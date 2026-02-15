import { type CSSProperties } from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ScanlineOverlayProps {
  /** When false the overlay is fully hidden (no DOM cost for effects). */
  visible?: boolean;
}

// ---------------------------------------------------------------------------
// Styles (kept as CSSProperties objects to avoid an external CSS file)
// ---------------------------------------------------------------------------

const containerStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  pointerEvents: 'none',
  zIndex: 2,
  overflow: 'hidden',
};

/**
 * Horizontal scanlines: 2px repeating lines with very low opacity.
 */
const scanlinesStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.03) 0px, rgba(0, 0, 0, 0.03) 1px, transparent 1px, transparent 2px)',
  /* Every other line is slightly lit to simulate phosphor rows */
};

/**
 * CRT vignette / curvature effect using a radial gradient darkening at edges.
 */
const vignetteStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(ellipse 85% 80% at 50% 50%, transparent 60%, rgba(0, 0, 0, 0.55) 100%)',
};

/**
 * Animated scan beam -- a faint bright horizontal bar that sweeps top to
 * bottom over ~8 seconds.
 */
const scanBeamStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  width: '100%',
  height: '3px',
  background:
    'linear-gradient(180deg, transparent, rgba(140, 180, 255, 0.07), transparent)',
  /* The 60px spread gives it a soft halo */
  boxShadow: '0 0 30px 30px rgba(140, 180, 255, 0.025)',
  animation: 'scanBeamSweep 8s linear infinite',
};

// ---------------------------------------------------------------------------
// Keyframes injected once
// ---------------------------------------------------------------------------

const KEYFRAME_ID = '__scanline-overlay-keyframes__';

function ensureKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAME_ID)) return;

  const style = document.createElement('style');
  style.id = KEYFRAME_ID;
  style.textContent = `
    @keyframes scanBeamSweep {
      0%   { top: -60px; }
      100% { top: calc(100vh + 60px); }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScanlineOverlay({ visible = true }: ScanlineOverlayProps) {
  if (!visible) return null;

  // Inject keyframes on first visible render
  ensureKeyframes();

  return (
    <div style={containerStyle} aria-hidden="true">
      {/* Scanlines */}
      <div style={scanlinesStyle} />
      {/* CRT edge vignette */}
      <div style={vignetteStyle} />
      {/* Sweep beam */}
      <div style={scanBeamStyle} />
    </div>
  );
}
