import { useEffect, useRef, useCallback, useState } from 'react';
import type { WSClientMessage, WSServerMessage } from '../types';
import { useAgentStore } from '../stores/agentStore';
import { useProjectStore } from '../stores/projectStore';
import { useLogStore } from '../stores/logStore';
import { useFlowStore } from '../stores/flowStore';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
type TerminalOutputCallback = (agentId: string, data: string) => void;

// Global terminal output callback registry
const terminalOutputCallbacks = new Map<string, TerminalOutputCallback>();

export function registerTerminalCallback(id: string, cb: TerminalOutputCallback): () => void {
  terminalOutputCallbacks.set(id, cb);
  return () => {
    terminalOutputCallbacks.delete(id);
  };
}

export function useWebSocket(token: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(1000);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

  const { addAgent, updateAgent, addEvent } = useAgentStore.getState();
  const { addProject, updateProject, setBaseDir } = useProjectStore.getState();
  const { addLog } = useLogStore.getState();
  const { addToast } = useFlowStore.getState();

  const sendMessage = useCallback((message: WSClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Wrap flat client messages into the payload format the server expects
      let wrapped: any;
      switch (message.type) {
        case 'agent:launch':
          wrapped = { type: 'agent:launch', payload: { id: message.id, projectId: message.projectId, task: message.task, cwd: message.cwd } };
          break;
        case 'agent:kill':
          wrapped = { type: 'agent:kill', payload: { agentId: message.agentId } };
          break;
        case 'terminal:input':
          wrapped = { type: 'terminal:input', payload: { agentId: message.agentId, data: message.data } };
          break;
        case 'terminal:resize':
          wrapped = { type: 'terminal:resize', payload: { agentId: message.agentId, cols: message.cols, rows: message.rows } };
          break;
        case 'project:create':
          wrapped = { type: 'project:create', payload: { id: message.id, name: message.name, description: message.description } };
          break;
        case 'state:request':
          wrapped = message; // No payload needed
          break;
        default:
          wrapped = message;
      }
      ws.send(JSON.stringify(wrapped));
    }
  }, []);

  // Map server status values to client status values
  type AgentStatus = 'queued' | 'launching' | 'active' | 'completed' | 'error';
  const statusMap: Record<string, string> = { launched: 'launching', running: 'active' };
  const mapStatus = (status: string): AgentStatus => (statusMap[status] || status) as AgentStatus;

  const handleMessage = useCallback((data: WSServerMessage) => {
    switch (data.type) {
      case 'terminal:output': {
        // Dispatch to all registered terminal output callbacks
        terminalOutputCallbacks.forEach((cb) => {
          cb(data.agentId, data.data);
        });
        break;
      }

      case 'agent:status': {
        const mappedStatus = mapStatus(data.status);
        const updates: Record<string, any> = { status: mappedStatus };
        if (mappedStatus === 'completed' || mappedStatus === 'error') {
          updates.completedAt = data.timestamp || Date.now();
        }
        updateAgent(data.agentId, updates);
        break;
      }

      case 'file:created':
      case 'file:edited': {
        const event = {
          id: `${data.agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          agentId: data.agentId,
          type: data.type as any,
          detail: { path: data.path },
          timestamp: data.timestamp || Date.now(),
        };
        addEvent(data.agentId, event);
        // Increment filesChanged count
        const agent = useAgentStore.getState().agents[data.agentId];
        if (agent) {
          updateAgent(data.agentId, { filesChanged: (agent.filesChanged || 0) + 1 });
        }
        break;
      }

      case 'build:started':
      case 'build:succeeded':
      case 'build:error': {
        const event = {
          id: `${data.agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          agentId: data.agentId,
          type: data.type as any,
          detail: { message: data.message },
          timestamp: data.timestamp || Date.now(),
        };
        addEvent(data.agentId, event);
        break;
      }

      case 'task:completed': {
        const event = {
          id: `${data.agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          agentId: data.agentId,
          type: 'task:completed' as any,
          detail: {},
          timestamp: data.timestamp || Date.now(),
        };
        addEvent(data.agentId, event);
        break;
      }

      case 'fs:change': {
        // File system change events are informational
        break;
      }

      case 'git:status': {
        // Git status updates - informational for now
        break;
      }

      case 'state:sync': {
        // Bulk sync projects and agents from server
        // Server sends Records, convert to arrays and map fields
        const agentStore = useAgentStore.getState();
        const projectStore = useProjectStore.getState();

        // Store base directory from server
        if (data.baseDir) {
          projectStore.setBaseDir(data.baseDir);
        }

        const serverProjects = data.projects || {};
        for (const proj of Object.values(serverProjects)) {
          const p = proj as any;
          projectStore.addProject({
            id: p.id,
            name: p.name,
            description: p.description || '',
            cwd: p.cwd,
            status: p.status || 'active',
            health: p.health || 'healthy',
            progress: p.progress ?? 0,
            agents: p.agents || [],
            createdAt: p.createdAt || Date.now(),
          });
        }

        const serverAgents = data.agents || {};
        for (const ag of Object.values(serverAgents)) {
          const a = ag as any;
          agentStore.addAgent({
            id: a.id,
            projectId: a.projectId,
            task: a.task,
            cwd: a.cwd,
            status: mapStatus(a.status),
            launchedAt: a.launchedAt,
            completedAt: a.completedAt,
            filesChanged: a.filesChanged ?? 0,
            events: a.events || [],
          });
        }
        break;
      }

      case 'log': {
        addLog(data.entry);
        break;
      }

      case 'validation:error': {
        addToast({
          type: 'error',
          title: 'VALIDATION ERROR',
          message: data.message,
          duration: 6000,
        });
        break;
      }
    }
  }, [addEvent, updateAgent, addLog, addToast]);

  const connect = useCallback(() => {
    // Don't connect without a token
    if (!token) return;

    // Clean up any existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/ws/events?token=${encodeURIComponent(token)}`;

    setConnectionStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      reconnectDelayRef.current = 1000; // Reset backoff on successful connect

      // Request full state sync from server
      sendMessage({ type: 'state:request' });
    };

    ws.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data);
        // Server sends payload-wrapped messages; unwrap for handlers
        const data: WSServerMessage = raw.payload
          ? { type: raw.type, ...raw.payload }
          : raw;
        handleMessage(data);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      wsRef.current = null;

      // Schedule reconnect with exponential backoff
      const delay = reconnectDelayRef.current;
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);

      // Increase delay for next attempt, capped at 30s
      reconnectDelayRef.current = Math.min(delay * 2, 30000);
    };

    ws.onerror = () => {
      // The onclose handler will fire after onerror, so reconnect logic is handled there
    };
  }, [token, sendMessage, handleMessage]);

  useEffect(() => {
    // Clean up previous connection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (token) {
      connect();
    } else {
      setConnectionStatus('disconnected');
    }

    return () => {
      // Clean up on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [token, connect]);

  return { sendMessage, connectionStatus };
}
