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
  Film,
  Folder,
  FolderPlus,
  Star,
  Tag,
  Edit2,
  Check,
} from 'lucide-react';
import { AudioFormat, DownloadQueueItem, DownloadedFileInfo, LibraryFolder } from '../types/downloader';
import { useLibraryFolders } from '../hooks/useLibraryFolders';
import { VideoThumbnail } from './VideoThumbnail';
import { FolderModal } from './FolderModal';

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
  onAttachVideoOnly?: (filePath: string, fileName: string) => void;
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
  onAttachVideoOnly: _onAttachVideoOnly,
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

  // Playlist Folders & Tags Hook
  const {
    folders,
    activeFolderId,
    activeFolder,
    setActiveFolderId,
    activeTag,
    setActiveTag,
    formatFilter,
    setFormatFilter,
    createFolder,
    updateFolder,
    deleteFolder,
    toggleFileInFolder,
    isFileInFolder,
    getFileFolders,
    setSongTags,
    getSongTags,
    allTags,
  } = useLibraryFolders();

  const [isFolderModalOpen, setIsFolderModalOpen] = useState<boolean>(false);
  const [folderToEdit, setFolderToEdit] = useState<LibraryFolder | null>(null);
  const [folderPickerPath, setFolderPickerPath] = useState<string | null>(null);
  const [tagEditorPath, setTagEditorPath] = useState<string | null>(null);
  const [tagInputText, setTagInputText] = useState<string>('');

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

  const mp4Count = downloadedFiles.filter(
    (f) => f.format === 'mp4' || f.format === 'webm' || f.format === 'mkv'
  ).length;
  const wavCount = downloadedFiles.length - mp4Count;

  const filteredLibrary = downloadedFiles.filter((f) => {
    // 1. Text Search query
    const query = libraryFilter.toLowerCase().trim();
    const songTags = getSongTags(f.file_path);
    const songFolders = getFileFolders(f.file_path);
    const matchesSearch =
      !query ||
      f.file_name.toLowerCase().includes(query) ||
      songTags.some((t) => t.toLowerCase().includes(query)) ||
      songFolders.some((folder) => folder.name.toLowerCase().includes(query));

    // 2. Format Filter
    const isMp4 = f.format === 'mp4' || f.format === 'webm' || f.format === 'mkv';
    let matchesFormat = true;
    if (formatFilter === 'mp4') {
      matchesFormat = isMp4;
    } else if (formatFilter === 'wav') {
      matchesFormat = !isMp4;
    }

    // 3. Active Folder filter
    let matchesFolder = true;
    if (activeFolderId) {
      matchesFolder = isFileInFolder(activeFolderId, f.file_path);
    }

    // 4. Active Tag filter
    let matchesTag = true;
    if (activeTag) {
      matchesTag =
        songTags.some((t) => t.toLowerCase() === activeTag.toLowerCase()) ||
        Boolean(activeFolder?.tags.some((t) => t.toLowerCase() === activeTag.toLowerCase()));
    }

    return matchesSearch && matchesFormat && matchesFolder && matchesTag;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-2 sm:p-4"
    >
      <div
        className="w-full max-w-[96vw] xl:max-w-6xl h-[92vh] max-h-[94vh] bg-[#16161c] border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
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
                                  <span>Vocal</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onAssignTrack('instrumental', item.filePath!, item.title || 'Backing Track')}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-200 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                                  title="โหลดไฟล์นี้เข้าช่องดนตรี (Backing Track)"
                                >
                                  <Music size={13} className="text-emerald-400" />
                                  <span>ใช้เป็น Instrument</span>
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
            {/* Library Search & Format Filter Bar */}
            <div
              style={{ padding: '12px 24px' }}
              className="border-b border-zinc-800 bg-[#16161a] flex items-center justify-between gap-3 flex-wrap"
            >
              {/* Search Input */}
              <input
                type="text"
                placeholder="ค้นหาเพลงในคลัง, โฟลเดอร์ หรือ #แท็ก..."
                value={libraryFilter}
                onChange={(e) => setLibraryFilter(e.target.value)}
                className="flex-1 min-w-[200px] bg-[#22222a] border border-zinc-700/80 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 shadow-inner"
              />

              {/* Format Filter Segmented Control [ All | MP4 | WAV ] */}
              <div className="flex items-center bg-[#22222a] border border-zinc-700/80 rounded-xl p-0.5 shrink-0 shadow-inner">
                <button
                  type="button"
                  onClick={() => setFormatFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    formatFilter === 'all'
                      ? 'bg-zinc-700 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                  }`}
                >
                  ทั้งหมด ({downloadedFiles.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFormatFilter('mp4')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    formatFilter === 'mp4'
                      ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-500/40'
                      : 'text-zinc-400 hover:text-cyan-300 hover:bg-white/5'
                  }`}
                >
                  <Film size={13} />
                  <span>MP4 ({mp4Count})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormatFilter('wav')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    formatFilter === 'wav'
                      ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/40'
                      : 'text-zinc-400 hover:text-purple-300 hover:bg-white/5'
                  }`}
                >
                  <Music size={13} />
                  <span>WAV ({wavCount})</span>
                </button>
              </div>

              {/* Refresh & Rescan */}
              <div className="flex items-center gap-2">
                {onRefreshLibrary && (
                  <button
                    onClick={onRefreshLibrary}
                    disabled={isLoadingLibrary}
                    className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer border border-zinc-700/60"
                    title="สแกนไฟล์ในโฟลเดอร์ใหม่"
                  >
                    <RefreshCw size={14} className={isLoadingLibrary ? 'animate-spin text-cyan-400' : ''} />
                  </button>
                )}
              </div>
            </div>

            {/* Spotify-style Playlist Folders Shelf */}
            <div className="px-6 py-2.5 bg-[#18181f] border-b border-zinc-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                <Folder size={13} className="text-purple-400" /> โฟลเดอร์:
              </span>

              {/* All Files Chip */}
              <button
                type="button"
                onClick={() => setActiveFolderId(null)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  activeFolderId === null
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                    : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700/60'
                }`}
              >
                <span>เพลงทั้งหมด</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 font-mono">
                  {downloadedFiles.length}
                </span>
              </button>

              {/* Custom Folders Chips */}
              {folders.map((folder) => {
                const count = downloadedFiles.filter((f) => folder.filePaths.includes(f.file_path)).length;
                const isActive = activeFolderId === folder.id;
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => setActiveFolderId(isActive ? null : folder.id)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border ${
                      isActive
                        ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/30'
                        : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    <span>{folder.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 font-mono">
                      {count}
                    </span>
                    {folder.rating > 0 && (
                      <span className="text-[10px] text-amber-400 flex items-center">
                        ★{folder.rating}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Add Folder Button */}
              <button
                type="button"
                onClick={() => {
                  setFolderToEdit(null);
                  setIsFolderModalOpen(true);
                }}
                className="px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-800/60 hover:bg-zinc-700 text-purple-300 border border-dashed border-purple-500/50 hover:border-purple-400 transition-all shrink-0 cursor-pointer flex items-center gap-1 ml-auto"
              >
                <FolderPlus size={13} />
                <span>+ สร้างโฟลเดอร์</span>
              </button>
            </div>

            {/* Active Folder Details Banner (When a folder is selected) */}
            {activeFolder && (
              <div className="px-6 py-2.5 bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-transparent border-b border-purple-900/40 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-purple-900/60 border border-purple-500/40 text-purple-200 shrink-0">
                    <Folder size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-white truncate">{activeFolder.name}</h3>
                      <div className="flex items-center text-amber-400 text-xs">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={11}
                            className={i < activeFolder.rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-600'}
                          />
                        ))}
                      </div>
                    </div>
                    {activeFolder.description && (
                      <p className="text-[11px] text-zinc-300 truncate mt-0.5">{activeFolder.description}</p>
                    )}
                    {activeFolder.tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {activeFolder.tags.map((tag) => (
                          <span
                            key={tag}
                            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                            className={`px-2 py-0.2 rounded-full text-[10px] font-medium border cursor-pointer transition-colors ${
                              activeTag === tag
                                ? 'bg-purple-600 text-white border-purple-400'
                                : 'bg-purple-950/80 text-purple-300 border-purple-500/40 hover:bg-purple-900'
                            }`}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setFolderToEdit(activeFolder);
                      setIsFolderModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    title="แก้ไขโฟลเดอร์นี้"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`ต้องการลบโฟลเดอร์ "${activeFolder.name}" ใช่หรือไม่? (ไฟล์เพลงจะไม่ถูกลบ)`)) {
                        deleteFolder(activeFolder.id);
                      }
                    }}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950/80 text-zinc-400 hover:text-rose-300 transition-colors cursor-pointer"
                    title="ลบโฟลเดอร์นี้"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* Tag Filter Chips Bar (if tags exist) */}
            {allTags.length > 0 && (
              <div className="px-6 py-2 bg-[#141418] border-b border-zinc-800/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
                  <Tag size={11} /> แท็ก:
                </span>
                {allTags.map((tag) => {
                  const isActive = activeTag === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setActiveTag(isActive ? null : tag)}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-500/40'
                          : 'bg-zinc-850 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 border border-zinc-750'
                      }`}
                    >
                      #{tag}
                    </button>
                  );
                })}
                {activeTag && (
                  <button
                    type="button"
                    onClick={() => setActiveTag(null)}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 underline cursor-pointer ml-1 shrink-0"
                  >
                    ล้างแท็ก
                  </button>
                )}
              </div>
            )}

            {/* Library Files List */}
            <div
              style={{ padding: '20px 24px' }}
              className="flex-1 overflow-y-auto space-y-3"
            >
              {filteredLibrary.length === 0 ? (
                <div className="py-14 flex flex-col items-center justify-center text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                  <HardDrive size={32} className="mb-2 opacity-30" />
                  <p className="text-sm font-medium">ไม่พบไฟล์ที่ตรงกับเงื่อนไขในคลัง</p>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    ลองเปลี่ยนคำค้นหา, ตัวกรองรูปแบบไฟล์ หรือเลือกดูโฟลเดอร์อื่น
                  </p>
                </div>
              ) : (
                filteredLibrary.map((file) => {
                  const isMp4 = file.format === 'mp4' || file.format === 'webm' || file.format === 'mkv';
                  const songFolders = getFileFolders(file.file_path);
                  const songTags = getSongTags(file.file_path);

                  return (
                    <div
                      key={file.file_path}
                      className="p-3.5 rounded-xl border border-zinc-800/80 bg-[#18181f]/80 hover:bg-[#202028] hover:border-zinc-700/80 transition-all flex flex-col gap-3 shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Left: Video Thumbnail for MP4 or Audio Badge for WAV */}
                        {isMp4 ? (
                          <VideoThumbnail filePath={file.file_path} className="w-24 h-16 shrink-0" />
                        ) : (
                          <div className="w-24 h-16 rounded-lg bg-gradient-to-br from-purple-950/80 to-indigo-950/80 border border-purple-500/30 flex flex-col items-center justify-center text-purple-300 shrink-0 shadow-inner">
                            <Music size={22} className="mb-0.5 text-purple-400 opacity-90" />
                            <span className="text-[10px] font-black uppercase font-mono tracking-wider text-purple-300">
                              {file.format}
                            </span>
                          </div>
                        )}

                        {/* Middle: Details & Meta & Tags */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                isMp4
                                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/50'
                                  : 'bg-purple-950/80 text-purple-300 border border-purple-500/40'
                              }`}
                            >
                              {isMp4 ? `${file.format} 🎬` : file.format}
                            </span>
                            <h4 className="text-xs font-bold text-zinc-100 truncate flex-1" title={file.file_name}>
                              {file.file_name}
                            </h4>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-1 font-mono">
                            <span>ความยาว: {formatDuration(file.duration_secs)}</span>
                            <span>•</span>
                            <span>ขนาด: {formatFileSize(file.size_bytes)}</span>
                          </div>

                          {/* Folders & Tags badges */}
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px]">
                            {/* Folders this file belongs to */}
                            {songFolders.map((folder) => (
                              <span
                                key={folder.id}
                                onClick={() => setActiveFolderId(folder.id)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-950/70 border border-purple-500/40 text-purple-300 font-semibold cursor-pointer hover:bg-purple-900"
                                title={`คลิกเพื่อดูโฟลเดอร์ "${folder.name}"`}
                              >
                                <Folder size={10} className="text-purple-400" />
                                <span>{folder.name}</span>
                              </span>
                            ))}

                            {/* Tags attached to this song */}
                            {songTags.map((tag) => (
                              <span
                                key={tag}
                                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                                className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border cursor-pointer ${
                                  activeTag === tag
                                    ? 'bg-cyan-600 text-white border-cyan-400'
                                    : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                                }`}
                              >
                                #{tag}
                              </span>
                            ))}

                            {/* Add Tag Quick Button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (tagEditorPath === file.file_path) {
                                  setTagEditorPath(null);
                                } else {
                                  setTagEditorPath(file.file_path);
                                  setTagInputText(songTags.join(', '));
                                }
                              }}
                              className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-zinc-800 text-[10px] flex items-center gap-0.5"
                              title="แก้ไขแท็กของเพลงนี้"
                            >
                              <Tag size={10} />
                              <span>{songTags.length > 0 ? 'แก้ไขแท็ก' : '+ แท็ก'}</span>
                            </button>
                          </div>

                          {/* Inline Tag Editor if open for this song */}
                          {tagEditorPath === file.file_path && (
                            <div className="mt-2 p-2 rounded-lg bg-black/40 border border-zinc-700/70 flex items-center gap-2">
                              <input
                                type="text"
                                value={tagInputText}
                                onChange={(e) => setTagInputText(e.target.value)}
                                placeholder="ใส่แท็ก คั่นด้วยจุลภาค เช่น exercise, pop, warmup"
                                className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const tagsArray = tagInputText
                                    .split(',')
                                    .map((s) => s.trim().replace(/^#/, ''))
                                    .filter(Boolean);
                                  setSongTags(file.file_path, tagsArray);
                                  setTagEditorPath(null);
                                }}
                                className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
                              >
                                บันทึก
                              </button>
                              <button
                                type="button"
                                onClick={() => setTagEditorPath(null)}
                                className="p-1 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Top-Right Action Group: [ ✂️ แยก Stem ] [ 📁 โฟลเดอร์ ] [ 🗑️ ลบไฟล์ ] */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* 1. Stem AI Splitter (Icon only) */}
                          {onSendToSplitter && (
                            <button
                              type="button"
                              onClick={() => {
                                onSendToSplitter(file.file_path);
                                onClose();
                              }}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-cyan-300 hover:bg-cyan-950/50 border border-transparent hover:border-cyan-500/30 transition-all cursor-pointer"
                              title="แยก Stem AI (Demucs) แยกเสียงร้องและเสียงดนตรี"
                            >
                              <Scissors size={15} />
                            </button>
                          )}

                          {/* 2. Assign to Folder Popover */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setFolderPickerPath(folderPickerPath === file.file_path ? null : file.file_path)
                              }
                              className={`px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-all cursor-pointer ${
                                songFolders.length > 0
                                  ? 'bg-purple-950/80 border-purple-500/50 text-purple-200 hover:bg-purple-900'
                                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border-transparent hover:border-zinc-750'
                              }`}
                              title={`จัดเก็บเพลงนี้ลงโฟลเดอร์ (${songFolders.length} โฟลเดอร์)`}
                            >
                              <Folder size={14} className={songFolders.length > 0 ? 'text-purple-400' : 'text-zinc-400'} />
                              {songFolders.length > 0 && (
                                <span className="text-[10px] px-1 rounded-full bg-purple-900/80 font-mono text-purple-200">
                                  {songFolders.length}
                                </span>
                              )}
                            </button>

                            {/* Popover checklist of folders */}
                            {folderPickerPath === file.file_path && (
                              <div className="absolute right-0 top-full mt-1.5 z-30 w-56 bg-[#1c1c24] border border-zinc-700 rounded-xl shadow-2xl p-2 text-xs space-y-1 animate-fade-in">
                                <div className="px-2 py-1 text-[11px] font-bold text-zinc-400 border-b border-zinc-800 flex items-center justify-between">
                                  <span>เลือกโฟลเดอร์สำหรับเพลงนี้</span>
                                  <button
                                    onClick={() => setFolderPickerPath(null)}
                                    className="text-zinc-500 hover:text-white cursor-pointer"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                                {folders.length === 0 ? (
                                  <div className="p-2 text-center text-[11px] text-zinc-500">
                                    ยังไม่มีโฟลเดอร์
                                  </div>
                                ) : (
                                  folders.map((folder) => {
                                    const inFolder = isFileInFolder(folder.id, file.file_path);
                                    return (
                                      <button
                                        key={folder.id}
                                        type="button"
                                        onClick={() => toggleFileInFolder(folder.id, file.file_path)}
                                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                                          inFolder
                                            ? 'bg-purple-900/60 text-purple-200 font-bold'
                                            : 'hover:bg-zinc-800 text-zinc-300'
                                        }`}
                                      >
                                        <span className="truncate flex items-center gap-1.5">
                                          <Folder size={12} className={inFolder ? 'text-purple-400' : 'text-zinc-500'} />
                                          {folder.name}
                                        </span>
                                        {inFolder && <Check size={13} className="text-purple-300 shrink-0" />}
                                      </button>
                                    );
                                  })
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFolderPickerPath(null);
                                    setFolderToEdit(null);
                                    setIsFolderModalOpen(true);
                                  }}
                                  className="w-full text-center py-1 text-[11px] text-purple-400 hover:text-purple-300 font-semibold cursor-pointer border-t border-zinc-800/80 mt-1"
                                >
                                  + สร้างโฟลเดอร์ใหม่
                                </button>
                              </div>
                            )}
                          </div>

                          {/* 3. Delete file button */}
                          {onDeleteDownloadedFile && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`ต้องการลบไฟล์ "${file.file_name}" ออกจากเครื่องใช่หรือไม่?`)) {
                                  onDeleteDownloadedFile(file.file_path);
                                }
                              }}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                              title="ลบไฟล์นี้ออกจากเครื่อง"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Spotify-style Clean Bottom Action Row: Vocal & Backing Track (Right Aligned) */}
                      {onAssignTrack && (
                        <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onAssignTrack('vocalRef', file.file_path, file.file_name);
                              onClose();
                            }}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-950/80 hover:bg-purple-900 border border-purple-500/50 text-purple-200 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                            title="โหลดไฟล์นี้เข้าช่องเสียงร้อง (Vocal Guide)"
                          >
                            <Mic size={13} className="text-purple-400" />
                            <span>Vocal</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onAssignTrack('instrumental', file.file_path, file.file_name);
                              onClose();
                            }}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-200 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                            title="โหลดไฟล์นี้เข้าช่องดนตรี (Backing Track)"
                          >
                            <Music size={13} className="text-emerald-400" />
                            <span>Instrument</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Folder Create / Edit Modal */}
        <FolderModal
          isOpen={isFolderModalOpen}
          onClose={() => setIsFolderModalOpen(false)}
          folderToEdit={folderToEdit}
          onSaveFolder={(name, desc, rating, tags) => {
            if (folderToEdit) {
              updateFolder(folderToEdit.id, {
                name,
                description: desc,
                rating,
                tags,
              });
            } else {
              createFolder(name, desc, rating, tags);
            }
          }}
        />
      </div>
    </div>
  );
};

