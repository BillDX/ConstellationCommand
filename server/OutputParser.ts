import { EventEmitter } from 'node:events';
import type { AgentStatus } from './types.js';

// ── Parsed event types emitted by OutputParser ───────────────────────────

export interface ParsedEvent {
  agentId: string;
  timestamp: number;
  event: string;
  path?: string;
  message?: string;
}

// ── Regex patterns for detecting Claude Code structured output ───────────

const PATTERNS: Array<{
  event: string;
  regex: RegExp;
  extractPath?: boolean;
  extractMessage?: boolean;
}> = [
  // File creation
  { event: 'file:created', regex: /\b(?:Created|Writing|Creating)\b.*?((?:\/[\w.\-]+)+|(?:[\w.\-]+\/[\w.\-/]+))/, extractPath: true },
  // File edit
  { event: 'file:edited', regex: /\b(?:Edited|Updated|Modified)\b.*?((?:\/[\w.\-]+)+|(?:[\w.\-]+\/[\w.\-/]+))/, extractPath: true },
  // Build started
  { event: 'build:started', regex: /\b(?:npm run|Building|Compiling)\b/ },
  // Build success
  { event: 'build:succeeded', regex: /\b(?:Build succeeded|compiled successfully|Successfully compiled)\b/i },
  // Build error
  { event: 'build:error', regex: /(?:^|\s)(?:Error:|error:|failed|FAIL)\b(.*)/, extractMessage: true },
  // Task complete
  { event: 'task:completed', regex: /\b(?:Task completed|Done!|Finished|All done|completed successfully)\b/i },
];

// ── Claude Code CLI activity detection ───────────────────────────────────
// Each pattern maps to a specific AgentStatus. Order matters — first match wins.
// These are checked against ANSI-stripped output lines.

interface ActivityPattern {
  status: AgentStatus;
  regex: RegExp;
}

// Patterns that signal the agent has STOPPED working (highest priority)
const IDLE_PATTERNS: ActivityPattern[] = [
  // "✻ Worked for Xm Ys" — definitive turn completion
  { status: 'waiting', regex: /Worked for \d+/ },
  // Cost/token summary — turn just ended
  { status: 'waiting', regex: /Total cost:|tokens?\s+used|input.*output.*tokens/i },
  // Bare prompt character — awaiting input
  { status: 'waiting', regex: /^[>❯]\s*$/ },
  // Confirmation prompts
  { status: 'waiting', regex: /\[Y\/n\]|\[y\/N\]|Press Enter|Hit enter/i },
  // Disconnected
  { status: 'paused', regex: /\[DISCONNECTED\]|Terminal session ended/i },
  // Reconnecting
  { status: 'paused', regex: /\[RECONNECT|RETRY|Reconnecting/i },
];

// Patterns that signal the agent IS working (checked when idle, to resume).
// These are intentionally broad — Claude Code renders tool calls with
// box-drawing characters (╭─ Read, ├ Edit, etc.), plain text, or various
// TUI formats. We match tool names loosely, anywhere in the line.
const ACTIVITY_PATTERNS: ActivityPattern[] = [
  // ── THINKING ──
  // Claude Code shows "✻ Thinking...", "Thinking...", or just "Thinking" as a status
  // Require dots or start-of-line/spinner context to avoid matching conversational "thinking"
  { status: 'thinking', regex: /(?:^|[✻⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏])\s*Thinking/i },
  { status: 'thinking', regex: /Thinking\.{2,3}/i },
  { status: 'thinking', regex: /thought for \d+/i },

  // ── CODING — file write/edit operations ──
  // Tool headers: "╭─ Write", "├ Edit", "│ Edit", etc.
  { status: 'coding', regex: /[│├╭╰─]\s*(?:Write|Edit|NotebookEdit)\b/ },
  // Tool names at line start or after whitespace
  { status: 'coding', regex: /^\s*(?:Write|Edit|NotebookEdit)\b/ },
  // Tool parameter keywords unique to file editing (old_string/new_string only appear in Edit)
  { status: 'coding', regex: /\b(?:old_string|new_string)\b/i },
  // Action confirmations
  { status: 'coding', regex: /\b(?:Wrote|Updated|Created|Modified)\s+(?:\/|[a-zA-Z].*\.(?:ts|tsx|js|jsx|py|rs|go|css|html|json|md))/i },

  // ── EXECUTING — bash/shell operations ──
  // Tool header: "╭─ Bash", "├ Bash", etc.
  { status: 'executing', regex: /[│├╭╰─]\s*Bash\b/ },
  { status: 'executing', regex: /^\s*Bash\b/ },
  // Shell prompt indicators
  { status: 'executing', regex: /^\s*[\$❯]\s+\w/ },
  // Specific command invocations
  { status: 'executing', regex: /\b(?:npm run|npx |node |python |pip |git |cargo |make |docker )\b/i },

  // ── SCANNING — reading/searching files ──
  // Tool headers: "╭─ Read", "├ Glob", "│ Grep", etc.
  { status: 'scanning', regex: /[│├╭╰─]\s*(?:Read|Glob|Grep)\b/ },
  { status: 'scanning', regex: /^\s*(?:Read|Glob|Grep)\b/ },
  // Search result indicators
  { status: 'scanning', regex: /\b(?:Found \d+ (?:files?|matches?)|No matches)\b/i },

  // ── DOWNLOADING — web operations ──
  // Tool headers
  { status: 'downloading', regex: /[│├╭╰─]\s*(?:WebFetch|WebSearch)\b/ },
  { status: 'downloading', regex: /^\s*(?:WebFetch|WebSearch)\b/ },
  { status: 'downloading', regex: /\b(?:Fetching URL|Searching the web)\b/i },

  // ── BUILDING — compile/bundle operations ──
  { status: 'building', regex: /\b(?:npm run build|npm run compile|vite build|tsc|webpack|esbuild|rollup)\b/i },
  { status: 'building', regex: /\b(?:npm install|npm ci|yarn install|pnpm install|pip install)\b/i },
  { status: 'building', regex: /\b(?:modules? transformed|built in \d+)/i },

  // ── TESTING — test execution ──
  { status: 'testing', regex: /\b(?:npm run test|npm test|npx playwright|npx jest|pytest|vitest|mocha)\b/i },
  { status: 'testing', regex: /\b(?:test:e2e|test:unit|test:integration)\b/i },
  { status: 'testing', regex: /\b(?:PASS|FAIL|Tests:)\b.*\b(?:test|spec|suite)\b/i },
  { status: 'testing', regex: /\d+ (?:passed|failed|pending|skipped)/i },

  // ── GENERAL ACTIVE — catch-all tool/activity indicators ──
  // Other Claude Code tool names
  { status: 'running', regex: /[│├╭╰─]\s*(?:Task|Skill|AskUser|EnterPlanMode|TodoWrite|SendMessage)\b/ },
  { status: 'running', regex: /\bTool Result\b/i },

  // Spinner/streaming characters (braille spinners used by many CLIs, Claude's ✻)
  { status: 'running', regex: /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏⣾⣽⣻⢿⡿⣟⣯⣷✻]/ },
];

