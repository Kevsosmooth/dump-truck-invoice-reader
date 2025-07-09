import { documentProcessingQueue, setQueueConcurrency } from '../services/queue.js';
import { processDocumentJob } from './document-processor.js';

export function initializeJobProcessors() {
  // Set concurrency based on environment (1 for free tier)
  const concurrency = process.env.AZURE_TIER === 'S0' ? 10 : 1;
  setQueueConcurrency(concurrency);

  // Register job processors
  documentProcessingQueue.process(concurrency, processDocumentJob);

  console.log(`✅ Job processors initialized with concurrency: ${concurrency}`);
}