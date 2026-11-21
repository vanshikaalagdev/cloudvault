import React from 'react';
import { HardDrive } from 'lucide-react';

interface QuotaBarProps {
  storageUsed: number | string;
  storageQuota: number | string;
}

export const QuotaBar: React.FC<QuotaBarProps> = ({ storageUsed, storageQuota }) => {
  const used = Number(storageUsed);
  const quota = Number(storageQuota) || 52428800; // default 50MB
  const percent = Math.min(Math.round((used / quota) * 100), 100);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`;
  };

  const getProgressColor = () => {
    if (percent > 90) return 'bg-rose-500';
    if (percent > 75) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium text-slate-300">
          <HardDrive className="w-4 h-4 text-emerald-400" />
          Cloud Storage Usage
        </span>
        <span className="text-xs font-semibold text-slate-400">
          {formatSize(used)} / {formatSize(quota)} ({percent}%)
        </span>
      </div>

      <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ease-out rounded-full ${getProgressColor()}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {percent > 90 && (
        <p className="text-xs text-rose-400 mt-0.5">
          ⚠️ You have reached over 90% of your account storage quota.
        </p>
      )}
    </div>
  );
};
