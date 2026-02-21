export type AgentRole = 'manual' | 'coordinator' | 'worker' | 'merger';

export interface Agent {
  id: string;
  projectId: string;
  task: string;
  cwd: string;
  role: AgentRole;
  status:
    | 'queued'        // Not yet started
    | 'launching'     // CLI booting up
    | 'active'        // General working state
    | 'thinking'      // Reasoning / planning
    | 'coding'        // Writing or editing files
    | 'executing'     // Running shell commands
    | 'scanning'      // Reading / searching files
    | 'downloading'   // Fetching from web
    | 'building'      // Compiling / bundling
    | 'testing'       // Running test suites
    | 'waiting'       // Awaiting user input
    | 'paused'        // Disconnected / reconnecting
    | 'completed'     // Finished successfully
    | 'error';        // Exited with error
  launchedAt: number;
  completedAt?: number;
  filesChanged: number;
  events: AgentEvent[];
  /** For workers: the plan task ID this agent is executing */
  planTaskId?: string;
  /** For workers: the git branch this agent works on */
  branch?: string;
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
  paletteIndex: number;
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

export type OrchestrationPhase =
  | 'initializing'  // Coordinator spawning
  | 'planning'      // Coordinator generating plan
  | 'reviewing'     // Plan ready, awaiting user approval
  | 'executing'     // Workers active
  | 'completing'    // All tasks done, final merges
  | 'completed'     // Project finished
  | 'error';        // Orchestration failed

export interface PlanTask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'assigned' | 'in-progress' | 'completed' | 'failed';
  assignedAgent: string | null;
  branch: string | null;
  order: number;
  dependencies: string[];
}

export type View = 'tactical' | 'incubator' | 'planning' | 'logs' | 'status';

// WebSocket message types (flat client-facing API; useWebSocket wraps for server)
export type WSClientMessage =
  | { type: 'terminal:input'; agentId: string; data: string }
  | { type: 'terminal:resize'; agentId: string; cols: number; rows: number }
  | { type: 'agent:launch'; id: string; projectId: string; task: string; cwd: string }
  | { type: 'agent:kill'; agentId: string }
  | { type: 'project:create'; id: string; name: string; description: string; paletteIndex: number }
  | { type: 'state:request' }
  | { type: 'orchestration:start'; projectId: string; maxConcurrentWorkers?: number }
  | { type: 'orchestration:approve-plan'; projectId: string }
  | { type: 'orchestration:abort'; projectId: string };

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
  | { type: 'log'; entry: LogEntry }
  | { type: 'orchestration:phase'; projectId: string; phase: OrchestrationPhase; timestamp: number }
  | { type: 'orchestration:plan-ready'; projectId: string; tasks: PlanTask[]; timestamp: number }
  | { type: 'orchestration:task-update'; projectId: string; taskId: string; status: PlanTask['status']; assignedAgent: string | null; branch: string | null; timestamp: number }
  | { type: 'orchestration:worker-spawned'; projectId: string; agentId: string; taskId: string; branch: string; timestamp: number }
  | { type: 'orchestration:merge-result'; projectId: string; branch: string; taskId: string; success: boolean; message: string; timestamp: number };
