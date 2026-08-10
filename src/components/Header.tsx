import React, { useState } from 'react';
import { Menu, Download, Settings, Loader2 } from 'lucide-react';

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
      {/* Left: App Logo & Side Drawer Toggle Icon */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 rounded-lg bg-purple-950/40 border border-purple-500/80 text-purple-300 hover:text-white hover:bg-purple-900/60 transition-all cursor-pointer shadow-[0_0_10px_rgba(168,85,247,0.25)]"
          title="Toggle Menu Drawer"
        >
          <Menu size={20} />
        </button>
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
          onChange={(e) => setFormat(e.target.value as 'FLAC' | 'MP3' | 'WAV')}
          className="bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-300 rounded px-2 py-1 hover:text-white focus:outline-none focus:border-cyan-500 cursor-pointer mr-1.5"
        >
          <option value="FLAC">FLAC</option>
          <option value="MP3">MP3</option>
          <option value="WAV">WAV</option>
        </select>

        {/* Download Action Button */}
        <button
          type="submit"
          disabled={!youtubeUrl.trim() || isDownloading}
          className={`p-1.5 rounded transition-all flex items-center justify-center ${
            youtubeUrl.trim() && !isDownloading
              ? 'bg-zinc-700 hover:bg-zinc-600 text-white cursor-pointer'
              : 'text-zinc-500 cursor-not-allowed'
          }`}
          title="Download YouTube Audio"
        >
          {isDownloading ? (
            <Loader2 size={16} className="animate-spin text-cyan-400" />
          ) : (
            <Download size={18} className="text-zinc-300" />
          )}
        </button>
      </form>

      {/* Right: Settings Gear Icon Button */}
      <div className="flex items-center gap-2 shrink-0">
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
