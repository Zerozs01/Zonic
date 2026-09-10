import { useState, useEffect, useRef, useCallback } from 'react';
import { isTauriAvailable } from '../services/tauriBridge';
import {
  downloadAudioStreamNative,
  cancelDownloadNative,
  listDownloadedAudioNative,
  deleteDownloadedAudioNative,
  openDownloadFolderNative,
} from '../services/downloaderService';
import {
  AudioFormat,
  DownloadCompletePayload,
  DownloadErrorPayload,
  DownloadProgressPayload,
  DownloadQueueItem,
  DownloadedFileInfo,
} from '../types/downloader';

const STORAGE_KEY = 'zonic_download_queue_v1';

interface UseAudioDownloaderQueueProps {
  onAutoLoadTrack?: (targetTrackId: 'vocalRef' | 'instrumental' | 'userVocal', filePath: string, title: string) => Promise<void> | void;
}

export function useAudioDownloaderQueue({ onAutoLoadTrack }: UseAudioDownloaderQueueProps = {}) {
  const [queue, setQueue] = useState<DownloadQueueItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((item: DownloadQueueItem) => {
            // Clean up any tasks that were downloading/converting when app refreshed
            if (item.status === 'downloading' || item.status === 'converting') {
              return { ...item, status: 'cancelled' };
            }
            return item;
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load download queue from localStorage:', e);
    }
    return [];
  });

  const [downloadedFiles, setDownloadedFiles] = useState<DownloadedFileInfo[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState<boolean>(false);

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const activeTaskIdRef = useRef<string | null>(null);
  const queueRef = useRef<DownloadQueueItem[]>([]);
  const isProcessingRef = useRef<boolean>(false);

  activeTaskIdRef.current = activeTaskId;
  queueRef.current = queue;

  // Persist queue to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.warn('Failed to save download queue to localStorage:', e);
    }
  }, [queue]);

  // Refresh Downloaded Library Files from disk
  const refreshDownloadedLibrary = useCallback(async () => {
    setIsLoadingLibrary(true);
    try {
      const files = await listDownloadedAudioNative();
      setDownloadedFiles(files);
    } catch (err) {
      console.warn('Failed to list downloaded files:', err);
    } finally {
      setIsLoadingLibrary(false);
    }
  }, []);

  const deleteDownloadedFile = useCallback(async (filePath: string) => {
    try {
      await deleteDownloadedAudioNative(filePath);
      setDownloadedFiles((prev) => prev.filter((f) => f.file_path !== filePath));
      // Also update any matching item in queue
      setQueue((prev) => prev.filter((item) => item.filePath !== filePath));
    } catch (err) {
      console.error('Failed to delete downloaded file:', err);
    }
  }, []);

  const openDownloadFolder = useCallback(async () => {
    try {
      await openDownloadFolderNative();
    } catch (err) {
      console.error('Failed to open download folder:', err);
    }
  }, []);

  const onAutoLoadTrackRef = useRef(onAutoLoadTrack);
  useEffect(() => {
    onAutoLoadTrackRef.current = onAutoLoadTrack;
  }, [onAutoLoadTrack]);

  // Initial scan of downloaded files on mount
  useEffect(() => {
    refreshDownloadedLibrary();
  }, [refreshDownloadedLibrary]);

  // 1. Setup Tauri Event Listeners (mounted once, leak-proof)
  useEffect(() => {
    let mounted = true;
    const unlistenFns: (() => void)[] = [];

    const setupListeners = async () => {
      if (!isTauriAvailable()) return;

      try {
        const { listen } = await import('@tauri-apps/api/event');
        if (!mounted) return;

        const unProgress = await listen<DownloadProgressPayload>('download-progress', (event) => {
          if (!mounted) return;
          const { task_id, percent, speed, eta, phase } = event.payload;
          setQueue((prev) =>
            prev.map((item) =>
              item.id === task_id
                ? {
                    ...item,
                    percent,
                    speed,
                    eta,
                    status: phase === 'converting' ? 'converting' : 'downloading',
                  }
                : item
            )
          );
        });
        if (mounted) unlistenFns.push(unProgress);
        else unProgress();

        const unComplete = await listen<DownloadCompletePayload>('download-complete', async (event) => {
          if (!mounted) return;
          const { task_id, file_path, title, duration_secs } = event.payload;
          // Update queue item to completed
          setQueue((prev) =>
            prev.map((item) =>
              item.id === task_id
                ? {
                    ...item,
                    title,
                    filePath: file_path,
                    durationSecs: duration_secs,
                    percent: 100,
                    status: 'completed',
                  }
                : item
            )
          );
          // Auto-refresh disk library
          refreshDownloadedLibrary();
        });
        if (mounted) unlistenFns.push(unComplete);
        else unComplete();

        const unError = await listen<DownloadErrorPayload>('download-error', (event) => {
          if (!mounted) return;
          const { task_id, message } = event.payload;
          setQueue((prev) =>
            prev.map((item) =>
              item.id === task_id
                ? {
                    ...item,
                    status: 'failed',
                    error: message,
                  }
                : item
            )
          );
        });
        if (mounted) unlistenFns.push(unError);
        else unError();
      } catch (err) {
        console.warn('[DownloaderQueue] Failed to register Tauri event listeners:', err);
      }
    };

    setupListeners();

    return () => {
      mounted = false;
      unlistenFns.forEach((fn) => fn());
    };
  }, [refreshDownloadedLibrary]);

  // 2. Sequential Process Loop (FIFO)
  const processNextInQueue = useCallback(async () => {
    if (isProcessingRef.current) return;

    // Find next pending task
    const nextTask = queueRef.current.find((item) => item.status === 'pending');
    if (!nextTask) return;

    isProcessingRef.current = true;
    setActiveTaskId(nextTask.id);

    // Update status to downloading
    setQueue((prev) =>
      prev.map((item) =>
        item.id === nextTask.id ? { ...item, status: 'downloading', percent: 0 } : item
      )
    );

    try {
      const result = await downloadAudioStreamNative(
        nextTask.id,
        nextTask.url,
        nextTask.format,
        0
      );

      if (result) {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === nextTask.id
              ? {
                  ...item,
                  status: 'completed',
                  percent: 100,
                  title: result.title,
                  filePath: result.file_path,
                  durationSecs: result.duration_secs,
                }
              : item
          )
        );

        refreshDownloadedLibrary();

        if (onAutoLoadTrackRef.current) {
          try {
            await onAutoLoadTrackRef.current(nextTask.targetTrackId, result.file_path, result.title);
          } catch (err) {
            console.error('[DownloaderQueue] Auto load error:', err);
          }
        }
      }
    } catch (err: any) {
      console.error('[DownloaderQueue] Download execution failed:', err);
      setQueue((prev) =>
        prev.map((item) =>
          item.id === nextTask.id
            ? { ...item, status: 'failed', error: err?.toString() || 'Unknown error' }
            : item
        )
      );
    } finally {
      isProcessingRef.current = false;
      setActiveTaskId(null);
      // Auto-trigger next item in queue
      setTimeout(() => {
        processNextInQueue();
      }, 300);
    }
  }, [refreshDownloadedLibrary]);

  // Trigger processing when queue changes
  useEffect(() => {
    const hasPending = queue.some((item) => item.status === 'pending');
    if (hasPending && !activeTaskIdRef.current && !isProcessingRef.current) {
      processNextInQueue();
    }
  }, [queue, processNextInQueue]);

  // 3. Add to Queue
  const addToQueue = useCallback(
    (url: string, format: AudioFormat = 'flac', targetTrackId: 'vocalRef' | 'instrumental' | 'userVocal' = 'vocalRef') => {
      const cleanUrl = url.trim();
      if (!cleanUrl) return;

      const newItem: DownloadQueueItem = {
        id: `dl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        url: cleanUrl,
        format,
        targetTrackId,
        status: 'pending',
        percent: 0,
        speed: '',
        eta: '',
        createdAt: Date.now(),
      };

      setQueue((prev) => [...prev, newItem]);
    },
    []
  );

  // 4. Cancel Task
  const cancelTask = useCallback(async (taskId: string) => {
    const task = queueRef.current.find((item) => item.id === taskId);
    if (!task) return;

    if (task.status === 'downloading' || task.status === 'converting') {
      try {
        await cancelDownloadNative(taskId);
      } catch (e) {
        console.warn('Error cancelling task:', e);
      }
    }

    setQueue((prev) =>
      prev.map((item) =>
        item.id === taskId ? { ...item, status: 'cancelled', speed: '', eta: '' } : item
      )
    );
  }, []);

  // 5. Retry Task
  const retryTask = useCallback((taskId: string) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === taskId
          ? { ...item, status: 'pending', percent: 0, error: undefined, speed: '', eta: '' }
          : item
      )
    );
  }, []);

  // 6. Clear Completed / Failed
  const clearFinished = useCallback(() => {
    setQueue((prev) =>
      prev.filter((item) => item.status === 'downloading' || item.status === 'converting' || item.status === 'pending')
    );
  }, []);

  const isDownloading = queue.some(
    (item) => item.status === 'downloading' || item.status === 'converting' || item.status === 'pending'
  );

  return {
    queue,
    downloadedFiles,
    isLoadingLibrary,
    refreshDownloadedLibrary,
    deleteDownloadedFile,
    openDownloadFolder,
    activeTaskId,
    isDownloading,
    addToQueue,
    cancelTask,
    retryTask,
    clearFinished,
  };
}

