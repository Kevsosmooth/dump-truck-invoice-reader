import { processDocumentBuffer } from './azure-document-ai.js';
import { canMakeRequest, waitForToken } from './rate-limiter.js';

/**
 * Process multiple documents concurrently with rate limiting
 * @param {Array} documents - Array of {buffer, fileName} objects
 * @param {string} modelId - Model ID to use for processing
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<Array>} - Array of results
 */
export async function processDocumentsConcurrently(documents, modelId, onProgress) {
  const results = [];
  const errors = [];
  
  // Create an array of processing functions
  const processingTasks = documents.map((doc, index) => {
    return async () => {
      try {
        // Wait for rate limit token
        await waitForToken();
        
        // Update progress
        if (onProgress) {
          onProgress({
            current: index + 1,
            total: documents.length,
            fileName: doc.fileName,
            status: 'processing'
          });
        }
        
        // Process the document
        const result = await processDocumentBuffer(doc.buffer, doc.fileName, modelId);
        
        results.push({
          index,
          fileName: doc.fileName,
          success: true,
          result
        });
        
        // Update progress
        if (onProgress) {
          onProgress({
            current: index + 1,
            total: documents.length,
            fileName: doc.fileName,
            status: 'completed'
          });
        }
      } catch (error) {
        console.error(`Error processing ${doc.fileName}:`, error);
        errors.push({
          index,
          fileName: doc.fileName,
          success: false,
          error: error.message
        });
        
        // Update progress
        if (onProgress) {
          onProgress({
            current: index + 1,
            total: documents.length,
            fileName: doc.fileName,
            status: 'failed',
            error: error.message
          });
        }
      }
    };
  });
  
  // Process with controlled concurrency
  const maxConcurrent = 5; // Process up to 5 documents at once
  const inProgress = [];
  
  for (const task of processingTasks) {
    // Start the task
    const promise = task();
    inProgress.push(promise);
    
    // If we've reached max concurrent, wait for one to complete
    if (inProgress.length >= maxConcurrent) {
      await Promise.race(inProgress);
      // Remove completed promises
      for (let i = inProgress.length - 1; i >= 0; i--) {
        if (await isPromiseSettled(inProgress[i])) {
          inProgress.splice(i, 1);
        }
      }
    }
  }
  
  // Wait for all remaining tasks
  await Promise.all(inProgress);
  
  // Sort results by original index
  results.sort((a, b) => a.index - b.index);
  
  return {
    results: results.map(r => r.result),
    errors,
    totalProcessed: results.length,
    totalFailed: errors.length
  };
}

/**
 * Check if a promise is settled (resolved or rejected)
 */
async function isPromiseSettled(promise) {
  try {
    // Race the promise against a resolved promise
    const result = await Promise.race([
      promise.then(() => true).catch(() => true),
      Promise.resolve(false)
    ]);
    return result;
  } catch {
    return true;
  }
}

/**
 * Process documents in batches (useful for very large sets)
 * @param {Array} documents - Array of {buffer, fileName} objects
 * @param {string} modelId - Model ID to use
 * @param {number} batchSize - Number of documents per batch
 * @param {Function} onBatchComplete - Callback after each batch
 * @returns {Promise<Array>} - All results
 */
export async function processDocumentsInBatches(documents, modelId, batchSize = 10, onBatchComplete) {
  const allResults = [];
  const batches = [];
  
  // Split into batches
  for (let i = 0; i < documents.length; i += batchSize) {
    batches.push(documents.slice(i, i + batchSize));
  }
  
  // Process each batch
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Processing batch ${i + 1} of ${batches.length} (${batch.length} documents)`);
    
    const batchResults = await processDocumentsConcurrently(batch, modelId);
    allResults.push(...batchResults.results);
    
    if (onBatchComplete) {
      onBatchComplete({
        batchIndex: i,
        totalBatches: batches.length,
        batchResults
      });
    }
  }
  
  return allResults;
}

/**
 * Calculate optimal batch size based on available memory and document sizes
 */
export function calculateOptimalBatchSize(documents, maxMemoryMB = 500) {
  const avgDocSize = documents.reduce((sum, doc) => sum + doc.buffer.length, 0) / documents.length;
  const avgDocSizeMB = avgDocSize / (1024 * 1024);
  
  // Estimate memory usage (roughly 3x the document size for processing)
  const memoryPerDoc = avgDocSizeMB * 3;
  const optimalBatchSize = Math.floor(maxMemoryMB / memoryPerDoc);
  
  // Ensure reasonable bounds
  return Math.max(1, Math.min(optimalBatchSize, 20));
}