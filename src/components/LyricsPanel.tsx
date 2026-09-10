import React, { useState, useEffect, useRef } from 'react';
import {
  Check,
  Sparkles,
  RefreshCw,
  Type,
  FileText,
  Loader2,
  SlidersHorizontal,
  Copy,
  AlertTriangle,
  Clock,
  Mic,
  MapPin,
  Play,
  Music,
  CheckCircle2,
} from 'lucide-react';
import { LyricLine, parseLyricsText } from '../utils/audioAnalysis';
import { LoadedTrack } from '../types/audio';
import { useLyricsSync } from '../hooks/useLyricsSync';

interface LyricsPanelProps {
  currentTimeSec: number;
  durationSec: number;
  vocalRefTrack?: LoadedTrack | null;
  onLyricsChange?: (lines: LyricLine[]) => void;
  onSeek?: (timeSec: number) => void;
  onSyncClick?: () => void;
}

const DEFAULT_LYRICS = `🎵 VocalAlign Karaoke Studio
ยินดีต้อนรับสู่ระบบซ้อมร้องเพลงคาราโอเกะ
ร้องเสียงของคุณให้ตรงกับโน้ตและจังหวะทำนอง
ปรับเปลี่ยนคีย์เพลง และจังหวะ BPM ได้ตามต้องการ
จะคอยอยู่ข้างเคียงเธอ เปล่งประกายเสียงร้องไปพร้อมกัน!
(วางเนื้อเพลงของคุณที่นี่เพื่อเริ่มซิงค์จังหวะร้อง)`;

