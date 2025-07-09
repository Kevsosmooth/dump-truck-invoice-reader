import express from 'express';
import { prisma } from '../index.js';
import { deleteBlobsByPrefix } from '../services/azure-storage.js';
import { authenticateToken } from '../middleware/auth.js';
import { postProcessJob, postProcessSession } from '../services/post-processor.js';
import { debugSessionBlobs } from '../utils/debug-blobs.js';

const router = express.Router();

// Development only - clear all user sessions
router.delete('/clear-sessions', authenticateToken, async (req, res) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'This endpoint is only available in development' });
    }

    const userId = req.user.id;
    
    // Get all sessions for this user
    const sessions = await prisma.processingSession.findMany({
      where: { userId },
      select: {
        id: true,
        blobPrefix: true,
      }
    });

    // Delete from Azure Blob Storage
    for (const session of sessions) {
      if (session.blobPrefix) {
        try {
          await deleteBlobsByPrefix(session.blobPrefix);
        } catch (error) {
          console.error(`Failed to delete blobs for session ${session.id}:`, error);
        }
      }
    }

    // Delete all jobs for this user
    await prisma.job.deleteMany({
      where: { userId }
    });

    // Delete all sessions for this user
    const result = await prisma.processingSession.deleteMany({
      where: { userId }
    });

    res.json({ 
      success: true, 
      message: `Deleted ${result.count} sessions`,
      deletedCount: result.count 
    });

  } catch (error) {
    console.error('Error clearing sessions:', error);
    res.status(500).json({ error: 'Failed to clear sessions' });
  }
});

// Development only - reprocess a session
router.post('/reprocess-session/:sessionId', authenticateToken, async (req, res) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'This endpoint is only available in development' });
    }

    const { sessionId } = req.params;
    const userId = req.user.id;
    
    // Verify session belongs to user
    const session = await prisma.processingSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Run post-processing
    await postProcessSession(sessionId);
    
    res.json({ 
      success: true, 
      message: `Reprocessed session ${sessionId}`
    });
  } catch (error) {
    console.error('Error reprocessing session:', error);
    res.status(500).json({ error: 'Failed to reprocess session' });
  }
});

// Development only - debug session details
router.get('/session-debug/:sessionId', authenticateToken, async (req, res) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'This endpoint is only available in development' });
    }

    const { sessionId } = req.params;
    const userId = req.user.id;
    
    const session = await prisma.processingSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      include: {
        jobs: true,
      },
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Get detailed job info
    const jobDetails = await Promise.all(
      session.jobs.map(async (job) => ({
        id: job.id,
        fileName: job.fileName,
        status: job.status,
        hasExtractedFields: !!job.extractedFields,
        fieldsExtracted: job.extractedFields ? Object.keys(job.extractedFields).length : 0,
        hasProcessedFile: !!job.processedFileUrl,
        hasNewFileName: !!job.newFileName,
        newFileName: job.newFileName,
        blobUrl: job.blobUrl,
        processedFileUrl: job.processedFileUrl,
      }))
    );
    
    res.json({
      session: {
        id: session.id,
        status: session.status,
        blobPrefix: session.blobPrefix,
        totalFiles: session.totalFiles,
        totalPages: session.totalPages,
        processedPages: session.processedPages,
        createdAt: session.createdAt,
      },
      jobs: jobDetails,
      summary: {
        totalJobs: session.jobs.length,
        completedJobs: session.jobs.filter(j => j.status === 'COMPLETED').length,
        processedJobs: session.jobs.filter(j => j.processedFileUrl).length,
        renamedJobs: session.jobs.filter(j => j.newFileName).length,
      },
      blobDebug: await debugSessionBlobs(session.id, session.blobPrefix),
    });
  } catch (error) {
    console.error('Error debugging session:', error);
    res.status(500).json({ error: 'Failed to debug session' });
  }
});

export default router;