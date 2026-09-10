import React, { useState } from 'react';
import {
  Download,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Trash2,
  Music,
  Mic,
  Layers,
  Sparkles,
  FolderOpen,
  RefreshCw,
  Library,
  Scissors,
  HardDrive,
} from 'lucide-react';
import { AudioFormat, DownloadQueueItem, DownloadedFileInfo } from '../types/downloader';

interface UrlDownloaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  queue: DownloadQueueItem[];
  isDownloading?: boolean;
  onAddToQueue: (url: string, format: AudioFormat, targetTrackId: 'vocalRef' | 'instrumental' | 'userVocal') => void;
  onCancelTask: (taskId: string) => void;
  onRetryTask: (taskId: string) => void;
  onClearFinished: () => void;
  onAssignTrack?: (targetTrackId: 'vocalRef' | 'instrumental', filePath: string, title: string) => void;
  onSendToSplitter?: (filePath: string) => void;
  // Persistent Library Props
  downloadedFiles?: DownloadedFileInfo[];
  isLoadingLibrary?: boolean;
  onRefreshLibrary?: () => void;
  onDeleteDownloadedFile?: (filePath: string) => void;
  onOpenDownloadFolder?: () => void;
}

export const UrlDownloaderModal: React.FC<UrlDownloaderModalProps> = ({
  isOpen,
  onClose,
  queue,
  onAddToQueue,
  onCancelTask,
  onRetryTask,
  onClearFinished,
  onAssignTrack,
  onSendToSplitter,
  downloadedFiles = [],
  isLoadingLibrary = false,
  onRefreshLibrary,
  onDeleteDownloadedFile,
  onOpenDownloadFolder,
}) => {
  const [activeTab, setActiveTab] = useState<'download' | 'library'>('download');
  const [urlInput, setUrlInput] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<AudioFormat>('mp4');
  const [targetTrack, setTargetTrack] = useState<'vocalRef' | 'instrumental' | 'userVocal'>('vocalRef');
  const [libraryFilter, setLibraryFilter] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    onAddToQueue(urlInput.trim(), selectedFormat, targetTrack);
    setUrlInput('');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes <= 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const formatDuration = (secs?: number) => {
    if (!secs || secs <= 0) return '--:--';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (item: DownloadQueueItem) => {
    switch (item.status) {
      case 'pending':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span> In Queue
          </span>
        );
      case 'downloading':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-500/60 flex items-center gap-1">
            <Loader2 size={12} className="animate-spin text-cyan-400" /> Downloading ({Math.round(item.percent)}%)
          </span>
        );
      case 'converting':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-950/80 text-purple-300 border border-purple-500/60 flex items-center gap-1">
            <Sparkles size={12} className="animate-pulse text-purple-400" /> Converting {item.format.toUpperCase()}
          </span>
        );
      case 'loading':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-500/60 flex items-center gap-1">
            <Loader2 size={12} className="animate-spin text-amber-400" /> Ingesting Audio
          </span>
        );
      case 'completed':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/60 flex items-center gap-1">
            <CheckCircle2 size={12} className="text-emerald-400" /> Ready
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-500/60 flex items-center gap-1">
            <AlertCircle size={12} className="text-rose-400" /> Failed
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-800 text-zinc-500 border border-zinc-700">
            Cancelled
          </span>
        );
    }
  };

  const getTargetTrackLabel = (trackId: 'vocalRef' | 'instrumental' | 'userVocal') => {
    switch (trackId) {
      case 'vocalRef':
        return { label: 'Vocal Guide', icon: <Mic size={12} className="text-purple-400" />, color: 'text-purple-300 border-purple-500/40 bg-purple-950/40' };
      case 'instrumental':
        return { label: 'Backing Track', icon: <Music size={12} className="text-emerald-400" />, color: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/40' };
      case 'userVocal':
        return { label: 'User Recording', icon: <Layers size={12} className="text-cyan-400" />, color: 'text-cyan-300 border-cyan-500/40 bg-cyan-950/40' };
    }
  };

  const filteredLibrary = downloadedFiles.filter((f) =>
    f.file_name.toLowerCase().includes(libraryFilter.toLowerCase())
  );

  return (
    <div
      style={{ padding: '24px' }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in"
    >
      <div
        className="w-full max-w-3xl bg-[#18181d] border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        style={{
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 35px rgba(6, 182, 212, 0.15)',
        }}
      >
        {/* Header */}
        <div
          style={{ padding: '16px 24px' }}
          className="flex items-center justify-between border-b border-zinc-800 bg-[#1e1e24]/80"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-600/30 to-purple-600/30 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
              <Download size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                URL Audio Downloader & Library
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-medium">
                  yt-dlp + ffmpeg Sidecar
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                ดาวน์โหลดและจัดการคลังไฟล์เสียงคาราโอเกะที่บันทึกไว้ในเครื่อง
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{ padding: '12px 24px 0 24px' }}
          className="flex items-center justify-between bg-[#16161a] border-b border-zinc-800/80"
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('download')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-t border-x transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'download'
                  ? 'bg-[#18181d] text-cyan-300 border-zinc-700/80 border-b-transparent shadow'
                  : 'bg-transparent text-zinc-400 border-transparent hover:text-zinc-200'
              }`}
            >
              <Download size={14} />
              <span>ดาวน์โหลดใหม่ (URL Downloader)</span>
              {queue.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-900/60 text-cyan-300 text-[10px] font-mono border border-cyan-500/30">
                  {queue.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('library')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-t border-x transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'library'
                  ? 'bg-[#18181d] text-purple-300 border-zinc-700/80 border-b-transparent shadow'
                  : 'bg-transparent text-zinc-400 border-transparent hover:text-zinc-200'
              }`}
            >
              <Library size={14} />
              <span>คลังเพลงในเครื่อง (Library)</span>
              {downloadedFiles.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-purple-900/60 text-purple-300 text-[10px] font-mono border border-purple-500/30">
                  {downloadedFiles.length}
                </span>
              )}
            </button>
          </div>

          {/* Quick open directory button */}
          {onOpenDownloadFolder && (
            <button
              onClick={onOpenDownloadFolder}
              className="text-xs text-zinc-400 hover:text-cyan-300 flex items-center gap-1.5 pb-2 transition-colors cursor-pointer"
              title="เปิดโฟลเดอร์เพลงดาวน์โหลดใน Windows Explorer"
            >
              <FolderOpen size={14} className="text-cyan-400" />
              <span className="hidden sm:inline">เปิดโฟลเดอร์ในเครื่อง</span>
            </button>
          )}
        </div>

        {/* Tab 1: Download & Active Queue */}
        {activeTab === 'download' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Form Input Section */}
            <form
              onSubmit={handleSubmit}
              style={{ padding: '18px 24px' }}
              className="border-b border-zinc-800/80 bg-[#16161a] space-y-3.5"
            >
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Media Stream URL:
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center bg-[#22222a] border border-zinc-700/80 rounded-xl px-3 py-2 focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500/50 transition-all shadow-inner min-w-0">
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none min-w-0"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!urlInput.trim()}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                      urlInput.trim()
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                        : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed'
                    }`}
                  >
                    <Download size={15} />
                    <span>Add to Queue</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Format Selection */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Output Audio / Video Format:
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['flac', 'mp3', 'wav', 'mp4'] as AudioFormat[]).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setSelectedFormat(fmt)}
                        className={`py-2 text-xs font-bold rounded-lg border uppercase tracking-wider transition-all cursor-pointer ${
                          selectedFormat === fmt
                            ? 'bg-cyan-600/30 border-cyan-500 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                            : 'bg-zinc-800/60 border-zinc-700/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                        }`}
                      >
                        {fmt === 'mp4' ? 'MP4 🎬' : fmt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Track Ingestion */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Target Studio Track:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTargetTrack('vocalRef')}
                      className={`py-2 px-2 text-xs font-medium rounded-lg border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        targetTrack === 'vocalRef'
                          ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                          : 'bg-zinc-800/60 border-zinc-700/80 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Mic size={14} className="text-purple-400" /> Vocal Guide
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetTrack('instrumental')}
                      className={`py-2 px-2 text-xs font-medium rounded-lg border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        targetTrack === 'instrumental'
                          ? 'bg-emerald-600/30 border-emerald-500 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                          : 'bg-zinc-800/60 border-zinc-700/80 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Music size={14} className="text-emerald-400" /> Backing Track
                    </button>
                  </div>
                </div>
              </div>
            </form>

            {/* Sequential Queue List */}
            <div
              style={{ padding: '20px 24px' }}
              className="flex-1 overflow-y-auto space-y-3"
            >
              <div className="flex items-center justify-between pb-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <span>Download & Processing Queue</span>
                  <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-[10px]">
                    {queue.length} items
                  </span>
                </h3>
                {queue.some((i) => i.status === 'completed' || i.status === 'failed' || i.status === 'cancelled') && (
                  <button
                    onClick={onClearFinished}
                    className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} /> Clear Finished
                  </button>
                )}
              </div>

              {queue.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                  <Download size={32} className="mb-2 opacity-30" />
                  <p className="text-sm font-medium">No active downloads in queue</p>
                  <p className="text-xs text-zinc-600">Enter a URL above to queue audio files</p>
                  {downloadedFiles.length > 0 && (
                    <button
                      onClick={() => setActiveTab('library')}
                      className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-950/60 border border-purple-500/40 text-purple-300 hover:bg-purple-900/60 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Library size={13} /> ดูไฟล์ในคลัง ({downloadedFiles.length} เพลง)
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {queue.map((item) => {
                    const targetMeta = getTargetTrackLabel(item.targetTrackId);
                    const isItemActive = item.status === 'downloading' || item.status === 'converting';

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isItemActive
                            ? 'bg-zinc-900/90 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                            : item.status === 'completed'
                            ? 'bg-zinc-900/50 border-zinc-800'
                            : item.status === 'failed'
                            ? 'bg-rose-950/20 border-rose-900/50'
                            : 'bg-zinc-900/40 border-zinc-800/80'
                        }`}
                      >
                        {/* Item Top Row */}
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border flex items-center gap-1 ${targetMeta.color}`}>
                              {targetMeta.icon}
                              {targetMeta.label}
                            </span>
                            <p className="text-xs font-semibold text-zinc-200 truncate" title={item.title || item.url}>
                              {item.title || item.url}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {getStatusBadge(item)}

                            {/* Actions */}
                            {isItemActive && (
                              <button
                                onClick={() => onCancelTask(item.id)}
                                className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                                title="Cancel Download"
                              >
                                <X size={14} />
                              </button>
                            )}
                            {item.status === 'failed' && (
                              <button
                                onClick={() => onRetryTask(item.id)}
                                className="p-1 rounded text-zinc-400 hover:text-cyan-400 hover:bg-cyan-950/30 transition-colors cursor-pointer"
                                title="Retry Download"
                              >
                                <RotateCcw size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Progress Bar (Active/Converting) */}
                        {isItemActive && (
                          <div className="space-y-1.5 mt-2">
                            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-cyan-500 to-purple-500 h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, Math.max(0, item.percent))}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[11px] text-zinc-400">
                              <span>
                                Speed: <strong className="text-zinc-200">{item.speed || 'N/A'}</strong>
                              </span>
                              <span>
                                ETA: <strong className="text-zinc-200">{item.eta || 'N/A'}</strong>
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Error message */}
                        {item.status === 'failed' && item.error && (
                          <p className="text-[11px] text-rose-400 mt-1 truncate" title={item.error}>
                            Error: {item.error}
                          </p>
                        )}

                        {/* Completed File Details & Assign Action Buttons */}
                        {item.status === 'completed' && item.filePath && (
                          <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between gap-3 flex-wrap">
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-mono text-zinc-500 truncate" title={item.filePath}>
                                {item.filePath}
                              </p>
                              {item.durationSecs && item.durationSecs > 0 ? (
                                <span className="text-[11px] text-zinc-400 font-mono">
                                  ความยาว: {Math.floor(item.durationSecs / 60)}:{String(Math.floor(item.durationSecs % 60)).padStart(2, '0')} นาที
                                </span>
                              ) : null}
                            </div>

                            {onAssignTrack && (
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => onAssignTrack('vocalRef', item.filePath!, item.title || 'Vocal Track')}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-950/70 hover:bg-purple-900 border border-purple-500/50 text-purple-200 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                                  title="โหลดไฟล์นี้เข้าช่องเสียงร้อง (Vocal Guide)"
                                >
                                  <Mic size={13} className="text-purple-400" />
                                  <span>ใช้เป็น Vocal</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onAssignTrack('instrumental', item.filePath!, item.title || 'Backing Track')}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-200 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                                  title="โหลดไฟล์นี้เข้าช่องดนตรี (Backing Track)"
                                >
                                  <Music size={13} className="text-emerald-400" />
                                  <span>ใช้เป็น Backing Track</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Downloaded Library (Local Cache) */}
        {activeTab === 'library' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Library Search & Toolbar */}
            <div
              style={{ padding: '14px 24px' }}
              className="border-b border-zinc-800 bg-[#16161a] flex items-center justify-between gap-3"
            >
              <input
                type="text"
                placeholder="ค้นหาเพลงในคลัง..."
                value={libraryFilter}
                onChange={(e) => setLibraryFilter(e.target.value)}
                className="flex-1 bg-[#22222a] border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
              />

              <div className="flex items-center gap-2">
                {onRefreshLibrary && (
                  <button
                    onClick={onRefreshLibrary}
                    disabled={isLoadingLibrary}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                    title="สแกนไฟล์ในโฟลเดอร์ใหม่"
                  >
                    <RefreshCw size={14} className={isLoadingLibrary ? 'animate-spin text-cyan-400' : ''} />
                  </button>
                )}
              </div>
            </div>

            {/* Library Files List */}
            <div
              style={{ padding: '20px 24px' }}
              className="flex-1 overflow-y-auto space-y-2.5"
            >
              {filteredLibrary.length === 0 ? (
                <div className="py-14 flex flex-col items-center justify-center text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                  <HardDrive size={32} className="mb-2 opacity-30" />
                  <p className="text-sm font-medium">ไม่พบไฟล์เสียงในคลังดาวน์โหลด</p>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    คุณสามารถดาวน์โหลดเพลงจาก YouTube ที่แท็บ "ดาวน์โหลดใหม่" ได้ทันที
                  </p>
                </div>
              ) : (
                filteredLibrary.map((file) => (
                  <div
                    key={file.file_path}
                    className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 transition-all flex flex-col gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              file.format === 'mp4' || file.format === 'webm' || file.format === 'mkv'
                                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/50'
                                : 'bg-purple-950/80 text-purple-300 border border-purple-500/40'
                            }`}
                          >
                            {file.format === 'mp4' || file.format === 'webm' || file.format === 'mkv'
                              ? `${file.format} 🎬`
                              : file.format}
                          </span>
                          <h4 className="text-xs font-bold text-zinc-100 truncate" title={file.file_name}>
                            {file.file_name}
                          </h4>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-1 font-mono">
                          <span>ความยาว: {formatDuration(file.duration_secs)}</span>
                          <span>•</span>
                          <span>ขนาด: {formatFileSize(file.size_bytes)}</span>
                        </div>
                      </div>

                      {onDeleteDownloadedFile && (
                        <button
                          onClick={() => {
                            if (window.confirm(`ต้องการลบไฟล์ "${file.file_name}" ออกจากเครื่องใช่หรือไม่?`)) {
                              onDeleteDownloadedFile(file.file_path);
                            }
                          }}
                          className="p-1.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                          title="ลบไฟล์นี้ออกจากเครื่อง"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* Quick Load Buttons */}
                    <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-end gap-2 flex-wrap">
                      {onAssignTrack && (
                        <>
                          <button
                            onClick={() => {
                              onAssignTrack('vocalRef', file.file_path, file.file_name);
                              onClose();
                            }}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-950/70 hover:bg-purple-900 border border-purple-500/50 text-purple-200 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                            title="โหลดไฟล์นี้เข้าช่องเสียงร้อง (Vocal Guide)"
                          >
                            <Mic size={13} className="text-purple-400" />
                            <span>ใช้เป็น Vocal</span>
                          </button>
                          <button
                            onClick={() => {
                              onAssignTrack('instrumental', file.file_path, file.file_name);
                              onClose();
                            }}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-200 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                            title="โหลดไฟล์นี้เข้าช่องดนตรี (Backing Track)"
                          >
                            <Music size={13} className="text-emerald-400" />
                            <span>ใช้เป็น Backing Track</span>
                          </button>
                        </>
                      )}

                      {onSendToSplitter && (
                        <button
                          onClick={() => {
                            onSendToSplitter(file.file_path);
                            onClose();
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                          title="ส่งไฟล์นี้ไปยัง AI Stem Splitter เพื่อแยกเสียงร้องและเสียงดนตรี"
                        >
                          <Scissors size={13} className="text-cyan-400" />
                          <span>แยก Stem AI</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

