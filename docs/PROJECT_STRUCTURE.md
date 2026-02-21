# ConstellationCommand — Project Structure

**14,200+ lines of TypeScript/React/CSS across 65 source files.**

```
ConstellationCommand/
├── server/                          # Node.js backend (Express + WebSocket + node-pty)
│   ├── index.ts                     # Express app, WebSocket routing, state, message dispatch
│   ├── SessionManager.ts            # PTY lifecycle: spawn, kill, resize, output buffering
│   ├── OutputParser.ts              # Regex engine: parses Claude Code stdout into structured events
│   ├── types.ts                     # Shared types: Agent, Project, all WS message schemas
│   ├── auth.ts                      # Password auth (scrypt), sessions, rate limiting, security headers
│   ├── pathSecurity.ts              # Sandboxed project dirs, path validation, slug sanitization
│   ├── FileWatcher.ts               # chokidar wrapper: watches project dirs for fs changes
│   └── GitMonitor.ts                # Polls `git status`/`git diff --stat` per project
│
├── src/                             # React frontend (TypeScript SPA)
│   ├── main.tsx                     # React entry point
│   ├── App.tsx                      # Root layout: sidebar nav, view router, WS connection, overlays
│   ├── types.ts                     # Client-side types: Agent, Project, WS message shapes
│   │
│   ├── components/
│   │   ├── Viewscreen/              # Tactical display — the main "bridge viewscreen"
│   │   │   ├── ViewscreenTerminal.tsx   # LCARS-framed viewscreen with embedded terminal
│   │   │   ├── Planet.tsx               # Animated planet (SVG gradients, palette-driven)
│   │   │   ├── Moon.tsx                 # Orbiting moon per agent (status-colored, animated)
│   │   │   ├── OrbitalField.tsx         # Positions moons in orbit around planet
│   │   │   ├── HUD.tsx                  # Heads-up display: project info, bottom bar, controls
│   │   │   ├── Starfield.tsx            # Animated star background (canvas)
│   │   │   ├── HoloTooltip.tsx          # Hover tooltip for moons
│   │   │   ├── ScanlineOverlay.tsx      # CRT scan-line texture effect
│   │   │   ├── ScanSweep.tsx            # Radar-style scanning animation
│   │   │   ├── ShieldEffect.tsx         # Shield activation visual
│   │   │   ├── TransporterEffect.tsx    # Agent beam-in/beam-out animation
│   │   │   ├── WarpEffect.tsx           # View transition warp animation
│   │   │   ├── AmbientParticles.tsx     # Floating particle effects
│   │   │   └── EmptyTactical.tsx        # Placeholder when no project selected
│   │   │
│   │   ├── Console/                 # Agent terminal panel
│   │   │   ├── AgentConsole.tsx         # Slide-in panel: header, terminal, activity, controls
│   │   │   ├── TerminalContainer.tsx    # xterm.js instance + WebSocket attachment
│   │   │   └── ActivityFeed.tsx         # Parsed event stream sidebar (files, builds, tasks)
│   │   │
│   │   ├── Planning/                # Mission planning views
│   │   │   ├── MissionPlanning.tsx      # Task list editor, per-task launch, BEGIN MISSION
│   │   │   └── LaunchModal.tsx          # Agent launch dialog (task input, project context)
│   │   │
│   │   ├── Incubator/               # Project creation / galaxy map
│   │   │   ├── GalaxyMap.tsx            # Multi-project overview with planet cards
│   │   │   └── CreateProjectModal.tsx   # New project form (name, desc, directory preview)
│   │   │
│   │   ├── Logs/
│   │   │   └── SystemLogs.tsx           # Filterable log viewer (level, source, agent)
│   │   │
│   │   ├── Status/
│   │   │   └── StatusView.tsx           # Ship systems dashboard (sessions, connections, etc.)
│   │   │
│   │   ├── Auth/
│   │   │   └── LoginOverlay.tsx         # Password setup / login screen
│   │   │
│   │   ├── Feedback/
│   │   │   ├── ToastContainer.tsx       # Notification toasts (success, error, info)
│   │   │   └── AgentStatusStrip.tsx     # Status indicator strip for agents
│   │   │
│   │   └── Welcome/
│   │       └── WelcomeOverlay.tsx       # First-run "BEGIN NEW MISSION" overlay
│   │
│   ├── hooks/
│   │   ├── useWebSocket.ts          # WS connection, reconnect, message dispatch to stores
│   │   └── useStardate.ts           # Star Trek stardate formatter
│   │
│   ├── stores/                      # Zustand state management
│   │   ├── agentStore.ts            # Agent records, selection, events
│   │   ├── projectStore.ts          # Project records, active project, base dir
│   │   ├── authStore.ts             # Auth token, login state
│   │   ├── flowStore.ts             # Toasts, UI flow state
│   │   ├── planningStore.ts         # Task lists per project
│   │   ├── logStore.ts              # System log entries
│   │   └── uiStore.ts              # View state, modal visibility
│   │
│   ├── utils/
│   │   └── generateId.ts            # UUID generation (crypto.randomUUID with fallback)
│   │
│   └── theme/
│       ├── global.css               # CSS variables, fonts, base styles
│       └── animations.css           # Keyframe animations (pulse, glow, warp, fade, etc.)
│
├── tests/                           # Playwright E2E tests
│   ├── app.spec.ts                  # Core UI tests (40): layout, nav, modals, views
│   ├── workflows.spec.ts            # Workflow tests (24): project lifecycle, planning, agents
│   └── auth.spec.ts                 # Auth tests: login, setup, session
│
├── docs/
│   ├── GETTING_STARTED.md           # User-facing walkthrough
│   └── PROJECT_STRUCTURE.md         # This file
│
├── .claude/agents/                  # Claude Code agent definitions
│   ├── claude-specialist.md         # PTY/WebSocket/terminal integration
│   ├── frontend-effects.md          # Visual effects and UI polish
│   ├── qa-integration.md            # Testing and quality assurance
│   ├── docs.md                      # Documentation
│   └── security.md                  # Security review
│
├── index.html                       # Vite HTML entry point
├── vite.config.ts                   # Vite config: proxy, build output, aliases
├── tsconfig.json                    # Frontend TypeScript config
├── tsconfig.server.json             # Server TypeScript config
├── playwright.config.ts             # Playwright test configuration
├── package.json                     # Dependencies and scripts
├── CLAUDE.md                        # Developer instructions for Claude Code agents
├── MISSION_STATUS.md                # Multi-agent coordination status board
└── README.md                        # Project overview and quick start
```

