# Getting Started with ConstellationCommand

A step-by-step guide to installing, running, and using ConstellationCommand to manage Claude Code sessions through a starship-themed mission control interface.

## Prerequisites

- **Node.js** v18+ (v20 recommended)
- **npm** v9+
- **Claude Code CLI** installed and authenticated (`claude` command available in PATH)
- A modern browser (Chrome, Firefox, Edge)

## Installation

```bash
git clone https://github.com/YOUR_USERNAME/ConstellationCommand.git
cd ConstellationCommand
npm install
```

## Starting the Server

### Development Mode (with hot reload)

```bash
npm run dev
```

This starts:
- **Vite dev server** on `http://localhost:5173` (frontend with HMR)
- **Express + WebSocket server** on `http://localhost:3000` (backend API)

In dev mode, open `http://localhost:5173` in your browser.

### Production Mode

```bash
npm run build
npm start
```

This builds the frontend and starts the Express server on port 3000, serving both the API and the built frontend. Open `http://localhost:3000` (or your server's IP address) in your browser.

## Step-by-Step: Creating and Running a Project

### Step 1: Welcome Screen

When you first load ConstellationCommand, you'll see a welcome overlay with the **CONSTELLATION COMMAND** logo and a starfield background.

Click **BEGIN NEW MISSION** to proceed.

### Step 2: Create a Project

The Project Incubator (galaxy map) view opens. Click **NEW PROJECT** to open the project creation modal.

Fill in:
- **Project Designation**: A name for your project (e.g., "My Web App")
- **Mission Parameters** (optional): A description of what this project is about

You'll see a directory preview showing where the project will be created: `~/.constellation-command/projects/<slug>/`

Click **CREATE** to create the project.

### Step 3: Mission Planning

After creating a project, you're taken to the **Mission Planning** view. Here you can:

- Add task directives using the task input field
- Press **ADD** or hit **Enter** to add each task
- Build a checklist of what you want your Claude Code agents to accomplish

### Step 4: Launch an Agent

Navigate to **Active Missions** (tactical view) using the sidebar. You'll see your project represented as a planet.

Click **LAUNCH AGENT** in the bottom action bar. The Launch Modal opens:

- **Task Directive**: Describe what you want Claude Code to do (e.g., "Set up a React project with TypeScript and Tailwind CSS")
- **Working Directory**: Automatically set to your project's directory (read-only)

Click **LAUNCH** (or press **Ctrl+Enter**).

### Step 5: Watch Claude Code Work

After launching, the app automatically:
1. Navigates to the tactical view
2. Opens the **Agent Console** — a slide-in panel showing the live Claude Code terminal

In the Agent Console you'll see:
- **Terminal Session**: Live xterm.js terminal showing Claude Code's output in real-time
- **Activity Feed**: Structured events (files created, builds started, tasks completed)
- **Status Badge**: Shows LAUNCHING → ACTIVE → COMPLETED
- **Elapsed Timer**: How long the agent has been running
- **Files Counter**: Number of files the agent has changed

You can interact with the terminal directly — type commands and they'll be sent to the Claude Code session.

### Step 6: Monitor from System Logs

Navigate to **System Logs** via the sidebar to see a chronological feed of all events:
- Agent launches and status changes
- File creation/edit events
- Build events
- Validation warnings

Use the filter buttons (ALL, INFO, WARN, ERROR, SUCCESS) and search bar to find specific events.

### Step 7: Launch More Agents

You can launch multiple agents for the same project. Each agent:
- Appears as an orbiting moon around the project's planet
- Has its own terminal session and activity feed
- Click a moon to open that agent's console

### Step 8: Managing Agents

From the Agent Console, you can:
- **TERMINATE AGENT**: Kill the Claude Code session
- Close the console with the **X** button or **Escape** key
- Click a different agent moon to switch consoles

## Navigation Guide

The sidebar has 5 views:

| View | Description |
|------|-------------|
| **Active Missions** | Tactical view — planet + orbiting agent moons, launch agents |
| **Project Incubator** | Galaxy map — create new projects, view all projects |
| **Mission Planning** | Task checklist — plan what agents should do |
| **System Logs** | Event feed — all agent and system activity |
| **Ship Status** | Dashboard — system metrics and health |

## Tips

- **Multiple projects**: Create as many projects as you need. Switch between them from the Incubator.
- **Red Alert**: The RED ALERT button in the bottom bar terminates all running agents.
- **SCAN**: The SCAN button forces a state sync from the server.
- **HAIL**: The HAIL button opens the console for the first active agent.
- **Projects persist**: Projects survive page reloads and server restarts (state synced via WebSocket).
- **Keyboard shortcuts**: Ctrl+Enter to launch from the modal, Escape to close modals/panels.

## Running Tests

```bash
npm run build              # Required: build frontend first
npm run test:e2e           # Run all 64 E2E tests
npx playwright test --headed  # Run with visible browser
```

## Troubleshooting

- **CREATE button not working**: Hard refresh (Ctrl+Shift+R) to pick up latest JavaScript bundle.
- **No terminal output**: Make sure `claude` CLI is installed and in your PATH.
- **Connection issues**: Check that port 3000 is not blocked. The connection status indicator (bottom-right) should show CONNECTED.
- **Path errors**: Project directories are auto-created under `~/.constellation-command/projects/`. Ensure the home directory is writable.
