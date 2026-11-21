import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, formatPublicS3Url } from '../config/s3';
import { config } from '../config/env';

export class S3Service {
  /**
   * Generates a presigned PUT URL for direct client-to-storage upload
   * @param key S3 Object key
   * @param mimeType Expected MIME type
   * @param expiresInSeconds URL expiration in seconds (default 300 = 5 minutes)
   */
  static async getPresignedUploadUrl(
    key: string,
    mimeType: string,
    expiresInSeconds: number = 300
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: config.storage.bucket,
      Key: key,
      ContentType: mimeType,
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    return formatPublicS3Url(url);
  }

  /**
   * Generates a presigned GET URL for secure downloading/previewing
   * @param key S3 Object key
   * @param downloadFilename Optional original filename for Content-Disposition header
   * @param expiresInSeconds Expiration time (default 900 = 15 minutes)
   */
  static async getPresignedDownloadUrl(
    key: string,
    downloadFilename?: string,
    expiresInSeconds: number = 900
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: config.storage.bucket,
      Key: key,
      ResponseContentDisposition: downloadFilename
        ? `attachment; filename="${encodeURIComponent(downloadFilename)}"`
        : undefined,
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    return formatPublicS3Url(url);
  }

  /**
   * Checks whether an object exists in storage and returns its content length
   */
  static async headObject(key: string): Promise<{ exists: boolean; contentLength?: number }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: config.storage.bucket,
        Key: key,
      });
      const response = await s3Client.send(command);
      return {
        exists: true,
        contentLength: response.ContentLength,
      };
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return { exists: false };
      }
      throw err;
    }
  }

  /**
   * Deletes an object from S3 storage
   */
  static async deleteObject(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: config.storage.bucket,
        Key: key,
      });
      await s3Client.send(command);
    } catch (err: any) {
      console.warn(`[S3Service] Failed to delete object ${key}:`, err.message);
    }
  }
}
