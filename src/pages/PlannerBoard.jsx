import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import { adminAPI, employeeProjectAPI, projectAPI, unifiedEmployeeAPI } from '../services/api';
import { Users, CalendarDays, Plus, MessageSquare, Loader2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import './PlannerBoard.css';

// Very lightweight frontend-only planner board.
// Backend wiring will go to future /api/planner endpoints.

const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'];

const statusLabels = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
};

const statusColors = {
  NOT_STARTED: '#e5e7eb',
  IN_PROGRESS: '#f97316',
  COMPLETED: '#22c55e',
};

const calculateDays = (start, end) => {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
  const diffTime = e - s;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays > 0 ? diffDays : 0;
};

const getWeekRange = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  // We want Monday as the start of the week
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const format = (dt) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  return {
    weekStart: format(weekStart),
    weekEnd: format(weekEnd),
    weekStartObj: weekStart,
    weekEndObj: weekEnd
  };
};

export default function PlannerBoard() {
  const { sessionType, getCurrentUser } = useAuth();
  const currentUser = getCurrentUser();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const pendingFocusAssignmentId = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [focusedAssignmentId, setFocusedAssignmentId] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assigneeId: '',
    status: 'NOT_STARTED',
    startDate: '',
    dueDate: '',
    projectId: '',
    isBillable: false,
  });
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState([]);
  const [availableProjects, setAvailableProjects] = useState([]);

  const currentRange = getWeekRange(currentDate);

  const handlePrevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const handleNextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const isManagerView = sessionType === 'admin' || sessionType === 'employee'; // fine-tune later

  const fetchTasks = async () => {
    setLoading(true);
    try {
      let assignments = [];
      const { weekStart, weekEnd } = currentRange;

      if (sessionType === 'admin') {
        // Optimized: get all assignments for the week in one call
        const res = await projectAPI.getAllAssignments('all', weekStart, weekEnd);
        assignments = res.data || [];
      } else {
        try {
          const res = await employeeProjectAPI.getWeeklyAssignedTasks(weekStart, weekEnd);
          assignments = res.data || [];
        } catch (err) {
          console.error('Error fetching assigned tasks:', err);
          const raw = window.safeSessionStorage.getItem('plannerTasks');
          if (raw) {
            const parsed = JSON.parse(raw);
            setTasks(Array.isArray(parsed) ? parsed : []);
          }
        }
      }

      const mappedTasks = assignments.map(assignment => {
        const initials = assignment.employeeName
          ? assignment.employeeName
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2)
          : (assignment.createdByEmployeeName
            ? assignment.createdByEmployeeName
              .split(' ')
              .map(n => n[0])
              .join('')
              .toUpperCase()
              .substring(0, 2)
            : '?');

        const status = (assignment.status && STATUSES.includes(assignment.status))
          ? assignment.status
          : 'NOT_STARTED';

        return {
          id: `assignment-${assignment.id}`,
          assignmentId: assignment.id,
          taskId: assignment.taskId,
          projectId: assignment.projectId,
          title: assignment.taskName || 'Untitled Task',
          description: assignment.projectName ? `Project: ${assignment.projectName}` : '',
          status: status,
          rawStatus: assignment.status,
          dueDate: assignment.endDate || '',
          startDate: assignment.startDate || '',
          createdAt: new Date().toISOString(),
          createdByName: assignment.createdByEmployeeName || (sessionType === 'employee' ? currentUser?.fullName || 'Me' : 'Manager'),
          assigneeName: assignment.employeeName || (assignment.createdByEmployeeName || 'Unknown'),
          assigneeInitials: initials,
          employeeId: assignment.employeeId,
          allocationPercent: assignment.allocationPercent || 100,
          approvedByManager: assignment.approvedByEmployeeName,
          approvalStatus: assignment.approvalStatus, // Add approval status
        };
      });

      // Deduplicate mapped tasks by assignmentId or purely id to prevent UI glitches 
      // where dropping a task appears as if dragging "clones" due to identical IDs being fed from the backend.
      const uniqueMappedTasks = [];
      const seenIds = new Set();
      for (const t of mappedTasks) {
        if (!seenIds.has(t.id)) {
          seenIds.add(t.id);
          uniqueMappedTasks.push(t);
        }
      }

      setTasks(uniqueMappedTasks);

      if (sessionType === 'admin') {
        try {
          const res = await unifiedEmployeeAPI.getEmployees();
          const list = res.data?.employees || (Array.isArray(res.data) ? res.data : []);
          setEmployees(list);
        } catch (err) {
          console.error('Error fetching employees:', err);
        }
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const assignmentId = searchParams.get('assignmentId');
    if (!assignmentId) return;

    const loadAssignmentWeek = async () => {
      try {
        const res = sessionType === 'admin'
          ? await projectAPI.getTaskAssignmentById(assignmentId)
          : await employeeProjectAPI.getSelfAssignment(assignmentId).catch(() =>
              projectAPI.getTaskAssignmentById(assignmentId)
            );
        const assignment = res?.data;
        if (assignment?.startDate) {
          pendingFocusAssignmentId.current = assignmentId;
          setCurrentDate(new Date(`${assignment.startDate}T00:00:00`));
        } else {
          pendingFocusAssignmentId.current = assignmentId;
        }
      } catch (err) {
        console.warn('Could not resolve planner deep link assignment', err);
        pendingFocusAssignmentId.current = assignmentId;
      }
    };

    loadAssignmentWeek();
  }, [searchParams, sessionType]);

  useEffect(() => {
    fetchTasks();
  }, [sessionType, currentDate]);

  useEffect(() => {
    if (!pendingFocusAssignmentId.current || loading) return;
    const match = tasks.find(
      (t) => String(t.assignmentId) === String(pendingFocusAssignmentId.current)
    );
    if (match) {
      setFocusedAssignmentId(String(match.assignmentId));
      pendingFocusAssignmentId.current = null;
      if (searchParams.get('assignmentId')) {
        navigate(location.pathname, { replace: true });
      }
    }
  }, [tasks, loading, searchParams, navigate, location.pathname]);

  useEffect(() => {
    if (!focusedAssignmentId) return;
    const scrollTimer = window.setTimeout(() => {
      const target = document.querySelector(`[data-assignment-id="${focusedAssignmentId}"]`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }, 100);
    const clearTimer = window.setTimeout(() => {
      setFocusedAssignmentId(null);
    }, 2400);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [focusedAssignmentId]);

  const normalizePlannerProjects = (data) => {
    const list = Array.isArray(data) ? data : [];
    return list.map((p) => ({
      ...p,
      id: p.id ?? p.projectId,
      projectName: p.projectName || p.name || 'Unnamed project',
    })).filter((p) => p.id != null);
  };

  useEffect(() => {
    const fetchAvailableProjects = async () => {
      try {
        let projects = [];
        if (sessionType === 'employee') {
          const { weekStart, weekEnd } = currentRange;
          try {
            const res = await employeeProjectAPI.getAllocatedProjects(weekStart, weekEnd);
            projects = normalizePlannerProjects(res.data);
          } catch (err) {
            console.error('Error fetching allocated projects:', err);
          }
          if (projects.length === 0) {
            try {
              const fallback = await employeeProjectAPI.getAvailableProjects();
              projects = normalizePlannerProjects(fallback.data);
            } catch (err) {
              console.error('Error fetching available projects:', err);
            }
          }
        } else {
          const res = await employeeProjectAPI.getAvailableProjects();
          projects = normalizePlannerProjects(res.data);
        }
        setAvailableProjects(projects);
      } catch (err) {
        console.error('Error fetching projects:', err);
        toast.error('Failed to load projects for task creation');
        setAvailableProjects([]);
      }
    };
    fetchAvailableProjects();
  }, [sessionType, currentDate]);

  const persistTasks = (next) => {
    setTasks(next);
    try {
      window.safeSessionStorage.setItem('plannerTasks', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    // Duplicate title check
    const isDuplicate = tasks.some(t =>
      t.title.toLowerCase().trim() === newTask.title.toLowerCase().trim() &&
      String(t.projectId) === String(newTask.projectId)
    );

    if (isDuplicate) {
      toast.error(`A task with the title "${newTask.title}" already exists in this project.`);
      return;
    }

    setSaving(true);
    try {
      if (sessionType === 'admin') {
        if (!newTask.assigneeId) {
          toast.error("Please select an employee");
          setSaving(false);
          return;
        }

        const payload = {
          taskName: newTask.title,
          projectId: newTask.projectId || null,
          description: newTask.description,
          isBillable: newTask.isBillable,
          startDate: newTask.startDate || null,
          endDate: newTask.dueDate || null,
          dueDate: newTask.dueDate || null,
        };

        await projectAPI.createTaskAssignmentWithTask(newTask.assigneeId, payload);
        toast.success('Task assigned successfully');
        fetchTasks(); // Refresh board
        setNewTask({
          title: '',
          description: '',
          assigneeId: '',
          status: 'NOT_STARTED',
          startDate: '',
          dueDate: '',
          projectId: '',
          isBillable: false,
        });
      } else {
        // Employee creating task for approval
        const payload = {
          taskName: newTask.title.trim(),
          projectId: newTask.projectId ? Number(newTask.projectId) : null,
          description: newTask.description?.trim() || '',
          isBillable: newTask.isBillable,
          startDate: newTask.startDate || null,
          endDate: newTask.dueDate || null,
        };
        await employeeProjectAPI.createSelfTask(payload);
        toast.success('Task created and sent for approval');
        fetchTasks(); // Refresh board
        setNewTask({
          title: '',
          description: '',
          assigneeId: '',
          status: 'NOT_STARTED',
          startDate: '',
          dueDate: '',
          projectId: '',
          isBillable: false,
        });
      }
    } catch (err) {
      console.error('Error creating task:', err);
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  const handleDrop = async (taskId, targetStatus) => {
    // Block moving unapproved tasks from NOT_STARTED
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status === 'NOT_STARTED' && targetStatus !== 'NOT_STARTED' && task.approvalStatus !== 'APPROVED') {
      toast.error("task is not approved cant change the status");
      return;
    }

    // We get the task from the *latest* functional state to prevent quick drag/drop bugs
    let taskToUpdate = null;

    setTasks(prevTasks => {
      taskToUpdate = prevTasks.find(t => t.id === taskId);
      if (!taskToUpdate) return prevTasks;

      return prevTasks.map(t =>
        t.id === taskId ? { ...t, status: targetStatus } : t
      );
    });

    // Need a tiny delay to ensure `taskToUpdate` has properly grabbed the value
    // from the functional set state above before we push to the backend.
    setTimeout(async () => {
      if (!taskToUpdate) return;

      try {
        if (taskToUpdate.assignmentId) {
          if (sessionType === 'admin') {
            await projectAPI.updateTaskAssignment(taskToUpdate.assignmentId, { status: targetStatus });
          } else {
            await employeeProjectAPI.updateAssignmentStatus(taskToUpdate.assignmentId, targetStatus);
          }
        }
        toast.success('Task status updated');
      } catch (err) {
        console.error('Error saving task status:', err);
        // Revert on failure
        setTasks(prevTasks =>
          prevTasks.map(t =>
            t.id === taskId ? { ...t, status: taskToUpdate.status } : t
          )
        );
        toast.error('Failed to update status');
      }
    }, 0);
  };

  const openTaskDetails = (task) => {
    setFocusedAssignmentId(null);
    setActiveTask(task);
    // Mock comments in-memory for now
    try {
      const raw = window.safeSessionStorage.getItem(`plannerComments:${task.id}`);
      const parsed = raw ? JSON.parse(raw) : [];
      setComments(parsed);
    } catch {
      setComments([]);
    }
    setNewComment('');
  };

  const closeTaskDetails = () => {
    setActiveTask(null);
    setComments([]);
    setNewComment('');
  };

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!activeTask || !newComment.trim()) return;

    const authorName =
      (currentUser && (currentUser.fullName || currentUser.name || currentUser.username)) ||
      'You';
    const comment = {
      id: `c-${Date.now()}`,
      text: newComment.trim(),
      author: authorName,
      createdAt: new Date().toISOString(),
    };
    const next = [...comments, comment];
    setComments(next);
    try {
      window.safeSessionStorage.setItem(`plannerComments:${activeTask.id}`, JSON.stringify(next));
    } catch {
      // ignore
    }
    setNewComment('');
  };

  const tasksByStatus = (status) => tasks.filter((t) => t.status === status);

  if (loading) {
    return (
      <div className="planner-page">
        <Header title="Planner" subtitle="Lightweight task planner for your team" />
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280' }}>
            <Loader2 className="spin-slow" size={18} />
            <span>Loading planner…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="planner-page">
      <Header
        title="Planner"
        subtitle="Create and track tasks for your reportees, similar to a simple Teams planner board."
      />

      <div className="page-content planner-page-content">
        <div className="planner-layout">
          {/* Left – create task */}
          <div
            style={{
              borderRadius: 12,
              border: '1px solid var(--gray-10)',
              background: '#ffffff',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* Week Switcher & Today Button Inside Card Header */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              borderBottom: '1px solid #f1f5f9',
              paddingBottom: 14,
              marginBottom: 8
            }}>
              <div style={{ 
                fontSize: 12.5, 
                fontWeight: 700, 
                color: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <CalendarDays size={14} style={{ color: '#4f46e5' }} />
                <span>{currentRange.weekStart} – {currentRange.weekEnd}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  background: '#f1f5f9', 
                  padding: 2, 
                  borderRadius: 6,
                  border: '1px solid #e2e8f0'
                }}>
                  <button 
                    type="button"
                    onClick={handlePrevWeek}
                    title="Previous Week"
                    style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      color: '#475569',
                    }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button 
                    type="button"
                    onClick={handleNextWeek}
                    title="Next Week"
                    style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      color: '#475569',
                    }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
                <button 
                  type="button"
                  onClick={() => setCurrentDate(new Date())}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    color: '#475569',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  Today
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  background: 'var(--primary-50)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary-600)',
                }}
              >
                <Plus size={14} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Add task</span>
            </div>

            {sessionType === 'employee' && (
              <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>
                Add tasks for your allocated projects, then drag cards between columns to update status. New tasks require manager approval.
              </p>
            )}
            {sessionType === 'admin' && (
              <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>
                Create and assign tasks to your team members. Drag tasks between columns to update status.
              </p>
            )}

            {(sessionType === 'admin' || sessionType === 'employee') && (
              <form
                onSubmit={handleCreateTask}
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                <input
                  type="text"
                  placeholder="Task title"
                  value={newTask.title}
                  onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    fontSize: 13,
                  }}
                />

                <textarea
                  placeholder="Description"
                  rows={2}
                  value={newTask.description}
                  onChange={(e) => setNewTask((prev) => ({ ...prev, description: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    fontSize: 13,
                    resize: 'none',
                  }}
                />

                <select
                  value={newTask.projectId}
                  onChange={(e) => setNewTask((prev) => ({ ...prev, projectId: e.target.value }))}
                  required
                  disabled={availableProjects.length === 0}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    fontSize: 13,
                    backgroundColor: '#ffffff',
                  }}
                >
                  <option value="">
                    {availableProjects.length === 0 ? 'No projects available' : 'Select Project *'}
                  </option>
                  {availableProjects.map((p) => (
                    <option key={p.id} value={String(p.id)}>{p.projectName}</option>
                  ))}
                </select>
                {availableProjects.length === 0 && (
                  <p style={{ fontSize: 11, color: '#b45309', margin: 0 }}>
                    No projects found for this week. Log time on a project or ask your manager to assign you to one.
                  </p>
                )}

                {/* Start Date & End Date – mandatory for all */}
                {(() => {
                  const today = new Date().toISOString().split('T')[0];
                  return (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CalendarDays size={12} /> Start Date *
                        </label>
                        <input
                          type="date"
                          value={newTask.startDate}
                          min={today}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewTask((prev) => ({ 
                              ...prev, 
                              startDate: val,
                              // If current end date is before new start date, reset it
                              dueDate: prev.dueDate && prev.dueDate < val ? val : prev.dueDate 
                            }));
                          }}
                          onClick={(e) => e.target.showPicker?.()}
                          required
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 8,
                            border: '1px solid #e5e7eb',
                            fontSize: 13,
                            boxSizing: 'border-box',
                            cursor: 'pointer'
                          }}
                        />
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CalendarDays size={12} /> End Date *
                        </label>
                        <input
                          type="date"
                          value={newTask.dueDate}
                          min={newTask.startDate || today}
                          onChange={(e) => setNewTask((prev) => ({ ...prev, dueDate: e.target.value }))}
                          onClick={(e) => e.target.showPicker?.()}
                          required
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 8,
                            border: '1px solid #e5e7eb',
                            fontSize: 13,
                            boxSizing: 'border-box',
                            cursor: 'pointer'
                          }}
                        />
                      </div>
                    </div>
                  );
                })()}

                 <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                    <input
                      type="checkbox"
                      checked={newTask.isBillable}
                      onChange={(e) => setNewTask(p => ({ ...p, isBillable: e.target.checked }))}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        accentColor: '#4f46e5',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        backgroundColor: '#ffffff'
                      }}
                    />
                    Billable
                  </label>
                </div>

                {sessionType === 'admin' && (
                  <div className="planner-form-row">
                    <select
                      value={newTask.assigneeId}
                      onChange={(e) =>
                        setNewTask((prev) => ({ ...prev, assigneeId: e.target.value || '' }))
                      }
                      required
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid #e5e7eb',
                        fontSize: 13,
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <option value="">Assign to… *</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.fullName || emp.employeeName || emp.employeeId}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <button
                    type="submit"
                    disabled={
                      saving ||
                      !newTask.title.trim() ||
                      !newTask.projectId ||
                      !newTask.startDate ||
                      !newTask.dueDate ||
                      (sessionType === 'admin' && !newTask.assigneeId)
                    }
                    style={{
                      padding: '8px 16px',
                      borderRadius: 999,
                      border: 'none',
                      background: (
                        saving ||
                        !newTask.title.trim() ||
                        !newTask.projectId ||
                        !newTask.startDate ||
                        !newTask.dueDate ||
                        (sessionType === 'admin' && !newTask.assigneeId)
                      )
                        ? '#e5e7eb'
                        : 'linear-gradient(135deg,#4f46e5,#22c55e)',
                      color: (
                        saving ||
                        !newTask.title.trim() ||
                        !newTask.projectId ||
                        !newTask.startDate ||
                        !newTask.dueDate ||
                        (sessionType === 'admin' && !newTask.assigneeId)
                      )
                        ? '#9ca3af'
                        : '#ffffff',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: (
                        saving ||
                        !newTask.title.trim() ||
                        !newTask.projectId ||
                        !newTask.startDate ||
                        !newTask.dueDate ||
                        (sessionType === 'admin' && !newTask.assigneeId)
                      )
                        ? 'not-allowed'
                        : 'pointer',
                    }}
                  >
                    {saving ? 'Creating...' : 'Create Task'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right – Kanban board */}
          <div className="planner-board-container">
            <div className="planner-board">
              {STATUSES.map((status) => (
                <PlannerColumn
                  key={status}
                  status={status}
                  tasks={tasksByStatus(status)}
                  focusedAssignmentId={focusedAssignmentId}
                  onDropTask={handleDrop}
                  onOpenTask={openTaskDetails}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Task details & comments drawer */}
        {activeTask && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.45)',
              display: 'flex',
              justifyContent: 'flex-end',
              zIndex: 11000,
            }}
            onClick={closeTaskDetails}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 380,
                maxWidth: '100%',
                background: '#ffffff',
                height: '100%',
                padding: 16,
                boxShadow: '-8px 0 24px rgba(15,23,42,0.35)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#4b5563',
                    }}
                  >
                    {statusLabels[activeTask.status]}
                  </div>
                  <button
                    type="button"
                    onClick={closeTaskDetails}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#9ca3af',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    aria-label="Close details"
                  >
                    <X size={18} />
                  </button>
                </div>
                <h2
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    margin: 0,
                    marginBottom: 4,
                    color: '#111827',
                  }}
                >
                  {activeTask.title}
                </h2>
                {activeTask.description && (
                  <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                    {activeTask.description}
                  </p>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  fontSize: 13,
                  color: '#4b5563',
                  background: '#f8fafc',
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid #e2e8f0'
                }}
              >
                {activeTask.startDate && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarDays size={14} color="#64748b" />
                    <span style={{ fontWeight: 600 }}>Start Date:</span> {activeTask.startDate}
                  </div>
                )}
                {activeTask.dueDate && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarDays size={14} color="#ef4444" />
                    <span style={{ fontWeight: 600 }}>End Date:</span> {activeTask.dueDate}
                  </div>
                )}
                {activeTask.startDate && activeTask.dueDate && (() => {
                  const days = calculateDays(activeTask.startDate, activeTask.dueDate);
                  const isLow = days < 2;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: isLow ? '#ef4444' : '#4f46e5',
                        background: isLow ? '#fef2f2' : '#eef2ff',
                        padding: '2px 8px',
                        borderRadius: 4,
                        border: `1px solid ${isLow ? '#fee2e2' : '#e0e7ff'}`,
                      }}>
                        Duration: {days} Days
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  fontSize: 12,
                  color: '#6b7280',
                  marginTop: 4
                }}
              >
                {activeTask.createdByName && (
                  <div>
                    <strong>Created by:</strong> {activeTask.createdByName}
                  </div>
                )}
                {activeTask.approvedByManager && (
                  <div style={{ color: '#10b981' }}>
                    <strong>Approved by:</strong> {activeTask.approvedByManager}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlannerColumn({ status, tasks, focusedAssignmentId, onDropTask, onOpenTask }) {
  const handleDrop = (e) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    onDropTask(taskId, status);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div
      className="planner-column"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
          flexShrink: 0
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
          {statusLabels[status]}
        </span>
        <span
          style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 999,
            background: '#e5e7eb',
            color: '#4b5563',
          }}
        >
          {tasks.length}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {tasks.map((task) => (
          <PlannerCard
            key={task.id}
            task={task}
            isFocused={String(task.assignmentId) === String(focusedAssignmentId)}
            onOpen={() => onOpenTask(task)}
          />
        ))}
      </div>
    </div>
  );
}

