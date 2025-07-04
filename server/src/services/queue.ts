import Bull from 'bull';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// Redis client configuration
export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('✅ Redis connected'));

// Connect to Redis
export async function connectRedis() {
  await redisClient.connect();
}

// Bull queue configuration
const queueOptions = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
};

// Create queues
export const documentProcessingQueue = new Bull('document-processing', queueOptions);
export const emailQueue = new Bull('email-notifications', queueOptions);

// Queue event handlers
documentProcessingQueue.on('completed', (job, result) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

documentProcessingQueue.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err);
});

documentProcessingQueue.on('stalled', (job) => {
  console.warn(`⚠️ Job ${job.id} stalled and will be retried`);
});

// Set concurrency based on tier
export function setQueueConcurrency(concurrency: number = 1) {
  documentProcessingQueue.concurrency = concurrency;
}

// Export job data types
export interface DocumentProcessingJobData {
  jobId: string;
  userId: number;
  filePath: string;
  fileName: string;
  modelId?: string;
  pageNumber?: number;
  totalPages?: number;
}