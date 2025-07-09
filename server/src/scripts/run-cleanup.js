#!/usr/bin/env node

/**
 * Cleanup script for expired sessions
 * Can be run manually or via cron job
 * 
 * Usage:
 *   node run-cleanup.js [hours]
 *   
 * Examples:
 *   node run-cleanup.js        # Cleanup sessions older than 24 hours (default)
 *   node run-cleanup.js 48     # Cleanup sessions older than 48 hours
 *   
 * For cron job (daily at 2 AM):
 *   0 2 * * * /usr/bin/node /path/to/run-cleanup.js >> /var/log/cleanup.log 2>&1
 */

import dotenv from 'dotenv';
import { cleanupExpiredSessions } from '../services/cleanup-service.js';

dotenv.config();

async function main() {
  const hoursThreshold = process.argv[2] ? parseInt(process.argv[2]) : 24;
  
  if (isNaN(hoursThreshold) || hoursThreshold <= 0) {
    console.error('Invalid hours threshold. Please provide a positive number.');
    process.exit(1);
  }

  console.log(`Starting cleanup for sessions older than ${hoursThreshold} hours...`);
  console.log('Timestamp:', new Date().toISOString());
  console.log('Environment:', process.env.NODE_ENV || 'development');
  
  try {
    const stats = await cleanupExpiredSessions(hoursThreshold);
    
    console.log('\nCleanup completed successfully:');
    console.log(`- Sessions processed: ${stats.sessionsProcessed}`);
    console.log(`- Sessions expired: ${stats.sessionsExpired}`);
    console.log(`- Jobs expired: ${stats.jobsExpired}`);
    console.log(`- Blobs deleted: ${stats.blobsDeleted}`);
    
    if (stats.errors.length > 0) {
      console.log(`- Errors encountered: ${stats.errors.length}`);
      stats.errors.forEach((error, index) => {
        console.error(`  ${index + 1}. ${error}`);
      });
      process.exit(2); // Exit with code 2 to indicate partial success
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Cleanup failed with fatal error:', error);
    process.exit(1);
  }
}

main();