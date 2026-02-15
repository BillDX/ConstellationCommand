import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLogStore } from '../../stores/logStore';
import type { LogEntry } from '../../types';

/* ============================================================
   SystemLogs — Starship Main Computer Log Display

   Full-screen log viewer showing all application events, styled
   as a tactical starship computer readout. Positioned within the
   HUD frame (top bar, sidebar, bottom bar).
   ============================================================ */

/* ---------- Constants ---------- */

const LOG_LEVELS = ['ALL', 'INFO', 'WARN', 'ERROR', 'SUCCESS'] as const;
type FilterLevel = (typeof LOG_LEVELS)[number];

const LEVEL_COLORS: Record<LogEntry['level'], string> = {
  info: 'var(--cyan-glow, #00c8ff)',
  warn: 'var(--amber-alert, #ff9f1c)',
  error: 'var(--red-alert, #ff3344)',
  success: 'var(--green-success, #00ff88)',
};

const LEVEL_BG: Record<LogEntry['level'], string> = {
  info: 'rgba(0, 200, 255, 0.12)',
  warn: 'rgba(255, 159, 28, 0.12)',
  error: 'rgba(255, 51, 68, 0.12)',
  success: 'rgba(0, 255, 136, 0.12)',
};

/* ---------- Utility ---------- */

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

/* ==========================================================
   Main Component
   ========================================================== */

