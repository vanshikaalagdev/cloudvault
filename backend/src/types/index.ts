import { Request } from 'express';

export interface JwtPayload {
  userId: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export interface FileProcessingJobData {
  fileId: string;
  s3Key: string;
  fileName: string;
  mimeType: string;
  userId: string;
}
