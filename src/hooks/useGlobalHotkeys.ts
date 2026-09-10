import { useEffect, useRef } from 'react';
import { isTauriAvailable } from '../services/tauriBridge';

interface UseGlobalHotkeysProps {
  onPlayPause: () => void;
  isModalOpen?: boolean;
  onCloseModal?: () => void;
}

export function useGlobalHotkeys({
  onPlayPause,
  isModalOpen = false,
  onCloseModal,
}: UseGlobalHotkeysProps) {
  const onPlayPauseRef = useRef(onPlayPause);
  onPlayPauseRef.current = onPlayPause;

  const isModalOpenRef = useRef(isModalOpen);
  isModalOpenRef.current = isModalOpen;

  const onCloseModalRef = useRef(onCloseModal);
  onCloseModalRef.current = onCloseModal;

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // 1. Escape key closes any active modal
      if (e.key === 'Escape' || e.code === 'Escape') {
        if (isModalOpenRef.current && onCloseModalRef.current) {
          e.preventDefault();
          onCloseModalRef.current();
          return;
        }
      }

      // 2. Spacebar Play / Pause Shortcut (Only when no modal is open!)
      if (e.code === 'Space' || e.key === ' ') {
        if (isModalOpenRef.current) {
          return;
        }

        const target = e.target as HTMLElement | null;
        const isTyping =
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable);

        if (!isTyping) {
          e.preventDefault();
          // Unfocus any currently focused element so Space doesn't re-trigger it
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          onPlayPauseRef.current();
          return;
        }
      }

      // 3. F11 Fullscreen
      if (e.key === 'F11' || e.code === 'F11') {
        e.preventDefault();
        try {
          if (isTauriAvailable()) {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const appWin = getCurrentWindow();
            const isFull = await appWin.isFullscreen();
            await appWin.setFullscreen(!isFull);
          } else {
            if (!document.fullscreenElement) {
              await document.documentElement.requestFullscreen();
            } else {
              await document.exitFullscreen();
            }
          }
        } catch (err) {
          console.warn('Fullscreen toggle error:', err);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
