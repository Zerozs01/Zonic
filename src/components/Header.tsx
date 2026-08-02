import React from 'react';
import { Mic, Activity } from 'lucide-react';
import { isTauriAvailable } from '../services/tauriBridge';

interface HeaderProps {
  activeTab: 'dual' | 'live';
  onSelectTab: (tab: 'dual' | 'live') => void;
}

export const Header: React.FC<HeaderProps> = React.memo(({ activeTab, onSelectTab }) => {
  const isTauri = isTauriAvailable();

  return (
    <header className="app-header">
      <div className="brand-group">
        <div className="logo-box">
          <Mic className="brand-icon" size={26} />
        </div>
        <div>
          <h1 className="brand-title">VocalAlign</h1>
          <p className="brand-subtitle">Advanced Vocal Pitch Alignment & Real-Time Training System</p>
        </div>
      </div>

      <div className="header-controls">
        <div className="tab-group">
          <button
            className={`tab-btn ${activeTab === 'dual' ? 'active' : ''}`}
            onClick={() => onSelectTab('dual')}
          >
            <Activity size={16} /> Dual Track Pitch Alignment
          </button>
          <button
            className={`tab-btn ${activeTab === 'live' ? 'active' : ''}`}
            onClick={() => onSelectTab('live')}
          >
            <Mic size={16} /> Live Vocal Practice
          </button>
        </div>

        <div className="environment-badge">
          <span className={`badge-dot ${isTauri ? 'tauri' : 'browser'}`} />
          {isTauri ? 'Layer 3: Rust Tauri Desktop' : 'Web Audio Sandbox'}
        </div>
      </div>
    </header>
  );
});

