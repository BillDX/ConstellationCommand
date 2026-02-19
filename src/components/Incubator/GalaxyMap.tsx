import React, { useState, useCallback, useMemo } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import type { Project } from '../../types';
import { PLANET_THEMES } from '../Viewscreen/Planet';

/* ============================================================
   GalaxyMap - Project Incubator / Galaxy Map View

   Full-screen galaxy map showing projects as star nodes with
   constellation lines connecting related projects. Each star
   represents a project, sized by progress and colored by health.
   ============================================================ */

interface GalaxyMapProps {
  onCreateProject: () => void;
}

/* ---------- Layout Constants ---------- */

const MAP_PADDING = 80;
const STAR_MIN_SIZE = 20;
const STAR_MAX_SIZE = 60;

/* ---------- Health Color Helper ---------- */

function getHealthColor(health: Project['health']): string {
  switch (health) {
    case 'healthy':
      return '#00ff88';
    case 'warning':
      return '#ff9f1c';
    case 'error':
      return '#ff3344';
    default:
      return '#7a8ba8';
  }
}

/* ---------- Status Label ---------- */

function getStatusLabel(status: Project['status']): string {
  return status.toUpperCase().replace('-', ' ');
}

/* ---------- Star Size from Progress ---------- */

function getStarSize(progress: number): number {
  const clamped = Math.max(0, Math.min(100, progress));
  return STAR_MIN_SIZE + (clamped / 100) * (STAR_MAX_SIZE - STAR_MIN_SIZE);
}

/* ---------- Deterministic Position for Project ---------- */

function getStarPosition(index: number, total: number, containerW: number, containerH: number): { x: number; y: number } {
  if (total === 1) {
    return { x: containerW / 2, y: containerH / 2 };
  }

  // Distribute nodes in a spiral-like pattern with deterministic offsets
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const angle = index * goldenAngle;
  const radius = Math.min(containerW, containerH) * 0.32 * Math.sqrt((index + 1) / total);
  const cx = containerW / 2;
  const cy = containerH / 2;

  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
}

/* ==========================================================
   Star Dust Background (SVG grid of dim dots)
   ========================================================== */

function StarDust({ width, height }: { width: number; height: number }) {
  const dots = useMemo(() => {
    const result: { x: number; y: number; r: number; opacity: number }[] = [];
    // Deterministic pseudo-random using simple seeded values
    const spacing = 40;
    for (let gx = 0; gx < width; gx += spacing) {
      for (let gy = 0; gy < height; gy += spacing) {
        // Simple hash for offset
        const hash = ((gx * 7919 + gy * 104729) % 1000) / 1000;
        const hash2 = ((gx * 6271 + gy * 87671) % 1000) / 1000;
        if (hash > 0.55) continue; // ~45% of grid cells get a dot
        result.push({
          x: gx + hash * spacing * 0.8,
          y: gy + hash2 * spacing * 0.8,
          r: 0.5 + hash * 1.2,
          opacity: 0.08 + hash2 * 0.18,
        });
      }
    }
    return result;
  }, [width, height]);

  return (
    <g>
      {dots.map((dot, i) => (
        <circle
          key={i}
          cx={dot.x}
          cy={dot.y}
          r={dot.r}
          fill="#e0f0ff"
          opacity={dot.opacity}
        />
      ))}
    </g>
  );
}

/* ==========================================================
   Constellation Lines (faint dashed lines between nodes)
   ========================================================== */

function ConstellationLines({
  positions,
}: {
  positions: { x: number; y: number }[];
}) {
  if (positions.length < 2) return null;

  // Connect each node to its next neighbor in a chain, plus
  // connect the last to the first if there are 3+ nodes
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < positions.length - 1; i++) {
    lines.push({
      x1: positions[i].x,
      y1: positions[i].y,
      x2: positions[i + 1].x,
      y2: positions[i + 1].y,
    });
  }
  if (positions.length >= 3) {
    lines.push({
      x1: positions[positions.length - 1].x,
      y1: positions[positions.length - 1].y,
      x2: positions[0].x,
      y2: positions[0].y,
    });
  }

  return (
    <g>
      {lines.map((line, i) => (
        <line
          key={i}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="rgba(0, 200, 255, 0.12)"
          strokeWidth={1}
          strokeDasharray="6 8"
        />
      ))}
    </g>
  );
}

