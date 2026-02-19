# ConstellationCommand

**A gamified sci-fi mission control interface for Claude Code.**

Turn your software development workflow into a starship command experience. Projects are planets. AI agents are orbiting moons. Your terminal is a bridge console.

## Quick Start

```bash
# Clone and install
git clone https://github.com/BillDX/ConstellationCommand.git
cd ConstellationCommand
npm install

# Development mode (Vite HMR + Express server)
npm run dev
# Open http://localhost:5173

# Production mode
npm run build
npm start
# Open http://localhost:3000
```

For a detailed walkthrough, see the **[Getting Started Guide](docs/GETTING_STARTED.md)**.

## Versions

### v0.1.0 — Core Feature Set (2026-02-19)

Stable milestone with the full foundational feature set in place.

**What's included:**
- LCARS viewscreen terminal with Star Trek bridge UI
- Planet palette system with deterministic color assignment per project
- Granular agent status detection (13 states: thinking, coding, executing, scanning, downloading, building, testing, waiting, paused, etc.)
- Activity-specific moon animations and colors
- Agent auto-submit via output-driven PTY task injection
- Password authentication with scrypt hashing
- WebSocket-based real-time state sync
- PTY-backed Claude Code CLI sessions with xterm.js rendering

**To restore this version:**
```bash
# Check out the tag (read-only detached HEAD)
git checkout v0.1.0

# Or create a branch from it to work from
git branch restore-point v0.1.0 && git checkout restore-point

# Or reset current branch back to it (destructive — discards later commits)
git reset --hard v0.1.0

# Compare current work against this milestone
git diff v0.1.0
```

---

## Features

- **Tactical Viewscreen** — Animated planet + orbiting moon visualization for projects and agents
- **Live Agent Terminals** — Real-time xterm.js consoles showing Claude Code conversations via WebSocket
- **Full Context Prompts** — Agents receive project name, description, and mission plan alongside their task
- **Mission Planning** — Task checklists with per-task launch or BEGIN MISSION to launch all at once
- **Project Incubator** — Galaxy map for creating and managing multiple projects
- **System Logs** — Filterable event feed with agent lifecycle, file, and build events
- **Ship Status Dashboard** — System metrics and health monitoring
- **Path Security** — Server-side directory sandboxing prevents agents from escaping project boundaries

## Architecture

```
Browser (React + TypeScript + Zustand)
    ↕ WebSocket
Server (Node.js + Express + node-pty)
    ↕ PTY
Claude Code CLI sessions
```

- **Backend**: Node.js + Express + WebSocket server
- **Frontend**: React + TypeScript SPA with Zustand state management
- **Terminal**: node-pty spawns Claude Code sessions; xterm.js renders them over WebSocket
- **Security**: All project directories auto-created under `~/.constellation-command/projects/`

## How It Works

1. **Create a project** — Give it a name and description; the server creates a sandboxed directory
2. **Plan your mission** — Add task directives in the Mission Planning view
3. **Launch agents** — Each agent spawns a Claude Code CLI session with your full project context
4. **Watch live** — The agent console auto-opens, showing the terminal in real-time
5. **Monitor events** — System Logs track file changes, builds, and agent lifecycle

## Running Tests

```bash
npm run build              # Build frontend (required)
npm run test:e2e           # Run all 64 Playwright E2E tests
npx playwright test --headed  # Run with visible browser
```

Test coverage: UI layout, navigation, project creation, mission planning, agent launch and communication, system logs, path security, multi-project workflows, and full lifecycle flows.

## Documentation

- **[Getting Started Guide](docs/GETTING_STARTED.md)** — Step-by-step walkthrough for creating and running projects
- **[CLAUDE.md](CLAUDE.md)** — Developer reference for contributors and Claude Code agents

## License

ISC
