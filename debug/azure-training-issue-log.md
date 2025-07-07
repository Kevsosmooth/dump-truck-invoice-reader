# Azure Document Intelligence Training Issue Debug Log

## Issue Summary
Cannot train custom model with Azure Document Intelligence. Multiple error messages received while trying different approaches.

## Environment
- Azure Document Intelligence endpoint: https://silvi.cognitiveservices.azure.com/
- Storage Account: dumptruckinvoicereader
- Container: training-documents
- SDK: @azure/ai-form-recognizer v5.1.0
- Training Type: Template (labeled)

## Error History

### Error 1: "TrainingContentMissing"
**Message**: "Training data is missing: Could not find any training data at the given path."

**What we tried**:
1. Fixed file naming mismatch (PDFs had UUID prefix, labels didn't)
2. Added OCR file generation
3. Removed trailing slash from prefix
4. Added file verification before training

**Result**: Files were found but still got error

### Error 2: "InvalidManagedIdentity" 
**Message**: "The managed identity configuration is invalid: Managed identity is not enabled for the current resource."

**What we tried**:
1. Changed approach to append folder path to URL for labeled training
2. Fixed URL construction (was appending path after query params)

**Result**: Error changed to new one

### Error 3: "InvalidContentSourceFormat"
**Message**: "Invalid content source: Source Uri must include container path"

**What we tried**:
1. Reverted to using container URL + prefix approach
2. Verified files exist in blob storage

**Result**: Back to TrainingContentMissing error

## File Structure in Blob
```
training-documents/
└── demo-user/
    └── 1a899f03-f6a5-4f24-b788-64e62cec7d37/
        ├── {uuid}_document.pdf (5 files)
        ├── {uuid}_document.pdf.labels.json (5 files)
        └── {uuid}_document.pdf.ocr.json (5 files)
```

## ROOT CAUSE DISCOVERED (2025-07-06 18:30 UTC)

### The Real Problem
All label files contain `"text": "sample value"` instead of actual text from the documents!

### Evidence from Blob Storage
```json
{
  "document": "3b6dd6c6-96fa-4137-aafc-5b804112884f_SILVI SAND OF EAGLESLAKE_Date_June-27-2025_Ticket#89832.pdf",
  "labels": [{
    "label": "date",
    "key": null,
    "value": [{
      "page": 1,
      "text": "sample value",  // <-- THIS IS THE PROBLEM
      "boundingBoxes": [[120.19, 191.72, 160.19, 191.72, 160.19, 207.51, 120.19, 207.51]]
    }]
  }]
}
```

### Code Analysis
In `/client/src/components/ModelTraining/DocumentLabeling.tsx`:
- Line 234: `value: '', // Would extract from OCR in real app`
- Line 275: `value: label.value || 'sample value',`

Since `label.value` is always empty, it defaults to 'sample value' for ALL labels.

### Why This Causes TrainingContentMissing
Azure Document Intelligence needs real text values to:
1. Validate that labeled regions actually contain text
2. Train the model to recognize patterns in the text
3. Associate field types with text patterns

When all labels have "sample value", Azure can't find any real training content.

## Solution Files Created
1. `/debug/critical-issue-found.md` - Detailed analysis of the root cause
2. `/debug/solution-plan.md` - Multiple solution options
3. `/debug/implementation-fix.md` - Specific code changes needed

## Next Steps
1. Implement quick fix to capture real text values from users
2. Test training with proper text values in labels
3. Plan for automated text extraction in the future

## CORRECTION: Real Root Cause Found (2025-07-06 19:00 UTC)

### My Mistake
I misunderstood how template models work. Users don't need to manually enter text values - Azure extracts text based on labeled locations.

### The ACTUAL Problem
OCR files (.ocr.json) were completely empty with no text lines. They should contain all text extracted from documents with coordinates.

### Solution Implemented
1. Added `generateOcrData` method using Azure Layout API
2. Modified document upload to automatically generate OCR files
3. OCR files now contain actual text extracted from PDFs
4. This happens during upload, not during labeling

### Current Status
- Document upload now runs Layout API to extract text
- OCR files are generated with actual content
- Training should now work properly

See `/debug/ocr-implementation.md` for full details.