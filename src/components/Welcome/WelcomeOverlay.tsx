import React, { useState, useEffect } from 'react';
import { useFlowStore } from '../../stores/flowStore';
import { useUIStore } from '../../stores/uiStore';

export default function WelcomeOverlay() {
  const { markWelcomeSeen } = useFlowStore();
  const { setView } = useUIStore();
  const [typewriterText, setTypewriterText] = useState('');
  const [showSteps, setShowSteps] = useState(false);
  const [showButton, setShowButton] = useState(false);

  const fullText = "Commander, your mission: build software with AI agents at your command.";

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < fullText.length) {
        setTypewriterText(fullText.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => setShowSteps(true), 300);
        setTimeout(() => setShowButton(true), 800);
      }
    }, 30);
    return () => clearInterval(interval);
  }, []);

  const handleBegin = () => {
    markWelcomeSeen();
    setView('incubator');
  };

  const steps = [
    { icon: '\u25C8', label: 'CREATE PROJECT' },
    { icon: '\u25C6', label: 'PLAN MISSIONS' },
    { icon: '\u25C9', label: 'DEPLOY AGENTS' },
  ];

  return (
    <div style={styles.overlay}>
      <div style={styles.content}>
        <h1 style={styles.logo}>CONSTELLATION COMMAND</h1>

        <p style={styles.typewriter}>
          {typewriterText}
          <span style={styles.cursor}>|</span>
        </p>

        {showSteps && (
          <div style={styles.steps}>
            {steps.map((step, i) => (
              <React.Fragment key={step.label}>
                <div style={styles.step}>
                  <span style={styles.stepIcon}>{step.icon}</span>
                  <span style={styles.stepLabel}>{step.label}</span>
                </div>
                {i < steps.length - 1 && <div style={styles.stepConnector}>- - -</div>}
              </React.Fragment>
            ))}
          </div>
        )}

        {showButton && (
          <button onClick={handleBegin} style={styles.beginButton}>
            BEGIN NEW MISSION
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(10, 14, 23, 0.85)',
    backdropFilter: 'blur(8px)',
    animation: 'fade-in 0.6s ease-out',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 32,
    maxWidth: 600,
    textAlign: 'center',
    padding: '0 24px',
  },
  logo: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '28px',
    fontWeight: 900,
    letterSpacing: '6px',
    color: 'var(--cyan-glow, #00c8ff)',
    textShadow: '0 0 20px rgba(0, 200, 255, 0.6), 0 0 60px rgba(0, 200, 255, 0.2)',
    margin: 0,
    animation: 'pulse-glow 3s ease-in-out infinite',
  },
  typewriter: {
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '18px',
    fontWeight: 500,
    color: 'var(--text-primary, #e0f0ff)',
    lineHeight: 1.6,
    minHeight: '2em',
    margin: 0,
  },
  cursor: {
    color: 'var(--cyan-glow, #00c8ff)',
    animation: 'flicker 1s step-end infinite',
  },
  steps: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    animation: 'fade-in-up 0.5s ease-out',
  },
  step: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  stepIcon: {
    fontSize: '24px',
    color: 'var(--cyan-glow, #00c8ff)',
    textShadow: '0 0 10px rgba(0, 200, 255, 0.5)',
  },
  stepLabel: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '2px',
    color: 'var(--text-secondary, #7a8ba8)',
  },
  stepConnector: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '10px',
    color: 'rgba(0, 200, 255, 0.3)',
    letterSpacing: '2px',
    marginBottom: 20,
  },
  beginButton: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '4px',
    color: 'var(--cyan-glow, #00c8ff)',
    border: '2px solid var(--cyan-glow, #00c8ff)',
    background: 'linear-gradient(180deg, rgba(0, 200, 255, 0.1) 0%, rgba(0, 200, 255, 0.03) 100%)',
    padding: '16px 40px',
    cursor: 'pointer',
    textShadow: '0 0 12px rgba(0, 200, 255, 0.5)',
    boxShadow: '0 0 20px rgba(0, 200, 255, 0.3), inset 0 0 15px rgba(0, 200, 255, 0.05)',
    transition: 'all 0.2s ease',
    clipPath: 'polygon(12px 0%, calc(100% - 12px) 0%, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0% calc(100% - 12px), 0% 12px)',
  },
};
