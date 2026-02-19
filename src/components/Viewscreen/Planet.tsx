import React, { useMemo } from 'react';

/* ============================================================
   Planet Component — Central Visualization

   A large CSS/SVG-rendered sphere representing a project.
   Layers: atmosphere -> base sphere -> surface texture ->
           cloud layers -> progress ring -> label

   Each project gets a unique visual theme from PLANET_THEMES,
   selected by paletteIndex. Themes vary in color, cloud
   density/speed, atmosphere, surface texture, and lighting.
   ============================================================ */

export interface PlanetProps {
  name: string;
  health: 'healthy' | 'warning' | 'error';
  progress: number; // 0-100
  paletteIndex?: number;
  onClick?: () => void;
}

/* ---------- Planet Theme Definition ---------- */

interface PlanetTheme {
  /** Display name for the planet class */
  className: string;

  /* --- Colors --- */
  primary: string;
  secondary: string;
  surface: string;
  highlight: string;
  atmosphere: string;
  atmosphereOuter: string;
  glow: string;
  cloudTint: string;
  gradient: string;

  /* --- Cloud Behavior --- */
  cloudSpeed1: number;      // seconds for cloud layer 1 full rotation
  cloudSpeed2: number;      // seconds for cloud layer 2 full rotation
  cloudOpacity1: number;    // 0-1 opacity of cloud layer 1
  cloudOpacity2: number;    // 0-1 opacity of cloud layer 2

  /* --- Atmosphere --- */
  atmosphereScale: number;  // multiplier on atmosphere size (0.5-1.5)
  breatheSpeed: number;     // seconds for atmosphere breathe cycle

  /* --- Surface --- */
  surfaceOpacity: number;   // 0-1 how visible continental textures are
  surfaceDetail: 'sparse' | 'moderate' | 'dense';

  /* --- Lighting --- */
  terminatorHarsh: number;    // 0-1 how sharp the day/night line is
  specularIntensity: number;  // 0-0.25 brightness of the specular highlight
  specularSize: number;       // 0.3-0.7 size multiplier

  /* --- Ring accent color (progress ring tint) --- */
  ringColor: string;
}

/* ---------- 8 Curated Vintage Sci-Fi Planet Themes ---------- */

