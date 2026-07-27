import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { Header } from './components/Header';
import { DropZone } from './components/DropZone';
import { PitchVisualizer } from './components/PitchVisualizer';
import { AudioControls } from './components/AudioControls';
import { MetricsPanel } from './components/MetricsPanel';
import { MicControlDeck } from './components/MicControlDeck';
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
  const [activeTab, setActiveTab] = useState<'dual' | 'live'>('dual');
  const [statusMsg, setStatusMsg] = useState<string>('VocalAlign Engine Ready.');

  // Audio Tracks
  const [vocalTrack, setVocalTrack] = useState<LoadedTrack | null>(null);
  const [referenceTrack, setReferenceTrack] = useState<LoadedTrack | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const playbackAnimRef = useRef<number | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const playbackStartOffsetRef = useRef<number>(0);

  // Audio Context for Web Audio Playback
  const audioCtxRef = useRef<AudioContext | null>(null);
  const vocalSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const refSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Microphone Hardware Input State
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recStatus, setRecStatus] = useState<RecordingStatus | null>(null);
  const [liveMicFrame, setLiveMicFrame] = useState<PitchFrame | null>(null);

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
      setStatusMsg(`Found ${devList.length} input device(s).`);
    } catch (err: any) {
      console.warn('Device scan warning:', err);
      setStatusMsg('Audio input scan ready (Web Audio Fallback)');
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

  // Handle Track Loaded (Drag & Drop or File Selector)
  const handleTrackLoaded = async (trackType: 'vocal' | 'reference', file: File) => {
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
        color: trackType === 'vocal' ? '#00f2fe' : '#a855f7',
      };

      if (trackType === 'vocal') {
        setVocalTrack(track);
      } else {
        setReferenceTrack(track);
      }

      setStatusMsg(
        `Successfully loaded '${file.name}' (${analysis.voiced_frames} pitch frames extracted)`
      );
    } catch (err: any) {
      console.error('File load error:', err);
      setStatusMsg(`Error loading audio file: ${err?.message || err?.toString()}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearTrack = (trackType: 'vocal' | 'reference') => {
    if (isPlaying) stopPlayback();
    if (trackType === 'vocal') setVocalTrack(null);
    else setReferenceTrack(null);
    setStatusMsg(`Cleared ${trackType} track.`);
  };

  // Playback Control
  const maxDuration = Math.max(
    vocalTrack?.meta?.duration_seconds || 0,
    referenceTrack?.meta?.duration_seconds || 0
  );

  const startPlayback = (startAtSec = currentTimeSec) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;

    // Stop existing sources
    if (vocalSourceRef.current) {
      vocalSourceRef.current.stop();
      vocalSourceRef.current.disconnect();
    }
    if (refSourceRef.current) {
      refSourceRef.current.stop();
      refSourceRef.current.disconnect();
    }

    if (startAtSec >= maxDuration) startAtSec = 0;

    // Play Vocal Buffer
    if (vocalTrack?.audioBuffer) {
      const vSource = ctx.createBufferSource();
      vSource.buffer = vocalTrack.audioBuffer;
      const gainNode = ctx.createGain();
      gainNode.gain.value = volume;
      vSource.connect(gainNode);
      gainNode.connect(ctx.destination);
      vSource.start(0, startAtSec);
      vocalSourceRef.current = vSource;
    }

    // Play Reference Buffer
    if (referenceTrack?.audioBuffer) {
      const rSource = ctx.createBufferSource();
      rSource.buffer = referenceTrack.audioBuffer;
      const gainNode = ctx.createGain();
      gainNode.gain.value = volume;
      rSource.connect(gainNode);
      gainNode.connect(ctx.destination);
      rSource.start(0, startAtSec);
      refSourceRef.current = rSource;
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
    if (vocalSourceRef.current) {
      try { vocalSourceRef.current.stop(); } catch (e) {}
      vocalSourceRef.current.disconnect();
      vocalSourceRef.current = null;
    }
    if (refSourceRef.current) {
      try { refSourceRef.current.stop(); } catch (e) {}
      refSourceRef.current.disconnect();
      refSourceRef.current = null;
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
      setStatusMsg('Starting low-latency microphone capture stream...');
      const status = await startMicStream(selectedDevice);
      setRecStatus(status);
      setIsRecording(true);
      setStatusMsg(`Recording active from: ${selectedDevice || 'Default Microphone'}`);
    } catch (err: any) {
      setStatusMsg(`Error starting mic: ${err?.message || err?.toString()}`);
    }
  };

  const handleStopMic = async () => {
    try {
      const status = await stopMicStream();
      setRecStatus(status);
      setIsRecording(false);
      setStatusMsg('Microphone capture stream stopped.');
    } catch (err: any) {
      setStatusMsg(`Error stopping mic: ${err?.message || err?.toString()}`);
    }
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Main Content Area */}
      <main style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Track Dropzones */}
        <DropZone
          vocalTrack={vocalTrack}
          referenceTrack={referenceTrack}
          onTrackLoaded={handleTrackLoaded}
          onClearTrack={handleClearTrack}
          isProcessing={isProcessing}
        />

        {/* Pitch Alignment Visualizer Canvas */}
        <PitchVisualizer
          vocalTrack={vocalTrack}
          referenceTrack={referenceTrack}
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
          <MetricsPanel vocalTrack={vocalTrack} referenceTrack={referenceTrack} />

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
        VocalAlign Engine • Phase 1-3 Active • Tauri Rust Audio & HTML5 Canvas Pitch Alignment
      </footer>
    </div>
  );
}
