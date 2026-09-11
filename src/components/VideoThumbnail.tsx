import React, { useState, useEffect, useRef } from 'react';
import { Film, Play } from 'lucide-react';
import { isTauriAvailable } from '../services/tauriBridge';

interface VideoThumbnailProps {
  filePath: string;
  className?: string;
}

export const VideoThumbnail: React.FC<VideoThumbnailProps> = React.memo(({ filePath, className = '' }) => {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    setHasError(false);
    setIsLoaded(false);

    (async () => {
      try {
        if (isTauriAvailable()) {
          const { convertFileSrc } = await import('@tauri-apps/api/core');
          const assetUrl = convertFileSrc(filePath);
          if (isMounted) setVideoSrc(assetUrl);
        } else {
          if (isMounted) setVideoSrc(filePath);
        }
      } catch (err) {
        if (isMounted) setHasError(true);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [filePath]);

  if (hasError || !videoSrc) {
    return (
      <div
        className={`flex items-center justify-center bg-cyan-950/60 border border-cyan-500/30 rounded-lg text-cyan-400 shrink-0 ${className}`}
      >
        <Film size={20} className="opacity-70" />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-black border border-cyan-500/40 shadow-sm shrink-0 select-none group ${className}`}
    >
      <video
        ref={videoRef}
        src={videoSrc}
        muted
        playsInline
        preload="metadata"
        onLoadedMetadata={(e) => {
          const vid = e.currentTarget;
          // Seek to 1s or 10% into the video to show an informative frame instead of black start
          if (vid.duration > 1.2) {
            vid.currentTime = 1.0;
          } else if (vid.duration > 0.2) {
            vid.currentTime = vid.duration * 0.3;
          }
        }}
        onSeeked={() => {
          setIsLoaded(true);
        }}
        onError={() => {
          setHasError(true);
        }}
        className={`w-full h-full object-cover pointer-events-none transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Loading Placeholder while seeking frame */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-cyan-950/40 animate-pulse">
          <Film size={16} className="text-cyan-400/60" />
        </div>
      )}

      {/* Subtle play icon & Format pill */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />
      
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 pointer-events-none">
        <Play size={16} className="text-white drop-shadow-md fill-white/80" />
      </div>

      <span className="absolute bottom-1 right-1 px-1.5 py-0.2 rounded bg-black/80 border border-cyan-500/40 text-[9px] font-black text-cyan-300 font-mono leading-tight tracking-wider">
        MP4
      </span>
    </div>
  );
});
