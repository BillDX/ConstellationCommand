import { useEffect, useRef, useCallback, useState } from 'react';
import type { WSClientMessage, WSServerMessage } from '../types';
import { useAgentStore } from '../stores/agentStore';
import { useProjectStore } from '../stores/projectStore';
import { useLogStore } from '../stores/logStore';

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

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(1000);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

  const { addAgent, updateAgent, addEvent } = useAgentStore.getState();
  const { addProject, updateProject } = useProjectStore.getState();
  const { addLog } = useLogStore.getState();

  const sendMessage = useCallback((message: WSClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }, []);

  const handleMessage = useCallback((data: WSServerMessage) => {
    switch (data.type) {
      case 'terminal:output': {
        // Dispatch to all registered terminal output callbacks
        terminalOutputCallbacks.forEach((cb) => {
          cb(data.agentId, data.data);
        });
        break;
      }

      case 'event': {
        const event = {
          id: `${data.agentId}-${Date.now()}`,
          agentId: data.agentId,
          type: data.event as any,
          detail: data.detail,
          timestamp: Date.now(),
        };
        addEvent(data.agentId, event);
        break;
      }

      case 'agent:status': {
        const updates: Record<string, any> = { status: data.status };
        if (data.status === 'completed' || data.status === 'error') {
          updates.completedAt = Date.now();
        }
        updateAgent(data.agentId, updates);
        break;
      }

      case 'fs:change': {
        // File system change events are informational;
        // the server tracks filesChanged counts and pushes agent updates
        break;
      }

      case 'state:sync': {
        // Bulk sync projects and agents from server
        const agentStore = useAgentStore.getState();
        const projectStore = useProjectStore.getState();

        for (const project of data.projects) {
          projectStore.addProject(project);
        }
        for (const agent of data.agents) {
          agentStore.addAgent(agent);
        }
        break;
      }

      case 'log': {
        addLog(data.entry);
        break;
      }
    }
  }, [addEvent, updateAgent, addLog]);

  const connect = useCallback(() => {
    // Clean up any existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/ws/events`;

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
        const data: WSServerMessage = JSON.parse(event.data);
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
  }, [sendMessage, handleMessage]);

  useEffect(() => {
    connect();

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
  }, [connect]);

  return { sendMessage, connectionStatus };
}
