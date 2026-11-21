import crypto from 'crypto';
import { prisma } from '../config/db';
import { getObjectBuffer, uploadObjectBuffer } from '../config/s3';
import { processImage } from './imageProcessor';
import { processPdf } from './pdfProcessor';

export interface ProcessFileJobPayload {
  fileId: string;
  s3Key: string;
  fileName: string;
  mimeType: string;
  userId: string;
}

export async function processFileJob(payload: ProcessFileJobPayload): Promise<void> {
  const { fileId, s3Key, fileName, mimeType } = payload;
  console.log(`[Worker] Starting processing for File ID: ${fileId} (${fileName})`);

  try {
    // 1. Fetch file buffer from S3/MinIO
    const fileBuffer = await getObjectBuffer(s3Key);
    const byteLength = fileBuffer.length;

    // 2. Calculate cryptographic SHA-256 checksum
    const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const baseMetadata: Record<string, any> = {
      originalName: fileName,
      detectedSize: byteLength,
      sha256: sha256Hash,
      processedAt: new Date().toISOString(),
    };

    let thumbnailKey: string | null = null;

    // 3. Specialized asset processing
    const isImage = mimeType.startsWith('image/') || /\.(jpe?g|png|webp|gif|tiff|avif)$/i.test(fileName);
    const isPdf = mimeType === 'application/pdf' || /\.pdf$/i.test(fileName);

    if (isImage) {
      try {
        console.log(`[Worker] Generating image thumbnail for ${s3Key}...`);
        const imageResult = await processImage(fileBuffer);
        Object.assign(baseMetadata, { image: imageResult.metadata });

        // Save thumbnail to S3 under thumbnails/ directory
        thumbnailKey = `thumbnails/${s3Key.replace(/^uploads\//, '')}.webp`;
        await uploadObjectBuffer(thumbnailKey, imageResult.thumbnailBuffer, imageResult.thumbnailMimeType);
        console.log(`[Worker] Thumbnail uploaded: ${thumbnailKey}`);
      } catch (imgErr: any) {
        console.warn(`[Worker] Image processing warning for ${fileName}:`, imgErr.message);
        baseMetadata.imageWarning = imgErr.message;
      }
    } else if (isPdf) {
      try {
        console.log(`[Worker] Extracting PDF metadata for ${s3Key}...`);
        const pdfResult = await processPdf(fileBuffer);
        Object.assign(baseMetadata, { pdf: pdfResult.metadata });
      } catch (pdfErr: any) {
        console.warn(`[Worker] PDF processing warning for ${fileName}:`, pdfErr.message);
        baseMetadata.pdfWarning = pdfErr.message;
      }
    }

    // 4. Update PostgreSQL transaction record to COMPLETED
    await prisma.file.update({
      where: { id: fileId },
      data: {
        status: 'COMPLETED',
        thumbnailKey,
        metadata: baseMetadata,
        errorMessage: null,
      },
    });

    console.log(`✅ [Worker] Successfully completed processing for File ID: ${fileId}`);
  } catch (error: any) {
    console.error(`❌ [Worker] Failed processing for File ID: ${fileId}:`, error.message);

    // Update status to FAILED and record error message
    await prisma.file.update({
      where: { id: fileId },
      data: {
        status: 'FAILED',
        errorMessage: error.message || 'Unknown processing error',
      },
    });

    throw error; // Let BullMQ track the failed attempt
  }
}
