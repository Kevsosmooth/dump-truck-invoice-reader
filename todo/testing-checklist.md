# Azure Document Intelligence Training - Testing Checklist

## Pre-Testing Setup
- [ ] Ensure Azure credentials are configured in `.env`
- [ ] Verify storage account `dumptruckinvoicereader` is accessible
- [ ] Check `training-documents` container exists
- [ ] Have at least 5 sample PDF/image documents ready

## Testing Steps

### 1. Project Creation
- [ ] Create new training project via API
- [ ] Verify project ID is generated
- [ ] Check blob container is accessible

### 2. Document Upload
- [ ] Upload 5+ documents for template model (or 1+ for neural)
- [ ] Verify files appear in blob storage at: `userId/projectId/fileName`
- [ ] Check file size limits are enforced

### 3. Document Labeling
- [ ] View uploaded documents in UI
- [ ] Draw bounding boxes for fields
- [ ] Save labels for each document
- [ ] Verify `.labels.json` files created in blob storage
- [ ] Check `.ocr.json` files are created

### 4. Model Training
- [ ] Start training process
- [ ] Verify model ID is generated
- [ ] Check training status updates
- [ ] Monitor Azure portal for training progress

### 5. Model Testing
- [ ] Wait for training completion (20-30 minutes)
- [ ] Test model with new document
- [ ] Verify extracted fields match expectations
- [ ] Check confidence scores

## Expected File Structure in Blob Storage
```
training-documents/
├── demo-user/
│   └── {project-id}/
│       ├── {doc-id}_document1.pdf
│       ├── {doc-id}_document1.pdf.labels.json
│       ├── {doc-id}_document1.pdf.ocr.json
│       ├── {doc-id}_document2.pdf
│       ├── {doc-id}_document2.pdf.labels.json
│       └── {doc-id}_document2.pdf.ocr.json
```

## Common Issues to Check
- [ ] CORS settings on storage account (if accessing from browser)
- [ ] SAS token permissions include read/write/list
- [ ] Coordinates are normalized (0-1 range)
- [ ] Label format matches Azure requirements
- [ ] Build mode enum is correct (Template/Neural)

## Azure Portal Verification
- [ ] Check Document Intelligence resource for new models
- [ ] Verify model appears in custom models list
- [ ] Review training metrics and accuracy

## Error Scenarios to Test
- [ ] Upload unsupported file type
- [ ] Exceed file size limits
- [ ] Train with insufficient documents
- [ ] Train without labels
- [ ] Invalid coordinates in labels