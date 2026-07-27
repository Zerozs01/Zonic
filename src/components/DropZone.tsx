import React, { useRef } from 'react';
import { UploadCloud, Music, Mic, FileText, CheckCircle2, Trash2 } from 'lucide-react';
import { LoadedTrack } from '../types/audio';

interface DropZoneProps {
  vocalTrack: LoadedTrack | null;
  referenceTrack: LoadedTrack | null;
  onTrackLoaded: (trackType: 'vocal' | 'reference', file: File) => void;
  onClearTrack: (trackType: 'vocal' | 'reference') => void;
  isProcessing: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  vocalTrack,
  referenceTrack,
  onTrackLoaded,
  onClearTrack,
  isProcessing,
}) => {
  const vocalInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, trackType: 'vocal' | 'reference') => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/') || file.name.match(/\.(wav|mp3|ogg|flac|m4a)$/i)) {
        onTrackLoaded(trackType, file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, trackType: 'vocal' | 'reference') => {
    if (e.target.files && e.target.files.length > 0) {
      onTrackLoaded(trackType, e.target.files[0]);
    }
  };

  return (
    <div className="dropzone-container grid-two-cols">
      {/* 🎤 Vocal Track Dropzone */}
      <div
        className={`glass-card dropzone-card ${vocalTrack ? 'active-track' : ''}`}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, 'vocal')}
      >
        <input
          type="file"
          ref={vocalInputRef}
          onChange={(e) => handleFileChange(e, 'vocal')}
          accept="audio/*,.wav,.mp3,.ogg,.flac"
          style={{ display: 'none' }}
        />

        <div className="card-header">
          <div className="header-icon cyan-glow">
            <Mic size={20} color="#00f2fe" />
          </div>
          <div>
            <h3 className="card-title">Vocal Track (User / Target)</h3>
            <p className="card-subtitle">Your recorded vocal stem (.wav, .mp3)</p>
          </div>
        </div>

        {vocalTrack ? (
          <div className="track-info-box cyan-border">
            <div className="track-meta-row">
              <div className="track-name-group">
                <CheckCircle2 size={18} color="#00f2fe" />
                <span className="track-name">{vocalTrack.name}</span>
              </div>
              <button
                className="btn-icon-danger"
                onClick={() => onClearTrack('vocal')}
                title="Remove Vocal Track"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {vocalTrack.meta && (
              <div className="meta-details-grid">
                <div><span>Duration:</span> <strong>{vocalTrack.meta.duration_seconds.toFixed(1)}s</strong></div>
                <div><span>Sample Rate:</span> <strong>{vocalTrack.meta.sample_rate} Hz</strong></div>
                <div><span>Voiced Frames:</span> <strong>{vocalTrack.analysis?.voiced_frames || 0}</strong></div>
                <div><span>Avg Pitch:</span> <strong>{vocalTrack.analysis?.avg_pitch_hz.toFixed(1)} Hz</strong></div>
              </div>
            )}
          </div>
        ) : (
          <div className="dropzone-area" onClick={() => vocalInputRef.current?.click()}>
            <UploadCloud size={36} color="#00f2fe" className="bounce-icon" />
            <div className="dropzone-text">
              <strong>Drag & drop Vocal Audio File here</strong>
              <span>or click to browse (.wav, .mp3, .flac)</span>
            </div>
          </div>
        )}
      </div>

      {/* 🎵 Reference / Guide Track Dropzone */}
      <div
        className={`glass-card dropzone-card ${referenceTrack ? 'active-track-purple' : ''}`}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, 'reference')}
      >
        <input
          type="file"
          ref={refInputRef}
          onChange={(e) => handleFileChange(e, 'reference')}
          accept="audio/*,.wav,.mp3,.ogg,.flac"
          style={{ display: 'none' }}
        />

        <div className="card-header">
          <div className="header-icon purple-glow">
            <Music size={20} color="#a855f7" />
          </div>
          <div>
            <h3 className="card-title">Reference Track (Guide Melody)</h3>
            <p className="card-subtitle">Original singer or instrumental melody reference</p>
          </div>
        </div>

        {referenceTrack ? (
          <div className="track-info-box purple-border">
            <div className="track-meta-row">
              <div className="track-name-group">
                <CheckCircle2 size={18} color="#a855f7" />
                <span className="track-name">{referenceTrack.name}</span>
              </div>
              <button
                className="btn-icon-danger"
                onClick={() => onClearTrack('reference')}
                title="Remove Reference Track"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {referenceTrack.meta && (
              <div className="meta-details-grid">
                <div><span>Duration:</span> <strong>{referenceTrack.meta.duration_seconds.toFixed(1)}s</strong></div>
                <div><span>Sample Rate:</span> <strong>{referenceTrack.meta.sample_rate} Hz</strong></div>
                <div><span>Voiced Frames:</span> <strong>{referenceTrack.analysis?.voiced_frames || 0}</strong></div>
                <div><span>Avg Pitch:</span> <strong>{referenceTrack.analysis?.avg_pitch_hz.toFixed(1)} Hz</strong></div>
              </div>
            )}
          </div>
        ) : (
          <div className="dropzone-area purple-hover" onClick={() => refInputRef.current?.click()}>
            <UploadCloud size={36} color="#a855f7" className="bounce-icon" />
            <div className="dropzone-text">
              <strong>Drag & drop Reference Guide Track</strong>
              <span>or click to browse (.wav, .mp3, .flac)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
