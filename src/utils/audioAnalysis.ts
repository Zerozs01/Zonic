import { PitchFrame } from '../types/audio';
import { hzToNote } from './webAudioPitch';

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface LyricLine {
  id: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;
  timeSec?: number;  // alias for backward compatibility
  words?: WordTimestamp[];
}

/**
 * Parses LRC lyrics format `[mm:ss.xx] text` or plain text with auto-spaced timestamps across song duration.
 */
export function parseLyricsText(
  rawText: string,
  durationSec = 180,
  startOffsetSec = 0
): LyricLine[] {
  if (!rawText.trim()) return [];

  const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const lrcRegex = /^\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/;
  const parsedLrc: LyricLine[] = [];

  let isLrc = false;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(lrcRegex);
    if (match) {
      isLrc = true;
      const mins = parseInt(match[1], 10);
      const secs = parseInt(match[2], 10);
      const msStr = match[3] || '0';
      const ms = parseInt(msStr.padEnd(3, '0').slice(0, 3), 10);
      const startTime = mins * 60 + secs + ms / 1000;
      const text = match[4].trim();
      if (text) {
        // Estimate line duration as ~3.5 seconds
        const endTime = startTime + 3.5;
        const wordsArr = text.split(/\s+/).map((w, wIdx, arr) => {
          const wLen = (endTime - startTime) / arr.length;
          return {
            word: w,
            start: startTime + wIdx * wLen,
            end: startTime + (wIdx + 1) * wLen,
          };
        });

        parsedLrc.push({
          id: `lrc-${i}`,
          startTime,
          endTime,
          timeSec: startTime,
          text,
          words: wordsArr,
        });
      }
    }
  }

  if (isLrc && parsedLrc.length > 0) {
    return parsedLrc.sort((a, b) => a.startTime - b.startTime);
  }

  // Plain text fallback: distribute lines starting from startOffsetSec across available duration
  const total = lines.length;
  const offset = Math.max(0, startOffsetSec);
  const availableDuration = Math.max(10, durationSec - offset);
  const interval = (availableDuration * 0.9) / Math.max(1, total);

  return lines.map((text, idx) => {
    const startTime = Math.round((offset + idx * interval) * 100) / 100;
    const endTime = Math.round((startTime + interval * 0.9) * 100) / 100;
    const wordsArr = text.trim().split(/\s+/).map((w, wIdx, arr) => {
      const wLen = (endTime - startTime) / arr.length;
      return {
        word: w,
        start: startTime + wIdx * wLen,
        end: startTime + (wIdx + 1) * wLen,
      };
    });

    return {
      id: `plain-${idx}`,
      startTime,
      endTime,
      timeSec: startTime,
      text: text.trim(),
      words: wordsArr,
    };
  });
}

/**
 * Estimate song BPM from AudioBuffer using energy peak correlation.
 */
export function detectSongBpm(audioBuffer: AudioBuffer): number {
  try {
    const pcm = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const step = Math.floor(sampleRate * 0.02); // 20ms frames for high speed
    const frameCount = Math.min(Math.floor(pcm.length / step), 1500); // Analyze first ~30 seconds
    
    // Compute frame energies with fast decimation
    const energies = new Float32Array(frameCount);
    for (let f = 0; f < frameCount; f++) {
      let sumSq = 0;
      const start = f * step;
      const end = Math.min(pcm.length, start + step);
      for (let i = start; i < end; i += 8) {
        sumSq += pcm[i] * pcm[i];
      }
      energies[f] = Math.sqrt(sumSq / ((end - start) / 8 || 1));
    }

    // Auto-correlation for lags corresponding to 60 BPM to 180 BPM
    const minBpm = 60;
    const maxBpm = 180;
    const minLag = Math.floor((60 / maxBpm) / 0.02); // ~16 frames
    const maxLag = Math.floor((60 / minBpm) / 0.02); // ~50 frames

    let maxCorr = 0;
    let bestLag = 30;

    const sampleFrames = Math.max(10, frameCount - maxLag);

    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      for (let i = 0; i < sampleFrames; i += 2) {
        corr += energies[i] * energies[i + lag];
      }
      if (corr > maxCorr) {
        maxCorr = corr;
        bestLag = lag;
      }
    }

    const bpm = Math.round(60 / (bestLag * 0.02));
    return isNaN(bpm) || bpm < 50 || bpm > 220 ? 120 : bpm;
  } catch (e) {
    console.warn('BPM detection error:', e);
    return 120;
  }
}

/**
 * Transpose pitch frequency Hz by semitones offset (-12 to +12)
 */
export function transposeFrequency(hz: number, semitones: number): number {
  if (hz <= 0 || semitones === 0) return hz;
  return hz * Math.pow(2, semitones / 12);
}

/**
 * Transpose a PitchFrame for guide HUD / pitch visualizer
 */
export function transposePitchFrame(frame: PitchFrame | null, semitones: number): PitchFrame | null {
  if (!frame || !frame.is_voiced || semitones === 0) return frame;

  const transposedHz = transposeFrequency(frame.frequency_hz, semitones);
  const { noteName, centsOffset } = hzToNote(transposedHz);

  return {
    ...frame,
    frequency_hz: transposedHz,
    note_name: noteName,
    cents_offset: centsOffset,
  };
}
