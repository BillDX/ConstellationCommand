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