// ── OutputParser class ───────────────────────────────────────────────────

// Which statuses count as "active" (not idle)
const ACTIVE_STATUSES = new Set<AgentStatus>([
  'running', 'thinking', 'coding', 'executing', 'scanning',
  'downloading', 'building', 'testing',
]);

// Terminal statuses — don't override these
const TERMINAL_STATUSES = new Set<AgentStatus>(['completed', 'error']);

export class OutputParser extends EventEmitter {
  private buffers: Map<string, string> = new Map();
  private agentStates: Map<string, AgentStatus> = new Map();
  private idleTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  // Track the specific activity for decay (e.g., 'coding' decays to 'running' after a while)
  private activityTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  // Debug: track last few state transitions for logging
  public debug = true;

  /**
   * Feed raw stdout data from an agent's pty. Buffers partial lines and
   * emits structured events when known patterns are detected.
   */
  parse(agentId: string, data: string): void {
    const existing = this.buffers.get(agentId) ?? '';
    const combined = existing + data;

    // Split on newlines AND carriage returns. Claude Code's TUI uses \r for
    // in-place updates (spinners, thinking indicators, progress). Without
    // splitting on \r, those updates accumulate in the buffer and never get
    // pattern-matched individually. The regex handles \r\n, \n, and bare \r.
    const lines = combined.split(/\r?\n|\r/);
    const partial = lines.pop() ?? '';
    this.buffers.set(agentId, partial);

    for (const line of lines) {
      this.matchLine(agentId, line);
      this.detectAgentState(agentId, line);
    }

    // Also check partial line for state detection (prompts don't end with newline)
    if (partial) {
      this.detectAgentState(agentId, partial);
    }
  }

  /** Flush buffered data for an agent (on exit). */
  flush(agentId: string): void {
    const remaining = this.buffers.get(agentId);
    if (remaining) {
      this.matchLine(agentId, remaining);
      this.buffers.delete(agentId);
    }
  }

  /** Clean up all state for a removed agent. */
  clearBuffer(agentId: string): void {
    this.buffers.delete(agentId);
    this.agentStates.delete(agentId);
    for (const map of [this.idleTimers, this.activityTimers]) {
      const timer = map.get(agentId);
      if (timer) { clearTimeout(timer); map.delete(agentId); }
    }
  }

