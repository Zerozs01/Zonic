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

  // Target Pitch Frame for HUD (timestamp-aligned with vocal guide)
  const targetPitchFrame = useMemo<PitchFrame | null>(() => {
    const frames = vocalRefTrack?.analysis?.pitch_frames;
    if (!frames || frames.length === 0) return null;

    const timeMs = currentTimeSec * 1000;
    if (frames.length === 1) return frames[0];

    const firstTime = frames[0].timestamp_ms;
    const lastTime = frames[frames.length - 1].timestamp_ms;
    if (timeMs <= firstTime) return frames[0];
    if (timeMs >= lastTime) return frames[frames.length - 1];

    const avgHop = (lastTime - firstTime) / (frames.length - 1);
    let estIdx = Math.round((timeMs - firstTime) / (avgHop || 25));
    estIdx = Math.max(0, Math.min(frames.length - 1, estIdx));

    // Refine to closest frame within ±4 frames
    let bestIdx = estIdx;
    let minDiff = Math.abs(frames[estIdx].timestamp_ms - timeMs);
    const sStart = Math.max(0, estIdx - 4);
    const sEnd = Math.min(frames.length - 1, estIdx + 4);
    for (let i = sStart; i <= sEnd; i++) {
      const diff = Math.abs(frames[i].timestamp_ms - timeMs);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = i;
      }
    }

    const currentFrame = frames[bestIdx];
    // If the exact frame is unvoiced (e.g. brief consonant < 60ms), check adjacent frames
    if (!currentFrame.is_voiced) {
      for (let offset of [-1, 1, -2, 2]) {
        const neighbor = frames[bestIdx + offset];
        if (neighbor && neighbor.is_voiced && Math.abs(neighbor.timestamp_ms - timeMs) <= 60) {
          return neighbor;
        }
      }
    }

    return currentFrame || null;
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
