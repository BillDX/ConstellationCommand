import React, { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';

/* ============================================================
   HoloTooltip Component — Holographic Projection Tooltip

   A sci-fi styled tooltip that appears on hover with a short
   delay. Features a dark semi-transparent background with cyan
   border, subtle glow, and a directional chevron arrow.

   Positioning is calculated relative to the hovered element
   using getBoundingClientRect for precise placement.
   ============================================================ */

export interface HoloTooltipProps {
  children: ReactNode;
  content: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

/* ---------- Constants ---------- */

const SHOW_DELAY_MS = 200;
const ARROW_SIZE = 6;
const TOOLTIP_OFFSET = 10;

/* ---------- Keyframe Injection ---------- */

const KEYFRAME_ID = '__holo-tooltip-keyframes__';

function ensureKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAME_ID)) return;

  const style = document.createElement('style');
  style.id = KEYFRAME_ID;
  style.textContent = `
    @keyframes holo-tooltip-fade-in {
      from {
        opacity: 0;
        transform: translate(var(--tt-tx, 0), var(--tt-ty, 0)) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translate(var(--tt-tx, 0), var(--tt-ty, 0)) scale(1);
      }
    }

    @keyframes holo-tooltip-scanline {
      0% {
        background-position: 0 0;
      }
      100% {
        background-position: 0 40px;
      }
    }
  `;
  document.head.appendChild(style);
}

/* ---------- Arrow Styles ---------- */

function getArrowStyle(position: 'top' | 'bottom' | 'left' | 'right'): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
  };

  switch (position) {
    case 'top':
      return {
        ...base,
        bottom: -ARROW_SIZE,
        left: '50%',
        marginLeft: -ARROW_SIZE,
        borderWidth: `${ARROW_SIZE}px ${ARROW_SIZE}px 0 ${ARROW_SIZE}px`,
        borderColor: 'rgba(0, 200, 255, 0.35) transparent transparent transparent',
      };
    case 'bottom':
      return {
        ...base,
        top: -ARROW_SIZE,
        left: '50%',
        marginLeft: -ARROW_SIZE,
        borderWidth: `0 ${ARROW_SIZE}px ${ARROW_SIZE}px ${ARROW_SIZE}px`,
        borderColor: 'transparent transparent rgba(0, 200, 255, 0.35) transparent',
      };
    case 'left':
      return {
        ...base,
        right: -ARROW_SIZE,
        top: '50%',
        marginTop: -ARROW_SIZE,
        borderWidth: `${ARROW_SIZE}px 0 ${ARROW_SIZE}px ${ARROW_SIZE}px`,
        borderColor: 'transparent transparent transparent rgba(0, 200, 255, 0.35)',
      };
    case 'right':
      return {
        ...base,
        left: -ARROW_SIZE,
        top: '50%',
        marginTop: -ARROW_SIZE,
        borderWidth: `${ARROW_SIZE}px ${ARROW_SIZE}px ${ARROW_SIZE}px 0`,
        borderColor: 'transparent rgba(0, 200, 255, 0.35) transparent transparent',
      };
  }
}

/* ---------- Component ---------- */

export default function HoloTooltip({
  children,
  content,
  position = 'top',
}: HoloTooltipProps) {
  ensureKeyframes();

  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Compute position of the tooltip relative to the viewport */
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;

    const rect = trigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const offset = TOOLTIP_OFFSET + ARROW_SIZE;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = rect.top - tooltipRect.height - offset;
        left = rect.left + rect.width / 2 - tooltipRect.width / 2;
        break;
      case 'bottom':
        top = rect.bottom + offset;
        left = rect.left + rect.width / 2 - tooltipRect.width / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipRect.height / 2;
        left = rect.left - tooltipRect.width - offset;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipRect.height / 2;
        left = rect.right + offset;
        break;
    }

    /* Clamp to viewport boundaries with 8px padding */
    top = Math.max(8, Math.min(top, window.innerHeight - tooltipRect.height - 8));
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));

    setCoords({ top, left });
  }, [position]);

  /* Show / hide handlers */
  const handleMouseEnter = useCallback(() => {
    timerRef.current = setTimeout(() => {
      setVisible(true);
    }, SHOW_DELAY_MS);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  }, []);

  /* Update position when visible */
  useEffect(() => {
    if (visible) {
      /* Small delay to let the tooltip render before measuring */
      requestAnimationFrame(() => {
        updatePosition();
      });
    }
  }, [visible, updatePosition]);

  /* Cleanup timer on unmount */
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  /* ---------- Styles ---------- */

  const wrapperStyle: React.CSSProperties = {
    display: 'inline-block',
    position: 'relative',
  };

  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    top: coords.top,
    left: coords.left,
    zIndex: 9999,
    pointerEvents: 'none',
    /* Fade-in animation */
    animation: 'holo-tooltip-fade-in 0.2s ease-out forwards',
  };

  const tooltipBodyStyle: React.CSSProperties = {
    position: 'relative',
    padding: '8px 14px',
    background: 'rgba(10, 14, 23, 0.92)',
    border: '1px solid rgba(0, 200, 255, 0.35)',
    borderRadius: 4,
    boxShadow: [
      '0 0 12px rgba(0, 200, 255, 0.15)',
      '0 0 30px rgba(0, 200, 255, 0.08)',
      'inset 0 1px 0 rgba(0, 200, 255, 0.1)',
      '0 4px 20px rgba(0, 0, 0, 0.5)',
    ].join(', '),
    backdropFilter: 'blur(12px)',
    /* Content typography */
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '12px',
    fontWeight: 500,
    letterSpacing: '0.3px',
    lineHeight: 1.5,
    color: 'var(--text-primary, #e0f0ff)',
    whiteSpace: 'nowrap',
    maxWidth: 280,
  };

  /* Holographic scanline texture overlay */
  const scanlineOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: 4,
    background:
      'repeating-linear-gradient(0deg, transparent 0px, transparent 1px, rgba(0, 200, 255, 0.02) 1px, rgba(0, 200, 255, 0.02) 2px)',
    animation: 'holo-tooltip-scanline 3s linear infinite',
    pointerEvents: 'none',
  };

  /* Top edge glow highlight */
  const edgeGlowStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 4,
    right: 4,
    height: 1,
    background: 'linear-gradient(90deg, transparent, rgba(0, 200, 255, 0.4), transparent)',
    borderRadius: '1px 1px 0 0',
    pointerEvents: 'none',
  };

  return (
    <div
      ref={triggerRef}
      style={wrapperStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {visible && (
        <div style={tooltipStyle} ref={tooltipRef} role="tooltip">
          <div style={tooltipBodyStyle}>
            {/* Scanline texture */}
            <div style={scanlineOverlayStyle} />

            {/* Top edge glow */}
            <div style={edgeGlowStyle} />

            {/* Arrow / chevron */}
            <span style={getArrowStyle(position)} />

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              {content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