export const PLANET_THEMES: PlanetTheme[] = [
  /* 0 — CLASS M: Terran — Classic oceanic world, blue-green, Earth-like */
  {
    className: 'Class M — Terran',
    primary: '#1a7a6d',
    secondary: '#0e4f5c',
    surface: '#2d9b8a',
    highlight: '#5cecc6',
    atmosphere: 'rgba(0, 200, 180, 0.15)',
    atmosphereOuter: 'rgba(0, 200, 255, 0.05)',
    glow: 'rgba(0, 200, 180, 0.4)',
    cloudTint: 'rgba(180, 240, 230, 0.08)',
    gradient: 'radial-gradient(ellipse at 30% 25%, #5cecc6 0%, #2d9b8a 25%, #1a7a6d 50%, #0e4f5c 75%, #072a30 100%)',
    cloudSpeed1: 60,
    cloudSpeed2: 45,
    cloudOpacity1: 1,
    cloudOpacity2: 0.7,
    atmosphereScale: 1.0,
    breatheSpeed: 6,
    surfaceOpacity: 1.0,
    surfaceDetail: 'moderate',
    terminatorHarsh: 0.45,
    specularIntensity: 0.12,
    specularSize: 0.55,
    ringColor: '#00c8ff',
  },

  /* 1 — CLASS H: LCARS Amber — Warm desert world, amber/gold, Vulcan vibes */
  {
    className: 'Class H — Desert',
    primary: '#8a6a1a',
    secondary: '#5c3d0e',
    surface: '#b8891f',
    highlight: '#ffc857',
    atmosphere: 'rgba(255, 180, 50, 0.12)',
    atmosphereOuter: 'rgba(255, 200, 50, 0.04)',
    glow: 'rgba(255, 159, 28, 0.35)',
    cloudTint: 'rgba(255, 220, 150, 0.06)',
    gradient: 'radial-gradient(ellipse at 30% 25%, #ffc857 0%, #b8891f 25%, #8a6a1a 50%, #5c3d0e 75%, #2e1d05 100%)',
    cloudSpeed1: 90,
    cloudSpeed2: 70,
    cloudOpacity1: 0.4,
    cloudOpacity2: 0.25,
    atmosphereScale: 0.7,
    breatheSpeed: 8,
    surfaceOpacity: 1.4,
    surfaceDetail: 'dense',
    terminatorHarsh: 0.6,
    specularIntensity: 0.18,
    specularSize: 0.4,
    ringColor: '#ffc857',
  },

  /* 2 — CLASS J: Nebula Violet — Gas giant, deep purple/indigo, swirling storms */
  {
    className: 'Class J — Gas Giant',
    primary: '#4a2080',
    secondary: '#2d1060',
    surface: '#6b3fa0',
    highlight: '#b088e0',
    atmosphere: 'rgba(140, 80, 220, 0.18)',
    atmosphereOuter: 'rgba(100, 60, 180, 0.06)',
    glow: 'rgba(140, 80, 220, 0.45)',
    cloudTint: 'rgba(180, 140, 240, 0.10)',
    gradient: 'radial-gradient(ellipse at 30% 25%, #b088e0 0%, #6b3fa0 25%, #4a2080 50%, #2d1060 75%, #150835 100%)',
    cloudSpeed1: 30,
    cloudSpeed2: 22,
    cloudOpacity1: 1.0,
    cloudOpacity2: 0.9,
    atmosphereScale: 1.3,
    breatheSpeed: 5,
    surfaceOpacity: 0.5,
    surfaceDetail: 'sparse',
    terminatorHarsh: 0.3,
    specularIntensity: 0.08,
    specularSize: 0.65,
    ringColor: '#b088e0',
  },

  /* 3 — CLASS Y: Crimson — Volcanic world, deep red, Klingon homeworld feel */
  {
    className: 'Class Y — Volcanic',
    primary: '#8a1a1a',
    secondary: '#5c0e0e',
    surface: '#c03030',
    highlight: '#ff6b6b',
    atmosphere: 'rgba(255, 60, 40, 0.14)',
    atmosphereOuter: 'rgba(255, 80, 60, 0.05)',
    glow: 'rgba(255, 51, 68, 0.4)',
    cloudTint: 'rgba(255, 160, 140, 0.07)',
    gradient: 'radial-gradient(ellipse at 30% 25%, #ff6b6b 0%, #c03030 25%, #8a1a1a 50%, #5c0e0e 75%, #2e0505 100%)',
    cloudSpeed1: 50,
    cloudSpeed2: 38,
    cloudOpacity1: 0.6,
    cloudOpacity2: 0.4,
    atmosphereScale: 0.85,
    breatheSpeed: 4,
    surfaceOpacity: 1.2,
    surfaceDetail: 'dense',
    terminatorHarsh: 0.55,
    specularIntensity: 0.15,
    specularSize: 0.45,
    ringColor: '#ff6b6b',
  },

  /* 4 — CLASS L: Emerald — Jungle world, lush green, Romulan territory */
  {
    className: 'Class L — Jungle',
    primary: '#1a6a2a',
    secondary: '#0e4a18',
    surface: '#2d9040',
    highlight: '#5cec78',
    atmosphere: 'rgba(40, 200, 80, 0.14)',
    atmosphereOuter: 'rgba(60, 220, 100, 0.05)',
    glow: 'rgba(40, 200, 80, 0.35)',
    cloudTint: 'rgba(160, 240, 180, 0.09)',
    gradient: 'radial-gradient(ellipse at 30% 25%, #5cec78 0%, #2d9040 25%, #1a6a2a 50%, #0e4a18 75%, #062e0a 100%)',
    cloudSpeed1: 55,
    cloudSpeed2: 40,
    cloudOpacity1: 0.9,
    cloudOpacity2: 0.7,
    atmosphereScale: 1.1,
    breatheSpeed: 7,
    surfaceOpacity: 1.3,
    surfaceDetail: 'dense',
    terminatorHarsh: 0.4,
    specularIntensity: 0.10,
    specularSize: 0.50,
    ringColor: '#5cec78',
  },

  /* 5 — CLASS K: Copper — Arid/desert world, bronze tones, ancient ruins feel */
  {
    className: 'Class K — Arid',
    primary: '#7a5030',
    secondary: '#5a3520',
    surface: '#a06838',
    highlight: '#d4a060',
    atmosphere: 'rgba(200, 140, 60, 0.10)',
    atmosphereOuter: 'rgba(180, 120, 50, 0.04)',
    glow: 'rgba(200, 140, 60, 0.30)',
    cloudTint: 'rgba(220, 180, 130, 0.05)',
    gradient: 'radial-gradient(ellipse at 30% 25%, #d4a060 0%, #a06838 25%, #7a5030 50%, #5a3520 75%, #2e1a0e 100%)',
    cloudSpeed1: 100,
    cloudSpeed2: 80,
    cloudOpacity1: 0.3,
    cloudOpacity2: 0.15,
    atmosphereScale: 0.6,
    breatheSpeed: 10,
    surfaceOpacity: 1.5,
    surfaceDetail: 'dense',
    terminatorHarsh: 0.65,
    specularIntensity: 0.20,
    specularSize: 0.35,
    ringColor: '#d4a060',
  },

  /* 6 — CLASS P: Ice — Frozen world, ice blue/silver, Andorian homeworld */
  {
    className: 'Class P — Frozen',
    primary: '#3a6a8a',
    secondary: '#254a6a',
    surface: '#5a9ab8',
    highlight: '#a0d8f0',
    atmosphere: 'rgba(140, 200, 240, 0.16)',
    atmosphereOuter: 'rgba(160, 220, 255, 0.06)',
    glow: 'rgba(140, 200, 240, 0.40)',
    cloudTint: 'rgba(200, 230, 255, 0.10)',
    gradient: 'radial-gradient(ellipse at 30% 25%, #a0d8f0 0%, #5a9ab8 25%, #3a6a8a 50%, #254a6a 75%, #102030 100%)',
    cloudSpeed1: 40,
    cloudSpeed2: 30,
    cloudOpacity1: 1.0,
    cloudOpacity2: 0.85,
    atmosphereScale: 1.2,
    breatheSpeed: 8,
    surfaceOpacity: 0.8,
    surfaceDetail: 'moderate',
    terminatorHarsh: 0.35,
    specularIntensity: 0.22,
    specularSize: 0.60,
    ringColor: '#a0d8f0',
  },

  /* 7 — CLASS T: Magenta — Exotic anomaly, pink/magenta, strange new world */
  {
    className: 'Class T — Anomaly',
    primary: '#8a2070',
    secondary: '#601050',
    surface: '#b03890',
    highlight: '#e880c8',
    atmosphere: 'rgba(220, 80, 180, 0.16)',
    atmosphereOuter: 'rgba(240, 100, 200, 0.06)',
    glow: 'rgba(220, 80, 180, 0.40)',
    cloudTint: 'rgba(240, 170, 220, 0.09)',
    gradient: 'radial-gradient(ellipse at 30% 25%, #e880c8 0%, #b03890 25%, #8a2070 50%, #601050 75%, #300828 100%)',
    cloudSpeed1: 35,
    cloudSpeed2: 25,
    cloudOpacity1: 0.8,
    cloudOpacity2: 0.65,
    atmosphereScale: 1.4,
    breatheSpeed: 4,
    surfaceOpacity: 0.6,
    surfaceDetail: 'sparse',
    terminatorHarsh: 0.30,
    specularIntensity: 0.10,
    specularSize: 0.60,
    ringColor: '#e880c8',
  },
];

