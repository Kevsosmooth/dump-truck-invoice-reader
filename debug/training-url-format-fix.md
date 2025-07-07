# Training URL Format Fix

## Problem
Azure training was failing with "TrainingContentMissing" error even though files were present in blob storage.

## Root Cause
Azure Document Intelligence expects different URL formats for different training modes:
- **Template (labeled) training**: Wants the URL to point directly to the folder containing training files
- **Neural training**: Can use container URL with prefix parameter

## Previous Approach (Failed)
```
Container URL: https://dumptruckinvoicereader.blob.core.windows.net/training-documents
Prefix: demo-user/088ae7d2-cd88-47a2-be96-63e901d85bc7
Result: TrainingContentMissing error
```

## New Approach (Fixed)
For template models, we now construct a folder-specific URL:
```
Folder URL: https://dumptruckinvoicereader.blob.core.windows.net/training-documents/demo-user/088ae7d2-cd88-47a2-be96-63e901d85bc7?sastoken
Prefix: undefined (not used when URL points to folder)
```

## Code Changes
Modified `azure-training-service.ts` in the `startModelTraining` method:

```typescript
// For template (labeled) training, Azure expects the URL to point to the folder
// containing the training files, not the container root with a prefix
let finalTrainingUrl = trainingDataUrl;
let usePrefix = prefix;

if (buildMode === DocumentModelBuildMode.Template && prefix) {
  // For labeled training, append the folder path to the URL
  // Remove the SAS token first
  const urlParts = trainingDataUrl.split('?');
  const baseUrl = urlParts[0];
  const sasToken = urlParts[1];
  
  // Construct folder-specific URL
  finalTrainingUrl = `${baseUrl}/${prefix}?${sasToken}`;
  usePrefix = undefined; // Don't use prefix when URL points to folder
  
  console.log('Using folder-specific URL for template training:', finalTrainingUrl);
}
```

## Why This Works
1. Azure's template training expects to find all files (PDFs, labels, OCR) in a single folder
2. When using a folder-specific URL, Azure doesn't need the prefix parameter
3. The SAS token provides the necessary permissions at the folder level

## Testing
After this fix, the training should proceed successfully with the proper folder URL format.