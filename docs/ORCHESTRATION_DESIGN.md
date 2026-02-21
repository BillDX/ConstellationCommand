# Autonomous Orchestration Design

## Vision

Transform ConstellationCommand from a manual agent launcher into an autonomous orchestration system.

**Current flow:** User creates project → manually writes tasks → manually launches agents → manually monitors.

**New flow:** User provides project description → **Coordinator agent auto-generates a plan** → **Worker agents auto-spawn for each task** → **Merge agent handles code integration** → Coordinator monitors progress and drives to completion.

The user's job becomes: describe what you want, approve the plan, and watch the starship bridge run itself.

## Concept Mapping: multiclaude → ConstellationCommand

| multiclaude | ConstellationCommand | Notes |
|-------------|---------------------|-------|
| tmux sessions | node-pty sessions | We already have PTY management |
| tmux windows | Agent moons (visual) | Each agent = orbiting moon |
| Git worktrees | Git worktrees | **New** — need to add |
| Supervisor agent | **Coordinator agent** | Plans work, spawns workers, monitors |
| Merge-queue agent | **Merge agent** | Integrates completed branches |
| Worker agents | **Worker agents** | One task, one branch, one PR |
| Filesystem messages | **WebSocket messages** | Richer — real-time via our existing WS |
| CLI commands | Server-side orchestrator | Agents talk to our server, not a CLI |
| `state.json` | In-memory state + WS broadcast | Our existing Zustand sync |

## Architecture

```
User describes project
         │
         ▼
┌─────────────────────────────────────────────────────┐
│                   Orchestrator                       │
│   (server/Orchestrator.ts — the autonomous engine)   │
│                                                      │
│  1. Spawns COORDINATOR agent                         │
│  2. Parses plan from coordinator output              │
│  3. Creates git worktrees per worker                 │
│  4. Spawns WORKER agents (one per task)              │
│  5. Spawns MERGE agent                               │
│  6. Monitors completion, drives forward              │
└─────┬───────────┬──────────────┬────────────────────┘
      │           │              │
      ▼           ▼              ▼
 Coordinator    Workers       Merge Agent
 (plans work)  (do tasks)   (integrates code)
      │           │              │
      ▼           ▼              ▼
  PLAN.md     work/<name>    main branch
  (artifact)  (branches)     (merged results)
```

## Agent Roles

### Coordinator (`coordinator`)

**One per project.** The brain. Spawned automatically when a project enters orchestrated mode.

**Responsibilities:**
- Read project description and codebase
- Generate a structured plan (PLAN.md) with small, independent tasks
- Signal the server when the plan is ready (structured output marker)
- Monitor worker progress via status checks
- Reassign or retry failed tasks
- Declare project complete when all tasks pass

**Prompt strategy:** The coordinator gets the project description and is told to produce a plan in a specific parseable format. After the plan is extracted, the coordinator enters monitoring mode — periodically checking worker status and nudging stuck ones.

### Worker (`worker`)

**One per task.** The hands. Each worker gets:
- Its own git branch (`work/<agent-short-id>`)
- Its own git worktree (isolated copy of the repo)
- A single focused task from the plan
- Instructions to commit, push, and signal completion

**Prompt strategy:** Worker gets the task text, project context, and explicit instructions: do the task, commit to your branch, then signal done. Don't expand scope. Stay focused.

### Merge Agent (`merger`)

**One per project.** The integrator. Monitors for completed worker branches and merges them into main.

**Responsibilities:**
- Watch for worker completion signals
- Pull worker branches, check for conflicts
- Run tests if available
- Merge clean branches into main
- Report merge conflicts back to coordinator
- Keep main branch healthy

**Prompt strategy:** Merge agent monitors git state, checks worker branches, and performs merges. If conflicts arise, it either resolves them or reports back.

## New Server Components

### 1. `server/Orchestrator.ts`

The autonomous engine. Manages the lifecycle of an orchestrated project.

