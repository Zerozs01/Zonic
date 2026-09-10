import { useCallback, useEffect, useRef, useState } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { splitAudioStemsNative, cancelSplitNative } from '../services/splitterService';
import {
  INITIAL_SPLITTER_STATE,
  type SplitCancelledPayload,
  type SplitCompletePayload,
  type SplitErrorPayload,
  type SplitProgressPayload,
  type StemModel,
  type StemSplitterState,
} from '../types/splitter';

// ────────────────────────────────────────────────────────────────
// Hook Options
// ────────────────────────────────────────────────────────────────

export interface UseStemSplitterOptions {
  /** Called when vocal stem is ready — provides the absolute file path */
  onVocalReady?: (filePath: string, jobId: string) => void;
  /** Called when instrumental stem is ready */
  onInstrumentalReady?: (filePath: string, jobId: string) => void;
  /** Called on any error */
  onError?: (message: string, jobId: string) => void;
}

// ────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────

export function useStemSplitter(options: UseStemSplitterOptions = {}) {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const [state, setState] = useState<StemSplitterState>(INITIAL_SPLITTER_STATE);
  const currentJobIdRef = useRef<string | null>(null);
  const unlistenRefs = useRef<UnlistenFn[]>([]);

  // ── Register global event listeners once (leak-proof & deduplicated) ─
  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      const handleProgress = ({ payload }: { payload: SplitProgressPayload }) => {
        if (!mounted) return;
        if (payload.job_id !== currentJobIdRef.current) return;

        setState((prev) => ({
          ...prev,
          percent: payload.percent,
          stepLabel: payload.step,
          status: mapStepToStatus(payload.step),
        }));
      };

      const handleComplete = ({ payload }: { payload: SplitCompletePayload }) => {
        if (!mounted) return;
        if (payload.job_id !== currentJobIdRef.current) return;

        setState((prev) => ({
          ...prev,
          status: 'complete',
          percent: 100,
          stepLabel: 'Complete',
          vocalPath: payload.vocal_path,
          instrumentalPath: payload.instrumental_path,
        }));

        optionsRef.current.onVocalReady?.(payload.vocal_path, payload.job_id);
        optionsRef.current.onInstrumentalReady?.(payload.instrumental_path, payload.job_id);
        currentJobIdRef.current = null;
      };

      const handleError = ({ payload }: { payload: SplitErrorPayload }) => {
        if (!mounted) return;
        if (payload.job_id !== currentJobIdRef.current) return;

        setState((prev) => ({
          ...prev,
          status: 'error',
          error: payload.message,
        }));

        optionsRef.current.onError?.(payload.message, payload.job_id);
        currentJobIdRef.current = null;
      };

      // Listen to canonical split events only to avoid double-processing
      const unlistenProgress = await listen<SplitProgressPayload>('split-progress', handleProgress);
      const unlistenComplete = await listen<SplitCompletePayload>('split-complete', handleComplete);
      const unlistenError = await listen<SplitErrorPayload>('split-error', handleError);
      const unlistenCancelled = await listen<SplitCancelledPayload>(
        'split-cancelled',
        ({ payload }) => {
          if (!mounted) return;
          if (payload.job_id !== currentJobIdRef.current) return;

          setState((prev) => ({ ...prev, status: 'cancelled' }));
          currentJobIdRef.current = null;
        },
      );

      if (!mounted) {
        unlistenProgress();
        unlistenComplete();
        unlistenError();
        unlistenCancelled();
        return;
      }

      unlistenRefs.current = [
        unlistenProgress,
        unlistenComplete,
        unlistenError,
        unlistenCancelled,
      ];
    };

    setup().catch(console.error);

    return () => {
      mounted = false;
      unlistenRefs.current.forEach((fn) => fn());
      unlistenRefs.current = [];
    };
  }, []);

  // ── startSplit ─────────────────────────────────────────────────
  const startSplit = useCallback(
    async (inputPath: string, model: StemModel = 'mdx_extra_q') => {
      if (state.status === 'loading_model' || state.status === 'separating') {
        console.warn('[useStemSplitter] A split is already in progress.');
        return;
      }

      const jobId = `split_${Date.now()}`;
      currentJobIdRef.current = jobId;

      setState({
        ...INITIAL_SPLITTER_STATE,
        jobId,
        modelUsed: model,
        status: 'loading_model',
        percent: 0,
        stepLabel: 'Starting…',
      });

      try {
        // Fire-and-forget: result arrives via events, not return value
        // (invoke also returns the payload but events handle UI updates)
        await splitAudioStemsNative(inputPath, model, jobId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setState((prev) => ({ ...prev, status: 'error', error: message }));
        optionsRef.current.onError?.(message, jobId);
        currentJobIdRef.current = null;
      }
    },
    [state.status],
  );

  // ── cancelSplit ────────────────────────────────────────────────
  const cancelSplit = useCallback(async () => {
    const jobId = currentJobIdRef.current;
    if (!jobId) return;
    try {
      await cancelSplitNative(jobId);
    } catch (err) {
      console.warn('[useStemSplitter] Cancel error:', err);
    }
  }, []);

  // ── resetSplit ─────────────────────────────────────────────────
  const resetSplit = useCallback(() => {
    currentJobIdRef.current = null;
    setState(INITIAL_SPLITTER_STATE);
  }, []);

  return {
    splitState: state,
    startSplit,
    cancelSplit,
    resetSplit,
    isActive: state.status === 'loading_model' || state.status === 'separating' || state.status === 'writing',
  };
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function mapStepToStatus(step: string): StemSplitterState['status'] {
  const s = step.toLowerCase();
  if (s.includes('load') || s.includes('model') || s.includes('install')) return 'loading_model';
  if (s.includes('separ') || s.includes('infer') || s.includes('chunk')) return 'separating';
  if (s.includes('writ') || s.includes('output') || s.includes('output')) return 'writing';
  return 'separating';
}
