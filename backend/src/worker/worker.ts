import { Worker, Job } from 'bullmq';
import crypto from 'crypto';
import { Readable } from 'stream';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '../config/db';
import { config } from '../config/env';
import { s3Client } from '../config/s3';
import { redisConnection } from '../config/queue';
import { processImage } from './imageProcessor';
import { processPdf } from './pdfProcessor';
import { FileProcessingJobData } from '../types';

async function getObjectBuffer(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: config.storage.bucket,
    Key: key,
  });

  const response = await s3Client.send(command);
  if (!response.Body) {
    throw new Error(`Empty response body from storage for key: ${key}`);
  }

  const stream = response.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function uploadObjectBuffer(key: string, buffer: Buffer, contentType: string): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: config.storage.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await s3Client.send(command);
}

async function handleFileJob(job: Job<FileProcessingJobData>): Promise<void> {
  const { fileId, s3Key, fileName, mimeType } = job.data;
  console.log(`[Embedded Worker] Processing Job ${job.id} for File: ${fileName}`);

  try {
    const fileBuffer = await getObjectBuffer(s3Key);
    const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const baseMetadata: Record<string, any> = {
      originalName: fileName,
      detectedSize: fileBuffer.length,
      sha256: sha256Hash,
      processedAt: new Date().toISOString(),
    };

    let thumbnailKey: string | null = null;
    const isImage = mimeType.startsWith('image/') || /\.(jpe?g|png|webp|gif|tiff|avif)$/i.test(fileName);
    const isPdf = mimeType === 'application/pdf' || /\.pdf$/i.test(fileName);

    if (isImage) {
      try {
        const imageResult = await processImage(fileBuffer);
        Object.assign(baseMetadata, { image: imageResult.metadata });
        thumbnailKey = `thumbnails/${s3Key.replace(/^uploads\//, '')}.webp`;
        await uploadObjectBuffer(thumbnailKey, imageResult.thumbnailBuffer, imageResult.thumbnailMimeType);
      } catch (imgErr: any) {
        baseMetadata.imageWarning = imgErr.message;
      }
    } else if (isPdf) {
      try {
        const pdfResult = await processPdf(fileBuffer);
        Object.assign(baseMetadata, { pdf: pdfResult.metadata });
      } catch (pdfErr: any) {
        baseMetadata.pdfWarning = pdfErr.message;
      }
    }

    await prisma.file.update({
      where: { id: fileId },
      data: {
        status: 'COMPLETED',
        thumbnailKey,
        metadata: baseMetadata,
        errorMessage: null,
      },
    });

    console.log(`✅ [Embedded Worker] Job ${job.id} completed successfully for File: ${fileName}`);
  } catch (err: any) {
    console.error(`❌ [Embedded Worker] Job failed for File: ${fileName}:`, err.message);
    await prisma.file.update({
      where: { id: fileId },
      data: {
        status: 'FAILED',
        errorMessage: err.message || 'Processing error',
      },
    });
    throw err;
  }
}

export function startEmbeddedWorker(): Worker<FileProcessingJobData> {
  const worker = new Worker<FileProcessingJobData>(
    'file-processing',
    async (job: Job<FileProcessingJobData>) => {
      await handleFileJob(job);
    },
    {
      connection: redisConnection,
      concurrency: 5,
    }
  );

  worker.on('ready', () => {
    console.log('⚡ [Embedded Worker] Connected and listening to queue: file-processing');
  });

  worker.on('error', (err) => {
    console.warn('⚠️ [Embedded Worker Error]:', err.message);
  });

  return worker;
}