export const PLANET_THEME_COUNT = PLANET_THEMES.length;

/* ---------- Surface Texture Generators ---------- */

function buildSurfaceTexture(theme: PlanetTheme): string {
  const ct = theme.cloudTint;
  const baseOpacity = theme.surfaceOpacity;
  const o = (v: number) => (v * baseOpacity).toFixed(3);

  const conic = `conic-gradient(from 45deg at 35% 40%, transparent 0deg, ${ct} 15deg, transparent 30deg, transparent 90deg, ${ct} 100deg, transparent 115deg, transparent 180deg, ${ct} 195deg, transparent 210deg, transparent 270deg, ${ct} 285deg, transparent 300deg)`;

  if (theme.surfaceDetail === 'sparse') {
    // Minimal continental features — more ocean/gas
    return [
      conic,
      `radial-gradient(ellipse 60px 40px at 35% 45%, rgba(255,255,255,${o(0.03)}) 0%, transparent 100%)`,
      `radial-gradient(ellipse 45px 55px at 65% 55%, rgba(255,255,255,${o(0.025)}) 0%, transparent 100%)`,
      `repeating-radial-gradient(circle at 50% 50%, transparent 0px, transparent 4px, rgba(255,255,255,${o(0.006)}) 4px, rgba(255,255,255,${o(0.006)}) 5px)`,
    ].join(', ');
  }

  if (theme.surfaceDetail === 'dense') {
    // Heavy terrain — lots of continental features, volcanic/desert patterns
    return [
      conic,
      `radial-gradient(ellipse 90px 55px at 25% 40%, rgba(255,255,255,${o(0.05)}) 0%, transparent 100%)`,
      `radial-gradient(ellipse 70px 100px at 60% 55%, rgba(255,255,255,${o(0.04)}) 0%, transparent 100%)`,
      `radial-gradient(ellipse 50px 40px at 45% 25%, rgba(255,255,255,${o(0.04)}) 0%, transparent 100%)`,
      `radial-gradient(ellipse 80px 45px at 75% 35%, rgba(255,255,255,${o(0.035)}) 0%, transparent 100%)`,
      `radial-gradient(ellipse 65px 75px at 20% 65%, rgba(255,255,255,${o(0.04)}) 0%, transparent 100%)`,
      `radial-gradient(ellipse 40px 50px at 80% 70%, rgba(255,255,255,${o(0.03)}) 0%, transparent 100%)`,
      `radial-gradient(ellipse 55px 30px at 50% 80%, rgba(255,255,255,${o(0.025)}) 0%, transparent 100%)`,
      `repeating-radial-gradient(circle at 50% 50%, transparent 0px, transparent 2px, rgba(255,255,255,${o(0.01)}) 2px, rgba(255,255,255,${o(0.01)}) 3px)`,
    ].join(', ');
  }

  // moderate (default)
  return [
    conic,
    `radial-gradient(ellipse 80px 50px at 30% 45%, rgba(255,255,255,${o(0.04)}) 0%, transparent 100%)`,
    `radial-gradient(ellipse 60px 90px at 65% 60%, rgba(255,255,255,${o(0.03)}) 0%, transparent 100%)`,
    `radial-gradient(ellipse 40px 35px at 50% 25%, rgba(255,255,255,${o(0.03)}) 0%, transparent 100%)`,
    `radial-gradient(ellipse 70px 40px at 75% 30%, rgba(255,255,255,${o(0.025)}) 0%, transparent 100%)`,
    `radial-gradient(ellipse 55px 65px at 20% 70%, rgba(255,255,255,${o(0.03)}) 0%, transparent 100%)`,
    `repeating-radial-gradient(circle at 50% 50%, transparent 0px, transparent 3px, rgba(255,255,255,${o(0.008)}) 3px, rgba(255,255,255,${o(0.008)}) 4px)`,
  ].join(', ');
}

