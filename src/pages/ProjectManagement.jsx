import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { projectAPI, adminAPI, employeeProjectAPI, teamAPI, unifiedEmployeeAPI } from '../services/api';
import Header from '../components/Header';
import {
  Plus,
  Edit,
  Trash2,
  Users,
  CheckSquare,
  Calendar,
  X,
  Save,
  Loader2,
  ChevronDown,
  ChevronRight,
  Briefcase,
  Search,
  CheckCircle,
  Clock,
  LayoutGrid,
  RotateCw,
  ToggleLeft,
  ToggleRight,
  Pause,
  Play
} from 'lucide-react';

const isProjectOperational = (project) =>
  Boolean(project?.isActive) && !Boolean(project?.isPaused);

export default function ProjectManagement() {
  const { getCurrentUser, sessionType, hasCrudPermission, user, adminUser } = useAuth();
  const currentUser = getCurrentUser();
  const [searchParams] = useSearchParams();

  // Cache helpers to prevent skeleton flicker on navigation
  const getCached = (key, def) => {
    try {
      const val = window.safeSessionStorage.getItem(`pm_${key}`);
      return val ? JSON.parse(val) : def;
    } catch { return def; }
  };
  const setCache = (key, val) => window.safeSessionStorage.setItem(`pm_${key}`, JSON.stringify(val));

  const [projects, setProjects] = useState(() => getCached('projects', []));
  const [employees, setEmployees] = useState(() => getCached('employees', []));
  const [loading, setLoading] = useState(() => !window.safeSessionStorage.getItem('pm_projects'));
  const [expandedProjects, setExpandedProjects] = useState(new Set());
  const [activeTab, setActiveTab] = useState(() => {
    const tab = (searchParams.get('tab') || '').toLowerCase();
    const allowed = ['projects', 'tasks', 'approvals'];
    return allowed.includes(tab) ? tab : 'projects';
  });
  const [teamAssignments, setTeamAssignments] = useState(() => getCached('teamAssignments', []));
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(() => window.safeSessionStorage.getItem('pm_teamAssignments') !== null);
  const [fetchingAssignments, setFetchingAssignments] = useState(false);

  // Modal states
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [projectAssignedEmployeeIds, setProjectAssignedEmployeeIds] = useState(new Set());
  const [pendingTasks, setPendingTasks] = useState(() => getCached('pendingTasks', []));
  const [pendingLoaded, setPendingLoaded] = useState(() => window.safeSessionStorage.getItem('pm_pendingTasks') !== null);
  const [fetchingPending, setFetchingPending] = useState(false);
  const [submittedAssignment, setSubmittedAssignment] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [actionType, setActionType] = useState(null); // 'approve' or 'reject'
  const [showProjectTeamOnly, setShowProjectTeamOnly] = useState(true);
  const [isProjectLevelAssign, setIsProjectLevelAssign] = useState(false);
  const [submittingProject, setSubmittingProject] = useState(false);
  const [submittingTask, setSubmittingTask] = useState(false);
  const [submittingAssignment, setSubmittingAssignment] = useState(false);

  // Filter states for Team Assignments - Defaulting to Current Week
  const [assignmentSearchTerm, setAssignmentSearchTerm] = useState('');
  const [assignmentStartDate, setAssignmentStartDate] = useState(() => {
    const today = new Date();
    const day = today.getDay(); // 0: Sun, 1: Mon...
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    return monday.toISOString().split('T')[0];
  });
  const [assignmentEndDate, setAssignmentEndDate] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diffToSunday = day === 0 ? 0 : 7 - day;
    const sunday = new Date(today);
    sunday.setDate(today.getDate() + diffToSunday);
    return sunday.toISOString().split('T')[0];
  });

  // HR/Admin view state
  const isHR = (() => {
    if (!currentUser) return false;
    if (currentUser.roles && Array.isArray(currentUser.roles)) {
      return currentUser.roles.some(role => ['HR', 'CEO'].includes(String(role).trim().toUpperCase()));
    }
    let roleValue = currentUser.employeeRoleName || '';
    if (!roleValue && currentUser.role) {
      if (typeof currentUser.role === 'string') {
        roleValue = currentUser.role;
      } else if (currentUser.role.name) {
        roleValue = currentUser.role.name;
      }
    }
    return ['HR', 'CEO'].includes(String(roleValue).trim().toUpperCase());
  })();

  const [dataView, setDataView] = useState(isHR || sessionType === 'admin' ? 'all' : 'team');

  // Form states
  const [projectForm, setProjectForm] = useState({
    projectName: '',
    projectCode: '',
    description: '',
    isActive: true,
    isBillable: false,
  });

  const [taskForm, setTaskForm] = useState({
    taskName: '',
    taskCode: '',
    description: '',
    isActive: true,
    isBillable: false,
  });

  const [assignmentForm, setAssignmentForm] = useState({
    taskId: '',
    employeeIds: [],
    startDate: '',
    endDate: '',
    allocationPercent: 100,
  });

  // Initial mount fetch
  useEffect(() => {
    fetchEmployees(dataView);
    fetchProjects();
    fetchPendingTasks();
  }, []);

  // Selective fetch on tab or view change
  useEffect(() => {
    if (activeTab === 'tasks') {
      fetchTeamAssignments();
    } else if (activeTab === 'approvals') {
      fetchPendingTasks();
    }
    // Re-fetch employees for the assignment modal to match the current view
    fetchEmployees(dataView);
  }, [dataView]);

  useEffect(() => {
    if (activeTab === 'projects' && projects.length === 0) {
      fetchProjects();
    } else if (activeTab === 'tasks' && !assignmentsLoaded) {
      fetchTeamAssignments();
    } else if (activeTab === 'approvals' && !pendingLoaded) {
      fetchPendingTasks();
    }
  }, [activeTab]);

  const fetchPendingTasks = async (force = false) => {
    try {
      if (force || (!pendingLoaded && pendingTasks.length === 0)) {
        setFetchingPending(true);
      }
      const res = await employeeProjectAPI.getPendingTasks(dataView);
      const data = res.data;
      let finalData = [];
      // Ensure we only set an array — backend may return error object on failure
      if (Array.isArray(data)) {
        finalData = data;
      } else if (data && Array.isArray(data.data)) {
        finalData = data.data;
      }
      setPendingTasks(finalData);
      setPendingLoaded(true);
      setCache('pendingTasks', finalData);
      if (force) toast.success('Pending approvals refreshed');
    } catch (err) {
      console.error('Error fetching pending tasks:', err);
      if (force) toast.error('Failed to refresh pending approvals');
      // Don't clear existing pending tasks on error — preserve what we had
    } finally {
      setFetchingPending(false);
    }
  };

  const getResolveEmployeeName = (nameField, idField) => {
    if (nameField && nameField !== 'null' && nameField !== 'undefined') return nameField;
    if (!idField) return 'N/A';
    const emp = employees.find(e => e.id === idField || e.employeeId === idField);
    return emp ? `${emp.firstName} ${emp.lastName}` : (idField || 'N/A');
  };

  const handleApproveTask = async (id) => {
    setProcessingId(id);
    setActionType('approve');
    try {
      await employeeProjectAPI.approveTask(id);
      toast.success('Task approved');
      fetchPendingTasks();
      fetchProjects();
    } catch (err) {
      toast.error('Failed to approve task');
    } finally {
      setProcessingId(null);
      setActionType(null);
    }
  };

  const handleRejectTask = async (id) => {
    setProcessingId(id);
    setActionType('reject');
    try {
      await employeeProjectAPI.rejectTask(id);
      toast.success('Task rejected');
      fetchPendingTasks();
      fetchProjects();
    } catch (err) {
      toast.error('Failed to reject task');
    } finally {
      setProcessingId(null);
      setActionType(null);
    }
  };

  const fetchTeamAssignments = async (force = false) => {
    try {
      if (force || (!assignmentsLoaded && teamAssignments.length === 0)) {
        setFetchingAssignments(true);
      }
      const res = await projectAPI.getAllAssignments(dataView);
      const data = res.data || [];
      setTeamAssignments(data);
      setAssignmentsLoaded(true);
      setCache('teamAssignments', data);
      if (force) toast.success('Team assignments refreshed');
    } catch (err) {
      console.error('Error fetching assignments:', err);
      if (force) toast.error('Failed to refresh assignments');
    } finally {
      setFetchingAssignments(false);
    }
  };

  const fetchProjects = async () => {
    try {
      // Only show global loader if we have no projects yet
      if (projects.length === 0) {
        setLoading(true);
      }
      const response = await projectAPI.getAllProjects();
      const projectsData = response.data || [];
      setProjects(projectsData);
      setCache('projects', projectsData);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchTasksForProject = async (projectId) => {
    try {
      const response = await projectAPI.getTasksForProject(projectId);
      const tasks = response.data || [];
      setProjects(prev => prev.map(p =>
        p.id === projectId ? { ...p, tasks } : p
      ));
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchEmployees = async (view) => {
    try {
      // Map frontend dataView to backend DataScope
      const scope = view === 'all' ? 'ORG' : 'TEAM';
      const response = await unifiedEmployeeAPI.getEmployees(scope);
      // Handle different response formats
      let employeesData = [];
      if (response.data) {
        if (Array.isArray(response.data)) {
          employeesData = response.data;
        } else if (response.data.employees && Array.isArray(response.data.employees)) {
          employeesData = response.data.employees;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          employeesData = response.data.data;
        }
      }
      setEmployees(employeesData);
      setCache('employees', employeesData);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setEmployees([]); // Ensure it's always an array
    }
  };

  const toggleProjectExpansion = (projectId) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const handleCreateProject = async () => {
    try {
      setSubmittingProject(true);
      const projectData = {
        ...projectForm,
        createdByEmployeeId: currentUser?.id || null,
      };
      await projectAPI.createProject(projectData);
      toast.success('Project created successfully');
      setShowProjectModal(false);
      resetProjectForm();
      fetchProjects();
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error(error.response?.data?.message || 'Failed to create project');
    } finally {
      setSubmittingProject(false);
    }
  };

  const handleUpdateProject = async () => {
    try {
      setSubmittingProject(true);
      await projectAPI.updateProject(editingProject.id, projectForm);
      toast.success('Project updated successfully');
      setShowProjectModal(false);
      setEditingProject(null);
      resetProjectForm();
      fetchProjects();
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error(error.response?.data?.message || 'Failed to update project');
    } finally {
      setSubmittingProject(false);
    }
  };

  const handleToggleProjectStatus = async (project) => {
    try {
      const updatedData = { ...project, isActive: !project.isActive, isPaused: !project.isActive ? false : project.isPaused };
      await projectAPI.updateProject(project.id, updatedData);
      toast.success(`Project ${updatedData.isActive ? 'activated' : 'deactivated'} successfully`);
      fetchProjects();
    } catch (error) {
      console.error('Error toggling project status:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to update project status');
    }
  };

  const handlePauseOrResumeProject = async (project) => {
    try {
      if (project.isPaused) {
        await projectAPI.resumeProject(project.id);
        toast.success('Project resumed');
      } else {
        if (!project.isActive) {
          toast.error('Activate the project before pausing it');
          return;
        }
        if (!window.confirm(`Pause "${project.projectName}" entirely?\n\nNo new tasks or assignments can be added, and it will be hidden from timesheets until resumed.`)) {
          return;
        }
        await projectAPI.pauseProject(project.id);
        toast.success('Project paused');
      }
      fetchProjects();
    } catch (error) {
      console.error('Error pausing/resuming project:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to update project pause state');
    }
  };

  const handleToggleTaskStatus = async (projectId, task) => {
    try {
      const updatedData = { ...task, isActive: !task.isActive };
      await projectAPI.updateTask(task.id, updatedData);
      toast.success(`Task ${updatedData.isActive ? 'activated' : 'deactivated'} successfully`);
      fetchTasksForProject(projectId);
    } catch (error) {
      console.error('Error toggling task status:', error);
      toast.error('Failed to update task status');
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Deleting this project will permanently remove it along with all its tasks and assignments. This action cannot be undone. Are you sure you want to proceed?')) return;

    try {
      await projectAPI.deleteProject(projectId);
      toast.success('Project deleted successfully');
      fetchProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error(error.response?.data?.message || 'Failed to delete project');
    }
  };

  const handleDeleteTask = async (projectId, taskId) => {
    if (!window.confirm('Are you sure you want to delete this task? All associated assignments will also be deleted.')) return;

    try {
      await projectAPI.deleteTask(taskId);
      toast.success('Task deleted successfully');
      fetchTasksForProject(projectId);
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error(error.response?.data?.message || 'Failed to delete task');
    }
  };

  const handleCreateTask = async () => {
    try {
      if (!selectedProject) return;
      setSubmittingTask(true);
      const taskData = {
        ...taskForm,
        createdByEmployeeId: currentUser?.id || null,
      };
      await projectAPI.createTask(selectedProject.id, taskData);
      toast.success('Task created successfully');
      setShowTaskModal(false);
      resetTaskForm();
      fetchTasksForProject(selectedProject.id);
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error(error.response?.data?.message || 'Failed to create task');
    } finally {
      setSubmittingTask(false);
    }
  };

  const handleUpdateTask = async () => {
    try {
      if (!selectedProject) return;
      setSubmittingTask(true);
      await projectAPI.updateTask(editingTask.id, taskForm);
      toast.success('Task updated successfully');
      setShowTaskModal(false);
      setEditingTask(null);
      resetTaskForm();
      fetchTasksForProject(selectedProject.id);
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error(error.response?.data?.message || 'Failed to update task');
    } finally {
      setSubmittingTask(false);
    }
  };

  const handleCreateAssignment = async () => {
    try {
      if (!selectedProject) return;
      setSubmittingAssignment(true);

      if (!assignmentForm.employeeIds || assignmentForm.employeeIds.length === 0) {
        toast.error('Please select at least one employee');
        return;
      }

      // Optional start and end date
      setSubmittedAssignment(true);
      if (assignmentForm.startDate && assignmentForm.endDate && new Date(assignmentForm.startDate) > new Date(assignmentForm.endDate)) {
        toast.error('Start date cannot be after end date');
        return;
      }

      // Frontend duplicate pre-check: warn if any selected employee is already on this project
      const selectedTask = (() => {
        for (const proj of projects) {
          const t = (proj.tasks || []).find(t => String(t.id) === String(assignmentForm.taskId));
          if (t) return t;
        }
        return null;
      })();

      // Fetch fresh assignments for this specific task to check per-employee duplicates
      let existingEmployeeIds = new Set();
      try {
        const resp = await projectAPI.getAssignmentsForProject(selectedProject.id);
        const assignments = resp.data || [];
        // Filter to the specific task
        assignments
          .filter(a => String(a.taskId) === String(assignmentForm.taskId))
          .forEach(a => a.employeeId && existingEmployeeIds.add(a.employeeId));
      } catch (e) { /* ignore */ }

      // Separate employees into valid vs duplicates
      const duplicateEmps = assignmentForm.employeeIds.filter((id) =>
        Array.from(existingEmployeeIds).some((existingId) => employeeIdsMatch(existingId, id))
      );
      const validEmps = assignmentForm.employeeIds.filter((id) =>
        !Array.from(existingEmployeeIds).some((existingId) => employeeIdsMatch(existingId, id))
      );

      if (duplicateEmps.length > 0) {
        const dupNames = duplicateEmps.map((id) => {
          const e = employees.find((emp) => employeeIdsMatch(emp.id, id));
          return e ? getEmployeeDisplayName(e) : id;
        }).join(', ');
        toast.error(`Already assigned to: ${dupNames}. Skipping duplicates.`);
        if (validEmps.length === 0) return; // nothing to do
      }

      // Only assign the valid (non-duplicate) employees
      const totalToAssign = validEmps.length;
      let successCount = 0;
      let errorMessages = [];

      for (const empId of validEmps) {
        try {
          const assignmentData = {
            projectId: selectedProject.id,
            taskId: assignmentForm.taskId,
            employeeId: empId,
            startDate: assignmentForm.startDate || null,
            endDate: assignmentForm.endDate || null,
            allocationPercent: assignmentForm.allocationPercent,
            isActive: true,
          };
          await projectAPI.createTaskAssignment(assignmentData);
          successCount++;
        } catch (err) {
          const msg = err.response?.data?.message || err.message || 'Unknown error';
          errorMessages.push(msg);
          console.error(`Failed to assign to employee ${empId}:`, err);
        }
      }

      const verb = isProjectLevelAssign ? 'Project assigned' : 'Task assigned';

      if (successCount === totalToAssign && successCount > 0) {
        toast.success(`${verb} to ${successCount} employee${successCount > 1 ? 's' : ''} successfully`);
      } else if (successCount > 0) {
        toast.success(`${verb} to ${successCount} out of ${totalToAssign} employees`);
        if (errorMessages.length > 0) {
          toast.error(errorMessages[0]);
        }
      } else if (totalToAssign === 0) {
        // All were duplicates, already informed
      } else {
        toast.error(errorMessages[0] || `Failed to assign ${isProjectLevelAssign ? 'project' : 'task'}`);
      }

      setShowAssignmentModal(false);
      setSubmittedAssignment(false);
      resetAssignmentForm();
      fetchTasksForProject(selectedProject.id);
    } catch (error) {
      console.error('Error creating assignment:', error);
      toast.error(error.response?.data?.message || 'Failed to assign task');
    } finally {
      setSubmittingAssignment(false);
    }
  };

  const openProjectModal = (project = null) => {
    if (project) {
      setEditingProject(project);
      setProjectForm({
        projectName: project.projectName || '',
        projectCode: project.projectCode || '',
        description: project.description || '',
        isActive: project.isActive !== undefined ? project.isActive : true,
        isBillable: project.isBillable !== undefined ? project.isBillable : true,
      });
    } else {
      resetProjectForm();
    }
    setShowProjectModal(true);
  };

  const openTaskModal = (project, task = null) => {
    setSelectedProject(project);
    if (task) {
      setEditingTask(task);
      setTaskForm({
        taskName: task.taskName || '',
        taskCode: task.taskCode || '',
        description: task.description || '',
        isActive: task.isActive !== undefined ? task.isActive : true,
        isBillable: task.isBillable !== undefined ? task.isBillable : true,
      });
    } else {
      resetTaskForm();
    }
    setShowTaskModal(true);
  };

  const openAssignmentModal = async (project, task, fromProjectLevel = false) => {
    setSelectedProject(project);
    setProjectAssignedEmployeeIds(new Set());
    setAssignmentForm({
      taskId: task?.id || '',
      employeeIds: [],
      startDate: '',
      endDate: '',
      allocationPercent: 100,
    });
    setEmployeeSearchTerm('');
    setShowProjectTeamOnly(!fromProjectLevel);
    setIsProjectLevelAssign(fromProjectLevel);
    setShowAssignmentModal(true);
    fetchEmployees(dataView);

    try {
      const resp = await projectAPI.getAssignmentsForProject(project.id);
      const assignments = resp.data || [];
      const assignedIds = new Set(assignments.map(a => a.employeeId).filter(Boolean));
      setProjectAssignedEmployeeIds(assignedIds);
    } catch (e) {
      console.error('Error fetching project assignments:', e);
      setProjectAssignedEmployeeIds(new Set());
    }
  };

  const resetProjectForm = () => {
    setProjectForm({
      projectName: '',
      projectCode: '',
      description: '',
      isActive: true,
      isBillable: false,
    });
    setEditingProject(null);
  };

  const resetTaskForm = () => {
    setTaskForm({
      taskName: '',
      taskCode: '',
      description: '',
      isActive: true,
      isBillable: false,
    });
    setEditingTask(null);
  };

  const getEmployeeDisplayName = (emp) => {
    if (!emp) return '';
    const fromParts = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
    return fromParts || emp.employeeName || emp.fullName || emp.name || '';
  };

  const isCurrentUserEmployee = (emp) => {
    if (!emp) return false;

    const currentRoles = [
      ...(user?.roles || []),
      user?.employeeRoleName,
      user?.role?.name,
      user?.roleName,
      adminUser?.employeeRoleName,
      adminUser?.role?.name,
      adminUser?.roleName,
    ].filter(Boolean).map(r => String(r).toUpperCase());

    const isHrOrCeoOrManager = currentRoles.some(r => ['HR', 'CEO', 'MANAGER'].includes(r));

    // HR, CEO, and Manager should be able to assign tasks to themselves, so don't filter them out
    if (isHrOrCeoOrManager) {
      return false;
    }

    // Filter out pure Admin profiles
    if (adminUser) {
      const isSelfByEmail = adminUser.email && emp.email && String(emp.email).toLowerCase() === String(adminUser.email).toLowerCase();
      if (isSelfByEmail) return true;
    }

    return false;
  };

  const isEmployeeOnProject = (emp) =>
    Array.from(projectAssignedEmployeeIds).some((id) => String(id) === String(emp?.id));

  const matchesEmployeeSearch = (emp, term) => {
    if (!term) return true;
    const query = term.toLowerCase().trim();
    const name = getEmployeeDisplayName(emp).toLowerCase();
    const id = String(emp.employeeId || emp.id || '').toLowerCase();
    const email = String(emp.email || '').toLowerCase();
    const dept = String(emp.departmentName || emp.department?.name || emp.department || '').toLowerCase();
    return name.includes(query) || id.includes(query) || email.includes(query) || dept.includes(query);
  };

  const getAssignableEmployees = () => {
    if (!Array.isArray(employees)) return [];

    let pool = employees.filter((emp) => !isCurrentUserEmployee(emp));

    if (showProjectTeamOnly) {
      pool = pool.filter((emp) => isEmployeeOnProject(emp));
    } else if (isProjectLevelAssign) {
      pool = pool.filter((emp) => !isEmployeeOnProject(emp));
    }

    return pool.filter((emp) => matchesEmployeeSearch(emp, employeeSearchTerm));
  };

  const employeeIdsMatch = (a, b) => String(a) === String(b);

  const toggleAssignmentEmployee = (empId) => {
    setAssignmentForm((prev) => {
      const currentIds = prev.employeeIds || [];
      if (currentIds.some((id) => employeeIdsMatch(id, empId))) {
        return { ...prev, employeeIds: currentIds.filter((id) => !employeeIdsMatch(id, empId)) };
      }
      return { ...prev, employeeIds: [...currentIds, empId] };
    });
  };

  const resetAssignmentForm = () => {
    setAssignmentForm({
      taskId: '',
      employeeIds: [],
      startDate: '',
      endDate: '',
      allocationPercent: 100,
    });
    setSelectedProject(null);
  };

  // Helper to filter team assignments
  const getFilteredAssignments = () => {
    return teamAssignments.filter(assignment => {
      // 1. Search filter (multi-field)
      if (assignmentSearchTerm) {
        const query = assignmentSearchTerm.toLowerCase();
        const approvedByName = getResolveEmployeeName(assignment.approvedByEmployeeName, assignment.approvedByEmployeeId).toLowerCase();
        const createdByName = getResolveEmployeeName(assignment.createdByEmployeeName, assignment.createdByEmployeeId).toLowerCase();
        const statusStr = (assignment.status || 'Active').toLowerCase();
        const workStatusStr = (assignment.status || 'NOT_STARTED').replace(/_/g, ' ').toLowerCase();

        const matches = (
          (assignment.projectName || '').toLowerCase().includes(query) ||
          (assignment.taskName || '').toLowerCase().includes(query) ||
          (assignment.employeeName || '').toLowerCase().includes(query) ||
          statusStr.includes(query) ||
          workStatusStr.includes(query) ||
          approvedByName.includes(query) ||
          createdByName.includes(query) ||
          (assignment.startDate && assignment.startDate.includes(query)) ||
          (assignment.endDate && assignment.endDate.includes(query))
        );
        if (!matches) return false;
      }

      // 2. Date range filter (Overlap matching: Task is active within the selected range)
      if (assignmentStartDate || assignmentEndDate) {
        const filterStart = assignmentStartDate ? new Date(assignmentStartDate) : null;
        const filterEnd = assignmentEndDate ? new Date(assignmentEndDate) : null;

        const taskStart = assignment.startDate ? new Date(assignment.startDate) : null;
        const taskEnd = assignment.endDate ? new Date(assignment.endDate) : null;

        // If filtering by Start: task must end after range start (if task has end date)
        if (filterStart && taskEnd && taskEnd < filterStart) {
          return false;
        }

        // If filtering by End: task must start before range end (if task has start date)
        if (filterEnd && taskStart && taskStart > filterEnd) {
          return false;
        }
      }

      return true;
    });
  };

  const filteredAssignments = getFilteredAssignments();

  if (loading) {
    return (
      <div className="main-content">
        <Header title="Project Management" subtitle="Create projects, tasks, and assign them to employees" />
        <div className="page-content" style={{ padding: '14px 16px 20px' }}>
          <div className="card" style={{ padding: '16px 20px', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9', marginBottom: '16px' }}>
              <div>
                <div className="nt-skeleton" style={{ width: '140px', height: '18px', marginBottom: '6px', borderRadius: '4px' }} />
                <div className="nt-skeleton" style={{ width: '220px', height: '12px', borderRadius: '4px' }} />
              </div>
              <div className="nt-skeleton" style={{ width: '120px', height: '32px', borderRadius: '6px' }} />
            </div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
              <div className="nt-skeleton" style={{ flex: 1, height: '32px', borderRadius: '6px' }} />
              <div className="nt-skeleton" style={{ flex: 1, height: '32px', borderRadius: '6px' }} />
              <div className="nt-skeleton" style={{ flex: 1, height: '32px', borderRadius: '6px' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ padding: '16px', border: '1px solid #f1f5f9', borderRadius: '8px', background: '#fff', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="nt-skeleton" style={{ width: '16px', height: '16px', borderRadius: '4px' }} />
                      <div className="nt-skeleton" style={{ width: '180px', height: '16px', borderRadius: '4px' }} />
                      <div className="nt-skeleton" style={{ width: '60px', height: '18px', borderRadius: '12px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <div className="nt-skeleton" style={{ width: '90px', height: '28px', borderRadius: '6px' }} />
                      <div className="nt-skeleton" style={{ width: '80px', height: '28px', borderRadius: '6px' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <Header
        title="Project Management"
        subtitle="Create projects, tasks, and assign them to employees"
      />

      <div className="page-content" style={{ padding: '14px 16px 20px' }}>
        {/* Unified Main Card Container */}
        <div className="card" style={{ padding: '16px 20px', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', background: '#fff' }}>
          {/* Header Row with Action Button */}
          <div className="approvals-header" style={{ paddingBottom: '14px', borderBottom: '1px solid #f1f5f9', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 2px' }}>Projects</h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Manage your team Projects and tasks</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {(sessionType === 'admin' || isHR) && (
                <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                  <button
                    onClick={() => setDataView('all')}
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: 'none',
                      background: dataView === 'all' ? '#fff' : 'transparent',
                      color: dataView === 'all' ? '#0f172a' : '#64748b',
                      boxShadow: dataView === 'all' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    All Company
                  </button>
                  <button
                    onClick={() => setDataView('team')}
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: 'none',
                      background: dataView === 'team' ? '#fff' : 'transparent',
                      color: dataView === 'team' ? '#0f172a' : '#64748b',
                      boxShadow: dataView === 'team' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    My Team Data
                  </button>
                </div>
              )}
              {activeTab === 'projects' && hasCrudPermission('PROJECT_MANAGEMENT', 'create') && (
                <button
                  onClick={() => openProjectModal()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 14px',
                    height: '32px',
                    background: '#4f46e5',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={15} />
                  Create Project
                </button>
              )}
            </div>
          </div>

          {/* Clean Sub Navigation Tabs */}
          <div className="mp-tabs" style={{ marginBottom: '16px', background: '#f1f5f9', padding: '3px', borderRadius: '8px', display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setActiveTab('projects')}
              className={`mp-tab ${activeTab === 'projects' ? 'active' : ''}`}
              style={{
                flex: '1',
                height: '32px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                background: activeTab === 'projects' ? '#fff' : 'transparent',
                color: activeTab === 'projects' ? '#0f172a' : '#64748b',
                boxShadow: activeTab === 'projects' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Briefcase size={15} />
              Projects
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`mp-tab ${activeTab === 'tasks' ? 'active' : ''}`}
              style={{
                flex: '1',
                height: '32px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                background: activeTab === 'tasks' ? '#fff' : 'transparent',
                color: activeTab === 'tasks' ? '#0f172a' : '#64748b',
                boxShadow: activeTab === 'tasks' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <CheckCircle size={15} />
              Active Tasks
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className={`mp-tab ${activeTab === 'approvals' ? 'active' : ''}`}
              style={{
                flex: '1',
                height: '32px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                background: activeTab === 'approvals' ? '#fff' : 'transparent',
                color: activeTab === 'approvals' ? '#0f172a' : '#64748b',
                boxShadow: activeTab === 'approvals' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <CheckSquare size={15} />
              Approvals
              {pendingTasks.length > 0 && (
                <span style={{
                  background: '#ef4444',
                  color: 'white',
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontWeight: 700
                }}>
                  {pendingTasks.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab Contents Container */}
          {activeTab === 'projects' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {projects.length === 0 ? (
                <div style={{
                  padding: 40,
                  textAlign: 'center',
                  background: '#f8fafc',
                  borderRadius: 8,
                  border: '1px dashed #e2e8f0'
                }}>
                  <Briefcase size={48} style={{ color: '#d1d5db', marginBottom: 16 }} />
                  <p style={{ color: '#6b7280', fontSize: 16 }}>No projects found. Create one to get started.</p>
                </div>
              ) : (
                projects.map(project => (
                  <div
                    key={project.id}
                    style={{
                      background: project.isPaused ? '#fffbeb' : 'white',
                      borderRadius: 12,
                      border: project.isPaused ? '1px solid #fcd34d' : '1px solid #e5e7eb',
                      overflow: 'hidden',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      opacity: project.isActive ? 1 : 0.85
                    }}
                  >
                    {/* Project Header */}
                    <div style={{
                      padding: '16px 20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: expandedProjects.has(project.id) ? '#f8fafc' : (project.isPaused ? '#fffbeb' : 'white'),
                      borderBottom: expandedProjects.has(project.id) ? '1px solid #e5e7eb' : 'none',
                    }}>
                      <div
                        onClick={() => toggleProjectExpansion(project.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flex: 1 }}
                      >
                        {expandedProjects.has(project.id) ? <ChevronDown size={20} color="#94a3b8" /> : <ChevronRight size={20} color="#94a3b8" />}
                        <div>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>
                            {project.projectName}
                            {project.projectCode && <span style={{ marginLeft: 8, opacity: 0.5, fontWeight: 400 }}>({project.projectCode})</span>}
                            {project.isPaused && (
                              <span style={{
                                marginLeft: 10,
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#b45309',
                                background: '#fef3c7',
                                border: '1px solid #fcd34d',
                                borderRadius: 999,
                                padding: '2px 8px',
                                verticalAlign: 'middle'
                              }}>
                                Paused
                              </span>
                            )}
                          </h3>
                          <div style={{ display: 'flex', gap: 12, marginTop: 4, alignItems: 'center' }}>
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleProjectStatus(project);
                              }}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 4, 
                                cursor: 'pointer',
                                padding: '2px 4px',
                                borderRadius: 4,
                                transition: 'background 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                              title={project.isActive ? 'Deactivate Project' : 'Activate Project'}
                            >
                              {project.isActive ? (
                                <ToggleRight size={20} color="#10b981" fill="#10b98120" />
                              ) : (
                                <ToggleLeft size={20} color="#94a3b8" />
                              )}
                              <span style={{ fontSize: 12, color: project.isActive ? '#10b981' : '#64748b', fontWeight: 600 }}>
                                {project.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>|</span>
                            <span style={{ fontSize: 12, color: '#64748b' }}>
                              {project.isBillable ? 'Billable' : 'Non-billable'}
                            </span>
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>|</span>
                            <span style={{ fontSize: 12, color: '#64748b' }}>
                              {(project.tasks || []).length} Tasks
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {hasCrudPermission('PROJECT_MANAGEMENT', 'update') && project.isActive && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePauseOrResumeProject(project);
                            }}
                            style={{
                              padding: '6px 12px',
                              background: project.isPaused ? '#ecfdf5' : '#fff7ed',
                              color: project.isPaused ? '#047857' : '#c2410c',
                              border: `1px solid ${project.isPaused ? '#a7f3d0' : '#fdba74'}`,
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                            title={project.isPaused ? 'Resume entire project' : 'Pause entire project'}
                          >
                            {project.isPaused ? <Play size={14} /> : <Pause size={14} />}
                            {project.isPaused ? 'Resume Project' : 'Pause Project'}
                          </button>
                        )}
                        {hasCrudPermission('PROJECT_MANAGEMENT', 'update') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isProjectOperational(project)) return;
                              if (project.tasks && project.tasks.length > 0) {
                                openAssignmentModal(project, project.tasks[0], true);
                              } else {
                                toast.error('Please create at least one task first to assign members.');
                              }
                            }}
                            disabled={!isProjectOperational(project)}
                            style={{
                              padding: '6px 12px',
                              background: isProjectOperational(project) ? '#f0f9ff' : '#f3f4f6',
                              color: isProjectOperational(project) ? '#0369a1' : '#94a3b8',
                              border: 'none',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: isProjectOperational(project) ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              marginLeft: 'auto',
                              opacity: isProjectOperational(project) ? 1 : 0.6
                            }}
                          >
                            <Users size={14} /> Assign Team
                          </button>
                        )}
                        {hasCrudPermission('PROJECT_MANAGEMENT', 'create') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isProjectOperational(project)) return;
                              openTaskModal(project);
                            }}
                            disabled={!isProjectOperational(project)}
                            style={{
                              padding: '6px 12px',
                              background: isProjectOperational(project) ? '#eff6ff' : '#f3f4f6',
                              color: isProjectOperational(project) ? '#3b82f6' : '#94a3b8',
                              border: 'none',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: isProjectOperational(project) ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              opacity: isProjectOperational(project) ? 1 : 0.6
                            }}
                          >
                            <Plus size={14} /> Add Task
                          </button>
                        )}
                        {hasCrudPermission('PROJECT_MANAGEMENT', 'update') && (
                          <button
                            onClick={() => openProjectModal(project)}
                            style={{
                              padding: '6px',
                              background: 'none',
                              border: 'none',
                              color: '#6b7280',
                              cursor: 'pointer',
                              borderRadius: 4
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        {hasCrudPermission('PROJECT_MANAGEMENT', 'delete') && (
                          <button
                            onClick={() => handleDeleteProject(project.id)}
                            style={{
                              padding: '6px',
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              borderRadius: 4
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Project Tasks (Expanded) */}
                    {expandedProjects.has(project.id) && (
                      <div style={{ padding: '0 20px 20px 20px' }}>
                        <div style={{
                          marginTop: 16,
                          background: '#f8fafc',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                        }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Task Name</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Billable</th>
                                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(project.tasks || []).length === 0 ? (
                                <tr>
                                  <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                                    No tasks added to this project yet.
                                  </td>
                                </tr>
                              ) : (
                                project.tasks.map(task => (
                                  <tr key={task.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '12px 16px' }}>
                                      <div style={{ fontSize: 14, fontWeight: 500, color: '#1e293b' }}>{task.taskName}</div>
                                      {task.taskCode && <div style={{ fontSize: 11, color: '#64748b' }}>{task.taskCode}</div>}
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                      <div 
                                        onClick={() => isProjectOperational(project) && handleToggleTaskStatus(project.id, task)}
                                        style={{ 
                                          display: 'inline-flex', 
                                          alignItems: 'center', 
                                          gap: 6, 
                                          cursor: isProjectOperational(project) ? 'pointer' : 'not-allowed',
                                          padding: '2px 8px',
                                          borderRadius: 12,
                                          background: (!isProjectOperational(project) || !task.isActive) ? '#f3f4f6' : '#dcfce7',
                                          color: (!isProjectOperational(project) || !task.isActive) ? '#64748b' : '#166534',
                                          border: `1px solid ${(!isProjectOperational(project) || !task.isActive) ? '#d1d5db' : '#86efac'}`,
                                          transition: 'all 0.2s',
                                          opacity: isProjectOperational(project) ? 1 : 0.7
                                        }}
                                        onMouseEnter={(e) => isProjectOperational(project) && (e.currentTarget.style.transform = 'scale(1.02)')}
                                        onMouseLeave={(e) => isProjectOperational(project) && (e.currentTarget.style.transform = 'scale(1)')}
                                        title={project.isPaused ? 'Project is Paused' : (!project.isActive ? 'Project is Inactive' : (task.isActive ? 'Deactivate Task' : 'Activate Task'))}
                                      >
                                        {task.isActive && isProjectOperational(project) ? (
                                          <ToggleRight size={16} />
                                        ) : (
                                          <ToggleLeft size={16} />
                                        )}
                                        <span style={{ fontSize: 11, fontWeight: 700 }}>
                                          {project.isPaused ? 'Paused (Proj)' : (!project.isActive ? 'Inactive (Proj)' : (task.isActive ? 'Active' : 'Inactive'))}
                                        </span>
                                      </div>
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                      <span style={{ fontSize: 13, color: '#64748b' }}>
                                        {task.isBillable ? 'Yes' : 'No'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                        {hasCrudPermission('PROJECT_MANAGEMENT', 'update') && (
                                          <button
                                            onClick={() => isProjectOperational(project) && openTaskModal(project, task)}
                                            disabled={!isProjectOperational(project)}
                                            style={{
                                              padding: '4px 8px',
                                              background: isProjectOperational(project) ? '#f3f4f6' : '#f8fafc',
                                              border: 'none',
                                              borderRadius: 4,
                                              cursor: isProjectOperational(project) ? 'pointer' : 'not-allowed',
                                              color: isProjectOperational(project) ? '#64748b' : '#cbd5e1',
                                              opacity: isProjectOperational(project) ? 1 : 0.6
                                            }}
                                            title={isProjectOperational(project) ? "Edit Task" : (project.isPaused ? "Project is Paused" : "Project is Inactive")}
                                          >
                                            <Edit size={14} />
                                          </button>
                                        )}
                                        {hasCrudPermission('PROJECT_MANAGEMENT', 'update') && (
                                          <button
                                            onClick={() => isProjectOperational(project) && openAssignmentModal(project, task)}
                                            disabled={!isProjectOperational(project)}
                                            style={{
                                              padding: '4px 8px',
                                              background: isProjectOperational(project) ? '#dbeafe' : '#f3f4f6',
                                              border: 'none',
                                              borderRadius: 4,
                                              cursor: isProjectOperational(project) ? 'pointer' : 'not-allowed',
                                              color: isProjectOperational(project) ? '#1e40af' : '#94a3b8',
                                              opacity: isProjectOperational(project) ? 1 : 0.6
                                            }}
                                            title={isProjectOperational(project) ? "Assign Employees" : (project.isPaused ? "Project is Paused" : "Project is Inactive")}
                                          >
                                            <Users size={14} />
                                          </button>
                                        )}
                                        {hasCrudPermission('PROJECT_MANAGEMENT', 'delete') && (
                                          <button
                                            onClick={() => isProjectOperational(project) && handleDeleteTask(project.id, task.id)}
                                            disabled={!isProjectOperational(project)}
                                            style={{
                                              padding: '4px 8px',
                                              background: isProjectOperational(project) ? '#fee2e2' : '#f3f4f6',
                                              border: 'none',
                                              borderRadius: 4,
                                              cursor: isProjectOperational(project) ? 'pointer' : 'not-allowed',
                                              color: isProjectOperational(project) ? '#ef4444' : '#94a3b8',
                                              opacity: isProjectOperational(project) ? 1 : 0.6
                                            }}
                                            title={isProjectOperational(project) ? "Delete Task" : (project.isPaused ? "Project is Paused" : "Project is Inactive")}
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

        {activeTab === 'tasks' && (
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Team Assignments</h2>
                <span style={{ padding: '2px 10px', borderRadius: 12, background: '#eff6ff', fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>
                  {filteredAssignments.length} {filteredAssignments.length === teamAssignments.length ? 'Total' : 'Found'}
                </span>
              </div>
              <button
                onClick={() => fetchTeamAssignments(true)}
                disabled={fetchingAssignments}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  background: 'none',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: 'pointer',
                  color: '#4b5563'
                }}
              >
                {fetchingAssignments ? <Loader2 size={14} className="spin-slow" /> : <RotateCw size={14} />}
                Refresh
              </button>
            </div>

            {/* Filter Bar */}
            <div style={{ padding: '12px 24px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#9ca3af' }} />
                <input
                  type="text"
                  placeholder="Search by employee, project, task, status, created by, approved by..."
                  value={assignmentSearchTerm}
                  onChange={(e) => setAssignmentSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 34px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#4b5563', fontWeight: 500 }}>From:</span>
                <input
                  type="date"
                  value={assignmentStartDate}
                  onChange={(e) => setAssignmentStartDate(e.target.value)}
                  style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#4b5563', fontWeight: 500 }}>To:</span>
                <input
                  type="date"
                  value={assignmentEndDate}
                  onChange={(e) => setAssignmentEndDate(e.target.value)}
                  style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}
                />
              </div>
              {(assignmentSearchTerm || assignmentStartDate || assignmentEndDate) && (
                <button
                  onClick={() => {
                    setAssignmentSearchTerm('');
                    setAssignmentStartDate('');
                    setAssignmentEndDate('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <X size={14} /> Clear
                </button>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Project</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Task</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Start Date</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>End Date</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Allocation</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Work Status</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Approved By</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Created By</th>
                  </tr>
                </thead>
                <tbody>
                  {fetchingAssignments && teamAssignments.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ padding: '40px', textAlign: 'center' }}>
                        <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto', color: '#3b82f6' }} />
                        <p style={{ marginTop: 12, color: '#6b7280' }}>Loading team assignments...</p>
                      </td>
                    </tr>
                  ) : filteredAssignments.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                        {teamAssignments.length === 0 ? 'No assignments found for your team.' : 'No matches found for your search filters.'}
                      </td>
                    </tr>
                  ) : (
                    filteredAssignments.map((assignment, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '8px 12px', fontSize: 11, fontWeight: 500 }}>{assignment.projectName}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ fontSize: 11, fontWeight: 500 }}>{assignment.taskName}</div>
                          <div style={{ fontSize: 10, color: '#6b7280' }}>{assignment.employeeName}</div>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 11, color: '#4b5563' }}>
                          {assignment.startDate ? new Date(assignment.startDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 11, color: '#4b5563' }}>
                          {assignment.endDate ? new Date(assignment.endDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 11 }}>
                          <span style={{ padding: '1px 6px', borderRadius: 4, background: '#f3f4f6', fontWeight: 600 }}>
                            {assignment.allocationPercent}%
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: 10,
                            fontWeight: 600,
                            background: (assignment.projectActive && assignment.taskActive) ? '#dcfce7' : '#f3f4f6',
                            color: (assignment.projectActive && assignment.taskActive) ? '#166534' : '#64748b',
                            border: `1px solid ${(assignment.projectActive && assignment.taskActive) ? '#86efac' : '#d1d5db'}`,
                            textTransform: 'uppercase'
                          }}>
                            {(!assignment.projectActive) ? 'Inactive (Proj)' : (assignment.taskActive ? 'Active' : 'Inactive')}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 11, textAlign: 'left' }}>
                          <span style={{
                            padding: '1px 8px',
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 600,
                            background: assignment.status === 'COMPLETED' ? '#dcfce7' :
                              assignment.status === 'IN_PROGRESS' ? '#dbeafe' : '#f3f4f6',
                            color: assignment.status === 'COMPLETED' ? '#166534' :
                              assignment.status === 'IN_PROGRESS' ? '#1e40af' : '#4b5563',
                            border: `1px solid ${assignment.status === 'COMPLETED' ? '#86efac' :
                              assignment.status === 'IN_PROGRESS' ? '#93c5fd' : '#d1d5db'}`
                          }}>
                            {(assignment.status || 'NOT_STARTED').replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 11, color: '#6b7280' }}>
                          {getResolveEmployeeName(assignment.approvedByEmployeeName, assignment.approvedByEmployeeId)}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 11, color: '#6b7280' }}>
                          {getResolveEmployeeName(assignment.createdByEmployeeName, assignment.createdByEmployeeId)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'approvals' && (
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Task Approvals</h2>
                <span style={{ padding: '4px 12px', borderRadius: 12, background: '#fff7ed', fontSize: 12, color: '#c2410c', fontWeight: 600 }}>
                  {pendingTasks.filter(task => {
                    if (!assignmentSearchTerm) return true;
                    const query = assignmentSearchTerm.toLowerCase();
                    return (task.taskName || '').toLowerCase().includes(query) ||
                      (task.employeeName || '').toLowerCase().includes(query) ||
                      (task.projectName || '').toLowerCase().includes(query);
                  }).length} Found
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#9ca3af' }} />
                  <input
                    type="text"
                    placeholder="Search approvals..."
                    value={assignmentSearchTerm}
                    onChange={(e) => setAssignmentSearchTerm(e.target.value)}
                    style={{
                      padding: '6px 10px 6px 30px',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      fontSize: 12,
                      width: 180
                    }}
                  />
                </div>
                <button
                  onClick={() => fetchPendingTasks(true)}
                  disabled={fetchingPending}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    background: 'none',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    fontSize: 13,
                    cursor: 'pointer',
                    color: '#4b5563'
                  }}
                >
                  {fetchingPending ? <Loader2 size={16} className="spin-slow" /> : <RotateCw size={16} />}
                  Refresh
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Project</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Task Details</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Requested By</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Billable</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fetchingPending && !pendingLoaded ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '40px', textAlign: 'center' }}>
                        <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto', color: '#3b82f6' }} />
                        <p style={{ marginTop: 12, color: '#6b7280' }}>Loading pending tasks...</p>
                      </td>
                    </tr>
                  ) : pendingTasks.filter(task => {
                    if (!assignmentSearchTerm) return true;
                    const query = assignmentSearchTerm.toLowerCase();
                    return (task.taskName || '').toLowerCase().includes(query) ||
                      (task.employeeName || '').toLowerCase().includes(query) ||
                      (task.projectName || '').toLowerCase().includes(query);
                  }).length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '60px', textAlign: 'center' }}>
                        <div style={{ marginBottom: 16 }}>
                          <CheckSquare size={48} style={{ color: '#d1d5db', margin: '0 auto' }} />
                        </div>
                        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>No matching pending tasks</h3>
                        <p style={{ color: '#6b7280', marginTop: 4 }}>Try clearing your search results.</p>
                      </td>
                    </tr>
                  ) : (
                    pendingTasks.filter(task => {
                      if (!assignmentSearchTerm) return true;
                      const query = assignmentSearchTerm.toLowerCase();
                      return (task.taskName || '').toLowerCase().includes(query) ||
                        (task.employeeName || '').toLowerCase().includes(query) ||
                        (task.projectName || '').toLowerCase().includes(query);
                    }).map((task) => (
                      <tr key={task.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '16px', fontSize: 14, fontWeight: 500, color: '#111827' }}>
                          {task.projectName || 'General'}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{task.taskName}</div>
                          {task.description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{task.description}</div>}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                              {task.employeeName?.charAt(0) || '?'}
                            </div>
                            <span style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{task.employeeName}</span>
                          </div>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 600,
                            background: task.isBillable ? '#ecfdf5' : '#f3f4f6',
                            color: task.isBillable ? '#059669' : '#6b7280',
                            border: `1px solid ${task.isBillable ? '#6ee7b7' : '#d1d5db'}`
                          }}>
                            {task.isBillable ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 600,
                            background: '#fff7ed',
                            color: '#c2410c',
                            border: '1px solid #fdba74'
                          }}>
                            Pending Approval
                          </span>
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleApproveTask(task.id)}
                              disabled={processingId === task.id}
                              style={{
                                padding: '8px 16px',
                                background: '#22c55e',
                                color: 'white',
                                border: 'none',
                                borderRadius: 6,
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: processingId === task.id ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                opacity: processingId === task.id && actionType !== 'approve' ? 0.7 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                minWidth: 90,
                                justifyContent: 'center'
                              }}
                              onMouseEnter={(e) => !processingId && (e.currentTarget.style.background = '#16a34a')}
                              onMouseLeave={(e) => !processingId && (e.currentTarget.style.background = '#22c55e')}
                            >
                              {processingId === task.id && actionType === 'approve' ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : null}
                              {processingId === task.id && actionType === 'approve' ? 'Approving...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleRejectTask(task.id)}
                              disabled={processingId === task.id}
                              style={{
                                padding: '8px 16px',
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: 6,
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: processingId === task.id ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                opacity: processingId === task.id && actionType !== 'reject' ? 0.7 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                minWidth: 80,
                                justifyContent: 'center'
                              }}
                              onMouseEnter={(e) => !processingId && (e.currentTarget.style.background = '#dc2626')}
                              onMouseLeave={(e) => !processingId && (e.currentTarget.style.background = '#ef4444')}
                            >
                              {processingId === task.id && actionType === 'reject' ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : null}
                              {processingId === task.id && actionType === 'reject' ? 'Rejecting...' : 'Reject'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Project Modal */}
      {showProjectModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'white',
            borderRadius: 12,
            padding: 24,
            width: '90%',
            maxWidth: 600,
            maxHeight: '90vh',
            overflow: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
                {editingProject ? 'Edit Project' : 'Create Project'}
              </h2>
              <button
                onClick={() => {
                  setShowProjectModal(false);
                  resetProjectForm();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                  Project Name *
                </label>
                <input
                  type="text"
                  value={projectForm.projectName}
                  onChange={(e) => setProjectForm({ ...projectForm, projectName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                  placeholder="Enter project name"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                  Project Code
                </label>
                <input
                  type="text"
                  value={projectForm.projectCode}
                  onChange={(e) => setProjectForm({ ...projectForm, projectCode: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                  placeholder="Enter project code (optional)"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                  Description
                </label>
                <textarea
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14,
                    minHeight: 100,
                    resize: 'vertical',
                  }}
                  placeholder="Enter project description"
                />
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={projectForm.isActive}
                    onChange={(e) => setProjectForm({ ...projectForm, isActive: e.target.checked })}
                  />
                  <span style={{ fontSize: 14 }}>Active</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={projectForm.isBillable}
                    onChange={(e) => setProjectForm({ ...projectForm, isBillable: e.target.checked })}
                  />
                  <span style={{ fontSize: 14 }}>Billable</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  onClick={() => {
                    setShowProjectModal(false);
                    resetProjectForm();
                  }}
                  style={{
                    padding: '10px 20px',
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 500,
                    color: '#374151',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={editingProject ? handleUpdateProject : handleCreateProject}
                  disabled={submittingProject}
                  style={{
                    padding: '10px 20px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: submittingProject ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    opacity: submittingProject ? 0.7 : 1,
                  }}
                >
                  {submittingProject && <Loader2 size={16} className="animate-spin" />}
                  {editingProject ? (submittingProject ? 'Updating...' : 'Update') : (submittingProject ? 'Creating...' : 'Create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && selectedProject && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'white',
            borderRadius: 12,
            padding: 24,
            width: '90%',
            maxWidth: 600,
            maxHeight: '90vh',
            overflow: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
                {editingTask ? 'Edit Task' : 'Create Task'}
                <span style={{ fontSize: 14, fontWeight: 400, color: '#6b7280', marginLeft: 8 }}>
                  in {selectedProject.projectName}
                </span>
              </h2>
              <button
                onClick={() => {
                  setShowTaskModal(false);
                  resetTaskForm();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                  Task Name *
                </label>
                <input
                  type="text"
                  value={taskForm.taskName}
                  onChange={(e) => setTaskForm({ ...taskForm, taskName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                  placeholder="Enter task name"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                  Task Code
                </label>
                <input
                  type="text"
                  value={taskForm.taskCode}
                  onChange={(e) => setTaskForm({ ...taskForm, taskCode: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                  placeholder="Enter task code (optional)"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                  Description
                </label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14,
                    minHeight: 100,
                    resize: 'vertical',
                  }}
                  placeholder="Enter task description"
                />
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={taskForm.isActive}
                    onChange={(e) => setTaskForm({ ...taskForm, isActive: e.target.checked })}
                  />
                  <span style={{ fontSize: 14 }}>Active</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={taskForm.isBillable}
                    onChange={(e) => setTaskForm({ ...taskForm, isBillable: e.target.checked })}
                  />
                  <span style={{ fontSize: 14 }}>Billable</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  onClick={() => {
                    setShowTaskModal(false);
                    resetTaskForm();
                  }}
                  style={{
                    padding: '10px 20px',
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 500,
                    color: '#374151',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={editingTask ? handleUpdateTask : handleCreateTask}
                  disabled={submittingTask}
                  style={{
                    padding: '10px 20px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: submittingTask ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    opacity: submittingTask ? 0.7 : 1,
                  }}
                >
                  {submittingTask && <Loader2 size={16} className="animate-spin" />}
                  {editingTask ? (submittingTask ? 'Updating...' : 'Update') : (submittingTask ? 'Creating...' : 'Create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignmentModal && selectedProject && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'white',
            borderRadius: 12,
            padding: '16px 20px',
            width: '90%',
            maxWidth: 420,
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
                {isProjectLevelAssign ? 'Assign Project to Employees' : 'Assign Task to Employee'}
              </h2>
              <button
                onClick={() => {
                  setShowAssignmentModal(false);
                  setSubmittedAssignment(false);
                  resetAssignmentForm();
                }}
                style={{
                  background: '#f3f4f6',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: '50%',
                  display: 'flex',
                  color: '#6b7280'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
                    Select Employees *
                  </label>
                  <div 
                      onClick={() => setShowProjectTeamOnly(!showProjectTeamOnly)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 6, 
                        cursor: 'pointer',
                        fontSize: 12,
                        color: showProjectTeamOnly ? '#1e40af' : '#64748b',
                        fontWeight: 700,
                        padding: '4px 10px',
                        background: showProjectTeamOnly ? '#dbeafe' : '#f1f5f9',
                        borderRadius: 20,
                        border: `1px solid ${showProjectTeamOnly ? '#3b82f6' : '#d1d5db'}`,
                        transition: 'all 0.2s'
                      }}
                    >
                      {showProjectTeamOnly ? <LayoutGrid size={12} /> : <Users size={12} />}
                      {showProjectTeamOnly
                        ? (isProjectLevelAssign ? 'Show Available Employees' : 'Show All Employees')
                        : (isProjectLevelAssign ? 'Show Current Project Team' : 'Show Project Team Only')}
                    </div>
                </div>
                {(() => {
                  const filteredEmployees = getAssignableEmployees();
                  const selectedEmps = Array.isArray(employees)
                    ? employees.filter((e) => assignmentForm.employeeIds.some((id) => employeeIdsMatch(id, e.id)))
                    : [];

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: 10, top: 12, color: '#9ca3af', pointerEvents: 'none' }} />
                        <input
                          type="text"
                          placeholder="Search by name, ID, email, or department..."
                          value={employeeSearchTerm}
                          onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 12px 10px 34px',
                            border: '1px solid #d1d5db',
                            borderRadius: 8,
                            fontSize: 14,
                            outline: 'none'
                          }}
                        />
                      </div>
                      
                      <div style={{
                        maxHeight: '180px',
                        overflowY: 'auto',
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        background: '#f9fafb',
                      }}>
                        {filteredEmployees.length === 0 ? (
                          <div style={{ padding: '20px', textAlign: 'center', fontSize: 13, color: '#6b7280' }}>
                            {employeeSearchTerm
                              ? 'No matching employees found'
                              : showProjectTeamOnly
                                ? 'No employees on this project yet'
                                : isProjectLevelAssign
                                  ? 'All available employees are already on this project'
                                  : 'No available employees found'}
                          </div>
                        ) : (
                          filteredEmployees.map(emp => {
                            const isSelected = assignmentForm.employeeIds.some((id) => employeeIdsMatch(id, emp.id));
                            const displayName = getEmployeeDisplayName(emp) || 'Unknown';
                            return (
                              <div
                                key={emp.id}
                                onClick={() => toggleAssignmentEmployee(emp.id)}
                                style={{
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  background: isSelected ? '#eff6ff' : 'white',
                                  borderBottom: '1px solid #f3f4f6',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => { if(!isSelected) e.currentTarget.style.background = '#f9fafb'; }}
                                onMouseLeave={(e) => { if(!isSelected) e.currentTarget.style.background = 'white'; }}
                              >
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 13, color: isSelected ? '#1d4ed8' : '#374151' }}>
                                    {displayName}
                                  </div>
                                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                                    {emp.employeeId || emp.id} • {emp.departmentName || emp.department || 'No Dept'}
                                    {emp.email ? ` • ${emp.email}` : ''}
                                  </div>
                                </div>
                                {isSelected ? (
                                  <CheckCircle size={18} color="#3b82f6" fill="#3b82f620" />
                                ) : (
                                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: '1px solid #d1d5db' }} />
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {selectedEmps.length > 0 && (
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>
                            Selected ({selectedEmps.length})
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {selectedEmps.map(emp => (
                              <div
                                key={emp.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '4px 10px',
                                  background: 'white',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: 20,
                                  fontSize: 12,
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                }}
                              >
                                <span style={{ fontWeight: 600, color: '#334155' }}>{getEmployeeDisplayName(emp) || emp.employeeId}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleAssignmentEmployee(emp.id); }}
                                  style={{
                                    border: 'none',
                                    background: '#f1f5f9',
                                    padding: 2,
                                    borderRadius: '50%',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    color: '#64748b'
                                  }}
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Dates row - side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontSize: 13, fontWeight: 500 }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={assignmentForm.startDate}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setAssignmentForm(prev => {
                        const updates = { ...prev, startDate: newStart };
                        // If end date exists and is earlier than new start date, reset end date
                        if (prev.endDate && newStart && prev.endDate < newStart) {
                          updates.endDate = newStart;
                        }
                        return updates;
                      });
                    }}
                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #d1d5db',
                      borderRadius: 7,
                      fontSize: 13,
                      cursor: 'pointer',
                      outline: 'none',
                      background: 'white',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontSize: 13, fontWeight: 500 }}>
                    End Date
                  </label>
                  <input
                    type="date"
                    min={assignmentForm.startDate}
                    value={assignmentForm.endDate}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, endDate: e.target.value })}
                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #d1d5db',
                      borderRadius: 7,
                      fontSize: 13,
                      cursor: 'pointer',
                      outline: 'none',
                      background: 'white',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                  Allocation Percent (%)
                </label>
                <input
                    type="number"
                    min="1"
                    max="100"
                    value={assignmentForm.allocationPercent}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, allocationPercent: parseInt(e.target.value) || 100 })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #d1d5db',
                      borderRadius: 7,
                      fontSize: 13,
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  />
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  onClick={() => {
                    setShowAssignmentModal(false);
                    setSubmittedAssignment(false);
                    resetAssignmentForm();
                  }}
                  style={{
                    padding: '10px 20px',
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 500,
                    color: '#374151',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAssignment}
                  disabled={submittingAssignment}
                  style={{
                    padding: '10px 20px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: submittingAssignment ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    opacity: submittingAssignment ? 0.7 : 1,
                  }}
                >
                  {submittingAssignment && <Loader2 size={16} className="animate-spin" />}
                  {submittingAssignment ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

