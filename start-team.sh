#!/usr/bin/env bash
#
# ConstellationCommand Team Launcher
#
# Starts Claude Code agents in tmux panes/windows with dangerously-skip-permissions.
# Includes a dedicated dev server window and Chrome DevTools MCP integration.
#
# Usage:
#   ./start-team.sh                # Launch full team (default)
#   ./start-team.sh --core         # Launch only core agents (specialist + frontend)
#   ./start-team.sh --no-server    # Skip dev server window
#   ./start-team.sh --no-wait      # No staggered delay between launches
#   ./start-team.sh --kill         # Kill existing session
#
# Layout:
#   Window 0: dev-server     — npm run dev (client + server)
#   Window 1: specialist     — Claude Code backend/server agent (opus)
#   Window 2: frontend       — Claude Code UI/components agent (sonnet)
#   Window 3: qa             — Claude Code testing agent (sonnet) + Chrome DevTools MCP
#   Window 4: security       — Claude Code security reviewer (sonnet, read-only)
#   Window 5: docs           — Claude Code documentation agent (haiku)
#

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
SESSION="constellation"
STAGGER_DELAY=4  # seconds between agent launches to avoid API stampede

# ── Parse flags ────────────────────────────────────────────────────
NO_WAIT=false
NO_SERVER=false
CORE_ONLY=false
KILL_SESSION=false

for arg in "$@"; do
  case "$arg" in
    --no-wait)    NO_WAIT=true ;;
    --no-server)  NO_SERVER=true ;;
    --core)       CORE_ONLY=true ;;
    --kill)       KILL_SESSION=true ;;
    *)            echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

# ── Kill mode ──────────────────────────────────────────────────────
if [ "$KILL_SESSION" = true ]; then
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    tmux kill-session -t "$SESSION"
    echo "Session '$SESSION' killed."
  else
    echo "No session '$SESSION' found."
  fi
  exit 0
fi

# ── Agent definitions ──────────────────────────────────────────────
# Format: "window-name:agent-file-name"
# Agent files are in .claude/agents/<name>.md
if [ "$CORE_ONLY" = true ]; then
  AGENTS=(
    "specialist:claude-specialist"
    "frontend:frontend-effects"
  )
else
  AGENTS=(
    "specialist:claude-specialist"
    "frontend:frontend-effects"
    "qa:qa-integration"
    "security:security"
    "docs:docs"
  )
fi

# ── Preflight checks ──────────────────────────────────────────────
command -v tmux >/dev/null 2>&1 || { echo "Error: tmux is not installed"; exit 1; }
command -v claude >/dev/null 2>&1 || { echo "Error: claude CLI is not installed"; exit 1; }

if [ ! -d "$PROJECT_DIR/.claude/agents" ]; then
  echo "Error: No .claude/agents/ directory found in $PROJECT_DIR"
  exit 1
fi

# Verify agent files exist
for entry in "${AGENTS[@]}"; do
  agent="${entry#*:}"
  agent_file="$PROJECT_DIR/.claude/agents/${agent}.md"
  if [ ! -f "$agent_file" ]; then
    echo "Error: Agent file not found: $agent_file"
    exit 1
  fi
done

# Check for existing session
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Session '$SESSION' already exists."
  echo "  tmux attach -t $SESSION           (to rejoin)"
  echo "  ./start-team.sh --kill             (to kill and restart)"
  echo "  tmux kill-session -t $SESSION      (same thing)"
  exit 1
fi

# ── Build check ────────────────────────────────────────────────────
if [ ! -d "$PROJECT_DIR/dist/client" ]; then
  echo "No production build found. Building..."
  cd "$PROJECT_DIR" && npm run build
  echo ""
fi

# ── Launch ─────────────────────────────────────────────────────────
echo "╔════════════════════════════════════════════════════════╗"
echo "║     CONSTELLATION COMMAND — TEAM LAUNCHER             ║"
echo "╠════════════════════════════════════════════════════════╣"
echo "║  Project: $PROJECT_DIR"
echo "║  Session: $SESSION"
echo "║  Agents:  ${#AGENTS[@]}"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Window 0: Dev server
if [ "$NO_SERVER" = false ]; then
  tmux new-session -d -s "$SESSION" -n "dev-server" -x 220 -y 50
  tmux send-keys -t "$SESSION:dev-server" "cd '$PROJECT_DIR' && npm run dev" C-m
  echo "  ◉ dev-server — npm run dev (client :5173 + server :3000)"
  sleep 2  # Let server start before agents
else
  # Create session with first agent instead
  first_entry="${AGENTS[0]}"
  first_name="${first_entry%%:*}"
  first_agent="${first_entry#*:}"
  tmux new-session -d -s "$SESSION" -n "$first_name" -x 220 -y 50
  tmux send-keys -t "$SESSION:$first_name" "cd '$PROJECT_DIR' && claude --dangerously-skip-permissions --agent $first_agent" C-m
  echo "  ★ $first_name ($first_agent) — window 0"

  # Remove first agent from list since we already launched it
  AGENTS=("${AGENTS[@]:1}")
fi

# Agent windows
window_idx=1
for entry in "${AGENTS[@]}"; do
  name="${entry%%:*}"
  agent="${entry#*:}"
  agent_file="$PROJECT_DIR/.claude/agents/${agent}.md"

  cmd="cd '$PROJECT_DIR' && claude --dangerously-skip-permissions --agent $agent"

  tmux new-window -t "$SESSION" -n "$name"
  tmux send-keys -t "$SESSION:$name" "$cmd" C-m

  # Mark coordinator
  if [ "$agent" = "claude-specialist" ]; then
    echo "  ★ $name ($agent, opus) — window $window_idx [COORDINATOR]"
  else
    echo "  · $name ($agent) — window $window_idx"
  fi

  window_idx=$((window_idx + 1))

  # Stagger launches
  if [ "$NO_WAIT" = false ]; then
    sleep "$STAGGER_DELAY"
  fi
done

# Select the coordinator/specialist window
if [ "$NO_SERVER" = false ]; then
  tmux select-window -t "$SESSION:specialist"
else
  tmux select-window -t "$SESSION:0"
fi

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  All agents launched.                                  ║"
echo "╠════════════════════════════════════════════════════════╣"
echo "║  Navigation:                                           ║"
echo "║    Ctrl-b n / p    next / previous window              ║"
echo "║    Ctrl-b w        window list                         ║"
echo "║    Ctrl-b d        detach (agents keep running)        ║"
echo "║    Ctrl-b 0-5      jump to window by number            ║"
echo "╠════════════════════════════════════════════════════════╣"
echo "║  Chrome DevTools MCP:                                  ║"
echo "║    Configured in .mcp.json — agents can use browser    ║"
echo "║    tools (screenshot, click, evaluate, network) on     ║"
echo "║    the running app at http://localhost:5173 (dev)      ║"
echo "║    or http://localhost:3000 (production build)         ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Attach (or tell the user how if already in tmux)
if [ -n "${TMUX:-}" ]; then
  echo "You're already inside tmux. Switch with:"
  echo "  tmux switch-client -t $SESSION"
else
  tmux attach -t "$SESSION"
fi
