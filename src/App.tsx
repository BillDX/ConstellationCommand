import React from 'react';
import Starfield from './components/Viewscreen/Starfield';
import AmbientParticles from './components/Viewscreen/AmbientParticles';
import ScanlineOverlay from './components/Viewscreen/ScanlineOverlay';
import Planet from './components/Viewscreen/Planet';
import HUD from './components/Viewscreen/HUD';
import { useUIStore } from './stores/uiStore';
import { useProjectStore } from './stores/projectStore';
import { useWebSocket } from './hooks/useWebSocket';

export default function App() {
  const { currentView, sidebarCollapsed, showCRT, setView, toggleSidebar, openLaunchModal, toggleProjectDetail } = useUIStore();
  const { projects, activeProjectId } = useProjectStore();
  const { connectionStatus } = useWebSocket();

  const activeProject = activeProjectId ? projects[activeProjectId] : null;

  return (
    <div className="app">
      {/* Background Layers */}
      <Starfield />
      <AmbientParticles />
      <ScanlineOverlay visible={showCRT} />

      {/* Main Content */}
      {currentView === 'tactical' && activeProject && (
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
      )}

      {/* HUD Overlay */}
      <HUD
        activeView={currentView}
        onNavigate={(view) => setView(view as any)}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        onLaunchAgent={openLaunchModal}
        onRedAlert={() => console.log('RED ALERT')}
        onHail={() => console.log('HAIL')}
        onScan={() => console.log('SCAN')}
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
