import { PitchFrame } from '../types/audio';
import { hzToNote } from './webAudioPitch';

export interface LyricLine {
  id: string;
  timeSec: number;
  text: string;
}

/**
 * Parses LRC lyrics format `[mm:ss.xx] text` or plain text with auto-spaced timestamps across song duration.
 */
export function parseLyricsText(rawText: string, durationSec = 180): LyricLine[] {
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
      const timeSec = mins * 60 + secs + ms / 1000;
      const text = match[4].trim();
      if (text) {
        parsedLrc.push({ id: `lrc-${i}`, timeSec, text });
      }
    }
  }

  if (isLrc && parsedLrc.length > 0) {
    return parsedLrc.sort((a, b) => a.timeSec - b.timeSec);
  }

  // Plain text fallback: distribute lines evenly across song duration
  const total = lines.length;
  const interval = durationSec > 0 ? (durationSec * 0.85) / Math.max(1, total) : 3;

  return lines.map((text, idx) => ({
    id: `plain-${idx}`,
    timeSec: Math.round((idx * interval) * 100) / 100,
    text: text.trim(),
  }));
}

/**
 * Estimate song BPM from AudioBuffer using energy peak correlation.
 */
export function detectSongBpm(audioBuffer: AudioBuffer): number {
  try {
    const pcm = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const step = Math.floor(sampleRate * 0.01); // 10ms frames
    const frameCount = Math.floor(pcm.length / step);
    
    // Compute frame energies
    const energies = new Float32Array(frameCount);
    for (let f = 0; f < frameCount; f++) {
      let sumSq = 0;
      const start = f * step;
      const end = Math.min(pcm.length, start + step);
      for (let i = start; i < end; i += 4) {
        sumSq += pcm[i] * pcm[i];
      }
      energies[f] = Math.sqrt(sumSq / ((end - start) / 4 || 1));
    }

    // Auto-correlation for lags corresponding to 60 BPM to 180 BPM
    const minBpm = 60;
    const maxBpm = 180;
    const minLag = Math.floor((60 / maxBpm) / 0.01); // ~33 frames
    const maxLag = Math.floor((60 / minBpm) / 0.01); // ~100 frames

    let maxCorr = 0;
    let bestLag = 60;

    const sampleFrames = Math.min(frameCount - maxLag, 3000); // Check first ~30 seconds

    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      for (let i = 0; i < sampleFrames; i++) {
        corr += energies[i] * energies[i + lag];
      }
      if (corr > maxCorr) {
        maxCorr = corr;
        bestLag = lag;
      }
    }

    const bpm = Math.round(60 / (bestLag * 0.01));
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
