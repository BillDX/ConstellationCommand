import { EventEmitter } from 'node:events';
import { randomBytes } from 'node:crypto';
import type { SessionManager } from './SessionManager.js';
import { WorktreeManager } from './WorktreeManager.js';
import {
  buildCoordinatorPrompt,
  buildWorkerPrompt,
  buildMergerPrompt,
  buildMergeInstruction,
  parsePlanFromOutput,
  detectTaskComplete,
  detectMergeResult,
} from './AgentPrompts.js';
import type {
  OrchestratedProject,
  OrchestrationPhase,
  PlanTask,
  Project,
  AgentRole,
} from './types.js';

// ── Orchestrator ──────────────────────────────────────────────────────────
//
// The autonomous engine that drives projects from description to completion.
//
// Lifecycle:
//   1. startOrchestration() → spawns coordinator
//   2. Coordinator produces plan → onPlanReady()
//   3. User approves plan → approvePlan()
//   4. Workers spawn for each task → spawnNextWorkers()
//   5. Workers complete → onWorkerComplete() → merger merges → onMergeComplete()
//   6. All tasks done → project marked complete
//
// Events emitted:
//   'phase'           — { projectId, phase }
//   'plan-ready'      — { projectId, tasks }
//   'task-update'     — { projectId, taskId, status, assignedAgent, branch }
//   'worker-spawned'  — { projectId, agentId, taskId, branch }
//   'merge-result'    — { projectId, branch, taskId, success, message }
//   'log'             — { level, source, message, projectId, agentId? }
//   'agent-launch'    — { id, projectId, task, cwd, role, planTaskId?, branch? }

const DEFAULT_MAX_WORKERS = 3;

function generateAgentId(): string {
  return randomBytes(16).toString('hex');
}

export class Orchestrator extends EventEmitter {
  private projects: Map<string, OrchestratedProject> = new Map();
  private sessionManager: SessionManager;
  private worktreeManager: WorktreeManager;

  /** Accumulated output per agent, for detecting structured markers */
  private agentOutputBuffers: Map<string, string> = new Map();

