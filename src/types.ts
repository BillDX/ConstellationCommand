export interface Agent {
  id: string;
  projectId: string;
  task: string;
  cwd: string;
  status: 'queued' | 'launching' | 'active' | 'completed' | 'error';
  launchedAt: number;
  completedAt?: number;
  filesChanged: number;
  events: AgentEvent[];
}

export interface AgentEvent {
  id: string;
  agentId: string;
  type: 'file:created' | 'file:edited' | 'build:started' | 'build:succeeded' | 'build:error' | 'task:completed' | 'info';
  detail: Record<string, any>;
  timestamp: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  cwd: string;
  status: 'active' | 'concept' | 'development' | 'deployed' | 'needs-attention';
  health: 'healthy' | 'warning' | 'error';
  progress: number;
  agents: string[];
  createdAt: number;
}

export interface LogEntry {
  id: string;
  agentId?: string;
  projectId?: string;
  level: 'info' | 'warn' | 'error' | 'success';
  source: string;
  message: string;
  timestamp: number;
}

export type View = 'tactical' | 'incubator' | 'planning' | 'logs' | 'status';

// WebSocket message types (flat client-facing API; useWebSocket wraps for server)
export type WSClientMessage =
  | { type: 'terminal:input'; agentId: string; data: string }
  | { type: 'terminal:resize'; agentId: string; cols: number; rows: number }
  | { type: 'agent:launch'; id: string; projectId: string; task: string; cwd: string }
  | { type: 'agent:kill'; agentId: string }
  | { type: 'project:create'; id: string; name: string; description: string }
  | { type: 'state:request' };

// Server messages (unwrapped from payload wrapper in useWebSocket)
export type WSServerMessage =
  | { type: 'terminal:output'; agentId: string; data: string }
  | { type: 'agent:status'; agentId: string; status: string; timestamp: number }
  | { type: 'state:sync'; projects: Record<string, any>; agents: Record<string, any>; baseDir: string }
  | { type: 'fs:change'; projectId: string; event: string; path: string; timestamp: number }
  | { type: 'file:created'; agentId: string; path: string; timestamp: number }
  | { type: 'file:edited'; agentId: string; path: string; timestamp: number }
  | { type: 'build:started'; agentId: string; message?: string; timestamp: number }
  | { type: 'build:succeeded'; agentId: string; message?: string; timestamp: number }
  | { type: 'build:error'; agentId: string; message?: string; timestamp: number }
  | { type: 'task:completed'; agentId: string; timestamp: number }
  | { type: 'git:status'; projectId: string; changes: any[]; diffStat: string; timestamp: number }
  | { type: 'validation:error'; message: string; context: string }
  | { type: 'log'; entry: LogEntry };
