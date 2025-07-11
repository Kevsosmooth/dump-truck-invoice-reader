# Session Auto-Cleanup Implementation

## Overview

The session auto-cleanup system implements a two-layer approach to handle expired sessions:

1. **UI Layer**: Immediately filters out expired sessions from the user interface
2. **Background Layer**: Periodically cleans up expired sessions and their associated files from storage

This dual approach ensures users never see expired sessions while the system efficiently manages storage cleanup in the background.

## Problem Statement

### Current Implementation Issues
- **Cron-based delays**: The current system runs cleanup every hour, meaning expired sessions remain visible for up to 59 minutes
- **Poor user experience**: Users see sessions they can no longer access or download
- **Storage inefficiency**: Files remain in storage longer than necessary
- **No immediate feedback**: Session expiration isn't reflected in real-time

## Solution Architecture

### SessionCleanupManager

A singleton service that manages both UI filtering and background cleanup operations:

```javascript
class SessionCleanupManager {
  constructor() {
    this.cleanupInterval = null;
    this.isRunning = false;
    this.lastCleanup = null;
    this.cleanupIntervalMs = process.env.CLEANUP_INTERVAL 
      ? parseInt(process.env.CLEANUP_INTERVAL) 
      : 3600000; // 1 hour default
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.runCleanup(); // Run immediately on start
    
    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.runCleanup();
    }, this.cleanupIntervalMs);
  }

  async runCleanup() {
    try {
      console.log('[SessionCleanupManager] Starting cleanup run...');
      this.lastCleanup = new Date();
      
      const result = await cleanupExpiredSessions();
      
      console.log('[SessionCleanupManager] Cleanup completed:', {
        sessionsDeleted: result.sessionsDeleted,
        filesDeleted: result.filesDeleted,
        errors: result.errors.length
      });
      
      return result;
    } catch (error) {
      console.error('[SessionCleanupManager] Cleanup failed:', error);
      throw error;
    }
  }

  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isRunning = false;
  }
}
```

## Implementation Details

### 1. UI Layer - Immediate Filtering

The frontend filters expired sessions before displaying them:

```javascript
// In SessionList component
const ActiveSessions = ({ sessions, onRefresh }) => {
  const activeSessions = useMemo(() => {
    return sessions.filter(session => {
      const expiresAt = new Date(session.expiresAt);
      return expiresAt > new Date();
    });
  }, [sessions]);

  return (
    <div>
      {activeSessions.length === 0 ? (
        <EmptyState message="No active sessions" />
      ) : (
        activeSessions.map(session => (
          <SessionCard key={session.id} session={session} />
        ))
      )}
    </div>
  );
};
```

### 2. Backend Layer - Background Cleanup

The cleanup service runs periodically to remove expired sessions:

```javascript
// cleanup-service.js
export async function cleanupExpiredSessions() {
  const stats = {
    sessionsDeleted: 0,
    filesDeleted: 0,
    errors: []
  };

  try {
    // Find all expired sessions
    const expiredSessions = await prisma.processingSessions.findMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      },
      include: {
        jobs: true
      }
    });

    // Process each expired session
    for (const session of expiredSessions) {
      try {
        // Delete associated files from blob storage
        const deleteResults = await deleteSessionFiles(session.id, session.userId);
        stats.filesDeleted += deleteResults.deleted;

        // Delete session from database (cascades to jobs)
        await prisma.processingSessions.delete({
          where: { id: session.id }
        });
        
        stats.sessionsDeleted++;
        
        // Log cleanup action
        await prisma.cleanupLog.create({
          data: {
            sessionId: session.id,
            userId: session.userId,
            filesDeleted: deleteResults.deleted,
            action: 'auto_cleanup'
          }
        });
      } catch (error) {
        stats.errors.push({
          sessionId: session.id,
          error: error.message
        });
      }
    }

    return stats;
  } catch (error) {
    console.error('[Cleanup] Failed to run cleanup:', error);
    throw error;
  }
}
```

### 3. API Endpoint Filtering

All API endpoints that return sessions filter out expired ones:

```javascript
// GET /api/sessions
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const sessions = await prisma.processingSessions.findMany({
      where: {
        userId: req.user.id,
        expiresAt: {
          gt: new Date() // Only return non-expired sessions
        }
      },
      include: {
        jobs: {
          select: {
            id: true,
            status: true,
            fileName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});
```

