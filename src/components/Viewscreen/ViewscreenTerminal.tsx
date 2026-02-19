import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import TerminalContainer from '../Console/TerminalContainer';

/* ============================================================
   ViewscreenTerminal — Star Trek Bridge Main Viewscreen

   A large LCARS-framed monitor that dominates the tactical view.
   When no channel is open, shows a standby/idle pattern.
   When a moon/planet is clicked, "opens a channel" and renders
   the agent's terminal session inside the viewscreen.
   ============================================================ */

interface ViewscreenTerminalProps {
  agentId: string | null;
  onCloseChannel: () => void;
  sendMessage: (msg: any) => void;
  authToken?: string | null;
}

/* ---------- Status Helpers ---------- */

function getStatusInfo(status: string): { label: string; color: string } {
  switch (status) {
    case 'active':
      return { label: 'ACTIVE', color: 'var(--green-success, #00ff88)' };
    case 'launching':
      return { label: 'LAUNCHING', color: 'var(--amber-alert, #ff9f1c)' };
    case 'completed':
      return { label: 'COMPLETED', color: '#5a7a9a' };
    case 'error':
      return { label: 'ERROR', color: 'var(--red-alert, #ff3344)' };
    default:
      return { label: status.toUpperCase(), color: 'var(--text-secondary, #7a8ba8)' };
  }
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

/* ---------- Keyframe Injection ---------- */

const KEYFRAME_ID = '__viewscreen-keyframes__';

function ensureKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAME_ID)) return;

  const style = document.createElement('style');
  style.id = KEYFRAME_ID;
  style.textContent = `
    @keyframes viewscreen-scanline {
      0% { top: -2px; opacity: 0; }
      5% { opacity: 0.6; }
      95% { opacity: 0.6; }
      100% { top: 100%; opacity: 0; }
    }

    @keyframes viewscreen-static {
      0% { background-position: 0 0; }
      100% { background-position: 0 -200px; }
    }

    @keyframes channel-open-flash {
      0% { opacity: 0.8; }
      15% { opacity: 0; }
      30% { opacity: 0.5; }
      45% { opacity: 0; }
      60% { opacity: 0.3; }
      100% { opacity: 0; }
    }

    @keyframes lcars-pulse {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1; }
    }

    @keyframes standby-drift {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }

    @keyframes viewscreen-power-on {
      0% {
        clip-path: inset(49.5% 0 49.5% 0);
        opacity: 0.5;
      }
      40% {
        clip-path: inset(49% 0 49% 0);
        opacity: 0.7;
      }
      70% {
        clip-path: inset(20% 0 20% 0);
        opacity: 0.9;
      }
      100% {
        clip-path: inset(0 0 0 0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
}

/* ==========================================================
   Main Component
   ========================================================== */

export default function ViewscreenTerminal({
  agentId,
  onCloseChannel,
  sendMessage,
  authToken,
}: ViewscreenTerminalProps) {
  ensureKeyframes();

  const agent = useAgentStore((state) => agentId ? state.agents[agentId] : null);
  const [elapsed, setElapsed] = useState(0);
  const [channelOpening, setChannelOpening] = useState(false);
  const prevAgentIdRef = useRef<string | null>(null);

  // Track channel open transition
  useEffect(() => {
    if (agentId && agentId !== prevAgentIdRef.current) {
      setChannelOpening(true);
      const timer = setTimeout(() => setChannelOpening(false), 600);
      prevAgentIdRef.current = agentId;
      return () => clearTimeout(timer);
    }
    if (!agentId) {
      prevAgentIdRef.current = null;
    }
  }, [agentId]);

  // Elapsed timer
  useEffect(() => {
    if (!agent) return;
    const { launchedAt, completedAt } = agent;
    if (completedAt) {
      setElapsed(completedAt - launchedAt);
      return;
    }
    const update = () => setElapsed(Date.now() - launchedAt);
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [agent?.launchedAt, agent?.completedAt]);

  const statusInfo = useMemo(
    () => getStatusInfo(agent?.status ?? 'queued'),
    [agent?.status],
  );

  const handleTerminate = useCallback(() => {
    if (agentId) {
      sendMessage({ type: 'agent:kill', agentId });
    }
  }, [agentId, sendMessage]);

  const isChannelOpen = !!agentId && !!agent;

  return (
    <div style={vs.outerFrame}>
      {/* ===== LCARS Top Bar ===== */}
      <div style={vs.lcarsTopBar}>
        <div style={vs.lcarsCapLeft} />
        <div style={vs.lcarsBarSegment1} />
        <div style={vs.lcarsLabelTop}>
          {isChannelOpen ? 'MAIN VIEWSCREEN' : 'MAIN VIEWSCREEN'}
        </div>
        <div style={vs.lcarsBarSegment2} />
        <div style={{
          ...vs.lcarsStatusIndicator,
          backgroundColor: isChannelOpen ? statusInfo.color : 'var(--text-secondary, #7a8ba8)',
          boxShadow: isChannelOpen
            ? `0 0 8px ${statusInfo.color}`
            : '0 0 4px rgba(122, 139, 168, 0.3)',
        }} />
        <div style={vs.lcarsBarSegment3} />
        <div style={vs.lcarsCapRight} />
      </div>

      {/* ===== Screen Area ===== */}
      <div style={vs.screenOuter}>
        <div style={vs.screenInner}>
          {/* Subtle CRT curvature overlay */}
          <div style={vs.crtCurvature} />

          {/* Scan line effect */}
          <div style={vs.screenScanline} />

          {/* Channel open flash */}
          {channelOpening && <div style={vs.channelFlash} />}

          {isChannelOpen ? (
            /* ===== CHANNEL OPEN — Terminal View ===== */
            <div style={{
              ...vs.channelContent,
              animation: channelOpening ? 'viewscreen-power-on 0.5s ease-out forwards' : undefined,
            }}>
              {/* Channel Header */}
              <div style={vs.channelHeader}>
                <div style={vs.channelHeaderLeft}>
                  <span style={{
                    ...vs.channelDot,
                    backgroundColor: statusInfo.color,
                    boxShadow: `0 0 6px ${statusInfo.color}`,
                    animation: agent?.status === 'active' ? 'pulse-glow 2s ease-in-out infinite' : undefined,
                  }} />
                  <span style={vs.channelLabel}>CHANNEL OPEN</span>
                  <span style={vs.channelSeparator}>{'\u2502'}</span>
                  <span style={vs.channelAgentId}>
                    AGENT {agentId!.slice(0, 8).toUpperCase()}
                  </span>
                </div>

                <div style={vs.channelHeaderRight}>
                  <span style={vs.channelMetric}>
                    <span style={vs.channelMetricLabel}>STATUS</span>
                    <span style={{ ...vs.channelMetricValue, color: statusInfo.color }}>
                      {statusInfo.label}
                    </span>
                  </span>
                  <span style={vs.channelMetric}>
                    <span style={vs.channelMetricLabel}>ELAPSED</span>
                    <span style={vs.channelMetricValue}>{formatElapsed(elapsed)}</span>
                  </span>
                  <span style={vs.channelMetric}>
                    <span style={vs.channelMetricLabel}>FILES</span>
                    <span style={vs.channelMetricValue}>{agent?.filesChanged ?? 0}</span>
                  </span>

                  {/* Close channel */}
                  <button onClick={onCloseChannel} style={vs.closeChannelBtn}>
                    CLOSE CHANNEL
                  </button>
                </div>
              </div>

              {/* Task description */}
              <div style={vs.taskBar}>
                <span style={vs.taskLabel}>MISSION:</span>
                <span style={vs.taskText}>{agent?.task ?? 'Unknown'}</span>
              </div>

              {/* Terminal area */}
              <div style={vs.terminalArea}>
                <TerminalContainer
                  agentId={agentId!}
                  sendMessage={sendMessage}
                  authToken={authToken}
                />
              </div>

              {/* Action bar */}
              {agent?.status === 'active' && (
                <div style={vs.actionBar}>
                  <button onClick={handleTerminate} style={vs.terminateBtn}>
                    TERMINATE AGENT
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ===== STANDBY — No Channel Open ===== */
            <div style={vs.standbyContainer}>
              <div style={vs.standbyIcon}>
                {/* Star Trek delta/chevron shape via CSS */}
                <svg width="60" height="70" viewBox="0 0 60 70" style={{ opacity: 0.3, animation: 'standby-drift 4s ease-in-out infinite' }}>
                  <path
                    d="M30 5 L55 60 Q30 45 5 60 Z"
                    fill="none"
                    stroke="var(--cyan-glow, #00c8ff)"
                    strokeWidth="1.5"
                    opacity="0.6"
                  />
                  <path
                    d="M30 15 L48 55 Q30 43 12 55 Z"
                    fill="rgba(0, 200, 255, 0.05)"
                    stroke="none"
                  />
                </svg>
              </div>
              <div style={vs.standbyLabel}>STANDBY</div>
              <div style={vs.standbySubtext}>
                Select an agent moon to open a channel
              </div>
              {/* Subtle animated scan line on standby */}
              <div style={vs.standbyScanline} />
            </div>
          )}
        </div>
      </div>

      {/* ===== LCARS Bottom Bar ===== */}
      <div style={vs.lcarsBottomBar}>
        <div style={vs.lcarsCapLeftBottom} />
        <div style={vs.lcarsBarSegmentBottom1} />
        <div style={vs.lcarsLabelBottom}>
          {isChannelOpen
            ? `SUBSPACE FREQ ${agentId!.slice(0, 4).toUpperCase()}.${agentId!.slice(4, 7).toUpperCase()}`
            : 'ALL FREQUENCIES CLEAR'
          }
        </div>
        <div style={vs.lcarsBarSegmentBottom2} />
        <div style={vs.lcarsCapRightBottom} />
      </div>
    </div>
  );
}

/* ==========================================================
   Styles — LCARS-inspired viewscreen monitor frame
   ========================================================== */

const LCARS_AMBER = '#f1a847';
const LCARS_SALMON = '#cc6699';
const LCARS_BLUE = '#7799cc';
const LCARS_ORANGE = '#dd8833';
const LCARS_LAVENDER = '#9977cc';

const vs: Record<string, React.CSSProperties> = {
  /* --- Outer Frame --- */
  outerFrame: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    gap: 0,
  },

  /* --- LCARS Top Bar --- */
  lcarsTopBar: {
    display: 'flex',
    alignItems: 'stretch',
    height: 32,
    flexShrink: 0,
    gap: 3,
  },

  lcarsCapLeft: {
    width: 60,
    backgroundColor: LCARS_AMBER,
    borderRadius: '16px 0 0 0',
    opacity: 0.85,
  },

  lcarsBarSegment1: {
    width: 40,
    backgroundColor: LCARS_SALMON,
    opacity: 0.7,
  },

  lcarsLabelTop: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '3px',
    color: LCARS_AMBER,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },

  lcarsBarSegment2: {
    flex: 1,
    backgroundColor: LCARS_BLUE,
    opacity: 0.5,
  },

  lcarsStatusIndicator: {
    width: 12,
    borderRadius: 6,
    flexShrink: 0,
    transition: 'all 0.3s ease',
  },

  lcarsBarSegment3: {
    width: 80,
    backgroundColor: LCARS_LAVENDER,
    opacity: 0.5,
  },

  lcarsCapRight: {
    width: 40,
    backgroundColor: LCARS_AMBER,
    borderRadius: '0 16px 0 0',
    opacity: 0.85,
  },

  /* --- Screen Area --- */
  screenOuter: {
    flex: 1,
    padding: '0 4px',
    display: 'flex',
    overflow: 'hidden',
  },

  screenInner: {
    flex: 1,
    position: 'relative',
    background: '#060a12',
    borderLeft: `3px solid ${LCARS_AMBER}88`,
    borderRight: `3px solid ${LCARS_AMBER}88`,
    overflow: 'hidden',
  },

  /* CRT curvature illusion */
  crtCurvature: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%)',
    pointerEvents: 'none',
    zIndex: 20,
  },

  /* Screen scan line */
  screenScanline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    background: 'linear-gradient(90deg, transparent 5%, rgba(0, 200, 255, 0.08) 20%, rgba(0, 200, 255, 0.08) 80%, transparent 95%)',
    animation: 'viewscreen-scanline 6s linear infinite',
    pointerEvents: 'none',
    zIndex: 21,
  },

  /* Channel open flash overlay */
  channelFlash: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0, 200, 255, 0.15)',
    animation: 'channel-open-flash 0.6s ease-out forwards',
    pointerEvents: 'none',
    zIndex: 22,
  },

  /* --- Channel Content (when open) --- */
  channelContent: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    position: 'relative',
    zIndex: 10,
  },

  channelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    background: 'rgba(0, 200, 255, 0.04)',
    borderBottom: '1px solid rgba(0, 200, 255, 0.15)',
    flexShrink: 0,
    gap: 12,
  },

  channelHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },

  channelDot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },

  channelLabel: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '2px',
    color: 'var(--cyan-glow, #00c8ff)',
    textShadow: '0 0 8px rgba(0, 200, 255, 0.4)',
  },

  channelSeparator: {
    color: 'rgba(0, 200, 255, 0.3)',
    fontSize: '14px',
  },

  channelAgentId: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '1px',
    color: 'var(--text-primary, #e0f0ff)',
  },

  channelHeaderRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flexShrink: 0,
  },

  channelMetric: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1,
  },

  channelMetricLabel: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '7px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: 'var(--text-secondary, #7a8ba8)',
    opacity: 0.6,
  },

  channelMetricValue: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    color: 'var(--text-primary, #e0f0ff)',
  },

  closeChannelBtn: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '8px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    color: 'var(--amber-alert, #ff9f1c)',
    border: '1px solid rgba(255, 159, 28, 0.4)',
    background: 'rgba(255, 159, 28, 0.08)',
    padding: '4px 12px',
    cursor: 'pointer',
    borderRadius: 2,
    transition: 'all 0.15s ease',
  },

  taskBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 16px',
    borderBottom: '1px solid rgba(0, 200, 255, 0.08)',
    background: 'rgba(0, 0, 0, 0.2)',
    flexShrink: 0,
  },

  taskLabel: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '8px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    color: 'var(--text-secondary, #7a8ba8)',
    opacity: 0.6,
    flexShrink: 0,
  },

  taskText: {
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-primary, #e0f0ff)',
    opacity: 0.8,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  terminalArea: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    background: '#0a0e17',
  },

  actionBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 16px',
    borderTop: '1px solid rgba(255, 51, 68, 0.15)',
    background: 'rgba(0, 0, 0, 0.3)',
    flexShrink: 0,
  },

  terminateBtn: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '8px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    color: 'var(--red-alert, #ff3344)',
    border: '1px solid rgba(255, 51, 68, 0.4)',
    background: 'rgba(255, 51, 68, 0.08)',
    padding: '5px 18px',
    cursor: 'pointer',
    borderRadius: 2,
    transition: 'all 0.15s ease',
  },

  /* --- Standby Screen --- */
  standbyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 16,
    position: 'relative',
    zIndex: 10,
  },

  standbyIcon: {
    opacity: 0.6,
  },

  standbyLabel: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '22px',
    fontWeight: 700,
    letterSpacing: '8px',
    color: 'var(--text-secondary, #7a8ba8)',
    textShadow: '0 0 15px rgba(122, 139, 168, 0.3)',
    opacity: 0.5,
    animation: 'lcars-pulse 4s ease-in-out infinite',
  },

  standbySubtext: {
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-secondary, #7a8ba8)',
    opacity: 0.35,
    letterSpacing: '1px',
  },

  standbyScanline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    background: 'linear-gradient(90deg, transparent 10%, rgba(122, 139, 168, 0.12) 30%, rgba(122, 139, 168, 0.12) 70%, transparent 90%)',
    animation: 'viewscreen-scanline 8s linear infinite',
    pointerEvents: 'none',
  },

  /* --- LCARS Bottom Bar --- */
  lcarsBottomBar: {
    display: 'flex',
    alignItems: 'stretch',
    height: 24,
    flexShrink: 0,
    gap: 3,
  },

  lcarsCapLeftBottom: {
    width: 60,
    backgroundColor: LCARS_AMBER,
    borderRadius: '0 0 0 16px',
    opacity: 0.85,
  },

  lcarsBarSegmentBottom1: {
    flex: 1,
    backgroundColor: LCARS_ORANGE,
    opacity: 0.5,
  },

  lcarsLabelBottom: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '9px',
    fontWeight: 500,
    letterSpacing: '1.5px',
    color: 'var(--text-secondary, #7a8ba8)',
    opacity: 0.6,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },

  lcarsBarSegmentBottom2: {
    width: 100,
    backgroundColor: LCARS_SALMON,
    opacity: 0.5,
  },

  lcarsCapRightBottom: {
    width: 40,
    backgroundColor: LCARS_AMBER,
    borderRadius: '0 0 16px 0',
    opacity: 0.85,
  },
};
