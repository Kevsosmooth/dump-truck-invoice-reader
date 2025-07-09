# Azure Document Intelligence Service Limits - S0 (Standard) Tier

## Overview
This document outlines the service limits and quotas for Azure Document Intelligence S0 (Standard) tier, which is critical for implementing our document processing system.

## Request Rate Limits

### Analysis Operations
- **Analyze Document**: 15 transactions per second (TPS)
- **Analyze Batch**: 15 TPS
- **Get Analyze Result**: 50 TPS

### Model Management Operations
- **Build Model**: 5 TPS
- **Compose Model**: 5 TPS
- **Copy Model**: 5 TPS
- **Get/Delete Model**: 5 TPS
- **List Models**: 10 TPS

### Other Operations
- **List Operations**: 10 TPS
- **Get Operation**: 50 TPS
- **Get Document Model Build Operation**: 10 TPS

## Document Processing Limits

### File Size and Page Limits
- **Maximum file size**: 500 MB per document
- **Maximum pages per analysis**: 2,000 pages
- **Maximum OCR JSON response size**: 500 MB

### Supported File Formats
- PDF (text and scanned)
- JPEG/JPG
- PNG
- BMP
- TIFF
- HEIF
- DOCX
- XLSX
- PPTX
- HTML

### Processing Timeouts
- **Synchronous API timeout**: 60 seconds
- **Asynchronous operation retention**: 24 hours

## Custom Model Limits

### Model Capacity
- **Maximum custom template models**: 5,000
- **Maximum custom neural models**: 500
- **Maximum composed models**: 500

### Training Limits
- **Training dataset size (neural/generative)**: 1 GB
- **Training dataset size (template)**: 50 MB
- **Maximum training documents (neural/generative)**: 50,000
- **Maximum training documents (template)**: 500

## Best Practices for Rate Limit Management

### 1. Implement Exponential Backoff
```javascript
// Example retry delays (in seconds)
const retryDelays = [2, 5, 13, 34, 89, 233];
```

### 2. Respect Retry-After Headers
When receiving a 429 (Too Many Requests) response, check for the `Retry-After` header and wait the specified duration before retrying.

### 3. Use Progressive Ramp-Up
- Start with a lower request rate
- Gradually increase to the maximum allowed rate
- Monitor for throttling responses

### 4. Polling Best Practices
- Minimum 2-second interval between polling requests
- Use the `retry-after` header value if provided
- Implement exponential backoff for polling

## Quota Increase Options

The S0 (Standard) tier allows for quota increases through Azure support tickets:
- Request higher TPS limits
- Increase model capacity
- Expand training dataset limits

## Cost Optimization Tips

1. **Batch Processing**: Group documents to minimize API calls
2. **Efficient Polling**: Use appropriate intervals to avoid unnecessary requests
3. **Error Handling**: Implement proper retry logic to avoid failed requests
4. **Model Selection**: Use the most appropriate model for your document type

## Implementation Considerations

### Rate Limiting Strategy
```javascript
// Token bucket implementation for 15 TPS
const bucketSize = 15;
const refillRate = 15; // tokens per second
let availableTokens = bucketSize;
let lastRefillTime = Date.now();

function canMakeRequest() {
  const now = Date.now();
  const timePassed = (now - lastRefillTime) / 1000;
  const tokensToAdd = Math.floor(timePassed * refillRate);
  
  if (tokensToAdd > 0) {
    availableTokens = Math.min(bucketSize, availableTokens + tokensToAdd);
    lastRefillTime = now;
  }
  
  if (availableTokens > 0) {
    availableTokens--;
    return true;
  }
  
  return false;
}
```

### Queue Management
- Implement a priority queue for document processing
- Use job status tracking for recovery
- Store operation IDs for polling continuation

### Error Handling
- 429 (Too Many Requests): Implement backoff
- 503 (Service Unavailable): Retry with exponential backoff
- Network errors: Implement circuit breaker pattern

## Monitoring and Alerting

### Key Metrics to Track
1. Request rate (TPS)
2. Error rate (especially 429 errors)
3. Average processing time
4. Queue depth
5. Success rate

### Recommended Thresholds
- Alert when error rate > 5%
- Warning when queue depth > 100 documents
- Critical when processing time > 5 minutes per document

## References

- [Azure Document Intelligence Service Limits](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/service-limits?view=doc-intel-4.0.0)
- [Azure Document Intelligence Pricing](https://azure.microsoft.com/en-us/pricing/details/ai-document-intelligence/)
- [Best Practices for Azure AI Services](https://learn.microsoft.com/en-us/azure/ai-services/authentication)