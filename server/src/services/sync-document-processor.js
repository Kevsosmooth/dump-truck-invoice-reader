import { PrismaClient } from '@prisma/client';
import { processDocumentFromUrl } from './azure-document-ai.js';
import { generateSasUrl, extractBlobPath } from './azure-storage.js';
import { waitForToken } from './rate-limiter.js';
import { postProcessJob, postProcessSession } from './post-processor.js';
import { cleanupIntermediateFiles } from './storage-optimizer.js';

const prisma = new PrismaClient();

/**
 * Process a document job synchronously
 */
export async function processDocumentSync(jobData) {
  const { jobId, sessionId, userId, modelId } = jobData;
  
  try {
    // Get job details
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Update job status to PROCESSING
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'PROCESSING' },
    });

    // Extract blob path from URL
    const blobPath = extractBlobPath(job.blobUrl);
    
    console.log(`[AZURE] Generating SAS URL for: ${blobPath}`);
    
    // Generate SAS URL for the blob (1 hour expiry)
    const { sasUrl } = await generateSasUrl(blobPath, 1);
    
    console.log(`[AZURE] Starting document analysis with model: ${modelId}`);

    // Wait for rate limit token
    await waitForToken();

    // Process with Azure using the URL
    const result = await processDocumentFromUrl(sasUrl, job.fileName, modelId);

    // Update job with results
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        extractedFields: {
          ...result.fields,
          _confidence: result.confidence // Store confidence in the fields
        },
        completedAt: new Date(),
        pagesProcessed: 1,
        creditsUsed: 1,
      },
    });

    // Update session progress
    await prisma.processingSession.update({
      where: { id: sessionId },
      data: {
        processedPages: {
          increment: 1,
        },
      },
    });

    // Deduct credits from user (except for admin with ID 1)
    if (userId !== 1) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          credits: {
            decrement: 1,
          },
        },
      });
    } else {
      console.log(`[CREDITS] Admin user (ID: 1) - credits not deducted`);
    }

    // Check if all child jobs in session are complete
    const remainingJobs = await prisma.job.count({
      where: { 
        sessionId,
        status: { not: 'COMPLETED' },
        parentJobId: { not: null } // Only check child jobs
      },
    });

    if (remainingJobs === 0) {
      // All child jobs complete
      console.log(`All jobs complete for session ${sessionId}, marking session as COMPLETED`);
      await prisma.processingSession.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED' },
      });
    }

    console.log(`✅ Job ${jobId} completed successfully`);
    
    // Don't post-process here - we'll do it all at once after all jobs complete
    
    return result;

  } catch (error) {
    console.error(`❌ Error processing job ${jobId}:`, error);
    
    // Update job status to FAILED
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        error: error.message,
      },
    });

    // Update session status if needed
    const failedJobsCount = await prisma.job.count({
      where: {
        sessionId,
        status: 'FAILED',
      },
    });

    if (failedJobsCount > 0) {
      await prisma.processingSession.update({
        where: { id: sessionId },
        data: { status: 'FAILED' },
      });
    }

    throw error;
  }
}

/**
 * Process all pending jobs for a session
 */
export async function processSessionJobs(sessionId) {
  // First get the session to get the modelId
  const session = await prisma.processingSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const jobs = await prisma.job.findMany({
    where: {
      sessionId,
      status: 'QUEUED',
      parentJobId: { not: null }, // Only get child jobs that need processing
    },
  });

  console.log('\n========================================');
  console.log(`[PROCESSING] Starting session ${sessionId}`);
  console.log(`[PROCESSING] Model: ${session.modelId}`);
  console.log(`[PROCESSING] Jobs to process: ${jobs.length}`);
  console.log('========================================\n');

  // Process jobs sequentially to respect rate limits
  let processedCount = 0;
  for (const job of jobs) {
    try {
      processedCount++;
      console.log(`\n[PROCESSING] Job ${processedCount}/${jobs.length}: ${job.fileName}`);
      
      await processDocumentSync({
        jobId: job.id,
        sessionId: job.sessionId,
        userId: job.userId,
        modelId: session.modelId, // Use modelId from session
      });
      
      console.log(`[PROCESSING] ✅ Completed ${processedCount}/${jobs.length}`);
    } catch (error) {
      console.error(`[PROCESSING] ❌ Failed job ${job.id}:`, error.message);
      // Continue with other jobs even if one fails
    }
  }
  
  console.log('\n========================================');
  console.log(`[PROCESSING COMPLETE] Session ${sessionId}`);
  console.log(`[PROCESSING COMPLETE] Total processed: ${processedCount}/${jobs.length}`);
  console.log('========================================\n');
  
  // Update session status to COMPLETED if all jobs are done
  const failedJobs = await prisma.job.count({
    where: {
      sessionId,
      status: 'FAILED',
      parentJobId: { not: null }
    }
  });

  if (failedJobs === 0 && processedCount === jobs.length) {
    console.log(`[SESSION] All jobs completed successfully, marking session as COMPLETED`);
    await prisma.processingSession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED' }
    });
  } else if (failedJobs > 0) {
    console.log(`[SESSION] ${failedJobs} jobs failed, marking session as FAILED`);
    await prisma.processingSession.update({
      where: { id: sessionId },
      data: { status: 'FAILED' }
    });
  }
  
  // Post-process the entire session after all jobs are done
  await postProcessSession(sessionId);
  
  // Clean up intermediate files to save storage space
  if (failedJobs === 0 && processedCount === jobs.length) {
    // Add a small delay to ensure post-processing is fully complete
    console.log(`[STORAGE] Scheduling cleanup for completed session ${sessionId}`);
    setTimeout(async () => {
      try {
        console.log(`[STORAGE] Starting cleanup for session ${sessionId}`);
        const cleanupResult = await cleanupIntermediateFiles(sessionId);
        console.log(`[STORAGE] Cleanup complete: deleted ${cleanupResult.deleted} files, kept ${cleanupResult.kept} files`);
      } catch (error) {
        console.error(`[STORAGE] Cleanup failed for session ${sessionId}:`, error);
      }
    }, 5000); // 5 second delay
  }
}