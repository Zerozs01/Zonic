import { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { DualWaveformBar } from './components/DualWaveformBar';
import { LyricsPanel } from './components/LyricsPanel';
import { KaraokeVisualizerStage } from './components/KaraokeVisualizerStage';
import { KaraokeControlBar } from './components/KaraokeControlBar';
import { MicSettingsModal } from './components/MicSettingsModal';
import { PerformanceModal } from './components/PerformanceModal';

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
  scanMicrophones,
  startMicStream,
  stopMicStream,
} from './services/tauriBridge';

import { processAudioFileInBrowser } from './utils/webAudioPitch';
import { detectSongBpm, LyricLine } from './utils/audioAnalysis';

export default function App() {
  const [_statusMsg, setStatusMsg] = useState<string>('Karaoke Studio Ready.');

  // Modals & Panels State
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isResultsOpen, setIsResultsOpen] = useState<boolean>(false);

  // Reference Audio Tracks
  const [vocalRefTrack, setVocalRefTrack] = useState<LoadedTrack | null>(null);
  const [instrumentalTrack, setInstrumentalTrack] = useState<LoadedTrack | null>(null);
  const [_isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // Individual Track Volumes
  const [instVolume, setInstVolume] = useState<number>(0.8);
  const [vocalVolume, setVocalVolume] = useState<number>(0.7);

  // Playback & Master Volume State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
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

  // Live Performance Match Score
  const [overallScore, setOverallScore] = useState<number>(100);
  const scoreHistoryRef = useRef<number[]>([]);

  // Scan Audio Input Devices on startup
  const handleScanDevices = async () => {
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
  };

  // Silent F11 Fullscreen Listener
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
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

  useEffect(() => {
    handleScanDevices();
  }, []);

  // Poll Mic Status & Live Pitch when recording is active
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRecording) {
      timer = setInterval(async () => {
        try {
          const status = await fetchMicStatus();
          if (status) setRecStatus(status);

          const frame = await analyzeLiveStreamPitchNative();
          if (frame) setLiveMicFrame(frame);
        } catch (e) {
          console.error('Mic polling error:', e);
        }
      }, 100);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  // Update Transpose, Playback Rate and Gain dynamically on active audio sources
  useEffect(() => {
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
  }, [playbackRate, transposeKey, vocalVolume, instVolume, volume]);

  // Update real-time pitch match score
  useEffect(() => {
    if (isPlaying && isRecording && liveMicFrame?.is_voiced && vocalRefTrack?.analysis?.pitch_frames) {
      const frameIdx = Math.floor((currentTimeSec * 1000) / 10);
      const targetFrame = vocalRefTrack.analysis.pitch_frames[frameIdx];
      if (targetFrame && targetFrame.is_voiced && targetFrame.frequency_hz > 0) {
        const transposedTargetHz = transposeKey !== 0
          ? targetFrame.frequency_hz * Math.pow(2, transposeKey / 12)
          : targetFrame.frequency_hz;

        const cents = Math.abs(1200 * Math.log2(liveMicFrame.frequency_hz / transposedTargetHz));
        const frameScore = Math.max(0, Math.min(100, Math.round(100 - cents * 0.8)));
        scoreHistoryRef.current.push(frameScore);

        if (scoreHistoryRef.current.length > 50) {
          scoreHistoryRef.current.shift();
        }

        const avg = scoreHistoryRef.current.reduce((a, b) => a + b, 0) / scoreHistoryRef.current.length;
        const roundedAvg = Math.round(avg);
        setOverallScore((prev) => (prev !== roundedAvg ? roundedAvg : prev));
      }
    }
  }, [isPlaying, isRecording, liveMicFrame, vocalRefTrack, transposeKey]);

  // Handle YouTube Download
  const handleDownloadYoutube = (url: string, format: string) => {
    setIsDownloading(true);
    setStatusMsg(`Downloading '${url}' as ${format}...`);
    setTimeout(() => {
      setIsDownloading(false);
      setStatusMsg(`Downloaded successfully. Ready to play.`);
    }, 2000);
  };

  // Handle Track Loaded
  const handleTrackLoaded = async (trackType: 'vocalRef' | 'instrumental', file: File) => {
    setIsProcessing(true);
    setStatusMsg(`Loading '${file.name}'...`);
    try {
      let meta: any;
      let analysis: any;
      let audioBuffer: AudioBuffer;

      const filePath = (file as any).path || file.name;
      const isTauri = isTauriAvailable();

      if (isTauri && (file as any).path) {
        const nativeAnalysis = await analyzeAudioFilePitchNative(filePath);
        const browserRes = await processAudioFileInBrowser(file);
        audioBuffer = browserRes.audioBuffer;
        meta = browserRes.meta;
        analysis = nativeAnalysis || browserRes.analysis;
      } else {
        const res = await processAudioFileInBrowser(file);
        meta = res.meta;
        analysis = res.analysis;
        audioBuffer = res.audioBuffer;
      }

      if (audioBuffer) {
        const detectedBpm = detectSongBpm(audioBuffer);
        setBpm(detectedBpm);
      }

      const track: LoadedTrack = {
        id: trackType,
        name: file.name,
        filePath,
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

      setStatusMsg(`Ready to sing: '${file.name}'`);
    } catch (err: any) {
      console.error('File load error:', err);
      setStatusMsg(`Error loading audio file: ${err?.message || err?.toString()}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Playback Control
  const maxDuration = Math.max(
    vocalRefTrack?.meta?.duration_seconds || 0,
    instrumentalTrack?.meta?.duration_seconds || 0
  );

  const startPlayback = (startAtSec = currentTimeSec) => {
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
        setCurrentTimeSec(0);
        setIsResultsOpen(true);
      } else {
        setCurrentTimeSec(current);
        playbackAnimRef.current = requestAnimationFrame(updateTimer);
      }
    };

    playbackAnimRef.current = requestAnimationFrame(updateTimer);
  };

  const stopPlayback = () => {
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
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback(currentTimeSec);
    }
  };

  const handleSeek = (timeSec: number) => {
    setCurrentTimeSec(timeSec);
    if (isPlaying) {
      startPlayback(timeSec);
    }
  };

  // Mic Controls
  const handleStartMic = async () => {
    try {
      const status = await startMicStream(selectedDevice);
      setRecStatus(status);
      setIsRecording(true);
    } catch (err: any) {
      console.warn('Mic start error:', err);
    }
  };

  const handleStopMic = async () => {
    try {
      const status = await stopMicStream();
      setRecStatus(status);
      setIsRecording(false);
    } catch (err: any) {
      console.warn('Mic stop error:', err);
    }
  };

  // Lyric Lines State
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);

  // Target Pitch Frame for HUD
  const targetPitchFrame = (() => {
    if (!vocalRefTrack?.analysis?.pitch_frames) return null;
    const frameIdx = Math.floor((currentTimeSec * 1000) / 10);
    return vocalRefTrack.analysis.pitch_frames[frameIdx] || null;
  })();

  return (
    <div className="root-app-viewport text-zinc-100">
      <div className="root-app-frame">
        {/* 1. Top Navigation Header Bar */}
        <Header
          onOpenSettings={() => setIsSettingsOpen(true)}
          onDownloadYoutube={handleDownloadYoutube}
          isDownloading={isDownloading}
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
            instVolume={instVolume}
            onInstVolumeChange={setInstVolume}
            vocalVolume={vocalVolume}
            onVocalVolumeChange={setVocalVolume}
          />

          {/* Section 2: Middle Workspace Split View (Flexbox Row - 38% Lyrics, 62% Stage) */}
          <main className="flex-1 flex flex-row items-stretch gap-3.5 min-h-0 overflow-hidden w-full">
            
            {/* Left Column (38% Width - Lyrics Editor Panel) */}
            <div className="w-[38%] h-full flex flex-col min-h-0 shrink-0 overflow-hidden">
              <LyricsPanel
                currentTimeSec={currentTimeSec}
                durationSec={maxDuration}
                vocalRefTrack={vocalRefTrack}
                onLyricsChange={setLyricLines}
                onSyncClick={() => {
                  setStatusMsg('Synced lyrics with audio timeline.');
                }}
              />
            </div>

            {/* Right Column (62% Width - Karaoke Visualizer Stage) */}
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
    </div>
  );
}
