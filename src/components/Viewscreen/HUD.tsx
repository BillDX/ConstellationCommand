import React, { useState, useEffect, useCallback } from 'react';

/* ============================================================
   HUD (Heads-Up Display) — Bridge Command Overlay

   Three zones: Top Bar, Left Sidebar, Bottom Bar.
   Full-viewport overlay rendered above the starfield / planet.
   ============================================================ */

/* ---------- Type Definitions ---------- */

export interface HUDTopBarProps {
  title?: string;
  subtitle?: string;
}

export interface HUDSidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export interface HUDBottomBarProps {
  onLaunchAgent: () => void;
  onRedAlert: () => void;
  onHail: () => void;
  onScan: () => void;
  redAlertActive?: boolean;
}

export interface HUDProps extends HUDSidebarProps, HUDBottomBarProps {
  title?: string;
  subtitle?: string;
}

/* ---------- Navigation Items ---------- */

interface NavItem {
  id: string;
  icon: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'tactical',  icon: '\u25C9', label: 'Active Missions' },      // ◉
  { id: 'incubator', icon: '\u25C8', label: 'Project Incubator' },    // ◈
  { id: 'planning',  icon: '\u25C6', label: 'Mission Planning' },     // ◆
  { id: 'logs',      icon: '\u25A3', label: 'System Logs' },          // ▣
  { id: 'status',    icon: '\u2B21', label: 'Ship Status' },          // ⬡
];

/* ---------- Utility: Stardate ---------- */

