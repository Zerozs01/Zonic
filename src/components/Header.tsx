import React, { useState } from 'react';
import { Menu, Download, Settings, Loader2, ListMusic, Scissors, Activity, Video } from 'lucide-react';
import { AudioFormat } from '../types/downloader';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenDownloader?: () => void;
  onOpenSplitter?: () => void;
  onDownloadYoutube?: (url: string, format: AudioFormat) => void;
  isDownloading?: boolean;
  activeDownloadCount?: number;
  viewMode?: 'stage' | 'video';
  onViewModeChange?: (mode: 'stage' | 'video') => void;
  hasVideo?: boolean;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  onOpenSettings,
  onOpenDownloader,
  onOpenSplitter,
  onDownloadYoutube,
  isDownloading = false,
  activeDownloadCount = 0,
  viewMode = 'stage',
  onViewModeChange,
  hasVideo = false,
}) => {
  const [youtubeUrl, setYoutubeUrl] = useState<string>('');
  const [format, setFormat] = useState<AudioFormat>('flac');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  const handleDownload = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!youtubeUrl.trim()) {
      if (onOpenDownloader) onOpenDownloader();
      return;
    }
    if (onDownloadYoutube) {
      onDownloadYoutube(youtubeUrl.trim(), format);
      setYoutubeUrl('');
    }
  };

  return (
    <header
      style={{
        backgroundColor: '#19191e',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        padding: '10px 20px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
      }}
      className="w-full flex items-center justify-between gap-4 shrink-0"
    >
      {/* Left: App Menu & View Mode Toggle (Score vs Video) in Red-Box Spot */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 rounded-lg bg-purple-950/40 border border-purple-500/80 text-purple-300 hover:text-white hover:bg-purple-900/60 transition-all cursor-pointer shadow-[0_0_10px_rgba(168,85,247,0.25)]"
          title="Toggle Menu Drawer"
        >
          <Menu size={20} />
        </button>

        {/* View Mode Toggle: [ 📊 หน้าจอคะแนน ] [ 🎬 ภาพวิดีโอ ] */}
        {onViewModeChange && (
          <div className="flex items-center bg-[#22222a] border border-zinc-700/80 rounded-xl p-1 shadow-inner gap-1">
            <button
              type="button"
              onClick={() => onViewModeChange('stage')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'stage'
                  ? 'bg-purple-600/90 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
              title="สลับเป็นหน้าจอคะแนนและการเทียบเสียง (Score & Pitch Roll)"
            >
              <Activity size={14} className={viewMode === 'stage' ? 'text-white' : 'text-purple-400'} />
              <span className="hidden md:inline">หน้าจอคะแนน</span>
            </button>

            <button
              type="button"
              onClick={() => onViewModeChange('video')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer relative ${
                viewMode === 'video'
                  ? 'bg-cyan-600/90 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
              title="สลับเป็นภาพวิดีโอคาราโอเกะ (Karaoke Video Player)"
            >
              <Video size={14} className={viewMode === 'video' ? 'text-white' : 'text-cyan-400'} />
              <span className="hidden md:inline">ภาพวิดีโอ</span>
              {hasVideo && (
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse ml-0.5" title="มีวิดีโอพร้อมเล่น" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Center: Wide YouTube URL Input Box with Format Selector Dropdown & Download Button */}
      <form
        onSubmit={handleDownload}
        className="flex-1 max-w-xl flex items-center bg-[#2b2b2b] border border-zinc-700/80 rounded-md px-2 py-1 focus-within:border-cyan-500/80 transition-all shadow-inner"
      >
        <input
          type="text"
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          placeholder="วางลิงก์ YouTube URL เพื่อดาวน์โหลดเพลงคาราโอเกะ (e.g. https://www.youtube.com/watch?v=...)"
          className="flex-1 bg-transparent px-3 py-1 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none min-w-0"
        />

        {/* Format Selector Dropdown */}
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value.toLowerCase() as AudioFormat)}
          className="bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-300 rounded px-2 py-1 hover:text-white focus:outline-none focus:border-cyan-500 cursor-pointer mr-1.5 uppercase"
        >
          <option value="flac">FLAC</option>
          <option value="mp3">MP3</option>
          <option value="wav">WAV</option>
          <option value="mp4">MP4 (Video)</option>
        </select>

        {/* Download Action Button */}
        <button
          type="submit"
          className="p-1.5 rounded transition-all flex items-center justify-center bg-cyan-700/80 hover:bg-cyan-600 text-white cursor-pointer mr-1 shadow-sm"
          title={youtubeUrl.trim() ? "ดาวน์โหลดเข้าคิว" : "เปิดตัวจัดการดาวน์โหลด"}
        >
          {isDownloading ? (
            <Loader2 size={16} className="animate-spin text-cyan-200" />
          ) : (
            <Download size={18} className="text-white" />
          )}
        </button>

        {/* Queue Manager Button */}
        {onOpenDownloader && (
          <button
            type="button"
            onClick={onOpenDownloader}
            className="p-1.5 rounded text-zinc-400 hover:text-cyan-300 hover:bg-zinc-700/60 transition-colors relative cursor-pointer"
            title="เปิดคิวดาวน์โหลด (Download Queue)"
          >
            <ListMusic size={18} />
            {activeDownloadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-500 text-[10px] font-bold text-black flex items-center justify-center animate-pulse">
                {activeDownloadCount}
              </span>
            )}
          </button>
        )}
      </form>

      {/* Right: Stem Splitter & Settings Buttons */}
      <div className="flex items-center gap-2 shrink-0">
        {onOpenSplitter && (
          <button
            onClick={onOpenSplitter}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 border border-purple-500/40 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="แยกเสียงร้องและเสียงดนตรี (AI Stem Splitter)"
          >
            <Scissors size={14} className="text-purple-400" />
            <span className="hidden sm:inline">Stem Splitter</span>
          </button>
        )}

        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
          title="ตั้งค่าไมโครโฟน / เสียง"
        >
          <Settings size={22} />
        </button>
      </div>
    </header>
  );
});
