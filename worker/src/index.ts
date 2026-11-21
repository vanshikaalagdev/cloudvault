import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from './config/env';
import { prisma } from './config/db';
import { processFileJob, ProcessFileJobPayload } from './processors/fileProcessor';

console.log('=======================================================');
console.log('🚀 CloudVault Asynchronous Background Worker starting...');
console.log(`📡 Storage Provider: ${config.storage.provider.toUpperCase()}`);
console.log(`🗄️  Bucket: ${config.storage.bucket}`);
console.log(`⚡ Redis: ${config.redis.url}`);
console.log('=======================================================');

const redisConnection = new IORedis(config.redis.url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const worker = new Worker<ProcessFileJobPayload>(
  'file-processing',
  async (job: Job<ProcessFileJobPayload>) => {
    console.log(`[Queue] Received Job ${job.id} for File: ${job.data.fileName}`);
    await processFileJob(job.data);
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 files in parallel
  }
);

worker.on('ready', () => {
  console.log('✅ Worker is connected and listening to queue: file-processing');
});

worker.on('completed', (job: Job) => {
  console.log(`🎉 [Queue] Job ${job.id} completed successfully!`);
});

worker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`💥 [Queue] Job ${job?.id} failed with error:`, err.message);
});

worker.on('error', (err: Error) => {
  console.error('⚠️ [Queue] Worker encountered an error:', err.message);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n[${signal}] Shutting down worker gracefully...`);
  await worker.close();
  await redisConnection.quit();
  await prisma.$disconnect();
  console.log('✅ Worker shutdown complete.');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
