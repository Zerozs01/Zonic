import React, { useRef } from 'react';
import { UploadCloud, Music, Mic, CheckCircle2, Trash2, Loader2 } from 'lucide-react';
import { LoadedTrack } from '../types/audio';

interface DropZoneProps {
  vocalRefTrack: LoadedTrack | null;
  instrumentalTrack: LoadedTrack | null;
  onTrackLoaded: (trackType: 'vocalRef' | 'instrumental', file: File) => void;
  onClearTrack: (trackType: 'vocalRef' | 'instrumental') => void;
  isProcessing: boolean;
}

export const DropZone: React.FC<DropZoneProps> = React.memo(({
  vocalRefTrack,
  instrumentalTrack,
  onTrackLoaded,
  onClearTrack,
  isProcessing,
}) => {
  const vocalRefInputRef = useRef<HTMLInputElement>(null);
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
    <div className="dropzone-container grid-two-cols">
      {/* 🎤 Original Vocal Guide Reference Dropzone */}
      <div
        className={`glass-card dropzone-card ${vocalRefTrack ? 'active-track-purple' : ''}`}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, 'vocalRef')}
      >
        <input
          type="file"
          ref={vocalRefInputRef}
          onChange={(e) => handleFileChange(e, 'vocalRef')}
          accept="audio/*,.wav,.mp3,.ogg,.flac"
          style={{ display: 'none' }}
        />

        <div className="card-header">
          <div className="header-icon purple-glow">
            <Mic size={20} color="#a855f7" />
          </div>
          <div>
            <h3 className="card-title">Original Vocal Guide (เสียงคนร้องต้นฉบับ)</h3>
            <p className="card-subtitle">Isolated vocal stem for pitch contour & note detection</p>
          </div>
        </div>

        {vocalRefTrack ? (
          <div className="track-info-box purple-border">
            <div className="track-meta-row">
              <div className="track-name-group">
                <CheckCircle2 size={18} color="#a855f7" />
                <span className="track-name">{vocalRefTrack.name}</span>
              </div>
              <button
                className="btn-icon-danger"
                onClick={() => onClearTrack('vocalRef')}
                title="Remove Vocal Guide"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {vocalRefTrack.meta && (
              <div className="meta-details-grid">
                <div><span>Duration:</span> <strong>{vocalRefTrack.meta.duration_seconds.toFixed(1)}s</strong></div>
                <div><span>Sample Rate:</span> <strong>{vocalRefTrack.meta.sample_rate} Hz</strong></div>
                <div><span>Pitch Frames:</span> <strong>{vocalRefTrack.analysis?.voiced_frames || 0}</strong></div>
                <div><span>Avg Pitch:</span> <strong>{vocalRefTrack.analysis?.avg_pitch_hz.toFixed(1)} Hz</strong></div>
              </div>
            )}
          </div>
        ) : (
          <div className="dropzone-area purple-hover" onClick={() => vocalRefInputRef.current?.click()}>
            {isProcessing ? (
              <Loader2 size={36} color="#a855f7" className="spin-icon" />
            ) : (
              <UploadCloud size={36} color="#a855f7" className="bounce-icon" />
            )}
            <div className="dropzone-text">
              <strong>Drag & drop Original Vocal Track (เสียงคนร้อง)</strong>
              <span>or click to browse (.wav, .mp3, .flac)</span>
            </div>
          </div>
        )}
      </div>

      {/* 🎸 Backing Track / Instrumental Dropzone */}
      <div
        className={`glass-card dropzone-card ${instrumentalTrack ? 'active-track' : ''}`}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, 'instrumental')}
      >
        <input
          type="file"
          ref={instInputRef}
          onChange={(e) => handleFileChange(e, 'instrumental')}
          accept="audio/*,.wav,.mp3,.ogg,.flac"
          style={{ display: 'none' }}
        />

        <div className="card-header">
          <div className="header-icon cyan-glow">
            <Music size={20} color="#00f2fe" />
          </div>
          <div>
            <h3 className="card-title">Instrumental Track (เสียงเครื่องดนตรี / BGM)</h3>
            <p className="card-subtitle">Backing track played during live karaoke practice</p>
          </div>
        </div>

        {instrumentalTrack ? (
          <div className="track-info-box cyan-border">
            <div className="track-meta-row">
              <div className="track-name-group">
                <CheckCircle2 size={18} color="#00f2fe" />
                <span className="track-name">{instrumentalTrack.name}</span>
              </div>
              <button
                className="btn-icon-danger"
                onClick={() => onClearTrack('instrumental')}
                title="Remove Instrumental Track"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {instrumentalTrack.meta && (
              <div className="meta-details-grid">
                <div><span>Duration:</span> <strong>{instrumentalTrack.meta.duration_seconds.toFixed(1)}s</strong></div>
                <div><span>Sample Rate:</span> <strong>{instrumentalTrack.meta.sample_rate} Hz</strong></div>
                <div><span>Channels:</span> <strong>{instrumentalTrack.meta.channels}</strong></div>
                <div><span>Peak Amp:</span> <strong>{instrumentalTrack.meta.peak_amplitude.toFixed(2)}</strong></div>
              </div>
            )}
          </div>
        ) : (
          <div className="dropzone-area" onClick={() => instInputRef.current?.click()}>
            {isProcessing ? (
              <Loader2 size={36} color="#00f2fe" className="spin-icon" />
            ) : (
              <UploadCloud size={36} color="#00f2fe" className="bounce-icon" />
            )}
            <div className="dropzone-text">
              <strong>Drag & drop Instrumental Track (เสียงดนตรี)</strong>
              <span>or click to browse (.wav, .mp3, .flac)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

