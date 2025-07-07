# Training URL Investigation

## Current Approach
- Container URL: `https://dumptruckinvoicereader.blob.core.windows.net/training-documents`
- Prefix: `demo-user/088ae7d2-cd88-47a2-be96-63e901d85bc7`
- Result: "TrainingContentMissing" error

## Files Present
We can see 15 files:
- 5 PDF files
- 5 label files (.labels.json)
- 5 OCR files (.ocr.json)

## Possible Issues

### 1. URL Format
Azure might expect:
- Option A: Container URL + prefix parameter (current approach)
- Option B: Direct folder URL without prefix parameter
- Option C: Container URL with trailing slash

### 2. SAS Token Permissions
Current: "rl" (read and list)
- Might need additional permissions?

### 3. File Naming
Label files reference the full filename with UUID prefix
- This should be correct according to docs

### 4. OCR File Format
OCR files are being generated with Layout API
- Format looks correct (v2.1.0)

## Test Plan
1. Try using folder-specific URL instead of prefix
2. Add more SAS permissions
3. Verify OCR file content structure