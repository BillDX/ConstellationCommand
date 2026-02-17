import { create } from 'zustand';

type AuthPhase = 'loading' | 'setup-required' | 'login' | 'authenticated';

interface AuthState {
  phase: AuthPhase;
  error: string | null;
  remainingAttempts: number | null;
  retryAfterMs: number;
  token: string | null;

  checkStatus: () => Promise<void>;
  login: (password: string) => Promise<boolean>;
  setup: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  getToken: () => string | null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  phase: 'loading',
  error: null,
  remainingAttempts: null,
  retryAfterMs: 0,
  token: null,

  checkStatus: async () => {
    try {
      // Check if setup is required
      const setupRes = await fetch('/auth/setup-required');
      const setupData = await setupRes.json();

      if (setupData.setupRequired) {
        set({ phase: 'setup-required', error: null });
        return;
      }

      // Check for existing session token in sessionStorage
      const storedToken = sessionStorage.getItem('cc-auth-token');
      if (storedToken) {
        const statusRes = await fetch('/auth/status', {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (statusRes.ok) {
          set({ phase: 'authenticated', token: storedToken, error: null });
          return;
        }

        // Token invalid — clear it
        sessionStorage.removeItem('cc-auth-token');
      }

      set({ phase: 'login', error: null });
    } catch {
      // Server unreachable — show login
      set({ phase: 'login', error: null });
    }
  },

  login: async (password: string) => {
    set({ error: null });

    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.token) {
        sessionStorage.setItem('cc-auth-token', data.token);
        set({ phase: 'authenticated', token: data.token, error: null, remainingAttempts: null, retryAfterMs: 0 });
        return true;
      }

      set({
        error: data.error || 'Authentication failed',
        remainingAttempts: data.remainingAttempts ?? null,
        retryAfterMs: data.retryAfterMs ?? 0,
      });
      return false;
    } catch {
      set({ error: 'Connection error' });
      return false;
    }
  },

  setup: async (password: string) => {
    set({ error: null });

    try {
      const res = await fetch('/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.token) {
        sessionStorage.setItem('cc-auth-token', data.token);
        set({ phase: 'authenticated', token: data.token, error: null });
        return true;
      }

      set({ error: data.error || 'Setup failed' });
      return false;
    } catch {
      set({ error: 'Connection error' });
      return false;
    }
  },

  logout: async () => {
    const token = get().token;
    if (token) {
      try {
        await fetch('/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Ignore — we're logging out anyway
      }
    }

    sessionStorage.removeItem('cc-auth-token');
    set({ phase: 'login', token: null, error: null });
  },

  getToken: () => get().token,
}));
