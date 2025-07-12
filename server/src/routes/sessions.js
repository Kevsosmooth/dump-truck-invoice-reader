import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// POST /create - Create new processing session
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description } = req.body;

    // Calculate expiry time (24 hours from now)
    const expiryTime = new Date();
    expiryTime.setHours(expiryTime.getHours() + 24);

    const session = await prisma.processingSession.create({
      data: {
        name: name || `Session ${new Date().toISOString()}`,
        description: description || '',
        status: 'pending',
        userId,
        expiresAt: expiryTime,
        metadata: {}
      },
      include: {
        jobs: true
      }
    });

    res.status(201).json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create processing session'
    });
  }
});

// GET /:sessionId - Get session status with job details
router.get('/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await prisma.processingSession.findFirst({
      where: {
        id: sessionId,
        userId // Ensure user owns the session
      },
      include: {
        jobs: {
          include: {
            processingResults: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or access denied'
      });
    }

    // Check if session has expired
    const isExpired = new Date() > new Date(session.expiresAt);
    
    // Calculate overall progress
    const totalJobs = session.jobs.length;
    const completedJobs = session.jobs.filter(job => 
      ['completed', 'failed'].includes(job.status)
    ).length;
    const progress = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

    // Calculate post-processing progress
    const postProcessingProgress = session.totalPages > 0 
      ? (session.postProcessedCount / session.totalPages) * 100 
      : 0;

    res.json({
      success: true,
      session: {
        ...session,
        isExpired,
        progress,
        postProcessingProgress,
        stats: {
          total: totalJobs,
          completed: session.jobs.filter(j => j.status === 'completed').length,
          failed: session.jobs.filter(j => j.status === 'failed').length,
          processing: session.jobs.filter(j => j.status === 'processing').length,
          pending: session.jobs.filter(j => j.status === 'pending').length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch session details'
    });
  }
});

// DELETE /:sessionId - Cancel session and clean up
router.delete('/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // First check if user owns the session
    const session = await prisma.processingSession.findFirst({
      where: {
        id: sessionId,
        userId
      },
      include: {
        jobs: true
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or access denied'
      });
    }

    // Cancel any pending or processing jobs
    const jobsToCancel = session.jobs.filter(job => 
      ['pending', 'processing'].includes(job.status)
    );

    if (jobsToCancel.length > 0) {
      await prisma.processingJob.updateMany({
        where: {
          id: {
            in: jobsToCancel.map(job => job.id)
          }
        },
        data: {
          status: 'cancelled',
          updatedAt: new Date()
        }
      });
    }

    // Update session status
    await prisma.processingSession.update({
      where: {
        id: sessionId
      },
      data: {
        status: 'cancelled',
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Session cancelled successfully',
      cancelledJobs: jobsToCancel.length
    });
  } catch (error) {
    console.error('Error cancelling session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel session'
    });
  }
});

