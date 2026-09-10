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
  { label: '0.50x', value: 0.5 },
  { label: '0.60x', value: 0.6 },
  { label: '0.70x', value: 0.7 },
  { label: '0.75x', value: 0.75 },
  { label: '0.80x', value: 0.8 },
  { label: '0.85x', value: 0.85 },
  { label: '0.90x', value: 0.9 },
  { label: '0.95x', value: 0.95 },
  { label: '1.00x (Normal)', value: 1.0 },
  { label: '1.05x', value: 1.05 },
  { label: '1.10x', value: 1.1 },
  { label: '1.15x', value: 1.15 },
  { label: '1.20x', value: 1.2 },
  { label: '1.25x', value: 1.25 },
  { label: '1.35x', value: 1.35 },
  { label: '1.50x', value: 1.5 },
  { label: '1.75x', value: 1.75 },
  { label: '2.00x', value: 2.0 },
];

export const KaraokeControlBar: React.FC<KaraokeControlBarProps> = React.memo(({
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

  const handleStepRate = (delta: number) => {
    const nextRate = Math.round((playbackRate + delta) * 100) / 100;
    const clamped = Math.max(0.5, Math.min(2.0, nextRate));
    onPlaybackRateChange(clamped);
  };
  return (
    <footer
      style={{
        backgroundColor: '#19191e',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        padding: '10px 24px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
      }}
      className="w-full flex items-center justify-between gap-4 select-none shrink-0"
    >
      
      {/* 1. Key Transpose Widget (Left): [-] [🎵 Original key: x] [+] */}
      <div className="flex items-center bg-[#2b2b2b] border border-zinc-700/60 rounded-md overflow-hidden shadow">
        <button
          onClick={() => onTransposeChange(Math.max(-6, transposeKey - 1))}
          disabled={transposeKey <= -6}
          className="px-3 py-1.5 text-zinc-200 hover:bg-zinc-700 disabled:opacity-40 font-bold transition-colors cursor-pointer text-base"
          title="Lower Pitch (-1 Semitone)"
        >
          -
        </button>

        <div className="px-3 py-1 flex items-center gap-1.5 border-x border-zinc-700/60 bg-[#222222]">
          <Music2 size={13} className="text-cyan-400" />
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-zinc-400 font-semibold leading-tight">Key</span>
            <span className="text-xs font-bold text-zinc-100 leading-tight">
              {transposeKey === 0 ? 'Original key: 0' : transposeKey > 0 ? `Original key: +${transposeKey}` : `Original key: ${transposeKey}`}
            </span>
          </div>
        </div>

        <button
          onClick={() => onTransposeChange(Math.min(6, transposeKey + 1))}
          disabled={transposeKey >= 6}
          className="px-3 py-1.5 text-zinc-200 hover:bg-zinc-700 disabled:opacity-40 font-bold transition-colors cursor-pointer text-base"
          title="Raise Pitch (+1 Semitone)"
        >
          +
        </button>
      </div>

      {/* 2. BPM Adjuster Widget (Center-Left): [ 🔔 120 BPM ⇡⇣ ] */}
      <div className="flex items-center bg-[#2b2b2b] border border-zinc-700/60 rounded-lg px-3 py-1.5 gap-2 shadow">
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
          className="w-10 h-10 rounded-lg bg-[#333333] border border-zinc-700/80 hover:bg-zinc-600 text-zinc-200 flex items-center justify-center transition-all cursor-pointer shadow"
          title="Stop Playback"
        >
          <Square size={16} className="fill-zinc-200" />
        </button>

        {/* Big Bright White Circular Play / Pause Button */}
        <button
          onClick={onPlayPause}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xl ${
            isPlaying
              ? 'bg-amber-500 hover:bg-amber-400 text-zinc-900'
              : 'bg-white hover:bg-zinc-100 text-zinc-900 hover:scale-105 active:scale-95'
          }`}
          title={isPlaying ? 'Pause (Spacebar)' : 'Play (Spacebar)'}
        >
          {isPlaying ? (
            <Pause size={24} className="fill-zinc-900 text-zinc-900" />
          ) : (
            <Play size={24} className="fill-zinc-900 text-zinc-900 ml-1" />
          )}
        </button>

        {/* Replay / Restart Button */}
        <button
          onClick={() => onSeek(0)}
          className="w-10 h-10 rounded-full bg-[#333333] border border-zinc-700/80 hover:bg-zinc-600 text-zinc-200 flex items-center justify-center transition-all cursor-pointer shadow"
          title="Replay from Beginning"
        >
          <RotateCcw size={16} />
        </button>

        {/* Time Readout */}
        <div className="text-xs font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-md">
          <span className="text-cyan-400 font-semibold">{formatTime(currentTimeSec)}</span>
          <span className="text-zinc-600 mx-1">/</span>
          <span>{formatTime(durationSec)}</span>
        </div>
      </div>

      {/* 4. Playback Speed Selector (Right): [-] [ ⏱️ 1.00x ▾ ] [+] */}
      <div className="flex items-center bg-[#2b2b2b] border border-zinc-700/60 rounded-md overflow-hidden shadow">
        <button
          onClick={() => handleStepRate(-0.05)}
          disabled={playbackRate <= 0.5}
          className="px-2.5 py-1.5 text-zinc-200 hover:bg-zinc-700 disabled:opacity-40 font-bold transition-colors cursor-pointer text-sm"
          title="Decrease speed by -0.05x"
        >
          -
        </button>

        <div className="px-2.5 py-1 flex items-center gap-1.5 border-x border-zinc-700/60 bg-[#222222]">
          <Gauge size={14} className="text-cyan-400 shrink-0" />
          <select
            value={playbackRate}
            onChange={(e) => onPlaybackRateChange(parseFloat(e.target.value))}
            className="bg-transparent text-xs font-bold text-cyan-400 focus:outline-none cursor-pointer"
          >
            {!SPEED_OPTIONS.some((opt) => Math.abs(opt.value - playbackRate) < 0.001) && (
              <option value={playbackRate} className="bg-zinc-900 text-zinc-200">
                {playbackRate.toFixed(2)}x
              </option>
            )}
            {SPEED_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-zinc-900 text-zinc-200">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => handleStepRate(0.05)}
          disabled={playbackRate >= 2.0}
          className="px-2.5 py-1.5 text-zinc-200 hover:bg-zinc-700 disabled:opacity-40 font-bold transition-colors cursor-pointer text-sm"
          title="Increase speed by +0.05x"
        >
          +
        </button>
      </div>
    </footer>
  );
});
