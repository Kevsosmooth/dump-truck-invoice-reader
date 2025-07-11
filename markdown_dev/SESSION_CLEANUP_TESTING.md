# Session Auto-Cleanup Testing Guide

## Overview
This guide provides step-by-step instructions for testing the new session auto-cleanup feature, including the development speed-up functionality.

## Prerequisites
1. Ensure `NODE_ENV=development` in your `.env` file
2. Both frontend and backend should be running in development mode
3. Have at least one PDF file ready for upload

## Test Scenarios

### Test 1: Speed Up Expiration (Primary Test)
1. **Upload a PDF file**
   - Go to the dashboard
   - Upload one or more PDF files
   - Wait for processing to complete

2. **Verify Session in List**
   - Check that the session appears in the "Recent Processing Sessions" list
   - Note the "Expires" column showing ~24 hours

3. **Speed Up Expiration**
   - Click the amber "Speed Up" button (only visible in development)
   - You should see an alert confirming the expiration was updated
   - The session list will refresh automatically

4. **Monitor for 1 Minute**
   - The "Expires" column should now show "1m" or less
   - Wait for the minute to pass
   - The session should disappear from the list automatically

5. **Verify Cleanup**
   - Check server logs for cleanup messages
   - Verify the session no longer appears in the list
   - Try to download (should fail with "session expired" message)

### Test 2: UI Filtering (Immediate Effect)
1. **Database Manipulation** (Advanced)
   - Manually update a session's `expiresAt` to a past time in the database
   - Refresh the dashboard
   - The expired session should not appear

### Test 3: Server Restart Recovery
1. **Create a Session**
   - Upload files and note the session ID
   - Speed up the expiration to 5 minutes (modify the endpoint temporarily)

2. **Restart Server**
   - Stop the backend server (Ctrl+C)
   - Start it again (`npm run dev`)
   - Check logs for "Rescheduling cleanups for existing sessions"

3. **Verify Rescheduling**
   - The session should still expire at the scheduled time
   - Monitor logs for cleanup execution

### Test 4: Normal 24-Hour Expiration
1. **Create a Session** (without speed-up)
2. **Note the Time**
3. **Check After 24 Hours**
   - Session should be automatically cleaned up
   - No manual intervention required

## What to Look For

### In the Frontend:
- ✅ Speed Up button only appears in development mode
- ✅ Expired sessions never appear in the list
- ✅ Sessions disappear when they expire
- ✅ Download attempts on expired sessions show error

### In the Backend Logs:
```
[CLEANUP] Scheduled automatic cleanup for session xyz at 2025-07-12T15:30:00.000Z
[CLEANUP] Session will be cleaned up in 24 hours
🔄 Rescheduling cleanups for existing sessions...
✅ Session cleanups rescheduled
[CLEANUP] Performing cleanup for session xyz
[CLEANUP] Successfully cleaned up session xyz
```

### In the Database:
- Sessions with `expiresAt` in the past should have `status = 'EXPIRED'`
- `filesDeleted` should be `true` after cleanup

## Troubleshooting

### Speed Up Button Not Visible
- Check that frontend is running in development mode
- Verify `import.meta.env.MODE !== 'production'` in browser console

### Session Not Disappearing After Expiration
1. Check server logs for cleanup execution
2. Verify the session's `expiresAt` time in database
3. Check for any errors in cleanup process
4. Manually refresh the page (auto-refresh might have failed)

### Cleanup Not Running
1. Check that `ENABLE_AUTO_CLEANUP` is not set to `false`
2. Verify sessionCleanupManager is imported and initialized
3. Look for errors during server startup
4. Check that database connection is successful

## Expected Behavior Summary
1. **Immediate**: Expired sessions are hidden from UI
2. **On Schedule**: Cleanup runs at exact expiration time
3. **Development**: Speed Up button allows testing without waiting
4. **Reliability**: Server restarts don't affect scheduled cleanups
5. **User Experience**: No expired sessions visible, clear error messages