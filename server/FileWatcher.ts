import { EventEmitter } from 'node:events';
import { watch, type FSWatcher } from 'chokidar';

// ── FileWatcher ──────────────────────────────────────────────────────────

export class FileWatcher extends EventEmitter {
  private watchers: Map<string, FSWatcher> = new Map();

  /**
   * Start watching a project directory for file-system changes.
   * Ignores node_modules, .git, and dist directories.
   */
  watch(projectId: string, cwd: string): void {
    if (this.watchers.has(projectId)) {
      return; // already watching
    }

    const watcher = watch(cwd, {
      persistent: true,
      ignoreInitial: true,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
      ],
      depth: 10,
    });

    watcher.on('add', (filePath: string) => {
      this.emitChange(projectId, 'add', filePath);
    });

    watcher.on('change', (filePath: string) => {
      this.emitChange(projectId, 'change', filePath);
    });

    watcher.on('unlink', (filePath: string) => {
      this.emitChange(projectId, 'unlink', filePath);
    });

    watcher.on('error', (error: unknown) => {
      this.emit('error', { projectId, error });
    });

    this.watchers.set(projectId, watcher);
  }

  /**
   * Stop watching a project directory.
   */
  async unwatch(projectId: string): Promise<void> {
    const watcher = this.watchers.get(projectId);
    if (!watcher) return;

    await watcher.close();
    this.watchers.delete(projectId);
  }

  /**
   * Stop all watchers.
   */
  async unwatchAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const [projectId] of this.watchers) {
      promises.push(this.unwatch(projectId));
    }
    await Promise.all(promises);
  }

  // ── internal ─────────────────────────────────────────────────────────

  private emitChange(projectId: string, event: 'add' | 'change' | 'unlink', filePath: string): void {
    this.emit('fs:change', {
      projectId,
      event,
      path: filePath,
      timestamp: Date.now(),
    });
  }
}
