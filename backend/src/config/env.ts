import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root or current directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config(); // fallback to local directory

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  jwt: {
    secret: process.env.JWT_SECRET || 'supersecret_cloudvault_jwt_key_at_least_32_chars_long',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cloudvault?schema=public',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  storage: {
    provider: (process.env.STORAGE_PROVIDER || 'minio').toLowerCase() as 'minio' | 'aws',
    bucket: process.env.AWS_S3_BUCKET || 'cloudvault-bucket',
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'minioadmin',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin',
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT || 'http://localhost:9000',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  },

  quota: {
    defaultBytes: BigInt(process.env.USER_STORAGE_QUOTA_BYTES || '52428800'), // 50MB
  },
};