export default function SystemLogs() {
  const { logs, clearLogs, getFilteredLogs } = useLogStore();

  /* ---------- Local State ---------- */
  const [activeFilter, setActiveFilter] = useState<FilterLevel>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [scrollLock, setScrollLock] = useState(false);
  const [hoveredFilter, setHoveredFilter] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [radarAngle, setRadarAngle] = useState(0);

  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  /* ---------- Filtered Logs ---------- */
  const filteredLogs = useMemo(() => {
    const levelFilter = activeFilter === 'ALL'
      ? undefined
      : (activeFilter.toLowerCase() as LogEntry['level']);

    const storeFiltered = getFilteredLogs({
      level: levelFilter,
    });

    if (!searchQuery.trim()) return storeFiltered;

    const q = searchQuery.toLowerCase();
    return storeFiltered.filter(
      (log) =>
        log.message.toLowerCase().includes(q) ||
        log.source.toLowerCase().includes(q) ||
        (log.agentId && log.agentId.toLowerCase().includes(q)),
    );
  }, [logs, activeFilter, searchQuery, getFilteredLogs]);

  /* ---------- Auto-scroll ---------- */
  useEffect(() => {
    if (!scrollLock && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs, scrollLock]);

  /* ---------- Radar Animation for Empty State ---------- */
  useEffect(() => {
    if (filteredLogs.length > 0) return;
    const id = setInterval(() => {
      setRadarAngle((prev) => (prev + 3) % 360);
    }, 50);
    return () => clearInterval(id);
  }, [filteredLogs.length]);

  /* ---------- Oldest Entry Timestamp ---------- */
  const oldestTimestamp = useMemo(() => {
    if (logs.length === 0) return null;
    return logs[0].timestamp;
  }, [logs]);

  /* ---------- Handlers ---------- */
  const handleFilterClick = useCallback((level: FilterLevel) => {
    setActiveFilter(level);
  }, []);

  const handleClearLogs = useCallback(() => {
    clearLogs();
  }, [clearLogs]);

  const handleScrollLockToggle = useCallback(() => {
    setScrollLock((prev) => !prev);
  }, []);

  /* ==========================================================
     Render
     ========================================================== */

  return (
    <div style={styles.container}>
      {/* --- Header Bar --- */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.title}>SYSTEM LOGS</span>
          <span style={styles.logCountBadge}>{filteredLogs.length}</span>
        </div>

        <div style={styles.headerCenter}>
          {/* Level Filter Buttons */}
          <div style={styles.filterGroup}>
            {LOG_LEVELS.map((level) => {
              const isActive = activeFilter === level;
              const isHovered = hoveredFilter === level;
              const color =
                level === 'ALL'
                  ? 'var(--cyan-glow, #00c8ff)'
                  : LEVEL_COLORS[level.toLowerCase() as LogEntry['level']];
              return (
                <button
                  key={level}
                  onClick={() => handleFilterClick(level)}
                  onMouseEnter={() => setHoveredFilter(level)}
                  onMouseLeave={() => setHoveredFilter(null)}
                  style={{
                    ...styles.filterButton,
                    color: isActive ? '#0a0e17' : color,
                    background: isActive
                      ? color
                      : isHovered
                        ? `${color}22`
                        : 'transparent',
                    borderColor: isActive ? color : isHovered ? color : 'rgba(0, 200, 255, 0.2)',
                    textShadow: isActive ? 'none' : isHovered ? `0 0 6px ${color}` : 'none',
                  }}
                >
                  {level}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div style={styles.searchWrapper}>
            <span style={styles.searchIcon}>{'\u2315'}</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              style={styles.searchInput}
            />
          </div>
        </div>

        <div style={styles.headerRight}>
          {/* Scroll Lock Toggle */}
          <button
            onClick={handleScrollLockToggle}
            style={{
              ...styles.scrollLockButton,
              color: scrollLock
                ? 'var(--amber-alert, #ff9f1c)'
                : 'var(--text-secondary, #7a8ba8)',
              borderColor: scrollLock
                ? 'rgba(255, 159, 28, 0.5)'
                : 'rgba(0, 200, 255, 0.15)',
              background: scrollLock
                ? 'rgba(255, 159, 28, 0.1)'
                : 'transparent',
            }}
          >
            {scrollLock ? '\u23F8 LOCKED' : '\u25BC AUTO'}
          </button>

          {/* Clear Logs */}
          <button
            onClick={handleClearLogs}
            onMouseEnter={() => setHoveredFilter('clear')}
            onMouseLeave={() => setHoveredFilter(null)}
            style={{
              ...styles.clearButton,
              background:
                hoveredFilter === 'clear'
                  ? 'rgba(255, 51, 68, 0.15)'
                  : 'transparent',
            }}
          >
            CLEAR LOGS
          </button>
        </div>
      </div>

      {/* --- Main Log Area --- */}
      <div ref={logContainerRef} style={styles.logArea}>
        {filteredLogs.length === 0 ? (
          /* Empty State */
          <div style={styles.emptyState}>
            {/* Radar Animation */}
            <div style={styles.radarContainer}>
              <div style={styles.radarRing} />
              <div style={styles.radarRingInner} />
              <div
                style={{
                  ...styles.radarSweep,
                  transform: `rotate(${radarAngle}deg)`,
                }}
              />
              <div style={styles.radarCenter} />
            </div>
            <span style={styles.emptyText}>NO LOG ENTRIES</span>
            <span style={styles.emptySubtext}>Awaiting system transmissions...</span>
          </div>
        ) : (
          /* Log Entries */
          <>
            {filteredLogs.map((log, index) => {
              const isEven = index % 2 === 0;
              const isHovered = hoveredRow === log.id;
              return (
                <div
                  key={log.id}
                  onMouseEnter={() => setHoveredRow(log.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    ...styles.logRow,
                    background: isHovered
                      ? 'rgba(0, 200, 255, 0.06)'
                      : isEven
                        ? 'rgba(13, 19, 33, 0.4)'
                        : 'rgba(10, 14, 23, 0.6)',
                  }}
                >
                  {/* Timestamp */}
                  <span style={styles.logTimestamp}>
                    {formatTimestamp(log.timestamp)}
                  </span>

                  {/* Level Badge */}
                  <span
                    style={{
                      ...styles.logLevelBadge,
                      color: LEVEL_COLORS[log.level],
                      background: LEVEL_BG[log.level],
                      borderColor: `${LEVEL_COLORS[log.level]}`,
                    }}
                  >
                    {log.level.toUpperCase()}
                  </span>

                  {/* Source */}
                  <span style={styles.logSource}>{log.source}</span>

                  {/* Agent ID (if present) */}
                  {log.agentId && (
                    <span style={styles.logAgentId}>
                      [{log.agentId.slice(0, 8)}]
                    </span>
                  )}

                  {/* Message */}
                  <span
                    style={{
                      ...styles.logMessage,
                      color:
                        log.level === 'error'
                          ? 'var(--red-alert, #ff3344)'
                          : log.level === 'warn'
                            ? 'var(--amber-alert, #ff9f1c)'
                            : 'var(--text-primary, #e0f0ff)',
                    }}
                  >
                    {log.message}
                  </span>
                </div>
              );
            })}
            <div ref={logEndRef} />
          </>
        )}
      </div>

      {/* --- Footer --- */}
      <div style={styles.footer}>
        <span style={styles.footerItem}>
          <span style={styles.footerLabel}>TOTAL</span>
          <span style={styles.footerValue}>{logs.length}</span>
        </span>
        <span style={styles.footerDivider}>{'\u2502'}</span>
        <span style={styles.footerItem}>
          <span style={styles.footerLabel}>FILTERED</span>
          <span style={styles.footerValue}>{filteredLogs.length}</span>
        </span>
        <span style={styles.footerDivider}>{'\u2502'}</span>
        <span style={styles.footerItem}>
          <span style={styles.footerLabel}>OLDEST</span>
          <span style={styles.footerValue}>
            {oldestTimestamp ? formatTimestamp(oldestTimestamp) : '--:--:--.---'}
          </span>
        </span>
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
    bottom: 64,
    right: 0,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--panel-bg, rgba(13, 19, 33, 0.85))',
    borderLeft: '1px solid var(--panel-border, rgba(0, 200, 255, 0.3))',
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    color: 'var(--text-primary, #e0f0ff)',
    zIndex: 50,
    overflow: 'hidden',
  },

  /* --- Header --- */
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 20px',
    borderBottom: '1px solid rgba(0, 200, 255, 0.2)',
    background: 'linear-gradient(180deg, rgba(13, 19, 33, 0.95) 0%, rgba(13, 19, 33, 0.8) 100%)',
    flexShrink: 0,
    gap: 16,
    flexWrap: 'wrap',
  },

  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },

  title: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '3px',
    color: 'var(--cyan-glow, #00c8ff)',
    textShadow: '0 0 12px rgba(0, 200, 255, 0.5), 0 0 30px rgba(0, 200, 255, 0.2)',
  },

  logCountBadge: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '2px',
    background: 'rgba(0, 200, 255, 0.12)',
    border: '1px solid rgba(0, 200, 255, 0.3)',
    color: 'var(--cyan-glow, #00c8ff)',
    letterSpacing: '1px',
  },

  headerCenter: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },

  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },

  filterButton: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    padding: '4px 10px',
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    textTransform: 'uppercase' as const,
    whiteSpace: 'nowrap',
  },

  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },

  searchIcon: {
    position: 'absolute',
    left: 8,
    color: 'var(--text-secondary, #7a8ba8)',
    fontSize: '14px',
    pointerEvents: 'none',
    zIndex: 1,
  },

  searchInput: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '12px',
    padding: '5px 10px 5px 26px',
    background: 'var(--space-void, #0a0e17)',
    border: '1px solid rgba(0, 200, 255, 0.2)',
    color: 'var(--text-primary, #e0f0ff)',
    outline: 'none',
    width: 200,
    transition: 'border-color 0.2s ease',
  },

  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },

  scrollLockButton: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '9px',
    fontWeight: 600,
    letterSpacing: '1px',
    padding: '4px 10px',
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  },

  clearButton: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    padding: '4px 12px',
    border: '1px solid rgba(255, 51, 68, 0.5)',
    color: 'var(--red-alert, #ff3344)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    textShadow: '0 0 6px rgba(255, 51, 68, 0.3)',
  },

  /* --- Log Area --- */
  logArea: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '0',
    scrollbarWidth: 'thin' as any,
    scrollbarColor: 'rgba(0, 200, 255, 0.3) rgba(10, 14, 23, 0.5)',
  },

  /* --- Log Row --- */
  logRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '6px 20px',
    borderBottom: '1px solid rgba(0, 200, 255, 0.04)',
    transition: 'background 0.1s ease',
    minHeight: 32,
  },

  logTimestamp: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--text-secondary, #7a8ba8)',
    letterSpacing: '0.5px',
    flexShrink: 0,
    minWidth: 95,
  },

  logLevelBadge: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '8px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    padding: '2px 8px',
    border: '1px solid',
    borderRadius: '1px',
    textAlign: 'center' as const,
    flexShrink: 0,
    minWidth: 60,
    textTransform: 'uppercase' as const,
  },

  logSource: {
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary, #7a8ba8)',
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
    flexShrink: 0,
    minWidth: 90,
    maxWidth: 130,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  logAgentId: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '10px',
    fontWeight: 400,
    color: 'rgba(0, 200, 255, 0.5)',
    letterSpacing: '0.5px',
    flexShrink: 0,
  },

  logMessage: {
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '13px',
    fontWeight: 500,
    letterSpacing: '0.3px',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  /* --- Empty State --- */
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 20,
    opacity: 0.7,
  },

  radarContainer: {
    position: 'relative',
    width: 120,
    height: 120,
  },

  radarRing: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    border: '1px solid rgba(0, 200, 255, 0.2)',
  },

  radarRingInner: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
    borderRadius: '50%',
    border: '1px solid rgba(0, 200, 255, 0.12)',
  },

  radarSweep: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '50%',
    height: 2,
    transformOrigin: '0% 50%',
    background: 'linear-gradient(90deg, rgba(0, 200, 255, 0.6) 0%, transparent 100%)',
    boxShadow: '0 0 8px rgba(0, 200, 255, 0.3)',
  },

  radarCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 6,
    height: 6,
    marginTop: -3,
    marginLeft: -3,
    borderRadius: '50%',
    background: 'var(--cyan-glow, #00c8ff)',
    boxShadow: '0 0 8px rgba(0, 200, 255, 0.6)',
  },

  emptyText: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '16px',
    fontWeight: 700,
    letterSpacing: '4px',
    color: 'var(--text-secondary, #7a8ba8)',
    textShadow: '0 0 8px rgba(122, 139, 168, 0.3)',
  },

  emptySubtext: {
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '13px',
    fontWeight: 400,
    letterSpacing: '2px',
    color: 'var(--text-secondary, #7a8ba8)',
    opacity: 0.6,
  },

  /* --- Footer --- */
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    padding: '8px 20px',
    borderTop: '1px solid rgba(0, 200, 255, 0.2)',
    background: 'linear-gradient(0deg, rgba(13, 19, 33, 0.95) 0%, rgba(13, 19, 33, 0.8) 100%)',
    flexShrink: 0,
  },

  footerItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },

  footerLabel: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '9px',
    fontWeight: 600,
    letterSpacing: '1.5px',
    color: 'var(--text-secondary, #7a8ba8)',
  },

  footerValue: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--cyan-glow, #00c8ff)',
    letterSpacing: '1px',
    textShadow: '0 0 6px rgba(0, 200, 255, 0.3)',
  },

  footerDivider: {
    color: 'rgba(0, 200, 255, 0.2)',
    fontSize: '14px',
  },
};
