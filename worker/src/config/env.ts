import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',

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
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  },
};
