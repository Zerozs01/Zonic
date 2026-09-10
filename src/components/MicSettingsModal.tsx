import React, { useState, useEffect } from 'react';
import {
  X,
  Mic,
  RefreshCw,
  Volume2,
  CheckCircle2,
  Sliders,
  Cpu,
  Zap,
  Activity,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import { AudioDevice, RecordingStatus } from '../types/audio';
import { setMicProcessingNative } from '../services/tauriBridge';

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
  const [highPassEnabled, setHighPassEnabled] = useState<boolean>(true);
  const [gainDb, setGainDb] = useState<number>(6.0);

  useEffect(() => {
    if (recStatus) {
      if (recStatus.high_pass_enabled !== undefined) {
        setHighPassEnabled(recStatus.high_pass_enabled);
      }
      if (recStatus.gain_db !== undefined) {
        setGainDb(recStatus.gain_db);
      }
    }
  }, [recStatus?.high_pass_enabled, recStatus?.gain_db]);

  const handleToggleHighPass = async (enabled: boolean) => {
    setHighPassEnabled(enabled);
    await setMicProcessingNative(enabled, gainDb);
  };

  const handleGainChange = async (val: number) => {
    setGainDb(val);
    await setMicProcessingNative(highPassEnabled, val);
  };

  const applyPreset = async (presetGain: number) => {
    setGainDb(presetGain);
    setHighPassEnabled(true);
    await setMicProcessingNative(true, presetGain);
  };

  if (!isOpen) return null;

  const activeDevice =
    devices.find((d) => d.name === selectedDevice) ||
    devices.find((d) => d.is_default) ||
    devices[0];

  const currentDb = recStatus?.current_peak_db ?? -100.0;
  // Normalized 0 to 100% across -60 dBFS to 0 dBFS
  const normalizedMeter = Math.max(0, Math.min(100, ((currentDb + 60.0) / 60.0) * 100));

  const sampleRate = recStatus?.sample_rate || activeDevice?.sample_rate || 48000;
  const bufferSize = recStatus?.buffer_size || activeDevice?.preferred_buffer_size || 256;
  const latencyMs = recStatus?.latency_ms || activeDevice?.estimated_latency_ms || 5.3;
  const hostName = recStatus?.host_name || activeDevice?.host_name || 'WASAPI';

  const getMeterColor = (db: number) => {
    if (db >= -3.0) return 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.8)]';
    if (db >= -12.0) return 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]';
    if (db >= -24.0) return 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]';
    return 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]';
  };

  const getVocalRangeStatus = (db: number) => {
    if (db < -50.0) return { label: 'Silent / Noise Floor', color: 'text-zinc-500' };
    if (db < -24.0) return { label: 'Low Vocal Signal (แนะนำเพิ่ม Gain)', color: 'text-amber-400' };
    if (db <= -10.0) return { label: '🟢 Optimal Vocal Sweet Spot (-18 ถึง -12 dBFS)', color: 'text-emerald-300 font-semibold' };
    if (db <= -2.0) return { label: '🟡 High Signal (ใกล้แตะขีดจำกัด)', color: 'text-amber-300' };
    return { label: '🔴 Peak / Digital Clipping Warning!', color: 'text-rose-400 font-bold' };
  };

  const vocalRange = getVocalRangeStatus(currentDb);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div
        className="w-full max-w-xl bg-[#18181d] border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 35px rgba(6, 182, 212, 0.15)',
        }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#1e1e24]/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-600/30 to-purple-600/30 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
              <Mic size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                ตั้งค่าไมโครโฟนสตูดิโอ (Audio Input Pipeline)
              </h3>
              <p className="text-xs text-zinc-400">
                WASAPI Low-Latency Engine • Optimized for Dynamic USB/XLR Mics
              </p>
            </div>
          </div>
          <button
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Device Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center justify-between">
              <span>เลือกอุปกรณ์ไมโครโฟน:</span>
              <span className="text-[11px] text-cyan-400 lowercase font-mono">
                {devices.length} devices detected
              </span>
            </label>
            <div className="flex items-center gap-2">
              <select
                className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-cyan-500 transition-all cursor-pointer font-medium"
                value={selectedDevice}
                onChange={(e) => onSelectDevice(e.target.value)}
              >
                {devices.map((dev) => (
                  <option key={dev.id || dev.name} value={dev.name}>
                    {dev.name} {dev.is_default ? '(Default System Mic)' : ''}
                  </option>
                ))}
              </select>

              <button
                className="p-2.5 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer shadow-sm shrink-0"
                onClick={onRescanDevices}
                title="ค้นหาไมโครโฟนใหม่ (Rescan Devices)"
              >
                <RefreshCw size={18} />
              </button>
            </div>
          </div>

          {/* Studio Hardware Specs Card */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 border border-zinc-800 shadow-inner space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-zinc-800/60">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Cpu size={14} className="text-cyan-400" />
                <span>Studio Hardware Pipeline Specs</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Zap size={10} className="text-emerald-400" />
                {hostName} Low-Latency
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80">
                <p className="text-[10px] text-zinc-500 uppercase font-semibold">Sample Rate</p>
                <p className="text-sm font-bold text-cyan-300 font-mono mt-0.5">
                  {sampleRate.toLocaleString()} Hz
                </p>
                <span className="text-[9px] text-zinc-400">Broadcast Native</span>
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80">
                <p className="text-[10px] text-zinc-500 uppercase font-semibold">Buffer Size</p>
                <p className="text-sm font-bold text-purple-300 font-mono mt-0.5">
                  {bufferSize} Samples
                </p>
                <span className="text-[9px] text-zinc-400">WASAPI Fixed</span>
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80">
                <p className="text-[10px] text-zinc-500 uppercase font-semibold">Input Latency</p>
                <p className="text-sm font-bold text-emerald-300 font-mono mt-0.5">
                  ~{latencyMs} ms
                </p>
                <span className="text-[9px] text-zinc-400">Ultra-Low</span>
              </div>
            </div>
          </div>

          {/* DSP Signal Pre-processing Controls */}
          <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/90 space-y-4">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Sliders size={14} className="text-purple-400" />
                <span>Dynamic Mic Signal Pre-Processing</span>
              </span>
              <span className="text-[10px] text-purple-300 font-medium bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
                DSP Active
              </span>
            </div>

            {/* 80 Hz Low-Cut Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
              <div className="space-y-0.5 max-w-[75%]">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className={highPassEnabled ? "text-emerald-400" : "text-zinc-500"} />
                  <span className="text-xs font-bold text-zinc-200">
                    80 Hz High-Pass Filter (Low-Cut)
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-tight">
                  กรองเสียงฮัมไฟ 50/60Hz, เสียงกระแทกลม (Plosives), และเสียงโต๊ะสั่น (Rumble) ป้องกัน YIN Pitch ผิดเพี้ยน
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleHighPass(!highPassEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  highPassEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    highPassEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Gain Staging */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Radio size={13} className="text-cyan-400" />
                  <span>Dynamic Mic Gain Stage:</span>
                </span>
                <span className="font-mono font-bold text-cyan-300 text-sm">
                  {gainDb >= 0 ? `+${gainDb.toFixed(1)}` : gainDb.toFixed(1)} dB
                </span>
              </div>

              <input
                type="range"
                min="-6"
                max="24"
                step="0.5"
                value={gainDb}
                onChange={(e) => handleGainChange(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-zinc-500">Preset ด่วน:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => applyPreset(12.0)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-purple-950/60 hover:bg-purple-900 border border-purple-500/40 text-purple-200 transition-colors cursor-pointer"
                  >
                    FIFINE K688 (+12 dB)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(6.0)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                  >
                    Standard (+6 dB)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(0.0)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 transition-colors cursor-pointer"
                  >
                    Unity (0 dB)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time VU Meter */}
          <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <Volume2 size={15} className="text-cyan-400" />
                <span>ระดับเสียงไมโครโฟน Real-time (VU Meter):</span>
              </span>
              <strong className="font-mono text-sm text-white">
                {currentDb > -80 ? `${currentDb.toFixed(1)} dBFS` : '---'}
              </strong>
            </div>

            {/* Meter Bar with Optimal Range Highlights */}
            <div className="relative w-full bg-zinc-950 h-4 rounded-full overflow-hidden border border-zinc-800 p-0.5">
              {/* Sweet spot marker (-18 to -12 dBFS on 60dB scale is 70% to 80%) */}
              <div
                className="absolute top-0 bottom-0 border-x border-emerald-500/40 bg-emerald-500/10 pointer-events-none"
                style={{ left: '70%', width: '10%' }}
                title="Optimal Sweet Spot Range (-18 to -12 dBFS)"
              />

              <div
                className={`h-full rounded-full transition-all duration-75 ${getMeterColor(currentDb)}`}
                style={{ width: `${isRecording ? normalizedMeter : 0}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
              <span>-60 dBFS</span>
              <span className="text-emerald-400 font-semibold">-18 dB</span>
              <span className="text-emerald-400 font-semibold">-12 dB</span>
              <span className="text-rose-400">0 dB (Clip)</span>
            </div>

            <p className={`text-xs ${vocalRange.color} text-center pt-1`}>
              {vocalRange.label}
            </p>
          </div>

          {/* Modal Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            {!isRecording ? (
              <button
                type="button"
                onClick={onStartMic}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-cyan-500 via-teal-500 to-indigo-600 hover:from-cyan-400 hover:via-teal-400 hover:to-indigo-500 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <CheckCircle2 size={18} />
                <span>เปิดใช้งานไมโครโฟน (Start WASAPI Stream)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onStopMic}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-white bg-rose-600 hover:bg-rose-500 transition-all shadow-[0_0_20px_rgba(244,63,94,0.3)] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <Activity size={18} className="animate-pulse" />
                <span>ปิดไมโครโฟน (Stop Stream)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
