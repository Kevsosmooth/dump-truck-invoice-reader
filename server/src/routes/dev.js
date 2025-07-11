import express from 'express';
import { prisma } from '../index.js';
import { deleteBlobsByPrefix } from '../services/azure-storage.js';
import { authenticateToken } from '../middleware/auth.js';
import { postProcessJob, postProcessSession } from '../services/post-processor.js';
import { debugSessionBlobs } from '../utils/debug-blobs.js';
import { cleanupIntermediateFiles, aggressiveCleanup } from '../services/storage-optimizer.js';
import sessionCleanupManager from '../services/session-cleanup-manager.js';

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

// Development only - fix stuck session
router.post('/fix-session/:sessionId', authenticateToken, async (req, res) => {
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
        userId 
      },
      include: {
        jobs: {
          where: {
            parentJobId: { not: null } // Only child jobs
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check job statuses
    const completedJobs = session.jobs.filter(j => j.status === 'COMPLETED').length;
    const totalJobs = session.jobs.length;

    console.log(`[FIX-SESSION] Session ${sessionId}:`);
    console.log(`  - Current status: ${session.status}`);
    console.log(`  - Total child jobs: ${totalJobs}`);
    console.log(`  - Completed jobs: ${completedJobs}`);

    if (completedJobs === totalJobs && session.status !== 'COMPLETED') {
      // Update session to completed
      await prisma.processingSession.update({
        where: { id: sessionId },
        data: { 
          status: 'COMPLETED',
          processedPages: session.totalPages
        }
      });

      console.log(`[FIX-SESSION] Updated session status to COMPLETED`);

      // Check if post-processing is needed
      const unprocessedJobs = await prisma.job.count({
        where: {
          sessionId,
          status: 'COMPLETED',
          processedFileUrl: null,
          parentJobId: { not: null }
        }
      });

      if (unprocessedJobs > 0) {
        console.log(`[FIX-SESSION] Running post-processing for ${unprocessedJobs} unprocessed jobs...`);
        await postProcessSession(sessionId);
      }

      return res.json({ 
        success: true,
        message: 'Session fixed and marked as completed',
        status: 'COMPLETED',
        completedJobs,
        totalJobs
      });
    } else if (completedJobs === totalJobs) {
      return res.json({ 
        success: true,
        message: 'Session already completed',
        status: session.status,
        completedJobs,
        totalJobs
      });
    } else {
      return res.json({ 
        success: false,
        message: 'Session has incomplete jobs',
        status: session.status,
        completedJobs,
        totalJobs,
        incomplete: totalJobs - completedJobs
      });
    }

  } catch (error) {
    console.error('Error fixing session:', error);
    res.status(500).json({ error: 'Failed to fix session' });
  }
});

// Storage cleanup endpoints
router.post('/cleanup-storage/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { aggressive = false, force = false } = req.body;
    
    console.log(`[DEV] Storage cleanup requested for session ${sessionId} (aggressive: ${aggressive}, force: ${force})`);
    
    // Verify session exists
    const session = await prisma.processingSession.findUnique({
      where: { id: sessionId },
      include: { jobs: true }
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Only check status if not forcing
    if (!force && session.status !== 'COMPLETED') {
      return res.status(400).json({ 
        error: 'Session must be completed before cleanup (use force: true to override)',
        status: session.status 
      });
    }
    
    let result;
    if (aggressive) {
      result = await aggressiveCleanup(sessionId);
    } else {
      result = await cleanupIntermediateFiles(sessionId);
    }
    
    res.json({
      success: true,
      sessionId,
      cleanupType: aggressive ? 'aggressive' : 'intermediate',
      filesDeleted: result.deleted,
      filesKept: result.kept,
      estimatedSpaceSaved: `~${result.deleted * 2}MB`
    });
    
  } catch (error) {
    console.error('Storage cleanup error:', error);
    res.status(500).json({ error: 'Storage cleanup failed' });
  }
});

// Get storage statistics for a session
router.get('/storage-stats/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await prisma.processingSession.findUnique({
      where: { id: sessionId },
      include: { jobs: true }
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Import listBlobsByPrefix
    const { listBlobsByPrefix } = await import('../services/azure-storage.js');
    
    // Get all blobs for this session
    const allBlobs = await listBlobsByPrefix(session.blobPrefix);
    
    // Categorize blobs
    const stats = {
      total: allBlobs.length,
      totalSize: 0,
      byCategory: {
        originals: { count: 0, size: 0 },
        pages: { count: 0, size: 0 },
        processed: { count: 0, size: 0 },
        other: { count: 0, size: 0 }
      },
      files: []
    };
    
    allBlobs.forEach(blob => {
      stats.totalSize += blob.size;
      stats.files.push({
        name: blob.name,
        size: blob.size,
        sizeFormatted: `${(blob.size / 1024 / 1024).toFixed(2)}MB`
      });
      
      if (blob.name.includes('/originals/')) {
        stats.byCategory.originals.count++;
        stats.byCategory.originals.size += blob.size;
      } else if (blob.name.includes('/pages/')) {
        stats.byCategory.pages.count++;
        stats.byCategory.pages.size += blob.size;
      } else if (blob.name.includes('/processed/')) {
        stats.byCategory.processed.count++;
        stats.byCategory.processed.size += blob.size;
      } else {
        stats.byCategory.other.count++;
        stats.byCategory.other.size += blob.size;
      }
    });
    
    // Format sizes
    Object.keys(stats.byCategory).forEach(category => {
      stats.byCategory[category].sizeFormatted = 
        `${(stats.byCategory[category].size / 1024 / 1024).toFixed(2)}MB`;
    });
    
    stats.totalSizeFormatted = `${(stats.totalSize / 1024 / 1024).toFixed(2)}MB`;
    stats.potentialSavings = `${((stats.byCategory.originals.size + stats.byCategory.pages.size) / 1024 / 1024).toFixed(2)}MB`;
    
    res.json({
      sessionId,
      status: session.status,
      storageStats: stats
    });
    
  } catch (error) {
    console.error('Error getting storage stats:', error);
    res.status(500).json({ error: 'Failed to get storage statistics' });
  }
});

