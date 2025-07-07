# Azure Training Debugging Guide

## Current Issue
"Training data is missing: Could not find any training data at the given path"

## Fixes Applied

### 1. Removed Trailing Slash from Prefix
- Changed from: `${project.userId}/${project.id}/`
- Changed to: `${project.userId}/${project.id}`
- Azure's prefix filter doesn't expect trailing slash

### 2. Added File Verification
Before training starts, the system now:
- Lists all files in the training folder
- Verifies minimum 5 PDFs exist
- Checks each PDF has corresponding .labels.json file
- Logs detailed file information

### 3. Enhanced Logging
- Container URL and prefix are logged
- File counts are shown
- Full error details are captured

## What to Check

### In Console Output
Look for these new log messages:
```
Files found in training folder:
- demo-user/8184cb5f-3d60-4e24-a485-6c1d8dace53a/417978a5-06bd-4a13-925d-3bd1456ec927_SILVI SAND OF EAGLESLAKE_Date_June-26-2025_Ticket#89706.pdf
- demo-user/8184cb5f-3d60-4e24-a485-6c1d8dace53a/417978a5-06bd-4a13-925d-3bd1456ec927_SILVI SAND OF EAGLESLAKE_Date_June-26-2025_Ticket#89706.pdf.labels.json
...
Training folder contains: 5 PDFs, 5 label files, 5 OCR files
```

### If Still Failing
1. Check the SAS URL format - should end with something like: `?sv=2025-05-05&st=...&sr=c&sp=racwdl&sig=...`
2. Verify the prefix has no trailing slash
3. Check if files are accessible via Storage Explorer with the SAS URL

## Alternative Approaches to Try

### 1. Direct Folder URL (if current fix doesn't work)
Instead of container URL + prefix, try:
```javascript
const folderUrl = `${sasUrl}${project.userId}/${project.id}`;
// Pass folderUrl as trainingDataUrl with no prefix
```

### 2. Check Label File Content
Ensure label files contain the correct document name:
```json
{
  "document": "417978a5-06bd-4a13-925d-3bd1456ec927_SILVI SAND OF EAGLESLAKE_Date_June-26-2025_Ticket#89706.pdf",
  "labels": [...]
}
```

### 3. Test with Azure Storage Explorer
1. Use the SAS URL to connect to the container
2. Navigate to the project folder
3. Verify all files are accessible

## Expected Behavior After Fix
- Training should start successfully
- Progress updates should appear
- No "TrainingContentMissing" error

## If Issue Persists
The detailed logging will show:
- Exact container URL and prefix being used
- List of files Azure should find
- More specific error details from Azure

This information will help identify the root cause.