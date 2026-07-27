export interface AudioDevice {
  id: string;
  name: string;
  is_default: boolean;
  sample_rate: number;
  channels: number;
}

export interface RecordingStatus {
  is_recording: boolean;
  device_name: string;
  sample_rate: number;
  buffer_size: number;
  current_peak_db: number;
  total_samples_captured: number;
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
  id: 'vocal' | 'reference';
  name: string;
  filePath: string;
  meta: AudioFileMeta | null;
  analysis: AnalysisResult | null;
  audioBuffer: AudioBuffer | null;
  color: string;
}

export interface AlignmentMetrics {
  overallScore: number; // 0 to 100%
  inTunePercentage: number;
  flatPercentage: number;
  sharpPercentage: number;
  avgCentsOffset: number;
  vocalRangeNoteMin: string;
  vocalRangeNoteMax: string;
}
