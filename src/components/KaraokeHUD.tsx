import React from 'react';
import { Mic, Music, Sparkles } from 'lucide-react';
import { PitchFrame } from '../types/audio';

interface KaraokeHUDProps {
  targetPitchFrame: PitchFrame | null;
  liveMicFrame: PitchFrame | null;
  isRecording: boolean;
  overallScore: number;
}

export const KaraokeHUD: React.FC<KaraokeHUDProps> = ({
  targetPitchFrame,
  liveMicFrame,
  isRecording,
  overallScore,
}) => {
  const getPitchComparison = () => {
    if (!targetPitchFrame || !targetPitchFrame.is_voiced || targetPitchFrame.frequency_hz <= 0) {
      return {
        targetNote: '---',
        targetHz: 0,
        userNote: liveMicFrame?.is_voiced ? liveMicFrame.note_name : '---',
        userHz: liveMicFrame?.is_voiced ? liveMicFrame.frequency_hz : 0,
        centsOffset: 0,
        status: 'none' as const,
        statusText: 'Listening to Guide Pitch...',
        colorClass: 'grey',
      };
    }

    const targetHz = targetPitchFrame.frequency_hz;
    const targetNote = targetPitchFrame.note_name;

    if (!liveMicFrame || !liveMicFrame.is_voiced || liveMicFrame.frequency_hz <= 0) {
      return {
        targetNote,
        targetHz,
        userNote: '---',
        userHz: 0,
        centsOffset: 0,
        status: 'none' as const,
        statusText: isRecording ? 'Sing into Microphone...' : 'Press Play to Sing!',
        colorClass: 'grey',
      };
    }

    const userHz = liveMicFrame.frequency_hz;
    const userNote = liveMicFrame.note_name;

    // Calculate cents difference between user mic pitch and original singer pitch
    const centsOffset = Math.round(1200 * Math.log2(userHz / targetHz));
    const absOffset = Math.abs(centsOffset);

    if (absOffset <= 20) {
      return {
        targetNote,
        targetHz,
        userNote,
        userHz,
        centsOffset,
        status: 'green' as const,
        statusText: '🟢 PERFECT! In-Tune',
        colorClass: 'green',
      };
    } else if (absOffset <= 45) {
      return {
        targetNote,
        targetHz,
        userNote,
        userHz,
        centsOffset,
        status: 'orange' as const,
        statusText: centsOffset > 0 ? '🟠 Slightly Sharp (ร้องสูงไป)' : '🟠 Slightly Flat (ร้องต่ำไป)',
        colorClass: 'orange',
      };
    } else {
      return {
        targetNote,
        targetHz,
        userNote,
        userHz,
        centsOffset,
        status: 'red' as const,
        statusText: centsOffset > 0 ? '🔴 Too Sharp! (หลุดคีย์สูง)' : '🔴 Too Flat! (หลุดคีย์ต่ำ)',
        colorClass: 'red',
      };
    }
  };

  const comp = getPitchComparison();

  return (
    <div className={`glass-card karaoke-hud-card ${comp.colorClass}`}>
      <div className="hud-header">
        <div className="hud-title-group">
          <Sparkles size={20} className="glow-icon" />
          <h3 className="hud-title">Real-Time Karaoke Pitch & Key HUD</h3>
        </div>

        <div className="score-pill">
          <span>PITCH MATCH SCORE</span>
          <strong className="score-pct">{overallScore}%</strong>
        </div>
      </div>

      <div className="hud-notes-grid">
        {/* Original Singer Target Note */}
        <div className="note-card target-note-card">
          <div className="note-card-header">
            <Music size={16} color="#a855f7" />
            <span>ต้นฉบับ (Original Singer)</span>
          </div>
          <div className="note-big purple">{comp.targetNote}</div>
          <div className="note-hz">{comp.targetHz > 0 ? `${comp.targetHz.toFixed(1)} Hz` : 'No Voiced Note'}</div>
        </div>

        {/* Real-time Pitch Offset Meter */}
        <div className="cents-gauge-box">
          <div className={`status-banner-pill ${comp.colorClass}`}>
            {comp.statusText}
          </div>

          <div className="cents-offset-readout">
            <span>Cents Deviation:</span>
            <strong className={`cents-num ${comp.colorClass}`}>
              {comp.centsOffset > 0 ? `+${comp.centsOffset}` : comp.centsOffset} cents
            </strong>
          </div>

          {/* Visual Cents Meter Bar (-100 cents to +100 cents) */}
          <div className="cents-bar-track">
            <div className="cents-bar-center-line" />
            <div
              className={`cents-bar-indicator ${comp.colorClass}`}
              style={{
                left: `${Math.max(5, Math.min(95, 50 + (comp.centsOffset / 100) * 45))}%`,
              }}
            />
          </div>
          <div className="cents-labels">
            <span>-100 (Flat)</span>
            <span>0 (In-Tune)</span>
            <span>+100 (Sharp)</span>
          </div>
        </div>

        {/* User Live Mic Note */}
        <div className={`note-card user-note-card ${comp.colorClass}`}>
          <div className="note-card-header">
            <Mic size={16} color="#00f2fe" />
            <span>เสียงคุณ (Your Live Voice)</span>
          </div>
          <div className={`note-big ${comp.colorClass}`}>{comp.userNote}</div>
          <div className="note-hz">{comp.userHz > 0 ? `${comp.userHz.toFixed(1)} Hz` : 'Sing into Mic'}</div>
        </div>
      </div>
    </div>
  );
};
