import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { config } from './env';

const clientConfig: S3ClientConfig = {
  region: config.storage.region,
  credentials: {
    accessKeyId: config.storage.accessKeyId,
    secretAccessKey: config.storage.secretAccessKey,
  },
};

if (config.storage.provider === 'minio' || config.storage.endpoint) {
  clientConfig.endpoint = config.storage.endpoint;
  clientConfig.forcePathStyle = config.storage.forcePathStyle;
}

export const s3Client = new S3Client(clientConfig);

/**
 * Downloads an S3 object and returns it as a Node.js Buffer
 */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: config.storage.bucket,
    Key: key,
  });

  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new Error(`Empty response body received from S3 for key: ${key}`);
  }

  const stream = response.Body as Readable;
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

/**
 * Uploads a generated preview / thumbnail buffer back to S3
 */
export async function uploadObjectBuffer(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: config.storage.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);
}
