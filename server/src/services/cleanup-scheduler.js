/**
 * Example integration for cleanup scheduler
 * Add this to your main application file to enable automatic cleanup
 */

import { scheduleCleanup } from './cleanup-service.js';

/**
 * Initialize cleanup scheduler
 * @param {Object} options - Configuration options
 * @param {string} options.schedule - Cron expression (default: daily at 2 AM)
 * @param {number} options.hoursThreshold - Hours until session expiry (default: 24)
 * @param {boolean} options.enabled - Whether to enable automatic cleanup (default: true)
 */
export function initializeCleanupScheduler(options = {}) {
  const {
    schedule = '0 2 * * *',  // Daily at 2 AM
    hoursThreshold = 24,
    enabled = true
  } = options;

  if (!enabled) {
    console.log('Cleanup scheduler is disabled');
    return null;
  }

  // Common cron expressions:
  // '0 2 * * *'     - Daily at 2 AM
  // '0 */6 * * *'   - Every 6 hours
  // '0 0 * * 0'     - Weekly on Sunday at midnight
  // '*/30 * * * *'  - Every 30 minutes (for testing)

  const task = scheduleCleanup(schedule, hoursThreshold);
  
  console.log(`Cleanup scheduler initialized:`);
  console.log(`- Schedule: ${schedule}`);
  console.log(`- Hours threshold: ${hoursThreshold}`);
  console.log(`- Next run: ${task.nextDates(1)[0].toISOString()}`);

  return task;
}

// Example usage in your main application:
/*
// In your server initialization code (e.g., index.js):

import { initializeCleanupScheduler } from './services/cleanup-scheduler.js';

// Initialize cleanup scheduler based on environment
const cleanupTask = initializeCleanupScheduler({
  enabled: process.env.ENABLE_AUTO_CLEANUP !== 'false',
  schedule: process.env.CLEANUP_SCHEDULE || '0 2 * * *',
  hoursThreshold: parseInt(process.env.CLEANUP_HOURS_THRESHOLD) || 24
});

// Graceful shutdown
process.on('SIGTERM', () => {
  if (cleanupTask) {
    cleanupTask.stop();
    console.log('Cleanup scheduler stopped');
  }
});
*/