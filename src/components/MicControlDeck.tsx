import React from 'react';
import { Mic, Play, Square, RefreshCw, Activity, Volume2 } from 'lucide-react';
import { AudioDevice, PitchFrame, RecordingStatus } from '../types/audio';

interface MicControlDeckProps {
  devices: AudioDevice[];
  selectedDevice: string;
  onSelectDevice: (deviceName: string) => void;
  onRescanDevices: () => void;
  isRecording: boolean;
  onStartMic: () => void;
  onStopMic: () => void;
  recStatus: RecordingStatus | null;
  liveMicFrame: PitchFrame | null;
}

export const MicControlDeck: React.FC<MicControlDeckProps> = React.memo(({
  devices,
  selectedDevice,
  onSelectDevice,
  onRescanDevices,
  isRecording,
  onStartMic,
  onStopMic,
  recStatus,
  liveMicFrame,
}) => {
  return (
    <div className="glass-card mic-deck-card">
      <div className="card-header">
        <Mic color="#00f2fe" size={20} />
        <h3 className="card-title">Live Hardware Input Stream (CPAL Audio)</h3>
      </div>

      <div className="mic-deck-content">
        {/* Input Selector */}
        <div className="input-group">
          <label className="input-label">Audio Input Device:</label>
          <div className="row-gap">
            <select
              className="select-input"
              value={selectedDevice}
              onChange={(e) => onSelectDevice(e.target.value)}
            >
              {devices.length === 0 ? (
                <option value="">No audio input found</option>
              ) : (
                devices.map((d) => (
                  <option key={d.id || d.name} value={d.name}>
                    {d.name} {d.is_default ? '(Default)' : ''} ({d.sample_rate}Hz)
                  </option>
                ))
              )}
            </select>
            <button className="btn-secondary" onClick={onRescanDevices} title="Rescan Devices">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Start / Stop Toggle */}
        <div className="mic-action-row">
          {!isRecording ? (
            <button className="btn-primary-glow" onClick={onStartMic}>
              <Play size={18} style={{ marginRight: 8 }} /> Start Live Vocal Capture
            </button>
          ) : (
            <button className="btn-danger-glow" onClick={onStopMic}>
              <Square size={18} style={{ marginRight: 8 }} /> Stop Live Stream
            </button>
          )}
        </div>

        {/* Audio Meter & Real-time Pitch Readout */}
        {isRecording && recStatus && (
          <div className="live-meter-box">
            <div className="meter-header">
              <span><Volume2 size={14} style={{ display: 'inline', marginRight: 4 }} /> Input dB: {recStatus.current_peak_db.toFixed(1)} dB</span>
              <span>Samples: {recStatus.total_samples_captured.toLocaleString()}</span>
            </div>
            <div className="meter-track">
              <div
                className="meter-fill"
                style={{
                  width: `${Math.max(0, Math.min(100, (recStatus.current_peak_db + 60) * 1.66))}%`,
                }}
              />
            </div>

            {liveMicFrame && liveMicFrame.is_voiced && (
              <div className="live-pitch-badge">
                <Activity size={16} color="#00f2fe" className="pulse-icon" />
                <span>Live Pitch: </span>
                <strong className="pitch-note">{liveMicFrame.note_name}</strong>
                <span className="pitch-hz">({liveMicFrame.frequency_hz.toFixed(1)} Hz)</span>
                <span className={`cents-badge ${Math.abs(liveMicFrame.cents_offset) <= 15 ? 'good' : 'off'}`}>
                  {liveMicFrame.cents_offset > 0 ? `+${liveMicFrame.cents_offset}` : liveMicFrame.cents_offset} cents
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

