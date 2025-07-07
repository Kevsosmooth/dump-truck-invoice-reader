# Solution: Generate Real OCR Files

## Current Problem
The code generates empty OCR files:
```javascript
lines: []  // Empty array - no text!
```

## What We Need
Before labeling, we need to:
1. Run Azure Document Intelligence Layout API on each PDF
2. Extract all text with coordinates
3. Save proper OCR files with actual content

## Implementation Options

### Option 1: Run OCR When Uploading Documents
```javascript
// In model-training.ts when uploading documents
for (const file of req.files) {
  // Upload PDF
  await uploadToBlob(file);
  
  // Run OCR
  const ocrResult = await analyzeDocument(file.buffer);
  
  // Save OCR result
  await uploadOcrResult(ocrResult);
}
```

### Option 2: Run OCR Before Labeling
Add a new step in the workflow:
1. Upload documents
2. **NEW: Run OCR on all documents**
3. Label documents
4. Train model

### Option 3: Generate OCR During Label Save
When saving labels, also run OCR if not already done.

## Quick Fix for Testing
For now, we could:
1. Use Azure Document Intelligence to analyze one of the PDFs
2. Get the OCR result
3. Use that as a template for all OCR files
4. This would at least have some text content

## Proper Fix
Add OCR processing to the document upload flow:

```typescript
// In azure-training-service.ts
async generateOcrFile(
  documentBuffer: Buffer,
  documentPath: string
): Promise<any> {
  // Use Layout API to analyze document
  const poller = await analysisClient.beginAnalyzeDocument(
    'prebuilt-layout',
    documentBuffer
  );
  
  const result = await poller.pollUntilDone();
  
  // Convert to OCR format
  const ocrData = {
    status: "succeeded",
    recognitionResults: result.pages.map(page => ({
      page: page.pageNumber,
      width: page.width,
      height: page.height,
      unit: page.unit,
      lines: page.lines?.map(line => ({
        boundingBox: line.polygon,
        text: line.content,
        words: line.words?.map(word => ({
          boundingBox: word.polygon,
          text: word.content
        }))
      })) || []
    }))
  };
  
  return ocrData;
}
```

## Important Notes
1. This will increase document upload time
2. May incur additional Azure API costs
3. But it's REQUIRED for labeled training to work
4. The Form Recognizer Sample Labeling Tool does this automatically