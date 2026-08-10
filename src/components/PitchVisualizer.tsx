import React, { useEffect, useRef, useState, useMemo } from 'react';
import { LoadedTrack, PitchFrame } from '../types/audio';
import { hzToNote } from '../utils/webAudioPitch';

interface PitchVisualizerProps {
  vocalRefTrack: LoadedTrack | null;
  instrumentalTrack: LoadedTrack | null;
  currentTimeSec: number;
  durationSec: number;
  onSeek: (timeSec: number) => void;
  liveMicFrame: PitchFrame | null;
  isRecording: boolean;
  transposeKey?: number;
  bpm?: number;
}

interface TargetNoteBlock {
  startTime: number;
  endTime: number;
  avgHz: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
}

const SCALE_NOTES = [
  { name: 'C5', hz: 523.25 },
  { name: 'A4', hz: 440.0 },
  { name: 'F4', hz: 349.23 },
  { name: 'C4', hz: 261.63 },
  { name: 'A3', hz: 220.0 },
  { name: 'F3', hz: 174.61 },
  { name: 'C3', hz: 130.81 },
  { name: 'A2', hz: 110.0 },
];

export const PitchVisualizer: React.FC<PitchVisualizerProps> = ({
  vocalRefTrack,
  currentTimeSec,
  durationSec,
  onSeek,
  liveMicFrame,
  isRecording,
  transposeKey = 0,
  bpm = 120,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoomLevel, setZoomLevel] = useState<number>(1.2);
  const scrollOffsetSec = Math.max(0, currentTimeSec - (durationSec / zoomLevel) / 3);
  const isDraggingRef = useRef<boolean>(false);

  // Live pitch trail history
  const livePitchHistoryRef = useRef<{ timeSec: number; hz: number; color: string }[]>([]);
  // Laser Spark Particle system
  const particlesRef = useRef<Particle[]>([]);

  const getTransposedHz = (hz: number) => {
    if (hz <= 0 || transposeKey === 0) return hz;
    return hz * Math.pow(2, transposeKey / 12);
  };

  // Convert raw pitch frames into WeSing horizontal note blocks
  const targetBlocks = useMemo<TargetNoteBlock[]>(() => {
    if (!vocalRefTrack?.analysis?.pitch_frames) return [];
    const frames = vocalRefTrack.analysis.pitch_frames;
    const blocks: TargetNoteBlock[] = [];

    let currentBlock: { start: number; end: number; hzSum: number; count: number } | null = null;

    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      if (!f.is_voiced || f.frequency_hz <= 0) {
        if (currentBlock && currentBlock.count >= 2) {
          blocks.push({
            startTime: currentBlock.start,
            endTime: currentBlock.end,
            avgHz: currentBlock.hzSum / currentBlock.count,
          });
        }
        currentBlock = null;
        continue;
      }

      const tSec = f.timestamp_ms / 1000;
      const hz = f.frequency_hz;

      if (!currentBlock) {
        currentBlock = { start: tSec, end: tSec, hzSum: hz, count: 1 };
      } else {
        const prevAvgHz = currentBlock.hzSum / currentBlock.count;
        const semitoneDiff = Math.abs(12 * Math.log2(hz / prevAvgHz));

        // Group into same note block if within 1.5 semitones and continuous time (<100ms gap)
        if (semitoneDiff <= 1.5 && tSec - currentBlock.end <= 0.1) {
          currentBlock.end = tSec;
          currentBlock.hzSum += hz;
          currentBlock.count += 1;
        } else {
          if (currentBlock.count >= 2) {
            blocks.push({
              startTime: currentBlock.start,
              endTime: currentBlock.end,
              avgHz: currentBlock.hzSum / currentBlock.count,
            });
          }
          currentBlock = { start: tSec, end: tSec, hzSum: hz, count: 1 };
        }
      }
    }

    if (currentBlock && currentBlock.count >= 2) {
      blocks.push({
        startTime: currentBlock.start,
        endTime: currentBlock.end,
        avgHz: currentBlock.hzSum / currentBlock.count,
      });
    }

    return blocks;
  }, [vocalRefTrack]);

  // Record live mic input pitch trail and spawn laser particles
  useEffect(() => {
    if (liveMicFrame && liveMicFrame.is_voiced && liveMicFrame.frequency_hz > 0) {
      let targetHz = 0;
      if (vocalRefTrack?.analysis?.pitch_frames) {
        const frames = vocalRefTrack.analysis.pitch_frames;
        const frameIdx = Math.floor((currentTimeSec * 1000) / 10);
        if (frameIdx >= 0 && frameIdx < frames.length && frames[frameIdx].is_voiced) {
          targetHz = getTransposedHz(frames[frameIdx].frequency_hz);
        }
      }

      let pointColor = '#00f2fe';
      let isHit = false;

      if (targetHz > 0) {
        const centsOffset = Math.abs(1200 * Math.log2(liveMicFrame.frequency_hz / targetHz));
        if (centsOffset <= 20) {
          pointColor = '#10b981'; // Green Perfect
          isHit = true;
        } else if (centsOffset <= 45) {
          pointColor = '#f59e0b'; // Amber Great
          isHit = true;
        } else {
          pointColor = '#ef4444'; // Red Miss
        }
      }

      livePitchHistoryRef.current.push({
        timeSec: currentTimeSec,
        hz: liveMicFrame.frequency_hz,
        color: pointColor,
      });

      if (livePitchHistoryRef.current.length > 1500) {
        livePitchHistoryRef.current.shift();
      }

      // Spawn laser particles on hit
      if (isHit) {
        const particleColors = ['#f59e0b', '#10b981', '#00f2fe', '#f43f5e', '#ffffff'];
        for (let i = 0; i < 4; i++) {
          particlesRef.current.push({
            x: 0, // Will be offset to playhead X in canvas render
            y: 0,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.8) * 4,
            size: Math.random() * 4 + 2,
            color: particleColors[Math.floor(Math.random() * particleColors.length)],
            alpha: 1.0,
          });
        }
      }
    }
  }, [liveMicFrame, currentTimeSec, vocalRefTrack]);

  const lastSizeRef = useRef<{ width: number; height: number; dpr: number }>({ width: 0, height: 0, dpr: 0 });

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const wrapper = canvas.parentElement;
    const width = wrapper ? wrapper.getBoundingClientRect().width : 800;
    const height = 360;

    if (
      Math.abs(lastSizeRef.current.width - width) > 1 ||
      lastSizeRef.current.height !== height ||
      lastSizeRef.current.dpr !== dpr
    ) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = '100%';
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
      lastSizeRef.current = { width, height, dpr };
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    // Smooth Deep Purple / Indigo WeSing Background Gradient (Matching Image 2)
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#13112b');
    bgGradient.addColorStop(0.5, '#1e1a42');
    bgGradient.addColorStop(1, '#0e0b1d');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Dynamic Pitch Bounds
    const minHz = 80;
    const maxHz = 600;
    const logMin = Math.log2(minHz);
    const logMax = Math.log2(maxHz);

    const hzToY = (hz: number) => {
      if (hz <= minHz) return height - 30;
      if (hz >= maxHz) return 30;
      const logHz = Math.log2(hz);
      const norm = (logHz - logMin) / (logMax - logMin);
      return height - 30 - norm * (height - 60);
    };

    const maxDuration = Math.max(10, durationSec);
    const visibleDuration = maxDuration / zoomLevel;
    const startTimeSec = Math.max(0, Math.min(scrollOffsetSec, maxDuration - visibleDuration));

    const timeToX = (tSec: number) => {
      const norm = (tSec - startTimeSec) / visibleDuration;
      return norm * (width - 70) + 50;
    };

    // 1. Draw Pitch Grid & Pitch Scale Labels
    ctx.font = '10px Inter, sans-serif';
    ctx.textBaseline = 'middle';

    SCALE_NOTES.forEach((note) => {
      const y = hzToY(note.hz);
      if (y >= 20 && y <= height - 20) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(50, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = note.name.includes('C') || note.name.includes('A') ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)';
        ctx.fillText(note.name, 12, y);
      }
    });

    // 2. Draw BPM Tempo Bar Grid Lines
    const beatIntervalSec = 60 / Math.max(40, bpm);
    for (let t = Math.floor(startTimeSec / beatIntervalSec) * beatIntervalSec; t <= startTimeSec + visibleDuration; t += beatIntervalSec) {
      const x = timeToX(t);
      if (x >= 50 && x <= width) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }

    // 3. Draw WeSing Target Note Blocks (Rounded Pill Bars)
    if (targetBlocks.length > 0) {
      targetBlocks.forEach((block) => {
        if (block.endTime < startTimeSec - 0.5 || block.startTime > startTimeSec + visibleDuration + 0.5) {
          return;
        }

        const x1 = timeToX(block.startTime);
        const x2 = timeToX(block.endTime);
        const barWidth = Math.max(16, x2 - x1);
        const transposedHz = getTransposedHz(block.avgHz);
        const y = hzToY(transposedHz);
        const barHeight = 12;
        const radius = 6;

        if (x1 + barWidth >= 40 && x1 <= width + 20) {
          const isActive = currentTimeSec >= block.startTime && currentTimeSec <= block.endTime;

          // Note Bar Gradient
          const barGrad = ctx.createLinearGradient(x1, y - barHeight / 2, x1, y + barHeight / 2);
          if (isActive) {
            barGrad.addColorStop(0, '#ec4899');
            barGrad.addColorStop(1, '#a855f7');
            ctx.shadowColor = 'rgba(236, 72, 153, 0.8)';
            ctx.shadowBlur = 12;
          } else {
            barGrad.addColorStop(0, 'rgba(168, 85, 247, 0.7)');
            barGrad.addColorStop(1, 'rgba(99, 102, 241, 0.5)');
            ctx.shadowColor = 'rgba(168, 85, 247, 0.3)';
            ctx.shadowBlur = 6;
          }

          ctx.fillStyle = barGrad;
          ctx.beginPath();
          ctx.roundRect(x1, y - barHeight / 2, barWidth, barHeight, radius);
          ctx.fill();

          // Border outline for active note
          if (isActive) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          ctx.shadowBlur = 0;
        }
      });
    }

    // 4. Draw Live Microphone Pitch Trail
    if (livePitchHistoryRef.current.length > 0) {
      const pts = livePitchHistoryRef.current;
      for (let i = 0; i < pts.length; i++) {
        const pt = pts[i];
        if (pt.timeSec < startTimeSec - 0.5 || pt.timeSec > startTimeSec + visibleDuration + 0.5) continue;

        const x = timeToX(pt.timeSec);
        const y = hzToY(pt.hz);

        if (x >= 45 && x <= width + 10) {
          ctx.shadowColor = pt.color;
          ctx.shadowBlur = 8;
          ctx.fillStyle = pt.color;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
    }

    // 5. Draw Laser Playhead & Spark Particle Explosion (Matching Image 2)
    const playheadX = timeToX(currentTimeSec);
    if (playheadX >= 50 && playheadX <= width) {
      // Background Glow Beam Line (Electric Cyan/Blue)
      const beamGrad = ctx.createLinearGradient(playheadX, 0, playheadX, height);
      beamGrad.addColorStop(0, 'rgba(0, 242, 254, 0.15)');
      beamGrad.addColorStop(0.5, 'rgba(0, 242, 254, 0.95)');
      beamGrad.addColorStop(1, 'rgba(0, 242, 254, 0.15)');

      ctx.strokeStyle = beamGrad;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Laser Comet Head Orb at active pitch Y position
      let activeY = height / 2;
      if (liveMicFrame && liveMicFrame.is_voiced && liveMicFrame.frequency_hz > 0) {
        activeY = hzToY(liveMicFrame.frequency_hz);
      } else if (vocalRefTrack?.analysis?.pitch_frames) {
        const frameIdx = Math.floor((currentTimeSec * 1000) / 10);
        const targetFrame = vocalRefTrack.analysis.pitch_frames[frameIdx];
        if (targetFrame && targetFrame.is_voiced) {
          activeY = hzToY(getTransposedHz(targetFrame.frequency_hz));
        }
      }

      // Glowing Comet Flare Disc (Electric Cyan/Blue)
      const flareGrad = ctx.createRadialGradient(playheadX, activeY, 1, playheadX, activeY, 18);
      flareGrad.addColorStop(0, '#ffffff');
      flareGrad.addColorStop(0.3, '#00f2fe');
      flareGrad.addColorStop(0.7, 'rgba(0, 242, 254, 0.6)');
      flareGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = flareGrad;
      ctx.beginPath();
      ctx.arc(playheadX, activeY, 18, 0, Math.PI * 2);
      ctx.fill();

      // Render & Update Spark Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.03;

        if (p.alpha <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(playheadX + p.x, activeY + p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
    }
  }, [
    vocalRefTrack,
    targetBlocks,
    currentTimeSec,
    durationSec,
    zoomLevel,
    scrollOffsetSec,
    isRecording,
    liveMicFrame,
    transposeKey,
    bpm,
  ]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    updateSeekFromEvent(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      updateSeekFromEvent(e);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const updateSeekFromEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;

    const width = rect.width;
    const maxDuration = Math.max(10, durationSec);
    const visibleDuration = maxDuration / zoomLevel;
    const startTimeSec = Math.max(0, Math.min(scrollOffsetSec, maxDuration - visibleDuration));

    const normX = Math.max(0, Math.min(1, (clickX - 50) / (width - 70)));
    const targetTimeSec = startTimeSec + normX * visibleDuration;
    onSeek(Math.max(0, Math.min(durationSec, targetTimeSec)));
  };

  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col justify-between" ref={containerRef}>
      {/* Zoom Controls Overlay (Top Right) */}
      <div className="absolute top-14 right-4 z-20 flex items-center bg-zinc-950/70 border border-zinc-800/80 rounded-lg px-2 py-1 gap-2 shadow-lg backdrop-blur-sm">
        <button
          className="text-zinc-300 hover:text-white font-bold px-1.5 py-0.5 rounded hover:bg-zinc-800 transition-colors cursor-pointer text-xs"
          onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.3))}
          title="Zoom Out"
        >
          -
        </button>
        <span className="text-[11px] font-mono font-bold text-zinc-400">{zoomLevel.toFixed(1)}x</span>
        <button
          className="text-zinc-300 hover:text-white font-bold px-1.5 py-0.5 rounded hover:bg-zinc-800 transition-colors cursor-pointer text-xs"
          onClick={() => setZoomLevel((z) => Math.min(4, z + 0.3))}
          title="Zoom In"
        >
          +
        </button>
      </div>

      <div className="w-full h-full relative">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full h-full cursor-pointer block"
        />
      </div>

      {vocalRefTrack?.analysis && (
        <div className="absolute bottom-1 left-4 z-20 text-[10px] text-zinc-400 font-medium bg-zinc-950/60 px-2 py-0.5 rounded backdrop-blur-sm border border-zinc-800/50">
          Range: {vocalRefTrack.analysis.min_pitch_hz.toFixed(0)} - {vocalRefTrack.analysis.max_pitch_hz.toFixed(0)} Hz ({hzToNote(vocalRefTrack.analysis.avg_pitch_hz).noteName})
        </div>
      )}
    </div>
  );
};

