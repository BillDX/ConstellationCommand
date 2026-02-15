import { useState, useEffect, useRef, useMemo, type CSSProperties } from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TransporterEffectProps {
  /** When true the transporter beam animation plays. */
  active: boolean;
  /** Centre x position of the effect in pixels. */
  x: number;
  /** Centre y position of the effect in pixels. */
  y: number;
  /** Called when the ~1.2 s animation finishes. */
  onComplete?: () => void;
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const CYAN_GLOW = '#00c8ff';

// ---------------------------------------------------------------------------
// Duration (ms)
// ---------------------------------------------------------------------------

const EFFECT_DURATION = 1200;
const PARTICLE_COUNT = 42;

// ---------------------------------------------------------------------------
// Particle data (generated once per activation)
// ---------------------------------------------------------------------------

interface ParticleData {
  id: number;
  /** Horizontal offset from origin (px). */
  dx: number;
  /** Upward travel distance (px). */
  dy: number;
  /** Starting scatter offset x (px). */
  startX: number;
  /** Starting scatter offset y (px). */
  startY: number;
  /** Size in px. */
  size: number;
  /** Animation delay in ms. */
  delay: number;
  /** Individual particle duration in ms. */
  duration: number;
  /** Hue shift: 0 = cyan, slight variance adds life. */
  hue: number;
  /** Peak opacity. */
  peakOpacity: number;
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function generateParticles(): ParticleData[] {
  const particles: ParticleData[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      id: i,
      dx: rand(-60, 60),
      dy: rand(-120, -30),
      startX: rand(-18, 18),
      startY: rand(-18, 18),
      size: rand(2, 6),
      delay: rand(0, 300),
      duration: rand(600, 1000),
      hue: rand(-15, 15), // shift around 190 (cyan)
      peakOpacity: rand(0.6, 1),
    });
  }
  return particles;
}

// ---------------------------------------------------------------------------
// Keyframes injected once
// ---------------------------------------------------------------------------

const KEYFRAME_ID = '__transporter-effect-keyframes__';

function ensureKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAME_ID)) return;

  const style = document.createElement('style');
  style.id = KEYFRAME_ID;
  style.textContent = `
    @keyframes transporterParticle {
      0% {
        opacity: 0;
        transform: translate(var(--tp-sx), var(--tp-sy)) scale(1);
      }
      20% {
        opacity: var(--tp-peak);
        transform: translate(
          calc(var(--tp-sx) + var(--tp-dx) * 0.2),
          calc(var(--tp-sy) + var(--tp-dy) * 0.2)
        ) scale(1.3);
      }
      100% {
        opacity: 0;
        transform: translate(var(--tp-dx), var(--tp-dy)) scale(0.3);
      }
    }

    @keyframes transporterColumn {
      0%   { opacity: 0; transform: scaleY(0.3) scaleX(0.6); }
      15%  { opacity: 0.9; transform: scaleY(1) scaleX(1); }
      60%  { opacity: 0.7; transform: scaleY(1.1) scaleX(0.85); }
      100% { opacity: 0; transform: scaleY(1.4) scaleX(0.3); }
    }

    @keyframes transporterRing {
      0%   { opacity: 0; transform: scale(0.2); }
      30%  { opacity: 0.8; transform: scale(1); }
      100% { opacity: 0; transform: scale(2); }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function containerStyle(x: number, y: number): CSSProperties {
  return {
    position: 'fixed',
    left: x,
    top: y,
    width: 0,
    height: 0,
    pointerEvents: 'none',
    zIndex: 50,
    overflow: 'visible',
  };
}

function particleStyle(p: ParticleData): CSSProperties {
  const hue = 190 + p.hue;
  return {
    position: 'absolute',
    width: p.size,
    height: p.size,
    borderRadius: '50%',
    backgroundColor: `hsl(${hue}, 100%, 75%)`,
    boxShadow: `
      0 0 ${p.size * 2}px ${p.size}px hsla(${hue}, 100%, 65%, 0.6),
      0 0 ${p.size * 4}px ${p.size * 2}px hsla(${hue}, 100%, 55%, 0.3)
    `,
    // CSS custom properties drive the keyframe
    '--tp-sx': `${p.startX}px`,
    '--tp-sy': `${p.startY}px`,
    '--tp-dx': `${p.dx}px`,
    '--tp-dy': `${p.dy}px`,
    '--tp-peak': `${p.peakOpacity}`,
    animation: `transporterParticle ${p.duration}ms ease-out ${p.delay}ms forwards`,
    opacity: 0,
    willChange: 'transform, opacity',
  } as CSSProperties;
}

/** Vertical beam column centred on the origin. */
const columnStyle: CSSProperties = {
  position: 'absolute',
  left: -20,
  top: -80,
  width: 40,
  height: 160,
  borderRadius: '50% / 20%',
  background: `linear-gradient(
    180deg,
    transparent 0%,
    ${CYAN_GLOW}44 15%,
    ${CYAN_GLOW}aa 40%,
    #ffffffcc 50%,
    ${CYAN_GLOW}aa 60%,
    ${CYAN_GLOW}44 85%,
    transparent 100%
  )`,
  boxShadow: `
    0 0 30px 10px ${CYAN_GLOW}44,
    0 0 60px 20px ${CYAN_GLOW}22
  `,
  animation: `transporterColumn ${EFFECT_DURATION}ms ease-in-out forwards`,
  willChange: 'transform, opacity',
};

/** Expanding ring at the base of the beam. */
const ringStyle: CSSProperties = {
  position: 'absolute',
  left: -30,
  top: -6,
  width: 60,
  height: 12,
  borderRadius: '50%',
  border: `1.5px solid ${CYAN_GLOW}`,
  boxShadow: `0 0 12px 3px ${CYAN_GLOW}55`,
  animation: `transporterRing ${EFFECT_DURATION * 0.8}ms ease-out forwards`,
  willChange: 'transform, opacity',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TransporterEffect({
  active,
  x,
  y,
  onComplete,
}: TransporterEffectProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track activation count so we regenerate particles each time
  const [activationKey, setActivationKey] = useState(0);

  const particles = useMemo(() => generateParticles(), [activationKey]);

  useEffect(() => {
    if (!active) return;

    // Bump key to regenerate particle data on each activation
    setActivationKey((k) => k + 1);

    timerRef.current = setTimeout(() => {
      onComplete?.();
    }, EFFECT_DURATION);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, onComplete]);

  if (!active) return null;

  ensureKeyframes();

  return (
    <div style={containerStyle(x, y)} aria-hidden="true">
      {/* Beam column */}
      <div style={columnStyle} />
      {/* Base ring */}
      <div style={ringStyle} />
      {/* Scatter particles */}
      {particles.map((p) => (
        <div key={p.id} style={particleStyle(p)} />
      ))}
    </div>
  );
}
