import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Particle {
  id: number;
  x: number;
  y: number;
  /** Velocity in viewport-percent per second */
  vx: number;
  vy: number;
  size: number;
  opacity: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PARTICLE_COUNT = 40;
const DRIFT_DAMPING = 0.97;
const BROWNIAN_FORCE = 0.15; // vp%/s^2 randomness

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function createParticles(): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      vx: rand(-0.3, 0.3),
      vy: rand(-0.3, 0.3),
      size: rand(1, 2.5),
      opacity: rand(0.04, 0.15),
    });
  }
  return particles;
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
  zIndex: 1,
  overflow: 'hidden',
};

function particleStyle(p: Particle): CSSProperties {
  return {
    position: 'absolute',
    left: 0,
    top: 0,
    width: `${p.size}px`,
    height: `${p.size}px`,
    borderRadius: '50%',
    backgroundColor: 'rgba(180, 200, 240, 1)',
    opacity: p.opacity,
    // GPU-accelerated positioning via translate
    transform: `translate3d(${p.x}vw, ${p.y}vh, 0)`,
    willChange: 'transform, opacity',
    transition: 'none',
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AmbientParticles() {
  const [particles, setParticles] = useState<Particle[]>(createParticles);
  const particlesRef = useRef<Particle[]>(particles);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Keep ref in sync with state
  useEffect(() => {
    particlesRef.current = particles;
  }, [particles]);

  const animate = useCallback((timestamp: number) => {
    const dt = lastTimeRef.current === 0
      ? 0.016
      : Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
    lastTimeRef.current = timestamp;

    const updated = particlesRef.current.map((p) => {
      // Brownian jitter
      let vx = p.vx + (Math.random() - 0.5) * BROWNIAN_FORCE * dt * 60;
      let vy = p.vy + (Math.random() - 0.5) * BROWNIAN_FORCE * dt * 60;

      // Damping to keep motion subtle
      vx *= DRIFT_DAMPING;
      vy *= DRIFT_DAMPING;

      let x = p.x + vx * dt * 60;
      let y = p.y + vy * dt * 60;

      // Wrap around edges with a small buffer
      if (x < -2) x += 104;
      if (x > 102) x -= 104;
      if (y < -2) y += 104;
      if (y > 102) y -= 104;

      return { ...p, x, y, vx, vy };
    });

    setParticles(updated);
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [animate]);

  return (
    <div style={containerStyle} aria-hidden="true">
      {particles.map((p) => (
        <div key={p.id} style={particleStyle(p)} />
      ))}
    </div>
  );
}
