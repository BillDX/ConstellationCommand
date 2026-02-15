import React, { useMemo } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useAgentStore } from '../../stores/agentStore';
import { useLogStore } from '../../stores/logStore';
import type { Agent, LogEntry } from '../../types';

/* ============================================================
   StatusView - Ship Status / System Overview Dashboard

   A 2x2 grid dashboard showing the health of all systems at a
   glance: Ship Systems, Crew Manifest, Recent Activity, and
   Mission Overview. Reads directly from Zustand stores.
   ============================================================ */

/* ---------- Helpers ---------- */

function getAgentStatusColor(status: Agent['status']): string {
  switch (status) {
    case 'active':
      return '#00c8ff';
    case 'completed':
      return '#00ff88';
    case 'error':
      return '#ff3344';
    case 'launching':
      return '#ff9f1c';
    case 'queued':
    default:
      return '#7a8ba8';
  }
}

function getHealthColor(health: 'healthy' | 'warning' | 'error'): string {
  switch (health) {
    case 'healthy':
      return '#00ff88';
    case 'warning':
      return '#ff9f1c';
    case 'error':
      return '#ff3344';
  }
}

function getLogLevelColor(level: LogEntry['level']): string {
  switch (level) {
    case 'info':
      return '#00c8ff';
    case 'warn':
      return '#ff9f1c';
    case 'error':
      return '#ff3344';
    case 'success':
      return '#00ff88';
  }
}

function formatElapsed(launchedAt: number): string {
  const elapsed = Date.now() - launchedAt;
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/* ---------- Corner Decoration Sub-Component ---------- */

function CornerDecorations() {
  const size = 10;
  const thickness = 2;
  const color = 'rgba(0, 200, 255, 0.5)';

  const base: React.CSSProperties = {
    position: 'absolute',
    width: size,
    height: size,
    pointerEvents: 'none',
  };

  const hBar: React.CSSProperties = {
    position: 'absolute',
    width: size,
    height: thickness,
    background: color,
  };

  const vBar: React.CSSProperties = {
    position: 'absolute',
    width: thickness,
    height: size,
    background: color,
  };

  return (
    <>
      {/* Top-left */}
      <span style={{ ...base, top: 0, left: 0 }}>
        <span style={{ ...hBar, top: 0, left: 0 }} />
        <span style={{ ...vBar, top: 0, left: 0 }} />
      </span>
      {/* Top-right */}
      <span style={{ ...base, top: 0, right: 0 }}>
        <span style={{ ...hBar, top: 0, right: 0 }} />
        <span style={{ ...vBar, top: 0, right: 0 }} />
      </span>
      {/* Bottom-left */}
      <span style={{ ...base, bottom: 0, left: 0 }}>
        <span style={{ ...hBar, bottom: 0, left: 0 }} />
        <span style={{ ...vBar, bottom: 0, left: 0 }} />
      </span>
      {/* Bottom-right */}
      <span style={{ ...base, bottom: 0, right: 0 }}>
        <span style={{ ...hBar, bottom: 0, right: 0 }} />
        <span style={{ ...vBar, bottom: 0, right: 0 }} />
      </span>
    </>
  );
}

/* ---------- Progress Ring Sub-Component ---------- */

function ProgressRing({ progress, size = 96 }: { progress: number; size?: number }) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;
  const center = size / 2;

  const progressColor =
    progress >= 75 ? '#00ff88' : progress >= 40 ? '#ff9f1c' : '#ff3344';

  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      {/* Background ring */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="rgba(0, 200, 255, 0.1)"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={progressColor}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
        style={{
          filter: `drop-shadow(0 0 4px ${progressColor})`,
          transition: 'stroke-dashoffset 0.6s ease',
        }}
      />
      {/* Center text */}
      <text
        x={center}
        y={center}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontFamily: "'Orbitron', sans-serif",
          fontSize: '18px',
          fontWeight: 700,
          fill: '#e0f0ff',
        }}
      >
        {progress}%
      </text>
    </svg>
  );
}

/* ==========================================================
   Main StatusView Component
   ========================================================== */

