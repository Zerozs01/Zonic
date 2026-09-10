import { useState, useRef, useCallback, useEffect } from 'react';
import { isTauriAvailable, saveUploadedAudioNative } from '../services/tauriBridge';

export type StageViewMode = 'stage' | 'video' | 'hybrid';

export function useVideoSync(onStatusChange?: (msg: string) => void) {
  const [viewMode, setViewMode] = useState<StageViewMode>('stage');
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const prevVideoUrlRef = useRef<string | null>(null);

  // Safely set video URL and revoke previous blob URLs to prevent memory leaks
  const setCleanVideoUrl = useCallback((newUrl: string | null) => {
    if (prevVideoUrlRef.current && prevVideoUrlRef.current.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(prevVideoUrlRef.current);
      } catch (e) {}
    }
    prevVideoUrlRef.current = newUrl;
    setCurrentVideoUrl(newUrl);
  }, []);

  // Cleanup any lingering blob URL on unmount
  useEffect(() => {
    return () => {
      if (prevVideoUrlRef.current && prevVideoUrlRef.current.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(prevVideoUrlRef.current);
        } catch (e) {}
      }
    };
  }, []);

  // Check if filename or path is a supported video format
  const isVideoFile = useCallback((filenameOrPath?: string | null): boolean => {
    if (!filenameOrPath) return false;
    const lower = filenameOrPath.toLowerCase();
    return (
      lower.endsWith('.mp4') ||
      lower.endsWith('.webm') ||
      lower.endsWith('.mkv') ||
      lower.endsWith('.mov')
    );
  }, []);

  // Dedicated handler to attach or replace karaoke video
  const handleAttachVideo = useCallback(
    async (file: File) => {
      try {
        let vUrl: string | null = null;
        let filePath = (file as any).path;
        const isTauri = isTauriAvailable();

        if (isTauri && (!filePath || filePath === file.name)) {
          const buf = await file.arrayBuffer();
          const saved = await saveUploadedAudioNative(file.name, new Uint8Array(buf));
          if (saved) filePath = saved;
        }

        if (isTauri && filePath && filePath !== file.name) {
          try {
            const { convertFileSrc } = await import('@tauri-apps/api/core');
            vUrl = convertFileSrc(filePath);
          } catch (e) {
            console.warn('[useVideoSync] Failed to convertFileSrc for attached video:', e);
          }
        }

        if (!vUrl) {
          vUrl = URL.createObjectURL(file);
        }

        setCleanVideoUrl(vUrl);
        setViewMode('video');
        onStatusChange?.(`เชื่อมต่อภาพวิดีโอคาราโอเกะสำเร็จ: '${file.name}'`);
      } catch (err: any) {
        console.error('Attach video error:', err);
        onStatusChange?.(`ไม่สามารถโหลดวิดีโอได้: ${err?.message || err?.toString()}`);
      }
    },
    [onStatusChange, setCleanVideoUrl]
  );

  return {
    viewMode,
    setViewMode,
    currentVideoUrl,
    setCleanVideoUrl,
    isVideoFile,
    handleAttachVideo,
  };
}
