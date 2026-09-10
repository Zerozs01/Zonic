import React, { useState } from 'react';
import {
  Scissors,
  Loader2,
  CheckCircle2,
  XCircle,
  Mic,
  Music2,
  ChevronDown,
  Zap,
  Star,
  X,
} from 'lucide-react';
import type { StemModel, StemSplitterState } from '../types/splitter';
import { STEM_MODELS } from '../types/splitter';

// ────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────

interface StemSplitterPanelProps {
  /** Absolute file path of the source audio to split */
  sourceFilePath: string | null;
  /** Display name shown in the panel header */
  sourceFileName?: string;
  splitterState: StemSplitterState;
  onStartSplit: (inputPath: string, model: StemModel) => void;
  onCancelSplit: () => void;
  onReset: () => void;
}

// ────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────

export const StemSplitterPanel: React.FC<StemSplitterPanelProps> = ({
  sourceFilePath,
  sourceFileName,
  splitterState,
  onStartSplit,
  onCancelSplit,
  onReset,
}) => {
  const [selectedModel, setSelectedModel] = useState<StemModel>('mdx_extra_q');
  const [showModelPicker, setShowModelPicker] = useState(false);

  const { status, percent, stepLabel, vocalPath, instrumentalPath, error } = splitterState;
  const isActive = status === 'loading_model' || status === 'separating' || status === 'writing';
  const isDone = status === 'complete';
  const isError = status === 'error';
  const isIdle = status === 'idle' || status === 'cancelled';

  const currentModel = STEM_MODELS.find((m) => m.id === selectedModel) ?? STEM_MODELS[0];

  const handleSplit = () => {
    if (!sourceFilePath) return;
    onStartSplit(sourceFilePath, selectedModel);
  };

  return (
    <div className="stem-splitter-panel">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="splitter-header">
        <div className="splitter-title">
          <Scissors size={16} className="splitter-icon" />
          <span>Stem Splitter</span>
          {sourceFileName && (
            <span className="splitter-source-name">{sourceFileName}</span>
          )}
        </div>
        {!isIdle && isDone === false && !isError && (
          <div className="splitter-status-badge">
            {isActive ? (
              <span className="badge-active">
                <Loader2 size={12} className="spin" />
                Processing
              </span>
            ) : null}
          </div>
        )}
        {isDone && (
          <div className="splitter-status-badge">
            <span className="badge-done">
              <CheckCircle2 size={12} />
              Done
            </span>
          </div>
        )}
        {isError && (
          <div className="splitter-status-badge">
            <span className="badge-error">
              <XCircle size={12} />
              Failed
            </span>
          </div>
        )}
      </div>

      {/* ── Source file missing warning ────────────────────────── */}
      {!sourceFilePath && (
        <div className="splitter-empty-state">
          <Music2 size={28} className="empty-icon" />
          <p>Load an audio track to enable stem splitting.</p>
        </div>
      )}

      {/* ── Idle: Model Picker + Split Button ─────────────────── */}
      {sourceFilePath && isIdle && (
        <div className="splitter-idle-body">
          <p className="splitter-desc">
            Separate <strong>vocals</strong> and <strong>instrumental</strong>{' '}
            locally using Demucs AI — no internet required after first run.
          </p>

          {/* Model picker */}
          <div className="model-picker-wrapper">
            <label className="model-label">Model</label>
            <button
              id="stem-model-picker-btn"
              className="model-picker-btn"
              onClick={() => setShowModelPicker((v) => !v)}
              aria-expanded={showModelPicker}
            >
              <div className="model-picker-info">
                <span className="model-picker-name">{currentModel.label}</span>
                <span className="model-picker-desc">{currentModel.description}</span>
              </div>
              <div className="model-picker-badges">
                <span className={`speed-badge speed-${currentModel.speed.toLowerCase()}`}>
                  <Zap size={10} /> {currentModel.speed}
                </span>
                <span className="quality-badge">
                  <Star size={10} /> {currentModel.quality}
                </span>
                <ChevronDown
                  size={14}
                  className={`chevron ${showModelPicker ? 'open' : ''}`}
                />
              </div>
            </button>

            {showModelPicker && (
              <div className="model-dropdown" role="listbox">
                {STEM_MODELS.map((m) => (
                  <button
                    key={m.id}
                    id={`model-option-${m.id}`}
                    role="option"
                    aria-selected={m.id === selectedModel}
                    className={`model-option ${m.id === selectedModel ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedModel(m.id);
                      setShowModelPicker(false);
                    }}
                  >
                    <span className="model-option-name">{m.label}</span>
                    <span className="model-option-desc">{m.description}</span>
                    <div className="model-option-badges">
                      <span className={`speed-badge speed-${m.speed.toLowerCase()}`}>
                        <Zap size={9} /> {m.speed}
                      </span>
                      <span className="quality-badge">
                        <Star size={9} /> {m.quality}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Split button */}
          <button
            id="stem-split-btn"
            className="split-btn"
            onClick={handleSplit}
            disabled={!sourceFilePath}
          >
            <Scissors size={16} />
            Split Stems
          </button>
        </div>
      )}

      {/* ── Active: Progress ───────────────────────────────────── */}
      {isActive && (
        <div className="splitter-progress-body">
          <div className="progress-step-label">
            <Loader2 size={14} className="spin" />
            <span>{stepLabel || 'Processing…'}</span>
          </div>

          <div className="progress-bar-track" role="progressbar" aria-valuenow={percent} aria-valuemax={100}>
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>

          <div className="progress-meta">
            <span className="progress-percent">{Math.round(percent)}%</span>
            <button
              id="stem-cancel-btn"
              className="cancel-btn"
              onClick={onCancelSplit}
            >
              <X size={13} />
              Cancel
            </button>
          </div>

          <p className="progress-hint">
            AI is separating audio on your CPU. This may take 1–5 minutes depending on song length.
          </p>
        </div>
      )}

      {/* ── Complete: Stem Tracks preview ─────────────────────── */}
      {isDone && vocalPath && instrumentalPath && (
        <div className="splitter-result-body">
          <div className="stem-result-row vocal-row">
            <Mic size={16} className="stem-icon vocal-icon" />
            <div className="stem-result-info">
              <span className="stem-result-label">Vocals</span>
              <span className="stem-result-path" title={vocalPath}>
                {vocalPath.split(/[\\/]/).pop()}
              </span>
            </div>
            <span className="stem-ready-badge">Loaded ✓</span>
          </div>

          <div className="stem-result-row inst-row">
            <Music2 size={16} className="stem-icon inst-icon" />
            <div className="stem-result-info">
              <span className="stem-result-label">Instrumental</span>
              <span className="stem-result-path" title={instrumentalPath}>
                {instrumentalPath.split(/[\\/]/).pop()}
              </span>
            </div>
            <span className="stem-ready-badge">Loaded ✓</span>
          </div>

          <button
            id="stem-split-again-btn"
            className="split-again-btn"
            onClick={onReset}
          >
            Split Again
          </button>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────── */}
      {isError && (
        <div className="splitter-error-body">
          <XCircle size={24} className="error-icon" />
          <p className="error-message">{error}</p>
          <div className="error-hint">
            <strong>Tip:</strong> Ensure Python is installed and run:
            <code>pip install demucs torch torchaudio</code>
          </div>
          <button id="stem-retry-btn" className="retry-btn" onClick={onReset}>
            Try Again
          </button>
        </div>
      )}

      {/* ── Styles ────────────────────────────────────────────── */}
      <style>{`
        .stem-splitter-panel {
          background: linear-gradient(135deg, rgba(15, 12, 30, 0.95) 0%, rgba(22, 16, 46, 0.95) 100%);
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 14px;
          padding: 16px;
          font-family: 'Inter', -apple-system, sans-serif;
          color: #e2d9f3;
          position: relative;
          overflow: hidden;
        }
        .stem-splitter-panel::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at top left, rgba(139,92,246,0.06) 0%, transparent 60%);
          pointer-events: none;
        }

        /* ── Header ── */
        .splitter-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .splitter-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          font-size: 13px;
          color: #c4b5fd;
        }
        .splitter-icon { color: #a78bfa; }
        .splitter-source-name {
          font-size: 11px;
          color: rgba(196, 181, 253, 0.5);
          max-width: 130px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* ── Status badges ── */
        .badge-active, .badge-done, .badge-error {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 20px;
          font-weight: 500;
        }
        .badge-active { background: rgba(139,92,246,0.15); color: #a78bfa; }
        .badge-done   { background: rgba(34,197,94,0.15);  color: #4ade80; }
        .badge-error  { background: rgba(239,68,68,0.15);  color: #f87171; }

        /* ── Empty state ── */
        .splitter-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 20px;
          color: rgba(196,181,253,0.35);
          text-align: center;
          font-size: 12px;
        }
        .empty-icon { opacity: 0.35; }

        /* ── Idle body ── */
        .splitter-idle-body {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .splitter-desc {
          font-size: 12px;
          color: rgba(196,181,253,0.6);
          line-height: 1.5;
          margin: 0;
        }

        /* ── Model picker ── */
        .model-label {
          font-size: 11px;
          color: rgba(196,181,253,0.5);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 600;
          display: block;
          margin-bottom: 5px;
        }
        .model-picker-btn {
          width: 100%;
          background: rgba(139,92,246,0.08);
          border: 1px solid rgba(139,92,246,0.2);
          border-radius: 8px;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: all 0.18s ease;
          gap: 8px;
          text-align: left;
        }
        .model-picker-btn:hover {
          background: rgba(139,92,246,0.14);
          border-color: rgba(139,92,246,0.4);
        }
        .model-picker-info { flex: 1; }
        .model-picker-name {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #c4b5fd;
        }
        .model-picker-desc {
          display: block;
          font-size: 10.5px;
          color: rgba(196,181,253,0.5);
          margin-top: 2px;
        }
        .model-picker-badges {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-shrink: 0;
        }
        .chevron { color: rgba(196,181,253,0.5); transition: transform 0.2s ease; }
        .chevron.open { transform: rotate(180deg); }

        /* Badges */
        .speed-badge, .quality-badge {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 9.5px;
          padding: 2px 6px;
          border-radius: 10px;
          font-weight: 600;
        }
        .speed-fast   { background: rgba(16,185,129,0.12); color: #34d399; }
        .speed-medium { background: rgba(245,158,11,0.12); color: #fbbf24; }
        .speed-slow   { background: rgba(239,68,68,0.12);  color: #f87171; }
        .quality-badge { background: rgba(139,92,246,0.12); color: #a78bfa; }

        /* Dropdown */
        .model-dropdown {
          position: absolute;
          left: 16px; right: 16px;
          z-index: 100;
          background: rgba(22, 16, 46, 0.98);
          border: 1px solid rgba(139,92,246,0.25);
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 12px 40px rgba(0,0,0,0.5);
          backdrop-filter: blur(12px);
        }
        .model-option {
          width: 100%;
          background: none;
          border: none;
          padding: 10px 14px;
          text-align: left;
          cursor: pointer;
          transition: background 0.15s ease;
          display: flex;
          flex-direction: column;
          gap: 2px;
          border-bottom: 1px solid rgba(139,92,246,0.07);
        }
        .model-option:last-child { border-bottom: none; }
        .model-option:hover, .model-option.selected {
          background: rgba(139,92,246,0.12);
        }
        .model-option-name {
          font-size: 12px;
          font-weight: 600;
          color: #c4b5fd;
        }
        .model-option-desc {
          font-size: 10.5px;
          color: rgba(196,181,253,0.5);
        }
        .model-option-badges { display: flex; gap: 4px; margin-top: 4px; }

        /* ── Split button ── */
        .split-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
          border: none;
          border-radius: 10px;
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          letter-spacing: 0.02em;
        }
        .split-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(124,58,237,0.4);
        }
        .split-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* ── Progress body ── */
        .splitter-progress-body {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .progress-step-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #a78bfa;
          font-weight: 500;
        }
        .progress-bar-track {
          height: 6px;
          background: rgba(139,92,246,0.12);
          border-radius: 10px;
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #7c3aed, #a78bfa, #7c3aed);
          background-size: 200% 100%;
          animation: shimmer 1.8s ease infinite;
          border-radius: 10px;
          transition: width 0.3s ease;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .progress-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .progress-percent {
          font-size: 20px;
          font-weight: 800;
          color: #c4b5fd;
          font-variant-numeric: tabular-nums;
        }
        .cancel-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 6px;
          color: #f87171;
          padding: 4px 10px;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .cancel-btn:hover {
          background: rgba(239,68,68,0.18);
          border-color: rgba(239,68,68,0.45);
        }
        .progress-hint {
          font-size: 10.5px;
          color: rgba(196,181,253,0.4);
          margin: 0;
          line-height: 1.5;
        }

        /* ── Result body ── */
        .splitter-result-body {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .stem-result-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 9px;
          border: 1px solid;
        }
        .vocal-row {
          background: rgba(139,92,246,0.07);
          border-color: rgba(139,92,246,0.2);
        }
        .inst-row {
          background: rgba(16,185,129,0.06);
          border-color: rgba(16,185,129,0.18);
        }
        .stem-icon { flex-shrink: 0; }
        .vocal-icon { color: #a78bfa; }
        .inst-icon  { color: #34d399; }
        .stem-result-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .stem-result-label {
          font-size: 11px;
          font-weight: 700;
          color: #c4b5fd;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .stem-result-path {
          font-size: 10px;
          color: rgba(196,181,253,0.45);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .stem-ready-badge {
          font-size: 10px;
          color: #4ade80;
          font-weight: 600;
          flex-shrink: 0;
        }
        .split-again-btn {
          margin-top: 4px;
          background: rgba(139,92,246,0.08);
          border: 1px solid rgba(139,92,246,0.2);
          border-radius: 8px;
          color: #a78bfa;
          padding: 8px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
          font-weight: 600;
        }
        .split-again-btn:hover {
          background: rgba(139,92,246,0.14);
          border-color: rgba(139,92,246,0.35);
        }

        /* ── Error body ── */
        .splitter-error-body {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
          text-align: center;
        }
        .error-icon { color: #f87171; }
        .error-message {
          font-size: 12px;
          color: #fca5a5;
          margin: 0;
          line-height: 1.5;
        }
        .error-hint {
          font-size: 11px;
          color: rgba(196,181,253,0.5);
          background: rgba(0,0,0,0.2);
          border-radius: 6px;
          padding: 8px 10px;
          text-align: left;
          line-height: 1.6;
        }
        .error-hint code {
          display: block;
          font-family: 'JetBrains Mono', 'Consolas', monospace;
          font-size: 10px;
          color: #c4b5fd;
          margin-top: 4px;
        }
        .retry-btn {
          background: linear-gradient(135deg, #7c3aed, #5b21b6);
          border: none;
          border-radius: 8px;
          color: #fff;
          padding: 8px 20px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .retry-btn:hover {
          background: linear-gradient(135deg, #8b5cf6, #6d28d9);
        }

        /* ── Utility ── */
        .spin {
          animation: spin 1.2s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .model-picker-wrapper {
          position: relative;
        }
      `}</style>
    </div>
  );
};

export default StemSplitterPanel;
