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
  active: '#00ff88',      // vibrant green — general active
  thinking: '#6366f1',    // indigo — neural processing
  coding: '#10b981',      // emerald — writing code
  executing: '#00c8ff',   // cyan — running commands
  scanning: '#14b8a6',    // teal — sensor sweep / reading
  downloading: '#38bdf8', // sky blue — data transfer
  building: '#f59e0b',    // gold — construction
  testing: '#84cc16',     // lime — diagnostics
  waiting: '#ff9f1c',     // amber — standby / awaiting input
  paused: '#64748b',      // slate — systems on hold
  completed: '#5a7a9a',   // muted steel — mission complete
  error: '#ff3344',       // red — alert
  queued: '#4a5568',      // dim gray — in queue
  launching: '#8b5cf6',   // purple — warp engines initializing
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

    @keyframes moon-active-pulse {
      0%, 100% {
        box-shadow: 0 0 8px 3px rgba(0, 255, 136, 0.4),
                    0 0 20px 8px rgba(0, 255, 136, 0.15);
        transform: scale(1);
      }
      50% {
        box-shadow: 0 0 14px 5px rgba(0, 255, 136, 0.6),
                    0 0 30px 12px rgba(0, 255, 136, 0.25);
        transform: scale(1.06);
      }
    }

    @keyframes moon-waiting-pulse {
      0%, 100% {
        box-shadow: 0 0 8px 3px rgba(255, 159, 28, 0.3),
                    0 0 20px 8px rgba(255, 159, 28, 0.1);
        transform: scale(1);
      }
      50% {
        box-shadow: 0 0 12px 4px rgba(255, 159, 28, 0.5),
                    0 0 25px 10px rgba(255, 159, 28, 0.2);
        transform: scale(1.03);
      }
    }

    @keyframes moon-thinking-pulse {
      0%, 100% {
        box-shadow: 0 0 10px 4px rgba(99, 102, 241, 0.4),
                    0 0 25px 10px rgba(99, 102, 241, 0.15);
        transform: scale(1);
      }
      50% {
        box-shadow: 0 0 18px 7px rgba(99, 102, 241, 0.7),
                    0 0 40px 15px rgba(99, 102, 241, 0.3);
        transform: scale(1.08);
      }
    }

    @keyframes moon-coding-pulse {
      0%, 100% {
        box-shadow: 0 0 8px 3px rgba(16, 185, 129, 0.4),
                    0 0 20px 8px rgba(16, 185, 129, 0.15);
        transform: scale(1);
      }
      50% {
        box-shadow: 0 0 14px 5px rgba(16, 185, 129, 0.65),
                    0 0 30px 12px rgba(16, 185, 129, 0.25);
        transform: scale(1.05);
      }
    }

    @keyframes moon-executing-pulse {
      0%, 100% {
        box-shadow: 0 0 8px 3px rgba(0, 200, 255, 0.4),
                    0 0 18px 8px rgba(0, 200, 255, 0.15);
        transform: scale(1);
      }
      33% {
        box-shadow: 0 0 14px 5px rgba(0, 200, 255, 0.7),
                    0 0 25px 12px rgba(0, 200, 255, 0.3);
        transform: scale(1.04);
      }
      66% {
        box-shadow: 0 0 10px 4px rgba(0, 200, 255, 0.5),
                    0 0 20px 9px rgba(0, 200, 255, 0.2);
        transform: scale(1.02);
      }
    }

    @keyframes moon-scanning-pulse {
      0%, 100% {
        box-shadow: 0 0 8px 3px rgba(20, 184, 166, 0.35),
                    0 0 22px 9px rgba(20, 184, 166, 0.12);
        transform: scale(1);
        filter: brightness(1);
      }
      50% {
        box-shadow: 0 0 16px 6px rgba(20, 184, 166, 0.6),
                    0 0 35px 14px rgba(20, 184, 166, 0.25);
        transform: scale(1.06);
        filter: brightness(1.15);
      }
    }

    @keyframes moon-downloading-pulse {
      0% {
        box-shadow: 0 0 6px 2px rgba(56, 189, 248, 0.3),
                    0 0 16px 6px rgba(56, 189, 248, 0.1);
        transform: scale(1);
      }
      50% {
        box-shadow: 0 0 12px 5px rgba(56, 189, 248, 0.6),
                    0 0 28px 11px rgba(56, 189, 248, 0.25);
        transform: scale(1.04);
      }
      100% {
        box-shadow: 0 0 6px 2px rgba(56, 189, 248, 0.3),
                    0 0 16px 6px rgba(56, 189, 248, 0.1);
        transform: scale(1);
      }
    }

    @keyframes moon-building-pulse {
      0%, 100% {
        box-shadow: 0 0 8px 3px rgba(245, 158, 11, 0.35),
                    0 0 20px 8px rgba(245, 158, 11, 0.12);
        transform: scale(1);
      }
      25% {
        box-shadow: 0 0 12px 5px rgba(245, 158, 11, 0.55),
                    0 0 28px 11px rgba(245, 158, 11, 0.2);
        transform: scale(1.04);
      }
      75% {
        box-shadow: 0 0 14px 6px rgba(245, 158, 11, 0.6),
                    0 0 30px 12px rgba(245, 158, 11, 0.25);
        transform: scale(1.06);
      }
    }

    @keyframes moon-testing-pulse {
      0%, 100% {
        box-shadow: 0 0 8px 3px rgba(132, 204, 22, 0.35),
                    0 0 18px 7px rgba(132, 204, 22, 0.12);
        transform: scale(1);
      }
      30% {
        box-shadow: 0 0 14px 5px rgba(132, 204, 22, 0.6),
                    0 0 28px 11px rgba(132, 204, 22, 0.25);
        transform: scale(1.05);
      }
      60% {
        box-shadow: 0 0 10px 4px rgba(132, 204, 22, 0.4),
                    0 0 22px 9px rgba(132, 204, 22, 0.15);
        transform: scale(1.02);
      }
    }

    @keyframes moon-error-flash {
      0%, 100% {
        box-shadow: 0 0 6px 2px rgba(255, 51, 68, 0.3),
                    0 0 15px 5px rgba(255, 51, 68, 0.1);
        opacity: 1;
      }
      50% {
        box-shadow: 0 0 12px 4px rgba(255, 51, 68, 0.6),
                    0 0 25px 10px rgba(255, 51, 68, 0.2);
        opacity: 0.85;
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

  const s = agent.status;
  const isLaunching = s === 'launching';
  const isWorking = s === 'active' || s === 'thinking' || s === 'coding' || s === 'executing' || s === 'scanning' || s === 'downloading' || s === 'building' || s === 'testing';
  const isWaiting = s === 'waiting';
  const isPaused = s === 'paused';
  const isCompleted = s === 'completed';
  const isError = s === 'error';
  const isFinished = isCompleted || isError || isPaused;

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

  /* Status-specific animation — each state gets a distinct visual rhythm */
  const statusAnimation =
    s === 'thinking'     ? 'moon-thinking-pulse 2.5s ease-in-out infinite' :
    s === 'coding'       ? 'moon-coding-pulse 1.8s ease-in-out infinite' :
    s === 'executing'    ? 'moon-executing-pulse 1.2s ease-in-out infinite' :
    s === 'scanning'     ? 'moon-scanning-pulse 2s ease-in-out infinite' :
    s === 'downloading'  ? 'moon-downloading-pulse 1.5s ease-in-out infinite' :
    s === 'building'     ? 'moon-building-pulse 2s ease-in-out infinite' :
    s === 'testing'      ? 'moon-testing-pulse 1.6s ease-in-out infinite' :
    isWorking            ? 'moon-active-pulse 2s ease-in-out infinite' :
    isWaiting            ? 'moon-waiting-pulse 3s ease-in-out infinite' :
    isLaunching          ? 'pulse-glow-strong 1.5s ease-in-out infinite' :
    isError              ? 'moon-error-flash 3s ease-in-out infinite' :
    'none';

  /* Completed/queued moons are visually muted */
  const glowIntensity = isFinished ? 0.3 : 1;

  /* The visible moon sphere */
  const moonBodyStyle: React.CSSProperties = {
    width: moonSize,
    height: moonSize,
    borderRadius: '50%',
    background: isFinished
      ? `radial-gradient(ellipse at 35% 30%, ${color}88 0%, ${color}55 40%, ${color}33 70%, ${color}18 100%)`
      : `radial-gradient(ellipse at 35% 30%, ${color}cc 0%, ${color}88 40%, ${color}44 70%, ${color}22 100%)`,
    boxShadow: [
      `0 0 ${moonSize * 0.4}px ${moonSize * 0.15 * glowIntensity}px ${color}${isFinished ? '33' : '55'}`,
      `0 0 ${moonSize * 0.8}px ${moonSize * 0.3 * glowIntensity}px ${color}${isFinished ? '11' : '22'}`,
      `inset -2px -3px ${moonSize * 0.3}px rgba(0, 0, 0, ${isFinished ? '0.6' : '0.4'})`,
      `inset 1px 2px ${moonSize * 0.15}px rgba(255, 255, 255, ${isFinished ? '0.05' : '0.1'})`,
    ].join(', '),
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    animation: statusAnimation,
    opacity: isFinished ? 0.6 : 1,
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
    color: isFinished ? `${color}88` : `${color}cc`,
    textShadow: isFinished ? 'none' : `0 0 6px ${color}44`,
    whiteSpace: 'nowrap',
    textAlign: 'center',
    maxWidth: 100,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    pointerEvents: 'none',
    opacity: isFinished ? 0.5 : 1,
    animation: 'moon-label-fade-in 0.6s ease-out forwards',
  };

  /* Status indicator dot */
  const statusDotStyle: React.CSSProperties = {
    position: 'absolute',
    top: -2,
    right: -2,
    width: isWorking ? 8 : 6,
    height: isWorking ? 8 : 6,
    borderRadius: '50%',
    backgroundColor: color,
    boxShadow: isWorking ? `0 0 6px ${color}, 0 0 12px ${color}88` : `0 0 4px ${color}`,
    border: '1px solid rgba(10, 14, 23, 0.8)',
    opacity: isFinished ? 0.5 : 1,
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
