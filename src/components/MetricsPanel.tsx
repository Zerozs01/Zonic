import React from 'react';
import { Target, Award, Activity, TrendingUp, Music } from 'lucide-react';
import { LoadedTrack } from '../types/audio';
import { hzToNote } from '../utils/webAudioPitch';

interface MetricsPanelProps {
  vocalTrack: LoadedTrack | null;
  referenceTrack: LoadedTrack | null;
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({ vocalTrack, referenceTrack }) => {
  // Calculate pitch alignment score & distribution
  const computeMetrics = () => {
    if (
      !vocalTrack?.analysis?.pitch_frames ||
      !referenceTrack?.analysis?.pitch_frames
    ) {
      return null;
    }

    const vFrames = vocalTrack.analysis.pitch_frames;
    const rFrames = referenceTrack.analysis.pitch_frames;

    let comparedCount = 0;
    let inTuneCount = 0;
    let flatCount = 0;
    let sharpCount = 0;
    let totalCentsDiff = 0;

    const minLen = Math.min(vFrames.length, rFrames.length);

    for (let i = 0; i < minLen; i++) {
      const vf = vFrames[i];
      const rf = rFrames[i];

      if (vf.is_voiced && rf.is_voiced && vf.frequency_hz > 0 && rf.frequency_hz > 0) {
        comparedCount++;
        // Calculate cents difference between vocal and reference
        const centsDiff = 1200 * Math.log2(vf.frequency_hz / rf.frequency_hz);
        totalCentsDiff += Math.abs(centsDiff);

        if (Math.abs(centsDiff) <= 25) {
          inTuneCount++;
        } else if (centsDiff < -25) {
          flatCount++;
        } else {
          sharpCount++;
        }
      }
    }

    if (comparedCount === 0) return null;

    const inTunePct = Math.round((inTuneCount / comparedCount) * 100);
    const flatPct = Math.round((flatCount / comparedCount) * 100);
    const sharpPct = Math.round((sharpCount / comparedCount) * 100);
    const avgCents = Math.round(totalCentsDiff / comparedCount);

    const overallScore = Math.max(0, Math.min(100, Math.round(100 - avgCents * 0.8)));

    const minHz = vocalTrack.analysis.min_pitch_hz;
    const maxHz = vocalTrack.analysis.max_pitch_hz;

    return {
      overallScore,
      inTunePct,
      flatPct,
      sharpPct,
      avgCents,
      minNote: hzToNote(minHz).noteName,
      maxNote: hzToNote(maxHz).noteName,
      comparedCount,
    };
  };

  const metrics = computeMetrics();

  return (
    <div className="glass-card metrics-card">
      <div className="card-header">
        <Award color="#00f2fe" size={22} />
        <h3 className="card-title">Vocal Alignment Performance Score</h3>
      </div>

      {metrics ? (
        <div className="metrics-content-grid">
          {/* Circular Score Badge */}
          <div className="score-circle-container">
            <div className="score-circle">
              <span className="score-value">{metrics.overallScore}%</span>
              <span className="score-label">MATCH SCORE</span>
            </div>
          </div>

          {/* Detailed Statistics Cards */}
          <div className="stats-breakdown-grid">
            <div className="stat-box green">
              <span className="stat-num">{metrics.inTunePct}%</span>
              <span className="stat-title">In-Tune Accuracy</span>
              <span className="stat-sub">&lt; 25 Cents Offset</span>
            </div>

            <div className="stat-box yellow">
              <span className="stat-num">{metrics.flatPct}%</span>
              <span className="stat-title">Flat Pitch</span>
              <span className="stat-sub">Slightly Low</span>
            </div>

            <div className="stat-box red">
              <span className="stat-num">{metrics.sharpPct}%</span>
              <span className="stat-title">Sharp Pitch</span>
              <span className="stat-sub">Slightly High</span>
            </div>

            <div className="stat-box cyan">
              <span className="stat-num">±{metrics.avgCents}</span>
              <span className="stat-title">Avg Cents Offset</span>
              <span className="stat-sub">Pitch Deviation</span>
            </div>
          </div>

          {/* Vocal Range Card */}
          <div className="range-box">
            <Music color="#00f2fe" size={18} />
            <div>
              <span className="range-title">Detected Vocal Range:</span>
              <strong className="range-notes">
                {metrics.minNote} → {metrics.maxNote}
              </strong>
            </div>
          </div>
        </div>
      ) : (
        <div className="metrics-placeholder">
          <Target size={32} color="#6b7280" />
          <p>Load both Vocal and Reference audio tracks to generate Pitch Alignment Score</p>
        </div>
      )}
    </div>
  );
};
