import React, { useRef, useEffect } from 'react';
import { PitchVisualizer } from './PitchVisualizer';
import { KaraokeHUD } from './KaraokeHUD';
import { LoadedTrack, PitchFrame } from '../types/audio';
import { LyricLine } from '../utils/audioAnalysis';
import { Video, Activity, UploadCloud, Film } from 'lucide-react';

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
  targetPitchFrame: PitchFrame | null;
  lyricLines?: LyricLine[];
  bpm?: number;
  // Video Integration Props
  viewMode?: 'stage' | 'video';
  onViewModeChange?: (mode: 'stage' | 'video') => void;
  videoUrl?: string | null;
  onAttachVideo?: (file: File) => void;
  isPlaying?: boolean;
  playbackRate?: number;
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
  targetPitchFrame,
  lyricLines = [],
  bpm = 120,
  viewMode = 'stage',
  onViewModeChange,
  videoUrl,
  onAttachVideo,
  isPlaying = false,
  playbackRate = 1.0,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);

  // Synchronize HTML5 Video with Master Audio Playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    if (isPlaying) {
      video.play().catch((err) => {
        // Autoplay may be deferred until user interaction
        console.warn('[VideoStage] Video play deferred:', err);
      });
    } else {
      video.pause();
    }
  }, [isPlaying, videoUrl]);

  // Synchronize Video Playback Rate
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Synchronize Video Seek Position
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    // Only update if difference is noticeable (> 0.25s) to prevent jitter
    if (Math.abs(video.currentTime - currentTimeSec) > 0.25) {
      video.currentTime = currentTimeSec;
    }
  }, [currentTimeSec, videoUrl]);

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
        
        {/* WeSing Top Score HUD Bar Overlay */}
        <div className="absolute top-3 left-3 right-3 z-30 pointer-events-none flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <KaraokeHUD
              targetPitchFrame={targetPitchFrame}
              liveMicFrame={liveMicFrame}
              isRecording={isRecording}
              overallScore={overallScore}
              transposeKey={transposeKey}
              currentTimeSec={currentTimeSec}
              durationSec={durationSec}
            />
          </div>

          {/* Quick Toggle Button on Stage Corner */}
          {onViewModeChange && (
            <div className="pointer-events-auto ml-2 shrink-0">
              <button
                type="button"
                onClick={() => onViewModeChange(viewMode === 'stage' ? 'video' : 'stage')}
                className={`p-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                  viewMode === 'video'
                    ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-200 hover:bg-cyan-900/80'
                    : 'bg-purple-950/80 border-purple-500/60 text-purple-200 hover:bg-purple-900/80'
                }`}
                title={viewMode === 'stage' ? 'สลับไปโหมดวิดีโอคาราโอเกะ' : 'สลับไปโหมดกราฟคะแนน'}
              >
                {viewMode === 'stage' ? (
                  <>
                    <Video size={13} className="text-cyan-400" />
                    <span className="hidden xl:inline">สลับเป็นวิดีโอ</span>
                  </>
                ) : (
                  <>
                    <Activity size={13} className="text-purple-400" />
                    <span className="hidden xl:inline">สลับเป็นคะแนน</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* ── Mode 1: Pitch Roll Canvas Stage ── */}
        {viewMode === 'stage' && (
          <div className="w-full h-full relative z-10 pt-16 pb-16">
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
            />
          </div>
        )}

        {/* ── Mode 2: Karaoke Video Player Stage ── */}
        {viewMode === 'video' && (
          <div
            className="w-full h-full relative z-10 flex items-center justify-center bg-black overflow-hidden"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={handleVideoDrop}
          >
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                muted
                playsInline
                className="w-full h-full object-contain pointer-events-none"
              />
            ) : (
              <div
                onClick={() => videoFileInputRef.current?.click()}
                className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-zinc-700/80 hover:border-cyan-500/80 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900/70 transition-all cursor-pointer max-w-md mx-4"
              >
                <div className="p-4 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 mb-3 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                  <Film size={36} />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">ยังไม่มีคลิปวิดีโอคาราโอเกะ</h3>
                <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                  คลิกเพื่อเลือกไฟล์วิดีโอ (.mp4, .webm) หรือลากไฟล์มาวางในบริเวณนี้ เพื่อดูภาพและเนื้อร้องคาราโอเกะจากคลิปโดยตรง
                </p>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <UploadCloud size={15} />
                  <span>เลือกไฟล์วิดีโอจากเครื่อง</span>
                </button>
              </div>
            )}
          </div>
        )}

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


