import { prisma } from '../config/db';
import { S3Service } from './s3.service';
import { fileProcessingQueue } from '../config/queue';
import { AppError } from '../middleware/errorHandler';
import { FileProcessingJobData } from '../types';

export class FileService {
  /**
   * Request an S3 presigned URL for direct upload
   */
  static async requestPresignedUpload(
    userId: string,
    fileName: string,
    fileSizeBytes: number,
    mimeType: string
  ) {
    // 1. Fetch user to check storage quota
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const requestedSize = BigInt(fileSizeBytes);
    if (user.storageUsed + requestedSize > user.storageQuota) {
      const quotaMb = Number(user.storageQuota) / (1024 * 1024);
      throw new AppError(
        `Storage quota exceeded. Your account limit is ${quotaMb.toFixed(0)} MB.`,
        403
      );
    }

    // 2. Generate clean S3 key
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const s3Key = `uploads/${userId}/${Date.now()}-${sanitizedFileName}`;

    // 3. Create PENDING file record in database
    const file = await prisma.file.create({
      data: {
        userId,
        fileName,
        fileSizeBytes: requestedSize,
        mimeType: mimeType || 'application/octet-stream',
        s3Key,
        status: 'PENDING',
      },
    });

    // 4. Generate Presigned S3 PUT URL (valid for 5 minutes)
    const uploadUrl = await S3Service.getPresignedUploadUrl(s3Key, file.mimeType, 300);

    return {
      fileId: file.id,
      fileName: file.fileName,
      s3Key: file.s3Key,
      uploadUrl,
      expiresInSeconds: 300,
    };
  }

  /**
   * Confirms upload after direct S3 transfer completes, pushing job to queue
   */
  static async confirmUpload(userId: string, fileId: string) {
    const file = await prisma.file.findFirst({
      where: { id: fileId, userId },
    });

    if (!file) {
      throw new AppError('File not found or unauthorized', 404);
    }

    if (file.status === 'COMPLETED' || file.status === 'PROCESSING') {
      return file;
    }

    // Verify file actually exists in S3 storage before updating status
    const head = await S3Service.headObject(file.s3Key);
    if (!head.exists) {
      throw new AppError('File was not detected in cloud storage. Please retry the upload.', 400);
    }

    // Update status to PROCESSING and atomically update user storage usage
    const actualSizeBytes = head.contentLength ? BigInt(head.contentLength) : file.fileSizeBytes;

    const [updatedFile] = await prisma.$transaction([
      prisma.file.update({
        where: { id: file.id },
        data: {
          status: 'PROCESSING',
          fileSizeBytes: actualSizeBytes,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          storageUsed: {
            increment: actualSizeBytes,
          },
        },
      }),
    ]);

    // Dispatch asynchronous job to BullMQ queue
    const jobData: FileProcessingJobData = {
      fileId: file.id,
      s3Key: file.s3Key,
      fileName: file.fileName,
      mimeType: file.mimeType,
      userId,
    };

    try {
      await fileProcessingQueue.add('process-file', jobData, {
        jobId: `file-${file.id}`,
      });
    } catch (queueErr: any) {
      console.warn('[Queue Warning] Failed to push to Redis queue:', queueErr.message);
      // Even if Redis is momentarily unreachable, file is recorded as PROCESSING
    }

    return updatedFile;
  }

  /**
   * List all files owned by user
   */
  static async getUserFiles(userId: string) {
    const files = await prisma.file.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Populate thumbnail signed URLs for quick preview
    const filesWithPreviews = await Promise.all(
      files.map(async (f) => {
        let thumbnailUrl: string | null = null;
        if (f.thumbnailKey) {
          try {
            thumbnailUrl = await S3Service.getPresignedDownloadUrl(f.thumbnailKey, undefined, 3600);
          } catch {
            thumbnailUrl = null;
          }
        }
        return {
          ...f,
          thumbnailUrl,
        };
      })
    );

    return filesWithPreviews;
  }

  /**
   * Get single file details
   */
  static async getFileById(userId: string, fileId: string) {
    const file = await prisma.file.findFirst({
      where: { id: fileId, userId },
    });

    if (!file) {
      throw new AppError('File not found', 404);
    }

    let thumbnailUrl: string | null = null;
    if (file.thumbnailKey) {
      thumbnailUrl = await S3Service.getPresignedDownloadUrl(file.thumbnailKey, undefined, 3600);
    }

    return { ...file, thumbnailUrl };
  }

  /**
   * Generate secure presigned download URL
   */
  static async getDownloadUrl(userId: string, fileId: string) {
    const file = await prisma.file.findFirst({
      where: { id: fileId, userId },
    });

    if (!file) {
      throw new AppError('File not found', 404);
    }

    if (file.status === 'PENDING') {
      throw new AppError('File upload has not completed yet.', 400);
    }

    const downloadUrl = await S3Service.getPresignedDownloadUrl(file.s3Key, file.fileName, 900);
    return { downloadUrl, fileName: file.fileName };
  }

  /**
   * Delete file from storage and database
   */
  static async deleteFile(userId: string, fileId: string) {
    const file = await prisma.file.findFirst({
      where: { id: fileId, userId },
    });

    if (!file) {
      throw new AppError('File not found', 404);
    }

    // 1. Delete main file from S3
    await S3Service.deleteObject(file.s3Key);

    // 2. Delete thumbnail if present
    if (file.thumbnailKey) {
      await S3Service.deleteObject(file.thumbnailKey);
    }

    // 3. Decrement user storage usage & remove DB record in a transaction
    await prisma.$transaction([
      prisma.file.delete({
        where: { id: file.id },
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          storageUsed: {
            decrement: file.status !== 'PENDING' ? file.fileSizeBytes : BigInt(0),
          },
        },
      }),
    ]);

    return { message: 'File deleted successfully' };
  }
}
