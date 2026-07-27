import { useState, useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { Header } from './components/Header';
import { DropZone } from './components/DropZone';
import { PitchVisualizer } from './components/PitchVisualizer';
import { AudioControls } from './components/AudioControls';
import { MetricsPanel } from './components/MetricsPanel';
import { MicControlDeck } from './components/MicControlDeck';
import { KaraokeHUD } from './components/KaraokeHUD';
import {
  AudioDevice,
  LoadedTrack,
  PitchFrame,
  RecordingStatus,
} from './types/audio';
import {
  analyzeLiveStreamPitchNative,
  fetchMicStatus,
  scanMicrophones,
  startMicStream,
  stopMicStream,
} from './services/tauriBridge';
import { processAudioFileInBrowser } from './utils/webAudioPitch';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dual' | 'live'>('live');
  const [statusMsg, setStatusMsg] = useState<string>('Karaoke Live Vocal Training Engine Ready.');

  // Reference Audio Tracks
  const [vocalRefTrack, setVocalRefTrack] = useState<LoadedTrack | null>(null);
  const [instrumentalTrack, setInstrumentalTrack] = useState<LoadedTrack | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const playbackAnimRef = useRef<number | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const playbackStartOffsetRef = useRef<number>(0);

  // Audio Context for Backing & Guide Audio Playback
  const audioCtxRef = useRef<AudioContext | null>(null);
  const vocalRefSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const instSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Microphone Hardware Input State (DEFAULT ACTIVE)
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
      setStatusMsg('Scanning audio input devices...');
      const devList = await scanMicrophones();
      setDevices(devList);
      if (devList.length > 0) {
        const def = devList.find((d) => d.is_default) || devList[0];
        setSelectedDevice(def.name);
      }
      setStatusMsg(`Microphone ready: Found ${devList.length} input device(s).`);
    } catch (err: any) {
      console.warn('Device scan warning:', err);
      setStatusMsg('Microphone ready (Web Audio Input)');
    }
  };

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

  // Update real-time score
  useEffect(() => {
    if (isPlaying && isRecording && liveMicFrame?.is_voiced && vocalRefTrack?.analysis?.pitch_frames) {
      const frameIdx = Math.floor((currentTimeSec * 1000) / 10);
      const targetFrame = vocalRefTrack.analysis.pitch_frames[frameIdx];
      if (targetFrame && targetFrame.is_voiced && targetFrame.frequency_hz > 0) {
        const cents = Math.abs(1200 * Math.log2(liveMicFrame.frequency_hz / targetFrame.frequency_hz));
        const frameScore = Math.max(0, Math.min(100, Math.round(100 - cents * 0.8)));
        scoreHistoryRef.current.push(frameScore);

        if (scoreHistoryRef.current.length > 50) {
          scoreHistoryRef.current.shift();
        }

        const avg = scoreHistoryRef.current.reduce((a, b) => a + b, 0) / scoreHistoryRef.current.length;
        setOverallScore(Math.round(avg));
      }
    }
  }, [isPlaying, isRecording, liveMicFrame, currentTimeSec, vocalRefTrack]);

  // Handle Track Loaded (Drag & Drop or File Selector)
  const handleTrackLoaded = async (trackType: 'vocalRef' | 'instrumental', file: File) => {
    setIsProcessing(true);
    setStatusMsg(`Decoding and analyzing pitch for '${file.name}' using YIN algorithm...`);
    try {
      const { meta, analysis, audioBuffer } = await processAudioFileInBrowser(file);

      const track: LoadedTrack = {
        id: trackType,
        name: file.name,
        filePath: file.name,
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

      setStatusMsg(
        `Successfully loaded '${file.name}' (${analysis.voiced_frames} pitch guide frames extracted)`
      );
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
    setStatusMsg(`Cleared ${trackType === 'vocalRef' ? 'Original Vocal Guide' : 'Instrumental'} track.`);
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

    // Auto-start Microphone capture if not already recording
    if (!isRecording) {
      handleStartMic();
    }

    // Stop existing sources
    if (vocalRefSourceRef.current) {
      try { vocalRefSourceRef.current.stop(); } catch (e) {}
      vocalRefSourceRef.current.disconnect();
    }
    if (instSourceRef.current) {
      try { instSourceRef.current.stop(); } catch (e) {}
      instSourceRef.current.disconnect();
    }

    if (startAtSec >= maxDuration) startAtSec = 0;

    // Play Instrumental Backing Track
    if (instrumentalTrack?.audioBuffer) {
      const iSource = ctx.createBufferSource();
      iSource.buffer = instrumentalTrack.audioBuffer;
      const gainNode = ctx.createGain();
      gainNode.gain.value = volume;
      iSource.connect(gainNode);
      gainNode.connect(ctx.destination);
      iSource.start(0, startAtSec);
      instSourceRef.current = iSource;
    }

    // Play Original Vocal Guide Track (optional guide volume)
    if (vocalRefTrack?.audioBuffer) {
      const vSource = ctx.createBufferSource();
      vSource.buffer = vocalRefTrack.audioBuffer;
      const gainNode = ctx.createGain();
      gainNode.gain.value = volume * 0.7; // Guide vocal slightly lower
      vSource.connect(gainNode);
      gainNode.connect(ctx.destination);
      vSource.start(0, startAtSec);
      vocalRefSourceRef.current = vSource;
    }

    setIsPlaying(true);
    playbackStartTimeRef.current = ctx.currentTime;
    playbackStartOffsetRef.current = startAtSec;

    const updateTimer = () => {
      const elapsed = ctx.currentTime - playbackStartTimeRef.current;
      const current = playbackStartOffsetRef.current + elapsed;

      if (current >= maxDuration) {
        stopPlayback();
        setCurrentTimeSec(0);
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
      setStatusMsg('Starting live microphone capture stream...');
      const status = await startMicStream(selectedDevice);
      setRecStatus(status);
      setIsRecording(true);
      setStatusMsg(`Live Karaoke Mic active: ${selectedDevice || 'Default Microphone'}`);
    } catch (err: any) {
      setStatusMsg(`Error starting mic: ${err?.message || err?.toString()}`);
    }
  };

  const handleStopMic = async () => {
    try {
      const status = await stopMicStream();
      setRecStatus(status);
      setIsRecording(false);
      setStatusMsg('Microphone stream stopped.');
    } catch (err: any) {
      setStatusMsg(`Error stopping mic: ${err?.message || err?.toString()}`);
    }
  };

  // Current Target Pitch Frame for HUD
  const targetPitchFrame = (() => {
    if (!vocalRefTrack?.analysis?.pitch_frames) return null;
    const frameIdx = Math.floor((currentTimeSec * 1000) / 10);
    return vocalRefTrack.analysis.pitch_frames[frameIdx] || null;
  })();

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Main Content Area */}
      <main style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Track Dropzones: Original Vocal & Instrumental BGM */}
        <DropZone
          vocalRefTrack={vocalRefTrack}
          instrumentalTrack={instrumentalTrack}
          onTrackLoaded={handleTrackLoaded}
          onClearTrack={handleClearTrack}
          isProcessing={isProcessing}
        />

        {/* Real-Time Karaoke Pitch & Key HUD */}
        <KaraokeHUD
          targetPitchFrame={targetPitchFrame}
          liveMicFrame={liveMicFrame}
          isRecording={isRecording}
          overallScore={overallScore}
        />

        {/* Dynamic Color Karaoke Pitch Visualizer Canvas */}
        <PitchVisualizer
          vocalRefTrack={vocalRefTrack}
          instrumentalTrack={instrumentalTrack}
          currentTimeSec={currentTimeSec}
          durationSec={maxDuration}
          onSeek={handleSeek}
          liveMicFrame={liveMicFrame}
          isRecording={isRecording}
        />

        {/* Playback Scrubber & Volume Toolbar */}
        <AudioControls
          isPlaying={isPlaying}
          currentTimeSec={currentTimeSec}
          durationSec={maxDuration}
          onPlayPause={handlePlayPause}
          onStop={stopPlayback}
          onSeek={handleSeek}
          volume={volume}
          onVolumeChange={setVolume}
        />

        {/* Grid: Metrics Panel & Mic Deck */}
        <div className="grid-two-cols">
          <MetricsPanel vocalRefTrack={vocalRefTrack} liveMicFrame={liveMicFrame} />

          <MicControlDeck
            devices={devices}
            selectedDevice={selectedDevice}
            onSelectDevice={setSelectedDevice}
            onRescanDevices={handleScanDevices}
            isRecording={isRecording}
            onStartMic={handleStartMic}
            onStopMic={handleStopMic}
            recStatus={recStatus}
            liveMicFrame={liveMicFrame}
          />
        </div>

        {/* System Status Console */}
        <div className="status-bar">
          <AlertCircle size={16} color="#00f2fe" style={{ flexShrink: 0 }} />
          <span>{statusMsg}</span>
        </div>
      </main>

      <footer className="app-footer">
        VocalAlign Karaoke Practice Engine • Phase 1-4 Active • YIN Pitch Detection & Live Note Matching
      </footer>
    </div>
  );
}
