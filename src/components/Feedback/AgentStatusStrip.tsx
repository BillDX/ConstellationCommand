import React from 'react';
import { useAgentStore } from '../../stores/agentStore';
import { useUIStore } from '../../stores/uiStore';

export default function AgentStatusStrip() {
  const { agents } = useAgentStore();
  const { openConsole } = useUIStore();
  const agentList = Object.values(agents);

  if (agentList.length === 0) return null;

  const statusColors: Record<string, string> = {
    active: 'var(--green-success, #00ff88)',
    launching: 'var(--amber-alert, #ff9f1c)',
    completed: 'var(--cyan-glow, #00c8ff)',
    error: 'var(--red-alert, #ff3344)',
    queued: 'var(--text-secondary, #7a8ba8)',
  };

  return (
    <div style={stripStyles.container}>
      {agentList.map(agent => (
        <button
          key={agent.id}
          onClick={() => openConsole(agent.id)}
          style={stripStyles.indicator}
        >
          <span style={{
            ...stripStyles.dot,
            backgroundColor: statusColors[agent.status] || statusColors.queued,
            boxShadow: `0 0 4px ${statusColors[agent.status] || statusColors.queued}`,
            animation: agent.status === 'active' ? 'pulse-glow 2s ease-in-out infinite' : 'none',
          }} />
          <span style={stripStyles.agentId}>{agent.id.slice(0, 6).toUpperCase()}</span>
          <span style={stripStyles.task}>{agent.task.slice(0, 30)}</span>
        </button>
      ))}
    </div>
  );
}

const stripStyles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    bottom: 64,
    left: 0,
    right: 0,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0 16px',
    background: 'rgba(13, 19, 33, 0.85)',
    borderTop: '1px solid rgba(0, 200, 255, 0.1)',
    zIndex: 105,
    animation: 'fade-in-up 0.3s ease-out',
    overflowX: 'auto',
  },
  indicator: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    padding: '2px 8px',
    transition: 'background 0.15s ease',
    flexShrink: 0,
  },
  dot: {
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
  agentId: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '9px',
    fontWeight: 600,
    letterSpacing: '1px',
    color: 'var(--cyan-glow, #00c8ff)',
    flexShrink: 0,
  },
  task: {
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--text-secondary, #7a8ba8)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 200,
  },
};
