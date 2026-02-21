import React, { useState, useCallback, useMemo } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useAgentStore } from '../../stores/agentStore';
import { usePlanningStore } from '../../stores/planningStore';
import { useOrchestrationStore } from '../../stores/orchestrationStore';
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
  const colors: Record<string, string> = {
    active: '#00ff88', thinking: '#6366f1', coding: '#10b981',
    executing: '#00c8ff', scanning: '#14b8a6', downloading: '#38bdf8',
    building: '#f59e0b', testing: '#84cc16', waiting: '#ff9f1c',
    paused: '#64748b', launching: '#8b5cf6', completed: '#5a7a9a',
    error: '#ff3344',
  };
  return colors[status] || '#7a8ba8';
}

/* ==========================================================
   Main Component
   ========================================================== */

export default function MissionPlanning({ sendMessage, onWarp }: MissionPlanningProps) {
  const { projects, activeProjectId } = useProjectStore();
  const { agents } = useAgentStore();
  const { setView } = useUIStore();
  const planningStore = usePlanningStore();
  const { orchestrations } = useOrchestrationStore();

  const activeProject = activeProjectId ? projects[activeProjectId] : null;
  const orchestration = activeProjectId ? orchestrations[activeProjectId] ?? null : null;

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
        role: 'manual',
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
        role: 'manual',
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

  /* ---------- Initiate Orchestrated Mission ---------- */
  const handleInitiateMission = useCallback(() => {
    if (!activeProjectId) return;
    useOrchestrationStore.getState().startOrchestration(activeProjectId);
    sendMessage({
      type: 'orchestration:start',
      projectId: activeProjectId,
      maxConcurrentWorkers: 3,
    });
  }, [activeProjectId, sendMessage]);

  /* ---------- Approve Orchestrated Plan ---------- */
  const handleApprovePlan = useCallback(() => {
    if (!activeProjectId) return;
    sendMessage({
      type: 'orchestration:approve-plan',
      projectId: activeProjectId,
    });
    // Navigate to tactical to watch the workers
    if (onWarp) onWarp();
    setTimeout(() => {
      setView('tactical');
    }, 1000);
  }, [activeProjectId, sendMessage, onWarp, setView]);

  /* ---------- Abort Orchestration ---------- */
  const handleAbortOrchestration = useCallback(() => {
    if (!activeProjectId) return;
    sendMessage({
      type: 'orchestration:abort',
      projectId: activeProjectId,
    });
    useOrchestrationStore.getState().clearOrchestration(activeProjectId);
  }, [activeProjectId, sendMessage]);

  /* ---------- Counts ---------- */
  const unlaunchedCount = tasks.filter((t) => !t.completed && !t.agentId).length;
  const isOrchestrating = orchestration !== null && orchestration.phase !== 'completed' && orchestration.phase !== 'error';

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

        {/* ========== ORCHESTRATION STATUS ========== */}
        {orchestration && (
          <section style={styles.section}>
            <div style={styles.sectionHeaderBar}>
              <div style={styles.sectionHeaderDecorLeft} />
              <span style={styles.sectionLabel}>AUTONOMOUS ORCHESTRATION</span>
              <div style={styles.sectionHeaderDecorRight} />
            </div>

            <div style={styles.orchStatusPanel}>
              {/* Phase indicator */}
              <div style={styles.orchPhaseRow}>
                <span style={styles.orchPhaseLabel}>PHASE</span>
                <span style={{
                  ...styles.orchPhaseBadge,
                  color: orchestration.phase === 'completed' ? '#00ff88'
                    : orchestration.phase === 'error' ? '#ff3344'
                    : orchestration.phase === 'reviewing' ? '#ff9f1c'
                    : orchestration.phase === 'executing' ? '#00c8ff'
                    : '#8b5cf6',
                  borderColor: orchestration.phase === 'completed' ? 'rgba(0, 255, 136, 0.4)'
                    : orchestration.phase === 'error' ? 'rgba(255, 51, 68, 0.4)'
                    : orchestration.phase === 'reviewing' ? 'rgba(255, 159, 28, 0.4)'
                    : orchestration.phase === 'executing' ? 'rgba(0, 200, 255, 0.4)'
                    : 'rgba(139, 92, 246, 0.4)',
                  background: orchestration.phase === 'completed' ? 'rgba(0, 255, 136, 0.08)'
                    : orchestration.phase === 'error' ? 'rgba(255, 51, 68, 0.08)'
                    : orchestration.phase === 'reviewing' ? 'rgba(255, 159, 28, 0.08)'
                    : orchestration.phase === 'executing' ? 'rgba(0, 200, 255, 0.08)'
                    : 'rgba(139, 92, 246, 0.08)',
                }}>
                  {orchestration.phase === 'initializing' && '\u25CB INITIALIZING'}
                  {orchestration.phase === 'planning' && '\u25CF COORDINATOR PLANNING...'}
                  {orchestration.phase === 'reviewing' && '\u25C9 PLAN READY \u2014 REVIEW BELOW'}
                  {orchestration.phase === 'executing' && '\u25B6 WORKERS ACTIVE'}
                  {orchestration.phase === 'completing' && '\u25B6 COMPLETING'}
                  {orchestration.phase === 'completed' && '\u2713 MISSION COMPLETE'}
                  {orchestration.phase === 'error' && '\u2717 ERROR'}
                </span>

                {/* Abort button */}
                {isOrchestrating && (
                  <button
                    onClick={handleAbortOrchestration}
                    onMouseEnter={() => setHoveredButton('abort-orch')}
                    onMouseLeave={() => setHoveredButton(null)}
                    style={{
                      ...styles.orchAbortButton,
                      boxShadow: hoveredButton === 'abort-orch'
                        ? '0 0 12px rgba(255, 51, 68, 0.5)'
                        : '0 0 4px rgba(255, 51, 68, 0.2)',
                      background: hoveredButton === 'abort-orch'
                        ? 'rgba(255, 51, 68, 0.12)'
                        : 'rgba(255, 51, 68, 0.04)',
                    }}
                  >
                    ABORT
                  </button>
                )}
              </div>

              {/* Progress bar during execution */}
              {(orchestration.phase === 'executing' || orchestration.phase === 'completing' || orchestration.phase === 'completed') && orchestration.plan.length > 0 && (
                <div style={styles.orchProgressContainer}>
                  <div style={styles.orchProgressTrack}>
                    <div style={{
                      ...styles.orchProgressFill,
                      width: `${(orchestration.plan.filter(t => t.status === 'completed').length / orchestration.plan.length) * 100}%`,
                    }} />
                  </div>
                  <span style={styles.orchProgressText}>
                    {orchestration.plan.filter(t => t.status === 'completed').length} / {orchestration.plan.length} tasks
                  </span>
                </div>
              )}

              {/* Auto-generated plan (during reviewing) */}
              {orchestration.plan.length > 0 && (
                <div style={styles.orchPlanList}>
                  {orchestration.plan.map((task, idx) => {
                    const taskAgent = task.assignedAgent ? agents[task.assignedAgent] : null;
                    return (
                      <div key={task.id} style={{
                        ...styles.orchPlanTask,
                        borderLeft: task.status === 'completed' ? '2px solid #00ff88'
                          : task.status === 'failed' ? '2px solid #ff3344'
                          : task.status === 'in-progress' ? '2px solid #00c8ff'
                          : task.status === 'assigned' ? '2px solid #ff9f1c'
                          : '2px solid rgba(0, 200, 255, 0.15)',
                        background: idx % 2 === 0 ? 'rgba(0, 0, 0, 0.15)' : 'transparent',
                      }}>
                        <span style={styles.taskNumber}>{String(idx + 1).padStart(2, '0')}</span>
                        <span style={{
                          ...styles.orchTaskStatus,
                          color: task.status === 'completed' ? '#00ff88'
                            : task.status === 'failed' ? '#ff3344'
                            : task.status === 'in-progress' ? '#00c8ff'
                            : task.status === 'assigned' ? '#ff9f1c'
                            : '#7a8ba8',
                        }}>
                          {task.status === 'completed' ? '\u2713'
                            : task.status === 'failed' ? '\u2717'
                            : task.status === 'in-progress' ? '\u25B6'
                            : task.status === 'assigned' ? '\u25CB'
                            : '\u25CB'}
                        </span>
                        <div style={styles.orchTaskInfo}>
                          <span style={styles.orchTaskTitle}>{task.title}</span>
                          <span style={styles.orchTaskDesc}>{task.description}</span>
                        </div>
                        {taskAgent && (
                          <span style={styles.taskAgentBadge}>
                            <span style={{
                              ...styles.taskAgentDot,
                              backgroundColor: getAgentStatusColor(taskAgent.status),
                              boxShadow: `0 0 4px ${getAgentStatusColor(taskAgent.status)}`,
                            }} />
                            <span style={styles.taskAgentLabel}>
                              {taskAgent.id.slice(0, 6).toUpperCase()}
                            </span>
                          </span>
                        )}
                        {task.branch && (
                          <span style={styles.orchBranchBadge}>{task.branch}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Approve / Reject for reviewing phase */}
              {orchestration.phase === 'reviewing' && (
                <div style={styles.orchApprovalRow}>
                  <button
                    onClick={handleAbortOrchestration}
                    onMouseEnter={() => setHoveredButton('reject-plan')}
                    onMouseLeave={() => setHoveredButton(null)}
                    style={{
                      ...styles.cancelButton,
                      background: hoveredButton === 'reject-plan'
                        ? 'rgba(255, 51, 68, 0.08)'
                        : 'transparent',
                      borderColor: hoveredButton === 'reject-plan'
                        ? 'rgba(255, 51, 68, 0.4)'
                        : 'rgba(122, 139, 168, 0.3)',
                      color: hoveredButton === 'reject-plan'
                        ? '#ff3344'
                        : 'var(--text-secondary, #7a8ba8)',
                    }}
                  >
                    REJECT PLAN
                  </button>
                  <button
                    onClick={handleApprovePlan}
                    onMouseEnter={() => setHoveredButton('approve-plan')}
                    onMouseLeave={() => setHoveredButton(null)}
                    style={{
                      ...styles.beginMissionButton,
                      boxShadow: hoveredButton === 'approve-plan'
                        ? '0 0 25px rgba(0, 255, 136, 0.6), 0 0 50px rgba(0, 255, 136, 0.2), inset 0 0 20px rgba(0, 255, 136, 0.1)'
                        : '0 0 15px rgba(0, 255, 136, 0.3), inset 0 0 10px rgba(0, 255, 136, 0.05)',
                      borderColor: '#00ff88',
                      color: '#00ff88',
                      textShadow: '0 0 12px rgba(0, 255, 136, 0.5)',
                      transform: hoveredButton === 'approve-plan' ? 'scale(1.02)' : 'scale(1)',
                    }}
                  >
                    <span style={styles.beginMissionIcon}>{'\u2713'}</span>
                    <span style={styles.beginMissionLabel}>APPROVE &amp; DEPLOY</span>
                    <span style={styles.beginMissionCount}>
                      {orchestration.plan.length} TASK{orchestration.plan.length !== 1 ? 'S' : ''}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ========== MISSION PLAN (Manual) ========== */}
        <section style={styles.section}>
          <div style={styles.sectionHeaderBar}>
            <div style={styles.sectionHeaderDecorLeft} />
            <span style={styles.sectionLabel}>{orchestration ? 'MANUAL TASKS' : 'MISSION PLAN'}</span>
            <div style={styles.sectionHeaderDecorRight} />
          </div>

          <div style={styles.taskListPanel}>
            {tasks.length === 0 && !orchestration && (
              <div style={styles.emptyState}>
                <span style={styles.emptyStateIcon}>{'\u25C7'}</span>
                <span style={styles.emptyStateText}>
                  No tasks defined. Add tasks below or use INITIATE MISSION for autonomous orchestration.
                </span>
              </div>
            )}
            {tasks.length === 0 && orchestration && (
              <div style={styles.emptyState}>
                <span style={styles.emptyStateIcon}>{'\u25C7'}</span>
                <span style={styles.emptyStateText}>
                  Orchestration is managing tasks automatically. Manual tasks are optional.
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

        {/* ========== LAUNCH AREA ========== */}
        <div style={styles.missionLaunchArea}>
          <div style={styles.missionLaunchDecorLine} />

          {/* INITIATE MISSION — Autonomous orchestration */}
          {!isOrchestrating && (
            <button
              onClick={handleInitiateMission}
              onMouseEnter={() => setHoveredButton('initiate-mission')}
              onMouseLeave={() => setHoveredButton(null)}
              disabled={!activeProject}
              style={{
                ...styles.beginMissionButton,
                opacity: activeProject ? 1 : 0.35,
                cursor: activeProject ? 'pointer' : 'not-allowed',
                boxShadow: hoveredButton === 'initiate-mission' && activeProject
                  ? '0 0 25px rgba(139, 92, 246, 0.6), 0 0 50px rgba(139, 92, 246, 0.2), inset 0 0 20px rgba(139, 92, 246, 0.1)'
                  : '0 0 15px rgba(139, 92, 246, 0.3), inset 0 0 10px rgba(139, 92, 246, 0.05)',
                borderColor: '#8b5cf6',
                color: '#8b5cf6',
                textShadow: '0 0 12px rgba(139, 92, 246, 0.5)',
                transform: hoveredButton === 'initiate-mission' && activeProject
                  ? 'scale(1.02)'
                  : 'scale(1)',
              }}
            >
              <span style={styles.beginMissionIcon}>{'\u2726'}</span>
              <span style={styles.beginMissionLabel}>INITIATE MISSION</span>
              <span style={{
                ...styles.beginMissionCount,
                background: 'rgba(139, 92, 246, 0.15)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
              }}>
                AUTO
              </span>
            </button>
          )}

          {/* BEGIN MISSION — Manual task launch */}
          {!isOrchestrating && unlaunchedCount > 0 && (
            <button
              onClick={handleBeginMission}
              onMouseEnter={() => setHoveredButton('begin-mission')}
              onMouseLeave={() => setHoveredButton(null)}
              style={{
                ...styles.beginMissionButton,
                boxShadow: hoveredButton === 'begin-mission'
                  ? '0 0 25px rgba(0, 200, 255, 0.6), 0 0 50px rgba(0, 200, 255, 0.2), inset 0 0 20px rgba(0, 200, 255, 0.1)'
                  : '0 0 15px rgba(0, 200, 255, 0.3), inset 0 0 10px rgba(0, 200, 255, 0.05)',
                transform: hoveredButton === 'begin-mission'
                  ? 'scale(1.02)'
                  : 'scale(1)',
              }}
            >
              <span style={styles.beginMissionIcon}>{'\u25B6'}</span>
              <span style={styles.beginMissionLabel}>BEGIN MISSION</span>
              <span style={styles.beginMissionCount}>
                {unlaunchedCount} TASK{unlaunchedCount !== 1 ? 'S' : ''}
              </span>
            </button>
          )}

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

  /* --- Orchestration Status Panel --- */
  orchStatusPanel: {
    background: 'var(--panel-bg, rgba(13, 19, 33, 0.85))',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: 2,
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
    backdropFilter: 'blur(8px)',
    boxShadow: '0 0 20px rgba(0, 0, 0, 0.3), inset 0 0 30px rgba(139, 92, 246, 0.02)',
  },

  orchPhaseRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },

  orchPhaseLabel: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '8px',
    fontWeight: 700,
    letterSpacing: '2px',
    color: 'var(--text-secondary, #7a8ba8)',
    opacity: 0.7,
  },

  orchPhaseBadge: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '2px',
    padding: '4px 12px',
    border: '1px solid',
    borderRadius: 2,
    flex: 1,
  },

  orchAbortButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    padding: '0 16px',
    border: '1px solid rgba(255, 51, 68, 0.4)',
    borderRadius: 1,
    color: '#ff3344',
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '8px',
    fontWeight: 700,
    letterSpacing: '2px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    flexShrink: 0,
  },

  orchProgressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },

  orchProgressTrack: {
    flex: 1,
    height: 4,
    background: 'rgba(0, 200, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },

  orchProgressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #00c8ff, #00ff88)',
    borderRadius: 2,
    transition: 'width 0.5s ease',
    boxShadow: '0 0 8px rgba(0, 200, 255, 0.4)',
  },

  orchProgressText: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '1px',
    color: 'var(--text-secondary, #7a8ba8)',
    flexShrink: 0,
  },

  orchPlanList: {
    display: 'flex',
    flexDirection: 'column' as const,
    border: '1px solid rgba(0, 200, 255, 0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },

  orchPlanTask: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    borderBottom: '1px solid rgba(0, 200, 255, 0.06)',
    transition: 'background 0.15s ease',
  },

  orchTaskStatus: {
    fontSize: '14px',
    fontWeight: 700,
    width: 18,
    textAlign: 'center' as const,
    flexShrink: 0,
  },

  orchTaskInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    minWidth: 0,
  },

  orchTaskTitle: {
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary, #e0f0ff)',
    letterSpacing: '0.3px',
  },

  orchTaskDesc: {
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '12px',
    fontWeight: 400,
    color: 'var(--text-secondary, #7a8ba8)',
    opacity: 0.7,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },

  orchBranchBadge: {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: '9px',
    fontWeight: 500,
    letterSpacing: '0.5px',
    color: '#8b5cf6',
    padding: '2px 6px',
    background: 'rgba(139, 92, 246, 0.08)',
    border: '1px solid rgba(139, 92, 246, 0.25)',
    borderRadius: 2,
    flexShrink: 0,
  },

  orchApprovalRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 8,
    borderTop: '1px solid rgba(0, 200, 255, 0.1)',
  },

  cancelButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    padding: '0 22px',
    border: '1px solid rgba(122, 139, 168, 0.3)',
    borderRadius: 1,
    color: 'var(--text-secondary, #7a8ba8)',
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '2px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    background: 'transparent',
  },
};
