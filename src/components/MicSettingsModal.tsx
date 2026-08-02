import React from 'react';
import { X, Mic, RefreshCw, Volume2, CheckCircle2 } from 'lucide-react';
import { AudioDevice, RecordingStatus } from '../types/audio';

interface MicSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: AudioDevice[];
  selectedDevice: string;
  onSelectDevice: (devName: string) => void;
  onRescanDevices: () => void;
  isRecording: boolean;
  onStartMic: () => void;
  onStopMic: () => void;
  recStatus: RecordingStatus | null;
}

export const MicSettingsModal: React.FC<MicSettingsModalProps> = ({
  isOpen,
  onClose,
  devices,
  selectedDevice,
  onSelectDevice,
  onRescanDevices,
  isRecording,
  onStartMic,
  onStopMic,
  recStatus,
}) => {
  if (!isOpen) return null;

  const currentDb = recStatus?.current_peak_db || -100;
  const normalizedVol = Math.max(0, Math.min(100, (currentDb + 80) * 1.25));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card notion-style" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Mic size={18} color="#00f2fe" />
            <h3>ตั้งค่าอุปกรณ์ไมโครโฟน (Microphone Input)</h3>
          </div>
          <button className="btn-close-modal" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="setting-field">
            <label className="field-label">เลือกไมโครโฟนสำหรับร้องเพลง:</label>
            <div className="field-row">
              <select
                className="select-input-clean"
                value={selectedDevice}
                onChange={(e) => onSelectDevice(e.target.value)}
              >
                {devices.map((dev) => (
                  <option key={dev.id || dev.name} value={dev.name}>
                    {dev.name} {dev.is_default ? '(Default)' : ''}
                  </option>
                ))}
              </select>

              <button className="btn-icon-secondary" onClick={onRescanDevices} title="ค้นหาไมโครโฟนใหม่">
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {/* Volume DB Meter */}
          <div className="mic-volume-meter-card">
            <div className="meter-info">
              <Volume2 size={15} color="#9ca3af" />
              <span>ระดับเสียงไมโครโฟน Real-time:</span>
              <strong className="db-value">{currentDb > -90 ? `${currentDb.toFixed(1)} dB` : '---'}</strong>
            </div>
            <div className="volume-track-clean">
              <div
                className="volume-fill-clean"
                style={{ width: `${isRecording ? normalizedVol : 0}%` }}
              />
            </div>
          </div>

          <div className="modal-action-row">
            {!isRecording ? (
              <button className="btn-primary-clean" onClick={onStartMic}>
                <CheckCircle2 size={16} />
                <span>เปิดใช้งานไมโครโฟน</span>
              </button>
            ) : (
              <button className="btn-secondary-danger" onClick={onStopMic}>
                <span>ปิดไมโครโฟน</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
