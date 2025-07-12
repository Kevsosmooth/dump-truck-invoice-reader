# Post-Processing Fix Implementation Plan

## Problem Statement
- Azure processing completes quickly (15 docs/sec with STANDARD tier)
- Progress shows 100% when Azure finishes, but file renaming is still in progress
- Users can download files before renaming is complete, getting mixed renamed/unrenamed files
- Post-processing happens in batch AFTER all Azure processing completes

## Solution Overview
Track post-processing status separately from Azure processing status to ensure downloads only happen when ALL work is complete.

## Implementation Tasks

### 1. Database Schema Updates
- [ ] Add `postProcessingStatus` field to ProcessingSession model
- [ ] Add `postProcessingStartedAt` timestamp
- [ ] Add `postProcessingCompletedAt` timestamp
- [ ] Add `postProcessedCount` to track renamed files
- [ ] Create migration for these changes

### 2. Update Status Flow
- [ ] Add new SessionStatus enum value: `POST_PROCESSING`
- [ ] Update session status transitions:
  - UPLOADING → PROCESSING → POST_PROCESSING → COMPLETED
- [ ] Ensure COMPLETED only set when ALL files are renamed

### 3. Post-Processing Tracking
- [ ] Modify `postProcessSession` to update status to POST_PROCESSING
- [ ] Track individual file rename progress
- [ ] Update `postProcessedCount` as files are renamed
- [ ] Set COMPLETED only when postProcessedCount === totalPages

### 4. API Endpoints
- [ ] Create `/api/sessions/:sessionId/post-processing-status` endpoint
- [ ] Return detailed status including:
  - Post-processing progress percentage
  - Files renamed vs total
  - Estimated time remaining
- [ ] Update existing session endpoint to include post-processing info

### 5. Frontend Updates
- [ ] Update progress calculation:
  - Azure processing: 0-80% of total progress
  - Post-processing: 80-100% of total progress
- [ ] Poll post-processing status after Azure completes
- [ ] Show "Preparing files..." message during post-processing
- [ ] Disable download button until truly complete

### 6. Download Safety Check
- [ ] Add validation in download endpoint
- [ ] Check all jobs have `newFileName` populated
- [ ] Return appropriate status if files not ready
- [ ] Consider retry mechanism with backoff

### 7. Error Handling
- [ ] Handle post-processing failures gracefully
- [ ] Add retry mechanism for failed renames
- [ ] Log post-processing errors separately
- [ ] Allow partial downloads if some files fail

## Progress Tracking

### Phase 1: Database & Backend (Priority: High)
- Status: COMPLETED ✅
- ✅ Schema updated with post-processing fields
- ✅ POST_PROCESSING enum added to SessionStatus
- ⚠️ Migration created but needs database running to apply

### Phase 2: Post-Processing Logic (Priority: High)
- Status: COMPLETED ✅
- ✅ Updated post-processor to set POST_PROCESSING status
- ✅ Added progress tracking with postProcessedCount
- ✅ Proper status transitions and timestamps

### Phase 3: API & Frontend (Priority: Medium)
- Status: COMPLETED ✅
- ✅ Created /sessions/:sessionId/post-processing-status endpoint
- ✅ Updated frontend to show dual-phase progress (80% Azure, 100% post-processing)
- ✅ Added polling for post-processing status
- ✅ Download button disabled until post-processing complete

### Phase 4: Safety & Validation (Priority: High)
- Status: COMPLETED ✅
- ✅ Added download safety checks (HTTP 202 if not ready)
- ✅ Comprehensive logging for debugging
- ✅ User-friendly retry messages

## Implementation Complete!

All code changes have been made. To activate:
1. Start your PostgreSQL database
2. Run: `cd server && npx prisma migrate dev --name add-post-processing-fields`
3. Restart the server

The fix will:
- Track post-processing separately from Azure processing
- Show accurate progress (0-80% Azure, 80-100% renaming)
- Prevent downloads until files are fully renamed
- Provide clear status messages to users

## Notes
- Consider WebSocket for real-time progress updates (future enhancement)
- May need to adjust progress percentages based on actual timing
- Should maintain backward compatibility with existing sessions