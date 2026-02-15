import { EventEmitter } from 'node:events';

// ── Parsed event types emitted by OutputParser ───────────────────────────

export interface ParsedEvent {
  agentId: string;
  timestamp: number;
  event: string;
  path?: string;
  message?: string;
}

// ── Regex patterns for detecting Claude Code output ──────────────────────

const FILE_PATH_RE = /(?:\/[\w.\-]+)+|(?:[\w.\-]+\/[\w.\-/]+)/;

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
  // Build success (check before error so "compiled successfully" isn't caught by "Error")
  { event: 'build:succeeded', regex: /\b(?:Build succeeded|compiled successfully|Successfully compiled)\b/i },
  // Build error
  { event: 'build:error', regex: /(?:^|\s)(?:Error:|error:|failed|FAIL)\b(.*)/, extractMessage: true },
  // Task complete
  { event: 'task:completed', regex: /\b(?:Task completed|Done!|Finished|All done|completed successfully)\b/i },
];

// ── OutputParser class ───────────────────────────────────────────────────

export class OutputParser extends EventEmitter {
  private buffers: Map<string, string> = new Map();

  /**
   * Feed raw stdout data from an agent's pty.  Buffers partial lines and
   * emits structured events when known patterns are detected.
   */
  parse(agentId: string, data: string): void {
    const existing = this.buffers.get(agentId) ?? '';
    const combined = existing + data;

    // Split on newlines; the last element may be a partial line
    const lines = combined.split('\n');
    const partial = lines.pop() ?? '';
    this.buffers.set(agentId, partial);

    for (const line of lines) {
      this.matchLine(agentId, line);
    }
  }

  /**
   * Flush any remaining buffered data for an agent (e.g. on exit).
   */
  flush(agentId: string): void {
    const remaining = this.buffers.get(agentId);
    if (remaining) {
      this.matchLine(agentId, remaining);
      this.buffers.delete(agentId);
    }
  }

  /**
   * Clean up buffer for a removed agent.
   */
  clearBuffer(agentId: string): void {
    this.buffers.delete(agentId);
  }

  // ── internal ─────────────────────────────────────────────────────────

  private matchLine(agentId: string, line: string): void {
    // Strip ANSI escape codes for cleaner matching
    const clean = stripAnsi(line);

    for (const pattern of PATTERNS) {
      const match = pattern.regex.exec(clean);
      if (match) {
        const evt: ParsedEvent = {
          agentId,
          timestamp: Date.now(),
          event: pattern.event,
        };

        if (pattern.extractPath && match[1]) {
          evt.path = match[1];
        }
        if (pattern.extractMessage && match[1]) {
          evt.message = match[1].trim();
        }

        this.emit('parsed', evt);
        // Only emit the first matching pattern per line
        break;
      }
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]|\x1b\][^\x07]*\x07/g;

function stripAnsi(str: string): string {
  return str.replace(ANSI_RE, '');
}
