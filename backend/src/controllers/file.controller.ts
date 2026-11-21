import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { FileService } from '../services/file.service';
import { AuthenticatedRequest } from '../types';

const getPresignedUrlSchema = z.object({
  fileName: z.string().min(1, 'File name is required').max(255),
  fileSizeBytes: z.number().positive('File size must be greater than 0'),
  mimeType: z.string().min(1, 'MIME type is required'),
});

const confirmUploadSchema = z.object({
  fileId: z.string().uuid('Valid file ID is required'),
});

export class FileController {
  static async getPresignedUrl(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const validated = getPresignedUrlSchema.parse(req.body);
      const userId = req.user!.userId;

      const result = await FileService.requestPresignedUpload(
        userId,
        validated.fileName,
        validated.fileSizeBytes,
        validated.mimeType
      );

      res.status(200).json({
        success: true,
        message: 'Presigned upload URL generated successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async confirmUpload(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const validated = confirmUploadSchema.parse(req.body);
      const userId = req.user!.userId;

      const result = await FileService.confirmUpload(userId, validated.fileId);

      res.status(200).json({
        success: true,
        message: 'Upload confirmed. Processing queued.',
        data: { file: result },
      });
    } catch (err) {
      next(err);
    }
  }

  static async listFiles(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const files = await FileService.getUserFiles(userId);

      res.status(200).json({
        success: true,
        data: { files },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getFile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const fileId = req.params.id;

      const file = await FileService.getFileById(userId, fileId);

      res.status(200).json({
        success: true,
        data: { file },
      });
    } catch (err) {
      next(err);
    }
  }

  static async downloadFile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const fileId = req.params.id;

      const result = await FileService.getDownloadUrl(userId, fileId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteFile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const fileId = req.params.id;

      const result = await FileService.deleteFile(userId, fileId);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }
}
