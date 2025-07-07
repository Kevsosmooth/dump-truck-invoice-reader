# Azure Training Error Fixes - "Training data is missing"

## Problem Identified
The error "Training data is missing: Could not find any training data at the given path" occurred because:

1. **File Naming Mismatch**: 
   - PDFs were uploaded with UUID prefix: `{uuid}_{originalname}`
   - Labels were referencing original filename without UUID
   - This caused Azure to not find matching label/OCR files for PDFs

2. **Missing OCR Files**:
   - Azure Document Intelligence requires OCR files for labeled training
   - The OCR files were removed in previous fix

## Fixes Applied

### 1. Fixed File Naming in model-training.ts
- Added `originalFileName` field to store display name
- Made `fileName` store the actual blob name with UUID
- Updated label generation to use the correct `document.fileName`
- Label files now match PDF names exactly

### 2. Added OCR File Generation
- Re-added OCR file generation in `uploadLabelData` method
- OCR files follow same naming pattern: `{documentPath}.ocr.json`
- Basic OCR structure satisfies Azure requirements

### 3. Proper Path Structure
Files are now organized correctly:
```
training-documents/
├── demo-user/
│   └── {project-id}/
│       ├── {uuid}_document1.pdf
│       ├── {uuid}_document1.pdf.labels.json
│       ├── {uuid}_document1.pdf.ocr.json
│       └── ...
```

## Expected Result
- Training should now find all required files
- PDF, labels, and OCR files all match in naming
- Azure Document Intelligence can properly process the training data

## Next Steps
1. Restart the server to apply changes
2. Create a new training project
3. Upload documents
4. Label them
5. Start training - it should work now!

## Testing
The training process should:
- Successfully start without "TrainingContentMissing" error
- Show progress updates
- Complete in 20-30 minutes
- Result in a working custom model