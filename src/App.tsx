import React, { useState } from 'react';
import { Mic, Music, Activity, Cpu, Layers, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [phase, setPhase] = useState<number>(0);

  return (
    <div style={styles.container}>
      {/* Top Header Navigation */}
      <header style={styles.header}>
        <div style={styles.brand}>
          <Mic style={styles.logoIcon} size={28} />
          <div>
            <h1 style={styles.title}>VocalAlign</h1>
            <p style={styles.subtitle}>Advanced Vocal Training & Pitch Alignment System</p>
          </div>
        </div>

        <div style={styles.badge}>
          <span style={styles.badgeDot} />
          Layer 1: Software/OS Active
        </div>
      </header>

      {/* Main Container */}
      <main style={styles.mainContent}>
        {/* Phase Status Banner */}
        <section style={styles.glassCard}>
          <div style={styles.cardHeader}>
            <Activity color="#00f2fe" size={22} />
            <h2 style={styles.cardTitle}>System Phase Status</h2>
          </div>
          
          <div style={styles.phaseGrid}>
            <div style={{ ...styles.phaseBox, ...styles.phaseActive }}>
              <div style={styles.phaseNumber}>Phase 0</div>
              <div style={styles.phaseName}>Environment & Layer 1</div>
              <div style={styles.phaseStatusText}>
                <CheckCircle2 size={16} color="#00f2fe" style={{ marginRight: 6 }} />
                Initialized & Ready
              </div>
            </div>

            <div style={styles.phaseBox}>
              <div style={styles.phaseNumber}>Phase 1</div>
              <div style={styles.phaseName}>Layer 3 Hardware I/O</div>
              <div style={styles.phasePendingText}>Pending Confirmation</div>
            </div>

            <div style={styles.phaseBox}>
              <div style={styles.phaseNumber}>Phase 2</div>
              <div style={styles.phaseName}>Core DSP Engine</div>
              <div style={styles.phasePendingText}>Pending Phase 1</div>
            </div>

            <div style={styles.phaseBox}>
              <div style={styles.phaseNumber}>Phase 3</div>
              <div style={styles.phaseName}>UI Bridge & Viz</div>
              <div style={styles.phasePendingText}>Pending Phase 2</div>
            </div>
          </div>
        </section>

        {/* System Specs Overview */}
        <div style={styles.gridTwoCols}>
          <div style={styles.glassCard}>
            <div style={styles.cardHeader}>
              <Cpu color="#4facfe" size={20} />
              <h3 style={styles.cardSubTitle}>Core Engine Architecture</h3>
            </div>
            <ul style={styles.featureList}>
              <li>⚡ <strong>Rust Audio Thread:</strong> Dedicated non-blocking OS worker thread</li>
              <li>🎯 <strong>Target Latency:</strong> Minimal hardware buffer sizing (CPAL)</li>
              <li>📊 <strong>DSP Algorithms:</strong> YIN & FFT Pitch Extraction</li>
              <li>🛡️ <strong>Zero Electron:</strong> Native Tauri v2 Wrapper</li>
            </ul>
          </div>

          <div style={styles.glassCard}>
            <div style={styles.cardHeader}>
              <Layers color="#7f53ac" size={20} />
              <h3 style={styles.cardSubTitle}>Multi-Layer Analysis</h3>
            </div>
            <ul style={styles.featureList}>
              <li>🔹 <strong>Layer 1:</strong> Rust Async Multi-threading</li>
              <li>🔹 <strong>Layer 2:</strong> Practice Records & History (Local Storage/SQLite)</li>
              <li>🔹 <strong>Layer 3:</strong> Audio Interface & Low-Latency Buffer</li>
            </ul>
          </div>
        </div>
      </main>

      <footer style={styles.footer}>
        VocalAlign Protocol • Operating under Antigravity Rules
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'radial-gradient(circle at 50% 0%, #171e38 0%, #0b0f19 75%)',
    padding: '24px 36px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  logoIcon: {
    color: '#00f2fe',
    filter: 'drop-shadow(0 0 8px rgba(0,242,254,0.4))',
  },
  title: {
    fontSize: '26px',
    fontWeight: 700,
    letterSpacing: '-0.5px',
    background: 'linear-gradient(90deg, #ffffff, #9ca3af)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontSize: '13px',
    color: '#9ca3af',
    marginTop: '2px',
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    borderRadius: '20px',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
    border: '1px solid rgba(0, 242, 254, 0.2)',
    fontSize: '12px',
    color: '#00f2fe',
    fontWeight: 500,
  },
  badgeDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#00f2fe',
    boxShadow: '0 0 8px #00f2fe',
  },
  mainContent: {
    marginTop: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    flex: 1,
  },
  glassCard: {
    backgroundColor: 'rgba(17, 24, 39, 0.65)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '18px',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#f3f4f6',
  },
  cardSubTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#f3f4f6',
  },
  phaseGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  phaseBox: {
    padding: '16px',
    borderRadius: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  phaseActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.05)',
    border: '1px solid rgba(0, 242, 254, 0.3)',
    boxShadow: '0 0 16px rgba(0, 242, 254, 0.1)',
  },
  phaseNumber: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: '#9ca3af',
    marginBottom: '4px',
  },
  phaseName: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#ffffff',
    marginBottom: '10px',
  },
  phaseStatusText: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '13px',
    color: '#00f2fe',
    fontWeight: 500,
  },
  phasePendingText: {
    fontSize: '12px',
    color: '#6b7280',
  },
  gridTwoCols: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
  },
  featureList: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    fontSize: '14px',
    color: '#d1d5db',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: '24px',
    textAlign: 'center',
    fontSize: '12px',
    color: '#6b7280',
  },
};
