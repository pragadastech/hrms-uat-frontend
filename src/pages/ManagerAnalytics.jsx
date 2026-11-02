/* eslint-disable react/prop-types */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { formatTimeTo12h, formatHours } from '../utils/timeUtils';
import { managerAnalyticsAPI, leaveBalanceAPI } from '../services/api';
import Header from '../components/Header';
import LeaveAdjustmentsPanel from '../components/LeaveAdjustmentsPanel';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import {
  Users,
  UserCheck,
  UserX,
  Calendar,
  Clock,
  AlertCircle,
  BarChart3,
  RefreshCw,
  Search,
  Timer,
  AlarmClock,
  Wifi,
  Shield,
  Zap,
  Award,
  CheckCircle,
  Download,
  Sparkles,
  Brain,
  Target,
  TrendingUp,
  Lightbulb,
  FileSpreadsheet,
  LayoutDashboard,
  AlertTriangle,
  Scale,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

const COLORS_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

/* ───────── helpers ───────── */
const formatDate = (d) => {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getMonthRange = (offset = 0) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  const fmt = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  return { startDate: fmt(start), endDate: fmt(end) };
};





const statusColor = {
  PRESENT: '#10b981',
  ABSENT: '#ef4444',
  ON_LEAVE: '#f59e0b',
  NOT_CLOCKED_IN: '#94a3b8',
  HOLIDAY: '#f59e0b',
  APPROVED: '#10b981',
  PENDING: '#f59e0b',
  REJECTED: '#ef4444',
  SUBMITTED: '#3b82f6',
  DRAFT: '#6b7280',
};

const statusLabel = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  ON_LEAVE: 'On Leave',
  NOT_CLOCKED_IN: 'Not Clocked In',
  HOLIDAY: 'Holiday',
};

const STATUS_BADGE = ({ status }) => (
  <span
    style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      color: '#fff',
      background: statusColor[status] || '#6b7280',
    }}
  >
    {statusLabel[status] || status?.toLowerCase().replace(/_/g, ' ') || 'unknown'}
  </span>
);

