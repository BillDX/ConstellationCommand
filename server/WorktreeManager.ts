import { exec } from 'node:child_process';
import { access, constants, rm } from 'node:fs/promises';
import { join } from 'node:path';

// ── WorktreeManager ───────────────────────────────────────────────────────
//
// Manages git worktrees for isolated worker agent directories.
// Each worker gets its own branch and worktree so agents don't
// step on each other's file changes.

export interface Worktree {
  agentId: string;
  branch: string;
  path: string;
  createdAt: number;
}

const WORKTREE_DIR_NAME = '.worktrees';

export class WorktreeManager {
  private worktrees: Map<string, Worktree> = new Map();

  /**
   * Ensure the project directory is a git repo. Initialize one if not.
   * Returns true if a git repo exists (or was just created).
   */
  async ensureGitRepo(projectCwd: string): Promise<boolean> {
    try {
      await this.execGit('git rev-parse --is-inside-work-tree', projectCwd);
      return true;
    } catch {
      // Not a git repo — initialize one
      try {
        await this.execGit('git init', projectCwd);
        await this.execGit('git checkout -b main', projectCwd);
        // Create an initial commit so worktrees have something to branch from
        await this.execGit('git commit --allow-empty -m "Initial commit"', projectCwd);
        return true;
      } catch (err) {
        console.error(`[WorktreeManager] Failed to init git repo in ${projectCwd}:`, err);
        return false;
      }
    }
  }

  /**
   * Create a git worktree for a worker agent.
   *
   * Creates a new branch `work/<agentShortId>` and a worktree directory
   * at `<projectCwd>/.worktrees/<agentShortId>/`.
   */
  async createWorktree(projectCwd: string, agentId: string): Promise<Worktree> {
    const shortId = agentId.slice(0, 8);
    const branch = `work/${shortId}`;
    const worktreeDir = join(projectCwd, WORKTREE_DIR_NAME);
    const worktreePath = join(worktreeDir, shortId);

    // Ensure the worktrees parent directory exists
    await this.execGit(`mkdir -p "${worktreeDir}"`, projectCwd);

    // Ensure .worktrees is gitignored
    await this.ensureGitignoreEntry(projectCwd, WORKTREE_DIR_NAME);

    // Determine the base branch (main or master or whatever HEAD points to)
    const baseBranch = await this.getDefaultBranch(projectCwd);

    // Create the worktree with a new branch
    try {
      await this.execGit(
        `git worktree add -b "${branch}" "${worktreePath}" "${baseBranch}"`,
        projectCwd,
      );
    } catch (err) {
      // Branch might already exist from a previous attempt
      const errMsg = String(err);
      if (errMsg.includes('already exists')) {
        // Clean up the old branch and try again
        await this.execGit(`git branch -D "${branch}"`, projectCwd).catch(() => {});
        await this.execGit(
          `git worktree add -b "${branch}" "${worktreePath}" "${baseBranch}"`,
          projectCwd,
        );
      } else {
        throw err;
      }
    }

    const worktree: Worktree = {
      agentId,
      branch,
      path: worktreePath,
      createdAt: Date.now(),
    };

    this.worktrees.set(agentId, worktree);
    return worktree;
  }

  /**
   * Remove a worker's worktree and optionally delete the branch.
   */
  async removeWorktree(agentId: string, projectCwd: string, deleteBranch = false): Promise<void> {
    const worktree = this.worktrees.get(agentId);
    if (!worktree) return;

    try {
      // Remove the worktree
      await this.execGit(`git worktree remove "${worktree.path}" --force`, projectCwd);
    } catch {
      // Worktree might already be gone — try manual cleanup
      try {
        await rm(worktree.path, { recursive: true, force: true });
        await this.execGit('git worktree prune', projectCwd);
      } catch {
        // Best effort
      }
    }

    if (deleteBranch) {
      try {
        await this.execGit(`git branch -D "${worktree.branch}"`, projectCwd);
      } catch {
        // Branch might already be deleted
      }
    }

    this.worktrees.delete(agentId);
  }

  /**
   * Get the worktree for an agent.
   */
  getWorktree(agentId: string): Worktree | undefined {
    return this.worktrees.get(agentId);
  }

  /**
   * Get the worktree path for an agent, or the project CWD if no worktree exists.
   */
  getAgentCwd(agentId: string, projectCwd: string): string {
    const worktree = this.worktrees.get(agentId);
    return worktree ? worktree.path : projectCwd;
  }

  /**
   * List all active worktrees.
   */
  listWorktrees(): Worktree[] {
    return Array.from(this.worktrees.values());
  }

  /**
   * Clean up all worktrees for a project.
   */
  async cleanupAll(projectCwd: string): Promise<void> {
    const agents = Array.from(this.worktrees.keys());
    for (const agentId of agents) {
      await this.removeWorktree(agentId, projectCwd, true);
    }
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  private async getDefaultBranch(cwd: string): Promise<string> {
    try {
      const branch = await this.execGit('git symbolic-ref --short HEAD', cwd);
      return branch.trim() || 'main';
    } catch {
      return 'main';
    }
  }

  private async ensureGitignoreEntry(cwd: string, entry: string): Promise<void> {
    const gitignorePath = join(cwd, '.gitignore');
    try {
      await access(gitignorePath, constants.F_OK);
      const content = await this.execGit(`cat "${gitignorePath}"`, cwd);
      if (!content.includes(entry)) {
        await this.execGit(`echo "\n${entry}/" >> "${gitignorePath}"`, cwd);
      }
    } catch {
      // No .gitignore — create one
      await this.execGit(`echo "${entry}/" > "${gitignorePath}"`, cwd);
    }
  }

  private execGit(command: string, cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, { cwd, timeout: 15000 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`${command} failed: ${stderr || error.message}`));
          return;
        }
        resolve(stdout);
      });
    });
  }
}