## Development Testing Features

### Speed-Up Cleanup Button

For development testing, implement a button to trigger immediate cleanup:

```javascript
// Development-only endpoint
if (process.env.NODE_ENV === 'development') {
  router.post('/dev/trigger-cleanup', authenticateToken, async (req, res) => {
    try {
      const result = await sessionCleanupManager.runCleanup();
      res.json({
        message: 'Cleanup triggered',
        result
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// Frontend component
const DevTools = () => {
  const [isLoading, setIsLoading] = useState(false);

  const triggerCleanup = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/dev/trigger-cleanup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      console.log('Cleanup result:', data);
      alert(`Cleanup completed: ${data.result.sessionsDeleted} sessions deleted`);
    } catch (error) {
      console.error('Cleanup failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-100 p-4 rounded shadow">
      <h3 className="font-bold mb-2">Dev Tools</h3>
      <button
        onClick={triggerCleanup}
        disabled={isLoading}
        className="bg-red-500 text-white px-4 py-2 rounded"
      >
        {isLoading ? 'Running...' : 'Trigger Cleanup'}
      </button>
    </div>
  );
};
```

## Testing Plan

### Test Scenarios

1. **Immediate UI Filtering**
   - Create a session with 5-minute expiration
   - Wait for expiration
   - Refresh page - session should not appear
   - Verify session still exists in database until cleanup

2. **Background Cleanup**
   - Create expired session
   - Trigger manual cleanup (dev mode)
   - Verify session removed from database
   - Verify files removed from blob storage
   - Check cleanup logs created

3. **Active Session Protection**
   - Create active session (24-hour expiration)
   - Run cleanup
   - Verify session remains unchanged
   - Verify files still accessible

4. **Concurrent Access**
   - Create session about to expire
   - Start download while cleanup runs
   - Verify appropriate error handling

### Testing with Shortened Expiration

For testing, temporarily set short expiration times:

```javascript
// In .env.development
SESSION_EXPIRATION_HOURS=0.083  # 5 minutes
CLEANUP_INTERVAL=60000          # 1 minute

// Or in code for specific tests
const testSession = await prisma.processingSessions.create({
  data: {
    ...sessionData,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
  }
});
```

## Benefits

### User Experience
- **Immediate feedback**: Expired sessions disappear instantly from UI
- **Clean interface**: Users only see actionable sessions
- **Clear expectations**: No confusion about session availability

### System Efficiency
- **Automated cleanup**: No manual intervention required
- **Resource optimization**: Storage freed up regularly
- **Audit trail**: Cleanup actions logged for tracking

### Developer Experience
- **Easy testing**: Dev tools for immediate cleanup
- **Clear separation**: UI logic separate from cleanup logic
- **Flexible configuration**: Configurable intervals and expiration

## Considerations

### Performance
- Cleanup runs in background, doesn't affect API response times
- Bulk operations for efficiency when deleting multiple sessions
- Indexed database queries on `expiresAt` field

### Error Handling
- Failed file deletions don't block session deletion
- Errors logged but cleanup continues
- Retry mechanism for transient failures

### Monitoring
- Cleanup logs track all operations
- Metrics available for deleted sessions/files
- Error tracking for failed operations

### Edge Cases
- Sessions being processed during cleanup are protected
- Download requests for expired sessions return appropriate errors
- Cleanup respects ongoing operations

## Configuration

### Environment Variables
```env
# Session expiration (default: 24 hours)
SESSION_EXPIRATION_HOURS=24

# Cleanup interval (default: 1 hour)
CLEANUP_INTERVAL=3600000

# Enable cleanup on startup (default: true)
AUTO_CLEANUP_ON_START=true

# Maximum files to delete per cleanup run (default: 1000)
CLEANUP_BATCH_SIZE=1000
```

### Database Indexes
```sql
-- Optimize cleanup queries
CREATE INDEX idx_processing_sessions_expires_at ON processing_sessions(expires_at);
CREATE INDEX idx_cleanup_logs_created_at ON cleanup_logs(created_at);
```

## Future Enhancements

1. **Webhook notifications** when sessions are about to expire
2. **Grace period** for recently expired sessions
3. **Archival option** instead of deletion
4. **Metrics dashboard** for cleanup operations
5. **Configurable retention** per user tier