function toStardate(date: Date): string {
  const year = date.getFullYear();
  const start = new Date(year, 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  return `SD ${year}.${String(dayOfYear).padStart(3, '0')}`;
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/* ==========================================================
   Top Bar Component
   ========================================================== */

function TopBar({ title, subtitle }: HUDTopBarProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header style={styles.topBar}>
      {/* Left: Brand */}
      <div style={styles.topBarLeft}>
        <span style={styles.brandText}>CONSTELLATION COMMAND</span>
      </div>

      {/* Center: Title */}
      <div style={styles.topBarCenter}>
        <span style={styles.titleText}>
          {title ?? 'TACTICAL COMMAND'} &mdash; {subtitle ?? 'ACTIVE MISSIONS'}
        </span>
      </div>

      {/* Right: Stardate + Clock */}
      <div style={styles.topBarRight}>
        <span style={styles.stardateText}>{toStardate(now)}</span>
        <span style={styles.clockText}>{formatClock(now)}</span>
      </div>
    </header>
  );
}

/* ==========================================================
   Left Sidebar Component
   ========================================================== */

function Sidebar({ activeView, onNavigate, collapsed, onToggle }: HUDSidebarProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <nav
      style={{
        ...styles.sidebar,
        width: collapsed ? 56 : 220,
      }}
    >
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        style={styles.sidebarToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <span
          style={{
            display: 'inline-block',
            transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform 0.3s ease',
            fontSize: '14px',
          }}
        >
          {'\u25B6'}
        </span>
      </button>

      {/* Navigation Items */}
      <div style={styles.navList}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          const isHovered = hoveredItem === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              style={{
                ...styles.navItem,
                background: isActive
                  ? 'rgba(0, 200, 255, 0.12)'
                  : isHovered
                  ? 'rgba(0, 200, 255, 0.06)'
                  : 'transparent',
                borderLeft: isActive
                  ? '2px solid var(--cyan-glow, #00c8ff)'
                  : '2px solid transparent',
                color: isActive
                  ? 'var(--text-highlight, #00c8ff)'
                  : isHovered
                  ? 'var(--text-primary, #e0f0ff)'
                  : 'var(--text-secondary, #7a8ba8)',
                textShadow: isActive
                  ? '0 0 8px rgba(0, 200, 255, 0.5)'
                  : isHovered
                  ? '0 0 4px rgba(0, 200, 255, 0.3)'
                  : 'none',
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              {!collapsed && (
                <span style={styles.navLabel}>{item.label}</span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ==========================================================
   Bottom Bar Component
   ========================================================== */

interface ActionButton {
  id: string;
  label: string;
  color: string;
  glowColor: string;
  handler: () => void;
  pulsing?: boolean;
}

function BottomBar({
  onLaunchAgent,
  onRedAlert,
  onHail,
  onScan,
  redAlertActive = false,
}: HUDBottomBarProps) {
  const [pressedButton, setPressedButton] = useState<string | null>(null);

  const buttons: ActionButton[] = [
    {
      id: 'launch',
      label: 'LAUNCH AGENT',
      color: 'var(--cyan-glow, #00c8ff)',
      glowColor: 'rgba(0, 200, 255, 0.4)',
      handler: onLaunchAgent,
    },
    {
      id: 'red-alert',
      label: 'RED ALERT',
      color: 'var(--red-alert, #ff3344)',
      glowColor: 'rgba(255, 51, 68, 0.4)',
      handler: onRedAlert,
      pulsing: redAlertActive,
    },
    {
      id: 'hail',
      label: 'HAIL',
      color: 'var(--amber-alert, #ff9f1c)',
      glowColor: 'rgba(255, 159, 28, 0.4)',
      handler: onHail,
    },
    {
      id: 'scan',
      label: 'SCAN',
      color: 'var(--green-success, #00ff88)',
      glowColor: 'rgba(0, 255, 136, 0.4)',
      handler: onScan,
    },
  ];

  const handlePress = useCallback((btn: ActionButton) => {
    setPressedButton(btn.id);
    btn.handler();
    setTimeout(() => setPressedButton(null), 200);
  }, []);

  return (
    <footer style={styles.bottomBar}>
      <div style={styles.bottomBarInner}>
        {buttons.map((btn) => {
          const isPressed = pressedButton === btn.id;
          return (
            <button
              key={btn.id}
              onClick={() => handlePress(btn)}
              style={{
                ...styles.actionButton,
                borderColor: btn.color,
                color: btn.color,
                boxShadow: btn.pulsing
                  ? `0 0 15px ${btn.glowColor}, inset 0 0 15px ${btn.glowColor}`
                  : `0 0 8px ${btn.glowColor}`,
                transform: isPressed ? 'scale(0.94)' : 'scale(1)',
                animation: btn.pulsing ? 'pulse-glow-strong 1.5s ease-in-out infinite' : 'none',
                background: btn.pulsing
                  ? `linear-gradient(180deg, rgba(255, 51, 68, 0.15) 0%, rgba(255, 51, 68, 0.05) 100%)`
                  : styles.actionButton.background,
              }}
            >
              {/* Decorative corner clips */}
              <span style={{ ...styles.cornerClip, top: -1, left: -1 }} />
              <span style={{ ...styles.cornerClip, top: -1, right: -1, transform: 'scaleX(-1)' }} />
              <span style={{ ...styles.cornerClip, bottom: -1, left: -1, transform: 'scaleY(-1)' }} />
              <span style={{ ...styles.cornerClip, bottom: -1, right: -1, transform: 'scale(-1)' }} />

              <span style={styles.actionButtonLabel}>{btn.label}</span>
            </button>
          );
        })}
      </div>
    </footer>
  );
}

/* ==========================================================
   Main HUD Component (Composite)
   ========================================================== */

export default function HUD({
  title,
  subtitle,
  activeView,
  onNavigate,
  collapsed,
  onToggle,
  onLaunchAgent,
  onRedAlert,
  onHail,
  onScan,
  redAlertActive,
}: HUDProps) {
  return (
    <div style={styles.hudContainer}>
      <TopBar title={title} subtitle={subtitle} />
      <Sidebar
        activeView={activeView}
        onNavigate={onNavigate}
        collapsed={collapsed}
        onToggle={onToggle}
      />
      <BottomBar
        onLaunchAgent={onLaunchAgent}
        onRedAlert={onRedAlert}
        onHail={onHail}
        onScan={onScan}
        redAlertActive={redAlertActive}
      />

      {/* Scan Line Effect */}
      <div style={styles.scanLineOverlay} />
    </div>
  );
}

/* --- Also export sub-components for granular use --- */
export { TopBar, Sidebar, BottomBar };

/* ==========================================================
   Styles
   ========================================================== */

const styles: Record<string, React.CSSProperties> = {
  /* --- HUD Container --- */
  hudContainer: {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 100,
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
  },

  /* --- Top Bar --- */
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    background: 'linear-gradient(180deg, rgba(13, 19, 33, 0.92) 0%, rgba(13, 19, 33, 0.7) 100%)',
    borderBottom: '1px solid rgba(0, 200, 255, 0.25)',
    boxShadow: '0 1px 20px rgba(0, 200, 255, 0.08), inset 0 -1px 0 rgba(0, 200, 255, 0.1)',
    backdropFilter: 'blur(8px)',
    pointerEvents: 'auto',
    zIndex: 110,
    animation: 'fade-in 0.6s ease-out',
  },

  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flex: '0 0 auto',
  },

  brandText: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '2.5px',
    color: 'var(--cyan-glow, #00c8ff)',
    textShadow: '0 0 10px rgba(0, 200, 255, 0.5), 0 0 30px rgba(0, 200, 255, 0.2)',
  },

  topBarCenter: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    textAlign: 'center',
  },

  titleText: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '12px',
    fontWeight: 500,
    letterSpacing: '2px',
    color: 'var(--text-primary, #e0f0ff)',
    textShadow: '0 0 6px rgba(224, 240, 255, 0.3)',
    whiteSpace: 'nowrap',
  },

  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    flex: '0 0 auto',
  },

  stardateText: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '11px',
    fontWeight: 400,
    letterSpacing: '1px',
    color: 'var(--text-secondary, #7a8ba8)',
  },

  clockText: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '2px',
    color: 'var(--cyan-glow, #00c8ff)',
    textShadow: '0 0 8px rgba(0, 200, 255, 0.4)',
    minWidth: 80,
    textAlign: 'right' as const,
  },

  /* --- Sidebar --- */
  sidebar: {
    position: 'absolute',
    top: 48,
    left: 0,
    bottom: 64,
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(90deg, rgba(13, 19, 33, 0.92) 0%, rgba(13, 19, 33, 0.75) 100%)',
    borderRight: '1px solid rgba(0, 200, 255, 0.15)',
    boxShadow: '1px 0 20px rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(8px)',
    transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    overflow: 'hidden',
    pointerEvents: 'auto',
    zIndex: 105,
  },

  sidebarToggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 36,
    border: 'none',
    borderBottom: '1px solid rgba(0, 200, 255, 0.1)',
    background: 'transparent',
    color: 'var(--text-secondary, #7a8ba8)',
    cursor: 'pointer',
    transition: 'color 0.2s, background 0.2s',
    fontFamily: 'inherit',
  },

  navList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '8px 0',
    flex: 1,
  },

  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    height: 42,
    padding: '0 16px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '14px',
    fontWeight: 500,
    letterSpacing: '0.5px',
    textAlign: 'left' as const,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },

  navIcon: {
    fontSize: '18px',
    width: 24,
    textAlign: 'center' as const,
    flexShrink: 0,
  },

  navLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  /* --- Bottom Bar --- */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(0deg, rgba(13, 19, 33, 0.92) 0%, rgba(13, 19, 33, 0.7) 100%)',
    borderTop: '1px solid rgba(0, 200, 255, 0.2)',
    boxShadow: '0 -1px 20px rgba(0, 200, 255, 0.06)',
    backdropFilter: 'blur(8px)',
    pointerEvents: 'auto',
    zIndex: 110,
    animation: 'fade-in 0.6s ease-out 0.2s both',
  },

  bottomBarInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },

  actionButton: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    padding: '0 28px',
    border: '1px solid',
    background: 'linear-gradient(180deg, rgba(0, 200, 255, 0.06) 0%, rgba(0, 200, 255, 0.02) 100%)',
    cursor: 'pointer',
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '2px',
    textTransform: 'uppercase' as const,
    transition: 'all 0.15s ease',
    /* Clipped corners via clip-path */
    clipPath: 'polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)',
    overflow: 'hidden',
  },

  cornerClip: {
    position: 'absolute',
    width: 8,
    height: 8,
    /* Tiny decorative corner fill */
    pointerEvents: 'none',
  },

  actionButtonLabel: {
    position: 'relative',
    zIndex: 1,
  },

  /* --- Scan Line Overlay --- */
  scanLineOverlay: {
    position: 'fixed',
    left: 0,
    right: 0,
    height: 2,
    background: 'linear-gradient(90deg, transparent 0%, rgba(0, 200, 255, 0.06) 20%, rgba(0, 200, 255, 0.06) 80%, transparent 100%)',
    animation: 'scan-line 8s linear infinite',
    pointerEvents: 'none',
    zIndex: 200,
    opacity: 0.5,
  },
};
