import { createServer } from 'node:http';
import { parse as parseUrl } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { SessionManager } from './SessionManager.js';
import { FileWatcher } from './FileWatcher.js';
import { GitMonitor } from './GitMonitor.js';
import { Orchestrator } from './Orchestrator.js';
import { authManager, securityHeaders } from './auth.js';
import type {
  Agent,
  AgentRole,
  Project,
  ClientMessage,
  ServerMessage,
  StateSyncMessage,
  LogEntry,
} from './types.js';
import {
  getBaseDirectory,
  ensureBaseDirectory,
  createProjectDirectory,
  validateProjectPath,
  validateAgentCwd,
} from './pathSecurity.js';

// ── Config ───────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Express app ──────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(securityHeaders);

// ── Auth API routes (before static files) ────────────────────────────────

app.get('/auth/setup-required', (_req, res) => {
  res.json({ setupRequired: authManager.isSetupRequired() });
});

app.post('/auth/setup', (req, res) => {
  if (!authManager.isSetupRequired()) {
    res.status(400).json({ error: 'Password already configured' });
    return;
  }

  const { password } = req.body;
  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'Password is required' });
    return;
  }

  const result = authManager.setPassword(password);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  const token = authManager.createSession();
  res.json({ token });
});

app.post('/auth/login', (req, res) => {
  if (authManager.isSetupRequired()) {
    res.status(400).json({ error: 'Password not configured. Use /auth/setup first.' });
    return;
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const rateLimit = authManager.checkRateLimit(ip);
  if (!rateLimit.allowed) {
    res.status(429).json({
      error: 'Too many attempts',
      remainingAttempts: 0,
      retryAfterMs: rateLimit.retryAfterMs,
    });
    return;
  }

  const { password } = req.body;
  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'Password is required' });
    return;
  }

  if (!authManager.verifyPassword(password)) {
    authManager.recordFailedAttempt(ip);
    const updated = authManager.checkRateLimit(ip);
    res.status(401).json({
      error: 'Invalid password',
      remainingAttempts: updated.remainingAttempts,
      retryAfterMs: updated.retryAfterMs,
    });
    return;
  }

  authManager.clearRateLimit(ip);
  const token = authManager.createSession();
  res.json({ token });
});

app.post('/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    authManager.destroySession(token);
  }
  res.json({ success: true });
});