---

## Major File Summaries

### Server (`server/`)

| File | Lines | Purpose |
|------|-------|---------|
| **index.ts** | 508 | Express app with auth routes, WebSocket upgrade handling (`/ws/events` for broadcast, `/ws/terminal/:agentId` for raw PTY I/O), state management (in-memory projects/agents records), and client message dispatch. Wires up SessionManager, FileWatcher, GitMonitor, and OutputParser events into broadcast messages. |
| **SessionManager.ts** | 296 | Manages node-pty processes. `launchAgent()` spawns `claude --dangerously-skip-permissions`, waits for first output, then sends the task text + Enter. Buffers output (256KB per session) for replay when terminal clients connect late. Tracks terminal WebSocket clients per agent. Emits status transitions and log events. |
| **OutputParser.ts** | 327 | Two-tier regex engine fed raw PTY stdout. **Tier 1**: Structural event detection (file created/edited, build started/succeeded/error, task completed). **Tier 2**: Agent activity state machine with 13 states — checks idle patterns first (turn completion, cost summary, bare prompt), then activity patterns (thinking, coding, executing, scanning, downloading, building, testing). Includes idle timeout (8s) and activity decay (12s) timers. |
| **types.ts** | 229 | All shared types. `AgentStatus` (13 states), `Agent`, `Project`, full WebSocket protocol (10 client message types, 10 server message types including `state:sync`, `agent:status`, file/build/task events, `validation:error`, `log`). |
| **auth.ts** | 207 | `AuthManager` singleton: scrypt password hashing, session tokens (24h TTL), rate limiting (5 attempts / 15min window). `CC_PASSWORD` env var for headless setup. Security headers middleware (CSP, X-Frame-Options, etc.). |
| **pathSecurity.ts** | 88 | All project directories sandboxed under `~/.constellation-command/projects/`. Slug sanitization, collision-avoiding directory creation, `realpath`-based validation for both project and agent CWDs. |
| **FileWatcher.ts** | 80 | chokidar wrapper. Watches project directories (ignoring node_modules, .git, dist), emits `fs:change` events with add/change/unlink type. |
| **GitMonitor.ts** | 114 | Polls `git status --porcelain` and `git diff --stat` every 10s per project. Emits parsed file changes and diff summaries. |

### Frontend Components (`src/components/`)

