import React, { useEffect, useRef, useState } from 'react';
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
  instrumentalTrack,
  currentTimeSec,
  durationSec,
  onSeek,
  liveMicFrame,
  isRecording,
  transposeKey = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1x to 5x
  const scrollOffsetSec = Math.max(0, currentTimeSec - (durationSec / zoomLevel) / 2);
  const isDraggingRef = useRef<boolean>(false);

  // Live pitch history for live mic input with target pitch color coding
  const livePitchHistoryRef = useRef<{ timeSec: number; hz: number; color: string }[]>([]);

  const getTransposedHz = (hz: number) => {
    if (hz <= 0 || transposeKey === 0) return hz;
    return hz * Math.pow(2, transposeKey / 12);
  };

  useEffect(() => {
    if (liveMicFrame && liveMicFrame.is_voiced && liveMicFrame.frequency_hz > 0) {
      // Find reference target pitch at current time
      let targetHz = 0;
      if (vocalRefTrack?.analysis?.pitch_frames) {
        const frames = vocalRefTrack.analysis.pitch_frames;
        const frameIdx = Math.floor((currentTimeSec * 1000) / 10); // 10ms hop
        if (frameIdx >= 0 && frameIdx < frames.length) {
          const refFrame = frames[frameIdx];
          if (refFrame.is_voiced) targetHz = getTransposedHz(refFrame.frequency_hz);
        }
      }

      let pointColor = '#00f2fe'; // Default cyan
      if (targetHz > 0) {
        const centsOffset = Math.abs(1200 * Math.log2(liveMicFrame.frequency_hz / targetHz));
        if (centsOffset <= 20) {
          pointColor = '#10b981'; // 🟢 Green (In-Tune)
        } else if (centsOffset <= 45) {
          pointColor = '#f59e0b'; // 🟠 Orange (Slightly off)
        } else {
          pointColor = '#ef4444'; // 🔴 Red (Off-pitch)
        }
      }

      livePitchHistoryRef.current.push({
        timeSec: currentTimeSec,
        hz: liveMicFrame.frequency_hz,
        color: pointColor,
      });

      if (livePitchHistoryRef.current.length > 2000) {
        livePitchHistoryRef.current.shift();
      }
    }
  }, [liveMicFrame, currentTimeSec, vocalRefTrack]);

  const lastSizeRef = useRef<{ width: number; height: number; dpr: number }>({ width: 0, height: 0, dpr: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle DPI scaling matching exact container width
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
      // Clear canvas without resetting GPU state
      ctx.clearRect(0, 0, width, height);
    }

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

    // 1. Draw Original Vocal Guide Pitch Contour with Viewport Windowing
    if (vocalRefTrack?.analysis?.pitch_frames) {
      ctx.shadowColor = 'rgba(168, 85, 247, 0.6)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 3;
      ctx.beginPath();

      let inPath = false;
      const frames = vocalRefTrack.analysis.pitch_frames;

      // Viewport Windowing: Compute start and end frame indices (10ms hop size)
      const startIdx = Math.max(0, Math.floor((startTimeSec - 0.5) * 100));
      const endIdx = Math.min(frames.length - 1, Math.ceil((startTimeSec + visibleDuration + 0.5) * 100));

      for (let i = startIdx; i <= endIdx; i++) {
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
        const y = hzToY(getTransposedHz(f.frequency_hz));

        if (x < 50 || x > width + 10) continue;

        if (!inPath) {
          ctx.moveTo(x, y);
          inPath = true;
        } else {
          ctx.lineTo(x, y);
        }
      }

      if (inPath) ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 2. Draw Live Karaoke Microphone Pitch Trail (Color-Coded) with Viewport Windowing
    if (livePitchHistoryRef.current.length > 0) {
      const pts = livePitchHistoryRef.current;
      for (let i = 0; i < pts.length; i++) {
        const pt = pts[i];
        if (pt.timeSec < startTimeSec - 0.5 || pt.timeSec > startTimeSec + visibleDuration + 0.5) {
          continue;
        }
        const x = timeToX(pt.timeSec);
        const y = hzToY(pt.hz);

        if (x >= 55 && x <= width + 10) {
          ctx.shadowColor = pt.color;
          ctx.shadowBlur = 10;
          ctx.fillStyle = pt.color;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
    }

    // 3. Draw Playhead Line
    const playheadX = timeToX(currentTimeSec);
    if (playheadX >= 60 && playheadX <= width) {
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height - 24);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#00f2fe';
      ctx.beginPath();
      ctx.moveTo(playheadX - 6, 0);
      ctx.lineTo(playheadX + 6, 0);
      ctx.lineTo(playheadX, 8);
      ctx.closePath();
      ctx.fill();
    }
  }, [
    vocalRefTrack,
    instrumentalTrack,
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
    <div className="glass-card pitch-visualizer-card minimal" ref={containerRef}>
      <div className="card-header space-between clean">
        <div className="header-icon-group">
          <h3 className="card-title minimal">Pitch Contour</h3>
          <div className="legend-group clean">
            <span className="legend-item purple">
              <span className="legend-dot purple-dot" /> โน๊ตทำนอง
            </span>
            <span className="legend-item green">
              <span className="legend-dot green-dot" /> ตรงคีย์
            </span>
            <span className="legend-item orange">
              <span className="legend-dot orange-dot" /> เพี้ยนเล็กน้อย
            </span>
            <span className="legend-item red">
              <span className="legend-dot red-dot" /> หลุดคีย์
            </span>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="zoom-controls clean">
          <button
            className="btn-zoom-clean"
            onClick={() => setZoomLevel((z) => Math.max(1, z - 0.5))}
            title="Zoom Out"
          >
            -
          </button>
          <span className="zoom-label-clean">{zoomLevel.toFixed(1)}x</span>
          <button
            className="btn-zoom-clean"
            onClick={() => setZoomLevel((z) => Math.min(5, z + 0.5))}
            title="Zoom In"
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

      {vocalRefTrack?.analysis && (
        <div className="canvas-footer-stats">
          <span>
            Original Range: <strong>{vocalRefTrack.analysis.min_pitch_hz.toFixed(0)} Hz</strong> -{' '}
            <strong>{vocalRefTrack.analysis.max_pitch_hz.toFixed(0)} Hz</strong>
          </span>
          <span>
            Original Avg Pitch: <strong>{vocalRefTrack.analysis.avg_pitch_hz.toFixed(1)} Hz</strong> ({hzToNote(vocalRefTrack.analysis.avg_pitch_hz).noteName})
          </span>
        </div>
      )}
    </div>
  );
};