function PlannerCard({ task, isFocused, onOpen }) {
  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      data-assignment-id={task.assignmentId}
      draggable
      onDragStart={handleDragStart}
      onClick={onOpen}
      className={`planner-card ${isFocused ? 'planner-card-focused' : ''}`}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{task.title}</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          {task.dueDate && (
            <span style={{ fontSize: 11, color: '#6b7280' }}>{task.dueDate}</span>
          )}
          {task.startDate && task.dueDate && (() => {
            const days = calculateDays(task.startDate, task.dueDate);
            const isLow = days < 2;
            return (
              <div style={{
                fontSize: 9,
                fontWeight: 700,
                color: isLow ? '#ef4444' : '#4f46e5',
                background: isLow ? '#fef2f2' : '#eef2ff',
                padding: '1px 6px',
                borderRadius: 4,
                border: `1px solid ${isLow ? '#fee2e2' : '#e0e7ff'}`,
              }}>
                {days} Days
              </div>
            );
          })()}
        </div>
      </div>
      {task.rawStatus === 'PENDING_APPROVAL' && (
        <div style={{
          fontSize: 10,
          fontWeight: 600,
          color: '#f97316',
          background: '#fff7ed',
          border: '1px solid #ffedd5',
          padding: '2px 6px',
          borderRadius: 4,
          width: 'fit-content',
          marginBottom: 6
        }}>
          Approval Required
        </div>
      )}
      {task.description && (
        <div
          style={{
            fontSize: 12,
            color: '#6b7280',
            marginBottom: 4,
            maxHeight: 40,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {task.description}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: '#6b7280',
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: '999px',
                background: '#e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 600,
                color: '#4b5563',
              }}
            >
              {task.assigneeInitials ||
                (task.assigneeName
                  ? task.assigneeName
                    .split(' ')
                    .map((p) => p[0])
                    .join('')
                    .toUpperCase()
                  : '?')}
            </div>
            {task.assigneeName && <span>{task.assigneeName}</span>}
          </div>
        </div>
        {task.approvedByManager && (
          <div style={{ fontSize: 10, color: '#10b981', fontWeight: 500, marginLeft: 26 }}>
            Approved by: {task.approvedByManager}
          </div>
        )}
      </div>
    </div>
  );
}