```typescript
interface OrchestrationConfig {
  projectId: string;
  projectName: string;
  description: string;
  cwd: string;
  maxConcurrentWorkers: number;  // default: 3
}

interface OrchestratedProject {
  config: OrchestrationConfig;
  coordinatorId: string | null;
  mergerId: string | null;
  workerIds: string[];
  plan: PlanTask[];
  phase: 'planning' | 'executing' | 'merging' | 'completed' | 'error';
}

interface PlanTask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'assigned' | 'in-progress' | 'completed' | 'failed';
  assignedAgent: string | null;
  branch: string | null;
  dependencies: string[];  // task IDs this depends on
}
```

**Key methods:**
- `startOrchestration(config)` — Kicks off the whole flow
- `onPlanReady(projectId, tasks)` — Called when coordinator's plan is parsed
- `spawnNextWorkers(projectId)` — Spawns workers for ready tasks (respects concurrency limit)
- `onWorkerComplete(agentId)` — Marks task done, triggers merge, spawns next worker
- `onMergeComplete(branch)` — Updates task status, checks if all done
- `checkProgress(projectId)` — Coordinator's periodic health check

### 2. `server/WorktreeManager.ts`

Git worktree lifecycle for isolated worker directories.

```typescript
interface Worktree {
  agentId: string;
  branch: string;
  path: string;
  createdAt: number;
}
```

**Key methods:**
- `createWorktree(projectCwd, agentId)` — Creates branch + worktree
- `removeWorktree(agentId)` — Cleans up on completion
- `listWorktrees(projectCwd)` — Active worktrees
- `getWorktreePath(agentId)` — Path for agent's isolated dir

### 3. `server/AgentPrompts.ts`

Prompt templates for each agent role. Each prompt includes:
- Role definition and rules
- Project context (name, description, plan)
- Communication protocol (how to signal status)
- Explicit constraints (scope, branch naming, etc.)

### 4. Extended `server/OutputParser.ts`

New patterns to detect:
- **Plan output markers** — Coordinator writes plan in structured format
- **Task completion signals** — Worker signals "TASK COMPLETE"
- **Merge status** — Merge agent reports success/conflict
- **Status requests** — Coordinator asking for worker updates

### 5. Extended `server/types.ts`

New types:
- `AgentRole: 'coordinator' | 'worker' | 'merger' | 'manual'`
- Orchestration-related WebSocket messages
- Plan/task structures

## Inter-Agent Communication

multiclaude uses filesystem JSON files polled every 2 minutes. We can do better.

**Our approach:** Server-mediated messaging over WebSocket.

```typescript
// Agent A's output is parsed for structured messages
// e.g., "MESSAGE:worker-abc:Check the auth module tests"
//
// Server extracts this message and:
// 1. Writes it to the target agent's PTY stdin
// 2. Broadcasts it on the events channel for UI display
// 3. Logs it in the system log

interface AgentMessage {
  id: string;
  from: string;      // agent ID
  to: string;        // agent ID or 'coordinator' or 'merger'
  body: string;
  timestamp: number;
  status: 'pending' | 'delivered' | 'acknowledged';
}
```

However, the simpler initial approach: **the server is the message bus**. Agents don't talk to each other directly. The Orchestrator decides what to tell each agent based on events:

- Worker completes → Orchestrator tells merge agent to check the branch
- Merge fails → Orchestrator tells coordinator about the conflict
- Coordinator wants status → Server provides it directly (no need to ask workers)

## Orchestration Flow (Detailed)

### Phase 1: Planning

```
User clicks "INITIATE MISSION" (new button, not manual "LAUNCH AGENT")
  → Server creates project directory (existing flow)
  → Orchestrator.startOrchestration() called
  → Coordinator agent spawned with project description
  → Coordinator analyzes codebase, writes PLAN.md
  → OutputParser detects plan markers in coordinator output
  → Orchestrator.onPlanReady() extracts tasks
  → Tasks appear in Planning view (auto-populated)
  → UI shows plan for user review
```

### Phase 2: Execution

