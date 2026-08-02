import React, { useRef } from 'react';
import { Mic, Music, Settings, Trophy, UploadCloud, Trash2, Loader2 } from 'lucide-react';
import { LoadedTrack } from '../types/audio';

interface HeaderProps {
  vocalRefTrack: LoadedTrack | null;
  instrumentalTrack: LoadedTrack | null;
  onTrackLoaded: (trackType: 'vocalRef' | 'instrumental', file: File) => void;
  onClearTrack: (trackType: 'vocalRef' | 'instrumental') => void;
  isProcessing: boolean;
  onOpenSettings: () => void;
  onOpenResults?: () => void;
  hasScore?: boolean;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  vocalRefTrack,
  instrumentalTrack,
  onTrackLoaded,
  onClearTrack,
  isProcessing,
  onOpenSettings,
  onOpenResults,
  hasScore = false,
}) => {
  const vocalInputRef = useRef<HTMLInputElement>(null);
  const instInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, trackType: 'vocalRef' | 'instrumental') => {
    if (e.target.files && e.target.files.length > 0) {
      onTrackLoaded(trackType, e.target.files[0]);
    }
  };

  return (
    <header className="app-header minimal">
      <input
        type="file"
        ref={vocalInputRef}
        onChange={(e) => handleFileChange(e, 'vocalRef')}
        accept="audio/*,.wav,.mp3,.ogg,.flac"
        style={{ display: 'none' }}
      />
      <input
        type="file"
        ref={instInputRef}
        onChange={(e) => handleFileChange(e, 'instrumental')}
        accept="audio/*,.wav,.mp3,.ogg,.flac"
        style={{ display: 'none' }}
      />

      {/* Brand Logo & Title */}
      <div className="brand-group">
        <div className="logo-box small">
          <Mic className="brand-icon" size={20} />
        </div>
        <div className="brand-titles">
          <h1 className="brand-title minimal">VocalAlign</h1>
          <span className="brand-tag">Karaoke Studio</span>
        </div>
      </div>

      {/* Center: Integrated Track Loader Buttons in Header */}
      <div className="header-track-loaders">
        {/* Vocal Guide Import Button */}
        <div className={`header-track-btn purple ${vocalRefTrack ? 'loaded' : ''}`}>
          {vocalRefTrack ? (
            <>
              <Mic size={14} color="#a855f7" />
              <span className="header-track-name" title={vocalRefTrack.name}>
                {vocalRefTrack.name}
              </span>
              <button
                className="header-clear-icon"
                onClick={() => onClearTrack('vocalRef')}
                title="ลบไฟล์เสียงร้อง"
              >
                <Trash2 size={12} />
              </button>
            </>
          ) : (
            <button className="header-upload-btn purple" onClick={() => vocalInputRef.current?.click()}>
              {isProcessing ? <Loader2 size={14} className="spin-icon" /> : <UploadCloud size={14} />}
              <span>+ เลือกไฟล์เสียงร้อง (Vocal Guide)</span>
            </button>
          )}
        </div>

        {/* Instrumental BGM Import Button */}
        <div className={`header-track-btn cyan ${instrumentalTrack ? 'loaded' : ''}`}>
          {instrumentalTrack ? (
            <>
              <Music size={14} color="#00f2fe" />
              <span className="header-track-name" title={instrumentalTrack.name}>
                {instrumentalTrack.name}
              </span>
              <button
                className="header-clear-icon"
                onClick={() => onClearTrack('instrumental')}
                title="ลบไฟล์เสียงดนตรี"
              >
                <Trash2 size={12} />
              </button>
            </>
          ) : (
            <button className="header-upload-btn cyan" onClick={() => instInputRef.current?.click()}>
              {isProcessing ? <Loader2 size={14} className="spin-icon" /> : <UploadCloud size={14} />}
              <span>+ เลือกไฟล์เสียงดนตรี (BGM)</span>
            </button>
          )}
        </div>
      </div>

      {/* Right Actions: Settings & Results */}
      <div className="header-actions">
        {hasScore && onOpenResults && (
          <button className="btn-header-action highlight" onClick={onOpenResults} title="ดูผลการร้องซ้อมล่าสุด">
            <Trophy size={15} />
            <span>ผลการร้อง</span>
          </button>
        )}
        <button className="btn-header-action" onClick={onOpenSettings} title="ตั้งค่าไมโครโฟน">
          <Settings size={16} />
          <span>ตั้งค่าไมค์</span>
        </button>
      </div>
    </header>
  );
});
