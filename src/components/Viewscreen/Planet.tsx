import React, { useMemo } from 'react';

/* ============================================================
   Planet Component — Central Visualization

   A large CSS/SVG-rendered sphere representing a project.
   Layers: atmosphere -> base sphere -> surface texture ->
           cloud layers -> progress ring -> label
   ============================================================ */

export interface PlanetProps {
  name: string;
  health: 'healthy' | 'warning' | 'error';
  progress: number; // 0-100
  onClick?: () => void;
}

/* ---------- Color Palettes per Health State ---------- */

const PALETTES = {
  healthy: {
    primary: '#1a7a6d',
    secondary: '#0e4f5c',
    surface: '#2d9b8a',
    highlight: '#5cecc6',
    atmosphere: 'rgba(0, 200, 180, 0.15)',
    atmosphereOuter: 'rgba(0, 200, 255, 0.05)',
    glow: 'rgba(0, 200, 180, 0.4)',
    cloudTint: 'rgba(180, 240, 230, 0.08)',
    gradient: 'radial-gradient(ellipse at 30% 25%, #5cecc6 0%, #2d9b8a 25%, #1a7a6d 50%, #0e4f5c 75%, #072a30 100%)',
  },
  warning: {
    primary: '#8a6a1a',
    secondary: '#5c3d0e',
    surface: '#b8891f',
    highlight: '#ffc857',
    atmosphere: 'rgba(255, 159, 28, 0.15)',
    atmosphereOuter: 'rgba(255, 200, 50, 0.05)',
    glow: 'rgba(255, 159, 28, 0.4)',
    cloudTint: 'rgba(255, 220, 150, 0.08)',
    gradient: 'radial-gradient(ellipse at 30% 25%, #ffc857 0%, #b8891f 25%, #8a6a1a 50%, #5c3d0e 75%, #2e1d05 100%)',
  },
  error: {
    primary: '#8a1a1a',
    secondary: '#5c0e0e',
    surface: '#c03030',
    highlight: '#ff6b6b',
    atmosphere: 'rgba(255, 51, 68, 0.15)',
    atmosphereOuter: 'rgba(255, 80, 80, 0.05)',
    glow: 'rgba(255, 51, 68, 0.4)',
    cloudTint: 'rgba(255, 180, 180, 0.08)',
    gradient: 'radial-gradient(ellipse at 30% 25%, #ff6b6b 0%, #c03030 25%, #8a1a1a 50%, #5c0e0e 75%, #2e0505 100%)',
  },
} as const;

/* ---------- Constants ---------- */

const PLANET_SIZE = 340;
const ATMOSPHERE_SIZE = PLANET_SIZE + 60;
const RING_SIZE = PLANET_SIZE + 100;
const RING_RADIUS = (RING_SIZE - 4) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const TICK_COUNT = 72;

