import { deleteBlob, listBlobsByPrefix } from './azure-storage.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Clean up original and page files after session processing is complete
 * Keeps only the processed files for download
 */
export async function cleanupIntermediateFiles(sessionId) {
  try {
    // Get session to find blob prefix
    const session = await prisma.processingSession.findUnique({
      where: { id: sessionId },
      include: { jobs: true }
    });

    if (!session || !session.blobPrefix) {
      console.log(`Session ${sessionId} not found or has no blob prefix`);
      return { deleted: 0, kept: 0 };
    }

    // Check if all jobs are completed - only check child jobs (not parent jobs)
    const childJobs = session.jobs.filter(job => job.parentJobId !== null);
    const allJobsCompleted = childJobs.length > 0 && childJobs.every(job => 
      job.status === 'COMPLETED'
    );

    if (!allJobsCompleted) {
      console.log(`Session ${sessionId} still processing, skipping cleanup`);
      console.log(`Child jobs: ${childJobs.length}, Completed: ${childJobs.filter(j => j.status === 'COMPLETED').length}`);
      return { deleted: 0, kept: 0 };
    }
    
    // Also check if we have processed files
    const hasProcessedFiles = childJobs.some(job => job.processedFileUrl || job.newFileName);
    if (!hasProcessedFiles) {
      console.log(`Session ${sessionId} has no processed files yet, skipping cleanup`);
      return { deleted: 0, kept: 0 };
    }

    console.log(`\n[STORAGE CLEANUP] Starting cleanup for session ${sessionId}`);
    
    let deletedCount = 0;
    let keptCount = 0;

    // List all blobs for this session
    const allBlobs = await listBlobsByPrefix(session.blobPrefix);
    
    console.log(`[STORAGE CLEANUP] Found ${allBlobs.length} total blobs for session`);
    
    for (const blob of allBlobs) {
      const blobName = blob.name;
      
      // Keep processed files, delete originals and pages
      if (blobName.includes('/processed/')) {
        console.log(`[KEEP] ${blobName}`);
        keptCount++;
      } else if (blobName.includes('/originals/') || blobName.includes('/pages/')) {
        try {
          // The blob name already includes the environment prefix from listBlobsByPrefix
          // but deleteBlob will add it again, so we need to remove it
          const { getEnvironmentPrefix } = await import('./azure-storage.js');
          const envPrefix = getEnvironmentPrefix();
          const pathWithoutPrefix = blobName.startsWith(envPrefix) 
            ? blobName.slice(envPrefix.length) 
            : blobName;
            
          await deleteBlob(pathWithoutPrefix);
          console.log(`[DELETE] ${blobName}`);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete ${blobName}:`, error.message);
        }
      }
    }

    console.log(`[STORAGE CLEANUP] Complete: Deleted ${deletedCount} files, kept ${keptCount} files`);
    console.log(`[STORAGE CLEANUP] Space saved: ~${deletedCount * 2}MB (estimated)\n`);

    return { deleted: deletedCount, kept: keptCount };
  } catch (error) {
    console.error('Error in storage cleanup:', error);
    return { deleted: 0, kept: 0 };
  }
}

/**
 * Aggressive cleanup - keeps ONLY processed files, deletes even originals
 * Use with caution - no way to reprocess after this
 */
export async function aggressiveCleanup(sessionId) {
  try {
    const session = await prisma.processingSession.findUnique({
      where: { id: sessionId },
      include: { jobs: true }
    });

    if (!session || !session.blobPrefix) {
      return { deleted: 0, kept: 0 };
    }

    console.log(`\n[AGGRESSIVE CLEANUP] Starting for session ${sessionId}`);
    
    let deletedCount = 0;
    let keptCount = 0;
    
    // Import extractBlobPath
    const { extractBlobPath } = await import('./azure-storage.js');

    // For each job, keep ONLY the processed file URL
    for (const job of session.jobs) {
      if (job.processedFileUrl && job.blobUrl && job.blobUrl !== job.processedFileUrl) {
        try {
          // Extract and delete the original
          const originalPath = extractBlobPath(job.blobUrl);
          await deleteBlob(originalPath);
          deletedCount++;
          console.log(`[DELETE] Original: ${originalPath}`);
        } catch (error) {
          console.error(`Failed to delete original:`, error.message);
        }
      }
    }

    // Delete all pages
    const pageBlobs = await listBlobsByPrefix(`${session.blobPrefix}pages/`);
    for (const blob of pageBlobs) {
      try {
        await deleteBlob(blob.name);
        deletedCount++;
        console.log(`[DELETE] Page: ${blob.name}`);
      } catch (error) {
        console.error(`Failed to delete page:`, error.message);
      }
    }

    // Count kept files
    const processedBlobs = await listBlobsByPrefix(`${session.blobPrefix}processed/`);
    keptCount = processedBlobs.length;

    console.log(`[AGGRESSIVE CLEANUP] Complete: Deleted ${deletedCount} files, kept ${keptCount} files\n`);

    return { deleted: deletedCount, kept: keptCount };
  } catch (error) {
    console.error('Error in aggressive cleanup:', error);
    return { deleted: 0, kept: 0 };
  }
}