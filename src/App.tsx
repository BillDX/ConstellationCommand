import React, { useMemo, useState, useCallback } from 'react';
import Starfield from './components/Viewscreen/Starfield';
import AmbientParticles from './components/Viewscreen/AmbientParticles';
import ScanlineOverlay from './components/Viewscreen/ScanlineOverlay';
import Planet from './components/Viewscreen/Planet';
import OrbitalField from './components/Viewscreen/OrbitalField';
import HUD from './components/Viewscreen/HUD';
import AgentConsole from './components/Console/AgentConsole';
import MissionPlanning from './components/Planning/MissionPlanning';
import LaunchModal from './components/Planning/LaunchModal';
import GalaxyMap from './components/Incubator/GalaxyMap';
import CreateProjectModal from './components/Incubator/CreateProjectModal';
import SystemLogs from './components/Logs/SystemLogs';
import StatusView from './components/Status/StatusView';
import WarpEffect from './components/Viewscreen/WarpEffect';
import TransporterEffect from './components/Viewscreen/TransporterEffect';
import ShieldEffect from './components/Viewscreen/ShieldEffect';
import ScanSweep from './components/Viewscreen/ScanSweep';
import { useUIStore } from './stores/uiStore';
import { useProjectStore } from './stores/projectStore';
import { useAgentStore } from './stores/agentStore';
import { useWebSocket } from './hooks/useWebSocket';
import type { Agent } from './types';

export default function App() {
  const {
    currentView, sidebarCollapsed, showCRT, showConsolePanel, consolePanelAgentId,
    showLaunchModal,
    setView, toggleSidebar, openLaunchModal, closeLaunchModal, toggleProjectDetail, openConsole, closeConsole,
  } = useUIStore();
  const { projects, activeProjectId } = useProjectStore();
  const { agents } = useAgentStore();
  const { sendMessage, connectionStatus } = useWebSocket();

  // Visual effect states
  const [warpActive, setWarpActive] = useState(false);
  const [shieldActive, setShieldActive] = useState(false);
  const [transporterActive, setTransporterActive] = useState(false);
  const [transporterPos, setTransporterPos] = useState({ x: 0, y: 0 });
  const [showCreateProject, setShowCreateProject] = useState(false);

  const activeProject = activeProjectId ? projects[activeProjectId] : null;

  // Get agents for the active project
  const projectAgents: Agent[] = useMemo(() => {
    if (!activeProject) return [];
    return Object.values(agents).filter(a => a.projectId === activeProject.id);
  }, [agents, activeProject]);

  // Get selected agent for console panel
  const selectedAgent = consolePanelAgentId ? agents[consolePanelAgentId] : null;

  // Red Alert handler — shield flash + kill all agents
  const handleRedAlert = useCallback(() => {
    setShieldActive(true);
    Object.values(agents).forEach(agent => {
      if (agent.status === 'active' || agent.status === 'launching') {
        sendMessage({ type: 'agent:kill', agentId: agent.id });
      }
    });
  }, [agents, sendMessage]);

  // Launch modal with warp effect
  const handleLaunchAgent = useCallback(() => {
    openLaunchModal();
  }, [openLaunchModal]);

  // View navigation with warp transition
  const handleNavigate = useCallback((view: string) => {
    if (view !== currentView) {
      setWarpActive(true);
      setTimeout(() => {
        setView(view as any);
      }, 400);
    }
  }, [currentView, setView]);

  return (
    <div className="app">
      {/* Background Layers */}
      <Starfield />
      <AmbientParticles />
      <ScanlineOverlay visible={showCRT} />

      {/* Scan Sweep Radar — visible in tactical view */}
      {currentView === 'tactical' && <ScanSweep active />}

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

      {/* Mission Planning View */}
      {currentView === 'planning' && (
        <MissionPlanning sendMessage={sendMessage} />
      )}

      {/* Project Incubator / Galaxy Map View */}
      {currentView === 'incubator' && (
        <GalaxyMap onCreateProject={() => setShowCreateProject(true)} />
      )}

      {/* System Logs View */}
      {currentView === 'logs' && <SystemLogs />}

      {/* Ship Status View */}
      {currentView === 'status' && <StatusView />}

      {/* HUD Overlay */}
      <HUD
        activeView={currentView}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        onLaunchAgent={handleLaunchAgent}
        onRedAlert={handleRedAlert}
        onHail={() => {
          const active = Object.values(agents).find(a => a.status === 'active');
          if (active) openConsole(active.id);
        }}
        onScan={() => {
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

      {/* Launch Agent Modal */}
      {showLaunchModal && (
        <LaunchModal
          onClose={closeLaunchModal}
          sendMessage={sendMessage}
        />
      )}

      {/* Create Project Modal */}
      {showCreateProject && (
        <CreateProjectModal
          onClose={() => setShowCreateProject(false)}
          sendMessage={sendMessage}
        />
      )}

      {/* Visual Effects */}
      <WarpEffect
        active={warpActive}
        onComplete={() => setWarpActive(false)}
      />
      <ShieldEffect
        active={shieldActive}
        onComplete={() => setShieldActive(false)}
      />
      <TransporterEffect
        active={transporterActive}
        x={transporterPos.x}
        y={transporterPos.y}
        onComplete={() => setTransporterActive(false)}
      />

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