app.get('/auth/status', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token && authManager.validateSession(token)) {
    res.json({ authenticated: true });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

// Serve static files from dist/client in production
const clientDistPath = join(__dirname, '..', 'dist', 'client');
app.use(express.static(clientDistPath));

// SPA catch-all — serve index.html for any non-API/non-asset route
app.get('/{*path}', (_req, res) => {
  res.sendFile(join(clientDistPath, 'index.html'));
});

const httpServer = createServer(app);

// ── State ────────────────────────────────────────────────────────────────

const projects: Record<string, Project> = {};
const agents: Record<string, Agent> = {};

// ── Core services ────────────────────────────────────────────────────────

const sessionManager = new SessionManager();
const fileWatcher = new FileWatcher();
const gitMonitor = new GitMonitor();
const orchestrator = new Orchestrator(sessionManager);

// ── WebSocket server (noServer mode — we handle upgrade ourselves) ──────

const wss = new WebSocketServer({ noServer: true });

// Track clients connected to /ws/events
const eventClients: Set<WebSocket> = new Set();

// ── Broadcast helper ─────────────────────────────────────────────────────

function broadcast(msg: ServerMessage): void {
  const payload = JSON.stringify(msg);
  for (const ws of eventClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

let logCounter = 0;
function broadcastLog(
  level: LogEntry['level'],
  source: string,
  message: string,
  agentId?: string,
  projectId?: string,
): void {
  const entry: LogEntry = {
    id: `log-${Date.now()}-${++logCounter}`,
    level,
    source,
    message,
    timestamp: Date.now(),
    ...(agentId && { agentId }),
    ...(projectId && { projectId }),
  };
  broadcast({ type: 'log', payload: { entry } });
}

function buildStateSync(): StateSyncMessage {
  return {
    type: 'state:sync',
    payload: { projects, agents, baseDir: getBaseDirectory() },
  };
}

// ── Helper: register an agent in state and launch it ─────────────────────

function registerAndLaunchAgent(config: {
  id: string;
  projectId: string;
  task: string;
  cwd: string;
  role: AgentRole;
  planTaskId?: string;
  branch?: string;
}): void {
  const { id, projectId, task, cwd, role, planTaskId, branch } = config;

  agents[id] = {
    id,
    projectId,
    task: role === 'manual' ? task : `[${role.toUpperCase()}] ${task.slice(0, 100)}...`,
    cwd,
    status: 'launched',
    role,
    launchedAt: Date.now(),
    ...(planTaskId && { planTaskId }),
    ...(branch && { branch }),
  };

  if (projects[projectId]) {
    projects[projectId].agents.push(id);
  }

  const roleLabel = role === 'manual' ? '' : ` (${role})`;
  broadcastLog('info', 'AgentManager', `Agent ${id.slice(0, 8)}${roleLabel} launched for project "${projects[projectId]?.name}"`, id, projectId);
  sessionManager.launchAgent({ id, projectId, task, cwd, role });

  // Broadcast updated state so clients see the new agent immediately
  broadcast(buildStateSync());
}

// ── Wire up service events → broadcast ──────────────────────────────────

sessionManager.on('agent:status', (data: { agentId: string; status: string; timestamp: number }) => {
  // Update local agent state
  if (agents[data.agentId]) {
    agents[data.agentId].status = data.status as Agent['status'];
    if (data.status === 'completed' || data.status === 'error') {
      agents[data.agentId].completedAt = data.timestamp;
    }
  }

  broadcastLog(
    data.status === 'error' ? 'error' : 'info',
    'AgentManager',
    `Agent ${data.agentId.slice(0, 8)} status → ${data.status}`,
    data.agentId,
    agents[data.agentId]?.projectId,
  );

  broadcast({
    type: 'agent:status',
    payload: {
      agentId: data.agentId,
      status: data.status as Agent['status'],
      timestamp: data.timestamp,
    },
  });
});

sessionManager.on('log', (data: { level: string; agentId: string; projectId: string; source: string; message: string }) => {
  broadcastLog(data.level as LogEntry['level'], data.source, data.message, data.agentId, data.projectId);
});

sessionManager.outputParser.on('parsed', (evt) => {
  const { event, agentId, timestamp, path, message } = evt;

  if (event === 'file:created' || event === 'file:edited') {
    broadcast({
      type: event as 'file:created' | 'file:edited',
      payload: { agentId, path: path ?? '', timestamp },
    });
  } else if (event === 'build:started' || event === 'build:succeeded' || event === 'build:error') {
    broadcast({
      type: event as 'build:started' | 'build:succeeded' | 'build:error',
      payload: { agentId, message, timestamp },
    });
  } else if (event === 'task:completed') {
    broadcast({
      type: 'task:completed',
      payload: { agentId, timestamp },
    });
  }
});

// ── Feed raw agent output to orchestrator ────────────────────────────────

sessionManager.on('agent:output', (data: { agentId: string; data: string }) => {
  orchestrator.feedAgentOutput(data.agentId, data.data);
});

sessionManager.on('agent:exit', (data: { agentId: string; exitCode: number }) => {
  orchestrator.onAgentComplete(data.agentId, data.exitCode);
});

// ── Wire up orchestrator events → broadcast ──────────────────────────────

orchestrator.on('phase', (data: { projectId: string; phase: string; timestamp: number }) => {
  // Update project orchestration state
  if (projects[data.projectId]?.orchestration) {
    projects[data.projectId].orchestration!.phase = data.phase as any;
  }

  broadcastLog('info', 'Orchestrator', `Phase → ${data.phase.toUpperCase()}`, undefined, data.projectId);

  broadcast({
    type: 'orchestration:phase',
    payload: {
      projectId: data.projectId,
      phase: data.phase as any,
      timestamp: data.timestamp,
    },
  });
});

orchestrator.on('plan-ready', (data: { projectId: string; tasks: any[]; timestamp: number }) => {
  // Store plan in project state
  if (projects[data.projectId]?.orchestration) {
    projects[data.projectId].orchestration!.plan = data.tasks;
  }

  broadcastLog('success', 'Orchestrator', `Plan ready with ${data.tasks.length} tasks`, undefined, data.projectId);

  broadcast({
    type: 'orchestration:plan-ready',
    payload: {
      projectId: data.projectId,
      tasks: data.tasks,
      timestamp: data.timestamp,
    },
  });
});

orchestrator.on('task-update', (data) => {
  broadcast({
    type: 'orchestration:task-update',
    payload: {
      projectId: data.projectId,
      taskId: data.taskId,
      status: data.status,
      assignedAgent: data.assignedAgent,
      branch: data.branch,
      timestamp: data.timestamp,
    },
  });
});

orchestrator.on('worker-spawned', (data) => {
  broadcast({
    type: 'orchestration:worker-spawned',
    payload: {
      projectId: data.projectId,
      agentId: data.agentId,
      taskId: data.taskId,
      branch: data.branch,
      timestamp: data.timestamp,
    },
  });
});

orchestrator.on('merge-result', (data) => {
  broadcast({
    type: 'orchestration:merge-result',
    payload: {
      projectId: data.projectId,
      branch: data.branch,
      taskId: data.taskId,
      success: data.success,
      message: data.message,
      timestamp: data.timestamp,
    },
  });
});

orchestrator.on('log', (data: { level: string; source: string; message: string; projectId: string; agentId?: string }) => {
  broadcastLog(data.level as LogEntry['level'], data.source, data.message, data.agentId, data.projectId);
});

// The orchestrator emits 'agent-launch' when it needs to spawn agents
// (coordinator, workers, merger). We handle the actual launch here.
orchestrator.on('agent-launch', (config: {
  id: string;
  projectId: string;
  task: string;
  cwd: string;
  role: AgentRole;
  planTaskId?: string;
  branch?: string;
}) => {
  registerAndLaunchAgent(config);
});

// ── File watcher + git monitor events ────────────────────────────────────

fileWatcher.on('fs:change', (data) => {
  broadcast({
    type: 'fs:change',
    payload: data,
  });
});

gitMonitor.on('git:status', (data) => {
  broadcast({
    type: 'git:status',
    payload: data,
  });
});

// ── Handle HTTP upgrade → route to correct WS path ──────────────────────

httpServer.on('upgrade', (request, socket, head) => {
  const parsedUrl = parseUrl(request.url ?? '', true);
  const pathname = parsedUrl.pathname ?? '';

  // Require valid session token for WebSocket connections
  const token = parsedUrl.query.token as string | undefined;
  if (!token || !authManager.validateSession(token)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  // Route: /ws/terminal/:agentId
  const terminalMatch = pathname.match(/^\/ws\/terminal\/([^/]+)$/);
  if (terminalMatch) {
    const agentId = terminalMatch[1];

    wss.handleUpgrade(request, socket, head, (ws) => {
      handleTerminalConnection(ws, agentId);
    });
    return;
  }

  // Route: /ws/events
  if (pathname === '/ws/events') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      handleEventsConnection(ws);
    });
    return;
  }

  // Unknown WS path
  socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
  socket.destroy();
});

// ── Terminal WS handler ──────────────────────────────────────────────────

function handleTerminalConnection(ws: WebSocket, agentId: string): void {
  const ptyInstance = sessionManager.getSession(agentId);

  if (!ptyInstance) {
    ws.close(1008, `No active session for agent ${agentId}`);
    return;
  }

  // Register this WS as a terminal client for the agent
  sessionManager.addTerminalClient(agentId, ws);

  // Forward binary data from the WS client to the pty stdin
  ws.on('message', (data: Buffer | string) => {
    const str = typeof data === 'string' ? data : data.toString('utf-8');
    sessionManager.writeToSession(agentId, str);
  });

  ws.on('close', () => {
    // Removal is handled inside addTerminalClient's close listener
  });
}

// ── Events WS handler ───────────────────────────────────────────────────

function handleEventsConnection(ws: WebSocket): void {
  eventClients.add(ws);

  // Send current state on connect
  ws.send(JSON.stringify(buildStateSync()));

  ws.on('message', (raw: Buffer | string) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf-8'));
    } catch {
      return; // ignore malformed messages
    }

    handleClientMessage(msg);
  });

  ws.on('close', () => {
    eventClients.delete(ws);
  });
}

