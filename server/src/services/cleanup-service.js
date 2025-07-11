import { PrismaClient } from '@prisma/client';
import { deleteBlobsByPrefix } from './azure-storage.js';
import cron from 'node-cron';

const prisma = new PrismaClient();

// No need for separate blob client - using centralized azure-storage service

/**
 * Delete all blobs associated with a session
 * @param {string} sessionId - The session ID to cleanup blobs for
 * @param {string} blobPrefix - The blob prefix for the session (e.g., users/123/sessions/sessionId/)
 * @returns {Promise<number>} - Number of blobs deleted
 */
export async function cleanupSessionBlobs(sessionId, blobPrefix) {
  try {
    if (!blobPrefix) {
      console.warn(`No blob prefix found for session ${sessionId}, skipping blob cleanup`);
      return 0;
    }

    // Log the exact prefix being used for deletion
    console.log(`[CLEANUP] Deleting blobs for session ${sessionId} with prefix: ${blobPrefix}`);
    
    // Ensure the prefix ends with the session ID to prevent accidental deletion of other sessions
    if (!blobPrefix.includes(sessionId)) {
      console.error(`[CLEANUP] SAFETY CHECK FAILED: Blob prefix '${blobPrefix}' does not contain session ID '${sessionId}'`);
      throw new Error('Blob prefix does not match session ID - refusing to delete for safety');
    }
    
    // Use the centralized deleteBlobsByPrefix function which handles environment prefixes
    const deletedCount = await deleteBlobsByPrefix(blobPrefix);
    console.log(`[CLEANUP] Deleted ${deletedCount} blobs for session ${sessionId} (prefix: ${blobPrefix})`);
    
    return deletedCount;
  } catch (error) {
    console.error(`Error cleaning up blobs for session ${sessionId}:`, error.message);
    return 0;
  }
}

/**
 * Main cleanup function for expired sessions
 * Sessions have an expiresAt field set to 24 hours from creation time.
 * This function cleans up sessions that have passed their expiration date,
 * which aligns with Azure's 24-hour retention for polling data.
 * @returns {Promise<Object>} - Cleanup statistics
 */
export async function cleanupExpiredSessions() {
  const startTime = Date.now();
  const stats = {
    sessionsProcessed: 0,
    sessionsExpired: 0,
    jobsExpired: 0,
    blobsDeleted: 0,
    errors: []
  };

  try {
    console.log(`Starting cleanup process for sessions past their expiration date...`);

    const currentDate = new Date();

    // Find all sessions that have passed their expiration date
    // Sessions are created with expiresAt = createdAt + 24 hours
    const expiredSessions = await prisma.processingSession.findMany({
      where: {
        expiresAt: {
          lt: currentDate
        },
        status: {
          not: 'EXPIRED'
        }
      },
      include: {
        jobs: true
      }
    });

    stats.sessionsProcessed = expiredSessions.length;
    console.log(`Found ${expiredSessions.length} sessions to expire`);

    // Process each expired session
    for (const session of expiredSessions) {
      try {
        // Start a transaction to update session and jobs
        await prisma.$transaction(async (tx) => {
          // Update all non-completed jobs to EXPIRED
          const jobUpdateResult = await tx.job.updateMany({
            where: {
              sessionId: session.id,
              status: {
                notIn: ['COMPLETED', 'FAILED', 'EXPIRED']
              }
            },
            data: {
              status: 'EXPIRED',
              updatedAt: new Date()
            }
          });

          stats.jobsExpired += jobUpdateResult.count;

          // Update session status to EXPIRED
          await tx.processingSession.update({
            where: { id: session.id },
            data: {
              status: 'EXPIRED',
              updatedAt: new Date()
            }
          });

          stats.sessionsExpired++;
        });

        // Clean up Azure blobs for this session
        const blobsDeleted = await cleanupSessionBlobs(session.id, session.blobPrefix);
        stats.blobsDeleted += blobsDeleted;

        console.log(`Expired session ${session.id} (expired at: ${session.expiresAt.toISOString()}): ${session.jobs.length} jobs, ${blobsDeleted} blobs deleted`);
      } catch (error) {
        const errorMsg = `Failed to process session ${session.id}: ${error.message}`;
        console.error(errorMsg);
        stats.errors.push(errorMsg);
      }
    }

    // Also handle expired authentication sessions
    const expiredAuthSessions = await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });

    console.log(`Deleted ${expiredAuthSessions.count} expired authentication sessions`);

    // Log cleanup summary
    const duration = Date.now() - startTime;
    console.log('Cleanup completed:', {
      duration: `${duration}ms`,
      sessionsProcessed: stats.sessionsProcessed,
      sessionsExpired: stats.sessionsExpired,
      jobsExpired: stats.jobsExpired,
      blobsDeleted: stats.blobsDeleted,
      errors: stats.errors.length
    });

    // Store cleanup log in database
    await prisma.cleanupLog.create({
      data: {
        startedAt: new Date(startTime),
        completedAt: new Date(),
        sessionsProcessed: stats.sessionsProcessed,
        sessionsExpired: stats.sessionsExpired,
        jobsExpired: stats.jobsExpired,
        blobsDeleted: stats.blobsDeleted,
        errors: stats.errors.length > 0 ? JSON.stringify(stats.errors) : null,
        status: stats.errors.length > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED'
      }
    }).catch(err => {
      console.error('Failed to store cleanup log:', err.message);
    });

  } catch (error) {
    console.error('Cleanup process failed:', error);
    stats.errors.push(`Fatal error: ${error.message}`);

    // Try to log the failure
    await prisma.cleanupLog.create({
      data: {
        startedAt: new Date(startTime),
        completedAt: new Date(),
        sessionsProcessed: stats.sessionsProcessed,
        sessionsExpired: stats.sessionsExpired,
        jobsExpired: stats.jobsExpired,
        blobsDeleted: stats.blobsDeleted,
        errors: JSON.stringify(stats.errors),
        status: 'FAILED'
      }
    }).catch(err => {
      console.error('Failed to store cleanup error log:', err.message);
    });
  }

  return stats;
}

/**
 * Schedule recurring cleanup
 * @param {string} cronExpression - Cron expression for scheduling (default: daily at 2 AM)
 * @returns {Object} - Cron task object
 */
export function scheduleCleanup(cronExpression = '0 2 * * *') {
  console.log(`Scheduling cleanup with cron expression: ${cronExpression}`);
  
  const task = cron.schedule(cronExpression, async () => {
    console.log('Running scheduled cleanup...');
    await cleanupExpiredSessions();
  });

  task.start();
  console.log('Cleanup scheduled successfully');
  
  return task;
}

/**
 * Run cleanup once (for manual execution)
 */
export async function runCleanup() {
  try {
    const stats = await cleanupExpiredSessions();
    console.log('Manual cleanup completed:', stats);
    process.exit(0);
  } catch (error) {
    console.error('Manual cleanup failed:', error);
    process.exit(1);
  }
}

// Allow running as a script
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`Running manual cleanup for sessions past their expiration date...`);
  runCleanup();
}