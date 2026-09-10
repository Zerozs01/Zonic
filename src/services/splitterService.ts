import { invoke } from '@tauri-apps/api/core';
import type { SplitCompletePayload, StemModel } from '../types/splitter';

/**
 * Invoke the Rust split_audio_stems command.
 * Emits "split-progress", "split-complete", "split-error" events on the Tauri event bus.
 */
export async function splitAudioStemsNative(
  inputPath: string,
  model: StemModel = 'htdemucs',
  jobId?: string,
): Promise<SplitCompletePayload> {
  return invoke<SplitCompletePayload>('split_audio_stems', {
    inputPath,
    model,
    jobId,
  });
}

/**
 * Cancel an in-progress split job by job_id.
 */
export async function cancelSplitNative(jobId: string): Promise<void> {
  return invoke<void>('cancel_split', { jobId });
}
