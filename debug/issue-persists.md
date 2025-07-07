# Issue Still Persists - TrainingContentMissing

## After Reverting Fix
We reverted back to using container URL + prefix, but still getting the same error.

## Current State
```
Training parameters:
- modelId: 'user_demo-user_test_1751823725888'
- buildMode: 'template'
- trainingUrl: 'https://dumptruckinvoicereader.blob.core.windows.net/training-documents?sv=2025-05-05&st=...'
- prefix: 'demo-user/1a899f03-f6a5-4f24-b788-64e62cec7d37'
```

Files verified to exist:
- 5 PDFs
- 5 label files  
- 5 OCR files

## Observations
1. The system can list and find all files using the same SAS URL and prefix
2. But Azure API says it can't find training data at the path
3. The SAS permissions are 'rl' (read, list)

## Possible Issues to Investigate

### 1. SAS Token Permissions
Current: `sp=rl` (read, list)
Maybe needs: More permissions like 'x' (execute)?

### 2. API Version Mismatch
Using: `api-version=2023-07-31`
Maybe the SDK and API version don't match?

### 3. Label File Format
Are the label files in the exact format Azure expects?
- Document name in label JSON matches PDF name?
- Coordinate format correct?

### 4. OCR File Format
The OCR files are minimal - maybe Azure needs more data?

### 5. File Encoding
Are files uploaded with correct encoding/content-type?

### 6. Container Access
Is there a difference between how our code accesses files vs how Azure accesses them?

## Next Investigation Steps
1. Check if we can manually train using Azure Document Intelligence Studio with these files
2. Try creating SAS URL with different permissions
3. Verify the exact label/OCR file format Azure expects
4. Check if there's a working example we can compare against