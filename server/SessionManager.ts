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

const MAX_OUTPUT_BUFFER = 256 * 1024; // 256 KB scrollback buffer per session

interface Session {
  pty: IPty;
  projectId: string;
  task: string;
  cwd: string;
  status: AgentStatus;
  launchedAt: number;
  completedAt?: number;
  terminalClients: Set<WebSocket>;
  outputBuffer: string;
}

// ── SessionManager ───────────────────────────────────────────────────────

export class SessionManager extends EventEmitter {
  private sessions: Map<string, Session> = new Map();
  public readonly outputParser: OutputParser;

  constructor() {
    super();
    this.outputParser = new OutputParser();

    // Listen for activity state changes from the output parser.
    // The parser detects specific Claude Code activities (thinking, coding,
    // executing, scanning, etc.) and emits state transitions.
    this.outputParser.on('agent:activity', ({ agentId, state }: { agentId: string; state: AgentStatus }) => {
      const session = this.sessions.get(agentId);
      if (!session) return;
      // Don't override terminal states
      if (session.status === 'completed' || session.status === 'error') return;

      if (session.status !== state) {
        session.status = state;
        this.emitStatus(agentId, state);
      }
    });
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

    // Strip CLAUDECODE env var to prevent "nested session" error when
    // ConstellationCommand's server itself runs inside a Claude Code session
    const cleanEnv = { ...process.env } as Record<string, string>;
    delete cleanEnv.CLAUDECODE;

    const ptyProcess = pty.spawn('claude', ['--dangerously-skip-permissions'], {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd: config.cwd,
      env: cleanEnv,
    });

    const session: Session = {
      pty: ptyProcess,
      projectId: config.projectId,
      task: config.task,
      cwd: config.cwd,
      status: 'launched',
      launchedAt: Date.now(),
      terminalClients: new Set(),
      outputBuffer: '',
    };

    this.sessions.set(config.id, session);

    // Emit initial status
    this.emitStatus(config.id, 'launched');
    this.emitLog('info', config.id, config.projectId, 'SessionManager', `PTY spawned for agent ${config.id.slice(0, 8)} in ${config.cwd}`);

    // After a brief moment mark as running
    setTimeout(() => {
      if (session.status === 'launched') {
        session.status = 'running';
        this.emitStatus(config.id, 'running');
      }
    }, 500);

    // Track whether we've seen first output and whether task has been sent
    let firstOutput = true;
    let taskSent = false;

    // Forward pty output → terminal WS clients + OutputParser + buffer
    ptyProcess.onData((data: string) => {
      if (firstOutput) {
        firstOutput = false;
        this.emitLog('info', config.id, config.projectId, 'SessionManager', `Agent ${config.id.slice(0, 8)} receiving stdout — Claude Code is running`);

        // Now that Claude Code is producing output, it's safe to send the task.
        // Wait a moment for the prompt to fully render, then send text + Enter.
        if (config.task && !taskSent) {
          taskSent = true;
          setTimeout(() => {
            ptyProcess.write(config.task);
            // Longer gap before Enter to ensure Claude Code's input handler
            // has fully processed the pasted text
            setTimeout(() => {
              ptyProcess.write('\r');
              this.emitLog('info', config.id, config.projectId, 'SessionManager', `Task submitted to agent ${config.id.slice(0, 8)}`);
            }, 300);
          }, 500);
        }
      }

      // Buffer output for replay when new terminal clients connect
      session.outputBuffer += data;
      if (session.outputBuffer.length > MAX_OUTPUT_BUFFER) {
        session.outputBuffer = session.outputBuffer.slice(-MAX_OUTPUT_BUFFER);
      }

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
      this.emitLog(
        exitCode === 0 ? 'info' : 'error',
        config.id, config.projectId, 'SessionManager',
        `Agent ${config.id.slice(0, 8)} exited with code ${exitCode}`
      );

      // Clean up parser buffer
      this.outputParser.clearBuffer(config.id);
    });

    // Fallback: if no output arrives within 5 seconds, send the task anyway.
    // This handles edge cases where Claude Code might be waiting for input
    // before producing any output.
    if (config.task) {
      setTimeout(() => {
        if (!taskSent) {
          taskSent = true;
          this.emitLog('info', config.id, config.projectId, 'SessionManager', `Fallback: sending task to agent ${config.id.slice(0, 8)} (no output detected)`);
          ptyProcess.write(config.task);
          setTimeout(() => {
            ptyProcess.write('\r');
          }, 300);
        }
      }, 5000);
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

    // Replay buffered output so the client sees previous terminal history
    if (session.outputBuffer.length > 0 && ws.readyState === 1) {
      ws.send(session.outputBuffer);
    }

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
    try {
      session.pty.resize(cols, rows);
    } catch {
      // pty may have already exited — ignore resize errors
    }
  }

  // ── internal ─────────────────────────────────────────────────────────

  private emitStatus(agentId: string, status: AgentStatus): void {
    this.emit('agent:status', {
      agentId,
      status,
      timestamp: Date.now(),
    });
  }

  private emitLog(level: string, agentId: string, projectId: string, source: string, message: string): void {
    this.emit('log', { level, agentId, projectId, source, message });
  }
}
