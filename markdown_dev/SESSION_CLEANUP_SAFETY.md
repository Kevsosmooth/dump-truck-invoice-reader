# Session Cleanup Safety Measures

## Overview
This document outlines the safety measures implemented to ensure session cleanup ONLY deletes the specific session's data and never affects other users or sessions.

## The Issue
In development environments, there was a concern that cleanup might delete data for all users instead of just the specific session being cleaned up.

## Safety Implementation

### 1. **Blob Prefix Structure**
Each session has a unique blob prefix that includes:
```
users/{userId}/sessions/{sessionId}/
```

Example:
```
users/123/sessions/7ee74fb2-de18-43c8-a447-1c809acf7219/
```

### 2. **Environment Separation**
All blobs are prefixed with environment:
- Development: `development/users/{userId}/sessions/{sessionId}/`
- Production: `production/users/{userId}/sessions/{sessionId}/`

This ensures development and production data are completely isolated.

### 3. **Safety Checks Added**

#### In cleanup-service.js:
```javascript
// Ensure the prefix ends with the session ID
if (!blobPrefix.includes(sessionId)) {
  console.error(`[CLEANUP] SAFETY CHECK FAILED: Blob prefix '${blobPrefix}' does not contain session ID '${sessionId}'`);
  throw new Error('Blob prefix does not match session ID - refusing to delete for safety');
}
```

#### Detailed Logging:
```javascript
console.log(`[CLEANUP] Deleting blobs for session ${sessionId} with prefix: ${blobPrefix}`);
console.log(`[AZURE-STORAGE] Deleting blobs with prefix: ${fullPrefix}`);
console.log(`[AZURE-STORAGE] Found ${blobsToDelete.length} blobs to delete`);
```

### 4. **How Deletion Works**
1. Session cleanup is triggered (manually or automatically)
2. System retrieves the session's `blobPrefix` from database
3. Safety check ensures prefix contains the session ID
4. Azure Storage lists ONLY blobs matching the exact prefix
5. Each blob is deleted individually with logging

## Testing the Safety

### 1. **Check the Logs**
When a session is cleaned up, you'll see:
```
[CLEANUP] Deleting blobs for session 7ee74fb2-de18-43c8-a447-1c809acf7219 with prefix: users/123/sessions/7ee74fb2-de18-43c8-a447-1c809acf7219/
[AZURE-STORAGE] Deleting blobs with prefix: development/users/123/sessions/7ee74fb2-de18-43c8-a447-1c809acf7219/
[AZURE-STORAGE] Environment: development, Container: documents
[AZURE-STORAGE] Found 5 blobs to delete with prefix: development/users/123/sessions/7ee74fb2-de18-43c8-a447-1c809acf7219/
[AZURE-STORAGE] Deleting blob: development/users/123/sessions/7ee74fb2-de18-43c8-a447-1c809acf7219/originals/invoice.pdf
...
```

### 2. **Verify in Azure Portal**
1. Go to your storage account
2. Navigate to the container
3. Check that only the specific session folder was deleted
4. Other users' folders remain intact

### 3. **Test with Multiple Users**
1. Create sessions for multiple users
2. Speed up expiration for ONE session
3. Verify only that session's data is deleted

## What Prevents Accidental Deletion

1. **Unique Session IDs**: Each session has a UUID that's part of the path
2. **User ID Isolation**: Each user's data is in their own folder
3. **Prefix Matching**: Azure only returns blobs that START with the exact prefix
4. **Safety Check**: Code refuses to delete if session ID isn't in the prefix
5. **Environment Separation**: Dev and prod data are completely isolated

## Example Blob Structure
```
documents/
├── development/
│   ├── users/
│   │   ├── 123/
│   │   │   └── sessions/
│   │   │       ├── session-abc123/  <- Only this is deleted
│   │   │       │   ├── originals/
│   │   │       │   ├── pages/
│   │   │       │   └── processed/
│   │   │       └── session-xyz789/  <- This remains
│   │   └── 456/
│   │       └── sessions/
│   │           └── session-def456/  <- This remains
└── production/
    └── users/
        └── ... (completely separate)
```

## Emergency Safeguards

If you're still concerned about data loss:

1. **Disable Auto-Cleanup**: Set `ENABLE_AUTO_CLEANUP=false` in .env
2. **Manual Cleanup Only**: Remove the automatic scheduling
3. **Add Additional Checks**: Require user confirmation before cleanup
4. **Backup First**: Implement backup before deletion

## Monitoring Cleanup Operations

All cleanup operations are logged in the `CleanupLog` table with:
- Number of sessions processed
- Number of blobs deleted
- Any errors encountered
- Timestamp of operation

## Conclusion

The cleanup system is designed with multiple layers of safety to ensure it ONLY deletes the specific session's data. The combination of unique paths, safety checks, and detailed logging makes accidental deletion of other users' data virtually impossible.