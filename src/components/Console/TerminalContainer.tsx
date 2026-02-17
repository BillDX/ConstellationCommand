import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { AttachAddon } from '@xterm/addon-attach';
import '@xterm/xterm/css/xterm.css';

/* ============================================================
   TerminalContainer - xterm.js Terminal Wrapper

   Creates an xterm.js terminal instance, connects it to the
   backend via WebSocket (AttachAddon), and handles resize events.
   Themed to match the starship bridge console aesthetic.
   ============================================================ */

interface TerminalContainerProps {
  agentId: string;
  sendMessage: (msg: any) => void;
  authToken?: string | null;
}

/* ---------- xterm Theme ---------- */

const XTERM_THEME = {
  background: '#0a0e17',
  foreground: '#e0f0ff',
  cursor: '#00c8ff',
  cursorAccent: '#0a0e17',
  selectionBackground: 'rgba(0, 200, 255, 0.25)',
  selectionForeground: '#e0f0ff',
  black: '#0a0e17',
  red: '#ff3344',
  green: '#00ff88',
  yellow: '#ff9f1c',
  blue: '#00c8ff',
  magenta: '#8b5cf6',
  cyan: '#00c8ff',
  white: '#e0f0ff',
  brightBlack: '#3a4a6a',
  brightRed: '#ff6677',
  brightGreen: '#33ffaa',
  brightYellow: '#ffbb55',
  brightBlue: '#55ddff',
  brightMagenta: '#aa88ff',
  brightCyan: '#55ddff',
  brightWhite: '#ffffff',
};

export default function TerminalContainer({ agentId, sendMessage, authToken }: TerminalContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    /* ---------- Create Terminal ---------- */
    const terminal = new Terminal({
      theme: XTERM_THEME,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      allowTransparency: true,
      scrollback: 5000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    /* ---------- Open Terminal ---------- */
    terminal.open(container);

    // Initial fit after the terminal is rendered
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch {
        // Container may not be visible yet
      }
    });

    /* ---------- WebSocket Connection with Retry ---------- */
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const tokenParam = authToken ? `?token=${encodeURIComponent(authToken)}` : '';
    const wsUrl = `${protocol}//${host}/ws/terminal/${agentId}${tokenParam}`;

    terminal.writeln('\x1b[36m[CONNECTING]\x1b[0m Connecting to agent terminal...');

    let wsAttempt = 0;
    const maxAttempts = 3;
    const retryDelay = 500;

    function connectWs() {
      wsAttempt++;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        terminal.writeln('\x1b[32m--- TERMINAL SESSION ESTABLISHED ---\x1b[0m\r\n');
        const attachAddon = new AttachAddon(ws);
        terminal.loadAddon(attachAddon);
      };

      ws.onerror = () => {
        if (wsAttempt < maxAttempts) {
          terminal.writeln(`\x1b[33m[RETRY ${wsAttempt}/${maxAttempts}]\x1b[0m Reconnecting...`);
          setTimeout(connectWs, retryDelay);
        } else {
          terminal.writeln('\r\n\x1b[31m[CONNECTION ERROR]\x1b[0m Unable to connect to agent terminal.');
        }
      };

      ws.onclose = () => {
        if (wsAttempt >= maxAttempts) {
          terminal.writeln('\r\n\x1b[33m[DISCONNECTED]\x1b[0m Terminal session ended.');
        }
      };
    }

    connectWs();

    /* ---------- Resize Handling ---------- */
    const handleResize = () => {
      if (!fitAddonRef.current || !terminalRef.current) return;
      try {
        fitAddonRef.current.fit();
        const { cols, rows } = terminalRef.current;
        sendMessage({
          type: 'terminal:resize',
          agentId,
          cols,
          rows,
        });
      } catch {
        // Ignore resize errors when container is hidden
      }
    };

    // Observe container size changes
    const resizeObserver = new ResizeObserver(() => {
      // Debounce resize to avoid excessive fitting
      requestAnimationFrame(handleResize);
    });
    resizeObserver.observe(container);
    resizeObserverRef.current = resizeObserver;

    // Also listen to window resize as a fallback
    window.addEventListener('resize', handleResize);

    /* ---------- Cleanup ---------- */
    return () => {
      window.removeEventListener('resize', handleResize);

      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
      }

      fitAddonRef.current = null;
    };
  }, [agentId, sendMessage, authToken]);

  return (
    <div
      ref={containerRef}
      style={styles.container}
      data-agent-terminal={agentId}
    />
  );
}

/* ==========================================================
   Styles
   ========================================================== */

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100%',
    background: '#0a0e17',
    borderRadius: 2,
    overflow: 'hidden',
  },
};