export default function Planet({ name, health, progress, onClick }: PlanetProps) {
  const palette = PALETTES[health];
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const dashOffset = RING_CIRCUMFERENCE - (clampedProgress / 100) * RING_CIRCUMFERENCE;

  /* Pre-compute tick marks */
  const ticks = useMemo(() => {
    const items: React.ReactNode[] = [];
    for (let i = 0; i < TICK_COUNT; i++) {
      const angle = (i / TICK_COUNT) * 360;
      const isMajor = i % 9 === 0;
      items.push(
        <line
          key={i}
          x1={RING_SIZE / 2}
          y1={4}
          x2={RING_SIZE / 2}
          y2={isMajor ? 14 : 9}
          stroke="rgba(0, 200, 255, 0.35)"
          strokeWidth={isMajor ? 1.5 : 0.7}
          transform={`rotate(${angle} ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      );
    }
    return items;
  }, []);

  /* ---------- Inline Styles ---------- */

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: onClick ? 'pointer' : 'default',
    userSelect: 'none',
    /* Enough room for atmosphere + ring + label */
    width: RING_SIZE + 40,
    height: RING_SIZE + 80,
  };

  /* --- Atmosphere --- */
  const atmosphereStyle: React.CSSProperties = {
    position: 'absolute',
    width: ATMOSPHERE_SIZE,
    height: ATMOSPHERE_SIZE,
    borderRadius: '50%',
    background: `radial-gradient(circle, ${palette.atmosphere} 40%, ${palette.atmosphereOuter} 65%, transparent 72%)`,
    boxShadow: `0 0 60px 20px ${palette.glow}, 0 0 120px 40px ${palette.atmosphereOuter}`,
    animation: 'atmosphere-breathe 6s ease-in-out infinite, pulse-glow 4s ease-in-out infinite',
    pointerEvents: 'none',
    zIndex: 0,
  };

  /* --- Base Sphere --- */
  const sphereStyle: React.CSSProperties = {
    position: 'absolute',
    width: PLANET_SIZE,
    height: PLANET_SIZE,
    borderRadius: '50%',
    background: palette.gradient,
    boxShadow: `inset -8px -12px 30px rgba(0,0,0,0.6), inset 4px 6px 20px rgba(255,255,255,0.05), 0 0 30px 5px ${palette.glow}`,
    overflow: 'hidden',
    zIndex: 1,
  };

  /* --- Surface Texture Layer --- */
  const surfaceTextureStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    /* Multiple layered gradients simulate continental / terrain patterns */
    background: [
      /* Noise-like pattern from overlapping conic gradients */
      `conic-gradient(from 45deg at 35% 40%, transparent 0deg, ${palette.cloudTint} 15deg, transparent 30deg, transparent 90deg, ${palette.cloudTint} 100deg, transparent 115deg, transparent 180deg, ${palette.cloudTint} 195deg, transparent 210deg, transparent 270deg, ${palette.cloudTint} 285deg, transparent 300deg)`,
      /* Simulated continental masses via radial spots */
      `radial-gradient(ellipse 80px 50px at 30% 45%, rgba(255,255,255,0.04) 0%, transparent 100%)`,
      `radial-gradient(ellipse 60px 90px at 65% 60%, rgba(255,255,255,0.03) 0%, transparent 100%)`,
      `radial-gradient(ellipse 40px 35px at 50% 25%, rgba(255,255,255,0.03) 0%, transparent 100%)`,
      `radial-gradient(ellipse 70px 40px at 75% 30%, rgba(255,255,255,0.025) 0%, transparent 100%)`,
      `radial-gradient(ellipse 55px 65px at 20% 70%, rgba(255,255,255,0.03) 0%, transparent 100%)`,
      /* Fine grain via repeating radial */
      `repeating-radial-gradient(circle at 50% 50%, transparent 0px, transparent 3px, rgba(255,255,255,0.008) 3px, rgba(255,255,255,0.008) 4px)`,
    ].join(', '),
    mixBlendMode: 'screen',
    zIndex: 2,
  };

  /* --- Cloud Layer 1 (slow clockwise) --- */
  const cloudLayer1Style: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: [
      `radial-gradient(ellipse 120px 30px at 25% 35%, ${palette.cloudTint} 0%, transparent 70%)`,
      `radial-gradient(ellipse 90px 20px at 60% 50%, ${palette.cloudTint} 0%, transparent 70%)`,
      `radial-gradient(ellipse 70px 25px at 40% 70%, ${palette.cloudTint} 0%, transparent 70%)`,
      `radial-gradient(ellipse 100px 15px at 75% 25%, ${palette.cloudTint} 0%, transparent 70%)`,
      `radial-gradient(ellipse 60px 20px at 15% 55%, ${palette.cloudTint} 0%, transparent 70%)`,
    ].join(', '),
    animation: 'rotate-slow 60s linear infinite',
    mixBlendMode: 'screen',
    zIndex: 3,
  };

  /* --- Cloud Layer 2 (counter-clockwise, faster) --- */
  const cloudLayer2Style: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: [
      `radial-gradient(ellipse 80px 18px at 55% 30%, ${palette.cloudTint} 0%, transparent 70%)`,
      `radial-gradient(ellipse 110px 22px at 30% 60%, ${palette.cloudTint} 0%, transparent 70%)`,
      `radial-gradient(ellipse 50px 16px at 70% 75%, ${palette.cloudTint} 0%, transparent 70%)`,
      `radial-gradient(ellipse 90px 14px at 45% 45%, ${palette.cloudTint} 0%, transparent 70%)`,
    ].join(', '),
    animation: 'rotate-slow-reverse 45s linear infinite',
    mixBlendMode: 'screen',
    opacity: 0.7,
    zIndex: 4,
  };

  /* --- Terminator / Rim Darkness --- */
  const terminatorStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: 'radial-gradient(ellipse at 70% 65%, transparent 30%, rgba(0,0,0,0.45) 70%, rgba(0,0,0,0.7) 100%)',
    zIndex: 5,
    pointerEvents: 'none',
  };

  /* --- Specular Highlight --- */
  const specularStyle: React.CSSProperties = {
    position: 'absolute',
    width: PLANET_SIZE * 0.55,
    height: PLANET_SIZE * 0.35,
    top: PLANET_SIZE * 0.08,
    left: PLANET_SIZE * 0.12,
    borderRadius: '50%',
    background: 'radial-gradient(ellipse at 50% 60%, rgba(255,255,255,0.12) 0%, transparent 70%)',
    zIndex: 6,
    pointerEvents: 'none',
  };

  /* --- Ring Container (SVG) --- */
  const ringContainerStyle: React.CSSProperties = {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    zIndex: 7,
    pointerEvents: 'none',
    animation: 'rotate-slow 90s linear infinite',
  };

  /* --- Label --- */
  const labelStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 0,
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '3px',
    textTransform: 'uppercase',
    color: 'var(--text-highlight, #00c8ff)',
    textShadow: '0 0 10px rgba(0, 200, 255, 0.6), 0 0 30px rgba(0, 200, 255, 0.3)',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    zIndex: 10,
  };

  /* --- Progress Readout --- */
  const progressReadoutStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 24,
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '11px',
    fontWeight: 400,
    letterSpacing: '1px',
    color: 'var(--text-secondary, #7a8ba8)',
    textAlign: 'center',
    zIndex: 10,
  };

  return (
    <div
      style={containerStyle}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`Project ${name}: ${health} status, ${clampedProgress}% progress`}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      {/* Atmosphere Aura */}
      <div style={atmosphereStyle} />

      {/* Planet Body */}
      <div style={sphereStyle}>
        {/* Surface Texture */}
        <div style={surfaceTextureStyle} />

        {/* Cloud Layer 1 */}
        <div style={cloudLayer1Style} />

        {/* Cloud Layer 2 */}
        <div style={cloudLayer2Style} />

        {/* Terminator Shadow */}
        <div style={terminatorStyle} />

        {/* Specular Highlight */}
        <div style={specularStyle} />
      </div>

      {/* Holographic Progress Ring */}
      <svg
        style={ringContainerStyle}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Tick Marks */}
        {ticks}

        {/* Background Ring Track */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="rgba(0, 200, 255, 0.08)"
          strokeWidth={2}
        />

        {/* Progress Arc */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="var(--cyan-glow, #00c8ff)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          style={{
            transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: 'drop-shadow(0 0 4px rgba(0, 200, 255, 0.6))',
          }}
        />

        {/* Glow duplicate for extra brightness */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="rgba(0, 200, 255, 0.2)"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          style={{
            transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: 'blur(3px)',
          }}
        />
      </svg>

      {/* Progress Percentage */}
      <span style={progressReadoutStyle}>
        {clampedProgress.toFixed(0)}%
      </span>

      {/* Project Name */}
      <span style={labelStyle}>{name}</span>
    </div>
  );
}
