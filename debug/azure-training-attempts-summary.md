# Azure Training Attempts Summary

## Timeline of Issues and Fixes

### 1. Initial Issue: "TrainingContentMissing"
- **Error**: Training data is missing: Could not find any training data at the given path
- **Attempted Fix**: Used folder-specific URL instead of container URL + prefix
- **Result**: Different error - "InvalidContentSourceFormat"

### 2. Second Issue: "InvalidContentSourceFormat"
- **Error**: Invalid content source: Source Uri must include container path
- **Current URL Format**: 
  ```
  https://dumptruckinvoicereader.blob.core.windows.net/training-documents/demo-user/a57c6250-6d57-4ad9-8061-aa8dd80e62f7?sastoken
  ```
- **Attempted Fix**: Reverted to container URL + prefix parameter approach
- **Added**: Trailing slash to prefix

## Current Approach (Latest)
```javascript
// Container URL
finalTrainingUrl = "https://.../training-documents?sastoken"

// Prefix with trailing slash
usePrefix = "demo-user/a57c6250-6d57-4ad9-8061-aa8dd80e62f7/"
```

## What We Know Works
1. ✅ Files are uploaded correctly (PDFs, labels, OCR)
2. ✅ OCR files contain actual text extracted via Layout API
3. ✅ Label files reference correct document names
4. ✅ SAS URL has read and list permissions

## What's Still Failing
- Azure training API can't find or access the training data
- Error messages suggest URL format issues

## Possible Root Causes
1. **SAS Token Scope**: Container-level SAS might not work for training
2. **API Expectations**: The API might expect a different URL format
3. **Permissions**: Might need additional permissions beyond "rl"
4. **Path Encoding**: Special characters in the path might need encoding

## Next Steps to Try
1. Generate account-level SAS instead of container-level
2. Add more permissions to SAS token (e.g., "rlw")
3. URL encode the prefix path
4. Check if there's a specific Azure SDK method for training URLs