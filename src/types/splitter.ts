// Types for the Vocal / Instrumental Stem Splitter feature

export type StemModel = 'htdemucs' | 'htdemucs_ft' | 'mdx_extra' | 'mdx_extra_q';

export type SplitJobStatus =
  | 'idle'
  | 'loading_model'
  | 'separating'
  | 'writing'
  | 'complete'
  | 'error'
  | 'cancelled';

// ── IPC Payloads (must match Rust structs exactly) ─────────────

export interface SplitProgressPayload {
  job_id: string;
  /** Human-readable step label e.g. "Separating stems" */
  step: string;
  /** 0 – 100 */
  percent: number;
}

export interface SplitCompletePayload {
  job_id: string;
  vocal_path: string;
  instrumental_path: string;
  duration_secs: number;
  model_used: string;
}

export interface SplitErrorPayload {
  job_id: string;
  message: string;
  code: number | null;
}

export interface SplitCancelledPayload {
  job_id: string;
}

// ── Hook State ──────────────────────────────────────────────────

export interface StemSplitterState {
  jobId: string | null;
  status: SplitJobStatus;
  percent: number;
  stepLabel: string;
  vocalPath: string | null;
  instrumentalPath: string | null;
  error: string | null;
  modelUsed: StemModel;
}

export const INITIAL_SPLITTER_STATE: StemSplitterState = {
  jobId: null,
  status: 'idle',
  percent: 0,
  stepLabel: '',
  vocalPath: null,
  instrumentalPath: null,
  error: null,
  modelUsed: 'mdx_extra_q',
};

// ── Model display info ──────────────────────────────────────────

export interface ModelInfo {
  id: StemModel;
  label: string;
  description: string;
  speed: 'Fast' | 'Medium' | 'Slow';
  quality: 'Good' | 'Better' | 'Best';
}

export const STEM_MODELS: ModelInfo[] = [
  {
    id: 'mdx_extra_q',
    label: 'MDX Extra Q',
    description: 'Fastest — Quantized model, good for quick previews',
    speed: 'Fast',
    quality: 'Good',
  },
  {
    id: 'mdx_extra',
    label: 'MDX Extra',
    description: 'Balanced quality and speed',
    speed: 'Medium',
    quality: 'Better',
  },
  {
    id: 'htdemucs',
    label: 'HT-Demucs',
    description: 'High quality hybrid transformer',
    speed: 'Slow',
    quality: 'Best',
  },
  {
    id: 'htdemucs_ft',
    label: 'HT-Demucs FT',
    description: 'Fine-tuned for pop/rock vocals — Best overall',
    speed: 'Slow',
    quality: 'Best',
  },
];
