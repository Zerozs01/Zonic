import { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { DualWaveformBar } from './components/DualWaveformBar';
import { LyricsPanel } from './components/LyricsPanel';
import { KaraokeVisualizerStage } from './components/KaraokeVisualizerStage';
import { KaraokeControlBar } from './components/KaraokeControlBar';
import { MicSettingsModal } from './components/MicSettingsModal';
import { PerformanceModal } from './components/PerformanceModal';
import { UrlDownloaderModal } from './components/UrlDownloaderModal';
import { StemSplitterPanel } from './components/StemSplitterPanel';
import { useAudioDownloaderQueue } from './hooks/useAudioDownloaderQueue';
import { useStemSplitter } from './hooks/useStemSplitter';
import { useGlobalHotkeys } from './hooks/useGlobalHotkeys';
import { useLivePitchScoring } from './hooks/useLivePitchScoring';
import { AudioFormat } from './types/downloader';

import { Scissors, X } from 'lucide-react';
import {
  AudioDevice,
  LoadedTrack,
  PitchFrame,
  RecordingStatus,
} from './types/audio';
import {
  analyzeAudioFilePitchNative,
  analyzeLiveStreamPitchNative,
  fetchMicStatus,
  isTauriAvailable,
  readAudioFileBytesNative,
  saveUploadedAudioNative,
  scanMicrophones,
  startMicStream,
  stopMicStream,
} from './services/tauriBridge';

import { processAudioFileInBrowser } from './utils/webAudioPitch';
import { detectSongBpm, LyricLine } from './utils/audioAnalysis';

export default function App() {
  const [statusMsg, setStatusMsg] = useState<string>('Karaoke Studio Ready.');

  // Modals & Panels State
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isResultsOpen, setIsResultsOpen] = useState<boolean>(false);
  const [isDownloaderOpen, setIsDownloaderOpen] = useState<boolean>(false);
  const [isSplitterOpen, setIsSplitterOpen] = useState<boolean>(false);

  // Reference Audio Tracks
  const [vocalRefTrack, setVocalRefTrack] = useState<LoadedTrack | null>(null);
  const [instrumentalTrack, setInstrumentalTrack] = useState<LoadedTrack | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Visualizer View Mode: 'stage' (Pitch Score & HUD) vs 'video' (Karaoke Video Player)
  const [viewMode, setViewMode] = useState<'stage' | 'video'>('stage');
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
  const isVideoFile = (filenameOrPath?: string | null): boolean => {
    if (!filenameOrPath) return false;
    const lower = filenameOrPath.toLowerCase();
    return lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mkv') || lower.endsWith('.mov');
  };

  // Individual Track Volumes
  const [instVolume, setInstVolume] = useState<number>(0.8);
  const [vocalVolume, setVocalVolume] = useState<number>(0.7);

  // Playback & Master Volume State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const currentTimeSecRef = useRef<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const playbackAnimRef = useRef<number | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const playbackStartOffsetRef = useRef<number>(0);

  // Key Transpose, Speed Rate & Metronome BPM State
  const [transposeKey, setTransposeKey] = useState<number>(0); // -6 to +6 semitones
  const [playbackRate, setPlaybackRate] = useState<number>(1.0); // 0.5x to 1.5x
  const [bpm, setBpm] = useState<number>(120);

  // Audio Context for Backing & Guide Audio Playback
  const audioCtxRef = useRef<AudioContext | null>(null);
  const vocalRefSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const vocalGainNodeRef = useRef<GainNode | null>(null);
  const instSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const instGainNodeRef = useRef<GainNode | null>(null);

  // Microphone Hardware Input State
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recStatus, setRecStatus] = useState<RecordingStatus | null>(null);
  const [liveMicFrame, setLiveMicFrame] = useState<PitchFrame | null>(null);

  // Modular Real-time Live Pitch Scoring Engine
  const { overallScore, targetPitchFrame } = useLivePitchScoring({
    isPlaying,
    isRecording,
    liveMicFrame,
    vocalRefTrack,
    currentTimeSec,
    transposeKey,
  });

  // Scan Audio Input Devices on startup
  const handleScanDevices = useCallback(async () => {
    try {
      const devList = await scanMicrophones();
      setDevices(devList);
      if (devList.length > 0) {
        const def = devList.find((d) => d.is_default) || devList[0];
        setSelectedDevice(def.name);
      }
    } catch (err: any) {
      console.warn('Device scan warning:', err);
    }
  }, []);

  useEffect(() => {
    handleScanDevices();
  }, [handleScanDevices]);

  // Check if any modal is currently open
  const isAnyModalOpen = isSettingsOpen || isResultsOpen || isDownloaderOpen || isSplitterOpen;

  const handleCloseAllModals = useCallback(() => {
    setIsSettingsOpen(false);
    setIsResultsOpen(false);
    setIsDownloaderOpen(false);
    setIsSplitterOpen(false);
  }, []);

  // Ref to hold current handlePlayPause without recreating hotkey listeners
  const handlePlayPauseRef = useRef<() => void>(() => {});

  // Modular Global Hotkeys: Spacebar (Play/Pause), Escape (Close Modal), F11 (Fullscreen)
  useGlobalHotkeys({
    onPlayPause: () => handlePlayPauseRef.current(),
    isModalOpen: isAnyModalOpen,
    onCloseModal: handleCloseAllModals,
  });

  // Optimized Mic Polling: poll live pitch at 50ms, but poll status ONLY if settings modal is open!
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRecording) {
      timer = setInterval(async () => {
        try {
          const frame = await analyzeLiveStreamPitchNative();
          if (frame) setLiveMicFrame(frame);

          if (isSettingsOpen) {
            const status = await fetchMicStatus();
            if (status) setRecStatus(status);
          }
        } catch (e) {
          console.error('Mic polling error:', e);
        }
      }, 50);
    }
    return () => clearInterval(timer);
  }, [isRecording, isSettingsOpen]);

  // Update Transpose, Playback Rate and Gain dynamically on active audio sources
  useEffect(() => {
    if (isPlaying && audioCtxRef.current) {
      // Re-anchor playback timer offset so dynamic speed change doesn't jump the playhead
      const ctx = audioCtxRef.current;
      playbackStartOffsetRef.current = currentTimeSecRef.current;
      playbackStartTimeRef.current = ctx.currentTime;
    }
    if (instSourceRef.current) {
      try {
        instSourceRef.current.playbackRate.value = playbackRate;
        instSourceRef.current.detune.value = transposeKey * 100;
      } catch (e) {}
    }
    if (vocalRefSourceRef.current) {
      try {
        vocalRefSourceRef.current.playbackRate.value = playbackRate;
        vocalRefSourceRef.current.detune.value = transposeKey * 100;
      } catch (e) {}
    }
    if (vocalGainNodeRef.current) {
      try {
        vocalGainNodeRef.current.gain.value = vocalVolume * volume;
      } catch (e) {}
    }
    if (instGainNodeRef.current) {
      try {
        instGainNodeRef.current.gain.value = instVolume * volume;
      } catch (e) {}
    }
  }, [playbackRate, transposeKey, vocalVolume, instVolume, volume, isPlaying]);

  // Auto Load Track from Downloader
  const handleAutoLoadDownloadedTrack = useCallback(
    async (
      targetTrackId: 'vocalRef' | 'instrumental' | 'userVocal',
      filePath: string,
      title: string
    ) => {
      setIsProcessing(true);
      setStatusMsg(`Loading downloaded track: ${title}...`);
      try {
        const isTauri = isTauriAvailable();
        let audioBuffer: AudioBuffer | null = null;
        let meta: any = null;
        let analysis: any = null;

        if (isTauri) {
          let arrayBuffer: ArrayBuffer | null = await readAudioFileBytesNative(filePath);
          if (!arrayBuffer) {
            try {
              const { convertFileSrc } = await import('@tauri-apps/api/core');
              const assetUrl = convertFileSrc(filePath);
              const res = await fetch(assetUrl);
              if (res.ok) {
                arrayBuffer = await res.arrayBuffer();
              }
            } catch (e) {
              console.warn('Asset fetch fallback failed:', e);
            }
          }

          if (!arrayBuffer) {
            throw new Error(`Could not read audio file bytes from: ${filePath}`);
          }

          if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          if (audioCtxRef.current.state === 'suspended') {
            await audioCtxRef.current.resume();
          }
          // Always pass a cloned buffer to prevent detachment issues
          audioBuffer = await audioCtxRef.current.decodeAudioData(arrayBuffer.slice(0));

          let nativeAnalysis: any = null;
          if (targetTrackId === 'vocalRef') {
            try {
              nativeAnalysis = await analyzeAudioFilePitchNative(filePath);
            } catch (pitchErr) {
              console.warn('[App] Pitch analysis warning:', pitchErr);
            }
          }

          analysis = nativeAnalysis || {
            total_duration_seconds: audioBuffer.duration,
            sample_rate: audioBuffer.sampleRate,
            total_frames: 0,
            voiced_frames: 0,
            pitch_frames: [],
            min_pitch_hz: 80,
            max_pitch_hz: 600,
            avg_pitch_hz: 220,
          };
          meta = {
            file_path: filePath,
            file_name: title,
            sample_rate: audioBuffer.sampleRate,
            channels: audioBuffer.numberOfChannels,
            duration_seconds: audioBuffer.duration,
            total_samples: audioBuffer.length,
            peak_amplitude: 1.0,
          };
        }

        if (audioBuffer) {
          const detectedBpm = detectSongBpm(audioBuffer);
          setBpm(detectedBpm);
        }

        // Check if this downloaded file is a video format (e.g. MP4 Karaoke)
        let videoUrl: string | null = null;
        if (isVideoFile(filePath) || isVideoFile(title)) {
          if (isTauri) {
            try {
              const { convertFileSrc } = await import('@tauri-apps/api/core');
              videoUrl = convertFileSrc(filePath);
            } catch (vErr) {
              console.warn('[App] Video URL resolution error:', vErr);
            }
          }
          if (videoUrl) {
            setCleanVideoUrl(videoUrl);
            setViewMode('video');
          }
        }

        const track: LoadedTrack = {
          id: targetTrackId,
          name: title,
          filePath,
          videoUrl,
          meta,
          analysis,
          audioBuffer,
          color: targetTrackId === 'vocalRef' ? '#a855f7' : '#10b981',
        };

        if (targetTrackId === 'vocalRef') {
          setVocalRefTrack(track);
        } else if (targetTrackId === 'instrumental') {
          setInstrumentalTrack(track);
        }

        setStatusMsg(videoUrl ? `โหลดวิดีโอคาราโอเกะสำเร็จ: '${title}'` : `Downloaded and loaded: '${title}'`);
      } catch (err: any) {
        console.error('Error auto-loading downloaded audio:', err);
        setStatusMsg(`Failed to load audio: ${err?.message || err}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [setCleanVideoUrl]
  );

  const handleClearTrack = useCallback((trackType: 'vocalRef' | 'instrumental') => {
    if (trackType === 'vocalRef') {
      setVocalRefTrack(null);
      setStatusMsg('ลบแทร็กเสียงร้อง (Vocal Guide) ออกแล้ว');
    } else {
      setInstrumentalTrack(null);
      setStatusMsg('ลบแทร็กดนตรี (Backing Track) ออกแล้ว');
    }
  }, []);

  // Audio Downloader Queue & Local Library Hook
  const {
    queue: downloadQueue,
    downloadedFiles,
    isLoadingLibrary,
    refreshDownloadedLibrary,
    deleteDownloadedFile,
    openDownloadFolder,
    isDownloading,
    addToQueue,
    cancelTask,
    retryTask,
    clearFinished,
  } = useAudioDownloaderQueue({
    onAutoLoadTrack: handleAutoLoadDownloadedTrack,
  });

  // Stem Splitter Hook — auto-loads vocal & instrumental into existing track slots
  const { splitState, startSplit, cancelSplit, resetSplit } = useStemSplitter({
    onVocalReady: (filePath) => {
      const sourceName = vocalRefTrack?.name ?? instrumentalTrack?.name ?? 'track';
      handleAutoLoadDownloadedTrack('vocalRef', filePath, `Vocals — ${sourceName}`);
    },
    onInstrumentalReady: (filePath) => {
      const sourceName = vocalRefTrack?.name ?? instrumentalTrack?.name ?? 'track';
      handleAutoLoadDownloadedTrack('instrumental', filePath, `Instrumental — ${sourceName}`);
    },
    onError: (message) => {
      setStatusMsg(`Stem split error: ${message}`);
    },
  });

  // Handle YouTube Download from Header Quick Input
  const handleDownloadYoutube = useCallback(
    (url: string, format: AudioFormat) => {
      addToQueue(url, format, 'vocalRef');
      setIsDownloaderOpen(true);
      setStatusMsg(`Added to queue: '${url}'`);
    },
    [addToQueue]
  );

  // Handle Track Loaded
  const handleTrackLoaded = useCallback(
    async (trackType: 'vocalRef' | 'instrumental', file: File) => {
      setIsProcessing(true);
      setStatusMsg(`กำลังนำเข้า '${file.name}'...`);
      try {
        let meta: any;
        let analysis: any;
        let audioBuffer: AudioBuffer;

        let filePath = (file as any).path;
        const isTauri = isTauriAvailable();

        // In Tauri, ensure we have an absolute disk path for native commands & DSP
        if (isTauri && (!filePath || filePath === file.name)) {
          setStatusMsg(`กำลังคัดลอก '${file.name}' สู่ Local Cache...`);
          const buf = await file.arrayBuffer();
          const saved = await saveUploadedAudioNative(file.name, new Uint8Array(buf));
          if (saved) {
            filePath = saved;
          }
        }
        if (!filePath) {
          filePath = file.name;
        }

        if (isTauri && filePath && filePath !== file.name) {
          // 1. Decode audio buffer for UI waveform without heavy JS loops
          if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          if (audioCtxRef.current.state === 'suspended') {
            await audioCtxRef.current.resume();
          }
          const arrayBuf = await file.arrayBuffer();
          audioBuffer = await audioCtxRef.current.decodeAudioData(arrayBuf.slice(0));

          // 2. Only perform YIN pitch analysis on Vocal Reference tracks
          let nativeAnalysis: any = null;
          if (trackType === 'vocalRef') {
            setStatusMsg(`กำลังวิเคราะห์ Pitch เสียงร้องด้วย Native Rust DSP...`);
            try {
              nativeAnalysis = await analyzeAudioFilePitchNative(filePath);
            } catch (e) {
              console.warn('[App] Pitch analysis warning:', e);
            }
          }

          meta = {
            file_path: filePath,
            file_name: file.name,
            sample_rate: audioBuffer.sampleRate,
            channels: audioBuffer.numberOfChannels,
            duration_seconds: audioBuffer.duration,
            total_samples: audioBuffer.length,
            peak_amplitude: 1.0,
          };

          analysis = nativeAnalysis || {
            total_duration_seconds: audioBuffer.duration,
            sample_rate: audioBuffer.sampleRate,
            total_frames: 0,
            voiced_frames: 0,
            pitch_frames: [],
            min_pitch_hz: 80,
            max_pitch_hz: 600,
            avg_pitch_hz: 220,
          };
        } else {
          setStatusMsg(`กำลังวิเคราะห์คลื่นเสียง (Browser Mode)...`);
          const res = await processAudioFileInBrowser(file);
          meta = res.meta;
          analysis = res.analysis;
          audioBuffer = res.audioBuffer;
        }

        if (audioBuffer) {
          const detectedBpm = detectSongBpm(audioBuffer);
          setBpm(detectedBpm);
        }

        // Detect video format and resolve preview URL
        let videoUrl: string | null = null;
        if (isVideoFile(file.name)) {
          if (isTauri && filePath && filePath !== file.name) {
            try {
              const { convertFileSrc } = await import('@tauri-apps/api/core');
              videoUrl = convertFileSrc(filePath);
            } catch (vErr) {
              console.warn('[App] Video URL resolution error:', vErr);
            }
          }
          if (!videoUrl) {
            videoUrl = URL.createObjectURL(file);
          }
          setCleanVideoUrl(videoUrl);
          setViewMode('video');
        }

        const track: LoadedTrack = {
          id: trackType,
          name: file.name,
          filePath,
          videoUrl,
          meta,
          analysis,
          audioBuffer,
          color: trackType === 'vocalRef' ? '#a855f7' : '#10b981',
        };

        if (trackType === 'vocalRef') {
          setVocalRefTrack(track);
        } else {
          setInstrumentalTrack(track);
        }

        setStatusMsg(videoUrl ? `พร้อมฝึกร้องพร้อมวิดีโอ: '${file.name}'` : `พร้อมฝึกร้อง: '${file.name}'`);
      } catch (err: any) {
        console.error('File load error:', err);
        setStatusMsg(`เกิดข้อผิดพลาดในการโหลดไฟล์: ${err?.message || err?.toString()}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [setCleanVideoUrl]
  );

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
            console.warn('[App] Failed to convertFileSrc for attached video:', e);
          }
        }

        if (!vUrl) {
          vUrl = URL.createObjectURL(file);
        }

        setCleanVideoUrl(vUrl);
        setViewMode('video');
        setStatusMsg(`เชื่อมต่อภาพวิดีโอคาราโอเกะสำเร็จ: '${file.name}'`);
      } catch (err: any) {
        console.error('Attach video error:', err);
        setStatusMsg(`ไม่สามารถโหลดวิดีโอได้: ${err?.message || err?.toString()}`);
      }
    },
    [setCleanVideoUrl]
  );

  // Playback Control
  const maxDuration = Math.max(
    vocalRefTrack?.meta?.duration_seconds || 0,
    instrumentalTrack?.meta?.duration_seconds || 0
  );

  const stopPlayback = useCallback(() => {
    if (vocalRefSourceRef.current) {
      try { vocalRefSourceRef.current.stop(); } catch (e) {}
      vocalRefSourceRef.current.disconnect();
      vocalRefSourceRef.current = null;
      vocalGainNodeRef.current = null;
    }
    if (instSourceRef.current) {
      try { instSourceRef.current.stop(); } catch (e) {}
      instSourceRef.current.disconnect();
      instSourceRef.current = null;
      instGainNodeRef.current = null;
    }
    if (playbackAnimRef.current) {
      cancelAnimationFrame(playbackAnimRef.current);
      playbackAnimRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // Mic Controls
  const handleStartMic = useCallback(async () => {
    try {
      const status = await startMicStream(selectedDevice);
      if (status) {
        setRecStatus(status);
        setIsRecording(status.is_recording);
      }
    } catch (err: any) {
      console.warn('Mic start error, attempting state recovery:', err);
      try {
        const status = await fetchMicStatus();
        if (status) {
          setRecStatus(status);
          setIsRecording(status.is_recording);
        }
      } catch (e) {}
    }
  }, [selectedDevice]);

  const handleStopMic = useCallback(async () => {
    try {
      const status = await stopMicStream();
      if (status) {
        setRecStatus(status);
        setIsRecording(status.is_recording);
      } else {
        setIsRecording(false);
      }
    } catch (err: any) {
      console.warn('Mic stop error:', err);
      setIsRecording(false);
    }
  }, []);

  const startPlayback = useCallback(
    (offsetSec?: number) => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;

      if (!isRecording) {
        handleStartMic();
      }

      if (vocalRefSourceRef.current) {
        try { vocalRefSourceRef.current.stop(); } catch (e) {}
        vocalRefSourceRef.current.disconnect();
      }
      if (instSourceRef.current) {
        try { instSourceRef.current.stop(); } catch (e) {}
        instSourceRef.current.disconnect();
      }

      let startAtSec = offsetSec !== undefined ? offsetSec : currentTimeSecRef.current;
      if (startAtSec >= maxDuration) startAtSec = 0;

      // Play Instrumental Track
      if (instrumentalTrack?.audioBuffer) {
        const iSource = ctx.createBufferSource();
        iSource.buffer = instrumentalTrack.audioBuffer;
        iSource.playbackRate.value = playbackRate;
        iSource.detune.value = transposeKey * 100;
        const gainNode = ctx.createGain();
        gainNode.gain.value = instVolume * volume;
        iSource.connect(gainNode);
        gainNode.connect(ctx.destination);
        iSource.start(0, startAtSec);
        instSourceRef.current = iSource;
        instGainNodeRef.current = gainNode;
      }

      // Play Original Vocal Guide Track
      if (vocalRefTrack?.audioBuffer) {
        const vSource = ctx.createBufferSource();
        vSource.buffer = vocalRefTrack.audioBuffer;
        vSource.playbackRate.value = playbackRate;
        vSource.detune.value = transposeKey * 100;
        const gainNode = ctx.createGain();
        gainNode.gain.value = vocalVolume * volume;
        vSource.connect(gainNode);
        gainNode.connect(ctx.destination);
        vSource.start(0, startAtSec);
        vocalRefSourceRef.current = vSource;
        vocalGainNodeRef.current = gainNode;
      }

      setIsPlaying(true);
      playbackStartTimeRef.current = ctx.currentTime;
      playbackStartOffsetRef.current = startAtSec;

      const updateTimer = () => {
        const elapsed = (ctx.currentTime - playbackStartTimeRef.current) * playbackRate;
        const current = playbackStartOffsetRef.current + elapsed;

        if (current >= maxDuration) {
          stopPlayback();
          currentTimeSecRef.current = 0;
          setCurrentTimeSec(0);
          setIsResultsOpen(true);
        } else {
          currentTimeSecRef.current = current;
          setCurrentTimeSec(current);
          playbackAnimRef.current = requestAnimationFrame(updateTimer);
        }
      };

      playbackAnimRef.current = requestAnimationFrame(updateTimer);
    },
    [
      handleStartMic,
      instVolume,
      instrumentalTrack?.audioBuffer,
      isRecording,
      maxDuration,
      playbackRate,
      stopPlayback,
      transposeKey,
      vocalRefTrack?.audioBuffer,
      vocalVolume,
      volume,
    ]
  );

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
    } else {
      if (!vocalRefTrack && !instrumentalTrack) {
        setStatusMsg('ยังไม่มีแทร็กเพลงในระบบ กรุณานำเข้าเพลงก่อนเล่น');
        return;
      }
      startPlayback(currentTimeSecRef.current);
      if (!isRecording) {
        handleStartMic();
      }
    }
  }, [
    handleStartMic,
    instrumentalTrack,
    isPlaying,
    isRecording,
    startPlayback,
    stopPlayback,
    vocalRefTrack,
  ]);
  handlePlayPauseRef.current = handlePlayPause;

  const handleSeek = useCallback(
    (timeSec: number) => {
      currentTimeSecRef.current = timeSec;
      setCurrentTimeSec(timeSec);
      if (isPlaying) {
        startPlayback(timeSec);
      }
    },
    [isPlaying, startPlayback]
  );

  // Lyric Lines State
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);

  return (
    <div className="root-app-viewport text-zinc-100">
      <div className="root-app-frame">
        {/* 1. Top Navigation Header Bar */}
        <Header
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenDownloader={() => setIsDownloaderOpen(true)}
          onOpenSplitter={() => setIsSplitterOpen(true)}
          onDownloadYoutube={handleDownloadYoutube}
          isDownloading={isDownloading}
          activeDownloadCount={downloadQueue.filter((q) => q.status === 'downloading' || q.status === 'converting' || q.status === 'pending').length}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          hasVideo={Boolean(currentVideoUrl)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden gap-3">
          
          {/* Section 1: Top Dual Waveform Bar Container */}
          <DualWaveformBar
            vocalRefTrack={vocalRefTrack}
            instrumentalTrack={instrumentalTrack}
            currentTimeSec={currentTimeSec}
            durationSec={maxDuration}
            onSeek={handleSeek}
            onTrackLoaded={handleTrackLoaded}
            onClearTrack={handleClearTrack}
            instVolume={instVolume}
            onInstVolumeChange={setInstVolume}
            vocalVolume={vocalVolume}
            onVocalVolumeChange={setVocalVolume}
          />

          {/* Section 2: Middle Workspace Split View (Flexbox Row - 38% Lyrics, 62% Stage) */}
          <main className="flex-1 flex flex-row items-stretch gap-3.5 min-h-0 overflow-hidden w-full">
            
            {/* Left Column (38% Width - Full Height Lyrics Panel Studio) */}
            <div className="w-[38%] h-full flex flex-col min-h-0 shrink-0 overflow-hidden">
              <LyricsPanel
                currentTimeSec={currentTimeSec}
                durationSec={maxDuration}
                vocalRefTrack={vocalRefTrack}
                onLyricsChange={setLyricLines}
                onSeek={handleSeek}
                onSyncClick={() => {
                  setStatusMsg('Synced lyrics with audio timeline.');
                }}
              />
            </div>

            {/* Right Column (62% Width - Karaoke Visualizer Stage / Video Player) */}
            <div className="flex-1 h-full flex flex-col min-h-0 overflow-hidden">
              <KaraokeVisualizerStage
                vocalRefTrack={vocalRefTrack}
                instrumentalTrack={instrumentalTrack}
                currentTimeSec={currentTimeSec}
                durationSec={maxDuration}
                onSeek={handleSeek}
                liveMicFrame={liveMicFrame}
                isRecording={isRecording}
                transposeKey={transposeKey}
                overallScore={overallScore}
                targetPitchFrame={targetPitchFrame}
                lyricLines={lyricLines}
                bpm={bpm}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                videoUrl={currentVideoUrl}
                onAttachVideo={handleAttachVideo}
                isPlaying={isPlaying}
                playbackRate={playbackRate}
              />
            </div>
          </main>
        </div>

        {/* Section 3: Bottom Transport Control Bar */}
        <KaraokeControlBar
          isPlaying={isPlaying}
          currentTimeSec={currentTimeSec}
          durationSec={maxDuration}
          onPlayPause={handlePlayPause}
          onStop={stopPlayback}
          onSeek={handleSeek}
          volume={volume}
          onVolumeChange={setVolume}
          transposeKey={transposeKey}
          onTransposeChange={setTransposeKey}
          playbackRate={playbackRate}
          onPlaybackRateChange={setPlaybackRate}
          bpm={bpm}
          onBpmChange={setBpm}
        />
      </div>

      {/* Modals */}
      <MicSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        devices={devices}
        selectedDevice={selectedDevice}
        onSelectDevice={setSelectedDevice}
        onRescanDevices={handleScanDevices}
        isRecording={isRecording}
        onStartMic={handleStartMic}
        onStopMic={handleStopMic}
        recStatus={recStatus}
      />

      <PerformanceModal
        isOpen={isResultsOpen}
        onClose={() => setIsResultsOpen(false)}
        overallScore={overallScore}
        vocalRefTrack={vocalRefTrack}
        transposeKey={transposeKey}
      />

      <UrlDownloaderModal
        isOpen={isDownloaderOpen}
        onClose={() => setIsDownloaderOpen(false)}
        queue={downloadQueue}
        isDownloading={isDownloading}
        onAddToQueue={addToQueue}
        onCancelTask={cancelTask}
        onRetryTask={retryTask}
        onClearFinished={clearFinished}
        onAssignTrack={(trackType, filePath, title) => handleAutoLoadDownloadedTrack(trackType, filePath, title)}
        onSendToSplitter={(filePath) => {
          setIsDownloaderOpen(false);
          setIsSplitterOpen(true);
          startSplit(filePath);
        }}
        downloadedFiles={downloadedFiles}
        isLoadingLibrary={isLoadingLibrary}
        onRefreshLibrary={refreshDownloadedLibrary}
        onDeleteDownloadedFile={deleteDownloadedFile}
        onOpenDownloadFolder={openDownloadFolder}
      />

      {/* AI Stem Splitter Modal */}
      {isSplitterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-fade-in">
          <div className="w-full max-w-xl bg-[#18181d] border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#1e1e24]/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-purple-950/60 border border-purple-500/50 text-purple-300">
                  <Scissors size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">AI Stem Splitter (Demucs)</h3>
                  <p className="text-xs text-zinc-400">แยกเสียงร้อง (Vocal) และเสียงดนตรี (Instrumental) ออกจากไฟล์เพลงรวม</p>
                </div>
              </div>
              <button
                onClick={() => setIsSplitterOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <StemSplitterPanel
                sourceFilePath={instrumentalTrack?.filePath ?? vocalRefTrack?.filePath ?? null}
                sourceFileName={instrumentalTrack?.name ?? vocalRefTrack?.name}
                splitterState={splitState}
                onStartSplit={startSplit}
                onCancelSplit={cancelSplit}
                onReset={resetSplit}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modern Glassmorphic Audio Processing Indicator */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="p-6 rounded-2xl bg-zinc-900/95 border border-zinc-700/60 shadow-[0_8px_32px_rgba(0,0,0,0.6)] flex flex-col items-center gap-3.5 max-w-xs text-center">
            <div className="relative flex items-center justify-center">
              <div className="w-11 h-11 rounded-full border-3 border-cyan-500/20 border-t-cyan-400 animate-spin" />
              <div className="absolute w-4 h-4 rounded-full bg-gradient-to-tr from-cyan-400 to-indigo-500 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white tracking-wide">กำลังนำเข้าและประมวลผลเสียง</h3>
              <p className="text-xs text-cyan-300/90 leading-relaxed font-mono">{statusMsg}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