export const LyricsPanel: React.FC<LyricsPanelProps> = React.memo(({
  currentTimeSec,
  durationSec,
  vocalRefTrack,
  onLyricsChange,
  onSeek,
  onSyncClick,
}) => {
  const [activeTab, setActiveTab] = useState<'stage' | 'timeline' | 'text'>('stage');
  const [copiedLrc, setCopiedLrc] = useState<boolean>(false);
  const [startOffsetSec, setStartOffsetSec] = useState<number>(0);

  const {
    mode,
    rawText,
    setRawText,
    lines,
    setLines,
    progress,
    error,
    triggerSync,
    adjustLineTime,
    shiftAllLines,
    setAllLinesStartTime,
    stampLineTime,
    exportToLrc,
  } = useLyricsSync({
    initialText: DEFAULT_LYRICS,
    onLyricsChange,
  });

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Initialize lines from default raw text if empty
  useEffect(() => {
    if (lines.length === 0 && rawText.trim()) {
      const parsed = parseLyricsText(rawText, durationSec || 180, startOffsetSec);
      if (parsed.length > 0) {
        const synced = parsed.map((p) => ({
          ...p,
          confidence: 1.0,
          isCustomEdited: false,
        }));
        setLines(synced);
      }
    }
  }, []);

  // Find active line index based on currentTimeSec
  const activeIndex = (() => {
    if (lines.length === 0) return -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineStart = lines[i].startTime ?? 0;
      if (currentTimeSec >= lineStart) {
        return i;
      }
    }
    return 0;
  })();

  // Smoothly scroll container to keep active line centered
  useEffect(() => {
    if (activeLineRef.current && containerRef.current && activeTab === 'stage') {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex, activeTab]);

  const handleLoadSample = () => {
    setRawText(DEFAULT_LYRICS);
    const parsed = parseLyricsText(DEFAULT_LYRICS, durationSec || 180, startOffsetSec);
    setLines(parsed.map((p) => ({ ...p, confidence: 1.0, isCustomEdited: false })));
  };

  const handleApplyPlainText = () => {
    const parsed = parseLyricsText(rawText, durationSec || 180, startOffsetSec);
    setLines(parsed.map((p) => ({ ...p, confidence: 1.0, isCustomEdited: false })));
    setActiveTab('stage');
  };

  // Set first line (and subsequent lines) to start at current playhead
  const handleSetStartAtPlayhead = () => {
    const current = Math.max(0, Number(currentTimeSec.toFixed(2)));
    setStartOffsetSec(current);
    if (lines.length > 0) {
      setAllLinesStartTime(current);
    } else {
      const parsed = parseLyricsText(rawText, durationSec || 180, current);
      setLines(parsed.map((p) => ({ ...p, confidence: 1.0, isCustomEdited: true })));
    }
  };

  const handleStartSync = async () => {
    if (onSyncClick) onSyncClick();
    const vocalPath = vocalRefTrack?.filePath || '';
    await triggerSync(vocalPath, 'auto');
  };

  const handleCopyLrc = () => {
    const lrcContent = exportToLrc();
    navigator.clipboard.writeText(lrcContent);
    setCopiedLrc(true);
    setTimeout(() => setCopiedLrc(false), 2000);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  };

  const firstLineStart = lines.length > 0 ? lines[0].startTime : startOffsetSec;

  return (
    <div
      style={{
        backgroundColor: '#17171c',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
      }}
      className="w-full h-full flex flex-col overflow-hidden text-zinc-100"
    >
      {/* ── 1. Top Header Bar ─────────────────────────────────────────── */}
      <div className="bg-[#121215] border-b border-zinc-800/90 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
            <FileText size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              Lyrics Studio
              {lines.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-medium">
                  {lines.length} lines
                </span>
              )}
            </h2>
          </div>
        </div>

        {/* Tab Controls (CapCut / Premiere / Notion Layer Switcher) */}
        <div className="flex items-center gap-1.5 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab('stage')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'stage'
                ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Music size={12} />
            <span>Karaoke Stage</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'timeline'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <SlidersHorizontal size={12} />
            <span>Timeline / Nudge</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'text'
                ? 'bg-zinc-700 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Type size={12} />
            <span>Edit Text</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {lines.length > 0 && (
            <button
              onClick={handleCopyLrc}
              title="Copy LRC Formatted Lyrics"
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs flex items-center gap-1 border border-zinc-700 transition-colors cursor-pointer"
            >
              {copiedLrc ? (
                <Check size={14} className="text-emerald-400" />
              ) : (
                <Copy size={14} className="text-zinc-400" />
              )}
              <span className="hidden sm:inline">{copiedLrc ? 'Copied' : 'LRC'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 2. Quick Timeline & Start-Time Control Bar (The Hero Feature) ── */}
      <div className="bg-[#141418] border-b border-zinc-800/80 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        {/* Left: Playhead Stamp / Set Start Time */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSetStartAtPlayhead}
            title="เลื่อนจุดเริ่มต้นของเนื้อเพลงทั้งหมดมาที่เวลาของหัวอ่านปัจจุบัน (ข้ามเสียงฮัม/Intro)"
            className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-950 to-indigo-950 hover:from-cyan-900 hover:to-indigo-900 border border-cyan-500/40 text-cyan-200 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <MapPin size={13} className="text-cyan-400" />
            <span>start point ({formatTime(currentTimeSec)})</span>
          </button>

          <span className="text-zinc-400 font-mono text-[11px] bg-zinc-900 px-2 py-1 rounded-md border border-zinc-800">
            เริ่มท่อนแรก: <strong className="text-white">{formatTime(firstLineStart)}</strong>
          </span>
        </div>

        {/* Right: Global Shift Controls (เลื่อนทั้งเพลง) */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-zinc-400 mr-1 hidden sm:inline">เลื่อนทั้งเพลง:</span>
          <button
            type="button"
            onClick={() => shiftAllLines(-1.0)}
            title="เลื่อนเวลาทั้งเพลงเร็วขึ้น 1.0 วินาที"
            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-mono border border-zinc-700/60 transition-colors cursor-pointer active:scale-95"
          >
            -1.0s
          </button>
          <button
            type="button"
            onClick={() => shiftAllLines(-0.2)}
            title="เลื่อนเวลาทั้งเพลงเร็วขึ้น 0.2 วินาที"
            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-mono border border-zinc-700/60 transition-colors cursor-pointer active:scale-95"
          >
            -0.2s
          </button>
          <button
            type="button"
            onClick={() => shiftAllLines(0.2)}
            title="เลื่อนเวลาทั้งเพลงช้าลง 0.2 วินาที"
            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-mono border border-zinc-700/60 transition-colors cursor-pointer active:scale-95"
          >
            +0.2s
          </button>
          <button
            type="button"
            onClick={() => shiftAllLines(1.0)}
            title="เลื่อนเวลาทั้งเพลงช้าลง 1.0 วินาที"
            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-mono border border-zinc-700/60 transition-colors cursor-pointer active:scale-95"
          >
            +1.0s
          </button>
        </div>
      </div>

      {/* ── 3. Main Content Viewport ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden bg-[#161619] p-4">
        {/* Error Alert */}
        {error && (
          <div className="mb-3 p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 flex items-center gap-2.5 text-xs text-rose-300 shrink-0">
            <AlertTriangle size={15} className="text-rose-400 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* ── VIEW A: Karaoke Stage Display View ──────────────────────── */}
        {activeTab === 'stage' && (
          <div
            ref={containerRef}
            className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
          >
            {lines.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-center p-6 space-y-3">
                <Sparkles size={32} className="text-cyan-400 animate-pulse" />
                <div>
                  <p className="text-sm font-semibold text-zinc-300">ยังไม่มีเนื้อเพลงที่ซิงค์เวลา</p>
                  <p className="text-xs text-zinc-500 max-w-xs mt-1">
                    วางเนื้อเพลงในแท็บ <strong>Edit Text</strong> หรือกดปุ่ม <strong>SYNC LYRICS</strong> เพื่อคำนวณอัตโนมัติ
                  </p>
                </div>
              </div>
            ) : (
              lines.map((line, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <div
                    key={line.id || idx}
                    ref={isActive ? activeLineRef : null}
                    onClick={() => onSeek && onSeek(line.startTime)}
                    style={{ padding: '12px 18px', borderRadius: '12px' }}
                    className={`transition-all duration-300 cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-purple-900/60 via-cyan-900/40 to-transparent border-l-4 border-cyan-400 text-white font-bold scale-[1.01] shadow-lg shadow-cyan-950/40'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50 font-medium'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono mb-1 text-zinc-500">
                      <span className={isActive ? 'text-cyan-400 font-bold' : ''}>
                        {formatTime(line.startTime)}
                      </span>
                    </div>
                    <div className="text-base tracking-wide leading-relaxed">
                      {line.text}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── VIEW B: Timeline & Per-Line Nudge Editor (CapCut / Premiere) */}
        {activeTab === 'timeline' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
            <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-800/40 text-xs text-purple-300 flex items-center justify-between shrink-0">
              <span className="flex items-center gap-1.5 font-medium">
                <SlidersHorizontal size={14} className="text-purple-400" />
                <span>คลิกปุ่ม 📍 <strong>มาร์กเวลา</strong> เพื่อกำหนดเวลาเริ่มของแต่ละบรรทัดให้ตรงกับเพลงสด</span>
              </span>
            </div>

            {lines.map((line, idx) => {
              const isActive = idx === activeIndex;
              return (
                <div
                  key={line.id || idx}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    isActive
                      ? 'bg-cyan-950/30 border-cyan-600/50 shadow-md'
                      : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-900'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-cyan-400 flex items-center gap-1 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                        <Clock size={11} />
                        {formatTime(line.startTime)}
                      </span>

                      {/* Jump and Play from this line */}
                      {onSeek && (
                        <button
                          type="button"
                          onClick={() => onSeek(line.startTime)}
                          title="กระโดดเล่นเพลงท่อนนี้"
                          className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-semibold flex items-center gap-1 cursor-pointer border border-zinc-700"
                        >
                          <Play size={10} className="fill-current text-emerald-400" />
                          <span>ฟัง</span>
                        </button>
                      )}

                      {/* Stamp current playhead to this line */}
                      <button
                        type="button"
                        onClick={() => stampLineTime(line.id, currentTimeSec)}
                        title={`กำหนดเวลาบรรทัดนี้เป็นเวลาปัจจุบันของหัวอ่าน (${formatTime(currentTimeSec)})`}
                        className="px-2 py-0.5 rounded bg-gradient-to-r from-purple-950 to-indigo-950 hover:from-purple-900 hover:to-indigo-900 text-purple-200 border border-purple-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                      >
                        <MapPin size={10} className="text-purple-400" />
                        <span>📍 มาร์กตรงนี้ ({formatTime(currentTimeSec)})</span>
                      </button>
                    </div>

                    <p className="text-xs text-zinc-200 font-medium">{line.text}</p>
                  </div>

                  {/* Micro-Nudge Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => adjustLineTime(line.id, -0.2)}
                      title="เลื่อนเร็วขึ้น 0.2 วินาที"
                      className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-mono border border-zinc-700 cursor-pointer active:scale-95"
                    >
                      -0.2s
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustLineTime(line.id, 0.2)}
                      title="เลื่อนช้าลง 0.2 วินาที"
                      className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-mono border border-zinc-700 cursor-pointer active:scale-95"
                    >
                      +0.2s
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── VIEW C: Plain Text Editor ──────────────────────────────── */}
        {activeTab === 'text' && (
          <div className="flex-1 flex flex-col min-h-0 gap-3">
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="วางเนื้อเพลงของคุณที่นี่ (บรรทัดละ 1 ประโยค)..."
              className="flex-1 w-full bg-zinc-900/90 border border-zinc-800 rounded-xl p-3.5 text-sm text-zinc-200 focus:outline-none focus:border-cyan-500 font-mono resize-none leading-relaxed shadow-inner"
            />
            <div className="flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={handleLoadSample}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 cursor-pointer bg-zinc-800/80 hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-700"
              >
                <RefreshCw size={12} />
                <span>โหลดตัวอย่าง</span>
              </button>

              <button
                type="button"
                onClick={handleApplyPlainText}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                <CheckCircle2 size={14} />
                <span>จัดวางเนื้อเพลงลงไทม์ไลน์</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Bottom Sync Trigger Bar ──────────────────────────────────── */}
      <div className="bg-[#121215] border-t border-zinc-800/90 px-4 py-3 flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <Mic size={13} className="text-purple-400" />
            <span>Track Source: {vocalRefTrack?.name || 'audio [vocals].mp3'}</span>
          </span>
          <span className="text-[10px] text-zinc-500">AI Whisper Forced Alignment</span>
        </div>

        <button
          type="button"
          onClick={handleStartSync}
          disabled={mode === 'syncing'}
          className={`w-full py-2.5 rounded-xl text-xs font-bold text-white uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer active:scale-[0.99] ${
            mode === 'syncing'
              ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-cyan-500 via-teal-500 to-indigo-600 hover:from-cyan-400 hover:via-teal-400 hover:to-indigo-500 shadow-[0_0_20px_rgba(6,182,212,0.25)]'
          }`}
        >
          {mode === 'syncing' ? (
            <>
              <Loader2 size={15} className="animate-spin text-cyan-400" />
              <span>{progress.stage || 'กำลังประมวลผล AI Alignment...'}</span>
            </>
          ) : (
            <>
              <Sparkles size={15} />
              <span>SYNC LYRICS (AI FORCED ALIGNMENT)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
});
