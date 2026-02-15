import { useEffect, useRef, type CSSProperties } from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WarpEffectProps {
  /** When true the warp speed animation plays. */
  active: boolean;
  /** Called when the ~1.5 s animation finishes. */
  onComplete?: () => void;
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const SPACE_VOID = '#0a0e17';
const PURPLE_WARP = '#8b5cf6';
const CYAN_GLOW = '#00c8ff';

// ---------------------------------------------------------------------------
// Duration (ms)
// ---------------------------------------------------------------------------

const WARP_DURATION = 1500;

// ---------------------------------------------------------------------------
// Keyframes injected once
// ---------------------------------------------------------------------------

const KEYFRAME_ID = '__warp-effect-keyframes__';

function ensureKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAME_ID)) return;

  const style = document.createElement('style');
  style.id = KEYFRAME_ID;
  style.textContent = `
    /* --- Star-streak layer --- */
    @keyframes warpStreaks {
      0% {
        opacity: 0;
        transform: scale(0.3);
        filter: blur(0px);
      }
      15% {
        opacity: 1;
        transform: scale(0.6);
        filter: blur(1px);
      }
      50% {
        opacity: 1;
        transform: scale(1.8);
        filter: blur(3px);
      }
      75% {
        opacity: 0.6;
        transform: scale(3.5);
        filter: blur(6px);
      }
      100% {
        opacity: 0;
        transform: scale(5);
        filter: blur(10px);
      }
    }

    /* --- Radial speed-line layer --- */
    @keyframes warpLines {
      0% {
        opacity: 0;
        transform: scale(0.2) rotate(0deg);
      }
      20% {
        opacity: 0.9;
        transform: scale(0.8) rotate(5deg);
      }
      55% {
        opacity: 1;
        transform: scale(2) rotate(12deg);
      }
      100% {
        opacity: 0;
        transform: scale(4) rotate(18deg);
      }
    }

    /* --- White flash overlay --- */
    @keyframes warpFlash {
      0%   { opacity: 0; }
      40%  { opacity: 0; }
      60%  { opacity: 0.95; }
      80%  { opacity: 1; }
      100% { opacity: 0; }
    }

    /* --- Central warp-tunnel glow --- */
    @keyframes warpTunnel {
      0%   { opacity: 0; transform: scale(0.1); }
      30%  { opacity: 0.8; transform: scale(0.5); }
      60%  { opacity: 1; transform: scale(1.2); }
      100% { opacity: 0; transform: scale(2.5); }
    }

    /* --- Outer ring pulse --- */
    @keyframes warpRing {
      0%   { opacity: 0; transform: scale(0.05); }
      25%  { opacity: 0.7; transform: scale(0.4); }
      50%  { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(3); }
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
};

/** Radial streaks that simulate stars elongating from the centre. */
const streaksStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: `repeating-conic-gradient(
    from 0deg at 50% 50%,
    rgba(255, 255, 255, 0.0) 0deg,
    rgba(200, 220, 255, 0.6) 0.4deg,
    rgba(255, 255, 255, 0.0) 0.9deg,
    rgba(180, 200, 255, 0.0) 2.4deg
  )`,
  animation: `warpStreaks ${WARP_DURATION}ms ease-in forwards`,
  willChange: 'transform, opacity, filter',
};

/** A second streak layer with slightly different spacing for density. */
const streaks2Style: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: `repeating-conic-gradient(
    from 1.2deg at 50% 50%,
    rgba(255, 255, 255, 0.0) 0deg,
    rgba(139, 92, 246, 0.5) 0.25deg,
    rgba(0, 200, 255, 0.35) 0.5deg,
    rgba(255, 255, 255, 0.0) 1.8deg
  )`,
  animation: `warpLines ${WARP_DURATION}ms ease-in forwards`,
  willChange: 'transform, opacity',
};

/** Central glowing warp tunnel. */
const tunnelStyle: CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  width: '40vmin',
  height: '40vmin',
  marginTop: '-20vmin',
  marginLeft: '-20vmin',
  borderRadius: '50%',
  background: `radial-gradient(circle, ${CYAN_GLOW}88 0%, ${PURPLE_WARP}44 40%, transparent 70%)`,
  boxShadow: `
    0 0 60px 30px ${CYAN_GLOW}33,
    0 0 120px 60px ${PURPLE_WARP}22
  `,
  animation: `warpTunnel ${WARP_DURATION}ms ease-out forwards`,
  willChange: 'transform, opacity',
};

/** Expanding ring at the warp entry point. */
const ringStyle: CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  width: '50vmin',
  height: '50vmin',
  marginTop: '-25vmin',
  marginLeft: '-25vmin',
  borderRadius: '50%',
  border: `2px solid ${CYAN_GLOW}`,
  boxShadow: `
    0 0 20px 4px ${CYAN_GLOW}66,
    inset 0 0 20px 4px ${CYAN_GLOW}33
  `,
  background: 'transparent',
  animation: `warpRing ${WARP_DURATION}ms ease-out forwards`,
  willChange: 'transform, opacity',
};

/** Full-screen white flash at peak warp. */
const flashStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: `radial-gradient(circle at 50% 50%, #ffffff, ${CYAN_GLOW}44 60%, ${SPACE_VOID}00 100%)`,
  animation: `warpFlash ${WARP_DURATION}ms ease-in-out forwards`,
  willChange: 'opacity',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WarpEffect({ active, onComplete }: WarpEffectProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) return;

    timerRef.current = setTimeout(() => {
      onComplete?.();
    }, WARP_DURATION);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, onComplete]);

  if (!active) return null;

  ensureKeyframes();

  return (
    <div style={containerStyle} aria-hidden="true">
      {/* Star streaks (two overlapping layers for density) */}
      <div style={streaksStyle} />
      <div style={streaks2Style} />
      {/* Central warp tunnel glow */}
      <div style={tunnelStyle} />
      {/* Expanding ring */}
      <div style={ringStyle} />
      {/* White flash at peak */}
      <div style={flashStyle} />
    </div>
  );
}
