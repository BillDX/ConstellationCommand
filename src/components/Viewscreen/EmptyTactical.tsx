import React from 'react';
import { useUIStore } from '../../stores/uiStore';

export default function EmptyTactical() {
  const { setView } = useUIStore();

  return (
    <div style={styles.container}>
      <div style={styles.planetOutline}>
        <div style={styles.scanLine} />
      </div>

      <h2 style={styles.title}>NO ACTIVE MISSION</h2>
      <p style={styles.subtitle}>Navigate to Project Incubator to create or select a mission</p>

      <button onClick={() => setView('incubator')} style={styles.button}>
        GO TO INCUBATOR
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    zIndex: 10,
    pointerEvents: 'none',
  },
  planetOutline: {
    width: 200,
    height: 200,
    borderRadius: '50%',
    border: '1px dashed rgba(0, 200, 255, 0.15)',
    position: 'relative',
    overflow: 'hidden',
    opacity: 0.3,
  },
  scanLine: {
    position: 'absolute',
    width: '100%',
    height: 2,
    background: 'linear-gradient(90deg, transparent, rgba(0, 200, 255, 0.3), transparent)',
    animation: 'scan-line 4s linear infinite',
  },
  title: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '18px',
    fontWeight: 700,
    letterSpacing: '4px',
    color: 'var(--text-secondary, #7a8ba8)',
    margin: 0,
    textShadow: '0 0 10px rgba(122, 139, 168, 0.3)',
  },
  subtitle: {
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-secondary, #7a8ba8)',
    opacity: 0.6,
    margin: 0,
  },
  button: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '2px',
    color: 'var(--cyan-glow, #00c8ff)',
    border: '1px solid var(--cyan-glow, #00c8ff)',
    background: 'linear-gradient(180deg, rgba(0, 200, 255, 0.08) 0%, rgba(0, 200, 255, 0.02) 100%)',
    padding: '10px 24px',
    cursor: 'pointer',
    pointerEvents: 'auto',
    transition: 'all 0.2s ease',
    boxShadow: '0 0 10px rgba(0, 200, 255, 0.2)',
    clipPath: 'polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)',
  },
};
