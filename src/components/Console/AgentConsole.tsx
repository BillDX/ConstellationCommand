import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import ActivityFeed from './ActivityFeed';
import TerminalContainer from './TerminalContainer';

/* ============================================================
   AgentConsole - Slide-in Bridge Console Panel

   Full-height slide-in panel from the right side of the viewport.
   Contains terminal output, command input, activity feed, and
   agent action controls. Styled as a starship bridge console.
   ============================================================ */

interface AgentConsoleProps {
  agentId: string;
  onClose: () => void;
  sendMessage: (msg: any) => void;
}

/* ---------- Status Display Helpers ---------- */

interface StatusVisual {
  color: string;
  glowColor: string;
  label: string;
}

function getStatusVisual(status: string): StatusVisual {
  switch (status) {
    case 'active':
      return {
        color: 'var(--green-success, #00ff88)',
        glowColor: 'rgba(0, 255, 136, 0.5)',
        label: 'ACTIVE',
      };
    case 'launching':
      return {
        color: 'var(--amber-alert, #ff9f1c)',
        glowColor: 'rgba(255, 159, 28, 0.5)',
        label: 'LAUNCHING',
      };
    case 'queued':
      return {
        color: 'var(--text-secondary, #7a8ba8)',
        glowColor: 'rgba(122, 139, 168, 0.3)',
        label: 'QUEUED',
      };
    case 'completed':
      return {
        color: 'var(--cyan-glow, #00c8ff)',
        glowColor: 'rgba(0, 200, 255, 0.5)',
        label: 'COMPLETED',
      };
    case 'error':
      return {
        color: 'var(--red-alert, #ff3344)',
        glowColor: 'rgba(255, 51, 68, 0.5)',
        label: 'ERROR',
      };
    default:
      return {
        color: 'var(--text-secondary, #7a8ba8)',
        glowColor: 'rgba(122, 139, 168, 0.3)',
        label: status.toUpperCase(),
      };
  }
}

/* ---------- Elapsed Time Formatter ---------- */

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const pad = (n: number) => String(n).padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/* ==========================================================
   Main Component
   ========================================================== */

