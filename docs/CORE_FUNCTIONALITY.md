# Core Functionality

ConstellationCommand is a multi-agent orchestration platform that manages Claude Code CLI sessions for collaborative software development.

## What It Does

The application provides:

1. **Project Management** — Create sandboxed directories for code work. Each project is isolated under `~/.constellation-command/projects/<slug>/` with server-side path validation.

2. **Agent Sessions** — Launch Claude Code CLI instances as independent agents. Each agent is a pseudo-terminal (PTY) session spawned server-side and rendered to the browser via xterm.js over WebSocket.

3. **Task Execution** — Define tasks (text directives) that agents execute. Tasks receive full project context (name, description, all pending tasks) via stdin at launch. Agents work synchronously with each other or sequentially in git worktrees.

4. **Multi-Agent Orchestration** — Coordinate multiple agents for complex projects:
   - **Manual mode**: Launch agents ad-hoc with custom directives
   - **Coordinated mode**: One agent (coordinator) analyzes the project and generates a plan, then spawns worker agents on separate git branches. A merger agent combines results back to main.

5. **Real-Time Monitoring** — Watch agent activity in real time. The system detects granular states (thinking, coding, executing, building, testing, waiting) via stdout parsing and broadcasts status updates over WebSocket. System logs track file changes, build events, and agent lifecycle.

## How It Works

### Architecture

```
Browser (React UI)
  ↓ WebSocket
Express Server (Node.js)
  ↓ PTY
Claude Code CLI Sessions (agents)
```

**Backend**: Express.js + WebSocket server on port 3000. Manages PTY lifecycle, state synchronization, file watching, and orchestration.

**Frontend**: React 19 SPA with Zustand state stores. Renders agent terminals, project views, task planning, and orchestration status.

**Session Management**: `node-pty` spawns Claude Code with `--dangerously-skip-permissions`. `SessionManager` handles lifecycle. `OutputParser` watches stdout for events (file creation, builds, errors) and broadcasts them over WebSocket.

**State Sync**: Server publishes state changes (agent status, projects, logs) over `/ws/events`. Client stores sync via Zustand. Terminal I/O flows over `/ws/terminal/:agentId`.

### Agents

Each agent has:
- **Role**: `manual` (free-form), `coordinator` (planner), `worker` (task executor), `merger` (branch combiner)
- **Status**: queued → launching → active/thinking/coding/executing/building/testing → completed/error
- **Context**: Project name, description, task directive, working directory
- **Task**: Text directive defining what to work on
- **Event Log**: File changes, build status, completion events

### Task Lifecycle

A task is a text directive. Execution paths:

1. **Manual Launch** — User enters a task directive in the UI. Server spawns an agent, pipes the directive + context to stdin, agent works interactively. Stays active until user terminates or agent completes.

2. **Per-Task Launch** — User approves a task from a plan. Server spawns an agent for that task only.

3. **BEGIN MISSION** — All incomplete tasks launch simultaneously, one agent per task. Each agent gets its assigned task. When one completes, user can launch the next batch.

4. **INITIATE MISSION** (Orchestration) — Fully autonomous:
   - Coordinator agent boots, analyzes the project and pending tasks, generates a detailed multi-task plan
   - User reviews and approves the plan
   - Server spawns worker agents, one per task, each on a separate git worktree branch
   - Workers execute in parallel (respecting dependencies)
   - Merger agent combines all branches back to main
   - Orchestration completes with merged code

## User Flows

### Flow 1: Create Project & Manual Launch

1. User opens Incubator (galaxy map)
2. Clicks "Create Project" → enters name and description
3. Server creates project directory, assigns deterministic color palette
4. User navigates to Tactical View (planet + orbiting agent windows)
5. Clicks "Launch Agent" → enters task directive
6. Agent spawns with full context (project name, description, task) in stdin
7. Terminal opens, showing live output in real time
8. User watches agent work or sends additional input
9. When done, user can launch another agent for the next task

### Flow 2: Plan & Mission Launch

1. User navigates to Planning view for a project
2. Clicks "Add Task" → enters task title and description
3. Repeats to build task checklist
4. Clicks "BEGIN MISSION" → all incomplete tasks launch simultaneously
5. Each task gets its own agent window on the Tactical View
6. Agents work in parallel on the same directory
7. Completed tasks are marked done
8. User can launch remaining tasks when ready

### Flow 3: Autonomous Orchestration

1. User navigates to Planning view
2. Clicks "INITIATE MISSION" → orchestration begins
3. Coordinator agent spawns, generates a multi-task plan considering dependencies
4. System displays plan for user review
5. User clicks "Approve Plan"
6. Worker agents spawn (one per task) on separate git branches
7. Workers execute tasks in parallel (or sequentially per dependencies)
8. Merger agent watches for completion, combines branches to main
9. Orchestration completes, all code merged, task statuses updated

### Flow 4: Monitor & Logs

At any time:
- **Tactical View**: See all active agents and their current status icons
- **Console**: Click an agent window to view full terminal output
- **Logs**: System log shows all events (file created, build started, agent completed) with timestamps
- **Status Dashboard**: Project health, file change count, git status, build/test results

### Flow 5: Security & Multi-Project

- User can create multiple projects
- Each project is isolated to its own directory
- Server validates all paths via `fs.realpath` + prefix check before PTY spawn
- Agents cannot escape project boundaries
- Multiple projects can run simultaneously with independent agents
