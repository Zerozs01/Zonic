import React, { useRef, useEffect, useState } from 'react';
import { Upload, Volume2, VolumeX, Mic, Music2, Trash2 } from 'lucide-react';
import { LoadedTrack } from '../types/audio';
import { setTrackGainNative, setTrackMuteNative } from '../services/tauriBridge';

interface DualWaveformBarProps {
  vocalRefTrack: LoadedTrack | null;
  instrumentalTrack: LoadedTrack | null;
  currentTimeSec: number;
  durationSec: number;
  onSeek: (timeSec: number) => void;
  onTrackLoaded: (trackType: 'vocalRef' | 'instrumental', file: File) => void;
  onClearTrack?: (trackType: 'vocalRef' | 'instrumental') => void;
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
  onClearTrack,
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

  // Volume memories for Mute/Solo restore
  const lastInstVolRef = useRef<number>(0.8);
  const lastVocalVolRef = useRef<number>(0.7);

  // Track Solo States
  const [instSolo, setInstSolo] = useState<boolean>(false);
  const [vocalSolo, setVocalSolo] = useState<boolean>(false);

  // Volume & Mute handlers
  const handleInstVolume = (vol: number) => {
    if (vol > 0) lastInstVolRef.current = vol;
    onInstVolumeChange(vol);
    setTrackGainNative('instrumental', vol).catch(() => {});
    setTrackMuteNative('instrumental', vol === 0).catch(() => {});
  };

  const handleVocalVolume = (vol: number) => {
    if (vol > 0) lastVocalVolRef.current = vol;
    onVocalVolumeChange(vol);
    setTrackGainNative('vocalRef', vol).catch(() => {});
    setTrackMuteNative('vocalRef', vol === 0).catch(() => {});
  };

  // Mute Toggles
  const isInstMuted = instVolume === 0;
  const isVocalMuted = vocalVolume === 0;

  const toggleInstMute = () => {
    if (isInstMuted) {
      handleInstVolume(lastInstVolRef.current > 0 ? lastInstVolRef.current : 0.8);
    } else {
      lastInstVolRef.current = instVolume;
      handleInstVolume(0);
    }
  };

  const toggleVocalMute = () => {
    if (isVocalMuted) {
      handleVocalVolume(lastVocalVolRef.current > 0 ? lastVocalVolRef.current : 0.7);
    } else {
      lastVocalVolRef.current = vocalVolume;
      handleVocalVolume(0);
    }
  };

  // Solo Toggles
  const toggleInstSolo = () => {
    if (instSolo) {
      // Turn off solo -> Restore vocal volume
      setInstSolo(false);
      handleVocalVolume(lastVocalVolRef.current > 0 ? lastVocalVolRef.current : 0.7);
    } else {
      // Turn on solo -> Unmute inst, mute vocal
      setInstSolo(true);
      setVocalSolo(false);
      if (isInstMuted) {
        handleInstVolume(lastInstVolRef.current > 0 ? lastInstVolRef.current : 0.8);
      }
      lastVocalVolRef.current = vocalVolume > 0 ? vocalVolume : lastVocalVolRef.current;
      handleVocalVolume(0);
    }
  };

  const toggleVocalSolo = () => {
    if (vocalSolo) {
      // Turn off solo -> Restore inst volume
      setVocalSolo(false);
      handleInstVolume(lastInstVolRef.current > 0 ? lastInstVolRef.current : 0.8);
    } else {
      // Turn on solo -> Unmute vocal, mute inst
      setVocalSolo(true);
      setInstSolo(false);
      if (isVocalMuted) {
        handleVocalVolume(lastVocalVolRef.current > 0 ? lastVocalVolRef.current : 0.7);
      }
      lastInstVolRef.current = instVolume > 0 ? instVolume : lastInstVolRef.current;
      handleInstVolume(0);
    }
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

      // Draw subtle center line
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, amp);
      ctx.lineTo(width, amp);
      ctx.stroke();

