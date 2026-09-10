import React from 'react';
import { X, Trophy, Music, Mic, CheckCircle2 } from 'lucide-react';
import { LoadedTrack, ScoreDifficulty } from '../types/audio';
import { hzToNote } from '../utils/webAudioPitch';

interface PerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  overallScore: number;
  vocalRefTrack: LoadedTrack | null;
  transposeKey: number;
  difficulty?: ScoreDifficulty;
}

export const PerformanceModal: React.FC<PerformanceModalProps> = ({
  isOpen,
  onClose,
  overallScore,
  vocalRefTrack,
  transposeKey,
  difficulty = 'easy',
}) => {
  if (!isOpen) return null;

  const getScoreGrade = (score: number, mode: ScoreDifficulty = 'easy') => {
    if (mode === 'easy') {
      if (score >= 75) return { grade: 'S+', title: '🔥 สุดยอดมาก! เสียงเป๊ะตรงคีย์ (Easy)', color: '#10b981' };
      if (score >= 60) return { grade: 'A', title: '⭐ ร้องไพเราะ คุม pitch ได้ดีเยี่ยม', color: '#00f2fe' };
      if (score >= 45) return { grade: 'B', title: '👍 อยู่ในเกณฑ์ดี มีหลุดคีย์เล็กน้อย', color: '#f59e0b' };
      return { grade: 'C', title: '🎤 ซ้อมอีกนิด สู้ๆ ฝึกร้องบ่อยๆ จะเก่งขึ้น!', color: '#a855f7' };
    } else if (mode === 'normal') {
      if (score >= 85) return { grade: 'S+', title: '🔥 สุดยอดมาก! มาตรฐานนักร้อง', color: '#10b981' };
      if (score >= 70) return { grade: 'A', title: '⭐ ร้องไพเราะ คุม pitch ได้ดีเยี่ยม', color: '#00f2fe' };
      if (score >= 50) return { grade: 'B', title: '👍 อยู่ในเกณฑ์ดี มีหลุดคีย์เล็กน้อย', color: '#f59e0b' };
      return { grade: 'C', title: '🎤 ต้องฝึกซ้อมเพิ่มเติมอีกนิด สู้ๆ!', color: '#a855f7' };
    } else {
      if (score >= 90) return { grade: 'S+', title: '🔥 โหดมาก! ระดับนักร้องมืออาชีพ (Hard)', color: '#10b981' };
      if (score >= 80) return { grade: 'A', title: '⭐ เป๊ะคีย์มาก แทบไม่หลุดโน้ต', color: '#00f2fe' };
      if (score >= 65) return { grade: 'B', title: '👍 เกณฑ์ดี มีโดนหักคะแนนท่อนยาก', color: '#f59e0b' };
      return { grade: 'C', title: '🎤 โหมด Hard มีหักคะแนน Miss ลองซ้อมโหมด Easy ก่อนได้นะ', color: '#a855f7' };
    }
  };

  const info = getScoreGrade(overallScore, difficulty);
  const minHz = vocalRefTrack?.analysis?.min_pitch_hz || 0;
  const maxHz = vocalRefTrack?.analysis?.max_pitch_hz || 0;
  const minNote = minHz > 0 ? hzToNote(minHz).noteName : '---';
  const maxNote = maxHz > 0 ? hzToNote(maxHz).noteName : '---';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card notion-style performance" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Trophy size={20} color="#f59e0b" />
            <h3>ผลการฝึกร้องเพลง (Vocal Performance Summary)</h3>
          </div>
          <button className="btn-close-modal" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body performance-body">
          {/* Main Score Hero Card */}
          <div className="score-hero-card">
            <div className="grade-badge" style={{ color: info.color, borderColor: info.color }}>
              {info.grade}
            </div>
            <div className="score-main-group">
              <div className="score-big-num">{overallScore}%</div>
              <div className="score-label">PITCH MATCH ACCURACY SCORE</div>
              <div className="score-title-text">{info.title}</div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="performance-stats-grid">
            <div className="stat-card-clean">
              <div className="stat-card-header">
                <Music size={15} color="#a855f7" />
                <span>คีย์เพลงที่ซ้อม (Transpose)</span>
              </div>
              <div className="stat-card-val">
                {transposeKey === 0 ? 'คีย์ต้นฉบับ (Key 0)' : transposeKey > 0 ? `+${transposeKey} Semitones` : `${transposeKey} Semitones`}
              </div>
            </div>

            <div className="stat-card-clean">
              <div className="stat-card-header">
                <Mic size={15} color="#00f2fe" />
                <span>ช่วงเสียงต้นฉบับ (Original Range)</span>
              </div>
              <div className="stat-card-val">
                {minNote} - {maxNote}
              </div>
            </div>
          </div>

          <button className="btn-primary-clean full" onClick={onClose}>
            <CheckCircle2 size={16} />
            <span>ซ้อมเพลงต่อ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