/* ───────── main component ───────── */
const ManagerAnalytics = ({ defaultTab = 'overview', isStandalone = false, showAdjustmentsTab = false }) => {

  /* ── cache ── */
  const getCached = (key, def) => {
    try {
      const val = window.safeSessionStorage.getItem(`ma_${key}`);
      return val ? JSON.parse(val) : def;
    } catch { return def; }
  };
  const setCache = (key, val) => window.safeSessionStorage.setItem(`ma_${key}`, JSON.stringify(val));

  const { hasAdminAccess } = useAuth();
  const canShowAdjustments = showAdjustmentsTab || (typeof hasAdminAccess === 'function' && hasAdminAccess());

  /* ── state ── */
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [leaveView, setLeaveView] = useState(
    defaultTab === 'adjustments' ? 'adjustments' : 'analytics'
  );
  
  // Prag AI worksheet summary states
  const [aiDateRange, setAiDateRange] = useState(getMonthRange());
  const [aiLoading, setAiLoading] = useState(false);
  const [aiData, setAiData] = useState(() => getCached('aiData', null));
  const [aiStatus, setAiStatus] = useState('IDLE');
  const [aiError, setAiError] = useState(null);
  const [aiAuditId, setAiAuditId] = useState(null);
  const aiIntervalRef = useRef(null);

  // Sync tab with prop if it changes via routing
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // Clean up polling interval on unmount
  useEffect(() => {
    return () => {
      if (aiIntervalRef.current) {
        clearInterval(aiIntervalRef.current);
      }
    };
  }, []);

  const triggerAiAnalysis = async () => {
    setAiLoading(true);
    setAiStatus('PENDING');
    setAiError(null);
    setAiData(null);
    if (aiIntervalRef.current) {
      clearInterval(aiIntervalRef.current);
    }
    
    try {
      const res = await managerAnalyticsAPI.triggerWorksheetSummary(
        aiDateRange.startDate,
        aiDateRange.endDate
      );
      const auditId = res.data?.auditId;
      if (!auditId) {
        throw new Error("Audit ID could not be resolved from backend.");
      }
      
      setAiAuditId(auditId);
      toast.success("Performance analysis started!");
      
      // Start polling
      pollAiStatus(auditId);
    } catch (err) {
      console.error("Failed to trigger AI analysis", err);
      const errMsg = err.response?.data?.error || err.message || "Failed to start performance analysis session.";
      setAiError(errMsg);
      setAiStatus('FAILED');
      setAiLoading(false);
      toast.error(errMsg);
    }
  };

  const pollAiStatus = (auditId) => {
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes
    
    aiIntervalRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
        setAiError("AI appraisal timed out. The request is still processing in the background, please check again in a moment.");
        setAiStatus('FAILED');
        setAiLoading(false);
        return;
      }
      
      try {
        const res = await managerAnalyticsAPI.getWorksheetSummaryStatus(auditId);
        const status = res.data?.status;
        
        if (status === 'COMPLETED') {
          if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
          setAiData(res.data);
          setCache('aiData', res.data);
          setAiStatus('COMPLETED');
          setAiLoading(false);
          toast.success("Performance reports compiled successfully!");
        } else if (status === 'FAILED') {
          if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
          setAiError(res.data?.errorMessage || "Analysis failed during processing.");
          setAiStatus('FAILED');
          setAiLoading(false);
          toast.error("Performance analysis failed.");
        } else {
          setAiStatus('PENDING');
        }
      } catch (err) {
        console.error("Polling error (network lag)", err);
      }
    }, 2000);
  };
  const [loading, setLoading] = useState(() => !window.safeSessionStorage.getItem('ma_overview'));
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState(''); // Separate state for input value

  // overview
  const [overview, setOverview] = useState(() => getCached('overview', null));

  // attendance
  const [attendanceCalendar, setAttendanceCalendar] = useState(() => getCached('attendanceCalendar', []));
  const [attMonth, setAttMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // timesheets
  const [timesheets, setTimesheets] = useState(() => getCached('timesheets', []));
  const [tsAllEntries, setTsAllEntries] = useState([]); // All entries for employee modal
  const [tsTotalHours, setTsTotalHours] = useState(() => getCached('tsTotalHours', 0));
  const [tsBillableCount, setTsBillableCount] = useState(() => getCached('tsBillableCount', 0));
  const [tsNonBillableCount, setTsNonBillableCount] = useState(() => getCached('tsNonBillableCount', 0));
  const [tsBillableFilter, setTsBillableFilter] = useState('ALL');
  const [tsDateRange, setTsDateRange] = useState(getMonthRange());
  const [tsPage, setTsPage] = useState(0);
  const [tsTotalPages, setTsTotalPages] = useState(0);
  const [tsTotalCount, setTsTotalCount] = useState(0);
  const [tsHoursByProject, setTsHoursByProject] = useState(() => getCached('tsHoursByProject', {}));
  const [tsHoursByEmployee, setTsHoursByEmployee] = useState(() => getCached('tsHoursByEmployee', {}));
  const [tsHoursByDate, setTsHoursByDate] = useState(() => getCached('tsHoursByDate', {}));
  const [tsHoursByTask, setTsHoursByTask] = useState(() => getCached('tsHoursByTask', {}));
  const [tsEmployeeBreakdown, setTsEmployeeBreakdown] = useState(() => getCached('tsEmployeeBreakdown', {}));
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // leaves
  const [leaves, setLeaves] = useState(() => getCached('leaves', []));
  const [leaveStatusCounts, setLeaveStatusCounts] = useState(() => getCached('leaveStatusCounts', {}));
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('');
  const [leaveYear, setLeaveYear] = useState(new Date().getFullYear());
  const [allLeavesForSummary, setAllLeavesForSummary] = useState(() => getCached('allLeavesForSummary', []));
  const [teamBalances, setTeamBalances] = useState({});

  /* ── data loaders ── */
  const fetchOverview = useCallback(async () => {
    try {
      if (!overview) setLoading(true);
      setError(null);
      const res = await managerAnalyticsAPI.getOverview();
      setOverview(res.data);
      setCache('overview', res.data);
    } catch (e) {
      console.error('Overview fetch error', e);
      setError('Failed to load overview');
      toast.error('Failed to load overview');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAttendance = useCallback(async () => {
    try {
      if (attendanceCalendar.length === 0) setLoading(true);
      setError(null);
      const [y, m] = attMonth.split('-').map(Number);
      const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
      const endDate = new Date(y, m, 0).toISOString().split('T')[0]; // last day of month
      const res = await managerAnalyticsAPI.getTeamAttendance(startDate, endDate);
      const data = res.data?.calendar || [];
      setAttendanceCalendar(data);
      setCache('attendanceCalendar', data);
    } catch (e) {
      console.error('Attendance fetch error', e);
      setError('Failed to load attendance');
      toast.error('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [attMonth]);

  const fetchTimesheets = useCallback(async () => {
    try {
      if (timesheets.length === 0) setLoading(true);
      setError(null);
      const res = await managerAnalyticsAPI.getTeamTimesheets(
        tsDateRange.startDate, 
        tsDateRange.endDate, 
        tsBillableFilter,
        tsPage,
        25,
        searchTerm
      );
      const data = res.data?.entries || [];
      setTimesheets(data);
      setCache('timesheets', data);
      setTsTotalHours(res.data?.totalHours || 0);
      setCache('tsTotalHours', res.data?.totalHours || 0);
      setTsBillableCount(res.data?.billableCount || 0);
      setCache('tsBillableCount', res.data?.billableCount || 0);
      setTsNonBillableCount(res.data?.nonBillableCount || 0);
      setCache('tsNonBillableCount', res.data?.nonBillableCount || 0);
      
      setTsTotalPages(res.data?.totalPages || 0);
      setTsTotalCount(res.data?.totalCount || 0);
      
      setTsHoursByProject(res.data?.hoursByProject || {});
      setCache('tsHoursByProject', res.data?.hoursByProject || {});
      setTsHoursByEmployee(res.data?.hoursByEmployee || {});
      setCache('tsHoursByEmployee', res.data?.hoursByEmployee || {});
      setTsHoursByDate(res.data?.hoursByDate || {});
      setCache('tsHoursByDate', res.data?.hoursByDate || {});
      setTsHoursByTask(res.data?.hoursByTask || {});
      setCache('tsHoursByTask', res.data?.hoursByTask || {});
      setTsEmployeeBreakdown(res.data?.employeeBreakdown || {});
      setCache('tsEmployeeBreakdown', res.data?.employeeBreakdown || {});
      setTsAllEntries(res.data?.allEntries || []);
    } catch (e) {
      console.error('Timesheets fetch error', e);
      setError('Failed to load timesheets');
      toast.error('Failed to load timesheets');
    } finally {
      setLoading(false);
    }
  }, [tsDateRange, tsBillableFilter, tsPage, searchTerm]);

  const fetchLeaves = useCallback(async () => {
    try {
      if (leaves.length === 0) setLoading(true);
      setError(null);
      const res = await managerAnalyticsAPI.getTeamLeaves(
        leaveYear,
        leaveStatusFilter || undefined
      );
      const data = res.data?.leaves || [];
      setLeaves(data);
      setCache('leaves', data);
      setLeaveStatusCounts(res.data?.statusCounts || {});
      setCache('leaveStatusCounts', res.data?.statusCounts || {});
    } catch (e) {
      console.error('Leaves fetch error', e);
      setError('Failed to load leaves');
      toast.error('Failed to load leaves');
    } finally {
      setLoading(false);
    }
  }, [leaveYear, leaveStatusFilter]);

  const fetchAllLeavesSummary = useCallback(async () => {
    try {
      const res = await managerAnalyticsAPI.getTeamLeaves(leaveYear);
      setAllLeavesForSummary(res.data?.leaves || []);
    } catch (e) {
      console.error('Full leave summary fetch error', e);
    }
  }, [leaveYear]);

  /* ── effects ── */
  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (activeTab === 'attendance') fetchAttendance();
  }, [activeTab, attMonth, fetchAttendance]);

  useEffect(() => {
    if (activeTab === 'timesheets') fetchTimesheets();
  }, [activeTab, fetchTimesheets]);

  useEffect(() => {
    setTsPage(0);
  }, [tsDateRange, tsBillableFilter, searchTerm]);

  useEffect(() => {
    if (activeTab === 'leaves') {
      fetchLeaves();
      fetchAllLeavesSummary();
    }
  }, [activeTab, leaveYear, leaveStatusFilter, fetchLeaves, fetchAllLeavesSummary]);

  const fetchAllBalances = useCallback(async () => {
    try {
      const { reportingAPI } = await import('../services/api');
      const res = await reportingAPI.getLeaveBalanceReport({});
      const balanceMap = {};
      if (res.data?.data && Array.isArray(res.data.data)) {
        res.data.data.forEach(emp => {
          const empId = String(emp.employeeId || emp.employeeIdString || '').toUpperCase();
          if (empId && emp.leaveBalances) {
            balanceMap[empId] = {};
            emp.leaveBalances.forEach(lb => {
              const code = lb.leaveTypeCode || lb.leaveType;
              balanceMap[empId][code] = {
                available: lb.availableBalance ?? lb.balance ?? 0,
                used: lb.usedLeaves ?? 0,
                quota: (lb.openingBalance ?? 0) + (lb.accruedLeaves ?? 0) || lb.annualQuota || 0
              };
            });
          }
        });
      }
      setTeamBalances(balanceMap);
    } catch (err) {
      console.error('Failed to fetch team leave balances', err);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'leaves') fetchAllBalances();
  }, [activeTab, fetchAllBalances]);

  const handleLeaveAction = async (requestId, action, reason) => {
    try {
      if (action === 'approve') {
        await managerAnalyticsAPI.approveLeaveRequest(requestId, null, 'Approved via Team Intelligence');
        toast.success('Leave request approved');
      } else if (action === 'cancel') {
        await managerAnalyticsAPI.cancelLeaveRequest(requestId, null, reason || 'Cancelled via Team Intelligence');
        toast.success('Leave request cancelled');
      } else {
        await managerAnalyticsAPI.rejectLeaveRequest(requestId, null, 'Rejected via Team Intelligence');
        toast.success('Leave request rejected');
      }
      fetchLeaves();
      fetchAllBalances();
      fetchOverview();
    } catch (e) {
      console.error('Leave action error', e);
      const errorMessage = e.response?.data?.message || e.response?.data?.error || e.message || 'Failed to update leave request';
      toast.error(errorMessage);
      throw e;
    }
  };

  /* ── filtered lists ── */
  const filteredAttendanceCalendar = useMemo(() => {
    if (!searchTerm) return attendanceCalendar;
    const q = searchTerm.toLowerCase();
    return attendanceCalendar.filter(
      (s) =>
        s.employeeName?.toLowerCase().includes(q) ||
        s.employeeId?.toLowerCase().includes(q) ||
        s.department?.toLowerCase().includes(q)
    );
  }, [attendanceCalendar, searchTerm]);

  const filteredTimesheets = useMemo(() => {
    if (!searchTerm) return timesheets;
    const q = searchTerm.toLowerCase();
    return timesheets.filter(
      (t) =>
        t.employeeName?.toLowerCase().includes(q) ||
        t.employeeId?.toLowerCase().includes(q) ||
        t.projectName?.toLowerCase().includes(q) ||
        t.taskName?.toLowerCase().includes(q) ||
        t.status?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
    );
  }, [timesheets, searchTerm]);

  const filteredLeaves = useMemo(() => {
    if (!searchTerm) return leaves;
    const q = searchTerm.toLowerCase();
    return leaves.filter(
      (l) =>
        l.employeeName?.toLowerCase().includes(q) ||
        l.employeeId?.toLowerCase().includes(q) ||
        l.department?.toLowerCase().includes(q)
    );
  }, [leaves, searchTerm]);

  /* ────────────── RENDER ────────────── */
  const tabs = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'ai-insights', label: 'Performance Reports', icon: Sparkles },
    { key: 'attendance', label: 'Attendance', icon: UserCheck },
    { key: 'timesheets', label: 'Timesheets', icon: Clock },
    { key: 'leaves', label: 'Leaves', icon: Calendar },
  ];

  return (
    <div style={{ padding: '0', minHeight: '100vh', background: '#f8fafc' }}>
      <Header title={isStandalone
        ? (activeTab === 'timesheets'
          ? 'Timesheet Analytics'
          : (leaveView === 'adjustments' ? 'Leave Adjustments' : 'Leave Analytics'))
        : "Team Overview"} />

      <div style={{ padding: '20px 24px' }}>
        {/* Tabs - ONLY in general Overview dashboard */}
        {!isStandalone && (
          <div style={styles.tabBar}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSearchTerm(''); setSearchInput(''); }}
                style={{
                  ...styles.tabBtn,
                  ...(active ? styles.tabBtnActive : {}),
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
        )}

        {isStandalone && activeTab === 'leaves' && canShowAdjustments && (
          <div style={{ ...styles.tabBar, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setLeaveView('analytics')}
              style={{
                ...styles.tabBtn,
                ...(leaveView === 'analytics' ? styles.tabBtnActive : {}),
              }}
            >
              <Calendar size={16} />
              Leave Analytics
            </button>
            <button
              type="button"
              onClick={() => setLeaveView('adjustments')}
              style={{
                ...styles.tabBtn,
                ...(leaveView === 'adjustments' ? styles.tabBtnActive : {}),
              }}
            >
              <Scale size={16} />
              Leave Adjustments
            </button>
          </div>
        )}

        {/* Loading / Error */}

        {/* Loading / Error */}
        {loading && leaveView !== 'adjustments' && (
          <div style={styles.center}>
            <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: 8, color: '#64748b' }}>Loading...</p>
          </div>
        )}
        {error && !loading && leaveView !== 'adjustments' && (
          <div style={{ ...styles.center, color: '#ef4444' }}>
            <AlertCircle size={28} />
            <p style={{ marginTop: 8 }}>{error}</p>
          </div>
        )}

        {/* Content */}
        {activeTab === 'leaves' && leaveView === 'adjustments' && canShowAdjustments ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #e2e8f0' }}>
            <LeaveAdjustmentsPanel embedded showImport />
          </div>
        ) : !loading && !error && (
          <>
            {activeTab === 'overview' && renderOverview(overview, searchTerm, setSearchTerm)}
            {activeTab === 'ai-insights' && (
              <RenderAiInsights
                data={aiData}
                loading={aiLoading}
                status={aiStatus}
                error={aiError}
                dateRange={aiDateRange}
                setDateRange={setAiDateRange}
                onTrigger={triggerAiAnalysis}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
              />
            )}
            {activeTab === 'attendance' && renderAttendance(filteredAttendanceCalendar, attMonth, setAttMonth, fetchAttendance)}
            {activeTab === 'timesheets' && renderTimesheets(
              timesheets, 
              { totalHours: tsTotalHours, billableCount: tsBillableCount, nonBillableCount: tsNonBillableCount }, 
              tsDateRange, setTsDateRange, 
              tsBillableFilter, setTsBillableFilter, 
              fetchTimesheets,
              tsPage, setTsPage, tsTotalPages, tsTotalCount,
              { 
                hoursByProject: tsHoursByProject, 
                hoursByEmployee: tsHoursByEmployee, 
                hoursByDate: tsHoursByDate,
                hoursByTask: tsHoursByTask,
                employeeBreakdown: tsEmployeeBreakdown
              },
              isStandalone,
              setSelectedEmployee,
              searchTerm,
              setSearchTerm,
              searchInput,
              setSearchInput,
              tsAllEntries
            )}
            {activeTab === 'leaves' && leaveView === 'analytics' && renderLeaves(
              filteredLeaves, 
              leaveStatusCounts, 
              leaveYear, setLeaveYear, 
              leaveStatusFilter, setLeaveStatusFilter, 
              fetchLeaves, 
              isStandalone,
              setSelectedEmployee,
              overview?.teamSize || filteredLeaves.length,
              searchTerm,
              setSearchTerm,
              searchInput,
              setSearchInput,
              teamBalances,
              allLeavesForSummary,
              loading
            )}
          </>
        )}
      </div>

      {/* Side Drawer / Modal for Employee Details */}
      <EmployeeModal emp={selectedEmployee} onClose={() => setSelectedEmployee(null)} allEntries={tsAllEntries} />
      <LeaveModal emp={selectedEmployee} onClose={() => setSelectedEmployee(null)} allLeaves={allLeavesForSummary} onAction={handleLeaveAction} teamBalances={teamBalances} />

      {/* Custom Styles for Timesheet Dashboard */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } } 
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes ts-up { from { transform: translateY(14px); opacity: 0; } to { transform: none; opacity: 1; } }
        @keyframes ts-blink { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(1.5); } }
        
        /* Custom Clean Scrollbar */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #fff; }
        ::-webkit-scrollbar-thumb { background: #eef0f4; border-radius: 10px; border: 1px solid #fff; }
        ::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
        * { scrollbar-width: thin; scrollbar-color: #eef0f4 #fff; }

        .ts-dashboard-content { font-family: 'DM Sans', sans-serif; color: #0f1117; background: #f8fafc; }
        
        .ts-page-header { margin-bottom: 1.5rem; }
        @media (max-width: 640px) { .ts-page-header { margin-bottom: 1rem; } }

        .ts-hcontrols { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; width: 100%; }
        .ts-search-wrap { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid rgba(0,0,0,0.13); border-radius: 8px; padding: 6px 12px; flex: 1; min-width: 280px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); transition: 0.2s; }
        .ts-search-wrap:focus-within { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        .ts-search-wrap input { border: none; outline: none; font-size: 13px; color: #0f1117; width: 100%; height: 26px; background: transparent; }

        .ts-date-wrap {
          display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid rgba(0,0,0,0.13);
          border-radius: 8px; padding: 6px 12px; font-size: 13px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }
        .ts-date-wrap input { border: none; outline: none; font-size: 12px; color: #0f1117; width: 120px; flex-shrink: 0; background: transparent; }
        .ts-sep { color: #9ca3b0; }
        .ts-refresh-btn-mini { background: none; border: none; cursor: pointer; color: #3b82f6; display: flex; align-items: center; }

        .ts-chip-group { display: flex; background: #eef0f4; border: 1px solid rgba(0,0,0,0.07); border-radius: 8px; padding: 3px; gap: 2px; }
        .ts-chip { padding: 5px 13px; font-size: 12px; border: none; background: transparent; border-radius: 6px; cursor: pointer; color: #5c6070; transition: all 0.12s; }
        .ts-chip.active { background: #fff; color: #0f1117; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }

        .ts-ai-banner {
          background: #fff; border: 1px solid rgba(0,0,0,0.07); border-left: 4px solid #2563eb;
          border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 1.75rem;
          display: flex; align-items: flex-start; gap: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }
        .ts-ai-dot { width: 7px; height: 7px; border-radius: 50%; background: #2563eb; margin-top: 6px; flex-shrink: 0; animation: ts-blink 2.5s ease-in-out infinite; }
        .ts-ai-text { font-size: 13.5px; color: #5c6070; line-height: 1.6; }
        .ts-ai-text strong { color: #0f1117; font-weight: 600; }

        .ts-metrics-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 1.75rem; }
        .ts-metric { background: #fff; border: 1px solid rgba(0,0,0,0.07); border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        .ts-metric-lbl { font-size: 10px; color: #9ca3b0; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
        .ts-metric-val { font-size: 24px; font-weight: 700; color: #0f1117; margin: 2px 0; }
        .ts-metric-val.ts-gn { color: #0b9e6e; }
        .ts-metric-val.ts-rd { color: #d03e3e; }
        .ts-metric-val.ts-am { color: #b06800; }
        .ts-metric-val.ts-bl { color: #2563eb; }
        .ts-metric-sub { font-size: 11px; color: #9ca3b0; }
        .ts-metric-sub.ts-gn { color: #0b9e6e; font-weight: 600; }
        .ts-metric-sub.ts-rd { color: #d03e3e; font-weight: 600; }

        .ts-sec-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
        .ts-sec-title { font-size: 15px; font-weight: 700; color: #0f1117; }
        .ts-sec-hint { font-size: 12px; color: #9ca3b0; }

        .ts-emp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
        @media (max-width: 480px) { .ts-emp-grid { grid-template-columns: 1fr; } }
        
        .ts-emp-card {
          background: #fff; border: 1px solid rgba(0,0,0,0.07); border-radius: 12px; padding: 1.25rem;
          cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.06); transition: all 0.2s;
          position: relative; overflow: hidden;
        }
        .ts-emp-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); border-color: rgba(0,0,0,0.13); }
        .ts-emp-card::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: #2563eb; opacity: 0; transition: 0.2s; }
        .ts-emp-card:hover::after { opacity: 1; }

        .ts-card-top { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
        .ts-avatar { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; }
        .ts-card-name { font-size: 14px; font-weight: 600; color: #0f1117; }
        .ts-card-id { font-size: 11px; color: #9ca3b0; font-family: 'DM Mono', monospace; }

        .ts-hours-big { font-size: 32px; font-weight: 700; color: #0f1117; line-height: 1; }
        .ts-hours-sub { font-size: 11.5px; color: #9ca3b0; margin: 4px 0 12px; }

        .ts-bar-track { width: 100%; height: 6px; background: #eef0f4; border-radius: 3px; margin-bottom: 12px; overflow: hidden; }
        .ts-bar-bill { height: 100%; border-radius: 3px; transition: width 0.3s ease; }

        .ts-pill-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
        .ts-pill { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 100px; }
        .ts-pill-g { background: #edf9f4; color: #0b9e6e; border: 1px solid #b0e4cf; }
        .ts-pill-r { background: #fdf1f1; color: #d03e3e; border: 1px solid #f0bebe; }

        .ts-card-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid rgba(0,0,0,0.05); }
        .ts-eff-lbl { font-size: 11px; color: #9ca3b0; }
        .ts-eff-val { font-size: 13px; font-weight: 700; font-family: 'DM Mono', monospace; }

        /* Overlay & Modal */
        .ts-overlay {
          display: none; position: fixed; inset: 0; background: rgba(10,14,26,0.6); z-index: 2000;
          align-items: center; justify-content: center; padding: 1rem; backdrop-filter: blur(4px);
        }
        .ts-overlay.open { display: flex; }
        .ts-modal {
          background: #fff; border-radius: 16px; padding: 1.5rem; width: 100%; max-width: 900px;
          position: relative; box-shadow: 0 24px 64px rgba(0,0,0,0.15); animation: ts-up 0.25s ease-out;
          color: #0f1117; max-height: 94vh; overflow-y: auto;
        }
        @media (max-width: 768px) { .ts-modal { padding: 1.25rem; } }

        .ts-modal-close { position: absolute; top: 1rem; right: 1rem; background: #f7f8fa; border: 1px solid rgba(0,0,0,0.07); border-radius: 8px; width: 30px; height: 30px; cursor: pointer; color: #5c6070; display: flex; align-items: center; justify-content: center; }
        .ts-modal-close:hover { background: #eef0f4; color: #0f1117; }

        .ts-modal-head { display: flex; align-items: center; gap: 14px; margin-bottom: 1rem; }
        .ts-m-av { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; }
        .ts-m-name { font-size: 16px; font-weight: 700; }
        .ts-m-meta { font-size: 13px; color: #9ca3b0; margin-top: 4px; }

        .ts-modal-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 1rem; }
        .ts-mm { background: #f7f8fa; border: 1px solid rgba(0,0,0,0.02); border-radius: 8px; padding: 0.75rem; text-align: center; }
        .ts-mm-val { font-size: 20px; font-weight: 700; }
        .ts-mm-val.ts-gn { color: #0b9e6e; }
        .ts-mm-val.ts-rd { color: #d03e3e; }
        .ts-mm-lbl { font-size: 10px; color: #9ca3b0; text-transform: uppercase; margin-top: 2px; font-weight: 600; }

        .ts-legend-row { display: flex; gap: 16px; margin-bottom: 10px; }
        .ts-lg-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #5c6070; font-weight: 500; }
        .ts-lg-dot { width: 10px; height: 10px; border-radius: 3px; }

        .ts-chart-wrap { width: 100%; height: 160px; margin-bottom: 1rem; background: #fff; border-radius: 8px; }

        .ts-entry-head { display: grid; grid-template-columns: 60px 100px 1fr 50px 60px; gap: 8px; padding: 8px; font-size: 9px; font-weight: 700; color: #9ca3b0; text-transform: uppercase; border-bottom: 1px solid rgba(0,0,0,0.08); }
        .ts-entry-row { display: grid; grid-template-columns: 60px 100px 1fr 50px 60px; gap: 8px; padding: 8px; border-bottom: 1px solid rgba(0,0,0,0.04); font-size: 11.5px; align-items: center; }
        .ts-e-date { color: #9ca3b0; font-family: 'DM Mono', monospace; }
        .ts-e-task { color: #5c6070; font-weight: 600; }
        .ts-e-hrs { text-align: right; font-weight: 700; font-family: 'DM Mono', monospace; }
        .ts-e-desc { color: #0f1117; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .ts-modal-ai { margin-top: 1.5rem; background: #eff4ff; border-left: 4px solid #2563eb; border-radius: 8px; padding: 1rem; display: flex; gap: 12px; }
        .ts-modal-ai-text { font-size: 13px; color: #5c6070; line-height: 1.6; }
        
        .ts-table { width: 100%; border-collapse: collapse; min-width: 600px; }
        .ts-th { text-align: left; padding: 12px 16px; font-size: 12px; color: #9ca3b0; text-transform: uppercase; border-bottom: 2px solid #f1f5f9; }
        .ts-td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .ts-row-alt { background: #fafbfc; }

        .ts-card { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; }

        .text-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        /* Leave Intelligence specific */
        .lv-risk-badge { font-size: 10px; font-weight: 700; background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; padding: 2px 8px; border-radius: 100px; text-transform: uppercase; }
        .lv-avail { color: #0b9e6e; font-weight: 600; }
        .lv-used { color: #2563eb; font-weight: 600; }
        .lv-signals { margin-top: 12px; display: flex; flex-direction: column; gap: 4px; border-top: 1px solid rgba(0,0,0,0.03); padding-top: 10px; }
        .lv-sig-item { font-size: 11px; display: flex; align-items: center; gap: 6px; }
        .lv-dot { width: 4px; height: 4px; border-radius: 50%; }

        .lv-btn-acc { background: #10b981; color: #fff; border: none; padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; }
        .lv-btn-acc:hover { background: #059669; }
        .lv-btn-rej { background: #ef4444; color: #fff; border: none; padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; }
        .lv-btn-rej:hover { background: #dc2626; }
        .lv-btn-grey { background: #64748b; color: #fff; border: none; padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; }
        .lv-btn-grey:hover { background: #475569; }

        .rt-badge { background: var(--red); color: #fff; font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 8px; }

        /* Overview Page Styles */
        .ov-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 24px; }
        .ov-card { background: #fff; border: 1px solid rgba(0,0,0,0.07); border-radius: 14px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04); transition: all 0.2s; cursor: default; display: flex; flex-direction: column; gap: 8px; }
        .ov-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
        .ov-icon-box { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
        .ov-lbl { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
        .ov-num { font-size: 28px; font-weight: 800; color: #0f1117; line-height: 1; }
        .ov-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }

        .team-table-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
        .team-table-title { font-size: 15px; font-weight: 700; color: #0f1117; }
        .team-srch { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid rgba(0,0,0,0.13); border-radius: 8px; padding: 5px 12px; width: 240px; }
        .team-srch input { border: none; outline: none; font-size: 13px; color: #0f1117; width: 100%; background: transparent; }

        .u-av { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; }
        .emp-info { display: flex; align-items: center; gap: 10px; }
        .emp-nm-row { font-weight: 600; color: #0f1117; font-size: 13px; }
        .emp-id-sub { font-size: 11px; color: #94a3b8; font-family: 'DM Mono', monospace; }

        /* System Dark Theme Overrides for Manager Analytics */
        [data-theme='dark'] .ts-dashboard-content { background: #0f172a; color: #e2e8f0; }
        [data-theme='dark'] .ts-card { background: #1e293b; border-color: rgba(255,255,255,0.08); }
        [data-theme='dark'] .team-srch { background: #1e293b; border-color: rgba(255,255,255,0.15); }
        [data-theme='dark'] .team-srch input { color: #f8fafc; }
        [data-theme='dark'] .ts-search-wrap { background: #1e293b; border-color: rgba(255,255,255,0.15); }
        [data-theme='dark'] .ts-search-wrap input { color: #f8fafc; }
        [data-theme='dark'] .team-table-title { color: #f8fafc; }
        [data-theme='dark'] .emp-nm-row { color: #f8fafc; }
        [data-theme='dark'] .ts-th { border-bottom-color: rgba(255,255,255,0.08); }
        [data-theme='dark'] .ts-td { border-bottom-color: rgba(255,255,255,0.05); color: #e2e8f0; }
        [data-theme='dark'] .ts-row-alt { background: rgba(255,255,255,0.02); }
        [data-theme='dark'] .ts-date-wrap { background: #1e293b; border-color: rgba(255,255,255,0.15); }
        [data-theme='dark'] .ts-date-wrap input { color: #f8fafc; }
        [data-theme='dark'] .ts-chip-group { background: #0f172a; border-color: rgba(255,255,255,0.08); }
        [data-theme='dark'] .ts-chip { color: #9ca3af; }
        [data-theme='dark'] .ts-chip.active { background: #1e293b; color: #f8fafc; }
        [data-theme='dark'] .ts-refresh-btn-mini { color: #60a5fa; }
        [data-theme='dark'] .ts-sec-title { color: #f8fafc; }
        [data-theme='dark'] .ts-metric { background: #1e293b; border-color: rgba(255,255,255,0.08); }
        [data-theme='dark'] .ts-metric-val { color: #e2e8f0; }
        [data-theme='dark'] .ts-hours-big { color: #f8fafc; }
        [data-theme='dark'] .ts-emp-card { background: #1e293b; border-color: rgba(255,255,255,0.08); }
        [data-theme='dark'] .ts-card-name { color: #f8fafc; }
        [data-theme='dark'] .ts-card-footer { border-top-color: rgba(255,255,255,0.05); }
        [data-theme='dark'] .ts-eff-val { color: #e2e8f0; }
        [data-theme='dark'] .ts-ai-banner { background: #1e293b; border-color: rgba(255,255,255,0.08); border-left-color: #3b82f6; }
        [data-theme='dark'] .ts-ai-text { color: #9ca3af; }
        [data-theme='dark'] .ts-ai-text strong { color: #f8fafc; }
        [data-theme='dark'] .ov-card { background: #1e293b; border-color: rgba(255,255,255,0.08); }
        [data-theme='dark'] .ov-num { color: #f8fafc; }
        [data-theme='dark'] .ts-modal { background: #1e293b; color: #e2e8f0; }
        [data-theme='dark'] .ts-modal-close { background: #0f172a; border-color: rgba(255,255,255,0.08); color: #9ca3af; }
        [data-theme='dark'] .ts-modal-close:hover { background: #1e293b; color: #f8fafc; }
        [data-theme='dark'] .ts-mm { background: #0f172a; border-color: rgba(255,255,255,0.05); }
        [data-theme='dark'] .ts-mm-val { color: #f8fafc; }
        [data-theme='dark'] .ts-entry-head { border-bottom-color: rgba(255,255,255,0.08); }
        [data-theme='dark'] .ts-entry-row { border-bottom-color: rgba(255,255,255,0.05); }
        [data-theme='dark'] .ts-e-task { color: #e2e8f0; }
        [data-theme='dark'] .ts-e-desc { color: #f8fafc; }
        [data-theme='dark'] .ts-modal-ai { background: rgba(59, 130, 246, 0.05); border-left-color: #3b82f6; }
        [data-theme='dark'] .ts-modal-ai-text { color: #9ca3af; }
        [data-theme='dark'] ::-webkit-scrollbar-track { background: #1e293b; }
        [data-theme='dark'] ::-webkit-scrollbar-thumb { background: #0f172a; border-color: #1e293b; }
        [data-theme='dark'] ::-webkit-scrollbar-thumb:hover { background: #334155; }
        [data-theme='dark'] * { scrollbar-color: #0f172a #1e293b; }
      `}</style>
    </div>
  );
};

/* ===================== SECTION RENDERERS ===================== */

const EmployeeModal = ({ emp, onClose, allEntries }) => {
  if (!emp || emp.type === 'leave') return null;

  // Derive dynamic details from local entries
  const empEntries = allEntries.filter(e => e.employeeName === emp.name);
  
  // Group hours by date for the chart (Daily Breakdown)
  const byDate = empEntries.reduce((acc, e) => {
    if (!e.date) return acc;
    acc[e.date] = acc[e.date] || { billable: 0, nonBillable: 0 };
    if (e.billable) acc[e.date].billable += (e.hours || 0);
    else acc[e.date].nonBillable += (e.hours || 0);
    return acc;
  }, {});

  const chartData = Object.entries(byDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, data]) => ({
      date: date.slice(5), // MM-DD
      billable: Number(data.billable.toFixed(2)),
      nonBillable: Number(data.nonBillable.toFixed(2))
    }));

  const billH = emp.billableHours || 0;
  const nbH = emp.nonBillableHours || 0;
  const totalH = emp.totalHours || 0;
  const eff = totalH > 0 ? Math.round((billH / totalH) * 100) : 0;

  return (
    <div className="ts-overlay open" onClick={(e) => e.target.className.includes('ts-overlay') && onClose()}>
      <div className="ts-modal">
        <button className="ts-modal-close" onClick={onClose}>✕</button>
        
        <div className="ts-modal-head">
          <div className="ts-m-av" style={{ 
            background: COLORS_PALETTE[0] + '20', 
            color: COLORS_PALETTE[0] 
          }}>
            {emp.name?.split(' ').map(n=>n[0]).join('')}
          </div>
          <div>
            <div className="ts-m-name">{emp.name}</div>
            <div className="ts-m-meta">{emp.employeeId || 'EMP'} · {emp.entryCount} entries in range</div>
          </div>
        </div>

        <div className="ts-modal-metrics">
          <div className="ts-mm"><div className="ts-mm-val">{formatHours(totalH)}</div><div className="ts-mm-lbl">Total hours</div></div>
          <div className="ts-mm"><div className="ts-mm-val ts-gn">{formatHours(billH)}</div><div className="ts-mm-lbl">Billable</div></div>
          <div className="ts-mm"><div className="ts-mm-val ts-rd">{formatHours(nbH)}</div><div className="ts-mm-lbl">Non-billable</div></div>
        </div>

        <div className="ts-legend-row">
          <div className="ts-lg-item"><div className="ts-lg-dot" style={{ background: '#0b9e6e' }}></div>Billable</div>
          <div className="ts-lg-item"><div className="ts-lg-dot" style={{ background: '#d0d5e3' }}></div>Non-billable</div>
        </div>

        <div className="ts-chart-wrap">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3b0' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3b0' }} />
              <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
              <Bar dataKey="nonBillable" stackId="a" fill="#d0d5e3" radius={[0, 0, 0, 0]} />
              <Bar dataKey="billable" stackId="a" fill="#0b9e6e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ marginTop: '1.25rem' }}>
          <div className="ts-entry-head" style={{ gridTemplateColumns: '60px 100px 1fr 60px 60px 50px 60px' }}>
            <span>Date</span>
            <span>Project</span>
            <span>Description</span>
            <span style={{ textAlign: 'center' }}>In</span>
            <span style={{ textAlign: 'center' }}>Out</span>
            <span style={{ textAlign: 'right' }}>Hours</span>
            <span style={{ textAlign: 'right' }}>Type</span>
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {empEntries.map((e, idx) => (
              <div key={idx} className="ts-entry-row" style={{ gridTemplateColumns: '60px 100px 1fr 60px 60px 50px 60px' }}>
                <span className="ts-e-date">{e.date?.slice(5) || '-'}</span>
                <span className="ts-e-task text-truncate">{e.projectName || '-'}</span>
                <span className="ts-e-desc" title={e.description}>{e.description || '-'}</span>
                <span style={{ textAlign: 'center', fontSize: '10px', color: '#64748b' }}>{formatTimeTo12h(e.clockIn)}</span>
                <span style={{ textAlign: 'center', fontSize: '10px', color: '#64748b' }}>{formatTimeTo12h(e.clockOut)}</span>
                <span className="ts-e-hrs">{formatHours(e.hours)}</span>
                <span style={{ textAlign: 'right' }}>
                  {e.billable 
                    ? <span className="ts-pill ts-pill-g" style={{ fontSize: '10px', padding: '2px 7px' }}>Bill</span>
                    : <span className="ts-pill ts-pill-r" style={{ fontSize: '10px', padding: '2px 7px' }}>Non-B</span>
                  }
                </span>
              </div>
            ))}
            {empEntries.length === 0 && <div className="ts-empty-st">No entries found for this employee</div>}
          </div>
        </div>

        <div className="ts-modal-ai" style={{ marginTop: '1rem', padding: '0.75rem' }}>
          <div className="ts-ai-dot" style={{ flexShrink: 0, marginTop: '3px', background: '#2563eb' }}></div>
          <div className="ts-modal-ai-text">
            <strong>AI Insight:</strong> {emp.name} has a <strong>{eff}% billable rate</strong> this period — 
            {eff < 35 ? ' indicating heavy internal workload or training investment.' : 
             eff < 55 ? ' moderate mix of client work and internal obligations.' : ' strong client-facing output.'}
            {nbH > billH ? ' Non-billable hours exceed billable — consider reviewing meeting load.' : ' Billable hours lead non-billable — good time allocation.'}
          </div>
        </div>
      </div>
    </div>
  );
}

const RenderParsedAppraisal = ({ appraisalText }) => {
  const parsed = useMemo(() => {
    if (!appraisalText) return null;
    
    let summary = "";
    let ratings = [];
    let scoreText = "";
    let strengths = [];
    let improvements = [];
    let recommendations = [];
    
    const lines = appraisalText.split('\n');
    let currentSection = "";
    
    const cleanMarkdown = (str) => {
      if (!str) return "";
      return str.replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, '').trim();
    };
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('## ')) {
        const secName = line.replace('## ', '').toLowerCase();
        if (secName.includes('summary')) {
          currentSection = 'summary';
        } else if (secName.includes('ratings')) {
          currentSection = 'ratings';
        } else if (secName.includes('score')) {
          currentSection = 'score';
          scoreText = line.replace('## ', '');
        } else if (secName.includes('strengths')) {
          currentSection = 'strengths';
        } else if (secName.includes('improvement') || secName.includes('areas')) {
          currentSection = 'improvements';
        } else if (secName.includes('recommendations')) {
          currentSection = 'recommendations';
        } else {
          currentSection = '';
        }
        continue;
      }
      
      if (currentSection === 'summary') {
        if (line) summary += (summary ? ' ' : '') + line;
      } else if (currentSection === 'ratings') {
        if (line.startsWith('|') && !line.includes('---|') && !line.toLowerCase().includes('component')) {
          const parts = line.split('|').map(p => p.trim()).filter(Boolean);
          if (parts.length >= 3) {
            const num = cleanMarkdown(parts[0]);
            const name = cleanMarkdown(parts[1]);
            const ratingStr = cleanMarkdown(parts[2]);
            const justification = cleanMarkdown(parts.slice(3).join(' | '));
            ratings.push({ num, name, ratingStr, justification });
          }
        }
      } else if (currentSection === 'strengths') {
        if (line.startsWith('-') || line.startsWith('*')) {
          strengths.push(line.substring(1).trim());
        } else if (line) {
          strengths.push(line);
        }
      } else if (currentSection === 'improvements') {
        if (line.startsWith('-') || line.startsWith('*')) {
          improvements.push(line.substring(1).trim());
        } else if (line) {
          improvements.push(line);
        }
      } else if (currentSection === 'recommendations') {
        if (line.startsWith('-') || line.startsWith('*')) {
          recommendations.push(line.substring(1).trim());
        } else if (line) {
          recommendations.push(line);
        }
      }
    }
    
    // Extract score number
    let scoreNum = 0;
    let scoreMax = 50;
    if (scoreText) {
      const match = scoreText.match(/(\d+)\s*\/\s*(\d+)/);
      if (match) {
        scoreNum = parseInt(match[1]);
        scoreMax = parseInt(match[2]);
      }
    }
    
    return {
      summary: cleanMarkdown(summary),
      ratings,
      scoreText,
      scoreNum,
      scoreMax,
      strengths,
      improvements,
      recommendations,
      isParsed: !!(summary || ratings.length > 0 || scoreText)
    };
  }, [appraisalText]);

  if (!parsed || !parsed.isParsed) {
    return (
      <div className="appraisal-quote" style={{ whiteSpace: 'pre-wrap', fontStyle: 'normal', color: '#334155' }}>
        {appraisalText || "No performance narrative compiled."}
      </div>
    );
  }

  const getScoreColor = (num) => {
    if (num >= 35) return '#10b981'; // Green
    if (num >= 25) return '#3b82f6'; // Blue
    return '#ef4444'; // Red
  };

  const getScoreBg = (num) => {
    if (num >= 35) return '#edf9f4';
    if (num >= 25) return '#eff6ff';
    return '#fef2f2';
  };

  const scoreColor = getScoreColor(parsed.scoreNum);
  const scoreBg = getScoreBg(parsed.scoreNum);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '8px', marginBottom: '20px' }}>
      
      {/* Premium Circular/Pill Score Badge and Overall Summary Card */}
      <div style={{ 
        background: '#fff', 
        border: '1px solid #e2e8f0', 
        borderRadius: '12px', 
        padding: '20px', 
        boxShadow: '0 4px 12px rgba(0,0,0,0.015)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: `linear-gradient(90deg, ${scoreColor} 0%, #8b5cf6 100%)` }}></div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Executive Performance Summary
            </h4>
            <p style={{ fontSize: '13.5px', color: '#334155', lineHeight: '1.6', margin: 0, fontStyle: 'italic', fontWeight: 500 }}>
              "{parsed.summary}"
            </p>
          </div>
          
          {parsed.scoreText && (
            <div style={{ 
              background: scoreBg, 
              border: `1px solid ${scoreColor}30`, 
              borderRadius: '12px', 
              padding: '12px 18px', 
              textAlign: 'center', 
              minWidth: '120px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Performance Score</div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '2px', margin: '2px 0' }}>
                <span style={{ fontSize: '28px', fontWeight: 800, color: scoreColor }}>{parsed.scoreNum}</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>/{parsed.scoreMax}</span>
              </div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: scoreColor, textTransform: 'uppercase' }}>
                {parsed.scoreNum >= 35 ? 'Outstanding' : parsed.scoreNum >= 25 ? 'Satisfactory' : 'Needs Action'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Component Ratings Section */}
      {parsed.ratings.length > 0 && (
        <div style={{ 
          background: '#fff', 
          border: '1px solid #e2e8f0', 
          borderRadius: '12px', 
          padding: '20px', 
          boxShadow: '0 4px 12px rgba(0,0,0,0.015)' 
        }}>
          <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BarChart3 size={15} color="#8b5cf6" />
            Performance Dimension Ratings
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {parsed.ratings.map((rate, rIdx) => {
              const scoreVal = parseInt(rate.ratingStr.split('/')[0]) || 0;
              const maxVal = parseInt(rate.ratingStr.split('/')[1]) || 5;
              const barColor = scoreVal >= 4 ? '#10b981' : scoreVal >= 3 ? '#3b82f6' : scoreVal >= 2 ? '#f59e0b' : '#ef4444';
              const rowBg = rIdx % 2 === 0 ? '#f8fafc' : '#ffffff';
              
              return (
                <div key={rIdx} style={{ 
                  background: rowBg, 
                  border: '1px solid #f1f5f9', 
                  borderRadius: '10px', 
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', fontFamily: 'DM Mono' }}>#{rate.num}</span>
                      <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#1e293b' }}>{rate.name}</span>
                    </div>
                    
                    {/* Visual Rating Bars */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ display: 'flex', gap: '3px' }}>
                        {[...Array(maxVal)].map((_, i) => (
                          <div
                            key={i}
                            style={{
                              width: '12px',
                              height: '6px',
                              borderRadius: '1.5px',
                              backgroundColor: i < scoreVal ? barColor : '#e2e8f0'
                            }}
                          />
                        ))}
                      </div>
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: 700, 
                        color: barColor, 
                        background: `${barColor}12`, 
                        padding: '2px 8px', 
                        borderRadius: '6px'
                      }}>
                        {rate.ratingStr}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ fontSize: '12.5px', color: '#475569', lineHeight: '1.5', paddingLeft: '24px' }}>
                    {rate.justification}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

function RenderAiInsights({ data: rawData, loading, status, error, dateRange, setDateRange, onTrigger, searchTerm, setSearchTerm }) {
  // Rotate loading text messages for AI synthesis feel
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const loadingMessages = [
    "Compiling daily timesheet logs...",
    "Correlating biometric attendance clock-ins...",
    "Computing developer logging density metrics...",
    "Synthesizing qualitative appraisal narratives...",
    "Formulating growths & leadership recommendations..."
  ];

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingMsgIdx(prev => (prev + 1) % loadingMessages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [loading]);

  const handleStartChange = (e) => {
    setDateRange(prev => ({ ...prev, startDate: e.target.value }));
  };

  const handleEndChange = (e) => {
    setDateRange(prev => ({ ...prev, endDate: e.target.value }));
  };

  // Structured Data Compatibility Adapter
  const data = useMemo(() => {
    if (!rawData) return null;
    
    let rawResults = [];
    let summaryObj = {};
    
    if (rawData.employees && rawData.teamSummary) {
      rawResults = rawData.employees;
      summaryObj = {
        total_employees_assessed: rawData.teamSummary.employeesAssessed,
        total_hours_logged_by_team: rawData.teamSummary.totalHoursLogged,
        average_hours_per_employee: rawData.teamSummary.averageHoursPerEmployee,
        total_entries_analyzed: rawData.teamSummary.totalEntries
      };
    } else if (rawData.results) {
      rawResults = rawData.results;
      const originalSummary = rawData.summary || {};
      summaryObj = {
        total_employees_assessed: originalSummary.total_employees_assessed || rawData.results.length,
        total_hours_logged_by_team: originalSummary.total_hours_logged_by_team || 0,
        average_hours_per_employee: originalSummary.average_hours_per_employee || 0,
        total_entries_analyzed: originalSummary.total_entries_analyzed || 0
      };
    } else {
      return rawData;
    }

    const results = rawResults.map(empNode => {
      // Extract employee info
      const empId = empNode.employee?.id || empNode.employee_id || '';
      const empName = empNode.employee?.name || empNode.employee_name || '';
      const department = empNode.employee?.department || empNode.department || 'Engineering';
      const designation = empNode.employee?.designation || empNode.designation || 'Software Engineer';
      
      // Extract metrics
      const origMetrics = empNode.productivity || empNode.metrics || {};
      const totalHours = origMetrics.totalHours ?? origMetrics.total_hours ?? 0;
      const totalEntries = origMetrics.totalEntries ?? origMetrics.total_entries ?? 0;
      const approvedCount = origMetrics.approvedEntries ?? origMetrics.approved_count ?? 0;
      const pendingCount = origMetrics.pendingEntries ?? origMetrics.pending_count ?? 0;
      const rejectedCount = origMetrics.rejectedEntries ?? origMetrics.rejected_count ?? 0;
      const lateSubmissions = origMetrics.lateSubmissions ?? origMetrics.late_submissions ?? 0;
      const projects = origMetrics.projects || [];
      
      // Daily summary reconstruction — handles both array (new DB) and object (old microservice) shapes
      let daily_summary = {};
      const rawDailySummary = origMetrics.daily_summary || empNode.attendance?.dailyAttendance || [];
      
      if (Array.isArray(rawDailySummary)) {
        rawDailySummary.forEach(day => {
          if (day.date) {
            daily_summary[day.date] = {
              hours: day.workedHours ?? day.hours ?? 0,
              status: day.status || ((day.workedHours || day.hours) > 0 ? 'APPROVED' : 'PENDING'),
              clockIn: day.clockIn || '',
              clockOut: day.clockOut || '',
              location: day.location || 'OFFICE',
              timesheetEntries: day.timesheetEntries || []
            };
          }
        });
      } else if (rawDailySummary && typeof rawDailySummary === 'object') {
        Object.entries(rawDailySummary).forEach(([dateStr, dayData]) => {
          daily_summary[dateStr] = {
            hours: dayData.hours ?? 0,
            status: dayData.status || (dayData.hours > 0 ? 'APPROVED' : 'PENDING'),
            clockIn: dayData.clockIn || '',
            clockOut: dayData.clockOut || '',
            location: dayData.location || 'OFFICE',
            timesheetEntries: dayData.timesheetEntries || []
          };
        });
      }

      // ─────────────────────────────────────────────────────────────────────
      // CENTRALIZED METRICS & ANALYTICS ENGINE (FRONTEND)
      // Source-of-truth: raw daily_summary ledger — no soft-skill guessing.
      // ─────────────────────────────────────────────────────────────────────

      // 1. Calculate total working days (weekdays only) in the selected range
      let workingDays = 0;
      const startStr = dateRange.startDate;
      const endStr = dateRange.endDate;
      if (startStr && endStr) {
        let curr = new Date(startStr);
        const end = new Date(endStr);
        let limit = 0;
        while (curr <= end && limit < 1000) {
          limit++;
          const dow = curr.getDay();
          if (dow !== 0 && dow !== 6) workingDays++;
          curr.setDate(curr.getDate() + 1);
        }
      }
      if (workingDays === 0) workingDays = 22;
      
      // 2. Present days, WFH days, Office days
      let presentDays = 0;
      let weekendWorkDays = 0;
      let officeDays = 0;
      let wfhDays = 0;
      let missingSwipes = 0;
      let underworkedDays = 0;
      let overtimeDays = 0;
      let abnormalDays = 0;
      let weekendWorkdays = [];
      
      // Biometric clock timings parsing
      let totalInSecs = 0;
      let inCount = 0;
      let totalOutSecs = 0;
      let outCount = 0;
      
      Object.entries(daily_summary).forEach(([dateStr, dayData]) => {
        const hours = dayData.hours ?? 0;
        const clockIn = dayData.clockIn || "";
        const clockOut = dayData.clockOut || "";
        const hasSwipes = clockIn.trim() !== '' || clockOut.trim() !== '';
        const hasEntries = dayData.timesheetEntries && dayData.timesheetEntries.length > 0;
        
        // Weekend check
        const d = new Date(dateStr);
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        
        if (hours > 0 || hasSwipes || hasEntries) {
          if (isWeekend) {
            weekendWorkDays++;
            weekendWorkdays.push(dateStr);
          } else {
            presentDays++;
          }
          
          const location = dayData.location || 'OFFICE';
          if (location === 'WORK_FROM_HOME' || location === 'FROM_HOME' || location === 'WFH' || String(location).toUpperCase().includes('FROM_HOME')) {
            wfhDays++;
          } else {
            officeDays++;
            if (clockIn.trim() === '' || clockOut.trim() === '') {
              missingSwipes++;
            }
          }
          
          // Anomaly checks
          if (hours > 12.0) {
            abnormalDays++;
          }
          if (hours > 9.0) {
            overtimeDays++;
          } else if (hours < 4.0 && hours > 0) {
            underworkedDays++;
          }
          
          // Parse Clock-In
          if (clockIn.trim() !== '') {
            const parts = clockIn.split(':');
            if (parts.length >= 2) {
              const secs = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60;
              totalInSecs += secs;
              inCount++;
            }
          }
          
          // Parse Clock-Out
          if (clockOut.trim() !== '') {
            const parts = clockOut.split(':');
            if (parts.length >= 2) {
              const secs = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60;
              totalOutSecs += secs;
              outCount++;
            }
          }
        }
      });
      
      // Calculate averages and ratios
      const leaveDays = Math.max(0, workingDays - presentDays);
      const hybridRatio = (officeDays + wfhDays) > 0 ? Math.round((officeDays / (officeDays + wfhDays)) * 100) : 0;
      const avgDailyHours = presentDays > 0 ? Math.round((totalHours / presentDays) * 100) / 100 : 0;
      
      const formatAvgTime = (totalSecs, count) => {
        if (count === 0) return 'N/A';
        const avgSecs = Math.round(totalSecs / count);
        const hrs = Math.floor(avgSecs / 3600);
        const mins = Math.floor((avgSecs % 3600) / 60);
        const ampm = hrs >= 12 ? 'PM' : 'AM';
        const displayHrs = hrs % 12 === 0 ? 12 : hrs % 12;
        const displayMins = mins.toString().padStart(2, '0');
        return `${displayHrs}:${displayMins} ${ampm}`;
      };
      
      const avgClockIn = formatAvgTime(totalInSecs, inCount);
      const avgClockOut = formatAvgTime(totalOutSecs, outCount);
      
      // 3. Explainable Policy Penalties & Compliance Score
      const penaltyLate = lateSubmissions * 3.0;
      const penaltyReject = rejectedCount * 8.0;
      const penaltyMissingSwipe = missingSwipes * 4.0;
      const penaltyAnomaly = abnormalDays * 5.0;
      const penaltyInsufficientHours = underworkedDays * 4.0;
      
      let complianceScore = 100 - penaltyLate - penaltyReject - penaltyMissingSwipe - penaltyAnomaly - penaltyInsufficientHours;
      complianceScore = Math.max(0, Math.min(100, Math.round(complianceScore)));
      
      // 4. Anomaly detection and risk flags synthesis
      let riskFlags = [];
      if (inCount === 0 && officeDays > 0) {
        riskFlags.push("⚠ Missing Clock-In / Clock-Out records — no attendance logs found for office days");
      }
      if (avgDailyHours < 6.0 && presentDays > 0) {
        riskFlags.push("⚠ Low average work hours - below full-time allocation threshold");
      }
      if (pendingCount > 5) {
        riskFlags.push("⚠ Excess pending submissions - requires immediate approval action");
      }
      if (rejectedCount > 0) {
        riskFlags.push("⚠ Rejected timesheet entries found - review compliance warning");
      }
      if (lateSubmissions > 10) {
        riskFlags.push("⚠ High late submission ratio - low timesheet discipline");
      }
      if (abnormalDays > 0) {
        riskFlags.push(`⚠ Abnormal work duration detected (>12 hrs) on ${abnormalDays} day(s)`);
      }
      if (missingSwipes > 0 && inCount > 0) {
        riskFlags.push(`⚠ Missing Clock-In / Clock-Out on ${missingSwipes} office day(s)`);
      }
      
      // 5. Elite Trustworthiness metrics
      const attendanceIntegrity = inCount === 0 ? 'LOW' : (missingSwipes === 0 ? 'HIGH' : 'MEDIUM');
      const systemRiskLevel = (riskFlags.length > 3 || rejectedCount > 2) ? 'HIGH' : (riskFlags.length > 0 ? 'MEDIUM' : 'LOW');
      
      // 6. Calculate worked hours array for active days
      let workedHoursArray = [];
      Object.values(daily_summary).forEach(day => {
        const hours = day.hours ?? 0;
        if (hours > 0) workedHoursArray.push(hours);
      });
      
      // Calculate standard deviation for Productivity Consistency
      let variance = 0;
      let activeDaysCount = workedHoursArray.length;
      if (activeDaysCount > 1) {
        let mean = totalHours / activeDaysCount;
        let sumSquaredDiffs = workedHoursArray.reduce((sum, h) => sum + Math.pow(h - mean, 2), 0);
        variance = sumSquaredDiffs / activeDaysCount;
      }
      let standardDeviation = Math.sqrt(variance);
      let productivityConsistencyScore = 5;
      if (activeDaysCount <= 1) productivityConsistencyScore = 1;
      else if (standardDeviation > 3.5) productivityConsistencyScore = 2; // extreme variance
      else if (standardDeviation > 2.0) productivityConsistencyScore = 3; // moderate variance
      else if (standardDeviation > 1.0) productivityConsistencyScore = 4; // low variance
      else productivityConsistencyScore = 5; // highly stable
      
      // Document Richness rating
      let totalWords = 0;
      let totalDescriptions = 0;
      Object.values(daily_summary).forEach(day => {
        (day.timesheetEntries || []).forEach(entry => {
          if (entry.description) {
            const words = entry.description.trim().split(/\s+/).filter(Boolean).length;
            totalWords += words;
            totalDescriptions++;
          }
        });
      });
      let avgWordCount = totalDescriptions > 0 ? (totalWords / totalDescriptions) : 0;
      let documentationScore = 1;
      if (avgWordCount >= 15) documentationScore = 5;
      else if (avgWordCount >= 9) documentationScore = 4;
      else if (avgWordCount >= 5) documentationScore = 3;
      else if (avgWordCount >= 2) documentationScore = 2;
      else documentationScore = 1;

      // Defensible AI Confidence Score Formula based on Telemetry Completeness Matrix
      let biometricCoverage = presentDays > 0 ? (inCount / presentDays) * 30 : 0;
      let timesheetCompleteness = totalEntries > 0 ? (approvedCount / totalEntries) * 20 : 0;
      let approvalRatio = (approvedCount + rejectedCount) > 0 ? (approvedCount / (approvedCount + rejectedCount)) * 20 : 20;
      let richnessScore = Math.min(15, avgWordCount) / 15 * 15; // weight 15%
      let telemetryConsistency = 15;
      if (missingSwipes > 0) telemetryConsistency -= (missingSwipes * 3);
      if (abnormalDays > 0) telemetryConsistency -= (abnormalDays * 5);
      telemetryConsistency = Math.max(0, telemetryConsistency);
      
      let confidenceScore = biometricCoverage + timesheetCompleteness + approvalRatio + richnessScore + telemetryConsistency;
      confidenceScore = Math.max(10, Math.min(100, Math.round(confidenceScore)));
      
      // AI Evaluation payload mapping
      const aiEval = empNode.aiEvaluation || {};
      let overallScoreStr = empNode.score || aiEval.overallScore || "17/50";
      let overallScore = 17;
      let maxScore = 50;
      if (typeof overallScoreStr === 'string' && overallScoreStr.includes('/')) {
        const parts = overallScoreStr.split('/');
        overallScore = parseInt(parts[0]) || 17;
        maxScore = parseInt(parts[1]) || 50;
      } else if (typeof overallScoreStr === 'number') {
        overallScore = overallScoreStr;
      }
      
      let performanceLevel = aiEval.performanceLevel || "Needs Action";
      if (overallScore >= 45) performanceLevel = "Highly Productive";
      else if (overallScore >= 35) performanceLevel = "Satisfactory";
      else if (overallScore >= 20) performanceLevel = "Needs Improvement";
      
      // Ground AI ratings mapping strictly in evidence to avoid soft-skill hallucination
      const ratings = {
        punctuality: inCount > 0 ? Math.max(1, Math.round(5 - (missingSwipes * 0.5))) : 2,
        accountability: Math.max(1, Math.round(5 - (rejectedCount * 1.5) - (lateSubmissions * 0.3))),
        qualityOfWork: Math.max(1, Math.round(5 - (rejectedCount * 1.5))),
        quantityOfWork: avgDailyHours >= 8.5 ? 5 : (avgDailyHours >= 7.5 ? 4 : (avgDailyHours >= 6.0 ? 3 : (avgDailyHours >= 4.0 ? 2 : 1))),
        consistency: productivityConsistencyScore,
        documentation: documentationScore,
        teamwork: "N/A",  // Explicitly N/A for telemetry disconnects
        leadership: "N/A"  // Explicitly N/A for telemetry disconnects
      };

      return {
        employee_id: empId,
        employee_name: empName,
        department: department,
        designation: designation,
        score: `${overallScore}/${maxScore}`,
        appraisal: empNode.appraisal || aiEval.summary || empNode.appraisalNarrative || "Steady performance.",
        pros: empNode.pros || empNode.strengths || aiEval.pros || [],
        improvements: empNode.improvements || aiEval.improvements || [],
        recommendations: empNode.recommendations || aiEval.recommendations || [],
        
        attendance: {
          workingDays,
          presentDays,
          weekendWorkDays,
          leaveDays,
          officeDays,
          wfhDays,
          hybridRatio,
          avgHoursPerDay: avgDailyHours,
          avgClockIn,
          avgClockOut,
          overtimeDays,
          underworkedDays,
          lateSubmissions,
          complianceScore,
          
          penaltyLate,
          penaltyReject,
          penaltyMissingSwipe,
          penaltyAnomaly,
          penaltyInsufficientHours,
          abnormalDays,
          
          dailyAttendance: Object.entries(daily_summary).map(([date, data]) => ({
            date,
            workedHours: data.hours,
            status: data.status,
            clockIn: data.clockIn,
            clockOut: data.clockOut,
            location: data.location,
            timesheetEntries: data.timesheetEntries
          }))
        },
        productivity: {
          totalHours,
          totalEntries,
          approvedEntries: approvedCount,
          pendingEntries: pendingCount,
          rejectedEntries: rejectedCount,
          projects,
          taskDistribution: origMetrics.taskDistribution || {}
        },
        riskFlags,
        aiEvaluation: {
          overallScore,
          maxScore,
          performanceLevel,
          ratings
        },
        
        attendanceIntegrity,
        systemRiskLevel,
        confidenceScore,
        weekendWorkdays,
        
        officeDays,
        wfhDays,
        performanceLevel,
        ratings,
        metrics: {
          total_hours: totalHours,
          total_entries: totalEntries,
          total_days: workingDays,
          approved_count: approvedCount,
          rejected_count: rejectedCount,
          pending_count: pendingCount,
          avg_hours_per_day: avgDailyHours,
          late_submissions: lateSubmissions,
          projects,
          daily_summary
        }
      };
    });

    return { summary: summaryObj, results };
  }, [rawData, dateRange]);

  // Filter employee results
  const filteredResults = useMemo(() => {
    if (!data?.results) return [];
    if (!searchTerm) return data.results;
    const q = searchTerm.toLowerCase();
    return data.results.filter(r => 
      r.employee_name?.toLowerCase().includes(q) ||
      r.employee_id?.toLowerCase().includes(q)
    );
  }, [data, searchTerm]);

  // Dynamic colors for grade scores
  const getGradeStyle = (score) => {
    const s = String(score || '').toLowerCase();
    if (s.includes('95%') || s.includes('exceeds') || s.includes('a+')) {
      return {
        badgeBg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        textColor: '#064e3b',
        borderColor: '#a7f3d0',
        textLabel: 'Outstanding Performance'
      };
    } else if (s.includes('82%') || s.includes('meets') || s.includes('b')) {
      return {
        badgeBg: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        textColor: '#1e3a8a',
        borderColor: '#bfdbfe',
        textLabel: 'Strong Contribution'
      };
    } else {
      return {
        badgeBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        textColor: '#78350f',
        borderColor: '#fde68a',
        textLabel: 'Under Allocation - Attention Needed'
      };
    }
  };

  return (
    <div className="ts-dashboard-content">
      {/* Dynamic Keyframe Styles */}
      <style>{`
        @keyframes scanGlow {
          0% { box-shadow: 0 0 10px rgba(59,130,246,0.3), 0 0 20px rgba(139,92,246,0.2); }
          50% { box-shadow: 0 0 25px rgba(59,130,246,0.6), 0 0 45px rgba(139,92,246,0.4); }
          100% { box-shadow: 0 0 10px rgba(59,130,246,0.3), 0 0 20px rgba(139,92,246,0.2); }
        }
        @keyframes loadingBar {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }
        .ai-glow-card {
          border: 1px solid rgba(139, 92, 246, 0.2);
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
        }
        .ai-glow-card:hover {
          border-color: rgba(139, 92, 246, 0.4);
          box-shadow: 0 12px 30px rgba(139, 92, 246, 0.08);
        }
        .ai-pulse-btn {
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%) !important;
          color: #fff !important;
          border: none !important;
          font-weight: 600 !important;
          transition: all 0.25s ease !important;
        }
        .ai-pulse-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(139, 92, 246, 0.45) !important;
        }
        .ai-pulse-btn:disabled {
          background: #cbd5e1 !important;
          cursor: not-allowed;
        }
        .ai-scanning-orb {
          width: 80px; height: 80px;
          border-radius: 50%;
          background: radial-gradient(circle, #3b82f6 0%, #8b5cf6 100%);
          display: flex; align-items: center; justify-content: center;
          color: #fff;
          margin: 0 auto 20px;
          animation: scanGlow 2s ease-in-out infinite;
        }
        .appraisal-summary-details {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          margin-bottom: 16px;
          background: #fff;
          overflow: hidden;
          transition: all 0.2s;
        }
        .appraisal-summary-details[open] {
          border-color: #8b5cf6;
          box-shadow: 0 4px 20px rgba(139, 92, 246, 0.06);
        }
        .appraisal-summary-header {
          padding: 18px 24px;
          cursor: pointer;
          user-select: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-weight: 600;
        }
        .appraisal-summary-header:hover {
          background: #faf5ff;
        }
        .appraisal-quote {
          position: relative;
          background: #f8fafc;
          border-left: 4px solid #8b5cf6;
          border-radius: 4px 12px 12px 4px;
          padding: 16px 20px;
          margin-bottom: 20px;
          font-style: italic;
          color: #334155;
          font-size: 14px;
          line-height: 1.6;
        }
        .ai-metric-mini {
          background: #f1f5f9;
          border-radius: 8px;
          padding: 10px 14px;
          text-align: center;
        }
        .ai-metric-mini-val {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          font-family: 'DM Mono', monospace;
        }
        .ai-metric-mini-lbl {
          font-size: 10px;
          color: #64748b;
          text-transform: uppercase;
          margin-top: 2px;
          font-weight: 600;
        }
        .ai-card-title {
          font-size: 18px;
          font-weight: 700;
          background: linear-gradient(135deg, #1e293b 0%, #475569 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>

      {/* Control Banner Card */}
      <div className="ai-glow-card" style={{ borderRadius: 16, padding: '24px', marginBottom: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ background: '#e0e7ff', padding: 8, borderRadius: 10, display: 'flex', alignItems: 'center' }}>
            <Sparkles size={20} color="#3b82f6" />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Pragava AI Team Analytics Engine</h2>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: '2px 0 0 0' }}>Generate automated employee performance and attendance reports</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Start Date</label>
            <input 
              type="date" 
              value={dateRange.startDate} 
              onChange={handleStartChange}
              disabled={loading}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>End Date</label>
            <input 
              type="date" 
              value={dateRange.endDate} 
              onChange={handleEndChange}
              disabled={loading}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
            />
          </div>

          <button 
            onClick={onTrigger} 
            disabled={loading}
            className="ai-pulse-btn"
            style={{ padding: '10px 24px', borderRadius: 8, fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', height: '38px' }}
          >
            {loading ? (
              <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Brain size={15} />
            )}
            {loading ? 'Generating...' : 'Generate Performance Reports'}
          </button>
        </div>
      </div>

      {/* Loading Scanning Matrix View */}
      {loading && (
        <div className="ai-glow-card" style={{ borderRadius: 16, padding: '40px 20px', textAlign: 'center', marginBottom: '24px' }}>
          <div className="ai-scanning-orb">
            <Brain size={32} style={{ animation: 'pulse 1.5s infinite' }} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
            Pragava Attendance Intelligence Sync
          </h3>
          <p style={{ fontSize: '13.5px', color: '#64748b', maxWidth: '400px', margin: '0 auto 20px' }}>
            Cross-referencing clock-in / clock-out logs, timesheet entries, work hours, and attendance patterns...
          </p>

          <div style={{ width: '100%', maxWidth: '340px', background: '#e2e8f0', height: '6px', borderRadius: '3px', margin: '0 auto 12px', overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)', height: '100%', width: '100%', animation: 'loadingBar 4s infinite ease-in-out' }}></div>
          </div>
          
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <RefreshCw size={12} style={{ animation: 'spin 1.5s linear infinite' }} />
            {loadingMessages[loadingMsgIdx]}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && !loading && (
        <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 12, padding: '16px 20px', display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#991b1b', margin: 0 }}>Analysis Engine Warning</h4>
            <p style={{ fontSize: '13px', color: '#b91c1c', margin: '4px 0 0 0' }}>{error}</p>
          </div>
        </div>
      )}

      {/* Completed Appraisal Output Panel */}
      {data && !loading && (
        <>
          {/* Summary KPIs Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Assessed Employees</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: '4px 0 0 0' }}>{data.summary?.total_employees_assessed ?? 0}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Active reporting structure</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Logged Team Hours</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: '4px 0 0 0' }}>{data.summary?.total_hours_logged_by_team ?? 0} hrs</div>
              <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, marginTop: '4px' }}>100% billable allocation check</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Hours per Employee</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: '4px 0 0 0' }}>{data.summary?.average_hours_per_employee?.toFixed(1) ?? 0} hrs</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>For this reporting period</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Entries Processed</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: '4px 0 0 0' }}>{data.summary?.total_entries_analyzed ?? 0} logs</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Timesheet lines cross-referenced</div>
            </div>
          </div>

          {/* Search bar inside Completed panel */}
          <div className="team-table-hd" style={{ marginTop: '30px' }}>
            <h3 className="team-table-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={16} color="#3b82f6" />
              Employee Performance & Attendance Reports
            </h3>
            <div className="team-srch">
              <Search size={14} style={{ color: '#94a3b8' }} />
              <input 
                placeholder="Search employee records..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Detailed Employee Cards */}
          <div style={{ marginTop: '16px' }}>
            {filteredResults.map((result, idx) => {
              const grade = getGradeStyle(result.score);
              const initials = (result.employee_name || '').split(' ').map(n=>n[0]).join('');
              const empColor = COLORS_PALETTE[idx % COLORS_PALETTE.length];
              
              return (
                <details key={idx} className="appraisal-summary-details">
                  <summary className="appraisal-summary-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div className="u-av" style={{ background: `${empColor}15`, color: empColor, width: '40px', height: '40px', fontSize: '14px' }}>
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{result.employee_name}</div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                          <strong style={{ color: '#475569' }}>{result.designation || 'Software Engineer'}</strong> · {result.department || 'Engineering'} · {result.employee_id}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        background: result.performanceLevel === 'Highly Productive' || result.performanceLevel === 'Excellent' ? '#ecfdf5' : result.performanceLevel === 'Satisfactory' ? '#eff6ff' : '#fef2f2',
                        color: result.performanceLevel === 'Highly Productive' || result.performanceLevel === 'Excellent' ? '#10b981' : result.performanceLevel === 'Satisfactory' ? '#3b82f6' : '#ef4444',
                        border: `1px solid ${result.performanceLevel === 'Highly Productive' || result.performanceLevel === 'Excellent' ? '#a7f3d0' : result.performanceLevel === 'Satisfactory' ? '#bfdbfe' : '#fecaca'}`,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '10.5px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        {result.performanceLevel}
                      </span>
                      <span style={{ 
                        background: grade.badgeBg,
                        color: '#fff',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                      }}>
                        {result.score}
                      </span>
                      <div style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 'bold' }}>▼</div>
                    </div>
                  </summary>

                  <div style={{ padding: '24px', borderTop: '1px solid #f1f5f9', background: '#fafbfc' }}>
                    
                    {/* SECTION 1 — Executive KPI Cards Grid */}
                    <div style={{ marginBottom: '24px' }}>
                      <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#475569', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <LayoutDashboard size={14} color="#64748b" />
                        Employee Performance & Attendance Reports
                      </h4>
                      
                      {/* Row 1: Attendance Metrics */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Total Working Days</div>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{result.attendance?.workingDays ?? 0} days</div>
                          <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>Excluding weekends & holidays</div>
                        </div>
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Present Days</div>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>{result.attendance?.presentDays ?? 0} days</div>
                          <div style={{ fontSize: '9.5px', color: '#10b981', fontWeight: 600, marginTop: '2px' }}>Active biometric/timesheet logs</div>
                        </div>
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Leave Days</div>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: (result.attendance?.leaveDays ?? 0) > 3 ? '#ef4444' : '#f59e0b', marginTop: '2px' }}>{result.attendance?.leaveDays ?? 0} days</div>
                          <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>Working Days - Present Days</div>
                        </div>
                      </div>

                      {/* Row 2: Location & Work Mode Analytics */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Office Days</div>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: '#475569', marginTop: '2px' }}>{result.officeDays ?? 0} days</div>
                          <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>Physical swipes at terminal</div>
                        </div>
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>WFH Days</div>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: '#3b82f6', marginTop: '2px' }}>{result.wfhDays ?? 0} days</div>
                          <div style={{ fontSize: '9.5px', color: '#3b82f6', fontWeight: 600, marginTop: '2px' }}>Remote work mode allocation</div>
                        </div>
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Hybrid Ratio</div>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: '#8b5cf6', marginTop: '2px' }}>{result.attendance?.hybridRatio ?? 0}%</div>
                          <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>Office / WFH allocation percentage</div>
                        </div>
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Avg Daily Hours</div>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{(result.attendance?.avgHoursPerDay ?? 0).toFixed(1)} hrs</div>
                          <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>Total hours / present days</div>
                        </div>
                      </div>

                      {/* Row 3: Swipe Telemetry & Compliance Metrics */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Avg Clock-In Time</div>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: result.attendance?.avgClockIn === 'N/A' ? '#94a3b8' : '#475569', marginTop: '2px', fontFamily: 'DM Mono' }}>{result.attendance?.avgClockIn ?? 'N/A'}</div>
                          <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>Average daily clock-in time</div>
                        </div>
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Avg Clock-Out Time</div>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: result.attendance?.avgClockOut === 'N/A' ? '#94a3b8' : '#475569', marginTop: '2px', fontFamily: 'DM Mono' }}>{result.attendance?.avgClockOut ?? 'N/A'}</div>
                          <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>Average daily clock-out time</div>
                        </div>
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Overtime Days</div>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>{result.attendance?.overtimeDays ?? 0} days</div>
                          <div style={{ fontSize: '9.5px', color: '#10b981', fontWeight: 600, marginTop: '2px' }}>Days exceeding 9.0 logged hours</div>
                        </div>
                        {(result.attendance?.weekendWorkDays ?? 0) > 0 && (
                          <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase' }}>Weekend Work</div>
                            <div style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626', marginTop: '2px' }}>{result.attendance.weekendWorkDays} days</div>
                            <div style={{ fontSize: '9.5px', color: '#ef4444', fontWeight: 600, marginTop: '2px' }}>Work logged on Sat/Sun</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SECTION 1.5 — Attendance Validation Summary */}
                    <div style={{ marginBottom: '24px' }}>
                      <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#475569', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Shield size={14} color="#64748b" />
                        Attendance Validation Summary
                      </h4>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                        gap: '12px' 
                      }}>
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.01)' }}>
                          <div style={{ background: result.systemRiskLevel === 'LOW' ? '#e6f4ea' : result.systemRiskLevel === 'MEDIUM' ? '#fef3c7' : '#fce8e6', padding: '10px', borderRadius: '10px', display: 'flex', alignItems: 'center' }}>
                            <FileSpreadsheet size={20} color={result.systemRiskLevel === 'LOW' ? '#137333' : result.systemRiskLevel === 'MEDIUM' ? '#b06000' : '#c5221f'} />
                          </div>
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Timesheet Reports</div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                              {result.systemRiskLevel === 'LOW' ? 'Consistent' : result.systemRiskLevel === 'MEDIUM' ? 'Gaps Detected' : 'Issues Found'}
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                              Attendance & timesheet consistency analysis
                            </div>
                          </div>
                        </div>

                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.01)' }}>
                          <div style={{ background: '#f5f3ff', padding: '10px', borderRadius: '10px', display: 'flex', alignItems: 'center' }}>
                            <BarChart3 size={20} color="#8b5cf6" />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
                              <span>Timesheet Validation</span>
                              <span style={{ color: '#8b5cf6', fontWeight: 800 }}>{result.confidenceScore}%</span>
                            </div>
                            <div style={{ width: '100%', background: '#e2e8f0', height: '6px', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                              <div style={{ background: '#8b5cf6', height: '100%', width: `${result.confidenceScore}%`, borderRadius: '3px' }}></div>
                            </div>
                            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '4px' }}>
                              Based on clock-in logs, approval rate & entry completeness
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 1.6 — Attendance & Productivity Trend Graph */}
                    {(() => {
                      const chartData = Object.entries(result.metrics?.daily_summary || {})
                        .sort((a, b) => new Date(a[0]) - new Date(b[0]))
                        .map(([dateStr, dayData]) => {
                          const dateObj = new Date(dateStr);
                          return {
                            date: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                            Hours: dayData.hours ?? 0
                          };
                        });

                      return chartData.length > 0 ? (
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.01)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <TrendingUp size={16} color="#3b82f6" />
                              <h5 style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Daily Hours & Activity Trend</h5>
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                              Interactive visual ledger tracking
                            </div>
                          </div>
                          <div style={{ height: '200px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                              <LineChart data={chartData} margin={{ top: 10, right: 15, left: -25, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} stroke="#cbd5e1" />
                                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} stroke="#cbd5e1" />
                                <Tooltip 
                                  contentStyle={{ background: '#0f172a', color: '#fff', borderRadius: '8px', border: 'none', fontSize: '11px' }}
                                  labelStyle={{ fontWeight: 'bold', color: '#38bdf8' }}
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="Hours" 
                                  stroke="#3b82f6" 
                                  strokeWidth={2.5} 
                                  activeDot={{ r: 6 }} 
                                  dot={{ r: 3, stroke: '#3b82f6', strokeWidth: 1.5, fill: '#fff' }} 
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {/* SECTION 2 — System Integrity Risk Flags */}
                    {result.riskFlags && result.riskFlags.length > 0 && (
                      <div style={{
                        background: '#fffbeb',
                        border: '1px solid #fef3c7',
                        borderRadius: '12px',
                        padding: '16px 20px',
                        marginBottom: '24px',
                        boxShadow: '0 2px 8px rgba(245,158,11,0.02)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 800, color: '#b45309', marginBottom: '8px' }}>
                          <AlertTriangle size={15} color="#d97706" />
                          SYSTEM INTEGRITY RISK WARNINGS
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {result.riskFlags.map((flag, fIdx) => (
                            <div key={fIdx} style={{ fontSize: '12px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                              <span>• {flag}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SECTION 3 — Chronological Attendance & Timesheet Ledger Table */}
                    {result.metrics?.daily_summary && Object.keys(result.metrics.daily_summary).length > 0 && (
                      <div style={{ marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#475569', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={14} color="#64748b" />
                          Attendance & Timesheet Work-Hours Ledger
                        </h4>
                        
                        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.01)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Date</th>
                                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Work Mode</th>
                                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Clock-In</th>
                                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Clock-Out</th>
                                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Worked Hours</th>
                                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Compliance Remark</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(result.metrics.daily_summary)
                                .sort((a, b) => new Date(a[0]) - new Date(b[0]))
                                .map(([dateStr, dayData]) => {
                                  const hours = dayData.hours ?? 0;
                                  const location = dayData.location || 'OFFICE';
                                  const hasClockIn = dayData.clockIn && dayData.clockIn.trim() !== '';
                                  const hasClockOut = dayData.clockOut && dayData.clockOut.trim() !== '';
                                  const hasEntries = dayData.timesheetEntries && dayData.timesheetEntries.length > 0;
                                  const isWFH = location === 'WORK_FROM_HOME' || location === 'FROM_HOME' || location === 'WFH' || String(location || '').toUpperCase().includes('FROM_HOME');

                                  const dateObj = new Date(dateStr);
                                  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                                  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                                  const dateDisplay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                                  // Compliance Remark — 6 rules
                                  let remark = 'Complete';
                                  let remarkClr = '#10b981';
                                  let remarkBg = '#ecfdf5';

                                  if (hours === 0 && !hasClockIn && !hasClockOut && !hasEntries) {
                                    remark = 'Missing Timesheet Entry';
                                    remarkClr = '#6b7280';
                                    remarkBg = '#f9fafb';
                                  } else if (hours > 12) {
                                    remark = 'Abnormal/Extra Work Duration';
                                    remarkClr = '#dc2626';
                                    remarkBg = '#fef2f2';
                                  } else if (!hasClockIn && !hasClockOut) {
                                    remark = 'Missing Clock-In & Clock-Out';
                                    remarkClr = '#ef4444';
                                    remarkBg = '#fef2f2';
                                  } else if (!hasClockIn) {
                                    remark = 'Missing Clock-In';
                                    remarkClr = '#f59e0b';
                                    remarkBg = '#fffbeb';
                                  } else if (!hasClockOut) {
                                    remark = 'Missing Clock-Out';
                                    remarkClr = '#f59e0b';
                                    remarkBg = '#fffbeb';
                                  }

                                  return (
                                    <React.Fragment key={dateStr}>
                                      <tr style={{ borderBottom: '1px solid #f1f5f9', background: isWeekend ? '#fafbfc' : 'transparent' }}>
                                        <td style={{ padding: '10px 14px', fontWeight: 700, color: isWeekend ? '#64748b' : '#1e293b' }}>
                                          {dayName}, {dateDisplay}
                                          {isWeekend && (
                                            <span style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', marginLeft: '6px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                                              WEEKEND
                                            </span>
                                          )}
                                        </td>
                                        <td style={{ padding: '10px 14px' }}>
                                          <span style={{
                                            fontSize: '9.5px',
                                            fontWeight: 800,
                                            color: isWFH ? '#3b82f6' : '#475569',
                                            background: isWFH ? '#eff6ff' : '#f1f5f9',
                                            padding: '2px 8px',
                                            borderRadius: '4px'
                                          }}>
                                            {isWFH ? 'WFH' : 'OFFICE'}
                                          </span>
                                        </td>
                                        <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontSize: '12px', color: hasClockIn ? '#0f172a' : '#94a3b8' }}>
                                          {hasClockIn ? dayData.clockIn.substring(0, 5) : '--:--'}
                                        </td>
                                        <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontSize: '12px', color: hasClockOut ? '#0f172a' : '#94a3b8' }}>
                                          {hasClockOut ? dayData.clockOut.substring(0, 5) : '--:--'}
                                        </td>
                                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a', fontFamily: 'DM Mono' }}>
                                          {hours.toFixed(1)} hrs
                                        </td>
                                        <td style={{ padding: '10px 14px' }}>
                                          <span style={{
                                            fontSize: '10px',
                                            fontWeight: 700,
                                            color: remarkClr,
                                            background: remarkBg,
                                            padding: '3px 8px',
                                            borderRadius: '5px',
                                            border: `1px solid ${remarkClr}25`
                                          }}>
                                            {remark}
                                          </span>
                                        </td>
                                      </tr>
                                      {hasEntries && (
                                        <tr style={{ background: '#f8fafc' }}>
                                          <td colSpan={6} style={{ padding: '8px 14px', borderBottom: '1px solid #f1f5f9' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '16px', borderLeft: '2px solid #cbd5e1' }}>
                                              {dayData.timesheetEntries.map((entry, eIdx) => (
                                                <div key={eIdx} style={{ fontSize: '11.5px', color: '#475569', lineHeight: '1.4' }}>
                                                  <span style={{ fontWeight: 800, color: '#3b82f6', background: '#eff6ff', padding: '1px 4px', borderRadius: '3px', fontSize: '9px', marginRight: '6px' }}>
                                                    {entry.projectName}
                                                  </span>
                                                  <strong style={{ color: '#1e293b' }}>{entry.taskName}</strong>: "{entry.description || 'No description provided'}"
                                                </div>
                                              ))}
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                            </tbody>

                          </table>
                        </div>
                      </div>
                    )}

                    {/* SECTION 4 — Performance Summary */}
                    <div style={{
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '24px',
                      marginBottom: '24px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.01)'
                    }}>
                      <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <BarChart3 size={14} color="#3b82f6" />
                        Performance Summary
                      </h4>
                      
                      {/* Parsed narrative block */}
                      <RenderParsedAppraisal appraisalText={result.appraisal} />
                    </div>

                    {/* Performance Indicators */}
                    {result.ratings && Object.keys(result.ratings).length > 0 && (
                      <div style={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '16px',
                        padding: '24px',
                        marginBottom: '24px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.01)'
                      }}>
                        <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <BarChart3 size={14} color="#3b82f6" />
                          Performance Indicators
                        </h4>
                        
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                          gap: '14px'
                        }}>
                          {Object.entries(result.ratings).map(([attribute, ratingVal]) => {
                            const isNA = ratingVal === 'N/A' || ratingVal === null || ratingVal === undefined;
                            const val = isNA ? 0 : Number(ratingVal);
                            const barColor = val >= 4.5 ? '#10b981' : val >= 3.5 ? '#3b82f6' : val >= 2.5 ? '#f59e0b' : '#ef4444';
                            const attrName = attribute.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                            const attrDescriptions = {
                              punctuality: 'Based on clock-in regularity',
                              accountability: 'Based on rejection count & late submissions',
                              qualityOfWork: 'Based on rejection frequency',
                              quantityOfWork: 'Based on average daily logged hours',
                              consistency: 'Based on daily hours standard deviation',
                              documentation: 'Based on average task description word count',
                              teamwork: 'N/A — Insufficient collaboration data',
                              leadership: 'N/A — Insufficient attendance log data'
                            };
                            
                            return (
                              <div key={attribute} style={{
                                background: isNA ? '#f8fafc' : '#f8fafc',
                                border: `1px solid ${isNA ? '#e2e8f0' : '#f1f5f9'}`,
                                borderRadius: '10px',
                                padding: '12px 14px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                opacity: isNA ? 0.65 : 1
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>{attrName}</span>
                                  {isNA ? (
                                    <span style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', background: '#f1f5f9', padding: '2px 7px', borderRadius: '4px', letterSpacing: '0.05em' }}>N/A</span>
                                  ) : (
                                    <span style={{
                                      fontSize: '10px',
                                      fontWeight: 800,
                                      color: barColor,
                                      background: `${barColor}10`,
                                      padding: '1px 6px',
                                      borderRadius: '4px'
                                    }}>
                                      {val} / 5
                                    </span>
                                  )}
                                </div>
                                
                                {!isNA && (
                                  <div style={{
                                    height: '5px',
                                    background: '#e2e8f0',
                                    borderRadius: '2.5px',
                                    overflow: 'hidden',
                                    width: '100%'
                                  }}>
                                    <div style={{
                                      height: '100%',
                                      background: barColor,
                                      width: `${(val / 5) * 100}%`,
                                      borderRadius: '2.5px',
                                      transition: 'width 0.4s ease'
                                    }} />
                                  </div>
                                )}
                                
                                <div style={{ fontSize: '9px', color: '#94a3b8', fontStyle: 'italic' }}>
                                  {attrDescriptions[attribute] || 'Derived from telemetry'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Strengths and Improvements grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>
                          <CheckCircle size={15} color="#10b981" />
                          Key Strengths & Achievements
                        </div>
                        <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: '1.6' }}>
                          {(result.pros || []).map((pro, pIdx) => <li key={pIdx} style={{ marginBottom: '4px' }}>{pro}</li>)}
                          {(result.pros || []).length === 0 && <li>Stable daily time logging integrity.</li>}
                        </ul>
                      </div>

                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>
                          <Target size={15} color="#f59e0b" />
                          Recommended Growth Areas
                        </div>
                        <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: '1.6' }}>
                          {(result.improvements || []).map((imp, iIdx) => <li key={iIdx} style={{ marginBottom: '4px' }}>{imp}</li>)}
                          {(result.improvements || []).length === 0 && <li>Sustain current productive trajectory.</li>}
                        </ul>
                      </div>
                    </div>

                    {/* Actionable Recommendations */}
                    <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: '12px', padding: '18px', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, color: '#1e40af', marginBottom: '10px' }}>
                        <Lightbulb size={16} color="#3b82f6" />
                        Manager Actionable Recommendations
                      </div>
                      <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '12.5px', color: '#1e3a8a', lineHeight: '1.6' }}>
                        {(result.recommendations || []).map((rec, rIdx) => <li key={rIdx} style={{ marginBottom: '4px' }}>{rec}</li>)}
                        {(result.recommendations || []).length === 0 && <li>No corrective actions required. Maintain standard approval schedule.</li>}
                      </ul>
                    </div>

                    {/* Rejected Entries Audit Summary Box */}
                    {result.metrics?.rejected_entries?.length > 0 && (
                      <div style={{ background: '#fff5f5', border: '1px solid #fee2e2', borderRadius: '12px', padding: '18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, color: '#991b1b', marginBottom: '12px' }}>
                          <AlertCircle size={15} color="#ef4444" />
                          Audit Warning: Rejected Timesheet Records Found
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '100px 80px 1fr', gap: '10px', fontSize: '11px', color: '#991b1b', fontWeight: 800, borderBottom: '1px solid #fecaca', paddingBottom: '6px', marginBottom: '6px' }}>
                          <span>Date</span>
                          <span>Hours</span>
                          <span>Rejection Reason</span>
                        </div>
                        {result.metrics.rejected_entries.map((rej, rejIdx) => (
                          <div key={rejIdx} style={{ display: 'grid', gridTemplateColumns: '100px 80px 1fr', gap: '10px', fontSize: '12px', color: '#7f1d1d', padding: '3px 0' }}>
                            <span style={{ fontFamily: 'DM Mono', fontWeight: 600 }}>{rej.date}</span>
                            <span>{rej.hours} hrs</span>
                            <span style={{ fontStyle: 'italic' }}>"{rej.reason || 'No explanation logged'}"</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              );
            })}

            {filteredResults.length === 0 && (
              <div className="ts-empty-st" style={{ marginTop: '20px' }}>
                No employee appraisals found matching your search.
              </div>
            )}
          </div>
        </>
      )}

      {/* Initial / Idle state when no data exists */}
      {!data && !loading && (
        <div className="ai-glow-card" style={{ borderRadius: 16, padding: '40px 20px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <div style={{ background: '#f5f3ff', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Sparkles size={28} color="#8b5cf6" style={{ margin: 'auto' }} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>No Active Performance Appraisal Session</h3>
          <p style={{ fontSize: '13.5px', color: '#64748b', maxWidth: '440px', margin: '0 auto 20px', lineHeight: '1.6' }}>
            Initiate a live multi-tenant AI analysis of your team's worksheet hours and clock swipes. Our deep appraisal models compile dynamic performance profiles instantly.
          </p>
          <button 
            onClick={onTrigger} 
            className="ai-pulse-btn"
            style={{ padding: '10px 24px', borderRadius: 8, fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: '0 auto' }}
          >
            <Brain size={15} />
            Generate Appraisal Report Now
          </button>
        </div>
      )}
    </div>
  );
}

function renderOverview(data, searchTerm, setSearchTerm) {
  if (!data) return <div className="ts-empty-st">No team intelligence data available.</div>;

  const filteredMembers = (data.members || []).filter(m => 
    m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = [
    { label: 'Total team', value: data.teamSize ?? 0, icon: Users, color: '#3b82f6', sub: 'Active members' },
    { label: 'Present', value: data.presentToday ?? 0, icon: UserCheck, color: '#10b981', sub: 'In office/WFH' },
    { label: 'Absent', value: data.absentToday ?? 0, icon: UserX, color: '#ef4444', sub: 'Not clocked in' },
    { label: 'On Leave', value: data.onLeaveToday ?? 0, icon: Calendar, color: '#f59e0b', sub: 'Approved leave' },
    { label: 'Late entry', value: data.lateToday ?? 0, icon: AlarmClock, color: '#f43f5e', sub: 'After policy time' },
    { label: 'WFH Today', value: data.wfhToday ?? 0, icon: Wifi, color: '#0ea5e9', sub: 'Remote access' },
  ];

  const locationLabel = (loc) => {
    if (!loc) return '-';
    if (loc === 'WORK_FROM_HOME' || loc === 'FROM_HOME' || loc === 'WFH') return 'WFH';
    if (String(loc).toUpperCase().includes('FROM_HOME') || String(loc).toUpperCase().includes('WFH')) return 'WFH';
    return String(loc).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="ts-dashboard-content">
      {/* KPI Section */}
      <div className="ov-grid">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="ov-card">
              <div className="ov-icon-box" style={{ background: `${s.color}12` }}>
                <Icon size={18} color={s.color} />
              </div>
              <div className="ov-num">{s.value}</div>
              <div className="ov-lbl">{s.label}</div>
              <div className="ov-sub">{s.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Members Table Section */}
      <div className="team-table-hd">
        <h3 className="team-table-title">Direct Reports &ndash; Today&apos;s Status</h3>
        <div className="team-srch">
          <Search size={14} style={{ color: '#94a3b8' }} />
          <input 
            placeholder="Filter by name, ID or dept..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="ts-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="ts-table">
            <thead>
              <tr>
                <th className="ts-th">Employee / ID</th>
                <th className="ts-th">Dept / Role</th>
                <th className="ts-th">Status</th>
                <th className="ts-th">In / Out</th>
                <th className="ts-th">Location</th>
                <th className="ts-th" style={{ textAlign: 'right' }}>Logged Hrs</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((m, i) => {
                const initials = (m.name || '').split(' ').map(n => n[0]).join('');
                return (
                  <tr key={i} className={i % 2 === 0 ? '' : 'ts-row-alt'}>
                    <td className="ts-td">
                      <div className="emp-info">
                        <div className="u-av" style={{ 
                          background: `${COLORS_PALETTE[i % COLORS_PALETTE.length]}15`,
                          color: COLORS_PALETTE[i % COLORS_PALETTE.length]
                        }}>
                          {initials}
                        </div>
                        <div>
                          <div className="emp-nm-row">{m.name}</div>
                          <div className="emp-id-sub">{m.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="ts-td">
                      <div style={{ fontWeight: 500, color: '#475569' }}>{m.department || '-'}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{m.designation || '-'}</div>
                    </td>
                    <td className="ts-td">
                      <STATUS_BADGE status={m.todayStatus} />
                    </td>
                    <td className="ts-td">
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{formatTimeTo12h(m.clockInTime)}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{formatTimeTo12h(m.clockOutTime)}</div>
                    </td>
                    <td className="ts-td">
                      <span className={`ts-pill ${m.workLocation === 'OFFICE' ? 'ts-pill-g' : 'ts-pill-r'}`} style={{ border: 'none', background: m.workLocation === 'OFFICE' ? '#f0fdf4' : '#eff6ff' }}>
                        {locationLabel(m.workLocation)}
                      </span>
                    </td>
                    <td className="ts-td" style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'DM Mono' }}>
                      {formatHours(m.totalHours)}
                    </td>
                  </tr>
                );
              })}
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                    No team members found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function renderAttendance(calendar, month, setMonth, refresh) {
  // Compute totals from calendar data
  const totalPresent = calendar.reduce((a, s) => a + (s.presentDays || 0) + (s.wfhDays || 0), 0);
  const totalAbsent = calendar.reduce((a, s) => a + (s.absentDays || 0), 0);
  const totalLeave = calendar.reduce((a, s) => a + (s.leaveDays || 0), 0);
  const totalWfh = calendar.reduce((a, s) => a + (s.wfhDays || 0), 0);

  // Derive all days of the selected month
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = [];
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(y, m - 1, i));
  }

  // Month display label
  const monthLabel = new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  // Navigate prev/next month
  const goMonth = (dir) => {
    const dt = new Date(y, m - 1 + dir, 1);
    setMonth(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
  };

  // Color map for codes: H=Weekend(grey), HD=Holiday(purple), F=Future(white)
  const cellColor = { P: '#10b981', W: '#3b82f6', L: '#f59e0b', H: '#e2e8f0', HD: '#a855f7', A: '#fecaca', F: '#ffffff' };
  const cellText  = { P: '#fff', W: '#fff', L: '#fff', H: '#64748b', HD: '#fff', A: '#b91c1c', F: '#cbd5e1' };

  return (
    <>
      {/* Month picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => goMonth(-1)} style={{ ...styles.refreshBtn, padding: '6px 12px' }}>&larr;</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            onClick={(e) => e.target.showPicker?.()}
            style={{ ...styles.dateInput, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 15, fontWeight: 600, color: '#334155' }}>{monthLabel}</span>
        </div>
        <button onClick={() => goMonth(1)} style={{ ...styles.refreshBtn, padding: '6px 12px' }}>&rarr;</button>
        <button onClick={refresh} style={styles.refreshBtn}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          { label: 'Present', short: 'P', value: totalPresent - totalWfh, color: '#10b981' },
          { label: 'WFH', short: 'W', value: totalWfh, color: '#3b82f6' },
          { label: 'Leave', short: 'L', value: totalLeave, color: '#f59e0b' },
          { label: 'Absent', short: 'A', value: totalAbsent, color: '#ef4444' },
        ].map((s) => (
          <div key={s.short} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 16px', borderRadius: 10,
            background: '#fff', border: '1px solid #e2e8f0',
            minWidth: 120,
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: '50%',
              background: s.color, color: '#fff',
              fontSize: 13, fontWeight: 700,
            }}>{s.short}</span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Attendance Calendar</h3>
        <div>
          <table style={{ ...styles.table, fontSize: 11, borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...styles.th, position: 'sticky', left: 0, background: '#fff', zIndex: 2, width: 120, minWidth: 120, borderBottom: '2px solid #e2e8f0' }}>Employee</th>
                {days.map((d, i) => {
                  const dayName = ['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()];
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <th key={i} style={{
                      textAlign: 'center', padding: '2px 0',
                      width: 26, minWidth: 26, fontSize: 9, fontWeight: 600,
                      color: isWeekend ? '#94a3b8' : '#334155',
                      borderBottom: '2px solid #e2e8f0',
                      background: isWeekend ? '#f8fafc' : '#fff',
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700 }}>{d.getDate()}</div>
                      <div style={{ fontSize: 8, fontWeight: 400, color: isWeekend ? '#94a3b8' : '#64748b' }}>{dayName}</div>
                    </th>
                  );
                })}
                <th style={{ ...styles.th, textAlign: 'center', fontSize: 9, width: 35, borderBottom: '2px solid #e2e8f0', color: '#10b981' }}>P</th>
                <th style={{ ...styles.th, textAlign: 'center', fontSize: 9, width: 35, borderBottom: '2px solid #e2e8f0', color: '#3b82f6' }}>W</th>
                <th style={{ ...styles.th, textAlign: 'center', fontSize: 9, width: 35, borderBottom: '2px solid #e2e8f0', color: '#f59e0b' }}>L</th>
                <th style={{ ...styles.th, textAlign: 'center', fontSize: 9, width: 35, borderBottom: '2px solid #e2e8f0', color: '#ef4444' }}>A</th>
              </tr>
            </thead>
            <tbody>
              {calendar.map((emp, rowIdx) => (
                <tr key={rowIdx}>
                  <td style={{
                    position: 'sticky', left: 0, background: '#fff', zIndex: 1,
                    whiteSpace: 'nowrap', padding: '6px 8px', width: 120,
                    borderBottom: '1px solid #f1f5f9',
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 11 }}>{emp.employeeName}</div>
                    <div style={{ fontSize: 9, color: '#64748b' }}>{emp.employeeId}</div>
                  </td>
                  {days.map((d, colIdx) => {
                    const dayNum = String(d.getDate());
                    const code = emp.days?.[dayNum] || '-';
                    const bg = cellColor[code] || 'transparent';
                    const fg = cellText[code] || '#cbd5e1';
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <td key={colIdx} style={{ textAlign: 'center', padding: '3px 0', width: 26, borderBottom: '1px solid #f1f5f9', background: isWeekend ? '#fafbfc' : 'transparent' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 22, height: 22, borderRadius: '50%',
                          fontSize: 9, fontWeight: 700,
                          background: bg, color: fg,
                          border: code === 'F' ? '1px solid #e2e8f0' : code === '-' ? '1px dashed #e2e8f0' : 'none',
                        }}>
                          {code !== '-' ? d.getDate() : ''}
                        </span>
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'center', fontWeight: 600, color: '#10b981', padding: '3px 4px', borderBottom: '1px solid #f1f5f9', fontSize: 10, width: 35 }}>{emp.presentDays || 0}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600, color: '#3b82f6', padding: '3px 4px', borderBottom: '1px solid #f1f5f9', fontSize: 10, width: 35 }}>{emp.wfhDays || 0}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600, color: '#f59e0b', padding: '3px 4px', borderBottom: '1px solid #f1f5f9', fontSize: 10, width: 35 }}>{emp.leaveDays || 0}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600, color: '#ef4444', padding: '3px 4px', borderBottom: '1px solid #f1f5f9', fontSize: 10, width: 35 }}>{emp.absentDays || 0}</td>
                </tr>
              ))}
              {calendar.length === 0 && (
                <tr><td colSpan={days.length + 5} style={{ ...styles.td, textAlign: 'center', color: '#94a3b8' }}>No attendance data</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Legend below table */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 18, padding: '12px 16px', background: '#f8fafc', borderRadius: 8 }}>
          {[
            { label: 'Present (Office)', bg: '#10b981', fg: '#fff' },
            { label: 'WFH', bg: '#3b82f6', fg: '#fff' },
            { label: 'Leave', bg: '#f59e0b', fg: '#fff' },
            { label: 'Holiday', bg: '#a855f7', fg: '#fff' },
            { label: 'Weekend', bg: '#e2e8f0', fg: '#64748b' },
            { label: 'Absent', bg: '#fecaca', fg: '#b91c1c' },
            { label: 'Future', bg: '#ffffff', fg: '#cbd5e1', border: true },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-block',
                width: 14, height: 14, borderRadius: '50%',
                background: item.bg,
                border: item.border ? '1px solid #e2e8f0' : 'none',
              }} />
              <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// Helper function to download timesheet data as CSV
const downloadCSV = (entries, dateRange) => {
  if (!entries || entries.length === 0) {
    toast.error('No data to download');
    return;
  }

  // CSV headers
  const headers = ['Employee Name', 'Employee ID', 'Date', 'Project', 'Task', 'Log In', 'Log Out', 'Hours', 'Billable', 'Description', 'Status'];
  
  // Convert entries to CSV rows
  const csvRows = [headers.join(',')];
  entries.forEach(entry => {
    const values = [
      entry.employeeName || '',
      entry.employeeId || '',
      entry.date || '',
      entry.projectName || '',
      entry.taskName || '',
      formatTimeTo12h(entry.clockIn),
      formatTimeTo12h(entry.clockOut),
      formatHours(entry.hours),
      entry.billable ? 'Yes' : 'No',
      `"${(entry.description || '').replace(/"/g, '""')}"`, // Escape quotes in description
      entry.status || ''
    ];
    csvRows.push(values.join(','));
  });

  // Create CSV content
  const csvContent = csvRows.join('\n');
  
  // Create blob and download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  // Generate filename with date range
  const startDate = dateRange.startDate.replace(/-/g, '');
  const endDate = dateRange.endDate.replace(/-/g, '');
  link.setAttribute('href', url);
  link.setAttribute('download', `timesheet_report_${startDate}_to_${endDate}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  toast.success('Report downloaded successfully');
};

function renderTimesheets(
  entries, 
  stats, 
  dateRange, setDateRange, 
  billableFilter, setBillableFilter, 
  refresh,
  page, setPage, totalPages, totalCount,
  chartDataObj,
  isStandalone,
  setSelectedEmployee,
  searchTerm,
  setSearchTerm,
  searchInput,
  setSearchInput,
  allEntries
) {
  const displayTotalHours = stats?.totalHours || 0;
  const displayBillable = stats?.billableCount || 0; 
  const displayNonBillable = stats?.nonBillableCount || 0;

  // Recalculate billable hours if stats are actually counts
  const billableHours = Object.values(chartDataObj.employeeBreakdown || {}).reduce((acc, emp) => acc + (emp.billableHours || 0), 0);
  const nonBillableHours = Object.values(chartDataObj.employeeBreakdown || {}).reduce((acc, emp) => acc + (emp.nonBillableHours || 0), 0);
  const totalLoggedHours = billableHours + nonBillableHours;

  const employeeBreakdownData = Object.entries(chartDataObj?.employeeBreakdown || {})
    .map(([name, s]) => ({
      name,
      ...s,
      billableRatio: s.totalHours > 0 ? (s.billableHours / s.totalHours) * 100 : 0,
      descriptionQuality: s.avgDescriptionLength > 100 ? 'High' : (s.avgDescriptionLength > 40 ? 'Medium' : 'Low')
    }))
    .sort((a, b) => b.totalHours - a.totalHours);

  const activeEmployees = employeeBreakdownData.length;
  const avgBillable = activeEmployees > 0 ? (billableHours / activeEmployees).toFixed(1) : '0.0';
  const billPct = totalLoggedHours > 0 ? Math.round((billableHours / totalLoggedHours) * 100) : 0;
  
  const bestBillableEmp = [...employeeBreakdownData].sort((a, b) => b.billableRatio - a.billableRatio)[0];

  return (
    <div className="ts-dashboard-content">
      {/* Header Controls */}
      <div className="ts-page-header">
        <div className="ts-hcontrols">
          <div className="ts-search-wrap">
            <Search size={16} style={{ color: '#9ca3b0' }} />
            <input 
              placeholder="Type employee, project, task, status..." 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSearchTerm(searchInput);
                  setPage(0); // Reset to first page on new search
                }
              }}
            />
          </div>
          <div className="ts-date-wrap">
            <Calendar size={12} />
            <input type="date" value={dateRange.startDate} onChange={(e) => setDateRange(p => ({ ...p, startDate: e.target.value }))} />
            <span className="ts-sep">→</span>
            <input type="date" value={dateRange.endDate} onChange={(e) => setDateRange(p => ({ ...p, endDate: e.target.value }))} />
            <button onClick={refresh} className="ts-refresh-btn-mini"><RefreshCw size={12} /></button>
            <button onClick={() => downloadCSV(allEntries, dateRange)} className="ts-refresh-btn-mini" title="Download Report"><Download size={12} /></button>
          </div>
          <div className="ts-chip-group">
            <button className={`ts-chip ${billableFilter === 'ALL' ? 'active' : ''}`} onClick={() => setBillableFilter('ALL')}>All</button>
            <button className={`ts-chip ${billableFilter === 'YES' ? 'active' : ''}`} onClick={() => setBillableFilter('YES')}>Billable</button>
            <button className={`ts-chip ${billableFilter === 'NO' ? 'active' : ''}`} onClick={() => setBillableFilter('NO')}>Non-billable</button>
          </div>
        </div>
      </div>

      {/* AI Banner */}
      <div className="ts-ai-banner">
        <div className="ts-ai-dot"></div>
        <div className="ts-ai-text">
          <strong>AI Insight:</strong> Team billable rate is <strong>{billPct}%</strong> this period — the remaining {100 - billPct}% is non-billable (meetings, training, admin).
          {bestBillableEmp && <> <strong>{bestBillableEmp.name}</strong> has the highest billable ratio at <strong>{Math.round(bestBillableEmp.billableRatio)}%</strong>.</>}
          Consider reviewing internal meeting fragmentation to improve client-facing output.
        </div>
      </div>

      {/* Metrics Row */}
      <div className="ts-metrics-row">
        <div className="ts-metric">
          <span className="ts-metric-lbl">Active employees</span>
          <span className="ts-metric-val ts-bl">{activeEmployees}</span>
          <span className="ts-metric-sub">in selected period</span>
        </div>
        <div className="ts-metric">
          <span className="ts-metric-lbl">Total hours</span>
          <span className="ts-metric-val">{formatHours(totalLoggedHours)}</span>
          <span className="ts-metric-sub">all entries combined</span>
        </div>
        <div className="ts-metric">
          <span className="ts-metric-lbl">Billable hours</span>
          <span className="ts-metric-val ts-gn">{formatHours(billableHours)}</span>
          <span className="ts-metric-sub ts-gn">{billPct}% of total</span>
        </div>
        <div className="ts-metric">
          <span className="ts-metric-lbl">Non-billable</span>
          <span className="ts-metric-val ts-rd">{formatHours(nonBillableHours)}</span>
          <span className="ts-metric-sub ts-rd">{100 - billPct}% of total</span>
        </div>
        <div className="ts-metric">
          <span className="ts-metric-lbl">Avg billable / person</span>
          <span className="ts-metric-val ts-am">{formatHours(avgBillable)}</span>
          <span className="ts-metric-sub">hrs per employee</span>
        </div>
      </div>

      {/* Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '2rem' }}>
        {/* Productivity Trend */}
        <div className="ts-card" style={{ padding: '24px' }}>
          <div className="ts-sec-header">
            <div>
              <span className="ts-sec-title">Productivity Trend</span>
              <p className="ts-sec-hint" style={{ margin: 0 }}>Total hours logged per day</p>
            </div>
          </div>
          <div style={{ width: '100%', height: 280, marginTop: '16px' }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={Object.entries(chartDataObj.hoursByDate || {})
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([date, hours]) => ({ 
                  date: date.split('-').slice(1).join('/'), 
                  hours: Number(hours.toFixed(1)) 
                }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="hours" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project Allocation */}
        <div className="ts-card" style={{ padding: '24px' }}>
          <div className="ts-sec-header">
            <div>
              <span className="ts-sec-title">Project Allocation</span>
              <p className="ts-sec-hint" style={{ margin: 0 }}>Hour distribution by project</p>
            </div>
          </div>
          <div style={{ width: '100%', height: 280, marginTop: '16px' }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie
                  data={Object.entries(chartDataObj.hoursByProject || {})
                    .map(([name, hours]) => ({ name, value: Number(hours.toFixed(1)) }))
                    .sort((a, b) => b.value - a.value)}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  animationDuration={1500}
                >
                  {Object.entries(chartDataObj.hoursByProject || {}).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS_PALETTE[index % COLORS_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                />
                <Legend 
                  iconType="circle" 
                  verticalAlign="bottom" 
                  align="center"
                  wrapperStyle={{ fontSize: '11px', fontWeight: 600, paddingTop: '20px' }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="ts-sec-header">
        <span className="ts-sec-title">Employee performance cards</span>
        <span className="ts-sec-hint">Click any card to view detailed breakdown</span>
      </div>

      <div className="ts-emp-grid">
        {employeeBreakdownData.map((emp, idx) => {
          const empBillPct = emp.totalHours > 0 ? (emp.billableHours / emp.totalHours) * 100 : 0;
          const effColor = empBillPct >= 50 ? '#0b9e6e' : empBillPct >= 30 ? '#b06800' : '#d03e3e';
          const initials = emp.name.split(' ').map(n => n[0]).join('');
          
          return (
            <div key={idx} className="ts-emp-card" onClick={() => setSelectedEmployee(emp)}>
              <div className="ts-card-top">
                <div className="ts-avatar" style={{ 
                  background: COLORS_PALETTE[idx % COLORS_PALETTE.length] + '15', 
                  color: COLORS_PALETTE[idx % COLORS_PALETTE.length] 
                }}>
                  {initials}
                </div>
                <div>
                  <div className="ts-card-name">{emp.name}</div>
                  <div className="ts-card-id">{emp.employeeId || `EMP-${idx+100}`}</div>
                </div>
              </div>
              <div className="ts-hours-big">{formatHours(emp.totalHours)}</div>
              <div className="ts-hours-sub">{emp.entryCount} entries · total hours logged</div>
              <div className="ts-bar-track">
                <div className="ts-bar-bill" style={{ width: `${empBillPct}%`, background: effColor }}></div>
              </div>
              <div className="ts-pill-row">
                <span className="ts-pill ts-pill-g">{formatHours(emp.billableHours)}h billable</span>
                <span className="ts-pill ts-pill-r">{formatHours(emp.nonBillableHours)}h non-bill</span>
              </div>
              <div className="ts-card-footer">
                <span className="ts-eff-lbl">Billable rate</span>
                <span className="ts-eff-val" style={{ color: effColor }}>{Math.round(empBillPct)}%</span>
              </div>
            </div>
          );
        })}
        {employeeBreakdownData.length === 0 && (
          <div className="ts-empty-st" style={{ gridColumn: '1 / -1' }}>No employee data available for this range.</div>
        )}
      </div>

      {/* Paginated Table for Detailed Records (Bottom Section) */}
      {!isStandalone && (
        <div style={{ marginTop: '3rem' }}>
          <div className="ts-sec-header">
            <span className="ts-sec-title">Recent Timesheet Entries</span>
          </div>
          <div className="ts-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="ts-table">
              <thead>
                <tr>
                  <th className="ts-th">Employee</th>
                  <th className="ts-th">Date</th>
                  <th className="ts-th">Project</th>
                  <th className="ts-th" style={{ textAlign: 'center' }}>In/Out</th>
                  <th className="ts-th">Hours</th>
                  <th className="ts-th" style={{ textAlign: 'center' }}>Billable</th>
                  <th className="ts-th">Description</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? '' : 'ts-row-alt'}>
                    <td className="ts-td">
                      <div style={{ fontWeight: 600 }}>{e.employeeName}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{e.employeeId}</div>
                    </td>
                    <td className="ts-td">{e.date}</td>
                    <td className="ts-td">{e.projectName}</td>
                    <td className="ts-td" style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600 }}>{formatTimeTo12h(e.clockIn)}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>{formatTimeTo12h(e.clockOut)}</div>
                    </td>
                    <td className="ts-td" style={{ fontWeight: 600 }}>{formatHours(e.hours)}</td>
                    <td className="ts-td" style={{ textAlign: 'center' }}>
                      <span className={`ts-pill ${e.billable ? 'ts-pill-g' : 'ts-pill-r'}`}>
                        {e.billable ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="ts-td"><div className="text-truncate" style={{ maxWidth: 200 }}>{e.description}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '1rem', borderTop: '1px solid #f1f5f9' }}>
                <button disabled={page <= 0} onClick={() => setPage(page - 1)} className="ts-refresh-btn-mini">&larr;</button>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{page + 1} / {totalPages}</span>
                <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} className="ts-refresh-btn-mini">&rarr;</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function renderLeaves(leaves, statusCounts, year, setYear, statusFilter, setStatusFilter, refresh, isStandalone, setSelectedEmployee, teamSize, searchTerm, setSearchTerm, searchInput, setSearchInput, teamBalances, allLeavesForSummary, loading) {
  // Full history map for modal and last leave tracking
  const fullHistoryMap = allLeavesForSummary.reduce((acc, l) => {
    const eid = String(l.employeeId).toUpperCase();
    if (!acc[eid]) acc[eid] = [];
    acc[eid].push(l);
    return acc;
  }, {});

  if (loading) return <div className="ts-loading-state"><RefreshCw className="ts-spin" /><span>Fetching leave intelligence...</span></div>;

  // Aggregate leaves by employee for the CURRENT filtered view
  const leavesByEmployee = leaves.reduce((acc, l) => {
    if (!acc[l.employeeId]) {
      acc[l.employeeId] = {
        id: l.employeeId,
        name: l.employeeName,
        dept: l.department || 'General',
        entries: [],
        available: 0,
        quota: 0
      };
    }
    acc[l.employeeId].entries.push(l);
    return acc;
  }, {});

  const employeeList = Object.values(leavesByEmployee);
  const pendingRequests = leaves.filter(l => l.status === 'PENDING').length;
  const highRiskCount = employeeList.filter(e => e.used > 10).length;
  
  // Availability calc: Total employees - people on leave today
  const today = new Date().toISOString().split('T')[0];
  const onLeaveTodayCount = leaves.filter(l => l.status === 'APPROVED' && today >= l.startDate && today <= l.endDate).length;
  const availability = teamSize > 0 ? Math.round(((teamSize - onLeaveTodayCount) / teamSize) * 100) : 100;

  return (
    <div className="ts-dashboard-content">
      <div className="ts-page-header">
        <div className="ts-hcontrols">
          <div className="ts-search-wrap">
            <Search size={16} style={{ color: '#9ca3b0' }} />
            <input 
              placeholder="Search by name, ID, or department..." 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSearchTerm(searchInput);
                }
              }}
            />
          </div>
          <div className="ts-date-wrap">
            <Calendar size={12} />
            <select 
              value={year} 
              onChange={(e) => setYear(Number(e.target.value))}
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              {[...Array(5)].map((_, i) => {
                const y = new Date().getFullYear() - 2 + i;
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>
            <button onClick={refresh} className="ts-refresh-btn-mini"><RefreshCw size={12} /></button>
          </div>
          <div className="ts-chip-group">
            <button className={`ts-chip ${statusFilter === '' ? 'active' : ''}`} onClick={() => setStatusFilter('')}>All</button>
            <button className={`ts-chip ${statusFilter === 'PENDING' ? 'active' : ''}`} onClick={() => setStatusFilter('PENDING')}>Pending</button>
            <button className={`ts-chip ${statusFilter === 'APPROVED' ? 'active' : ''}`} onClick={() => setStatusFilter('APPROVED')}>Approved</button>
          </div>
        </div>
      </div>

      <div className="ts-metrics-row">
        <div className="ts-metric">
          <span className="ts-metric-lbl">Team Availability</span>
          <span className={`ts-metric-val ${availability < 50 ? 'ts-rd' : availability < 80 ? 'ts-am' : 'ts-gn'}`}>{availability}%</span>
          <span className="ts-metric-sub">{onLeaveTodayCount} people out today</span>
        </div>
        <div className="ts-metric">
          <span className="ts-metric-lbl">Leaves Reported</span>
          <span className="ts-metric-val ts-bl">{leaves.length}</span>
          <span className="ts-metric-sub">{leaves.reduce((a,b)=>a+(b.totalDays||0), 0).toFixed(1)} total days</span>
        </div>
        <div className="ts-metric">
          <span className="ts-metric-lbl">Pending Approvals</span>
          <span className="ts-metric-val ts-am">{pendingRequests}</span>
          <span className="ts-metric-sub">Requires manager attention</span>
        </div>
        <div className="ts-metric">
          <span className="ts-metric-lbl">High Usage Risk</span>
          <span className="ts-metric-val ts-rd">{highRiskCount}</span>
          <span className="ts-metric-sub">Approaching annual limits</span>
        </div>
      </div>

      <div className="ts-sec-header">
        <h3 className="ts-sec-title">Employee Leave Readiness</h3>
        <span className="ts-sec-hint">Sorted by usage frequency</span>
      </div>

      <div className="ts-emp-grid">
        {employeeList.map((emp) => {
          // Merge with real balance data
          const empIdNorm = String(emp.id).toUpperCase();
          const fullEntries = fullHistoryMap[empIdNorm] || [];
          
          const lastLeaveEntry = fullEntries
            .filter(l => l.status === 'APPROVED')
            .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0];

          const balances = teamBalances[empIdNorm] || {};
          const annualData = balances['ANNUAL_LEAVE'] || balances['AL'] || { available: 0, used: 0, quota: 0 };
          const sickData = balances['SICK_LEAVE'] || balances['SL'] || { available: 0, used: 0, quota: 0 };
          
          const available = annualData.available + sickData.available;
          const totalTaken = annualData.used + sickData.used; 
          const quota = annualData.quota + sickData.quota;
          const totalConsumed = quota > 0 ? Math.max(0, quota - available) : totalTaken;
          
          const usagePercent = Math.min((totalConsumed / (quota || 18)) * 100, 100);
          const isHighRisk = usagePercent > 75;

          const annualConsumed = Math.max(0, annualData.quota - annualData.available);
          const sickConsumed = Math.max(0, sickData.quota - sickData.available);

          const displayEmp = { 
            ...emp, 
            available, 
            used: totalConsumed,
            totalTaken,
            quota,
            annualAvail: annualData.available,
            annualConsumed,
            sickAvail: sickData.available,
            sickConsumed,
            entries: fullEntries, // FULL history for modal
            lastLeave: lastLeaveEntry ? lastLeaveEntry.startDate : null
          };

          return (
            <div key={emp.id} className="ts-emp-card" onClick={() => setSelectedEmployee({ ...displayEmp, type: 'leave' })}>
              <div className="ts-card-top">
                <div className="ts-avatar" style={{ background: COLORS_PALETTE[3] + '15', color: COLORS_PALETTE[3] }}>
                  {emp.name.split(' ').map(n=>n[0]).join('')}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="ts-card-name" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {displayEmp.name}
                    {isHighRisk && <span className="lv-risk-badge">High Risk</span>}
                  </div>
                  <div className="ts-card-id">{displayEmp.id} · {displayEmp.dept}</div>
                </div>
              </div>

              <div className="ts-card-footer" style={{ border: 'none', padding: 0, marginBottom: '8px' }}>
                <span className="ts-eff-lbl"><span className="lv-avail">Available: {displayEmp.available}</span> · <span className="lv-used">Consumed: {displayEmp.used}</span></span>
              </div>

              <div className="ts-bar-track">
                <div className="ts-bar-bill" style={{ 
                  width: `${usagePercent}%`, 
                  background: usagePercent > 75 ? '#ef4444' : usagePercent > 50 ? '#f59e0b' : '#10b981' 
                }}></div>
              </div>

              <div className="lv-signals">
                <div className="lv-sig-item">
                  <div className="lv-dot" style={{ background: '#10b981' }}></div> 
                  <strong>Annual:</strong> {annualData.available} Avail / {annualConsumed} Consumed
                </div>
                <div className="lv-sig-item">
                  <div className="lv-dot" style={{ background: '#8b5cf6' }}></div> 
                  <strong>Sick:</strong> {sickData.available} Avail / {sickConsumed} Consumed
                </div>
                <div className="lv-sig-item" style={{ color: '#9ca3b0', marginTop: '4px' }}>
                  📅 Last leave: {displayEmp.lastLeave ? formatDate(displayEmp.lastLeave) : 'Never'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {employeeList.length === 0 && (
        <div style={{ padding: '4rem', textAlign: 'center', background: '#fff', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)' }}>
          <Calendar size={48} style={{ color: '#eef0f4', marginBottom: '1rem' }} />
          <div style={{ color: '#9ca3b0', fontSize: '14px' }}>No leave intelligence data found for this period.</div>
        </div>
      )}
    </div>
  );
}

const LeaveModal = ({ emp, onClose, allLeaves, onAction, teamBalances = {} }) => {
  const [mTab, setMTab] = useState('OVERVIEW');
  const [adjustments, setAdjustments] = useState([]);
  const [adjLoading, setAdjLoading] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [processingAction, setProcessingAction] = useState({ id: null, type: null });

  useEffect(() => {
    if (emp?.id && mTab === 'ADJUSTMENTS') {
      const fetchAdj = async () => {
        try {
          setAdjLoading(true);
          const res = await leaveBalanceAPI.getAdjustments(emp.id);
          setAdjustments(res.data || []);
        } catch (e) {
          console.error('Failed to fetch adjustments', e);
        } finally {
          setAdjLoading(false);
        }
      };
      fetchAdj();
    }
  }, [emp?.id, mTab]);

  if (!emp || emp.type !== 'leave') return null;

  const empLeaves = allLeaves.filter(l => l.employeeId === emp.id);
  const filtered = empLeaves.filter(l => l.status === mTab);

  // Extract all leave type balances for this employee
  const empIdNorm = String(emp.id).toUpperCase();
  const rawBalances = teamBalances[empIdNorm] || {};

  // Standard friendly names and badges for known leave types
  const LEAVE_TYPE_META = {
    'ANNUAL_LEAVE': { label: 'Annual Leave', code: 'AL', color: '#10b981', bg: '#ecfdf5' },
    'AL': { label: 'Annual Leave', code: 'AL', color: '#10b981', bg: '#ecfdf5' },
    'SICK_LEAVE': { label: 'Sick Leave', code: 'SL', color: '#ef4444', bg: '#fef2f2' },
    'SL': { label: 'Sick Leave', code: 'SL', color: '#ef4444', bg: '#fef2f2' },
    'CASUAL_LEAVE': { label: 'Casual Leave', code: 'CL', color: '#3b82f6', bg: '#eff6ff' },
    'CL': { label: 'Casual Leave', code: 'CL', color: '#3b82f6', bg: '#eff6ff' },
    'MATERNITY_LEAVE': { label: 'Maternity Leave', code: 'ML', color: '#ec4899', bg: '#fdf2f8' },
    'ML': { label: 'Maternity Leave', code: 'ML', color: '#ec4899', bg: '#fdf2f8' },
    'PATERNITY_LEAVE': { label: 'Paternity Leave', code: 'PL', color: '#8b5cf6', bg: '#f5f3ff' },
    'PL': { label: 'Paternity Leave', code: 'PL', color: '#8b5cf6', bg: '#f5f3ff' },
    'BEREAVEMENT_LEAVE': { label: 'Bereavement Leave', code: 'BL', color: '#64748b', bg: '#f8fafc' },
    'BL': { label: 'Bereavement Leave', code: 'BL', color: '#64748b', bg: '#f8fafc' },
    'COMPENSATORY_OFF': { label: 'Compensatory Off', code: 'CO', color: '#f59e0b', bg: '#fffbeb' },
    'CO': { label: 'Compensatory Off', code: 'CO', color: '#f59e0b', bg: '#fffbeb' },
    'UNPAID_LEAVE': { label: 'Unpaid Leave', code: 'UL', color: '#94a3b8', bg: '#f1f5f9' },
    'UL': { label: 'Unpaid Leave', code: 'UL', color: '#94a3b8', bg: '#f1f5f9' }
  };

  // Build unified list of all leave types
  const leaveTypesMap = {};
  // 1. Seed with Annual & Sick from emp object
  leaveTypesMap['Annual Leave'] = {
    code: 'AL',
    label: 'Annual Leave',
    available: emp.annualAvail || 0,
    consumed: emp.annualConsumed || 0,
    quota: (emp.annualAvail || 0) + (emp.annualConsumed || 0),
    color: '#10b981',
    bg: '#ecfdf5'
  };
  leaveTypesMap['Sick Leave'] = {
    code: 'SL',
    label: 'Sick Leave',
    available: emp.sickAvail || 0,
    consumed: emp.sickConsumed || 0,
    quota: (emp.sickAvail || 0) + (emp.sickConsumed || 0),
    color: '#ef4444',
    bg: '#fef2f2'
  };

  // 2. Add all items from rawBalances
  Object.entries(rawBalances).forEach(([typeKey, data]) => {
    const meta = LEAVE_TYPE_META[typeKey] || {
      label: typeKey.replace(/_/g, ' '),
      code: typeKey.substring(0, 3).toUpperCase(),
      color: '#6366f1',
      bg: '#eef2ff'
    };
    const avail = Number(data.available || 0);
    const used = Number(data.used || 0);
    const q = Number(data.quota || (avail + used) || 0);
    const consumed = q > 0 ? Math.max(0, q - avail) : used;

    leaveTypesMap[meta.label] = {
      code: meta.code,
      label: meta.label,
      available: avail,
      consumed: consumed,
      quota: q,
      color: meta.color,
      bg: meta.bg
    };
  });

  const allLeaveTypesList = Object.values(leaveTypesMap);

  // Leave Breakdown & Stats calculation
  const totalApprovedLeaves = empLeaves.filter(l => l.status === 'APPROVED');
  const totalPendingLeaves = empLeaves.filter(l => l.status === 'PENDING');
  const totalRejectedLeaves = empLeaves.filter(l => l.status === 'REJECTED');
  const totalCancelledLeaves = empLeaves.filter(l => l.status === 'CANCELLED');

  const approvedDays = totalApprovedLeaves.reduce((acc, l) => acc + (Number(l.totalDays) || 1), 0);
  const pendingDays = totalPendingLeaves.reduce((acc, l) => acc + (Number(l.totalDays) || 1), 0);

  // Monthly Leave Trend (Jan - Dec)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyTrendData = monthNames.map((m, idx) => ({ month: m, approved: 0, pending: 0 }));

  empLeaves.forEach(l => {
    if (l.startDate) {
      const dt = new Date(l.startDate);
      if (!isNaN(dt.getTime())) {
        const mIdx = dt.getMonth();
        const days = Number(l.totalDays) || 1;
        if (l.status === 'APPROVED') monthlyTrendData[mIdx].approved += days;
        else if (l.status === 'PENDING') monthlyTrendData[mIdx].pending += days;
      }
    }
  });

  // Leave Type Distribution Chart Data
  const typeDistributionData = allLeaveTypesList
    .filter(t => t.consumed > 0 || t.available > 0)
    .map(t => ({
      name: t.label,
      consumed: t.consumed,
      available: t.available
    }));

  return (
    <div className="ts-overlay open" onClick={(e) => e.target.className.includes('ts-overlay') && onClose()}>
      <div className="ts-modal" style={{ maxWidth: '820px' }}>
        <button className="ts-modal-close" onClick={onClose}>✕</button>
        
        <div className="ts-modal-head" style={{ marginBottom: '14px' }}>
          <div className="ts-m-av" style={{ background: COLORS_PALETTE[3] + '20', color: COLORS_PALETTE[3] }}>
            {emp.name?.split(' ').map(n=>n[0]).join('')}
          </div>
          <div>
            <div className="ts-m-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {emp.name}
              <span style={{ fontSize: '11px', fontWeight: 600, background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '12px' }}>
                {emp.dept || 'Team Member'}
              </span>
            </div>
            <div className="ts-m-meta">{emp.id} · Total Leaves Tracked: {empLeaves.length}</div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="ts-chip-group" style={{ marginBottom: '1.25rem', justifyContent: 'flex-start' }}>
          <button className={`ts-chip ${mTab === 'OVERVIEW' ? 'active' : ''}`} onClick={() => setMTab('OVERVIEW')}>
            📊 Overview
          </button>
          <button className={`ts-chip ${mTab === 'PENDING' ? 'active' : ''}`} onClick={() => setMTab('PENDING')}>
            Applied ({totalPendingLeaves.length})
          </button>
          <button className={`ts-chip ${mTab === 'APPROVED' ? 'active' : ''}`} onClick={() => setMTab('APPROVED')}>
            Approved ({totalApprovedLeaves.length})
          </button>
          <button className={`ts-chip ${mTab === 'REJECTED' ? 'active' : ''}`} onClick={() => setMTab('REJECTED')}>
            Rejected ({totalRejectedLeaves.length})
          </button>
          <button className={`ts-chip ${mTab === 'CANCELLED' ? 'active' : ''}`} onClick={() => setMTab('CANCELLED')}>
            Cancelled ({totalCancelledLeaves.length})
          </button>
          <button className={`ts-chip ${mTab === 'ADJUSTMENTS' ? 'active' : ''}`} onClick={() => setMTab('ADJUSTMENTS')}>
            Adjustments
          </button>
        </div>

        {/* Content Body */}
        {mTab === 'OVERVIEW' ? (
          <div style={{ maxHeight: '520px', overflowY: 'auto', paddingRight: '4px' }}>
            {/* Top Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '1.25rem' }}>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Available Total</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#10b981', marginTop: '2px' }}>{emp.available || 0}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Days remaining</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Consumed Total</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#3b82f6', marginTop: '2px' }}>{emp.used || approvedDays || 0}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Days taken</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Pending Review</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#f59e0b', marginTop: '2px' }}>{pendingDays}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{totalPendingLeaves.length} request(s)</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Quota Utilization</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#8b5cf6', marginTop: '2px' }}>
                  {emp.quota > 0 ? Math.round(((emp.used || approvedDays) / emp.quota) * 100) : 0}%
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Of {emp.quota || 18} quota</div>
              </div>
            </div>

            {/* Graphs Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', marginBottom: '1.25rem' }}>
              {/* Monthly Trend Chart */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Monthly Leave Activity (Days)</span>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#10b981' }}></span> Approved
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f59e0b' }}></span> Pending
                    </span>
                  </div>
                </div>
                <div style={{ width: '100%', height: '170px' }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={monthlyTrendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                      <Tooltip 
                        contentStyle={{ fontSize: '12px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} 
                        formatter={(val) => [`${val} Days`, '']}
                      />
                      <Bar dataKey="approved" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={12} />
                      <Bar dataKey="pending" stackId="a" fill="#f59e0b" radius={[3, 3, 0, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Leave Type Breakdown Chart */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: '10px' }}>
                  Leave Type Usage vs Balance
                </span>
                <div style={{ width: '100%', height: '170px' }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={typeDistributionData} layout="vertical" margin={{ top: 5, right: 15, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.05)" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#475569' }} width={80} />
                      <Tooltip 
                        contentStyle={{ fontSize: '12px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                        formatter={(val, name) => [`${val} Days`, name === 'consumed' ? 'Consumed' : 'Available']}
                      />
                      <Bar dataKey="consumed" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={10} />
                      <Bar dataKey="available" fill="#10b981" radius={[0, 4, 4, 0]} barSize={10} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* All Types Leaves Cards & Info */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>All Leave Types Breakdown & Quotas</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{allLeaveTypesList.length} leave categories configured</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '10px' }}>
                {allLeaveTypesList.map((lt, idx) => {
                  const usedPct = lt.quota > 0 ? Math.min(100, Math.round((lt.consumed / lt.quota) * 100)) : 0;
                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        background: '#f8fafc', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '10px', 
                        padding: '12px',
                        borderLeft: `4px solid ${lt.color}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{lt.label}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Code: {lt.code}</div>
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '6px', background: lt.bg, color: lt.color }}>
                          {lt.quota > 0 ? `${lt.quota}d Quota` : 'Standard'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '6px' }}>
                        <span style={{ color: '#059669', fontWeight: 600 }}>Available: <strong>{lt.available}</strong>d</span>
                        <span style={{ color: '#475569' }}>Consumed: <strong>{lt.consumed}</strong>d</span>
                      </div>

                      <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${usedPct}%`, height: '100%', background: lt.color, borderRadius: '3px' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Leave History Preview */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Recent Leave Applications</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Last {Math.min(3, empLeaves.length)} of {empLeaves.length} applications</span>
              </div>
              {empLeaves.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '10px' }}>
                  No leave requests recorded for this team member.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {empLeaves.slice(0, 3).map((l, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#f8fafc', borderRadius: '8px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{l.leaveType}</span>
                        <span style={{ color: '#64748b' }}>({formatDate(l.startDate)} &mdash; {formatDate(l.endDate)})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, color: '#2563eb' }}>{l.totalDays} Days</span>
                        <span style={{ 
                          fontSize: '10px', 
                          fontWeight: 700, 
                          padding: '2px 6px', 
                          borderRadius: '4px',
                          background: l.status === 'APPROVED' ? '#ecfdf5' : l.status === 'PENDING' ? '#fffbeb' : '#fef2f2',
                          color: l.status === 'APPROVED' ? '#059669' : l.status === 'PENDING' ? '#d97706' : '#dc2626'
                        }}>
                          {l.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Other Tabs: PENDING, APPROVED, REJECTED, CANCELLED, ADJUSTMENTS */
          <div style={{ maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
            {mTab === 'ADJUSTMENTS' ? (
               adjLoading ? (
                 <div style={{ textAlign: 'center', padding: '2rem' }}><RefreshCw size={20} className="spin" /></div>
               ) : (
                 adjustments.length === 0 ? (
                   <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3b0', fontSize: '13px' }}>No adjustments recorded.</div>
                 ) : (
                   adjustments.map((adj, idx) => (
                     <div key={idx} className="ts-card" style={{ padding: '1rem', marginBottom: '10px', border: '1px solid rgba(0,0,0,0.06)', borderLeft: `4px solid ${adj.adjustmentType === 'ADDITION' ? '#10b981' : '#ef4444'}` }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                         <span style={{ fontWeight: 700, fontSize: '14px' }}>{adj.leaveType?.replace('_', ' ')}</span>
                         <span style={{ fontSize: '13px', fontWeight: 700, color: adj.adjustmentType === 'ADDITION' ? '#10b981' : '#ef4444' }}>
                           {adj.adjustmentType === 'ADDITION' ? '+' : '-'}{Math.abs(adj.daysChanged || 0)} Days
                         </span>
                       </div>
                       <div style={{ fontSize: '12px', color: '#9ca3b0', marginBottom: '10px' }}>
                         Adjusted on: {formatDate(adj.timestamp || adj.createdAt || adj.adjustmentDate)}
                       </div>
                       <div style={{ fontSize: '13px', color: '#5c6070', fontStyle: 'italic', background: '#f7f8fa', padding: '8px', borderRadius: '8px' }}>
                         &ldquo;{adj.reason || 'No reason provided'}&rdquo;
                       </div>
                     </div>
                   ))
                 )
               )
            ) : (
              filtered.map((l, idx) => (
                <div key={idx} className="ts-card" style={{ padding: '1rem', marginBottom: '10px', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{l.leaveType}</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#2563eb' }}>{l.totalDays} Days</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3b0', marginBottom: '10px' }}>
                    {formatDate(l.startDate)} &mdash; {formatDate(l.endDate)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#5c6070', fontStyle: 'italic', background: '#f7f8fa', padding: '8px', borderRadius: '8px' }}>
                    &ldquo;{l.reason || 'No reason provided'}&rdquo;
                  </div>

                  {mTab === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button 
                        type="button"
                        className="lv-btn-acc" 
                        onClick={async () => {
                          try {
                            setProcessingAction({ id: l.id, type: 'approve' });
                            await onAction(l.id, 'approve');
                          } catch (err) {
                          } finally {
                            setProcessingAction({ id: null, type: null });
                          }
                        }}
                        disabled={processingAction.id !== null}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {processingAction.id === l.id && processingAction.type === 'approve' ? (
                          <>
                            <RefreshCw size={14} className="ts-spin" style={{ animation: 'spin 1s linear infinite' }} />
                            Approving...
                          </>
                        ) : (
                          'Approve'
                        )}
                      </button>
                      <button 
                        type="button"
                        className="lv-btn-rej" 
                        onClick={async () => {
                          try {
                            setProcessingAction({ id: l.id, type: 'reject' });
                            await onAction(l.id, 'reject');
                          } catch (err) {
                          } finally {
                            setProcessingAction({ id: null, type: null });
                          }
                        }}
                        disabled={processingAction.id !== null}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {processingAction.id === l.id && processingAction.type === 'reject' ? (
                          <>
                            <RefreshCw size={14} className="ts-spin" style={{ animation: 'spin 1s linear infinite' }} />
                            Rejecting...
                          </>
                        ) : (
                          'Reject'
                        )}
                      </button>
                      <button 
                        type="button"
                        className="lv-btn-grey" 
                        onClick={() => { setConfirmingLeave(l); setCancelReason(''); }}
                        disabled={processingAction.id !== null}
                      >
                        Cancel Leave
                      </button>
                    </div>
                  )}

                  {mTab === 'APPROVED' && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button className="lv-btn-rej" onClick={() => { setConfirmingLeave(l); setCancelReason(''); }}>Cancel Leave</button>
                    </div>
                  )}
                </div>
              ))
            )}
            {mTab !== 'ADJUSTMENTS' && filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3b0', fontSize: '13px' }}>
                No {mTab.toLowerCase()} leave requests found for this period.
              </div>
            )}
          </div>
        )}

        <div className="ts-modal-ai">
          <div className="ts-ai-dot" style={{ flexShrink: 0, marginTop: '3px', background: '#2563eb' }}></div>
          <div className="ts-modal-ai-text">
            <strong>Capacity Insight:</strong> {emp.name} has used <strong>{((emp.used/(emp.quota || 18))*100).toFixed(0)}%</strong> of their total leave entitlement. 
            {emp.used > (emp.quota * 0.8) ? ' Usage is high — consider discussing backup for critical tasks.' : ' Leave consumption is within healthy seasonal patterns.'}
            {emp.pending > 0 ? ' There are pending requests requiring your immediate review.' : ''}
          </div>
        </div>
      </div>

      {confirmingLeave && (
        <div className="ts-overlay open" style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="ts-modal" style={{ maxWidth: '400px', width: '90%', margin: '0 auto', transform: 'none', position: 'relative' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: '#1e293b' }}>Confirm Cancel Leave</h3>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
              Are you sure you want to cancel this {((confirmingLeave.status || mTab) === 'APPROVED') ? 'approved leave' : 'leave request'}? This action cannot be undone.
            </p>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Cancellation Reason (Mandatory)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Please enter a reason..."
                style={{
                  width: '100%',
                  height: '80px',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                  resize: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button 
                type="button"
                className="lv-btn-rej" 
                style={{ background: '#64748b', color: '#fff', border: 'none' }}
                onClick={() => setConfirmingLeave(null)}
                disabled={isCancelling}
              >
                Go Back
              </button>
              <button 
                type="button"
                className="lv-btn-acc"
                style={{ background: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', border: 'none' }}
                onClick={async () => {
                  if (!cancelReason.trim()) {
                    toast.error('Cancellation reason is required');
                    return;
                  }
                  try {
                    setIsCancelling(true);
                    await onAction(confirmingLeave.id, 'cancel', cancelReason.trim());
                    setConfirmingLeave(null);
                    setMTab('CANCELLED');
                  } catch (err) {
                    // error is handled inside handleLeaveAction
                  } finally {
                    setIsCancelling(false);
                  }
                }}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <>
                    <RefreshCw size={14} className="ts-spin" style={{ animation: 'spin 1s linear infinite' }} />
                    Cancelling...
                  </>
                ) : (
                  'Confirm Cancel'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ================ SUB-COMPONENTS ================ */

function DateRangeFilter({ dateRange, setDateRange, onRefresh }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 16 }}>
      <input
        type="date"
        value={dateRange.startDate}
        onChange={(e) => setDateRange((p) => ({ ...p, startDate: e.target.value }))}
        onClick={(e) => e.target.showPicker?.()}
        style={{ ...styles.dateInput, cursor: 'pointer' }}
      />
      <span style={{ color: '#64748b' }}>to</span>
      <input
        type="date"
        value={dateRange.endDate}
        onChange={(e) => setDateRange((p) => ({ ...p, endDate: e.target.value }))}
        onClick={(e) => e.target.showPicker?.()}
        style={{ ...styles.dateInput, cursor: 'pointer' }}
      />
      <button onClick={onRefresh} style={styles.refreshBtn}>
        <RefreshCw size={14} /> Refresh
      </button>
    </div>
  );
}

function MiniKpi({ label, value, color }) {
  return (
    <div style={{ ...styles.miniKpi, borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748b', textTransform: 'capitalize' }}>{label?.toLowerCase()}</div>
    </div>
  );
}

/* ================ STYLES ================ */

const styles = {
  tabBar: {
    display: 'flex',
    gap: 4,
    background: '#f1f5f9',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
    overflowX: 'auto',
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 18px',
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: 14,
    color: '#64748b',
    transition: 'all .15s',
    whiteSpace: 'nowrap',
  },
  tabBtnActive: {
    background: '#fff',
    color: '#1e293b',
    boxShadow: '0 1px 3px rgba(0,0,0,.08)',
  },
  toolbar: {
    display: 'flex',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    background: '#fff',
    flex: 1,
    maxWidth: 400,
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    background: 'transparent',
  },
  kpiRow: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  kpiCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '18px 22px',
    borderRadius: 12,
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,.06)',
    flex: '1 1 180px',
    minWidth: 180,
  },
  kpiIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: { fontSize: 24, fontWeight: 700, color: '#1e293b' },
  kpiLabel: { fontSize: 13, color: '#64748b', marginTop: 2 },
  miniKpi: {
    padding: '14px 18px',
    borderRadius: 10,
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,.06)',
    minWidth: 120,
    flex: '1 1 120px',
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,.02)',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  chartCard: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#475569',
    marginBottom: 20,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: '0.025em',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
  },
  th: {
    textAlign: 'left',
    padding: '10px 14px',
    fontWeight: 600,
    color: '#475569',
    borderBottom: '2px solid #e2e8f0',
    whiteSpace: 'nowrap',
    fontSize: 13,
  },
  td: {
    padding: '10px 14px',
    borderBottom: '1px solid #f1f5f9',
    color: '#1e293b',
  },
  rowAlt: { background: '#f8fafc' },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
  },
  dateInput: {
    padding: '7px 12px',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    fontSize: 14,
    color: '#1e293b',
    background: '#fff',
  },
  select: {
    padding: '7px 12px',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    fontSize: 14,
    color: '#1e293b',
    background: '#fff',
    cursor: 'pointer',
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 16px',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    color: '#3b82f6',
  },
};

export default ManagerAnalytics;