      // Draw waveform bars
      ctx.fillStyle = '#00ff88'; // Bright Neon Emerald
      for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
          const datum = data[i * step + j];
          if (datum !== undefined) {
            if (datum < min) min = datum;
            if (datum > max) max = datum;
          }
        }
        const barHeight = Math.max(2, (max - min) * amp * 0.95);
        ctx.fillRect(i, amp - barHeight / 2, 1.5, barHeight);
      }
    } else {
      // Placeholder Waveform Pattern when empty
      ctx.fillStyle = 'rgba(0, 255, 136, 0.35)';
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

      // Draw subtle center line
      ctx.strokeStyle = 'rgba(183, 110, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, amp);
      ctx.lineTo(width, amp);
      ctx.stroke();

      // Draw waveform bars
      ctx.fillStyle = '#b76eff'; // Bright Neon Purple
      for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
          const datum = data[i * step + j];
          if (datum !== undefined) {
            if (datum < min) min = datum;
            if (datum > max) max = datum;
          }
        }
        const barHeight = Math.max(2, (max - min) * amp * 0.95);
        ctx.fillRect(i, amp - barHeight / 2, 1.5, barHeight);
      }
    } else {
      // Placeholder Waveform Pattern when empty
      ctx.fillStyle = 'rgba(183, 110, 255, 0.35)';
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
        {/* Left Track Control & Mute/Solo */}
        <div className="flex items-center gap-2 w-64 shrink-0">
          <div className="flex items-center gap-1 shrink-0">
            <Music2 size={13} className="text-emerald-400 shrink-0" />
            <span
              className="text-xs font-semibold text-emerald-400"
              title={instrumentalTrack?.name || 'Music (Instrumental)'}
            >
              Music
            </span>
          </div>

          {/* DAW-Style Mute / Solo Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={toggleInstMute}
              className={`w-6 h-6 rounded text-[10px] font-bold transition-all cursor-pointer border ${
                isInstMuted
                  ? 'bg-rose-600 text-white border-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
              title="Mute Music Track (M)"
            >
              M
            </button>
            <button
              onClick={toggleInstSolo}
              className={`w-6 h-6 rounded text-[10px] font-bold transition-all cursor-pointer border ${
                instSolo
                  ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
              title="Solo Music Track (S)"
            >
              S
            </button>
          </div>

          {/* Upload Button */}
          <button
            onClick={() => instInputRef.current?.click()}
            className="p-1 rounded bg-zinc-800 border border-emerald-500/40 hover:bg-emerald-950/80 text-emerald-400 transition-colors cursor-pointer shrink-0"
            title="อัปโหลด/เปลี่ยนไฟล์เสียงดนตรี (Instrumental)"
          >
            <Upload size={13} />
          </button>

          {/* Volume Fader */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-1">
            <button
              onClick={toggleInstMute}
              className="text-zinc-400 hover:text-emerald-400 cursor-pointer shrink-0"
            >
              {isInstMuted ? <VolumeX size={12} className="text-red-400" /> : <Volume2 size={12} />}
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

        {/* Right Side: Clear Track Button */}
        {instrumentalTrack && onClearTrack && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClearTrack('instrumental');
            }}
            className="p-1.5 rounded bg-zinc-800/90 border border-zinc-700 hover:border-rose-500/80 hover:bg-rose-950/80 text-zinc-400 hover:text-rose-300 transition-colors cursor-pointer shrink-0 shadow-sm"
            title="เอาแทร็กเสียงดนตรีออก (Clear Track)"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Row 2: Vocal Guide Track */}
      <div className="flex items-center gap-3 h-12 bg-[#121212] rounded px-3 border border-zinc-800/60 overflow-hidden">
        {/* Left Track Control & Mute/Solo */}
        <div className="flex items-center gap-2 w-64 shrink-0">
          <div className="flex items-center gap-1 shrink-0">
            <Mic size={13} className="text-purple-400 shrink-0" />
            <span
              className="text-xs font-semibold text-purple-400"
              title={vocalRefTrack?.name || 'Vocal Guide'}
            >
              Vocal
            </span>
          </div>

          {/* DAW-Style Mute / Solo Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={toggleVocalMute}
              className={`w-6 h-6 rounded text-[10px] font-bold transition-all cursor-pointer border ${
                isVocalMuted
                  ? 'bg-rose-600 text-white border-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
              title="Mute Vocal Guide Track (M)"
            >
              M
            </button>
            <button
              onClick={toggleVocalSolo}
              className={`w-6 h-6 rounded text-[10px] font-bold transition-all cursor-pointer border ${
                vocalSolo
                  ? 'bg-purple-500 text-zinc-950 border-purple-400 shadow-[0_0_8px_rgba(183,110,255,0.7)]'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
              title="Solo Vocal Guide Track (S)"
            >
              S
            </button>
          </div>

          {/* Upload Button */}
          <button
            onClick={() => vocalInputRef.current?.click()}
            className="p-1 rounded bg-zinc-800 border border-purple-500/40 hover:bg-purple-950/80 text-purple-400 transition-colors cursor-pointer shrink-0"
            title="อัปโหลด/เปลี่ยนไฟล์เสียงร้อง (Vocal Guide)"
          >
            <Upload size={13} />
          </button>

          {/* Volume Fader */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-1">
            <button
              onClick={toggleVocalMute}
              className="text-zinc-400 hover:text-purple-400 cursor-pointer shrink-0"
            >
              {isVocalMuted ? <VolumeX size={12} className="text-red-400" /> : <Volume2 size={12} />}
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

        {/* Right Side: Clear Track Button */}
        {vocalRefTrack && onClearTrack && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClearTrack('vocalRef');
            }}
            className="p-1.5 rounded bg-zinc-800/90 border border-zinc-700 hover:border-rose-500/80 hover:bg-rose-950/80 text-zinc-400 hover:text-rose-300 transition-colors cursor-pointer shrink-0 shadow-sm"
            title="เอาแทร็กเสียงร้องออก (Clear Track)"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
});
