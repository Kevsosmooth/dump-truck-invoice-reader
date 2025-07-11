import { PrismaClient } from '@prisma/client';
import { cleanupSessionBlobs } from './cleanup-service.js';

const prisma = new PrismaClient();

class SessionCleanupManager {
  constructor() {
    if (SessionCleanupManager.instance) {
      return SessionCleanupManager.instance;
    }

    // Map to track scheduled cleanups (sessionId -> timeoutId)
    this.scheduledCleanups = new Map();
    
    SessionCleanupManager.instance = this;
    console.log('[SessionCleanupManager] Initialized');
  }

  /**
   * Schedule cleanup for a session at its expiration time
   * @param {string} sessionId - The session ID to schedule cleanup for
   * @param {Date} expiresAt - When the session expires
   */
  scheduleCleanup(sessionId, expiresAt) {
    try {
      // Cancel any existing cleanup for this session
      this.cancelCleanup(sessionId);

      const now = new Date();
      const expirationTime = new Date(expiresAt);
      const delay = expirationTime.getTime() - now.getTime();

      // If already expired, cleanup immediately
      if (delay <= 0) {
        console.log(`Session ${sessionId} already expired, cleaning up immediately`);
        this.performCleanup(sessionId);
        return;
      }

      // Schedule cleanup at expiration time
      const timeoutId = setTimeout(() => {
        console.log(`Executing scheduled cleanup for session ${sessionId}`);
        this.performCleanup(sessionId);
      }, delay);

      this.scheduledCleanups.set(sessionId, timeoutId);
      
      console.log(`Scheduled cleanup for session ${sessionId} in ${Math.round(delay / 1000)} seconds`);
    } catch (error) {
      console.error(`Error scheduling cleanup for session ${sessionId}:`, error);
    }
  }

  /**
   * Cancel a scheduled cleanup
   * @param {string} sessionId - The session ID to cancel cleanup for
   */
  cancelCleanup(sessionId) {
    const timeoutId = this.scheduledCleanups.get(sessionId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.scheduledCleanups.delete(sessionId);
      console.log(`Cancelled cleanup for session ${sessionId}`);
    }
  }

  /**
   * Perform the actual cleanup for a session
   * @param {string} sessionId - The session ID to clean up
   */
  async performCleanup(sessionId) {
    try {
      // Remove from scheduled cleanups
      this.scheduledCleanups.delete(sessionId);

      // Get session details
      const session = await prisma.processingSession.findUnique({
        where: { id: sessionId },
        include: { user: true }
      });

      if (!session) {
        console.warn(`Session ${sessionId} not found for cleanup`);
        return;
      }

      // Check if already expired
      if (session.status === 'EXPIRED') {
        console.log(`Session ${sessionId} already marked as expired`);
        return;
      }

      console.log(`Starting cleanup for session ${sessionId}`);

      // Delete files from blob storage
      let deleted = 0;
      if (session.userId) {
        deleted = await cleanupSessionBlobs(sessionId, session.blobPrefix);
        console.log(`Deleted ${deleted} files for session ${sessionId}`);
      }

      // Update session status to expired
      await prisma.processingSession.update({
        where: { id: sessionId },
        data: { 
          status: 'EXPIRED'
        }
      });

      // Log cleanup in audit log
      if (session.userId) {
        await prisma.auditLog.create({
          data: {
            userId: session.userId,
            eventType: 'SESSION_EXPIRED',
            eventData: {
              sessionId: sessionId,
              performedBy: 'scheduled_cleanup',
              expiresAt: session.expiresAt.toISOString(),
              filesDeleted: deleted > 0
            }
          }
        });
      }

      console.log(`Successfully cleaned up session ${sessionId}`);
    } catch (error) {
      console.error(`Error performing cleanup for session ${sessionId}:`, error);
    }
  }

  /**
   * Reschedule all active sessions (called on server startup)
   */
  async rescheduleAllSessions() {
    try {
      console.log('Rescheduling cleanup for all active sessions');

      // Find all sessions that need cleanup scheduling
      const sessions = await prisma.processingSession.findMany({
        where: {
          status: { not: 'EXPIRED' }
        },
        select: {
          id: true,
          expiresAt: true
        }
      });

      let scheduledCount = 0;
      let expiredCount = 0;

      for (const session of sessions) {
        const now = new Date();
        if (session.expiresAt <= now) {
          // Already expired, cleanup immediately
          await this.performCleanup(session.id);
          expiredCount++;
        } else {
          // Schedule future cleanup
          this.scheduleCleanup(session.id, session.expiresAt);
          scheduledCount++;
        }
      }

      console.log(`Cleanup rescheduling complete: ${scheduledCount} scheduled, ${expiredCount} expired`);
    } catch (error) {
      console.error('Error rescheduling sessions:', error);
    }
  }

  /**
   * Speed up expiration for development testing
   * @param {string} sessionId - The session ID to speed up
   * @param {Date} newExpiresAt - New expiration time
   */
  async speedUpExpiration(sessionId, newExpiresAt) {
    try {
      // Update database
      await prisma.processingSession.update({
        where: { id: sessionId },
        data: { expiresAt: newExpiresAt }
      });

      // Reschedule cleanup
      this.scheduleCleanup(sessionId, newExpiresAt);
      
      console.log(`Updated expiration for session ${sessionId} to ${newExpiresAt.toISOString()}`);
    } catch (error) {
      console.error(`Error speeding up expiration for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get status of all scheduled cleanups
   */
  getScheduledCleanups() {
    return Array.from(this.scheduledCleanups.keys());
  }

  /**
   * Clear all scheduled cleanups (useful for shutdown)
   */
  clearAllCleanups() {
    for (const [sessionId, timeoutId] of this.scheduledCleanups) {
      clearTimeout(timeoutId);
    }
    this.scheduledCleanups.clear();
    console.log('Cleared all scheduled cleanups');
  }
}

// Export singleton instance
export default new SessionCleanupManager();