import { useState, useEffect, Fragment, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Loader2,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  List,
  LayoutGrid,
  Copy,
  HelpCircle,
  Plus,
  Info,
  Search,
  Download,
  ChevronDown,
  ChevronUp,
  PartyPopper,
  Eye,
  CheckCircle,
  XCircle,
  Send,
  Edit2,
  Trash2,
  Play,
  Pause,
  Square,
  RefreshCw,
  X,
  Filter,
  Upload,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { attendanceAPI, timeEntryAPI, createLeaveRequest, getPendingLeaveRequests, getEmployeeLeaveRequests, adminAPI, getAllLeaveRequests, getAcceptedLeaveRequests, getRejectedLeaveRequests, respondToLeaveRequest, employeeAPI, employeeProjectAPI, projectAPI, teamAPI, reportingAPI, timesheetScreenshotAPI, timesheetAPI, leaveBalanceAPI, holidayCalendarAPI, getLeaveBalances } from '../services/api';
import api from '../services/api';
import {
  formatTimeTo12h,
  formatEntryTimeRange,
  findOverlappingTimesheetEntry,
  validateDescription,
  formatHours,
  decimalHoursToHHMMSS,
  hhmmssToDecimalHours,
  normalizeHHMMSS,
  hasPositiveHours,
  calculateSubmittedHoursForMonthInWeek,
  resolveAttendanceClockTime,
} from '../utils/timeUtils';
import Header from '../components/Header';
import { toast } from 'react-hot-toast';
import DatePicker from '../components/DatePicker';
import LeaveHistoryImportModal from '../components/LeaveHistoryImportModal';
import './TimeOffice.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const getAttendanceStatusClass = (status, isPastDate) => {
  const s = (status || '').toUpperCase();
  if (s === 'PRESENT') return 'to-status present';
  if (s === 'AWAITING SHIFT') return 'to-status awaiting';
  if (s === 'ABSENT' || (s === 'NOT CLOCKED IN YET' && isPastDate)) return 'to-status absent';
  if (s === 'ON LEAVE' || s === 'ON_LEAVE') return 'to-status leave';
  if (s === 'WFH') return 'to-status wfh';
  if (s === 'HOLIDAY') return 'to-status holiday';
  if (s === 'OPTIONAL_HOLIDAY' || s === 'OPTIONAL HOLIDAY') return 'to-status optional-holiday';
  if (s === 'NOT CLOCKED IN YET') return 'to-status pending-clock';
  return 'to-status default';
};

export function Attendance({ initialTab = 'attendance' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, adminUser, sessionType, hasAdminAccess, getCurrentUser, hasModule: authHasModule } = useAuth();
  const monthInputRef = useRef(null);
  const hasModule = authHasModule || (() => true);
  const currentUser = getCurrentUser();

  const isAdmin = (() => {
    if (sessionType === 'admin' || !!adminUser) return true;
    if (!currentUser) return false;
    // Check if the current employee user has the explicit 'ADMIN' role
    // We intentionally do NOT use hasAdminAccess() here because that returns true for HR and CEO,
    // and we want them to use the HR/Employee UI instead of the Admin UI.
    if (currentUser.roles && Array.isArray(currentUser.roles)) {
      return currentUser.roles.some(role => String(role).trim().toUpperCase() === 'ADMIN');
    }
    const roleValue = currentUser.employeeRoleName || currentUser.role?.name || currentUser.role;
    return String(roleValue).trim().toUpperCase() === 'ADMIN';
  })();

  // Check if user has HR role
  const isHR = (() => {
    if (!currentUser) return false;
    // Check roles array first (from login response)
    if (currentUser.roles && Array.isArray(currentUser.roles)) {
      return currentUser.roles.some(role => ['HR', 'CEO'].includes(String(role).trim().toUpperCase()));
    }
    // Fallback to old role fields
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

  // Default to attendance tab when on time-office route - initialize from location state to prevent flicker
  const [activeMainTab, setActiveMainTab] = useState(() => {
    if (location.state?.activeTab) return location.state.activeTab;
    return initialTab || 'attendance';
  });

  // Sync state with prop for navigation between routes using the same component
  useEffect(() => {
    if (initialTab) {
      setActiveMainTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveMainTab(location.state.activeTab);
    }
  }, [location.state]);

  // Redirection logic for gated tabs
  useEffect(() => {
    if (activeMainTab === 'timesheet' && !hasModule('TIMESHEETS')) {
      setActiveMainTab('attendance');
    } else if (activeMainTab === 'leave' && (!hasModule('LEAVE_MANAGEMENT') || (!isAdmin && !isHR))) {
      setActiveMainTab('attendance');
    } else if (activeMainTab === 'attendance' && !hasModule('ATTENDANCE')) {
      if (hasModule('TIMESHEETS')) setActiveMainTab('timesheet');
      else if (hasModule('LEAVE_MANAGEMENT')) setActiveMainTab('leave');
    }
  }, [activeMainTab]);

  // Trigger auto clock-out on mount to ensure attendance data is fresh
  useEffect(() => {
    const triggerAutoClockOut = async () => {
      try {
        await timeEntryAPI.triggerAutoClockOut();
        console.log('✅ Auto clock-out check triggered successfully');
      } catch (err) {
        console.warn('⚠️ Auto clock-out trigger failed (non-critical):', err);
      }
    };

    triggerAutoClockOut();
  }, []);

  // Handle tab change - no navigation, just update state with smooth transition
  const handleTabChange = (tab) => {
    // Small delay to allow smooth transition
    setActiveMainTab(tab);
  };
  const [activeSubTab, setActiveSubTab] = useState('all');
  // Admin/HR filters for organization-wide views
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState('ALL');
  const [adminLeaveTypeFilter, setAdminLeaveTypeFilter] = useState('ALL');
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    if (activeMainTab === 'timesheet' && ['project', 'summary', 'rejected', 'pastdue'].includes(activeSubTab)) {
      setActiveSubTab('all');
    }
  }, [activeMainTab, activeSubTab]);

  // Top-level data view for HR/Admin users: 'my-data' or 'team-data' (org-wide for admins)
  // This controls all sections: attendance, timesheet, and leave
  const [hrDataView, setHrDataView] = useState(isAdmin ? 'team-data' : 'my-data');

  // Team members data for HR users
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamAttendanceData, setTeamAttendanceData] = useState([]);
  const [teamTimesheets, setTeamTimesheets] = useState([]);
  const [expandedTimesheets, setExpandedTimesheets] = useState(new Set());
  // Separate loading states for each tab to avoid full page reload
  const [loading, setLoading] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [timesheetLoading, setTimesheetLoading] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [rejectedLoading, setRejectedLoading] = useState(false);
  const [submittingTimesheet, setSubmittingTimesheet] = useState(false);
  const [projectTimeLoading, setProjectTimeLoading] = useState(false);
  const [timeSummaryLoading, setTimeSummaryLoading] = useState(false);
  const [pastDueLoading, setPastDueLoading] = useState(false);

  // Admin attendance data
  const [adminAttendanceData, setAdminAttendanceData] = useState([]);
  // Employee attendance data
  const [employeeAttendanceData, setEmployeeAttendanceData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Admin timesheet data
  const [adminTimesheets, setAdminTimesheets] = useState([]);
  const [selectedTimesheet, setSelectedTimesheet] = useState(null);
  const [showTimesheetModal, setShowTimesheetModal] = useState(false);
  const [entryScreenshots, setEntryScreenshots] = useState([]);
  const [screenshotsLoading, setScreenshotsLoading] = useState(false);
  // Track screenshots for team timesheet entries (key: entryId, value: screenshots array)
  const [teamEntryScreenshots, setTeamEntryScreenshots] = useState({});
  const [teamScreenshotsLoading, setTeamScreenshotsLoading] = useState({});

  // Time entry toggle
  const [submitDailyEntry, setSubmitDailyEntry] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === 'undefined') return 'grid';
    return window.matchMedia('(max-width: 768px)').matches ? 'list' : 'grid';
  });
  const [timesheetModal, setTimesheetModal] = useState(null);
  const [entryTooltip, setEntryTooltip] = useState(null);

  useEffect(() => {
    if (!entryTooltip) return undefined;
    const dismissTooltip = () => setEntryTooltip(null);
    window.addEventListener('scroll', dismissTooltip, true);
    window.addEventListener('resize', dismissTooltip);
    return () => {
      window.removeEventListener('scroll', dismissTooltip, true);
      window.removeEventListener('resize', dismissTooltip);
    };
  }, [entryTooltip]);

  // Week navigation
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.getFullYear(), today.getMonth(), diff);
  });

  const [timesheetMonthFilter, setTimesheetMonthFilter] = useState(() => {
    // Default to the current month; since the initial week always contains today,
    // today's month is the correct default for cross-month weeks too.
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  // Timesheet data
  const [timesheetData, setTimesheetData] = useState({
    totalHours: '0:00',
    expectedHours: '40:00',
    billable: '0:00',
    nonBillable: '0:00',
    timeOff: '0:00',
    attendanceHours: {},
    entries: [],
    timesheetId: null,
    status: 'DRAFT' // Initialize with DRAFT status
  });

  // Weekend configuration
  const [weekendConfig, setWeekendConfig] = useState({
    monday: false, tuesday: false, wednesday: false, thursday: false, friday: false,
    saturday: true, sunday: true
  });

  // Projects Allocated filters
  const [projectStatus, setProjectStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [projects, setProjects] = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [assignedProjects, setAssignedProjects] = useState([]);

  // New Timesheet Tabs Data
  const [rejectedTimesheetsList, setRejectedTimesheetsList] = useState([]);
  const [pastDueTimesheets, setPastDueTimesheets] = useState([]);
  const [projectTimeData, setProjectTimeData] = useState([]);
  const [timeSummaryData, setTimeSummaryData] = useState(null);

  // Time Entry Modal
  const [showTimeEntryModal, setShowTimeEntryModal] = useState(false);
  const [isDirectSubmit, setIsDirectSubmit] = useState(false);
  const [showWeeklyEntryModal, setShowWeeklyEntryModal] = useState(false);
  const [showEditEntryModal, setShowEditEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [timeEntryForm, setTimeEntryForm] = useState({
    workDate: '',
    projectId: '',
    taskId: '',
    taskName: '',
    description: '',
    hours: '',
    clockIn: '',
    clockOut: '',
    billable: false,
    workType: 'WORK'
  });

  // Timer state for time entry
  const [timerState, setTimerState] = useState({
    isRunning: false,
    isPaused: false,
    elapsedTime: 0, // in seconds
    startTime: null,
    pausedTime: 0 // accumulated paused time
  });

  const [editEntryForm, setEditEntryForm] = useState({
    workDate: '',
    projectId: '',
    taskId: '',
    taskName: '',
    description: '',
    hours: '',
    clockIn: '',
    clockOut: '',
    billable: false,
    workType: 'WORK'
  });
  const [weeklyEntries, setWeeklyEntries] = useState([]); // Array of entries for each day of the week
  const [availableProjects, setAvailableProjects] = useState([]);
  const [availableTasks, setAvailableTasks] = useState([]);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState(false);
  const [submitConfirmData, setSubmitConfirmData] = useState({ title: '', message: '', type: 'submit', action: null });

  const [pagination, setPagination] = useState({
    current: 1,
    total: 2,
    showing: '1 to 2 of 2',
    totalPages: 1
  });

  // Leave states
  const [showLeaveDetailModal, setShowLeaveDetailModal] = useState(false);
  const [selectedLeaveDetail, setSelectedLeaveDetail] = useState(null);
  const [managerLimits, setManagerLimits] = useState({});
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [leaveBalances, setLeaveBalances] = useState({
    casualLeave: { available: 0, consumed: 0, annual: 0 },
    sickLeave: { available: 0, consumed: 0, annual: 0 }
  });

  const getLeaveTypeCode = (leaveType) => {
    if (!leaveType) return '';
    const map = {
      'ANNUAL_LEAVE': 'AL',
      'SICK_LEAVE': 'SL',
      'PERSONAL_LEAVE': 'PL',
      'MATERNITY_LEAVE': 'ML',
      'PATERNITY_LEAVE': 'PTL',
      'BEREAVEMENT_LEAVE': 'BL',
      'CASUAL_LEAVE': 'CL',
      'COMPASSIONATE_LEAVE': 'CML',
      'STUDY_LEAVE': 'STL',
      'TRAINING_LEAVE': 'TRL',
      'UNPAID_LEAVE': 'UL',
      'HALF_DAY': 'HALF_DAY',
      'COMPENSATORY_OFF': 'CO',
      'FESTIVAL_LEAVE': 'FL',
      'BIRTHDAY_LEAVE': 'BDL',
      'ANNIVERSARY_LEAVE': 'ANL'
    };
    return map[leaveType] || leaveType;
  };

  const extractApproverName = (response) => {
    if (!response) return null;
    // Pattern: "APPROVED by Name (HR)" or "REJECTED by Name (Admin)"
    const match = response.match(/(?:APPROVED|REJECTED) by (.*?) \((?:Admin|HR|Manager)\)/i);
    if (match && match[1]) {
      const name = match[1].trim();
      return name.toLowerCase() === 'admin user' ? 'Admin' : name;
    }

    // Pattern: "Approved by Name"
    const match2 = response.match(/Approv(?:ed|al) by (.*)/i);
    if (match2 && match2[1]) {
      const name = match2[1].trim();
      // Filter out auto-messages
      if (name.toLowerCase().includes('manager (within limit)')) return null;
      return name.toLowerCase() === 'admin user' ? 'Admin' : name;
    }

    return null;
  };



  const handleViewLeaveDetail = (leave) => {
    setSelectedLeaveDetail(leave);
    setShowLeaveDetailModal(true);
  };
  const [activeLeaveSubTab, setActiveLeaveSubTab] = useState(isAdmin ? 'pending' : 'summary');
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [allLeaveRequests, setAllLeaveRequests] = useState([]);
  const [acceptedLeaveRequests, setAcceptedLeaveRequests] = useState([]);
  const [rejectedLeaveRequests, setRejectedLeaveRequests] = useState([]);
  const [leaveTypeOptions, setLeaveTypeOptions] = useState([]);
  const [selectedLeaveCode, setSelectedLeaveCode] = useState('');
  const [leaveBalancesByCode, setLeaveBalancesByCode] = useState({});
  const [holidays, setHolidays] = useState([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
    halfDayType: null // null = full day, 'MORNING_HALF' = first half, 'AFTERNOON_HALF' = second half
  });
  const [historyLeaveTypeFilter, setHistoryLeaveTypeFilter] = useState('ALL');

  useEffect(() => {
    if (isAdmin) {
      // Admin organization-wide view
      if (activeMainTab === 'attendance') {
        fetchAdminAttendanceData();
      } else if (activeMainTab === 'timesheet') {
        fetchAdminTimesheets();
      } else if (activeMainTab === 'leave') {
        fetchLeaveData();
      }
    } else if (isHR) {
      // HR user: fetch data based on top-level data view
      if (hrDataView === 'my-data') {
        // My Data: Show employee's own data
        if (activeMainTab === 'attendance') {
          fetchEmployeeAttendanceData();
        } else if (activeMainTab === 'timesheet') {
          if (activeSubTab === 'all') {
            fetchTimesheetData();
            fetchProjectTime();
            fetchTimeSummary();
            fetchRejectedTimesheets();
            fetchPastDueTimesheets();
          } else if (activeSubTab === 'tasks') {
            fetchMyTasks();
          } else if (activeSubTab === 'allocated') {
            fetchAssignedProjects();
          } else if (activeSubTab === 'rejected') {
            fetchRejectedTimesheets();
          } else if (activeSubTab === 'pastdue') {
            fetchPastDueTimesheets();
          } else if (activeSubTab === 'project') {
            fetchProjectTime();
          } else if (activeSubTab === 'summary') {
            fetchTimeSummary();
          }
        } else if (activeMainTab === 'leave') {
          fetchLeaveData();
        }
      } else if (hrDataView === 'team-data') {
        // Team Data: Show team members' data
        // First fetch team members if not already loaded
        if (teamMembers.length === 0) {
          fetchTeamMembers();
        }
        if (activeMainTab === 'attendance') {
          fetchTeamAttendanceData();
        } else if (activeMainTab === 'timesheet' && activeSubTab === 'all') {
          fetchTeamTimesheets();
        } else if (activeMainTab === 'leave') {
          fetchTeamLeaveData();
        }
      }
    } else {
      // Regular Employee view
      if (activeMainTab === 'attendance') {
        fetchEmployeeAttendanceData();
      } else if (activeMainTab === 'timesheet') {
        if (activeSubTab === 'all') {
          fetchTimesheetData();
          fetchProjectTime();
          fetchTimeSummary();
          fetchRejectedTimesheets();
          fetchPastDueTimesheets();
        } else if (activeSubTab === 'tasks') {
          fetchMyTasks();
        } else if (activeSubTab === 'allocated') {
          fetchAssignedProjects();
        } else if (activeSubTab === 'rejected') {
          fetchRejectedTimesheets();
        } else if (activeSubTab === 'pastdue') {
          fetchPastDueTimesheets();
        } else if (activeSubTab === 'project') {
          fetchProjectTime();
        } else if (activeSubTab === 'summary') {
          fetchTimeSummary();
        }
      }
    }
    // Only fetch leave data if not already handled above (for non-admin paths)
    // Always fetch holidays and leaves if in leave or timesheet mode to support auto-population
    if ((activeMainTab === 'leave' || activeMainTab === 'timesheet') && !isAdmin) {
      if (isHR && hrDataView === 'team-data') {
        if (teamMembers.length > 0 || pendingRequests.length === 0) {
          fetchTeamLeaveData();
        }
        const fetchLimits = async () => {
          try {
            const limits = await teamAPI.getLeaveLimits();
            setManagerLimits(limits.data || {});
          } catch (error) {
            console.error('Error fetching manager limits:', error);
          }
        };
        fetchLimits();
      } else {
        fetchLeaveData();
      }
    }
  }, [currentWeekStart, activeSubTab, activeMainTab, selectedDate, isAdmin, isHR, hrDataView]);

  const timesheetMonthInitRef = useRef(true);
  useEffect(() => {
    if (timesheetMonthInitRef.current) {
      timesheetMonthInitRef.current = false;
      return;
    }
    if (activeMainTab !== 'timesheet' || activeSubTab !== 'all') return;
    if (isAdmin && !(isHR && hrDataView === 'my-data')) return;
    if (!user?.employeeId) return;
    fetchTimesheetData();
  }, [timesheetMonthFilter]);

  // Get week days array (defined early as it's used by other functions)
  // Helper function to format date as YYYY-MM-DD in local timezone
  const formatDateLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const normalizeEntryDate = (entryDate) => {
    if (!entryDate) return null;
    try {
      if (entryDate instanceof Date) {
        return isNaN(entryDate.getTime()) ? null : formatDateLocal(entryDate);
      }
      if (typeof entryDate === 'string') {
        const d = entryDate.includes('T') ? entryDate.split('T')[0] : entryDate.trim().split(' ')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
        const p = new Date(d);
        return isNaN(p.getTime()) ? null : formatDateLocal(p);
      }
    } catch { /* ignore */ }
    return null;
  };

  const parseDateToLocal = (value) => {
    if (!value) return null;
    if (value instanceof Date) {
      if (isNaN(value.getTime())) return null;
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    if (typeof value === 'string') {
      const clean = value.includes('T') ? value.split('T')[0] : value.trim().split(' ')[0];
      const parts = clean.split('-').map(Number);
      if (parts.length === 3 && !parts.some(Number.isNaN)) {
        const [year, month, day] = parts;
        return new Date(year, month - 1, day);
      }
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      }
    }
    return null;
  };

  const normalizeAttendanceRecordDate = (record) => {
    if (!record) return null;
    const raw = record.date ?? record.attendanceDate ?? record.workDate;
    if (Array.isArray(raw) && raw.length >= 3) {
      const [year, month, day] = raw;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    if (raw instanceof Date) {
      return isNaN(raw.getTime()) ? null : formatDateLocal(raw);
    }
    if (typeof raw === 'string') {
      const clean = raw.includes('T') ? raw.split('T')[0] : raw.trim().split(' ')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
      const parsed = parseDateToLocal(raw);
      return parsed ? formatDateLocal(parsed) : null;
    }
    return null;
  };

  const formatAttendanceDisplayDate = (dateStr) => {
    const local = parseDateToLocal(dateStr);
    if (!local) return dateStr || '—';
    return local.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getAttendanceDayName = (dateStr) => {
    const local = parseDateToLocal(dateStr);
    if (!local) return '—';
    return local.toLocaleDateString('en-US', { weekday: 'short' });
  };

  /** Align API rows with the selected Mon–Sun week (fixes wrong dates after week navigation). */
  const mergeAttendanceWithWeekDays = (records, weekDays) => {
    const byDate = {};
    (records || []).forEach((record) => {
      const dateKey = normalizeAttendanceRecordDate(record);
      if (dateKey) byDate[dateKey] = { ...record, date: dateKey };
    });

    const todayStr = formatDateLocal(new Date());
    return weekDays.map((day) => {
      if (byDate[day.dateStr]) return byDate[day.dateStr];
      const isFuture = day.dateStr > todayStr;
      return {
        date: day.dateStr,
        status: isFuture ? 'UPCOMING' : 'NO RECORD',
        clockInTime: null,
        checkInTime: null,
        clockOutTime: null,
        checkOutTime: null,
        totalHours: '0:00',
        hours: '0:00',
        workLocation: null,
        statusReason: isFuture ? 'Future date' : 'No attendance recorded',
        _synthetic: true,
      };
    });
  };

  // Robust task date formatter: handles strings, objects and multiple possible field names
  const formatTaskDate = (val) => {
    if (!val) return '';
    let value = val;
    // If it's an object, try common date fields
    if (typeof val === 'object') {
      value = val.endDate || val.startDate || val.taskEndDate || val.toDate || val.dueDate || val.date || val.value || '';
    }
    if (!value) return '';
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed.toLocaleDateString();
    return String(value);
  };

  // Determine billable flag from various possible property names
  const isTaskBillable = (task) => {
    if (!task) return false;
    if (task.billable !== undefined) return !!task.billable;
    if (task.isBillable !== undefined) return !!task.isBillable;
    if (task.is_billable !== undefined) return !!task.is_billable;
    return false;
  };

  const getWeekDays = () => {
    const days = [];
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      days.push({
        date: date.getDate(),
        month: monthNames[date.getMonth()],
        dayName: dayNames[date.getDay()],
        dateStr: formatDateLocal(date), // Use local date formatting to avoid timezone issues
        isToday: new Date().toDateString() === date.toDateString()
      });
    }
    return days;
  };

  const fetchWeekendConfig = async () => {
    try {
      const response = await adminAPI.getWeekendConfig();
      if (response.data) {
        setWeekendConfig(response.data);
      }
    } catch (error) {
      console.error("Error fetching weekend config:", error);
      // Fallback to default sat/sun is already set in state
    }
  };

  useEffect(() => {
    fetchWeekendConfig();
  }, []);

  const isWeekendDay = (dateStr) => {
    if (!dateStr) return false;
    // Split YYYY-MM-DD to avoid timezone shifts that can cause "off-by-one" day errors
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
    return !!weekendConfig[dayName];
  };

  // Helper to calculate shift hours for an employee
  const calculateShiftHours = () => {
    // Priority: Employee profile shift data (from login/user DTO)
    const startTime = user?.shiftStartTime;
    const endTime = user?.shiftEndTime;

    if (!startTime || !endTime) return 8; // Default to 8 (standard shift excluding break)

    try {
      // Parse "HH:mm" or "HH:mm:ss" formats
      const startParts = startTime.split(':').map(Number);
      const endParts = endTime.split(':').map(Number);
      
      const startMinutes = (startParts[0] || 0) * 60 + (startParts[1] || 0);
      const endMinutes = (endParts[0] || 0) * 60 + (endParts[1] || 0);

      let diffMinutes = endMinutes - startMinutes;
      if (diffMinutes < 0) diffMinutes += 24 * 60; // Handle overnight shifts

      // Subtract 1 hour (60 mins) for break if shift is 5 hours or more
      if (diffMinutes >= 300) {
        diffMinutes -= 60;
      }

      // Convert to decimal hours (e.g., 8)
      return parseFloat((diffMinutes / 60).toFixed(2));
    } catch (e) {
      console.error("Error calculating shift hours:", e);
      return 8;
    }
  };

  // Helper to check if a date is a holiday
  const isHoliday = (dateStr) => {
    if (!holidays || !Array.isArray(holidays)) return null;
    return holidays.find(h => {
      if (!h.date) return false;
      // Convert h.date to YYYY-MM-DD regardless of format (Date object or string)
      let hDateStr = '';
      if (typeof h.date === 'string') {
        hDateStr = h.date.includes('T') ? h.date.split('T')[0] : h.date.trim().split(' ')[0];
      } else {
        hDateStr = formatDateLocal(new Date(h.date));
      }
      return hDateStr === dateStr;
    });
  };

  // Helper to check if a date is part of an approved leave
  const isApprovedLeave = (dateStr) => {
    if (!leaveHistory || !Array.isArray(leaveHistory)) return null;
    
    // Parse the date components to avoid timezone shifts
    const [year, month, day] = dateStr.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    targetDate.setHours(0, 0, 0, 0);

    return leaveHistory.find(leave => {
      // Match approved/accepted status
      const status = String(leave.status || '').toUpperCase();
      if (status !== 'APPROVED' && status !== 'ACCEPTED') return false;
      
      // Ensure the leave belongs to the current user (especially for HR/Admins viewing their own sheets)
      const leaveEmpId = leave.employeeId || leave.employee?.employeeId || leave.employee?.id;
      const currentEmpId = user?.employeeId;
      if (currentEmpId && leaveEmpId && String(leaveEmpId).trim() !== String(currentEmpId).trim()) return false;

      // Parse leave range
      const start = parseDateToLocal(leave.startDate);
      const end = parseDateToLocal(leave.endDate);
      
      if (!start || !end) return false;
      
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      
      return targetDate >= start && targetDate <= end;
    });
  };

  const fetchAdminAttendanceData = async () => {
    setAttendanceLoading(true);
    try {
      const response = await attendanceAPI.getDailyAttendance(selectedDate);
      if (response.data?.attendance && Array.isArray(response.data.attendance)) {
        setAdminAttendanceData(response.data.attendance);
      } else if (Array.isArray(response.data)) {
        setAdminAttendanceData(response.data);
      } else {
        setAdminAttendanceData([]);
      }
    } catch (error) {
      console.error("Error fetching admin attendance data", error);
      toast.error('Failed to fetch attendance data');
      setAdminAttendanceData([]);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const fetchEmployeeAttendanceData = async (forceLoading = false) => {
    if (!user?.employeeId) return;

    const weekDays = getWeekDays();
    const weekRange = `${weekDays[0].dateStr}_${weekDays[6].dateStr}`;
    const cacheKey = `hrms_attendance_data_${user.employeeId}_${weekRange}`;

    // Initialize from cache to prevent flicker
    if (!forceLoading) {
      const cached = window.safeSessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed._range === weekRange) {
            setEmployeeAttendanceData(parsed.data);
          }
        } catch (e) {
          console.error("Attendance cache parse error", e);
        }
      }
    }

    // Only show loader if no data
    if (employeeAttendanceData.length === 0 || forceLoading) {
      setAttendanceLoading(true);
    }

    try {
      const startDate = weekDays[0].dateStr;
      const endDate = weekDays[6].dateStr;

      const response = await attendanceAPI.getMyAttendanceByDateRange(startDate, endDate);
      const data = response.data?.attendance || response.data || [];
      const attendanceList = Array.isArray(data) ? data : [];

      setEmployeeAttendanceData(attendanceList);
      window.safeSessionStorage.setItem(cacheKey, JSON.stringify({
        data: attendanceList,
        _range: weekRange
      }));
    } catch (error) {
      console.error("Error fetching employee attendance data", error);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const fetchAdminTimesheets = async () => {
    setTimesheetLoading(true);
    try {
      // Use the unified timesheets endpoint which returns data based on scope (ORG for admins)
      const weekStart = formatDateLocal(currentWeekStart);
      const response = await api.get('/timesheets', { params: { week: weekStart } });

      if (response.data?.timesheets && Array.isArray(response.data.timesheets)) {
        setAdminTimesheets(response.data.timesheets);
      } else if (Array.isArray(response.data)) {
        setAdminTimesheets(response.data);
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        setAdminTimesheets(response.data.data);
      } else {
        setAdminTimesheets([]);
      }
    } catch (error) {
      console.error("Error fetching admin timesheets", error);
      toast.error('Failed to fetch timesheet data');
      setAdminTimesheets([]);
    } finally {
      setTimesheetLoading(false);
    }
  };

  // Fetch team members for HR users
  const fetchTeamMembers = async () => {
    if (!user?.employeeId) return;
    try {
      const response = await teamAPI.getTeamOverview(user.employeeId);
      if (response.data && Array.isArray(response.data)) {
        setTeamMembers(response.data);
      } else {
        setTeamMembers([]);
      }
    } catch (error) {
      console.error("Error fetching team members", error);
      toast.error('Failed to fetch team members');
      setTeamMembers([]);
    }
  };

  // Fetch team attendance data
  const fetchTeamAttendanceData = async () => {
    if (!user?.employeeId) return;
    setAttendanceLoading(true);
    try {
      const response = await teamAPI.getTeamAttendance(user.employeeId, selectedDate);
      let attendanceRecords = [];

      // Backend returns data in teamMembers field, not attendance field
      if (response.data?.teamMembers && Array.isArray(response.data.teamMembers)) {
        attendanceRecords = response.data.teamMembers.map(member => {
          const clockIn = resolveAttendanceClockTime(member, 'in');
          const clockOut = resolveAttendanceClockTime(member, 'out');
          return {
            ...member,
            date: selectedDate,
            employeeName: member.firstName && member.lastName
              ? `${member.firstName} ${member.lastName}`
              : member.employeeName || member.employeeId,
            clockInTime: clockIn,
            checkInTime: clockIn,
            clockOutTime: clockOut,
            checkOutTime: clockOut,
            totalHours: member.totalHours || member.hours || '0:00',
            workLocation: member.workLocation || member.location || 'Office'
          };
        });
      } else if (response.data?.attendance && Array.isArray(response.data.attendance)) {
        attendanceRecords = response.data.attendance.map((record) => {
          const clockIn = resolveAttendanceClockTime(record, 'in');
          const clockOut = resolveAttendanceClockTime(record, 'out');
          return {
            ...record,
            date: record.date || selectedDate,
            clockInTime: clockIn,
            checkInTime: clockIn,
            clockOutTime: clockOut,
            checkOutTime: clockOut,
          };
        });
      } else if (Array.isArray(response.data)) {
        attendanceRecords = response.data.map((record) => {
          const clockIn = resolveAttendanceClockTime(record, 'in');
          const clockOut = resolveAttendanceClockTime(record, 'out');
          return {
            ...record,
            date: record.date || selectedDate,
            clockInTime: clockIn,
            checkInTime: clockIn,
            clockOutTime: clockOut,
            checkOutTime: clockOut,
          };
        });
      }

      console.log('âœ… [Attendance] Team attendance data fetched:', {
        recordCount: attendanceRecords.length,
        sampleRecord: attendanceRecords[0],
        selectedDate
      });
      setTeamAttendanceData(attendanceRecords);
    } catch (error) {
      console.error("âŒ [Attendance] Error fetching team attendance data", error);
      toast.error('Failed to fetch team attendance data');
      setTeamAttendanceData([]);
    } finally {
      setAttendanceLoading(false);
    }
  };

  // Fetch team timesheets (only pending/submitted that need approval)
  const fetchTeamTimesheets = async () => {
    if (!user?.employeeId) return;
    setTimesheetLoading(true);
    try {
      const weekStart = formatDateLocal(currentWeekStart);
      // Use getPendingTimesheets to get only timesheets that need approval
      const response = await teamAPI.getPendingTimesheets(weekStart);
      let allTimesheets = [];
      if (response.data?.timesheets && Array.isArray(response.data.timesheets)) {
        allTimesheets = response.data.timesheets;
      } else if (Array.isArray(response.data)) {
        allTimesheets = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        allTimesheets = response.data.data;
      }

      // Filter to show only SUBMITTED or PENDING timesheets (that need approval)
      // Also include APPROVED and REJECTED for reference, but prioritize pending ones
      const pendingTimesheets = allTimesheets.filter(ts =>
        ts.status === 'SUBMITTED' || ts.status === 'PENDING' || ts.status === 'PENDING_APPROVAL'
      );

      // If there are pending timesheets, show those; otherwise show all for reference
      setTeamTimesheets(pendingTimesheets.length > 0 ? pendingTimesheets : allTimesheets);
    } catch (error) {
      console.error("Error fetching team timesheets", error);
      toast.error('Failed to fetch team timesheets');
      setTeamTimesheets([]);
    } finally {
      setTimesheetLoading(false);
    }
  };

  // Fetch team leave data
  const fetchTeamLeaveData = async () => {
    if (!user?.employeeId) return;
    setLeaveLoading(true);
    try {
      const response = await teamAPI.getTeamLeaveRequests(user.employeeId);
      let teamLeaves = [];
      if (response.data && Array.isArray(response.data)) {
        teamLeaves = response.data;
      } else if (Array.isArray(response)) {
        teamLeaves = response;
      }

      // Filter by status
      const pending = teamLeaves.filter(req =>
        req.status === 'PENDING' || req.status === 'SUBMITTED' || req.status === 'PENDING_APPROVAL'
      );
      const approved = teamLeaves.filter(req => req.status === 'APPROVED');
      const rejected = teamLeaves.filter(req => req.status === 'REJECTED');

      // Set state for team leave management
      setPendingRequests(pending);
      setAcceptedLeaveRequests(approved);
      setRejectedLeaveRequests(rejected);
      setAllLeaveRequests(teamLeaves);
      setLeaveHistory(teamLeaves);
    } catch (error) {
      console.error("Error fetching team leave data", error);
      toast.error('Failed to fetch team leave data');
      setPendingRequests([]);
      setAcceptedLeaveRequests([]);
      setRejectedLeaveRequests([]);
      setAllLeaveRequests([]);
      setLeaveHistory([]);
    } finally {
      setLeaveLoading(false);
    }
  };

  const fetchTimesheetData = async (forceLoading = false) => {
    if (!user?.employeeId) return;

    const weekDays = getWeekDays();
    const weekStart = weekDays[0].dateStr;
    const cacheKey = `hrms_ts_data_${user.employeeId}_${weekStart}`;

    // Initialize/Refresh local state with cache if available to prevent flicker
    let hasLoadedFromCache = false;
    if (!forceLoading) {
      const cached = window.safeSessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed._week === weekStart) {
            setTimesheetData(parsed);
            hasLoadedFromCache = true;
          }
        } catch (e) {
          console.error("Cache parse error", e);
        }
      }
    }

    // Only show full loader if we have no data in state AND no data in cache
    const hasInState = timesheetData.entries && timesheetData.entries.length > 0 && timesheetData._week === weekStart;
    if ((!hasInState && !hasLoadedFromCache) || forceLoading) {
      setTimesheetLoading(true);
    }

    try {
      // Calculate start date for the week
      console.log('📅 [Timesheet] Fetching data for week:', weekStart);

      // Use get-or-create endpoint to ensure timesheet exists
      let timesheet = null;
      try {
        const timesheetResponse = await api.get('/employee/timesheet/week', {
          params: { weekStart, month: timesheetMonthFilter },
        });
        timesheet = timesheetResponse.data;
      } catch (error) {
        console.error('Error getting/creating timesheet:', error);
        const response = await api.get('/timesheets', { params: { week: weekStart } });
        if (response.data?.timesheets && Array.isArray(response.data.timesheets) && response.data.timesheets.length > 0) {
          timesheet = response.data.timesheets[0];
        } else if (response.data && !response.data.timesheets) {
          timesheet = response.data;
        }
      }

      let attendanceMap = {};
      let totalHours = 0;
      let billableHours = 0;
      let nonBillableHours = 0;
      let timeOffHours = 0;
      const todayStr = formatDateLocal(new Date());

      if (!timesheet) {
        weekDays.forEach(day => {
          attendanceMap[day.dateStr] = '0:00';
        });

        const emptyState = {
          timesheetId: null,
          entries: [],
          totalHours: '0:00',
          expectedHours: '40:00',
          billable: '0:00',
          nonBillable: '0:00',
          timeOff: '0:00',
          attendanceHours: attendanceMap,
          status: 'DRAFT',
          projects: [],
          _week: weekStart
        };
        setTimesheetData(emptyState);
        window.safeSessionStorage.setItem(cacheKey, JSON.stringify(emptyState));
        return;
      }

      const entries = [...(timesheet.entries || [])];
      entries.forEach(entry => {
        const entryDate = entry.workDate || entry.date || entry.entryDate;
        if (entryDate) {
          let dateStr = typeof entryDate === 'string' ? (entryDate.includes('T') ? entryDate.split('T')[0] : entryDate) : formatDateLocal(new Date(entryDate));
          if (!attendanceMap[dateStr]) attendanceMap[dateStr] = '0:00';

          let hVal = typeof entry.hours === 'number' ? entry.hours : (parseFloat(entry.hours) || 0);
          if (entry.isCancelled) {
            hVal = 0;
          }
          const current = parseHours(attendanceMap[dateStr]);
          attendanceMap[dateStr] = formatHours(current + hVal);

          const isHolidayOrLeave = (entry.workType === 'HOLIDAY' || entry.workType === 'LEAVE');
          if (!isHolidayOrLeave || dateStr <= todayStr) {
            totalHours += hVal;
            if (isHolidayOrLeave) timeOffHours += hVal;
            else if (entry.billable !== false) billableHours += hVal;
            else nonBillableHours += hVal;
          }
        }
      });

      // Auto-inject missing holiday/leave entries
      const shiftHours = calculateShiftHours();
      weekDays.forEach(day => {
        const hasEntriesForDay = entries.some(e => {
          const eDate = e.workDate || e.date || e.entryDate;
          const eDateStr = typeof eDate === 'string' ? (eDate.includes('T') ? eDate.split('T')[0] : eDate) : formatDateLocal(new Date(eDate));
          return eDateStr === day.dateStr;
        });

        if (!hasEntriesForDay) {
          const holiday = isHoliday(day.dateStr);
          const leave = isApprovedLeave(day.dateStr);
          if (holiday || leave) {
            const hVal = parseFloat(shiftHours) || 0;
            entries.push({
              workDate: day.dateStr,
              taskName: holiday ? (holiday.name || 'Holiday') : (String(leave?.leaveType || 'Leave').replace(/_/g, ' ')),
              description: holiday ? (holiday.description || 'Holiday') : (leave?.reason || 'Leave'),
              hours: shiftHours,
              billable: false,
              workType: holiday ? 'HOLIDAY' : 'LEAVE',
              isVirtual: true
            });
            if (!attendanceMap[day.dateStr]) attendanceMap[day.dateStr] = '0:00';
            attendanceMap[day.dateStr] = formatHours(parseHours(attendanceMap[day.dateStr]) + hVal);
            if (day.dateStr <= todayStr) {
              totalHours += hVal;
              timeOffHours += hVal;
            }
          }
        }
      });

      // Calculate Expected Hours
      let expected = '40:00';
      try {
        const empUser = currentUser || user || {};
        if (empUser.shiftStartTime && empUser.shiftEndTime) {
          const sParts = empUser.shiftStartTime.split(':').map(Number);
          const eParts = empUser.shiftEndTime.split(':').map(Number);
          
          if (sParts.length >= 2 && eParts.length >= 2 && !isNaN(sParts[0]) && !isNaN(eParts[0])) {
            const daily = ((eParts[0] * 60 + (eParts[1] || 0)) - (sParts[0] * 60 + (sParts[1] || 0))) * (empUser.workingDays || 5);
            if (!isNaN(daily)) {
              expected = `${Math.floor(daily / 60)}:${(Math.abs(daily) % 60).toString().padStart(2, '0')}`;
            }
          }
        }
      } catch (e) {
        console.error('Error calculating shift hours:', e);
      }

      const finalTimesheetData = {
        attendanceHours: attendanceMap,
        totalHours: formatHours(totalHours),
        expectedHours: expected,
        billable: formatHours(billableHours),
        nonBillable: formatHours(nonBillableHours),
        timeOff: formatHours(timeOffHours),
        entries: entries,
        timesheetId: timesheet.id || timesheet.timesheetId,
        status: entries.length === 0 ? 'DRAFT' : (timesheet.status || 'DRAFT'),
        summaryMonth: timesheet.summaryMonth || timesheetMonthFilter,
        submittedHoursForMonth: timesheet.submittedHoursForMonth ?? null,
        _week: weekStart
      };

      setTimesheetData(finalTimesheetData);
      window.safeSessionStorage.setItem(cacheKey, JSON.stringify(finalTimesheetData));
    } catch (error) {
      console.error("Error fetching timesheet data", error);
    } finally {
      setTimesheetLoading(false);
    }
  };

  // Helper functions for hour formatting
  const parseHours = (hoursStr) => {
    if (typeof hoursStr === 'number') return hoursStr;
    if (!hoursStr || hoursStr === '0:00') return 0;
    const parts = hoursStr.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0]) + (parseInt(parts[1]) / 60);
    }
    return parseFloat(hoursStr) || 0;
  };





  // Helper function to check if an employee has HR role
  const isEmployeeHR = (leaveRequest) => {
    if (!leaveRequest) return false;
    // Check employeeRoleName field (multiple possible locations)
    const roleName = leaveRequest.employeeRoleName ||
      leaveRequest.employee?.employeeRoleName ||
      leaveRequest.employee?.role?.name ||
      leaveRequest.role?.name ||
      leaveRequest.employee?.employeeRoleName;
    if (roleName && ['HR', 'CEO'].includes(String(roleName).trim().toUpperCase())) {
      return true;
    }
    // Check roles array
    const roles = leaveRequest.employee?.roles || leaveRequest.roles || leaveRequest.employee?.role;
    if (Array.isArray(roles)) {
      return roles.some(role => {
        const roleStr = typeof role === 'string' ? role : (role?.name || role);
        return ['HR', 'CEO'].includes(String(roleStr).trim().toUpperCase());
      });
    }
    // Check if role object has name property
    if (roles && typeof roles === 'object' && roles.name) {
      return ['HR', 'CEO'].includes(String(roles.name).trim().toUpperCase());
    }
    return false;
  };

  // Helper function to filter out HR employees' own leave requests for HR users
  const filterHROwnLeaves = (leaves) => {
    if (!isHR || hrDataView !== 'team-data') {
      return leaves;
    }

    const currentEmployeeId = user?.employeeId || currentUser?.employeeId;
    if (!currentEmployeeId) {
      return leaves;
    }

    // Filter out leave requests where:
    // 1. The employeeId matches the current HR user's employeeId, OR
    // 2. The employee has HR role
    return leaves.filter(leave => {
      // Check if it's the current user's own leave
      const requestEmployeeId = leave.employeeId || leave.employee?.employeeId;
      const isOwnLeave = requestEmployeeId && currentEmployeeId &&
        (String(requestEmployeeId).toLowerCase() === String(currentEmployeeId).toLowerCase());

      // Check if the employee has HR role
      const isHREmployee = isEmployeeHR(leave);

      // Exclude if it's own leave OR HR employee leave
      return !isOwnLeave && !isHREmployee;
    });
  };

  const fetchLeaveData = async () => {
    setLeaveLoading(true);
    let freshLeaveTypes = [];
    try {
      // Fetch active leave types for EVERYONE (Admins and Employees)
      try {
        const ltRes = await employeeAPI.getActiveLeaveTypes();
        const data = ltRes.data || ltRes || [];
        freshLeaveTypes = Array.isArray(data) ? data : (data.data || []);
        setLeaveTypeOptions(freshLeaveTypes);
      } catch (err) {
        console.error('Error fetching active leave types:', err);
        setLeaveTypeOptions([]);
      }

      // Fetch holidays for duration calculation
      try {
        const holidayRes = await holidayCalendarAPI.getActiveHolidays();
        const holidayList = Array.isArray(holidayRes?.data) ? holidayRes.data : (Array.isArray(holidayRes) ? holidayRes : []);
        setHolidays(holidayList);
      } catch (hErr) {
        console.warn('Could not load holidays:', hErr);
      }

      // Admin org view or HR in Team Data view: Fetch organization-wide leave data
      if (isAdmin || (isHR && hrDataView === 'team-data')) {
        // For admins/HR, fetch all leave requests by status
        try {
          const pendingRes = await getPendingLeaveRequests();
          let pending = [];
          if (Array.isArray(pendingRes)) {
            pending = pendingRes;
          } else if (pendingRes?.data && Array.isArray(pendingRes.data)) {
            pending = pendingRes.data;
          } else if (pendingRes?.leaveRequests) {
            pending = pendingRes.leaveRequests;
          }
          // Filter out HR own leaves if viewing as HR
          setPendingRequests(filterHROwnLeaves(pending));
        } catch (err) {
          console.error('Error fetching pending leave requests:', err);
          setPendingRequests([]);
        }

        try {
          const allRes = await getAllLeaveRequests();
          let allLeaves = [];
          if (Array.isArray(allRes)) {
            allLeaves = allRes;
          } else if (allRes?.data && Array.isArray(allRes.data)) {
            allLeaves = allRes.data;
          }
          // Filter out HR own leaves if viewing as HR
          const filteredAllLeaves = filterHROwnLeaves(allLeaves);
          setAllLeaveRequests(filteredAllLeaves);
          // Set leave history to all requests for admin
          setLeaveHistory(filteredAllLeaves);
        } catch (err) {
          console.error('Error fetching all leave requests:', err);
          setAllLeaveRequests([]);
        }

        try {
          const acceptedRes = await getAcceptedLeaveRequests();
          let accepted = [];
          if (Array.isArray(acceptedRes)) {
            accepted = acceptedRes;
          } else if (acceptedRes?.data && Array.isArray(acceptedRes.data)) {
            accepted = acceptedRes.data;
          }
          // Filter out HR own leaves if viewing as HR
          setAcceptedLeaveRequests(filterHROwnLeaves(accepted));
        } catch (err) {
          console.error('Error fetching accepted leave requests:', err);
          setAcceptedLeaveRequests([]);
        }

        try {
          const rejectedRes = await getRejectedLeaveRequests();
          let rejected = [];
          if (Array.isArray(rejectedRes)) {
            rejected = rejectedRes;
          } else if (rejectedRes?.data && Array.isArray(rejectedRes.data)) {
            rejected = rejectedRes.data;
          }
          // Filter out HR own leaves if viewing as HR
          setRejectedLeaveRequests(filterHROwnLeaves(rejected));
        } catch (err) {
          console.error('Error fetching rejected leave requests:', err);
          setRejectedLeaveRequests([]);
        }
      } else {
        // For employees or HR in My Data view: Fetch their own leave requests only
        const currentEmployeeId = user?.employeeId || currentUser?.employeeId;
        // Fetch leave balances for the current user
        let rawBalances = [];
        try {
          const balRes = await getLeaveBalances();
          rawBalances = Array.isArray(balRes) ? balRes : (Array.isArray(balRes?.data) ? balRes.data : []);
        } catch (bErr) {
          console.warn('Could not load leave balances:', bErr);
        }

        // 1. Fetch leave history (this is allowed to fail without blocking balances)
        let ownLeaves = [];
        try {
          const historyRes = await getEmployeeLeaveRequests();
          if (historyRes?.leaveRequests) {
             ownLeaves = historyRes.leaveRequests;
          } else if (Array.isArray(historyRes)) {
            ownLeaves = historyRes;
          } else if (historyRes?.data) {
            ownLeaves = Array.isArray(historyRes.data) ? historyRes.data : [];
          }

          if (currentEmployeeId) {
            ownLeaves = ownLeaves.filter(leave => {
              const leaveEmployeeId = leave.employeeId || leave.employee?.employeeId || leave.employee?.id;
              return String(leaveEmployeeId).trim().toUpperCase() === String(currentEmployeeId).trim().toUpperCase();
            });
          }

          setLeaveHistory(ownLeaves);
          setPendingRequests(ownLeaves.filter(leave =>
            leave.status === 'PENDING' || leave.status === 'SUBMITTED' || leave.status === 'PENDING_APPROVAL'
          ));
          setAcceptedLeaveRequests(ownLeaves.filter(leave => leave.status === 'APPROVED'));
          setRejectedLeaveRequests(ownLeaves.filter(leave => leave.status === 'REJECTED'));
          setAllLeaveRequests(ownLeaves);
        } catch (err) {
          console.error('Error fetching employee leave history:', err);
          setLeaveHistory([]);
          setPendingRequests([]);
        }

        // 2. Build dynamic balance map (Must run even if history failed)
        try {
          const byCode = {};
          if (rawBalances.length > 0) {
            rawBalances.forEach(bal => {
              // Exclude WFH from leave balances section
              if ((bal.leaveTypeCode || '').toUpperCase() === 'WFH') return;
              
              const code = bal.leaveTypeCode;
              const annual = bal.annualQuota || 0;
              const available = bal.availableBalance || 0;
              const consumed = Math.max(0, annual - available);

              byCode[code] = {
                available: Math.max(0, available),
                consumed: consumed,
                annual: annual,
              name: bal.leaveTypeName ? `${bal.leaveTypeName} (${bal.leaveTypeCode})` : code,
              code: code
              };
            });
          } else {
            // Fallback for if balances API fails - use leave types to build empty state
            const typesAvailable = (freshLeaveTypes.length > 0) ? freshLeaveTypes : (leaveTypeOptions || []);
            const typesToUse = (typesAvailable || []).filter(lt => {
              const code = (lt.leaveTypeCode || lt.leaveTypeName || '').toUpperCase();
              return code !== 'WFH' && code !== '';
            });
            
            for (const lt of typesToUse) {
              const code = lt.leaveTypeCode || lt.leaveTypeName;
              const annual = lt.defaultLeaveCount ?? lt.maxDays ?? 0;
              const name = lt.leaveTypeName ? `${lt.leaveTypeName} (${lt.leaveTypeCode || code})` : code;
              byCode[code] = {
                available: annual,
                consumed: 0,
                annual: annual,
                name: name,
                code: code
              };
            }
          }
          setLeaveBalancesByCode(byCode);
        } catch (bErr) {
          console.error('Error calculating leave balances:', bErr);
        }
      }
    } catch (error) {
      console.error('Error fetching leave data:', error);
      setPendingRequests([]);
      setLeaveHistory([]);
      setAllLeaveRequests([]);
      setAcceptedLeaveRequests([]);
      setRejectedLeaveRequests([]);
    } finally {
      setLeaveLoading(false);
    }
  };

  // Fetch My Tasks
  const fetchMyTasks = async () => {
    if (assignedTasks.length === 0) {
      setTasksLoading(true);
    }
    try {
      // Get current week dates formatted as YYYY-MM-DD for the API
      const weekDays = getWeekDays();
      const startDate = weekDays[0].dateStr;
      const endDate = weekDays[6].dateStr;

      const response = await employeeProjectAPI.getWeeklyAssignedTasks(startDate, endDate);
      console.log('My Tasks API Response:', response);

      // Handle different response structures
      let tasks = [];
      if (Array.isArray(response.data)) {
        tasks = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        tasks = response.data.data;
      } else if (response.data?.tasks && Array.isArray(response.data.tasks)) {
        tasks = response.data.tasks;
      } else if (response.data && typeof response.data === 'object') {
        // If it's a single object, wrap it in an array
        tasks = [response.data];
      }

      console.log('Parsed tasks:', tasks);
      setAssignedTasks(tasks);
    } catch (error) {
      console.error('Error fetching assigned tasks:', error);
      console.error('Error details:', error.response?.data);
      toast.error('Failed to fetch assigned tasks');
      setAssignedTasks([]);
    } finally {
      setTasksLoading(false);
    }
  };

  const PROJECT_STATUS_LABELS = {
    'in-progress': 'In Progress',
    completed: 'Completed',
    'on-hold': 'On Hold',
  };

  const deriveProjectStatusKey = (project) => {
    if (project.projectActive === false) return 'on-hold';
    const statuses = (project.tasks || []).map((t) =>
      String(t.status || 'NOT_STARTED').toUpperCase().replace(/-/g, '_')
    );
    if (statuses.length === 0) return 'in-progress';
    if (statuses.every((s) => s === 'COMPLETED')) return 'completed';
    if (statuses.some((s) => s === 'ON_HOLD' || s === 'HOLD')) return 'on-hold';
    return 'in-progress';
  };

  const finalizeAssignedProject = (project) => {
    const statusKey = deriveProjectStatusKey(project);
    return {
      ...project,
      statusKey,
      statusLabel: PROJECT_STATUS_LABELS[statusKey] || 'In Progress',
    };
  };

  const filteredAssignedProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return assignedProjects.filter((project) => {
      const statusKey = project.statusKey || deriveProjectStatusKey(project);
      if (projectStatus && statusKey !== projectStatus) return false;
      if (!query) return true;
      const searchable = [
        project.name,
        project.statusLabel,
        PROJECT_STATUS_LABELS[statusKey],
        statusKey,
        ...(project.tasks || []).map((t) => t.name),
        ...(project.managers || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [assignedProjects, projectStatus, searchQuery]);

  // Fetch Assigned Projects
  const fetchAssignedProjects = async () => {
    if (assignedProjects.length === 0) {
      setProjectsLoading(true);
    }
    try {
      // Get assigned tasks first, then extract unique projects
      const response = await employeeProjectAPI.getMyAssignedTasks();
      const tasks = Array.isArray(response.data) ? response.data : (response.data?.tasks || []);

      // Group tasks by project
      const projectMap = new Map();
      tasks.forEach(task => {
        const projectId = task.projectId ?? `project-${task.projectName}`;
        const projectName = task.projectName || 'Leaves/Holiday & other';
        if (!projectMap.has(projectId)) {
          projectMap.set(projectId, {
            id: projectId,
            name: projectName,
            tasks: [],
            projectActive: task.projectActive !== false,
            managers: [],
          });
        }
        const entry = projectMap.get(projectId);
        if (task.projectActive === false) entry.projectActive = false;
        entry.tasks.push({
          id: task.taskId,
          name: task.taskName,
          status: task.status,
          startDate: task.startDate,
          endDate: task.endDate,
        });
        const managerName = task.approvedByEmployeeName || task.createdByEmployeeName;
        if (managerName && !entry.managers.includes(managerName)) {
          entry.managers.push(managerName);
        }
      });

      setAssignedProjects(Array.from(projectMap.values()).map(finalizeAssignedProject));
    } catch (error) {
      console.error('Error fetching assigned projects:', error);
      toast.error('Failed to fetch assigned projects');
      setAssignedProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  };

  const fetchRejectedTimesheets = async () => {
    if (rejectedTimesheetsList.length === 0) {
      setRejectedLoading(true);
    }
    try {
      const selectedWeekStart = formatDateLocal(new Date(currentWeekStart));
      const response = await timesheetAPI.getMyRejectedTimesheetsForWeek(selectedWeekStart);
      const timesheets = Array.isArray(response?.data?.rejectedTimesheets)
        ? response.data.rejectedTimesheets
        : [];
      setRejectedTimesheetsList(Array.isArray(timesheets) ? timesheets : []);
    } catch (error) {
      console.error('Error fetching rejected timesheets:', error);
      setRejectedTimesheetsList([]);
    } finally {
      setRejectedLoading(false);
    }
  };

  // Fetch Past Due Timesheets
  const fetchPastDueTimesheets = async () => {
    if (pastDueTimesheets.length === 0) {
      setPastDueLoading(true);
    }
    try {
      const selectedWeekStart = formatDateLocal(new Date(currentWeekStart));
      const response = await timesheetAPI.getMyPastDueMissedDates(selectedWeekStart);
      const missedDates = Array.isArray(response?.data?.missedDates)
        ? response.data.missedDates
        : [];
      setPastDueTimesheets(missedDates);
    } catch (error) {
      console.error('Error fetching past due timesheets:', error);
      setPastDueTimesheets([]);
    } finally {
      setPastDueLoading(false);
    }
  };

  // Fetch Project Time
  const fetchProjectTime = async (forceLoading = false) => {
    if (!user?.employeeId) return;
    const weekDays = getWeekDays();
    const weekRange = `${weekDays[0].dateStr}_${weekDays[6].dateStr}`;
    const cacheKey = `hrms_project_time_${user.employeeId}_${weekRange}`;

    let hasLoadedFromCache = false;
    if (!forceLoading) {
      const cached = window.safeSessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed._range === weekRange) {
            setProjectTimeData(parsed.data);
            hasLoadedFromCache = true;
          }
        } catch (e) { console.error("Project cache error", e); }
      }
    }

    // Only show full loader if we have no data in state AND no data in cache
    const hasInState = projectTimeData && projectTimeData.length > 0;
    if ((!hasInState && !hasLoadedFromCache) || forceLoading) {
      setProjectTimeLoading(true);
    }

    try {
      const startDate = weekDays[0].dateStr;
      const endDate = weekDays[6].dateStr;
      const response = await timesheetAPI.getMyProjectTime(startDate, endDate);
      const data = response.data || [];
      setProjectTimeData(data);
      window.safeSessionStorage.setItem(cacheKey, JSON.stringify({ data, _range: weekRange }));
    } catch (error) {
      console.error('Error fetching project time:', error);
    } finally {
      setProjectTimeLoading(false);
    }
  };

  // Fetch Time Summary
  const fetchTimeSummary = async (forceLoading = false) => {
    if (!user?.employeeId) return;
    const weekDays = getWeekDays();
    const weekRange = `${weekDays[0].dateStr}_${weekDays[6].dateStr}`;
    const cacheKey = `hrms_time_summary_${user.employeeId}_${weekRange}`;

    let hasLoadedFromCache = false;
    if (!forceLoading) {
      const cached = window.safeSessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed._range === weekRange) {
            setTimeSummaryData(parsed.data);
            hasLoadedFromCache = true;
          }
        } catch (e) { console.error("Summary cache error", e); }
      }
    }

    const hasInState = timeSummaryData && (Array.isArray(timeSummaryData) ? timeSummaryData.length > 0 : true);
    if ((!hasInState && !hasLoadedFromCache) || forceLoading) {
      setTimeSummaryLoading(true);
    }

    try {
      const startDate = weekDays[0].dateStr;
      const endDate = weekDays[6].dateStr;
      const response = await timesheetAPI.getMyTasks(startDate, endDate);
      const data = response.data || null;
      setTimeSummaryData(data);
      window.safeSessionStorage.setItem(cacheKey, JSON.stringify({ data, _range: weekRange }));
    } catch (error) {
      console.error('Error fetching time summary:', error);
    } finally {
      setTimeSummaryLoading(false);
    }
  };

  // Handle Add Time Entry
  const handleAddTimeEntry = (selectedDateArg = null) => {
    // If called via onClick={handleAddTimeEntry}, selectedDateArg is an event object.
    // Ensure we only use it if it's a valid date string.
    let selectedDate = (selectedDateArg && typeof selectedDateArg === 'string') ? selectedDateArg : null;

    // Use selected date or default to today
    let dateStr;
    if (selectedDate) {
      // If selectedDate is already a string in YYYY-MM-DD format, use it
      if (selectedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dateStr = selectedDate;
      } else {
        // Otherwise, convert to YYYY-MM-DD format
        try {
          const date = new Date(selectedDate);
          // Validate date before calling toISOString
          if (isNaN(date.getTime())) {
            // Invalid date, default to today
            const today = new Date();
            dateStr = today.toISOString().split('T')[0];
          } else {
            dateStr = date.toISOString().split('T')[0];
          }
        } catch (error) {
          console.error('Error parsing date:', error, selectedDate);
          // Default to today on error
          const today = new Date();
          dateStr = today.toISOString().split('T')[0];
        }
      }
    } else {
      // Default to today
      const today = new Date();
      dateStr = today.toISOString().split('T')[0];
    }

    // Check for holiday or approved leave on this date
    let holiday = isHoliday(dateStr);
    let leave = isApprovedLeave(dateStr);
    const shiftHours = calculateShiftHours();

    // If an automated entry (Leave/Holiday) already exists for this day, 
    // default the next entry to 'WORK' to avoid purple/orange duplication.
    const dayEntries = (timesheetData?.entries || []).filter(e => {
      const d = normalizeEntryDate(e.workDate || e.date || e.entryDate);
      return d === dateStr;
    });
    
    const hasSpecialEntry = dayEntries.some(e => 
      ['LEAVE', 'HOLIDAY'].includes(String(e.workType || '').toUpperCase())
    );

    // Also, if it's a half-day leave, the user likely wants to add WORK for the other half.
    const isHalfDay = leave && leave.halfDayType;

    if (hasSpecialEntry || isHalfDay) {
      holiday = null;
      leave = null;
    }

    setTimeEntryForm({
      workDate: dateStr,
      projectId: '',
      taskId: '',
      taskName: '',
      description: holiday ? 'Holiday' : (leave ? 'Approved Leave' : ''),
      hours: (holiday || leave || isHalfDay) ? 
             ((isHalfDay) ? (shiftHours / 2).toFixed(2) : shiftHours.toString()) : '',
      billable: false,
      workType: holiday ? 'HOLIDAY' : (leave ? 'LEAVE' : 'WORK')
    });
    setIsDirectSubmit(!selectedDate);
    setShowTimeEntryModal(true);
    // Fetch available projects and tasks
    fetchAvailableProjects();
  };

  // Handle Add Weekly Entry
  const handleAddWeeklyEntry = () => {
    const weekDays = getWeekDays();
    // Clear any existing entries first to prevent duplicates
    setWeeklyEntries([]);
    const shiftHours = calculateShiftHours();

    // Initialize weekly entries with one entry per day, auto-filling holidays/leaves
    const initialEntries = weekDays.map((day, idx) => {
      const holiday = isHoliday(day.dateStr);
      const leave = isApprovedLeave(day.dateStr);

      return {
        id: `entry-${day.dateStr}-${idx}`, // Unique ID for each entry
        workDate: day.dateStr,
        projectId: '',
        taskId: '',
        taskName: '',
        description: holiday ? 'Holiday' : (leave ? 'Approved Leave' : ''),
        hours: (holiday || leave) ? decimalHoursToHHMMSS(shiftHours) : '',
        billable: false,
        workType: holiday ? 'HOLIDAY' : (leave ? 'LEAVE' : 'WORK')
      };
    });
    setWeeklyEntries(initialEntries);
    setShowWeeklyEntryModal(true);
    // Fetch available projects and all tasks for the week
    fetchAvailableProjects();
    fetchTasksForProject();
  };

  const formatWeeklyDayLabel = (dateStr) => {
    if (!dateStr) return 'this day';
    try {
      const iso = String(dateStr).includes('T') ? dateStr.split('T')[0] : dateStr;
      return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Handle Weekly Entry Change
  const handleWeeklyEntryChange = (dayIndex, field, value) => {
    setWeeklyEntries(prev => {
      const updated = [...prev];
      let newEntry = { ...updated[dayIndex], [field]: value };
      
      // If workType changed to HOLIDAY or LEAVE (even if column is hidden, this is for future-proofing)
      // or if any other field changed that might require re-calculation
      if (field === 'workType') {
        if (value === 'HOLIDAY' || value === 'LEAVE') {
          const shiftHours = calculateShiftHours();
          newEntry.hours = decimalHoursToHHMMSS(shiftHours);
          if (!newEntry.description) {
            newEntry.description = value === 'HOLIDAY' ? 'Holiday' : 'Approved Leave';
          }
        }
      }
      
      updated[dayIndex] = newEntry;
      return updated;
    });
  };

  const handleWeeklyHoursBlur = (entryIndex, rawValue) => {
    const normalized = normalizeHHMMSS(rawValue);
    if (normalized) {
      handleWeeklyEntryChange(entryIndex, 'hours', normalized);
    } else if (rawValue && String(rawValue).trim()) {
      toast.error('Enter hours as HH:MM:SS (e.g. 08:30:00)');
    }
  };

  // Add new row for a specific day
  const handleAddWeeklyEntryRow = (dayIndex) => {
    const weekDays = getWeekDays();
    const day = weekDays[dayIndex];
    if (!day) {
      toast.error('Unable to add entry row for this day.');
      return;
    }

    setWeeklyEntries(prev => {
      const holiday = isHoliday(day.dateStr);
      const leave = isApprovedLeave(day.dateStr);
      const shiftHours = calculateShiftHours();

      const newEntry = {
        id: `entry-${day.dateStr}-${Date.now()}-${Math.random()}`, // Unique ID
        workDate: day.dateStr,
        projectId: '',
        taskId: '',
        taskName: '',
        description: holiday ? 'Holiday' : (leave ? 'Approved Leave' : ''),
        hours: (holiday || leave) ? decimalHoursToHHMMSS(shiftHours) : '',
        billable: false,
        workType: holiday ? 'HOLIDAY' : (leave ? 'LEAVE' : 'WORK')
      };
      // Find the last entry for this day and insert after it
      let insertIndex = prev.length;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].workDate === day.dateStr) {
          insertIndex = i + 1;
          break;
        }
      }
      const updated = [...prev];
      updated.splice(insertIndex, 0, newEntry);
      return updated;
    });

    toast.success(`Entry row added for ${formatWeeklyDayLabel(day.dateStr)}.`);
  };

  // Remove entry row (confirmation + feedback)
  const handleRemoveWeeklyEntryRow = (entryId) => {
    const entry = weeklyEntries.find((e) => e.id === entryId);
    if (!entry) {
      toast.error('Entry row not found.');
      return;
    }

    const dayLabel = formatWeeklyDayLabel(entry.workDate);
    const isLastRowForDay = weeklyEntries.filter((e) => e.workDate === entry.workDate).length <= 1;
    const removeMessage = isLastRowForDay
      ? `Remove the only entry row for ${dayLabel}? That day will be skipped unless you add another row.`
      : `Are you sure you want to remove this entry row for ${dayLabel}?`;

    setSubmitConfirmData({
      title: 'Remove Entry Row',
      message: removeMessage,
      type: 'delete',
      action: () => {
        setWeeklyEntries((prev) => prev.filter((e) => e.id !== entryId));
        toast.success(`Entry row removed for ${dayLabel}.`);
      },
    });
    setShowSubmitConfirmModal(true);
  };

  // Submit Weekly Entries
  const handleSubmitWeeklyEntries = async (e, isConfirmed = false) => {
    if (e) e.preventDefault();

    // Filter out empty entries (no hours)
    const validEntries = weeklyEntries.filter((entry) => entry.hours && hasPositiveHours(entry.hours));

    if (validEntries.length === 0) {
      toast.error('No valid entries to submit. Please enter hours for at least one day.');
      return;
    }

    if (!isConfirmed) {
      setSubmitConfirmData({
        title: 'Confirm Bulk Submission',
        message: `Are you sure you want to submit ${validEntries.length} time entries for this week?`,
        type: 'submit',
        action: () => handleSubmitWeeklyEntries(null, true)
      });
      setShowSubmitConfirmModal(true);
      return;
    }

    // Validation: Description and Duplicate checks for all weekly entries
    for (const entry of validEntries) {
      const descError = validateDescription(entry.description);
      if (descError) {
        toast.error(`Entry for ${entry.workDate}: ${descError}`);
        return;
      }

      // Check for duplicate description within the submission itself
      const duplicateInBatch = validEntries.find(e => 
        e !== entry && 
        e.workDate === entry.workDate && 
        String(e.taskId) === String(entry.taskId) && 
        e.description?.trim().toLowerCase() === entry.description?.trim().toLowerCase()
      );
      if (duplicateInBatch) {
        toast.error(`Duplicate description found for task on ${entry.workDate}.`);
        return;
      }

      // Check against existing entries (that aren't being overwritten/re-submitted if applicable)
      const duplicateInPersistent = timesheetData.entries.find(e => 
        e.workDate === entry.workDate && 
        String(e.taskId) === String(entry.taskId) && 
        e.description?.trim().toLowerCase() === entry.description?.trim().toLowerCase()
      );
      if (duplicateInPersistent) {
        toast.error(`Duplicate description already exists for task on ${entry.workDate}.`);
        return;
      }
    }

    // Set flag to prevent logout during timesheet operation
    window.safeSessionStorage.setItem('timesheetOperationInProgress', 'true');
    const operationStartTime = Date.now();
    window.safeSessionStorage.setItem('timesheetOperationStartTime', operationStartTime.toString());

    try {
      // Get or create timesheet if it doesn't exist
      let timesheetId = timesheetData.timesheetId;
      if (!timesheetId) {
        const weekDays = getWeekDays();
        const weekStart = weekDays[0].dateStr;

        console.log('ðŸ“… [Timesheet] Creating/getting timesheet for week:', weekStart);
        const timesheetResponse = await api.get('/employee/timesheet/week', { params: { weekStart } });
        timesheetId = timesheetResponse.data?.id || timesheetResponse.data?.timesheetId;

        if (!timesheetId) {
          toast.error('Failed to create timesheet. Please try again.');
          return;
        }

        // Update timesheet data with the new ID
        setTimesheetData(prev => ({ ...prev, timesheetId }));
      }

      // Submit all entries
      const submitPromises = validEntries.map(entry => {
        // Ensure workDate is in YYYY-MM-DD format
        let workDateStr = entry.workDate;
        if (workDateStr instanceof Date) {
          if (isNaN(workDateStr.getTime())) {
            throw new Error(`Invalid date for entry: ${entry.workDate}`);
          }
          workDateStr = workDateStr.toISOString().split('T')[0];
        } else if (typeof workDateStr === 'string' && workDateStr.includes('T')) {
          workDateStr = workDateStr.split('T')[0];
        }

        const hoursValue = hhmmssToDecimalHours(entry.hours);

        const entryData = {
          workDate: workDateStr,
          projectId: entry.projectId ? Number(entry.projectId) : null,
          taskId: entry.taskId ? Number(entry.taskId) : null,
          taskName: entry.taskName || null,
          description: entry.description || '',
          hours: hoursValue,
          billable: entry.billable !== undefined ? entry.billable : false,
          workType: entry.workType || 'WORK'
        };
        return api.post(`/employee/timesheet/${timesheetId}/entry`, entryData);
      });

      await Promise.all(submitPromises);

      // Get the current status before adding entries
      const previousStatus = timesheetData.status || 'DRAFT';
      const wasSubmitted = previousStatus === 'SUBMITTED' || previousStatus === 'submitted';

      // Don't auto-submit - let employees submit manually when ready
      // If timesheet was already SUBMITTED, it remains SUBMITTED (backend handles this)
      if (wasSubmitted) {
        toast.success(`Successfully added ${validEntries.length} time entries. Timesheet remains SUBMITTED.`);
      } else {
        toast.success(`Successfully added ${validEntries.length} time entries. Please submit the timesheet when ready.`);
      }

      setShowWeeklyEntryModal(false);
      setWeeklyEntries([]);
      // Refresh timesheet data to get updated status from backend
      await fetchTimesheetData();
    } catch (error) {
      console.error('Error adding weekly entries:', error);
      toast.error(error.response?.data?.message || error.response?.data?.error || 'Failed to add time entries');
    } finally {
      // Clear flag after operation completes
      setTimeout(() => {
        window.safeSessionStorage.removeItem('timesheetOperationInProgress');
        window.safeSessionStorage.removeItem('timesheetOperationStartTime');
      }, 2000);
    }
  };

  // Fetch available projects for time entry (only assigned projects)
  const fetchAvailableProjects = async () => {
    try {
      // Get current week dates for filtering
      const weekDays = getWeekDays();
      const startDate = weekDays[0].dateStr;
      const endDate = weekDays[6].dateStr;

      // Fetch assigned tasks to get assigned projects for THIS WEEK
      const response = await employeeProjectAPI.getWeeklyAssignedTasks(startDate, endDate);
      const allTasks = Array.isArray(response.data) ? response.data :
                       (response.data?.data && Array.isArray(response.data.data)) ? response.data.data :
                       (response.data?.tasks || []);

      // Filter: exclude only tasks explicitly pending self-approval or rejected.
      // Tasks directly assigned by managers (null/empty approvalStatus) are always included.
      const tasks = allTasks.filter(t => {
        const approvalStatus = String(t.approvalStatus || '').trim().toUpperCase();
        // Exclude self-requested tasks that are still pending approval
        if (approvalStatus === 'PENDING_APPROVAL') return false;
        // Exclude explicitly rejected tasks
        if (approvalStatus === 'REJECTED') return false;
        // Include APPROVED tasks and manager-assigned tasks (null/empty status)
        return true;
      });

      // Extract unique projects from assigned tasks
      const projectMap = new Map();
      tasks.forEach(task => {
        const projectId = task.projectId;
        const projectName = task.projectName || 'Leaves/Holiday & other';
        if (projectId && !projectMap.has(projectId)) {
          projectMap.set(projectId, {
            id: projectId,
            projectName: projectName
          });
        }
      });

      const projectsList = Array.from(projectMap.values());
      setAvailableProjects(projectsList);
      console.log(' [Attendance] Available projects for time entry:', projectsList);
      return projectsList;
    } catch (error) {
      console.error('Error fetching assigned projects:', error);
      setAvailableProjects([]);
      return [];
    }
  };

  // Fetch tasks for selected project (only assigned tasks for that project)
  const fetchTasksForProject = async (projectId = null) => {
    try {
      // Get current week dates for filtering
      const weekDays = getWeekDays();
      const startDate = weekDays[0].dateStr;
      const endDate = weekDays[6].dateStr;

      // Fetch assigned tasks and filter by project for THIS WEEK
      const response = await employeeProjectAPI.getWeeklyAssignedTasks(startDate, endDate);
      const allTasksRaw = Array.isArray(response.data) ? response.data :
                          (response.data?.data && Array.isArray(response.data.data)) ? response.data.data :
                          (response.data?.tasks || []);

      const todayStr = new Date().toISOString().split('T')[0];

      const allTasks = allTasksRaw.filter(t => {
        const approvalStatus = String(t.approvalStatus || '').trim().toUpperCase();
        if (approvalStatus === 'PENDING_APPROVAL') return false;
        if (approvalStatus === 'REJECTED') return false;
        // Exclude completed / closed / archived tasks (rule 4 & 6)
        const taskStatus = String(t.status || t.taskStatus || '').trim().toUpperCase();
        if (taskStatus === 'COMPLETED' || taskStatus === 'DONE' || taskStatus === 'CLOSED' || taskStatus === 'ARCHIVED') return false;
        // Hide tasks whose start date is in the future (rule 3)
        const taskStart = (t.startDate || t.start_date || '').split('T')[0];
        if (taskStart && taskStart > todayStr) return false;
        return true;
      }).map(task => ({
        id: task.taskId,
        taskName: task.taskName,
        projectId: task.projectId,
        projectName: task.projectName,
        isBillable: task.isBillable !== undefined ? task.isBillable : true,
        startDate: task.startDate || task.start_date || null,
        endDate: task.endDate || task.dueDate || task.due_date || task.end_date || null,
        status: task.status || task.taskStatus || null
      }));

      // If a specific projectId is provided, we still set it to availableTasks for single-entry modal
      // But we keep all tasks so that weekly modal (which uses availableTasks) can work across multiple projects
      setAvailableTasks(allTasks);
      console.log(' [Attendance] Fetched all week tasks:', allTasks.length);
      return allTasks;
    } catch (error) {
      console.error('Error fetching assigned tasks:', error);
      setAvailableTasks([]);
      return [];
    }
  };

  // Handle project selection change
  const handleProjectChange = (projectId) => {
    setTimeEntryForm(prev => ({ ...prev, projectId, taskId: '' }));
    fetchTasksForProject(projectId);
  };

  // Helper to convert decimal hours (0.92) to HH.MM format (0.55)
  const decimalToHHMM = (decimal) => {
    if (!decimal && decimal !== 0) return "";
    const num = parseFloat(decimal);
    if (isNaN(num)) return "";
    const h = Math.floor(Math.abs(num));
    const m = Math.round((Math.abs(num) - h) * 60);
    const finalH = m === 60 ? h + 1 : h;
    const finalM = m === 60 ? 0 : m;
    return `${finalH}.${String(finalM).padStart(2, '0')}`;
  };

  // Helper to convert HH.MM format (0.55) to decimal hours (0.92)
  const hhmmToDecimal = (hhmm) => {
    if (!hhmm && hhmm !== 0) return 0;
    const s = String(hhmm);
    if (!s.includes('.')) return parseFloat(s) || 0;
    const [h, m] = s.split('.').map(Number);
    return (h || 0) + (m || 0) / 60;
  };

  // Auto-calculate hours for new time entry
  useEffect(() => {
    if (timeEntryForm.clockIn && timeEntryForm.clockOut) {
      const [startH, startM] = timeEntryForm.clockIn.split(':').map(Number);
      const [endH, endM] = timeEntryForm.clockOut.split(':').map(Number);
      
      if (!isNaN(startH) && !isNaN(endH)) {
        let startTotalMins = (startH * 60) + (startM || 0);
        let endTotalMins = (endH * 60) + (endM || 0);
        
        let diffMins = endTotalMins - startTotalMins;
        if (diffMins < 0) diffMins += 24 * 60; // Handle overnight
        
        const h = Math.floor(diffMins / 60);
        const m = Math.round(diffMins % 60);
        const newHours = `${h}.${String(m).padStart(2, '0')}`;

        setTimeEntryForm(prev => {
          if (prev.hours === newHours) return prev;
          return { ...prev, hours: newHours };
        });
      }
    }
  }, [timeEntryForm.clockIn, timeEntryForm.clockOut]);

  // Auto-calculate hours for editing time entry
  useEffect(() => {
    if (editEntryForm.clockIn && editEntryForm.clockOut) {
      const [startH, startM] = editEntryForm.clockIn.split(':').map(Number);
      const [endH, endM] = editEntryForm.clockOut.split(':').map(Number);
      
      if (!isNaN(startH) && !isNaN(endH)) {
        let startTotalMins = (startH * 60) + (startM || 0);
        let endTotalMins = (endH * 60) + (endM || 0);
        
        let diffMins = endTotalMins - startTotalMins;
        if (diffMins < 0) diffMins += 24 * 60; // Handle overnight
        
        const h = Math.floor(diffMins / 60);
        const m = Math.round(diffMins % 60);
        const newHours = `${h}.${String(m).padStart(2, '0')}`;

        setEditEntryForm(prev => {
          if (prev.hours === newHours) return prev;
          return { ...prev, hours: newHours };
        });
      }
    }
  }, [editEntryForm.clockIn, editEntryForm.clockOut]);

  // Timer control functions
  const startTimer = () => {
    if (timerState.isRunning) return;

    const now = Date.now();
    const nowTime = new Date(now).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

    setTimeEntryForm(prev => {
      if (!prev.clockIn) {
        return { ...prev, clockIn: nowTime };
      }
      return prev;
    });

    setTimerState(prev => {
      if (prev.isPaused) {
        // Resuming from pause - adjust startTime to account for already elapsed time
        return {
          ...prev,
          isRunning: true,
          isPaused: false,
          startTime: now - (prev.elapsedTime * 1000)
        };
      } else {
        // Starting fresh
        return {
          ...prev,
          isRunning: true,
          isPaused: false,
          startTime: now,
          elapsedTime: 0
        };
      }
    });

    // Notify browser extension (if installed) to start capture ONLY for billable entries
    try {
      if (typeof window !== 'undefined') {
        // Only start screen capture if billable is checked (true)
        const isBillable = timeEntryForm.billable === true;

        if (isBillable) {
          const currentUserId = user?.employeeId || currentUser?.employeeId || null;
          const tenantId = currentUser?.tenantId || currentUser?.tenant_id || null;
          // Make sure uploadUrl is absolute because the extension service worker cannot use relative URLs
          const baseUrl = API_BASE_URL.startsWith('http') ? API_BASE_URL : window.location.origin + (API_BASE_URL.startsWith('/') ? '' : '/') + API_BASE_URL;
          const uploadUrl = `${baseUrl}/employee/timesheet/entry/screenshots`;

          // Use same token storage as the app (window.safeSessionStorage) so backend auth works
          const employeeToken = window.safeSessionStorage.getItem('employeeToken');
          const adminToken = window.safeSessionStorage.getItem('adminToken');
          const superAdminToken = window.safeSessionStorage.getItem('superAdminToken');
          const authToken = employeeToken || adminToken || superAdminToken || null;

          // Show instruction to user
          setTimeout(() => {
            toast.info('ðŸ“¸ Screen capture will start. When prompted, select "Entire Screen" (not "Tab" or "Window") to capture all applications.', {
              duration: 5000
            });
          }, 500);

          console.log('[Timer] Starting screen capture for billable entry');
          window.postMessage(
            {
              source: 'PRAGVA_HRMS',
              type: 'TIMER_START_CAPTURE',
              context: {
                employeeId: currentUserId,
                entryId: null, // backend can attach later based on session if needed
                tenantId,
                uploadUrl,
                authToken,
                billable: true,
                workDate: timeEntryForm.workDate // Pass workDate so screenshots are stored with correct date
              }
            },
            '*'
          );
        } else {
          console.log('[Timer] Skipping screen capture - entry is not billable');
        }
      }
    } catch (err) {
      console.warn('Failed to notify extension for timer start', err);
    }
  };

  const pauseTimer = () => {
    if (!timerState.isRunning) return;

    setTimerState(prev => ({
      ...prev,
      isRunning: false,
      isPaused: true
    }));
  };

  const stopTimer = () => {
    let calculatedHours = 0;

    setTimerState(prev => {
      if (!prev.isRunning && !prev.isPaused && prev.elapsedTime === 0) {
        // Still notify extension to stop even if timer wasn't running
        try {
          if (typeof window !== 'undefined') {
            window.postMessage(
              {
                source: 'PRAGVA_HRMS',
                type: 'TIMER_STOP_CAPTURE'
              },
              '*'
            );
          }
        } catch (err) {
          console.warn('Failed to notify extension for timer stop', err);
        }
        return prev;
      }

      // Calculate total hours from elapsed time
      let elapsedSeconds = prev.elapsedTime;
      if (prev.isRunning && prev.startTime !== null) {
        // Recalculate using current time to avoid any timer lag
        elapsedSeconds = Math.floor((Date.now() - prev.startTime) / 1000);
      } else if (prev.isPaused && prev.startTime !== null) {
        // If paused, elapsedTime should already be correct
        elapsedSeconds = prev.elapsedTime;
      }

      // Convert seconds to hours (1 minute = 60 seconds = 0.0167 hours)
      // Use precise calculation: seconds / 3600
      const totalHours = elapsedSeconds / 3600;

      // Round to 2 decimal places using toFixed for accuracy
      // Example: 60 seconds = 0.0167 hours -> 0.02 hours
      // Example: 120 seconds = 0.0333 hours -> 0.03 hours
      let roundedHours = parseFloat(totalHours.toFixed(2));

      // If timer ran but rounded to 0, set to minimum 0.01
      if (elapsedSeconds > 0 && roundedHours === 0) {
        roundedHours = 0.01;
      }

      calculatedHours = roundedHours;

      // Update hours and clockOut field (only if not already set or if finishing a timer session)
      const nowTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
      
      setTimeEntryForm(timeEntryForm => ({
        ...timeEntryForm,
        hours: decimalToHHMM(totalHours),
        clockOut: timeEntryForm.clockOut || nowTime
      }));

      // Reset timer
      return {
        isRunning: false,
        isPaused: false,
        elapsedTime: 0,
        startTime: null,
        pausedTime: 0
      };
    });

    console.log('[Timer] Stopped timer, calculated hours:', calculatedHours);

    // Notify browser extension to stop capture
    try {
      if (typeof window !== 'undefined') {
        console.log('[Timer] Notifying extension to stop capture');
        window.postMessage(
          {
            source: 'PRAGVA_HRMS',
            type: 'TIMER_STOP_CAPTURE'
          },
          '*'
        );
      }
    } catch (err) {
      console.error('Failed to notify extension for timer stop', err);
    }
  };

  const resetTimer = () => {
    setTimerState({
      isRunning: false,
      isPaused: false,
      elapsedTime: 0,
      startTime: null,
      pausedTime: 0
    });
  };

  // Format time display (HH:MM:SS)
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Timer update effect
  useEffect(() => {
    let interval = null;

    if (timerState.isRunning && timerState.startTime !== null) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - timerState.startTime) / 1000);
        setTimerState(prev => ({
          ...prev,
          elapsedTime: elapsed
        }));
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [timerState.isRunning, timerState.startTime]);

  // Reset timer when modal closes
  useEffect(() => {
    if (!showTimeEntryModal) {
      resetTimer();
    }
  }, [showTimeEntryModal]);

  // Pre-fetch projects whenever the timesheet tab is active so dropdowns are ready instantly
  useEffect(() => {
    if (activeMainTab === 'timesheet') {
      fetchAvailableProjects();
    }
  }, [activeMainTab]);

  // Submit time entry
  const handleSubmitTimeEntry = async (e, isConfirmed = false) => {
    if (e) e.preventDefault();

    // No need to confirm for Save Draft (only for Submit)
    if (!isConfirmed && isDirectSubmit) {
      const formattedDate = timeEntryForm.workDate ? new Date(timeEntryForm.workDate).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }) : 'this date';
      
      setSubmitConfirmData({
        title: 'Confirm Submission',
        message: `Are you sure you want to submit the time entry for ${formattedDate}?`,
        type: 'submit',
        action: () => handleSubmitTimeEntry(null, true)
      });
      setShowSubmitConfirmModal(true);
      return;
    }

    setTimesheetLoading(true);

    // Set flag to prevent logout during timesheet operation
    window.safeSessionStorage.setItem('timesheetOperationInProgress', 'true');
    const operationStartTime = Date.now();
    window.safeSessionStorage.setItem('timesheetOperationStartTime', operationStartTime.toString());

    try {
      // Get or create timesheet if it doesn't exist
      let timesheetId = timesheetData.timesheetId;
      if (!timesheetId) {
        const weekDays = getWeekDays();
        const weekStart = weekDays[0].dateStr;

        console.log('ðŸ“… [Timesheet] Creating/getting timesheet for week:', weekStart);
        const timesheetResponse = await api.get('/employee/timesheet/week', { params: { weekStart } });
        timesheetId = timesheetResponse.data?.id || timesheetResponse.data?.timesheetId;

        if (!timesheetId) {
          toast.error('Failed to create timesheet. Please try again.');
          return;
        }

        // Update timesheet data with the new ID
        setTimesheetData(prev => ({ ...prev, timesheetId }));
      }

      // Validate required fields
      if (!timeEntryForm.workDate) {
        toast.error('Please select a work date');
        return;
      }
      if (!timeEntryForm.clockIn) {
        toast.error('Please select a Log In time');
        return;
      }
      if (!timeEntryForm.clockOut) {
        toast.error('Please select a Log Out time');
        return;
      }

      // Validate that hours match Log In/Log Out difference
      if (timeEntryForm.clockIn && timeEntryForm.clockOut) {
        const [startH, startM] = timeEntryForm.clockIn.split(':').map(Number);
        const [endH, endM] = timeEntryForm.clockOut.split(':').map(Number);
        if (!isNaN(startH) && !isNaN(endH)) {
          let diffMins = (endH * 60 + (endM || 0)) - (startH * 60 + (startM || 0));
          if (diffMins < 0) diffMins += 24 * 60; // Handle overnight
          const expectedHours = parseFloat((diffMins / 60).toFixed(2));
          const hoursValue = hhmmToDecimal(timeEntryForm.hours);
          if (Math.abs(hoursValue - expectedHours) > 0.03) {
            toast.error(`Entered hours (${hoursValue}h) must match the calculated time between Log In and Log Out (${expectedHours}h).`);
            return;
          }
        }
      }

      // --- Validation: Block future week dates ---
      // Employees can only log entries for the current week or past weeks
      {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dayOfWeek = today.getDay(); // 0=Sun..6=Sat
        const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
        const endOfCurrentWeek = new Date(today);
        endOfCurrentWeek.setDate(today.getDate() + daysUntilSunday);
        const selectedDate = new Date(timeEntryForm.workDate);
        selectedDate.setHours(0, 0, 0, 0);
        if (selectedDate > endOfCurrentWeek) {
          toast.error('You can only log time for the current week or past weeks.');
          return;
        }
      }

      // --- Validation: Task date-range & status checks ---
      if (timeEntryForm.taskId) {
        const selectedTask = availableTasks.find(t => String(t.id) === String(timeEntryForm.taskId));
        if (selectedTask) {
          const wd = timeEntryForm.workDate; // YYYY-MM-DD
          // Check task status
          const taskStatus = String(selectedTask.status || '').trim().toUpperCase();
          if (taskStatus === 'COMPLETED' || taskStatus === 'DONE') {
            toast.error('Task is not active. This task has been completed.');
            return;
          }
          if (taskStatus === 'CLOSED' || taskStatus === 'ARCHIVED') {
            toast.error('Task is not active. This task is closed/archived.');
            return;
          }
          // Check start date (rule 1)
          if (selectedTask.startDate) {
            const taskStart = selectedTask.startDate.split('T')[0];
            if (wd < taskStart) {
              toast.error('This task has not started yet. Timesheet entry cannot be created before the task start date.');
              return;
            }
          }
          // Check end date (rule 2)
          if (selectedTask.endDate) {
            const taskEnd = selectedTask.endDate.split('T')[0];
            if (wd > taskEnd) {
              toast.error('This task has already ended. Timesheet entry cannot be created after the task end date.');
              return;
            }
          }
        }
      }

      // --- Validation: Description ---
      const descError = validateDescription(timeEntryForm.description);
      if (descError) {
        toast.error(descError);
        return;
      }

      // Convert HH.MM back to decimal for backend
      const hoursValue = hhmmToDecimal(timeEntryForm.hours);

      // --- Validation: Duplicate Description ---
      const isDescDuplicate = (timesheetData.entries || []).some(e => 
        e.workDate === timeEntryForm.workDate && 
        String(e.taskId || '') === String(timeEntryForm.taskId || '') && 
        e.description?.trim().toLowerCase() === timeEntryForm.description?.trim().toLowerCase()
      );
      if (isDescDuplicate) {
        toast.error('Duplicate description for this task is not allowed.');
        return;
      }

      // --- Validation 1: Positive hours validation ---
      if (isNaN(hoursValue) || hoursValue <= 0) {
        toast.error('Entered hours must be greater than zero.');
        return;
      }

      // --- Validation 2: Shift hour validation (per entry) ---
      // Calculate the employee's shift hours from their shift timings
      let employeeShiftHours = 9; // Default to 9 hours if shift info not available
      try {
        const empUser = currentUser || user || {};
        const shiftStart = empUser.shift?.startTime || empUser.shiftStartTime || empUser.shift?.start_time;
        const shiftEnd = empUser.shift?.endTime || empUser.shiftEndTime || empUser.shift?.end_time;

        if (shiftStart && shiftEnd) {
          const [startH, startM] = shiftStart.toString().split(':').map(Number);
          const [endH, endM] = shiftEnd.toString().split(':').map(Number);

          let startTotalMins = (startH * 60) + (startM || 0);
          let endTotalMins = (endH * 60) + (endM || 0);

          if (endTotalMins < startTotalMins) {
            endTotalMins += 24 * 60; // overnight shift
          }

          employeeShiftHours = (endTotalMins - startTotalMins) / 60;
        }
      } catch (e) {
        console.error('Error calculating shift hours for validation:', e);
      }

      if (hoursValue > employeeShiftHours) {
        toast.error(`Entry hours cannot exceed shift hours (${employeeShiftHours}h).`);
        return;
      }

      // Ensure workDate is in YYYY-MM-DD format
      let workDateStr = timeEntryForm.workDate;
      if (workDateStr instanceof Date) {
        if (isNaN(workDateStr.getTime())) {
          toast.error('Invalid work date');
          return;
        }
        workDateStr = workDateStr.toISOString().split('T')[0];
      } else if (typeof workDateStr === 'string') {
        // Normalize to YYYY-MM-DD format
        if (workDateStr.includes('T')) {
          workDateStr = workDateStr.split('T')[0];
        }
        // Validate format
        if (!workDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          toast.error('Invalid date format. Please select a valid date.');
          return;
        }
      }

      // --- Validation 3: Duplicate task entry restriction ---
      // Check if the same task is already logged for the same date
      const existingEntries = timesheetData.entries || [];
      const currentTaskId = timeEntryForm.taskId ? Number(timeEntryForm.taskId) : null;
      const currentTaskName = timeEntryForm.taskName || null;

      const isTaskDuplicate = existingEntries.some(entry => {
        const entryDate = entry.workDate || entry.date || entry.entryDate;
        let entryDateStr = entryDate;
        if (entryDate instanceof Date) {
          entryDateStr = entryDate.toISOString().split('T')[0];
        } else if (typeof entryDate === 'string' && entryDate.includes('T')) {
          entryDateStr = entryDate.split('T')[0];
        }

        if (entryDateStr !== workDateStr) return false;

        // Match by taskId if available, otherwise by taskName
        let taskMatch = false;
        if (currentTaskId && entry.taskId) {
          taskMatch = Number(entry.taskId) === currentTaskId;
        } else if (currentTaskName && (entry.taskName || entry.task_name)) {
          taskMatch = (entry.taskName || entry.task_name) === currentTaskName;
        }

        if (!taskMatch) return false;

        // NEW: Allow same task if time logs are different
        // If BOTH have no time logs, they are duplicates
        const entryClockIn = entry.clockIn || '';
        const entryClockOut = entry.clockOut || '';
        const formClockIn = timeEntryForm.clockIn || '';
        const formClockOut = timeEntryForm.clockOut || '';

        return entryClockIn === formClockIn && entryClockOut === formClockOut;
      });

      if (isTaskDuplicate) {
        toast.error('Duplicate task entry for the selected time log.');
        return;
      }

      const overlapEntry = findOverlappingTimesheetEntry(existingEntries, {
        workDate: workDateStr,
        clockIn: timeEntryForm.clockIn,
        clockOut: timeEntryForm.clockOut,
      });
      if (overlapEntry) {
        const overlapProject = overlapEntry.projectName || overlapEntry.projectNameSnapshot || overlapEntry.project?.projectName || 'another task';
        const overlapRange = formatEntryTimeRange(overlapEntry) || 'the same time';
        toast.error(`Time period overlaps with an existing entry (${overlapProject}, ${overlapRange}). You cannot work on multiple tasks at the same time.`);
        return;
      }

      // --- Validation 4: Daily total hours validation (24h cap) ---
      const dailyTotal = existingEntries.reduce((sum, entry) => {
        const entryDate = entry.workDate || entry.date || entry.entryDate;
        let entryDateStr = entryDate;
        if (entryDate instanceof Date) {
          entryDateStr = entryDate.toISOString().split('T')[0];
        } else if (typeof entryDate === 'string' && entryDate.includes('T')) {
          entryDateStr = entryDate.split('T')[0];
        }

        if (entryDateStr === workDateStr) {
          let h = 0;
          if (entry.hours !== undefined && entry.hours !== null) {
            h = typeof entry.hours === 'number' ? entry.hours : parseFloat(entry.hours) || 0;
          } else if (entry.totalHours) {
            h = typeof entry.totalHours === 'number' ? entry.totalHours : parseHours(entry.totalHours);
          }
          return sum + h;
        }
        return sum;
      }, 0);

      if (dailyTotal + hoursValue > 24) {
        toast.error(`Total hours for the day cannot exceed 24 hours. Already logged: ${dailyTotal}h, attempting to add: ${hoursValue}h.`);
        return;
      }

      const entryData = {
        workDate: workDateStr,
        projectId: timeEntryForm.projectId ? Number(timeEntryForm.projectId) : null,
        taskId: timeEntryForm.taskId ? Number(timeEntryForm.taskId) : null,
        taskName: timeEntryForm.taskName || null,
        description: timeEntryForm.description || '',
        hours: hoursValue,
        clockIn: timeEntryForm.clockIn || null,
        clockOut: timeEntryForm.clockOut || null,
        billable: timeEntryForm.billable !== undefined ? timeEntryForm.billable : false,
        workType: timeEntryForm.workType || 'WORK',
        isDirectSubmit: isDirectSubmit
      };

      console.log('ðŸ“ [Timesheet] Submitting entry:', entryData);

      const response = await api.post(`/employee/timesheet/${timesheetId}/entry`, entryData);
      const entryId = response.data?.id || response.data?.entryId;

      // Notify extension about the new entryId so screenshots can be associated
      if (entryId && typeof window !== 'undefined') {
        try {
          window.postMessage(
            {
              source: 'PRAGVA_HRMS',
              type: 'TIMER_ENTRY_CREATED',
              entryId: entryId
            },
            '*'
          );
          console.log('[Timer] Notified extension about entryId:', entryId);
        } catch (err) {
          console.warn('Failed to notify extension about entryId', err);
        }
      }

      // Get the current status before adding entry
      const previousStatus = timesheetData.status || 'DRAFT';
      const wasSubmitted = previousStatus === 'SUBMITTED' || previousStatus === 'submitted';

      // Don't auto-submit - let employees submit manually when ready
      // If timesheet was already SUBMITTED, it remains SUBMITTED (backend handles this)
      if (wasSubmitted || isDirectSubmit) {
        toast.success(isDirectSubmit ? 'Time entry submitted successfully!' : 'Time entry added successfully. Timesheet remains SUBMITTED.');
      } else {
        toast.success('Time entry added successfully. Please submit the timesheet when ready.');
      }

      setShowTimeEntryModal(false);
      // Refresh timesheet data to get updated status from backend
      await fetchTimesheetData();
    } catch (error) {
      console.error('Error adding time entry:', error);
      // Extract detailed error message from backend
      const errorMessage = error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to add time entry';
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: errorMessage
      });
      toast.error(errorMessage);
    } finally {
      setTimesheetLoading(false);
      // Clear flag after operation completes (with a delay to ensure all API calls finish)
      setTimeout(() => {
        window.safeSessionStorage.removeItem('timesheetOperationInProgress');
        window.safeSessionStorage.removeItem('timesheetOperationStartTime');
      }, 2000);
    }
  };

  // Helper function to check if all working days in a month have entries
  const checkMonthCompleteness = (monthDays, existingEntries) => {
    for (const day of monthDays) {
      const dateStr = day.dateStr;
      
      // 1. Skip Weekends (configurable)
      if (isWeekendDay(dateStr)) continue;
      
      // 2. Skip Holidays
      if (isHoliday(dateStr)) continue;
      
      // 3. Skip Approved Leaves
      if (isApprovedLeave(dateStr)) continue;
      
      // 4. Check for entry
      const hasEntry = existingEntries.some(entry => {
        let entryDate = entry.workDate || entry.date || entry.entryDate;
        if (entryDate && typeof entryDate === 'string' && entryDate.includes('T')) {
          entryDate = entryDate.split('T')[0];
        }
        return entryDate === dateStr;
      });
      
      if (!hasEntry) {
        return false;
      }
    }
    return true;
  };

  // Handle manual timesheet submission
  const handleSubmitTimesheet = async () => {
    const timesheetId = timesheetData.timesheetId;
    if (!timesheetId) {
      toast.error('No timesheet found. Please add entries first.');
      return;
    }

    const currentStatus = timesheetData.status || 'DRAFT';
    const normalizedStatus = currentStatus ? String(currentStatus).trim().toUpperCase() : 'DRAFT';

    // Check if there are new DRAFT entries that need submission
    // Backend now returns PENDING for already-submitted entries and DRAFT only for truly new ones
    const hasPendingEntries = (timesheetData.entries || []).some(entry => {
      const entryStatus = entry.status || 'DRAFT';
      return entryStatus === 'DRAFT';
    });

    // Allow submission for:
    // 1. DRAFT or REJECTED timesheets
    // 2. Any timesheet with PENDING entries (e.g., APPROVED/SUBMITTED timesheets with new DRAFT entries)
    if (normalizedStatus !== 'DRAFT' && normalizedStatus !== 'REJECTED' && !hasPendingEntries) {
      if (normalizedStatus === 'SUBMITTED') {
        toast('All entries are already approved. No new entries to submit.', {
          icon: '',
          duration: 4000
        });
      } else {
        toast.error(`Timesheet cannot be submitted. Current status: ${currentStatus}`);
      }
      return;
    }

    // --- Part 2: Working Days Validation ---
    // Smart validation for cross-month weeks
    const weekDays = getWeekDays();
    const existingEntries = timesheetData.entries || [];
    
    // Check if week spans two different months
    const firstMonth = weekDays[0].dateStr.split('-')[1];
    const lastMonth = weekDays[6].dateStr.split('-')[1];
    const isCrossMonthWeek = firstMonth !== lastMonth;
    
    if (isCrossMonthWeek) {
      // For cross-month weeks, allow submission if all working days in EITHER month have entries
      const firstMonthDays = weekDays.filter(day => day.dateStr.split('-')[1] === firstMonth);
      const secondMonthDays = weekDays.filter(day => day.dateStr.split('-')[1] === lastMonth);
      
      const hasCompleteFirstMonth = checkMonthCompleteness(firstMonthDays, existingEntries);
      const hasCompleteSecondMonth = checkMonthCompleteness(secondMonthDays, existingEntries);
      
      if (!hasCompleteFirstMonth && !hasCompleteSecondMonth) {
        toast.error('For cross-month weeks, please add entries for all working days in at least one month before submitting.', {
          duration: 5000,
          style: { border: '1px solid #ffffff', color: '#000000' }
        });
        return;
      }
    } else {
      // For single-month weeks, check all working days have entries
      for (const day of weekDays) {
        const dateStr = day.dateStr;
        
        // 1. Skip Weekends (configurable)
        if (isWeekendDay(dateStr)) continue;
        
        // 2. Skip Holidays
        if (isHoliday(dateStr)) continue;
        
        // 3. Skip Approved Leaves
        if (isApprovedLeave(dateStr)) continue;
        
        // 4. Check for entry
        const hasEntry = existingEntries.some(entry => {
          let entryDate = entry.workDate || entry.date || entry.entryDate;
          if (entryDate && typeof entryDate === 'string' && entryDate.includes('T')) {
            entryDate = entryDate.split('T')[0];
          }
          return entryDate === dateStr;
        });
        
        if (!hasEntry) {
          toast.error(`Incomplete Timesheet: Missing entry for ${day.dayName} (${dateStr}). Please log hours for all working days before submitting.`, {
            duration: 5000,
            style: { border: '1px solid #ffffff', color: '#000000' }
          });
          return;
        }
      }
    }

    try {
      setSubmittingTimesheet(true);

      // Identify and save any virtual holiday/leave entries before final submission
      const virtualEntries = (timesheetData.entries || []).filter(e => e.isVirtual);
      if (virtualEntries.length > 0) {
        console.log(`ðŸ“¦ [Timesheet] Saving ${virtualEntries.length} virtual holiday/leave entries before submit`);
        const savePromises = virtualEntries.map(entry => {
          const entryData = {
            workDate: entry.workDate,
            projectId: null,
            taskId: null,
            taskName: entry.taskName,
            description: entry.description,
            hours: parseFloat(entry.hours) || 0,
            billable: false,
            workType: entry.workType
          };
          return api.post(`/employee/timesheet/${timesheetId}/entry`, entryData).catch(err => {
            console.error(`Error saving virtual entry for ${entry.workDate}:`, err);
            // Don't fail the whole process if one save fails, but we might want to know
            return null;
          });
        });
        await Promise.all(savePromises);
      }

      // If timesheet is SUBMITTED with DRAFT entries, provide clear feedback
      if (normalizedStatus === 'SUBMITTED' && hasPendingEntries) {
        console.log('ðŸ“¤ Submitting DRAFT entries in SUBMITTED timesheet');
      }

      await api.post(`/employee/timesheet/${timesheetId}/submit`);
      await fetchTimesheetData();
      
      if (normalizedStatus === 'SUBMITTED') {
        // Count how many DRAFT entries were submitted (backend now returns PENDING for already-submitted)
        const draftEntriesCount = (timesheetData.entries || []).filter(entry => 
          (entry.status || 'DRAFT') === 'DRAFT'
        ).length;
        
        toast.success(`${draftEntriesCount > 0 ? draftEntriesCount : 'New'} entries submitted for manager approval!`, {
          position: 'top-right',
          icon: '✓',
          duration: 4000,
        });
      } else {
        toast.success('Timesheet submitted successfully! Awaiting manager approval.', {
          position: 'top-right',
          icon: '✓',
          duration: 4000,
        });
      }
    } catch (error) {
      console.error('Error submitting timesheet:', error);
      const errorMessage = error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to submit timesheet';

      // If backend rejects SUBMITTED timesheet submission, provide helpful message
      if (error.response?.status === 400 && normalizedStatus === 'SUBMITTED' && hasPendingEntries) {
        toast.error('Cannot resubmit timesheet. The backend does not allow submitting a timesheet that is already SUBMITTED, even with new entries. The new entries will remain DRAFT until the timesheet is approved or rejected.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setSubmittingTimesheet(false);
    }
  };

  const getMonthKeyFromDate = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  // Pick the month a week should default to. For cross-month weeks:
  //  - if the week contains today, use today's month
  //  - otherwise use whichever month owns the majority of the 7 days
  const getWeekDefaultMonthKey = (weekStartDate) => {
    const start = new Date(weekStartDate.getFullYear(), weekStartDate.getMonth(), weekStartDate.getDate());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }

    const todayKey = getMonthKeyFromDate(new Date());
    const dayKeys = days.map(getMonthKeyFromDate);
    if (dayKeys.includes(todayKey)) return todayKey;

    const counts = dayKeys.reduce((acc, key) => {
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    // Later month wins ties (weeks that roll into a new month favor the new month)
    return Object.keys(counts).sort((a, b) => (counts[b] - counts[a]) || (a < b ? 1 : -1))[0];
  };

  const handleTimesheetMonthChange = (monthValue) => {
    if (!monthValue) return;
    setTimesheetMonthFilter(monthValue);
    
    const [year, month] = monthValue.split('-');
    const parsedYear = parseInt(year, 10);
    const parsedMonth = parseInt(month, 10) - 1; // 0-indexed month
    
    // Find the first day of the selected month
    const firstDayOfMonth = new Date(parsedYear, parsedMonth, 1);
    
    // Calculate Monday of the week containing firstDayOfMonth
    const day = firstDayOfMonth.getDay();
    const diff = firstDayOfMonth.getDate() - day + (day === 0 ? -6 : 1);
    const newWeekStart = new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth(), diff);
    
    setCurrentWeekStart(newWeekStart);
  };

  // Navigate weeks
  const navigateWeek = (direction) => {
    const newDate = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate());
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setTimesheetMonthFilter(getWeekDefaultMonthKey(newDate));

    if (activeMainTab === 'attendance' && !isAdmin && !(isHR && hrDataView === 'team-data')) {
      setEmployeeAttendanceData([]);
    }

    // Immediately reset timesheet data to prevent showing old data
    if (activeMainTab === 'timesheet' && !isAdmin) {
      // Calculate week days for the new week manually (before state update)
      const newWeekDays = [];
      const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

      for (let i = 0; i < 7; i++) {
        const date = new Date(newDate);
        date.setDate(newDate.getDate() + i);
        newWeekDays.push({
          date: date.getDate(),
          month: monthNames[date.getMonth()],
          dayName: dayNames[date.getDay()],
          dateStr: formatDateLocal(date),
          isToday: new Date().toDateString() === date.toDateString()
        });
      }

      // Reset to default state immediately to clear old data
      const attendanceMap = {};
      newWeekDays.forEach(day => {
        attendanceMap[day.dateStr] = '0:00';
      });

      setTimesheetData({
        timesheetId: null,
        entries: [], // Clear entries immediately
        totalHours: '0:00',
        expectedHours: '56:00',
        billable: '0:00',
        nonBillable: '0:00',
        timeOff: '0:00',
        attendanceHours: attendanceMap,
        status: 'DRAFT', // Reset to DRAFT while fetching
        projects: [] // Clear projects
      });
      setAssignedTasks([]);
      setRejectedTimesheetsList([]);
      setPastDueTimesheets([]);
    }

    // Update week start - this will trigger useEffect to fetch new data
    setCurrentWeekStart(newDate);
  };

  // Format week range display
  const formatWeekRange = () => {
    const endDate = new Date(currentWeekStart);
    endDate.setDate(currentWeekStart.getDate() + 6);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const startMonth = monthNames[currentWeekStart.getMonth()];
    const endMonth = monthNames[endDate.getMonth()];

    if (startMonth === endMonth) {
      return `${currentWeekStart.getDate()} - ${endDate.getDate()} ${endMonth} ${endDate.getFullYear()}`;
    }
    return `${currentWeekStart.getDate()} ${startMonth} - ${endDate.getDate()} ${endMonth} ${endDate.getFullYear()}`;
  };

  // Handle view timesheet details
  const handleViewTimesheet = async (timesheet) => {
    // Set the timesheet immediately to show the modal
    setSelectedTimesheet(timesheet);
    setShowTimesheetModal(true);

    // If we're viewing team data and the timesheet has an ID, try to fetch the full details
    // to ensure we have the latest entry-level approval information
    if (isHR && hrDataView === 'team-data' && timesheet.id) {
      try {
        // Try to fetch the full timesheet details with entries
        const weekStart = timesheet.weekStartDate || timesheet.weekStart;
        if (weekStart) {
          const response = await teamAPI.getPendingTimesheets(weekStart);
          let allTimesheets = [];
          if (response.data?.timesheets && Array.isArray(response.data.timesheets)) {
            allTimesheets = response.data.timesheets;
          } else if (Array.isArray(response.data)) {
            allTimesheets = response.data;
          } else if (response.data?.data && Array.isArray(response.data.data)) {
            allTimesheets = response.data.data;
          }

          // Find the matching timesheet with full details
          const fullTimesheet = allTimesheets.find(ts => ts.id === timesheet.id);
          if (fullTimesheet && fullTimesheet.entries) {
            setSelectedTimesheet(fullTimesheet);
          }
        }
      } catch (error) {
        console.error('Error fetching full timesheet details:', error);
        // Continue with the original timesheet data if fetch fails
      }
    }
  };

  // Handle approve timesheet (for HR team management)
  const handleApproveTimesheet = async (timesheet, isConfirmed = false) => {
    if (!isConfirmed) {
      setSubmitConfirmData({
        title: 'Confirm Approval',
        message: `Approve timesheet for ${timesheet.employeeName || timesheet.employee?.firstName + ' ' + timesheet.employee?.lastName || 'employee'}?`,
        type: 'submit',
        action: () => handleApproveTimesheet(timesheet, true)
      });
      setShowSubmitConfirmModal(true);
      return;
    }
    try {
      await teamAPI.approveTimesheet(timesheet.id, { managerId: user?.employeeId });
      toast.success('Timesheet approved successfully');
      // Refresh team timesheets
      await fetchTeamTimesheets();
      // Refresh the selected timesheet if modal is open
      if (showTimesheetModal && selectedTimesheet && selectedTimesheet.id === timesheet.id) {
        // Wait a bit for the data to refresh, then update
        setTimeout(async () => {
          try {
            const updatedTimesheets = teamTimesheets.length > 0 ? teamTimesheets : adminTimesheets;
            const updatedTimesheet = updatedTimesheets.find(ts => ts.id === timesheet.id);
            if (updatedTimesheet) {
              setSelectedTimesheet(updatedTimesheet);
            }
          } catch (err) {
            console.error('Error refreshing timesheet details:', err);
          }
        }, 500);
      }
    } catch (error) {
      console.error('Error approving timesheet:', error);
      toast.error(error.response?.data?.message || 'Failed to approve timesheet');
    }
  };

  // Handle reject timesheet (for HR team management)
  const handleRejectTimesheet = async (timesheet) => {
    const reason = window.prompt('Please provide a reason for rejection:');
    if (!reason || reason.trim() === '') {
      return;
    }
    try {
      await teamAPI.rejectTimesheet(timesheet.id, { managerId: user?.employeeId, reason });
      toast.success('Timesheet rejected');
      // Refresh team timesheets
      await fetchTeamTimesheets();
      // Refresh the selected timesheet if modal is open
      if (showTimesheetModal && selectedTimesheet && selectedTimesheet.id === timesheet.id) {
        // Wait a bit for the data to refresh, then update
        setTimeout(async () => {
          try {
            const updatedTimesheets = teamTimesheets.length > 0 ? teamTimesheets : adminTimesheets;
            const updatedTimesheet = updatedTimesheets.find(ts => ts.id === timesheet.id);
            if (updatedTimesheet) {
              setSelectedTimesheet(updatedTimesheet);
            }
          } catch (err) {
            console.error('Error refreshing timesheet details:', err);
          }
        }, 500);
      }
    } catch (error) {
      console.error('Error rejecting timesheet:', error);
      toast.error(error.response?.data?.error || error.response?.data?.message || 'Failed to reject timesheet');
    }
  };

  // Handle approve timesheet entry (for HR team management)
  const handleApproveTimesheetEntry = async (timesheet, entry, isConfirmed = false) => {
    if (!isConfirmed) {
      setSubmitConfirmData({
        title: 'Confirm Entry Approval',
        message: `Are you sure you want to approve this timesheet entry for ${entry.workDate}?`,
        type: 'submit',
        action: () => handleApproveTimesheetEntry(timesheet, entry, true)
      });
      setShowSubmitConfirmModal(true);
      return;
    }
    try {
      await teamAPI.approveTimesheetEntry(timesheet.id, entry.id, { managerId: user?.employeeId });
      toast.success('Timesheet entry approved successfully');
      // Keep the timesheet expanded
      const wasExpanded = timesheet.id ? expandedTimesheets.has(timesheet.id) : false;
      // Refresh team timesheets
      await fetchTeamTimesheets();
      // Restore expanded state
      if (wasExpanded) {
        setExpandedTimesheets(prev => new Set(prev).add(timesheet.id));
      }
      // Refresh the selected timesheet if modal is open
      if (showTimesheetModal && selectedTimesheet && selectedTimesheet.id === timesheet.id) {
        setTimeout(async () => {
          try {
            const updatedTimesheets = teamTimesheets.length > 0 ? teamTimesheets : adminTimesheets;
            const updatedTimesheet = updatedTimesheets.find(ts => ts.id === timesheet.id);
            if (updatedTimesheet) {
              setSelectedTimesheet(updatedTimesheet);
            }
          } catch (err) {
            console.error('Error refreshing timesheet details:', err);
          }
        }, 500);
      }
    } catch (error) {
      console.error('Error approving timesheet entry:', error);
      toast.error(error.response?.data?.message || 'Failed to approve timesheet entry');
    }
  };

  // Handle reject timesheet entry (for HR team management)
  const handleRejectTimesheetEntry = async (timesheet, entry) => {
    const reason = window.prompt('Please provide a reason for rejection:');
    if (!reason || reason.trim() === '') {
      return;
    }
    try {
      await teamAPI.rejectTimesheetEntry(timesheet.id, entry.id, { managerId: user?.employeeId, reason });
      toast.success('Timesheet entry rejected');
      // Keep the timesheet expanded
      const wasExpanded = timesheet.id ? expandedTimesheets.has(timesheet.id) : false;
      // Refresh team timesheets
      await fetchTeamTimesheets();
      // Restore expanded state
      if (wasExpanded) {
        setExpandedTimesheets(prev => new Set(prev).add(timesheet.id));
      }
      // Refresh the selected timesheet if modal is open
      if (showTimesheetModal && selectedTimesheet && selectedTimesheet.id === timesheet.id) {
        setTimeout(async () => {
          try {
            const updatedTimesheets = teamTimesheets.length > 0 ? teamTimesheets : adminTimesheets;
            const updatedTimesheet = updatedTimesheets.find(ts => ts.id === timesheet.id);
            if (updatedTimesheet) {
              setSelectedTimesheet(updatedTimesheet);
            }
          } catch (err) {
            console.error('Error refreshing timesheet details:', err);
          }
        }, 500);
      }
    } catch (error) {
      console.error('Error rejecting timesheet entry:', error);
      toast.error(error.response?.data?.error || error.response?.data?.message || 'Failed to reject timesheet entry');
    }
  };

  // Shared helper: populate edit form and await data fetches before opening modal
  const openEditEntryModal = async (entry, editMode) => {
    const entryDate = entry.workDate || entry.work_date || entry.date;
    const hoursValue = entry.hours || entry.hoursWorked || 0;
    const projectId = entry.projectId || entry.project?.id || '';
    setEditingEntry({ ...entry, _editMode: editMode });
    setEditEntryForm({
      workDate: entryDate ? new Date(entryDate).toISOString().split('T')[0] : '',
      projectId,
      taskId: entry.taskId || entry.task?.id || '',
      taskName: entry.taskName || entry.taskNameSnapshot || entry.task?.name || '',
      description: entry.description || '',
      hours: decimalToHHMM(hoursValue),
      clockIn: entry.clockIn ? entry.clockIn.toString().substring(0, 5) : '',
      clockOut: entry.clockOut ? entry.clockOut.toString().substring(0, 5) : '',
      billable: entry.billable !== undefined ? entry.billable : (entry.isBillable !== undefined ? entry.isBillable : false),
      workType: entry.workType || 'WORK'
    });
    // Await both fetches so dropdowns are populated before modal opens
    await fetchAvailableProjects();
    if (projectId) {
      await fetchTasksForProject(projectId);
    }
    setShowEditEntryModal(true);
  };

  // Handle edit rejected entry
  const handleEditRejectedEntry = (entry, timesheet) => {
    openEditEntryModal(entry, 'rejected');
  };

  // Handle edit draft entry
  const handleEditDraftEntry = (entry, timesheet) => {
    openEditEntryModal(entry, 'draft');
  };

  // Handle delete draft entry - show in-app confirmation
  const handleDeleteEntry = (entry) => {
    if (!entry?.id) return;
    setEntryToDelete(entry);
    setSubmitConfirmData({
      title: 'Delete Time Entry',
      message: `Are you sure you want to delete the time entry for ${new Date(entry.workDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}? This action cannot be undone.`,
      type: 'delete',
      action: () => confirmDeleteEntry(entry)
    });
    setShowSubmitConfirmModal(true);
  };

  // Confirm delete action
  const confirmDeleteEntry = async (entryToUse) => {
    const entry = entryToUse || entryToDelete;
    if (!entry?.id) return;
    setShowDeleteConfirmModal(false);
    setShowSubmitConfirmModal(false);
    try {
      setTimesheetLoading(true);
      await api.delete(`/employee/timesheet/entry/${entry.id}`);
      toast.success('Entry deleted successfully');
      await fetchTimesheetData();
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error(error.response?.data?.message || 'Failed to delete entry');
    } finally {
      setTimesheetLoading(false);
      setEntryToDelete(null);
    }
  };

  // Handle update rejected entry
  const handleUpdateEntry = async (e, shouldResubmit = false, isConfirmed = false) => {
    if (e) e.preventDefault();
    if (!editingEntry || !editingEntry.id) {
      toast.error('No entry selected for editing');
      return;
    }

    // No need to confirm for simple updates (only for resubmit)
    if (!isConfirmed && shouldResubmit) {
      const formattedDate = editEntryForm.workDate ? new Date(editEntryForm.workDate).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }) : 'this date';
      
      const actionLabel = shouldResubmit ? 'update and resubmit' : 'update';
      setSubmitConfirmData({
        title: shouldResubmit ? 'Confirm Resubmission' : 'Confirm Update',
        message: `Are you sure you want to ${actionLabel} the time entry for ${formattedDate}?`,
        type: 'update',
        action: () => handleUpdateEntry(null, shouldResubmit, true)
      });
      setShowSubmitConfirmModal(true);
      return;
    }

    try {
      setTimesheetLoading(true);

      // Validate required fields
      if (!editEntryForm.clockIn) {
        toast.error('Please select a Log In time');
        return;
      }
      if (!editEntryForm.clockOut) {
        toast.error('Please select a Log Out time');
        return;
      }

      // Convert HH.MM back to decimal for backend
      const hoursValue = hhmmToDecimal(editEntryForm.hours);
      if (isNaN(hoursValue) || hoursValue < 0) {
        toast.error('Please enter valid hours (must be >= 0)');
        return;
      }

      // Validate that hours match Log In/Log Out difference
      if (editEntryForm.clockIn && editEntryForm.clockOut) {
        const [startH, startM] = editEntryForm.clockIn.split(':').map(Number);
        const [endH, endM] = editEntryForm.clockOut.split(':').map(Number);
        if (!isNaN(startH) && !isNaN(endH)) {
          let diffMins = (endH * 60 + (endM || 0)) - (startH * 60 + (startM || 0));
          if (diffMins < 0) diffMins += 24 * 60; // Handle overnight
          const expectedHours = parseFloat((diffMins / 60).toFixed(2));
          if (Math.abs(hoursValue - expectedHours) > 0.03) {
            toast.error(`Entered hours (${hoursValue}h) must match the calculated time between Log In and Log Out (${expectedHours}h).`);
            return;
          }
        }
      }

      // --- Validation: Description ---
      const descError = validateDescription(editEntryForm.description);
      if (descError) {
        toast.error(descError);
        return;
      }

      // --- Validation: Duplicate Description ---
      const isDescDuplicate = (timesheetData.entries || []).some(e => 
        e.id !== editingEntry.id &&
        e.workDate === editEntryForm.workDate && 
        String(e.taskId || '') === String(editEntryForm.taskId || '') && 
        e.description?.trim().toLowerCase() === editEntryForm.description?.trim().toLowerCase()
      );
      if (isDescDuplicate) {
        toast.error('Duplicate description for this task is not allowed.');
        return;
      }

      const overlapEntry = findOverlappingTimesheetEntry(timesheetData.entries || [], {
        workDate: editEntryForm.workDate,
        clockIn: editEntryForm.clockIn,
        clockOut: editEntryForm.clockOut,
        excludeEntryId: editingEntry.id,
      });
      if (overlapEntry) {
        const overlapProject = overlapEntry.projectName || overlapEntry.projectNameSnapshot || overlapEntry.project?.projectName || 'another task';
        const overlapRange = formatEntryTimeRange(overlapEntry) || 'the same time';
        toast.error(`Time period overlaps with an existing entry (${overlapProject}, ${overlapRange}). You cannot work on multiple tasks at the same time.`);
        return;
      }

      const entryData = {
        workDate: editEntryForm.workDate,
        description: editEntryForm.description,
        hours: hoursValue,
        clockIn: editEntryForm.clockIn || null,
        clockOut: editEntryForm.clockOut || null,
        billable: editEntryForm.billable !== undefined ? editEntryForm.billable : true,
        workType: editEntryForm.workType || 'WORK',
        isDirectSubmit: shouldResubmit
      };

      // Add project/task if provided
      if (editEntryForm.projectId) {
        entryData.projectId = editEntryForm.projectId;
      }
      if (editEntryForm.taskId) {
        entryData.taskId = editEntryForm.taskId;
      } else if (editEntryForm.taskName) {
        entryData.taskName = editEntryForm.taskName;
      }

      console.log('ðŸ“ [Timesheet] Updating entry:', entryData);

      const response = await api.put(`/employee/timesheet/entry/${editingEntry.id}`, entryData);

      // Refresh timesheet data to reflect submission status
      await fetchTimesheetData();

      if (shouldResubmit) {
        toast.success('Entry updated and timesheet submitted successfully!');
      } else {
        toast.success('Entry updated successfully!');
      }

      setShowEditEntryModal(false);
      setEditingEntry(null);
    } catch (error) {
      console.error('Error updating entry:', error);
      const errorMessage = error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to update entry';
      toast.error(errorMessage);
    } finally {
      setTimesheetLoading(false);
    }
  };

  // Handle view attendance details
  const handleViewAttendance = (record) => {
    // Show attendance details modal or navigate to details page
    toast.info(`Viewing attendance details for ${record.employeeName || record.employeeId}`);
    // You can implement a modal here if needed
  };

  // Handle add attendance note/action
  const handleAddAttendanceNote = (record) => {
    const note = window.prompt(`Add a note/action for ${record.employeeName || record.employeeId}:`);
    if (note && note.trim() !== '') {
      // You can implement API call to save note here
      toast.success('Note added successfully');
    }
  };

  // Toggle project expansion
  const toggleProjectExpand = (projectId) => {
    setAssignedProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, expanded: !p.expanded } : p
    ));
  };

  // Toggle timesheet expansion
  const toggleTimesheetExpand = (timesheetId) => {
    if (!timesheetId && timesheetId !== 0 && timesheetId !== '') {
      console.warn('Cannot toggle expansion: timesheet ID is missing');
      return;
    }
    setExpandedTimesheets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(timesheetId)) {
        newSet.delete(timesheetId);
      } else {
        newSet.add(timesheetId);
      }
      return newSet;
    });
  };

  // Calculate percentage for circular chart
  const calculatePercentage = (available, annual) => {
    if (!annual || annual === 0) return 0;
    if (!available || available === 0) return 0;
    return Math.min(100, Math.max(0, (available / annual) * 100));
  };

  // Handle leave request
  const handleRequestLeave = () => {
    setShowLeaveModal(true);
  };

  // Helper functions for Duration and Balance (Synced from Leaves.jsx)
  const calculateRequestedDuration = (start, end, halfDayType) => {
    if (!start) return 0;
    if (halfDayType && halfDayType !== 'FULL_DAY') return 0.5;
    if (!end) return 1;

    let count = 0;
    let cur = new Date(start);
    const last = new Date(end);

    while (cur <= last) {
      const day = cur.getDay();
      const isWeekend = day === 0 || day === 6;
      const dateStr = cur.toISOString().split('T')[0];
      const isHoliday = (holidays || []).some(h => {
        const hDate = new Date(h.date).toISOString().split('T')[0];
        return hDate === dateStr;
      });

      if (!isWeekend && !isHoliday) {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  const getAvailableBalance = (code) => {
    if (leaveBalancesByCode && leaveBalancesByCode[code] !== undefined) {
      return leaveBalancesByCode[code].available || 0;
    }
    return 0;
  };

  const mapLeaveTypeCodeToEnum = (leaveTypeInput) => {
    const codeToEnumMap = {
      'AL': 'ANNUAL_LEAVE',
      'SL': 'SICK_LEAVE',
      'PL': 'PERSONAL_LEAVE',
      'ML': 'MATERNITY_LEAVE',
      'PTL': 'PATERNITY_LEAVE',
      'BL': 'BEREAVEMENT_LEAVE',
      'CL': 'CASUAL_LEAVE',
      'CML': 'COMPASSIONATE_LEAVE',
      'STL': 'STUDY_LEAVE',
      'TRL': 'TRAINING_LEAVE',
      'UL': 'UNPAID_LEAVE',
      'HALF_DAY': 'HALF_DAY',
      'CO': 'COMPENSATORY_OFF',
      'FL': 'FESTIVAL_LEAVE',
      'BDL': 'BIRTHDAY_LEAVE',
      'ANL': 'ANNIVERSARY_LEAVE'
    };

    if (Object.values(codeToEnumMap).includes(leaveTypeInput)) return leaveTypeInput;
    if (codeToEnumMap[leaveTypeInput]) return codeToEnumMap[leaveTypeInput];

    const nameToEnumMap = {
      'annual leave': 'ANNUAL_LEAVE',
      'sick leave': 'SICK_LEAVE',
      'personal leave': 'PERSONAL_LEAVE',
      'maternity leave': 'MATERNITY_LEAVE',
      'paternity leave': 'PATERNITY_LEAVE',
      'bereavement leave': 'BEREAVEMENT_LEAVE',
      'casual leave': 'CASUAL_LEAVE',
      'compassionate leave': 'COMPASSIONATE_LEAVE',
      'study leave': 'STUDY_LEAVE',
      'training leave': 'TRAINING_LEAVE',
      'unpaid leave': 'UNPAID_LEAVE',
      'half day': 'HALF_DAY',
      'compensatory off': 'COMPENSATORY_OFF',
      'festival leave': 'FESTIVAL_LEAVE',
      'birthday leave': 'BIRTHDAY_LEAVE',
      'anniversary leave': 'ANNIVERSARY_LEAVE'
    };

    const lowerName = String(leaveTypeInput).toLowerCase();
    if (nameToEnumMap[lowerName]) return nameToEnumMap[lowerName];

    const activeType = leaveTypeOptions.find(lt =>
      lt.leaveTypeName === leaveTypeInput ||
      lt.leaveTypeCode === leaveTypeInput ||
      String(lt.id) === leaveTypeInput
    );
    if (activeType && activeType.leaveTypeCode) {
      return codeToEnumMap[activeType.leaveTypeCode] || activeType.leaveTypeCode;
    }
    return leaveTypeInput;
  };

  // Submit leave request
  const submitLeaveRequest = async (e) => {
    e.preventDefault();
    if (!leaveForm.leaveType) {
      toast.error('Please select a leave type');
      return;
    }

    const requestedDays = calculateRequestedDuration(leaveForm.startDate, leaveForm.endDate, leaveForm.halfDayType);
    const selectedType = leaveTypeOptions.find(lt => (lt.leaveTypeName === leaveForm.leaveType || lt.leaveType === leaveForm.leaveType));
    const leaveTypeCode = selectedType?.leaveTypeCode || leaveForm.leaveType;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(leaveForm.startDate);
    if (start < today) {
      toast.error('Cannot request leave for past dates.');
      return;
    }

    const available = getAvailableBalance(leaveTypeCode);
    if (requestedDays > available) {
      toast.error(`Insufficient balance. You are requesting ${requestedDays} days, but only ${available} days are available.`);
      return;
    }

    try {
      const leaveTypeEnum = mapLeaveTypeCodeToEnum(leaveForm.leaveType);
      const isHalfDay = leaveForm.halfDayType && leaveForm.halfDayType !== 'FULL_DAY';
      const requestData = {
        leaveType: leaveTypeEnum,
        startDate: leaveForm.startDate,
        endDate: isHalfDay ? leaveForm.startDate : (leaveForm.endDate || leaveForm.startDate),
        reason: leaveForm.reason,
        halfDayType: isHalfDay ? leaveForm.halfDayType : null
      };

      setLeaveLoading(true);
      await createLeaveRequest(requestData);
      toast.success('Leave request submitted successfully!');
      setShowLeaveModal(false);
      setLeaveForm({ leaveType: '', startDate: '', endDate: '', reason: '', halfDayType: null });
      fetchLeaveData();
    } catch (error) {
      console.error('Error submitting leave request:', error);
      toast.error(error.response?.data?.message || 'Failed to submit leave request');
    } finally {
      setLeaveLoading(false);
    }
  };

  const weekDays = getWeekDays();

  // Render Leave Balance Card
  const renderLeaveBalanceCard = (title, data, color) => {
    const percentage = calculatePercentage(data.available, data.annual);
    const circumference = 2 * Math.PI * 70;
    const strokeDashoffset = isNaN(percentage) ? circumference : circumference - (percentage / 100) * circumference;

    return (
      <div className="hr-leave-card" key={data.code || title}>
        <div className="hr-leave-card-header">
          <h3>{title}</h3>
          <a 
            href="#leave-history-section" 
            className="hr-view-details"
            onClick={(e) => {
              setHistoryLeaveTypeFilter(data.code || title);
            }}
          >View details</a>
        </div>

        <div className="hr-leave-chart-container">
          <svg className="hr-leave-chart" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="70" fill="none" stroke="#e5e7eb" strokeWidth="12" />
            <circle
              cx="80" cy="80" r="70" fill="none" stroke={color} strokeWidth="12"
              strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 80 80)" style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div className="hr-leave-chart-center">
            <span className="hr-leave-days">{data.available} Days</span>
            <span className="hr-leave-label">Available</span>
          </div>
        </div>

        <div className="hr-leave-stats">
          <div className="hr-leave-stat">
            <span className="hr-stat-label">AVAILABLE</span>
            <span className="hr-stat-value">{data.available} days</span>
          </div>
          <div className="hr-leave-stat">
            <span className="hr-stat-label">CONSUMED</span>
            <span className="hr-stat-value">{data.consumed} day</span>
          </div>
        </div>

        <div className="hr-leave-quota">
          <span className="hr-stat-label">ANNUAL QUOTA</span>
          <span className="hr-stat-value">{data.annual} days</span>
        </div>
      </div>
    );
  };

  // Handle leave approval/rejection
  const handleLeaveAction = async (leaveId, action) => {
    try {
      const status = (action || '').toUpperCase();

      // Determine the best name and role label
      // Prioritize Admin role over HR for labeling
      const roleLabel = isAdmin ? 'Admin' : 'HR';

      const approverName = isAdmin
        ? (adminUser?.firstName && adminUser?.lastName
          ? `${adminUser.firstName} ${adminUser.lastName}`
          : adminUser?.fullName || adminUser?.name ||
          (user?.firstName && user?.lastName
            ? `${user.firstName} ${user.lastName}`
            : user?.fullName || user?.name || 'Admin'))
        : (user?.firstName && user?.lastName
          ? `${user.firstName} ${user.lastName}`
          : user?.fullName || user?.name || user?.employeeId || 'HR Employee');

      // 1. Admin flow - FULL access, labeled as (Admin)
      if (isAdmin) {
        let responseMsg = `${status} by ${approverName} (Admin)`;

        if (status === 'REJECTED') {
          const reason = window.prompt('Please provide a reason for rejection:');
          if (!reason || reason.trim() === '') return;
          responseMsg = `${status} by ${approverName} (Admin): ${reason}`;
        }

        await respondToLeaveRequest(leaveId, {
          status: status,
          response: responseMsg
        });

        // Always refresh both if possible, or decide based on view
        if (hrDataView === 'team-data') fetchTeamLeaveData();
        fetchLeaveData();
      }
      // 2. HR Portal flow - Restricted access, labeled as (HR)
      else if (isHR && hrDataView === 'team-data') {
        const leaveRequest = allLeaveRequests.find(l => l.id === leaveId || String(l.id) === String(leaveId)) ||
          pendingRequests.find(l => l.id === leaveId || String(l.id) === String(leaveId)) ||
          acceptedLeaveRequests.find(l => l.id === leaveId || String(l.id) === String(leaveId)) ||
          rejectedLeaveRequests.find(l => l.id === leaveId || String(l.id) === String(leaveId));

        if (!leaveRequest) {
          toast.error('Leave request not found');
          return;
        }

        // Restrictions for HR: Cannot approve self or other HR
        const requestEmployeeId = leaveRequest.employeeId || leaveRequest.employee?.employeeId;
        const currentEmployeeId = user?.employeeId || currentUser?.employeeId;
        const isOwnLeave = requestEmployeeId && currentEmployeeId && (String(requestEmployeeId).toLowerCase() === String(currentEmployeeId).toLowerCase());
        const isHREmployeeLeave = isEmployeeHR(leaveRequest);

        if (isOwnLeave || isHREmployeeLeave) {
          toast.error('HR leave requests must be approved by Admin role users.');
          return;
        }

        let responseMsg = `${status} by ${approverName} (HR)`;
        if (status === 'REJECTED') {
          const reason = window.prompt('Please provide a reason for rejection:');
          if (!reason || reason.trim() === '') return;
          responseMsg = `${status} by ${approverName} (HR): ${reason}`;
        }

        await respondToLeaveRequest(leaveId, { status: status, response: responseMsg });
        fetchTeamLeaveData();
      }
      // 3. Fallback/Standard flow
      else {
        let responseMsg = `${status} by ${approverName}${roleLabel ? ` (${roleLabel})` : ''}`;
        if (status === 'REJECTED') {
          const reason = window.prompt('Please provide a reason for rejection:');
          if (!reason || reason.trim() === '') return;
          responseMsg = `${status} by ${approverName}${roleLabel ? ` (${roleLabel})` : ''}: ${reason}`;
        }

        await respondToLeaveRequest(leaveId, { status: status, response: responseMsg });
        fetchLeaveData();
      }
      toast.success(`Leave request ${action.toLowerCase()} successfully`);
    } catch (error) {
      console.error(`Error ${action.toLowerCase()} leave:`, error);
      // Extract error message from different possible response structures
      const errorMessage = error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        `Failed to ${action.toLowerCase()} leave request`;
      toast.error(errorMessage);
    }
  };

  // Render Leave Tab Content
  const renderLeaveContent = () => {
    // Admin or HR team-data: Show org-wide leave management
    if (isAdmin || (isHR && hrDataView === 'team-data')) {
      const getCurrentLeaveList = () => {
        switch (activeLeaveSubTab) {
          case 'pending':
            return pendingRequests;
          case 'approved':
            return acceptedLeaveRequests;
          case 'rejected':
            return rejectedLeaveRequests;
          case 'all':
            return allLeaveRequests;
          default:
            return pendingRequests;
        }
      };

      // Filter out HR own leaves if viewing as HR
      const currentLeavesList = filterHROwnLeaves(getCurrentLeaveList());

      // Extract unique leave types for the filter dropdown
      const uniqueLeaveTypes = [...new Set(currentLeavesList.map(req => req.leaveType || req.leaveTypeName).filter(Boolean))];

      // Apply Admin/HR filters
      const currentLeaves = currentLeavesList.filter(request => {
        const empName = (request.employeeName || (request.employee?.firstName + ' ' + request.employee?.lastName) || '').toLowerCase();
        const empId = String(request.employeeId || request.employee?.employeeId || '').toLowerCase();
        const searchTerm = adminSearchQuery.toLowerCase().trim().replace(/\s+/g, ' ');
        const leaveStatus = (request.status || '').toUpperCase();
        const lType = request.leaveType || request.leaveTypeName || '';
        
        const matchesSearch = !searchTerm || empName.replace(/\s+/g, ' ').includes(searchTerm) || empId.includes(searchTerm);
        const matchesStatus = adminStatusFilter === 'ALL' || leaveStatus === adminStatusFilter;
        const matchesType = adminLeaveTypeFilter === 'ALL' || lType === adminLeaveTypeFilter;
        
        return matchesSearch && matchesStatus && matchesType;
      });

      return (
        <>
          {/* Admin Leaves Filter Bar */}
          <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center', background: '#f9fafb', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <input
                type="text"
                placeholder="Search by employee name or ID..."
                value={adminSearchQuery}
                onChange={(e) => setAdminSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontSize: '14px'
                }}
              />
            </div>
            <select
              value={adminLeaveTypeFilter}
              onChange={(e) => setAdminLeaveTypeFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                fontSize: '14px',
                minWidth: '150px'
              }}
            >
              <option value="ALL">All Leave Types</option>
              {uniqueLeaveTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <select
              value={adminStatusFilter}
              onChange={(e) => setAdminStatusFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                fontSize: '14px',
                minWidth: '150px'
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            {isAdmin && (
              <button
                onClick={() => setShowImportModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  whiteSpace: 'nowrap'
                }}
                onMouseOver={(e) => e.target.style.background = '#059669'}
                onMouseOut={(e) => e.target.style.background = '#10b981'}
              >
                <Upload size={16} />
                Import History
              </button>
            )}
          </div>

          {/* Admin Leave Sub Navigation */}
          <div className="hr-sub-tabs">
            <button
              className={`hr-sub-tab ${activeLeaveSubTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveLeaveSubTab('pending')}
            >
              Pending
              {pendingRequests.length > 0 && (
                <span style={{ marginLeft: '8px', background: 'var(--error-light)', color: 'var(--error)', padding: '2px 6px', borderRadius: '10px', fontSize: '10px' }}>
                  {pendingRequests.length}
                </span>
              )}
            </button>
            <button
              className={`hr-sub-tab ${activeLeaveSubTab === 'approved' ? 'active' : ''}`}
              onClick={() => setActiveLeaveSubTab('approved')}
            >
              Approved
            </button>
            <button
              className={`hr-sub-tab ${activeLeaveSubTab === 'rejected' ? 'active' : ''}`}
              onClick={() => setActiveLeaveSubTab('rejected')}
            >
              Rejected
            </button>
            <button
              className={`hr-sub-tab ${activeLeaveSubTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveLeaveSubTab('all')}
            >
              All Requests
            </button>
          </div>

          {/* Admin Leave Requests Table */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                {activeLeaveSubTab === 'pending' && 'Pending Leave Requests'}
                {activeLeaveSubTab === 'approved' && 'Approved Leave Requests'}
                {activeLeaveSubTab === 'rejected' && 'Rejected Leave Requests'}
                {activeLeaveSubTab === 'all' && 'All Leave Requests'}
              </h3>
            </div>
            <div className="employee-table-container">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Loader2 className="animate-spin" size={32} />
                  <p>Loading leave requests...</p>
                </div>
              ) : currentLeaves.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Calendar size={48} style={{ color: 'var(--gray-400)', marginBottom: '16px' }} />
                  <p>No {activeLeaveSubTab} leave requests found</p>
                </div>
              ) : (
                <table className="employee-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Leave Type</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Duration</th>
                      <th>Reason</th>
                      <th>Response</th>
                      <th>Status</th>
                      <th>Applied On</th>
                      <th>Approved By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentLeaves.map((request, idx) => (
                      <tr key={request.id || `current-leave-${idx}`}>
                        <td>
                          <div className="employee-cell">
                            <img
                              src={`https://ui-avatars.com/api/?name=${request.employeeName || (request.employee?.firstName + ' ' + request.employee?.lastName) || 'Employee'}&background=6366f1&color=fff`}
                              className="employee-avatar"
                              alt=""
                            />
                            <div>
                              <div style={{ fontWeight: 500 }}>
                                {request.employeeName || (request.employee?.firstName + ' ' + request.employee?.lastName) || 'N/A'}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                                {request.employeeId || request.employee?.employeeId || ''}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>{request.leaveType || request.leaveTypeName || 'N/A'}</td>
                        <td>{request.startDate ? (typeof request.startDate === 'string' ? request.startDate : new Date(request.startDate).toLocaleDateString()) : 'N/A'}</td>
                        <td>{request.endDate ? (typeof request.endDate === 'string' ? request.endDate : new Date(request.endDate).toLocaleDateString()) : 'N/A'}</td>
                        <td>{request.totalDays || request.duration || 'N/A'} {request.totalDays === 1 ? 'day' : 'days'}</td>
                        <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {request.reason || '-'}
                        </td>
                        <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {request.response || request.adminResponse || request.managerResponse || '-'}
                        </td>
                        <td>
                          <span className={`status-badge ${request.status === 'APPROVED' ? 'approved' :
                            request.status === 'REJECTED' ? 'rejected' :
                              request.status === 'PENDING' ? 'pending' : 'pending'
                            }`}>
                            {request.status || 'PENDING'}
                          </span>
                        </td>
                        <td>{request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '-'}</td>
                        <td>
                          {(() => {
                            // Only show approver for APPROVED or REJECTED requests
                            // Don't show managerName for PENDING requests (managerName is the assigned manager, not approver)
                            const status = request.status || request.leaveStatus || '';
                            const normalizedStatus = status ? String(status).trim().toUpperCase() : '';
                            const isApprovedOrRejected = normalizedStatus === 'APPROVED' || normalizedStatus === 'REJECTED';

                            if (!isApprovedOrRejected) {
                              return <span style={{ color: 'var(--gray-400)' }}>-</span>;
                            }

                            // For approved/rejected requests, show admin name (final approver) if available
                            // Otherwise show manager name (initial approver) only if there's a response
                            const approverName = request.adminName || request.managerName || request.approvedByName;
                            const approvalDate = request.adminResponseDate || request.managerResponseDate || request.createdAt;

                            if (approverName && approvalDate) {
                              return (
                                <div style={{ fontSize: '12px' }}>
                                  <div style={{ fontWeight: 500 }}>{approverName}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginTop: '2px' }}>
                                    {new Date(approvalDate).toLocaleDateString()}
                                  </div>
                                </div>
                              );
                            }
                            return <span style={{ color: 'var(--gray-400)' }}>-</span>;
                          })()}
                        </td>
                        <td>
                          <div className="action-icons" style={{ display: 'flex', gap: '8px' }}>
                            <span
                              className="action-icon"
                              title="View Details"
                              style={{ color: 'var(--gray-500)', cursor: 'pointer' }}
                              onClick={() => handleViewLeaveDetail(request)}
                            >
                              <Eye size={16} />
                            </span>

                            {activeLeaveSubTab === 'pending' && (() => {
                              // Check if this is HR employee's own leave request
                              const isOwnLeave = request.employeeId === user?.employeeId || isEmployeeHR(request);
                              // Only show actions if it's not HR employee's own leave
                              if (isHR && hrDataView === 'team-data' && isOwnLeave) {
                                return (
                                  <span style={{ color: 'var(--gray-400)', fontSize: '12px' }}>
                                    Admin Only
                                  </span>
                                );
                              }
                              return (
                                <>
                                  <span
                                    className="action-icon"
                                    title="Approve"
                                    style={{ color: 'var(--success)', cursor: 'pointer' }}
                                    onClick={() => handleLeaveAction(request.id, 'APPROVED')}
                                  >
                                    <CheckCircle size={16} />
                                  </span>
                                  <span
                                    className="action-icon"
                                    title="Reject"
                                    style={{ color: 'var(--error)', cursor: 'pointer' }}
                                    onClick={() => handleLeaveAction(request.id, 'REJECTED')}
                                  >
                                    <XCircle size={16} />
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      );
    }

    // Employee Leave View (existing code)
    return (
      <>
        {/* Leave Sub Navigation */}
        <div className="hr-sub-tabs">
          <button
            className={`hr-sub-tab ${activeLeaveSubTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveLeaveSubTab('summary')}
          >
            Summary
          </button>
        </div>

        {/* Page Header with Date Range */}
        <div className="hr-leave-header">
          <h2 className="hr-section-title">Pending leave requests</h2>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="hr-year-select"
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              backgroundColor: 'white',
              fontSize: '14px',
              fontWeight: 600,
              color: '#1e293b',
              cursor: 'pointer',
              outline: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
              backgroundSize: '16px',
              paddingRight: '36px'
            }}
          >
            {[2024, 2025, 2026, 2027].map(year => (
              <option key={year} value={year}>Year {year}</option>
            ))}
          </select>
        </div>

        {/* Pending Requests Section */}
        <div className="hr-pending-section">
          <div className="hr-pending-content">
            {pendingRequests.length === 0 ? (
              <div className="hr-no-pending">
                <div className="hr-celebration-icon">
                  <PartyPopper size={32} />
                </div>
                <div className="hr-no-pending-text">
                  <h3>Hurray! No pending leave requests</h3>
                  <p>Request leave on the right!</p>
                </div>
              </div>
            ) : (
              <div className="hr-pending-list">
                {pendingRequests.map((request, idx) => (
                  <div key={request.id || `leave-request-${idx}`} className="hr-pending-item">
                    <span>{typeof request.leaveType === 'object' ? (request.leaveType.name || request.leaveType.leaveTypeName || request.leaveType.code || 'N/A') : (request.leaveType || 'N/A')}</span>
                    <span>{request.startDate} - {request.endDate}</span>
                    <span className="hr-status-badge pending">Pending</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hr-request-actions">
            <button className="hr-request-leave-btn" onClick={handleRequestLeave}>
              Request Leave
            </button>
            <a href="#" className="hr-policy-link">Leave Policy Explanation</a>
          </div>
        </div>

        {/* My Leave Stats */}
        <div className="hr-stats-section">
          <h2 className="hr-section-title">My Leave Stats</h2>

          <div className="hr-stats-grid">
            {/* Weekly Pattern - Real Data */}
            <div className="hr-stat-card">
              <div className="hr-stat-card-header">
                <h3>Weekly Pattern</h3>
                <Info size={16} />
              </div>
              <div className="hr-weekly-chart">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
                  // Count leaves on this day of week in the current year
                  const currentYear = new Date().getFullYear();
                  const approvedLeaves = leaveHistory.filter(l => (l.status || '').toUpperCase() === 'APPROVED');
                  const count = approvedLeaves.filter(l => {
                    const start = new Date(l.startDate);
                    const end = new Date(l.endDate);
                    const yearMatch = start.getFullYear() === currentYear;
                    if (!yearMatch) return false;
                    
                    // Simple check: does the leave overlap with this day type?
                    // This is an approximation for the chart
                    const dayIdx = (idx + 1) % 7; // Monday is 1 in JS Date, but idx 0 here
                    let dayMatch = false;
                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                      if (d.getDay() === dayIdx) {
                        dayMatch = true;
                        break;
                      }
                    }
                    return dayMatch;
                  }).length;

                  return (
                    <div key={day} className="hr-day-bar">
                      <div
                        className={`hr-bar ${idx < 5 ? 'weekday' : 'weekend'}`}
                        style={{ height: `${Math.min(100, 20 + count * 20)}px`, opacity: count > 0 ? 1 : 0.4 }}
                        title={`${count} leave occurrences`}
                      ></div>
                      <span className="hr-day-label">{day}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Consumed Leave Types - Real Data */}
            <div className="hr-stat-card">
              <div className="hr-stat-card-header">
                <h3>Consumed Leave Types</h3>
                <Info size={16} />
              </div>
              {(() => {
                const codes = Object.keys(leaveBalancesByCode);
                const hasConsumed = codes.some(c => leaveBalancesByCode[c].consumed > 0);
                if (!hasConsumed) {
                  return (
                    <div className="hr-no-data" style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <p style={{ fontSize: '12px', color: '#94a3b8' }}>No leave consumed yet.</p>
                    </div>
                  );
                }
                const colors = ['#84cc16', '#8b5cf6', '#6366f1', '#f59e0b', '#ef4444', '#10b981'];
                return (
                  <div style={{ padding: '0 5px' }}>
                    {codes.map((code, i) => {
                      const b = leaveBalancesByCode[code];
                      if (b.consumed <= 0) return null;
                      const pct = b.annual > 0 ? (b.consumed / b.annual) * 100 : 0;
                      return (
                        <div key={code} style={{ marginBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600 }}>{b.name}</span>
                            <span style={{ color: '#64748b' }}>{b.consumed} / {b.annual} days</span>
                          </div>
                          <div style={{ height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', backgroundColor: colors[i % colors.length], borderRadius: '3px', transition: 'width 0.5s ease' }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Monthly Stats - Real Data */}
            <div className="hr-stat-card">
              <div className="hr-stat-card-header">
                <h3>Monthly Stats</h3>
                <Info size={16} />
              </div>
              <div className="hr-monthly-chart" style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '100px', padding: '10px 0' }}>
                {(() => {
                  const currentYear = new Date().getFullYear();
                  const monthlyCounts = new Array(12).fill(0);
                  const approvedLeaves = leaveHistory.filter(l => (l.status || '').toUpperCase() === 'APPROVED');
                  approvedLeaves.forEach(l => {
                    if (!l.startDate) return;
                    const d = new Date(l.startDate);
                    if (d.getFullYear() === currentYear) {
                      monthlyCounts[d.getMonth()] += (l.totalDays || l.days || 1);
                    }
                  });
                  const maxMonth = Math.max(...monthlyCounts, 1);
                  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, idx) => (
                    <div key={month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div
                        style={{
                          width: '100%',
                          height: `${Math.max(4, (monthlyCounts[idx] / maxMonth) * 60)}px`,
                          backgroundColor: monthlyCounts[idx] > 0 ? '#6366f1' : '#f1f5f9',
                          borderRadius: '2px 2px 0 0',
                          transition: 'height 0.3s ease'
                        }}
                        title={`${monthlyCounts[idx]} days`}
                      ></div>
                      <span style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>{month}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Leave Balances — dynamic from all configured leave types */}
        {hrDataView !== 'team-data' && (
          <div className="hr-balances-section">
            <div className="hr-balances-grid">
              {(() => {
                const codes = Object.keys(leaveBalancesByCode);
                const colorPalette = ['#84cc16', '#8b5cf6', '#6366f1', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#14b8a6'];
                if (codes.length === 0) {
                  return <p style={{ color: '#6b7280', fontSize: '13px' }}>No leave types configured. Contact admin.</p>;
                }
                return codes.map((code, i) => {
                  const b = leaveBalancesByCode[code];
                  return renderLeaveBalanceCard(b.name, b, colorPalette[i % colorPalette.length]);
                });
              })()}
            </div>
          </div>
        )}

        {/* Leave History */}
        <div className="hr-history-section" id="leave-history-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 className="hr-section-title" style={{ margin: 0 }}>Leave History</h2>
            {historyLeaveTypeFilter !== 'ALL' && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                padding: '6px 14px', 
                backgroundColor: '#f5f7ff', 
                borderRadius: '50px',
                border: '1px solid #e0e7ff',
                boxShadow: '0 2px 5px rgba(99, 102, 241, 0.08)'
              }}>
                <Filter size={14} style={{ color: '#6366f1' }} />
                <span style={{ 
                  fontSize: '13px', 
                  color: '#1e1b4b', 
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  Filtered by: <span style={{ color: '#6366f1', backgroundColor: '#e0e7ff', padding: '1px 8px', borderRadius: '4px' }}>{historyLeaveTypeFilter}</span>
                </span>
                <div style={{ width: '1px', height: '16px', backgroundColor: '#e0e7ff', margin: '0 4px' }}></div>
                <button 
                  onClick={() => setHistoryLeaveTypeFilter('ALL')}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
                  style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px', 
                    color: '#64748b', 
                    background: 'none', 
                    border: 'none', 
                    cursor: 'pointer', 
                    padding: '3px 8px',
                    borderRadius: '50px',
                    transition: 'all 0.2s ease',
                    fontWeight: 500
                  }}
                >
                  <X size={14} />
                  Clear
                </button>
              </div>
            )}
          </div>

          {leaveHistory.length === 0 ? (
            <div className="hr-empty-history">
              <Calendar size={48} />
              <p>No leave history found.</p>
            </div>
          ) : (
            <div className="hr-history-table-container">
              <table className="hr-history-table">
                <thead>
                  <tr>
                    {/* Only show Employee column in Team Data view or Admin view */}
                    {(isAdmin || (isHR && hrDataView === 'team-data')) && <th>Employee</th>}
                    <th>Leave Type</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Days</th>
                    <th>Status</th>
                    <th>Reason</th>
                    <th>Response</th>
                    <th>Approved By</th>
                    {(isHR && hrDataView === 'team-data') && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filterHROwnLeaves(leaveHistory).filter(leave => {
                    // Filter by year
                    const startDate = leave.startDate ? new Date(leave.startDate) : null;
                    if (startDate && startDate.getFullYear() !== selectedYear) return false;

                    if (historyLeaveTypeFilter === 'ALL') return true;
                    const filter = historyLeaveTypeFilter.toUpperCase();
                    const lType = String(leave.leaveType || leave.leaveTypeName || '').toUpperCase();
                    const lCode = String(leave.leaveTypeCode || '').toUpperCase();
                    return lType.includes(filter) || filter.includes(lType) || lCode === filter;
                  }).map((leave, idx) => (
                    <tr key={leave.id || idx}>
                      {/* Only show Employee column in Team Data view or Admin view */}
                      {(isAdmin || (isHR && hrDataView === 'team-data')) && (
                        <td>
                          <div className="employee-cell">
                            <img
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(leave.employeeName || leave.employee?.firstName + ' ' + leave.employee?.lastName || 'Employee')}&background=6366f1&color=fff`}
                              className="employee-avatar"
                              alt=""
                              style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                            />
                            <div>
                              <div style={{ fontWeight: 500, fontSize: '13px' }}>
                                {leave.employeeName || (leave.employee?.firstName && leave.employee?.lastName ? `${leave.employee.firstName} ${leave.employee.lastName}` : 'N/A')}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                                {leave.employeeId || leave.employee?.employeeId || ''}
                              </div>
                            </div>
                          </div>
                        </td>
                      )}
                      <td>{typeof leave.leaveType === 'object' ? (leave.leaveType.name || leave.leaveType.leaveTypeName || leave.leaveType.code || 'N/A') : (leave.leaveType || leave.leaveTypeName || 'N/A')}</td>
                      <td>{leave.startDate ? (typeof leave.startDate === 'string' ? leave.startDate : new Date(leave.startDate).toLocaleDateString()) : 'N/A'}</td>
                      <td>{leave.endDate ? (typeof leave.endDate === 'string' ? leave.endDate : new Date(leave.endDate).toLocaleDateString()) : 'N/A'}</td>
                      <td>{leave.days || leave.totalDays || 1}</td>
                      <td>
                        <span className={`hr-status-badge ${leave.status?.toLowerCase()}`}>
                          {leave.status}
                        </span>
                      </td>
                      <td>{leave.reason || '-'}</td>
                      <td>{leave.response || leave.adminResponse || leave.managerResponse || '-'}</td>
                      <td>
                        {(() => {
                          // Only show approver for APPROVED or REJECTED requests
                          // Don't show managerName for PENDING requests (managerName is the assigned manager, not approver)
                          const status = leave.status || leave.leaveStatus || '';
                          const normalizedStatus = status ? String(status).trim().toUpperCase() : '';
                          const isApprovedOrRejected = normalizedStatus === 'APPROVED' || normalizedStatus === 'REJECTED';

                          if (!isApprovedOrRejected) {
                            return <span style={{ color: 'var(--gray-400)', fontSize: '12px' }}>-</span>;
                          }

                          // For approved/rejected requests, show admin name (final approver) if available
                          // Otherwise show manager name (initial approver) only if there's a response
                          const hasResponse = leave.adminResponse || leave.managerResponse || leave.approvedByName;
                          const approverName = leave.adminName || leave.managerName || leave.approvedByName;
                          const approvalDate = leave.adminResponseDate || leave.managerResponseDate || leave.createdAt;

                          if (approverName && approvalDate) {
                            return (
                              <div style={{ fontSize: '12px' }}>
                                <div style={{ fontWeight: 500 }}>{approverName}</div>
                                <div style={{ color: 'var(--gray-500)', fontSize: '11px' }}>
                                  {new Date(approvalDate).toLocaleDateString()}
                                </div>
                              </div>
                            );
                          }
                          return <span style={{ color: 'var(--gray-400)', fontSize: '12px' }}>-</span>;
                        })()}
                      </td>
                      {isHR && hrDataView === 'team-data' && (() => {
                        // Check if this is HR employee's own leave request
                        const isOwnLeave = leave.employeeId === user?.employeeId || isEmployeeHR(leave);

                        // Only show actions if it's not HR employee's own leave
                        if (isOwnLeave) {
                          return (
                            <td>
                              <span style={{ color: 'var(--gray-400)', fontSize: '12px' }}>
                                Admin Only
                              </span>
                            </td>
                          );
                        }

                        return (
                          <td>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {leave.status === 'PENDING' || leave.status === 'SUBMITTED' ? (
                                <>
                                  <button
                                    className="action-icon"
                                    title="Approve"
                                    onClick={() => handleLeaveAction(leave.id, 'approve')}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', padding: '4px' }}
                                  >
                                    <CheckCircle size={14} />
                                  </button>
                                  <button
                                    className="action-icon"
                                    title="Reject"
                                    onClick={() => handleLeaveAction(leave.id, 'reject')}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
                                  >
                                    <XCircle size={14} />
                                  </button>
                                </>
                              ) : (
                                <button
                                  className="action-icon"
                                  title="View Details"
                                  onClick={() => handleViewLeave(leave)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-500)', padding: '4px' }}
                                >
                                  <Eye size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })()}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  };

  const getProjectStatusBadgeClass = (statusKey) => {
    if (statusKey === 'completed') return 'status-badge approved';
    if (statusKey === 'on-hold') return 'status-badge rejected';
    return 'status-badge on-time';
  };

  // Render Projects Allocated content
  const renderProjectsAllocated = () => {
    const hasFilters = Boolean(projectStatus || searchQuery.trim());
    const totalFiltered = filteredAssignedProjects.length;
    const totalAll = assignedProjects.length;

    return (
      <div className="card" style={{ margin: 0 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '10px 16px', minHeight: 'auto' }}>
          <h3 className="card-title" style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Projects Allocated</h3>
          <div className="hr-projects-filters" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Project Status */}
            <div className="hr-select-input" style={{ width: 'auto' }}>
              <select
                value={projectStatus}
                onChange={(e) => setProjectStatus(e.target.value)}
                style={{ minHeight: '30px', height: '30px', padding: '4px 24px 4px 10px', fontSize: '12px' }}
              >
                <option value="">Status: All</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="on-hold">On Hold</option>
              </select>
              <ChevronDown size={14} aria-hidden style={{ right: '8px' }} />
            </div>

            {/* Search */}
            <div className="hr-search-input" style={{ width: 'auto' }}>
              <Search size={14} aria-hidden style={{ left: '10px' }} />
              <input
                type="search"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search allocated projects"
                style={{ minHeight: '30px', height: '30px', padding: '4px 10px 4px 28px', fontSize: '12px', width: '180px' }}
              />
            </div>

            {hasFilters && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '11px', padding: '4px 10px', minHeight: '30px', height: '30px' }}
                onClick={() => {
                  setProjectStatus('');
                  setSearchQuery('');
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="employee-table-container">
          {projectsLoading ? (
            <div className="to-loading-state" style={{ border: 'none', background: 'transparent', padding: '40px 20px' }}>
              <Loader2 className="animate-spin" size={32} />
              <p>Loading allocated projects...</p>
            </div>
          ) : totalAll === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--to-muted)' }}>
              <Clock size={48} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <h3 style={{ color: 'var(--to-text)', margin: '0 0 6px', fontSize: '15px', fontWeight: 700 }}>No projects allocated</h3>
              <p style={{ margin: 0, fontSize: '13px' }}>There are no projects allocated to you.</p>
            </div>
          ) : totalFiltered === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--to-muted)' }}>
              <Search size={48} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <h3 style={{ color: 'var(--to-text)', margin: '0 0 6px', fontSize: '15px', fontWeight: 700 }}>No match found</h3>
              <p style={{ margin: '0 0 12px', fontSize: '13px' }}>No projects match your filters.</p>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '12px' }}
                onClick={() => {
                  setProjectStatus('');
                  setSearchQuery('');
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <table className="employee-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: '20px' }}>PROJECT</th>
                  <th>PROJECT STATUS</th>
                  <th>PROJECT MANAGERS</th>
                  <th>PROJECT DURATION</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssignedProjects.map((project) => {
                  const isExpanded = Boolean(project.expanded);
                  return (
                    <Fragment key={project.id}>
                      <tr style={{ height: '36px' }}>
                        <td style={{ paddingLeft: '20px', fontWeight: 600, padding: '6px 14px' }}>
                          <button
                            type="button"
                            className="hr-expand-btn"
                            onClick={() => toggleProjectExpand(project.id)}
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? 'Collapse project' : 'Expand project'}
                            style={{ marginRight: '8px', border: 'none', background: 'transparent', cursor: 'pointer', verticalAlign: 'middle', color: 'var(--to-muted)', padding: 0 }}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                          <span style={{ verticalAlign: 'middle' }}>{project.name}</span>
                        </td>
                        <td style={{ padding: '6px 14px' }}>
                          <span className={getProjectStatusBadgeClass(project.statusKey)}>
                            {project.statusLabel || 'In Progress'}
                          </span>
                        </td>
                        <td style={{ padding: '6px 14px' }}>
                          {project.managers && project.managers.length > 0 ? (
                            project.managers.map((manager, idx) => (
                              <span key={`manager-${project.id}-${idx}`}>
                                {idx === 0 ? (
                                  <a href="#" className="hr-manager-link" style={{ color: 'var(--primary-500)', textDecoration: 'none', fontWeight: 600 }}>{manager}</a>
                                ) : (
                                  <span className="hr-manager-more" style={{ marginLeft: '6px', color: 'var(--to-muted)' }}>, {manager}</span>
                                )}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: '#9ca3af' }}>N/A</span>
                          )}
                        </td>
                        <td style={{ padding: '6px 14px' }}>
                          {project.tasks && project.tasks.length > 0 ? (
                            `${project.tasks[0].startDate ? new Date(project.tasks[0].startDate).toLocaleDateString() : 'N/A'} - ${project.tasks[0].endDate ? new Date(project.tasks[0].endDate).toLocaleDateString() : 'N/A'}`
                          ) : (
                            'N/A'
                          )}
                        </td>
                      </tr>
                      {isExpanded && project.tasks && project.tasks.length > 0 && (
                        <tr>
                          <td colSpan={4} style={{ padding: '8px 20px 10px 48px', backgroundColor: 'var(--gray-5, #f8fafc)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '2px solid var(--primary-200, #e9d5ff)', paddingLeft: '12px' }}>
                              {project.tasks.map((task, idx) => (
                                <div key={task.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '2px 0' }}>
                                  <span style={{ fontWeight: 500, color: 'var(--to-text, #1f2937)' }}>{task.name}</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <span className={`status-badge ${task.status === 'COMPLETED' ? 'approved' : 'on-time'}`} style={{ fontSize: '10px', padding: '1px 6px' }}>
                                      {task.status || 'Active'}
                                    </span>
                                    <span style={{ color: 'var(--to-muted, #6b7280)', fontSize: '11px' }}>
                                      {task.startDate ? new Date(task.startDate).toLocaleDateString() : '-'} to {task.endDate ? new Date(task.endDate).toLocaleDateString() : '-'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="hr-pagination" style={{ borderTop: '1px solid var(--to-border)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="hr-pagination-info" style={{ fontSize: '13px', color: 'var(--to-muted)' }}>
            {totalFiltered === 0
              ? 'Showing 0 projects'
              : `Showing ${totalFiltered} of ${totalAll} project${totalAll === 1 ? '' : 's'}`}
            {hasFilters ? ' (filtered)' : ''}
          </span>
          <div className="hr-pagination-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button type="button" className="hr-page-btn" disabled aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', border: '1px solid var(--to-border)', background: 'var(--to-surface)', color: 'var(--to-muted)', cursor: 'not-allowed' }}>
              <ChevronLeft size={16} />
            </button>
            <span className="hr-page-indicator" style={{ fontSize: '13px', color: 'var(--to-text)' }}>Page 1 of 1</span>
            <button type="button" className="hr-page-btn" disabled aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', border: '1px solid var(--to-border)', background: 'var(--to-surface)', color: 'var(--to-muted)', cursor: 'not-allowed' }}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render Admin Timesheets content
  // Render team timesheets with review/action capabilities
  const renderTeamTimesheets = () => {
    const timesheetsToShow = (teamTimesheets.length > 0 ? teamTimesheets : adminTimesheets).filter(ts => (ts.status || '').toUpperCase() !== 'DRAFT');
    return (
      <div className="to-ts-panel">
        {/* Page Header */}
        <div className="hr-page-header">
          <h1 className="hr-page-title">My Team Timesheets</h1>
          <div className="hr-page-actions">
            <div className="hr-view-toggle">
              <button
                className={`hr-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                <List size={18} />
              </button>
              <button
                className={`hr-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="hr-week-nav">
          <div className="hr-week-selector">
            <button className="hr-nav-arrow" onClick={() => navigateWeek('prev')}>
              <ChevronLeft size={18} />
            </button>
            <span className="hr-week-range">{formatWeekRange()}</span>
            <button className="hr-nav-arrow" onClick={() => navigateWeek('next')}>
              <ChevronRight size={18} />
            </button>
            <button className="hr-calendar-btn">
              <Calendar size={18} />
            </button>
          </div>
        </div>

        {/* Timesheets Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              {isHR && hrDataView === 'team-data'
                ? `My Team Timesheets - ${formatWeekRange()}`
                : `Employee Timesheets - ${formatWeekRange()}`
              }
            </h3>
          </div>
          <div className="employee-table-container">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Loader2 className="animate-spin" size={32} />
                <p>Loading timesheets...</p>
              </div>
            ) : timesheetsToShow.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Clock size={48} style={{ color: 'var(--gray-400)', marginBottom: '16px' }} />
                <p>No pending timesheets found for this week</p>
                <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '8px' }}>
                  All timesheets for this week have been processed.
                </p>
              </div>
            ) : (
              <table className="employee-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Employee ID</th>
                    <th>Department</th>
                    <th>Week Start</th>
                    <th>Total Hours</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Approved By</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {timesheetsToShow.map((timesheet, idx) => {
                    // Determine row background color based on status
                    const status = timesheet.status || 'DRAFT';
                    let rowBgColor = '#ffffff';
                    if (status === 'APPROVED') {
                      rowBgColor = '#ecfdf5'; // Light green for approved
                    } else if (status === 'SUBMITTED' || status === 'PENDING') {
                      rowBgColor = '#eff6ff'; // Light blue for submitted/pending
                    } else if (status === 'DRAFT') {
                      rowBgColor = '#f9fafb'; // Light grey for draft
                    } else if (status === 'REJECTED') {
                      rowBgColor = '#fef2f2'; // Light red for rejected
                    }

                    const timesheetKey = timesheet.id || `timesheet-${idx}`;
                    const isExpanded = timesheet.id ? expandedTimesheets.has(timesheet.id) : false;

                    return (
                      <Fragment key={timesheetKey}>
                        <tr style={{ backgroundColor: rowBgColor }}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {timesheet.id && (
                                <button
                                  className="hr-expand-btn"
                                  onClick={() => toggleTimesheetExpand(timesheet.id)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--gray-600)',
                                    transition: 'color 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.target.style.color = 'var(--primary-500)'}
                                  onMouseLeave={(e) => e.target.style.color = 'var(--gray-600)'}
                                  title={isExpanded ? 'Collapse entries' : 'Expand entries'}
                                >
                                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                              )}
                              <div className="employee-cell" style={{ flex: 1 }}>
                                <img
                                  src={`https://ui-avatars.com/api/?name=${timesheet.employeeName || (timesheet.employee?.firstName + ' ' + timesheet.employee?.lastName) || 'Employee'}&background=6366f1&color=fff`}
                                  className="employee-avatar"
                                  alt=""
                                />
                                <div>
                                  <div style={{ fontWeight: 500 }}>
                                    {timesheet.employeeName || (timesheet.employee?.firstName + ' ' + timesheet.employee?.lastName) || 'N/A'}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                                    {timesheet.employeeEmail || timesheet.employee?.email || ''}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>{timesheet.employeeIdString || timesheet.employee?.employeeId || timesheet.employee?.employeeIdString || timesheet.employeeId || 'N/A'}</td>
                          <td>{timesheet.department || timesheet.employee?.department?.name || 'N/A'}</td>
                          <td>{timesheet.weekStartDate || timesheet.weekStart || 'N/A'}</td>
                          <td style={{ fontFamily: 'monospace' }}>{formatHours(timesheet.totalHours || '0:00')}</td>
                          <td>
                            <span className={`status-badge ${timesheet.status === 'SUBMITTED' || timesheet.status === 'PENDING' ? 'pending' :
                              timesheet.status === 'APPROVED' ? 'approved' :
                                timesheet.status === 'REJECTED' ? 'rejected' : 'pending'
                              }`}>
                              {timesheet.status || 'DRAFT'}
                            </span>
                          </td>
                          <td>{timesheet.submittedAt ? new Date(timesheet.submittedAt).toLocaleDateString() : 'Not submitted'}</td>
                          <td>
                            {timesheet.approvedBy || timesheet.approvedByName || timesheet.managerName ? (
                              <div style={{ fontSize: '12px' }}>
                                <div style={{ fontWeight: 500 }}>
                                  {timesheet.approvedBy || timesheet.approvedByName || timesheet.managerName || 'N/A'}
                                </div>
                                {timesheet.approvedAt || timesheet.approvalDate ? (
                                  <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginTop: '2px' }}>
                                    {new Date(timesheet.approvedAt || timesheet.approvalDate).toLocaleDateString()}
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--gray-400)', fontSize: '12px' }}>-</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <button
                                className="action-icon"
                                title="View Details"
                                onClick={() => handleViewTimesheet(timesheet)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-500)' }}
                              >
                                <Eye size={14} />
                              </button>
                              {isHR && hrDataView === 'team-data' && (timesheet.status === 'SUBMITTED' || timesheet.status === 'PENDING') && (
                                <>
                                  <button
                                    className="action-icon"
                                    title="Approve"
                                    onClick={() => handleApproveTimesheet(timesheet)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981' }}
                                  >
                                    <CheckCircle size={14} />
                                  </button>
                                  <button
                                    className="action-icon"
                                    title="Reject"
                                    onClick={() => handleRejectTimesheet(timesheet)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                                  >
                                    <XCircle size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && timesheet.id && timesheet.entries && Array.isArray(timesheet.entries) && timesheet.entries.length > 0 && (
                          <tr key={`${timesheet.id}-expanded`}>
                            <td colSpan={9} style={{ padding: '0', backgroundColor: '#f9fafb', borderTop: 'none' }}>
                              <div style={{ padding: '20px', backgroundColor: '#ffffff', margin: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '15px', color: 'var(--gray-700)' }}>
                                  Timesheet Entries
                                </h4>
                                <div className="employee-table-container">
                                  <table className="employee-table" style={{ fontSize: '12px' }}>
                                    <thead>
                                      <tr>
                                        <th>Date</th>
                                        <th>Timeframe</th>
                                        <th>Project</th>
                                        <th>Task</th>
                                        <th>Description</th>
                                        <th style={{ padding: '8px 4px', textAlign: 'center', minWidth: '50px' }}>Hours</th>
                                        <th style={{ padding: '8px 4px', textAlign: 'center', minWidth: '70px' }}>Billable</th>
                                        <th>Work Type</th>
                                        <th>Status</th>
                                        <th>Approved/Rejected By</th>
                                        {isHR && hrDataView === 'team-data' && (
                                          <th>Actions</th>
                                        )}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(timesheet.entries || [])
                                        .sort((a, b) => {
                                          const dateA = new Date(a.workDate || a.work_date);
                                          const dateB = new Date(b.workDate || b.work_date);
                                          return dateA - dateB;
                                        })
                                        .map((entry, entryIdx) => {
                                          // Use the dedicated entry status field from backend
                                          const entryStatus = entry.status || 'DRAFT';
                                          const isApproved = entryStatus === 'APPROVED';
                                          const isRejected = entryStatus === 'REJECTED';
                                          const statusClass = isApproved ? 'approved' : isRejected ? 'rejected' : 'pending';

                                          // Determine if entry needs action (not approved and not rejected)
                                          const needsAction = !isApproved && !isRejected;

                                          // Get approval/rejection info
                                          // Try multiple ways to get the approved by name
                                          let approvedByName = null;
                                          if (entry.approvedByName) {
                                            approvedByName = entry.approvedByName;
                                          } else if (entry.approvedBy) {
                                            if (typeof entry.approvedBy === 'string') {
                                              approvedByName = entry.approvedBy;
                                            } else if (entry.approvedBy.firstName && entry.approvedBy.lastName) {
                                              approvedByName = `${entry.approvedBy.firstName} ${entry.approvedBy.lastName}`.trim();
                                            } else if (entry.approvedBy.name) {
                                              approvedByName = entry.approvedBy.name;
                                            }
                                          }
                                          // Only use entry-level approval info, do NOT inherit from timesheet

                                          let rejectedByName = null;
                                          if (entry.rejectedByName) {
                                            rejectedByName = entry.rejectedByName;
                                          } else if (entry.rejectedBy) {
                                            if (typeof entry.rejectedBy === 'string') {
                                              rejectedByName = entry.rejectedBy;
                                            } else if (entry.rejectedBy.firstName && entry.rejectedBy.lastName) {
                                              rejectedByName = `${entry.rejectedBy.firstName} ${entry.rejectedBy.lastName}`.trim();
                                            } else if (entry.rejectedBy.name) {
                                              rejectedByName = entry.rejectedBy.name;
                                            }
                                          }
                                          // Only use entry-level rejection info, do NOT inherit from timesheet

                                          const approvedAt = entry.approvedAt ? new Date(entry.approvedAt).toLocaleDateString() : null;
                                          const rejectedAt = entry.rejectedAt ? new Date(entry.rejectedAt).toLocaleDateString() : null;

                                          // Determine row background color based on status
                                          let entryRowBgColor = '#ffffff';
                                          if (isApproved) {
                                            entryRowBgColor = '#ecfdf5'; // Light green for approved
                                          } else if (isRejected) {
                                            entryRowBgColor = '#fef2f2'; // Light red for rejected
                                          } else if (needsAction) {
                                            entryRowBgColor = '#eff6ff'; // Light blue for pending
                                          }

                                          return (
                                            <tr key={entry.id || `entry-${timesheet.id || idx}-${entryIdx}`} style={{ backgroundColor: entryRowBgColor }}>
                                              <td>{new Date(entry.workDate || entry.work_date).toLocaleDateString()}</td>
                                              <td>{formatEntryTimeRange(entry) || '—'}</td>
                                              <td>{entry.projectName || entry.projectNameSnapshot || entry.project?.name || 'N/A'}</td>
                                              <td>{entry.taskName || entry.taskNameSnapshot || entry.task?.name || 'N/A'}</td>
                                              <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {entry.description || '-'}
                                              </td>
                                              <td style={{ fontFamily: 'monospace', textAlign: 'center', padding: '8px 2px' }}>{formatHours(entry.hours || '0')}</td>
                                              <td style={{ textAlign: 'center', padding: '8px 2px' }}>
                                                <span className={`status-badge ${(entry.billable || entry.isBillableSnapshot) ? 'approved' : 'pending'}`} style={{ padding: '2px 6px', fontSize: '10px' }}>
                                                  {(entry.billable || entry.isBillableSnapshot) ? 'Yes' : 'No'}
                                                </span>
                                              </td>
                                              <td>{entry.workType || 'WORK'}</td>
                                              <td>
                                                <span className={`status-badge ${statusClass}`}>
                                                  {entryStatus}
                                                </span>
                                              </td>
                                              <td>
                                                {approvedByName && approvedByName.trim() !== '' && approvedByName !== 'undefined undefined' ? (
                                                  <div style={{ fontSize: '12px' }}>
                                                    <div style={{ fontWeight: 500, color: '#10b981' }}>
                                                      Approved by: {approvedByName}
                                                    </div>
                                                    {approvedAt && (
                                                      <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginTop: '2px' }}>
                                                        {approvedAt}
                                                      </div>
                                                    )}
                                                  </div>
                                                ) : rejectedByName && rejectedByName.trim() !== '' && rejectedByName !== 'undefined undefined' ? (
                                                  <div style={{ fontSize: '12px' }}>
                                                    <div style={{ fontWeight: 500, color: '#ef4444' }}>
                                                      Rejected by: {rejectedByName}
                                                    </div>
                                                    {rejectedAt && (
                                                      <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginTop: '2px' }}>
                                                        {rejectedAt}
                                                      </div>
                                                    )}
                                                    {(entry.rejectionReason || timesheet.rejectionReason) && (
                                                      <div style={{ fontSize: '11px', color: 'var(--gray-600)', marginTop: '2px', fontStyle: 'italic' }}>
                                                        Reason: {entry.rejectionReason || timesheet.rejectionReason}
                                                      </div>
                                                    )}
                                                  </div>
                                                ) : (
                                                  <span style={{ color: 'var(--gray-400)', fontSize: '12px' }}>-</span>
                                                )}
                                              </td>
                                              {isHR && hrDataView === 'team-data' && (
                                                <td>
                                                  {needsAction ? (
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                      <button
                                                        className="action-icon"
                                                        title="Approve Entry"
                                                        onClick={() => handleApproveTimesheetEntry(timesheet, entry)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', padding: '4px' }}
                                                      >
                                                        <CheckCircle size={14} />
                                                      </button>
                                                      <button
                                                        className="action-icon"
                                                        title="Reject Entry"
                                                        onClick={() => handleRejectTimesheetEntry(timesheet, entry)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
                                                      >
                                                        <XCircle size={14} />
                                                      </button>
                                                    </div>
                                                  ) : (
                                                    <span style={{ color: 'var(--gray-400)', fontSize: '12px' }}>-</span>
                                                  )}
                                                </td>
                                              )}
                                            </tr>
                                          );
                                        })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAdminTimesheets = () => (
    <div className="to-ts-panel">
      {/* Page Header */}
      <div className="hr-page-header">
        <h1 className="hr-page-title">All Employees Timesheets</h1>
        <div className="hr-page-actions to-toolbar">
          <div className="to-search-wrap" style={{ width: '250px' }}>
            <Search size={16} />
            <input
              type="text"
              className="to-input"
              style={{ width: '100%' }}
              placeholder="Search employee..."
              value={adminSearchQuery}
              onChange={(e) => setAdminSearchQuery(e.target.value)}
            />
          </div>
          <div>
            <select
              className="to-select"
              value={adminStatusFilter}
              onChange={(e) => setAdminStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="ON_HOLD">On Hold</option>
            </select>
          </div>
          <div className="hr-view-toggle">
            <button
              className={`hr-view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <List size={18} />
            </button>
            <button
              className={`hr-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="hr-week-nav">
        <div className="hr-week-selector">
          <button className="hr-nav-arrow" onClick={() => navigateWeek('prev')}>
            <ChevronLeft size={18} />
          </button>
          <span className="hr-week-range">{formatWeekRange()}</span>
          <button className="hr-nav-arrow" onClick={() => navigateWeek('next')}>
            <ChevronRight size={18} />
          </button>
          <button className="hr-calendar-btn">
            <Calendar size={18} />
          </button>
        </div>
      </div>

      {/* Timesheets Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            Employee Timesheets - {formatWeekRange()}
          </h3>
        </div>
        <div className="employee-table-container">
          {timesheetLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Loader2 className="animate-spin" size={32} />
              <p>Loading timesheets...</p>
            </div>
          ) : (() => {
            const filteredTimesheets = adminTimesheets.filter(ts => {
              const tsStatus = (ts.status || '').toUpperCase();
              if (tsStatus === 'DRAFT') return false;

              const empName = (ts.employeeName || (ts.employee?.firstName + ' ' + ts.employee?.lastName) || '').toLowerCase();
              const empId = String(ts.employeeId || ts.employee?.employeeId || '').toLowerCase();
              const searchTerm = adminSearchQuery.toLowerCase();
              
              const matchesSearch = empName.includes(searchTerm) || empId.includes(searchTerm);
              // Note: 'PENDING' equals 'SUBMITTED' in this UI generally
              const checkStatus = adminStatusFilter === 'PENDING' ? 'SUBMITTED' : adminStatusFilter;
              const matchesStatus = adminStatusFilter === 'ALL' || tsStatus === checkStatus || (adminStatusFilter === 'PENDING' && tsStatus === 'PENDING');
              
              return matchesSearch && matchesStatus;
            });

            if (filteredTimesheets.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Clock size={48} style={{ color: 'var(--gray-400)', marginBottom: '16px' }} />
                  <p>No timesheets found matching your search</p>
                </div>
              );
            }

            return (
              <table className="employee-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Employee ID</th>
                    <th>Department</th>
                    <th>Week Start</th>
                    <th>Total Hours</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTimesheets.map((timesheet, idx) => {
                    const status = timesheet.status || 'DRAFT';
                  let rowBgColor = '#ffffff';
                  if (status === 'APPROVED') {
                    rowBgColor = '#ecfdf5';
                  } else if (status === 'SUBMITTED') {
                    rowBgColor = '#eff6ff';
                  } else if (status === 'DRAFT') {
                    rowBgColor = '#f9fafb';
                  } else if (status === 'REJECTED') {
                    rowBgColor = '#fef2f2';
                  }

                  const timesheetKey = timesheet.id || `admin-timesheet-${idx}`;
                  const expandKey = timesheet.id || `admin-${timesheet.employeeId || timesheet.employee?.employeeId || idx}-${timesheet.weekStartDate || timesheet.weekStart || idx}`;
                  const isExpanded = expandKey ? expandedTimesheets.has(expandKey) : false;

                  return (
                    <Fragment key={timesheetKey}>
                      <tr style={{ backgroundColor: rowBgColor }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              className="hr-expand-btn"
                              onClick={() => toggleTimesheetExpand(expandKey)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#6b7280',
                                transition: 'color 0.2s',
                                minWidth: '24px',
                                minHeight: '24px',
                                flexShrink: 0,
                                visibility: 'visible',
                                opacity: 1,
                                zIndex: 1
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#6366f1';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#6b7280';
                              }}
                              title={isExpanded ? 'Collapse entries' : 'Expand entries'}
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            <div className="employee-cell" style={{ flex: 1 }}>
                              <img
                                src={`https://ui-avatars.com/api/?name=${timesheet.employeeName || (timesheet.employee?.firstName + ' ' + timesheet.employee?.lastName) || 'Employee'}&background=6366f1&color=fff`}
                                className="employee-avatar"
                                alt=""
                              />
                              <div>
                                <div style={{ fontWeight: 500 }}>
                                  {timesheet.employeeName || (timesheet.employee?.firstName + ' ' + timesheet.employee?.lastName) || 'N/A'}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                                  {timesheet.employeeEmail || timesheet.employee?.email || ''}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>{timesheet.employeeIdString || timesheet.employee?.employeeId || timesheet.employee?.employeeIdString || timesheet.employeeId || 'N/A'}</td>
                        <td>{timesheet.department || timesheet.employee?.department?.name || 'N/A'}</td>
                        <td>{timesheet.weekStartDate || timesheet.weekStart || 'N/A'}</td>
                        <td style={{ fontFamily: 'monospace' }}>{formatHours(timesheet.totalHours || '0:00')}</td>
                        <td>
                          <span className={`status-badge ${timesheet.status === 'SUBMITTED' ? 'pending' :
                            timesheet.status === 'APPROVED' ? 'approved' :
                              timesheet.status === 'REJECTED' ? 'rejected' : 'pending'
                            }`}>
                            {timesheet.status || 'DRAFT'}
                          </span>
                        </td>
                        <td>{timesheet.submittedAt ? new Date(timesheet.submittedAt).toLocaleDateString() : 'Not submitted'}</td>
                        <td>
                          <button
                            className="action-icon"
                            title="View Details"
                            onClick={() => handleViewTimesheet(timesheet)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-500)' }}
                          >
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && expandKey && timesheet.entries && Array.isArray(timesheet.entries) && timesheet.entries.length > 0 && (
                        <tr key={`${expandKey}-expanded`}>
                          <td colSpan={8} style={{ padding: '0', backgroundColor: '#f9fafb', borderTop: 'none' }}>
                            <div style={{ padding: '20px', backgroundColor: '#ffffff', margin: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '15px', color: 'var(--gray-700)' }}>
                                Timesheet Entries
                              </h4>
                              <div className="employee-table-container">
                                <table className="employee-table" style={{ fontSize: '12px' }}>
                                  <thead>
                                    <tr>
                                      <th>Date</th>
                                      <th>Project</th>
                                      <th>Task</th>
                                      <th>Description</th>
                                      <th>Hours</th>
                                      <th>Billable</th>
                                      <th>Work Type</th>
                                      <th>Status</th>
                                      <th>Approved/Rejected By</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(timesheet.entries || [])
                                      .sort((a, b) => {
                                        const dateA = new Date(a.workDate || a.work_date);
                                        const dateB = new Date(b.workDate || b.work_date);
                                        return dateA - dateB;
                                      })
                                      .map((entry, entryIdx) => {
                                        // Determine entry status
                                        const entryApproved = entry.approved === true || entry.approved === 'true';
                                        const entryRejected = entry.rejected === true || entry.rejected === 'true';
                                        const timesheetStatus = timesheet.status || 'DRAFT';
                                        const isTimesheetApproved = timesheetStatus === 'APPROVED';
                                        const isTimesheetRejected = timesheetStatus === 'REJECTED';

                                        const isApproved = entryApproved || (isTimesheetApproved && !entryRejected);
                                        const isRejected = entryRejected || isTimesheetRejected;

                                        let entryStatus = 'PENDING';
                                        let statusClass = 'pending';
                                        if (isApproved) {
                                          entryStatus = 'APPROVED';
                                          statusClass = 'approved';
                                        } else if (isRejected) {
                                          entryStatus = 'REJECTED';
                                          statusClass = 'rejected';
                                        }

                                        // Get approval/rejection info
                                        let approvedByName = null;
                                        if (entry.approvedByName) {
                                          approvedByName = entry.approvedByName;
                                        } else if (entry.approvedBy) {
                                          if (typeof entry.approvedBy === 'string') {
                                            approvedByName = entry.approvedBy;
                                          } else if (entry.approvedBy.firstName && entry.approvedBy.lastName) {
                                            approvedByName = `${entry.approvedBy.firstName} ${entry.approvedBy.lastName}`.trim();
                                          } else if (entry.approvedBy.name) {
                                            approvedByName = entry.approvedBy.name;
                                          }
                                        }
                                        if (!approvedByName && isTimesheetApproved) {
                                          approvedByName = timesheet.approvedByName || timesheet.approvedBy || timesheet.managerName || null;
                                        }

                                        let rejectedByName = null;
                                        if (entry.rejectedByName) {
                                          rejectedByName = entry.rejectedByName;
                                        } else if (entry.rejectedBy) {
                                          if (typeof entry.rejectedBy === 'string') {
                                            rejectedByName = entry.rejectedBy;
                                          } else if (entry.rejectedBy.firstName && entry.rejectedBy.lastName) {
                                            rejectedByName = `${entry.rejectedBy.firstName} ${entry.rejectedBy.lastName}`.trim();
                                          } else if (entry.rejectedBy.name) {
                                            rejectedByName = entry.rejectedBy.name;
                                          }
                                        }
                                        if (!rejectedByName && isTimesheetRejected) {
                                          rejectedByName = timesheet.rejectedByName || timesheet.rejectedBy || null;
                                        }

                                        const approvedAt = entry.approvedAt ? new Date(entry.approvedAt).toLocaleDateString() :
                                          (isTimesheetApproved && timesheet.approvedAt ? new Date(timesheet.approvedAt).toLocaleDateString() : null);
                                        const rejectedAt = entry.rejectedAt ? new Date(entry.rejectedAt).toLocaleDateString() :
                                          (isTimesheetRejected && timesheet.rejectedAt ? new Date(timesheet.rejectedAt).toLocaleDateString() : null);

                                        let entryRowBgColor = '#ffffff';
                                        if (isApproved) {
                                          entryRowBgColor = '#ecfdf5';
                                        } else if (isRejected) {
                                          entryRowBgColor = '#fef2f2';
                                        } else {
                                          entryRowBgColor = '#eff6ff';
                                        }

                                        return (
                                          <tr key={entry.id || `admin-entry-${timesheet.id || idx}-${entryIdx}`} style={{ backgroundColor: entryRowBgColor }}>
                                            <td>{new Date(entry.workDate || entry.work_date).toLocaleDateString()}</td>
                                            <td>{entry.projectName || entry.projectNameSnapshot || entry.project?.name || 'N/A'}</td>
                                            <td>{entry.taskName || entry.taskNameSnapshot || entry.task?.name || 'N/A'}</td>
                                            <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                              {entry.description || '-'}
                                            </td>
                                            <td style={{ fontFamily: 'monospace' }}>{formatHours(entry.hours || '0')}</td>
                                            <td>
                                              <span className={`status-badge ${(entry.billable || entry.isBillableSnapshot) ? 'approved' : 'pending'}`}>
                                                {(entry.billable || entry.isBillableSnapshot) ? 'Yes' : 'No'}
                                              </span>
                                            </td>
                                            <td>{entry.workType || 'WORK'}</td>
                                            <td>
                                              <span className={`status-badge ${statusClass}`}>
                                                {entryStatus}
                                              </span>
                                            </td>
                                            <td>
                                              {approvedByName && approvedByName.trim() !== '' && approvedByName !== 'undefined undefined' ? (
                                                <div style={{ fontSize: '12px' }}>
                                                  <div style={{ fontWeight: 500, color: '#10b981' }}>
                                                    Approved by: {approvedByName}
                                                  </div>
                                                  {approvedAt && (
                                                    <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginTop: '2px' }}>
                                                      {approvedAt}
                                                    </div>
                                                  )}
                                                </div>
                                              ) : rejectedByName && rejectedByName.trim() !== '' && rejectedByName !== 'undefined undefined' ? (
                                                <div style={{ fontSize: '12px' }}>
                                                  <div style={{ fontWeight: 500, color: '#ef4444' }}>
                                                    Rejected by: {rejectedByName}
                                                  </div>
                                                  {rejectedAt && (
                                                    <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginTop: '2px' }}>
                                                      {rejectedAt}
                                                    </div>
                                                  )}
                                                  {(entry.rejectionReason || timesheet.rejectionReason) && (
                                                    <div style={{ fontSize: '11px', color: 'var(--gray-600)', marginTop: '2px', fontStyle: 'italic' }}>
                                                      Reason: {entry.rejectionReason || timesheet.rejectionReason}
                                                    </div>
                                                  )}
                                                </div>
                                              ) : (
                                                <span style={{ color: 'var(--gray-400)', fontSize: '12px' }}>-</span>
                                              )}
                                            </td>
                                            {/* Screenshots column removed */}
                                          </tr>
                                        );
                                      })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          );
        })()}
        </div>
      </div>
    </div>
  );

  // Render Rejected Timesheets
  const renderRejectedTimesheets = () => {
    const filteredRejected = Array.isArray(rejectedTimesheetsList) ? rejectedTimesheetsList : [];
    const rejectedEntryRows = filteredRejected.flatMap((ts) => {
      const entries = Array.isArray(ts.entries) ? ts.entries : [];
      const rejectedEntries = entries.filter((entry) =>
        entry?.rejected === true || String(entry?.status || '').toUpperCase() === 'REJECTED'
      );
      return rejectedEntries.map((entry) => ({ ...entry, __timesheet: ts }));
    });

    return (
      <div style={{ padding: '20px' }}>
        <div className="hr-page-header">
          <h1 className="hr-page-title">Rejected Timesheets - {formatWeekRange()}</h1>
        </div>
        <div className="hr-week-nav">
          <div className="hr-week-selector">
            <button className="hr-nav-arrow" onClick={() => navigateWeek('prev')}>
              <ChevronLeft size={18} />
            </button>
            <span className="hr-week-range">{formatWeekRange()}</span>
            <button className="hr-nav-arrow" onClick={() => navigateWeek('next')}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header">
            <h3 className="card-title">Rejected Entries for {formatWeekRange()}</h3>
          </div>
          <div className="employee-table-container">
            {rejectedEntryRows.length === 0 ? (
              <div className="hr-empty-tab">
                <Clock size={48} />
                <p>No rejected timesheets for this week range.</p>
              </div>
            ) : (
              <table className="employee-table">
                <thead>
                  <tr>
                    <th>Week Range</th>
                    <th>Work Date</th>
                    <th>Hours</th>
                    <th>Rejected By</th>
                    <th>Reason</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rejectedEntryRows.map((entry, idx) => {
                    const ts = entry.__timesheet;
                    return (
                    <tr key={entry.id || `${ts?.id || 'ts'}-${idx}`}>
                      <td>{ts?.weekStartDate || ts?.weekStart || 'N/A'}</td>
                      <td>{entry.workDate || 'N/A'}</td>
                      <td style={{ fontFamily: 'monospace' }}>{formatHours(Number(entry.hours || 0))}</td>
                      <td>{entry.rejectedByName || entry.rejectedBy || ts?.rejectedByName || ts?.rejectedBy || 'N/A'}</td>
                      <td>{entry.rejectionReason || ts?.rejectionReason || '-'}</td>
                      <td>
                        <button
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid #fca5a5',
                            background: '#fff1f2',
                            color: '#be123c',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            const tsDate = new Date(ts?.weekStartDate || ts?.weekStart || entry.workDate);
                            setCurrentWeekStart(tsDate);
                            if (entry.workDate) setTimesheetMonthFilter(getMonthKeyFromDate(new Date(entry.workDate)));
                            handleEditRejectedEntry(entry, ts);
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render Past Due Timesheets
  const renderPastDueTimesheets = () => {
    const filteredPastDue = Array.isArray(pastDueTimesheets) ? pastDueTimesheets : [];

    return (
      <div style={{ padding: '20px' }}>
        <div className="hr-page-header">
          <h1 className="hr-page-title">Past Due Timesheets</h1>
        </div>
        <div className="hr-week-nav">
          <div className="hr-week-selector">
            <button className="hr-nav-arrow" onClick={() => navigateWeek('prev')}>
              <ChevronLeft size={18} />
            </button>
            <span className="hr-week-range">{formatWeekRange()}</span>
            <button className="hr-nav-arrow" onClick={() => navigateWeek('next')}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header">
            <h3 className="card-title">Pending Missed Timesheets (Past Days Only)</h3>
          </div>
          <div className="employee-table-container">
            {filteredPastDue.length === 0 ? (
              <div className="hr-empty-tab">
                <Clock size={48} />
                <p>No missed working-day timesheets before this week.</p>
              </div>
            ) : (
              <table className="employee-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Week Range</th>
                    <th>Entry Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPastDue.map((ts, idx) => (
                    <tr key={ts.id || idx}>
                      <td>{ts.date || 'N/A'}</td>
                      <td>{ts.dayName || 'N/A'}</td>
                      <td>{ts.weekStartDate || ts.weekStart || 'N/A'}</td>
                      <td>
                        <span className="status-badge pending">
                          {ts.status || 'MISSED'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid #93c5fd',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                            title="Add entry on this date"
                            onClick={() => {
                              const targetWeek = parseDateToLocal(ts.weekStartDate || ts.weekStart || ts.date);
                              if (targetWeek) setCurrentWeekStart(targetWeek);
                              if (ts.date) setTimesheetMonthFilter(getMonthKeyFromDate(new Date(ts.date)));
                              setActiveSubTab('all');
                              if (ts.date) {
                                handleAddTimeEntry(ts.date);
                              }
                            }}
                          >
                            <Plus size={12} /> Add Entry
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render Project Time
  const renderProjectTime = () => (
    <div style={{ padding: '20px' }}>
      <div className="hr-page-header">
        <h1 className="hr-page-title">Project Time - {formatWeekRange()}</h1>
      </div>
      <div className="hr-week-nav">
        <div className="hr-week-selector">
          <button className="hr-nav-arrow" onClick={() => navigateWeek('prev')}>
            <ChevronLeft size={18} />
          </button>
          <span className="hr-week-range">{formatWeekRange()}</span>
          <button className="hr-nav-arrow" onClick={() => navigateWeek('next')}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-header">
          <h3 className="card-title">Project Distribution</h3>
        </div>
        <div className="employee-table-container">
          {!projectTimeData || projectTimeData.length === 0 ? (
            <div className="hr-empty-tab">
              <Clock size={48} />
              <p>No project time data for this week.</p>
            </div>
          ) : (
            <table className="employee-table">
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th>Billable Hours</th>
                  <th>Non-Billable Hours</th>
                  <th>Total Hours</th>
                </tr>
              </thead>
              <tbody>
                {projectTimeData.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{item.projectName || 'Leaves/Holiday & other'}</td>
                    <td style={{ fontFamily: 'monospace' }}>{formatHours(item.billableHours || 0)}</td>
                    <td style={{ fontFamily: 'monospace' }}>{formatHours(item.nonBillableHours || 0)}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatHours(item.totalHours || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );

  // Render Time Summary
  const renderTimeSummary = () => {
    const tasks = Array.isArray(timeSummaryData) ? timeSummaryData : [];
    const totalHours = tasks.reduce((sum, t) => sum + (Number(t.totalHours) || 0), 0);
    const totalEntries = tasks.length; // Or sum if backend provides entryCount

    return (
      <div style={{ padding: '20px' }}>
        <div className="hr-page-header">
          <h1 className="hr-page-title">Time Summary - {formatWeekRange()}</h1>
        </div>
        <div className="hr-week-nav">
          <div className="hr-week-selector">
            <button className="hr-nav-arrow" onClick={() => navigateWeek('prev')}>
              <ChevronLeft size={18} />
            </button>
            <span className="hr-week-range">{formatWeekRange()}</span>
            <button className="hr-nav-arrow" onClick={() => navigateWeek('next')}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header">
            <h3 className="card-title">Weekly Summary</h3>
          </div>
          <div className="employee-table-container">
            {tasks.length === 0 ? (
              <div className="hr-empty-tab">
                <Clock size={48} />
                <p>No summary data for this week.</p>
              </div>
            ) : (
              <table className="employee-table">
                <thead>
                  <tr>
                    <th>Task Name</th>
                    <th>Project</th>
                    <th>Total Hours</th>
                    <th>Last Worked</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 500 }}>{task.taskName || 'General'}</td>
                      <td>{task.projectName || 'N/A'}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatHours(task.totalHours || 0)}</td>
                      <td>{task.lastWorkedDate ? new Date(task.lastWorkedDate).toLocaleDateString() : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f9fafb', fontWeight: 600 }}>
                    <td colSpan="2">TOTAL</td>
                    <td style={{ fontFamily: 'monospace' }}>{formatHours(totalHours)}</td>
                    <td>{totalEntries} Tasks</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render All Timesheets content
  const renderAllTimesheets = () => {
    const weekDays = getWeekDays();
    const summaryTasks = Array.isArray(timeSummaryData) ? timeSummaryData : [];
    const rejectedTimesheetRows = Array.isArray(rejectedTimesheetsList) ? rejectedTimesheetsList : [];
    const rejectedEntryRows = rejectedTimesheetRows.flatMap((ts) => {
      const entries = Array.isArray(ts.entries) ? ts.entries : [];
      const rejectedEntries = entries.filter((entry) =>
        entry?.rejected === true || String(entry?.status || '').toUpperCase() === 'REJECTED'
      );
      return rejectedEntries.map((entry) => ({ ...entry, __timesheet: ts }));
    });
    const filteredPastDue = Array.isArray(pastDueTimesheets) ? pastDueTimesheets : [];
    const summaryTotalHours = summaryTasks.reduce((sum, t) => sum + (Number(t.totalHours) || 0), 0);
    const summaryTotalTasks = summaryTasks.length;

    /* â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */


    const getDayEntries = (day) =>
      (timesheetData.entries || []).filter(
        e => normalizeEntryDate(e.workDate || e.date || e.entryDate) === day.dateStr
      );

    const getDayTotals = (day) => {
      const entries = getDayEntries(day);
      const billable = entries.filter(e => e.billable !== false && e.billable !== null)
        .reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
      const nonBillable = entries.filter(e => e.billable === false)
        .reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
      return { billable, nonBillable, total: billable + nonBillable };
    };

    const getEntryColors = (entry) => {
      const s = (entry.status || 'DRAFT').toUpperCase();
      const type = (entry.workType || '').toUpperCase();
      const isBill = entry.billable !== false && entry.billable !== null;
      
      // Check work type first for automated entries
      if (entry.isCancelled) return { bg: '#f1f5f9', border: '#cbd5e1', text: '#475569', label: 'CANCELLED', badgeBg: '#e2e8f0' };
      if (type === 'HOLIDAY') return { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', label: 'HOLIDAY', badgeBg: '#fcd34d' };
      if (type === 'OPTIONAL_HOLIDAY' || type === 'OPTIONAL HOLIDAY') return { bg: '#fdf2f8', border: '#ec4899', text: '#9d174d', label: 'OPTIONAL HOLIDAY', badgeBg: '#fbcfe8' };
      if (type === 'LEAVE') return { bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8', label: 'ON LEAVE', badgeBg: '#e9d5ff' };
      
      if (s === 'APPROVED') {
        if (isBill) {
          return { bg: '#f0fdfa', border: '#0d9488', text: '#0f766e', label: 'APPROVED (BILL)', badgeBg: '#ccfbf1' };
        }
        return { bg: '#ecfdf5', border: '#10b981', text: '#065f46', label: 'APPROVED',  badgeBg: '#d1fae5' };
      }
      if (s === 'REJECTED')  return { bg: '#fef2f2', border: '#ef4444', text: '#991b1b', label: 'REJECTED',  badgeBg: '#fee2e2' };
      if (s === 'HOLD')      return { bg: '#fffbeb', border: '#fbbf24', text: '#92400e', label: 'HOLD',      badgeBg: '#fef3c7' };
      if (s === 'SUBMITTED' || s === 'PENDING') {
        if (isBill) {
          return { bg: '#eef2ff', border: '#4f46e5', text: '#3730a3', label: 'SUBMITTED (BILL)', badgeBg: '#e0e7ff' };
        }
        return { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af', label: 'SUBMITTED', badgeBg: '#dbeafe' };
      }
      return { bg: '#f8fafc', border: '#94a3b8', text: '#334155', label: 'DRAFT', badgeBg: '#e2e8f0' };
    };

    /* â”€â”€ status flags â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    const timesheetStatus    = timesheetData.status || 'DRAFT';
    const normalizedStatus   = String(timesheetStatus).trim().toUpperCase();
    const isDraftTs          = normalizedStatus === 'DRAFT';
    const isRejectedTs       = normalizedStatus === 'REJECTED';
    const isSubmittedTs      = normalizedStatus === 'SUBMITTED';
    const isApprovedTs       = normalizedStatus === 'APPROVED';
    const hasEntries         = !!(timesheetData.entries && timesheetData.entries.length > 0);
    const draftEntries       = hasEntries ? (timesheetData.entries || []).filter(e => (e.status || 'DRAFT') === 'DRAFT') : [];

    /* â”€â”€ progress â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    const totalHoursNum    = parseHours(timesheetData.totalHours    || '0:00');
    const expectedHoursNum = parseHours(timesheetData.expectedHours || '40:00');
    const progressPct      = expectedHoursNum > 0 ? Math.min(100, Math.round((totalHoursNum / expectedHoursNum) * 100)) : 0;
    const submittedHoursFromBackend =
      timesheetData.summaryMonth === timesheetMonthFilter &&
      timesheetData.submittedHoursForMonth != null &&
      !Number.isNaN(Number(timesheetData.submittedHoursForMonth))
        ? Number(timesheetData.submittedHoursForMonth)
        : null;
    const submittedHoursNum = submittedHoursFromBackend ?? calculateSubmittedHoursForMonthInWeek(
      timesheetData.entries,
      timesheetMonthFilter,
      weekDays.map((day) => day.dateStr),
      normalizeEntryDate
    );
    const submittedHoursTooltip =
      'Submitted Hours include only the hours submitted for the selected month, even if the selected week spans multiple months.';
    const submittedMonthLabel = timesheetMonthFilter
      ? new Date(`${timesheetMonthFilter}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'Selected month';

    /* â”€â”€ shared button style â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    const btnOutline = {
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--gray-20)',
      background: 'var(--white-5)', color: 'var(--dark-80)', fontSize: '13px', fontWeight: 500,
      cursor: 'pointer', transition: 'all 0.15s'
    };

    return (
      <div className="to-ts-panel">
        <div className="to-ts-actions-row">
          <div className="hr-week-nav" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div className="hr-week-selector">
              <button type="button" className="hr-nav-arrow" onClick={() => navigateWeek('prev')} aria-label="Previous week">
                <ChevronLeft size={16} />
              </button>
              <span className="hr-week-range">{formatWeekRange()}</span>
              <button type="button" className="hr-nav-arrow" onClick={() => navigateWeek('next')} aria-label="Next week">
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                className="hr-calendar-btn"
                title="Calendar"
                onClick={() => {
                  if (monthInputRef.current) {
                    try {
                      monthInputRef.current.showPicker();
                    } catch (e) {
                      monthInputRef.current.click();
                    }
                  }
                }}
              >
                <Calendar size={16} />
              </button>
            </div>
            <div className="to-month-filter" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--to-muted)', fontWeight: 600 }}>Month</span>
              <span style={{ fontSize: '13px', color: 'var(--to-text)', fontWeight: 700, backgroundColor: 'var(--to-surface)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--to-border)' }}>
                {submittedMonthLabel}
              </span>
              <input
                ref={monthInputRef}
                type="month"
                style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
                value={timesheetMonthFilter}
                onChange={(e) => handleTimesheetMonthChange(e.target.value)}
                aria-label="Select month for submitted hours"
              />
            </div>
          </div>

          <div className="to-toolbar">
            {(!isAdmin || (isHR && hrDataView === 'my-data')) && (
              <>
                <button type="button" className="to-btn-primary" onClick={() => handleAddTimeEntry()}>
                  <Plus size={13} /> Add today&apos;s entry
                </button>
                <button type="button" className="to-btn-success" onClick={handleAddWeeklyEntry}>
                  <Plus size={13} /> Add weekly entry
                </button>
              </>
            )}
            <div className="to-view-toggle">
              {[['list', List, 'List'], ['grid', LayoutGrid, 'Grid']].map(([mode, Icon, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={`to-view-btn ${viewMode === mode ? 'active' : ''}`}
                  onClick={() => setViewMode(mode)}
                >
                  <Icon size={14} />{label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="to-ts-summary-section">
          <h2 className="to-ts-summary-title">Timesheet Summary</h2>
          <div className="to-kpi-grid">
          <div className="to-kpi-card">
            <div className="to-kpi-card-head">
              <div className="to-kpi-icon primary">
                <Clock size={16} />
              </div>
              <span className="to-kpi-label">Total Hours</span>
            </div>
            <div className="to-kpi-value">{timesheetData.totalHours || '0:00'}</div>
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="to-progress-track" style={{ flex: 1, marginTop: 0 }}>
                <div
                  className="to-progress-fill"
                  style={{
                    width: `${progressPct}%`,
                    background: progressPct >= 100 ? '#10b981' : (progressPct >= 80 ? '#f59e0b' : 'var(--to-primary)')
                  }}
                />
              </div>
              <span className="to-kpi-sub" style={{ marginTop: 0, whiteSpace: 'nowrap' }}>/ {timesheetData.expectedHours || '40:00'}</span>
            </div>
            <div>
              {isDraftTs && <span className="to-ts-badge draft">DRAFT</span>}
              {isRejectedTs && <span className="to-ts-badge rejected">REJECTED</span>}
              {isSubmittedTs && !isDraftTs && <span className="to-ts-badge submitted">SUBMITTED</span>}
              {isApprovedTs && <span className="to-ts-badge approved">APPROVED</span>}
            </div>
          </div>

          <div className="to-kpi-card" title={submittedHoursTooltip}>
            <div className="to-kpi-card-head">
              <div className="to-kpi-icon violet">
                <Send size={16} />
              </div>
              <span className="to-kpi-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Submitted Hours
                <HelpCircle size={12} style={{ opacity: 0.65 }} aria-hidden="true" />
              </span>
            </div>
            <div className="to-kpi-value violet">{formatHours(submittedHoursNum)}</div>
            <div className="to-kpi-sub" title={submittedHoursTooltip}>
              For {submittedMonthLabel}
            </div>
          </div>

          <div className="to-kpi-card">
            <div className="to-kpi-card-head">
              <div className="to-kpi-icon blue">
                <Clock size={16} />
              </div>
              <span className="to-kpi-label">Time off / leave</span>
            </div>
            <div className="to-kpi-value blue">{timesheetData.timeOff || '0:00'}</div>
            <div className="to-kpi-sub">This week</div>
          </div>

          <div className="to-kpi-card">
            <div className="to-kpi-card-head">
              <div className="to-kpi-icon green">
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', display: 'block' }} />
              </div>
              <span className="to-kpi-label">Billable</span>
            </div>
            <div className="to-kpi-value green">{timesheetData.billable || '0:00'}</div>
            <div className="to-kpi-sub">This week</div>
          </div>

          <div className="to-kpi-card">
            <div className="to-kpi-card-head">
              <div className="to-kpi-icon orange">
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f97316', display: 'block' }} />
              </div>
              <span className="to-kpi-label">Non-billable</span>
            </div>
            <div className="to-kpi-value orange">{timesheetData.nonBillable || '0:00'}</div>
            <div className="to-kpi-sub">This week</div>
          </div>

          {/* Submit card */}
          {(!isAdmin || (isHR && hrDataView === 'my-data')) && hasEntries && (isDraftTs || isRejectedTs || draftEntries.length > 0) && (
            <div style={{ background: 'var(--white-20)', borderRadius: '12px', padding: '18px 20px', border: '1px solid var(--gray-20)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary-600)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                  {draftEntries.length > 0 ? `${draftEntries.length} ${draftEntries.length === 1 ? 'Entry' : 'Entries'} Ready` : 'Ready to Submit'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Submit for manager approval</div>
              </div>
              <button onClick={handleSubmitTimesheet} disabled={submittingTimesheet || timesheetLoading} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '9px 14px', borderRadius: '8px', border: 'none',
                background: (submittingTimesheet || timesheetLoading) ? '#9ca3af' : 'var(--primary-500)', color: '#ffffff',
                fontSize: '13px', fontWeight: 700, cursor: (submittingTimesheet || timesheetLoading) ? 'not-allowed' : 'pointer',
                boxShadow: (submittingTimesheet || timesheetLoading) ? 'none' : '0 2px 6px rgba(59,130,246,0.35)', transition: 'background 0.2s'
              }}>
                {submittingTimesheet ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                {submittingTimesheet ? 'Submitting...' : (draftEntries.length > 0 ? `Submit ${draftEntries.length} ${draftEntries.length === 1 ? 'Entry' : 'Entries'}` : 'Submit Timesheet')}
              </button>
            </div>
          )}

        </div>
        </div>

        <div className="to-ts-entries-section">
        {timesheetLoading && (!timesheetData.entries || timesheetData.entries.length === 0) ? (
          <div className="to-ts-entries-loading">
            <Loader2 className="animate-spin" size={32} style={{ color: '#6b7280' }} />
          </div>
        ) : viewMode === 'list' ? (

          /* LIST VIEW */
          <div className="to-ts-list-card">
            <div className="to-ts-list-card-header">
              <h3>Time Entries {formatWeekRange()}</h3>
            </div>
            <div className="to-ts-table-scroll">
              {hasEntries ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['Date', 'Time', 'Project', 'Task', 'Description', 'Hours', 'Billable', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...timesheetData.entries]
                      .sort((a, b) => new Date(b.workDate || b.date || b.entryDate) - new Date(a.workDate || a.date || a.entryDate))
                      .map((entry, idx) => {
                        const entryDate   = entry.workDate || entry.date || entry.entryDate;
                        const projectName = entry.projectName || entry.projectNameSnapshot || entry.project?.projectName || 'Leaves/Holiday & other';
                        const taskName    = entry.taskName || entry.taskNameSnapshot || entry.task?.taskName || 'General';
                        const hours       = entry.hours || 0;
                        const isBillable  = entry.billable !== false && entry.billable !== null;
                        const colors      = getEntryColors(entry);
                        const entryStatus = (entry.status || 'DRAFT').toUpperCase();
                        const isRej       = entryStatus === 'REJECTED';
                        const isDraftE    = entryStatus === 'DRAFT';
                        const isApprovedE = entryStatus === 'APPROVED';
                        const approvedByName = entry.approvedByName || null;
                        const rejectedByName = entry.rejectedByName || null;
                        const timeRange = formatEntryTimeRange(entry);
                        return (
                          <tr key={entry.id || `le-${idx}`} style={{ borderBottom: '1px solid #f3f4f6', background: colors.bg }}>
                            <td style={{ padding: '11px 14px', whiteSpace: 'nowrap', color: '#374151', fontWeight: 500 }}>
                              {entryDate ? new Date(entryDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'N/A'}
                            </td>
                            <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: '12px', color: '#4b5563', whiteSpace: 'nowrap' }}>
                              {timeRange || '—'}
                            </td>
                            <td style={{ padding: '11px 14px', fontWeight: 600, color: '#111827' }}>{projectName}</td>
                            <td style={{ padding: '11px 14px', color: '#374151' }}>{taskName}</td>
                            <td style={{ padding: '11px 14px', color: '#6b7280', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.description || ''}</td>
                            <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#111827' }}>
                              {typeof hours === 'number' ? formatHours(hours) : hours}
                            </td>
                            <td style={{ padding: '11px 14px' }}>
                              <span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: isBillable ? '#d1fae5' : '#ffedd5', color: isBillable ? '#065f46' : '#9a3412' }}>
                                {isBillable ? 'Billable' : 'Non-Bill'}
                              </span>
                            </td>
                            <td style={{ padding: '11px 14px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, background: colors.badgeBg, color: colors.text, display: 'inline-block', whiteSpace: 'nowrap' }}>{colors.label}</span>
                                {isApprovedE && approvedByName && <span style={{ fontSize: '10px', color: '#6b7280' }}>by {approvedByName}</span>}
                                {isRej && rejectedByName && <span style={{ fontSize: '10px', color: '#6b7280' }}>by {rejectedByName}</span>}
                              </div>
                            </td>
                            <td style={{ padding: '11px 14px' }}>
                              <div style={{ display: 'flex', gap: '5px' }}>
                                {isRej && (
                                  <button onClick={() => handleEditRejectedEntry(entry, timesheetData)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fff1f1', color: '#dc2626', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                                    <Edit2 size={12} /> Edit &amp; Resubmit
                                  </button>
                                )}
                                {isDraftE && (
                                  <>
                                    <button onClick={() => handleEditDraftEntry(entry, timesheetData)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #93c5fd', background: '#eff6ff', color: '#2563eb', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                                      <Edit2 size={12} /> Edit
                                    </button>
                                    <button onClick={() => handleDeleteEntry(entry)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fff1f1', color: '#dc2626', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                                      <Trash2 size={12} /> Del
                                    </button>
                                  </>
                                )}
                                {!isRej && !isDraftE && <span style={{ color: '#d1d5db' }}></span>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: '20px' }}>
                  <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px', textAlign: 'center', fontWeight: 500 }}>No entries for this week. Start adding time for a specific day:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                    {weekDays.map((day, i) => (
                      <button 
                        key={i}
                        onClick={() => handleAddTimeEntry(day.dateStr)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                          padding: '16px', borderRadius: '12px', border: '1px dashed #cbd5e1',
                          background: day.isToday ? '#eff6ff' : '#ffffff', cursor: 'pointer',
                          transition: 'all 0.2s', outline: 'none'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = day.isToday ? '#eff6ff' : '#ffffff'; e.currentTarget.style.transform = 'translateY(0)'; }}
                      >
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>{day.dayName}</div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>{day.date} {day.month}</div>
                        <div style={{ 
                          width: '32px', height: '32px', borderRadius: '50%', background: '#3b82f6', 
                          color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          marginTop: '4px', boxShadow: '0 4px 6px -1px rgba(59,130,246,0.3)'
                        }}>
                          <Plus size={18} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        ) : (

          <>
          {/* GRID / WEEKLY VIEW */}
          <div className="to-ts-grid-wrap hr-responsive-table">
              <table className="to-ts-week-grid">
                <thead>
                  <tr>
                    {/* Project/Task column */}
                    <th
                      className="to-ts-sticky-col-header"
                      style={{
                      padding: '14px 16px', textAlign: 'left', fontWeight: 700, color: '#374151',
                      background: '#f9fafb', borderBottom: '2px solid #e5e7eb', borderRight: '1px solid #e5e7eb',
                      fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em',
                      minWidth: '220px'
                    }}>
                      PROJECT / TASK
                    </th>
                    {weekDays.map((day, i) => {

                      return (
                        <th key={i} style={{
                          padding: '10px 8px 10px', textAlign: 'center', fontWeight: 700,
                          background: day.isToday ? '#eff6ff' : '#f9fafb',
                          borderBottom: `2px solid ${day.isToday ? '#3b82f6' : '#e5e7eb'}`,
                          borderRight: '1px solid #e5e7eb',
                          color: day.isToday ? '#1d4ed8' : '#374151',
                          minWidth: '96px', position: 'relative'
                        }}>
                          <div style={{ fontSize: '13px', fontWeight: 700 }}>{day.date} {day.month}</div>
                          <div style={{ fontSize: '10px', fontWeight: 600, color: day.isToday ? '#3b82f6' : '#6b7280', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{day.dayName}</div>
                          {/* day total removed */}
                          {(!isAdmin || (isHR && hrDataView === 'my-data')) && (
                            <button onClick={e => { e.stopPropagation(); handleAddTimeEntry(day.dateStr); }}
                              style={{ position: 'absolute', top: '6px', right: '6px', width: '20px', height: '20px', borderRadius: '50%', border: '1px solid #e5e7eb', background: '#ffffff', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, transition: 'all 0.15s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary-500)'; e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = 'var(--primary-500)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#374151'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
                              title={`Add entry for ${day.date} ${day.month}`}
                            ><Plus size={11} /></button>
                          )}
                        </th>
                      );
                    })}
                    <th style={{
                      padding: '14px 10px', textAlign: 'center', fontWeight: 700, color: '#374151',
                      background: '#f3f4f6', borderBottom: '2px solid #e5e7eb',
                      fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: '90px'
                    }}>WEEK<br />TOTAL</th>
                  </tr>
                </thead>
                <tbody>

                  {/* Entry Rows */}
                  {hasEntries ? (
                      (() => {
                        const projectMap = {};
                        const projectOrder = [];
                        timesheetData.entries.forEach(entry => {
                          const pName = entry.projectName || entry.project?.projectName || 'Leaves/Holiday & other';
                          if (!projectMap[pName]) { projectMap[pName] = []; projectOrder.push(pName); }
                          projectMap[pName].push(entry);
                        });
                        return projectOrder.map(grpProject => {
                          const grpEntries = projectMap[grpProject];
                          const weekTotal = grpEntries.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
                          const accentColors = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];
                          const accent = accentColors[Math.abs(grpProject.split('').reduce((h,c)=>h+c.charCodeAt(0),0)) % accentColors.length];
                          return (
                            <tr key={grpProject} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td
                                  className="to-ts-sticky-col"
                                  style={{
                                  padding: '12px 14px', background: '#ffffff',
                                  borderBottom: '1px solid #e5e7eb', borderLeft: `3px solid ${accent}`,
                                  borderRight: '1px solid #e5e7eb',
                                  verticalAlign: 'middle', width: '200px'
                                }}>
                                  <div style={{ fontWeight: 700, color: '#111827', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{grpProject}</div>
                                </td>
                              {weekDays.map((day, di) => {
                                const dayEntries = grpEntries.filter(e => normalizeEntryDate(e.workDate || e.date || e.entryDate) === day.dateStr);
                                return (
                                  <td key={di} style={{
                                    padding: '6px 4px', textAlign: 'center',
                                    background: day.isToday ? '#f8fafc' : '#ffffff',
                                    borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb',
                                    verticalAlign: 'middle'
                                  }}>
                                    {dayEntries.length > 0 && (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                        {dayEntries.map((entry, ei) => {
                                          const hoursValue = typeof entry.hours === 'number' ? entry.hours : parseFloat(entry.hours) || 0;
                                          const entryColors = getEntryColors(entry);
                                          const timeRange = formatEntryTimeRange(entry);
                                          return (
                                            <div key={entry.id || `pill-${grpProject}-${di}-${ei}`} className="to-ts-entry-chip-wrap">
                                              <button
                                                type="button"
                                                onClick={() => setTimesheetModal({ entry, projectName: grpProject, timesheetData })}
                                                onMouseEnter={(e) => {
                                                  const rect = e.currentTarget.getBoundingClientRect();
                                                  setEntryTooltip({
                                                    rect,
                                                    placeAbove: rect.top > 220,
                                                    entry,
                                                    grpProject,
                                                    day,
                                                    hoursValue,
                                                    timeRange,
                                                    entryColors,
                                                  });
                                                }}
                                                onMouseLeave={() => setEntryTooltip(null)}
                                                style={{
                                                  display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                                                  padding: '4px 9px', borderRadius: '20px',
                                                  background: entryColors.badgeBg,
                                                  border: `1px solid ${entryColors.border}60`,
                                                  cursor: 'pointer', userSelect: 'none',
                                                  transition: 'all 0.15s', outline: 'none'
                                                }}
                                              >
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                  <Clock size={11} style={{ color: entryColors.text, flexShrink: 0 }} />
                                                  <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '12px', color: entryColors.text }}>{formatHours(hoursValue)}</span>
                                                </span>
                                                {timeRange && (
                                                  <span style={{ fontSize: '9px', fontWeight: 600, color: entryColors.text, opacity: 0.85, lineHeight: 1.1 }}>
                                                    {timeRange}
                                                  </span>
                                                )}
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                              <td style={{ padding: '10px 8px', textAlign: 'center', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontFamily: 'monospace', fontWeight: 700, color: '#374151', fontSize: '14px' }}>
                                {formatHours(weekTotal)}
                              </td>
                            </tr>
                          );
                        });
                      })()
                  ) : (
                    <tr>
                      <td className="to-ts-sticky-col" style={{ padding: '12px 16px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>
                        <div style={{ color: '#9ca3af', fontSize: '13px', fontStyle: 'italic' }}>No entries for this week</div>
                      </td>
                      {weekDays.map((day, di) => (
                        <td key={di} style={{
                          padding: '8px 4px', textAlign: 'center',
                          background: day.isToday ? '#f8fafc' : '#ffffff',
                          borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb',
                          verticalAlign: 'middle'
                        }}>
                          {(!isAdmin || (isHR && hrDataView === 'my-data')) && (
                            <button 
                              onClick={() => handleAddTimeEntry(day.dateStr)}
                              style={{ 
                                width: '32px', height: '32px', borderRadius: '50%', 
                                border: '1px dashed #cbd5e1', background: 'transparent', 
                                color: '#94a3b8', display: 'flex', alignItems: 'center', 
                                justifyContent: 'center', cursor: 'pointer', margin: '0 auto',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#3b82f6'; e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.borderStyle = 'solid'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.borderStyle = 'dashed'; }}
                              title={`Add entry for ${day.dayName}`}
                            >
                              <Plus size={16} />
                            </button>
                          )}
                        </td>
                      ))}
                      <td style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}></td>
                    </tr>
                  )}

                  {/* Add new task row */}
                  {(!isAdmin || (isHR && hrDataView === 'my-data')) && (
                    <tr>
                      <td colSpan={weekDays.length + 2} style={{ padding: 0, borderBottom: '1px solid #e5e7eb' }}>
                        <button onClick={handleAddTimeEntry} style={{
                          width: '100%', padding: '11px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '13px', fontWeight: 500,
                          transition: 'background 0.15s'
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <Plus size={15} style={{ color: '#9ca3af' }} /> Add New Entry
                        </button>
                      </td>
                    </tr>
                  )}

                  {/* Billable Row */}
                  <tr>
                    <td className="to-ts-sticky-col" style={{ padding: '10px 16px', background: '#f0fdf4', borderBottom: '1px solid #d1fae5', borderRight: '1px solid #d1fae5', fontWeight: 700, color: '#065f46', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>BILLABLE</td>
                    {weekDays.map((day, i) => {
                      const { billable: dB } = getDayTotals(day);
                      return (
                        <td key={i} style={{ padding: '10px 8px', textAlign: 'center', background: '#f0fdf4', borderBottom: '1px solid #d1fae5', borderRight: '1px solid #d1fae5', fontFamily: 'monospace', fontWeight: 600, fontSize: '13px', color: dB > 0 ? '#065f46' : '#9ca3af' }}>
                          {dB > 0 ? formatHours(dB) : ''}
                        </td>
                      );
                    })}
                    <td style={{ padding: '10px 8px', textAlign: 'center', background: '#d1fae5', borderBottom: '1px solid #a7f3d0', fontFamily: 'monospace', fontWeight: 700, fontSize: '13px', color: '#065f46' }}>
                      {formatHours(weekDays.reduce((s, d) => s + getDayTotals(d).billable, 0))}
                    </td>
                  </tr>

                  {/* Non-Billable Row */}
                   <tr>
                    <td className="to-ts-sticky-col" style={{ padding: '10px 16px', background: '#fff7ed', borderBottom: '1px solid #fed7aa', borderRight: '1px solid #fed7aa', fontWeight: 700, color: '#9a3412', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>NON-BILLABLE</td>
                    {weekDays.map((day, i) => {
                      const { nonBillable: dNB } = getDayTotals(day);
                      return (
                        <td key={i} style={{ padding: '10px 8px', textAlign: 'center', background: '#fff7ed', borderBottom: '1px solid #fed7aa', borderRight: '1px solid #fed7aa', fontFamily: 'monospace', fontWeight: 600, fontSize: '13px', color: dNB > 0 ? '#9a3412' : '#9ca3af' }}>
                          {dNB > 0 ? formatHours(dNB) : ''}
                        </td>
                      );
                    })}
                    <td style={{ padding: '10px 8px', textAlign: 'center', background: '#fdba74', borderBottom: '1px solid #fb923c', fontFamily: 'monospace', fontWeight: 700, fontSize: '13px', color: '#9a3412' }}>
                      {formatHours(weekDays.reduce((s, d) => s + getDayTotals(d).nonBillable, 0))}
                    </td>
                  </tr>

                  {/* Total Row */}
                  <tr style={{ background: '#f3f4f6' }}>
                    <td className="to-ts-sticky-col" style={{ padding: '12px 16px', borderTop: '2px solid #e5e7eb', fontWeight: 800, color: '#111827', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em', background: '#f3f4f6', borderRight: '1px solid #e5e7eb' }}>TOTAL HOURS / DAY</td>
                    {weekDays.map((day, i) => {
                      const { total: dT } = getDayTotals(day);
                      return (
                        <td key={i} style={{ padding: '12px 8px', textAlign: 'center', background: day.isToday ? '#eff6ff' : '#ffffff', borderTop: `2px solid ${day.isToday ? '#3b82f6' : '#e5e7eb'}`, borderRight: '1px solid #e5e7eb', fontFamily: 'monospace', fontWeight: 700, fontSize: '14px', color: dT > 0 ? '#111827' : '#6b7280' }}>
                          {dT > 0 ? formatHours(dT) : '0:00'}
                        </td>
                      );
                    })}
                    <td style={{ padding: '12px 8px', textAlign: 'center', background: '#f3f4f6', borderTop: '2px solid #e5e7eb', fontFamily: 'monospace', fontWeight: 800, fontSize: '16px', color: '#111827' }}>
                      {timesheetData.totalHours || '0:00'}
                    </td>
                  </tr>
                </tbody>
              </table>
          </div>
          <p className="to-ts-grid-hint">Swipe left/right to view the full week grid</p>
          <div className="to-ts-legend">
            <span className="to-ts-legend-title">Timer status:</span>
            <div className="to-ts-legend-item"><div className="to-ts-legend-dot" style={{ background: '#10b981' }} /><span>Approved</span></div>
            <div className="to-ts-legend-item"><div className="to-ts-legend-dot" style={{ background: '#0d9488' }} /><span>Approved (Billable)</span></div>
            <div className="to-ts-legend-item"><div className="to-ts-legend-dot" style={{ background: '#94a3b8' }} /><span>Draft</span></div>
            <div className="to-ts-legend-item"><div className="to-ts-legend-dot" style={{ background: '#3b82f6' }} /><span>Submitted</span></div>
            <div className="to-ts-legend-item"><div className="to-ts-legend-dot" style={{ background: '#4f46e5' }} /><span>Submitted (Billable)</span></div>
            <div className="to-ts-legend-item"><div className="to-ts-legend-dot" style={{ background: '#ef4444' }} /><span>Rejected</span></div>
            <div className="to-ts-legend-item"><div className="to-ts-legend-dot" style={{ background: '#fbbf24' }} /><span>On Hold</span></div>
            <div className="to-ts-legend-item"><div className="to-ts-legend-dot" style={{ background: '#f59e0b' }} /><span>Holiday</span></div>
            <div className="to-ts-legend-item"><div className="to-ts-legend-dot" style={{ background: '#a855f7' }} /><span>On Leave</span></div>
          </div>
          </>
        )}
        </div>

        <div className="to-ts-bottom-sections">
          <div className="card" style={{ margin: 0 }}>
            <div className="card-header">
              <h3 className="card-title">Past Due Timesheets</h3>
            </div>
            <div className="employee-table-container">
              {pastDueLoading && filteredPastDue.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '30px' }}>
                  <Loader2 className="animate-spin" size={24} style={{ color: 'var(--gray-400)' }} />
                </div>
              ) : filteredPastDue.length === 0 ? (
                <div className="hr-empty-tab">
                  <Clock size={48} />
                  <p>No missed working-day timesheets in this week range.</p>
                </div>
              ) : (
                <table className="employee-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Day</th>
                      <th>Week Range</th>
                      <th>Entry Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPastDue.map((ts, idx) => (
                      <tr key={ts.id || idx}>
                        <td>{ts.date || 'N/A'}</td>
                        <td>{ts.dayName || 'N/A'}</td>
                        <td>{ts.weekStartDate || ts.weekStart || 'N/A'}</td>
                        <td>
                          <span className="status-badge pending">
                            {ts.status || 'MISSED'}
                          </span>
                        </td>
                        <td>
                          <button
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid #93c5fd',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                            title="Add entry on this date"
                            onClick={() => {
                              const targetWeek = parseDateToLocal(ts.weekStartDate || ts.weekStart || ts.date);
                              if (targetWeek) setCurrentWeekStart(targetWeek);
                              if (ts.date) setTimesheetMonthFilter(getMonthKeyFromDate(new Date(ts.date)));
                              if (ts.date) {
                                handleAddTimeEntry(ts.date);
                              }
                            }}
                          >
                            <Plus size={12} /> Add Entry
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card" style={{ margin: 0 }}>
            <div className="card-header">
              <h3 className="card-title">Rejected Timesheets</h3>
            </div>
            <div className="employee-table-container">
              {rejectedLoading && rejectedEntryRows.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '30px' }}>
                  <Loader2 className="animate-spin" size={24} style={{ color: 'var(--gray-400)' }} />
                </div>
              ) : rejectedEntryRows.length === 0 ? (
                <div className="hr-empty-tab">
                  <Clock size={48} />
                  <p>No rejected timesheet entries for this week range.</p>
                </div>
              ) : (
                <table className="employee-table">
                  <thead>
                    <tr>
                      <th>Week Range</th>
                      <th>Work Date</th>
                      <th>Hours</th>
                      <th>Rejected By</th>
                      <th>Reason</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rejectedEntryRows.map((entry, idx) => {
                      const ts = entry.__timesheet;
                      return (
                        <tr key={entry.id || `${ts?.id || 'ts'}-${idx}`}>
                          <td>{ts?.weekStartDate || ts?.weekStart || 'N/A'}</td>
                          <td>{entry.workDate || 'N/A'}</td>
                          <td style={{ fontFamily: 'monospace' }}>{formatHours(Number(entry.hours || 0))}</td>
                          <td>{entry.rejectedByName || entry.rejectedBy || ts?.rejectedByName || ts?.rejectedBy || 'N/A'}</td>
                          <td>{entry.rejectionReason || ts?.rejectionReason || '-'}</td>
                          <td>
                            <button
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid #fca5a5',
                                background: '#fff1f2',
                                color: '#be123c',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                const tsDate = new Date(ts?.weekStartDate || ts?.weekStart || entry.workDate);
                                setCurrentWeekStart(tsDate);
                                if (entry.workDate) setTimesheetMonthFilter(getMonthKeyFromDate(new Date(entry.workDate)));
                                handleEditRejectedEntry(entry, ts);
                              }}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card" style={{ margin: 0 }}>
            <div className="card-header">
              <h3 className="card-title">Project Time</h3>
            </div>
            <div className="employee-table-container">
              {projectTimeLoading && (!projectTimeData || projectTimeData.length === 0) ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '30px' }}>
                  <Loader2 className="animate-spin" size={24} style={{ color: 'var(--gray-400)' }} />
                </div>
              ) : (!projectTimeData || projectTimeData.length === 0) ? (
                <div className="hr-empty-tab">
                  <Clock size={48} />
                  <p>No project time data for this week.</p>
                </div>
              ) : (
                <table className="employee-table">
                  <thead>
                    <tr>
                      <th>Project Name</th>
                      <th>Billable Hours</th>
                      <th>Non-Billable Hours</th>
                      <th>Total Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectTimeData.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{item.projectName || 'Leaves/Holiday & other'}</td>
                        <td style={{ fontFamily: 'monospace' }}>{formatHours(item.billableHours || 0)}</td>
                        <td style={{ fontFamily: 'monospace' }}>{formatHours(item.nonBillableHours || 0)}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatHours(item.totalHours || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card" style={{ margin: 0 }}>
            <div className="card-header">
              <h3 className="card-title">Task Summary</h3>
            </div>
            <div className="employee-table-container">
              {timeSummaryLoading && summaryTasks.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '30px' }}>
                  <Loader2 className="animate-spin" size={24} style={{ color: 'var(--gray-400)' }} />
                </div>
              ) : summaryTasks.length === 0 ? (
                <div className="hr-empty-tab">
                  <Clock size={48} />
                  <p>No summary data for this week.</p>
                </div>
              ) : (
                <table className="employee-table">
                  <thead>
                    <tr>
                      <th>Task Name</th>
                      <th>Project</th>
                      <th>Total Hours</th>
                      <th>Last Worked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryTasks.map((task, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>{task.taskName || 'General'}</td>
                        <td>{task.projectName || 'N/A'}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatHours(task.totalHours || 0)}</td>
                        <td>{task.lastWorkedDate ? new Date(task.lastWorkedDate).toLocaleDateString() : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#f9fafb', fontWeight: 600 }}>
                      <td colSpan="2">TOTAL</td>
                      <td style={{ fontFamily: 'monospace' }}>{formatHours(summaryTotalHours)}</td>
                      <td>{summaryTotalTasks} Tasks</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>

        {entryTooltip && typeof document !== 'undefined' && createPortal(
          (() => {
            const { rect, placeAbove, entry, grpProject, day, hoursValue, timeRange } = entryTooltip;
            const centerX = rect.left + rect.width / 2;
            const left = Math.min(Math.max(centerX, 140), window.innerWidth - 140);
            const top = placeAbove ? rect.top - 10 : rect.bottom + 10;
            const entryStatus = String(entry.status || 'DRAFT').toUpperCase();
            return (
              <div
                className={`to-ts-entry-tooltip ${placeAbove ? 'above' : 'below'}`}
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  transform: placeAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
                }}
                role="tooltip"
              >
                <div className="to-ts-entry-tooltip-project">{grpProject}</div>
                <div className="to-ts-entry-tooltip-date">
                  {day.dayName}, {day.month} {day.date}, {new Date(day.dateStr).getFullYear()}
                </div>
                <div className="to-ts-entry-tooltip-rows">
                  <div className="to-ts-entry-tooltip-row">
                    <span>Hours</span>
                    <span className="mono">{formatHours(hoursValue)}</span>
                  </div>
                  {timeRange && (
                    <div className="to-ts-entry-tooltip-row">
                      <span>Time</span>
                      <span className="mono">{timeRange}</span>
                    </div>
                  )}
                  <div className="to-ts-entry-tooltip-row">
                    <span>Billing</span>
                    <span className={entry.billable === false ? 'warn' : 'ok'}>
                      {entry.billable === false ? 'Non-Bill' : 'Billable'}
                    </span>
                  </div>
                  <div className="to-ts-entry-tooltip-row">
                    <span>Status</span>
                    <span className={`status status-${entryStatus.toLowerCase()}`}>
                      {['SUBMITTED', 'PENDING'].includes(entryStatus) ? 'SUBMITTED' : (entry.status || 'DRAFT')}
                    </span>
                  </div>
                  {(entry.approvedByName || entry.rejectedByName) && (
                    <div className="to-ts-entry-tooltip-row subtle">
                      <span>{entryStatus === 'REJECTED' ? 'Rejected by' : 'Approved by'}</span>
                      <span>{entry.approvedByName || entry.rejectedByName}</span>
                    </div>
                  )}
                  {entry.description && (
                    <div className="to-ts-entry-tooltip-desc">"{entry.description}"</div>
                  )}
                </div>
              </div>
            );
          })(),
          document.body
        )}
      </div>
    );
  };


  return (
    <div className="time-office-page">
      <Header
        title={isAdmin ? (activeMainTab === 'leave' ? 'All Leaves' : (hasModule('TIMESHEETS') ? 'Time Office' : 'Attendance')) : (activeMainTab === 'leave' ? 'Leave' : (hasModule('TIMESHEETS') ? 'Time Office' : 'Attendance'))}
        subtitle={isAdmin ? (activeMainTab === 'leave' ? 'Manage organizational leave requests' : (hasModule('TIMESHEETS') ? 'Attendance, timesheets & hours' : 'Monitor organizational attendance')) : (activeMainTab === 'leave' ? 'Manage your leave requests and balances' : (hasModule('TIMESHEETS') ? 'Attendance, timesheets & hours' : 'Track and manage your work attendance'))}
      />

      <div className="page-content">
        {/* Top-level Data View Tabs for HR Users */}
        {isHR && !isAdmin && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              display: 'flex',
              gap: '4px',
              borderBottom: '2px solid var(--gray-10)',
              paddingBottom: '0',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch'
            }}>
              {/* Hide My Data tab for HR and CEO roles */}
              {!isHR && (
                <button
                  onClick={() => setHrDataView('my-data')}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    background: 'transparent',
                    borderBottom: hrDataView === 'my-data' ? '2px solid var(--primary-500)' : '2px solid transparent',
                    color: hrDataView === 'my-data' ? 'var(--primary-500)' : 'var(--gray-500)',
                    fontWeight: hrDataView === 'my-data' ? '600' : '500',
                    cursor: 'pointer',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    marginBottom: '-2px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  My Data
                </button>
              )}
              {/* Hide My Team Data tab for HR and CEO roles */}
              {!isHR && (
                <button
                  onClick={() => setHrDataView('team-data')}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    background: 'transparent',
                    borderBottom: hrDataView === 'team-data' ? '2px solid var(--primary-500)' : '2px solid transparent',
                    color: hrDataView === 'team-data' ? 'var(--primary-500)' : 'var(--gray-500)',
                    fontWeight: hrDataView === 'team-data' ? '600' : '500',
                    cursor: 'pointer',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    marginBottom: '-2px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  My Team Data
                </button>
              )}
            </div>
          </div>
        )}

        {/* Main Navigation Tabs */}
        <div className="hr-main-tabs">
          {initialTab !== 'leave' && hasModule('ATTENDANCE') && (
            <button
              className={`hr-main-tab ${activeMainTab === 'attendance' ? 'active' : ''}`}
              onClick={() => handleTabChange('attendance')}
            >
              ATTENDANCE
            </button>
          )}
          {initialTab !== 'leave' && hasModule('TIMESHEETS') && (
            isAdmin || (isHR && hrDataView === 'team-data') ? (
              <button
                className={`hr-main-tab ${activeMainTab === 'timesheet' ? 'active' : ''}`}
                onClick={() => {
                  handleTabChange('timesheet');
                  setActiveSubTab('all');
                }}
              >
                TIMESHEET
              </button>
            ) : (
              <>
                <button
                  className={`hr-main-tab ${activeMainTab === 'timesheet' && activeSubTab === 'all' ? 'active' : ''}`}
                  onClick={() => {
                    handleTabChange('timesheet');
                    setActiveSubTab('all');
                  }}
                >
                  TIMESHEETS
                </button>
                <button
                  className={`hr-main-tab ${activeMainTab === 'timesheet' && activeSubTab === 'tasks' ? 'active' : ''}`}
                  onClick={() => {
                    handleTabChange('timesheet');
                    setActiveSubTab('tasks');
                  }}
                >
                  MY TASKS
                </button>
                <button
                  className={`hr-main-tab ${activeMainTab === 'timesheet' && activeSubTab === 'allocated' ? 'active' : ''}`}
                  onClick={() => {
                    handleTabChange('timesheet');
                    setActiveSubTab('allocated');
                  }}
                >
                  PROJECTS ALLOCATED
                </button>
              </>
            )
          )}
          {initialTab === 'leave' && hasModule('LEAVE_MANAGEMENT') && (isAdmin || isHR) && (
            <button
              className={`hr-main-tab ${activeMainTab === 'leave' ? 'active' : ''}`}
              onClick={() => setActiveMainTab('leave')}
            >
              {isAdmin ? 'ALL LEAVES' : 'LEAVE'}
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="to-tab-content">
          {/* TIMESHEET Tab */}
          {activeMainTab === 'timesheet' && (
            <div className="to-tab-pane">
              <>
                {(isAdmin || (isHR && hrDataView === 'team-data')) && (
                  <div className="hr-sub-tabs">
                    <button className={`hr-sub-tab ${activeSubTab === 'all' ? 'active' : ''}`} onClick={() => setActiveSubTab('all')}>
                      {isAdmin ? 'All Timesheets' : 'All Employees Timesheets'}
                    </button>
                  </div>
                )}

                  <div className="to-tab-pane-inner">
                    {timesheetLoading && timesheetData.entries?.length > 0 && (
                      <div style={{ position: 'absolute', top: '-15px', right: '0', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--gray-500)', zIndex: 10, background: 'var(--white-5)', padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--gray-20)' }}>
                        <Loader2 className="animate-spin" size={10} />
                        Updating...
                      </div>
                    )}
                  <>
                    {/* HR/Admin Team Data: Show team/org timesheets */}
                    {(isAdmin || (isHR && hrDataView === 'team-data')) && activeSubTab === 'all' && (isAdmin ? renderAdminTimesheets() : renderTeamTimesheets())}
                    {/* Personal timesheets: all employees (non-admin) */}
                    {!isAdmin && (
                      <>
                        {activeSubTab === 'allocated' && renderProjectsAllocated()}
                        {activeSubTab === 'all' && renderAllTimesheets()}
                        {activeSubTab === 'rejected' && renderRejectedTimesheets()}
                        {activeSubTab === 'pastdue' && renderPastDueTimesheets()}
                        {activeSubTab === 'project' && renderProjectTime()}
                        {activeSubTab === 'summary' && renderTimeSummary()}
                      </>
                    )}

                    {/* My Tasks Render View */}
                    {activeSubTab === 'tasks' && (
                      <div style={{ padding: '0px' }}>
                        <div className="card" style={{ margin: 0 }}>
                          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '10px 16px', minHeight: 'auto' }}>
                            <h3 className="card-title" style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>My Assigned Tasks</h3>
                            <div className="hr-week-nav" style={{ margin: 0 }}>
                              <div className="hr-week-selector" style={{ minHeight: '30px', height: '30px' }}>
                                <button className="hr-nav-arrow" onClick={() => navigateWeek('prev')} style={{ width: '30px', height: '30px', minHeight: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <ChevronLeft size={16} />
                                </button>
                                <span className="hr-week-range" style={{ fontSize: '13px' }}>{formatWeekRange()}</span>
                                <button className="hr-nav-arrow" onClick={() => navigateWeek('next')} style={{ width: '30px', height: '30px', minHeight: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <ChevronRight size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="employee-table-container">
                            {tasksLoading ? (
                              <div className="to-loading-state" style={{ border: 'none', background: 'transparent', padding: '40px 20px' }}>
                                <Loader2 className="animate-spin" size={32} />
                                <p>Loading assigned tasks...</p>
                              </div>
                            ) : assignedTasks.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--to-muted)' }}>
                                <Clock size={48} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                                <h3 style={{ color: 'var(--to-text)', margin: '0 0 6px', fontSize: '15px', fontWeight: 700 }}>No tasks assigned yet</h3>
                                <p style={{ margin: 0, fontSize: '13px' }}>There are no tasks allocated to you for this week range.</p>
                              </div>
                            ) : (
                              <table className="employee-table">
                                <thead>
                                  <tr>
                                    <th style={{ padding: '6px 14px' }}>Project</th>
                                    <th style={{ padding: '6px 14px' }}>Task</th>
                                    <th style={{ padding: '6px 14px' }}>Start Date</th>
                                    <th style={{ padding: '6px 14px' }}>End Date</th>
                                    <th style={{ padding: '6px 14px' }}>Billable</th>
                                    <th style={{ padding: '6px 14px' }}>Allocation</th>
                                    <th style={{ padding: '6px 14px' }}>Status</th>
                                    <th style={{ padding: '6px 14px' }}>Work Status</th>
                                    <th style={{ padding: '6px 14px' }}>Approved By</th>
                                    <th style={{ padding: '6px 14px' }}>Created By</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {assignedTasks.map((task, idx) => (
                                    <tr key={task.id || idx} style={{ height: '36px' }}>
                                      <td style={{ padding: '6px 14px' }}>{task.projectName || 'N/A'}</td>
                                      <td style={{ padding: '6px 14px' }}>{task.taskName || 'N/A'}</td>
                                      <td style={{ padding: '6px 14px' }}>{formatTaskDate(task.startDate) || 'N/A'}</td>
                                      <td style={{ padding: '6px 14px' }}>{formatTaskDate(task.endDate) || 'N/A'}</td>
                                      <td style={{ padding: '6px 14px' }}>{isTaskBillable(task) ? 'Yes' : 'No'}</td>
                                      <td style={{ padding: '6px 14px' }}>{task.allocationPercent || 0}%</td>
                                      <td style={{ padding: '6px 14px' }}>
                                        <span className={`status-badge ${task.status === 'PENDING_APPROVAL' ? 'pending' :
                                          task.isActive ? 'approved' : 'rejected'
                                          }`}>
                                          {task.status === 'PENDING_APPROVAL' ? 'Pending Approval' :
                                            task.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '6px 14px' }}>
                                        {(() => {
                                          const statuses = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'];
                                          const pStatus = (task.status && statuses.includes(task.status)) ? task.status : 'NOT_STARTED';

                                          let label = 'Not Started';
                                          let badgeClass = '';
                                          let customStyle = {};

                                          if (pStatus === 'IN_PROGRESS') {
                                            label = 'In Progress';
                                            badgeClass = 'pending';
                                          } else if (pStatus === 'COMPLETED') {
                                            label = 'Completed';
                                            badgeClass = 'approved';
                                          } else {
                                            // NOT_STARTED
                                            customStyle = { backgroundColor: '#f3f4f6', color: '#374151' };
                                          }

                                          return (
                                            <span className={`status-badge ${badgeClass}`} style={customStyle}>
                                              {label}
                                            </span>
                                          );
                                        })()}
                                      </td>
                                      <td style={{ padding: '6px 14px' }}>{task.approvedByEmployeeName || 'N/A'}</td>
                                      <td style={{ padding: '6px 14px' }}>{task.createdByEmployeeName || 'N/A'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                </div>
              </>
            </div>
          )}

          {/* LEAVE Tab */}
          {activeMainTab === 'leave' && (isAdmin || isHR) && (
            <div style={{ opacity: 1, transition: 'opacity 0.2s ease-in' }}>
              {leaveLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 20px' }}>
                  <Loader2 className="animate-spin" size={32} style={{ color: '#6b7280' }} />
                </div>
              ) : (
                renderLeaveContent()
              )}
            </div>
          )}

          {/* Attendance Tab */}
          {activeMainTab === 'attendance' && (
            <div style={{ opacity: 1, transition: 'opacity 0.2s ease-in' }}>

              <div className="card" style={{ margin: 0 }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '10px 16px', minHeight: 'auto' }}>
                  <h3 className="card-title" style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{isAdmin ? 'All Attendance' : 'My Attendance'} — {isAdmin ? 'Daily view' : 'Week view'}</h3>
                  <div className="to-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {(isAdmin || (isHR && hrDataView === 'team-data')) ? (
                      <>
                        <input
                          type="date"
                          className="to-input"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          style={{ minHeight: '30px', height: '30px', padding: '4px 10px', fontSize: '12px' }}
                        />
                        {isAdmin && (
                          <button
                            type="button"
                            className="to-btn-outline"
                            onClick={() => navigate('/admin/reports/attendance')}
                            title="Go to Monthly Summary Report"
                            style={{ minHeight: '30px', height: '30px', padding: '4px 12px', fontSize: '12px' }}
                          >
                            <Calendar size={14} />
                            Monthly summary
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="to-icon-btn"
                          onClick={() => navigateWeek('prev')}
                          aria-label="Previous week"
                          style={{ width: '30px', height: '30px', minHeight: '30px' }}
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span className="to-week-label" style={{ fontSize: '13px' }}>
                          {formatWeekRange()}
                        </span>
                        <button
                          type="button"
                          className="to-icon-btn"
                          onClick={() => navigateWeek('next')}
                          aria-label="Next week"
                          style={{ width: '30px', height: '30px', minHeight: '30px' }}
                        >
                          <ChevronRight size={16} />
                        </button>
                      </>
                    )}
                    {isAdmin && (
                      <div className="to-search-wrap">
                        <Search size={14} />
                        <input
                          type="text"
                          className="to-input"
                          placeholder="Search employee..."
                          value={adminSearchQuery}
                          onChange={(e) => setAdminSearchQuery(e.target.value)}
                          style={{ minHeight: '30px', height: '30px', padding: '4px 10px 4px 34px', fontSize: '12px', width: '180px' }}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="employee-table-container">
                  {(() => {
                    if (attendanceLoading) {
                      return (
                        <div className="to-loading-state">
                          <Loader2 className="animate-spin" size={32} />
                          <p>Loading attendance data...</p>
                        </div>
                      );
                    }

                    const isEmployeeWeekView = !isAdmin && !(isHR && hrDataView === 'team-data');
                    const baseData = isAdmin ? (adminAttendanceData || []) : (hrDataView === 'team-data' ? (teamAttendanceData || []) : (employeeAttendanceData || []));
                    let dataToShow = baseData.filter(record => {
                      if (!isAdmin) return true;
                      const empName = (record.employeeName || (record.firstName + ' ' + record.lastName) || record.employee?.firstName + ' ' + record.employee?.lastName || '').toLowerCase().trim().replace(/\s+/g, ' ');
                      const empId = String(record.employeeId || record.employee?.employeeId || '').toLowerCase().trim();
                      const searchTerm = adminSearchQuery.toLowerCase().trim().replace(/\s+/g, ' ');
                      return !searchTerm || empName.includes(searchTerm) || empId.includes(searchTerm);
                    });

                    if (isEmployeeWeekView) {
                      const weekDays = getWeekDays();
                      dataToShow = mergeAttendanceWithWeekDays(dataToShow, weekDays).filter((record) => {
                        const dateKey = normalizeAttendanceRecordDate(record);
                        return dateKey && weekDays.some((d) => d.dateStr === dateKey);
                      });
                    }
                    console.log('[Attendance] Rendering attendance table:', {
                      isHR,
                      hrDataView,
                      isTeamData: isHR && hrDataView === 'team-data',
                      dataLength: dataToShow.length,
                      sampleData: dataToShow[0],
                      teamAttendanceDataLength: (teamAttendanceData || []).length,
                      employeeAttendanceDataLength: (employeeAttendanceData || []).length
                    });

                    if (dataToShow.length === 0) {
                      return (
                        <div className="to-empty-state">
                          <Calendar size={48} style={{ color: 'var(--gray-400)', marginBottom: '16px' }} />
                          <p>No attendance data found matching your filters</p>
                        </div>
                      );
                    }

                    return (
                      <table className="employee-table">
                        <thead>
                          <tr>
                            {((isAdmin || (isHR && hrDataView === 'team-data'))) && <th style={{ padding: '6px 14px' }}>Employee</th>}
                            <th style={{ padding: '6px 14px' }}>Date</th>
                            <th style={{ padding: '6px 14px' }}>Day</th>
                            <th style={{ padding: '6px 14px' }}>Status</th>
                            <th style={{ padding: '6px 14px' }}>Check In</th>
                            <th style={{ padding: '6px 14px' }}>Check Out</th>
                            <th style={{ padding: '6px 14px' }}>Work Hours</th>
                            <th style={{ padding: '6px 14px' }}>Location</th>
                            <th style={{ padding: '6px 14px' }}>Remark</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dataToShow.map((record, idx) => {
                            if (!record) return null; // Skip null/undefined records

                            // Create unique key: use id if available, otherwise combine employeeId with date or index
                            const recordDateKey = normalizeAttendanceRecordDate(record) || `row-${idx}`;
                            const uniqueKey = record.id ||
                              (record.employeeId ? `${record.employeeId}-${recordDateKey}` : `attendance-${recordDateKey}-${idx}`);

                            // Handle team attendance data structure (from team-attendance endpoint)
                            // Backend returns: firstName, lastName, employeeId, status, but may not have date/checkInTime/checkOutTime
                            const employeeName = record.employeeName ||
                              (record.firstName && record.lastName ? `${record.firstName} ${record.lastName}` :
                                (record.employee?.firstName && record.employee?.lastName ? `${record.employee.firstName} ${record.employee.lastName}` :
                                  record.employeeId || '--'));
                            const dateKey = normalizeAttendanceRecordDate(record) || '--';
                            const displayDate = dateKey !== '--' ? formatAttendanceDisplayDate(dateKey) : '—';
                            const todayStr = formatDateLocal(new Date());
                            const isPastDate = dateKey !== '--' && dateKey < todayStr;
                            const dayName = dateKey !== '--' ? getAttendanceDayName(dateKey) : '—';

                            return (
                              <tr key={uniqueKey} style={{ height: '36px' }}>
                                {(isAdmin || (isHR && hrDataView === 'team-data')) && (
                                  <td style={{ padding: '6px 14px' }}>
                                    {employeeName}
                                  </td>
                                )}
                                <td style={{ padding: '6px 14px' }}>{displayDate}</td>
                                <td style={{ padding: '6px 14px' }}>{dayName}</td>
                                <td style={{ padding: '6px 14px' }}>
                                  <span className={getAttendanceStatusClass(record.status, isPastDate)}>
                                    {record.status || '--'}
                                  </span>
                                </td>
                                <td style={{ fontFamily: 'monospace', padding: '6px 14px' }}>{formatTimeTo12h(record.clockInTime || record.checkInTime || record.checkIn) || '--:--'}</td>
                                <td style={{ fontFamily: 'monospace', padding: '6px 14px' }}>{formatTimeTo12h(record.clockOutTime || record.checkOutTime || record.checkOut) || '--:--'}</td>
                                <td style={{ padding: '6px 14px' }}>{formatHours(record.totalHours || record.hours || '0:00')}</td>
                                <td style={{ padding: '6px 14px' }}>{record.workLocation === 'WORK_FROM_HOME' || record.workLocation === 'FROM_HOME' || record.workLocation === 'WFH' || String(record.workLocation || '').toUpperCase().includes('FROM_HOME') ? 'WFH' : (record.workLocation === 'OFFICE' ? 'Office' : (record.workLocation || 'Office'))}</td>
                                <td style={{ padding: '6px 14px' }}>
                                  <span style={{ fontSize: '12px', color: 'var(--gray-600)' }}>
                                    {record.statusReason || record.remark || '--'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Other Tabs */}
          {!isAdmin && ['performance', 'expenses', 'helpdesk', 'apps'].includes(activeMainTab) && (
            <div className="hr-empty-tab">
              <Clock size={48} />
              <h3>{activeMainTab.charAt(0).toUpperCase() + activeMainTab.slice(1)}</h3>
              <p>This section is coming soon.</p>
            </div>
          )}
        </div>
      </div>

      {/* Timesheet Details Modal */}
      {showTimesheetModal && selectedTimesheet && (
        <div className="hr-modal-overlay" onClick={() => setShowTimesheetModal(false)}>
          <div className="hr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1300px', width: '98%', height: '90vh', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="hr-modal-header">
              <h2>Timesheet Details</h2>
              <button className="hr-modal-close" onClick={() => setShowTimesheetModal(false)}><X size={20} /></button>
            </div>
            <div className="hr-modal-body">
              {/* Employee Info */}
              <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <img
                    src={`https://ui-avatars.com/api/?name=${selectedTimesheet.employeeName || (selectedTimesheet.employee?.firstName + ' ' + selectedTimesheet.employee?.lastName) || 'Employee'}&background=6366f1&color=fff`}
                    className="employee-avatar"
                    alt=""
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '16px' }}>
                      {selectedTimesheet.employeeName || (selectedTimesheet.employee?.firstName + ' ' + selectedTimesheet.employee?.lastName) || 'N/A'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                      {selectedTimesheet.employeeIdString || selectedTimesheet.employee?.employeeId || selectedTimesheet.employee?.employeeIdString || selectedTimesheet.employeeId || 'N/A'} {selectedTimesheet.department || selectedTimesheet.employee?.department?.name || 'N/A'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '20px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Week:</span>
                    <span style={{ marginLeft: '5px', fontWeight: 500 }}>{selectedTimesheet.weekStartDate || selectedTimesheet.weekStart || 'N/A'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Total Hours:</span>
                    <span style={{ marginLeft: '5px', fontWeight: 500, fontFamily: 'monospace' }}>{formatHours(selectedTimesheet.totalHours || '0:00')}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Status:</span>
                    <span className={`status-badge ${selectedTimesheet.status === 'SUBMITTED' || selectedTimesheet.status === 'PENDING' ? 'pending' : selectedTimesheet.status === 'APPROVED' ? 'approved' : selectedTimesheet.status === 'REJECTED' ? 'rejected' : 'pending'}`} style={{ marginLeft: '5px' }}>
                      {selectedTimesheet.status || 'DRAFT'}
                    </span>
                  </div>
                  {(selectedTimesheet.approvedBy || selectedTimesheet.approvedByName || selectedTimesheet.managerName) && (
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Approved By:</span>
                      <span style={{ marginLeft: '5px', fontWeight: 500 }}>
                        {selectedTimesheet.approvedBy || selectedTimesheet.approvedByName || selectedTimesheet.managerName || 'N/A'}
                      </span>
                      {selectedTimesheet.approvedAt || selectedTimesheet.approvalDate ? (
                        <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--gray-500)' }}>
                          ({new Date(selectedTimesheet.approvedAt || selectedTimesheet.approvalDate).toLocaleDateString()})
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              {/* Timesheet Entries */}
              {selectedTimesheet.entries && selectedTimesheet.entries.length > 0 ? (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--gray-700)' }}>Timesheet Daily Entries</h3>
                    <div style={{ fontSize: '12px', color: 'var(--gray-500)', fontWeight: 500 }}>
                      Showing {selectedTimesheet.entries.length} records
                    </div>
                  </div>
                  
                  <div className="employee-table-container" style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
                    <table className="employee-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
                      <thead style={{ backgroundColor: '#f8fafc' }}>
                        <tr>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#4b5563', width: '10%' }}>Date</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#4b5563', width: '10%' }}>Project</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#4b5563', width: '12%' }}>Task</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#4b5563', width: '38%' }}>Description</th>
                          <th style={{ padding: '12px 6px', textAlign: 'center', fontWeight: 600, color: '#4b5563', width: '6%' }}>Hours</th>
                          <th style={{ padding: '12px 6px', textAlign: 'center', fontWeight: 600, color: '#4b5563', width: '7%' }}>Billable</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#4b5563', width: '7%' }}>Status</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#4b5563', width: '10%' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedTimesheet.entries
                          .sort((a, b) => {
                            const dateA = new Date(a.workDate || a.work_date);
                            const dateB = new Date(b.workDate || b.work_date);
                            return dateA - dateB;
                          })
                          .map((entry, idx) => {
                            const entryApproved = entry.approved === true || entry.approved === 'true';
                            const entryRejected = entry.rejected === true || entry.rejected === 'true';
                            const timesheetStatus = selectedTimesheet.status || 'DRAFT';
                            const isTimesheetApproved = timesheetStatus === 'APPROVED';
                            const isTimesheetRejected = timesheetStatus === 'REJECTED';
                            const isApproved = entryApproved || (isTimesheetApproved && !entryRejected);
                            const isRejected = entryRejected || isTimesheetRejected;
                            const isSubmitted = timesheetStatus === 'SUBMITTED' || timesheetStatus === 'PENDING';
                            const isDraft = timesheetStatus === 'DRAFT';

                            let entryStatusLabel = 'PENDING';
                            let statusColor = '#3b82f6';
                            let statusBg = '#eff6ff';

                            if (isApproved) {
                              entryStatusLabel = 'APPROVED';
                              statusColor = '#10b981';
                              statusBg = '#ecfdf5';
                            } else if (isRejected) {
                              entryStatusLabel = 'REJECTED';
                              statusColor = '#ef4444';
                              statusBg = '#fef2f2';
                            } else if (isDraft) {
                              entryStatusLabel = 'DRAFT';
                              statusColor = '#94a3b8';
                              statusBg = '#f8fafc';
                            }

                            const needsAction = (isSubmitted || isDraft) && !isApproved && !isRejected;

                            let approverInfo = null;
                            if (isApproved) {
                              approverInfo = entry.approvedByName || selectedTimesheet.approvedByName || selectedTimesheet.approvedBy || selectedTimesheet.managerName;
                            } else if (isRejected) {
                              approverInfo = entry.rejectedByName || selectedTimesheet.rejectedByName || selectedTimesheet.rejectedBy;
                            }

                            return (
                              <tr key={entry.id || `modal-entry-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontWeight: 500 }}>
                                  {new Date(entry.workDate || entry.work_date).toLocaleDateString()}
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  {entry.projectName || entry.projectNameSnapshot || entry.project?.name || 'N/A'}
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  {entry.taskName || entry.taskNameSnapshot || entry.task?.name || 'N/A'}
                                </td>
                                <td style={{ padding: '12px 16px', color: '#1f2937', fontSize: '13px', wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: '1.5' }}>
                                  {entry.description || '-'}
                                </td>
                                <td style={{ padding: '12px 6px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}>
                                  {formatHours(entry.hours || '0')}
                                </td>
                                <td style={{ padding: '12px 6px', textAlign: 'center' }}>
                                  <span style={{ 
                                    padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                                    backgroundColor: (entry.billable || entry.isBillableSnapshot) ? '#dcfce7' : '#f1f5f9',
                                    color: (entry.billable || entry.isBillableSnapshot) ? '#166534' : '#64748b'
                                  }}>
                                    {(entry.billable || entry.isBillableSnapshot) ? 'Yes' : 'No'}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ 
                                      padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, 
                                      backgroundColor: statusBg, color: statusColor, width: 'fit-content'
                                    }}>
                                      {entryStatusLabel}
                                    </span>
                                    {approverInfo && (
                                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>{approverInfo}</span>
                                    )}
                                  </div>
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    {(isAdmin || (isHR && hrDataView === 'team-data')) && needsAction ? (
                                      <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                          onClick={() => handleApproveTimesheetEntry(selectedTimesheet, entry)}
                                          title="Approve"
                                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#10b981' }}
                                        >
                                          <CheckCircle size={18} />
                                        </button>
                                        <button
                                          onClick={() => handleRejectTimesheetEntry(selectedTimesheet, entry)}
                                          title="Reject"
                                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}
                                        >
                                          <XCircle size={18} />
                                        </button>
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                        {isApproved || isRejected ? 'Completed' : 'Draft'}
                                      </span>
                                    )}
                                    {/* Screenshots button removed */}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {/* Screenshots strip removed */}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Clock size={48} style={{ color: 'var(--gray-400)', marginBottom: '16px' }} />
                  <p>No entries found for this timesheet</p>
                </div>
              )}
            </div>
            <div className="hr-modal-footer">
              <button type="button" className="hr-btn-secondary" onClick={() => setShowTimesheetModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Request Modal */}
      {showLeaveModal && (
        <div className="hr-modal-overlay" onClick={() => setShowLeaveModal(false)}>
          <div className="hr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hr-modal-header">
              <h2>Request Leave</h2>
              <button className="hr-modal-close" onClick={() => setShowLeaveModal(false)}>—</button>
            </div>
            <form onSubmit={submitLeaveRequest}>
              <div className="hr-modal-body">
                <div className="hr-form-row">
                  <div className="hr-form-group" style={{ flex: 2 }}>
                    <label>Leave Type</label>
                    <select
                      value={leaveForm.leaveType}
                      onChange={(e) => {
                        const value = e.target.value;
                        const lt = leaveTypeOptions.find(
                          (t) => t.leaveTypeName === value || t.leaveType === value
                        );
                        setLeaveForm({ ...leaveForm, leaveType: value, halfDayType: null });
                        setSelectedLeaveCode(lt?.leaveTypeCode || '');
                      }}
                      required
                      disabled={leaveTypeOptions.length === 0}
                    >
                      <option value="">
                        {leaveTypeOptions.length === 0 ? 'No leave types configured. Contact admin.' : 'Select leave type'}
                      </option>
                      {leaveTypeOptions.map((lt) => (
                        <option key={lt.id} value={lt.leaveTypeName || lt.leaveType}>
                          {lt.leaveTypeName || lt.leaveType}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="hr-form-group" style={{ flex: 1 }}>
                    <label>Leave Code</label>
                    <input
                      type="text"
                      value={selectedLeaveCode}
                      readOnly
                      placeholder="-"
                    />
                  </div>
                </div>
                {/* Half Day Selection */}
                {(() => {
                  const selectedLeaveType = leaveTypeOptions.find(lt =>
                    (lt.leaveTypeName || lt.leaveType) === leaveForm.leaveType
                  );
                  const isAnnualLeave = selectedLeaveType?.leaveTypeCode === 'AL' ||
                    selectedLeaveType?.leaveTypeName?.toLowerCase().includes('annual');
                  const showHalfDay = isAnnualLeave && leaveForm.leaveType;

                  return showHalfDay ? (
                    <div className="hr-form-group">
                      <label>Leave Duration</label>
                      <select
                        value={leaveForm.halfDayType || 'FULL_DAY'}
                        onChange={(e) => {
                          const value = e.target.value;
                          setLeaveForm({
                            ...leaveForm,
                            halfDayType: value === 'FULL_DAY' ? null : value,
                            endDate: value !== 'FULL_DAY' ? leaveForm.startDate : (leaveForm.endDate || leaveForm.startDate)
                          });
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #ddd',
                          fontSize: '13px',
                          backgroundColor: 'white'
                        }}
                      >
                        <option value="FULL_DAY">Full Day</option>
                        <option value="MORNING_HALF">First Half</option>
                        <option value="AFTERNOON_HALF">Second Half</option>
                      </select>
                    </div>
                  ) : null;
                })()}

                {/* Balance Info and Duration Feedback */}
                {leaveForm.leaveType && (
                  <div style={{ marginBottom: '15px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', fontSize: '13px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ color: '#64748b' }}>Available Balance:</span>
                      <span style={{ fontWeight: '700', color: '#6366f1' }}>
                        {(() => {
                          const selectedType = leaveTypeOptions.find(lt => (lt.leaveTypeName === leaveForm.leaveType || lt.leaveType === leaveForm.leaveType));
                          return getAvailableBalance(selectedType?.leaveTypeCode || leaveForm.leaveType);
                        })()} Days
                      </span>
                    </div>
                    {leaveForm.startDate && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Requested Duration:</span>
                        <span style={{ 
                          fontWeight: '700', 
                          color: calculateRequestedDuration(leaveForm.startDate, leaveForm.endDate, leaveForm.halfDayType) > getAvailableBalance(leaveTypeOptions.find(lt => (lt.leaveTypeName === leaveForm.leaveType || lt.leaveType === leaveForm.leaveType))?.leaveTypeCode || leaveForm.leaveType) 
                            ? '#ef4444' 
                            : '#10b981' 
                        }}>
                          {calculateRequestedDuration(leaveForm.startDate, leaveForm.endDate, leaveForm.halfDayType)} Days
                          <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#94a3b8', marginLeft: '5px' }}>
                            (Excl. weekends & holidays)
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="hr-form-row">
                  <div className="hr-form-group">
                    <label>From Date</label>
                    <DatePicker
                      value={leaveForm.startDate}
                      minDate={new Date().toLocaleDateString('en-CA')}
                      onChange={(date) => {
                        if (!(date instanceof Date)) return;
                        const newStartDate = date.toLocaleDateString('en-CA');
                        const newEndDate = leaveForm.halfDayType ? newStartDate : (leaveForm.endDate || newStartDate);
                        setLeaveForm({ ...leaveForm, startDate: newStartDate, endDate: newEndDate });
                      }}
                    />
                  </div>
                  <div className="hr-form-group">
                    <label>To Date</label>
                    <DatePicker
                      value={leaveForm.endDate}
                      minDate={leaveForm.startDate || new Date().toLocaleDateString('en-CA')}
                      onChange={(date) => {
                        if (!(date instanceof Date)) return;
                        setLeaveForm({ ...leaveForm, endDate: date.toLocaleDateString('en-CA') });
                      }}
                      disabled={!!leaveForm.halfDayType}
                    />
                  </div>
                </div>
                <div className="hr-form-group">
                  <label>Reason</label>
                  <textarea value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Enter reason for leave" rows={3} required />
                </div>
              </div>
              <div className="hr-modal-footer">
                <button type="button" className="hr-btn-secondary" onClick={() => setShowLeaveModal(false)}>Cancel</button>
                <button type="submit" className="hr-btn-primary">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Time Entry Modal */}
      {/* Weekly Entry Modal */}
      {showWeeklyEntryModal && (
        <div className="hr-modal-overlay" onClick={() => {
          setWeeklyEntries([]);
          setShowWeeklyEntryModal(false);
        }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 1000 }}>
          <div className="hr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '95%', width: '1200px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="hr-modal-header" style={{ flexShrink: 0, padding: '16px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#ffffff' }}>
              <h2 style={{ fontSize: '16px', margin: 0, fontWeight: 600 }}>Add Weekly Time Entries - {formatWeekRange()}</h2>
              <button
                className="hr-modal-close"
                onClick={() => {
                  setWeeklyEntries([]);
                  setShowWeeklyEntryModal(false);
                }}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#6b7280' }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmitWeeklyEntries} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="hr-modal-body" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '16px' }}>
                <div style={{ marginBottom: '16px', fontSize: '13px', color: '#6b7280', flexShrink: 0 }}>
                  Add time entries for each day of the week. Enter hours as <strong>HH:MM:SS</strong> (e.g. 08:30:00). Leave empty to skip a day.
                </div>
                <div className="weekly-timesheet-scroll" style={{ flex: 1, overflow: 'auto', minHeight: 0, position: 'relative' }}>
                  <div className="weekly-timesheet-scroll" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '100%', width: '100%' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'auto' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f9fafb', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                        <tr>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>Date</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>Project</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>Task</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>Description</th>
                          <th style={{ padding: '10px', textAlign: 'center', fontWeight: 600, border: '1px solid #e5e7eb', width: '120px', backgroundColor: '#f9fafb' }}>Hours (HH:MM:SS)</th>
                          <th style={{ padding: '10px', textAlign: 'center', fontWeight: 600, border: '1px solid #e5e7eb', width: '80px', backgroundColor: '#f9fafb' }}>Billable</th>
                          <th style={{ padding: '10px', textAlign: 'center', fontWeight: 600, border: '1px solid #e5e7eb', width: '60px', backgroundColor: '#f9fafb' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyEntries.map((entry, originalIdx) => {
                          const weekDays = getWeekDays();
                          const day = weekDays.find(d => d.dateStr === entry.workDate) || weekDays[0];
                          const dayTasks = availableTasks.filter(t => {
                            const taskProjectId = typeof t.projectId === 'string' ? parseInt(t.projectId) : t.projectId;
                            const entryProjectId = typeof entry.projectId === 'string' ? parseInt(entry.projectId) : entry.projectId;
                            return taskProjectId === entryProjectId;
                          });

                          return (
                            <tr key={entry.id || `entry-${entry.workDate}-${originalIdx}`} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '8px', border: '1px solid #e5e7eb', fontWeight: 500 }}>
                                {day.date} {day.month}<br />
                                <span style={{ fontSize: '11px', color: '#6b7280' }}>{day.dayName}</span>
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>
                                <select
                                  value={entry.projectId || ''}
                                  onChange={(e) => {
                                    const projectId = e.target.value;
                                    handleWeeklyEntryChange(originalIdx, 'projectId', projectId);
                                    handleWeeklyEntryChange(originalIdx, 'taskId', ''); // Reset task when project changes
                                    if (projectId) {
                                      fetchTasksForProject(projectId);
                                    }
                                  }}
                                  style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                                >
                                  <option value="">Select Project</option>
                                  {availableProjects.map(project => (
                                    <option key={project.id} value={project.id}>{project.projectName || project.name || 'Leaves/Holiday & other'}</option>
                                  ))}
                                </select>
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>
                                {entry.projectId ? (
                                  <>
                                    <select
                                      value={entry.taskId || ''}
                                      onChange={(e) => handleWeeklyEntryChange(originalIdx, 'taskId', e.target.value)}
                                      style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #d1d5db', marginBottom: '4px' }}
                                    >
                                      <option value="">Select Task</option>
                                      {dayTasks.map(task => (
                                        <option key={task.id} value={task.id}>{task.taskName}</option>
                                      ))}
                                    </select>
                                  </>
                                ) : (
                                  <span style={{ color: '#9ca3af' }}>Select a project first</span>
                                )}
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>
                                <input
                                  type="text"
                                  value={entry.description || ''}
                                  onChange={(e) => handleWeeklyEntryChange(originalIdx, 'description', e.target.value)}
                                  placeholder="Description"
                                  style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                                />
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                                <input
                                  type="text"
                                  className="weekly-hours-input"
                                  value={entry.hours || ''}
                                  onChange={(e) => handleWeeklyEntryChange(originalIdx, 'hours', e.target.value)}
                                  onBlur={(e) => handleWeeklyHoursBlur(originalIdx, e.target.value)}
                                  placeholder="00:00:00"
                                  inputMode="numeric"
                                  pattern="[0-9:]*"
                                  title="Format: HH:MM:SS (e.g. 08:30:00). Short forms like 8:30 are accepted."
                                  aria-label="Hours in HH MM SS format"
                                />
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  className="weekly-entry-checkbox"
                                  checked={entry.billable}
                                  onChange={(e) => handleWeeklyEntryChange(originalIdx, 'billable', e.target.checked)}
                                  aria-label="Billable"
                                />
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddWeeklyEntryRow(weekDays.findIndex(d => d.dateStr === entry.workDate));
                                    }}
                                    style={{
                                      padding: '6px 10px',
                                      backgroundColor: '#10b981',
                                      color: '#ffffff',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      fontWeight: 500,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      minWidth: '32px',
                                      height: '32px'
                                    }}
                                    title="Add another entry for this day"
                                    aria-label={`Add entry row for ${formatWeeklyDayLabel(entry.workDate)}`}
                                  >
                                    <Plus size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveWeeklyEntryRow(entry.id);
                                    }}
                                    style={{
                                      padding: '6px 10px',
                                      backgroundColor: '#ef4444',
                                      color: '#ffffff',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      minWidth: '32px',
                                      height: '32px',
                                      lineHeight: 1
                                    }}
                                    title="Remove this entry"
                                    aria-label={`Remove entry row for ${formatWeeklyDayLabel(entry.workDate)}`}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="hr-modal-footer" style={{
                padding: '12px 16px',
                display: 'flex',
                gap: '8px',
                justifyContent: 'flex-end',
                borderTop: '1px solid #e5e7eb',
                flexShrink: 0,
                backgroundColor: '#ffffff'
              }}>
                <button
                  type="button"
                  className="hr-btn-secondary"
                  onClick={() => {
                    setWeeklyEntries([]); // Clear entries first
                    setShowWeeklyEntryModal(false);
                  }}
                  style={{ padding: '6px 14px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                {(() => {
                  const weekDays = getWeekDays();
                  const workingDays = weekDays.filter(day => !isWeekendDay(day.dateStr));
                  const completedDays = workingDays.filter(day => 
                    weeklyEntries.some(entry => 
                      entry.workDate === day.dateStr && 
                      entry.projectId && 
                      entry.taskId && 
                      entry.hours &&
                      hasPositiveHours(entry.hours)
                    )
                  );
                  
                  const isComplete = completedDays.length === workingDays.length;
                  
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      {!isComplete && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontSize: '13px', fontWeight: 500 }}>
                          <Info size={14} />
                          <span>{completedDays.length} / {workingDays.length} working days completed</span>
                        </div>
                      )}
                      <button
                        type="submit"
                        className={isComplete ? "hr-btn-primary" : "hr-btn-secondary"}
                        disabled={!isComplete}
                        style={{ 
                          padding: '6px 20px', 
                          fontSize: '13px', 
                          backgroundColor: isComplete ? '#10b981' : '#f3f4f6',
                          color: isComplete ? '#ffffff' : '#9ca3af',
                          cursor: isComplete ? 'pointer' : 'not-allowed',
                          opacity: isComplete ? 1 : 0.7,
                          border: isComplete ? 'none' : '1px solid #e5e7eb'
                        }}
                      >
                        Submit All Entries
                      </button>
                    </div>
                  );
                })()}
              </div>
            </form>
          </div>
        </div>
      )}

      {showTimeEntryModal && (
        <div className="hr-modal-overlay" onClick={() => setShowTimeEntryModal(false)}>
          <div className="hr-time-modal hr-time-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="hr-time-modal-header">
              <h2><Plus size={20} /> Add Time Entry</h2>
              <button className="hr-time-modal-close" onClick={() => setShowTimeEntryModal(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmitTimeEntry}>
              <div className="hr-time-modal-body">
                <div className="hr-time-form-grid">
                  <div className="hr-time-grid">
                    <div className="hr-time-field-group">
                      <label>Work Date *</label>
                      <input
                        type="date"
                        className="hr-time-input"
                        value={timeEntryForm.workDate}
                        onChange={(e) => {
                          const newDate = e.target.value;
                          const holiday = isHoliday(newDate);
                          const leave = isApprovedLeave(newDate);
                          const shiftHours = calculateShiftHours();
                          
                          setTimeEntryForm(prev => ({ 
                            ...prev, 
                            workDate: newDate,
                            description: (holiday && !prev.description) ? 'Holiday' : ((leave && !prev.description) ? 'Approved Leave' : prev.description),
                            hours: (holiday || leave) ? shiftHours.toString() : prev.hours,
                            workType: holiday ? 'HOLIDAY' : (leave ? 'LEAVE' : 'WORK')
                          }));
                        }}
                        required
                      />
                    </div>
                    <div className="hr-time-field-group">
                      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        Log In <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
                        {timeEntryForm.clockIn && (
                          <span className="hr-time-format-preview">
                            <Clock size={10} /> {formatTimeTo12h(timeEntryForm.clockIn)}
                          </span>
                        )}
                      </label>
                      <input
                        type="time"
                        step="60"
                        className="hr-time-input hr-time-input--time"
                        value={timeEntryForm.clockIn || ''}
                        onChange={(e) => setTimeEntryForm(prev => ({ ...prev, clockIn: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="hr-time-field-group">
                      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        Log Out <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
                        {timeEntryForm.clockOut && (
                          <span className="hr-time-format-preview">
                            <Clock size={10} /> {formatTimeTo12h(timeEntryForm.clockOut)}
                          </span>
                        )}
                      </label>
                      <input
                        type="time"
                        step="60"
                        className="hr-time-input hr-time-input--time"
                        value={timeEntryForm.clockOut || ''}
                        onChange={(e) => setTimeEntryForm(prev => ({ ...prev, clockOut: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="hr-time-field-group">
                      <label>Hours *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="hr-time-input"
                        value={timeEntryForm.hours || ''}
                        onChange={(e) => setTimeEntryForm(prev => ({ ...prev, hours: e.target.value }))}
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>

                  <div className="hr-time-field-group">
                    <label>Project</label>
                    <select
                      className="hr-time-select"
                      value={String(timeEntryForm.projectId ?? '')}
                      onChange={(e) => handleProjectChange(e.target.value)}
                    >
                      <option value="">Select Project</option>
                      {availableProjects.map((project) => (
                        <option key={project.id} value={String(project.id)}>
                          {project.projectName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="hr-time-field-group">
                    <label>Task</label>
                    <select
                      className="hr-time-select"
                      value={String(timeEntryForm.taskId ?? '')}
                      onChange={(e) => {
                        const selectedTaskId = e.target.value;
                        const selectedTask = availableTasks.find(t => String(t.id || t.taskId) === String(selectedTaskId));
                        setTimeEntryForm(prev => ({
                          ...prev,
                          taskId: selectedTaskId,
                          billable: false // Default to uncheck
                        }));
                      }}
                      disabled={!timeEntryForm.projectId}
                    >
                      <option value="">Select Task</option>
                      {availableTasks
                        .filter(task => {
                          const wd = timeEntryForm.workDate;
                          // Strict project filtering
                          if (!timeEntryForm.projectId || String(task.projectId) !== String(timeEntryForm.projectId)) {
                            return false;
                          }
                          // Date range filtering
                          if (task.startDate && wd) {
                            const taskStart = task.startDate.split('T')[0];
                            if (taskStart > wd) return false;
                          }
                          if (task.endDate && wd) {
                            const taskEnd = task.endDate.split('T')[0];
                            if (taskEnd < wd) return false;
                          }
                          return true;
                        })
                        .map((task) => (
                          <option key={task.id || task.taskId} value={String(task.id || task.taskId)}>
                            {task.taskName}
                          </option>
                        ))}
                    </select>
                  </div>

                  {(() => {
                    const selectedTask = availableTasks.find(t => String(t.id || t.taskId) === String(timeEntryForm.taskId));
                    const isTaskBillable = selectedTask?.isBillable !== false && timeEntryForm.taskId;
                    if (!isTaskBillable) return null;
                    return (
                      <div className="hr-time-field-group full-width" style={{ marginTop: '-4px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                          <div 
                            onClick={() => setTimeEntryForm(prev => ({ ...prev, billable: !prev.billable }))}
                            style={{ 
                              width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0,
                              backgroundColor: timeEntryForm.billable ? '#6366f1' : '#ffffff', 
                              border: timeEntryForm.billable ? '1px solid #6366f1' : '1.5px solid #cbd5e1', 
                              borderRadius: '4px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                          >
                            {timeEntryForm.billable && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            )}
                          </div>
                          <label onClick={() => setTimeEntryForm(prev => ({ ...prev, billable: !prev.billable }))} style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', cursor: 'pointer', marginBottom: 0 }}>This is a billable task</label>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="hr-time-field-group full-width">
                    <label>Description</label>
                    <textarea
                      className="hr-time-textarea"
                      value={timeEntryForm.description}
                      onChange={(e) => setTimeEntryForm({ ...timeEntryForm, description: e.target.value })}
                      placeholder="Describe your work..."
                      rows={6}
                      maxLength={1500}
                    />
                  </div>
                </div>
              </div>

              <div className="hr-time-modal-footer">
                <button type="button" className="hr-time-btn-cancel" onClick={() => setShowTimeEntryModal(false)}>
                  Cancel
                </button>
                {!timerState.isRunning && timeEntryForm.projectId && timeEntryForm.taskId && (
                  <button type="submit" className="hr-time-btn-submit" disabled={timesheetLoading}>
                    {timesheetLoading ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Loader2 className="animate-spin" size={16} /> {isDirectSubmit ? 'Submitting...' : 'Saving...'}
                      </div>
                    ) : (isDirectSubmit ? 'Submit' : 'Save Draft')}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Edit Entry Modal */}
      {
        showEditEntryModal && editingEntry && (
          <div className="hr-modal-overlay" onClick={() => setShowEditEntryModal(false)}>
            <div className="hr-time-modal hr-time-modal-lg" onClick={(e) => e.stopPropagation()}>
              <div className="hr-time-modal-header" style={{ padding: '20px 30px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Edit2 size={20} className="text-blue-500" /> 
                  {editingEntry._editMode === 'rejected' ? 'Edit Rejected Entry' : 'Edit Entry'}
                </h2>
                <button
                  className="hr-time-modal-close"
                  onClick={() => {
                    setShowEditEntryModal(false);
                    setEditingEntry(null);
                  }}
                  style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#f1f5f9' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Information banner - only for rejected entries */}


              <form onSubmit={(e) => e.preventDefault()}>
                <div className="hr-time-modal-body">
                  {/* Removed rejection reason from here as it is now in the view modal */}


                  <div className="hr-time-form-grid">
                    <div className="hr-time-field-group">
                      <label>Work Date *</label>
                      <input
                        type="date"
                        className="hr-time-input"
                        value={editEntryForm.workDate}
                        onChange={(e) => {
                          const newDate = e.target.value;
                          const holiday = isHoliday(newDate);
                          const leave = isApprovedLeave(newDate);
                          const shiftHours = calculateShiftHours();
                          
                          setEditEntryForm(prev => ({ 
                            ...prev, 
                            workDate: newDate,
                            description: (holiday && !prev.description) ? 'Holiday' : ((leave && !prev.description) ? 'Approved Leave' : prev.description),
                            hours: (holiday || leave) ? shiftHours.toString() : prev.hours,
                            workType: holiday ? 'HOLIDAY' : (leave ? 'LEAVE' : 'WORK')
                          }));
                        }}
                        required
                      />
                    </div>
                    <div className="hr-time-field-group">
                      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        Log In <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
                        {editEntryForm.clockIn && (
                          <span className="hr-time-format-preview">
                            <Clock size={10} /> {formatTimeTo12h(editEntryForm.clockIn)}
                          </span>
                        )}
                      </label>
                      <input
                        type="time"
                        step="60"
                        className="hr-time-input hr-time-input--time"
                        value={editEntryForm.clockIn || ''}
                        onChange={(e) => setEditEntryForm(prev => ({ ...prev, clockIn: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="hr-time-field-group">
                      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        Log Out <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
                        {editEntryForm.clockOut && (
                          <span className="hr-time-format-preview">
                            <Clock size={10} /> {formatTimeTo12h(editEntryForm.clockOut)}
                          </span>
                        )}
                      </label>
                      <input
                        type="time"
                        step="60"
                        className="hr-time-input hr-time-input--time"
                        value={editEntryForm.clockOut || ''}
                        onChange={(e) => setEditEntryForm(prev => ({ ...prev, clockOut: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="hr-time-field-group">
                      <label>Hours *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="hr-time-input"
                        value={editEntryForm.hours || ''}
                        onChange={(e) => setEditEntryForm(prev => ({ ...prev, hours: e.target.value }))}
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <div className="hr-time-field-group">
                      <label>Project</label>
                      <select
                        className="hr-time-select"
                        value={String(editEntryForm.projectId ?? '')}
                        onChange={(e) => {
                          const projectId = e.target.value;
                          setEditEntryForm({ ...editEntryForm, projectId, taskId: '' });
                          if (projectId) {
                            fetchTasksForProject(projectId);
                          } else {
                            setAvailableTasks([]);
                          }
                        }}
                      >
                        <option value="">Select Project</option>
                        {availableProjects.map((project) => (
                          <option key={project.id} value={String(project.id)}>
                            {project.projectName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-time-field-group">
                      <label>Task</label>
                      <select
                        className="hr-time-select"
                        value={String(editEntryForm.taskId ?? '')}
                        onChange={(e) => {
                          const selectedTaskId = e.target.value;
                          const selectedTask = availableTasks.find(t => String(t.id || t.taskId) === String(selectedTaskId));
                          setEditEntryForm(prev => ({
                            ...prev,
                            taskId: selectedTaskId,
                            billable: false // Default to uncheck
                          }));
                        }}
                        disabled={!editEntryForm.projectId}
                      >
                        <option value="">Select Task</option>
                        {availableTasks
                          .filter(task => {
                            const wd = editEntryForm.workDate;
                            if (!editEntryForm.projectId || String(task.projectId) !== String(editEntryForm.projectId)) return false;
                            if (task.startDate && wd) {
                              const taskStart = task.startDate.split('T')[0];
                              if (taskStart > wd) return false;
                            }
                            if (task.endDate && wd) {
                              const taskEnd = task.endDate.split('T')[0];
                              if (taskEnd < wd) return false;
                            }
                            return true;
                          })
                          .map((task) => (
                            <option key={task.id || task.taskId} value={String(task.id || task.taskId)}>
                              {task.taskName}
                            </option>
                          ))}
                      </select>
                    </div>

                    {(() => {
                      const selectedTask = availableTasks.find(t => String(t.id || t.taskId) === String(editEntryForm.taskId));
                      const isTaskBillable = selectedTask?.isBillable !== false && editEntryForm.taskId;
                      if (!isTaskBillable) return null;
                      return (
                        <div className="hr-time-field-group full-width" style={{ marginTop: '-4px', marginBottom: '16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <div 
                              onClick={() => setEditEntryForm(prev => ({ ...prev, billable: !prev.billable }))}
                              style={{ 
                                width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0,
                                backgroundColor: editEntryForm.billable ? '#6366f1' : '#ffffff', 
                                border: editEntryForm.billable ? '1px solid #6366f1' : '1.5px solid #cbd5e1', 
                                borderRadius: '4px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}
                            >
                              {editEntryForm.billable && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                              )}
                            </div>
                            <label onClick={() => setEditEntryForm(prev => ({ ...prev, billable: !prev.billable }))} style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', cursor: 'pointer', marginBottom: 0 }}>This is a billable task</label>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="hr-time-field-group full-width">
                      <label>Description</label>
                      <textarea
                        className="hr-time-textarea"
                        value={editEntryForm.description}
                        onChange={(e) => setEditEntryForm({ ...editEntryForm, description: e.target.value })}
                        placeholder="Describe your work..."
                        rows={6}
                      />
                    </div>
                  </div>
                </div>

                <div className="hr-time-modal-footer">
                  <button
                    type="button"
                    className="hr-time-btn-cancel"
                    onClick={() => {
                      setShowEditEntryModal(false);
                      setEditingEntry(null);
                    }}
                  >
                    Cancel
                  </button>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="hr-time-btn-submit"
                      onClick={(e) => handleUpdateEntry(e, editingEntry.status !== 'DRAFT')}
                      disabled={timesheetLoading}
                      style={{ minWidth: '140px' }}
                    >
                      {timesheetLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                          <Loader2 className="animate-spin" size={16} /> Saving...
                        </div>
                      ) : (
                        editingEntry.status === 'REJECTED' ? 'Update and Submit entry' : 
                        (editingEntry.status === 'PENDING' ? 'Update' : 'Update Entry')
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Leave Detail Modal */}
      {showLeaveDetailModal && selectedLeaveDetail && (() => {
        const code = getLeaveTypeCode(selectedLeaveDetail.leaveType);
        const limit = managerLimits[code];
        const totalDays = selectedLeaveDetail.totalDays || selectedLeaveDetail.duration || 0;
        const isLimitExceeded = limit !== null && limit !== undefined && totalDays > limit;

        // Approval Flow logic
        const managerStatus = (selectedLeaveDetail.managerStatus || 'PENDING').toUpperCase();
        const finalStatus = (selectedLeaveDetail.status || 'PENDING').toUpperCase();

        // Admin intervened if manager was skipped or admin acted while manager pending
        const isAdminIntervened = (managerStatus === 'SKIPPED' || (finalStatus !== 'PENDING' && managerStatus === 'PENDING'));

        // Final action was taken by manager if within limit (and not intervened)
        const isActionFinalizedByManager = managerStatus !== 'PENDING' && managerStatus !== 'SKIPPED' &&
          selectedLeaveDetail.adminResponse?.toLowerCase().includes('within limit');

        // Admin action is required if limit exceeded OR if admin intervened OR if admin specifically responded
        const isAdminActionRequired = isLimitExceeded || isAdminIntervened;
        const isAdminActionTaken = finalStatus !== 'PENDING' && !isActionFinalizedByManager;

        const isForwardedToHr = (selectedLeaveDetail.managerResponse && selectedLeaveDetail.managerResponse.toLowerCase().includes('forwarded directly to hr')) ||
          (selectedLeaveDetail.adminResponse && selectedLeaveDetail.adminResponse.toLowerCase().includes('forwarded directly to hr'));

        const getManagerStepProps = () => {
          if (isForwardedToHr) return { icon: <ArrowRight size={16} />, color: '#3b82f6', statusText: 'Forwarded to HR' };
          if (isAdminIntervened && managerStatus === 'PENDING') return { icon: <Clock size={16} />, color: '#9ca3af', statusText: 'Skipped' };
          if (managerStatus === 'SKIPPED') return { icon: <Clock size={16} />, color: '#9ca3af', statusText: 'Skipped' };
          if (managerStatus === 'APPROVED') return { icon: <CheckCircle size={16} />, color: '#10b981', statusText: 'Approved' };
          if (managerStatus === 'REJECTED') return { icon: <XCircle size={16} />, color: '#ef4444', statusText: 'Rejected' };
          return { icon: <Clock size={16} />, color: '#3b82f6', statusText: 'Pending' };
        };

        const getAdminStepProps = () => {
          if (finalStatus === 'APPROVED') return { icon: <CheckCircle size={16} />, color: '#10b981', statusText: 'Approved' };
          if (finalStatus === 'REJECTED') return { icon: <XCircle size={16} />, color: '#ef4444', statusText: 'Rejected' };
          if (isAdminActionRequired && finalStatus === 'PENDING') return { icon: <Clock size={16} />, color: '#3b82f6', statusText: 'Waiting' };
          return { icon: <Clock size={16} />, color: '#9ca3af', statusText: 'N/A' };
        };

        const managerStep = getManagerStepProps();
        const adminStep = getAdminStepProps();

        return (
          <div className="hr-modal-overlay" onClick={() => setShowLeaveDetailModal(false)}>
            <div className="hr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', width: '95%', borderRadius: '12px' }}>
              <div className="hr-modal-header" style={{ borderBottom: '1px solid #e5e7eb', padding: '10px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ backgroundColor: '#eff6ff', padding: '6px', borderRadius: '8px' }}>
                    <Calendar size={18} style={{ color: '#3b82f6' }} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#111827' }}>Leave Request Details</h2>
                    <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>ID: #{selectedLeaveDetail.id}</p>
                  </div>
                </div>
                <button className="hr-modal-close" onClick={() => setShowLeaveDetailModal(false)} style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
              </div>

              <div className="hr-modal-body" style={{ padding: '16px' }}>
                {/* Employee Info Section */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', backgroundColor: '#f9fafb', padding: '10px', borderRadius: '10px', border: '1px solid #f3f4f6' }}>
                  <img
                    src={`https://ui-avatars.com/api/?name=${selectedLeaveDetail.employeeName || (selectedLeaveDetail.employee?.firstName + ' ' + selectedLeaveDetail.employee?.lastName)}&background=6366f1&color=fff&size=128`}
                    style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }}
                    alt=""
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedLeaveDetail.employeeName || (selectedLeaveDetail.employee?.firstName + ' ' + selectedLeaveDetail.employee?.lastName)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '1px' }}>
                      {selectedLeaveDetail.employeeId || selectedLeaveDetail.employee?.employeeId || 'ID N/A'} {selectedLeaveDetail.department || selectedLeaveDetail.employee?.departmentName || 'No Dept'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: 600,
                      backgroundColor: selectedLeaveDetail.status === 'APPROVED' ? '#d1fae5' : selectedLeaveDetail.status === 'REJECTED' ? '#fee2e2' : '#fef3c7',
                      color: selectedLeaveDetail.status === 'APPROVED' ? '#065f46' : selectedLeaveDetail.status === 'REJECTED' ? '#991b1b' : '#92400e'
                    }}>
                      {selectedLeaveDetail.status || 'PENDING'}
                    </span>
                  </div>
                </div>

                {/* Request Highlights Grid - Compact */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                    <div style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '2px' }}>Leave Type</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{selectedLeaveDetail.leaveType || selectedLeaveDetail.leaveTypeName}</div>
                  </div>
                  <div style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                    <div style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '2px' }}>Duration</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{totalDays} {totalDays === 1 ? 'Day' : 'Days'}</div>
                  </div>
                  <div style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '2px' }}>Period</div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>
                      {selectedLeaveDetail.startDate} to {selectedLeaveDetail.endDate}
                    </div>
                  </div>
                </div>

                {/* Reason Section */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Reason</div>
                  <div style={{ backgroundColor: '#fff7ed', padding: '8px 10px', borderRadius: '6px', borderLeft: '3px solid #f97316', fontSize: '12px', color: '#4b5563', lineHeight: 1.4 }}>
                    {selectedLeaveDetail.reason || 'No reason provided.'}
                  </div>
                  {selectedLeaveDetail.supportingDocumentPath && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Supporting Document</div>
                      <a 
                        href={selectedLeaveDetail.supportingDocumentPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          color: '#3b82f6',
                          backgroundColor: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontWeight: 600,
                          textDecoration: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          marginTop: '6px',
                          width: 'fit-content'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#dbeafe'; }}
                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; }}
                      >
                        View Attachment
                      </a>
                    </div>
                  )}
                </div>

                {/* Approval Flow Section - Compact with Live Marks */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Approval Flow</span>
                    {isLimitExceeded && (
                      <span style={{ fontSize: '9px', color: '#ef4444', backgroundColor: '#fee2e2', padding: '1px 6px', borderRadius: '4px' }}>
                        Limit Exceeded
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', padding: '0 5px' }}>
                    {/* Connector Line */}
                    <div style={{ position: 'absolute', top: '16px', left: '30px', right: '30px', height: '1.5px', backgroundColor: '#e5e7eb', zIndex: 0 }}></div>

                    {/* Flow Steps */}
                    {[
                      { label: 'Employee', name: selectedLeaveDetail.employeeName || 'Employee', icon: <CheckCircle size={14} />, color: '#10b981', statusText: 'Submitted' },
                      {
                        label: 'Manager',
                        name: isForwardedToHr
                          ? (selectedLeaveDetail.managerName || 'Manager')
                          : ((managerStatus === 'SKIPPED' || isAdminIntervened)
                            ? 'N/A'
                            : (selectedLeaveDetail.managerName || extractApproverName(selectedLeaveDetail.managerResponse) || 'Manager')),
                        ...managerStep
                      },
                      ...(isAdminActionRequired || isAdminActionTaken ? [{
                        label: 'HR / Admin',
                        name:
                          selectedLeaveDetail.adminName
                            ? selectedLeaveDetail.adminName
                            : 'Admin',
                        ...adminStep
                      }] : [])
                    ].map((step, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, position: 'relative', flex: 1 }}>
                        <div style={{
                          backgroundColor: '#fff',
                          color: step.color,
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: `2px solid ${step.color}`,
                          marginBottom: '4px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          transition: 'all 0.3s ease'
                        }}>
                          {step.icon}
                        </div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#111827' }}>{step.label}</div>
                        <div style={{ fontSize: '8px', color: '#6b7280', maxWidth: '80px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '1px' }}>
                          {step.name}
                        </div>
                        <div style={{ fontSize: '8px', fontWeight: 700, color: step.color, textTransform: 'uppercase' }}>
                          {step.statusText}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="hr-modal-footer" style={{ borderTop: '1px solid #e5e7eb', padding: '10px 16px', backgroundColor: '#f9fafb', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    className="hr-btn-secondary"
                    onClick={() => setShowLeaveDetailModal(false)}
                    style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer' }}
                  >
                    Close
                  </button>
                  {selectedLeaveDetail.status === 'PENDING' && (
                    <>
                      <button
                        className="hr-btn-primary"
                        onClick={() => {
                          handleLeaveAction(selectedLeaveDetail.id, 'APPROVED');
                          setShowLeaveDetailModal(false);
                        }}
                        style={{ backgroundColor: '#10b981', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        <CheckCircle size={14} /> Approve
                      </button>
                      <button
                        className="hr-btn-primary"
                        onClick={() => {
                          handleLeaveAction(selectedLeaveDetail.id, 'REJECTED');
                          setShowLeaveDetailModal(false);
                        }}
                        style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        <XCircle size={14} /> Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      <style>
        {`
          .hr-time-modal-body::-webkit-scrollbar,
          .hr-modal-body::-webkit-scrollbar,
          .weekly-timesheet-scroll::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          .hr-time-modal-body::-webkit-scrollbar-track,
          .hr-modal-body::-webkit-scrollbar-track,
          .weekly-timesheet-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .hr-time-modal-body::-webkit-scrollbar-thumb,
          .hr-modal-body::-webkit-scrollbar-thumb,
          .weekly-timesheet-scroll::-webkit-scrollbar-thumb {
            background: #f1f1f1;
            border-radius: 10px;
          }
          /* Firefox */
          .hr-time-modal-body,
          .hr-modal-body,
          .weekly-timesheet-scroll {
            scrollbar-width: thin;
            scrollbar-color: #f1f1f1 transparent;
          }
          .time-office-page .hr-modal input[type="checkbox"].weekly-entry-checkbox,
          .hr-modal .weekly-timesheet-scroll input[type="checkbox"].weekly-entry-checkbox {
            width: 18px;
            height: 18px;
            min-width: 18px;
            min-height: 18px;
            margin: 0;
            cursor: pointer;
            accent-color: #2563eb;
            background-color: #ffffff !important;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            vertical-align: middle;
            appearance: auto;
            -webkit-appearance: checkbox;
          }
          [data-theme='dark'] .time-office-page .hr-modal input[type="checkbox"].weekly-entry-checkbox,
          [data-theme='dark'] .hr-modal .weekly-timesheet-scroll input[type="checkbox"].weekly-entry-checkbox {
            background-color: #ffffff !important;
            border-color: #94a3b8;
            accent-color: #2563eb;
          }
          .weekly-hours-input {
            width: 100%;
            min-width: 96px;
            padding: 6px 8px;
            font-size: 12px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            border-radius: 4px;
            border: 1px solid #d1d5db;
            text-align: center;
            background-color: #ffffff;
            color: #1e293b;
            letter-spacing: 0.02em;
          }
          .weekly-hours-input:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
          }
          .weekly-hours-input::placeholder {
            color: #94a3b8;
          }
          [data-theme='dark'] .weekly-hours-input {
            background-color: #ffffff !important;
            color: #1e293b !important;
          }
          .hr-time-modal-lg {
            max-width: 800px !important;
            width: 95% !important;
          }
          .hr-time-form-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            padding: 20px;
          }
          @media (max-width: 640px) {
            .hr-time-form-grid {
              grid-template-columns: 1fr;
            }
          }
          .hr-time-field-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-bottom: 0;
          }
          .hr-time-field-group.full-width {
            grid-column: 1 / -1;
          }
          .hr-time-field-group label {
            font-size: 12px;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .hr-time-input, .hr-time-select, .hr-time-textarea {
            width: 100%;
            padding: 10px 14px;
            border-radius: 10px;
            border: 1px solid #e2e8f0;
            background-color: #f8fafc;
            font-size: 14px;
            color: #1e293b;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            outline: none;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          }
          .hr-time-input:focus, .hr-time-select:focus, .hr-time-textarea:focus {
            border-color: #3b82f6;
            background-color: #fff;
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1), 0 4px 6px -1px rgba(0,0,0,0.1);
          }
          .hr-time-format-preview {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            font-weight: 700;
            color: #3b82f6;
            background: #eff6ff;
            padding: 2px 8px;
            border-radius: 6px;
            cursor: default;
            animation: fadeIn 0.2s ease-out;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-2px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .hr-time-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            grid-column: 1 / -1;
            background: #f1f5f9;
            padding: 16px;
            border-radius: 12px;
            margin-bottom: 10px;
          }
          @media (max-width: 900px) {
            .hr-time-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }
          @media (max-width: 520px) {
            .hr-time-grid {
              grid-template-columns: 1fr;
            }
          }
          .hr-time-modal .hr-time-input--time {
            background-color: #ffffff !important;
            color: #1e293b !important;
            color-scheme: light;
          }
          .hr-time-modal-header {
            padding: 20px 24px;
            background: linear-gradient(to right, #ffffff, #f8fafc);
            border-bottom: 1px solid #e2e8f0;
          }
          .hr-time-modal-header h2 {
            font-size: 18px;
            font-weight: 800;
            color: #1e293b;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .hr-time-modal-footer {
            padding: 16px 24px;
            background-color: #f8fafc;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            border-bottom-left-radius: 20px;
            border-bottom-right-radius: 20px;
          }
          .hr-time-btn-submit {
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            color: white;
            padding: 10px 24px;
            border-radius: 10px;
            font-weight: 700;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
            transition: all 0.2s;
          }
          .hr-time-btn-submit:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3);
          }
          .hr-time-btn-cancel {
            background: white;
            color: #64748b;
            padding: 10px 24px;
            border-radius: 10px;
            border: 1px solid #e2e8f0;
            font-weight: 600;
            font-size: 14px;
            transition: all 0.2s;
          }
          .hr-time-btn-cancel:hover {
            background: #f1f5f9;
            color: #475569;
          }
        `}
      </style>
      {timesheetModal && (() => {
        const { entry, projectName: mProj, timesheetData: mTs } = timesheetModal;
        const rawTask = entry.taskName || entry.task?.taskName || "General";
        const mTask = typeof rawTask === 'string' ? rawTask.replace(/_/g, ' ').toUpperCase() : rawTask;
        const mHours = (entry.isCancelled || entry.cancelled || entry.status === 'CANCELLED') ? 0 : (typeof entry.hours === "number" ? entry.hours : parseFloat(entry.hours) || 0);
        const mBillable = entry.billable !== false && entry.billable !== null;
        const s = (entry.isCancelled || entry.cancelled || entry.status === 'CANCELLED') ? "CANCELLED" : (entry.status || "DRAFT").toUpperCase();
        const mColors = s === "CANCELLED" ? { text: "#475569", label: "CANCELLED", badgeBg: "#e2e8f0", border: "#cbd5e1" } : s === "APPROVED" ? { text: "#065f46", label: "APPROVED", badgeBg: "#d1fae5", border: "#10b981" } : s === "REJECTED" ? { text: "#991b1b", label: "REJECTED", badgeBg: "#fee2e2", border: "#ef4444" } : (s === "SUBMITTED" || s === "PENDING") ? { text: "#92400e", label: "SUBMITTED", badgeBg: "#fef3c7", border: "#f59e0b" } : { text: "#1e40af", label: "DRAFT", badgeBg: "#dbeafe", border: "#3b82f6" };
        const isRej = s === "REJECTED";
        const isDraftE = s === "DRAFT";
        const isApprovedE = s === "APPROVED";
        const mDate = entry.workDate || entry.date || entry.entryDate;
        const hh = String(Math.floor(mHours)).padStart(2,"0");
        const mm = String(Math.round((mHours % 1) * 60)).padStart(2,"0");
        return (
          <div onClick={() => setTimesheetModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: 'blur(4px)' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "24px", width: "100%", maxWidth: "850px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", overflow: "hidden", display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}>
              <style>{`
                .entry-view-scroll {
                  scrollbar-width: thin;
                  scrollbar-color: #ffffff transparent;
                }
                .entry-view-scroll::-webkit-scrollbar {
                  width: 6px;
                }
                .entry-view-scroll::-webkit-scrollbar-track {
                  background: transparent;
                }
                .entry-view-scroll::-webkit-scrollbar-thumb {
                  background-color: #ffffff;
                  border-radius: 10px;
                  border: 1px solid #e2e8f0;
                }
              `}</style>
              <div style={{ height: "6px", background: mColors.border }} />
              
              <div style={{ padding: "20px 30px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: mColors.text, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>Time Entry Details</div>
                  <div style={{ fontWeight: 800, color: "#1e293b", fontSize: "18px", marginBottom: "4px", lineHeight: 1.2 }}>{mTask}</div>
                  <div style={{ fontSize: "13px", color: "#64748b", fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Info size={12} /> {mProj}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {mDate && <div style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8" }}>{new Date(mDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</div>}
                  <button 
                    onClick={() => setTimesheetModal(null)} 
                    style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: "10px", 
                      border: "1px solid #e2e8f0", 
                      background: "#fff", 
                      color: "#64748b", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center", 
                      cursor: "pointer", 
                      transition: 'all 0.2s',
                      padding: 0
                    }} 
                    className="hover:bg-slate-50"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", background: "#f8fafc", padding: '0 10px' }}>
                <div style={{ flex: 1, padding: "16px", textAlign: "center" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>Total Time</div>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: "#1e293b", fontFamily: "monospace", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Clock size={16} className="text-slate-400" /> {hh}:{mm}
                  </div>
                </div>
                <div style={{ width: '1px', background: '#e2e8f0', margin: '16px 0' }} />
                <div style={{ flex: 1, padding: "16px", textAlign: "center" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>Billable Status</div>
                  <span style={{ display: "inline-flex", padding: "4px 12px", borderRadius: "20px", background: mBillable ? "#dcfce7" : "#fef3c7", color: mBillable ? "#166534" : "#92400e", fontSize: "12px", fontWeight: 700 }}>{mBillable ? "Billable" : "Non-Billable"}</span>
                </div>
                <div style={{ width: '1px', background: '#e2e8f0', margin: '16px 0' }} />
                <div style={{ flex: 1, padding: "16px", textAlign: "center" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>Submission Status</div>
                  <span style={{ display: "inline-flex", padding: "4px 12px", borderRadius: "20px", background: mColors.badgeBg, color: mColors.text, fontSize: "12px", fontWeight: 700 }}>{mColors.label}</span>
                </div>
                {entry.halfDayType && (
                  <>
                    <div style={{ width: '1px', background: '#e2e8f0', margin: '16px 0' }} />
                    <div style={{ flex: 1, padding: "16px", textAlign: "center" }}>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>Leave Type</div>
                      <span style={{ display: "inline-flex", padding: "4px 12px", borderRadius: "20px", background: "#fef3c7", color: "#92400e", fontSize: "12px", fontWeight: 700 }}>
                        {entry.halfDayType === 'MORNING_HALF' ? 'Morning Half' : 
                         entry.halfDayType === 'AFTERNOON_HALF' ? 'Afternoon Half' : entry.halfDayType}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="entry-view-scroll" style={{ overflowY: 'auto', flex: 1, padding: '24px 30px' }}>
                {((isApprovedE && entry.approvedByName) || (isRej && entry.rejectedByName)) && (
                  <div style={{ padding: "14px 18px", background: isRej ? "#fef2f2" : "#f0fdf4", border: `1px solid ${isRej ? '#fca5a5' : '#bcf0da'}`, borderRadius: '14px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: isRej ? '#fee2e2' : '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isApprovedE ? <CheckCircle size={20} color="#166534" /> : <XCircle size={20} color="#991b1b" />}
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: isRej ? "#991b1b" : "#166534" }}>{isApprovedE ? "Approved" : "Rejected"} by Manager</div>
                      <div style={{ fontSize: "12px", color: isRej ? "#b91c1c" : "#15803d" }}>{isApprovedE ? entry.approvedByName : entry.rejectedByName}</div>
                      {isRej && entry.rejectionReason && (
                        <div style={{ 
                          marginTop: '10px', 
                          padding: '10px 14px', 
                          background: 'rgba(239, 68, 68, 0.05)', 
                          borderRadius: '8px', 
                          borderLeft: '3px solid #ef4444',
                          fontSize: '12px',
                          color: '#7f1d1d',
                          lineHeight: 1.5
                        }}>
                          <strong style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px', opacity: 0.8 }}>Manager's Feedback:</strong>
                          {entry.rejectionReason}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(entry.clockIn || entry.clockOut) && (
                  <div style={{ display: "flex", gap: '16px', marginBottom: '24px' }}>
                    <div style={{ flex: 1, padding: "14px", background: "#f8fafc", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Log In</div>
                      <div style={{ fontSize: "15px", fontWeight: 700, color: "#334155", display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Play size={14} className="text-blue-500" /> {formatTimeTo12h(entry.clockIn)}
                      </div>
                    </div>
                    <div style={{ flex: 1, padding: "14px", background: "#f8fafc", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Log Out</div>
                      <div style={{ fontSize: "15px", fontWeight: 700, color: "#334155", display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Square size={14} className="text-red-500" /> {formatTimeTo12h(entry.clockOut)}
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ position: 'relative' }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px", display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <List size={14} /> Description
                  </div>
                  <div style={{ 
                    fontSize: "13px", 
                    color: "#334155", 
                    lineHeight: 1.6, 
                    background: '#fff', 
                    padding: '16px 20px', 
                    borderRadius: '16px', 
                    border: '1px solid #f1f5f9',
                    whiteSpace: "pre-wrap"
                  }}>
                    {entry.description || <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>No description provided.</span>}
                  </div>
                </div>
              </div>

              {(!isAdmin || (isHR && hrDataView === "my-data")) && (isRej || isDraftE) && (
                <div style={{ padding: "20px 30px", background: "#f8fafc", borderTop: "1px solid #f1f5f9", display: "flex", gap: "12px" }}>
                  {isRej && (
                    <button 
                      onClick={() => { setTimesheetModal(null); handleEditRejectedEntry(entry, mTs); }} 
                      style={{ flex: 1, height: '44px', display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer", boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)' }}
                    >
                      <Edit2 size={16} /> Edit &amp; Resubmit
                    </button>
                  )}
                  {isDraftE && (
                    <>
                      <button 
                        onClick={() => { setTimesheetModal(null); handleEditDraftEntry(entry, mTs); }} 
                        style={{ flex: 1, height: '44px', display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", borderRadius: "12px", border: "1px solid #e2e8f0", background: "#fff", color: "#2563eb", fontSize: "14px", fontWeight: 700, cursor: "pointer", transition: 'all 0.2s' }}
                        className="hover:bg-blue-50"
                      >
                        <Edit2 size={16} /> Edit Entry
                      </button>
                      <button 
                        onClick={() => { setTimesheetModal(null); handleDeleteEntry(entry); }} 
                        style={{ flex: 1, height: '44px', display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", borderRadius: "12px", border: "1px solid #fee2e2", background: "#fff", color: "#ef4444", fontSize: "14px", fontWeight: 700, cursor: "pointer", transition: 'all 0.2s' }}
                        className="hover:bg-red-50"
                      >
                        <Trash2 size={16} /> Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}
      <LeaveHistoryImportModal 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)} 
        onImportSuccess={() => {
          fetchLeaveData();
          setShowImportModal(false);
        }}
      />

      {/* Custom Confirmation Modal */}
      {showSubmitConfirmModal && (
        <div className="hr-modal-overlay" style={{ zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }}>
          <div 
            className="hr-time-modal" 
            style={{ 
              maxWidth: '420px', 
              borderRadius: '24px', 
              overflow: 'hidden', 
              background: '#fff', 
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              transform: 'scale(1)',
              transition: 'transform 0.2s ease-out'
            }}
          >
            <div style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', padding: '28px 24px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.2)' }}>
                {submitConfirmData.type === 'delete' ? (
                  <Trash2 size={28} color="#ef4444" />
                ) : submitConfirmData.type === 'update' ? (
                  <Edit2 size={28} color="#3b82f6" />
                ) : (
                  <Send size={28} color="#3b82f6" />
                )}
              </div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#1e3a8a', letterSpacing: '-0.02em' }}>{submitConfirmData.title}</h3>
            </div>
            <div style={{ padding: '24px 32px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '15px', color: '#64748b', lineHeight: 1.6, fontWeight: 500 }}>{submitConfirmData.message}</p>
            </div>
            <div style={{ padding: '0 32px 32px', display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowSubmitConfirmModal(false)}
                style={{ flex: 1, height: '48px', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: '14px' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  if (submitConfirmData.action) await submitConfirmData.action();
                  setShowSubmitConfirmModal(false);
                }}
                disabled={timesheetLoading}
                style={{ 
                  flex: 1, height: '48px', borderRadius: '14px', border: 'none', 
                  background: submitConfirmData.type === 'delete' ? '#ef4444' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
                  color: '#fff', fontWeight: 700, cursor: timesheetLoading ? 'not-allowed' : 'pointer', fontSize: '14px',
                  boxShadow: submitConfirmData.type === 'delete' ? '0 4px 12px rgba(239, 68, 68, 0.2)' : '0 4px 12px rgba(59, 130, 246, 0.25)',
                  transition: 'all 0.2s',
                  opacity: timesheetLoading ? 0.8 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
                onMouseEnter={e => { if(!timesheetLoading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { if(!timesheetLoading) e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {timesheetLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Processing...
                  </>
                ) : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default Attendance;
