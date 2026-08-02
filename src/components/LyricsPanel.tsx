import React, { useState, useEffect, useRef } from 'react';
import { FileText, Edit3, Check, Sparkles, RefreshCw, Type } from 'lucide-react';
import { LyricLine, parseLyricsText } from '../utils/audioAnalysis';

interface LyricsPanelProps {
  currentTimeSec: number;
  durationSec: number;
  onLyricsChange?: (lines: LyricLine[]) => void;
}

const DEFAULT_LYRICS = `[00:00.00] 🎵 VocalAlign Karaoke Practice
[00:05.00] ยินดีต้อนรับสู่ระบบฝึกร้องเพลงคาราโอเกะ
[00:10.00] ร้องเสียงของคุณให้ตรงกับเส้นคีย์ทำนองต้นฉบับ
[00:16.00] ปรับคีย์ Transpose และความเร็วตามใจชอบได้เลย
[00:22.00] ให้เสียงของคุณก้องกังวานและเปล่งประกาย!
[00:28.00] (สามารถวางเนื้อเพลงจริงในช่องแก้ไขด้านบนได้)`;

export const LyricsPanel: React.FC<LyricsPanelProps> = ({ currentTimeSec, durationSec }) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [rawLyricsText, setRawLyricsText] = useState<string>(DEFAULT_LYRICS);
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Parse lyrics when raw text or duration changes
  useEffect(() => {
    const lines = parseLyricsText(rawLyricsText, durationSec || 180);
    setLyricLines(lines);
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
    <div className="glass-card lyrics-panel">
      {/* Panel Header */}
      <div className="lyrics-header">
        <div className="title-group">
          <FileText size={18} color="#00f2fe" />
          <h3 className="panel-title">เนื้อเพลงคาราโอเกะ (Karaoke Lyrics)</h3>
        </div>

        <div className="action-group">
          {!isEditing ? (
            <button className="btn-lyrics-action" onClick={() => setIsEditing(true)}>
              <Edit3 size={14} />
              <span>ใส่/แก้ไขเนื้อเพลง</span>
            </button>
          ) : (
            <button className="btn-lyrics-action active" onClick={handleSave}>
              <Check size={14} />
              <span>บันทึกเนื้อเพลง</span>
            </button>
          )}
        </div>
      </div>

      {/* Edit Mode Textarea */}
      {isEditing ? (
        <div className="lyrics-edit-container">
          <div className="edit-tip">
            <Sparkles size={14} color="#a855f7" />
            <span>พิมพหรือวางเนื้อเพลงที่นี่ (รองรับทั้งข้อความปกติ และรูปแบบเวลา LRC เช่น [00:15.00] ข้อความ)</span>
          </div>
          <textarea
            className="lyrics-textarea"
            rows={8}
            value={rawLyricsText}
            onChange={(e) => setRawLyricsText(e.target.value)}
            placeholder="วางเนื้อเพลงที่นี่..."
          />
          <div className="edit-footer">
            <button className="btn-secondary-small" onClick={handleLoadSample}>
              <RefreshCw size={13} />
              <span>โหลดเนื้อเพลงตัวอย่าง</span>
            </button>
            <button className="btn-primary-small" onClick={handleSave}>
              <Check size={13} />
              <span>นำเข้าเนื้อเพลง</span>
            </button>
          </div>
        </div>
      ) : (
        /* Karaoke Live Scrolling Display Mode */
        <div className="lyrics-scroll-container" ref={containerRef}>
          {lyricLines.length === 0 ? (
            <div className="lyrics-empty">
              <Type size={32} color="#6b7280" />
              <p>ยังไม่มีเนื้อเพลง สั่งพิมพ์หรือวางเนื้อเพลงได้ที่ปุ่มด้านบน</p>
            </div>
          ) : (
            lyricLines.map((line, idx) => {
              const isActive = idx === activeIndex;
              const isPast = idx < activeIndex;

              return (
                <div
                  key={line.id || idx}
                  ref={isActive ? activeLineRef : null}
                  className={`lyric-line ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
                >
                  <span className="line-text">{line.text}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
