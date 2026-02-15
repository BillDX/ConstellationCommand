import { create } from 'zustand';
import type { Agent, AgentEvent } from '../types';

interface AgentState {
  agents: Record<string, Agent>;
  selectedAgentId: string | null;

  // Actions
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  removeAgent: (id: string) => void;
  selectAgent: (id: string | null) => void;
  addEvent: (agentId: string, event: AgentEvent) => void;
  clearEvents: (agentId: string) => void;

  // Computed
  getActiveAgents: () => Agent[];
  getAgentsByProject: (projectId: string) => Agent[];
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: {},
  selectedAgentId: null,

  addAgent: (agent) =>
    set((state) => ({
      agents: { ...state.agents, [agent.id]: agent },
    })),

  updateAgent: (id, updates) =>
    set((state) => {
      const existing = state.agents[id];
      if (!existing) return state;
      return {
        agents: {
          ...state.agents,
          [id]: { ...existing, ...updates },
        },
      };
    }),

  removeAgent: (id) =>
    set((state) => {
      const { [id]: _removed, ...rest } = state.agents;
      return {
        agents: rest,
        selectedAgentId: state.selectedAgentId === id ? null : state.selectedAgentId,
      };
    }),

  selectAgent: (id) =>
    set({ selectedAgentId: id }),

  addEvent: (agentId, event) =>
    set((state) => {
      const agent = state.agents[agentId];
      if (!agent) return state;
      return {
        agents: {
          ...state.agents,
          [agentId]: {
            ...agent,
            events: [...agent.events, event],
          },
        },
      };
    }),

  clearEvents: (agentId) =>
    set((state) => {
      const agent = state.agents[agentId];
      if (!agent) return state;
      return {
        agents: {
          ...state.agents,
          [agentId]: {
            ...agent,
            events: [],
          },
        },
      };
    }),

  getActiveAgents: () => {
    const { agents } = get();
    return Object.values(agents).filter(
      (agent) => agent.status === 'active' || agent.status === 'launching'
    );
  },

  getAgentsByProject: (projectId) => {
    const { agents } = get();
    return Object.values(agents).filter(
      (agent) => agent.projectId === projectId
    );
  },
}));