// GET /:sessionId/progress - Get real-time progress
router.get('/:sessionId/progress', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await prisma.processingSession.findFirst({
      where: {
        id: sessionId,
        userId
      },
      include: {
        jobs: {
          select: {
            id: true,
            status: true,
            fileName: true,
            progress: true,
            createdAt: true,
            updatedAt: true,
            error: true
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or access denied'
      });
    }

    // Calculate detailed progress
    const jobs = session.jobs;
    const totalJobs = jobs.length;
    const jobsByStatus = {
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      pending: jobs.filter(j => j.status === 'pending').length,
      cancelled: jobs.filter(j => j.status === 'cancelled').length
    };

    // Calculate overall progress percentage
    const finishedJobs = jobsByStatus.completed + jobsByStatus.failed + jobsByStatus.cancelled;
    const overallProgress = totalJobs > 0 ? (finishedJobs / totalJobs) * 100 : 0;

    // Get current processing jobs with their individual progress
    const processingJobs = jobs
      .filter(j => j.status === 'processing')
      .map(job => ({
        id: job.id,
        fileName: job.fileName,
        progress: job.progress || 0
      }));

    // Estimate time remaining based on average processing time
    const completedJobs = jobs.filter(j => j.status === 'completed');
    let estimatedTimeRemaining = null;
    
    if (completedJobs.length > 0) {
      const avgProcessingTime = completedJobs.reduce((sum, job) => {
        const duration = new Date(job.updatedAt) - new Date(job.createdAt);
        return sum + duration;
      }, 0) / completedJobs.length;

      const remainingJobs = jobsByStatus.pending + jobsByStatus.processing;
      estimatedTimeRemaining = Math.round((avgProcessingTime * remainingJobs) / 1000); // in seconds
    }

    res.json({
      success: true,
      progress: {
        sessionId,
        status: session.status,
        overallProgress: Math.round(overallProgress * 100) / 100,
        totalJobs,
        jobsByStatus,
        processingJobs,
        estimatedTimeRemaining,
        isExpired: new Date() > new Date(session.expiresAt),
        expiresAt: session.expiresAt,
        lastUpdated: session.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching session progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch session progress'
    });
  }
});

// GET /:sessionId/post-processing-status - Get post-processing status
router.get('/:sessionId/post-processing-status', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await prisma.processingSession.findFirst({
      where: {
        id: sessionId,
        userId
      },
      select: {
        id: true,
        postProcessingStatus: true,
        postProcessedCount: true,
        totalPages: true,
        postProcessingStartedAt: true,
        postProcessingCompletedAt: true,
        status: true,
        jobs: {
          select: {
            id: true,
            status: true
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or access denied'
      });
    }

    // Calculate percentage complete
    const percentComplete = session.totalPages > 0 
      ? Math.round((session.postProcessedCount / session.totalPages) * 100 * 100) / 100
      : 0;

    // Check if post-processing is complete
    const isComplete = session.postProcessingStatus === 'COMPLETED';

    // Estimate time remaining
    let estimatedTimeRemaining = null;
    if (session.postProcessingStatus === 'PROCESSING' && 
        session.postProcessingStartedAt && 
        session.postProcessedCount > 0 && 
        session.postProcessedCount < session.totalPages) {
      
      const elapsedTime = new Date() - new Date(session.postProcessingStartedAt);
      const avgTimePerPage = elapsedTime / session.postProcessedCount;
      const remainingPages = session.totalPages - session.postProcessedCount;
      estimatedTimeRemaining = Math.round((avgTimePerPage * remainingPages) / 1000); // in seconds
    }

    // Check if all jobs are completed before post-processing can start
    const allJobsCompleted = session.jobs.every(job => 
      ['completed', 'failed', 'cancelled'].includes(job.status)
    );

    res.json({
      success: true,
      postProcessingStatus: {
        sessionId,
        postProcessingStatus: session.postProcessingStatus || 'NOT_STARTED',
        postProcessedCount: session.postProcessedCount,
        totalPages: session.totalPages,
        percentComplete,
        isComplete,
        estimatedTimeRemaining,
        postProcessingStartedAt: session.postProcessingStartedAt,
        postProcessingCompletedAt: session.postProcessingCompletedAt,
        canStartPostProcessing: allJobsCompleted && session.status === 'completed',
        sessionStatus: session.status
      }
    });
  } catch (error) {
    console.error('Error fetching post-processing status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch post-processing status'
    });
  }
});

// Optional: Update session metadata
router.patch('/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    const { name, description, metadata } = req.body;

    // Check ownership
    const session = await prisma.processingSession.findFirst({
      where: {
        id: sessionId,
        userId
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or access denied'
      });
    }

    // Update session
    const updatedSession = await prisma.processingSession.update({
      where: {
        id: sessionId
      },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(metadata && { metadata }),
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      session: updatedSession
    });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update session'
    });
  }
});

export default router;