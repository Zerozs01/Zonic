import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { useVideoSync } from './hooks/useVideoSync';
import { AudioFormat } from './types/downloader';

import { Scissors, X } from 'lucide-react';
import {
  AudioDevice,
  LoadedTrack,
  PitchFrame,
  RecordingStatus,
  ScoreDifficulty,
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

import { processAudioFileInBrowser, extractPitchFramesFromAudioBuffer } from './utils/webAudioPitch';
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

  // Visualizer View Mode & Video Synchronization
  const {
    viewMode,
    setViewMode,
    currentVideoUrl,
    setCleanVideoUrl,
    isVideoFile,
    handleAttachVideo,
  } = useVideoSync((msg) => setStatusMsg(msg));

  // Individual Track Volumes
  const [instVolume, setInstVolume] = useState<number>(0.8);
  const [vocalVolume, setVocalVolume] = useState<number>(0.7);

  // Playback & Master Volume State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const currentTimeSecRef = useRef<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const playbackAnimRef = useRef<number | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const playbackStartOffsetRef = useRef<number>(0);

  // Draggable Lyrics Studio Width State (Default 32%, range 15% - 60%)
  const [lyricsWidthPercent, setLyricsWidthPercent] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('zonic_lyrics_width');
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 15 && parsed <= 60) return parsed;
      }
    } catch (e) {}
    return 32;
  });
  const [isDraggingSplitter, setIsDraggingSplitter] = useState<boolean>(false);
  const mainWorkspaceRef = useRef<HTMLElement | null>(null);

  // Key Transpose, Speed Rate & Metronome BPM State
  const [transposeKey, setTransposeKey] = useState<number>(0); // -6 to +6 semitones
  const [playbackRate, setPlaybackRate] = useState<number>(1.0); // 0.5x to 1.5x
  const playbackRateRef = useRef<number>(playbackRate);
  playbackRateRef.current = playbackRate;
  const [bpm, setBpm] = useState<number>(120);

  // Cache for analyzed pitch results to prevent redundant heavy re-analysis
  const pitchCacheRef = useRef<Map<string, any>>(new Map());

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
  const [difficulty, setDifficulty] = useState<ScoreDifficulty>(() => {
    return (localStorage.getItem('zonic_karaoke_difficulty') as ScoreDifficulty) || 'easy';
  });

  useEffect(() => {
    try {
      localStorage.setItem('zonic_karaoke_difficulty', difficulty);
    } catch (e) {}
  }, [difficulty]);

  // Modular Real-time Live Pitch Scoring Engine
  const { overallScore, rawScore, targetPitchFrame, resetScore } = useLivePitchScoring({
    isPlaying,
    isRecording,
    liveMicFrame,
    vocalRefTrack,
    currentTimeSec,
    transposeKey,
    difficulty,
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

  // Optimized Mic Polling: poll live pitch at 50ms, only when actively recording AND playing (or settings modal is open for mic test)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRecording && (isPlaying || isSettingsOpen)) {
      timer = setInterval(async () => {
        try {
          const frame = await analyzeLiveStreamPitchNative();
          if (frame) {
            setLiveMicFrame((prev) => {
              // Avoid re-rendering if consecutive frames are both unvoiced/silence
              if (!frame.is_voiced && !prev?.is_voiced) {
                return prev;
              }
              return frame;
            });
          }

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
  }, [isRecording, isPlaying, isSettingsOpen]);

  // 1. Dynamic Gain update for Vocal & Instrumental (Does NOT touch playback timebase)
  useEffect(() => {
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
  }, [vocalVolume, instVolume, volume]);

  // 2. Dynamic Playback Rate and Transpose (Sample-accurate & re-anchors playback timer seamlessly)
  useEffect(() => {
    playbackRateRef.current = playbackRate;
    if (isPlaying && audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      // Re-anchor playback timer offset with sample-accurate current time
      playbackStartOffsetRef.current = currentTimeSecRef.current;
      playbackStartTimeRef.current = now;

      if (instSourceRef.current) {
        try {
          instSourceRef.current.playbackRate.setValueAtTime(playbackRate, now);
          instSourceRef.current.detune.setValueAtTime(transposeKey * 100, now);
        } catch (e) {
          try {
            instSourceRef.current.playbackRate.value = playbackRate;
            instSourceRef.current.detune.value = transposeKey * 100;
          } catch (_) {}
        }
      }
      if (vocalRefSourceRef.current) {
        try {
          vocalRefSourceRef.current.playbackRate.setValueAtTime(playbackRate, now);
          vocalRefSourceRef.current.detune.setValueAtTime(transposeKey * 100, now);
        } catch (e) {
          try {
            vocalRefSourceRef.current.playbackRate.value = playbackRate;
            vocalRefSourceRef.current.detune.value = transposeKey * 100;
          } catch (_) {}
        }
      }
    }
  }, [playbackRate, transposeKey, isPlaying]);

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
          let arrayBuffer: ArrayBuffer | null = null;
          try {
            const { convertFileSrc } = await import('@tauri-apps/api/core');
            const assetUrl = convertFileSrc(filePath);
            const res = await fetch(assetUrl);
            if (res.ok) {
              arrayBuffer = await res.arrayBuffer();
            }
          } catch (e) {
            console.warn('Asset fetch fallback to native read:', e);
          }

          if (!arrayBuffer) {
            arrayBuffer = await readAudioFileBytesNative(filePath);
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
            if (pitchCacheRef.current.has(filePath)) {
              nativeAnalysis = pitchCacheRef.current.get(filePath);
            } else {
              try {
                nativeAnalysis = await analyzeAudioFilePitchNative(filePath);
                if (nativeAnalysis) {
                  pitchCacheRef.current.set(filePath, nativeAnalysis);
                }
              } catch (pitchErr) {
                console.warn('[App] Native pitch analysis warning, falling back to AudioBuffer:', pitchErr);
              }
            }
            if (!nativeAnalysis?.pitch_frames || nativeAnalysis.pitch_frames.length === 0) {
              if (audioBuffer.duration <= 90) {
                try {
                  nativeAnalysis = extractPitchFramesFromAudioBuffer(audioBuffer);
                  if (nativeAnalysis) {
                    pitchCacheRef.current.set(filePath, nativeAnalysis);
                  }
                } catch (webAudioErr) {
                  console.warn('[App] AudioBuffer pitch analysis warning:', webAudioErr);
                }
              }
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

  const activeDownloadCount = useMemo(() => {
    return downloadQueue.filter(
      (q) => q.status === 'downloading' || q.status === 'converting' || q.status === 'pending'
    ).length;
  }, [downloadQueue]);

  // Stem Splitter Hook — auto-loads vocal & instrumental into existing track slots & library
  const { splitState, startSplit, cancelSplit, resetSplit } = useStemSplitter({
    onComplete: async (vocalPath, instrumentalPath) => {
      try {
        // 1. Refresh Downloader Library immediately so both separated stems appear in Library tab
        await refreshDownloadedLibrary();

        // 2. Preserve active video URL so visual preview does not disappear
        const preservedVideoUrl = currentVideoUrl;

        // 3. Sequentially load tracks to prevent concurrency locks
        const sourceName = vocalRefTrack?.name ?? instrumentalTrack?.name ?? 'track';
        await handleAutoLoadDownloadedTrack('instrumental', instrumentalPath, `Instrumental — ${sourceName}`);
        await handleAutoLoadDownloadedTrack('vocalRef', vocalPath, `Vocals — ${sourceName}`);

        // 4. Re-apply preserved video URL if it was active
        if (preservedVideoUrl) {
          setCleanVideoUrl(preservedVideoUrl);
          setViewMode('video');
        }

        setStatusMsg(`แยกเสียงสำเร็จและบันทึกลงในคลังเพลงแล้ว: '${sourceName}'`);
      } catch (err: any) {
        console.warn('[App] Stem auto-load warning:', err);
      }
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
            if (pitchCacheRef.current.has(filePath)) {
              nativeAnalysis = pitchCacheRef.current.get(filePath);
            } else {
              setStatusMsg(`กำลังวิเคราะห์ Pitch เสียงร้องด้วย Native Rust DSP...`);
              try {
                nativeAnalysis = await analyzeAudioFilePitchNative(filePath);
                if (nativeAnalysis) {
                  pitchCacheRef.current.set(filePath, nativeAnalysis);
                }
              } catch (e) {
                console.warn('[App] Pitch analysis warning, falling back to AudioBuffer:', e);
              }
            }
            if (!nativeAnalysis?.pitch_frames || nativeAnalysis.pitch_frames.length === 0) {
              setStatusMsg(`กำลังวิเคราะห์ Pitch เสียงร้องจาก AudioBuffer...`);
              try {
                nativeAnalysis = extractPitchFramesFromAudioBuffer(audioBuffer);
                if (nativeAnalysis) {
                  pitchCacheRef.current.set(filePath, nativeAnalysis);
                }
              } catch (audioBufErr) {
                console.warn('[App] AudioBuffer pitch analysis warning:', audioBufErr);
              }
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



  // Playback Control
  const maxDuration = Math.max(
    vocalRefTrack?.meta?.duration_seconds || 0,
    instrumentalTrack?.meta?.duration_seconds || 0
  );

  const stopPlayback = useCallback(() => {
    isPlayingRef.current = false;
    if (vocalRefSourceRef.current) {
      try {
        vocalRefSourceRef.current.onended = null;
        vocalRefSourceRef.current.stop();
      } catch (e) {}
      try { vocalRefSourceRef.current.disconnect(); } catch (e) {}
      vocalRefSourceRef.current = null;
      vocalGainNodeRef.current = null;
    }
    if (instSourceRef.current) {
      try {
        instSourceRef.current.onended = null;
        instSourceRef.current.stop();
      } catch (e) {}
      try { instSourceRef.current.disconnect(); } catch (e) {}
      instSourceRef.current = null;
      instGainNodeRef.current = null;
    }
    if (playbackAnimRef.current) {
      cancelAnimationFrame(playbackAnimRef.current);
      playbackAnimRef.current = null;
    }
    setIsPlaying(false);
    setLiveMicFrame(null);
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

  const handleToggleMic = useCallback(() => {
    if (isRecording) {
      handleStopMic();
      setStatusMsg('ปิดไมโครโฟนแล้ว');
    } else {
      handleStartMic();
      setStatusMsg('เปิดไมโครโฟนแล้ว');
    }
  }, [isRecording, handleStartMic, handleStopMic]);

  const startPlayback = useCallback(
    (offsetSec?: number) => {
      // Clean up previous frame loop immediately to prevent duplicate concurrent loops
      if (playbackAnimRef.current) {
        cancelAnimationFrame(playbackAnimRef.current);
        playbackAnimRef.current = null;
      }

      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;

      if (!isRecording) {
        handleStartMic();
      }

      if (vocalRefSourceRef.current) {
        try { vocalRefSourceRef.current.stop(); } catch (e) {}
        try { vocalRefSourceRef.current.disconnect(); } catch (e) {}
      }
      if (instSourceRef.current) {
        try { instSourceRef.current.stop(); } catch (e) {}
        try { instSourceRef.current.disconnect(); } catch (e) {}
      }

      let startAtSec = offsetSec !== undefined ? offsetSec : currentTimeSecRef.current;
      if (startAtSec >= maxDuration) startAtSec = 0;
      if (startAtSec === 0) {
        resetScore();
      }

      const scheduleTime = ctx.currentTime + 0.03;

      // Play Instrumental Track
      if (instrumentalTrack?.audioBuffer) {
        const iSource = ctx.createBufferSource();
        iSource.buffer = instrumentalTrack.audioBuffer;
        iSource.playbackRate.value = playbackRateRef.current;
        iSource.detune.value = transposeKey * 100;
        const gainNode = ctx.createGain();
        gainNode.gain.value = instVolume * volume;
        iSource.connect(gainNode);
        gainNode.connect(ctx.destination);
        iSource.start(scheduleTime, startAtSec);
        instSourceRef.current = iSource;
        instGainNodeRef.current = gainNode;
      }

      // Play Original Vocal Guide Track
      if (vocalRefTrack?.audioBuffer) {
        const vSource = ctx.createBufferSource();
        vSource.buffer = vocalRefTrack.audioBuffer;
        vSource.playbackRate.value = playbackRateRef.current;
        vSource.detune.value = transposeKey * 100;
        const gainNode = ctx.createGain();
        gainNode.gain.value = vocalVolume * volume;
        vSource.connect(gainNode);
        gainNode.connect(ctx.destination);
        vSource.start(scheduleTime, startAtSec);
        vocalRefSourceRef.current = vSource;
        vocalGainNodeRef.current = gainNode;
      }

      isPlayingRef.current = true;
      setIsPlaying(true);
      playbackStartTimeRef.current = scheduleTime;
      playbackStartOffsetRef.current = startAtSec;

      let lastUiUpdate = 0;
      const updateTimer = () => {
        if (!isPlayingRef.current) return;
        const currentRate = playbackRateRef.current;
        const elapsed = (ctx.currentTime - playbackStartTimeRef.current) * currentRate;
        const current = playbackStartOffsetRef.current + elapsed;

        if (current >= maxDuration) {
          stopPlayback();
          currentTimeSecRef.current = 0;
          setCurrentTimeSec(0);
          setIsResultsOpen(true);
        } else {
          currentTimeSecRef.current = Math.max(0, current);
          const now = performance.now();
          // Throttle state update to ~25 FPS to save CPU, while ref stays 60 FPS
          if (now - lastUiUpdate >= 40) {
            lastUiUpdate = now;
            setCurrentTimeSec(Math.max(0, current));
          }
          if (isPlayingRef.current) {
            playbackAnimRef.current = requestAnimationFrame(updateTimer);
          }
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
      resetScore,
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
      if (timeSec === 0) {
        resetScore();
      }
      if (isPlaying) {
        startPlayback(timeSec);
      }
    },
    [isPlaying, resetScore, startPlayback]
  );

  // Draggable Splitter Mouse Drag Listener
  const handleSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplitter(true);
  }, []);

  useEffect(() => {
    if (!isDraggingSplitter) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = mainWorkspaceRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const percent = (relativeX / rect.width) * 100;
      const clamped = Math.max(15, Math.min(60, percent));
      setLyricsWidthPercent(Math.round(clamped * 10) / 10);
    };

    const handleMouseUp = () => {
      setIsDraggingSplitter(false);
      try {
        setLyricsWidthPercent((current) => {
          localStorage.setItem('zonic_lyrics_width', current.toString());
          return current;
        });
      } catch (e) {}
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSplitter]);

  // Dedicated handler to attach video only from library without replacing audio stems
  const handleAttachVideoOnly = useCallback(
    async (filePath: string, fileName: string) => {
      try {
        let vUrl: string | null = null;
        if (isTauriAvailable()) {
          const { convertFileSrc } = await import('@tauri-apps/api/core');
          vUrl = convertFileSrc(filePath);
        }
        if (vUrl) {
          setCleanVideoUrl(vUrl);
          setViewMode('video');
          setStatusMsg(`เชื่อมต่อภาพวิดีโอสำเร็จ: '${fileName}' (คงเสียงดนตรีและระบบคะแนนเดิม)`);
        }
      } catch (err: any) {
        console.warn('[App] Failed to attach video only:', err);
      }
    },
    [setCleanVideoUrl, setViewMode]
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
          isDownloading={isProcessing}
          activeDownloadCount={activeDownloadCount}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-4 py-3 gap-3">
          
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

          {/* Section 2: Middle Workspace Split View with Draggable Resizer */}
          <main
            ref={mainWorkspaceRef}
            className={`flex-1 flex flex-row items-stretch min-h-0 overflow-hidden w-full ${
              isDraggingSplitter ? 'select-none cursor-col-resize' : ''
            }`}
          >
            {/* Left Column (Resizable Width - Full Height Lyrics Panel Studio) */}
            <div
              style={{ width: `${lyricsWidthPercent}%` }}
              className="h-full flex flex-col min-h-0 shrink-0 overflow-hidden pr-1.5"
            >
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

            {/* Draggable Vertical Splitter Handle */}
            <div
              role="separator"
              aria-orientation="vertical"
              onMouseDown={handleSplitterMouseDown}
              className={`w-3 -mx-1 h-full flex items-center justify-center cursor-col-resize z-20 group shrink-0 transition-colors ${
                isDraggingSplitter ? 'bg-cyan-500/20' : 'hover:bg-cyan-500/10'
              }`}
              title="ลากเพื่อปรับขนาด Lyrics Studio / Video Stage"
            >
              <div
                className={`w-1 rounded-full transition-all duration-200 ${
                  isDraggingSplitter
                    ? 'bg-cyan-400 h-24 shadow-[0_0_12px_rgba(6,182,212,0.9)]'
                    : 'bg-zinc-700/60 group-hover:bg-cyan-400 group-hover:h-16'
                }`}
              />
            </div>

            {/* Right Column (Flex-1 - Karaoke Visualizer Stage / Video Player) */}
            <div className="flex-1 h-full flex flex-col min-h-0 overflow-hidden pl-1.5">
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
                rawScore={rawScore}
                targetPitchFrame={targetPitchFrame}
                lyricLines={lyricLines}
                bpm={bpm}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                videoUrl={currentVideoUrl}
                onAttachVideo={handleAttachVideo}
                isPlaying={isPlaying}
                playbackRate={playbackRate}
                difficulty={difficulty}
                onDifficultyChange={setDifficulty}
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
          isRecording={isRecording}
          onToggleMic={handleToggleMic}
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
        difficulty={difficulty}
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
        onAttachVideoOnly={handleAttachVideoOnly}
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
                onApplyAndClose={() => setIsSplitterOpen(false)}
                onOpenLibrary={() => {
                  setIsSplitterOpen(false);
                  setIsDownloaderOpen(true);
                  refreshDownloadedLibrary();
                }}
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
