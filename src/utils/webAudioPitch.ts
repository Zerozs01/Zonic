import { AnalysisResult, AudioFileMeta, PitchFrame } from '../types/audio';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function hzToNote(frequencyHz: number): { noteName: string; centsOffset: number } {
  if (frequencyHz <= 0 || isNaN(frequencyHz)) {
    return { noteName: 'Unvoiced', centsOffset: 0 };
  }

  // A4 = 440 Hz = MIDI note 69
  const midiNote = 12 * Math.log2(frequencyHz / 440) + 69;
  const roundedMidi = Math.round(midiNote);
  const noteIndex = (roundedMidi % 12 + 12) % 12;
  const octave = Math.floor(roundedMidi / 12) - 1;

  const noteName = `${NOTE_NAMES[noteIndex]}${octave}`;
  const centsOffset = Math.round((midiNote - roundedMidi) * 100);

  return { noteName, centsOffset };
}

// Shared reusable buffer to avoid allocations on every frame
let sharedYinBuffer: Float32Array | null = null;

export function detectYinPitch(
  samples: Float32Array,
  sampleRate: number,
  windowSize = 2048,
  threshold = 0.15,
  minFreqHz = 60,
  maxFreqHz = 1200
): { frequencyHz: number; clarity: number; isVoiced: boolean } {
  const halfWindow = Math.floor(windowSize / 2);
  const minTau = Math.max(1, Math.floor(sampleRate / maxFreqHz));
  const maxTau = Math.min(halfWindow - 1, Math.floor(sampleRate / minFreqHz));

  if (samples.length < windowSize) {
    return { frequencyHz: 0, clarity: 0, isVoiced: false };
  }

  if (!sharedYinBuffer || sharedYinBuffer.length < halfWindow) {
    sharedYinBuffer = new Float32Array(halfWindow);
  }
  const d = sharedYinBuffer;
  const upperTau = Math.min(halfWindow, maxTau + 2);

  // Step 1 & 2: Bounded Difference function & Cumulative mean normalized difference
  d[0] = 1;
  let runningSum = 0;

  for (let tau = 1; tau < upperTau; tau++) {
    let diffSum = 0;
    for (let i = 0; i < halfWindow; i++) {
      const delta = samples[i] - samples[i + tau];
      diffSum += delta * delta;
    }
    d[tau] = diffSum;
    runningSum += diffSum;

    if (runningSum > 0) {
      d[tau] = (diffSum * tau) / runningSum;
    } else {
      d[tau] = 1;
    }
  }


  // Step 3: Absolute threshold
  let bestTau = -1;
  for (let tau = minTau; tau <= maxTau; tau++) {
    if (d[tau] < threshold) {
      while (tau + 1 <= maxTau && d[tau + 1] < d[tau]) {
        tau++;
      }
      bestTau = tau;
      break;
    }
  }

  if (bestTau === -1) {
    // Find global minimum in range
    let minVal = 1.0;
    for (let tau = minTau; tau <= maxTau; tau++) {
      if (d[tau] < minVal) {
        minVal = d[tau];
        bestTau = tau;
      }
    }
    if (minVal > 0.4) {
      return { frequencyHz: 0, clarity: 1 - minVal, isVoiced: false };
    }
  }

  if (bestTau <= 0) {
    return { frequencyHz: 0, clarity: 0, isVoiced: false };
  }

  // Parabolic interpolation for fine frequency estimation
  let betterTau = bestTau;
  if (bestTau > 0 && bestTau < halfWindow - 1) {
    const s0 = d[bestTau - 1];
    const s1 = d[bestTau];
    const s2 = d[bestTau + 1];
    const denom = 2 * (2 * s1 - s0 - s2);
    if (Math.abs(denom) > 1e-6) {
      betterTau = bestTau + (s2 - s0) / denom;
    }
  }

  const frequencyHz = sampleRate / betterTau;
  const clarity = Math.max(0, 1 - (d[bestTau] || 0));
  const isVoiced = frequencyHz >= minFreqHz && frequencyHz <= maxFreqHz && clarity >= 0.55;

  return {
    frequencyHz: isVoiced ? frequencyHz : 0,
    clarity,
    isVoiced,
  };
}

export async function processAudioFileInBrowser(
  file: File
): Promise<{ meta: AudioFileMeta; analysis: AnalysisResult; audioBuffer: AudioBuffer }> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const sampleRate = audioBuffer.sampleRate;
  const channels = audioBuffer.numberOfChannels;
  const durationSeconds = audioBuffer.duration;
  const totalSamples = audioBuffer.length;

  // Get mono PCM samples
  const pcmData = audioBuffer.getChannelData(0);

  // Peak amplitude & RMS
  let peakAmp = 0;
  for (let i = 0; i < pcmData.length; i += 10) {
    const abs = Math.abs(pcmData[i]);
    if (abs > peakAmp) peakAmp = abs;
  }

  const meta: AudioFileMeta = {
    file_path: file.name,
    file_name: file.name,
    sample_rate: sampleRate,
    channels,
    duration_seconds: durationSeconds,
    total_samples: totalSamples,
    peak_amplitude: peakAmp,
  };

  // Perform YIN Pitch Analysis frame-by-frame (30ms hop for smooth performance)
  const hopMs = 30.0;
  const hopSamples = Math.max(64, Math.floor((sampleRate * hopMs) / 1000));
  const windowSize = 2048;

  const pitchFrames: PitchFrame[] = [];
  let voicedFrames = 0;
  let minHz = Infinity;
  let maxHz = 0;
  let hzSum = 0;

  for (let i = 0; i + windowSize <= pcmData.length; i += hopSamples) {
    const timestampMs = (i / sampleRate) * 1000;
    const windowSlice = pcmData.subarray(i, i + windowSize);

    // Calculate RMS amplitude for dB
    let sumSq = 0;
    for (let j = 0; j < windowSlice.length; j += 4) {
      sumSq += windowSlice[j] * windowSlice[j];
    }
    const rms = Math.sqrt(sumSq / (windowSlice.length / 4)) || 1e-6;
    const amplitudeDb = Math.max(-100, 20 * Math.log10(rms));

    const pitch = detectYinPitch(windowSlice, sampleRate, windowSize);
    const { noteName, centsOffset } = hzToNote(pitch.frequencyHz);

    if (pitch.isVoiced) {
      voicedFrames++;
      minHz = Math.min(minHz, pitch.frequencyHz);
      maxHz = Math.max(maxHz, pitch.frequencyHz);
      hzSum += pitch.frequencyHz;
    }

    pitchFrames.push({
      timestamp_ms: timestampMs,
      frequency_hz: pitch.frequencyHz,
      amplitude_db: amplitudeDb,
      clarity: pitch.clarity,
      note_name: noteName,
      cents_offset: centsOffset,
      is_voiced: pitch.isVoiced,
    });
  }

  const avgPitchHz = voicedFrames > 0 ? hzSum / voicedFrames : 0;

  const analysis: AnalysisResult = {
    total_duration_seconds: durationSeconds,
    sample_rate: sampleRate,
    total_frames: pitchFrames.length,
    voiced_frames: voicedFrames,
    pitch_frames: pitchFrames,
    min_pitch_hz: minHz === Infinity ? 0 : minHz,
    max_pitch_hz: maxHz,
    avg_pitch_hz: avgPitchHz,
  };

  return { meta, analysis, audioBuffer };
}
