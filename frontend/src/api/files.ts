import axios from 'axios';
import { apiClient } from './client';
import { FileRecord, PresignedUrlResponse } from '../types';

export const fileApi = {
  /**
   * Request an S3 presigned PUT URL from backend
   */
  async getPresignedUrl(
    fileName: string,
    fileSizeBytes: number,
    mimeType: string
  ): Promise<PresignedUrlResponse['data']> {
    const res = await apiClient.post<PresignedUrlResponse>('/files/get-presigned-url', {
      fileName,
      fileSizeBytes,
      mimeType: mimeType || 'application/octet-stream',
    });
    return res.data.data;
  },

  /**
   * Zero-Load Direct S3 Upload:
   * Upload raw binary directly to AWS S3 / MinIO via HTTP PUT with progress tracking
   */
  async uploadDirectToS3(
    uploadUrl: string,
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<void> {
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          if (onProgress) onProgress(percent);
        }
      },
    });
  },

  /**
   * Confirm successful upload with backend to trigger async BullMQ worker
   */
  async confirmUpload(fileId: string): Promise<FileRecord> {
    const res = await apiClient.post<{ success: boolean; data: { file: FileRecord } }>(
      '/files/confirm-upload',
      { fileId }
    );
    return res.data.data.file;
  },

  /**
   * Fetch all user's files
   */
  async listFiles(): Promise<FileRecord[]> {
    const res = await apiClient.get<{ success: boolean; data: { files: FileRecord[] } }>('/files');
    return res.data.data.files;
  },

  /**
   * Get single file record
   */
  async getFile(fileId: string): Promise<FileRecord> {
    const res = await apiClient.get<{ success: boolean; data: { file: FileRecord } }>(
      `/files/${fileId}`
    );
    return res.data.data.file;
  },

  /**
   * Fetch temporary presigned download URL
   */
  async getDownloadUrl(fileId: string): Promise<{ downloadUrl: string; fileName: string }> {
    const res = await apiClient.get<{
      success: boolean;
      data: { downloadUrl: string; fileName: string };
    }>(`/files/${fileId}/download`);
    return res.data.data;
  },

  /**
   * Delete file from storage and database
   */
  async deleteFile(fileId: string): Promise<void> {
    await apiClient.delete(`/files/${fileId}`);
  },
};
