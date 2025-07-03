import { documentProcessingQueue, setQueueConcurrency } from '../services/queue';
import { processDocumentJob } from './document-processor';

export function initializeJobProcessors() {
  // Set concurrency based on environment (1 for free tier)
  const concurrency = process.env.AZURE_TIER === 'S0' ? 10 : 1;
  setQueueConcurrency(concurrency);

  // Register job processors
  documentProcessingQueue.process(concurrency, processDocumentJob);

  console.log(`✅ Job processors initialized with concurrency: ${concurrency}`);
}