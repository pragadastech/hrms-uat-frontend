import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../contexts/ThemeContext';
import {
  Users, Building2, CheckCircle2, AlertCircle, Clock, Play, Square, CalendarDays,
  FileText, Bell, Trophy, Timer, MapPin, Home, Sun, Moon, Coffee, Calendar, CalendarClock, Loader2,
  Palmtree, CalendarCheck, Gift, CreditCard, ClipboardList, TrendingUp, UserPlus, FileSpreadsheet, Eye, Sparkles, Search,
  Cloud, CloudRain, CloudLightning
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  adminAPI, employeeAPI, timeEntryAPI, knowledgeAPI, organizationAPI, holidayCalendarAPI, noticeAPI,
  getAcceptedLeaveRequests, teamAPI, reportingAPI, wfhAPI, getPendingLeaveRequests, respondToLeaveRequest,
  complaintAPI, exitAPI, attendanceAPI, managerAnalyticsAPI
} from '../services/api';
import { formatTimeTo12h, formatDateLocal, resolveAttendanceClockTime } from '../utils/timeUtils';
import { toast } from 'react-hot-toast';
import Header from '../components/Header';
import HolidayBanner from '../components/HolidayBanner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import './Dashboard.css';
import './EmployeeDashboard.css';
import WeatherBackground from '../components/WeatherBackground';

// Helper functions for session management
const getSessionType = () => {
  const adminToken = window.safeSessionStorage.getItem('adminToken');
  const employeeToken = window.safeSessionStorage.getItem('employeeToken');

  if (adminToken) return 'admin';
  if (employeeToken) return 'employee';
  return null;
};

const getCurrentToken = () => {
  const sessionType = getSessionType();
  if (sessionType === 'admin') {
    return window.safeSessionStorage.getItem('adminToken');
  } else if (sessionType === 'employee') {
    return window.safeSessionStorage.getItem('employeeToken');
  }
  return null;
};

const isWithinNextDays = (dateStr, days = 7) => {
  if (!dateStr) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.floor((target - now) / (1000 * 60 * 60 * 24));
  return diff >= 0 && diff <= days;
};

const getHolidayDate = (h) => h?.date ?? h?.holidayDate ?? h?.holiday_date;
const getHolidayName = (h) => h?.name ?? h?.holidayName ?? h?.holiday_name ?? h?.title ?? 'Holiday';
const isInCurrentMonth = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};
const isOnOrAfterToday = (dateStr) => {
  if (!dateStr) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return target >= now;
};
const formatHolidayDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTodayHours = (v) => {
  if (v == null || v === '') return '0:00';
  const s = String(v).trim();
  const parts = s.split(':');
  if (parts.length >= 2) return `${parts[0]}:${parts[1].padStart(2, '0')}`;
  return s;
};