  // ── internal ─────────────────────────────────────────────────────────

  private matchLine(agentId: string, line: string): void {
    const clean = stripAnsi(line);

    for (const pattern of PATTERNS) {
      const match = pattern.regex.exec(clean);
      if (match) {
        const evt: ParsedEvent = {
          agentId,
          timestamp: Date.now(),
          event: pattern.event,
        };
        if (pattern.extractPath && match[1]) evt.path = match[1];
        if (pattern.extractMessage && match[1]) evt.message = match[1].trim();

        this.emit('parsed', evt);
        break; // first match only
      }
    }
  }

  /**
   * Detect agent activity state from a line of output.
   * Checks idle patterns first (highest priority), then activity patterns.
   */
  private detectAgentState(agentId: string, line: string): void {
    const clean = stripAnsi(line).trim();
    if (!clean) return;

    const current = this.agentStates.get(agentId) ?? 'running';
    if (TERMINAL_STATUSES.has(current)) return; // don't override completed/error

    // ── Check IDLE patterns first — they always win ──
    for (const { status, regex } of IDLE_PATTERNS) {
      if (regex.test(clean)) {
        if (this.debug && current !== status) {
          console.log(`[OutputParser] ${agentId.slice(0, 8)} IDLE match: "${clean.slice(0, 80)}" → ${status} (was ${current})`);
        }
        this.transitionState(agentId, status);
        return;
      }
    }

    // ── Check ACTIVITY patterns — to detect specific work types ──
    for (const { status, regex } of ACTIVITY_PATTERNS) {
      if (regex.test(clean)) {
        // Don't let the generic 'running' catch-all override a specific active state.
        // Specific states (coding, scanning, etc.) should only decay via the
        // activity decay timer, not be immediately overridden by conversational text.
        if (status === 'running' && current !== 'running' && ACTIVE_STATUSES.has(current)) {
          this.resetIdleTimer(agentId);
          return;
        }
        if (this.debug && current !== status) {
          console.log(`[OutputParser] ${agentId.slice(0, 8)} ACTIVITY match: "${clean.slice(0, 80)}" → ${status} (was ${current})`);
        }
        this.transitionState(agentId, status);
        this.resetIdleTimer(agentId);
        // Set activity decay: specific states like 'coding' decay to 'running'
        // after 10s without reinforcement, so they don't stick forever
        if (status !== 'running') {
          this.resetActivityDecay(agentId);
        }
        return;
      }
    }

    // ── Implicit activity: substantial output while idle → resume ──
    if (!ACTIVE_STATUSES.has(current) && clean.length > 30) {
      this.transitionState(agentId, 'running');
      this.resetIdleTimer(agentId);
      return;
    }

    // Any output while active resets the idle timer
    if (ACTIVE_STATUSES.has(current)) {
      this.resetIdleTimer(agentId);
    }
  }

  private transitionState(agentId: string, newState: AgentStatus): void {
    const current = this.agentStates.get(agentId);
    if (current === newState) return;

    this.agentStates.set(agentId, newState);
    this.emit('agent:activity', { agentId, state: newState });

    // Clear idle timer when transitioning to idle states
    if (!ACTIVE_STATUSES.has(newState)) {
      const timer = this.idleTimers.get(agentId);
      if (timer) { clearTimeout(timer); this.idleTimers.delete(agentId); }
    }
  }

  /** After N seconds of no output, assume agent is waiting for input. */
  private resetIdleTimer(agentId: string): void {
    const existing = this.idleTimers.get(agentId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      const state = this.agentStates.get(agentId);
      if (state && ACTIVE_STATUSES.has(state)) {
        this.transitionState(agentId, 'waiting');
      }
      this.idleTimers.delete(agentId);
    }, 8000);

    this.idleTimers.set(agentId, timer);
  }

  /** Specific activities (coding, scanning, etc.) decay to generic 'running' after 12s
   *  so the UI doesn't show a stale specific state. */
  private resetActivityDecay(agentId: string): void {
    const existing = this.activityTimers.get(agentId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      const state = this.agentStates.get(agentId);
      if (state && ACTIVE_STATUSES.has(state) && state !== 'running') {
        this.transitionState(agentId, 'running');
      }
      this.activityTimers.delete(agentId);
    }, 12000);

    this.activityTimers.set(agentId, timer);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07|\x1b[()][A-Z0-9]|\x1b[>=<]|\x1b\[[\d;]*m/g;

function stripAnsi(str: string): string {
  return str.replace(ANSI_RE, '');
}
