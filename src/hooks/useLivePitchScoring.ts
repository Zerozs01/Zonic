import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { LoadedTrack, PitchFrame } from '../types/audio';

interface UseLivePitchScoringProps {
  isPlaying: boolean;
  isRecording: boolean;
  liveMicFrame: PitchFrame | null;
  vocalRefTrack: LoadedTrack | null;
  currentTimeSec: number;
  transposeKey: number;
}

export function useLivePitchScoring({
  isPlaying,
  isRecording,
  liveMicFrame,
  vocalRefTrack,
  currentTimeSec,
  transposeKey,
}: UseLivePitchScoringProps) {
  const [overallScore, setOverallScore] = useState<number>(100);
  const scoreHistoryRef = useRef<number[]>([]);

  const resetScore = useCallback(() => {
    scoreHistoryRef.current = [];
    setOverallScore(100);
  }, []);

  // Target Pitch Frame for HUD
  const targetPitchFrame = useMemo<PitchFrame | null>(() => {
    if (!vocalRefTrack?.analysis?.pitch_frames) return null;
    const frameIdx = Math.floor((currentTimeSec * 1000) / 10);
    return vocalRefTrack.analysis.pitch_frames[frameIdx] || null;
  }, [vocalRefTrack, currentTimeSec]);

  // Update real-time pitch match score
  useEffect(() => {
    if (
      isPlaying &&
      isRecording &&
      liveMicFrame?.is_voiced &&
      targetPitchFrame?.is_voiced &&
      targetPitchFrame.frequency_hz > 0
    ) {
      const transposedTargetHz =
        transposeKey !== 0
          ? targetPitchFrame.frequency_hz * Math.pow(2, transposeKey / 12)
          : targetPitchFrame.frequency_hz;

      const cents = Math.abs(1200 * Math.log2(liveMicFrame.frequency_hz / transposedTargetHz));
      const frameScore = Math.max(0, Math.min(100, Math.round(100 - cents * 0.8)));
      scoreHistoryRef.current.push(frameScore);

      if (scoreHistoryRef.current.length > 50) {
        scoreHistoryRef.current.shift();
      }

      const avg = scoreHistoryRef.current.reduce((a, b) => a + b, 0) / scoreHistoryRef.current.length;
      const roundedAvg = Math.round(avg);
      setOverallScore((prev) => (prev !== roundedAvg ? roundedAvg : prev));
    }
  }, [isPlaying, isRecording, liveMicFrame, targetPitchFrame, transposeKey]);

  return {
    overallScore,
    targetPitchFrame,
    resetScore,
  };
}
