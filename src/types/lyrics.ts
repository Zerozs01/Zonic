export type SyncStage =
  | 'idle'
  | 'vad'
  | 'extracting_features'
  | 'ctc_aligning'
  | 'post_processing';

export type LyricsMode = 'unsynced' | 'syncing' | 'synced' | 'edit';

export interface WordTimestamp {
  word: string;
  start: number; // in seconds
  end: number;   // in seconds
  confidence?: number; // 0.0 - 1.0
}

export interface SyncedLyricLine {
  id: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;
  words?: WordTimestamp[];
  confidence: number; // 0.0 - 1.0 (for flagging lines that need review)
  isCustomEdited?: boolean;
}

export interface SyncedLyricsResult {
  jobId: string;
  lines: SyncedLyricLine[];
  durationSecs: number;
  avgConfidence: number;
}

export interface SyncProgressPayload {
  jobId: string;
  percent: number;
  stage: string;
  message: string;
}

export interface SyncLyricsRequest {
  vocalPath: string;
  plainText: string;
  language?: string;
  jobId?: string;
}
