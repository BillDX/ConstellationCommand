import { useRef, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Star {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  alpha: number;
  speed: number;
  /** Twinkle phase offset so stars don't pulse in unison */
  twinkleOffset: number;
  /** Twinkle speed multiplier */
  twinkleSpeed: number;
  /** If > 0 the star gets a soft glow drawn around it */
  glowRadius: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  alpha: number;
  life: number;     // seconds remaining
  maxLife: number;
}

interface Nebula {
  x: number;
  y: number;
  radius: number;
  color: string;     // e.g. "60, 80, 180"
  alpha: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function createStarLayer(
  count: number,
  width: number,
  height: number,
  radiusRange: [number, number],
  alphaRange: [number, number],
  speedRange: [number, number],
  glowRadius: number,
): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: rand(radiusRange[0], radiusRange[1]),
      baseAlpha: rand(alphaRange[0], alphaRange[1]),
      alpha: rand(alphaRange[0], alphaRange[1]),
      speed: rand(speedRange[0], speedRange[1]),
      twinkleOffset: Math.random() * Math.PI * 2,
      twinkleSpeed: rand(0.3, 1.8),
      glowRadius,
    });
  }
  return stars;
}

function createNebulae(width: number, height: number): Nebula[] {
  const palette = [
    '40, 60, 160',   // deep blue
    '100, 40, 140',  // purple
    '30, 120, 120',  // teal
  ];
  return palette.map((color) => ({
    x: rand(width * 0.1, width * 0.9),
    y: rand(height * 0.1, height * 0.9),
    radius: rand(Math.min(width, height) * 0.25, Math.min(width, height) * 0.5),
    color,
    alpha: rand(0.03, 0.08),
  }));
}

function spawnShootingStar(width: number, height: number): ShootingStar {
  // Start from a random edge-ish position biased towards the right / top
  const startX = rand(width * 0.3, width * 1.1);
  const startY = rand(-height * 0.1, height * 0.5);
  const angle = rand(Math.PI * 0.55, Math.PI * 0.75); // heading lower-left-ish
  const speed = rand(600, 1200);
  const life = rand(0.6, 1.4);
  return {
    x: startX,
    y: startY,
    vx: Math.cos(angle) * speed * -1,
    vy: Math.sin(angle) * speed,
    length: rand(80, 180),
    alpha: 1,
    life,
    maxLife: life,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  // Store mutable state in refs so the animation loop doesn't need re-binding.
  const starsRef = useRef<Star[][]>([]);
  const nebulaeRef = useRef<Nebula[]>([]);
  const shootingRef = useRef<ShootingStar | null>(null);
  const shootingTimerRef = useRef<number>(0);
  const sizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  // --------------------------------------------------
  // Initialise / re-initialise stars for a given size
  // --------------------------------------------------
  const init = useCallback((w: number, h: number) => {
    sizeRef.current = { w, h };
    starsRef.current = [
      createStarLayer(200, w, h, [0.3, 0.8], [0.15, 0.35], [0.08, 0.2], 0),        // far
      createStarLayer(100, w, h, [0.6, 1.2], [0.3, 0.6], [0.25, 0.55], 0),          // mid
      createStarLayer(50, w, h, [1.0, 1.8], [0.5, 0.85], [0.5, 1.0], 0),            // near
      createStarLayer(20, w, h, [1.4, 2.4], [0.7, 1.0], [0.8, 1.4], 6),             // closest (glow)
    ];
    nebulaeRef.current = createNebulae(w, h);
    shootingRef.current = null;
    shootingTimerRef.current = rand(5, 10);
  }, []);

  // --------------------------------------------------
  // Animation loop
  // --------------------------------------------------
  const lastTimeRef = useRef<number>(0);

  const animate = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dt = lastTimeRef.current === 0 ? 0.016 : (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;
    // Cap delta to avoid huge jumps when tab is backgrounded
    const cappedDt = Math.min(dt, 0.1);

    const { w, h } = sizeRef.current;

    // -- Clear --
    ctx.clearRect(0, 0, w, h);

    // -- Deep space background gradient --
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#05060f');
    bgGrad.addColorStop(0.5, '#0a0c1a');
    bgGrad.addColorStop(1, '#070916');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // -- Nebulae --
    for (const neb of nebulaeRef.current) {
      const grad = ctx.createRadialGradient(neb.x, neb.y, 0, neb.x, neb.y, neb.radius);
      grad.addColorStop(0, `rgba(${neb.color}, ${neb.alpha})`);
      grad.addColorStop(0.6, `rgba(${neb.color}, ${neb.alpha * 0.4})`);
      grad.addColorStop(1, `rgba(${neb.color}, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(neb.x - neb.radius, neb.y - neb.radius, neb.radius * 2, neb.radius * 2);
    }

    // -- Stars (all layers) --
    const time = timestamp / 1000;
    for (const layer of starsRef.current) {
      for (const star of layer) {
        // Drift
        star.x -= star.speed * cappedDt * 60; // normalise to ~60fps feel
        if (star.x < -4) {
          star.x = w + 4;
          star.y = Math.random() * h;
        }

        // Twinkle
        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset);
        star.alpha = star.baseAlpha + twinkle * 0.15;

        // Draw glow
        if (star.glowRadius > 0) {
          const glow = ctx.createRadialGradient(
            star.x, star.y, 0,
            star.x, star.y, star.glowRadius,
          );
          glow.addColorStop(0, `rgba(200, 220, 255, ${star.alpha * 0.35})`);
          glow.addColorStop(1, 'rgba(200, 220, 255, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.glowRadius, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw star
        ctx.fillStyle = `rgba(235, 240, 255, ${Math.max(0, Math.min(1, star.alpha))})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // -- Shooting star --
    shootingTimerRef.current -= cappedDt;
    if (shootingTimerRef.current <= 0 && !shootingRef.current) {
      shootingRef.current = spawnShootingStar(w, h);
      shootingTimerRef.current = rand(5, 10);
    }

    if (shootingRef.current) {
      const s = shootingRef.current;
      s.x += s.vx * cappedDt;
      s.y += s.vy * cappedDt;
      s.life -= cappedDt;

      const progress = 1 - s.life / s.maxLife;
      // Fade in quickly, fade out towards end
      s.alpha = progress < 0.15
        ? progress / 0.15
        : 1 - Math.pow(Math.max(0, (progress - 0.6) / 0.4), 2);
      s.alpha = Math.max(0, Math.min(1, s.alpha));

      // Trail direction (normalised velocity)
      const mag = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
      const nx = s.vx / mag;
      const ny = s.vy / mag;

      const tailX = s.x - nx * s.length;
      const tailY = s.y - ny * s.length;

      const trailGrad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
      trailGrad.addColorStop(0, `rgba(255, 255, 255, 0)`);
      trailGrad.addColorStop(0.7, `rgba(220, 230, 255, ${s.alpha * 0.4})`);
      trailGrad.addColorStop(1, `rgba(255, 255, 255, ${s.alpha})`);

      ctx.strokeStyle = trailGrad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();

      // Bright head glow
      const headGlow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 4);
      headGlow.addColorStop(0, `rgba(255, 255, 255, ${s.alpha})`);
      headGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = headGlow;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
      ctx.fill();

      if (s.life <= 0 || s.x < -s.length || s.y > h + s.length) {
        shootingRef.current = null;
      }
    }

    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  // --------------------------------------------------
  // Setup & teardown
  // --------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
      init(w, h);
    };

    resize();
    window.addEventListener('resize', resize);

    lastTimeRef.current = 0;
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [init, animate]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        display: 'block',
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  );
}
