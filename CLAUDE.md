# ConstellationCommand

A gamified sci-fi mission control interface that wraps around Claude Code CLI sessions, making software development feel like commanding a starship.

## Architecture
- **Backend**: Node.js + Express + WebSocket server on a headless Debian box
- **Frontend**: React + TypeScript SPA served by the backend, accessed via browser
- **Terminal**: node-pty on server spawns Claude Code sessions; xterm.js on client renders them over WebSocket
- **State**: Zustand on client, synced via WebSocket events from server

## Theme
Vintage Star Trek / retro sci-fi tactical command interface. The user is a Starfleet-style commander. Projects are planets. Agents are orbiting moons. Everything looks like a starship bridge viewscreen.

## Key Commands
- `npm run dev` — Start both client (Vite HMR) and server (tsx watch)
- `npm run build` — Build for production
- `npm start` — Run production server
- `npm run test:e2e` — Run Playwright E2E test suite

## Testing
E2E tests use Playwright with system Chromium (`/usr/bin/chromium`). The test suite is in `tests/app.spec.ts` and covers all 5 views, navigation, modals, and UI elements (35 tests).

**Prerequisites**: Production build must exist in `dist/client/` (`npm run build` first). The test config auto-starts the Express server on port 3000.

**Running tests**:
- `npm run test:e2e` — Run all tests headless
- `npx playwright test --headed` — Run with browser visible
- `npx playwright test -g "Launch Modal"` — Run a specific test group

**Test coverage**:
- Page load & core layout (title, starfield, branding, stardate/clock, connection status)
- HUD sidebar navigation (5 nav items, view switching, collapse/expand)
- Tactical view (planet, scan sweep, action buttons)
- Incubator view (galaxy map, NEW PROJECT button, CreateProjectModal)
- Planning view (mission planning panel, task input, adding tasks)
- Logs view (log viewer, filter buttons, search)
- Status view (4-panel dashboard, system metrics)
- Launch modal (open, fields, disabled/enabled state, Cancel, ESC)
- Visual elements (CRT overlay, connection status indicator)

## File Structure
- `server/` — Node.js backend (Express, WebSocket, pty management)
- `src/` — React frontend (components, stores, hooks, theme)
- `src/components/Viewscreen/` — Main tactical display (starfield, planet, moons, HUD)
- `src/components/Console/` — Agent terminal panels
- `src/components/Incubator/` — Project galaxy map
- `src/components/Planning/` — Mission briefing / task planning
- `src/components/Logs/` — System log viewer

## Claude Code Integration
All Claude Code sessions are spawned with `--dangerously-skip-permissions` flag via node-pty. The OutputParser watches stdout for file creation, build events, errors, and completions, then emits structured events over WebSocket to the frontend.
