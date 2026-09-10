export type AudioFormat = 'flac' | 'mp3' | 'wav' | 'mp4';

export type DownloadTaskStatus =
  | 'pending'
  | 'downloading'
  | 'converting'
  | 'loading'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface DownloadProgressPayload {
  task_id: string;
  percent: number;
  speed: string;
  eta: string;
  phase: string;
}

export interface DownloadCompletePayload {
  task_id: string;
  file_path: string;
  format: string;
  title: string;
  duration_secs: number;
}

export interface DownloadErrorPayload {
  task_id: string;
  message: string;
}

export interface DownloadQueueItem {
  id: string;
  url: string;
  format: AudioFormat;
  targetTrackId: 'vocalRef' | 'instrumental' | 'userVocal';
  title?: string;
  status: DownloadTaskStatus;
  percent: number;
  speed: string;
  eta: string;
  filePath?: string;
  durationSecs?: number;
  error?: string;
  createdAt: number;
}

export interface AddDownloadParams {
  url: string;
  format: AudioFormat;
  targetTrackId: 'vocalRef' | 'instrumental' | 'userVocal';
}

export interface DownloadedFileInfo {
  file_path: string;
  file_name: string;
  format: string;
  size_bytes: number;
  modified_timestamp: number;
  duration_secs?: number;
}

