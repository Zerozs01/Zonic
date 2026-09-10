export type ScoreDifficulty = 'easy' | 'normal' | 'hard';

export interface AudioDevice {
  id: string;
  name: string;
  is_default: boolean;
  sample_rate: number;
  channels: number;
  preferred_buffer_size?: number;
  estimated_latency_ms?: number;
  host_name?: string;
  supported_formats?: string[];
}

export interface RecordingStatus {
  is_recording: boolean;
  device_name: string;
  sample_rate: number;
  buffer_size: number;
  latency_ms?: number;
  host_name?: string;
  current_peak_db: number;
  total_samples_captured: number;
  high_pass_enabled?: boolean;
  gain_db?: number;
}

export interface AudioFileMeta {
  file_path: string;
  file_name: string;
  sample_rate: number;
  channels: number;
  duration_seconds: number;
  total_samples: number;
  peak_amplitude: number;
}

export interface PitchFrame {
  timestamp_ms: number;
  frequency_hz: number;
  amplitude_db: number;
  clarity: number;
  note_name: string;
  cents_offset: number;
  is_voiced: boolean;
}

export interface AnalysisResult {
  total_duration_seconds: number;
  sample_rate: number;
  total_frames: number;
  voiced_frames: number;
  pitch_frames: PitchFrame[];
  min_pitch_hz: number;
  max_pitch_hz: number;
  avg_pitch_hz: number;
}

export interface LoadedTrack {
  id: 'vocalRef' | 'instrumental' | 'userVocal';
  name: string;
  filePath: string;
  meta: AudioFileMeta | null;
  analysis: AnalysisResult | null;
  audioBuffer: AudioBuffer | null;
  color: string;
  videoUrl?: string | null;
}

export interface LiveKaraokeState {
  targetNote: string;
  targetHz: number;
  userNote: string;
  userHz: number;
  centsOffset: number;
  accuracyScore: number; // 0 to 100%
  colorStatus: 'green' | 'orange' | 'red' | 'none';
  feedbackText: string;
}
