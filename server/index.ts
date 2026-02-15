import { createServer } from 'node:http';
import { parse as parseUrl } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { SessionManager } from './SessionManager.js';
import { FileWatcher } from './FileWatcher.js';
import { GitMonitor } from './GitMonitor.js';
import type {
  Agent,
  Project,
  ClientMessage,
  ServerMessage,
  StateSyncMessage,
} from './types.js';

// ── Config ───────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? '';
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Express app ──────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// Serve static files from dist/client in production
const clientDistPath = join(__dirname, '..', 'dist', 'client');
app.use(express.static(clientDistPath));

const httpServer = createServer(app);

// ── State ────────────────────────────────────────────────────────────────

const projects: Record<string, Project> = {};
const agents: Record<string, Agent> = {};

// ── Core services ────────────────────────────────────────────────────────

const sessionManager = new SessionManager();
const fileWatcher = new FileWatcher();
const gitMonitor = new GitMonitor();

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

function buildStateSync(): StateSyncMessage {
  return {
    type: 'state:sync',
    payload: { projects, agents },
  };
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

  broadcast({
    type: 'agent:status',
    payload: {
      agentId: data.agentId,
      status: data.status as Agent['status'],
      timestamp: data.timestamp,
    },
  });
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

  // Optional auth token check
  if (AUTH_TOKEN) {
    const token = parsedUrl.query.token as string | undefined;
    if (token !== AUTH_TOKEN) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
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

function handleClientMessage(msg: ClientMessage): void {
  switch (msg.type) {
    case 'agent:launch': {
      const { id, projectId, task, cwd } = msg.payload;

      // Register agent in state
      agents[id] = {
        id,
        projectId,
        task,
        cwd,
        status: 'launched',
        launchedAt: Date.now(),
      };

      // Add agent to project
      if (projects[projectId]) {
        projects[projectId].agents.push(id);
      }

      sessionManager.launchAgent({ id, projectId, task, cwd });
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

      // Register project if not present
      if (!projects[projectId]) {
        projects[projectId] = {
          id: projectId,
          name: projectId,
          description: '',
          cwd,
          status: 'active',
          agents: [],
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
      gitMonitor.startMonitoring(projectId, cwd);
      break;
    }

    case 'git:stopMonitor': {
      const { projectId } = msg.payload;
      gitMonitor.stopMonitoring(projectId);
      break;
    }
  }
}

// ── Start server ─────────────────────────────────────────────────────────

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`ConstellationCommand server listening on 0.0.0.0:${PORT}`);
});
