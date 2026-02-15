import { create } from 'zustand';
import type { Project } from '../types';

interface ProjectState {
  projects: Record<string, Project>;
  activeProjectId: string | null;

  // Actions
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: {},
  activeProjectId: null,

  addProject: (project) =>
    set((state) => ({
      projects: { ...state.projects, [project.id]: project },
    })),

  updateProject: (id, updates) =>
    set((state) => {
      const existing = state.projects[id];
      if (!existing) return state;
      return {
        projects: {
          ...state.projects,
          [id]: { ...existing, ...updates },
        },
      };
    }),

  removeProject: (id) =>
    set((state) => {
      const { [id]: _removed, ...rest } = state.projects;
      return {
        projects: rest,
        activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
      };
    }),

  setActiveProject: (id) =>
    set({ activeProjectId: id }),
}));
