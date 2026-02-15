import React, { useMemo } from 'react';
import type { Agent } from '../../types';

/* ============================================================
   Moon Component — Orbital Agent Visualization

   A glowing moon that orbits the central planet, representing
   a single agent. Each moon follows an elliptical path at a
   unique orbital radius with smooth CSS keyframe animation.

   The orbit container rotates, while the moon counter-rotates
   to remain upright throughout its orbit.
   ============================================================ */

export interface MoonProps {
  agent: Agent;
  index: number;
  totalMoons: number;
  onClick: () => void;
}

/* ---------- Status Color Map ---------- */

const STATUS_COLORS: Record<Agent['status'], string> = {
  active: '#00c8ff',
  completed: '#ffd700',
  error: '#ff3344',
  queued: '#4a5568',
  launching: '#8b5cf6',
};

/* ---------- Helpers ---------- */

/** Simple deterministic hash from a string, returns 0-1 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash % 1000) / 1000;
}

/** Truncate text to approximately maxLen characters */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '\u2026';
}

/** Compute moon size (24-40px) from task string hash */
function getMoonSize(task: string): number {
  return 24 + hashString(task) * 16;
}

/** Compute orbit radius for a given index: 180, 220, 260, 300, ... */
function getOrbitRadius(index: number): number {
  return 180 + index * 40;
}

/** Compute orbital period: index 0 = 30s, 1 = 45s, 2 = 60s, ... */
function getOrbitalPeriod(index: number): number {
  return 30 + index * 15;
}

/* ---------- Keyframe Injection ---------- */

const KEYFRAME_ID = '__moon-orbital-keyframes__';

function ensureKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAME_ID)) return;

  const style = document.createElement('style');
  style.id = KEYFRAME_ID;
  style.textContent = `
    @keyframes moon-orbit {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }

    @keyframes moon-counter-rotate {
      from { transform: rotate(0deg); }
      to   { transform: rotate(-360deg); }
    }

    @keyframes moon-launch-pulse {
      0%, 100% {
        box-shadow: 0 0 8px 2px rgba(139, 92, 246, 0.4),
                    0 0 20px 6px rgba(139, 92, 246, 0.2);
        transform: rotate(var(--counter-angle, 0deg)) scale(1);
      }
      50% {
        box-shadow: 0 0 16px 6px rgba(139, 92, 246, 0.7),
                    0 0 35px 12px rgba(139, 92, 246, 0.35);
        transform: rotate(var(--counter-angle, 0deg)) scale(1.15);
      }
    }

    @keyframes moon-label-fade-in {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
  document.head.appendChild(style);
}

/* ---------- Component ---------- */

export default function Moon({ agent, index, totalMoons, onClick }: MoonProps) {
  ensureKeyframes();

  const color = STATUS_COLORS[agent.status];
  const moonSize = useMemo(() => getMoonSize(agent.task), [agent.task]);
  const orbitRadius = getOrbitRadius(index);
  const orbitalPeriod = getOrbitalPeriod(index);
  const taskLabel = truncate(agent.task, 20);

  /* Distribute moons evenly around the orbit at their starting angle */
  const startAngle = totalMoons > 0 ? (index / totalMoons) * 360 : 0;

  const isLaunching = agent.status === 'launching';

  /* ---------- Styles ---------- */

  /* Outer orbit arm: rotates around center, anchored at center */
  const orbitArmStyle: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    top: '50%',
    left: '50%',
    animation: `moon-orbit ${orbitalPeriod}s linear infinite`,
    animationDelay: `${-(startAngle / 360) * orbitalPeriod}s`,
    transformOrigin: '0 0',
    pointerEvents: 'none',
    zIndex: 20 + index,
  };

  /* Moon positioning: translates the moon out to its orbital radius */
  const moonPositionStyle: React.CSSProperties = {
    position: 'absolute',
    top: -moonSize / 2,
    left: orbitRadius - moonSize / 2,
    width: moonSize,
    height: moonSize,
    /* Counter-rotate to keep the moon upright */
    animation: `moon-counter-rotate ${orbitalPeriod}s linear infinite`,
    animationDelay: `${-(startAngle / 360) * orbitalPeriod}s`,
    pointerEvents: 'auto',
    cursor: 'pointer',
    zIndex: 20 + index,
  };

  /* The visible moon sphere */
  const moonBodyStyle: React.CSSProperties = {
    width: moonSize,
    height: moonSize,
    borderRadius: '50%',
    background: `radial-gradient(ellipse at 35% 30%, ${color}cc 0%, ${color}88 40%, ${color}44 70%, ${color}22 100%)`,
    boxShadow: [
      `0 0 ${moonSize * 0.4}px ${moonSize * 0.15}px ${color}55`,
      `0 0 ${moonSize * 0.8}px ${moonSize * 0.3}px ${color}22`,
      `inset -2px -3px ${moonSize * 0.3}px rgba(0, 0, 0, 0.4)`,
      `inset 1px 2px ${moonSize * 0.15}px rgba(255, 255, 255, 0.1)`,
    ].join(', '),
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    animation: isLaunching ? `pulse-glow-strong 1.5s ease-in-out infinite` : 'none',
    position: 'relative',
  };

  /* Label beneath the moon */
  const labelStyle: React.CSSProperties = {
    position: 'absolute',
    top: moonSize + 4,
    left: '50%',
    transform: 'translateX(-50%)',
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '10px',
    fontWeight: 500,
    letterSpacing: '0.5px',
    color: `${color}cc`,
    textShadow: `0 0 6px ${color}44`,
    whiteSpace: 'nowrap',
    textAlign: 'center',
    maxWidth: 100,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    pointerEvents: 'none',
    animation: 'moon-label-fade-in 0.6s ease-out forwards',
  };

  /* Status indicator dot */
  const statusDotStyle: React.CSSProperties = {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: color,
    boxShadow: `0 0 4px ${color}`,
    border: '1px solid rgba(10, 14, 23, 0.8)',
  };

  return (
    <div style={orbitArmStyle}>
      <div
        style={moonPositionStyle}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        role="button"
        tabIndex={0}
        aria-label={`Agent: ${agent.task} — Status: ${agent.status}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            onClick();
          }
        }}
        onMouseEnter={(e) => {
          const body = e.currentTarget.querySelector<HTMLElement>('[data-moon-body]');
          if (body) {
            body.style.transform = 'scale(1.15)';
            body.style.boxShadow = [
              `0 0 ${moonSize * 0.6}px ${moonSize * 0.25}px ${color}88`,
              `0 0 ${moonSize * 1.2}px ${moonSize * 0.5}px ${color}44`,
              `inset -2px -3px ${moonSize * 0.3}px rgba(0, 0, 0, 0.4)`,
              `inset 1px 2px ${moonSize * 0.15}px rgba(255, 255, 255, 0.15)`,
            ].join(', ');
          }
        }}
        onMouseLeave={(e) => {
          const body = e.currentTarget.querySelector<HTMLElement>('[data-moon-body]');
          if (body) {
            body.style.transform = 'scale(1)';
            body.style.boxShadow = moonBodyStyle.boxShadow as string;
          }
        }}
      >
        <div style={moonBodyStyle} data-moon-body="">
          {/* Status indicator */}
          <span style={statusDotStyle} />
        </div>

        {/* Task label */}
        <span style={labelStyle}>{taskLabel}</span>
      </div>
    </div>
  );
}
