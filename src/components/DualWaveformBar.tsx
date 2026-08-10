import React, { useRef, useEffect } from 'react';
import { Upload, Volume2, VolumeX } from 'lucide-react';
import { LoadedTrack } from '../types/audio';
import { setTrackGainNative, setTrackMuteNative } from '../services/tauriBridge';

interface DualWaveformBarProps {
  vocalRefTrack: LoadedTrack | null;
  instrumentalTrack: LoadedTrack | null;
  currentTimeSec: number;
  durationSec: number;
  onSeek: (timeSec: number) => void;
  onTrackLoaded: (trackType: 'vocalRef' | 'instrumental', file: File) => void;
  instVolume: number;
  onInstVolumeChange: (vol: number) => void;
  vocalVolume: number;
  onVocalVolumeChange: (vol: number) => void;
}

export const DualWaveformBar: React.FC<DualWaveformBarProps> = React.memo(({
  vocalRefTrack,
  instrumentalTrack,
  currentTimeSec,
  durationSec,
  onSeek,
  onTrackLoaded,
  instVolume,
  onInstVolumeChange,
  vocalVolume,
  onVocalVolumeChange,
}) => {
  const vocalInputRef = useRef<HTMLInputElement>(null);
  const instInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const vocalCanvasRef = useRef<HTMLCanvasElement>(null);
  const instCanvasRef = useRef<HTMLCanvasElement>(null);

  const handleInstVolume = (vol: number) => {
    onInstVolumeChange(vol);
    setTrackGainNative('instrumental', vol).catch(() => {});
    setTrackMuteNative('instrumental', vol === 0).catch(() => {});
  };

  const handleVocalVolume = (vol: number) => {
    onVocalVolumeChange(vol);
    setTrackGainNative('vocalRef', vol).catch(() => {});
    setTrackMuteNative('vocalRef', vol === 0).catch(() => {});
  };

  // Render Music (Instrumental) Waveform
  useEffect(() => {
    const canvas = instCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.offsetWidth || 800;
    const height = canvas.offsetHeight || 44;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.clearRect(0, 0, width, height);

    // Background fill
    ctx.fillStyle = '#06261c';
    ctx.fillRect(0, 0, width, height);

    const buffer = instrumentalTrack?.audioBuffer;
    if (buffer) {
      const data = buffer.getChannelData(0);
      const step = Math.ceil(data.length / width);
      const amp = height / 2;

      ctx.fillStyle = '#00ff88'; // Bright Neon Emerald
      for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
          const datum = data[i * step + j];
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
        const barHeight = Math.max(2, (max - min) * amp * 0.9);
        ctx.fillRect(i, amp - barHeight / 2, 1.5, barHeight);
      }
    } else {
      // Placeholder Waveform Pattern when empty
      ctx.fillStyle = 'rgba(0, 255, 136, 0.4)';
      for (let i = 0; i < width; i += 4) {
        const h = Math.sin(i * 0.05) * 12 + 16;
        ctx.fillRect(i, (height - h) / 2, 2, h);
      }
    }
  }, [instrumentalTrack, durationSec]);

  // Render Vocal Waveform
  useEffect(() => {
    const canvas = vocalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.offsetWidth || 800;
    const height = canvas.offsetHeight || 44;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.clearRect(0, 0, width, height);

    // Background fill
    ctx.fillStyle = '#1e1136';
    ctx.fillRect(0, 0, width, height);

    const buffer = vocalRefTrack?.audioBuffer;
    if (buffer) {
      const data = buffer.getChannelData(0);
      const step = Math.ceil(data.length / width);
      const amp = height / 2;

      ctx.fillStyle = '#b76eff'; // Bright Neon Purple
      for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
          const datum = data[i * step + j];
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
        const barHeight = Math.max(2, (max - min) * amp * 0.9);
        ctx.fillRect(i, amp - barHeight / 2, 1.5, barHeight);
      }
    } else {
      // Placeholder Waveform Pattern when empty
      ctx.fillStyle = 'rgba(183, 110, 255, 0.4)';
      for (let i = 0; i < width; i += 4) {
        const h = Math.cos(i * 0.05) * 12 + 16;
        ctx.fillRect(i, (height - h) / 2, 2, h);
      }
    }
  }, [vocalRefTrack, durationSec]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || durationSec <= 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * durationSec);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, trackType: 'vocalRef' | 'instrumental') => {
    if (e.target.files && e.target.files.length > 0) {
      onTrackLoaded(trackType, e.target.files[0]);
    }
  };

  const progressPercent = durationSec > 0 ? Math.min(100, (currentTimeSec / durationSec) * 100) : 0;

  return (
    <div
      style={{
        backgroundColor: '#19191e',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        padding: '10px 14px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
      }}
      className="w-full flex flex-col gap-2 select-none relative shrink-0"
    >
      <input
        type="file"
        ref={instInputRef}
        onChange={(e) => handleFileChange(e, 'instrumental')}
        accept="audio/*,.wav,.mp3,.ogg,.flac"
        style={{ display: 'none' }}
      />
      <input
        type="file"
        ref={vocalInputRef}
        onChange={(e) => handleFileChange(e, 'vocalRef')}
        accept="audio/*,.wav,.mp3,.ogg,.flac"
        style={{ display: 'none' }}
      />

      {/* Row 1: Music / Instrumental Track */}
      <div className="flex items-center gap-3 h-12 bg-[#121212] rounded px-3 border border-zinc-800/60 overflow-hidden">
        {/* Left Track Control */}
        <div className="flex items-center gap-2.5 w-44 shrink-0">
          <span className="text-xs font-semibold text-emerald-400 w-12 shrink-0">Music</span>
          <button
            onClick={() => instInputRef.current?.click()}
            className="p-1 rounded bg-zinc-800 border border-emerald-500/40 hover:bg-emerald-950/80 text-emerald-400 transition-colors cursor-pointer"
            title="อัปโหลด/เปลี่ยนไฟล์เสียงดนตรี (Instrumental)"
          >
            <Upload size={14} />
          </button>

          {/* Volume Fader */}
          <div className="flex items-center gap-1 flex-1">
            <button
              onClick={() => handleInstVolume(instVolume > 0 ? 0 : 0.8)}
              className="text-zinc-400 hover:text-emerald-400 cursor-pointer"
            >
              {instVolume === 0 ? <VolumeX size={12} className="text-red-400" /> : <Volume2 size={12} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={instVolume}
              onChange={(e) => handleInstVolume(parseFloat(e.target.value))}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
          </div>
        </div>

        {/* Waveform Viewport */}
        <div
          ref={containerRef}
          onClick={handleTimelineClick}
          className="flex-1 h-full relative cursor-pointer overflow-hidden rounded bg-[#06261c]"
        >
          <canvas ref={instCanvasRef} className="w-full h-full block" />
          
          {/* Synchronized Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_#ffffff] z-10 pointer-events-none"
            style={{ left: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Row 2: Vocal Guide Track */}
      <div className="flex items-center gap-3 h-12 bg-[#121212] rounded px-3 border border-zinc-800/60 overflow-hidden">
        {/* Left Track Control */}
        <div className="flex items-center gap-2.5 w-44 shrink-0">
          <span className="text-xs font-semibold text-purple-400 w-12 shrink-0">Vocal</span>
          <button
            onClick={() => vocalInputRef.current?.click()}
            className="p-1 rounded bg-zinc-800 border border-purple-500/40 hover:bg-purple-950/80 text-purple-400 transition-colors cursor-pointer"
            title="อัปโหลด/เปลี่ยนไฟล์เสียงร้อง (Vocal Guide)"
          >
            <Upload size={14} />
          </button>

          {/* Volume Fader */}
          <div className="flex items-center gap-1 flex-1">
            <button
              onClick={() => handleVocalVolume(vocalVolume > 0 ? 0 : 0.7)}
              className="text-zinc-400 hover:text-purple-400 cursor-pointer"
            >
              {vocalVolume === 0 ? <VolumeX size={12} className="text-red-400" /> : <Volume2 size={12} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={vocalVolume}
              onChange={(e) => handleVocalVolume(parseFloat(e.target.value))}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
            />
          </div>
        </div>

        {/* Waveform Viewport */}
        <div
          onClick={handleTimelineClick}
          className="flex-1 h-full relative cursor-pointer overflow-hidden rounded bg-[#1e1136]"
        >
          <canvas ref={vocalCanvasRef} className="w-full h-full block" />
          
          {/* Synchronized Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_#ffffff] z-10 pointer-events-none"
            style={{ left: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
});
