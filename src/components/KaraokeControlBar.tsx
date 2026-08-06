import React from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Music2,
  Bell,
  ChevronUp,
  ChevronDown,
  Gauge,
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

  // Pitch Transpose (-6 to +6 semitones)
  transposeKey: number;
  onTransposeChange: (newKey: number) => void;

  // Playback Speed Rate (0.5x to 1.5x)
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;

  // Metronome & BPM
  bpm: number;
  onBpmChange: (bpm: number) => void;
  metronomeActive?: boolean;
  onToggleMetronome?: () => void;
}

const SPEED_OPTIONS = [
  { label: '0.5x', value: 0.5 },
  { label: '0.75x', value: 0.75 },
  { label: '1.0x (Normal)', value: 1.0 },
  { label: '1.25x', value: 1.25 },
  { label: '1.5x', value: 1.5 },
];

export const KaraokeControlBar: React.FC<KaraokeControlBarProps> = ({
  isPlaying,
  currentTimeSec,
  durationSec,
  onPlayPause,
  onStop,
  onSeek,
  transposeKey,
  onTransposeChange,
  playbackRate,
  onPlaybackRateChange,
  bpm,
  onBpmChange,
}) => {
  const formatTime = (sec: number) => {
    if (isNaN(sec) || sec <= 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };
  return (
    <footer className="w-full bg-zinc-950 border-t border-zinc-800/80 px-6 py-3 flex items-center justify-between gap-4 select-none">
      
      {/* 1. Key Transpose Widget (Left): [-] [🎵 Original key: x] [+] */}
      <div className="flex items-center bg-zinc-800/90 border border-zinc-700/60 rounded-xl overflow-hidden shadow-inner">
        <button
          onClick={() => onTransposeChange(Math.max(-6, transposeKey - 1))}
          disabled={transposeKey <= -6}
          className="px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-700/60 disabled:opacity-40 disabled:hover:bg-transparent font-bold transition-colors cursor-pointer text-base"
          title="Lower Pitch (-1 Semitone)"
        >
          -
        </button>

        <div className="px-3 py-1.5 flex flex-col items-center justify-center border-x border-zinc-700/50 min-w-[110px] bg-zinc-900/60">
          <div className="flex items-center gap-1 text-zinc-400 text-xs">
            <Music2 size={13} className="text-cyan-400" />
            <span>Key</span>
          </div>
          <span className="text-xs font-semibold text-zinc-200">
            {transposeKey === 0 ? 'Original key: 0' : transposeKey > 0 ? `Original key: +${transposeKey}` : `Original key: ${transposeKey}`}
          </span>
        </div>

        <button
          onClick={() => onTransposeChange(Math.min(6, transposeKey + 1))}
          disabled={transposeKey >= 6}
          className="px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-700/60 disabled:opacity-40 disabled:hover:bg-transparent font-bold transition-colors cursor-pointer text-base"
          title="Raise Pitch (+1 Semitone)"
        >
          +
        </button>
      </div>

      {/* 2. BPM Adjuster Widget (Center-Left): [ 🔔 120 BPM ⇡⇣ ] */}
      <div className="flex items-center bg-zinc-800/90 border border-zinc-700/60 rounded-xl px-3 py-1.5 gap-2 shadow-inner">
        <Bell size={16} className="text-amber-400" />
        <span className="text-sm font-bold text-zinc-100 font-mono tracking-tight">{bpm} BPM</span>
        
        <div className="flex flex-col border-l border-zinc-700/60 pl-1.5">
          <button
            onClick={() => onBpmChange(Math.min(240, bpm + 1))}
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Increase BPM"
          >
            <ChevronUp size={12} />
          </button>
          <button
            onClick={() => onBpmChange(Math.max(40, bpm - 1))}
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Decrease BPM"
          >
            <ChevronDown size={12} />
          </button>
        </div>
      </div>

      {/* 3. Primary Transport Playback Controls (Center): [Stop], [Play/Pause], [Replay] */}
      <div className="flex items-center gap-4">
        {/* Stop Button */}
        <button
          onClick={onStop}
          className="w-10 h-10 rounded-lg bg-zinc-800/90 border border-zinc-700/60 hover:bg-zinc-700/80 text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow"
          title="Stop Playback"
        >
          <Square size={16} />
        </button>

        {/* Big Circular Play / Pause Button */}
        <button
          onClick={onPlayPause}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg ${
            isPlaying
              ? 'bg-gradient-to-br from-amber-500 to-red-600 text-white shadow-amber-500/25 hover:scale-105'
              : 'bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 text-white shadow-cyan-500/30 hover:scale-105'
          }`}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause size={24} className="fill-white" />
          ) : (
            <Play size={24} className="fill-white ml-1" />
          )}
        </button>

        {/* Replay / Restart Button */}
        <button
          onClick={() => onSeek(0)}
          className="w-10 h-10 rounded-full bg-zinc-800/90 border border-zinc-700/60 hover:bg-zinc-700/80 text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow"
          title="Replay from Beginning"
        >
          <RotateCcw size={16} />
        </button>

        {/* Time Readout */}
        <div className="text-xs font-mono text-zinc-400 bg-zinc-900/90 border border-zinc-800 px-2.5 py-1 rounded-md">
          <span className="text-cyan-400 font-semibold">{formatTime(currentTimeSec)}</span>
          <span className="text-zinc-600 mx-1">/</span>
          <span>{formatTime(durationSec)}</span>
        </div>
      </div>

      {/* 4. Playback Speed Selector (Right): [ 1.0x (Normal) ▾ ] */}
      <div className="flex items-center bg-zinc-800/90 border border-zinc-700/60 rounded-xl px-3 py-1.5 gap-2 shadow-inner">
        <Gauge size={15} className="text-cyan-400" />
        <select
          value={playbackRate}
          onChange={(e) => onPlaybackRateChange(parseFloat(e.target.value))}
          className="bg-transparent text-xs font-bold text-cyan-400 focus:outline-none cursor-pointer"
        >
          {SPEED_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-zinc-900 text-zinc-200">
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </footer>
  );
};
