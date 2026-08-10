import React from 'react';
import { PitchVisualizer } from './PitchVisualizer';
import { KaraokeHUD } from './KaraokeHUD';
import { LoadedTrack, PitchFrame } from '../types/audio';
import { LyricLine } from '../utils/audioAnalysis';

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
}) => {
  // Find current active lyric line
  const activeLine = (() => {
    if (lyricLines.length === 0) return null;
    for (let i = lyricLines.length - 1; i >= 0; i--) {
      const lineStart = lyricLines[i].startTime ?? lyricLines[i].timeSec ?? 0;
      if (currentTimeSec >= lineStart) {
        return lyricLines[i];
      }
    }
    return lyricLines[0];
  })();

  return (
    <div className="w-full h-full bg-zinc-950 border border-zinc-800/90 rounded-xl overflow-hidden shadow-2xl flex flex-col relative group">
      {/* 16:9 Responsive Stage Viewport */}
      <div className="w-full aspect-video relative flex flex-col justify-between overflow-hidden bg-gradient-to-b from-indigo-950/60 via-purple-950/30 to-zinc-950">
        
        {/* WeSing-style Top Score HUD Bar Overlay */}
        <div className="absolute top-2 left-3 right-3 z-30 pointer-events-none">
          <KaraokeHUD
            targetPitchFrame={targetPitchFrame}
            liveMicFrame={liveMicFrame}
            isRecording={isRecording}
            overallScore={overallScore}
            transposeKey={transposeKey}
          />
        </div>

        {/* Center Pitch Roll Canvas & Visualizer Stage */}
        <div className="flex-1 w-full relative z-10">
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

        {/* Word-by-word Karaoke Lyric Highlight Display Overlay (Bottom of Viewport) */}
        <div className="absolute bottom-3 left-6 right-6 z-30 text-center pointer-events-none flex flex-col items-center justify-center gap-1 bg-zinc-950/60 backdrop-blur-sm py-2 px-4 rounded-xl border border-zinc-800/60">
          {activeLine ? (
            <div className="text-lg md:text-xl font-extrabold tracking-wide drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] text-white flex flex-wrap justify-center gap-x-2">
              {activeLine.words && activeLine.words.length > 0 ? (
                activeLine.words.map((w, wIdx) => {
                  const isWordActive = currentTimeSec >= w.start && currentTimeSec <= w.end;
                  const isWordPast = currentTimeSec > w.end;
                  return (
                    <span
                      key={wIdx}
                      className={`transition-all duration-150 ${
                        isWordActive
                          ? 'text-cyan-300 scale-110 drop-shadow-[0_0_12px_#00f2fe] font-black'
                          : isWordPast
                          ? 'text-purple-400 opacity-90 font-bold'
                          : 'text-zinc-200 font-semibold'
                      }`}
                    >
                      {w.word}
                    </span>
                  );
                })
              ) : (
                <span className="text-cyan-300 drop-shadow-[0_0_10px_rgba(0,242,254,0.6)] font-bold">{activeLine.text}</span>
              )}
            </div>
          ) : (
            <span className="text-xs text-zinc-500 font-medium">🎵 VocalAlign Karaoke Stage - พร้อมเริ่มซ้อมร้องเพลง</span>
          )}
        </div>
      </div>
    </div>
  );
});
