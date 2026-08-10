import React, { useState, useEffect, useRef } from 'react';
import { Edit3, Check, Sparkles, RefreshCw, Type, FileText, Loader2 } from 'lucide-react';
import { LyricLine, parseLyricsText } from '../utils/audioAnalysis';
import { forceAlignLyricsNative } from '../services/tauriBridge';
import { LoadedTrack } from '../types/audio';

interface LyricsPanelProps {
  currentTimeSec: number;
  durationSec: number;
  vocalRefTrack?: LoadedTrack | null;
  onLyricsChange?: (lines: LyricLine[]) => void;
  onSyncClick?: () => void;
}

const DEFAULT_LYRICS = `[00:00.00] 🎵 VocalAlign Karaoke Studio
[00:05.00] ยินดีต้อนรับสู่ระบบซ้อมร้องเพลงคาราโอเกะ
[00:10.00] ร้องเสียงของคุณให้ตรงกับโน้ตและจังหวะทำนอง
[00:16.00] ปรับเปลี่ยนคีย์เพลง และจังหวะ BPM ได้ตามต้องการ
[00:22.00] จะคอยอยู่ข้างเคียงเธอ เปล่งประกายเสียงร้องไปพร้อมกัน!
[00:28.00] (วางเนื้อเพลงของคุณที่นี่เพื่อเริ่มซิงค์จังหวะร้อง)`;

export const LyricsPanel: React.FC<LyricsPanelProps> = ({
  currentTimeSec,
  durationSec,
  vocalRefTrack,
  onLyricsChange,
  onSyncClick,
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [rawLyricsText, setRawLyricsText] = useState<string>(DEFAULT_LYRICS);
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
  const [isAligning, setIsAligning] = useState<boolean>(false);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Parse lyrics when raw text or duration changes
  useEffect(() => {
    const lines = parseLyricsText(rawLyricsText, durationSec || 180);
    setLyricLines(lines);
    if (onLyricsChange) {
      onLyricsChange(lines);
    }
  }, [rawLyricsText, durationSec]);

  // Find active line index based on currentTimeSec
  const activeIndex = (() => {
    if (lyricLines.length === 0) return -1;
    for (let i = lyricLines.length - 1; i >= 0; i--) {
      const lineStart = lyricLines[i].startTime ?? lyricLines[i].timeSec ?? 0;
      if (currentTimeSec >= lineStart) {
        return i;
      }
    }
    return 0;
  })();

  // Smoothly scroll container to keep active line centered
  useEffect(() => {
    if (activeLineRef.current && containerRef.current && !isEditing) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex, isEditing]);

  const handleSave = () => {
    setIsEditing(false);
  };

  const handleLoadSample = () => {
    setRawLyricsText(DEFAULT_LYRICS);
  };

  const handleRunSync = async () => {
    setIsAligning(true);
    if (onSyncClick) onSyncClick();

    try {
      const vocalPath = vocalRefTrack?.filePath || 'sample_vocal.wav';
      const aligned = await forceAlignLyricsNative(vocalPath, rawLyricsText);
      if (aligned && aligned.length > 0) {
        const formattedLines: LyricLine[] = aligned.map((item: any) => ({
          id: item.id,
          startTime: item.startTime,
          endTime: item.endTime,
          timeSec: item.startTime,
          text: item.text,
          words: item.words,
        }));
        setLyricLines(formattedLines);
        if (onLyricsChange) onLyricsChange(formattedLines);
      }
    } catch (e) {
      console.warn('Forced alignment warning:', e);
    } finally {
      setTimeout(() => {
        setIsAligning(false);
      }, 800);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#19191e',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
      }}
      className="w-full h-full flex flex-col overflow-hidden"
    >
      {/* Top Header Bar */}
      <div
        style={{ padding: '14px 24px' }}
        className="bg-[#131315] border-b border-zinc-800/80 flex items-center justify-between"
      >
        <div className="flex items-center gap-2.5">
          <FileText size={18} className="text-zinc-300" />
          <h2 className="text-base font-bold text-white tracking-wide">Lyrics</h2>
        </div>

        <button
          onClick={() => setIsEditing(!isEditing)}
          style={{ padding: '6px 14px' }}
          className="rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors flex items-center gap-1.5 cursor-pointer border border-zinc-700/50"
        >
          {isEditing ? (
            <>
              <Check size={14} className="text-emerald-400" />
              <span>Done</span>
            </>
          ) : (
            <>
              <Edit3 size={14} className="text-zinc-400" />
              <span>Edit</span>
            </>
          )}
        </button>
      </div>

      {/* Main Body Viewport */}
      <div
        style={{ padding: '20px 24px' }}
        className="flex-1 flex flex-col min-h-0 relative overflow-hidden bg-[#161618]"
      >
        {isEditing ? (
          <div className="flex-1 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs text-purple-300/90 bg-purple-950/40 px-4 py-2.5 rounded-lg border border-purple-800/40">
              <Type size={14} className="shrink-0 text-purple-400" />
              <span>ใส่เนื้อเพลงบรรทัดละ 1 ประโยค (รองรับรูปแบบ LRC [00:12.34])</span>
            </div>
            <textarea
              value={rawLyricsText}
              onChange={(e) => setRawLyricsText(e.target.value)}
              placeholder="วางเนื้อเพลงที่นี่..."
              style={{ padding: '16px' }}
              className="flex-1 w-full bg-zinc-900/90 border border-zinc-800 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-cyan-500 font-mono resize-none leading-relaxed shadow-inner"
            />
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleLoadSample}
                className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 cursor-pointer bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors border border-zinc-700/40"
              >
                <RefreshCw size={13} />
                <span>โหลดตัวอย่าง</span>
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-colors cursor-pointer shadow-md"
              >
                บันทึกเนื้อเพลง
              </button>
            </div>
          </div>
        ) : (
          <div
            ref={containerRef}
            style={{ padding: '8px 12px' }}
            className="flex-1 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
          >
            {lyricLines.map((line, idx) => {
              const isActive = idx === activeIndex;
              return (
                <div
                  key={line.id || idx}
                  ref={isActive ? activeLineRef : null}
                  style={{ padding: '12px 20px', borderRadius: '12px' }}
                  className={`transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-900/60 via-cyan-900/50 to-transparent border-l-4 border-cyan-400 text-white font-bold scale-[1.02] shadow-lg shadow-cyan-950/50'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50 font-medium'
                  }`}
                >
                  <div className="text-base tracking-wide leading-relaxed">{line.text}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Prominent Bottom Action Button: SYNC */}
      <div style={{ padding: '16px 24px' }} className="bg-[#131315] border-t border-zinc-800/80">
        <button
          onClick={handleRunSync}
          disabled={isAligning}
          className={`w-full py-3 rounded-lg font-extrabold tracking-wider text-white transition-all shadow-[0_4px_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 cursor-pointer text-sm ${
            isAligning
              ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed border border-zinc-700/60'
              : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-400 hover:via-teal-400 hover:to-indigo-500 active:scale-[0.98]'
          }`}
        >
          {isAligning ? (
            <>
              <Loader2 size={16} className="animate-spin text-cyan-400" />
              <span>Aligning lyrics with vocal timeline...</span>
            </>
          ) : (
            <>
              <Sparkles size={16} />
              <span>SYNC</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
