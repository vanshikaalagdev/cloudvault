import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Search, Layers, Cpu, Database, Cloud } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fileApi } from '../api/files';
import { FileRecord } from '../types';
import { Navbar } from '../components/Navbar';
import { QuotaBar } from '../components/QuotaBar';
import { Dropzone } from '../components/Dropzone';
import { FileTable } from '../components/FileTable';
import { MetadataDrawer } from '../components/MetadataDrawer';

export const DashboardPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileForMetadata, setSelectedFileForMetadata] = useState<FileRecord | null>(null);

  const fetchFiles = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setRefreshing(true);
      const data = await fileApi.listFiles();
      setFiles(data);
    } catch (err) {
      console.error('Failed to fetch files:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Real-time polling while any file is PENDING or PROCESSING
  useEffect(() => {
    const hasPendingOrProcessing = files.some(
      (f) => f.status === 'PENDING' || f.status === 'PROCESSING' || f.status === 'UPLOADING'
    );

    if (!hasPendingOrProcessing) return;

    const intervalId = setInterval(() => {
      fetchFiles(true);
      refreshUser();
    }, 2500);

    return () => clearInterval(intervalId);
  }, [files, fetchFiles, refreshUser]);

  const handleUploadSuccess = () => {
    fetchFiles();
    refreshUser();
  };

  const handleFileDeleted = () => {
    fetchFiles();
    refreshUser();
  };

  const filteredFiles = files.filter((f) =>
    f.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.mimeType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Architecture Highlight Banner */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">Zero Server Load</p>
              <p className="text-[11px] text-slate-400">Direct S3 Presigned PUT</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">Async Pipeline</p>
              <p className="text-[11px] text-slate-400">Redis & BullMQ Queues</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">Asset Processor</p>
              <p className="text-[11px] text-slate-400">Sharp Thumbnails & PDF</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">Relational Store</p>
              <p className="text-[11px] text-slate-400">PostgreSQL via Prisma ORM</p>
            </div>
          </div>
        </div>

        {/* Storage Quota & Upload Dropzone Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-1 space-y-4">
            {user && (
              <QuotaBar
                storageUsed={user.storageUsed}
                storageQuota={user.storageQuota}
              />
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 space-y-2">
              <p className="font-semibold text-slate-300">How Direct Upload Works:</p>
              <ol className="list-decimal list-inside space-y-1 text-slate-400">
                <li>Client requests signed URL from API.</li>
                <li>API authorizes quota & returns PUT link.</li>
                <li>Client uploads raw binary directly to S3.</li>
                <li>BullMQ worker processes metadata & preview.</li>
              </ol>
            </div>
          </div>

          <div className="lg:col-span-2">
            {user && (
              <Dropzone
                onUploadSuccess={handleUploadSuccess}
                storageQuota={user.storageQuota}
                storageUsed={user.storageUsed}
              />
            )}
          </div>
        </div>

        {/* Files Explorer Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>Vault Assets</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  {files.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Managed storage with cryptographic verification and thumbnail previews.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search assets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-44 sm:w-60"
                />
              </div>

              <button
                onClick={() => fetchFiles()}
                disabled={refreshing}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
                title="Refresh assets"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>
          </div>

          <FileTable
            files={filteredFiles}
            onFileDeleted={handleFileDeleted}
            onInspectMetadata={(file) => setSelectedFileForMetadata(file)}
          />
        </div>
      </main>

      {/* Metadata Inspector Drawer */}
      <MetadataDrawer
        file={selectedFileForMetadata}
        onClose={() => setSelectedFileForMetadata(null)}
      />
    </div>
  );
};
