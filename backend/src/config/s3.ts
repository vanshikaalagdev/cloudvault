import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
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
 * Adjusts presigned URL for public browser access if S3_PUBLIC_ENDPOINT is specified
 * (e.g. backend inside Docker talks to http://minio:9000, while frontend browser reaches http://localhost:9000)
 */
export function formatPublicS3Url(presignedUrl: string): string {
  if (config.storage.provider !== 'minio') {
    return presignedUrl;
  }

  const internalEndpoint = config.storage.endpoint.replace(/\/+$/, '');
  const publicEndpoint = config.storage.publicEndpoint.replace(/\/+$/, '');

  if (internalEndpoint !== publicEndpoint && presignedUrl.startsWith(internalEndpoint)) {
    return presignedUrl.replace(internalEndpoint, publicEndpoint);
  }

  return presignedUrl;
}