```
User approves plan (or auto-approve mode)
  → Orchestrator.spawnNextWorkers() creates up to N workers
  → For each worker:
    → WorktreeManager creates isolated branch + worktree
    → Worker agent spawned in worktree directory
    → Worker receives task + project context
    → Worker works autonomously
    → On completion: OutputParser detects "TASK COMPLETE"
    → Orchestrator.onWorkerComplete() updates state
    → Next pending task gets a new worker
```

### Phase 3: Integration

```
Worker signals completion
  → Orchestrator tells merge agent: "Branch work/<id> is ready"
  → Merge agent pulls branch, checks for conflicts
  → Clean: merge into main, report success
  → Conflict: report to coordinator, coordinator decides action
  → Orchestrator updates task status
  → UI updates: moon color changes, activity feed shows merge
```

### Phase 4: Completion

```
All tasks completed + merged
  → Orchestrator marks project as 'completed'
  → Coordinator agent gets final summary
  → UI celebration effects (existing transporter/shield effects)
  → Project status updates in galaxy map
```

## UI Impact (Cross-Agent Dependencies)

Changes needed in frontend-effects agent's files:

1. **Planning view** — "INITIATE MISSION" button that triggers orchestration (not manual task entry)
2. **Tactical view** — Show coordinator moon as distinct (larger? different shape?)
3. **Tactical view** — Show merge agent moon as distinct
4. **HUD** — Orchestration phase indicator (PLANNING → EXECUTING → MERGING → COMPLETE)
5. **Activity feed** — Show orchestration events (plan ready, worker spawned, merge complete)
6. **Agent console** — Show agent role badge (COORDINATOR / WORKER / MERGER)

## Concurrency Model

- **Max concurrent workers:** Configurable, default 3. Prevents resource exhaustion.
- **Task dependencies:** Plan can specify that Task B depends on Task A. Workers for B don't spawn until A is merged.
- **Coordinator is long-lived:** Stays running throughout the project. Can be consulted.
- **Merge agent is long-lived:** Stays running, processes merges as they come.
- **Workers are ephemeral:** One task, then done. PTY cleaned up after completion.

## Implementation Phases

### Phase 1: Foundation (this PR)
- [ ] Agent roles in types (`coordinator`, `worker`, `merger`, `manual`)
- [ ] `server/AgentPrompts.ts` — Prompt templates
- [ ] `server/Orchestrator.ts` — Skeleton with state management
- [ ] `server/WorktreeManager.ts` — Git worktree operations
- [ ] Extended OutputParser for plan/completion detection
- [ ] New WebSocket messages for orchestration events
- [ ] Wire into `server/index.ts`

### Phase 2: Coordinator Flow
- [ ] Coordinator auto-spawns on project orchestration
- [ ] Plan parsing from coordinator output
- [ ] Tasks auto-populate in planning store
- [ ] Plan review/approval flow

### Phase 3: Worker Automation
- [ ] Automatic worker spawning from plan
- [ ] Worktree creation per worker
- [ ] Worker completion detection
- [ ] Concurrency limiting
- [ ] Next-task scheduling

### Phase 4: Merge Agent
- [ ] Merge agent auto-spawns
- [ ] Branch merge operations
- [ ] Conflict detection and reporting
- [ ] Main branch health monitoring

### Phase 5: Monitoring Loop
- [ ] Coordinator status checking
- [ ] Stuck worker detection
- [ ] Failed task retry
- [ ] Project completion detection

## Open Questions

1. **Plan format:** Should the coordinator write PLAN.md as markdown with a parseable structure, or should we use a more structured format (JSON in a code fence)?
2. **Git initialization:** Should the server auto-init a git repo in new project directories?
3. **Approval flow:** Should the user always approve the plan, or should there be an auto-approve mode?
4. **Worker naming:** multiclaude uses Docker-style names ("happy-platypus"). Fun but not informative. Should we use task-derived names?
5. **Merge strategy:** Squash merge (cleaner) or regular merge (preserves history)?