export default function StatusView() {
  const { projects, activeProjectId } = useProjectStore();
  const { agents } = useAgentStore();
  const logs = useLogStore((s) => s.logs);

  const activeProject = activeProjectId ? projects[activeProjectId] : null;

  const allAgents = useMemo(() => Object.values(agents), [agents]);

  const projectAgents = useMemo(() => {
    if (!activeProject) return allAgents;
    return allAgents.filter((a) => a.projectId === activeProject.id);
  }, [allAgents, activeProject]);

  const activeAgentCount = useMemo(
    () => allAgents.filter((a) => a.status === 'active' || a.status === 'launching').length,
    [allAgents],
  );

  const totalFilesChanged = useMemo(
    () => projectAgents.reduce((sum, a) => sum + a.filesChanged, 0),
    [projectAgents],
  );

  const recentLogs = useMemo(() => {
    const sorted = [...logs].sort((a, b) => b.timestamp - a.timestamp);
    return sorted.slice(0, 10);
  }, [logs]);

  /* ---------- Ship Systems Data ---------- */

  const overallHealth = activeProject?.health ?? 'healthy';

  // Connection status: true if there are any active agents
  const isConnected = activeAgentCount > 0;

  // Build status: check for recent build errors
  const hasBuildError = allAgents.some(
    (a) => a.status === 'error',
  );

  const systems = useMemo(() => {
    const healthValue =
      overallHealth === 'healthy' ? 100 : overallHealth === 'warning' ? 60 : 25;
    const crewValue =
      allAgents.length > 0
        ? Math.round((activeAgentCount / allAgents.length) * 100)
        : 0;
    const shieldValue = isConnected ? 100 : 30;
    const warpValue = hasBuildError ? 20 : activeAgentCount > 0 ? 100 : 50;

    return [
      {
        name: 'HULL INTEGRITY',
        value: healthValue,
        label: `${healthValue}%`,
        color:
          healthValue >= 75
            ? '#00ff88'
            : healthValue >= 50
            ? '#ff9f1c'
            : '#ff3344',
      },
      {
        name: 'CREW',
        value: crewValue,
        label: `${activeAgentCount} / ${allAgents.length}`,
        color:
          crewValue >= 75
            ? '#00ff88'
            : crewValue >= 40
            ? '#ff9f1c'
            : allAgents.length === 0
            ? '#7a8ba8'
            : '#ff3344',
      },
      {
        name: 'SHIELDS',
        value: shieldValue,
        label: isConnected ? 'ONLINE' : 'STANDBY',
        color: isConnected ? '#00ff88' : '#ff9f1c',
      },
      {
        name: 'WARP CORE',
        value: warpValue,
        label: hasBuildError ? 'FAULT' : activeAgentCount > 0 ? 'NOMINAL' : 'IDLE',
        color: hasBuildError
          ? '#ff3344'
          : activeAgentCount > 0
          ? '#00ff88'
          : '#ff9f1c',
      },
    ];
  }, [overallHealth, activeAgentCount, allAgents.length, isConnected, hasBuildError]);

  /* ---------- Render ---------- */

  return (
    <div style={styles.container}>
      {/* Scanline texture */}
      <div style={styles.scanlineTexture} />

      {/* 2x2 Grid */}
      <div style={styles.grid}>
        {/* ====== PANEL 1: Ship Systems (top-left) ====== */}
        <div style={styles.panel}>
          <CornerDecorations />
          <div style={styles.panelHeader}>
            <span style={styles.panelIcon}>{'\u2B21'}</span>
            <span style={styles.panelTitle}>SHIP SYSTEMS</span>
            <span
              style={{
                ...styles.statusIndicator,
                backgroundColor: getHealthColor(overallHealth),
                boxShadow: `0 0 8px ${getHealthColor(overallHealth)}`,
              }}
            />
          </div>
          <div style={styles.panelBody}>
            {systems.map((sys) => (
              <div key={sys.name} style={styles.systemRow}>
                <span style={styles.systemName}>{sys.name}</span>
                <span style={styles.systemLabel}>{sys.label}</span>
                <div style={styles.progressBarTrack}>
                  <div
                    style={{
                      ...styles.progressBarFill,
                      width: `${sys.value}%`,
                      backgroundColor: sys.color,
                      boxShadow: `0 0 6px ${sys.color}, inset 0 0 4px rgba(255,255,255,0.1)`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ====== PANEL 2: Crew Manifest (top-right) ====== */}
        <div style={styles.panel}>
          <CornerDecorations />
          <div style={styles.panelHeader}>
            <span style={styles.panelIcon}>{'\u25C9'}</span>
            <span style={styles.panelTitle}>CREW MANIFEST</span>
          </div>
          <div style={styles.panelBodyScroll}>
            {allAgents.length === 0 && (
              <div style={styles.emptyState}>
                <span style={styles.emptyIcon}>{'\u25C7'}</span>
                <span style={styles.emptyText}>No crew deployed</span>
              </div>
            )}
            {allAgents.map((agent) => (
              <div key={agent.id} style={styles.agentRow}>
                <span
                  style={{
                    ...styles.agentStatusDot,
                    backgroundColor: getAgentStatusColor(agent.status),
                    boxShadow: `0 0 6px ${getAgentStatusColor(agent.status)}`,
                  }}
                />
                <span style={styles.agentId}>
                  {agent.id.slice(0, 8).toUpperCase()}
                </span>
                <span style={styles.agentTask}>
                  {agent.task.length > 40
                    ? agent.task.slice(0, 40) + '...'
                    : agent.task}
                </span>
                <span style={styles.agentElapsed}>
                  {formatElapsed(agent.launchedAt)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ====== PANEL 3: Recent Activity (bottom-left) ====== */}
        <div style={styles.panel}>
          <CornerDecorations />
          <div style={styles.panelHeader}>
            <span style={styles.panelIcon}>{'\u25A3'}</span>
            <span style={styles.panelTitle}>RECENT ACTIVITY</span>
          </div>
          <div style={styles.panelBodyScroll}>
            {recentLogs.length === 0 && (
              <div style={styles.emptyState}>
                <span style={styles.emptyIcon}>{'\u25C7'}</span>
                <span style={styles.emptyText}>No recent activity</span>
              </div>
            )}
            {recentLogs.map((entry) => (
              <div key={entry.id} style={styles.logRow}>
                <span style={styles.logTimestamp}>
                  {formatTimestamp(entry.timestamp)}
                </span>
                <span
                  style={{
                    ...styles.logLevel,
                    color: getLogLevelColor(entry.level),
                  }}
                >
                  {entry.level.toUpperCase().padEnd(4)}
                </span>
                <span style={styles.logSource}>[{entry.source}]</span>
                <span style={styles.logMessage}>{entry.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ====== PANEL 4: Mission Overview (bottom-right) ====== */}
        <div style={styles.panel}>
          <CornerDecorations />
          <div style={styles.panelHeader}>
            <span style={styles.panelIcon}>{'\u25C8'}</span>
            <span style={styles.panelTitle}>MISSION OVERVIEW</span>
          </div>
          <div style={styles.panelBody}>
            {!activeProject ? (
              <div style={styles.emptyState}>
                <span style={styles.emptyIcon}>{'\u25C7'}</span>
                <span style={styles.emptyText}>No active mission</span>
              </div>
            ) : (
              <div style={styles.missionContent}>
                {/* Project name + description */}
                <div style={styles.missionInfo}>
                  <h2 style={styles.missionName}>{activeProject.name}</h2>
                  <p style={styles.missionDescription}>
                    {activeProject.description}
                  </p>

                  {/* Stats row */}
                  <div style={styles.missionStats}>
                    <div style={styles.statItem}>
                      <span style={styles.statValue}>{totalFilesChanged}</span>
                      <span style={styles.statLabel}>FILES</span>
                    </div>
                    <div style={styles.statDivider} />
                    <div style={styles.statItem}>
                      <span style={styles.statValue}>
                        {projectAgents.length}
                      </span>
                      <span style={styles.statLabel}>AGENTS</span>
                    </div>
                    <div style={styles.statDivider} />
                    <div style={styles.statItem}>
                      <span
                        style={{
                          ...styles.statValue,
                          color: getHealthColor(activeProject.health),
                        }}
                      >
                        {activeProject.health.toUpperCase()}
                      </span>
                      <span style={styles.statLabel}>HEALTH</span>
                    </div>
                  </div>
                </div>

                {/* Progress ring */}
                <div style={styles.progressRingContainer}>
                  <ProgressRing progress={activeProject.progress} />
                  <span style={styles.progressLabel}>MISSION PROGRESS</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================
   Styles
   ========================================================== */

const styles: Record<string, React.CSSProperties> = {
  /* --- Container --- */
  container: {
    position: 'fixed',
    top: 48,
    left: 220,
    right: 0,
    bottom: 64,
    overflow: 'hidden',
    zIndex: 50,
    animation: 'fade-in 0.4s ease-out',
  },

  scanlineTexture: {
    position: 'absolute',
    inset: 0,
    background:
      'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 200, 255, 0.012) 2px, rgba(0, 200, 255, 0.012) 4px)',
    pointerEvents: 'none',
    zIndex: 1,
  },

  /* --- Grid Layout --- */
  grid: {
    position: 'relative',
    zIndex: 2,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr 1fr',
    gap: 16,
    padding: 16,
    height: '100%',
    boxSizing: 'border-box' as const,
  },

  /* --- Panel --- */
  panel: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(13, 19, 33, 0.85)',
    border: '1px solid rgba(0, 200, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
    backdropFilter: 'blur(8px)',
    boxShadow:
      '0 0 20px rgba(0, 0, 0, 0.3), inset 0 0 30px rgba(0, 200, 255, 0.02)',
  },

  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    borderBottom: '1px solid rgba(0, 200, 255, 0.15)',
    background:
      'linear-gradient(180deg, rgba(0, 200, 255, 0.04) 0%, transparent 100%)',
    flexShrink: 0,
  },

  panelIcon: {
    fontSize: '14px',
    color: '#00c8ff',
    filter: 'drop-shadow(0 0 4px rgba(0, 200, 255, 0.5))',
    flexShrink: 0,
  },

  panelTitle: {
    fontFamily: "'Orbitron', sans-serif",
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '2.5px',
    color: '#00c8ff',
    textShadow: '0 0 10px rgba(0, 200, 255, 0.4)',
    flex: 1,
  },

  statusIndicator: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },

  /* --- Panel Bodies --- */
  panelBody: {
    flex: 1,
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 10,
    overflow: 'hidden',
  },

  panelBodyScroll: {
    flex: 1,
    padding: '4px 0',
    overflowY: 'auto',
    overflowX: 'hidden',
    scrollbarWidth: 'thin' as const,
    scrollbarColor: 'rgba(0, 200, 255, 0.2) transparent',
  },

  /* --- Empty State --- */
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '24px 16px',
    opacity: 0.5,
    flex: 1,
  },

  emptyIcon: {
    fontSize: '24px',
    color: '#00c8ff',
    opacity: 0.4,
  },

  emptyText: {
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: '13px',
    fontWeight: 500,
    color: '#7a8ba8',
    letterSpacing: '0.5px',
  },

  /* --- Panel 1: Ship Systems --- */
  systemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '6px 0',
  },

  systemName: {
    fontFamily: "'Orbitron', sans-serif",
    fontSize: '9px',
    fontWeight: 600,
    letterSpacing: '1.5px',
    color: '#7a8ba8',
    width: 110,
    flexShrink: 0,
  },

  systemLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '1px',
    color: '#e0f0ff',
    width: 70,
    textAlign: 'right' as const,
    flexShrink: 0,
  },

  progressBarTrack: {
    flex: 1,
    height: 4,
    background: 'rgba(0, 200, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },

  progressBarFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.6s ease, background-color 0.3s ease',
  },

  /* --- Panel 2: Crew Manifest --- */
  agentRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '7px 16px',
    borderBottom: '1px solid rgba(0, 200, 255, 0.06)',
    transition: 'background 0.15s ease',
  },

  agentStatusDot: {
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },

  agentId: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '1px',
    color: '#00c8ff',
    textShadow: '0 0 6px rgba(0, 200, 255, 0.3)',
    width: 72,
    flexShrink: 0,
  },

  agentTask: {
    flex: 1,
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: '12px',
    fontWeight: 500,
    color: '#e0f0ff',
    opacity: 0.8,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },

  agentElapsed: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '10px',
    fontWeight: 400,
    color: '#7a8ba8',
    opacity: 0.7,
    flexShrink: 0,
    letterSpacing: '0.5px',
    minWidth: 48,
    textAlign: 'right' as const,
  },

  /* --- Panel 3: Recent Activity --- */
  logRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 16px',
    borderBottom: '1px solid rgba(0, 200, 255, 0.04)',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '10px',
    lineHeight: '1.4',
  },

  logTimestamp: {
    color: '#7a8ba8',
    opacity: 0.6,
    flexShrink: 0,
    letterSpacing: '0.5px',
    width: 64,
  },

  logLevel: {
    fontWeight: 700,
    letterSpacing: '0.5px',
    flexShrink: 0,
    width: 40,
    textTransform: 'uppercase' as const,
  },

  logSource: {
    color: '#7a8ba8',
    opacity: 0.7,
    flexShrink: 0,
    maxWidth: 80,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  logMessage: {
    flex: 1,
    color: '#e0f0ff',
    opacity: 0.85,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },

  /* --- Panel 4: Mission Overview --- */
  missionContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    flex: 1,
  },

  missionInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minWidth: 0,
  },

  missionName: {
    fontFamily: "'Orbitron', sans-serif",
    fontSize: '16px',
    fontWeight: 700,
    letterSpacing: '2px',
    color: '#e0f0ff',
    textShadow: '0 0 10px rgba(224, 240, 255, 0.2)',
    margin: 0,
    textTransform: 'uppercase' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  missionDescription: {
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: '13px',
    fontWeight: 500,
    lineHeight: '1.4',
    color: '#7a8ba8',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  missionStats: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    paddingTop: 12,
    borderTop: '1px solid rgba(0, 200, 255, 0.1)',
    marginTop: 4,
  },

  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },

  statValue: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '16px',
    fontWeight: 700,
    color: '#e0f0ff',
    letterSpacing: '1px',
  },

  statLabel: {
    fontFamily: "'Orbitron', sans-serif",
    fontSize: '7px',
    fontWeight: 600,
    letterSpacing: '1.5px',
    color: '#7a8ba8',
    opacity: 0.7,
  },

  statDivider: {
    width: 1,
    height: 28,
    background: 'rgba(0, 200, 255, 0.15)',
  },

  progressRingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },

  progressLabel: {
    fontFamily: "'Orbitron', sans-serif",
    fontSize: '7px',
    fontWeight: 600,
    letterSpacing: '1.5px',
    color: '#7a8ba8',
    opacity: 0.7,
  },
};
