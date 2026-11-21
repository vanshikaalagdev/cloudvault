import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, FileUp } from 'lucide-react';
import { fileApi } from '../api/files';

interface DropzoneProps {
  onUploadSuccess: () => void;
  storageQuota: number | string;
  storageUsed: number | string;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onUploadSuccess,
  storageQuota,
  storageUsed,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusStage, setStatusStage] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = async (file: File) => {
    setErrorMessage(null);

    // Validate size against quota
    const used = Number(storageUsed);
    const quota = Number(storageQuota);
    if (used + file.size > quota) {
      setErrorMessage(
        `File exceeds remaining storage quota. (File: ${(file.size / 1024 / 1024).toFixed(1)}MB)`
      );
      return;
    }

    try {
      setIsUploading(true);
      setProgress(0);
      setCurrentFile(file.name);

      // Phase 1: Request presigned S3 PUT URL from API (Zero heavy payload on API)
      setStatusStage('Generating secure S3 Presigned URL...');
      const { fileId, uploadUrl } = await fileApi.getPresignedUrl(
        file.name,
        file.size,
        file.type || 'application/octet-stream'
      );

      // Phase 2: Stream raw binary DIRECTLY to AWS S3 / MinIO storage
      setStatusStage('Uploading directly to cloud storage (0 server load)...');
      await fileApi.uploadDirectToS3(uploadUrl, file, (percent) => {
        setProgress(percent);
      });

      // Phase 3: Confirm upload and trigger BullMQ async pipeline
      setStatusStage('Upload complete! Queuing background worker...');
      await fileApi.confirmUpload(fileId);

      setProgress(100);
      setStatusStage('Dispatched to async processing queue!');

      setTimeout(() => {
        setIsUploading(false);
        setCurrentFile(null);
        setProgress(0);
        setStatusStage('');
        onUploadSuccess();
      }, 1200);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setErrorMessage(
        err.response?.data?.error ||
          err.message ||
          'Failed to upload file. Please verify cloud storage connection.'
      );
      setIsUploading(false);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer text-center ${
          isDragging
            ? 'border-emerald-500 bg-emerald-950/20 shadow-lg shadow-emerald-500/10'
            : 'border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-slate-700'
        } ${isUploading ? 'pointer-events-none opacity-90' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading}
        />

        {isUploading ? (
          <div className="flex flex-col items-center justify-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
            </div>
            <p className="font-semibold text-slate-200 text-sm">{currentFile}</p>
            <p className="text-xs text-slate-400 mt-1">{statusStage}</p>

            <div className="w-full max-w-md bg-slate-800 rounded-full h-3 mt-4 overflow-hidden border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-bold text-emerald-400 mt-2">{progress}%</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center mb-4 text-emerald-400 shadow-inner group-hover:scale-105 transition-transform">
              <FileUp className="w-7 h-7" />
            </div>
            <h3 className="font-semibold text-base text-slate-100">
              Drag & Drop file here, or <span className="text-emerald-400">browse</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Direct S3 PutObject upload with zero RAM or thread load on backend API.
              Images (PNG, JPG, WebP) and PDFs automatically processed.
            </p>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="mt-3 p-3 rounded-xl bg-rose-950/50 border border-rose-900/60 flex items-center gap-2.5 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
