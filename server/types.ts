// ── Agent & Project domain types ──────────────────────────────────────────

export type AgentStatus = 'launched' | 'running' | 'completed' | 'error';

export interface Agent {
  id: string;
  projectId: string;
  task: string;
  cwd: string;
  status: AgentStatus;
  launchedAt: number;
  completedAt?: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  cwd: string;
  status: 'active' | 'idle' | 'error';
  agents: string[];
}

// ── WebSocket messages: Client → Server ──────────────────────────────────

export interface AgentLaunchMessage {
  type: 'agent:launch';
  payload: {
    id: string;
    projectId: string;
    task: string;
    cwd: string;
  };
}

export interface AgentKillMessage {
  type: 'agent:kill';
  payload: { agentId: string };
}

export interface TerminalInputMessage {
  type: 'terminal:input';
  payload: {
    agentId: string;
    data: string;
  };
}

export interface TerminalResizeMessage {
  type: 'terminal:resize';
  payload: {
    agentId: string;
    cols: number;
    rows: number;
  };
}

export interface ProjectWatchMessage {
  type: 'project:watch';
  payload: {
    projectId: string;
    cwd: string;
  };
}

export interface ProjectUnwatchMessage {
  type: 'project:unwatch';
  payload: { projectId: string };
}

export interface GitMonitorStartMessage {
  type: 'git:startMonitor';
  payload: {
    projectId: string;
    cwd: string;
  };
}

export interface GitMonitorStopMessage {
  type: 'git:stopMonitor';
  payload: { projectId: string };
}

export interface ProjectCreateMessage {
  type: 'project:create';
  payload: {
    id: string;
    name: string;
    description: string;
    cwd: string;
  };
}

export interface StateRequestMessage {
  type: 'state:request';
}

export type ClientMessage =
  | AgentLaunchMessage
  | AgentKillMessage
  | TerminalInputMessage
  | TerminalResizeMessage
  | ProjectWatchMessage
  | ProjectUnwatchMessage
  | GitMonitorStartMessage
  | GitMonitorStopMessage
  | ProjectCreateMessage
  | StateRequestMessage;

// ── WebSocket messages: Server → Client ──────────────────────────────────

export interface StateSyncMessage {
  type: 'state:sync';
  payload: {
    projects: Record<string, Project>;
    agents: Record<string, Agent>;
  };
}

export interface AgentStatusMessage {
  type: 'agent:status';
  payload: {
    agentId: string;
    status: AgentStatus;
    timestamp: number;
  };
}

export interface FileEventMessage {
  type: 'file:created' | 'file:edited';
  payload: {
    agentId: string;
    path: string;
    timestamp: number;
  };
}

export interface BuildEventMessage {
  type: 'build:started' | 'build:succeeded' | 'build:error';
  payload: {
    agentId: string;
    message?: string;
    timestamp: number;
  };
}

export interface TaskCompletedMessage {
  type: 'task:completed';
  payload: {
    agentId: string;
    timestamp: number;
  };
}

export interface FsChangeMessage {
  type: 'fs:change';
  payload: {
    projectId: string;
    event: 'add' | 'change' | 'unlink';
    path: string;
    timestamp: number;
  };
}

export interface GitStatusMessage {
  type: 'git:status';
  payload: {
    projectId: string;
    changes: GitFileChange[];
    diffStat: string;
    timestamp: number;
  };
}

export interface GitFileChange {
  status: string;
  path: string;
}

export type ServerMessage =
  | StateSyncMessage
  | AgentStatusMessage
  | FileEventMessage
  | BuildEventMessage
  | TaskCompletedMessage
  | FsChangeMessage
  | GitStatusMessage;
