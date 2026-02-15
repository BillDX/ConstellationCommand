import { type CSSProperties } from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ScanSweepProps {
  /** When false the sweep is hidden. Defaults to true. */
  active?: boolean;
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const CYAN_GLOW = '#00c8ff';

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

const ROTATION_DURATION = 6; // seconds per full sweep

// ---------------------------------------------------------------------------
// Keyframes injected once
// ---------------------------------------------------------------------------

const KEYFRAME_ID = '__scan-sweep-keyframes__';

function ensureKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAME_ID)) return;

  const style = document.createElement('style');
  style.id = KEYFRAME_ID;
  style.textContent = `
    @keyframes scanSweepRotate {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

/**
 * The outer container is centred on the viewport. It rotates continuously
 * and holds the radial sweep line + trailing gradient.
 */
const containerStyle: CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  width: 0,
  height: 0,
  pointerEvents: 'none',
  zIndex: 3,
  overflow: 'visible',
  animation: `scanSweepRotate ${ROTATION_DURATION}s linear infinite`,
  willChange: 'transform',
};

/**
 * The sweep line itself -- a thin radial beam pointing upward from the
 * rotation centre. It extends from the centre to beyond the viewport
 * corner so it always fills the screen radius.
 *
 * The line is 2px wide with a soft glow and very low opacity to stay
 * subtle.
 */
const lineStyle: CSSProperties = {
  position: 'absolute',
  left: -1,
  bottom: 0,
  width: 2,
  /* 100vmax ensures the line reaches the farthest viewport corner */
  height: '100vmax',
  background: `linear-gradient(
    to top,
    ${CYAN_GLOW}33 0%,
    ${CYAN_GLOW}66 20%,
    ${CYAN_GLOW}88 60%,
    ${CYAN_GLOW}aa 100%
  )`,
  opacity: 0.15,
  borderRadius: '1px',
  boxShadow: `0 0 6px 1px ${CYAN_GLOW}22`,
};

/**
 * The trailing wedge / fade behind the sweep line.  This gives the
 * classic radar "afterglow" look -- a conic gradient segment that
 * fades from the leading edge backwards over ~60 degrees.
 *
 * We position a large square centred at the rotation origin and use
 * a conic-gradient to paint only the trailing arc.
 */
const trailStyle: CSSProperties = {
  position: 'absolute',
  /* Centre a large square on the rotation origin */
  left: '-100vmax',
  bottom: '-100vmax',
  width: '200vmax',
  height: '100vmax',
  transformOrigin: '50% 100%',
  background: `conic-gradient(
    from -60deg at 50% 100%,
    transparent 0deg,
    ${CYAN_GLOW}08 15deg,
    ${CYAN_GLOW}12 35deg,
    ${CYAN_GLOW}18 50deg,
    ${CYAN_GLOW}22 58deg,
    transparent 60deg,
    transparent 360deg
  )`,
  opacity: 0.15,
  /* Mask to a circle so the trail doesn't paint into weird corners */
  clipPath: 'ellipse(100vmax 100vmax at 50% 100%)',
};

/**
 * A subtle dot at the rotation centre to anchor the sweep visually.
 */
const centreStyle: CSSProperties = {
  position: 'absolute',
  left: -3,
  top: -3,
  width: 6,
  height: 6,
  borderRadius: '50%',
  backgroundColor: CYAN_GLOW,
  opacity: 0.12,
  boxShadow: `0 0 8px 2px ${CYAN_GLOW}22`,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScanSweep({ active = true }: ScanSweepProps) {
  if (!active) return null;

  ensureKeyframes();

  return (
    <div style={containerStyle} aria-hidden="true">
      {/* Trailing afterglow wedge (renders behind the line) */}
      <div style={trailStyle} />
      {/* The sharp leading-edge scan line */}
      <div style={lineStyle} />
      {/* Centre dot */}
      <div style={centreStyle} />
    </div>
  );
}
