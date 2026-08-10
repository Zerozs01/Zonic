import React from 'react';
import { Mic, Music, Award, Zap } from 'lucide-react';
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
  const getGradeBadge = (score: number) => {
    if (score >= 96) return { grade: 'SSS', color: 'from-amber-300 via-yellow-400 to-amber-500 text-zinc-950 border-amber-300 shadow-amber-500/50' };
    if (score >= 90) return { grade: 'SS', color: 'from-yellow-400 to-amber-600 text-zinc-950 border-yellow-400 shadow-yellow-500/40' };
    if (score >= 80) return { grade: 'S', color: 'from-purple-400 to-indigo-600 text-white border-purple-400 shadow-purple-500/40' };
    if (score >= 70) return { grade: 'A', color: 'from-cyan-400 to-blue-600 text-white border-cyan-400 shadow-cyan-500/40' };
    if (score >= 60) return { grade: 'B', color: 'from-emerald-400 to-teal-600 text-white border-emerald-400 shadow-emerald-500/30' };
    return { grade: 'C', color: 'from-zinc-500 to-zinc-700 text-zinc-200 border-zinc-500 shadow-zinc-700/30' };
  };

  const getPitchComparison = () => {
    if (!targetPitchFrame || !targetPitchFrame.is_voiced || targetPitchFrame.frequency_hz <= 0) {
      return {
        targetNote: '---',
        targetHz: 0,
        userNote: liveMicFrame?.is_voiced ? liveMicFrame.note_name : '---',
        userHz: liveMicFrame?.is_voiced ? liveMicFrame.frequency_hz : 0,
        centsOffset: 0,
        statusText: 'พร้อมเริ่มร้องคาราโอเกะ',
        colorClass: 'bg-zinc-800/80 border-zinc-700 text-zinc-300',
        hitText: '',
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
        colorClass: 'bg-zinc-800/80 border-zinc-700 text-zinc-400',
        hitText: '',
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
        statusText: 'PERFECT! เสียงตรงคีย์เป๊ะ',
        colorClass: 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.4)]',
        hitText: 'PERFECT',
      };
    } else if (absOffset <= 45) {
      return {
        targetNote,
        targetHz,
        userNote,
        userHz,
        centsOffset,
        statusText: centsOffset > 0 ? 'GREAT! สูงไปนิด' : 'GREAT! ต่ำไปนิด',
        colorClass: 'bg-amber-950/80 border-amber-500/80 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.4)]',
        hitText: 'GREAT',
      };
    } else {
      return {
        targetNote,
        targetHz,
        userNote,
        userHz,
        centsOffset,
        statusText: centsOffset > 0 ? 'MISS! หลุดคีย์สูง' : 'MISS! หลุดคีย์ต่ำ',
        colorClass: 'bg-rose-950/80 border-rose-500/80 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.4)]',
        hitText: 'MISS',
      };
    }
  };

  const comp = getPitchComparison();
  const badgeInfo = getGradeBadge(overallScore);

  return (
    <div className="w-full flex items-center justify-between gap-3 p-2 bg-zinc-950/60 backdrop-blur-md rounded-xl border border-zinc-800/80 shadow-lg select-none">
      {/* Target Note Badge */}
      <div className="flex items-center gap-2 bg-purple-950/60 border border-purple-500/40 rounded-lg px-3 py-1.5">
        <Music size={14} className="text-purple-400" />
        <span className="text-xs text-purple-300 font-medium">โน้ตต้นฉบับ:</span>
        <strong className="text-sm font-bold text-white font-mono">{comp.targetNote}</strong>
      </div>

      {/* Center Live Hit Feedback Status Pill */}
      <div className={`px-4 py-1.5 rounded-full border text-xs font-extrabold tracking-wider transition-all duration-150 flex items-center gap-1.5 ${comp.colorClass}`}>
        {comp.hitText && <Zap size={14} className="animate-bounce" />}
        <span>{comp.statusText}</span>
      </div>

      {/* User Note Badge & Dynamic Score Grade */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-cyan-950/60 border border-cyan-500/40 rounded-lg px-3 py-1.5">
          <Mic size={14} className="text-cyan-400" />
          <span className="text-xs text-cyan-300 font-medium">เสียงคุณ:</span>
          <strong className="text-sm font-bold text-white font-mono">{comp.userNote}</strong>
        </div>

        {/* Dynamic Grade Badge Badge (C to SSS) */}
        <div className={`flex items-center gap-1 px-3 py-1 rounded-lg border font-black text-sm shadow-lg bg-gradient-to-r ${badgeInfo.color}`}>
          <Award size={15} />
          <span>{badgeInfo.grade}</span>
          <span className="text-xs font-mono font-bold ml-1">({overallScore}%)</span>
        </div>
      </div>
    </div>
  );
});
