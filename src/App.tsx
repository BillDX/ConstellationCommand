import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
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
import EmptyTactical from './components/Viewscreen/EmptyTactical';
import WelcomeOverlay from './components/Welcome/WelcomeOverlay';
import LoginOverlay from './components/Auth/LoginOverlay';
import ToastContainer from './components/Feedback/ToastContainer';
import AgentStatusStrip from './components/Feedback/AgentStatusStrip';
import { useUIStore } from './stores/uiStore';
import { useProjectStore } from './stores/projectStore';
import { useAgentStore } from './stores/agentStore';
import { useFlowStore } from './stores/flowStore';
import { useAuthStore } from './stores/authStore';
import { useWebSocket } from './hooks/useWebSocket';
import type { Agent } from './types';

/* ---------- View title mapping ---------- */
const VIEW_SUBTITLES: Record<string, string> = {
  tactical: 'ACTIVE MISSIONS',
  incubator: 'PROJECT INCUBATOR',
  planning: 'MISSION PLANNING',
  logs: 'SYSTEM LOGS',
  status: 'SHIP STATUS',
};

export default function App() {
  const {
    currentView, sidebarCollapsed, showCRT, showConsolePanel, consolePanelAgentId,
    showLaunchModal,
    setView, toggleSidebar, openLaunchModal, closeLaunchModal, toggleProjectDetail, openConsole, closeConsole,
  } = useUIStore();
  const { projects, activeProjectId } = useProjectStore();
  const { agents } = useAgentStore();
  const { phase, suggestedView, welcomeSeen, computePhase, addToast } = useFlowStore();
  const { phase: authPhase, token: authToken, checkStatus: checkAuthStatus } = useAuthStore();
  const { sendMessage, connectionStatus } = useWebSocket(authToken);

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Visual effect states
  const [warpActive, setWarpActive] = useState(false);
  const [shieldActive, setShieldActive] = useState(false);
  const [transporterActive, setTransporterActive] = useState(false);
  const [transporterPos, setTransporterPos] = useState({ x: 0, y: 0 });
  const [showCreateProject, setShowCreateProject] = useState(false);

  const activeProject = activeProjectId ? projects[activeProjectId] : null;

  // Agent lists
  const agentList = useMemo(() => Object.values(agents), [agents]);
  const activeAgents = useMemo(() => agentList.filter(a => a.status === 'active' || a.status === 'launching'), [agentList]);
  const completedAgents = useMemo(() => agentList.filter(a => a.status === 'completed'), [agentList]);

  // Get agents for the active project
  const projectAgents: Agent[] = useMemo(() => {
    if (!activeProject) return [];
    return agentList.filter(a => a.projectId === activeProject.id);
  }, [agentList, activeProject]);

  // Get selected agent for console panel
  const selectedAgent = consolePanelAgentId ? agents[consolePanelAgentId] : null;

  // Compute flow phase whenever projects/agents change
  useEffect(() => {
    computePhase(Object.keys(projects).length, activeAgents.length, completedAgents.length);
  }, [projects, activeAgents.length, completedAgents.length, computePhase]);

  // Track previous agent count for auto-open and toasts
  const prevAgentCountRef = useRef(agentList.length);
  const prevAgentStatusRef = useRef<Record<string, string>>({});

  useEffect(() => {
    // Detect new agents for transporter effect + auto-open console
    if (agentList.length > prevAgentCountRef.current) {
      setTransporterActive(true);
      setTransporterPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

      // Auto-open console when only 1 active agent
      if (activeAgents.length === 1) {
        setTimeout(() => {
          openConsole(activeAgents[0].id);
        }, 1000);
      }
    }
    prevAgentCountRef.current = agentList.length;

    // Detect status changes for toasts and effects
    for (const agent of agentList) {
      const prevStatus = prevAgentStatusRef.current[agent.id];
      if (prevStatus && prevStatus !== agent.status) {
        if (agent.status === 'completed') {
          setTransporterActive(true);
          addToast({
            type: 'success',
            title: 'MISSION COMPLETE',
            message: `Agent ${agent.id.slice(0, 6).toUpperCase()} completed`,
            duration: 5000,
            action: { label: 'VIEW', view: 'tactical' },
          });
        } else if (agent.status === 'error') {
          setShieldActive(true);
          addToast({
            type: 'error',
            title: 'AGENT ERROR',
            message: `Agent ${agent.id.slice(0, 6).toUpperCase()} encountered an error`,
            duration: 8000,
          });
        }
      }
      prevAgentStatusRef.current[agent.id] = agent.status;
    }
  }, [agentList, activeAgents, openConsole, addToast]);

  // Auto-open create project modal when arriving at incubator from welcome
  const prevViewRef = useRef(currentView);
  useEffect(() => {
    if (currentView === 'incubator' && prevViewRef.current !== 'incubator' && Object.keys(projects).length === 0) {
      setTimeout(() => setShowCreateProject(true), 500);
    }
    prevViewRef.current = currentView;
  }, [currentView, projects]);

  // Red Alert handler — shield flash + kill all agents
  const handleRedAlert = useCallback(() => {
    setShieldActive(true);
    Object.values(agents).forEach(agent => {
      if (agent.status === 'active' || agent.status === 'launching') {
        sendMessage({ type: 'agent:kill', agentId: agent.id });
      }
    });
  }, [agents, sendMessage]);

  // Phase-aware primary action button
  const handlePrimaryAction = useCallback(() => {
    if (phase === 'welcome' || phase === 'project-created') {
      // Navigate to incubator or planning
      if (phase === 'welcome') {
        setWarpActive(true);
        setTimeout(() => setView('incubator'), 400);
      } else {
        setWarpActive(true);
        setTimeout(() => setView('planning'), 400);
      }
    } else if (phase === 'agents-complete') {
      // Run tests - open launch modal pre-filled
      openLaunchModal();
    } else {
      openLaunchModal();
    }
  }, [phase, setView, openLaunchModal]);

  // View navigation with warp transition
  const handleNavigate = useCallback((view: string) => {
    if (view !== currentView) {
      setWarpActive(true);
      setTimeout(() => {
        setView(view as any);
      }, 400);
    }
  }, [currentView, setView]);

  // Warp trigger for MissionPlanning BEGIN MISSION
  const handleMissionWarp = useCallback(() => {
    setWarpActive(true);
  }, []);

  // Badge counts for sidebar
  const badgeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (activeAgents.length > 0) counts.tactical = activeAgents.length;
    return counts;
  }, [activeAgents.length]);

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

      {/* Empty Tactical - no active project */}
      {currentView === 'tactical' && !activeProject && <EmptyTactical />}

      {/* Mission Planning View */}
      {currentView === 'planning' && (
        <MissionPlanning sendMessage={sendMessage} onWarp={handleMissionWarp} />
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
        title={activeProject?.name ?? 'NO ACTIVE MISSION'}
        subtitle={VIEW_SUBTITLES[currentView] ?? 'ACTIVE MISSIONS'}
        activeView={currentView}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        onLaunchAgent={handlePrimaryAction}
        onRedAlert={handleRedAlert}
        onHail={() => {
          const active = Object.values(agents).find(a => a.status === 'active');
          if (active) openConsole(active.id);
        }}
        onScan={() => {
          sendMessage({ type: 'state:request' });
        }}
        suggestedView={suggestedView}
        badgeCounts={badgeCounts}
        phase={phase}
      />

      {/* Agent Status Strip */}
      <AgentStatusStrip />

      {/* Toast Notifications */}
      <ToastContainer />

      {/* Auth Overlay */}
      {authPhase !== 'authenticated' && <LoginOverlay />}

      {/* Welcome Overlay */}
      {phase === 'welcome' && !welcomeSeen && <WelcomeOverlay />}

      {/* Agent Console Panel */}
      {showConsolePanel && consolePanelAgentId && selectedAgent && (
        <AgentConsole
          agentId={consolePanelAgentId}
          onClose={closeConsole}
          sendMessage={sendMessage}
          authToken={authToken}
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
