import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Request, Response, NextFunction } from 'express';

// ── Types ────────────────────────────────────────────────────────────────

interface AuthConfig {
  passwordHash: string;
  salt: string;
}

interface Session {
  token: string;
  createdAt: number;
}

interface RateLimitEntry {
  attempts: number;
  firstAttemptAt: number;
}

// ── Constants ────────────────────────────────────────────────────────────

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const MIN_PASSWORD_LENGTH = 8;
const SCRYPT_KEYLEN = 64;

// ── AuthManager ──────────────────────────────────────────────────────────

class AuthManager {
  private configDir: string;
  private configPath: string;
  private config: AuthConfig | null = null;
  private sessions = new Map<string, Session>();
  private rateLimits = new Map<string, RateLimitEntry>();

  constructor() {
    this.configDir = join(homedir(), '.constellation-command');
    this.configPath = join(this.configDir, 'auth.json');
  }

  async init(): Promise<void> {
    // Ensure config directory exists
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }

    // Load existing config
    if (existsSync(this.configPath)) {
      try {
        const raw = readFileSync(this.configPath, 'utf-8');
        this.config = JSON.parse(raw) as AuthConfig;
      } catch {
        this.config = null;
      }
    }

    // Check CC_PASSWORD env var — auto-configure if no config exists
    const envPassword = process.env.CC_PASSWORD;
    if (envPassword && !this.config) {
      this.setPassword(envPassword);
    }

    // Periodically clean expired sessions (every 10 minutes)
    setInterval(() => this.cleanExpiredSessions(), 10 * 60 * 1000);
  }

  isSetupRequired(): boolean {
    return this.config === null;
  }

  setPassword(password: string): { success: boolean; error?: string } {
    if (password.length < MIN_PASSWORD_LENGTH) {
      return { success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
    }

    const salt = randomBytes(32).toString('hex');
    const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');

    this.config = { passwordHash: hash, salt };

    // Write config to disk with restrictive permissions
    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), { mode: 0o600 });

    return { success: true };
  }

  verifyPassword(password: string): boolean {
    if (!this.config) return false;

    const { passwordHash, salt } = this.config;
    const hash = scryptSync(password, salt, SCRYPT_KEYLEN);
    const expected = Buffer.from(passwordHash, 'hex');

    // Timing-safe comparison to prevent timing attacks
    return timingSafeEqual(hash, expected);
  }

  // ── Rate Limiting ────────────────────────────────────────────────────

  checkRateLimit(ip: string): { allowed: boolean; remainingAttempts: number; retryAfterMs: number } {
    const entry = this.rateLimits.get(ip);
    if (!entry) {
      return { allowed: true, remainingAttempts: RATE_LIMIT_MAX_ATTEMPTS, retryAfterMs: 0 };
    }

    const elapsed = Date.now() - entry.firstAttemptAt;

    // Window expired — reset
    if (elapsed >= RATE_LIMIT_WINDOW_MS) {
      this.rateLimits.delete(ip);
      return { allowed: true, remainingAttempts: RATE_LIMIT_MAX_ATTEMPTS, retryAfterMs: 0 };
    }

    const remaining = RATE_LIMIT_MAX_ATTEMPTS - entry.attempts;
    if (remaining <= 0) {
      const retryAfterMs = RATE_LIMIT_WINDOW_MS - elapsed;
      return { allowed: false, remainingAttempts: 0, retryAfterMs };
    }

    return { allowed: true, remainingAttempts: remaining, retryAfterMs: 0 };
  }

  recordFailedAttempt(ip: string): void {
    const entry = this.rateLimits.get(ip);
    if (!entry) {
      this.rateLimits.set(ip, { attempts: 1, firstAttemptAt: Date.now() });
    } else {
      entry.attempts++;
    }
  }

  clearRateLimit(ip: string): void {
    this.rateLimits.delete(ip);
  }

  // ── Session Management ───────────────────────────────────────────────

  createSession(): string {
    const token = randomBytes(32).toString('hex');
    this.sessions.set(token, { token, createdAt: Date.now() });
    return token;
  }

  validateSession(token: string): boolean {
    const session = this.sessions.get(token);
    if (!session) return false;

    const age = Date.now() - session.createdAt;
    if (age > SESSION_TTL_MS) {
      this.sessions.delete(token);
      return false;
    }

    return true;
  }

  destroySession(token: string): void {
    this.sessions.delete(token);
  }

  private cleanExpiredSessions(): void {
    const now = Date.now();
    for (const [token, session] of this.sessions) {
      if (now - session.createdAt > SESSION_TTL_MS) {
        this.sessions.delete(token);
      }
    }
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

export const authManager = new AuthManager();

// ── Security Headers Middleware ───────────────────────────────────────────

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ws: wss:; img-src 'self' data:;"
  );
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

// ── Auth Middleware (for protected routes) ────────────────────────────────

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token || !authManager.validateSession(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}
