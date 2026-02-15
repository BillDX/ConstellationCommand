import { useEffect, useRef, type CSSProperties } from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ShieldEffectProps {
  /** When true the shield barrier flash plays. */
  active: boolean;
  /** Called when the ~0.8 s animation finishes. */
  onComplete?: () => void;
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const RED_ALERT = '#ff3344';

// ---------------------------------------------------------------------------
// Duration (ms)
// ---------------------------------------------------------------------------

const SHIELD_DURATION = 800;

// ---------------------------------------------------------------------------
// Hexagonal grid SVG pattern (inline data-URI for a single hex cell)
// ---------------------------------------------------------------------------

/**
 * We generate an SVG pattern of hexagons as a data-URI so the shield looks
 * like a force-field lattice rather than a plain circle.
 */
const HEX_SIZE = 28;
const HEX_H = HEX_SIZE * Math.sqrt(3);
const HEX_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="${HEX_SIZE * 3}" height="${HEX_H * 2}">
  <polygon points="${hexPoints(HEX_SIZE * 1.5, HEX_H * 0.5, HEX_SIZE * 0.9)}"
    fill="none" stroke="${RED_ALERT}" stroke-width="1" opacity="0.7"/>
  <polygon points="${hexPoints(HEX_SIZE * 0, HEX_H * 1, HEX_SIZE * 0.9)}"
    fill="none" stroke="${RED_ALERT}" stroke-width="1" opacity="0.7"/>
  <polygon points="${hexPoints(HEX_SIZE * 3, HEX_H * 1, HEX_SIZE * 0.9)}"
    fill="none" stroke="${RED_ALERT}" stroke-width="1" opacity="0.7"/>
  <polygon points="${hexPoints(HEX_SIZE * 1.5, HEX_H * 1.5, HEX_SIZE * 0.9)}"
    fill="none" stroke="${RED_ALERT}" stroke-width="1" opacity="0.7"/>
</svg>
`;

function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

const HEX_DATA_URI = `url("data:image/svg+xml,${encodeURIComponent(HEX_SVG.trim())}")`;

// ---------------------------------------------------------------------------
// Keyframes injected once
// ---------------------------------------------------------------------------

const KEYFRAME_ID = '__shield-effect-keyframes__';

function ensureKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAME_ID)) return;

  const style = document.createElement('style');
  style.id = KEYFRAME_ID;
  style.textContent = `
    @keyframes shieldFlash {
      0%   { opacity: 0; transform: scale(0.85); }
      15%  { opacity: 1; transform: scale(1.02); }
      30%  { opacity: 0.7; transform: scale(1); }
      50%  { opacity: 1; transform: scale(1.01); }
      100% { opacity: 0; transform: scale(1.06); }
    }

    @keyframes shieldGlow {
      0%   { opacity: 0; }
      20%  { opacity: 0.8; }
      50%  { opacity: 1; }
      100% { opacity: 0; }
    }

    @keyframes shieldRipple {
      0%   { opacity: 0.8; transform: scale(0.5); }
      100% { opacity: 0; transform: scale(1.8); }
    }

    @keyframes shieldHexPulse {
      0%   { opacity: 0; }
      20%  { opacity: 0.9; }
      45%  { opacity: 0.5; }
      65%  { opacity: 0.8; }
      100% { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  pointerEvents: 'none',
  zIndex: 50,
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

/** Main dome-shaped shield with hex pattern. */
const shieldDomeStyle: CSSProperties = {
  position: 'absolute',
  width: '60vmin',
  height: '60vmin',
  borderRadius: '50%',
  backgroundImage: HEX_DATA_URI,
  backgroundSize: `${HEX_SIZE * 3}px ${HEX_H * 2}px`,
  border: `2px solid ${RED_ALERT}`,
  boxShadow: `
    0 0 40px 15px ${RED_ALERT}66,
    0 0 80px 30px ${RED_ALERT}33,
    inset 0 0 40px 15px ${RED_ALERT}44
  `,
  animation: `shieldFlash ${SHIELD_DURATION}ms ease-out forwards`,
  willChange: 'transform, opacity',
};

/** Radial glow behind the hex dome. */
const glowStyle: CSSProperties = {
  position: 'absolute',
  width: '70vmin',
  height: '70vmin',
  borderRadius: '50%',
  background: `radial-gradient(circle, ${RED_ALERT}55 0%, ${RED_ALERT}22 40%, transparent 70%)`,
  animation: `shieldGlow ${SHIELD_DURATION}ms ease-out forwards`,
  willChange: 'opacity',
};

/** Expanding ripple ring 1. */
const ripple1Style: CSSProperties = {
  position: 'absolute',
  width: '55vmin',
  height: '55vmin',
  borderRadius: '50%',
  border: `1.5px solid ${RED_ALERT}aa`,
  boxShadow: `0 0 12px 3px ${RED_ALERT}44`,
  animation: `shieldRipple ${SHIELD_DURATION * 0.9}ms ease-out forwards`,
  willChange: 'transform, opacity',
};

/** Expanding ripple ring 2 (slightly delayed). */
const ripple2Style: CSSProperties = {
  position: 'absolute',
  width: '50vmin',
  height: '50vmin',
  borderRadius: '50%',
  border: `1px solid ${RED_ALERT}88`,
  boxShadow: `0 0 8px 2px ${RED_ALERT}33`,
  animation: `shieldRipple ${SHIELD_DURATION * 0.85}ms ease-out 80ms forwards`,
  willChange: 'transform, opacity',
};

/** Full-screen red vignette tint. */
const vignetteStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: `radial-gradient(ellipse at 50% 50%, transparent 30%, ${RED_ALERT}15 70%, ${RED_ALERT}22 100%)`,
  animation: `shieldGlow ${SHIELD_DURATION}ms ease-out forwards`,
  willChange: 'opacity',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ShieldEffect({ active, onComplete }: ShieldEffectProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) return;

    timerRef.current = setTimeout(() => {
      onComplete?.();
    }, SHIELD_DURATION);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, onComplete]);

  if (!active) return null;

  ensureKeyframes();

  return (
    <div style={containerStyle} aria-hidden="true">
      {/* Background red vignette */}
      <div style={vignetteStyle} />
      {/* Radial glow */}
      <div style={glowStyle} />
      {/* Hex-patterned dome */}
      <div style={shieldDomeStyle} />
      {/* Expanding ripple rings */}
      <div style={ripple1Style} />
      <div style={ripple2Style} />
    </div>
  );
}
