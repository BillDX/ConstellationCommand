import React, { useMemo } from 'react';
import type { Agent } from '../../types';
import Moon from './Moon';

/* ============================================================
   OrbitalField Component — Agent Orbital Container

   Centers in the viewport (same positioning as the Planet) and
   renders:
   1. SVG orbital ring paths — faint glowing ellipses for each
      occupied orbit level.
   2. A Moon component for each agent, positioned along its
      assigned orbital ring.
   ============================================================ */

export interface OrbitalFieldProps {
  agents: Agent[];
  onMoonClick: (agentId: string) => void;
}

/* ---------- Constants ---------- */

/** Must match Moon.tsx getOrbitRadius */
function getOrbitRadius(index: number): number {
  return 180 + index * 40;
}

/** Field must be large enough to contain all orbital rings + labels */
function getFieldSize(agentCount: number): number {
  if (agentCount === 0) return 400;
  const maxRadius = getOrbitRadius(agentCount - 1);
  return (maxRadius + 80) * 2;
}

/* ---------- Keyframe Injection ---------- */

const KEYFRAME_ID = '__orbital-field-keyframes__';

function ensureKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAME_ID)) return;

  const style = document.createElement('style');
  style.id = KEYFRAME_ID;
  style.textContent = `
    @keyframes orbital-ring-rotate {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }

    @keyframes orbital-ring-fade-in {
      from {
        opacity: 0;
        transform: scale(0.92);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
  `;
  document.head.appendChild(style);
}

/* ---------- Sub-component: Orbital Ring ---------- */

interface OrbitalRingProps {
  radius: number;
  index: number;
}

function OrbitalRing({ radius, index }: OrbitalRingProps) {
  const size = radius * 2;
  const strokeColor = 'rgba(0, 200, 255, 0.12)';
  const glowColor = 'rgba(0, 200, 255, 0.06)';

  const svgStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: size,
    height: size,
    marginTop: -radius,
    marginLeft: -radius,
    pointerEvents: 'none',
    animation: `orbital-ring-fade-in 0.8s ease-out ${index * 0.15}s both`,
    zIndex: 5,
  };

  return (
    <svg
      style={svgStyle}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* SVG filter for the glow effect */}
      <defs>
        <filter id={`orbital-glow-${index}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer glow ring */}
      <ellipse
        cx={radius}
        cy={radius}
        rx={radius - 2}
        ry={radius - 2}
        fill="none"
        stroke={glowColor}
        strokeWidth={4}
        filter={`url(#orbital-glow-${index})`}
      />

      {/* Crisp inner ring */}
      <ellipse
        cx={radius}
        cy={radius}
        rx={radius - 2}
        ry={radius - 2}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1}
        strokeDasharray="4 8"
        opacity={0.6}
      />

      {/* Faint solid ring for continuity */}
      <ellipse
        cx={radius}
        cy={radius}
        rx={radius - 2}
        ry={radius - 2}
        fill="none"
        stroke={strokeColor}
        strokeWidth={0.5}
        opacity={0.4}
      />
    </svg>
  );
}

/* ---------- Main Component ---------- */

export default function OrbitalField({ agents, onMoonClick }: OrbitalFieldProps) {
  ensureKeyframes();

  const fieldSize = useMemo(() => getFieldSize(agents.length), [agents.length]);

  /* Pre-compute orbital ring data for each occupied orbit level */
  const orbitalRings = useMemo(() => {
    return agents.map((_, index) => ({
      radius: getOrbitRadius(index),
      index,
    }));
  }, [agents.length]);

  /* ---------- Styles ---------- */

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 15,
  };

  const fieldStyle: React.CSSProperties = {
    position: 'relative',
    width: fieldSize,
    height: fieldSize,
  };

  return (
    <div style={containerStyle} aria-label="Agent orbital field" role="region">
      <div style={fieldStyle}>
        {/* Orbital ring paths */}
        {orbitalRings.map((ring) => (
          <OrbitalRing
            key={`ring-${ring.index}`}
            radius={ring.radius}
            index={ring.index}
          />
        ))}

        {/* Moon components for each agent */}
        {agents.map((agent, index) => (
          <Moon
            key={agent.id}
            agent={agent}
            index={index}
            totalMoons={agents.length}
            onClick={() => onMoonClick(agent.id)}
          />
        ))}
      </div>
    </div>
  );
}
