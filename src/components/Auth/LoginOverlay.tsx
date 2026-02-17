import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';

export default function LoginOverlay() {
  const { phase, error, remainingAttempts, retryAfterMs, login, setup } = useAuthStore();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [flashClass, setFlashClass] = useState<'granted' | 'denied' | null>(null);
  const [countdown, setCountdown] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus password input on phase change
  useEffect(() => {
    if (phase === 'login' || phase === 'setup-required') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [phase]);

  // Rate limit countdown timer
  useEffect(() => {
    if (retryAfterMs > 0) {
      setCountdown(Math.ceil(retryAfterMs / 1000));
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
    setCountdown(0);
  }, [retryAfterMs]);

  // Flash ACCESS DENIED on error
  useEffect(() => {
    if (error) {
      setFlashClass('denied');
      const timer = setTimeout(() => setFlashClass(null), 600);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Flash ACCESS GRANTED then dismiss overlay
  useEffect(() => {
    if (flashClass === 'granted') {
      const timer = setTimeout(() => setFlashClass(null), 800);
      return () => clearTimeout(timer);
    }
  }, [flashClass]);

  const handleLogin = async () => {
    if (countdown > 0) return;
    const success = await login(password);
    if (success) {
      setFlashClass('granted');
    }
  };

  const handleSetup = async () => {
    setLocalError('');
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }
    const success = await setup(password);
    if (success) {
      setFlashClass('granted');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (phase === 'login') handleLogin();
      else if (phase === 'setup-required') handleSetup();
    }
  };

  // Don't render if authenticated (after grant animation)
  if (phase === 'authenticated' && flashClass !== 'granted') return null;

  const displayError = localError || error;

  return (
    <div style={{
      ...styles.overlay,
      ...(flashClass === 'granted' ? styles.grantedOverlay : {}),
      ...(flashClass === 'denied' ? styles.deniedOverlay : {}),
    }}>
      <div style={styles.content}>
        {/* Loading phase */}
        {phase === 'loading' && (
          <div style={styles.loadingContainer}>
            <h2 style={styles.loadingText}>INITIALIZING SECURITY PROTOCOLS</h2>
            <div style={styles.loadingDots}>...</div>
          </div>
        )}

        {/* Setup phase */}
        {phase === 'setup-required' && (
          <>
            <div style={styles.lockIcon}>{'\u25C8'}</div>
            <h1 style={styles.title}>SECURITY INITIALIZATION</h1>
            <p style={styles.subtitle}>Set a password to secure this command station</p>

            <div style={styles.inputGroup}>
              <label style={styles.label}>NEW PASSWORD</label>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                style={styles.input}
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>CONFIRM PASSWORD</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                style={styles.input}
                placeholder="Re-enter password"
                autoComplete="new-password"
              />
            </div>

            {displayError && <div style={styles.error}>{displayError}</div>}

            <button onClick={handleSetup} style={styles.button}>
              INITIALIZE SECURITY
            </button>
          </>
        )}

        {/* Login phase */}
        {phase === 'login' && (
          <>
            <div style={styles.lockIcon}>{'\u25C8'}</div>
            <h1 style={styles.title}>SECURITY CHECKPOINT</h1>
            <p style={styles.subtitle}>Authentication required to access command station</p>

            <div style={styles.inputGroup}>
              <label style={styles.label}>PASSWORD</label>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                style={styles.input}
                placeholder="Enter password"
                autoComplete="current-password"
                disabled={countdown > 0}
              />
            </div>

            {displayError && (
              <div style={styles.error}>
                {countdown > 0 ? (
                  <>ACCESS LOCKED — RETRY IN {countdown}s</>
                ) : (
                  <>
                    ACCESS DENIED
                    {remainingAttempts !== null && remainingAttempts > 0 && (
                      <span style={styles.attempts}> ({remainingAttempts} attempts remaining)</span>
                    )}
                  </>
                )}
              </div>
            )}

            <button
              onClick={handleLogin}
              style={{
                ...styles.button,
                ...(countdown > 0 ? styles.buttonDisabled : {}),
              }}
              disabled={countdown > 0}
            >
              AUTHENTICATE
            </button>
          </>
        )}

        {/* Grant animation */}
        {flashClass === 'granted' && (
          <div style={styles.grantedBanner}>ACCESS GRANTED</div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(10, 14, 23, 0.92)',
    backdropFilter: 'blur(8px)',
    animation: 'fade-in 0.6s ease-out',
    transition: 'background 0.3s ease',
  },
  grantedOverlay: {
    background: 'rgba(0, 255, 136, 0.08)',
  },
  deniedOverlay: {
    background: 'rgba(255, 51, 68, 0.06)',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
    maxWidth: 400,
    width: '100%',
    textAlign: 'center',
    padding: '0 24px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '4px',
    color: 'var(--cyan-glow, #00c8ff)',
    textShadow: '0 0 20px rgba(0, 200, 255, 0.6)',
    animation: 'pulse-glow 2s ease-in-out infinite',
    margin: 0,
  },
  loadingDots: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '24px',
    color: 'var(--cyan-glow, #00c8ff)',
    animation: 'pulse-glow 1s ease-in-out infinite',
  },
  lockIcon: {
    fontSize: '36px',
    color: 'var(--cyan-glow, #00c8ff)',
    textShadow: '0 0 20px rgba(0, 200, 255, 0.6), 0 0 60px rgba(0, 200, 255, 0.2)',
    animation: 'pulse-glow 3s ease-in-out infinite',
  },
  title: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '20px',
    fontWeight: 900,
    letterSpacing: '5px',
    color: 'var(--cyan-glow, #00c8ff)',
    textShadow: '0 0 20px rgba(0, 200, 255, 0.6), 0 0 60px rgba(0, 200, 255, 0.2)',
    margin: 0,
  },
  subtitle: {
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '15px',
    fontWeight: 500,
    color: 'var(--text-secondary, #7a8ba8)',
    margin: 0,
  },
  inputGroup: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
  },
  label: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '2px',
    color: 'var(--text-secondary, #7a8ba8)',
  },
  input: {
    width: '100%',
    height: 44,
    padding: '0 14px',
    background: 'rgba(10, 14, 23, 0.9)',
    border: '1px solid rgba(0, 200, 255, 0.3)',
    borderRadius: 2,
    color: 'var(--text-primary, #e0f0ff)',
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '16px',
    fontWeight: 500,
    letterSpacing: '1px',
    outline: 'none',
    boxShadow: 'inset 0 0 10px rgba(0, 0, 0, 0.4)',
    boxSizing: 'border-box',
  },
  error: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '2px',
    color: 'var(--red-alert, #ff3344)',
    textShadow: '0 0 10px rgba(255, 51, 68, 0.5)',
  },
  attempts: {
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '11px',
    fontWeight: 500,
    letterSpacing: '0.5px',
    color: 'var(--text-secondary, #7a8ba8)',
    textShadow: 'none',
  },
  button: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '4px',
    color: 'var(--cyan-glow, #00c8ff)',
    border: '2px solid var(--cyan-glow, #00c8ff)',
    background: 'linear-gradient(180deg, rgba(0, 200, 255, 0.1) 0%, rgba(0, 200, 255, 0.03) 100%)',
    padding: '14px 36px',
    cursor: 'pointer',
    textShadow: '0 0 12px rgba(0, 200, 255, 0.5)',
    boxShadow: '0 0 20px rgba(0, 200, 255, 0.3), inset 0 0 15px rgba(0, 200, 255, 0.05)',
    transition: 'all 0.2s ease',
    clipPath: 'polygon(12px 0%, calc(100% - 12px) 0%, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0% calc(100% - 12px), 0% 12px)',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  grantedBanner: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '18px',
    fontWeight: 900,
    letterSpacing: '6px',
    color: 'var(--green-success, #00ff88)',
    textShadow: '0 0 30px rgba(0, 255, 136, 0.8), 0 0 60px rgba(0, 255, 136, 0.4)',
    animation: 'fade-in 0.3s ease-out',
  },
};
