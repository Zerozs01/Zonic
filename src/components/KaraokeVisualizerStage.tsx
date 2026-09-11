import React, { useRef, useEffect, useState } from 'react';
import { PitchVisualizer } from './PitchVisualizer';
import { KaraokeHUD } from './KaraokeHUD';
import { LoadedTrack, PitchFrame, ScoreDifficulty } from '../types/audio';
import { LyricLine } from '../utils/audioAnalysis';
import { UploadCloud, Film } from 'lucide-react';
import { StageViewMode } from '../hooks/useVideoSync';

interface KaraokeVisualizerStageProps {
  vocalRefTrack: LoadedTrack | null;
  instrumentalTrack: LoadedTrack | null;
  currentTimeSec: number;
  durationSec: number;
  onSeek: (timeSec: number) => void;
  liveMicFrame: PitchFrame | null;
  isRecording: boolean;
  transposeKey: number;
  overallScore: number;
  rawScore?: number;
  targetPitchFrame: PitchFrame | null;
  lyricLines?: LyricLine[];
  bpm?: number;
  // Video Integration Props
  viewMode?: StageViewMode;
  onViewModeChange?: (mode: StageViewMode) => void;
  videoUrl?: string | null;
  onAttachVideo?: (file: File) => void;
  isPlaying?: boolean;
  playbackRate?: number;
  difficulty?: ScoreDifficulty;
  onDifficultyChange?: (mode: ScoreDifficulty) => void;
}

