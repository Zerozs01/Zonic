import React from 'react';
import { PitchVisualizer } from './PitchVisualizer';
import { KaraokeHUD } from './KaraokeHUD';
import { LoadedTrack, PitchFrame } from '../types/audio';

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
}) => {
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
          />
        </div>
      </div>
    </div>
  );
});