export default function AgentConsole({ agentId, onClose, sendMessage }: AgentConsoleProps) {
  const agent = useAgentStore((state) => state.agents[agentId]);
  const [commandInput, setCommandInput] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  /* ---------- Elapsed Timer ---------- */
  useEffect(() => {
    if (!agent) return;

    const launchedAt = agent.launchedAt;
    const completedAt = agent.completedAt;

    // If completed, show final elapsed time
    if (completedAt) {
      setElapsed(completedAt - launchedAt);
      return;
    }

    // Update every second while active
    const update = () => setElapsed(Date.now() - launchedAt);
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [agent?.launchedAt, agent?.completedAt]);

  /* ---------- Command Input Handler ---------- */
  const handleCommandSubmit = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && commandInput.trim()) {
        sendMessage({
          type: 'terminal:input',
          agentId,
          data: commandInput + '\n',
        });
        setCommandInput('');
      }
    },
    [commandInput, agentId, sendMessage],
  );

  /* ---------- Action Button Handlers ---------- */
  const handleTerminate = useCallback(() => {
    sendMessage({ type: 'agent:kill', agentId });
  }, [agentId, sendMessage]);

  /* ---------- Close with Animation ---------- */
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  }, [onClose]);

  /* ---------- Derived State ---------- */
  const statusVisual = useMemo(
    () => getStatusVisual(agent?.status ?? 'queued'),
    [agent?.status],
  );

  const events = agent?.events ?? [];
  const filesChanged = agent?.filesChanged ?? 0;
  const agentTask = agent?.task ?? 'Unknown Task';

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          ...styles.backdrop,
          opacity: isClosing ? 0 : 1,
        }}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        style={{
          ...styles.panel,
          transform: isClosing ? 'translateX(100%)' : 'translateX(0)',
        }}
      >
        {/* Scan-line texture overlay */}
        <div style={styles.scanlineTexture} />

        {/* Cyan left edge border glow */}
        <div style={styles.leftEdgeGlow} />

        {/* ========== HEADER ========== */}
        <header style={styles.header}>
          <div style={styles.headerContent}>
            {/* Agent Info */}
            <div style={styles.headerLeft}>
              <div style={styles.agentName}>
                <span style={styles.agentIdLabel}>AGENT</span>
                <span style={styles.agentIdValue}>{agentId.slice(0, 8).toUpperCase()}</span>
              </div>
              <div style={styles.taskText}>{agentTask}</div>
            </div>

            {/* Status Indicators */}
            <div style={styles.headerRight}>
              {/* Status Badge */}
              <div style={styles.statusBadge}>
                <span
                  style={{
                    ...styles.statusDot,
                    backgroundColor: statusVisual.color,
                    boxShadow: `0 0 6px ${statusVisual.glowColor}`,
                    animation:
                      agent?.status === 'active' || agent?.status === 'launching'
                        ? 'pulse-glow 2s ease-in-out infinite'
                        : 'none',
                  }}
                />
                <span
                  style={{
                    ...styles.statusLabel,
                    color: statusVisual.color,
                  }}
                >
                  {statusVisual.label}
                </span>
              </div>

              {/* Elapsed Time */}
              <div style={styles.metricBox}>
                <span style={styles.metricLabel}>ELAPSED</span>
                <span style={styles.metricValue}>{formatElapsed(elapsed)}</span>
              </div>

              {/* Files Touched */}
              <div style={styles.metricBox}>
                <span style={styles.metricLabel}>FILES</span>
                <span style={styles.metricValue}>{filesChanged}</span>
              </div>

              {/* Close Button */}
              <button
                onClick={handleClose}
                style={styles.closeButton}
                aria-label="Close agent console"
              >
                {'\u2715'}
              </button>
            </div>
          </div>

          {/* Header bottom separator */}
          <div style={styles.headerSeparator} />
        </header>

        {/* ========== COMPLETION / ERROR BANNERS ========== */}
        {agent?.status === 'completed' && (
          <div style={{
            padding: '12px 20px',
            background: 'rgba(0, 255, 136, 0.08)',
            borderBottom: '1px solid rgba(0, 255, 136, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            zIndex: 5,
            position: 'relative',
          }}>
            <span style={{ fontSize: '14px', color: 'var(--green-success, #00ff88)' }}>{'\u2713'}</span>
            <span style={{
              fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '3px',
              color: 'var(--green-success, #00ff88)',
              textShadow: '0 0 10px rgba(0, 255, 136, 0.5)',
            }}>MISSION COMPLETE</span>
          </div>
        )}
        {agent?.status === 'error' && (
          <div style={{
            padding: '12px 20px',
            background: 'rgba(255, 51, 68, 0.08)',
            borderBottom: '1px solid rgba(255, 51, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            zIndex: 5,
            position: 'relative',
          }}>
            <span style={{ fontSize: '14px', color: 'var(--red-alert, #ff3344)' }}>{'\u2717'}</span>
            <span style={{
              fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '3px',
              color: 'var(--red-alert, #ff3344)',
              textShadow: '0 0 10px rgba(255, 51, 68, 0.5)',
            }}>AGENT ERROR</span>
          </div>
        )}

        {/* ========== MAIN CONTENT ========== */}
        <div style={styles.mainContent}>
          {/* Terminal + Command Input Area */}
          <div style={styles.terminalArea}>
            {/* Terminal Window */}
            <div style={styles.terminalWindow}>
              {/* Terminal header bar */}
              <div style={styles.terminalHeader}>
                <span style={styles.terminalHeaderDot} />
                <span style={styles.terminalHeaderTitle}>TERMINAL SESSION</span>
                <span style={styles.terminalHeaderId}>{agentId.slice(0, 12)}</span>
              </div>

              {/* Terminal content */}
              <div style={styles.terminalContent}>
                <TerminalContainer agentId={agentId} sendMessage={sendMessage} />
              </div>
            </div>

            {/* Command Input */}
            <div style={styles.commandInputContainer}>
              <span style={styles.commandPrompt}>{'\u25B6'}</span>
              <input
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={handleCommandSubmit}
                placeholder="Enter command..."
                style={styles.commandInput}
                spellCheck={false}
                autoComplete="off"
              />
              <span style={styles.commandHint}>ENTER</span>
            </div>
          </div>

          {/* Activity Feed Sidebar */}
          <div style={styles.activitySidebar}>
            <ActivityFeed events={events} />
          </div>
        </div>

        {/* ========== ACTION BUTTONS ========== */}
        <footer style={styles.footer}>
          <div style={styles.footerSeparator} />
          <div style={styles.actionRow}>
            {/* Terminate Agent */}
            <button
              onClick={handleTerminate}
              style={{
                ...styles.actionButton,
                borderColor: agent?.status === 'completed'
                  ? 'var(--text-secondary, #7a8ba8)'
                  : 'var(--red-alert, #ff3344)',
                color: agent?.status === 'completed'
                  ? 'var(--text-secondary, #7a8ba8)'
                  : 'var(--red-alert, #ff3344)',
                boxShadow: agent?.status === 'completed'
                  ? '0 0 8px rgba(122, 139, 168, 0.2)'
                  : '0 0 8px rgba(255, 51, 68, 0.3)',
              }}
            >
              <span style={styles.cornerClipTL} />
              <span style={styles.cornerClipTR} />
              <span style={styles.cornerClipBL} />
              <span style={styles.cornerClipBR} />
              <span style={styles.actionButtonLabel}>TERMINATE AGENT</span>
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
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(2px)',
    zIndex: 500,
    transition: 'opacity 0.3s ease',
  },

  /* --- Panel --- */
  panel: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: '50vw',
    minWidth: 500,
    background: 'var(--panel-bg, rgba(13, 19, 33, 0.85))',
    backdropFilter: 'blur(12px)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 510,
    overflow: 'hidden',
    transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
    animation: 'slide-in-right 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
    boxShadow: '-4px 0 40px rgba(0, 0, 0, 0.5), -1px 0 0 rgba(0, 200, 255, 0.3)',
  },

  /* --- Scan-line Texture Overlay --- */
  scanlineTexture: {
    position: 'absolute',
    inset: 0,
    background:
      'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 200, 255, 0.015) 2px, rgba(0, 200, 255, 0.015) 4px)',
    pointerEvents: 'none',
    zIndex: 1,
  },

  /* --- Left Edge Cyan Glow --- */
  leftEdgeGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 2,
    background: 'var(--cyan-glow, #00c8ff)',
    boxShadow: '0 0 12px rgba(0, 200, 255, 0.6), 0 0 30px rgba(0, 200, 255, 0.2), 2px 0 20px rgba(0, 200, 255, 0.1)',
    zIndex: 2,
  },

  /* --- Header --- */
  header: {
    position: 'relative',
    flexShrink: 0,
    zIndex: 5,
    padding: '16px 20px 0',
  },

  headerContent: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },

  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },

  agentName: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },

  agentIdLabel: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '2px',
    color: 'var(--text-secondary, #7a8ba8)',
  },

  agentIdValue: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '1.5px',
    color: 'var(--cyan-glow, #00c8ff)',
    textShadow: '0 0 8px rgba(0, 200, 255, 0.4)',
  },

  taskText: {
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-primary, #e0f0ff)',
    opacity: 0.85,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flexShrink: 0,
  },

  /* --- Status Badge --- */
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(0, 200, 255, 0.15)',
    borderRadius: 3,
  },

  statusDot: {
    display: 'inline-block',
    width: 7,
    height: 7,
    borderRadius: '50%',
  },

  statusLabel: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '1.5px',
  },

  /* --- Metric Boxes --- */
  metricBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },

  metricLabel: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '7px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    color: 'var(--text-secondary, #7a8ba8)',
    opacity: 0.7,
  },

  metricValue: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '1px',
    color: 'var(--text-primary, #e0f0ff)',
    textShadow: '0 0 4px rgba(224, 240, 255, 0.2)',
  },

  /* --- Close Button --- */
  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    border: '1px solid rgba(0, 200, 255, 0.2)',
    borderRadius: 2,
    background: 'rgba(0, 0, 0, 0.3)',
    color: 'var(--text-secondary, #7a8ba8)',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontFamily: 'inherit',
  },

  headerSeparator: {
    marginTop: 12,
    height: 1,
    background: 'linear-gradient(90deg, var(--cyan-glow, #00c8ff) 0%, rgba(0, 200, 255, 0.2) 40%, transparent 100%)',
  },

  /* --- Main Content Area --- */
  mainContent: {
    position: 'relative',
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    zIndex: 5,
  },

  /* --- Terminal Area (left portion) --- */
  terminalArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    padding: '12px 0 12px 20px',
  },

  terminalWindow: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid rgba(0, 255, 136, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    background: '#0a0e17',
    boxShadow: 'inset 0 0 30px rgba(0, 0, 0, 0.5), 0 0 10px rgba(0, 255, 136, 0.05)',
  },

  terminalHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    background: 'rgba(0, 255, 136, 0.05)',
    borderBottom: '1px solid rgba(0, 255, 136, 0.15)',
    flexShrink: 0,
  },

  terminalHeaderDot: {
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: 'var(--green-success, #00ff88)',
    boxShadow: '0 0 4px rgba(0, 255, 136, 0.5)',
  },

  terminalHeaderTitle: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '8px',
    fontWeight: 700,
    letterSpacing: '2px',
    color: 'var(--green-success, #00ff88)',
    opacity: 0.7,
  },

  terminalHeaderId: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '9px',
    color: 'var(--text-secondary, #7a8ba8)',
    marginLeft: 'auto',
    opacity: 0.5,
  },

  terminalContent: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },

  /* --- Command Input --- */
  commandInputContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: '0 2px',
    flexShrink: 0,
  },

  commandPrompt: {
    fontSize: '10px',
    color: 'var(--cyan-glow, #00c8ff)',
    textShadow: '0 0 6px rgba(0, 200, 255, 0.5)',
    flexShrink: 0,
  },

  commandInput: {
    flex: 1,
    height: 36,
    padding: '0 12px',
    background: 'rgba(10, 14, 23, 0.9)',
    border: '1px solid rgba(0, 200, 255, 0.3)',
    borderRadius: 2,
    color: 'var(--text-primary, #e0f0ff)',
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '14px',
    fontWeight: 500,
    letterSpacing: '0.5px',
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    boxShadow: 'inset 0 0 10px rgba(0, 0, 0, 0.4)',
  },

  commandHint: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '7px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    color: 'var(--text-secondary, #7a8ba8)',
    opacity: 0.4,
    flexShrink: 0,
  },

  /* --- Activity Sidebar --- */
  activitySidebar: {
    width: 200,
    flexShrink: 0,
    borderLeft: '1px solid rgba(0, 200, 255, 0.1)',
    background: 'rgba(0, 0, 0, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },

  /* --- Footer / Action Buttons --- */
  footer: {
    position: 'relative',
    flexShrink: 0,
    zIndex: 5,
    padding: '0 20px 16px',
  },

  footerSeparator: {
    height: 1,
    background: 'linear-gradient(90deg, var(--cyan-glow, #00c8ff) 0%, rgba(0, 200, 255, 0.2) 40%, transparent 100%)',
    marginBottom: 12,
  },

  actionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  /* --- Action Button (matching HUD BottomBar style) --- */
  actionButton: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    padding: '0 22px',
    border: '1px solid',
    background: 'linear-gradient(180deg, rgba(0, 200, 255, 0.06) 0%, rgba(0, 200, 255, 0.02) 100%)',
    cursor: 'pointer',
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    textTransform: 'uppercase' as const,
    transition: 'all 0.15s ease',
    clipPath:
      'polygon(6px 0%, calc(100% - 6px) 0%, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0% calc(100% - 6px), 0% 6px)',
    overflow: 'hidden',
  },

  cornerClipTL: {
    position: 'absolute',
    width: 6,
    height: 6,
    top: -1,
    left: -1,
    pointerEvents: 'none',
  },

  cornerClipTR: {
    position: 'absolute',
    width: 6,
    height: 6,
    top: -1,
    right: -1,
    transform: 'scaleX(-1)',
    pointerEvents: 'none',
  },

  cornerClipBL: {
    position: 'absolute',
    width: 6,
    height: 6,
    bottom: -1,
    left: -1,
    transform: 'scaleY(-1)',
    pointerEvents: 'none',
  },

  cornerClipBR: {
    position: 'absolute',
    width: 6,
    height: 6,
    bottom: -1,
    right: -1,
    transform: 'scale(-1)',
    pointerEvents: 'none',
  },

  actionButtonLabel: {
    position: 'relative',
    zIndex: 1,
  },
};
