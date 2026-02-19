# ConstellationCommand

Gamified sci-fi mission control interface wrapping Claude Code CLI sessions. Projects are planets, agents are orbiting moons, UI is a retro Star Trek bridge viewscreen.

## Development Philosophy

- **Incremental changes over sweeping rewrites.** Small, focused commits. Each commit does one thing.
- **Test-driven.** Write or update tests before implementing features. Never skip tests to move faster.
- **Minimal dependencies.** Do not add libraries without explicit approval. Justify any new dependency.
- **Security-first.** Treat all user input as hostile. Never disable auth, validation, or path checks for convenience.
- **Explicit over clever.** No magic or metaprogramming unless genuinely warranted.

## Code Standards

- TypeScript strict mode. Type all function signatures and component props.
- Functions and components do one thing. If a description needs "and," split it.
- Keep modules focused, imports clean. No circular dependencies.
- No dead code, no commented-out blocks, no TODOs without linked issues.
- Prefer the platform: native Node.js APIs, standard React patterns, Zustand conventions.

## Testing

Run the full test suite before every commit. Do not commit with failing tests.

**When fixing a bug, write a failing test first that reproduces it.**

- **E2E tests** (Playwright, system Chromium at `/usr/bin/chromium`):
  - `tests/app.spec.ts` — Core UI (40 tests): layout, navigation, modals, views
  - `tests/workflows.spec.ts` — Workflows (24 tests): project lifecycle, planning, agent launch, communication
  - `tests/auth.spec.ts` — Authentication
- **Prerequisites**: `npm run build` first (production build in `dist/client/`). Test config auto-starts Express on :3000.
- **Commands**:
  - `npm run test:e2e` — All tests headless
  - `npx playwright test --headed` — With browser visible
  - `npx playwright test -g "pattern"` — Specific test group

## Git Workflow

- Commit early and often. Small, atomic commits with clear messages.
- Imperative mood: `Add rate limiting to login endpoint`, not `Added rate limiting`.
- Do not bundle unrelated changes in one commit.
- Do not refactor unrelated code while implementing a feature.

## When Making Changes

1. Read the relevant code and tests. Understand current behavior first.
2. Write or update tests for the desired behavior.
3. Implement the smallest change that makes the tests pass.
4. Run the full test suite (`npm run test:e2e`).
5. Verify manually in the browser that the user flow works.
6. Commit with a clear message.

## What Not To Do

- Do not add "nice to have" libraries or tools without discussion.
- Do not skip browser testing because unit tests pass.
- Do not make large, multi-concern pull requests.
- Do not write to paths outside the project or dev environment.
- Do not disable security features (path validation, auth, CSRF) for convenience.

## Architecture

- **Backend**: Node.js + Express + WebSocket (`ws`) on port 3000
- **Frontend**: React 19 + TypeScript SPA (Vite on :5173 in dev, served by Express in prod)
- **Terminal**: node-pty spawns Claude Code sessions server-side; xterm.js renders over WebSocket
- **State**: Zustand stores on client, synced via WebSocket events from server
- **Security**: Server-side path validation; all project dirs under `~/.constellation-command/projects/`

## Key Commands

- `npm run dev` — Client (Vite HMR :5173) + server (tsx watch :3000) concurrently
- `npm run build` — Build frontend into `dist/client/`
- `npm start` — Production server on :3000
- `npm run test:e2e` — Playwright E2E suite

## File Structure

- `server/index.ts` — Express app, WebSocket routing, event broadcast
- `server/SessionManager.ts` — PTY lifecycle, agent sessions
- `server/OutputParser.ts` — Regex event extraction from Claude stdout
- `server/pathSecurity.ts` — Path validation, slug sanitization
- `server/FileWatcher.ts` — chokidar file system watcher
- `server/GitMonitor.ts` — Git status polling
- `src/components/Viewscreen/` — Tactical display (starfield, planet, moons, HUD, effects)
- `src/components/Console/` — Agent terminal panels (xterm.js, activity feed)
- `src/components/Planning/` — Mission briefing, task planning, LaunchModal
- `src/components/Incubator/` — Galaxy map, CreateProjectModal
- `src/components/Logs/` — System log viewer
- `src/components/Status/` — Ship status dashboard
- `src/stores/` — Zustand stores (project, agent, UI, auth, flow, planning, log)
- `src/hooks/useWebSocket.ts` — WebSocket connection and message handling
- `tests/` — Playwright E2E tests

## WebSocket Protocol

- `/ws/events` — Broadcast channel (state sync, agent status, file events, logs)
- `/ws/terminal/:agentId` — Raw terminal I/O for a specific agent session

## Claude Code Integration

Sessions spawned via node-pty with `--dangerously-skip-permissions`. The `CLAUDECODE` env var is stripped to prevent nested-session errors.

**Prompt flow**: Launch sends full project context (name, description, all tasks with status, specific directive) to stdin after 1s boot delay. OutputParser watches stdout for file/build/error/completion events and broadcasts them over WebSocket.

**Launch flows**:
- **Launch Modal** (tactical view) — Free-form task directive
- **Per-task LAUNCH** (mission planning) — Single task from plan
- **BEGIN MISSION** — All uncompleted tasks simultaneously

All launches auto-navigate to tactical view and auto-open agent console.

## Path Security

All project directories auto-created under `~/.constellation-command/projects/<slug>/`. Server validates all CWD parameters via `fs.realpath` + prefix check before PTY spawn, file watch, or git monitor. No user-editable path fields exist in the UI.
