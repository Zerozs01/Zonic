import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { LoadedTrack, PitchFrame, ScoreDifficulty } from '../types/audio';

interface UseLivePitchScoringProps {
  isPlaying: boolean;
  isRecording: boolean;
  liveMicFrame: PitchFrame | null;
  vocalRefTrack: LoadedTrack | null;
  currentTimeSec: number;
  transposeKey: number;
  difficulty?: ScoreDifficulty;
}

export function useLivePitchScoring({
  isPlaying,
  isRecording,
  liveMicFrame,
  vocalRefTrack,
  currentTimeSec,
  transposeKey,
  difficulty = 'easy',
}: UseLivePitchScoringProps) {
  const [overallScore, setOverallScore] = useState<number>(0);
  const [rawScore, setRawScore] = useState<number>(0);

  // Map of scored target frame timestamps -> points earned
  const scoredFramesRef = useRef<Map<number, number>>(new Map());
  const accumulatedScoreRef = useRef<number>(0);

  // Total possible score based on total voiced target frames in the track
  const maxScore = useMemo(() => {
    const voicedCount =
      vocalRefTrack?.analysis?.voiced_frames ??
      vocalRefTrack?.analysis?.pitch_frames?.filter((f) => f.is_voiced).length ??
      1000;
    return Math.max(100, voicedCount * 10);
  }, [vocalRefTrack]);

  const resetScore = useCallback(() => {
    scoredFramesRef.current.clear();
    accumulatedScoreRef.current = 0;
    setRawScore(0);
    setOverallScore(0);
  }, []);

  // Reset score when loaded vocal track or difficulty changes
  useEffect(() => {
    resetScore();
  }, [vocalRefTrack?.filePath, difficulty, resetScore]);

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
      for (const offset of [-1, 1, -2, 2]) {
        const neighbor = frames[bestIdx + offset];
        if (neighbor && neighbor.is_voiced && Math.abs(neighbor.timestamp_ms - timeMs) <= 60) {
          return neighbor;
        }
      }
    }

    return currentFrame || null;
  }, [vocalRefTrack, currentTimeSec]);

  // Dynamic Scoring Engine: Easy (Octave Invariance / Forgiving), Normal (Balanced Singer Standard), Hard (Strict + Penalty)
  useEffect(() => {
    if (
      !isPlaying ||
      !isRecording ||
      !targetPitchFrame?.is_voiced ||
      targetPitchFrame.frequency_hz <= 0
    ) {
      return;
    }

    const frameTime = targetPitchFrame.timestamp_ms;
    const existingPts = scoredFramesRef.current.get(frameTime);

    let pts = 0;
    if (liveMicFrame?.is_voiced && liveMicFrame.frequency_hz > 0) {
      const transposedTargetHz =
        transposeKey !== 0
          ? targetPitchFrame.frequency_hz * Math.pow(2, transposeKey / 12)
          : targetPitchFrame.frequency_hz;

      const rawCents = 1200 * Math.log2(liveMicFrame.frequency_hz / transposedTargetHz);
      const absRawCents = Math.abs(rawCents);

      // Octave Folding: Calculate distance to nearest octave harmonic ([-600, +600] cents)
      // Solves unseparated MP4 instrumental artifacts (Octave 5 metronome/synths) and male singing female songs
      const octaveOffset = ((rawCents % 1200) + 1800) % 1200 - 600;
      const foldedDiff = Math.abs(octaveOffset);

      if (difficulty === 'easy') {
        // Easy Mode: Full octave invariance + generous tolerances (miss = +0, no deduction)
        const cents = foldedDiff;
        if (cents <= 45) {
          pts = 10; // Perfect
        } else if (cents <= 85) {
          pts = 7;  // Great
        } else if (cents <= 130) {
          pts = 4;  // Good
        } else {
          pts = 0;  // Miss (+0)
        }
      } else if (difficulty === 'normal') {
        // Normal Mode: Singer benchmark with gentle octave transfer allowance
        const cents = absRawCents <= 600 ? absRawCents : foldedDiff + 10;
        if (cents <= 30) {
          pts = 10; // Perfect
        } else if (cents <= 60) {
          pts = 7;  // Great
        } else if (cents <= 90) {
          pts = 4;  // Good
        } else {
          pts = 0;  // Miss (+0)
        }
      } else {
        // Hard Mode: Strict pro mode - requires exact octave and penalizes severe off-pitch
        const cents = absRawCents;
        if (cents <= 20) {
          pts = 10; // Perfect
        } else if (cents <= 40) {
          pts = 6;  // Great
        } else if (cents <= 65) {
          pts = 3;  // Good
        } else if (cents <= 120) {
          pts = 1;  // Near match (+1)
        } else {
          pts = -3; // Far off-pitch (-3 deduction)
        }
      }
    } else {
      pts = 0; // Unvoiced / natural breath (never penalize breath gaps)
    }

    if (existingPts === undefined) {
      // First encounter of this target frame
      scoredFramesRef.current.set(frameTime, pts);
      const nextAcc = Math.max(0, accumulatedScoreRef.current + pts);
      accumulatedScoreRef.current = nextAcc;
      setRawScore(nextAcc);
      const newOverall = Math.min(100, Math.round((nextAcc / maxScore) * 100));
      setOverallScore(newOverall);
    } else if (pts > existingPts) {
      // Practicing / rewound: user improved their hit! Add the score difference
      const diff = pts - existingPts;
      scoredFramesRef.current.set(frameTime, pts);
      const nextAcc = Math.max(0, accumulatedScoreRef.current + diff);
      accumulatedScoreRef.current = nextAcc;
      setRawScore(nextAcc);
      const newOverall = Math.min(100, Math.round((nextAcc / maxScore) * 100));
      setOverallScore(newOverall);
    } else if (difficulty === 'hard' && pts < 0 && existingPts >= 0) {
      // Hard mode: re-singing a frame badly penalizes
      const diff = pts - existingPts;
      scoredFramesRef.current.set(frameTime, pts);
      const nextAcc = Math.max(0, accumulatedScoreRef.current + diff);
      accumulatedScoreRef.current = nextAcc;
      setRawScore(nextAcc);
      const newOverall = Math.min(100, Math.round((nextAcc / maxScore) * 100));
      setOverallScore(newOverall);
    }
  }, [
    isPlaying,
    isRecording,
    liveMicFrame,
    targetPitchFrame,
    transposeKey,
    maxScore,
    difficulty,
  ]);

  return {
    overallScore,
    rawScore,
    targetPitchFrame,
    resetScore,
  };
}
