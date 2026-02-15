import { EventEmitter } from 'node:events';
import * as pty from 'node-pty';
import type { IPty } from 'node-pty';
import type WebSocket from 'ws';
import { OutputParser } from './OutputParser.js';
import type { AgentStatus } from './types.js';

// ── Session metadata ─────────────────────────────────────────────────────

export interface SessionInfo {
  agentId: string;
  projectId: string;
  task: string;
  cwd: string;
  status: AgentStatus;
  launchedAt: number;
  completedAt?: number;
  elapsedMs: number;
}

interface Session {
  pty: IPty;
  projectId: string;
  task: string;
  cwd: string;
  status: AgentStatus;
  launchedAt: number;
  completedAt?: number;
  terminalClients: Set<WebSocket>;
}

// ── SessionManager ───────────────────────────────────────────────────────

export class SessionManager extends EventEmitter {
  private sessions: Map<string, Session> = new Map();
  public readonly outputParser: OutputParser;

  constructor() {
    super();
    this.outputParser = new OutputParser();
  }

  /**
   * Spawn a new Claude Code CLI agent in a pseudo-terminal.
   */
  launchAgent(config: {
    id: string;
    projectId: string;
    task: string;
    cwd: string;
  }): void {
    if (this.sessions.has(config.id)) {
      throw new Error(`Agent ${config.id} is already running`);
    }

    const ptyProcess = pty.spawn('claude', ['--dangerously-skip-permissions'], {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd: config.cwd,
      env: process.env as Record<string, string>,
    });

    const session: Session = {
      pty: ptyProcess,
      projectId: config.projectId,
      task: config.task,
      cwd: config.cwd,
      status: 'launched',
      launchedAt: Date.now(),
      terminalClients: new Set(),
    };

    this.sessions.set(config.id, session);

    // Emit initial status
    this.emitStatus(config.id, 'launched');

    // After a brief moment mark as running
    setTimeout(() => {
      if (session.status === 'launched') {
        session.status = 'running';
        this.emitStatus(config.id, 'running');
      }
    }, 500);

    // Forward pty output → terminal WS clients + OutputParser
    ptyProcess.onData((data: string) => {
      // Send raw data to all connected terminal WebSocket clients
      for (const ws of session.terminalClients) {
        if (ws.readyState === 1 /* WebSocket.OPEN */) {
          ws.send(data);
        }
      }

      // Feed the output parser
      this.outputParser.parse(config.id, data);
    });

    // Handle pty exit
    ptyProcess.onExit(({ exitCode }) => {
      this.outputParser.flush(config.id);

      session.completedAt = Date.now();
      session.status = exitCode === 0 ? 'completed' : 'error';
      this.emitStatus(config.id, session.status);

      // Clean up parser buffer
      this.outputParser.clearBuffer(config.id);
    });

    // If a task prompt was provided, write it to stdin after a short delay
    // to let the CLI boot up
    if (config.task) {
      setTimeout(() => {
        ptyProcess.write(config.task + '\n');
      }, 1000);
    }
  }

  /**
   * Return the pty instance for an agent.
   */
  getSession(agentId: string): IPty | undefined {
    return this.sessions.get(agentId)?.pty;
  }

  /**
   * Kill the pty process for an agent.
   */
  killSession(agentId: string): void {
    const session = this.sessions.get(agentId);
    if (!session) return;

    session.pty.kill();
    session.completedAt = Date.now();
    session.status = 'completed';
    this.emitStatus(agentId, 'completed');

    // Close terminal WS clients
    for (const ws of session.terminalClients) {
      ws.close(1000, 'Agent killed');
    }
    session.terminalClients.clear();

    this.outputParser.clearBuffer(agentId);
    this.sessions.delete(agentId);
  }

  /**
   * Return summary info for all active sessions.
   */
  getAllSessions(): SessionInfo[] {
    const now = Date.now();
    const result: SessionInfo[] = [];

    for (const [agentId, session] of this.sessions) {
      result.push({
        agentId,
        projectId: session.projectId,
        task: session.task,
        cwd: session.cwd,
        status: session.status,
        launchedAt: session.launchedAt,
        completedAt: session.completedAt,
        elapsedMs: (session.completedAt ?? now) - session.launchedAt,
      });
    }

    return result;
  }

  /**
   * Register a WebSocket client that should receive raw terminal output
   * for a specific agent.
   */
  addTerminalClient(agentId: string, ws: WebSocket): void {
    const session = this.sessions.get(agentId);
    if (!session) return;

    session.terminalClients.add(ws);

    ws.on('close', () => {
      session.terminalClients.delete(ws);
    });
  }

  /**
   * Write data to an agent's pty stdin.
   */
  writeToSession(agentId: string, data: string): void {
    const session = this.sessions.get(agentId);
    if (!session) return;
    session.pty.write(data);
  }

  /**
   * Resize an agent's pty.
   */
  resizeSession(agentId: string, cols: number, rows: number): void {
    const session = this.sessions.get(agentId);
    if (!session) return;
    session.pty.resize(cols, rows);
  }

  // ── internal ─────────────────────────────────────────────────────────

  private emitStatus(agentId: string, status: AgentStatus): void {
    this.emit('agent:status', {
      agentId,
      status,
      timestamp: Date.now(),
    });
  }
}
