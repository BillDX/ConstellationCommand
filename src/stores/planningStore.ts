import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PlanningTask {
  id: string;
  text: string;
  completed: boolean;
  agentId?: string;
}

interface PlanningState {
  tasks: Record<string, PlanningTask[]>;

  addTask: (projectId: string, text: string) => void;
  removeTask: (projectId: string, taskId: string) => void;
  toggleTask: (projectId: string, taskId: string) => void;
  assignAgent: (projectId: string, taskId: string, agentId: string) => void;
  getProjectTasks: (projectId: string) => PlanningTask[];
}

export const usePlanningStore = create<PlanningState>()(
  persist(
    (set, get) => ({
      tasks: {},

      addTask: (projectId, text) => {
        const id = crypto.randomUUID();
        set((state) => ({
          tasks: {
            ...state.tasks,
            [projectId]: [...(state.tasks[projectId] || []), { id, text, completed: false }],
          },
        }));
      },

      removeTask: (projectId, taskId) => set((state) => ({
        tasks: {
          ...state.tasks,
          [projectId]: (state.tasks[projectId] || []).filter(t => t.id !== taskId),
        },
      })),

      toggleTask: (projectId, taskId) => set((state) => ({
        tasks: {
          ...state.tasks,
          [projectId]: (state.tasks[projectId] || []).map(t =>
            t.id === taskId ? { ...t, completed: !t.completed } : t
          ),
        },
      })),

      assignAgent: (projectId, taskId, agentId) => set((state) => ({
        tasks: {
          ...state.tasks,
          [projectId]: (state.tasks[projectId] || []).map(t =>
            t.id === taskId ? { ...t, agentId } : t
          ),
        },
      })),

      getProjectTasks: (projectId) => get().tasks[projectId] || [],
    }),
    {
      name: 'constellation-planning',
    }
  )
);
