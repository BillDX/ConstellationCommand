import React, { useState, useCallback, useMemo } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useAgentStore } from '../../stores/agentStore';
import { usePlanningStore } from '../../stores/planningStore';
import { useUIStore } from '../../stores/uiStore';
import { generateId } from '../../utils/generateId';

/* ============================================================
   MissionPlanning - Mission Briefing / Task Planning View

   Full-screen view styled like a military briefing document on
   a sci-fi command screen. Allows the commander to define tasks,
   assign agents, and launch missions.
   ============================================================ */

interface MissionPlanningProps {
  sendMessage: (msg: any) => void;
  onWarp?: () => void;
}

/* ---------- Status Color Helper ---------- */

function getAgentStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'var(--green-success, #00ff88)';
    case 'launching':
      return 'var(--amber-alert, #ff9f1c)';
    case 'completed':
      return '#5a7a9a';
    case 'error':
      return 'var(--red-alert, #ff3344)';
    default:
      return 'var(--text-secondary, #7a8ba8)';
  }
}

/* ==========================================================
   Main Component
   ========================================================== */

export default function MissionPlanning({ sendMessage, onWarp }: MissionPlanningProps) {
  const { projects, activeProjectId } = useProjectStore();
  const { agents } = useAgentStore();
  const { setView } = useUIStore();
  const planningStore = usePlanningStore();

  const activeProject = activeProjectId ? projects[activeProjectId] : null;

  const tasks = activeProjectId ? planningStore.getProjectTasks(activeProjectId) : [];
  const [newTaskText, setNewTaskText] = useState('');
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  /* ---------- Project Agents ---------- */
  const projectAgents = useMemo(() => {
    if (!activeProject) return [];
    return Object.values(agents).filter((a) => a.projectId === activeProject.id);
  }, [agents, activeProject]);

  /* ---------- Assigned Agents Map ---------- */
  const assignedAgents = useMemo(() => {
    const map: Record<string, typeof projectAgents> = {};
    for (const task of tasks) {
      if (task.agentId) {
        const agent = agents[task.agentId];
        if (agent) {
          if (!map[task.id]) map[task.id] = [];
          map[task.id].push(agent);
        }
      }
    }
    // Also find agents by matching task text
    for (const task of tasks) {
      for (const agent of projectAgents) {
        if (agent.task === task.text && !task.agentId) {
          if (!map[task.id]) map[task.id] = [];
          if (!map[task.id].find((a) => a.id === agent.id)) {
            map[task.id].push(agent);
          }
        }
      }
    }
    return map;
  }, [tasks, agents, projectAgents]);

  /* ---------- Add Task ---------- */
  const handleAddTask = useCallback(() => {
    const text = newTaskText.trim();
    if (!text || !activeProjectId) return;
    planningStore.addTask(activeProjectId, text);
    setNewTaskText('');
  }, [newTaskText, activeProjectId, planningStore]);

  const handleAddTaskKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleAddTask();
      }
    },
    [handleAddTask],
  );

  /* ---------- Toggle Task ---------- */
  const handleToggleTask = useCallback((taskId: string) => {
    if (!activeProjectId) return;
    planningStore.toggleTask(activeProjectId, taskId);
  }, [activeProjectId, planningStore]);

  /* ---------- Remove Task ---------- */
  const handleRemoveTask = useCallback((taskId: string) => {
    if (!activeProjectId) return;
    planningStore.removeTask(activeProjectId, taskId);
  }, [activeProjectId, planningStore]);

  /* ---------- Build Full Task Prompt ---------- */
  const buildPrompt = useCallback((taskText: string) => {
    const parts: string[] = [];
    parts.push(`Project: ${activeProject?.name ?? 'Unknown'}`);
    if (activeProject?.description) {
      parts.push(`Description: ${activeProject.description}`);
    }
    if (tasks.length > 0) {
      const taskList = tasks.map((t, i) => `  ${i + 1}. ${t.completed ? '[DONE] ' : ''}${t.text}`).join('\n');
      parts.push(`Mission Plan:\n${taskList}`);
    }
    parts.push(`\nYour task: ${taskText}`);
    return parts.join('\n');
  }, [activeProject, tasks]);

  /* ---------- Launch Single Task ---------- */
  const handleLaunchTask = useCallback(
    (task: { id: string; text: string }) => {
      if (!activeProject || !activeProjectId) return;
      const agentId = generateId();
      const fullPrompt = buildPrompt(task.text);

      // Register agent in client store immediately
      useAgentStore.getState().addAgent({
        id: agentId,
        projectId: activeProject.id,
        task: task.text,
        cwd: activeProject.cwd,
        status: 'launching',
        launchedAt: Date.now(),
        filesChanged: 0,
        events: [],
      });

      planningStore.assignAgent(activeProjectId, task.id, agentId);
      sendMessage({
        type: 'agent:launch',
        id: agentId,
        projectId: activeProject.id,
        task: fullPrompt,
        cwd: activeProject.cwd,
      });

      // Navigate to tactical and open console
      setView('tactical');
      setTimeout(() => useUIStore.getState().openConsole(agentId), 800);
    },
    [activeProject, activeProjectId, sendMessage, planningStore, buildPrompt, setView],
  );

  /* ---------- Begin Mission (Launch All Unchecked) ---------- */
  const handleBeginMission = useCallback(() => {
    if (!activeProject || !activeProjectId) return;
    const uncompletedTasks = tasks.filter((t) => !t.completed && !t.agentId);
    let lastAgentId = '';

    for (const task of uncompletedTasks) {
      const agentId = generateId();
      lastAgentId = agentId;
      const fullPrompt = buildPrompt(task.text);

      // Register agent in client store immediately
      useAgentStore.getState().addAgent({
        id: agentId,
        projectId: activeProject.id,
        task: task.text,
        cwd: activeProject.cwd,
        status: 'launching',
        launchedAt: Date.now(),
        filesChanged: 0,
        events: [],
      });

      planningStore.assignAgent(activeProjectId, task.id, agentId);
      sendMessage({
        type: 'agent:launch',
        id: agentId,
        projectId: activeProject.id,
        task: fullPrompt,
        cwd: activeProject.cwd,
      });
    }

    // Trigger warp effect and navigate to tactical
    if (onWarp) onWarp();
    setTimeout(() => {
      setView('tactical');
      // Auto-open console for the last launched agent
      if (lastAgentId) {
        setTimeout(() => useUIStore.getState().openConsole(lastAgentId), 800);
      }
    }, 1000);
  }, [activeProject, activeProjectId, tasks, sendMessage, planningStore, buildPrompt, onWarp, setView]);

  /* ---------- Counts ---------- */
  const unlaunchedCount = tasks.filter((t) => !t.completed && !t.agentId).length;

  return (
    <div style={styles.container}>
      {/* Scan-line texture */}
      <div style={styles.scanlineTexture} />

      {/* Content area */}
      <div style={styles.content}>
        {/* ========== MISSION OBJECTIVE ========== */}
        <section style={styles.section}>
          <div style={styles.sectionHeaderBar}>
            <div style={styles.sectionHeaderDecorLeft} />
            <span style={styles.sectionLabel}>MISSION OBJECTIVE</span>
            <div style={styles.sectionHeaderDecorRight} />
          </div>

          <div style={styles.objectivePanel}>
            <div style={styles.objectiveClassification}>
              <span style={styles.classificationBadge}>CLASSIFIED</span>
              <span style={styles.classificationLevel}>PRIORITY ALPHA</span>
            </div>
            <h1 style={styles.objectiveTitle}>
              {activeProject?.name ?? 'NO PROJECT SELECTED'}
            </h1>
            <p style={styles.objectiveDescription}>
              {activeProject?.description ?? 'Select a project from the tactical view to begin mission planning.'}
            </p>
            <div style={styles.objectiveMeta}>
              <span style={styles.metaItem}>
                <span style={styles.metaLabel}>STATUS</span>
                <span style={{
                  ...styles.metaValue,
                  color: activeProject?.status === 'active'
                    ? 'var(--green-success, #00ff88)'
                    : 'var(--text-secondary, #7a8ba8)',
                }}>
                  {(activeProject?.status ?? 'STANDBY').toUpperCase()}
                </span>
              </span>
              <span style={styles.metaDivider} />
              <span style={styles.metaItem}>
                <span style={styles.metaLabel}>CWD</span>
                <span style={styles.metaValueMono}>
                  {activeProject?.cwd ?? '---'}
                </span>
              </span>
              <span style={styles.metaDivider} />
              <span style={styles.metaItem}>
                <span style={styles.metaLabel}>PROGRESS</span>
                <span style={styles.metaValue}>
                  {activeProject?.progress ?? 0}%
                </span>
              </span>
            </div>
          </div>
        </section>

        {/* ========== MISSION PLAN ========== */}
        <section style={styles.section}>
          <div style={styles.sectionHeaderBar}>
            <div style={styles.sectionHeaderDecorLeft} />
            <span style={styles.sectionLabel}>MISSION PLAN</span>
            <div style={styles.sectionHeaderDecorRight} />
          </div>

          <div style={styles.taskListPanel}>
            {tasks.length === 0 && (
              <div style={styles.emptyState}>
                <span style={styles.emptyStateIcon}>{'\u25C7'}</span>
                <span style={styles.emptyStateText}>
                  No tasks defined. Add tasks below to plan your mission.
                </span>
              </div>
            )}

            {tasks.map((task, index) => {
              const isHovered = hoveredTaskId === task.id;
              const taskAgents = assignedAgents[task.id] || [];
              const hasAgent = !!task.agentId || taskAgents.length > 0;

              return (
                <div
                  key={task.id}
                  style={{
                    ...styles.taskRow,
                    background: isHovered
                      ? 'rgba(0, 200, 255, 0.06)'
                      : index % 2 === 0
                      ? 'rgba(0, 0, 0, 0.15)'
                      : 'transparent',
                    borderLeft: task.completed
                      ? '2px solid var(--green-success, #00ff88)'
                      : hasAgent
                      ? '2px solid var(--amber-alert, #ff9f1c)'
                      : '2px solid rgba(0, 200, 255, 0.15)',
                  }}
                  onMouseEnter={() => setHoveredTaskId(task.id)}
                  onMouseLeave={() => setHoveredTaskId(null)}
                >
                  {/* Task Number */}
                  <span style={styles.taskNumber}>
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  {/* Toggle Checkbox */}
                  <button
                    onClick={() => handleToggleTask(task.id)}
                    style={{
                      ...styles.taskToggle,
                      borderColor: task.completed
                        ? 'var(--green-success, #00ff88)'
                        : 'rgba(0, 200, 255, 0.4)',
                      background: task.completed
                        ? 'rgba(0, 255, 136, 0.15)'
                        : 'rgba(0, 0, 0, 0.3)',
                      boxShadow: task.completed
                        ? '0 0 8px rgba(0, 255, 136, 0.3), inset 0 0 6px rgba(0, 255, 136, 0.1)'
                        : '0 0 4px rgba(0, 200, 255, 0.1)',
                    }}
                    aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {task.completed && (
                      <span style={styles.taskToggleCheck}>{'\u2713'}</span>
                    )}
                    {!task.completed && (
                      <span style={styles.taskToggleDot} />
                    )}
                  </button>

                  {/* Task Text */}
                  <span
                    style={{
                      ...styles.taskText,
                      textDecoration: task.completed ? 'line-through' : 'none',
                      opacity: task.completed ? 0.5 : 1,
                      color: task.completed
                        ? 'var(--text-secondary, #7a8ba8)'
                        : 'var(--text-primary, #e0f0ff)',
                    }}
                  >
                    {task.text}
                  </span>

                  {/* Agent Assignment Badge */}
                  {taskAgents.length > 0 && (
                    <span style={styles.taskAgentBadge}>
                      <span
                        style={{
                          ...styles.taskAgentDot,
                          backgroundColor: getAgentStatusColor(taskAgents[0].status),
                          boxShadow: `0 0 4px ${getAgentStatusColor(taskAgents[0].status)}`,
                        }}
                      />
                      <span style={styles.taskAgentLabel}>
                        {taskAgents[0].id.slice(0, 6).toUpperCase()}
                      </span>
                    </span>
                  )}

                  {/* Launch Button */}
                  {!task.completed && !hasAgent && (
                    <button
                      onClick={() => handleLaunchTask(task)}
                      onMouseEnter={() => setHoveredButton(`launch-${task.id}`)}
                      onMouseLeave={() => setHoveredButton(null)}
                      style={{
                        ...styles.taskLaunchButton,
                        boxShadow: hoveredButton === `launch-${task.id}`
                          ? '0 0 12px rgba(0, 200, 255, 0.5), inset 0 0 8px rgba(0, 200, 255, 0.1)'
                          : '0 0 6px rgba(0, 200, 255, 0.2)',
                        background: hoveredButton === `launch-${task.id}`
                          ? 'rgba(0, 200, 255, 0.12)'
                          : 'linear-gradient(180deg, rgba(0, 200, 255, 0.06) 0%, rgba(0, 200, 255, 0.02) 100%)',
                      }}
                    >
                      LAUNCH
                    </button>
                  )}

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveTask(task.id)}
                    onMouseEnter={() => setHoveredButton(`remove-${task.id}`)}
                    onMouseLeave={() => setHoveredButton(null)}
                    style={{
                      ...styles.taskRemoveButton,
                      opacity: isHovered || hoveredButton === `remove-${task.id}` ? 0.8 : 0.2,
                      color: hoveredButton === `remove-${task.id}`
                        ? 'var(--red-alert, #ff3344)'
                        : 'var(--text-secondary, #7a8ba8)',
                    }}
                    aria-label="Remove task"
                  >
                    {'\u2715'}
                  </button>
                </div>
              );
            })}

            {/* Add Task Input */}
            <div style={styles.addTaskRow}>
              <span style={styles.addTaskIcon}>{'\u002B'}</span>
              <input
                type="text"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                onKeyDown={handleAddTaskKeyDown}
                placeholder="Add new task directive..."
                style={styles.addTaskInput}
                spellCheck={false}
              />
              <button
                onClick={handleAddTask}
                onMouseEnter={() => setHoveredButton('add-task')}
                onMouseLeave={() => setHoveredButton(null)}
                style={{
                  ...styles.addTaskButton,
                  opacity: newTaskText.trim() ? 1 : 0.4,
                  boxShadow: hoveredButton === 'add-task' && newTaskText.trim()
                    ? '0 0 10px rgba(0, 200, 255, 0.4)'
                    : '0 0 4px rgba(0, 200, 255, 0.15)',
                }}
                disabled={!newTaskText.trim()}
              >
                ADD
              </button>
            </div>
          </div>
        </section>

        {/* ========== CREW ASSIGNMENT ========== */}
        <section style={styles.section}>
          <div style={styles.sectionHeaderBar}>
            <div style={styles.sectionHeaderDecorLeft} />
            <span style={styles.sectionLabel}>CREW ASSIGNMENT</span>
            <div style={styles.sectionHeaderDecorRight} />
          </div>

          <div style={styles.crewPanel}>
            {projectAgents.length === 0 && (
              <div style={styles.emptyState}>
                <span style={styles.emptyStateIcon}>{'\u2B21'}</span>
                <span style={styles.emptyStateText}>
                  No agents deployed. Launch tasks to assign crew members.
                </span>
              </div>
            )}

            {projectAgents.map((agent) => {
              const assignedTask = tasks.find((t) => t.agentId === agent.id);
              return (
                <div key={agent.id} style={styles.crewRow}>
                  {/* Status Indicator */}
                  <span
                    style={{
                      ...styles.crewStatusDot,
                      backgroundColor: getAgentStatusColor(agent.status),
                      boxShadow: `0 0 6px ${getAgentStatusColor(agent.status)}`,
                      animation:
                        agent.status === 'active' || agent.status === 'launching'
                          ? 'pulse-glow 2s ease-in-out infinite'
                          : 'none',
                    }}
                  />

                  {/* Agent ID */}
                  <span style={styles.crewAgentId}>
                    {agent.id.slice(0, 8).toUpperCase()}
                  </span>

                  {/* Status Label */}
                  <span
                    style={{
                      ...styles.crewStatusLabel,
                      color: getAgentStatusColor(agent.status),
                    }}
                  >
                    {agent.status.toUpperCase()}
                  </span>

                  {/* Divider */}
                  <span style={styles.crewDivider} />

                  {/* Task Assignment */}
                  <span style={styles.crewTaskText}>
                    {assignedTask?.text ?? agent.task ?? 'Unassigned'}
                  </span>

                  {/* Files Changed */}
                  <span style={styles.crewFilesCount}>
                    {agent.filesChanged} files
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========== BEGIN MISSION BUTTON ========== */}
        <div style={styles.missionLaunchArea}>
          <div style={styles.missionLaunchDecorLine} />
          <button
            onClick={handleBeginMission}
            onMouseEnter={() => setHoveredButton('begin-mission')}
            onMouseLeave={() => setHoveredButton(null)}
            disabled={unlaunchedCount === 0}
            style={{
              ...styles.beginMissionButton,
              opacity: unlaunchedCount === 0 ? 0.35 : 1,
              cursor: unlaunchedCount === 0 ? 'not-allowed' : 'pointer',
              boxShadow: hoveredButton === 'begin-mission' && unlaunchedCount > 0
                ? '0 0 25px rgba(0, 200, 255, 0.6), 0 0 50px rgba(0, 200, 255, 0.2), inset 0 0 20px rgba(0, 200, 255, 0.1)'
                : '0 0 15px rgba(0, 200, 255, 0.3), inset 0 0 10px rgba(0, 200, 255, 0.05)',
              transform: hoveredButton === 'begin-mission' && unlaunchedCount > 0
                ? 'scale(1.02)'
                : 'scale(1)',
            }}
          >
            <span style={styles.beginMissionIcon}>{'\u25B6'}</span>
            <span style={styles.beginMissionLabel}>BEGIN MISSION</span>
            {unlaunchedCount > 0 && (
              <span style={styles.beginMissionCount}>
                {unlaunchedCount} TASK{unlaunchedCount !== 1 ? 'S' : ''}
              </span>
            )}
          </button>
          <div style={styles.missionLaunchDecorLine} />
        </div>
      </div>
    </div>
  );
}

/* ==========================================================
   Styles
   ========================================================== */

const styles: Record<string, React.CSSProperties> = {
  /* --- Container --- */
  container: {
    position: 'fixed',
    top: 48,
    left: 220,
    right: 0,
    bottom: 64,
    overflow: 'hidden',
    zIndex: 50,
    animation: 'fade-in 0.4s ease-out',
  },

  scanlineTexture: {
    position: 'absolute',
    inset: 0,
    background:
      'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 200, 255, 0.012) 2px, rgba(0, 200, 255, 0.012) 4px)',
    pointerEvents: 'none',
    zIndex: 1,
  },

  content: {
    position: 'relative',
    zIndex: 2,
    height: '100%',
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '28px 32px 40px',
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
    scrollbarWidth: 'thin' as any,
    scrollbarColor: 'rgba(0, 200, 255, 0.2) transparent',
  },

  /* --- Section --- */
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },

  sectionHeaderBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },

  sectionHeaderDecorLeft: {
    width: 20,
    height: 1,
    background: 'linear-gradient(90deg, transparent, var(--cyan-glow, #00c8ff))',
  },

  sectionLabel: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '3px',
    color: 'var(--cyan-glow, #00c8ff)',
    textShadow: '0 0 10px rgba(0, 200, 255, 0.4)',
    whiteSpace: 'nowrap',
  },

  sectionHeaderDecorRight: {
    flex: 1,
    height: 1,
    background: 'linear-gradient(90deg, var(--cyan-glow, #00c8ff), transparent)',
  },

  /* --- Mission Objective Panel --- */
  objectivePanel: {
    background: 'var(--panel-bg, rgba(13, 19, 33, 0.85))',
    border: '1px solid var(--panel-border, rgba(0, 200, 255, 0.3))',
    borderRadius: 2,
    padding: '20px 24px',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 0 20px rgba(0, 0, 0, 0.3), inset 0 0 30px rgba(0, 200, 255, 0.02)',
  },

  objectiveClassification: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },

  classificationBadge: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '8px',
    fontWeight: 700,
    letterSpacing: '2px',
    color: 'var(--red-alert, #ff3344)',
    padding: '2px 8px',
    border: '1px solid rgba(255, 51, 68, 0.4)',
    background: 'rgba(255, 51, 68, 0.08)',
  },

  classificationLevel: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '8px',
    fontWeight: 700,
    letterSpacing: '2px',
    color: 'var(--amber-alert, #ff9f1c)',
  },

  objectiveTitle: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '22px',
    fontWeight: 700,
    letterSpacing: '3px',
    color: 'var(--text-primary, #e0f0ff)',
    textShadow: '0 0 12px rgba(224, 240, 255, 0.2)',
    margin: '0 0 8px 0',
    textTransform: 'uppercase' as const,
  },

  objectiveDescription: {
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '15px',
    fontWeight: 500,
    lineHeight: '1.5',
    color: 'var(--text-secondary, #7a8ba8)',
    margin: '0 0 16px 0',
    maxWidth: 600,
  },

  objectiveMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    paddingTop: 12,
    borderTop: '1px solid rgba(0, 200, 255, 0.1)',
  },

  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },

  metaLabel: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '8px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    color: 'var(--text-secondary, #7a8ba8)',
    opacity: 0.7,
  },

  metaValue: {
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '1px',
    color: 'var(--text-primary, #e0f0ff)',
  },

  metaValueMono: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '11px',
    fontWeight: 400,
    letterSpacing: '0.5px',
    color: 'var(--text-primary, #e0f0ff)',
    opacity: 0.8,
  },

  metaDivider: {
    width: 1,
    height: 16,
    background: 'rgba(0, 200, 255, 0.2)',
  },

  /* --- Task List Panel --- */
  taskListPanel: {
    background: 'var(--panel-bg, rgba(13, 19, 33, 0.85))',
    border: '1px solid var(--panel-border, rgba(0, 200, 255, 0.3))',
    borderRadius: 2,
    overflow: 'hidden',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 0 20px rgba(0, 0, 0, 0.3), inset 0 0 30px rgba(0, 200, 255, 0.02)',
  },

  /* --- Empty State --- */
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '32px 20px',
    opacity: 0.5,
  },

  emptyStateIcon: {
    fontSize: '24px',
    color: 'var(--cyan-glow, #00c8ff)',
    opacity: 0.4,
  },

  emptyStateText: {
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-secondary, #7a8ba8)',
    textAlign: 'center' as const,
    letterSpacing: '0.5px',
  },

  /* --- Task Row --- */
  taskRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    borderBottom: '1px solid rgba(0, 200, 255, 0.06)',
    transition: 'background 0.15s ease',
  },

  taskNumber: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '1px',
    color: 'var(--text-secondary, #7a8ba8)',
    opacity: 0.4,
    width: 20,
    textAlign: 'right' as const,
    flexShrink: 0,
  },

  taskToggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    border: '1px solid',
    borderRadius: 2,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    flexShrink: 0,
    fontFamily: 'inherit',
    padding: 0,
  },

  taskToggleCheck: {
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--green-success, #00ff88)',
    textShadow: '0 0 6px rgba(0, 255, 136, 0.5)',
  },

  taskToggleDot: {
    width: 4,
    height: 4,
    borderRadius: '50%',
    background: 'rgba(0, 200, 255, 0.25)',
  },

  taskText: {
    flex: 1,
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '14px',
    fontWeight: 500,
    letterSpacing: '0.3px',
    transition: 'opacity 0.2s ease',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  taskAgentBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '2px 8px',
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(0, 200, 255, 0.15)',
    borderRadius: 2,
    flexShrink: 0,
  },

  taskAgentDot: {
    display: 'inline-block',
    width: 5,
    height: 5,
    borderRadius: '50%',
  },

  taskAgentLabel: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '9px',
    fontWeight: 600,
    letterSpacing: '1px',
    color: 'var(--text-secondary, #7a8ba8)',
  },

  taskLaunchButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 26,
    padding: '0 14px',
    border: '1px solid var(--cyan-glow, #00c8ff)',
    borderRadius: 1,
    color: 'var(--cyan-glow, #00c8ff)',
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '8px',
    fontWeight: 700,
    letterSpacing: '2px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    flexShrink: 0,
    clipPath: 'polygon(4px 0%, calc(100% - 4px) 0%, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0% calc(100% - 4px), 0% 4px)',
  },

  taskRemoveButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    border: 'none',
    background: 'transparent',
    fontSize: '10px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    flexShrink: 0,
    fontFamily: 'inherit',
    padding: 0,
  },

  /* --- Add Task Row --- */
  addTaskRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    borderTop: '1px solid rgba(0, 200, 255, 0.1)',
    background: 'rgba(0, 200, 255, 0.02)',
  },

  addTaskIcon: {
    fontSize: '16px',
    color: 'var(--cyan-glow, #00c8ff)',
    opacity: 0.5,
    flexShrink: 0,
    width: 20,
    textAlign: 'center' as const,
  },

  addTaskInput: {
    flex: 1,
    height: 32,
    padding: '0 12px',
    background: 'rgba(10, 14, 23, 0.8)',
    border: '1px solid rgba(0, 200, 255, 0.2)',
    borderRadius: 2,
    color: 'var(--text-primary, #e0f0ff)',
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '13px',
    fontWeight: 500,
    letterSpacing: '0.5px',
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    boxShadow: 'inset 0 0 8px rgba(0, 0, 0, 0.3)',
  },

  addTaskButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    padding: '0 16px',
    border: '1px solid var(--cyan-glow, #00c8ff)',
    borderRadius: 1,
    background: 'linear-gradient(180deg, rgba(0, 200, 255, 0.06) 0%, rgba(0, 200, 255, 0.02) 100%)',
    color: 'var(--cyan-glow, #00c8ff)',
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '2px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    flexShrink: 0,
  },

  /* --- Crew Assignment Panel --- */
  crewPanel: {
    background: 'var(--panel-bg, rgba(13, 19, 33, 0.85))',
    border: '1px solid var(--panel-border, rgba(0, 200, 255, 0.3))',
    borderRadius: 2,
    overflow: 'hidden',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 0 20px rgba(0, 0, 0, 0.3), inset 0 0 30px rgba(0, 200, 255, 0.02)',
  },

  crewRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    borderBottom: '1px solid rgba(0, 200, 255, 0.06)',
  },

  crewStatusDot: {
    display: 'inline-block',
    width: 7,
    height: 7,
    borderRadius: '50%',
    flexShrink: 0,
  },

  crewAgentId: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '1.5px',
    color: 'var(--cyan-glow, #00c8ff)',
    textShadow: '0 0 6px rgba(0, 200, 255, 0.3)',
    flexShrink: 0,
    width: 80,
  },

  crewStatusLabel: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '8px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    flexShrink: 0,
    width: 80,
  },

  crewDivider: {
    width: 1,
    height: 16,
    background: 'rgba(0, 200, 255, 0.15)',
    flexShrink: 0,
  },

  crewTaskText: {
    flex: 1,
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-primary, #e0f0ff)',
    opacity: 0.8,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },

  crewFilesCount: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '10px',
    fontWeight: 400,
    color: 'var(--text-secondary, #7a8ba8)',
    opacity: 0.6,
    flexShrink: 0,
    letterSpacing: '0.5px',
  },

  /* --- Begin Mission Button Area --- */
  missionLaunchArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    padding: '8px 0 16px',
  },

  missionLaunchDecorLine: {
    flex: 1,
    height: 1,
    background: 'linear-gradient(90deg, transparent, rgba(0, 200, 255, 0.3), transparent)',
  },

  beginMissionButton: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 52,
    padding: '0 40px',
    border: '2px solid var(--cyan-glow, #00c8ff)',
    background: 'linear-gradient(180deg, rgba(0, 200, 255, 0.1) 0%, rgba(0, 200, 255, 0.03) 100%)',
    color: 'var(--cyan-glow, #00c8ff)',
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '4px',
    textTransform: 'uppercase' as const,
    transition: 'all 0.2s ease',
    clipPath: 'polygon(12px 0%, calc(100% - 12px) 0%, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0% calc(100% - 12px), 0% 12px)',
    textShadow: '0 0 12px rgba(0, 200, 255, 0.5)',
    flexShrink: 0,
  },

  beginMissionIcon: {
    fontSize: '12px',
    filter: 'drop-shadow(0 0 4px rgba(0, 200, 255, 0.5))',
  },

  beginMissionLabel: {
    position: 'relative',
    zIndex: 1,
  },

  beginMissionCount: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '1px',
    padding: '2px 8px',
    background: 'rgba(0, 200, 255, 0.15)',
    border: '1px solid rgba(0, 200, 255, 0.3)',
    borderRadius: 2,
    color: 'var(--text-primary, #e0f0ff)',
  },
};
