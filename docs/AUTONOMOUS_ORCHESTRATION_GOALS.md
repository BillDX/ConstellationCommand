# Autonomous Orchestration: Functional Goals

Branch: `feature/autonomous-orchestration`

## What This Branch Does

This branch transforms ConstellationCommand from a tool where you manually launch and manage Claude Code agents into one where you describe a project and the system builds it for you. Inspired by [multiclaude](https://github.com/dlorenc/multiclaude).

## The User Experience Today (main branch)

1. User creates a project (planet) with a name and description
2. User manually writes tasks in the planning view
3. User manually launches agents one at a time (or all at once)
4. User manually monitors each agent's terminal and progress
5. User manually checks if the code works

Every step requires user action. The system is a glorified multi-tab terminal.

## The User Experience After This Branch

1. User creates a project with a name and description
2. User clicks **INITIATE MISSION**
3. A coordinator agent analyzes the project and generates a plan
4. User reviews the plan and clicks **APPROVE**
5. Worker agents auto-spawn for each task, working in isolated git branches
6. A merge agent integrates completed work into main
7. The system drives itself to completion

The user's role shifts from operator to commander: describe the mission, approve the plan, watch the bridge.

## Functional Goals

### Goal 1: Automated Plan Generation

**When** a user initiates orchestration on a project,
**then** a coordinator agent spawns, analyzes the project, and produces a structured plan with 3-10 small, focused tasks.

- The coordinator examines the project directory, understands existing code, and breaks the project description into concrete tasks
- Each task is sized for a single agent session
- Tasks have explicit dependency ordering (task B depends on task A completing first)
- The plan is output in a machine-parseable format (`===PLAN_START===` / `===PLAN_END===` markers)
- The server extracts tasks from the coordinator's terminal output without disrupting the raw stream

**Status:** Server-side implemented. `AgentPrompts.buildCoordinatorPrompt()` provides the prompt, `parsePlanFromOutput()` extracts the structured plan, `Orchestrator.checkCoordinatorOutput()` detects and processes it.

### Goal 2: Plan Review and Approval

**When** the coordinator produces a plan,
**then** the system presents it to the user for review before any execution begins.

- Orchestration enters the `reviewing` phase
- The plan (task titles, descriptions, dependencies) is broadcast to all connected clients via `orchestration:plan-ready`
- The user can approve the plan to begin execution, or abort
- No workers spawn until the user approves (no auto-approve by default)

**Status:** Server-side implemented. `Orchestrator.approvePlan()` and `abortOrchestration()` handle user decisions. Frontend plan review UI not yet built (cross-agent dependency).

### Goal 3: Isolated Worker Execution

**When** a plan is approved,
**then** worker agents auto-spawn for each ready task, each working in an isolated git branch and worktree.

- Each worker gets its own git branch (`work/<agent-short-id>`) and git worktree (a separate directory)
- Workers cannot interfere with each other's file changes
- Workers receive a focused prompt: their specific task, project context, and instructions to stay scoped
- Workers commit to their branch and signal completion (`===TASK_COMPLETE===`)
- Workers are ephemeral: one task, then the PTY is cleaned up

**Status:** Server-side implemented. `WorktreeManager.createWorktree()` handles git worktree lifecycle, `AgentPrompts.buildWorkerPrompt()` provides scoped prompts, `Orchestrator.spawnWorker()` manages spawn.

### Goal 4: Concurrency Control

**When** multiple tasks are ready to execute,
**then** the system respects a configurable concurrency limit and task dependency ordering.

- Maximum concurrent workers defaults to 3 (configurable per project)
- Tasks with unfinished dependencies wait until those dependencies complete
- As workers finish, new workers auto-spawn for the next ready tasks
- The system continuously fills available worker slots from the ready queue

**Status:** Server-side implemented. `Orchestrator.spawnNextWorkers()` enforces concurrency limits and dependency checks.

### Goal 5: Automated Code Integration

**When** a worker signals task completion,
**then** a merge agent integrates the worker's branch into main.

- A single merge agent per project handles all branch integrations
- The merge agent receives instructions via its terminal stdin when branches are ready
- It performs: checkout main, pull latest, merge branch, run tests (if available), push
- On success: signals `===MERGE_SUCCESS===` with the branch name
- On conflict: attempts simple resolution, or aborts and signals `===MERGE_CONFLICT===`
- Merge conflicts are reported back and the task is marked failed for retry

**Status:** Server-side implemented. `AgentPrompts.buildMergerPrompt()` and `buildMergeInstruction()` provide prompts, `Orchestrator.checkMergerOutput()` processes results.

### Goal 6: Orchestration Lifecycle

**When** orchestration is running,
**then** the system tracks and broadcasts the overall project phase.

Phases:
- `initializing` - Coordinator is being spawned
- `planning` - Coordinator is analyzing and creating the plan
- `reviewing` - Plan is ready, waiting for user approval
- `executing` - Workers are active, merge agent is integrating
- `completing` - All tasks done, final merges in progress
- `completed` - Project finished successfully
- `error` - Orchestration failed (coordinator died without plan, unrecoverable state)

Each phase change is broadcast to all clients via `orchestration:phase`.

**Status:** Server-side implemented. Phase transitions are managed by `Orchestrator.setPhase()`.

### Goal 7: Completion Detection

**When** all tasks in the plan are completed (or failed with no active workers),
**then** the system detects this and marks the project complete.

- All tasks completed successfully: project enters `completed` phase, merge agent is killed
- Some tasks failed with no active workers: orchestration stalls (user can retry or abort)
- The coordinator, merger, and all worker PTYs are cleaned up
- Git worktrees are removed after worker completion (branches are preserved for the merger)

**Status:** Server-side implemented. `Orchestrator.checkCompletion()` handles detection.

### Goal 8: Abort Capability

**When** the user aborts orchestration,
**then** all agents are killed and resources are cleaned up.

- All agent PTYs (coordinator, merger, workers) are terminated
- All git worktrees are removed
- Orchestration state is cleared
- The project returns to a normal (non-orchestrated) state

**Status:** Server-side implemented. `Orchestrator.abortOrchestration()`.

### Goal 9: Backward Compatibility

**When** a user launches agents the old way (manual launch from tactical view or planning view),
**then** everything works exactly as before.

- All existing agent launch flows use `role: 'manual'` by default
- Manual agents have no orchestration overhead
- The `Agent` type is extended with optional `role`, `planTaskId`, and `branch` fields
- No frontend changes are required for existing functionality to work

**Status:** Implemented. All new fields are additive/optional.

## What's Not Built Yet

These are identified next steps, not in scope for the initial server-side implementation:

### Frontend Integration (cross-agent dependency)
- "INITIATE MISSION" button in the planning or tactical view
- Plan review screen showing extracted tasks with approve/abort buttons
- Orchestration phase indicator in the HUD
- Agent role badges (COORDINATOR / WORKER / MERGER) in the console
- Orchestration events in the activity feed
- Worker branch/task status indicators on agent moons

### Extended Features (future)
- Auto-approve mode (skip the review step)
- Failed task retry (re-spawn a worker for a failed task)
- Coordinator monitoring mode (coordinator stays alive to check on workers)
- Worker-to-coordinator status reporting
- Project-level test runner (run full test suite after all merges)
- Merge queue ordering strategy (merge in dependency order vs. completion order)

## WebSocket Protocol Additions

### Client to Server
| Message | Payload | Effect |
|---------|---------|--------|
| `orchestration:start` | `{ projectId, maxConcurrentWorkers? }` | Begin orchestration, spawn coordinator |
| `orchestration:approve-plan` | `{ projectId }` | Approve the plan, start execution |
| `orchestration:abort` | `{ projectId }` | Kill all agents, clean up |

### Server to Client
| Message | Payload | When |
|---------|---------|------|
| `orchestration:phase` | `{ projectId, phase }` | Phase changes |
| `orchestration:plan-ready` | `{ projectId, tasks[] }` | Coordinator produced a plan |
| `orchestration:task-update` | `{ projectId, taskId, status, assignedAgent, branch }` | Task status changes |
| `orchestration:worker-spawned` | `{ projectId, agentId, taskId, branch }` | New worker launched |
| `orchestration:merge-result` | `{ projectId, branch, taskId, success, message }` | Merge completed or failed |

## New Server Files

| File | Purpose |
|------|---------|
| `server/Orchestrator.ts` | Autonomous engine: lifecycle, spawning, completion detection |
| `server/AgentPrompts.ts` | Prompt templates for coordinator, worker, merger; output parsers |
| `server/WorktreeManager.ts` | Git worktree creation, cleanup, branch management |

## Modified Server Files

| File | Change |
|------|--------|
| `server/types.ts` | Added `AgentRole`, `OrchestrationPhase`, `PlanTask`, `OrchestratedProject`; extended `Agent` and `Project`; added 8 new WebSocket message types |
| `server/SessionManager.ts` | Added `role` to session tracking; emits `agent:output` and `agent:exit` events for orchestrator |
| `server/index.ts` | Wires orchestrator into the server; handles new message types; routes agent output/exit to orchestrator |
