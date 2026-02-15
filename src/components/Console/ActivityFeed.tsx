import React, { useEffect, useRef } from 'react';
import type { AgentEvent } from '../../types';

/* ============================================================
   ActivityFeed - Telemetry Event Stream

   Scrollable event list that auto-scrolls to bottom on new events.
   Displays parsed agent events with type-based icons and relative
   timestamps. Designed for the right sidebar of the Agent Console.
   ============================================================ */

interface ActivityFeedProps {
  events: AgentEvent[];
}

/* ---------- Event Icon/Color Mapping ---------- */

interface EventVisual {
  icon: string;
  color: string;
  glowColor: string;
}

function getEventVisual(type: AgentEvent['type']): EventVisual {
  switch (type) {
    case 'file:created':
      return { icon: '+', color: 'var(--green-success, #00ff88)', glowColor: 'rgba(0, 255, 136, 0.4)' };
    case 'file:edited':
      return { icon: '~', color: 'var(--cyan-glow, #00c8ff)', glowColor: 'rgba(0, 200, 255, 0.4)' };
    case 'build:started':
      return { icon: '\u25B6', color: 'var(--amber-alert, #ff9f1c)', glowColor: 'rgba(255, 159, 28, 0.4)' };
    case 'build:succeeded':
      return { icon: '\u2713', color: 'var(--green-success, #00ff88)', glowColor: 'rgba(0, 255, 136, 0.4)' };
    case 'build:error':
      return { icon: '!', color: 'var(--red-alert, #ff3344)', glowColor: 'rgba(255, 51, 68, 0.4)' };
    case 'task:completed':
      return { icon: '\u2605', color: '#ffd700', glowColor: 'rgba(255, 215, 0, 0.4)' };
    case 'info':
    default:
      return { icon: '\u2022', color: 'var(--text-secondary, #7a8ba8)', glowColor: 'rgba(122, 139, 168, 0.3)' };
  }
}

/* ---------- Event Description ---------- */

function getEventDescription(event: AgentEvent): string {
  const { type, detail } = event;
  const path = detail?.path || detail?.file || '';
  const shortPath = path ? path.split('/').slice(-2).join('/') : '';

  switch (type) {
    case 'file:created':
      return shortPath ? `Created ${shortPath}` : 'File created';
    case 'file:edited':
      return shortPath ? `Edited ${shortPath}` : 'File edited';
    case 'build:started':
      return detail?.command ? `Build: ${detail.command}` : 'Build started';
    case 'build:succeeded':
      return 'Build succeeded';
    case 'build:error':
      return detail?.message ? `Error: ${detail.message}` : 'Build error';
    case 'task:completed':
      return detail?.summary || 'Task completed';
    case 'info':
      return detail?.message || 'Info';
    default:
      return type;
  }
}

/* ---------- Relative Timestamp ---------- */

function relativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5) return 'now';
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

/* ---------- Component ---------- */

export default function ActivityFeed({ events }: ActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(events.length);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (events.length > prevLengthRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevLengthRef.current = events.length;
  }, [events.length]);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerIcon}>{'\u25C9'}</span>
        <span style={styles.headerText}>ACTIVITY</span>
      </div>

      {/* Separator */}
      <div style={styles.separator} />

      {/* Event List */}
      <div ref={scrollRef} style={styles.scrollArea}>
        {events.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={styles.emptyIcon}>{'\u2026'}</span>
            <span style={styles.emptyText}>Awaiting telemetry...</span>
          </div>
        ) : (
          events.map((event) => {
            const visual = getEventVisual(event.type);
            const description = getEventDescription(event);
            return (
              <div key={event.id} style={styles.eventRow}>
                {/* Icon */}
                <span
                  style={{
                    ...styles.eventIcon,
                    color: visual.color,
                    textShadow: `0 0 6px ${visual.glowColor}`,
                  }}
                >
                  {visual.icon}
                </span>

                {/* Description + Timestamp */}
                <div style={styles.eventContent}>
                  <span style={styles.eventDescription}>{description}</span>
                  <span style={styles.eventTimestamp}>{relativeTime(event.timestamp)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ==========================================================
   Styles
   ========================================================== */

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 12px 8px',
    flexShrink: 0,
  },

  headerIcon: {
    fontSize: '10px',
    color: 'var(--cyan-glow, #00c8ff)',
    textShadow: '0 0 6px rgba(0, 200, 255, 0.5)',
  },

  headerText: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '2px',
    color: 'var(--text-secondary, #7a8ba8)',
  },

  separator: {
    height: 1,
    background: 'linear-gradient(90deg, transparent, rgba(0, 200, 255, 0.2), transparent)',
    flexShrink: 0,
  },

  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '6px 0',
  },

  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 12px',
    gap: 8,
  },

  emptyIcon: {
    fontSize: '20px',
    color: 'var(--text-secondary, #7a8ba8)',
    opacity: 0.4,
    animation: 'pulse-glow 3s ease-in-out infinite',
  },

  emptyText: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '10px',
    letterSpacing: '1px',
    color: 'var(--text-secondary, #7a8ba8)',
    opacity: 0.5,
  },

  eventRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '6px 12px',
    borderBottom: '1px solid rgba(0, 200, 255, 0.05)',
    transition: 'background 0.15s ease',
    animation: 'fade-in-up 0.25s ease-out',
  },

  eventIcon: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '13px',
    fontWeight: 700,
    lineHeight: '18px',
    width: 18,
    textAlign: 'center' as const,
    flexShrink: 0,
  },

  eventContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
    minWidth: 0,
  },

  eventDescription: {
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-primary, #e0f0ff)',
    lineHeight: '16px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  eventTimestamp: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '9px',
    letterSpacing: '0.5px',
    color: 'var(--text-secondary, #7a8ba8)',
    opacity: 0.6,
  },
};
