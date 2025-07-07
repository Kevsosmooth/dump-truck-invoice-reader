# Solution Plan for Azure Training

## Problem Summary
Label files contain "sample value" instead of actual text, causing Azure to report TrainingContentMissing.

## Solution Options

### Option 1: Quick Fix (Temporary)
Modify the frontend to prompt user for actual text values:
1. When drawing a bounding box, show a popup
2. User manually enters the text they see in that region
3. Save the actual text value instead of "sample value"

### Option 2: Proper Fix (Recommended)
Implement text extraction from PDF coordinates:
1. Use Azure Document Intelligence to analyze PDFs first
2. Extract text with coordinates
3. When user draws bounding box, find text within those coordinates
4. Automatically populate the value field

### Option 3: Server-Side Processing
1. Frontend sends bounding box coordinates
2. Server uses PDF processing library to extract text at coordinates
3. Server generates proper label files with extracted text

## Implementation Steps for Option 1 (Quick Fix)

1. **Update DocumentLabeling.tsx**:
   - Add a text input dialog after drawing box
   - Store the user-entered text in label.value
   - Remove the 'sample value' fallback

2. **Update the UI**:
   - Show current text value for each label
   - Allow editing existing label text
   - Validate that text is not empty

## Implementation Steps for Option 2 (Proper Fix)

1. **Pre-process documents**:
   - When uploading, analyze with Azure Document Intelligence
   - Store text locations in metadata
   
2. **Extract text on labeling**:
   - Match bounding box coordinates with text regions
   - Auto-populate value field
   
3. **Fallback to manual entry**:
   - If no text found at coordinates
   - Allow user to manually enter

## Immediate Action Required
At minimum, we need to:
1. Remove the 'sample value' default
2. Ensure real text is captured for each label
3. Validate labels have non-empty text before training

Without real text values, Azure training will never work!