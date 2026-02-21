# MISSION STATUS — ConstellationCommand

## Current Phase: Autonomous Orchestration (feature/autonomous-orchestration)
## Status: IN PROGRESS

## Recent Work (2026-02-21)

### Backend Orchestration Pipeline (server/)
- `server/Orchestrator.ts` — Coordinator → plan → workers → merger pipeline
- `server/AgentPrompts.ts` — Structured prompts for each agent role
- `server/WorktreeManager.ts` — Git worktree creation/cleanup for parallel agents
- `server/types.ts` — Server-side orchestration types

### Frontend Orchestration Wiring (src/)
- `src/types.ts` — AgentRole, OrchestrationPhase, PlanTask types + WS message types
- `src/stores/orchestrationStore.ts` — Zustand store for per-project orchestration state
- `src/hooks/useWebSocket.ts` — Handles orchestration WS messages + toasts
- `src/components/Planning/MissionPlanning.tsx` — INITIATE MISSION button, plan review, approve/reject
- `src/components/Console/AgentConsole.tsx` — Role badges (coordinator/worker/merger)
- `src/components/Planning/LaunchModal.tsx` — Role field for manual agents

### Smoke Test Suite
- `tests/smoke.spec.ts` — 12 fast tests (~1.5 min), all passing
- Covers: auth, navigation, project lifecycle, planning, modals, path security, system views

### Agent Team Profiles
- Rewrote all 5 agent profiles in `.claude/agents/` with accurate codebase context
- Created `.mcp.json` with Chrome DevTools MCP (headless, isolated, Chromium at /usr/bin/chromium)
- Rewrote `start-team.sh` with dev server window, --core/--kill/--no-server flags

## Agent Status
| Agent | Status | Notes |
|-------|--------|-------|
| claude-specialist | ACTIVE | Backend orchestration + team setup |
| frontend-effects | STANDBY | Profiles updated, ready for UI work |
| qa-integration | STANDBY | Profiles updated with Playwright context |
| security | STANDBY | Ready for security review |
| docs | STANDBY | CLAUDE.md updated |

## Cross-Agent Dependencies
- frontend-effects: Orchestration UI in MissionPlanning.tsx is functional but needs visual polish
- qa-integration: Smoke tests pass (12/12), full suite needs verification after orchestration changes
- security: Needs review of Orchestrator.ts, WorktreeManager.ts, and new WS message handlers in index.ts

## API Contracts

### Orchestration WebSocket Protocol
```
Client → Server:
  { type: 'orchestration:start', projectId, maxConcurrentWorkers? }
  { type: 'orchestration:approve-plan', projectId }
  { type: 'orchestration:abort', projectId }

Server → Client:
  { type: 'orchestration:phase', projectId, phase, timestamp }
  { type: 'orchestration:plan-ready', projectId, tasks: PlanTask[], timestamp }
  { type: 'orchestration:task-update', projectId, taskId, status, assignedAgent, branch, timestamp }
  { type: 'orchestration:worker-spawned', projectId, agentId, taskId, branch, timestamp }
  { type: 'orchestration:merge-result', projectId, branch, taskId, success, message, timestamp }
```

## Known Issues
- Full E2E suite (app.spec.ts, workflows.spec.ts) runs slow (30+ min) due to real Claude CLI sessions in agent tests
- Orchestration pipeline not yet tested end-to-end (needs live Claude sessions)
- All changes on feature/autonomous-orchestration branch are unstaged — no commits yet