  constructor(sessionManager: SessionManager) {
    super();
    this.sessionManager = sessionManager;
    this.worktreeManager = new WorktreeManager();
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Start orchestrated mode for a project. Spawns the coordinator agent
   * which will analyze the codebase and produce a plan.
   */
  async startOrchestration(
    project: Project,
    maxConcurrentWorkers?: number,
  ): Promise<OrchestratedProject> {
    if (this.projects.has(project.id)) {
      throw new Error(`Project ${project.id} is already being orchestrated`);
    }

    // Ensure git repo exists
    const gitReady = await this.worktreeManager.ensureGitRepo(project.cwd);
    if (!gitReady) {
      throw new Error(`Failed to initialize git repo in ${project.cwd}`);
    }

    const orch: OrchestratedProject = {
      projectId: project.id,
      phase: 'initializing',
      coordinatorId: null,
      mergerId: null,
      workerIds: [],
      plan: [],
      maxConcurrentWorkers: maxConcurrentWorkers ?? DEFAULT_MAX_WORKERS,
      startedAt: Date.now(),
    };

    this.projects.set(project.id, orch);
    this.setPhase(project.id, 'initializing');

    // Spawn coordinator
    const coordinatorId = generateAgentId();
    orch.coordinatorId = coordinatorId;

    const prompt = buildCoordinatorPrompt({
      name: project.name,
      description: project.description,
      cwd: project.cwd,
    });

    this.log('info', project.id, `Starting orchestration — spawning coordinator ${coordinatorId.slice(0, 8)}`);

    this.emit('agent-launch', {
      id: coordinatorId,
      projectId: project.id,
      task: prompt,
      cwd: project.cwd,
      role: 'coordinator' as AgentRole,
    });

    this.setPhase(project.id, 'planning');
    return orch;
  }

  /**
   * Feed agent output to the orchestrator for structured marker detection.
   * Called by the session manager or output parser for orchestrated agents.
   */
  feedAgentOutput(agentId: string, data: string): void {
    const existing = this.agentOutputBuffers.get(agentId) ?? '';
    const combined = existing + data;

    // Cap buffer size to prevent unbounded growth
    const MAX_BUFFER = 128 * 1024;
    const trimmed = combined.length > MAX_BUFFER
      ? combined.slice(-MAX_BUFFER)
      : combined;

    this.agentOutputBuffers.set(agentId, trimmed);

    // Find which project this agent belongs to
    const orch = this.findProjectByAgent(agentId);
    if (!orch) return;

    // Check for structured markers based on agent role
    if (agentId === orch.coordinatorId) {
      this.checkCoordinatorOutput(orch, trimmed);
    } else if (orch.workerIds.includes(agentId)) {
      this.checkWorkerOutput(orch, agentId, trimmed);
    } else if (agentId === orch.mergerId) {
      this.checkMergerOutput(orch, trimmed);
    }
  }

  /**
   * Handle agent completion (PTY exit). Called by the session manager.
   */
  onAgentComplete(agentId: string, exitCode: number): void {
    const orch = this.findProjectByAgent(agentId);
    if (!orch) return;

    if (agentId === orch.coordinatorId) {
      this.onCoordinatorComplete(orch, exitCode);
    } else if (orch.workerIds.includes(agentId)) {
      this.onWorkerExited(orch, agentId, exitCode);
    } else if (agentId === orch.mergerId) {
      this.log('warn', orch.projectId, `Merge agent exited (code ${exitCode})`, agentId);
    }

    // Clean up output buffer
    this.agentOutputBuffers.delete(agentId);
  }

  /**
   * User approved the generated plan. Start executing.
   */
  async approvePlan(projectId: string, projectState: Project): Promise<void> {
    const orch = this.projects.get(projectId);
    if (!orch || orch.phase !== 'reviewing') {
      throw new Error(`Project ${projectId} is not in reviewing phase`);
    }

    this.log('info', projectId, `Plan approved with ${orch.plan.length} tasks — starting execution`);
    this.setPhase(projectId, 'executing');

    // Spawn merge agent
    await this.spawnMerger(orch, projectState);

    // Spawn initial workers
    await this.spawnNextWorkers(orch, projectState);
  }

  /**
   * Abort orchestration for a project. Kills all agents, cleans up worktrees.
   */
  async abortOrchestration(projectId: string, projectCwd: string): Promise<void> {
    const orch = this.projects.get(projectId);
    if (!orch) return;

    this.log('warn', projectId, 'Orchestration aborted');

    // Kill all agents
    const allAgents = [
      orch.coordinatorId,
      orch.mergerId,
      ...orch.workerIds,
    ].filter(Boolean) as string[];

    for (const agentId of allAgents) {
      this.sessionManager.killSession(agentId);
      this.agentOutputBuffers.delete(agentId);
    }

    // Clean up worktrees
    await this.worktreeManager.cleanupAll(projectCwd);

    this.setPhase(projectId, 'error');
    this.projects.delete(projectId);
  }

  /**
   * Get orchestration state for a project.
   */
  getOrchestration(projectId: string): OrchestratedProject | undefined {
    return this.projects.get(projectId);
  }

  /**
   * Check if an agent belongs to an orchestrated project and return its role.
   */
  getAgentRole(agentId: string): AgentRole | null {
    for (const orch of this.projects.values()) {
      if (agentId === orch.coordinatorId) return 'coordinator';
      if (agentId === orch.mergerId) return 'merger';
      if (orch.workerIds.includes(agentId)) return 'worker';
    }
    return null;
  }

  // ── Coordinator handling ────────────────────────────────────────────────

  private checkCoordinatorOutput(orch: OrchestratedProject, output: string): void {
    if (orch.phase !== 'planning') return;

    // Strip ANSI codes for clean parsing
    const clean = stripAnsi(output);
    const tasks = parsePlanFromOutput(clean);

    if (tasks && tasks.length > 0) {
      this.log('success', orch.projectId, `Coordinator produced plan with ${tasks.length} tasks`);

      // Convert parsed tasks to PlanTask objects
      orch.plan = tasks.map((t, idx) => ({
        id: `task-${idx + 1}`,
        title: t.title,
        description: t.description,
        status: 'pending' as const,
        assignedAgent: null,
        branch: null,
        order: idx + 1,
        dependencies: t.dependencies.map(d => `task-${d}`),
      }));

      this.setPhase(orch.projectId, 'reviewing');

      this.emit('plan-ready', {
        projectId: orch.projectId,
        tasks: orch.plan,
        timestamp: Date.now(),
      });
    }
  }

  private onCoordinatorComplete(orch: OrchestratedProject, exitCode: number): void {
    if (orch.phase === 'planning' && orch.plan.length === 0) {
      // Coordinator exited without producing a plan
      this.log('error', orch.projectId, `Coordinator exited (code ${exitCode}) without producing a plan`);
      this.setPhase(orch.projectId, 'error');
    }
    // If coordinator exits after producing a plan, that's fine — it did its job
  }

  // ── Worker handling ─────────────────────────────────────────────────────

  private checkWorkerOutput(orch: OrchestratedProject, agentId: string, output: string): void {
    const clean = stripAnsi(output);

    if (detectTaskComplete(clean)) {
      const task = orch.plan.find(t => t.assignedAgent === agentId);
      if (!task || task.status === 'completed') return;

      this.log('success', orch.projectId, `Worker ${agentId.slice(0, 8)} signaled TASK_COMPLETE for "${task.title}"`, agentId);
      this.updateTask(orch, task.id, 'completed');

      // Tell merger to merge this branch
      if (orch.mergerId && task.branch) {
        const instruction = buildMergeInstruction(task.branch, task.title);
        this.sessionManager.writeToSession(orch.mergerId, instruction + '\r');
      }
    }
  }

  private async onWorkerExited(orch: OrchestratedProject, agentId: string, exitCode: number): Promise<void> {
    const task = orch.plan.find(t => t.assignedAgent === agentId);

    if (task && task.status !== 'completed') {
      if (exitCode === 0) {
        // Exited cleanly but didn't signal — treat as completed
        this.log('info', orch.projectId, `Worker ${agentId.slice(0, 8)} exited cleanly — marking "${task.title}" complete`, agentId);
        this.updateTask(orch, task.id, 'completed');

        if (orch.mergerId && task.branch) {
          const instruction = buildMergeInstruction(task.branch, task.title);
          this.sessionManager.writeToSession(orch.mergerId, instruction + '\r');
        }
      } else {
        // Exited with error
        this.log('error', orch.projectId, `Worker ${agentId.slice(0, 8)} failed (exit code ${exitCode}) for "${task.title}"`, agentId);
        this.updateTask(orch, task.id, 'failed');
      }
    }

    // Remove from active workers
    orch.workerIds = orch.workerIds.filter(id => id !== agentId);

    // Clean up worktree
    // Keep the branch around (merger may still need it)
    await this.worktreeManager.removeWorktree(agentId, this.getProjectCwd(orch.projectId) ?? '');

    // Check if we should spawn more workers or if we're done
    const projectState = this.getProjectState(orch.projectId);
    if (projectState) {
      await this.spawnNextWorkers(orch, projectState);
    }

    this.checkCompletion(orch);
  }

  // ── Merger handling ─────────────────────────────────────────────────────

  private checkMergerOutput(orch: OrchestratedProject, output: string): void {
    const clean = stripAnsi(output);
    const result = detectMergeResult(clean);

    if (!result) return;

    // Find which task this merge was for
    const task = orch.plan.find(t => t.branch === result.branch);

    if (result.type === 'success') {
      this.log('success', orch.projectId, `Merge agent merged ${result.branch} into main`, orch.mergerId ?? undefined);
      this.emit('merge-result', {
        projectId: orch.projectId,
        branch: result.branch,
        taskId: task?.id ?? 'unknown',
        success: true,
        message: `Branch ${result.branch} merged successfully`,
        timestamp: Date.now(),
      });
    } else {
      this.log('warn', orch.projectId, `Merge conflict on ${result.branch}: ${result.details}`, orch.mergerId ?? undefined);
      this.emit('merge-result', {
        projectId: orch.projectId,
        branch: result.branch,
        taskId: task?.id ?? 'unknown',
        success: false,
        message: result.details ?? 'Merge conflict',
        timestamp: Date.now(),
      });

      // Mark the task as failed so it can be retried
      if (task) {
        this.updateTask(orch, task.id, 'failed');
      }
    }

    // Clear merger output buffer after processing a result
    if (orch.mergerId) {
      this.agentOutputBuffers.set(orch.mergerId, '');
    }

    this.checkCompletion(orch);
  }

  // ── Worker spawning ─────────────────────────────────────────────────────

  private async spawnNextWorkers(orch: OrchestratedProject, project: Project): Promise<void> {
    if (orch.phase !== 'executing') return;

    const activeCount = orch.workerIds.length;
    const slotsAvailable = orch.maxConcurrentWorkers - activeCount;
    if (slotsAvailable <= 0) return;

    // Find tasks that are ready (pending, no unfinished dependencies)
    const readyTasks = orch.plan.filter(t => {
      if (t.status !== 'pending') return false;
      return t.dependencies.every(depId => {
        const dep = orch.plan.find(d => d.id === depId);
        return dep?.status === 'completed';
      });
    });

    const toSpawn = readyTasks.slice(0, slotsAvailable);

    for (const task of toSpawn) {
      await this.spawnWorker(orch, project, task);
    }
  }

  private async spawnWorker(orch: OrchestratedProject, project: Project, task: PlanTask): Promise<void> {
    const agentId = generateAgentId();
    const workerPrompt = buildWorkerPrompt(
      { name: project.name, description: project.description, cwd: project.cwd },
      task,
      orch.plan,
      '', // branch will be filled after worktree creation
    );

    // Create isolated worktree
    let worktree;
    try {
      worktree = await this.worktreeManager.createWorktree(project.cwd, agentId);
    } catch (err) {
      this.log('error', orch.projectId, `Failed to create worktree for task "${task.title}": ${err}`, agentId);
      this.updateTask(orch, task.id, 'failed');
      return;
    }

    // Update task with assignment info
    task.status = 'assigned';
    task.assignedAgent = agentId;
    task.branch = worktree.branch;

    // Rebuild prompt with actual branch name
    const finalPrompt = buildWorkerPrompt(
      { name: project.name, description: project.description, cwd: project.cwd },
      task,
      orch.plan,
      worktree.branch,
    );

    orch.workerIds.push(agentId);

    this.log('info', orch.projectId, `Spawning worker ${agentId.slice(0, 8)} for "${task.title}" on branch ${worktree.branch}`, agentId);

    this.emit('agent-launch', {
      id: agentId,
      projectId: orch.projectId,
      task: finalPrompt,
      cwd: worktree.path,
      role: 'worker' as AgentRole,
      planTaskId: task.id,
      branch: worktree.branch,
    });

    this.emit('worker-spawned', {
      projectId: orch.projectId,
      agentId,
      taskId: task.id,
      branch: worktree.branch,
      timestamp: Date.now(),
    });

    this.updateTask(orch, task.id, 'in-progress');
  }

  private async spawnMerger(orch: OrchestratedProject, project: Project): Promise<void> {
    const mergerId = generateAgentId();
    orch.mergerId = mergerId;

    const prompt = buildMergerPrompt({
      name: project.name,
      description: project.description,
      cwd: project.cwd,
    });

    this.log('info', orch.projectId, `Spawning merge agent ${mergerId.slice(0, 8)}`, mergerId);

    this.emit('agent-launch', {
      id: mergerId,
      projectId: orch.projectId,
      task: prompt,
      cwd: project.cwd,
      role: 'merger' as AgentRole,
    });
  }

  // ── Completion detection ────────────────────────────────────────────────

  private checkCompletion(orch: OrchestratedProject): void {
    if (orch.phase !== 'executing') return;

    const allDone = orch.plan.every(
      t => t.status === 'completed' || t.status === 'failed',
    );

    if (!allDone) return;

    const allSucceeded = orch.plan.every(t => t.status === 'completed');
    const failedTasks = orch.plan.filter(t => t.status === 'failed');

    if (allSucceeded) {
      this.log('success', orch.projectId, `All ${orch.plan.length} tasks completed successfully!`);
      this.setPhase(orch.projectId, 'completed');
      orch.completedAt = Date.now();

      // Kill the merger — its job is done
      if (orch.mergerId) {
        this.sessionManager.killSession(orch.mergerId);
      }
    } else if (orch.workerIds.length === 0) {
      // No active workers and some tasks failed — we're stuck
      this.log('warn', orch.projectId,
        `${failedTasks.length} tasks failed, no active workers. Orchestration stalled.`);
      // Don't set error — user may want to retry failed tasks
    }
  }

  // ── State updates ───────────────────────────────────────────────────────

  private setPhase(projectId: string, phase: OrchestrationPhase): void {
    const orch = this.projects.get(projectId);
    if (orch) orch.phase = phase;

    this.emit('phase', {
      projectId,
      phase,
      timestamp: Date.now(),
    });
  }

  private updateTask(orch: OrchestratedProject, taskId: string, status: PlanTask['status']): void {
    const task = orch.plan.find(t => t.id === taskId);
    if (!task) return;

    task.status = status;

    this.emit('task-update', {
      projectId: orch.projectId,
      taskId,
      status,
      assignedAgent: task.assignedAgent,
      branch: task.branch,
      timestamp: Date.now(),
    });
  }

  private log(level: string, projectId: string, message: string, agentId?: string): void {
    this.emit('log', {
      level,
      source: 'Orchestrator',
      message,
      projectId,
      ...(agentId && { agentId }),
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private findProjectByAgent(agentId: string): OrchestratedProject | null {
    for (const orch of this.projects.values()) {
      if (agentId === orch.coordinatorId) return orch;
      if (agentId === orch.mergerId) return orch;
      if (orch.workerIds.includes(agentId)) return orch;
    }
    return null;
  }

  /**
   * Hook to get project CWD from external state.
   * Set by the server when wiring up the orchestrator.
   */
  private projectCwds: Map<string, string> = new Map();

  setProjectCwd(projectId: string, cwd: string): void {
    this.projectCwds.set(projectId, cwd);
  }

  private getProjectCwd(projectId: string): string | undefined {
    return this.projectCwds.get(projectId);
  }

  /**
   * Hook to get project state from external state.
   * Set by the server when wiring up the orchestrator.
   */
  private projectStates: Map<string, Project> = new Map();

  setProjectState(projectId: string, project: Project): void {
    this.projectStates.set(projectId, project);
  }

  private getProjectState(projectId: string): Project | undefined {
    return this.projectStates.get(projectId);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07|\x1b[()][A-Z0-9]|\x1b[>=<]|\x1b\[[\d;]*m/g;

function stripAnsi(str: string): string {
  return str.replace(ANSI_RE, '');
}
