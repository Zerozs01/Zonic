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
      
      {/* Viewport Stage Container */}
      <div className="w-full h-full relative flex flex-col justify-between overflow-hidden bg-gradient-to-b from-[#13102d] via-[#1a153a] to-[#090715]">
        
        {/* WeSing Top Score HUD Bar Overlay */}
        <div className="absolute top-3 left-3 right-3 z-30 pointer-events-none">
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

        {/* Pitch Roll Canvas Stage */}
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

        {/* WeSing Bottom Karaoke Lyric Highlight Overlay (Matching Image 2) */}
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
      </div>
    </div>
  );
});