const daysUntilNextOccurrence = (dateStr) => {
  if (!dateStr) return Infinity;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const parsed = new Date(dateStr);
  // Reconstruct in local time to avoid UTC shifts
  let next = new Date(now.getFullYear(), parsed.getMonth(), parsed.getDate());
  
  if (next < today) {
    next.setFullYear(now.getFullYear() + 1);
  }
  
  const diffTime = next.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

// Deterministic avatar color from name
const AVATAR_COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#10b981', '#e11d48', '#0ea5e9'];
const getAvatarColor = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

/** Normalize clock times from AttendanceDto (string) or TimeEntryDto (LocalDateTime / formatted). */
const formatDashboardClock = (record, direction = 'in') => {
  if (!record) return '--:--';
  const formatted = direction === 'in'
    ? record.clockInTimeFormatted
    : record.clockOutTimeFormatted;
  if (formatted) return formatTimeTo12h(formatted);
  const raw = resolveAttendanceClockTime(record, direction);
  return raw === '--:--' ? '--:--' : formatTimeTo12h(raw);
};

const isManagerUser = (user) => {
  if (!user) return false;
  const roles = (user.roles || []).map((r) => String(r).trim().toUpperCase());
  const roleName = String(user.employeeRoleName || user.role?.name || user.role || '').trim().toUpperCase();
  return roles.includes('MANAGER') || roleName === 'MANAGER' || roles.includes('HR') || roleName === 'HR' || roles.includes('CEO') || roleName === 'CEO';
};

const isHrRoleUser = (account) => {
  if (!account) return false;
  if (account.roles && Array.isArray(account.roles)) {
    return account.roles.some((role) => ['HR', 'CEO'].includes(String(role).trim().toUpperCase()));
  }
  const roleValue = account.employeeRoleName || account.role?.name || account.role;
  return roleValue && ['HR', 'CEO'].includes(String(roleValue).trim().toUpperCase());
};

const resolveClockEmployeeId = (account) => account?.employeeId || account?.employee_id || null;

const readStoredEmployeeAccount = () => {
  try {
    const raw = window.safeSessionStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const Dashboard = () => {
  const { user, logout, hasAdminAccess: isAdmin, sessionType: authSessionType, getCurrentUser, hasDashboardWidget, hasModule } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const currentAccount = getCurrentUser() || user;
  const storedEmployeeAccount = readStoredEmployeeAccount();
  const isHR = isHrRoleUser(user) || isHrRoleUser(currentAccount) || isHrRoleUser(storedEmployeeAccount);
  const [clockEmployeeId, setClockEmployeeId] = useState(
    () => resolveClockEmployeeId(user) || resolveClockEmployeeId(currentAccount) || resolveClockEmployeeId(storedEmployeeAccount)
  );
  const shouldShowPersonalClock = !!clockEmployeeId;

  // Realtime Weather State, Info and Detection
  const [weatherType, setWeatherType] = useState('sunny');
  const [weatherInfo, setWeatherInfo] = useState({
    temp: null,
    condition: 'Clear Sky',
    locationName: 'Local'
  });

  const getWeatherTypeFromCode = (code) => {
    if (code === undefined || code === null) return 'sunny';
    if (code === 0 || code === 1) return 'sunny';
    if (code === 2 || code === 3) return 'cloudy';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rainy';
    if (code >= 95 && code <= 99) return 'thunderstorm';
    return 'sunny';
  };

  const getWeatherDescFromCode = (code) => {
    if (code === 0) return 'Clear Sky';
    if (code === 1 || code === 2 || code === 3) return 'Partly Cloudy';
    if (code === 45 || code === 48) return 'Foggy';
    if (code === 51 || code === 53 || code === 55) return 'Drizzle';
    if (code === 61 || code === 63 || code === 65) return 'Rainy';
    if (code === 80 || code === 81 || code === 82) return 'Rain Showers';
    if (code === 95 || code === 96 || code === 99) return 'Thunderstorm';
    return 'Sunny';
  };

  const handleManualWeather = (type) => {
    setWeatherType(type);
    let conditionName = 'Clear Sky';
    if (type === 'cloudy') conditionName = 'Partly Cloudy';
    if (type === 'rainy') conditionName = 'Rainy';
    if (type === 'thunderstorm') conditionName = 'Thunderstorm';
    setWeatherInfo(prev => ({ ...prev, condition: conditionName }));
  };



  // Helper function to format time
  const formatTime = (timeValue) => {
    if (!timeValue) return '';
    if (typeof timeValue === 'string') return timeValue.substring(0, 5);
    if (timeValue && typeof timeValue === 'object') {
      const hours = String(timeValue.hour || 0).padStart(2, '0');
      const minutes = String(timeValue.minute || 0).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    return '';
  };

  // Cache utilities to prevent re-loading on every mount
  const getCached = (key, def) => {
    try {
      const val = window.safeSessionStorage.getItem(`dash_${key}`);
      return val ? JSON.parse(val) : def;
    } catch { return def; }
  };
  const setCache = (key, val) => window.safeSessionStorage.setItem(`dash_${key}`, JSON.stringify(val));

  const [stats, setStats] = useState(() => getCached('stats', {
    totalEmployees: 0,
    activeEmployees: 0,
    departments: 0,
    totalSalary: 0,
  }));
  const [kbPosts, setKbPosts] = useState([]);
  const [organizationData, setOrganizationData] = useState(null);
  const [upcomingHolidays, setUpcomingHolidays] = useState([]);
  const [activeHolidays, setActiveHolidays] = useState(() => getCached('activeHolidays', []));
  const [activeNotices, setActiveNotices] = useState(() => getCached('notices', []));
  const [upcomingBirthdays, setUpcomingBirthdays] = useState([]);
  const [upcomingAnniversaries, setUpcomingAnniversaries] = useState([]);
  const [whosOutToday, setWhosOutToday] = useState([]);
  
  // Admin-specific dashboard states
  const [employees, setEmployees] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [pendingWfhs, setPendingWfhs] = useState([]);
  const [pendingComplaints, setPendingComplaints] = useState([]);
  const [pendingExits, setPendingExits] = useState([]);
  const [pendingExpenses, setPendingExpenses] = useState([]);
  const [clockedInEmployees, setClockedInEmployees] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(() => getCached('todayAttendance', []));
  const [teamAttendanceToday, setTeamAttendanceToday] = useState(() => getCached('teamAttendanceToday', []));
  const [adminNotices, setAdminNotices] = useState([]);
  const [activeChartTab, setActiveChartTab] = useState('presence');
  const [celebrationTab, setCelebrationTab] = useState('birthdays');
  const [adminLoading, setAdminLoading] = useState(false);
  const [directorySearch, setDirectorySearch] = useState('');
  const [selectedDirectoryEmployee, setSelectedDirectoryEmployee] = useState(null);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticePriority, setNoticePriority] = useState('NORMAL');
  const [submittingNotice, setSubmittingNotice] = useState(false);

  const [sessionInfo, setSessionInfo] = useState({
    loginTime: null,
    sessionDuration: '0:00:00',
    lastActivity: null,
    userRole: '',
    sessionType: '',
    isActive: true,
    lastLogin: null
  });
  // Only set initial loading to true if we have no cached critical data
  const [loading, setLoading] = useState(!window.safeSessionStorage.getItem('dash_stats') && !window.safeSessionStorage.getItem('dash_leaveBalances'));
  const [error, setError] = useState('');
  const [timeStatus, setTimeStatus] = useState(() => getCached('timeStatus', {
    isClockedIn: false,
    currentEntry: null,
    lastClockIn: null,
    lastClockOut: null,
    lastClockInFormatted: null,
    lastClockOutFormatted: null,
    todayHours: '0:00:00',
    elapsedTime: '0:00:00',
    completedHours: 0
  }));
  const [timeLoading, setTimeLoading] = useState(false);
  const [leaveBalances, setLeaveBalances] = useState(() => getCached('leaveBalances', []));
  const [recentLeaveHistory, setRecentLeaveHistory] = useState(() => getCached('recentLeaveHistory', []));
  const [requestsCount, setRequestsCount] = useState(() => getCached('requestsCount', 0));
  const [weeklyProgress, setWeeklyProgress] = useState(() => getCached('weeklyProgress', {
    worked: 0,
    target: 40,
    percent: 0
  }));
  const [weeklyBase, setWeeklyBase] = useState(() => Number(window.safeSessionStorage.getItem('dash_weeklyBase') || 0));
  const [activeLeaveTab, setActiveLeaveTab] = useState('Annual');

  // Confirmation dialog states
  const [showClockInDialog, setShowClockInDialog] = useState(false);
  const [showClockOutDialog, setShowClockOutDialog] = useState(false);
  const [selectedWorkLocation, setSelectedWorkLocation] = useState('OFFICE');

  // Location states
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  useEffect(() => {
    const resolveClockId = async () => {
      const directId =
        resolveClockEmployeeId(user) ||
        resolveClockEmployeeId(currentAccount) ||
        resolveClockEmployeeId(storedEmployeeAccount);
      if (directId) {
        setClockEmployeeId(directId);
        return;
      }
      if (!isAdmin()) return;
      try {
        const res = await timeEntryAPI.getMyStatus();
        if (res.data?.employeeId) {
          setClockEmployeeId(res.data.employeeId);
        }
      } catch (error) {
        console.warn('Could not resolve linked employee for admin clock:', error);
      }
    };
    resolveClockId();
  }, [user, currentAccount, isAdmin, storedEmployeeAccount]);

  // Time Entry Functions
  const fetchTimeStatus = async () => {
    if (!clockEmployeeId) return;

    try {
      let currentResponse;
      if (isAdmin()) {
        currentResponse = await timeEntryAPI.getMyStatus();
      } else {
        try {
          currentResponse = await timeEntryAPI.getCurrentStatus(clockEmployeeId);
        } catch (_) {
          currentResponse = await timeEntryAPI.getMyStatus();
        }
      }
      const currentEntry = currentResponse.data;

      let isClockedIn = false;
      let lastClockIn = null;
      let lastClockOut = null;

      if (currentEntry) {
        if (currentEntry.clockInTime && !currentEntry.clockOutTime) {
          isClockedIn = true;
          lastClockIn = currentEntry.clockInTime;
        } else if (currentEntry.clockInTime && currentEntry.clockOutTime) {
          isClockedIn = false;
          lastClockIn = currentEntry.clockInTime;
          lastClockOut = currentEntry.clockOutTime;
        }
      }

      const completedHours = parseFloat(currentEntry?.totalHours) || 0;
      let displayTodayHours = `${Math.floor(completedHours)}:${String(Math.floor((completedHours % 1) * 60)).padStart(2, '0')}`;

      try {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;
        const entriesRes = await timeEntryAPI.getEmployeeTimeEntries(clockEmployeeId, todayStr, todayStr);
        const entries = entriesRes?.data || [];
        if (Array.isArray(entries) && entries.length > 0) {
          const totalMins = entries.reduce((acc, e) => {
            const dur = e.durationMinutes ?? e.duration ?? e.totalHours;
            if (e.durationMinutes != null && typeof e.durationMinutes === 'number') return acc + e.durationMinutes;
            if (typeof dur === 'number') return acc + dur * 60; // assume hours
            if (typeof dur === 'string' && dur.includes(':')) {
              const [h, m, s] = dur.split(':').map(Number);
              return acc + (h || 0) * 60 + (m || 0) + (s || 0) / 60;
            }
            return acc;
          }, 0);
          const h = Math.floor(totalMins / 60);
          const min = Math.floor(totalMins % 60);
          displayTodayHours = `${h}:${String(min).padStart(2, '0')}`;
        }
      } catch (_) { }

      const initialElapsed = calculateElapsedTime(isClockedIn ? lastClockIn : null, completedHours, !isClockedIn);

      const newStatus = {
        isClockedIn,
        currentEntry,
        lastClockIn,
        lastClockOut,
        lastClockInFormatted: currentEntry?.clockInTimeFormatted || formatTimeTo12h(currentEntry?.clockInTime),
        lastClockOutFormatted: currentEntry?.clockOutTimeFormatted || formatTimeTo12h(currentEntry?.clockOutTime),
        todayHours: displayTodayHours,
        completedHours,
        elapsedTime: initialElapsed
      };
      setTimeStatus(prev => ({ ...prev, ...newStatus }));
      setCache('timeStatus', { ...timeStatus, ...newStatus });
    } catch (error) {
      console.error('Error fetching time status:', error);
    }
  };

  const getUserLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }
      setIsGettingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
          setUserLocation(location);
          setIsGettingLocation(false);
          resolve(location);
        },
        (error) => {
          setIsGettingLocation(false);
          reject(new Error('Unable to retrieve location'));
        }
      );
    });
  };

  const handleClockInClick = () => setShowClockInDialog(true);
  const handleClockOutClick = () => setShowClockOutDialog(true);

  const handleClockInConfirm = async () => {
    if (!clockEmployeeId) return;
    setTimeLoading(true);
    setShowClockInDialog(false);
    try {
      let latitude = null, longitude = null;
      if (selectedWorkLocation === 'OFFICE') {
        const loc = await getUserLocation();
        latitude = loc.latitude;
        longitude = loc.longitude;
      }
      await timeEntryAPI.clockIn(clockEmployeeId, latitude, longitude, selectedWorkLocation);
      toast.success('Successfully clocked in!');
      await fetchTimeStatus();
      if (isAdmin()) await fetchAdminDashboardData();
    } catch (error) {
      console.error('Clock-in error:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to clock in';
      toast.error(errorMessage);
      setError(errorMessage);
    } finally {
      setTimeLoading(false);
    }
  };

  const handleClockOutConfirm = async () => {
    if (!clockEmployeeId) return;
    setTimeLoading(true);
    setShowClockOutDialog(false);
    try {
      let latitude = null, longitude = null;
      if (timeStatus.currentEntry?.workLocation === 'OFFICE') {
        const loc = await getUserLocation();
        latitude = loc.latitude;
        longitude = loc.longitude;
      }
      await timeEntryAPI.clockOut(clockEmployeeId, latitude, longitude);
      toast.success('Successfully clocked out!');
      await fetchTimeStatus();
      if (isAdmin()) await fetchAdminDashboardData();
    } catch (error) {
      console.error('Clock-out error:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to clock out';
      toast.error(errorMessage);
      setError(errorMessage);
    } finally {
      setTimeLoading(false);
    }
  };

  const calculateElapsedTime = (clockInTime = null, baseHours = 0, forceClockedOut = false) => {
    const timeToUse = clockInTime || timeStatus.lastClockIn;
    const baseMs = (baseHours || timeStatus.completedHours || 0) * 3600 * 1000;
    const isClockedOutToday = forceClockedOut || (timeStatus.lastClockOut && !timeStatus.isClockedIn);
    if (!timeToUse || isClockedOutToday) {
      if (baseMs <= 0) return '0:00:00';
      const h = Math.floor(baseMs / 3600000), m = Math.floor((baseMs % 3600000) / 60000), s = Math.floor((baseMs % 60000) / 1000);
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    const diff = new Date().getTime() - new Date(timeToUse).getTime();
    const totalMs = baseMs + (diff > 0 ? diff : 0);
    const h = Math.floor(totalMs / 3600000), m = Math.floor((totalMs % 3600000) / 60000), s = Math.floor((totalMs % 60000) / 1000);
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const calculateSessionDuration = (startTime) => {
    if (!startTime) return '0:00:00';
    const diff = new Date() - new Date(startTime);
    if (diff < 0) return '0:00:00';
    const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const calculateUpcomingEvents = (empList) => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDate = today.getDate();

    // Birthday calculation
    const birthdays = empList
      .filter(e => e.dateOfBirth && e.isActive)
      .map(e => {
        const dob = new Date(e.dateOfBirth);
        let nextBday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
        if (nextBday < new Date(today.getFullYear(), currentMonth, currentDate)) {
          nextBday.setFullYear(today.getFullYear() + 1);
        }
        const diffTime = nextBday - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return { ...e, daysRemaining: diffDays, eventDate: dob };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 5);
    setUpcomingBirthdays(birthdays);

    // Anniversaries calculation
    const anniversaries = empList
      .filter(e => e.joiningDate && e.isActive)
      .map(e => {
        const join = new Date(e.joiningDate);
        let nextAnniv = new Date(today.getFullYear(), join.getMonth(), join.getDate());
        if (nextAnniv < new Date(today.getFullYear(), currentMonth, currentDate)) {
          nextAnniv.setFullYear(today.getFullYear() + 1);
        }
        const diffTime = nextAnniv - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const years = today.getFullYear() - join.getFullYear() + (nextAnniv.getFullYear() > today.getFullYear() ? -1 : 0);
        return { ...e, daysRemaining: diffDays, years, eventDate: join };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 5);
    setUpcomingAnniversaries(anniversaries);
  };

  const fetchAdminDashboardData = async () => {
    if (!isAdmin()) return;
    setAdminLoading(true);
    try {
      const today = formatDateLocal(new Date());
      const [empRes, leavesRes, wfhRes, clockedInRes, noticesRes, attendanceRes] = await Promise.allSettled([
        adminAPI.getAllEmployees(),
        getPendingLeaveRequests(),
        wfhAPI.getPending(),
        timeEntryAPI.getCurrentlyClockedInEmployees(),
        noticeAPI.getAllNotices(),
        attendanceAPI.getDailyAttendance(today),
      ]);

      const empData = empRes.status === 'fulfilled' ? (empRes.value.data?.employees || empRes.value.data || []) : [];
      setEmployees(empData);
      
      const s = {
        totalEmployees: empData.length,
        activeEmployees: empData.filter(e => e.isActive).length,
        departments: [...new Set(empData.map(e => e.departmentName || e.department).filter(Boolean))].length,
        totalSalary: empData.reduce((acc, e) => acc + (e.salary || 0), 0)
      };
      setStats(s);
      setCache('stats', s);

      const leavesData = leavesRes.status === 'fulfilled' ? (leavesRes.value.leaveRequests || leavesRes.value.data || leavesRes.value || []) : [];
      setPendingLeaves(leavesData);

      const wfhData = wfhRes.status === 'fulfilled' ? (wfhRes.value.data || wfhRes.value || []) : [];
      setPendingWfhs(wfhData);

      const clockedInRaw = clockedInRes.status === 'fulfilled' ? (clockedInRes.value.data || clockedInRes.value || []) : [];
      const clockedIn = clockedInRaw.map((c) => ({
        ...c,
        clockInDisplay: formatDashboardClock(c, 'in'),
        clockOutDisplay: c.clockOutTime || c.clockOutTimeFormatted ? formatDashboardClock(c, 'out') : 'Live',
      }));
      setClockedInEmployees(clockedIn);

      const attendanceList = attendanceRes.status === 'fulfilled'
        ? (attendanceRes.value.data?.attendance || attendanceRes.value.data || [])
        : [];
      const normalizedAttendance = (Array.isArray(attendanceList) ? attendanceList : [])
        .map((record) => ({
          ...record,
          employeeName: record.employeeName
            || (record.firstName && record.lastName ? `${record.firstName} ${record.lastName}` : null)
            || record.employeeId
            || 'Employee',
          clockInDisplay: formatDashboardClock(record, 'in'),
          clockOutDisplay: formatDashboardClock(record, 'out'),
        }))
        .filter((record) => {
          const status = String(record.status || '').toUpperCase();
          return record.clockInDisplay !== '--:--' || status === 'PRESENT' || status === 'WFH';
        })
        .sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''));
      setTodayAttendance(normalizedAttendance);
      setCache('todayAttendance', normalizedAttendance);

      const noticesData = noticesRes.status === 'fulfilled' ? (noticesRes.value.data || noticesRes.value || []) : [];
      setAdminNotices(noticesData);

      calculateUpcomingEvents(empData);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setAdminLoading(false);
    }
  };

  const fetchTeamAttendanceForDashboard = async () => {
    if (!shouldShowPersonalClock && isAdmin()) return;
    if (!clockEmployeeId && !isAdmin()) return;
    try {
      const today = formatDateLocal(new Date());
      let records = [];

      if (isManagerUser(user)) {
        try {
          const overviewRes = await managerAnalyticsAPI.getOverview();
          const members = overviewRes.data?.members || [];
          if (members.length > 0) {
            records = members.map((m) => ({
              ...m,
              employeeName: m.name || m.employeeId,
              clockInDisplay: formatDashboardClock(m, 'in'),
              clockOutDisplay: formatDashboardClock(m, 'out'),
              status: m.todayStatus || m.status,
            }));
          }
        } catch (_) {
          // fall through to team-attendance API
        }
      }

      if (records.length === 0) {
        const teamRes = await teamAPI.getTeamAttendance(clockEmployeeId, today);
        const teamMembers = teamRes.data?.teamMembers || teamRes.data?.attendance || teamRes.data || [];
        if (Array.isArray(teamMembers) && teamMembers.length > 0) {
          records = teamMembers.map((m) => ({
            ...m,
            employeeName: m.employeeName
              || (m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : null)
              || m.employeeId
              || 'Employee',
            clockInDisplay: formatDashboardClock(m, 'in'),
            clockOutDisplay: formatDashboardClock(m, 'out'),
          }));
        }
      }

      setTeamAttendanceToday(records);
      setCache('teamAttendanceToday', records);
    } catch (err) {
      console.error('Error fetching team attendance for dashboard:', err);
      setTeamAttendanceToday([]);
    }
  };

  const handleRespondLeave = async (requestId, status) => {
    try {
      await respondToLeaveRequest(requestId, {
        status,
        response: `${status.charAt(0) + status.slice(1).toLowerCase()} by Admin`
      });
      toast.success(`Leave request ${status.toLowerCase()} successfully`);
      fetchAdminDashboardData();
    } catch (err) {
      console.error('Error responding to leave:', err);
      toast.error(err.response?.data?.message || 'Failed to respond to leave request');
    }
  };

  const handleRespondWfh = async (requestId, status) => {
    try {
      await wfhAPI.respond(requestId, {
        status,
        response: `${status.charAt(0) + status.slice(1).toLowerCase()} by Admin`
      });
      toast.success(`WFH request ${status.toLowerCase()} successfully`);
      fetchAdminDashboardData();
    } catch (err) {
      console.error('Error responding to WFH:', err);
      toast.error(err.response?.data?.message || 'Failed to respond to WFH request');
    }
  };

  const handlePublishNotice = async (e) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeContent.trim()) {
      toast.error('Title and content are required');
      return;
    }
    setSubmittingNotice(true);
    try {
      const payload = {
        title: noticeTitle.trim(),
        content: noticeContent.trim(),
        category: 'ANNOUNCEMENT',
        priority: noticePriority,
        pinned: noticePriority === 'URGENT' || noticePriority === 'HIGH',
        active: true
      };
      await noticeAPI.createNotice(payload);
      toast.success('Announcement broadcasted successfully');
      setNoticeTitle('');
      setNoticeContent('');
      setNoticePriority('NORMAL');
      fetchAdminDashboardData();
    } catch (err) {
      console.error('Error broadcasting notice:', err);
      toast.error(err.response?.data?.message || 'Failed to publish announcement');
    } finally {
      setSubmittingNotice(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Only show spinner if we have no cached data at all
        const hasCache = window.safeSessionStorage.getItem('dash_stats') || window.safeSessionStorage.getItem('dash_leaveBalances');
        if (!hasCache) setLoading(true);
        if (isAdmin()) {
          await fetchAdminDashboardData();
        }
        const holRes = await holidayCalendarAPI.getActiveHolidays();
        const holidays = holRes?.data || [];
        setActiveHolidays(holidays);
        setCache('activeHolidays', holidays);

        const notRes = await noticeAPI.getActiveNotices();
        const notices = notRes?.data || [];
        setActiveNotices(notices);
        setCache('notices', notices);
        if (shouldShowPersonalClock) {
          await fetchTimeStatus();
        }
        if (!isAdmin() || shouldShowPersonalClock) {
          await fetchTeamAttendanceForDashboard();
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isAdmin, user, shouldShowPersonalClock, clockEmployeeId]);

  useEffect(() => {
    const fetchLeaveAndRequests = async () => {
      if (!clockEmployeeId || !shouldShowPersonalClock) return;
      try {
        // 1. Fetch Leave Balances & History
        const balanceRes = await reportingAPI.getLeaveBalanceReport({ search: clockEmployeeId, year: new Date().getFullYear().toString() });
        const reqRes = await employeeAPI.getEmployeeLeaveRequests();
        const allLeaveRequests = (reqRes.data || reqRes.leaveRequests || []);
        
        // Update history (show last 3)
        setRecentLeaveHistory(allLeaveRequests.slice(0, 3));
        setCache('recentLeaveHistory', allLeaveRequests.slice(0, 3));

        // Update balances
        const emp = (balanceRes.data?.data || []).find(e => String(e.employeeId).toLowerCase() === String(clockEmployeeId).toLowerCase());
        if (emp?.leaveBalances) {
          const filteredBalances = emp.leaveBalances.filter(lb => (lb.leaveTypeCode || '').toUpperCase() !== 'WFH');
          setLeaveBalances(filteredBalances);
          setCache('leaveBalances', filteredBalances);
          // Set default active tab to first available
          if (filteredBalances.length > 0 && (activeLeaveTab === 'Annual' || !activeLeaveTab)) {
            setActiveLeaveTab(filteredBalances[0].leaveTypeName || filteredBalances[0].leaveTypeCode);
          }
        }

        // 2. Fetch Requests Count (Pending Leave + Pending WFH + Pending Expenses)
        const pendingLeaves = allLeaveRequests.filter(r => ['PENDING', 'MANAGER_APPROVED', 'HR_APPROVED'].includes(String(r.status).toUpperCase())).length;
        
        let pendingWfh = 0;
        try {
          const wfhRes = await wfhAPI.getEmployeeRequests();
          pendingWfh = (wfhRes.data || []).filter(r => String(r.status).toUpperCase() === 'PENDING').length;
        } catch (e) {}

        let pendingExpenses = 0;
        try {
          const expRes = await employeeAPI.getMyExpenses();
          pendingExpenses = (expRes.data || []).filter(r => String(r.status).toUpperCase() === 'PENDING').length;
        } catch (e) {}

        const cnt = pendingLeaves + pendingWfh + pendingExpenses;
        setRequestsCount(cnt);
        setCache('requestsCount', cnt);

      } catch (e) {
        console.error('Error fetching dashboard extra data:', e);
      }
    };
    fetchLeaveAndRequests();
  }, [clockEmployeeId, shouldShowPersonalClock]);

  useEffect(() => {
    const fetchWeekly = async () => {
      if (!clockEmployeeId || !shouldShowPersonalClock) return;
      try {
        const now = new Date(), first = now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1);
        const mon = new Date(now.setDate(first)), sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const res = await timeEntryAPI.getEmployeeTimeEntries(clockEmployeeId, fmt(mon), fmt(sun));
        const completedTotal = (res.data || []).reduce((acc, e) => acc + (e.totalHours || 0), 0);
        
        // Save base completed hours for the week
        setCache('weeklyCompletedTotal', completedTotal);
        
        // Initial set
        let currentSessionHours = 0;
        if (timeStatus.isClockedIn && timeStatus.lastClockIn) {
          currentSessionHours = (new Date() - new Date(timeStatus.lastClockIn)) / (3600 * 1000);
        }
        
        const total = completedTotal + currentSessionHours;
        setWeeklyBase(completedTotal);
        window.safeSessionStorage.setItem('dash_weeklyBase', completedTotal);
        const wp = { worked: Math.round(total * 10) / 10, target: 40, percent: Math.min(100, Math.round((total / 40) * 100)) };
        setWeeklyProgress(wp);
        setCache('weeklyProgress', wp);
      } catch (e) { console.error(e); }
    };
    fetchWeekly();
  }, [clockEmployeeId, shouldShowPersonalClock, timeStatus.todayHours]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (timeStatus.isClockedIn && timeStatus.lastClockIn) {
        setTimeStatus(prev => ({ ...prev, elapsedTime: calculateElapsedTime(prev.lastClockIn, prev.completedHours) }));
        
        // Live Weekly Progress
        const currentSession = (new Date() - new Date(timeStatus.lastClockIn)) / (3600 * 1000);
        const total = weeklyBase + currentSession;
        setWeeklyProgress(prev => ({ 
          ...prev, 
          worked: Math.round(total * 10) / 10, 
          percent: Math.min(100, Math.round((total / prev.target) * 100)) 
        }));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [timeStatus.isClockedIn, timeStatus.lastClockIn]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good Morning', icon: <Sun size={20} /> };
    if (hour < 17) return { text: 'Good Afternoon', icon: <Sun size={20} /> };
    return { text: 'Good Evening', icon: <Moon size={20} /> };
  };

  const getCurrentDate = () => ({
    day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
    date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  });

  const parseElapsedTime = () => {
    const parts = (timeStatus.elapsedTime || '0:00:00').split(':');
    return { hours: parts[0] || '00', minutes: parts[1] || '00', seconds: parts[2] || '00' };
  };

  const quickActions = [
    { icon: <CalendarDays size={24} />, title: 'Leave Request', desc: 'Apply for time off', path: isAdmin() ? '/admin/leaves' : '/employee/leaves', color: '#3b82f6', module: 'LEAVE_MANAGEMENT' },
    { icon: <CalendarClock size={24} />, title: 'Attendance', desc: 'View your timesheet', path: isAdmin() ? '/admin/attendance' : '/employee/attendance', color: '#10b981', module: 'ATTENDANCE' },
    { icon: <Calendar size={24} />, title: 'Holidays', desc: 'Check calendar', path: isAdmin() ? '/admin/holidays' : '/employee/holidays', color: '#f59e0b', module: 'HOLIDAYS' },
    { icon: <FileText size={24} />, title: 'Payslips', desc: 'View payslips', path: isAdmin() ? '/admin/payroll' : '/employee/payslips', color: '#8b5cf6', module: 'PAYROLL' },
  ].filter((a) => !a.module || hasModule(a.module));

  const isAdminView = isAdmin();
  const greeting = getGreeting();
  const currentDate = getCurrentDate();

  const adminDisplayName = (() => {
    const currentUser = getCurrentUser();
    if (currentUser?.firstName) return `${currentUser.firstName} ${currentUser.lastName || ''}`.trim();
    return currentUser?.name || 'Administrator';
  })();

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-loading">
          <div className="dashboard-loading-content">
            <div className="spinner"></div>
            <p className="dashboard-loading-text">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // Final Render
  return (
    <div className="dashboard-page">
      <Header
        title={isAdminView ? 'Dashboard' : undefined}
        greeting={!isAdminView ? greeting.text : undefined}
        greetingSubtitle={!isAdminView ? `${currentDate.day}, ${currentDate.date}` : undefined}
        subtitle={isAdminView ? `${currentDate.day}, ${currentDate.date}` : undefined}
      />
      {isAdminView ? (
        <div className="page-content dashboard-scroll">
        <div className="dashboard-container admin-dashboard">
          <div className="dashboard-hero admin-hero-premium" style={{ position: 'relative', overflow: 'hidden' }}>
            <div className="dashboard-hero-pattern"></div>
            <div className="dashboard-container-inner" style={{ position: 'relative', zIndex: 2 }}>
              <div className="dashboard-hero-content">
                <div className="dashboard-hero-left">
                  <div className="hg-group" style={{ marginBottom: '12px' }}>
                    <div className="hg">
                      <span className="hg-icon">{greeting.icon}</span>
                      <span>{greeting.text}</span>
                    </div>
                  </div>
                  <h1 className="dashboard-welcome-title">
                    Welcome back, {adminDisplayName}
                  </h1>
                  <p className="dashboard-welcome-date" style={{ marginBottom: 0 }}>{currentDate.day}, {currentDate.date}</p>
                </div>
                <div className="dashboard-hero-right">
                  {shouldShowPersonalClock && (
                    <div className="admin-hr-clock">
                      <div className="admin-hr-clock-top">
                        <span className={`admin-hr-clock-pill ${timeStatus.isClockedIn ? 'in' : 'out'}`}>
                          {timeStatus.isClockedIn ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                          {timeStatus.isClockedIn ? 'Clocked In' : 'Not Clocked In'}
                        </span>
                        <span className="admin-hr-clock-location">
                          <MapPin size={13} />
                          {timeStatus.currentEntry?.workLocation || 'Office'}
                        </span>
                      </div>
                      <div className="admin-hr-clock-times">
                        <div>
                          <span className="admin-hr-clock-label">Check In</span>
                          <span className="admin-hr-clock-value">{timeStatus.lastClockInFormatted || '--:--'}</span>
                        </div>
                        <div>
                          <span className="admin-hr-clock-label">Check Out</span>
                          <span className="admin-hr-clock-value">
                            {timeStatus.lastClockOutFormatted && timeStatus.lastClockOutFormatted !== '--:--'
                              ? timeStatus.lastClockOutFormatted
                              : (timeStatus.isClockedIn ? 'Live' : '--:--')}
                          </span>
                        </div>
                        <div>
                          <span className="admin-hr-clock-label">Today</span>
                          <span className="admin-hr-clock-value">{formatTodayHours(timeStatus.todayHours)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`admin-hr-clock-btn ${timeStatus.isClockedIn ? 'out' : 'in'}`}
                        onClick={timeStatus.isClockedIn ? handleClockOutClick : handleClockInClick}
                        disabled={timeLoading}
                      >
                        {timeLoading ? <Loader2 className="animate-spin" size={16} /> : (timeStatus.isClockedIn ? <Square size={16} /> : <Play size={16} />)}
                        {timeStatus.isClockedIn ? 'Clock Out' : 'Clock In'}
                      </button>
                    </div>
                  )}
                  <div className="quick-stats-mini">
                    <div className="mini-stat-item">
                      <span className="mini-stat-label">Active Presence</span>
                      <span className="mini-stat-value">
                        {clockedInEmployees.length} / {stats.totalEmployees}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-main-content">
            {/* KPI Cards Grid */}
            {hasDashboardWidget('ORG_STATS') && (
            <div className="dashboard-admin-stats">
              {[
                { 
                  label: 'Total Strength', 
                  value: stats.totalEmployees, 
                  icon: <Users size={24} />, 
                  color: '#6366f1', 
                  desc: `${stats.activeEmployees} active profiles` 
                },
                { 
                  label: 'Active Presence', 
                  value: clockedInEmployees.length, 
                  icon: <Clock size={24} />, 
                  color: '#10b981', 
                  desc: 'Clocked in today',
                  isPulse: clockedInEmployees.length > 0 
                },
                { 
                  label: 'Pending Approvals', 
                  value: pendingLeaves.length + pendingWfhs.length, 
                  icon: <AlertCircle size={24} />, 
                  color: '#f59e0b', 
                  desc: `${pendingLeaves.length} leaves, ${pendingWfhs.length} WFH` 
                },
                { 
                  label: 'Active Notices', 
                  value: adminNotices.length, 
                  icon: <Bell size={24} />, 
                  color: '#8b5cf6', 
                  desc: 'Notice board announcements' 
                },
              ].map((stat, idx) => (
                <div key={idx} className="dashboard-card dashboard-stat-card-premium">
                  <div className="stat-card-header">
                    <div className="stat-icon-wrapper" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
                      {stat.icon}
                    </div>
                    {stat.isPulse && <span className="stat-pulse-dot"></span>}
                  </div>
                  <div className="stat-card-body">
                    <p className="stat-value-large">{stat.value}</p>
                    <p className="stat-label-text">{stat.label}</p>
                    <p className="stat-desc-text">{stat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            )}

            {/* Analytics Section & Quick Actions */}
            <div className="dashboard-grid-two-column">
              {hasDashboardWidget('ATTENDANCE_SUMMARY') && (
              <div className="dashboard-card analytics-chart-card">
                <div className="analytics-card-header">
                  <div className="analytics-title-group">
                    <TrendingUp size={20} className="text-primary" />
                    <h3>Analytics Center</h3>
                  </div>
                  <div className="analytics-tab-group">
                    <button 
                      className={`analytics-tab-btn ${activeChartTab === 'presence' ? 'active' : ''}`}
                      onClick={() => setActiveChartTab('presence')}
                    >
                      Presence
                    </button>
                    <button 
                      className={`analytics-tab-btn ${activeChartTab === 'departments' ? 'active' : ''}`}
                      onClick={() => setActiveChartTab('departments')}
                    >
                      Departments
                    </button>
                    <button 
                      className={`analytics-tab-btn ${activeChartTab === 'hiring' ? 'active' : ''}`}
                      onClick={() => setActiveChartTab('hiring')}
                    >
                      Hiring Trends
                    </button>
                  </div>
                </div>

                <div className="analytics-chart-container" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '260px' }}>
                  {((activeChartTab === 'presence' && (stats.totalEmployees || 0) === 0) ||
                    (activeChartTab === 'departments' && employees.length === 0)) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--db-color-text-muted)', fontSize: '13px' }}>
                      <TrendingUp size={28} style={{ marginBottom: 8, opacity: 0.5, color: '#6366f1' }} />
                      <span>No active data available for this chart.</span>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      {activeChartTab === 'presence' ? (
                        <PieChart>
                          <Pie
                            data={(() => {
                              const office = clockedInEmployees.filter(c => c.workLocation === 'OFFICE').length;
                              const wfh = clockedInEmployees.filter(c => c.workLocation === 'WORK_FROM_HOME').length;
                              const total = stats.totalEmployees || 0;
                              const present = office + wfh;
                              const absent = Math.max(0, total - present);
                              return [
                                { name: 'Office', value: office, color: '#6366f1' },
                                { name: 'WFH / Remote', value: wfh, color: '#10b981' },
                                { name: 'Absent / Leave', value: absent, color: '#ef4444' }
                              ].filter(item => item.value > 0);
                            })()}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={85}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {(() => {
                              const office = clockedInEmployees.filter(c => c.workLocation === 'OFFICE').length;
                              const wfh = clockedInEmployees.filter(c => c.workLocation === 'WORK_FROM_HOME').length;
                              const total = stats.totalEmployees || 0;
                              const present = office + wfh;
                              const absent = Math.max(0, total - present);
                              return [
                                { name: 'Office', value: office, color: '#6366f1' },
                                { name: 'WFH / Remote', value: wfh, color: '#10b981' },
                                { name: 'Absent / Leave', value: absent, color: '#ef4444' }
                              ].filter(item => item.value > 0);
                            })().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [`${value} Employees`, 'Count']} />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        </PieChart>
                      ) : activeChartTab === 'departments' ? (
                        <BarChart data={(() => {
                          const deptMap = {};
                          employees.forEach(e => {
                            const dept = e.departmentName || e.department || 'Unassigned';
                            deptMap[dept] = (deptMap[dept] || 0) + 1;
                          });
                          return Object.entries(deptMap).map(([name, count]) => ({ name, count }));
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--db-color-text-muted)', fontSize: 11 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--db-color-text-muted)', fontSize: 11 }} />
                          <Tooltip cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} formatter={(value) => [`${value} Members`, 'Headcount']} />
                          <Bar dataKey="count" fill="url(#deptColor)" radius={[4, 4, 0, 0]}>
                            <Cell fill="#6366f1" />
                          </Bar>
                          <defs>
                            <linearGradient id="deptColor" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.2}/>
                            </linearGradient>
                          </defs>
                        </BarChart>
                      ) : (
                        <AreaChart data={(() => {
                          const monthlyHires = {};
                          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                          const now = new Date();
                          for (let i = 5; i >= 0; i--) {
                            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                            monthlyHires[monthNames[d.getMonth()]] = 0;
                          }
                          employees.forEach(e => {
                            if (e.joiningDate) {
                              const joinDate = new Date(e.joiningDate);
                              const monthStr = monthNames[joinDate.getMonth()];
                              if (monthlyHires[monthStr] !== undefined) {
                                monthlyHires[monthStr] += 1;
                              }
                            }
                          });
                          return Object.entries(monthlyHires).map(([name, count]) => ({ name, count }));
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--db-color-text-muted)', fontSize: 11 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--db-color-text-muted)', fontSize: 11 }} />
                          <Tooltip formatter={(value) => [`${value} Onboarded`, 'Joins']} />
                          <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#hiringColor)" />
                          <defs>
                            <linearGradient id="hiringColor" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0}/>
                            </linearGradient>
                          </defs>
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
              )}

              {/* Quick Actions Panel */}
              {hasDashboardWidget('QUICK_ACTIONS') && (
              <div className="dashboard-card quick-actions-panel">
                <div className="panel-header">
                  <Sparkles size={20} style={{ color: '#f59e0b' }} />
                  <h3>Admin Action Hub</h3>
                </div>
                <div className="quick-actions-grid-premium">
                  {[
                    { icon: <UserPlus size={22} />, title: 'Add Employee', desc: 'Onboard member', path: '/admin/employees/add', color: '#6366f1', module: 'EMPLOYEE_MANAGEMENT' },
                    { icon: <ClipboardList size={22} />, title: 'Leave Board', desc: 'Manage time-off', path: '/admin/leaves', color: '#f59e0b', module: 'LEAVE_MANAGEMENT' },
                    { icon: <Clock size={22} />, title: 'Time Office', desc: 'Manage check-ins', path: '/admin/time-office', color: '#10b981', module: 'ATTENDANCE' },
                    { icon: <Bell size={22} />, title: 'Create Notice', desc: 'Push announcement', path: '/admin/notices', color: '#8b5cf6', module: 'NOTICES' },
                  ].filter((action) => !action.module || hasModule(action.module)).map((action, idx) => (
                    <button type="button" key={idx} className="quick-action-item-premium" onClick={() => navigate(action.path)}>
                      <div className="action-item-icon" style={{ backgroundColor: `${action.color}15`, color: action.color }}>
                        {action.icon}
                      </div>
                      <div className="action-item-text">
                        <h4>{action.title}</h4>
                        <p>{action.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                
                {/* Active Presence Feed */}
                <div className="presence-feed-section">
                  <div className="presence-feed-header">
                    <h4>On Site Today</h4>
                    <span className="presence-count-tag">{clockedInEmployees.length} Online</span>
                  </div>
                  <div className="presence-avatars-list">
                    {clockedInEmployees.length > 0 ? (
                      clockedInEmployees.slice(0, 6).map((c, idx) => (
                        <div key={idx} className="presence-avatar-bubble" title={`${c.employeeName || 'Employee'} — In: ${c.clockInDisplay || '--:--'}`}>
                          <img 
                            src={c.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.employeeName || 'E')}&background=10b981&color=fff`} 
                            alt={c.employeeName} 
                          />
                          <span className={`location-dot ${c.workLocation === 'WORK_FROM_HOME' ? 'wfh' : 'office'}`}></span>
                        </div>
                      ))
                    ) : (
                      <p className="no-presence-text">No active check-ins recorded today.</p>
                    )}
                    {clockedInEmployees.length > 6 && (
                      <div className="presence-avatar-more">+{clockedInEmployees.length - 6}</div>
                    )}
                  </div>

                  {todayAttendance.length > 0 && (
                    <div className="dash-attendance-list">
                      <div className="dash-attendance-list-header">
                        <span>Employee</span>
                        <span>Check In</span>
                        <span>Check Out</span>
                      </div>
                      <div className="dash-attendance-list-body">
                        {todayAttendance.slice(0, 8).map((record, idx) => (
                          <div key={record.employeeId || idx} className="dash-attendance-row">
                            <span className="dash-att-name" title={record.employeeName}>{record.employeeName}</span>
                            <span className="dash-att-time">{record.clockInDisplay}</span>
                            <span className="dash-att-time dash-att-out">
                              {record.clockOutDisplay !== '--:--' ? record.clockOutDisplay : (String(record.status || '').toUpperCase() === 'PRESENT' ? 'Live' : '--:--')}
                            </span>
                          </div>
                        ))}
                      </div>
                      {todayAttendance.length > 8 && (
                        <button type="button" className="dash-attendance-more" onClick={() => navigate('/admin/attendance')}>
                          View all {todayAttendance.length} records →
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Directory Lookup Widget */}
                <div className="directory-search-section">
                  <div className="directory-search-header">
                    <h4>Directory Lookup</h4>
                    <Search size={16} style={{ color: 'var(--db-color-text-muted)' }} />
                  </div>
                  <div className="directory-search-input-wrapper">
                    <input 
                      type="text" 
                      placeholder="Search employee name or department..." 
                      value={directorySearch} 
                      onChange={(e) => setDirectorySearch(e.target.value)} 
                    />
                  </div>
                  {directorySearch && (
                    <div className="directory-results-dropdown">
                      {employees.filter(e => {
                        const fullName = `${e.firstName || ''} ${e.lastName || ''}`.toLowerCase();
                        const dept = (e.departmentName || e.department || '').toLowerCase();
                        const q = directorySearch.toLowerCase();
                        return fullName.includes(q) || dept.includes(q);
                      }).length > 0 ? (
                        employees.filter(e => {
                          const fullName = `${e.firstName || ''} ${e.lastName || ''}`.toLowerCase();
                          const dept = (e.departmentName || e.department || '').toLowerCase();
                          const q = directorySearch.toLowerCase();
                          return fullName.includes(q) || dept.includes(q);
                        }).slice(0, 5).map(emp => (
                          <div key={emp.id || emp.employeeId} className="directory-result-item" onClick={() => setSelectedDirectoryEmployee(emp)}>
                            <img src={emp.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.firstName + ' ' + emp.lastName)}&background=6366f1&color=fff`} alt={emp.firstName} />
                            <div className="directory-result-info">
                              <h5>{emp.firstName} {emp.lastName}</h5>
                              <p>{emp.departmentName || emp.department || 'Staff'} • {emp.positionTitle || emp.jobTitle || 'Member'}</p>
                            </div>
                            <span className={`status-badge-dot ${emp.isActive ? 'active' : 'inactive'}`}></span>
                          </div>
                        ))
                      ) : (
                        <p className="no-results-text">No matches found</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>

            {/* Bottom Actions Feed & Engagement */}
            <div className="dashboard-grid-two-column">
              {/* Left Column: Approvals Feed */}
              {hasDashboardWidget('PENDING_APPROVALS') && (
              <div className="dashboard-card feed-card">
                <div className="feed-card-header">
                  <ClipboardList size={20} className="text-primary" />
                  <h3>Pending Approval Inbox</h3>
                </div>
                <div className="feed-items-container">
                  {pendingLeaves.length === 0 && pendingWfhs.length === 0 ? (
                    <div className="feed-empty-state">
                      <div className="check-success-badge">
                        <CheckCircle2 size={40} style={{ color: '#10b981' }} />
                      </div>
                      <h4>All Caught Up!</h4>
                      <p>There are no leave or work-from-home requests pending your approval.</p>
                    </div>
                  ) : (
                    <div className="feed-requests-list">
                      {pendingLeaves.map((request) => (
                        <div key={`leave-${request.id}`} className="feed-request-item leave-request-item">
                          <div className="request-user-info">
                            <img 
                              className="request-avatar"
                              src={request.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(request.employeeName || 'Leave')}&background=6366f1&color=fff`} 
                              alt={request.employeeName} 
                            />
                            <div className="request-user-details">
                              <h5 className="request-user-name">{request.employeeName || 'Employee'}</h5>
                              <p className="request-user-role">{request.departmentName || 'Department'}</p>
                            </div>
                            <span className="request-type-badge leave">Leave</span>
                          </div>
                          <div className="request-content">
                            <p className="request-date-range">
                              <CalendarDays size={14} style={{ marginRight: '6px' }} />
                              {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                            </p>
                            {request.reason && <p className="request-reason-text">"{request.reason}"</p>}
                          </div>
                          <div className="request-actions">
                            <button 
                              className="btn-respond approve" 
                              onClick={() => handleRespondLeave(request.id, 'APPROVED')}
                            >
                              Approve
                            </button>
                            <button 
                              className="btn-respond reject" 
                              onClick={() => handleRespondLeave(request.id, 'REJECTED')}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}

                      {pendingWfhs.map((request) => (
                        <div key={`wfh-${request.id}`} className="feed-request-item wfh-request-item">
                          <div className="request-user-info">
                            <img 
                              className="request-avatar"
                              src={request.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(request.employeeName || 'WFH')}&background=10b981&color=fff`} 
                              alt={request.employeeName} 
                            />
                            <div className="request-user-details">
                              <h5 className="request-user-name">{request.employeeName || 'Employee'}</h5>
                              <p className="request-user-role">{request.departmentName || 'Department'}</p>
                            </div>
                            <span className="request-type-badge wfh">WFH</span>
                          </div>
                          <div className="request-content">
                            <p className="request-date-range">
                              <CalendarDays size={14} style={{ marginRight: '6px' }} />
                              {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                            </p>
                            {request.reason && <p className="request-reason-text">"{request.reason}"</p>}
                          </div>
                          <div className="request-actions">
                            <button 
                              className="btn-respond approve" 
                              onClick={() => handleRespondWfh(request.id, 'APPROVED')}
                            >
                              Approve
                            </button>
                            <button 
                              className="btn-respond reject" 
                              onClick={() => handleRespondWfh(request.id, 'REJECTED')}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* Right Column: Engagement & Notices */}
              {(hasDashboardWidget('BIRTHDAYS') || hasDashboardWidget('NOTICES')) && (
              <div className="dashboard-card engagement-card">
                <div className="engagement-tabs-header">
                  {hasDashboardWidget('BIRTHDAYS') && (
                  <button 
                    className={`engagement-tab-btn ${celebrationTab === 'birthdays' ? 'active' : ''}`}
                    onClick={() => setCelebrationTab('birthdays')}
                  >
                    Birthdays
                  </button>
                  )}
                  {hasDashboardWidget('BIRTHDAYS') && (
                  <button 
                    className={`engagement-tab-btn ${celebrationTab === 'anniversaries' ? 'active' : ''}`}
                    onClick={() => setCelebrationTab('anniversaries')}
                  >
                    Anniversaries
                  </button>
                  )}
                  {hasDashboardWidget('NOTICES') && (
                  <button 
                    className={`engagement-tab-btn ${celebrationTab === 'notices' ? 'active' : ''}`}
                    onClick={() => setCelebrationTab('notices')}
                  >
                    Notice Board
                  </button>
                  )}
                </div>

                <div className="engagement-tab-content">
                  {celebrationTab === 'birthdays' && (
                    <div className="celebrations-list">
                      {upcomingBirthdays.length > 0 ? (
                        upcomingBirthdays.map((emp, idx) => (
                          <div key={idx} className="celebration-item-premium">
                            <div className="celebration-user">
                              <img 
                                src={emp.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.firstName + ' ' + emp.lastName)}&background=6366f1&color=fff`} 
                                alt={emp.firstName} 
                              />
                              <div>
                                <h5>{emp.firstName} {emp.lastName}</h5>
                                <p>{emp.positionTitle || emp.jobTitle || 'Team Member'}</p>
                              </div>
                            </div>
                            <div className="celebration-countdown">
                              <Gift size={16} style={{ color: '#ec4899', marginRight: '6px' }} />
                              <span>{emp.daysRemaining === 0 ? 'Today' : `In ${emp.daysRemaining} days`}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="no-events-text">No upcoming birthdays in the next 30 days.</p>
                      )}
                    </div>
                  )}

                  {celebrationTab === 'anniversaries' && (
                    <div className="celebrations-list">
                      {upcomingAnniversaries.length > 0 ? (
                        upcomingAnniversaries.map((emp, idx) => (
                          <div key={idx} className="celebration-item-premium">
                            <div className="celebration-user">
                              <img 
                                src={emp.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.firstName + ' ' + emp.lastName)}&background=10b981&color=fff`} 
                                alt={emp.firstName} 
                              />
                              <div>
                                <h5>{emp.firstName} {emp.lastName}</h5>
                                <p>{emp.positionTitle || emp.jobTitle || 'Team Member'}</p>
                              </div>
                            </div>
                            <div className="celebration-countdown">
                              <Trophy size={16} style={{ color: '#f59e0b', marginRight: '6px' }} />
                              <span>{emp.years} yr{emp.years > 1 ? 's' : ''} ({emp.daysRemaining === 0 ? 'Today' : `In ${emp.daysRemaining}d`})</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="no-events-text">No work anniversaries in the next 30 days.</p>
                      )}
                    </div>
                  )}

                  {celebrationTab === 'notices' && (
                    <div className="notices-tab-content-wrapper">
                      <div className="notices-list-premium">
                        {adminNotices.length > 0 ? (
                          adminNotices.slice(0, 3).map((notice) => (
                            <div key={notice.id} className="notice-item-premium">
                              <div className="notice-item-header">
                                <h5>{notice.title}</h5>
                                <span className={`priority-badge ${notice.priority?.toLowerCase() || 'medium'}`}>
                                  {notice.priority || 'Medium'}
                                </span>
                              </div>
                              <p className="notice-item-excerpt">
                                {notice.content?.substring(0, 90) || ''}...
                              </p>
                              <span className="notice-item-date">
                                {new Date(notice.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="no-events-text">No recent announcements posted.</p>
                        )}
                      </div>

                      {/* Inline Announcement Broadcasting Form */}
                      <form onSubmit={handlePublishNotice} className="dashboard-inline-notice-form">
                        <h4 className="inline-form-title"><Bell size={16} aria-hidden /> Broadcast Announcement</h4>
                        <div className="inline-form-group">
                          <input 
                            type="text" 
                            placeholder="Announcement title..." 
                            required 
                            value={noticeTitle}
                            onChange={(e) => setNoticeTitle(e.target.value)}
                          />
                        </div>
                        <div className="inline-form-group">
                          <textarea 
                            placeholder="Detailed message..." 
                            required 
                            rows={2}
                            value={noticeContent}
                            onChange={(e) => setNoticeContent(e.target.value)}
                          />
                        </div>
                        <div className="inline-form-actions">
                          <select 
                            value={noticePriority}
                            onChange={(e) => setNoticePriority(e.target.value)}
                          >
                            <option value="LOW">Low Priority</option>
                            <option value="NORMAL">Normal Priority</option>
                            <option value="HIGH">High Priority</option>
                            <option value="URGENT">Urgent Priority</option>
                          </select>
                          <button type="submit" className="btn-broadcast" disabled={submittingNotice}>
                            {submittingNotice ? 'Publishing...' : 'Broadcast'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
        </div>
      ) : (
        <div className="page-content dashboard-scroll">
        <EmployeeDashboardView 
          elapsed={parseElapsedTime()}
          name={(() => {
            const currentUser = getCurrentUser();
            if (!currentUser) return 'User';
            const isGenericAdmin = (currentUser.firstName === 'Admin' && currentUser.lastName === 'user') || (currentUser.name === 'Admin user');
            if ((currentUser.firstName || currentUser.lastName) && !isGenericAdmin) {
              return `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'User';
            }
            return currentUser.name || currentUser.fullName || 'User';
          })()}
          greeting={getGreeting()}
          currentDate={getCurrentDate()}
          timeStatus={timeStatus}
          handleClockOutClick={handleClockOutClick}
          handleClockInClick={handleClockInClick}
          timeLoading={timeLoading}
          navigate={navigate}
          weeklyProgress={weeklyProgress}
          formatTodayHours={formatTodayHours}
          activeLeaveTab={activeLeaveTab}
          setActiveLeaveTab={setActiveLeaveTab}
          leaveBalances={leaveBalances}
          recentLeaveHistory={recentLeaveHistory}
          user={user}
          activeHolidays={activeHolidays}
          weatherType={weatherType}
          setWeatherType={setWeatherType}
          weatherInfo={weatherInfo}
          setWeatherInfo={setWeatherInfo}
          teamAttendanceToday={teamAttendanceToday}
        />
        </div>
      )}

      {/* Shared Modals */}
      {typeof window !== 'undefined' && createPortal(
          <>
            {showClockInDialog && (
              <div className="dashboard-dialog-overlay" onClick={() => setShowClockInDialog(false)}>
                <div className="dashboard-dialog" onClick={e => e.stopPropagation()}>
                  <div className="dashboard-dialog-header">
                    <div className="dashboard-dialog-icon dashboard-dialog-icon-success"><Play size={32} style={{ color: '#22c55e' }} /></div>
                    <h2 className="dashboard-dialog-title">Start Your Day</h2>
                  </div>
                  <div className="dashboard-dialog-content">
                    <p className="dashboard-dialog-text">Select your work location to clock in</p>
                    <div className="dashboard-radio-group">
                      <label className={`dashboard-radio-option ${selectedWorkLocation === 'OFFICE' ? 'dashboard-radio-selected' : ''}`} onClick={() => setSelectedWorkLocation('OFFICE')}>
                        <input type="radio" value="OFFICE" checked={selectedWorkLocation === 'OFFICE'} readOnly />
                        <div className="dashboard-radio-content"><MapPin size={24} style={{ color: '#3b82f6' }} /><div><p className="dashboard-radio-title">Office</p><p className="dashboard-radio-desc">Location will be recorded</p></div></div>
                      </label>
                      <label className={`dashboard-radio-option ${selectedWorkLocation === 'WORK_FROM_HOME' ? 'dashboard-radio-selected' : ''}`} onClick={() => setSelectedWorkLocation('WORK_FROM_HOME')}>
                        <input type="radio" value="WORK_FROM_HOME" checked={selectedWorkLocation === 'WORK_FROM_HOME'} readOnly />
                        <div className="dashboard-radio-content"><Home size={24} style={{ color: '#f59e0b' }} /><div><p className="dashboard-radio-title">Home</p><p className="dashboard-radio-desc">Remote work session</p></div></div>
                      </label>
                    </div>
                  </div>
                  <div className="dashboard-dialog-actions">
                    <button className="dashboard-dialog-btn dashboard-dialog-btn-cancel" onClick={() => setShowClockInDialog(false)}>Cancel</button>
                    <button className="dashboard-dialog-btn dashboard-dialog-btn-primary" onClick={handleClockInConfirm} disabled={timeLoading}>Clock In</button>
                  </div>
                </div>
              </div>
            )}
            {showClockOutDialog && (
               <div className="dashboard-dialog-overlay" onClick={() => setShowClockOutDialog(false)}>
                <div className="dashboard-dialog" onClick={e => e.stopPropagation()}>
                  <div className="dashboard-dialog-header">
                    <div className="dashboard-dialog-icon dashboard-dialog-icon-danger"><Square size={32} style={{ color: '#ef4444' }} /></div>
                    <h2 className="dashboard-dialog-title">End Session</h2>
                  </div>
                  <div className="dashboard-dialog-content"><p className="dashboard-dialog-text">Are you sure you want to clock out?</p></div>
                  <div className="dashboard-dialog-actions">
                    <button className="dashboard-dialog-btn dashboard-dialog-btn-cancel" onClick={() => setShowClockOutDialog(false)}>Cancel</button>
                    <button className="dashboard-dialog-btn dashboard-dialog-btn-danger" onClick={handleClockOutConfirm} disabled={timeLoading}>Clock Out</button>
                  </div>
                </div>
              </div>
            )}
            {selectedDirectoryEmployee && (
              <div className="dashboard-dialog-overlay" onClick={() => setSelectedDirectoryEmployee(null)}>
                <div className="dashboard-dialog directory-detail-modal" onClick={e => e.stopPropagation()}>
                  <div className="directory-modal-banner"></div>
                  <div className="directory-modal-avatar-row">
                    <img 
                      src={selectedDirectoryEmployee.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedDirectoryEmployee.firstName + ' ' + selectedDirectoryEmployee.lastName)}&background=6366f1&color=fff`} 
                      alt={selectedDirectoryEmployee.firstName} 
                      className="directory-modal-avatar"
                    />
                    <div className="directory-modal-user-title">
                      <h3>{selectedDirectoryEmployee.firstName} {selectedDirectoryEmployee.lastName}</h3>
                      <p>{selectedDirectoryEmployee.positionTitle || selectedDirectoryEmployee.jobTitle || 'Team Member'}</p>
                    </div>
                    <span className={`status-pill ${selectedDirectoryEmployee.isActive ? 'active' : 'inactive'}`}>
                      {selectedDirectoryEmployee.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="directory-modal-details-grid">
                    <div className="detail-item">
                      <span className="detail-label">Email Address</span>
                      <span className="detail-value">{selectedDirectoryEmployee.email || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Phone Number</span>
                      <span className="detail-value">{selectedDirectoryEmployee.mobile || selectedDirectoryEmployee.phoneNumber || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Department</span>
                      <span className="detail-value">{selectedDirectoryEmployee.departmentName || selectedDirectoryEmployee.department || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Employee ID</span>
                      <span className="detail-value">{selectedDirectoryEmployee.employeeId || selectedDirectoryEmployee.id || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Joining Date</span>
                      <span className="detail-value">
                        {selectedDirectoryEmployee.joiningDate 
                          ? new Date(selectedDirectoryEmployee.joiningDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) 
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Work Mode</span>
                      <span className="detail-value">{selectedDirectoryEmployee.workLocation || 'Office-based'}</span>
                    </div>
                  </div>
                  <div className="dashboard-dialog-actions" style={{ marginTop: '24px' }}>
                    <button className="dashboard-dialog-btn dashboard-dialog-btn-primary" style={{ width: '100%' }} onClick={() => setSelectedDirectoryEmployee(null)}>Close Profile</button>
                  </div>
                </div>
              </div>
            )}
          </>,
          document.body
      )}
    </div>
  );
};

export default Dashboard;

// --- Sub-components moved outside to prevent re-creation on every render ---

const EmployeeDashboardView = ({
  elapsed, name, greeting, currentDate, timeStatus,
  handleClockOutClick, handleClockInClick, timeLoading, 
  navigate, weeklyProgress, formatTodayHours,
  activeLeaveTab, setActiveLeaveTab, leaveBalances, 
  recentLeaveHistory, user, activeHolidays,
  weatherType, setWeatherType, weatherInfo, setWeatherInfo,
  teamAttendanceToday = []
}) => {
  const handleManualWeather = (type) => {
    setWeatherType(type);
    let conditionName = 'Clear Sky';
    if (type === 'cloudy') conditionName = 'Partly Cloudy';
    if (type === 'rainy') conditionName = 'Rainy';
    if (type === 'thunderstorm') conditionName = 'Thunderstorm';
    setWeatherInfo(prev => ({ ...prev, condition: conditionName }));
  };

  return (
    <div className="emp-dashboard">
      {/* Animated Hero Section */}
      <div className="emp-hero">
        <div className="emp-hero-dots"></div>
        <div className="emp-hero-inner">
          <div className="emp-welcome-box">
            <div className="hg-group">
              <div className="hg">
                <span className="hg-icon">{greeting.icon}</span>
                <span>{greeting.text}</span>
              </div>
            </div>
            <h1>Welcome back, {name}</h1>
            <p>{currentDate.day}, {currentDate.date}</p>
            
            <div className="emp-status-pills">
              <span className={`emp-pill ${timeStatus.isClockedIn ? 'emp-pill-success' : 'emp-pill-warning'}`}>
                {timeStatus.isClockedIn ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {timeStatus.isClockedIn ? 'Clocked In' : 'Not Clocked In'}
              </span>
              <span className="emp-pill emp-pill-info">
                <MapPin size={14} /> {timeStatus.currentEntry?.workLocation || user?.workLocation || 'Office'}
              </span>
              <span className="emp-pill emp-pill-info">
                <Clock size={14} /> {user?.shiftDetails || '09:00 AM - 06:00 PM'}
              </span>
              <span className="emp-pill emp-pill-info">
                <Users size={14} /> {user?.department || 'Member'}
              </span>
            </div>
          </div>

          <div className="emp-clock-widget">
            <div className="emp-time-display">
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </div>
            <div className="emp-date-display">{currentDate.day}, {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
            
            <div className="emp-clock-stats">
              <div className="emp-clock-stat-box">
                <span className="emp-clock-stat-val">{elapsed.hours}</span>
                <span className="emp-clock-stat-lbl">Hours</span>
              </div>
              <div className="emp-clock-stat-box">
                <span className="emp-clock-stat-val">{elapsed.minutes}</span>
                <span className="emp-clock-stat-lbl">Mins</span>
              </div>
              <div className="emp-clock-stat-box">
                <span className="emp-clock-stat-val">{elapsed.seconds}</span>
                <span className="emp-clock-stat-lbl">Secs</span>
              </div>
            </div>

            <button 
              className={`emp-clock-btn ${timeStatus.isClockedIn ? 'emp-clock-btn-out' : 'emp-clock-btn-in'}`}
              onClick={timeStatus.isClockedIn ? handleClockOutClick : handleClockInClick}
              disabled={timeLoading}
            >
              {timeLoading ? <Loader2 className="animate-spin" size={18} /> : (timeStatus.isClockedIn ? <Square size={18} /> : <Play size={18} />)}
              {timeStatus.isClockedIn ? 'Clock Out' : 'Clock In'}
            </button>
          </div>
        </div>
      </div>

      {/* Action Strip */}
      <div className="emp-strip">
        <div className="emp-strip-card" onClick={() => navigate('/employee/leaves')}>
          <div className="emp-strip-icon" style={{ background: '#f0f4ff', color: '#1a4ff0' }}><Palmtree size={24} /></div>
          <div className="emp-strip-title">Leave Request</div>
          <div className="emp-strip-sub">Apply for time off</div>
        </div>
        <div className="emp-strip-card" onClick={() => navigate('/employee/attendance')}>
          <div className="emp-strip-icon" style={{ background: '#f0fdf4', color: '#059669' }}><CalendarCheck size={24} /></div>
          <div className="emp-strip-title">My Attendance</div>
          <div className="emp-strip-sub">View timesheet</div>
        </div>
        <div className="emp-strip-card" onClick={() => navigate('/employee/holidays')}>
          <div className="emp-strip-icon" style={{ background: '#fffbeb', color: '#d97706' }}><Gift size={24} /></div>
          <div className="emp-strip-title">Holidays</div>
          <div className="emp-strip-sub">Check calendar</div>
        </div>
        <div className="emp-strip-card" onClick={() => navigate('/employee/payslips')}>
          <div className="emp-strip-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}><CreditCard size={24} /></div>
          <div className="emp-strip-title">Payslips</div>
          <div className="emp-strip-sub">View & download</div>
        </div>
        <div className="emp-strip-card" onClick={() => navigate('/employee/time-office', { state: { activeTab: 'timesheet' } })}>
          <div className="emp-strip-icon" style={{ background: '#ecfeff', color: '#0891b2' }}><ClipboardList size={24} /></div>
          <div className="emp-strip-title">Timesheets</div>
          <div className="emp-strip-sub">Log hours</div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="emp-main-grid">
        {/* Today's Summary */}
        <div className="emp-card">
          <div className="emp-card-hd">
            <div className="emp-card-title">Today's Summary <div className="summary-live">Live</div></div>
            <button className="ft-btn" onClick={() => navigate('/employee/attendance')}>Full Timesheet →</button>
          </div>
          <div className="emp-card-body">
            <div className="weekly-progress">
              <div className="wp-label">
                <span>Weekly progress</span>
                <span>{weeklyProgress.worked}h / {weeklyProgress.target}h</span>
              </div>
              <div className="wp-bar">
                <div className="wp-fill" style={{ width: `${weeklyProgress.percent}%` }}></div>
              </div>
            </div>

            <div className="summary-list">
              <div className="summary-item">
                <div className="si-icon" style={{ background: '#f0f4ff', color: '#1a4ff0' }}><Timer size={18} /></div>
                <div className="si-info">
                  <div className="si-name">Today's Hours</div>
                  <div className="si-val">{timeStatus.isClockedIn ? timeStatus.elapsedTime.split(':').slice(0, 2).join(':') : formatTodayHours(timeStatus.todayHours)}</div>
                </div>
                {(timeStatus.todayHours === '0:00' && !timeStatus.isClockedIn) && <span className="status-badge">Not Started</span>}
              </div>
              <div className="summary-item">
                <div className="si-icon" style={{ background: '#f0fdf4', color: '#059669' }}><Play size={18} /></div>
                <div className="si-info">
                  <div className="si-name">Clock In</div>
                  <div className="si-val">{timeStatus.lastClockInFormatted || '--:--'}</div>
                </div>
              </div>
              <div className="summary-item">
                <div className="si-icon" style={{ background: '#fef2f2', color: '#dc2626' }}><Square size={18} /></div>
                <div className="si-info">
                  <div className="si-name">Clock Out</div>
                  <div className="si-val">
                    {timeStatus.lastClockOutFormatted && timeStatus.lastClockOutFormatted !== '--:--'
                      ? timeStatus.lastClockOutFormatted
                      : (timeStatus.isClockedIn ? 'Live' : '--:--')}
                  </div>
                </div>
              </div>
              <div className="summary-item">
                <div className="si-icon" style={{ background: '#fffbeb', color: '#d97706' }}><Coffee size={18} /></div>
                <div className="si-info">
                  <div className="si-name">Break Time</div>
                  <div className="si-val">{user?.breakDuration || '1 Hour Allocated'}</div>
                </div>
              </div>
              <div className="summary-item">
                <div className="si-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}><MapPin size={18} /></div>
                <div className="si-info">
                  <div className="si-name">Work Location</div>
                  <div className="si-val">{timeStatus.currentEntry?.workLocation || user?.workLocation || 'Office'}</div>
                </div>
              </div>
              <div className="summary-item">
                <div className="si-icon" style={{ background: '#ecfeff', color: '#0891b2' }}><CalendarDays size={18} /></div>
                <div className="si-info">
                  <div className="si-name">Shift</div>
                  <div className="si-val">{user?.shiftName || user?.shiftDetails || '09:00 AM - 06:00 PM'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {teamAttendanceToday.length > 0 && (
          <div className="emp-card">
            <div className="emp-card-hd">
              <div className="emp-card-title">Team Attendance Today</div>
              <button type="button" className="ft-btn" onClick={() => navigate('/manager/team?tab=attendance')}>View All →</button>
            </div>
            <div className="emp-card-body" style={{ padding: 0 }}>
              <div className="dash-attendance-list dash-attendance-list-emp">
                <div className="dash-attendance-list-header">
                  <span>Employee</span>
                  <span>Check In</span>
                  <span>Check Out</span>
                </div>
                <div className="dash-attendance-list-body">
                  {teamAttendanceToday.slice(0, 6).map((record, idx) => (
                    <div key={record.employeeId || idx} className="dash-attendance-row">
                      <span className="dash-att-name" title={record.employeeName}>{record.employeeName}</span>
                      <span className="dash-att-time">{record.clockInDisplay}</span>
                      <span className="dash-att-time dash-att-out">
                        {record.clockOutDisplay !== '--:--'
                          ? record.clockOutDisplay
                          : (String(record.status || record.todayStatus || '').toUpperCase() === 'PRESENT' ? 'Live' : '--:--')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Time Off Balance */}
        <div className="emp-card">
          <div className="emp-card-hd">
            <div className="emp-card-title">Time Off Balance</div>
            <div className="va-link" onClick={() => navigate('/employee/leaves')}>View Details</div>
          </div>
          <div className="emp-card-body">
            <div className="balance-tabs">
              {leaveBalances.length > 0 ? leaveBalances.map((lb, idx) => {
                const label = lb.leaveTypeName || lb.leaveTypeCode;
                return (
                  <div 
                    key={idx} 
                    className={`balance-tab ${activeLeaveTab === label ? 'active' : ''}`} 
                    onClick={() => setActiveLeaveTab(label)}
                  >
                    {label}
                  </div>
                );
              }) : (
                <div className="balance-tab active">No Leave Data</div>
              )}
            </div>

            {(() => {
              const currentBalance = leaveBalances.find(lb => lb.leaveTypeName === activeLeaveTab || lb.leaveTypeCode === activeLeaveTab || (activeLeaveTab === 'Annual' && lb.leaveTypeCode === 'AL') || (activeLeaveTab === 'Sick' && lb.leaveTypeCode === 'SL') || (activeLeaveTab === 'Casual' && lb.leaveTypeCode === 'CL'));
              
              const avail = currentBalance?.availableBalance || 0;
              const used = currentBalance?.usedLeaves || 0;
              const pending = currentBalance?.pendingLeaves || 0;
              const total = currentBalance?.annualQuota || (avail + used + pending) || 1;
              
              const availPct = Math.min(100, (avail / total) * 100);
              const usedPct = Math.min(100, (used / total) * 100);
              const pendingPct = Math.min(100, (pending / total) * 100);

              return (
                <div className="balance-grid">
                  <div className="balance-item">
                    <span className="bi-val" style={{ color: '#2563eb' }}>{avail}</span>
                    <span className="bi-lbl">Available</span>
                    <div className="bi-progress"><div className="bi-fill" style={{ width: `${availPct}%`, background: '#2563eb' }}></div></div>
                  </div>
                  <div className="balance-item">
                    <span className="bi-val" style={{ color: '#ef4444' }}>{used}</span>
                    <span className="bi-lbl">Used</span>
                    <div className="bi-progress"><div className="bi-fill" style={{ width: `${usedPct}%`, background: '#ef4444' }}></div></div>
                  </div>
                  <div className="balance-item">
                    <span className="bi-val" style={{ color: '#f59e0b' }}>{pending}</span>
                    <span className="bi-lbl">Pending</span>
                    <div className="bi-progress"><div className="bi-fill" style={{ width: `${pendingPct}%`, background: '#f59e0b' }}></div></div>
                  </div>
                  <div className="balance-item">
                    <span className="bi-val" style={{ color: '#64748b' }}>{currentBalance?.accruedLeaves || 0}</span>
                    <span className="bi-lbl">Carry Over</span>
                    <div className="bi-progress"><div className="bi-fill" style={{ width: '0%', background: '#64748b' }}></div></div>
                  </div>
                </div>
              );
            })()}

            <div className="history-title">Recent Leave History</div>
            <div className="history-list">
              {recentLeaveHistory.length > 0 ? recentLeaveHistory.map((leave, idx) => (
                <div key={idx} className="history-item">
                  <div className="hi-main">
                    <span className="hi-date">{new Date(leave.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <span className="hi-type">{leave.leaveType || leave.leaveTypeName}</span>
                    <span className="hi-days">{leave.totalDays || leave.days} day{ (leave.totalDays || leave.days) > 1 ? 's' : ''}</span>
                  </div>
                  <span className={`hi-status ${['APPROVED', 'HR_APPROVED', 'MANAGER_APPROVED'].includes(String(leave.status).toUpperCase()) ? 'his-app' : (['REJECTED', 'CANCELLED'].includes(String(leave.status).toUpperCase()) ? 'his-rej' : 'his-pen')}`}>
                    {leave.status}
                  </span>
                </div>
              )) : (
                <div className="no-history">No recent leave history</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="emp-right-column">
          {/* Quick Actions */}
          <div className="emp-card">
            <div className="emp-card-title" style={{ marginBottom: '1.25rem' }}>Quick Actions</div>
            <div className="qa-grid">
              <div className="qa-card" onClick={() => navigate('/employee/leaves')}>
                <div className="qa-ico" style={{ color: '#3b82f6' }}><Palmtree size={22} /></div>
                <div className="qa-label">Leave</div>
                <div className="qa-sublabel">Apply</div>
              </div>
              <div className="qa-card" onClick={() => navigate('/employee/wfh')}>
                <div className="qa-ico" style={{ color: '#8b5cf6' }}><Home size={22} /></div>
                <div className="qa-label">WFH</div>
                <div className="qa-sublabel">Request</div>
              </div>
              <div className="qa-card" onClick={() => navigate('/employee/expenses')}>
                <div className="qa-ico" style={{ color: '#10b981' }}><FileText size={22} /></div>
                <div className="qa-label">Expense</div>
                <div className="qa-sublabel">Submit</div>
              </div>
              <div className="qa-card" onClick={() => navigate('/employee/attendance')}>
                <div className="qa-ico" style={{ color: '#f59e0b' }}><ClipboardList size={22} /></div>
                <div className="qa-label">Timesheet</div>
                <div className="qa-sublabel">Log hours</div>
              </div>
            </div>
          </div>

          {/* Upcoming Holidays */}
          <div className="emp-card">
             <div className="emp-card-hd" style={{ padding: '0 0 1rem 0', borderBottom: 'none' }}>
              <div className="emp-card-title">Upcoming Holidays</div>
              <div className="va-link" onClick={() => navigate('/employee/holidays')}>All</div>
            </div>
            <div className="holiday-banner-list">
              {activeHolidays.length === 0 ? (
                <p className="no-history">No upcoming holidays scheduled.</p>
              ) : (
                activeHolidays
                  .map(h => ({ ...h, _days: daysUntilNextOccurrence(getHolidayDate(h)) }))
                  .sort((a, b) => a._days - b._days)
                  .slice(0, 3)
                  .map((h, i) => (
                    <HolidayBanner
                      key={h.id ?? `${getHolidayDate(h)}-${i}`}
                      name={getHolidayName(h)}
                      dateStr={getHolidayDate(h)}
                      daysLeft={h._days}
                      onClick={() => navigate('/employee/holidays')}
                    />
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
