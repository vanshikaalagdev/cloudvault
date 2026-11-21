import React, { useState } from 'react';
import { X, Copy, Check, Hash, Calendar, Image as ImageIcon, FileText, Layers, HardDrive } from 'lucide-react';
import { FileRecord } from '../types';
import { StatusBadge } from './StatusBadge';

interface MetadataDrawerProps {
  file: FileRecord | null;
  onClose: () => void;
}

export const MetadataDrawer: React.FC<MetadataDrawerProps> = ({ file, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!file) return null;

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatSize = (bytes: number | string): string => {
    const num = Number(bytes);
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(2)} MB`;
  };

  const imageMeta = file.metadata?.image;
  const pdfMeta = file.metadata?.pdf;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 flex flex-col justify-between shadow-2xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-slate-100 truncate max-w-[280px]">
                {file.fileName}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Asset Pipeline Inspection</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Status & Basic Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Pipeline Status</span>
              <StatusBadge status={file.status} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">File Size</span>
              <span className="text-xs font-semibold text-slate-200">
                {formatSize(file.fileSizeBytes)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">MIME Type</span>
              <span className="text-xs font-mono text-slate-300">{file.mimeType}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Created At</span>
              <span className="text-xs text-slate-300">
                {new Date(file.createdAt).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Cloud Storage Location */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              S3 Object Key
            </span>
            <p className="text-xs font-mono text-slate-300 break-all">{file.s3Key}</p>
          </div>

          {/* SHA-256 Cryptographic Checksum */}
          {file.metadata?.sha256 && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-emerald-400" />
                  SHA-256 Checksum
                </span>
                <button
                  onClick={() => handleCopySha(file.metadata.sha256!)}
                  className="text-slate-400 hover:text-emerald-400 transition-colors p-1"
                  title="Copy SHA-256"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] font-mono text-emerald-400/90 break-all select-all">
                {file.metadata.sha256}
              </p>
            </div>
          )}

          {/* Image Dimensions & Attributes */}
          {imageMeta && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                Image Metadata (Sharp)
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900 p-2 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">Dimensions</span>
                  <span className="font-semibold text-slate-200">
                    {imageMeta.width} x {imageMeta.height} px
                  </span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">Format</span>
                  <span className="font-semibold uppercase text-slate-200">
                    {imageMeta.format || 'N/A'}
                  </span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">Aspect Ratio</span>
                  <span className="font-semibold text-slate-200">
                    {imageMeta.aspectRatio ? `${imageMeta.aspectRatio}:1` : 'N/A'}
                  </span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">Alpha Channel</span>
                  <span className="font-semibold text-slate-200">
                    {imageMeta.hasAlpha ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* PDF Attributes */}
          {pdfMeta && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                Document Metadata
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900 p-2 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">Total Pages</span>
                  <span className="font-semibold text-slate-200">{pdfMeta.numPages}</span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">PDF Version</span>
                  <span className="font-semibold text-slate-200">{pdfMeta.version || '1.4'}</span>
                </div>
              </div>
              {pdfMeta.textSnippet && (
                <div className="bg-slate-900 p-2.5 rounded-lg text-xs">
                  <span className="text-slate-500 block text-[10px] mb-1">Text Preview Snippet</span>
                  <p className="text-slate-300 italic line-clamp-3">"{pdfMeta.textSnippet}"</p>
                </div>
              )}
            </div>
          )}

          {/* Error Message if Failed */}
          {file.errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-900 text-xs text-rose-300 space-y-1">
              <span className="font-semibold text-rose-200 block">Processing Failure</span>
              <p>{file.errorMessage}</p>
            </div>
          )}

          {/* Raw JSON viewer */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              Raw JSONB Output
            </span>
            <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 overflow-x-auto max-h-48">
              {JSON.stringify(file.metadata, null, 2)}
            </pre>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
