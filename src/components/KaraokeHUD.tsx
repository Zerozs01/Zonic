import React from 'react';
import { Mic, Music } from 'lucide-react';
import { PitchFrame } from '../types/audio';
import { hzToNote } from '../utils/webAudioPitch';

interface KaraokeHUDProps {
  targetPitchFrame: PitchFrame | null;
  liveMicFrame: PitchFrame | null;
  isRecording: boolean;
  overallScore: number;
  transposeKey?: number;
}

export const KaraokeHUD: React.FC<KaraokeHUDProps> = React.memo(({
  targetPitchFrame,
  liveMicFrame,
  isRecording,
  overallScore,
  transposeKey = 0,
}) => {
  const getPitchComparison = () => {
    if (!targetPitchFrame || !targetPitchFrame.is_voiced || targetPitchFrame.frequency_hz <= 0) {
      return {
        targetNote: '---',
        targetHz: 0,
        userNote: liveMicFrame?.is_voiced ? liveMicFrame.note_name : '---',
        userHz: liveMicFrame?.is_voiced ? liveMicFrame.frequency_hz : 0,
        centsOffset: 0,
        statusText: 'พร้อมเริ่มร้องคาราโอเกะ',
        colorClass: 'grey',
      };
    }

    const originalTargetHz = targetPitchFrame.frequency_hz;
    const targetHz = transposeKey !== 0
      ? originalTargetHz * Math.pow(2, transposeKey / 12)
      : originalTargetHz;

    const targetNote = transposeKey !== 0
      ? (hzToNote(targetHz).noteName || targetPitchFrame.note_name)
      : targetPitchFrame.note_name;

    if (!liveMicFrame || !liveMicFrame.is_voiced || liveMicFrame.frequency_hz <= 0) {
      return {
        targetNote,
        targetHz,
        userNote: '---',
        userHz: 0,
        centsOffset: 0,
        statusText: isRecording ? 'ร้องใส่ไมค์ได้เลย...' : 'กดเล่นเพลงเพื่อเริ่มซ้อม',
        colorClass: 'grey',
      };
    }

    const userHz = liveMicFrame.frequency_hz;
    const userNote = liveMicFrame.note_name;

    const centsOffset = Math.round(1200 * Math.log2(userHz / targetHz));
    const absOffset = Math.abs(centsOffset);

    if (absOffset <= 20) {
      return {
        targetNote,
        targetHz,
        userNote,
        userHz,
        centsOffset,
        statusText: '🟢 PERFECT! เสียงตรงคีย์เป๊ะ',
        colorClass: 'green',
      };
    } else if (absOffset <= 45) {
      return {
        targetNote,
        targetHz,
        userNote,
        userHz,
        centsOffset,
        statusText: centsOffset > 0 ? '🟠 สูงไปนิด (Slightly Sharp)' : '🟠 ต่ำไปนิด (Slightly Flat)',
        colorClass: 'orange',
      };
    } else {
      return {
        targetNote,
        targetHz,
        userNote,
        userHz,
        centsOffset,
        statusText: centsOffset > 0 ? '🔴 หลุดคีย์สูง' : '🔴 หลุดคีย์ต่ำ',
        colorClass: 'red',
      };
    }
  };

  const comp = getPitchComparison();

  return (
    <div className="hud-bar-minimal">
      {/* Target Note Badge */}
      <div className="hud-pill-clean purple">
        <Music size={14} color="#a855f7" />
        <span className="pill-lbl">โน๊ตต้นฉบับ:</span>
        <strong className="pill-val purple">{comp.targetNote}</strong>
      </div>

      {/* Live Status Pill */}
      <div className={`hud-status-pill ${comp.colorClass}`}>
        {comp.statusText}
      </div>

      {/* User Note Badge */}
      <div className={`hud-pill-clean ${comp.colorClass}`}>
        <Mic size={14} />
        <span className="pill-lbl">เสียงคุณ:</span>
        <strong className={`pill-val ${comp.colorClass}`}>{comp.userNote}</strong>
      </div>

      {/* Real-time score indicator */}
      <div className="hud-score-minimal">
        <span>SCORE:</span>
        <strong>{overallScore}%</strong>
      </div>
    </div>
  );
});