// Development only - speed up session expiration for testing
router.post('/speed-up-expiration/:sessionId', authenticateToken, async (req, res) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'This endpoint is only available in development' });
    }

    const { sessionId } = req.params;
    const userId = req.user.id;
    
    // Verify session belongs to user and exists
    const session = await prisma.processingSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      select: {
        id: true,
        status: true,
        expiresAt: true,
      }
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Check if session is already expired
    if (session.status === 'EXPIRED') {
      return res.status(400).json({ 
        error: 'Session is already expired',
        status: session.status
      });
    }
    
    // Calculate new expiration time (1 minute from now)
    const newExpiresAt = new Date(Date.now() + 60 * 1000); // 1 minute
    
    console.log(`[DEV] Speeding up expiration for session ${sessionId}`);
    console.log(`  - Current expiration: ${session.expiresAt.toISOString()}`);
    console.log(`  - New expiration: ${newExpiresAt.toISOString()}`);
    
    // Use sessionCleanupManager to update expiration and reschedule cleanup
    await sessionCleanupManager.speedUpExpiration(sessionId, newExpiresAt);
    
    res.json({ 
      success: true, 
      message: `Session expiration updated to 1 minute from now`,
      sessionId,
      previousExpiresAt: session.expiresAt.toISOString(),
      newExpiresAt: newExpiresAt.toISOString(),
      expiresInSeconds: 60
    });

  } catch (error) {
    console.error('Error speeding up session expiration:', error);
    res.status(500).json({ 
      error: 'Failed to speed up session expiration',
      details: error.message 
    });
  }
});

export default router;