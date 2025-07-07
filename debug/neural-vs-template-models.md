# Neural vs Template Models Comparison

## Custom Neural Models

### Key Characteristics
- More flexible - can generalize across different document formats
- Can handle variations in document structure
- Better for semi-structured documents
- Requires labeling (despite some confusion in docs)

### Training Requirements
- **Minimum documents**: 5 labeled examples
- **Maximum capacity**: 50,000 pages, 1GB total
- **Training time**: Up to 30 minutes
- **Build operations**: Limited to 20 per month (v3.x)

### OCR Requirements
- **OCR files ARE required** for labeled training
- Same format as template models (.ocr.json files)
- Must contain actual text extracted from documents
- Generated automatically by Document Intelligence Studio

### Important Note
Despite some documentation suggesting "unlabeled" training:
- Labeled training is strongly recommended
- Model composition only works with labeled models
- Unlabeled neural models have limited capabilities

## Custom Template Models

### Key Characteristics
- Best for consistent document layouts
- Faster training (few minutes)
- More predictable results for fixed formats
- Requires exact template matching

### Training Requirements
- **Minimum documents**: 5 labeled examples
- **Maximum capacity**: 500 pages, 50MB total
- **Training time**: Few minutes
- **Less flexible** with variations

### OCR Requirements
- **OCR files ARE required** for training
- Must contain actual text with coordinates
- Same format as neural models

## Key Differences

| Feature | Template | Neural |
|---------|----------|---------|
| Document variations | Low tolerance | High tolerance |
| Training time | Minutes | Up to 30 min |
| Data limit | 50MB | 1GB |
| Use case | Fixed forms | Variable layouts |
| OCR files | Required | Required |
| Labeling | Required | Required* |

*Despite some docs mentioning "unlabeled" training, labeled is recommended

## For Your Project

Since you're dealing with dump truck invoices that might vary:
1. **Neural model** might be better if invoices have different layouts
2. **Template model** is fine if all invoices follow same format
3. **Both require OCR files** with actual text content
4. **Both require labeling** for best results

## Current Implementation Status
Your code is set up for template models but can easily switch:
```typescript
const buildMode = project.modelType === 'neural' 
  ? DocumentModelBuildMode.Neural 
  : DocumentModelBuildMode.Template;
```

The OCR generation fix applies to BOTH model types!