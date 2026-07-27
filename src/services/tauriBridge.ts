import { invoke } from '@tauri-apps/api/core';
import { AnalysisResult, AudioDevice, AudioFileMeta, PitchFrame, RecordingStatus } from '../types/audio';

/**
 * Checks if the current environment is running inside a Tauri desktop container
 */
export const isTauriAvailable = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window || '__TAURI_IPC__' in window)
  );
};

export async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isTauriAvailable()) {
    console.info(`[TauriBridge] Environment is Web Browser. Skipping native Rust invoke('${cmd}')`);
    return null;
  }

  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    console.warn(`[TauriBridge] Error invoking '${cmd}':`, err);
    throw err;
  }
}

export async function scanMicrophones(): Promise<AudioDevice[]> {
  if (!isTauriAvailable()) {
    return [
      { id: 'default', name: 'Default Microphone (Web Audio)', is_default: true, sample_rate: 48000, channels: 2 },
      { id: 'studio', name: 'High-Res Audio Input (Browser Mock)', is_default: false, sample_rate: 44100, channels: 1 },
    ];
  }
  const result = await safeInvoke<AudioDevice[]>('list_microphones');
  return result || [];
}

export async function startMicStream(deviceName?: string): Promise<RecordingStatus | null> {
  if (!isTauriAvailable()) {
    return {
      is_recording: true,
      device_name: deviceName || 'Browser Web Audio Input',
      sample_rate: 48000,
      buffer_size: 2048,
      current_peak_db: -18.4,
      total_samples_captured: 48000,
    };
  }
  return await safeInvoke<RecordingStatus>('start_microphone', { deviceName: deviceName || null });
}

export async function stopMicStream(): Promise<RecordingStatus | null> {
  if (!isTauriAvailable()) {
    return {
      is_recording: false,
      device_name: 'Browser Web Audio Input',
      sample_rate: 48000,
      buffer_size: 2048,
      current_peak_db: -96.0,
      total_samples_captured: 96000,
    };
  }
  return await safeInvoke<RecordingStatus>('stop_microphone');
}

export async function fetchMicStatus(): Promise<RecordingStatus | null> {
  if (!isTauriAvailable()) {
    return {
      is_recording: true,
      device_name: 'Browser Web Audio Input',
      sample_rate: 48000,
      buffer_size: 2048,
      current_peak_db: -24 + Math.random() * 12,
      total_samples_captured: 120000,
    };
  }
  return await safeInvoke<RecordingStatus>('get_microphone_status');
}

export async function loadAudioFileNative(filePath: string): Promise<AudioFileMeta | null> {
  return await safeInvoke<AudioFileMeta>('load_audio_file', { filePath });
}

export async function analyzeAudioFilePitchNative(filePath: string): Promise<AnalysisResult | null> {
  return await safeInvoke<AnalysisResult>('analyze_audio_file_pitch', { filePath });
}

export async function analyzeLiveStreamPitchNative(): Promise<PitchFrame | null> {
  if (!isTauriAvailable()) {
    const time = Date.now() / 1000;
    const freq = 220 + Math.sin(time * 3) * 40;
    return {
      timestamp_ms: Date.now() % 10000,
      frequency_hz: freq,
      amplitude_db: -12 + Math.random() * 4,
      clarity: 0.88,
      note_name: 'A3',
      cents_offset: Math.round(Math.sin(time * 5) * 20),
      is_voiced: true,
    };
  }
  return await safeInvoke<PitchFrame>('analyze_live_stream_pitch');
}
