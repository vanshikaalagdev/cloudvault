import React from 'react';
import { Loader2, CheckCircle2, XCircle, Clock, UploadCloud } from 'lucide-react';
import { FileStatus } from '../types';

interface StatusBadgeProps {
  status: FileStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'PENDING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          Pending
        </span>
      );
    case 'UPLOADING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-950 text-sky-400 border border-sky-800 animate-pulse">
          <UploadCloud className="w-3.5 h-3.5 text-sky-400" />
          Uploading
        </span>
      );
    case 'PROCESSING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950 text-amber-400 border border-amber-800">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
          Processing
        </span>
      );
    case 'COMPLETED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          Completed
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-950 text-rose-400 border border-rose-800">
          <XCircle className="w-3.5 h-3.5 text-rose-400" />
          Failed
        </span>
      );
    default:
      return null;
  }
};
