import { Router } from 'express';
import { FileController } from '../controllers/file.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Apply JWT authentication to all file operations
router.use(requireAuth);

// Presigned URL generation for client direct S3 upload
router.post('/get-presigned-url', FileController.getPresignedUrl);
router.post('/upload-url', FileController.getPresignedUrl); // alias from spec

// Upload confirmation and async processing dispatch
router.post('/confirm-upload', FileController.confirmUpload);

// File management CRUD
router.get('/', FileController.listFiles);
router.get('/:id', FileController.getFile);
router.get('/:id/download', FileController.downloadFile);
router.delete('/:id', FileController.deleteFile);

export default router;
