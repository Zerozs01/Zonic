import React, { useEffect, useRef, useState } from 'react';
import { LoadedTrack, PitchFrame } from '../types/audio';
import { hzToNote } from '../utils/webAudioPitch';

interface PitchVisualizerProps {
  vocalTrack: LoadedTrack | null;
  referenceTrack: LoadedTrack | null;
  currentTimeSec: number;
  durationSec: number;
  onSeek: (timeSec: number) => void;
  liveMicFrame: PitchFrame | null;
  isRecording: boolean;
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
  vocalTrack,
  referenceTrack,
  currentTimeSec,
  durationSec,
  onSeek,
  liveMicFrame,
  isRecording,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1x to 5x
  const [scrollOffsetSec, setScrollOffsetSec] = useState<number>(0);
  const isDraggingRef = useRef<boolean>(false);

  // Live pitch trail for microphone stream
  const livePitchHistoryRef = useRef<{ timeSec: number; hz: number }[]>([]);

  useEffect(() => {
    if (isRecording && liveMicFrame && liveMicFrame.is_voiced) {
      livePitchHistoryRef.current.push({
        timeSec: currentTimeSec,
        hz: liveMicFrame.frequency_hz,
      });
      // Keep last 30 seconds of live pitch
      if (livePitchHistoryRef.current.length > 3000) {
        livePitchHistoryRef.current.shift();
      }
    }
  }, [liveMicFrame, currentTimeSec, isRecording]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI scaling
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement?.clientWidth || 800;
    const height = 360;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);

    // Clear Background with dark gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#0b0f19');
    bgGradient.addColorStop(1, '#111827');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Dynamic pitch boundaries (Min & Max Hz)
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
      return norm * (width - 80) + 60; // 60px left padding for note labels
    };

    // Draw Pitch Grid Lines & Note Labels
    ctx.font = '11px Inter, sans-serif';
    ctx.textBaseline = 'middle';

    SCALE_NOTES.forEach((note) => {
      const y = hzToY(note.hz);
      if (y >= 20 && y <= height - 20) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(60, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = note.name.includes('C') || note.name.includes('A') ? '#9ca3af' : '#4b5563';
        ctx.fillText(`${note.name} (${Math.round(note.hz)}Hz)`, 10, y);
      }
    });

    // Draw Time Grid Lines (Seconds)
    const timeStepSec = visibleDuration > 30 ? 10 : visibleDuration > 10 ? 5 : 1;
    for (let t = Math.floor(startTimeSec); t <= startTimeSec + visibleDuration; t += timeStepSec) {
      const x = timeToX(t);
      if (x >= 60 && x <= width) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height - 24);
        ctx.stroke();

        ctx.fillStyle = '#6b7280';
        ctx.fillText(`${t.toFixed(0)}s`, x - 8, height - 10);
      }
    }

    // Helper to draw Pitch Curve
    const drawPitchCurve = (
      frames: PitchFrame[],
      color: string,
      glowColor: string,
      lineWidth: number
    ) => {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();

      let inPath = false;

      for (let i = 0; i < frames.length; i++) {
        const f = frames[i];
        if (!f.is_voiced || f.frequency_hz <= 0) {
          if (inPath) {
            ctx.stroke();
            ctx.beginPath();
            inPath = false;
          }
          continue;
        }

        const tSec = f.timestamp_ms / 1000;
        const x = timeToX(tSec);
        const y = hzToY(f.frequency_hz);

        if (x < 50 || x > width + 10) continue;

        if (!inPath) {
          ctx.moveTo(x, y);
          inPath = true;
        } else {
          ctx.lineTo(x, y);
        }
      }

      if (inPath) {
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    };

    // 1. Draw Reference Track Pitch Curve (Violet)
    if (referenceTrack?.analysis?.pitch_frames) {
      drawPitchCurve(
        referenceTrack.analysis.pitch_frames,
        '#a855f7',
        'rgba(168, 85, 247, 0.6)',
        3
      );
    }

    // 2. Draw User Vocal Track Pitch Curve (Neon Cyan)
    if (vocalTrack?.analysis?.pitch_frames) {
      drawPitchCurve(
        vocalTrack.analysis.pitch_frames,
        '#00f2fe',
        'rgba(0, 242, 254, 0.6)',
        3
      );
    }

    // 3. Draw Live Mic Pitch Trail
    if (isRecording && livePitchHistoryRef.current.length > 0) {
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      let liveInPath = false;

      livePitchHistoryRef.current.forEach((pt) => {
        const x = timeToX(pt.timeSec);
        const y = hzToY(pt.hz);
        if (x >= 50 && x <= width + 10) {
          if (!liveInPath) {
            ctx.moveTo(x, y);
            liveInPath = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      });
      if (liveInPath) ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 4. Draw Current Playhead Line
    const playheadX = timeToX(currentTimeSec);
    if (playheadX >= 60 && playheadX <= width) {
      // Glow Playhead
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height - 24);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Playhead Top Pointer
      ctx.fillStyle = '#00f2fe';
      ctx.beginPath();
      ctx.moveTo(playheadX - 6, 0);
      ctx.lineTo(playheadX + 6, 0);
      ctx.lineTo(playheadX, 8);
      ctx.closePath();
      ctx.fill();
    }
  }, [
    vocalTrack,
    referenceTrack,
    currentTimeSec,
    durationSec,
    zoomLevel,
    scrollOffsetSec,
    isRecording,
    liveMicFrame,
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

    const normX = Math.max(0, Math.min(1, (clickX - 60) / (width - 80)));
    const targetTimeSec = startTimeSec + normX * visibleDuration;
    onSeek(Math.max(0, Math.min(durationSec, targetTimeSec)));
  };

  return (
    <div className="glass-card pitch-visualizer-card" ref={containerRef}>
      <div className="card-header space-between">
        <div className="header-icon-group">
          <h3 className="card-title">Dual Track Pitch Alignment Graph (YIN Algorithm)</h3>
          <div className="legend-group">
            <span className="legend-item cyan">
              <span className="legend-dot cyan-dot" /> Vocal Pitch (Hz)
            </span>
            <span className="legend-item purple">
              <span className="legend-dot purple-dot" /> Reference Guide (Hz)
            </span>
            {isRecording && (
              <span className="legend-item orange">
                <span className="legend-dot orange-dot" /> Live Mic Input
              </span>
            )}
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="zoom-controls">
          <button
            className="btn-zoom"
            onClick={() => setZoomLevel((z) => Math.max(1, z - 0.5))}
            title="Zoom Out Timeline"
          >
            -
          </button>
          <span className="zoom-label">{zoomLevel.toFixed(1)}x Zoom</span>
          <button
            className="btn-zoom"
            onClick={() => setZoomLevel((z) => Math.min(5, z + 0.5))}
            title="Zoom In Timeline"
          >
            +
          </button>
        </div>
      </div>

      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="pitch-canvas"
        />
      </div>

      {/* Real-time pitch readout pill */}
      {vocalTrack?.analysis && (
        <div className="canvas-footer-stats">
          <span>
            Vocal Range: <strong>{vocalTrack.analysis.min_pitch_hz.toFixed(0)} Hz</strong> -{' '}
            <strong>{vocalTrack.analysis.max_pitch_hz.toFixed(0)} Hz</strong>
          </span>
          <span>
            Avg Pitch: <strong>{vocalTrack.analysis.avg_pitch_hz.toFixed(1)} Hz</strong> ({hzToNote(vocalTrack.analysis.avg_pitch_hz).noteName})
          </span>
        </div>
      )}
    </div>
  );
};
