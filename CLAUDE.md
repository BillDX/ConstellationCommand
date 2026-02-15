# ConstellationCommand

A gamified sci-fi mission control interface that wraps around Claude Code CLI sessions, making software development feel like commanding a starship.

## Architecture
- **Backend**: Node.js + Express + WebSocket server on a headless Debian box
- **Frontend**: React + TypeScript SPA served by the backend, accessed via browser
- **Terminal**: node-pty on server spawns Claude Code sessions; xterm.js on client renders them over WebSocket
- **State**: Zustand on client, synced via WebSocket events from server
- **Security**: Server-side path validation — all project directories auto-created under `~/.constellation-command/projects/`

## Theme
Vintage Star Trek / retro sci-fi tactical command interface. The user is a Starfleet-style commander. Projects are planets. Agents are orbiting moons. Everything looks like a starship bridge viewscreen.

## Key Commands
- `npm run dev` — Start both client (Vite HMR on :5173) and server (tsx watch on :3000)
- `npm run build` — Build frontend for production into `dist/client/`
- `npm start` — Run production server (serves built frontend + API on :3000)
- `npm run test:e2e` — Run Playwright E2E test suite (64 tests)

## Testing
E2E tests use Playwright with system Chromium (`/usr/bin/chromium`). Test suites:
- `tests/app.spec.ts` — Core UI tests (40 tests): layout, navigation, modals, views
- `tests/workflows.spec.ts` — Workflow tests (24 tests): project lifecycle, planning, agent launch, communication, security

**Prerequisites**: Production build must exist in `dist/client/` (`npm run build` first). The test config auto-starts the Express server on port 3000.

**Running tests**:
- `npm run test:e2e` — Run all tests headless
- `npx playwright test --headed` — Run with browser visible
- `npx playwright test -g "Agent Communication"` — Run a specific test group

**Test coverage**:
- Page load & core layout (title, starfield, branding, stardate/clock, connection status)
- Welcome flow (overlay, BEGIN NEW MISSION)
- HUD sidebar navigation (5 nav items, view switching, collapse/expand)
- Tactical view (planet, scan sweep, action buttons, empty state)
- Incubator view (galaxy map, NEW PROJECT button, CreateProjectModal)
- Project creation (toast, planning navigation, directory preview, slug sanitization)
- Planning view (mission planning panel, task input, adding tasks, Enter key, persistence)
- Agent launch (modal fields, CWD read-only, auto-navigate, console auto-open)
- Agent communication (terminal connection, task display, activity feed, terminate, close)
- System logs (log viewer, filter buttons, search, agent launch log entries)
- Status view (4-panel dashboard, system metrics)
- Launch modal (open, fields, disabled/enabled state, Cancel, ESC)
- Path security (no editable CWD in any modal)
- Multi-project workflows
- Full welcome-to-project lifecycle

## File Structure
- `server/` — Node.js backend (Express, WebSocket, pty management)
  - `server/index.ts` — Main server, WebSocket routing, message dispatch
  - `server/SessionManager.ts` — PTY lifecycle, agent session management
  - `server/OutputParser.ts` — Regex-based event extraction from Claude stdout
  - `server/pathSecurity.ts` — Path validation, directory creation, slug sanitization
  - `server/FileWatcher.ts` — chokidar-based file system change watcher
  - `server/GitMonitor.ts` — Git status polling
  - `server/types.ts` — Server-side TypeScript types
- `src/` — React frontend
  - `src/components/Viewscreen/` — Main tactical display (starfield, planet, moons, HUD)
  - `src/components/Console/` — Agent terminal panels (xterm.js, activity feed)
  - `src/components/Incubator/` — Project galaxy map, CreateProjectModal
  - `src/components/Planning/` — Mission briefing, task planning, LaunchModal
  - `src/components/Logs/` — System log viewer
  - `src/components/Status/` — Ship status dashboard
  - `src/components/Welcome/` — First-run welcome overlay
  - `src/components/Feedback/` — Toasts, agent status strip
  - `src/stores/` — Zustand stores (project, agent, UI, flow, planning, log)
  - `src/hooks/useWebSocket.ts` — WebSocket connection, message wrapping/unwrapping
  - `src/utils/generateId.ts` — Secure-context-safe UUID generation
  - `src/types.ts` — Client-side TypeScript types
- `tests/` — Playwright E2E tests

## WebSocket Protocol
Two WebSocket routes:
- `/ws/events` — Event broadcast channel (state sync, agent status, file events, logs)
- `/ws/terminal/:agentId` — Raw terminal I/O for a specific agent session

## Claude Code Integration
All Claude Code sessions are spawned with `--dangerously-skip-permissions` flag via node-pty. The task prompt is written to stdin after a 1-second boot delay. The OutputParser watches stdout for file creation, build events, errors, and completions, then emits structured events over WebSocket to the frontend. Lifecycle events (spawn, first output, task sent, exit) are broadcast as log entries to the System Logs view.

## Path Security
All project directories are auto-created under `~/.constellation-command/projects/<slug>/`. The server:
- Generates directory paths from project names (slugified, collision-avoided)
- Validates all CWD parameters before PTY spawn, file watch, or git monitor
- Blocks directory traversal attacks via `fs.realpath` + prefix check
- No user-editable path fields exist in the UI
