import React, { useState, useEffect, useRef } from 'react';
import { Edit3, Check, Sparkles, RefreshCw, Type, FileText } from 'lucide-react';
import { LyricLine, parseLyricsText } from '../utils/audioAnalysis';

interface LyricsPanelProps {
  currentTimeSec: number;
  durationSec: number;
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
  onLyricsChange,
  onSyncClick,
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [rawLyricsText, setRawLyricsText] = useState<string>(DEFAULT_LYRICS);
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
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
      if (currentTimeSec >= lyricLines[i].timeSec) {
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

  return (
    <div className="w-full h-full bg-zinc-900/90 border border-zinc-800/90 rounded-xl flex flex-col overflow-hidden shadow-xl">
      {/* Top Header Bar */}
      <div className="px-4 py-3 bg-zinc-950/80 border-b border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-cyan-400" />
          <h2 className="text-base font-bold text-white tracking-wide">Lyrics</h2>
        </div>

        <button
          onClick={() => setIsEditing(!isEditing)}
          className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer border border-zinc-700/50"
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
      <div className="flex-1 p-3 flex flex-col min-h-0 relative overflow-hidden bg-zinc-950/40">
        {isEditing ? (
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs text-purple-300/80 bg-purple-950/30 px-3 py-1.5 rounded-md border border-purple-800/30">
              <Sparkles size={13} className="text-purple-400 shrink-0" />
              <span>พิมพ์หรือวางเนื้อเพลงตรงนี้ (รองรับแท็กเวลา [00:15.00] หรือข้อความเปล่า)</span>
            </div>
            <textarea
              className="flex-1 w-full bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500/80 resize-none font-mono leading-relaxed"
              value={rawLyricsText}
              onChange={(e) => setRawLyricsText(e.target.value)}
              placeholder="วางเนื้อเพลง..."
            />
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleLoadSample}
                className="text-xs text-zinc-400 hover:text-cyan-400 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={12} />
                <span>โหลดตัวอย่าง</span>
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white cursor-pointer shadow"
              >
                บันทึกเนื้อเพลง
              </button>
            </div>
          </div>
        ) : (
          /* Live Karaoke Lyrics View Mode */
          <div ref={containerRef} className="flex-1 overflow-y-auto px-2 py-4 flex flex-col gap-4 scroll-smooth">
            {lyricLines.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-2">
                <Type size={32} />
                <p className="text-xs">ยังไม่มีเนื้อเพลง สั่งแก้ไขกด Edit</p>
              </div>
            ) : (
              lyricLines.map((line, idx) => {
                const isActive = idx === activeIndex;
                const isPast = idx < activeIndex;

                return (
                  <div
                    key={line.id || idx}
                    ref={isActive ? activeLineRef : null}
                    className={`transition-all duration-300 text-center py-2 px-3 rounded-lg ${
                      isActive
                        ? 'text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-pink-400 to-rose-300 scale-105 shadow-sm drop-shadow-[0_0_10px_rgba(244,63,94,0.4)] bg-rose-950/20'
                        : isPast
                        ? 'text-sm font-medium text-zinc-500 opacity-60'
                        : 'text-base font-medium text-zinc-300 opacity-90'
                    }`}
                  >
                    <span>{line.text}</span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Prominent Bottom Action Button: SYNC */}
      <div className="p-3 bg-zinc-950 border-t border-zinc-800/80">
        <button
          onClick={onSyncClick}
          className="w-full py-3 rounded-lg font-extrabold tracking-wider text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-400 hover:via-teal-400 hover:to-indigo-500 active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 cursor-pointer text-sm"
        >
          <Sparkles size={16} />
          <span>SYNC</span>
        </button>
      </div>
    </div>
  );
};
