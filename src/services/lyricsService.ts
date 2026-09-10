import { isTauriAvailable, safeInvoke } from './tauriBridge';
import { SyncedLyricsResult, SyncLyricsRequest } from '../types/lyrics';

export async function syncLyricsNative(request: SyncLyricsRequest): Promise<SyncedLyricsResult | null> {
  if (!isTauriAvailable()) {
    console.info('[LyricsService] Browser environment: simulating lyrics alignment for:', request.vocalPath);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const lines = request.plainText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const duration = 180;
    const interval = lines.length > 0 ? duration / lines.length : 4;

    return {
      jobId: request.jobId || `mock_sync_${Date.now()}`,
      durationSecs: duration,
      avgConfidence: 0.92,
      lines: lines.map((text, idx) => {
        const start = Number((idx * interval).toFixed(2));
        const end = Number((start + interval * 0.85).toFixed(2));
        const words = text.split(/\s+/).map((w, wIdx, arr) => {
          const wLen = (end - start) / arr.length;
          return {
            word: w,
            start: Number((start + wIdx * wLen).toFixed(2)),
            end: Number((start + (wIdx + 1) * wLen).toFixed(2)),
            confidence: 0.95,
          };
        });
        return {
          id: `align-${idx}`,
          startTime: start,
          endTime: end,
          text,
          words,
          confidence: 0.92,
        };
      }),
    };
  }

  return await safeInvoke<SyncedLyricsResult>('sync_lyrics', {
    vocalPath: request.vocalPath,
    plainText: request.plainText,
    language: request.language,
    jobId: request.jobId,
  });
}

export async function cancelSyncLyricsNative(jobId: string): Promise<void> {
  if (!isTauriAvailable()) {
    console.info('[LyricsService] Mock sync cancelled for:', jobId);
    return;
  }

  await safeInvoke<void>('cancel_sync_lyrics', { jobId });
}