| File | Lines | Purpose |
|------|-------|---------|
| **Viewscreen/ViewscreenTerminal.tsx** | 710 | Main tactical display. LCARS-style frame with embedded starfield, planet, orbital moons, HUD overlay, and scan effects. Renders the "bridge viewscreen" — the primary view when a project is active. |
| **Viewscreen/Planet.tsx** | 619 | SVG planet with palette-driven gradients, atmosphere glow, surface features, and rotation animation. Each project gets a deterministic color palette. |
| **Viewscreen/Moon.tsx** | 450 | Orbiting moon per agent. Color and animation driven by agent status (pulsing green for active, spinning for coding, flickering red for error, etc.). Click opens agent console. |
| **Viewscreen/HUD.tsx** | 622 | Heads-up display overlay: project name/description at top, navigation sidebar, bottom bar with LAUNCH AGENT / SCAN / BEGIN MISSION buttons. Shows connection status and stardate. |
| **Console/AgentConsole.tsx** | 694 | Full-height slide-in panel from right. Header with agent ID, status badge, elapsed timer, file count. Terminal window (xterm.js via TerminalContainer). Activity feed sidebar. TERMINATE AGENT button. Animated open/close. |
| **Console/TerminalContainer.tsx** | 204 | Creates xterm.js Terminal instance, connects via WebSocket to `/ws/terminal/:agentId` using AttachAddon. Handles resize via ResizeObserver. 3-attempt connection retry. Sci-fi color theme. |
| **Console/ActivityFeed.tsx** | 269 | Scrollable event list in agent console sidebar. Shows parsed events (file created/edited, build started/succeeded/error, task completed) with icons, colors, and relative timestamps. Auto-scrolls on new events. |
| **Planning/MissionPlanning.tsx** | 1069 | Task list editor. Add/remove/toggle tasks. Per-task LAUNCH button. BEGIN MISSION launches all uncompleted tasks simultaneously. Shows project objective, task status summary. |
| **Planning/LaunchModal.tsx** | 673 | Modal for launching a single agent. Shows project context (name, CWD read-only), task textarea, palette-colored header. Generates agent ID, sends `agent:launch` via WebSocket, auto-navigates to tactical and opens console. |
| **Incubator/GalaxyMap.tsx** | 726 | Multi-project overview. Planet cards for each project with status, agent count, palette-driven colors. Click selects project and navigates to tactical. |
| **Incubator/CreateProjectModal.tsx** | 665 | New project form. Name input with real-time slug preview, description textarea. Shows server-generated directory path. Sends `project:create` via WebSocket, navigates to planning on success. |
| **Logs/SystemLogs.tsx** | 672 | Filterable log table. Level filter (info/warn/error/success), source filter, free-text search. Color-coded log entries with timestamps, source badges, agent/project links. |
| **Status/StatusView.tsx** | 846 | Ship systems dashboard. Shows active sessions, WebSocket connections, memory usage (simulated), server uptime, project/agent counts. Animated gauges and status indicators. |

### State Management (`src/stores/`)

| File | Lines | Purpose |
|------|-------|---------|
| **agentStore.ts** | 97 | Zustand store. Agent CRUD, selection, event lists. `getActiveAgents()`, `getAgentsByProject()`. |
| **projectStore.ts** | 53 | Project CRUD, active project selection, server base directory. |
| **authStore.ts** | 134 | Login/setup flow, token persistence (localStorage), setup-required check. |
| **flowStore.ts** | 83 | Toast notifications, UI flow state for guided experiences. |
| **planningStore.ts** | 68 | Per-project task lists (add, remove, toggle, clear). |
| **logStore.ts** | 48 | Log entry buffer with max 500 entries. |
| **uiStore.ts** | 66 | Current view, console visibility, modal state. |

### Hooks (`src/hooks/`)

| File | Lines | Purpose |
|------|-------|---------|
| **useWebSocket.ts** | 295 | Core WebSocket connection to `/ws/events`. Handles connect/reconnect with exponential backoff (1s–30s). Dispatches server messages to Zustand stores. Wraps flat client messages into server's payload format. Maps server status names to client names (`launched`→`launching`, `running`→`active`). |
| **useStardate.ts** | 45 | Converts real dates to Star Trek stardates for the HUD. |

### Tests (`tests/`)

| File | Lines | Tests | Coverage |
|------|-------|-------|----------|
| **app.spec.ts** | 456 | 40 | Core UI: layout, sidebar, nav, views, modals, responsive |
| **workflows.spec.ts** | 471 | 24 | Project creation, state sync, planning, agent launch, multi-project, navigation, path security, full lifecycle |
| **auth.spec.ts** | 68 | — | Login, password setup, session persistence |

---

## Data Flow

```
User clicks LAUNCH AGENT
  → LaunchModal sends { type: 'agent:launch', id, projectId, task, cwd } via WebSocket
  → server/index.ts handleClientMessage validates CWD, registers agent, calls sessionManager.launchAgent()
  → SessionManager spawns node-pty: `claude --dangerously-skip-permissions`
  → On first PTY output, sends task text + Enter to stdin
  → PTY stdout → OutputParser (structured events) + terminal WS clients (raw bytes)
  → OutputParser emits file:created, build:started, agent:activity, etc.
  → server/index.ts broadcasts events to /ws/events clients
  → useWebSocket.ts dispatches to Zustand stores
  → React components re-render (moon color changes, activity feed updates, etc.)
```

## Key Ports & Paths

| Resource | Location |
|----------|----------|
| Vite dev server | http://localhost:5173 |
| Express server | http://localhost:3000 |
| WebSocket events | ws://localhost:3000/ws/events |
| WebSocket terminal | ws://localhost:3000/ws/terminal/:agentId |
| Project directories | ~/.constellation-command/projects/ |
| Auth config | ~/.constellation-command/auth.json |