/* ==========================================================
   Star Node Component
   ========================================================== */

interface StarNodeProps {
  project: Project;
  x: number;
  y: number;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
}

function StarNode({ project, x, y, isHovered, onHover, onClick }: StarNodeProps) {
  const size = getStarSize(project.progress);
  const theme = PLANET_THEMES[project.paletteIndex % PLANET_THEMES.length];
  const color = theme.highlight;
  const halfSize = size / 2;

  return (
    <g
      onMouseEnter={() => onHover(project.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(project.id)}
      style={{ cursor: 'pointer' }}
    >
      {/* Outer glow ring */}
      <circle
        cx={x}
        cy={y}
        r={halfSize + 12}
        fill="none"
        stroke={color}
        strokeWidth={1}
        opacity={isHovered ? 0.4 : 0.1}
        style={{
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Glow aura */}
      <circle
        cx={x}
        cy={y}
        r={halfSize + 6}
        fill={`url(#glow-${project.id})`}
        opacity={isHovered ? 0.7 : 0.4}
        style={{
          animation: 'pulse-glow 3s ease-in-out infinite',
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Core star */}
      <circle
        cx={x}
        cy={y}
        r={halfSize}
        fill={color}
        opacity={0.85}
        style={{
          filter: `drop-shadow(0 0 ${isHovered ? 15 : 8}px ${color})`,
          transition: 'filter 0.3s ease',
        }}
      />

      {/* Inner bright core */}
      <circle
        cx={x}
        cy={y}
        r={halfSize * 0.4}
        fill="#ffffff"
        opacity={0.6}
      />

      {/* Radial gradient definition */}
      <defs>
        <radialGradient id={`glow-${project.id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Project name label */}
      <text
        x={x}
        y={y + halfSize + 22}
        textAnchor="middle"
        fill="var(--text-primary, #e0f0ff)"
        fontFamily="var(--font-display, 'Orbitron', sans-serif)"
        fontSize="10"
        fontWeight="700"
        letterSpacing="1.5"
        style={{
          textShadow: '0 0 6px rgba(224, 240, 255, 0.3)',
          pointerEvents: 'none',
        }}
      >
        {project.name.toUpperCase()}
      </text>

      {/* Status badge */}
      <text
        x={x}
        y={y + halfSize + 36}
        textAnchor="middle"
        fill={color}
        fontFamily="var(--font-mono, 'JetBrains Mono', monospace)"
        fontSize="8"
        fontWeight="600"
        letterSpacing="1"
        opacity={0.7}
        style={{ pointerEvents: 'none' }}
      >
        {getStatusLabel(project.status)}
      </text>
    </g>
  );
}

/* ==========================================================
   Hover Tooltip Component
   ========================================================== */

interface TooltipProps {
  project: Project;
  x: number;
  y: number;
}

function HoverTooltip({ project, x, y }: TooltipProps) {
  const color = getHealthColor(project.health);

  return (
    <foreignObject
      x={x + 40}
      y={y - 60}
      width={240}
      height={120}
      style={{ pointerEvents: 'none', overflow: 'visible' }}
    >
      <div
        style={{
          background: 'rgba(13, 19, 33, 0.95)',
          border: `1px solid ${color}`,
          borderRadius: 2,
          padding: '12px 16px',
          backdropFilter: 'blur(8px)',
          boxShadow: `0 0 20px rgba(0, 0, 0, 0.5), 0 0 8px ${color}40`,
          animation: 'fade-in 0.15s ease-out',
          display: 'flex',
          flexDirection: 'column' as const,
          gap: 6,
        }}
      >
        {/* Description */}
        <div
          style={{
            fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--text-secondary, #7a8ba8)',
            lineHeight: '1.4',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
          }}
        >
          {project.description || 'No description'}
        </div>

        {/* Stats row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            paddingTop: 6,
            borderTop: '1px solid rgba(0, 200, 255, 0.15)',
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
              fontSize: '7px',
              fontWeight: 700,
              letterSpacing: '1px',
              color: 'var(--text-secondary, #7a8ba8)',
            }}
          >
            PROGRESS
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: '11px',
              fontWeight: 600,
              color,
              textShadow: `0 0 4px ${color}80`,
            }}
          >
            {project.progress}%
          </span>

          <span
            style={{
              width: 1,
              height: 12,
              background: 'rgba(0, 200, 255, 0.2)',
            }}
          />

          <span
            style={{
              fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
              fontSize: '7px',
              fontWeight: 700,
              letterSpacing: '1px',
              color: 'var(--text-secondary, #7a8ba8)',
            }}
          >
            AGENTS
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--cyan-glow, #00c8ff)',
            }}
          >
            {project.agents.length}
          </span>
        </div>
      </div>
    </foreignObject>
  );
}

/* ==========================================================
   Main Component
   ========================================================== */

export default function GalaxyMap({ onCreateProject }: GalaxyMapProps) {
  const { projects } = useProjectStore();
  const { setActiveProject } = useProjectStore();

  const [hoveredStarId, setHoveredStarId] = useState<string | null>(null);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 1000, height: 600 });

  const projectList = useMemo(() => Object.values(projects), [projects]);

  /* ---------- Container ref for measuring ---------- */
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setContainerSize({ width: rect.width, height: rect.height });

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* ---------- Star positions ---------- */
  const starPositions = useMemo(() => {
    const innerW = containerSize.width - MAP_PADDING * 2;
    const innerH = containerSize.height - MAP_PADDING * 2 - 60; // 60 for header
    return projectList.map((_, i) => {
      const pos = getStarPosition(i, projectList.length, innerW, innerH);
      return {
        x: pos.x + MAP_PADDING,
        y: pos.y + MAP_PADDING + 60,
      };
    });
  }, [projectList, containerSize]);

  /* ---------- Click handler ---------- */
  const handleStarClick = useCallback((id: string) => {
    setActiveProject(id);
  }, [setActiveProject]);

  return (
    <div style={styles.container} ref={containerRef}>
      {/* Scan-line texture */}
      <div style={styles.scanlineTexture} />

      {/* ========== HEADER ========== */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.headerDecorLeft} />
          <span style={styles.headerIcon}>{'\u25C8'}</span>
          <span style={styles.headerTitle}>PROJECT INCUBATOR</span>
          <div style={styles.headerDecorRight} />
        </div>

        <button
          onClick={onCreateProject}
          onMouseEnter={() => setHoveredButton('create')}
          onMouseLeave={() => setHoveredButton(null)}
          style={{
            ...styles.createButton,
            boxShadow: hoveredButton === 'create'
              ? '0 0 20px rgba(0, 200, 255, 0.5), inset 0 0 12px rgba(0, 200, 255, 0.1)'
              : '0 0 10px rgba(0, 200, 255, 0.3)',
            transform: hoveredButton === 'create'
              ? 'scale(1.03)'
              : 'scale(1)',
          }}
        >
          <span style={styles.createButtonIcon}>{'\u002B'}</span>
          NEW PROJECT
        </button>
      </div>

      {/* ========== GALAXY MAP SVG ========== */}
      <svg
        width={containerSize.width}
        height={containerSize.height}
        style={styles.svg}
        viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}
      >
        {/* Star dust background */}
        <StarDust width={containerSize.width} height={containerSize.height} />

        {/* Constellation lines */}
        <ConstellationLines positions={starPositions} />

        {/* Star nodes */}
        {projectList.map((project, i) => (
          <StarNode
            key={project.id}
            project={project}
            x={starPositions[i].x}
            y={starPositions[i].y}
            isHovered={hoveredStarId === project.id}
            onHover={setHoveredStarId}
            onClick={handleStarClick}
          />
        ))}

        {/* Hover tooltip */}
        {hoveredStarId && (() => {
          const idx = projectList.findIndex(p => p.id === hoveredStarId);
          if (idx < 0) return null;
          return (
            <HoverTooltip
              project={projectList[idx]}
              x={starPositions[idx].x}
              y={starPositions[idx].y}
            />
          );
        })()}
      </svg>

      {/* ========== EMPTY STATE ========== */}
      {projectList.length === 0 && (
        <div style={styles.emptyState}>
          <span style={styles.emptyStateIcon}>{'\u2B21'}</span>
          <span style={styles.emptyStateTitle}>NO PROJECTS DETECTED</span>
          <span style={styles.emptyStateText}>
            Create a new project to begin charting the galaxy.
          </span>
        </div>
      )}

      {/* ========== PROJECT COUNT READOUT ========== */}
      <div style={styles.readout}>
        <span style={styles.readoutLabel}>STELLAR OBJECTS</span>
        <span style={styles.readoutValue}>{projectList.length}</span>
      </div>
    </div>
  );
}

/* ==========================================================
   Styles
   ========================================================== */

const styles: Record<string, React.CSSProperties> = {
  /* --- Container --- */
  container: {
    position: 'fixed',
    top: 48,
    left: 220,
    right: 0,
    bottom: 64,
    overflow: 'hidden',
    zIndex: 50,
    animation: 'fade-in 0.4s ease-out',
    background: 'transparent',
  },

  scanlineTexture: {
    position: 'absolute',
    inset: 0,
    background:
      'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 200, 255, 0.012) 2px, rgba(0, 200, 255, 0.012) 4px)',
    pointerEvents: 'none',
    zIndex: 1,
  },

  /* --- Header --- */
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 28px',
    zIndex: 10,
  },

  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },

  headerDecorLeft: {
    width: 20,
    height: 1,
    background: 'linear-gradient(90deg, transparent, var(--cyan-glow, #00c8ff))',
  },

  headerIcon: {
    fontSize: '16px',
    color: 'var(--cyan-glow, #00c8ff)',
    textShadow: '0 0 10px rgba(0, 200, 255, 0.5)',
  },

  headerTitle: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '3px',
    color: 'var(--cyan-glow, #00c8ff)',
    textShadow: '0 0 10px rgba(0, 200, 255, 0.4)',
  },

  headerDecorRight: {
    width: 60,
    height: 1,
    background: 'linear-gradient(90deg, var(--cyan-glow, #00c8ff), transparent)',
  },

  /* --- Create Button --- */
  createButton: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 36,
    padding: '0 24px',
    border: '1px solid var(--cyan-glow, #00c8ff)',
    background: 'linear-gradient(180deg, rgba(0, 200, 255, 0.1) 0%, rgba(0, 200, 255, 0.03) 100%)',
    color: 'var(--cyan-glow, #00c8ff)',
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '2px',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    clipPath: 'polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)',
    textShadow: '0 0 8px rgba(0, 200, 255, 0.5)',
  },

  createButtonIcon: {
    fontSize: '14px',
    fontWeight: 400,
    filter: 'drop-shadow(0 0 3px rgba(0, 200, 255, 0.5))',
  },

  /* --- SVG --- */
  svg: {
    position: 'absolute',
    inset: 0,
    zIndex: 2,
  },

  /* --- Empty State --- */
  emptyState: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 5,
    opacity: 0.6,
  },

  emptyStateIcon: {
    fontSize: '40px',
    color: 'var(--cyan-glow, #00c8ff)',
    opacity: 0.3,
    textShadow: '0 0 15px rgba(0, 200, 255, 0.3)',
  },

  emptyStateTitle: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '3px',
    color: 'var(--text-primary, #e0f0ff)',
    textShadow: '0 0 8px rgba(224, 240, 255, 0.2)',
  },

  emptyStateText: {
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-secondary, #7a8ba8)',
    textAlign: 'center' as const,
    letterSpacing: '0.5px',
    maxWidth: 300,
  },

  /* --- Readout --- */
  readout: {
    position: 'absolute',
    bottom: 12,
    left: 28,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    zIndex: 10,
    opacity: 0.6,
  },

  readoutLabel: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '8px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    color: 'var(--text-secondary, #7a8ba8)',
  },

  readoutValue: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '1px',
    color: 'var(--cyan-glow, #00c8ff)',
    textShadow: '0 0 6px rgba(0, 200, 255, 0.4)',
  },
};
