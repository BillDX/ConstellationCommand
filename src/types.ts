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

// WebSocket message types
export type WSClientMessage =
  | { type: 'terminal:input'; agentId: string; data: string }
  | { type: 'agent:launch'; projectId: string; task: string; cwd: string }
  | { type: 'agent:kill'; agentId: string }
  | { type: 'project:create'; name: string; description: string; cwd: string }
  | { type: 'state:request' };

export type WSServerMessage =
  | { type: 'terminal:output'; agentId: string; data: string }
  | { type: 'event'; agentId: string; event: string; detail: Record<string, any> }
  | { type: 'agent:status'; agentId: string; status: Agent['status'] }
  | { type: 'fs:change'; event: string; path: string; projectId: string }
  | { type: 'state:sync'; projects: Project[]; agents: Agent[] }
  | { type: 'log'; entry: LogEntry };
