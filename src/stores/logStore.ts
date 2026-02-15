import { create } from 'zustand';
import type { LogEntry } from '../types';

interface LogFilters {
  level?: LogEntry['level'];
  agentId?: string;
  projectId?: string;
  source?: string;
}

interface LogState {
  logs: LogEntry[];
  maxLogs: number;

  // Actions
  addLog: (entry: LogEntry) => void;
  clearLogs: () => void;
  getFilteredLogs: (filters: LogFilters) => LogEntry[];
}

export const useLogStore = create<LogState>((set, get) => ({
  logs: [],
  maxLogs: 500,

  addLog: (entry) =>
    set((state) => {
      const updated = [...state.logs, entry];
      // Trim to maxLogs, keeping the most recent entries
      if (updated.length > state.maxLogs) {
        return { logs: updated.slice(updated.length - state.maxLogs) };
      }
      return { logs: updated };
    }),

  clearLogs: () =>
    set({ logs: [] }),

  getFilteredLogs: (filters) => {
    const { logs } = get();
    return logs.filter((log) => {
      if (filters.level && log.level !== filters.level) return false;
      if (filters.agentId && log.agentId !== filters.agentId) return false;
      if (filters.projectId && log.projectId !== filters.projectId) return false;
      if (filters.source && log.source !== filters.source) return false;
      return true;
    });
  },
}));
