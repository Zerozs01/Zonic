import React from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Volume2,
  VolumeX,
  Music2,
  Gauge,
  Bell,
  Mic,
} from 'lucide-react';

interface KaraokeControlBarProps {
  isPlaying: boolean;
  currentTimeSec: number;
  durationSec: number;
  onPlayPause: () => void;
  onStop: () => void;
  onSeek: (timeSec: number) => void;
  volume: number;
  onVolumeChange: (vol: number) => void;

  // Pitch Transpose
  transposeKey: number; // -6 to +6 semitones
  onTransposeChange: (newKey: number) => void;

  // Playback Speed Rate (0.25x to 1.5x)
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;

  // Metronome & BPM
  bpm: number;
  onBpmChange: (bpm: number) => void;
  metronomeActive: boolean;
  onToggleMetronome: () => void;

  // Guide Vocal Audio Toggle (Default OFF)
  vocalGuideEnabled: boolean;
  onToggleVocalGuide: () => void;
}

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5];

export const KaraokeControlBar: React.FC<KaraokeControlBarProps> = ({
  isPlaying,
  currentTimeSec,
  durationSec,
  onPlayPause,
  onStop,
  onSeek,
  volume,
  onVolumeChange,
  transposeKey,
  onTransposeChange,
  playbackRate,
  onPlaybackRateChange,
  bpm,
  onBpmChange,
  metronomeActive,
  onToggleMetronome,
  vocalGuideEnabled,
  onToggleVocalGuide,
}) => {
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="karaoke-control-bar youtube-style">
      {/* Primary Toolbar Row */}
      <div className="yt-control-row">
        {/* Playback Buttons */}
        <div className="yt-btn-group">
          <button
            className={`btn-play-clean ${isPlaying ? 'playing' : ''}`}
            onClick={onPlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
          </button>
          <button className="btn-icon-clean" onClick={onStop} title="Stop">
            <Square size={15} />
          </button>
          <button className="btn-icon-clean" onClick={() => onSeek(0)} title="Reset to Start">
            <RotateCcw size={15} />
          </button>
        </div>

        {/* Timeline Scrubber */}
        <div className="yt-timeline">
          <span className="time-lbl">{formatTime(currentTimeSec)}</span>
          <input
            type="range"
            min={0}
            max={durationSec || 100}
            step={0.01}
            value={currentTimeSec}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="slider-clean"
          />
          <span className="time-lbl muted">{formatTime(durationSec)}</span>
        </div>

        {/* Key Transpose Control */}
        <div className="yt-widget transpose">
          <Music2 size={14} color="#a855f7" />
          <span className="widget-lbl">คีย์:</span>
          <button
            className="btn-nano"
            onClick={() => onTransposeChange(Math.max(-6, transposeKey - 1))}
            disabled={transposeKey <= -6}
          >
            -
          </button>
          <strong className="widget-val">{transposeKey === 0 ? 'Orig' : transposeKey > 0 ? `+${transposeKey}` : transposeKey}</strong>
          <button
            className="btn-nano"
            onClick={() => onTransposeChange(Math.min(6, transposeKey + 1))}
            disabled={transposeKey >= 6}
          >
            +
          </button>
        </div>

        {/* Speed Rate Control */}
        <div className="yt-widget speed">
          <Gauge size={14} color="#00f2fe" />
          <select
            className="select-speed-clean"
            value={playbackRate}
            onChange={(e) => onPlaybackRateChange(parseFloat(e.target.value))}
          >
            {SPEED_OPTIONS.map((rate) => (
              <option key={rate} value={rate}>
                {rate === 1.0 ? '1.0x (Normal)' : `${rate}x`}
              </option>
            ))}
          </select>
        </div>

        {/* Guide Vocal Audio Toggle (Default OFF) */}
        <button
          className={`btn-widget-toggle ${vocalGuideEnabled ? 'active purple' : ''}`}
          onClick={onToggleVocalGuide}
          title={vocalGuideEnabled ? 'ปิดเสียงนักร้องต้นฉบับ' : 'เปิดเสียงนักร้องต้นฉบับ (Default: ปิดไว้ฟังเฉพาะเสียงเพลง)'}
        >
          <Mic size={14} color={vocalGuideEnabled ? '#a855f7' : '#9ca3af'} />
          <span>{vocalGuideEnabled ? 'เสียงร้องไกด์: ON' : 'เสียงร้องไกด์: OFF'}</span>
        </button>

        {/* Metronome Toggle */}
        <button
          className={`btn-widget-toggle ${metronomeActive ? 'active' : ''}`}
          onClick={onToggleMetronome}
          title={metronomeActive ? 'ปิดเมทานอม' : 'เปิดเมทานอม'}
        >
          <Bell size={14} />
          <span>{bpm} BPM</span>
        </button>

        {/* Volume */}
        <div className="yt-volume">
          {volume === 0 ? (
            <VolumeX size={16} color="#ef4444" onClick={() => onVolumeChange(0.8)} style={{ cursor: 'pointer' }} />
          ) : (
            <Volume2 size={16} color="#9ca3af" onClick={() => onVolumeChange(0)} style={{ cursor: 'pointer' }} />
          )}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="slider-volume-clean"
          />
        </div>
      </div>
    </div>
  );
};
