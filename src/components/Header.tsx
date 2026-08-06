import React, { useState } from 'react';
import { Menu, Download, Settings, Loader2, Music2 } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onDownloadYoutube?: (url: string, format: string) => void;
  isDownloading?: boolean;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  onOpenSettings,
  onDownloadYoutube,
  isDownloading = false,
}) => {
  const [youtubeUrl, setYoutubeUrl] = useState<string>('');
  const [format, setFormat] = useState<'FLAC' | 'MP3' | 'WAV'>('FLAC');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  const handleDownload = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!youtubeUrl.trim()) return;
    if (onDownloadYoutube) {
      onDownloadYoutube(youtubeUrl.trim(), format);
    }
  };

  return (
    <header className="w-full bg-zinc-950/90 border-b border-zinc-800/80 px-4 py-2.5 flex items-center justify-between gap-4 backdrop-blur-md sticky top-0 z-40">
      {/* Left: App Logo & Side Drawer Toggle Icon */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors cursor-pointer"
          title="Toggle Menu Drawer"
        >
          <Menu size={20} />
        </button>
        
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/40 flex items-center justify-center shadow-[0_0_12px_rgba(0,242,254,0.25)]">
            <Music2 size={18} className="text-cyan-400" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white hidden sm:inline-block">
            Zonic <span className="text-xs font-medium text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/50 ml-1">Studio</span>
          </span>
        </div>
      </div>

      {/* Center: Wide YouTube URL Input Box with Format Selector Dropdown & Download Button */}
      <form
        onSubmit={handleDownload}
        className="flex-1 max-w-2xl flex items-center bg-zinc-900/90 border border-zinc-700/60 rounded-full px-1.5 py-1 focus-within:border-cyan-500/80 focus-within:ring-1 focus-within:ring-cyan-500/40 transition-all shadow-inner"
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
          onChange={(e) => setFormat(e.target.value as 'FLAC' | 'MP3' | 'WAV')}
          className="bg-zinc-800/90 border border-zinc-700/80 text-xs font-semibold text-zinc-300 rounded-lg px-2.5 py-1.5 hover:text-white focus:outline-none focus:border-cyan-500 cursor-pointer mr-1.5"
        >
          <option value="FLAC">FLAC</option>
          <option value="MP3">MP3</option>
          <option value="WAV">WAV</option>
        </select>

        {/* Download Action Button */}
        <button
          type="submit"
          disabled={!youtubeUrl.trim() || isDownloading}
          className={`p-2 rounded-full transition-all flex items-center justify-center ${
            youtubeUrl.trim() && !isDownloading
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 hover:scale-105 active:scale-95 cursor-pointer'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
          }`}
          title="Download YouTube Audio"
        >
          {isDownloading ? (
            <Loader2 size={16} className="animate-spin text-cyan-400" />
          ) : (
            <Download size={16} />
          )}
        </button>
      </form>

      {/* Right: Settings Gear Icon Button */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors cursor-pointer"
          title="ตั้งค่าไมโครโฟน / เสียง"
        >
          <Settings size={20} />
        </button>
      </div>
    </header>
  );
});
