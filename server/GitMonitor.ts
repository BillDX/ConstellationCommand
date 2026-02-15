import { EventEmitter } from 'node:events';
import { exec } from 'node:child_process';

// ── Types ────────────────────────────────────────────────────────────────

interface GitFileChange {
  status: string;
  path: string;
}

// ── GitMonitor ───────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 10_000; // 10 seconds

export class GitMonitor extends EventEmitter {
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map();

  /**
   * Start polling git status for a project directory every 10 seconds.
   */
  startMonitoring(projectId: string, cwd: string): void {
    if (this.timers.has(projectId)) {
      return; // already monitoring
    }

    // Run immediately once, then every POLL_INTERVAL_MS
    this.poll(projectId, cwd);

    const timer = setInterval(() => {
      this.poll(projectId, cwd);
    }, POLL_INTERVAL_MS);

    this.timers.set(projectId, timer);
  }

  /**
   * Stop monitoring a project directory.
   */
  stopMonitoring(projectId: string): void {
    const timer = this.timers.get(projectId);
    if (!timer) return;

    clearInterval(timer);
    this.timers.delete(projectId);
  }

  /**
   * Stop all monitors.
   */
  stopAll(): void {
    for (const [projectId] of this.timers) {
      this.stopMonitoring(projectId);
    }
  }

  // ── internal ─────────────────────────────────────────────────────────

  private poll(projectId: string, cwd: string): void {
    // Run both commands in parallel
    const statusPromise = this.execGit('git status --porcelain', cwd);
    const diffPromise = this.execGit('git diff --stat', cwd);

    Promise.all([statusPromise, diffPromise])
      .then(([statusOutput, diffOutput]) => {
        const changes = this.parseStatus(statusOutput);

        this.emit('git:status', {
          projectId,
          changes,
          diffStat: diffOutput.trim(),
          timestamp: Date.now(),
        });
      })
      .catch((error: Error) => {
        this.emit('error', { projectId, error });
      });
  }

  private execGit(command: string, cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, { cwd, timeout: 5000 }, (error, stdout, stderr) => {
        if (error) {
          // Non-zero exit from git is not necessarily fatal
          // (e.g. not a git repo), but we still report it
          reject(new Error(`${command} failed: ${stderr || error.message}`));
          return;
        }
        resolve(stdout);
      });
    });
  }

  private parseStatus(output: string): GitFileChange[] {
    const changes: GitFileChange[] = [];

    for (const line of output.split('\n')) {
      if (!line.trim()) continue;

      // git status --porcelain format: XY filename
      // X = index status, Y = work-tree status
      const statusCode = line.substring(0, 2).trim();
      const filePath = line.substring(3);

      if (statusCode && filePath) {
        changes.push({
          status: statusCode,
          path: filePath,
        });
      }
    }

    return changes;
  }
}
