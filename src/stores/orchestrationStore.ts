import { create } from 'zustand';
import type { OrchestrationPhase, PlanTask } from '../types';

export interface ProjectOrchestration {
  phase: OrchestrationPhase;
  plan: PlanTask[];
  coordinatorId: string | null;
  mergerId: string | null;
  workerIds: string[];
  startedAt: number;
  completedAt?: number;
}

interface OrchestrationState {
  /** Per-project orchestration state, keyed by projectId */
  orchestrations: Record<string, ProjectOrchestration>;

  // Actions
  startOrchestration: (projectId: string) => void;
  setPhase: (projectId: string, phase: OrchestrationPhase) => void;
  setPlan: (projectId: string, tasks: PlanTask[]) => void;
  updateTask: (projectId: string, taskId: string, updates: Partial<PlanTask>) => void;
  addWorker: (projectId: string, agentId: string) => void;
  setMergeResult: (projectId: string, taskId: string, success: boolean, message: string) => void;
  clearOrchestration: (projectId: string) => void;

  // Computed
  getOrchestration: (projectId: string) => ProjectOrchestration | null;
  isOrchestrating: (projectId: string) => boolean;
}

export const useOrchestrationStore = create<OrchestrationState>((set, get) => ({
  orchestrations: {},

  startOrchestration: (projectId) =>
    set((state) => ({
      orchestrations: {
        ...state.orchestrations,
        [projectId]: {
          phase: 'initializing',
          plan: [],
          coordinatorId: null,
          mergerId: null,
          workerIds: [],
          startedAt: Date.now(),
        },
      },
    })),

  setPhase: (projectId, phase) =>
    set((state) => {
      const existing = state.orchestrations[projectId];
      if (!existing) return state;
      return {
        orchestrations: {
          ...state.orchestrations,
          [projectId]: {
            ...existing,
            phase,
            ...(phase === 'completed' ? { completedAt: Date.now() } : {}),
          },
        },
      };
    }),

  setPlan: (projectId, tasks) =>
    set((state) => {
      const existing = state.orchestrations[projectId];
      if (!existing) return state;
      return {
        orchestrations: {
          ...state.orchestrations,
          [projectId]: { ...existing, plan: tasks },
        },
      };
    }),

  updateTask: (projectId, taskId, updates) =>
    set((state) => {
      const existing = state.orchestrations[projectId];
      if (!existing) return state;
      return {
        orchestrations: {
          ...state.orchestrations,
          [projectId]: {
            ...existing,
            plan: existing.plan.map((t) =>
              t.id === taskId ? { ...t, ...updates } : t,
            ),
          },
        },
      };
    }),

  addWorker: (projectId, agentId) =>
    set((state) => {
      const existing = state.orchestrations[projectId];
      if (!existing) return state;
      return {
        orchestrations: {
          ...state.orchestrations,
          [projectId]: {
            ...existing,
            workerIds: [...existing.workerIds, agentId],
          },
        },
      };
    }),

  setMergeResult: (projectId, taskId, success, message) =>
    set((state) => {
      const existing = state.orchestrations[projectId];
      if (!existing) return state;
      return {
        orchestrations: {
          ...state.orchestrations,
          [projectId]: {
            ...existing,
            plan: existing.plan.map((t) =>
              t.id === taskId
                ? { ...t, status: success ? 'completed' as const : 'failed' as const }
                : t,
            ),
          },
        },
      };
    }),

  clearOrchestration: (projectId) =>
    set((state) => {
      const { [projectId]: _removed, ...rest } = state.orchestrations;
      return { orchestrations: rest };
    }),

  getOrchestration: (projectId) => get().orchestrations[projectId] ?? null,

  isOrchestrating: (projectId) => {
    const orch = get().orchestrations[projectId];
    return !!orch && orch.phase !== 'completed' && orch.phase !== 'error';
  },
}));