export const KaraokeVisualizerStage: React.FC<KaraokeVisualizerStageProps> = React.memo(({
  vocalRefTrack,
  instrumentalTrack,
  currentTimeSec,
  durationSec,
  onSeek,
  liveMicFrame,
  isRecording,
  transposeKey,
  overallScore,
  rawScore,
  targetPitchFrame,
  lyricLines = [],
  bpm = 120,
  viewMode = 'stage',
  onViewModeChange,
  videoUrl,
  onAttachVideo,
  isPlaying = false,
  playbackRate = 1.0,
  difficulty = 'easy',
  onDifficultyChange,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);

  // Video Telemetry (Real-time measured rendered FPS & Resolution)
  const [videoTelemetry, setVideoTelemetry] = useState<{ fps: number; resolution: string } | null>(null);
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(0);
  const callbackIdRef = useRef<number | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  // High-performance video sync refs
  const currentTimeSecRef = useRef<number>(currentTimeSec);
  currentTimeSecRef.current = currentTimeSec;
  const prevTimeSecRef = useRef<number>(currentTimeSec);
  const lastHardSeekTimeRef = useRef<number>(0);

  // Ensure video is strictly muted and volume zero so sound never leaks or plays un-pausably
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.defaultMuted = true;
      videoRef.current.muted = true;
      videoRef.current.volume = 0;
    }
  }, [videoUrl]);

  // Measure Real Video FPS & Resolution via requestVideoFrameCallback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) {
      setVideoTelemetry(null);
      return;
    }

    const updateMeta = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setVideoTelemetry((prev) => ({
          fps: prev?.fps || 0,
          resolution: `${video.videoWidth}x${video.videoHeight}`,
        }));
      }
    };

    video.addEventListener('loadedmetadata', updateMeta);
    if (video.readyState >= 1) updateMeta();

    let isSubscribed = true;
    frameCountRef.current = 0;
    lastFpsTimeRef.current = performance.now();

    const onFrame = (now: DOMHighResTimeStamp) => {
      if (!isSubscribed) return;
      frameCountRef.current++;
      const elapsed = now - lastFpsTimeRef.current;
      if (elapsed >= 1000) {
        const measuredFps = Math.round((frameCountRef.current * 1000) / elapsed);
        setVideoTelemetry((prev) => ({
          fps: measuredFps,
          resolution: prev?.resolution || (video.videoWidth ? `${video.videoWidth}x${video.videoHeight}` : 'HD'),
        }));
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }
      if ('requestVideoFrameCallback' in video) {
        callbackIdRef.current = (video as any).requestVideoFrameCallback(onFrame);
      }
    };

    if ('requestVideoFrameCallback' in video) {
      callbackIdRef.current = (video as any).requestVideoFrameCallback(onFrame);
    }

    return () => {
      isSubscribed = false;
      video.removeEventListener('loadedmetadata', updateMeta);
      if (callbackIdRef.current !== null && 'cancelVideoFrameCallback' in video) {
        (video as any).cancelVideoFrameCallback(callbackIdRef.current);
      }
    };
  }, [videoUrl]);

  // 1. Deliberate Scrubbing & Pause Position Alignment
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    const delta = currentTimeSec - prevTimeSecRef.current;
    prevTimeSecRef.current = currentTimeSec;

    // Detect deliberate scrub or user timeline jump (jumped > 0.8s or scrubbed backward)
    if (Math.abs(delta) > 0.8 || delta < -0.15) {
      video.currentTime = currentTimeSec;
      lastHardSeekTimeRef.current = performance.now();
      video.playbackRate = playbackRate;
      return;
    }

    // When paused, strictly snap to current position so scrubbing reflects immediately
    if (!isPlaying) {
      if (Math.abs(video.currentTime - currentTimeSec) > 0.04) {
        video.currentTime = currentTimeSec;
      }
    }
  }, [currentTimeSec, isPlaying, playbackRate, videoUrl]);

  // 2. Play / Pause Controller with Master Audio Engine (Independent of playbackRate changes)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    video.defaultMuted = true;
    video.muted = true;
    video.volume = 0;

    if (isPlaying) {
      // Snap position once on play start if slightly misaligned (> 0.05s)
      if (Math.abs(video.currentTime - currentTimeSecRef.current) > 0.05) {
        video.currentTime = currentTimeSecRef.current;
      }
      lastHardSeekTimeRef.current = performance.now();
      video.playbackRate = playbackRate;

      const p = video.play();
      playPromiseRef.current = p;
      if (p !== undefined) {
        p.catch((err) => {
          if (err.name !== 'AbortError') {
            console.warn('[VideoStage] Video play deferred:', err);
          }
        });
      }
    } else {
      if (playPromiseRef.current) {
        playPromiseRef.current
          .then(() => {
            video.pause();
          })
          .catch(() => {
            video.pause();
          });
      } else {
        video.pause();
      }
      if (Math.abs(video.currentTime - currentTimeSecRef.current) > 0.04) {
        video.currentTime = currentTimeSecRef.current;
      }
    }
  }, [isPlaying, videoUrl]);

  // 2.1 Dynamic Playback Rate change for video (Smooth without re-triggering play or seeking)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    video.playbackRate = playbackRate;
  }, [playbackRate, videoUrl]);

  // 3. Smooth Phase-Locked Loop (PLL) Drift Correction (Interval-based: 350ms, NO rapid hook thrashing)
  useEffect(() => {
    if (!isPlaying || !videoUrl) return;
    const video = videoRef.current;
    if (!video) return;

    const pllInterval = setInterval(() => {
      if (!video || !isPlaying || video.paused || video.seeking) return;
      // Allow 600ms grace period after play/seek before adjusting
      if (performance.now() - lastHardSeekTimeRef.current < 600) return;

      const audioTime = currentTimeSecRef.current;
      const drift = audioTime - video.currentTime;
      const absDrift = Math.abs(drift);

      // Zone 0: Imperceptible drift (<= 50ms) -> keep normal playbackRate
      if (absDrift <= 0.05) {
        if (Math.abs(video.playbackRate - playbackRate) > 0.005) {
          video.playbackRate = playbackRate;
        }
        return;
      }

      // Zone 1: Subtle micro-drift (0.05s to 0.35s) -> gentle ±2% rate nudge
      if (absDrift <= 0.35) {
        const nudgeRate = playbackRate * (drift > 0 ? 1.02 : 0.98);
        if (Math.abs(video.playbackRate - nudgeRate) > 0.005) {
          video.playbackRate = nudgeRate;
        }
        return;
      }

      // Zone 2: Moderate drift (0.35s to 1.8s) -> ±4.5% rate nudge
      if (absDrift <= 1.8) {
        const nudgeRate = playbackRate * (drift > 0 ? 1.045 : 0.955);
        if (Math.abs(video.playbackRate - nudgeRate) > 0.005) {
          video.playbackRate = nudgeRate;
        }
        return;
      }

      // Zone 3: Severe sustained desync (> 2.5s) -> hard seek with 3s cooldown
      if (absDrift > 2.5 && performance.now() - lastHardSeekTimeRef.current > 3000) {
        video.currentTime = audioTime;
        lastHardSeekTimeRef.current = performance.now();
        video.playbackRate = playbackRate;
      }
    }, 350);

    return () => clearInterval(pllInterval);
  }, [isPlaying, playbackRate, videoUrl]);

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onAttachVideo) {
      onAttachVideo(e.target.files[0]);
    }
  };

  const handleVideoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onAttachVideo) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mkv|mov)$/i)) {
        onAttachVideo(file);
      }
    }
  };

  // Find current active lyric line and next line preview
  const { activeLine, nextLine } = (() => {
    if (lyricLines.length === 0) return { activeLine: null, nextLine: null };
    let activeIdx = -1;
    for (let i = lyricLines.length - 1; i >= 0; i--) {
      const lineStart = lyricLines[i].startTime ?? lyricLines[i].timeSec ?? 0;
      if (currentTimeSec >= lineStart) {
        activeIdx = i;
        break;
      }
    }

    const active = activeIdx >= 0 ? lyricLines[activeIdx] : lyricLines[0];
    const next = activeIdx >= 0 && activeIdx < lyricLines.length - 1 ? lyricLines[activeIdx + 1] : null;
    return { activeLine: active, nextLine: next };
  })();

  return (
    <div
      style={{
        backgroundColor: '#0c0919',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
      }}
      className="w-full h-full flex flex-col relative overflow-hidden group"
    >
      <input
        type="file"
        ref={videoFileInputRef}
        onChange={handleVideoFileChange}
        accept="video/*,.mp4,.webm,.mkv,.mov"
        style={{ display: 'none' }}
      />

      {/* Viewport Stage Container */}
      <div className="w-full h-full relative flex flex-col justify-between overflow-hidden bg-gradient-to-b from-[#13102d] via-[#1a153a] to-[#090715]">
        
        {/* WeSing Top Score HUD Bar Overlay with integrated Mode Selector on the exact same row */}
        <div className="absolute top-3 left-3 right-3 z-30 pointer-events-none">
          <KaraokeHUD
            targetPitchFrame={targetPitchFrame}
            liveMicFrame={liveMicFrame}
            isRecording={isRecording}
            overallScore={overallScore}
            rawScore={rawScore}
            transposeKey={transposeKey}
            currentTimeSec={currentTimeSec}
            durationSec={durationSec}
            isPlaying={isPlaying}
            difficulty={difficulty}
            onDifficultyChange={onDifficultyChange}
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
          />
        </div>

        {/* ── Viewport Display (Supports 'stage', 'video', and 'hybrid' seamlessly) ── */}
        <div className="w-full flex-1 flex flex-col min-h-0 relative overflow-hidden">
          {/* Video Pane: 100% in 'video', 70% in 'hybrid', hidden in 'stage' */}
          <div
            className={`w-full relative z-10 flex items-center justify-center bg-black overflow-hidden transition-all duration-200 ${
              viewMode === 'video'
                ? 'h-full flex-1'
                : viewMode === 'hybrid'
                ? 'h-[70%] border-b border-purple-500/30'
                : 'hidden'
            }`}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={handleVideoDrop}
          >
            {videoUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  muted
                  playsInline
                  preload="auto"
                  style={{
                    transform: 'translateZ(0)',
                    backfaceVisibility: 'hidden',
                    willChange: 'transform',
                  }}
                  className="w-full h-full object-contain pointer-events-none"
                />

                {/* Real-time Video Telemetry Overlay Badge (Resolution, Stream FPS & Display Sync) */}
                {videoTelemetry && (
                  <div className="absolute top-16 left-4 z-20 flex items-center gap-2 bg-zinc-950/80 border border-zinc-800/80 rounded-lg px-2.5 py-1 text-[11px] font-mono text-zinc-300 backdrop-blur-md shadow-lg pointer-events-none select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{videoTelemetry.resolution}</span>
                    <span className="text-zinc-500">•</span>
                    <span className="text-cyan-300 font-bold">
                      {videoTelemetry.fps > 0 ? `${videoTelemetry.fps} FPS` : 'V-Sync'}
                    </span>
                    <span className="text-zinc-500">•</span>
                    <span className="text-emerald-400 font-semibold">100Hz Smooth</span>
                  </div>
                )}
              </>
            ) : (
              <div
                onClick={() => videoFileInputRef.current?.click()}
                className="flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-zinc-700/80 hover:border-cyan-500/80 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900/70 transition-all cursor-pointer max-w-md mx-4"
              >
                <div className="p-3 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 mb-2 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                  <Film size={28} />
                </div>
                <h3 className="text-xs font-bold text-white mb-1">ยังไม่มีคลิปวิดีโอคาราโอเกะ</h3>
                <p className="text-[11px] text-zinc-400 mb-3 leading-relaxed">
                  คลิกเพื่อเลือกไฟล์วิดีโอ (.mp4, .webm) หรือลากไฟล์มาวางในบริเวณนี้
                </p>
                <button
                  type="button"
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <UploadCloud size={14} />
                  <span>เลือกไฟล์วิดีโอจากเครื่อง</span>
                </button>
              </div>
            )}
          </div>

          {/* Pitch Visualizer Pane: 100% in 'stage', 30% in 'hybrid', hidden in 'video' */}
          <div
            className={`w-full relative overflow-hidden transition-all duration-200 ${
              viewMode === 'stage'
                ? 'h-full flex-1'
                : viewMode === 'hybrid'
                ? 'h-[30%]'
                : 'hidden'
            }`}
          >
            <PitchVisualizer
              vocalRefTrack={vocalRefTrack}
              instrumentalTrack={instrumentalTrack}
              currentTimeSec={currentTimeSec}
              durationSec={durationSec}
              onSeek={onSeek}
              liveMicFrame={liveMicFrame}
              isRecording={isRecording}
              transposeKey={transposeKey}
              bpm={bpm}
              isPlaying={isPlaying}
              targetPitchFrame={targetPitchFrame}
            />
          </div>
        </div>

        {/* WeSing Bottom Karaoke Lyric Highlight Overlay (Only shown on Stage mode, or when Video has no internal lyrics) */}
        {viewMode === 'stage' && (
          <div className="absolute bottom-3 left-4 right-4 z-30 text-center pointer-events-none flex flex-col items-center justify-center gap-0.5 bg-gradient-to-t from-zinc-950/90 via-zinc-950/70 to-transparent py-3 px-6 rounded-b-2xl">
            {activeLine ? (
              <div className="flex flex-col items-center gap-1">
                {/* Active Main Lyric Line */}
                <div className="text-xl md:text-2xl font-black tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] text-white flex flex-wrap justify-center gap-x-2">
                  {activeLine.words && activeLine.words.length > 0 ? (
                    activeLine.words.map((w, wIdx) => {
                      const isWordActive = currentTimeSec >= w.start && currentTimeSec <= w.end;
                      const isWordPast = currentTimeSec > w.end;
                      return (
                        <span
                          key={wIdx}
                          className={`transition-all duration-150 ${
                            isWordActive
                              ? 'text-pink-400 scale-110 drop-shadow-[0_0_16px_rgba(244,114,182,0.9)] font-black'
                              : isWordPast
                              ? 'text-purple-300 opacity-95 font-bold'
                              : 'text-zinc-200 font-bold opacity-80'
                          }`}
                        >
                          {w.word}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-pink-400 drop-shadow-[0_0_14px_rgba(244,114,182,0.8)] font-black">
                      {activeLine.text}
                    </span>
                  )}
                </div>

                {/* Upcoming Next Line Preview */}
                {nextLine && (
                  <div className="text-xs font-semibold text-zinc-400 opacity-70 tracking-normal drop-shadow">
                    {nextLine.text}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-xs text-zinc-400 font-medium">🎵 VocalAlign Karaoke Stage - พร้อมเริ่มซ้อมร้องเพลง</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});


