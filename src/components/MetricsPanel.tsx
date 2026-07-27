import React from 'react';
import { Award, Music } from 'lucide-react';
import { LoadedTrack, PitchFrame } from '../types/audio';
import { hzToNote } from '../utils/webAudioPitch';

interface MetricsPanelProps {
  vocalRefTrack: LoadedTrack | null;
  liveMicFrame: PitchFrame | null;
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({ vocalRefTrack, liveMicFrame }) => {
  return (
    <div className="glass-card metrics-card">
      <div className="card-header">
        <Award color="#00f2fe" size={22} />
        <h3 className="card-title">Live Singing Accuracy & Vocal Range</h3>
      </div>

      <div className="metrics-content-grid">
        {/* Vocal Range Card */}
        <div className="range-box" style={{ gridColumn: 'span 2' }}>
          <Music color="#a855f7" size={18} />
          <div>
            <span className="range-title">Target Original Range:</span>
            <strong className="range-notes">
              {vocalRefTrack?.analysis
                ? `${hzToNote(vocalRefTrack.analysis.min_pitch_hz).noteName} → ${hzToNote(vocalRefTrack.analysis.max_pitch_hz).noteName}`
                : 'Import Original Vocal Track'}
            </strong>
          </div>
        </div>

        {/* Live Mic Note Readout */}
        <div className="stat-box cyan">
          <span className="stat-num">{liveMicFrame?.is_voiced ? liveMicFrame.note_name : '---'}</span>
          <span className="stat-title">Current Live Note</span>
          <span className="stat-sub">Microphone Pitch</span>
        </div>

        <div className="stat-box green">
          <span className="stat-num">
            {liveMicFrame?.is_voiced ? `${liveMicFrame.frequency_hz.toFixed(1)} Hz` : '0 Hz'}
          </span>
          <span className="stat-title">Live Frequency</span>
          <span className="stat-sub">Real-Time Pitch</span>
        </div>
      </div>
    </div>
  );
};
