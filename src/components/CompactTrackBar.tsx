import React, { useRef } from 'react';
import { Mic, Music, UploadCloud, CheckCircle2, Trash2, Loader2 } from 'lucide-react';
import { LoadedTrack } from '../types/audio';

interface CompactTrackBarProps {
  vocalRefTrack: LoadedTrack | null;
  instrumentalTrack: LoadedTrack | null;
  onTrackLoaded: (trackType: 'vocalRef' | 'instrumental', file: File) => void;
  onClearTrack: (trackType: 'vocalRef' | 'instrumental') => void;
  isProcessing: boolean;
}

export const CompactTrackBar: React.FC<CompactTrackBarProps> = React.memo(({
  vocalRefTrack,
  instrumentalTrack,
  onTrackLoaded,
  onClearTrack,
  isProcessing,
}) => {
  const vocalInputRef = useRef<HTMLInputElement>(null);
  const instInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, trackType: 'vocalRef' | 'instrumental') => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/') || file.name.match(/\.(wav|mp3|ogg|flac|m4a)$/i)) {
        onTrackLoaded(trackType, file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, trackType: 'vocalRef' | 'instrumental') => {
    if (e.target.files && e.target.files.length > 0) {
      onTrackLoaded(trackType, e.target.files[0]);
    }
  };

  return (
    <div className="compact-track-bar">
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
        onChange={(e) => handleFileChange(e, 'instInputRef' as any ? 'instrumental' : 'instrumental')}
        accept="audio/*,.wav,.mp3,.ogg,.flac"
        style={{ display: 'none' }}
      />

      {/* Vocal Reference Track Pill */}
      <div
        className={`track-pill purple ${vocalRefTrack ? 'loaded' : ''}`}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, 'vocalRef')}
        onClick={() => !vocalRefTrack && vocalInputRef.current?.click()}
      >
        <div className="pill-icon purple">
          <Mic size={16} />
        </div>

        {vocalRefTrack ? (
          <div className="pill-content">
            <span className="pill-title">เสียงร้อง (Vocal):</span>
            <span className="pill-name" title={vocalRefTrack.name}>{vocalRefTrack.name}</span>
            {vocalRefTrack.meta && (
              <span className="pill-meta">{vocalRefTrack.meta.duration_seconds.toFixed(0)}s</span>
            )}
            <button
              className="pill-clear-btn"
              onClick={(e) => {
                e.stopPropagation();
                onClearTrack('vocalRef');
              }}
              title="Remove Vocal Track"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ) : (
          <div className="pill-content prompt">
            {isProcessing ? (
              <Loader2 size={16} className="spin-icon" color="#a855f7" />
            ) : (
              <UploadCloud size={16} color="#a855f7" />
            )}
            <span className="pill-text">วางหรือเลือก <strong>ไฟล์เสียงร้องต้นฉบับ (Guide Vocal)</strong></span>
          </div>
        )}
      </div>

      {/* Instrumental Track Pill */}
      <div
        className={`track-pill cyan ${instrumentalTrack ? 'loaded' : ''}`}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, 'instrumental')}
        onClick={() => !instrumentalTrack && instInputRef.current?.click()}
      >
        <div className="pill-icon cyan">
          <Music size={16} />
        </div>

        {instrumentalTrack ? (
          <div className="pill-content">
            <span className="pill-title">ดนตรี (Instrumental):</span>
            <span className="pill-name" title={instrumentalTrack.name}>{instrumentalTrack.name}</span>
            {instrumentalTrack.meta && (
              <span className="pill-meta">{instrumentalTrack.meta.duration_seconds.toFixed(0)}s</span>
            )}
            <button
              className="pill-clear-btn"
              onClick={(e) => {
                e.stopPropagation();
                onClearTrack('instrumental');
              }}
              title="Remove Instrumental Track"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ) : (
          <div className="pill-content prompt">
            {isProcessing ? (
              <Loader2 size={16} className="spin-icon" color="#00f2fe" />
            ) : (
              <UploadCloud size={16} color="#00f2fe" />
            )}
            <span className="pill-text">วางหรือเลือก <strong>ไฟล์เสียงดนตรี (BGM/Backing Track)</strong></span>
          </div>
        )}
      </div>
    </div>
  );
});
