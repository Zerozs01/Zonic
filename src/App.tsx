import { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { KaraokeControlBar } from './components/KaraokeControlBar';
import { PitchVisualizer } from './components/PitchVisualizer';
import { LyricsPanel } from './components/LyricsPanel';
import { KaraokeHUD } from './components/KaraokeHUD';
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
import { detectSongBpm } from './utils/audioAnalysis';

export default function App() {
  const [statusMsg, setStatusMsg] = useState<string>('Karaoke Studio Ready.');

  // Modals & Panels State
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isResultsOpen, setIsResultsOpen] = useState<boolean>(false);

  // Reference Audio Tracks
  const [vocalRefTrack, setVocalRefTrack] = useState<LoadedTrack | null>(null);
  const [instrumentalTrack, setInstrumentalTrack] = useState<LoadedTrack | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Playback & Volume State
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
  const [metronomeActive, setMetronomeActive] = useState<boolean>(false);
  const lastBeatRef = useRef<number>(-1);

  // Audio Context for Backing & Guide Audio Playback
  const audioCtxRef = useRef<AudioContext | null>(null);
  const vocalRefSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const vocalGainNodeRef = useRef<GainNode | null>(null);
  const instSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [vocalGuideEnabled, setVocalGuideEnabled] = useState<boolean>(false); // DEFAULT OFF!

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

  // Metronome Click Effect during playback
  useEffect(() => {
    if (isPlaying && metronomeActive && audioCtxRef.current) {
      const beat = Math.floor((currentTimeSec * bpm) / 60);
      if (beat !== lastBeatRef.current && beat >= 0) {
        lastBeatRef.current = beat;
        try {
          const ctx = audioCtxRef.current;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const isDownbeat = beat % 4 === 0;
          osc.frequency.value = isDownbeat ? 1200 : 800;
          gain.gain.value = 0.12;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.04);
        } catch (e) {}
      }
    }
  }, [isPlaying, metronomeActive, currentTimeSec, bpm]);

  // Update Transpose, Playback Rate and Guide Vocal Volume dynamically on active audio sources
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
        vocalGainNodeRef.current.gain.value = vocalGuideEnabled ? volume * 0.7 : 0;
      } catch (e) {}
    }
  }, [playbackRate, transposeKey, vocalGuideEnabled, volume]);

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
        color: trackType === 'vocalRef' ? '#a855f7' : '#00f2fe',
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

  const handleClearTrack = (trackType: 'vocalRef' | 'instrumental') => {
    if (isPlaying) stopPlayback();
    if (trackType === 'vocalRef') setVocalRefTrack(null);
    else setInstrumentalTrack(null);
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
      gainNode.gain.value = volume;
      iSource.connect(gainNode);
      gainNode.connect(ctx.destination);
      iSource.start(0, startAtSec);
      instSourceRef.current = iSource;
    }

    // Play Original Vocal Guide Track (Default Audio OFF for Karaoke Practice)
    if (vocalRefTrack?.audioBuffer) {
      const vSource = ctx.createBufferSource();
      vSource.buffer = vocalRefTrack.audioBuffer;
      vSource.playbackRate.value = playbackRate;
      vSource.detune.value = transposeKey * 100;
      const gainNode = ctx.createGain();
      gainNode.gain.value = vocalGuideEnabled ? volume * 0.7 : 0;
      vSource.connect(gainNode);
      gainNode.connect(ctx.destination);
      vSource.start(0, startAtSec);
      vocalRefSourceRef.current = vSource;
      vocalGainNodeRef.current = gainNode;
    }

    setIsPlaying(true);
    playbackStartTimeRef.current = ctx.currentTime;
    playbackStartOffsetRef.current = startAtSec;
    lastBeatRef.current = -1;

    const updateTimer = () => {
      const elapsed = (ctx.currentTime - playbackStartTimeRef.current) * playbackRate;
      const current = playbackStartOffsetRef.current + elapsed;

      if (current >= maxDuration) {
        stopPlayback();
        setCurrentTimeSec(0);
        setIsResultsOpen(true); // Automatically show Performance Modal after singing finishes!
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

  // Target Pitch Frame for HUD
  const targetPitchFrame = (() => {
    if (!vocalRefTrack?.analysis?.pitch_frames) return null;
    const frameIdx = Math.floor((currentTimeSec * 1000) / 10);
    return vocalRefTrack.analysis.pitch_frames[frameIdx] || null;
  })();

  return (
    <div className="app-container notion-clean">
      {/* Sleek Minimal Header with integrated track import buttons */}
      <Header
        vocalRefTrack={vocalRefTrack}
        instrumentalTrack={instrumentalTrack}
        onTrackLoaded={handleTrackLoaded}
        onClearTrack={handleClearTrack}
        isProcessing={isProcessing}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenResults={() => setIsResultsOpen(true)}
        hasScore={scoreHistoryRef.current.length > 0}
      />

      {/* Main Karaoke Workspace */}
      <main className="main-karaoke-layout clean">
        {/* 1. YouTube-style Streamlined Controls */}
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
          metronomeActive={metronomeActive}
          onToggleMetronome={() => setMetronomeActive(!metronomeActive)}
          vocalGuideEnabled={vocalGuideEnabled}
          onToggleVocalGuide={() => setVocalGuideEnabled(!vocalGuideEnabled)}
        />

        {/* 2. Karaoke Stage Grid: 40% Lyrics (Left) : 60% Pitch Contour (Right) */}
        <div className="karaoke-screen-grid clean">
          {/* Left Column (40% Width): Karaoke Lyrics Display */}
          <div className="karaoke-left-panel clean lyrics-col">
            <LyricsPanel currentTimeSec={currentTimeSec} durationSec={maxDuration} />
          </div>

          {/* Right Column (60% Width): Pitch Contour & HUD */}
          <div className="karaoke-right-panel clean pitch-col">
            <KaraokeHUD
              targetPitchFrame={targetPitchFrame}
              liveMicFrame={liveMicFrame}
              isRecording={isRecording}
              overallScore={overallScore}
              transposeKey={transposeKey}
            />

            <PitchVisualizer
              vocalRefTrack={vocalRefTrack}
              instrumentalTrack={instrumentalTrack}
              currentTimeSec={currentTimeSec}
              durationSec={maxDuration}
              onSeek={handleSeek}
              liveMicFrame={liveMicFrame}
              isRecording={isRecording}
              transposeKey={transposeKey}
            />
          </div>
        </div>
      </main>

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