/* ---------- Cloud Layer Generators ---------- */

function buildCloudLayer1(theme: PlanetTheme): string {
  const ct = theme.cloudTint;
  return [
    `radial-gradient(ellipse 120px 30px at 25% 35%, ${ct} 0%, transparent 70%)`,
    `radial-gradient(ellipse 90px 20px at 60% 50%, ${ct} 0%, transparent 70%)`,
    `radial-gradient(ellipse 70px 25px at 40% 70%, ${ct} 0%, transparent 70%)`,
    `radial-gradient(ellipse 100px 15px at 75% 25%, ${ct} 0%, transparent 70%)`,
    `radial-gradient(ellipse 60px 20px at 15% 55%, ${ct} 0%, transparent 70%)`,
  ].join(', ');
}

function buildCloudLayer2(theme: PlanetTheme): string {
  const ct = theme.cloudTint;
  return [
    `radial-gradient(ellipse 80px 18px at 55% 30%, ${ct} 0%, transparent 70%)`,
    `radial-gradient(ellipse 110px 22px at 30% 60%, ${ct} 0%, transparent 70%)`,
    `radial-gradient(ellipse 50px 16px at 70% 75%, ${ct} 0%, transparent 70%)`,
    `radial-gradient(ellipse 90px 14px at 45% 45%, ${ct} 0%, transparent 70%)`,
  ].join(', ');
}

/* ---------- Constants ---------- */

const PLANET_SIZE = 340;
const RING_SIZE = PLANET_SIZE + 100;
const RING_RADIUS = (RING_SIZE - 4) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const TICK_COUNT = 72;

