import React from 'react';
import { Play, Pause, Square, Volume2, RotateCcw } from 'lucide-react';

interface AudioControlsProps {
  isPlaying: boolean;
  currentTimeSec: number;
  durationSec: number;
  onPlayPause: () => void;
  onStop: () => void;
  onSeek: (timeSec: number) => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  isPlaying,
  currentTimeSec,
  durationSec,
  onPlayPause,
  onStop,
  onSeek,
  volume,
  onVolumeChange,
}) => {
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="glass-card audio-controls-card">
      <div className="controls-main-row">
        {/* Playback Buttons */}
        <div className="btn-group">
          <button className="btn-play-primary" onClick={onPlayPause}>
            {isPlaying ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: 2 }} />}
          </button>
          <button className="btn-control-secondary" onClick={onStop} title="Stop Playback">
            <Square size={16} />
          </button>
          <button
            className="btn-control-secondary"
            onClick={() => onSeek(0)}
            title="Reset to Start"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {/* Timeline Slider */}
        <div className="timeline-scrubber-group">
          <span className="time-text">{formatTime(currentTimeSec)}</span>
          <input
            type="range"
            min={0}
            max={durationSec || 100}
            step={0.01}
            value={currentTimeSec}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="timeline-slider"
          />
          <span className="time-text muted">{formatTime(durationSec)}</span>
        </div>

        {/* Volume Slider */}
        <div className="volume-group">
          <Volume2 size={18} color="#9ca3af" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="volume-slider"
          />
        </div>
      </div>
    </div>
  );
};
