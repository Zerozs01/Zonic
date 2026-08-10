import React from 'react';
import { ArrowLeft, MoreVertical, Music, Mic, Zap, Music2 } from 'lucide-react';
import { PitchFrame } from '../types/audio';
import { hzToNote } from '../utils/webAudioPitch';

interface KaraokeHUDProps {
  targetPitchFrame: PitchFrame | null;
  liveMicFrame: PitchFrame | null;
  isRecording: boolean;
  overallScore: number;
  transposeKey?: number;
  currentTimeSec?: number;
  durationSec?: number;
}

const GRADES = ['C', 'B', 'A', 'S', 'SS', 'SSS'];

export const KaraokeHUD: React.FC<KaraokeHUDProps> = React.memo(({
  targetPitchFrame,
  liveMicFrame,
  isRecording,
  overallScore,
  transposeKey = 0,
  currentTimeSec = 0,
  durationSec = 0,
}) => {
  const formatTime = (sec: number) => {
    if (isNaN(sec) || sec <= 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getGradeInfo = (score: number) => {
    if (score >= 95) return { activeIndex: 5, grade: 'SSS', color: 'from-amber-300 to-yellow-500 text-zinc-950 shadow-yellow-500/50' };
    if (score >= 88) return { activeIndex: 4, grade: 'SS', color: 'from-yellow-400 to-amber-500 text-zinc-950 shadow-yellow-500/40' };
    if (score >= 78) return { activeIndex: 3, grade: 'S', color: 'from-purple-400 to-indigo-500 text-white shadow-purple-500/40' };
    if (score >= 68) return { activeIndex: 2, grade: 'A', color: 'from-cyan-400 to-blue-500 text-white shadow-cyan-500/40' };
    if (score >= 55) return { activeIndex: 1, grade: 'B', color: 'from-emerald-400 to-teal-500 text-white shadow-emerald-500/30' };
    return { activeIndex: 0, grade: 'C', color: 'from-zinc-500 to-zinc-700 text-zinc-200 shadow-zinc-700/30' };
  };

  const gradeInfo = getGradeInfo(overallScore);

  const getPitchComparison = () => {
    if (!targetPitchFrame || !targetPitchFrame.is_voiced || targetPitchFrame.frequency_hz <= 0) {
      return {
        targetNote: '---',
        userNote: liveMicFrame?.is_voiced ? liveMicFrame.note_name : '---',
        statusText: 'พร้อมเริ่มร้องคาราโอเกะ',
        hitText: '',
        colorClass: 'bg-zinc-900/80 border-zinc-700/60 text-zinc-400',
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
        userNote: '---',
        statusText: isRecording ? 'ร้องใส่ไมค์ได้เลย...' : 'กดเล่นเพลงเพื่อเริ่มซ้อม',
        hitText: '',
        colorClass: 'bg-zinc-900/80 border-zinc-700/60 text-zinc-400',
      };
    }

    const userHz = liveMicFrame.frequency_hz;
    const userNote = liveMicFrame.note_name;

    const centsOffset = Math.round(1200 * Math.log2(userHz / targetHz));
    const absOffset = Math.abs(centsOffset);

    if (absOffset <= 20) {
      return {
        targetNote,
        userNote,
        statusText: 'PERFECT',
        hitText: 'PERFECT',
        colorClass: 'bg-emerald-500/20 border-emerald-500/80 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.4)]',
      };
    } else if (absOffset <= 45) {
      return {
        targetNote,
        userNote,
        statusText: 'GREAT',
        hitText: 'GREAT',
        colorClass: 'bg-amber-500/20 border-amber-500/80 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.4)]',
      };
    } else {
      return {
        targetNote,
        userNote,
        statusText: 'MISS',
        hitText: 'MISS',
        colorClass: 'bg-rose-500/20 border-rose-500/80 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.4)]',
      };
    }
  };

  const comp = getPitchComparison();

  return (
    <div className="w-full flex flex-col gap-1.5 select-none pointer-events-auto">
      {/* 1. WeSing Top Navigation & Score Progress Pill (Matching Image 2) */}
      <div className="w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-zinc-950/75 backdrop-blur-md rounded-2xl border border-zinc-800/80 shadow-xl">
        
        {/* Left: Back Button */}
        <button
          className="p-1.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
          title="Back"
        >
          <ArrowLeft size={18} />
        </button>

        {/* Center: Score Track Header with Grade Milestones C B A S SS SSS */}
        <div className="flex-1 max-w-md mx-auto flex items-center bg-zinc-900/90 border border-zinc-800 rounded-full px-3 py-1 gap-2 shadow-inner">
          
          {/* Golden Note Icon & Score Counter (e.g. 222 or 0850) */}
          <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-yellow-500 text-zinc-950 font-black text-xs px-3 py-1 rounded-full shadow-md shrink-0 min-w-[72px] justify-center">
            <Music size={12} className="fill-zinc-950 shrink-0" />
            <span className="font-mono font-black text-xs leading-none whitespace-nowrap">
              {Math.round(overallScore * 8.5)}
            </span>
          </div>

          {/* Grade Track Milestones */}
          <div className="flex-1 flex items-center justify-between px-2 gap-1 text-[11px] font-bold">
            {GRADES.map((g, idx) => {
              const isPassed = idx <= gradeInfo.activeIndex;
              const isCurrent = idx === gradeInfo.activeIndex;
              return (
                <span
                  key={g}
                  className={`transition-all duration-300 ${
                    isCurrent
                      ? 'text-amber-400 font-extrabold scale-110 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                      : isPassed
                      ? 'text-zinc-200 opacity-90'
                      : 'text-zinc-600'
                  }`}
                >
                  {g}
                </span>
              );
            })}
          </div>
        </div>

        {/* Right: Menu Options */}
        <button
          className="p-1.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
          title="Options"
        >
          <MoreVertical size={18} />
        </button>
      </div>

      {/* 2. Sub Status Bar: Recording Time (Left), Pitch Notes/Hit Badge (Center), Song Duration (Right) */}
      <div className="w-full flex items-center justify-between px-4 text-xs">
        
        {/* Top-Left: Recording status & timestamp tag e.g. "บันทึก 00:59" */}
        <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-sm rounded-full px-3 py-0.5 text-zinc-300">
          <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-ping' : 'bg-zinc-500'}`} />
          <span className="font-medium text-[11px]">
            {isRecording ? 'บันทึก' : 'พร้อม'} {formatTime(currentTimeSec)}
          </span>
        </div>

        {/* Center: Target Note vs User Pitch & Hit Pill */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-sm px-2.5 py-0.5 rounded-full">
            <Music2 size={12} className="text-purple-400" />
            <span className="text-[11px] text-zinc-400">เป้าหมาย:</span>
            <strong className="text-[11px] font-bold text-purple-300 font-mono">{comp.targetNote}</strong>
          </div>

          {comp.hitText && (
            <div className={`px-3 py-0.5 rounded-full border text-[11px] font-black tracking-wider flex items-center gap-1 ${comp.colorClass}`}>
              <Zap size={11} className="animate-pulse" />
              <span>{comp.hitText}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-sm px-2.5 py-0.5 rounded-full">
            <Mic size={12} className="text-cyan-400" />
            <span className="text-[11px] text-zinc-400">เสียงคุณ:</span>
            <strong className="text-[11px] font-bold text-cyan-300 font-mono">{comp.userNote}</strong>
          </div>
        </div>

        {/* Top-Right: Song Duration e.g. "04:26" */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-sm rounded-full px-3 py-0.5 text-[11px] font-mono font-semibold text-zinc-400">
          {formatTime(durationSec)}
        </div>
      </div>
    </div>
  );
});