// ── Client message dispatcher ────────────────────────────────────────────

async function handleClientMessage(msg: ClientMessage): Promise<void> {
  switch (msg.type) {
    case 'agent:launch': {
      const { id, projectId, task, cwd } = msg.payload;

      const projectCwd = projects[projectId]?.cwd;
      if (!projectCwd) {
        broadcast({
          type: 'validation:error',
          payload: { message: `Project "${projectId}" not found`, context: 'agent:launch' },
        });
        break;
      }

      // Validate agent CWD is within the project directory
      const validation = await validateAgentCwd(cwd, projectCwd);
      if (!validation.valid) {
        broadcastLog('warn', 'PathSecurity', `Agent launch blocked: ${validation.reason}`, id, projectId);
        broadcast({
          type: 'validation:error',
          payload: { message: validation.reason!, context: 'agent:launch' },
        });
        break;
      }

      registerAndLaunchAgent({ id, projectId, task, cwd, role: 'manual' });
      break;
    }

    case 'agent:kill': {
      const { agentId } = msg.payload;
      sessionManager.killSession(agentId);
      break;
    }

    case 'terminal:input': {
      const { agentId, data } = msg.payload;
      sessionManager.writeToSession(agentId, data);
      break;
    }

    case 'terminal:resize': {
      const { agentId, cols, rows } = msg.payload;
      sessionManager.resizeSession(agentId, cols, rows);
      break;
    }

    case 'project:watch': {
      const { projectId, cwd } = msg.payload;

      const watchValidation = await validateProjectPath(cwd);
      if (!watchValidation.valid) {
        broadcast({
          type: 'validation:error',
          payload: { message: watchValidation.reason!, context: 'project:watch' },
        });
        break;
      }

      // Register project if not present
      if (!projects[projectId]) {
        projects[projectId] = {
          id: projectId,
          name: projectId,
          description: '',
          cwd,
          status: 'active',
          agents: [],
          paletteIndex: Math.abs([...projectId].reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0)) % 8,
        };
      }

      fileWatcher.watch(projectId, cwd);
      break;
    }

    case 'project:unwatch': {
      const { projectId } = msg.payload;
      fileWatcher.unwatch(projectId);
      break;
    }

    case 'git:startMonitor': {
      const { projectId, cwd } = msg.payload;

      const gitValidation = await validateProjectPath(cwd);
      if (!gitValidation.valid) {
        broadcast({
          type: 'validation:error',
          payload: { message: gitValidation.reason!, context: 'git:startMonitor' },
        });
        break;
      }

      gitMonitor.startMonitoring(projectId, cwd);
      break;
    }

    case 'git:stopMonitor': {
      const { projectId } = msg.payload;
      gitMonitor.stopMonitoring(projectId);
      break;
    }

    case 'project:create': {
      const { id, name, description, paletteIndex } = msg.payload;

      // Server generates project directory — no user-provided path
      const projectCwd = await createProjectDirectory(name);

      projects[id] = {
        id,
        name,
        description,
        cwd: projectCwd,
        status: 'active',
        agents: [],
        paletteIndex: paletteIndex ?? 0,
      };
      // Start file watcher on the created directory
      fileWatcher.watch(id, projectCwd);
      broadcastLog('success', 'ProjectManager', `Project "${name}" created at ${projectCwd}`, undefined, id);
      // Broadcast updated state
      broadcast(buildStateSync());
      break;
    }

    // ── Orchestration messages ──────────────────────────────────────────

    case 'orchestration:start': {
      const { projectId, maxConcurrentWorkers } = msg.payload;

      const project = projects[projectId];
      if (!project) {
        broadcast({
          type: 'validation:error',
          payload: { message: `Project "${projectId}" not found`, context: 'orchestration:start' },
        });
        break;
      }

      try {
        const orch = await orchestrator.startOrchestration(project, maxConcurrentWorkers);
        project.orchestration = orch;
        orchestrator.setProjectCwd(projectId, project.cwd);
        orchestrator.setProjectState(projectId, project);
        broadcast(buildStateSync());
      } catch (err) {
        broadcastLog('error', 'Orchestrator', `Failed to start orchestration: ${err}`, undefined, projectId);
        broadcast({
          type: 'validation:error',
          payload: { message: String(err), context: 'orchestration:start' },
        });
      }
      break;
    }

    case 'orchestration:approve-plan': {
      const { projectId } = msg.payload;

      const project = projects[projectId];
      if (!project) break;

      try {
        orchestrator.setProjectState(projectId, project);
        await orchestrator.approvePlan(projectId, project);
        broadcast(buildStateSync());
      } catch (err) {
        broadcastLog('error', 'Orchestrator', `Failed to approve plan: ${err}`, undefined, projectId);
      }
      break;
    }

    case 'orchestration:abort': {
      const { projectId } = msg.payload;

      const project = projects[projectId];
      if (!project) break;

      await orchestrator.abortOrchestration(projectId, project.cwd);
      delete project.orchestration;
      broadcast(buildStateSync());
      break;
    }

    case 'state:request': {
      broadcast(buildStateSync());
      break;
    }
  }
}

// ── Start server ─────────────────────────────────────────────────────────

(async () => {
  await authManager.init();
  console.log(`Auth: ${authManager.isSetupRequired() ? 'Setup required (no password configured)' : 'Password configured'}`);

  await ensureBaseDirectory();
  console.log(`Base project directory: ${getBaseDirectory()}`);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`ConstellationCommand server listening on 0.0.0.0:${PORT}`);
  });
})();
