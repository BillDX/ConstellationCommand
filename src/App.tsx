import React, { useMemo } from 'react';
import Starfield from './components/Viewscreen/Starfield';
import AmbientParticles from './components/Viewscreen/AmbientParticles';
import ScanlineOverlay from './components/Viewscreen/ScanlineOverlay';
import Planet from './components/Viewscreen/Planet';
import OrbitalField from './components/Viewscreen/OrbitalField';
import HUD from './components/Viewscreen/HUD';
import AgentConsole from './components/Console/AgentConsole';
import { useUIStore } from './stores/uiStore';
import { useProjectStore } from './stores/projectStore';
import { useAgentStore } from './stores/agentStore';
import { useWebSocket } from './hooks/useWebSocket';
import type { Agent } from './types';

export default function App() {
  const {
    currentView, sidebarCollapsed, showCRT, showConsolePanel, consolePanelAgentId,
    setView, toggleSidebar, openLaunchModal, toggleProjectDetail, openConsole, closeConsole,
  } = useUIStore();
  const { projects, activeProjectId } = useProjectStore();
  const { agents } = useAgentStore();
  const { sendMessage, connectionStatus } = useWebSocket();

  const activeProject = activeProjectId ? projects[activeProjectId] : null;

  // Get agents for the active project
  const projectAgents: Agent[] = useMemo(() => {
    if (!activeProject) return [];
    return Object.values(agents).filter(a => a.projectId === activeProject.id);
  }, [agents, activeProject]);

  // Get selected agent for console panel
  const selectedAgent = consolePanelAgentId ? agents[consolePanelAgentId] : null;

  return (
    <div className="app">
      {/* Background Layers */}
      <Starfield />
      <AmbientParticles />
      <ScanlineOverlay visible={showCRT} />

      {/* Main Content - Tactical View */}
      {currentView === 'tactical' && activeProject && (
        <>
          {/* Planet */}
          <div style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            pointerEvents: 'none',
          }}>
            <div style={{ pointerEvents: 'auto' }}>
              <Planet
                name={activeProject.name}
                health={activeProject.health}
                progress={activeProject.progress}
                onClick={toggleProjectDetail}
              />
            </div>
          </div>

          {/* Orbital Moons */}
          <OrbitalField
            agents={projectAgents}
            onMoonClick={(agentId) => openConsole(agentId)}
          />
        </>
      )}

      {/* HUD Overlay */}
      <HUD
        activeView={currentView}
        onNavigate={(view) => setView(view as any)}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        onLaunchAgent={openLaunchModal}
        onRedAlert={() => {
          // Kill all active agents
          Object.values(agents).forEach(agent => {
            if (agent.status === 'active' || agent.status === 'launching') {
              sendMessage({ type: 'agent:kill', agentId: agent.id });
            }
          });
        }}
        onHail={() => {
          // Focus on the first active agent's console
          const active = Object.values(agents).find(a => a.status === 'active');
          if (active) openConsole(active.id);
        }}
        onScan={() => {
          // Request state sync from server
          sendMessage({ type: 'state:request' });
        }}
      />

      {/* Agent Console Panel */}
      {showConsolePanel && consolePanelAgentId && selectedAgent && (
        <AgentConsole
          agentId={consolePanelAgentId}
          onClose={closeConsole}
          sendMessage={sendMessage}
        />
      )}

      {/* Connection Status Indicator */}
      <div style={{
        position: 'fixed',
        bottom: 72,
        right: 16,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
        fontSize: '10px',
        letterSpacing: '1px',
        color: connectionStatus === 'connected'
          ? 'var(--green-success, #00ff88)'
          : connectionStatus === 'connecting'
          ? 'var(--amber-alert, #ff9f1c)'
          : 'var(--text-secondary, #7a8ba8)',
        opacity: 0.7,
      }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: connectionStatus === 'connected'
            ? 'var(--green-success, #00ff88)'
            : connectionStatus === 'connecting'
            ? 'var(--amber-alert, #ff9f1c)'
            : 'var(--red-alert, #ff3344)',
          boxShadow: connectionStatus === 'connected'
            ? '0 0 6px rgba(0, 255, 136, 0.5)'
            : 'none',
        }} />
        {connectionStatus.toUpperCase()}
      </div>
    </div>
  );
}
