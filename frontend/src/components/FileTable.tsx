import React, { useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  Download,
  Trash2,
  Info,
  ExternalLink,
  Eye,
  FileCode,
} from 'lucide-react';
import { FileRecord } from '../types';
import { StatusBadge } from './StatusBadge';
import { fileApi } from '../api/files';

interface FileTableProps {
  files: FileRecord[];
  onFileDeleted: () => void;
  onInspectMetadata: (file: FileRecord) => void;
}

export const FileTable: React.FC<FileTableProps> = ({
  files,
  onFileDeleted,
  onInspectMetadata,
}) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const formatSize = (bytes: number | string): string => {
    const num = Number(bytes);
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFileIcon = (mimeType: string, fileName: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-emerald-400" />;
    if (mimeType === 'application/pdf') return <FileText className="w-5 h-5 text-rose-400" />;
    if (mimeType.startsWith('video/')) return <Film className="w-5 h-5 text-sky-400" />;
    if (mimeType.startsWith('audio/')) return <Music className="w-5 h-5 text-purple-400" />;
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compressed'))
      return <Archive className="w-5 h-5 text-amber-400" />;
    if (fileName.endsWith('.json') || fileName.endsWith('.js') || fileName.endsWith('.ts'))
      return <FileCode className="w-5 h-5 text-teal-400" />;
    return <FileText className="w-5 h-5 text-slate-400" />;
  };

  const handleDownload = async (file: FileRecord) => {
    try {
      setDownloadingId(file.id);
      const { downloadUrl } = await fileApi.getDownloadUrl(file.id);
      // Trigger browser download via temporary anchor
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', file.fileName);
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to download file');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (file: FileRecord) => {
    if (!confirm(`Are you sure you want to permanently delete "${file.fileName}"?`)) {
      return;
    }
    try {
      setDeletingId(file.id);
      await fileApi.deleteFile(file.id);
      onFileDeleted();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete file');
    } finally {
      setDeletingId(null);
    }
  };

  if (files.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-800/80 flex items-center justify-center mx-auto mb-3 text-slate-500">
          <FileText className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-slate-300">No files uploaded yet</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Drag and drop an image, PDF, or document above to test direct S3 presigned upload and async BullMQ processing.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-3.5 px-4">Asset</th>
              <th className="py-3.5 px-4">Size</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 hidden md:table-cell">Uploaded At</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 text-sm">
            {files.map((file) => (
              <tr key={file.id} className="hover:bg-slate-800/40 transition-colors">
                {/* Asset Name + Thumbnail */}
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-3">
                    {file.thumbnailUrl ? (
                      <div
                        onClick={() => setPreviewImageUrl(file.thumbnailUrl!)}
                        className="w-10 h-10 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 flex-shrink-0 cursor-pointer hover:border-emerald-500 transition-colors group relative"
                        title="Click to preview"
                      >
                        <img
                          src={file.thumbnailUrl}
                          alt={file.fileName}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Eye className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg border border-slate-800 bg-slate-950 flex items-center justify-center flex-shrink-0">
                        {getFileIcon(file.mimeType, file.fileName)}
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="font-medium text-slate-200 truncate max-w-[200px] sm:max-w-xs" title={file.fileName}>
                        {file.fileName}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono truncate max-w-[200px]">
                        {file.mimeType}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Size */}
                <td className="py-3.5 px-4 text-xs font-medium text-slate-300 whitespace-nowrap">
                  {formatSize(file.fileSizeBytes)}
                </td>

                {/* Status */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <StatusBadge status={file.status} />
                </td>

                {/* Date */}
                <td className="py-3.5 px-4 text-xs text-slate-400 hidden md:table-cell whitespace-nowrap">
                  {new Date(file.createdAt).toLocaleDateString()} {new Date(file.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>

                {/* Actions */}
                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    {/* Metadata Drawer Button */}
                    <button
                      onClick={() => onInspectMetadata(file)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                      title="Inspect Metadata & Checksum"
                    >
                      <Info className="w-4 h-4" />
                    </button>

                    {/* Download Button */}
                    <button
                      onClick={() => handleDownload(file)}
                      disabled={file.status === 'PENDING' || downloadingId === file.id}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 disabled:opacity-40 transition-colors"
                      title="Download Asset via Presigned S3 GET"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDelete(file)}
                      disabled={deletingId === file.id}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 disabled:opacity-40 transition-colors"
                      title="Delete Asset"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Image Preview Modal */}
      {previewImageUrl && (
        <div
          onClick={() => setPreviewImageUrl(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-2xl max-h-[85vh] bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
            <img
              src={previewImageUrl}
              alt="Thumbnail Preview"
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};
