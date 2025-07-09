# Cleanup Service Documentation

## Overview
The cleanup service automatically manages expired sessions, jobs, and associated Azure blob storage. It prevents storage bloat and maintains database performance by removing old data.

## Features
- Scheduled cleanup for expired sessions (24+ hours old by default)
- Deletes associated blobs from Azure storage
- Updates job statuses to EXPIRED
- Updates session status to EXPIRED
- Comprehensive logging of cleanup activities
- Error handling and partial failure recovery
- Can be run manually or via cron job

## Main Functions

### `cleanupExpiredSessions(hoursThreshold = 24)`
Main cleanup function that:
- Finds all sessions older than the threshold
- Updates job and session statuses to EXPIRED
- Deletes associated Azure blobs
- Logs results to the database

### `cleanupSessionBlobs(sessionId)`
Deletes all Azure blobs associated with a specific session.

### `scheduleCleanup(cronExpression, hoursThreshold)`
Sets up recurring cleanup tasks using cron expressions.

## Usage

### Manual Cleanup
```bash
# Cleanup sessions older than 24 hours (default)
npm run cleanup

# Cleanup sessions older than 48 hours
npm run cleanup -- 48

# Test cleanup with 1 hour threshold
npm run cleanup:test
```

### Scheduled Cleanup
Add to your main application:

```javascript
import { initializeCleanupScheduler } from './services/cleanup-scheduler.js';

// Initialize with default settings (daily at 2 AM)
const cleanupTask = initializeCleanupScheduler();

// Custom schedule (every 6 hours)
const cleanupTask = initializeCleanupScheduler({
  schedule: '0 */6 * * *',
  hoursThreshold: 12
});
```

### Cron Job Setup
For system-level scheduling:

```bash
# Edit crontab
crontab -e

# Add daily cleanup at 2 AM
0 2 * * * /usr/bin/node /path/to/server/src/scripts/run-cleanup.js >> /var/log/cleanup.log 2>&1
```

## Environment Variables
```env
# Enable/disable automatic cleanup
ENABLE_AUTO_CLEANUP=true

# Cron expression for cleanup schedule
CLEANUP_SCHEDULE=0 2 * * *

# Hours threshold for session expiry
CLEANUP_HOURS_THRESHOLD=24

# Azure Storage settings (required for blob cleanup)
AZURE_STORAGE_CONNECTION_STRING=your-connection-string
AZURE_STORAGE_CONTAINER=invoices
```

## Database Schema
The service requires these Prisma models:
- `Session` - Authentication sessions with status field
- `ProcessingSession` - Processing sessions with jobs
- `Job` - Individual processing jobs
- `CleanupLog` - Cleanup operation logs

## Exit Codes
- `0` - Success
- `1` - Fatal error
- `2` - Completed with errors

## Monitoring
Check cleanup logs in the database:
```sql
SELECT * FROM CleanupLog ORDER BY createdAt DESC LIMIT 10;
```

## Common Cron Expressions
- `0 2 * * *` - Daily at 2 AM
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Weekly on Sunday
- `*/30 * * * *` - Every 30 minutes (testing)