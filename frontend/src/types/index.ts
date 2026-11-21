export type FileStatus = 'PENDING' | 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface User {
  id: string;
  email: string;
  storageQuota: number | string;
  storageUsed: number | string;
  createdAt: string;
}

export interface FileMetadata {
  originalName?: string;
  detectedSize?: number;
  sha256?: string;
  processedAt?: string;
  image?: {
    width?: number;
    height?: number;
    format?: string;
    space?: string;
    channels?: number;
    hasAlpha?: boolean;
    aspectRatio?: number;
  };
  pdf?: {
    numPages?: number;
    info?: Record<string, any>;
    version?: string;
    textSnippet?: string;
  };
  [key: string]: any;
}

export interface FileRecord {
  id: string;
  userId: string;
  fileName: string;
  fileSizeBytes: number | string;
  mimeType: string;
  s3Key: string;
  thumbnailKey?: string | null;
  thumbnailUrl?: string | null;
  status: FileStatus;
  metadata: FileMetadata;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data: {
    user: User;
    token: string;
  };
}

export interface PresignedUrlResponse {
  success: boolean;
  data: {
    fileId: string;
    fileName: string;
    s3Key: string;
    uploadUrl: string;
    expiresInSeconds: number;
  };
}
