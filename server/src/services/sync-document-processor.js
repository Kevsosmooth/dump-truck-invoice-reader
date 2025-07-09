import { PrismaClient } from '@prisma/client';
import { processDocumentFromUrl } from './azure-document-ai.js';
import { generateSasUrl } from './azure-storage.js';
import { waitForToken } from './rate-limiter.js';
import { postProcessJob, postProcessSession } from './post-processor.js';

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
    // Example URL: https://dumptruckinvoicereader.blob.core.windows.net/documents/users/1/sessions/uuid/originals/file.pdf
    const url = new URL(job.blobUrl);
    const pathParts = url.pathname.split('/');
    // Remove the container name (first part after /)
    const blobPath = decodeURIComponent(pathParts.slice(2).join('/'));
    
    console.log(`Generating SAS URL for blob: ${blobPath}`);
    
    // Generate SAS URL for the blob (1 hour expiry)
    const { sasUrl } = await generateSasUrl(blobPath, 1);
    
    console.log(`Generated SAS URL: ${sasUrl}`);
    console.log(`Using model: ${modelId}`);

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

    // Deduct credits from user
    await prisma.user.update({
      where: { id: userId },
      data: {
        credits: {
          decrement: 1,
        },
      },
    });

    // Check if all jobs in session are complete
    const session = await prisma.processingSession.findUnique({
      where: { id: sessionId },
      include: {
        jobs: {
          where: { status: { not: 'COMPLETED' } },
        },
      },
    });

    if (session && session.jobs.length === 0) {
      // All jobs complete
      await prisma.processingSession.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED' },
      });
    }

    console.log(`✅ Job ${jobId} completed successfully`);
    
    // Post-process the job to rename and organize files
    await postProcessJob(jobId);
    
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
    },
  });

  console.log(`Processing ${jobs.length} jobs for session ${sessionId} with model ${session.modelId}`);

  // Process jobs sequentially to respect rate limits
  for (const job of jobs) {
    try {
      await processDocumentSync({
        jobId: job.id,
        sessionId: job.sessionId,
        userId: job.userId,
        modelId: session.modelId, // Use modelId from session
      });
    } catch (error) {
      console.error(`Failed to process job ${job.id}:`, error);
      // Continue with other jobs even if one fails
    }
  }
  
  // Post-process the entire session after all jobs are done
  await postProcessSession(sessionId);
}