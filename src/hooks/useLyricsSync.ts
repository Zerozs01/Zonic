import { useState, useCallback, useEffect, useRef } from 'react';
import { isTauriAvailable } from '../services/tauriBridge';
import { syncLyricsNative, cancelSyncLyricsNative } from '../services/lyricsService';
import {
  LyricsMode,
  SyncedLyricLine,
  SyncProgressPayload,
} from '../types/lyrics';
import { LyricLine } from '../utils/audioAnalysis';

interface UseLyricsSyncProps {
  initialText?: string;
  onLyricsChange?: (lines: LyricLine[]) => void;
}

export function useLyricsSync({ initialText = '', onLyricsChange }: UseLyricsSyncProps = {}) {
  const [mode, setMode] = useState<LyricsMode>('unsynced');
  const [rawText, setRawText] = useState<string>(initialText);
  const [lines, setLines] = useState<SyncedLyricLine[]>([]);
  const [progress, setProgress] = useState<{ percent: number; stage: string }>({
    percent: 0,
    stage: '',
  });
  const [error, setError] = useState<string | null>(null);

  const activeJobIdRef = useRef<string | null>(null);
  const onLyricsChangeRef = useRef(onLyricsChange);
  onLyricsChangeRef.current = onLyricsChange;

  // Convert SyncedLyricLine[] to LyricLine[] for downstream visualizers
  const notifyChanges = useCallback((updatedLines: SyncedLyricLine[]) => {
    if (onLyricsChangeRef.current) {
      const compatible: LyricLine[] = updatedLines.map((l) => ({
        id: l.id,
        startTime: l.startTime,
        endTime: l.endTime,
        timeSec: l.startTime,
        text: l.text,
        words: l.words?.map((w) => ({
          word: w.word,
          start: w.start,
          end: w.end,
        })),
      }));
      onLyricsChangeRef.current(compatible);
    }
  }, []);

  // 1. Setup Tauri event listener for sync-progress
  useEffect(() => {
    let mounted = true;
    const unlistenFns: (() => void)[] = [];

    const setupListeners = async () => {
      if (!isTauriAvailable()) return;

      try {
        const { listen } = await import('@tauri-apps/api/event');
        if (!mounted) return;

        const unProgress = await listen<SyncProgressPayload>('sync-progress', (event) => {
          if (!mounted) return;
          if (event.payload.jobId === activeJobIdRef.current) {
            setProgress({
              percent: event.payload.percent,
              stage: event.payload.message || event.payload.stage,
            });
          }
        });
        if (mounted) unlistenFns.push(unProgress);
        else unProgress();

        const unError = await listen<{ jobId: string; message: string }>('sync-error', (event) => {
          if (!mounted) return;
          if (event.payload.jobId === activeJobIdRef.current) {
            setError(event.payload.message);
          }
        });
        if (mounted) unlistenFns.push(unError);
        else unError();
      } catch (err) {
        console.warn('[useLyricsSync] Failed to register Tauri event listeners:', err);
      }
    };

    setupListeners();

    return () => {
      mounted = false;
      unlistenFns.forEach((fn) => fn());
    };
  }, []);

  // 2. Trigger Forced Alignment Sync
  const triggerSync = useCallback(
    async (vocalPath: string, language: string = 'auto') => {
      if (!vocalPath) {
        setError('กรุณาโหลดไฟล์เสียงร้อง (Vocal Track) ก่อนทำการซิงค์');
        return;
      }
      if (!rawText.trim()) {
        setError('กรุณาวางเนื้อเพลงก่อนเริ่มซิงค์');
        return;
      }

      const jobId = `sync_${Date.now()}`;
      activeJobIdRef.current = jobId;
      setMode('syncing');
      setProgress({ percent: 5, stage: 'เริ่มต้นประมวลผล Alignment...' });
      setError(null);

      try {
        const result = await syncLyricsNative({
          vocalPath,
          plainText: rawText,
          language,
          jobId,
        });

        if (result && result.lines.length > 0) {
          setLines(result.lines);
          setMode('synced');
          notifyChanges(result.lines);
        } else {
          throw new Error('ไม่พบข้อมูลผลลัพธ์การซิงค์เนื้อเพลง');
        }
      } catch (err: any) {
        console.error('[useLyricsSync] Sync error:', err);
        setError(err?.message || err?.toString() || 'เกิดข้อผิดพลาดในการ Alignment');
        setMode('unsynced');
      } finally {
        activeJobIdRef.current = null;
      }
    },
    [rawText, notifyChanges]
  );

  // 3. Cancel Sync
  const cancelSync = useCallback(async () => {
    const jobId = activeJobIdRef.current;
    if (jobId) {
      try {
        await cancelSyncLyricsNative(jobId);
      } catch (e) {
        console.warn('Error cancelling lyrics sync:', e);
      }
    }
    activeJobIdRef.current = null;
    setMode('unsynced');
    setProgress({ percent: 0, stage: '' });
  }, []);

  // 4. Shift All Lines by a delta offset (±0.5s, ±1.0s, etc.)
  const shiftAllLines = useCallback(
    (deltaSec: number) => {
      setLines((prev) => {
        if (prev.length === 0) return prev;
        const updated = prev.map((line) => {
          const newStart = Math.max(0, Number((line.startTime + deltaSec).toFixed(2)));
          const duration = Math.max(0.5, line.endTime - line.startTime);
          const newEnd = Number((newStart + duration).toFixed(2));
          const shiftedWords = line.words?.map((w) => ({
            ...w,
            start: Math.max(0, Number((w.start + deltaSec).toFixed(2))),
            end: Math.max(0, Number((w.end + deltaSec).toFixed(2))),
          }));
          return {
            ...line,
            startTime: newStart,
            endTime: newEnd,
            words: shiftedWords,
            isCustomEdited: true,
          };
        });
        notifyChanges(updated);
        return updated;
      });
    },
    [notifyChanges]
  );

  // 5. Align First Line Start Time directly to targetSec (e.g. from current playhead)
  const setAllLinesStartTime = useCallback(
    (targetStartSec: number) => {
      setLines((prev) => {
        if (prev.length === 0) return prev;
        const firstLineStart = prev[0].startTime;
        const delta = targetStartSec - firstLineStart;
        return prev.map((line) => {
          const newStart = Math.max(0, Number((line.startTime + delta).toFixed(2)));
          const duration = Math.max(0.5, line.endTime - line.startTime);
          const newEnd = Number((newStart + duration).toFixed(2));
          const shiftedWords = line.words?.map((w) => ({
            ...w,
            start: Math.max(0, Number((w.start + delta).toFixed(2))),
            end: Math.max(0, Number((w.end + delta).toFixed(2))),
          }));
          return {
            ...line,
            startTime: newStart,
            endTime: newEnd,
            words: shiftedWords,
            isCustomEdited: true,
          };
        });
      });
    },
    []
  );

  // 6. Stamp specific line start time to playhead timestamp (CapCut / Premiere subtitle style)
  const stampLineTime = useCallback(
    (lineId: string, timestampSec: number) => {
      setLines((prev) => {
        const updated = prev.map((line) => {
          if (line.id !== lineId) return line;
          const duration = Math.max(1.0, line.endTime - line.startTime);
          const newStart = Math.max(0, Number(timestampSec.toFixed(2)));
          const newEnd = Number((newStart + duration).toFixed(2));
          return {
            ...line,
            startTime: newStart,
            endTime: newEnd,
            isCustomEdited: true,
          };
        });
        notifyChanges(updated);
        return updated;
      });
    },
    [notifyChanges]
  );

  // 7. Micro-Nudge Timestamp (±0.1s, ±0.2s, ±0.5s)
  const adjustLineTime = useCallback(
    (lineId: string, deltaSec: number) => {
      setLines((prev) => {
        const updated = prev.map((line) => {
          if (line.id !== lineId) return line;
          const newStart = Math.max(0, Number((line.startTime + deltaSec).toFixed(2)));
          const duration = Math.max(0.5, line.endTime - line.startTime);
          const newEnd = Number((newStart + duration).toFixed(2));

          const shiftedWords = line.words?.map((w) => ({
            ...w,
            start: Math.max(0, Number((w.start + deltaSec).toFixed(2))),
            end: Math.max(0, Number((w.end + deltaSec).toFixed(2))),
          }));

          return {
            ...line,
            startTime: newStart,
            endTime: newEnd,
            words: shiftedWords,
            isCustomEdited: true,
          };
        });

        notifyChanges(updated);
        return updated;
      });
    },
    [notifyChanges]
  );

  // 8. Export to Standard LRC format string
  const exportToLrc = useCallback((): string => {
    return lines
      .map((l) => {
        const m = Math.floor(l.startTime / 60);
        const s = Math.floor(l.startTime % 60);
        const ms = Math.floor((l.startTime % 1) * 100);
        const timestamp = `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}]`;
        return `${timestamp} ${l.text}`;
      })
      .join('\n');
  }, [lines]);

  return {
    mode,
    setMode,
    rawText,
    setRawText,
    lines,
    setLines,
    progress,
    error,
    triggerSync,
    cancelSync,
    adjustLineTime,
    shiftAllLines,
    setAllLinesStartTime,
    stampLineTime,
    exportToLrc,
  };
}
