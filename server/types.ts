// ── Agent & Project domain types ──────────────────────────────────────────

export type AgentStatus =
  | 'launched'      // PTY spawned, CLI booting
  | 'running'       // General active state (fallback)
  | 'thinking'      // "Thinking..." — reasoning phase
  | 'coding'        // Writing/editing files
  | 'executing'     // Running bash/shell commands
  | 'scanning'      // Reading files, searching, grepping
  | 'downloading'   // Web fetch / web search
  | 'building'      // npm/compile/build operations
  | 'testing'       // Running tests
  | 'waiting'       // Awaiting user input (turn complete)
  | 'paused'        // Disconnected / reconnecting
  | 'completed'     // PTY exited successfully
  | 'error';        // PTY exited with error

// ── Agent roles for orchestrated projects ─────────────────────────────────

export type AgentRole =
  | 'manual'        // Legacy: user-launched agent with free-form task
  | 'coordinator'   // Plans work, monitors workers, drives completion
  | 'worker'        // Executes a single task in an isolated branch
  | 'merger';       // Merges completed worker branches into main

export interface Agent {
  id: string;
  projectId: string;
  task: string;
  cwd: string;
  status: AgentStatus;
  role: AgentRole;
  launchedAt: number;
  completedAt?: number;
  /** For workers: the plan task ID this agent is executing */
  planTaskId?: string;
  /** For workers: the git branch this agent works on */
  branch?: string;
}

// ── Orchestration types ───────────────────────────────────────────────────

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

export interface OrchestratedProject {
  projectId: string;
  phase: OrchestrationPhase;
  coordinatorId: string | null;
  mergerId: string | null;
  workerIds: string[];
  plan: PlanTask[];
  maxConcurrentWorkers: number;
  startedAt: number;
  completedAt?: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  cwd: string;
  status: 'active' | 'idle' | 'error';
  agents: string[];
  paletteIndex: number;
  /** If set, this project is running in orchestrated mode */
  orchestration?: OrchestratedProject;
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
    paletteIndex: number;
  };
}

export interface StateRequestMessage {
  type: 'state:request';
}

// ── Orchestration messages: Client → Server ───────────────────────────────

export interface OrchestrationStartMessage {
  type: 'orchestration:start';
  payload: {
    projectId: string;
    maxConcurrentWorkers?: number;
  };
}

export interface OrchestrationApprovePlanMessage {
  type: 'orchestration:approve-plan';
  payload: {
    projectId: string;
  };
}

export interface OrchestrationAbortMessage {
  type: 'orchestration:abort';
  payload: {
    projectId: string;
  };
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
  | StateRequestMessage
  | OrchestrationStartMessage
  | OrchestrationApprovePlanMessage
  | OrchestrationAbortMessage;

// ── WebSocket messages: Server → Client ──────────────────────────────────

export interface StateSyncMessage {
  type: 'state:sync';
  payload: {
    projects: Record<string, Project>;
    agents: Record<string, Agent>;
    baseDir: string;
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

export interface ValidationErrorMessage {
  type: 'validation:error';
  payload: {
    message: string;
    context: string;
  };
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

export interface LogMessage {
  type: 'log';
  payload: {
    entry: LogEntry;
  };
}

// ── Orchestration messages: Server → Client ───────────────────────────────

export interface OrchestrationPhaseMessage {
  type: 'orchestration:phase';
  payload: {
    projectId: string;
    phase: OrchestrationPhase;
    timestamp: number;
  };
}

export interface OrchestrationPlanReadyMessage {
  type: 'orchestration:plan-ready';
  payload: {
    projectId: string;
    tasks: PlanTask[];
    timestamp: number;
  };
}

export interface OrchestrationTaskUpdateMessage {
  type: 'orchestration:task-update';
  payload: {
    projectId: string;
    taskId: string;
    status: PlanTask['status'];
    assignedAgent: string | null;
    branch: string | null;
    timestamp: number;
  };
}

export interface OrchestrationWorkerSpawnedMessage {
  type: 'orchestration:worker-spawned';
  payload: {
    projectId: string;
    agentId: string;
    taskId: string;
    branch: string;
    timestamp: number;
  };
}

export interface OrchestrationMergeResultMessage {
  type: 'orchestration:merge-result';
  payload: {
    projectId: string;
    branch: string;
    taskId: string;
    success: boolean;
    message: string;
    timestamp: number;
  };
}

export type ServerMessage =
  | StateSyncMessage
  | AgentStatusMessage
  | FileEventMessage
  | BuildEventMessage
  | TaskCompletedMessage
  | FsChangeMessage
  | GitStatusMessage
  | ValidationErrorMessage
  | LogMessage
  | OrchestrationPhaseMessage
  | OrchestrationPlanReadyMessage
  | OrchestrationTaskUpdateMessage
  | OrchestrationWorkerSpawnedMessage
  | OrchestrationMergeResultMessage;
