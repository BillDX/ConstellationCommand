import { create } from 'zustand';
import type { View } from '../types';
import { generateId } from '../utils/generateId';

export type FlowPhase = 'welcome' | 'project-created' | 'planning' | 'agents-active' | 'agents-complete' | 'iterating';

export interface Toast {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  duration: number;
  action?: {
    label: string;
    view?: View;
    callback?: () => void;
  };
}

interface FlowState {
  phase: FlowPhase;
  welcomeSeen: boolean;
  suggestedView: View;
  toasts: Toast[];

  setPhase: (phase: FlowPhase) => void;
  markWelcomeSeen: () => void;
  computePhase: (projectCount: number, activeAgentCount: number, completedAgentCount: number) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
}

export const useFlowStore = create<FlowState>((set, get) => ({
  phase: 'welcome',
  welcomeSeen: false,
  suggestedView: 'incubator',
  toasts: [],

  setPhase: (phase) => set({ phase }),

  markWelcomeSeen: () => set({ welcomeSeen: true }),

  computePhase: (projectCount, activeAgentCount, completedAgentCount) => {
    const { welcomeSeen } = get();
    let phase: FlowPhase;
    let suggestedView: View;

    if (!welcomeSeen && projectCount === 0) {
      phase = 'welcome';
      suggestedView = 'incubator';
    } else if (projectCount === 0) {
      phase = 'welcome';
      suggestedView = 'incubator';
    } else if (activeAgentCount > 0) {
      phase = 'agents-active';
      suggestedView = 'tactical';
    } else if (completedAgentCount > 0) {
      phase = 'agents-complete';
      suggestedView = 'tactical';
    } else {
      phase = 'planning';
      suggestedView = 'planning';
    }

    set({ phase, suggestedView });
  },

  addToast: (toast) => {
    const id = generateId();
    set((state) => ({
      toasts: [...state.toasts.slice(-2), { ...toast, id }],
    }));
    if (toast.duration > 0) {
      setTimeout(() => {
        get().dismissToast(id);
      }, toast.duration);
    }
  },

  dismissToast: (id) => set((state) => ({
    toasts: state.toasts.filter(t => t.id !== id),
  })),
}));
