import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useProjectStore } from '../../stores/projectStore';

/* ============================================================
   LaunchModal - Agent Launch Dialog

   Overlay modal for launching a new Claude Code agent.
   Styled as a holographic panel floating in space with cyan
   border glow, scan-line texture, and fade-in animation.
   ============================================================ */

interface LaunchModalProps {
  onClose: () => void;
  sendMessage: (msg: any) => void;
}

/* ---------- Utility ---------- */

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/* ==========================================================
   Main Component
   ========================================================== */

export default function LaunchModal({ onClose, sendMessage }: LaunchModalProps) {
  const { projects, activeProjectId } = useProjectStore();
  const activeProject = activeProjectId ? projects[activeProjectId] : null;

  const [task, setTask] = useState('');
  const [cwd, setCwd] = useState(activeProject?.cwd ?? '');
  const [isClosing, setIsClosing] = useState(false);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ---------- Focus textarea on mount ---------- */
  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  /* ---------- Close with animation ---------- */
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 250);
  }, [onClose]);

  /* ---------- Escape key handler ---------- */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  /* ---------- Launch handler ---------- */
  const handleLaunch = useCallback(() => {
    const trimmedTask = task.trim();
    if (!trimmedTask) return;

    const projectId = activeProject?.id ?? 'default';
    const workingDir = cwd.trim() || activeProject?.cwd || '/home';
    const agentId = generateId();

    sendMessage({
      type: 'agent:launch',
      projectId,
      task: trimmedTask,
      cwd: workingDir,
    });

    handleClose();
  }, [task, cwd, activeProject, sendMessage, handleClose]);

  /* ---------- Keyboard shortcut: Ctrl/Cmd + Enter to launch ---------- */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleLaunch();
      }
    },
    [handleLaunch],
  );

  const canLaunch = task.trim().length > 0;

  return (
    <>
      {/* ========== BACKDROP ========== */}
      <div
        style={{
          ...styles.backdrop,
          opacity: isClosing ? 0 : 1,
        }}
        onClick={handleClose}
      />

      {/* ========== MODAL PANEL ========== */}
      <div
        style={{
          ...styles.modal,
          opacity: isClosing ? 0 : 1,
          transform: isClosing ? 'translate(-50%, -50%) scale(0.95)' : 'translate(-50%, -50%) scale(1)',
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Scan-line texture overlay */}
        <div style={styles.scanlineTexture} />

        {/* Border glow effects */}
        <div style={styles.topEdgeGlow} />
        <div style={styles.bottomEdgeGlow} />
        <div style={styles.leftEdgeGlow} />
        <div style={styles.rightEdgeGlow} />

        {/* Corner decorations */}
        <div style={{ ...styles.cornerDecor, top: -1, left: -1 }} />
        <div style={{ ...styles.cornerDecor, top: -1, right: -1, transform: 'scaleX(-1)' }} />
        <div style={{ ...styles.cornerDecor, bottom: -1, left: -1, transform: 'scaleY(-1)' }} />
        <div style={{ ...styles.cornerDecor, bottom: -1, right: -1, transform: 'scale(-1)' }} />

        {/* ========== HEADER ========== */}
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <span style={styles.headerIcon}>{'\u25C9'}</span>
            <span style={styles.headerTitle}>LAUNCH AGENT</span>
          </div>
          <button
            onClick={handleClose}
            onMouseEnter={() => setHoveredButton('close')}
            onMouseLeave={() => setHoveredButton(null)}
            style={{
              ...styles.closeButton,
              color: hoveredButton === 'close'
                ? 'var(--red-alert, #ff3344)'
                : 'var(--text-secondary, #7a8ba8)',
              borderColor: hoveredButton === 'close'
                ? 'rgba(255, 51, 68, 0.4)'
                : 'rgba(0, 200, 255, 0.2)',
            }}
            aria-label="Close modal"
          >
            {'\u2715'}
          </button>
        </header>

        <div style={styles.headerSeparator} />

        {/* ========== BODY ========== */}
        <div style={styles.body}>
          {/* Task Description Field */}
          <div style={styles.fieldGroup}>
            <label style={styles.fieldLabel}>
              <span style={styles.fieldLabelIcon}>{'\u25B8'}</span>
              TASK DIRECTIVE
              <span style={styles.fieldRequired}>REQUIRED</span>
            </label>
            <textarea
              ref={textareaRef}
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Describe the mission objective for this agent..."
              style={styles.textarea}
              spellCheck={false}
              rows={4}
            />
          </div>

          {/* Working Directory Field */}
          <div style={styles.fieldGroup}>
            <label style={styles.fieldLabel}>
              <span style={styles.fieldLabelIcon}>{'\u25B8'}</span>
              WORKING DIRECTORY
            </label>
            <input
              type="text"
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
              placeholder={activeProject?.cwd ?? '/home/user/project'}
              style={styles.textInput}
              spellCheck={false}
              autoComplete="off"
            />
            <span style={styles.fieldHint}>
              Default: {activeProject?.cwd ?? 'No project selected'}
            </span>
          </div>

          {/* Project Context */}
          {activeProject && (
            <div style={styles.contextRow}>
              <span style={styles.contextLabel}>PROJECT</span>
              <span style={styles.contextValue}>{activeProject.name}</span>
              <span style={styles.contextDivider} />
              <span style={styles.contextLabel}>ID</span>
              <span style={styles.contextValueMono}>{activeProject.id}</span>
            </div>
          )}
        </div>

        {/* ========== FOOTER ========== */}
        <div style={styles.footerSeparator} />

        <footer style={styles.footer}>
          {/* Keyboard Hint */}
          <span style={styles.keyboardHint}>
            <span style={styles.keyboardKey}>CTRL</span>
            <span style={styles.keyboardPlus}>+</span>
            <span style={styles.keyboardKey}>ENTER</span>
            <span style={styles.keyboardHintText}>to launch</span>
          </span>

          <div style={styles.footerActions}>
            {/* Cancel Button */}
            <button
              onClick={handleClose}
              onMouseEnter={() => setHoveredButton('cancel')}
              onMouseLeave={() => setHoveredButton(null)}
              style={{
                ...styles.cancelButton,
                background: hoveredButton === 'cancel'
                  ? 'rgba(0, 200, 255, 0.06)'
                  : 'transparent',
                boxShadow: hoveredButton === 'cancel'
                  ? '0 0 8px rgba(122, 139, 168, 0.2)'
                  : 'none',
              }}
            >
              CANCEL
            </button>

            {/* Launch Button */}
            <button
              onClick={handleLaunch}
              onMouseEnter={() => setHoveredButton('launch')}
              onMouseLeave={() => setHoveredButton(null)}
              disabled={!canLaunch}
              style={{
                ...styles.launchButton,
                opacity: canLaunch ? 1 : 0.35,
                cursor: canLaunch ? 'pointer' : 'not-allowed',
                boxShadow: hoveredButton === 'launch' && canLaunch
                  ? '0 0 20px rgba(0, 200, 255, 0.5), inset 0 0 12px rgba(0, 200, 255, 0.1)'
                  : '0 0 10px rgba(0, 200, 255, 0.3)',
                transform: hoveredButton === 'launch' && canLaunch
                  ? 'scale(1.02)'
                  : 'scale(1)',
              }}
            >
              <span style={styles.launchButtonIcon}>{'\u25B6'}</span>
              LAUNCH
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}

/* ==========================================================
   Styles
   ========================================================== */

const styles: Record<string, React.CSSProperties> = {
  /* --- Backdrop --- */
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(4px)',
    zIndex: 900,
    transition: 'opacity 0.25s ease',
    animation: 'fade-in 0.25s ease-out',
  },

  /* --- Modal Panel --- */
  modal: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90vw',
    maxWidth: 560,
    background: 'var(--space-deep, #0d1321)',
    border: '1px solid var(--panel-border, rgba(0, 200, 255, 0.3))',
    borderRadius: 2,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 910,
    overflow: 'hidden',
    transition: 'opacity 0.25s ease, transform 0.25s ease',
    animation: 'fade-in 0.3s ease-out',
    boxShadow:
      '0 0 40px rgba(0, 0, 0, 0.6), 0 0 80px rgba(0, 200, 255, 0.08), 0 0 1px rgba(0, 200, 255, 0.4)',
  },

  /* --- Scan-line Texture --- */
  scanlineTexture: {
    position: 'absolute',
    inset: 0,
    background:
      'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 200, 255, 0.015) 2px, rgba(0, 200, 255, 0.015) 4px)',
    pointerEvents: 'none',
    zIndex: 1,
  },

  /* --- Edge Glows --- */
  topEdgeGlow: {
    position: 'absolute',
    top: 0,
    left: '10%',
    right: '10%',
    height: 1,
    background: 'linear-gradient(90deg, transparent, rgba(0, 200, 255, 0.6), transparent)',
    boxShadow: '0 0 8px rgba(0, 200, 255, 0.3), 0 0 20px rgba(0, 200, 255, 0.1)',
    zIndex: 2,
  },

  bottomEdgeGlow: {
    position: 'absolute',
    bottom: 0,
    left: '10%',
    right: '10%',
    height: 1,
    background: 'linear-gradient(90deg, transparent, rgba(0, 200, 255, 0.4), transparent)',
    boxShadow: '0 0 8px rgba(0, 200, 255, 0.2)',
    zIndex: 2,
  },

  leftEdgeGlow: {
    position: 'absolute',
    top: '10%',
    bottom: '10%',
    left: 0,
    width: 1,
    background: 'linear-gradient(180deg, transparent, rgba(0, 200, 255, 0.4), transparent)',
    boxShadow: '0 0 8px rgba(0, 200, 255, 0.2)',
    zIndex: 2,
  },

  rightEdgeGlow: {
    position: 'absolute',
    top: '10%',
    bottom: '10%',
    right: 0,
    width: 1,
    background: 'linear-gradient(180deg, transparent, rgba(0, 200, 255, 0.4), transparent)',
    boxShadow: '0 0 8px rgba(0, 200, 255, 0.2)',
    zIndex: 2,
  },

  /* --- Corner Decorations --- */
  cornerDecor: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderLeft: '2px solid var(--cyan-glow, #00c8ff)',
    borderTop: '2px solid var(--cyan-glow, #00c8ff)',
    pointerEvents: 'none',
    zIndex: 3,
    filter: 'drop-shadow(0 0 4px rgba(0, 200, 255, 0.5))',
  },

  /* --- Header --- */
  header: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    zIndex: 5,
  },

  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },

  headerIcon: {
    fontSize: '14px',
    color: 'var(--cyan-glow, #00c8ff)',
    textShadow: '0 0 8px rgba(0, 200, 255, 0.5)',
  },

  headerTitle: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '3px',
    color: 'var(--cyan-glow, #00c8ff)',
    textShadow: '0 0 10px rgba(0, 200, 255, 0.4)',
  },

  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    border: '1px solid',
    borderRadius: 2,
    background: 'rgba(0, 0, 0, 0.3)',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontFamily: 'inherit',
    padding: 0,
  },

  headerSeparator: {
    height: 1,
    margin: '0 20px',
    background: 'linear-gradient(90deg, var(--cyan-glow, #00c8ff), rgba(0, 200, 255, 0.2), transparent)',
  },

  /* --- Body --- */
  body: {
    position: 'relative',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    zIndex: 5,
  },

  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },

  fieldLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '2px',
    color: 'var(--text-secondary, #7a8ba8)',
  },

  fieldLabelIcon: {
    fontSize: '8px',
    color: 'var(--cyan-glow, #00c8ff)',
    opacity: 0.6,
  },

  fieldRequired: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '7px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    color: 'var(--amber-alert, #ff9f1c)',
    marginLeft: 8,
    padding: '1px 5px',
    border: '1px solid rgba(255, 159, 28, 0.3)',
    background: 'rgba(255, 159, 28, 0.06)',
  },

  textarea: {
    width: '100%',
    minHeight: 100,
    padding: '12px 14px',
    background: 'var(--space-void, #0a0e17)',
    border: '1px solid rgba(0, 200, 255, 0.25)',
    borderRadius: 2,
    color: 'var(--text-primary, #e0f0ff)',
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: '1.5',
    letterSpacing: '0.3px',
    outline: 'none',
    resize: 'vertical' as const,
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    boxShadow: 'inset 0 0 15px rgba(0, 0, 0, 0.5)',
    boxSizing: 'border-box' as const,
  },

  textInput: {
    width: '100%',
    height: 38,
    padding: '0 14px',
    background: 'var(--space-void, #0a0e17)',
    border: '1px solid rgba(0, 200, 255, 0.25)',
    borderRadius: 2,
    color: 'var(--text-primary, #e0f0ff)',
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '12px',
    fontWeight: 400,
    letterSpacing: '0.5px',
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    boxShadow: 'inset 0 0 15px rgba(0, 0, 0, 0.5)',
    boxSizing: 'border-box' as const,
  },

  fieldHint: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '10px',
    fontWeight: 400,
    color: 'var(--text-secondary, #7a8ba8)',
    opacity: 0.5,
    letterSpacing: '0.3px',
  },

  /* --- Context Row --- */
  contextRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    background: 'rgba(0, 200, 255, 0.03)',
    border: '1px solid rgba(0, 200, 255, 0.1)',
    borderRadius: 2,
  },

  contextLabel: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '7px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    color: 'var(--text-secondary, #7a8ba8)',
    opacity: 0.6,
  },

  contextValue: {
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    color: 'var(--text-primary, #e0f0ff)',
  },

  contextDivider: {
    width: 1,
    height: 14,
    background: 'rgba(0, 200, 255, 0.15)',
  },

  contextValueMono: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '11px',
    fontWeight: 400,
    letterSpacing: '0.5px',
    color: 'var(--cyan-glow, #00c8ff)',
    opacity: 0.7,
  },

  /* --- Footer --- */
  footerSeparator: {
    height: 1,
    margin: '0 20px',
    background: 'linear-gradient(90deg, transparent, rgba(0, 200, 255, 0.2), transparent)',
  },

  footer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    zIndex: 5,
  },

  keyboardHint: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },

  keyboardKey: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '9px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    color: 'var(--text-secondary, #7a8ba8)',
    padding: '2px 6px',
    border: '1px solid rgba(0, 200, 255, 0.15)',
    borderRadius: 2,
    background: 'rgba(0, 0, 0, 0.3)',
  },

  keyboardPlus: {
    fontSize: '9px',
    color: 'var(--text-secondary, #7a8ba8)',
    opacity: 0.4,
  },

  keyboardHintText: {
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--text-secondary, #7a8ba8)',
    opacity: 0.4,
    marginLeft: 4,
  },

  footerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },

  cancelButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    padding: '0 22px',
    border: '1px solid rgba(122, 139, 168, 0.3)',
    borderRadius: 1,
    color: 'var(--text-secondary, #7a8ba8)',
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '2px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },

  launchButton: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 38,
    padding: '0 28px',
    border: '1px solid var(--cyan-glow, #00c8ff)',
    background: 'linear-gradient(180deg, rgba(0, 200, 255, 0.1) 0%, rgba(0, 200, 255, 0.03) 100%)',
    color: 'var(--cyan-glow, #00c8ff)',
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '3px',
    textTransform: 'uppercase' as const,
    transition: 'all 0.15s ease',
    clipPath: 'polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)',
    textShadow: '0 0 8px rgba(0, 200, 255, 0.5)',
  },

  launchButtonIcon: {
    fontSize: '10px',
    filter: 'drop-shadow(0 0 3px rgba(0, 200, 255, 0.5))',
  },
};