export default function Planet({ name, health, progress, paletteIndex = 0, onClick }: PlanetProps) {
  const theme = PLANET_THEMES[paletteIndex % PLANET_THEMES.length];
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const dashOffset = RING_CIRCUMFERENCE - (clampedProgress / 100) * RING_CIRCUMFERENCE;

  /* Derived sizes from theme */
  const atmosphereSize = PLANET_SIZE + Math.round(60 * theme.atmosphereScale);

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
          stroke={`${theme.ringColor}59`}
          strokeWidth={isMajor ? 1.5 : 0.7}
          transform={`rotate(${angle} ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      );
    }
    return items;
  }, [theme.ringColor]);

  /* Pre-compute layer backgrounds */
  const surfaceBackground = useMemo(() => buildSurfaceTexture(theme), [theme]);
  const cloud1Background = useMemo(() => buildCloudLayer1(theme), [theme]);
  const cloud2Background = useMemo(() => buildCloudLayer2(theme), [theme]);

  /* ---------- Inline Styles ---------- */

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: onClick ? 'pointer' : 'default',
    userSelect: 'none',
    width: RING_SIZE + 40,
    height: RING_SIZE + 80,
  };

  /* --- Atmosphere --- */
  const atmosphereStyle: React.CSSProperties = {
    position: 'absolute',
    width: atmosphereSize,
    height: atmosphereSize,
    borderRadius: '50%',
    background: `radial-gradient(circle, ${theme.atmosphere} 40%, ${theme.atmosphereOuter} 65%, transparent 72%)`,
    boxShadow: `0 0 60px 20px ${theme.glow}, 0 0 120px 40px ${theme.atmosphereOuter}`,
    animation: `atmosphere-breathe ${theme.breatheSpeed}s ease-in-out infinite, pulse-glow ${theme.breatheSpeed * 0.67}s ease-in-out infinite`,
    pointerEvents: 'none',
    zIndex: 0,
  };

  /* --- Base Sphere --- */
  const sphereStyle: React.CSSProperties = {
    position: 'absolute',
    width: PLANET_SIZE,
    height: PLANET_SIZE,
    borderRadius: '50%',
    background: theme.gradient,
    boxShadow: `inset -8px -12px 30px rgba(0,0,0,0.6), inset 4px 6px 20px rgba(255,255,255,0.05), 0 0 30px 5px ${theme.glow}`,
    overflow: 'hidden',
    zIndex: 1,
  };

  /* --- Surface Texture Layer --- */
  const surfaceTextureStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: surfaceBackground,
    mixBlendMode: 'screen',
    zIndex: 2,
  };

  /* --- Cloud Layer 1 --- */
  const cloudLayer1Style: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: cloud1Background,
    animation: `rotate-slow ${theme.cloudSpeed1}s linear infinite`,
    mixBlendMode: 'screen',
    opacity: theme.cloudOpacity1,
    zIndex: 3,
  };

  /* --- Cloud Layer 2 --- */
  const cloudLayer2Style: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: cloud2Background,
    animation: `rotate-slow-reverse ${theme.cloudSpeed2}s linear infinite`,
    mixBlendMode: 'screen',
    opacity: theme.cloudOpacity2,
    zIndex: 4,
  };

  /* --- Terminator / Rim Darkness --- */
  const terminatorStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: `radial-gradient(ellipse at 70% 65%, transparent 30%, rgba(0,0,0,${theme.terminatorHarsh}) 70%, rgba(0,0,0,${Math.min(theme.terminatorHarsh + 0.25, 0.85)}) 100%)`,
    zIndex: 5,
    pointerEvents: 'none',
  };

  /* --- Specular Highlight --- */
  const specularStyle: React.CSSProperties = {
    position: 'absolute',
    width: PLANET_SIZE * theme.specularSize,
    height: PLANET_SIZE * theme.specularSize * 0.64,
    top: PLANET_SIZE * 0.08,
    left: PLANET_SIZE * 0.12,
    borderRadius: '50%',
    background: `radial-gradient(ellipse at 50% 60%, rgba(255,255,255,${theme.specularIntensity}) 0%, transparent 70%)`,
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
    color: theme.highlight,
    textShadow: `0 0 10px ${theme.highlight}99, 0 0 30px ${theme.highlight}44`,
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
          stroke={`${theme.ringColor}14`}
          strokeWidth={2}
        />

        {/* Progress Arc */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={theme.ringColor}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          style={{
            transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: `drop-shadow(0 0 4px ${theme.ringColor}99)`,
          }}
        />

        {/* Glow duplicate for extra brightness */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={`${theme.ringColor}33`}
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
