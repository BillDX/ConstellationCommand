import { create } from 'zustand';
import type { View } from '../types';

interface UIState {
  currentView: View;
  sidebarCollapsed: boolean;
  showCRT: boolean;
  showConsolePanel: boolean;
  consolePanelAgentId: string | null;
  showLaunchModal: boolean;
  showProjectDetail: boolean;

  // Actions
  setView: (view: View) => void;
  toggleSidebar: () => void;
  toggleCRT: () => void;
  openConsole: (agentId: string) => void;
  closeConsole: () => void;
  openLaunchModal: () => void;
  closeLaunchModal: () => void;
  toggleProjectDetail: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  currentView: 'tactical',
  sidebarCollapsed: false,
  showCRT: true,
  showConsolePanel: false,
  consolePanelAgentId: null,
  showLaunchModal: false,
  showProjectDetail: false,

  setView: (view) =>
    set({ currentView: view }),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  toggleCRT: () =>
    set((state) => ({ showCRT: !state.showCRT })),

  openConsole: (agentId) =>
    set({ showConsolePanel: true, consolePanelAgentId: agentId }),

  closeConsole: () =>
    set({ showConsolePanel: false, consolePanelAgentId: null }),

  openLaunchModal: () =>
    set({ showLaunchModal: true }),

  closeLaunchModal: () =>
    set({ showLaunchModal: false }),

  toggleProjectDetail: () =>
    set((state) => ({ showProjectDetail: !state.showProjectDetail })),
}));
