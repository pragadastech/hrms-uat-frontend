import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { reportingAPI, respondToLeaveRequest, getPendingLeaveRequests, getAllLeaveRequests, getAcceptedLeaveRequests, adminAPI, teamAPI, wfhAPI, exitAPI, managerAnalyticsAPI, leaveBalanceAPI, employeeAPI, timeEntryAPI, managerAssetAPI, unifiedEmployeeAPI, delegationAPI } from '../services/api';
import { formatTimeTo12h, formatDateLocal, resolveAttendanceEmployeeCode, resolveAttendanceClockTime, formatHoursAndMinutes, getTimesheetEntryHours } from '../utils/timeUtils';
import { formatLeaveTypeLabel, formatWorkLocationLabel, isWfhCode } from '../utils/labelUtils';
import api from '../services/api';
import {
    Users,
    Calendar,
    CheckSquare,
    Clock,
    CheckCircle,
    XCircle,
    Search,
    MoreVertical,
    UserCheck,
    UserX,
    Mail,
    Phone,
    FileText,
    Eye,
    ChevronDown,
    ChevronUp,
    RotateCw,
    LogOut,
    X,
    RefreshCw,
    Box,
    AlertCircle,
    Info,
    Plus,
    CalendarDays,
    MessageSquare,
    Monitor,
    UserPlus,
    ArrowRight,
    Shield
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Header from '../components/Header';

let autoClockOutTriggered = false;
let autoClockOutTime = 0;
let isFetchingPendingTimesheets = false;
let isFetchingAttendanceCalendar = false;
let isFetchingTeamAssets = false;

const ASSET_TYPE_OPTIONS = ['LAPTOP', 'MOBILE', 'TABLET', 'MONITOR', 'KEYBOARD', 'MOUSE', 'HEADPHONES', 'CHARGER', 'BAG', 'OTHER'];

const getTeamMemberDbId = (member) => {
    if (!member) return '';
    const rawId = member.id ?? member.employeeIdNumber ?? member.employee?.id ?? member.employee_id;
    if (rawId == null || rawId === '') return '';
    const num = Number(rawId);
    return Number.isFinite(num) ? String(num) : '';
};

const safePercent = (numerator, denominator) => {
    const n = Number(numerator) || 0;
    const d = Number(denominator) || 0;
    if (d <= 0) return 0;
    const value = Math.round((n / d) * 100);
    return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
};

const Team = () => {
    const { user, hasAdminAccess, getCurrentUser } = useAuth();
    const isAdminUser = hasAdminAccess && hasAdminAccess();
    const navigate = useNavigate();
    const location = useLocation();
    // isOrgView: true when admin/HR on /admin/team (org-wide), false on /manager/team (team-only)
    const isOrgView = isAdminUser && location.pathname.startsWith('/admin');
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState('overview');
    const [attSearchTerm, setAttSearchTerm] = useState('');

    // Cache utilities to prevent re-loading on every mount
    const getCached = (key, def) => {
        try {
            const val = window.safeSessionStorage.getItem(`tp_${key}`);
            return val ? JSON.parse(val) : def;
        } catch { return def; }
    };
    const setCache = (key, val) => window.safeSessionStorage.setItem(`tp_${key}`, JSON.stringify(val));

    // Only show spinner if we have no cached team data
    const [loading, setLoading] = useState(!window.safeSessionStorage.getItem('tp_teamMembers'));
    const [teamMembers, setTeamMembers] = useState(() => getCached('teamMembers', []));
    const [teamAttendance, setTeamAttendance] = useState(() => getCached('teamAttendance', []));
    const [pendingLeaves, setPendingLeaves] = useState(() => getCached('pendingLeaves', []));
    const [pendingWfh, setPendingWfh] = useState(() => getCached('pendingWfh', []));
    const [pendingTimesheets, setPendingTimesheets] = useState(() => getCached('pendingTimesheets', []));
    const [allTeamTimesheets, setAllTeamTimesheets] = useState(() => getCached('allTeamTimesheets', []));
    const [timesheetSubTab, setTimesheetSubTab] = useState('SUBMITTED');
    const [timesheetWeekFilter, setTimesheetWeekFilter] = useState(() => {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(today.getFullYear(), today.getMonth(), diff);
        const yyyy = monday.getFullYear();
        const mm = String(monday.getMonth() + 1).padStart(2, '0');
        const dd = String(monday.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    });
    const [timesheetMonthFilter, setTimesheetMonthFilter] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    });
    const [pendingExpenses, setPendingExpenses] = useState(() => getCached('pendingExpenses', []));
    const [pendingExitRequests, setPendingExitRequests] = useState(() => getCached('pendingExitRequests', []));
    const [teamAssets, setTeamAssets] = useState(() => getCached('teamAssets', []));
    const [teamTickets, setTeamTickets] = useState([]);
    const [loadingTickets, setLoadingTickets] = useState(false);
    const [availableAssets, setAvailableAssets] = useState([]);
    const [showAssetModal, setShowAssetModal] = useState(false);
    const [showAssignAssetModal, setShowAssignAssetModal] = useState(false);
    const [assetAssignMode, setAssetAssignMode] = useState('existing');
    const [assetAssignForm, setAssetAssignForm] = useState({
        employeeId: '', assetId: '', notes: '', location: '', assetName: '', assetType: 'LAPTOP',
    });
    const [memberSearchTerm, setMemberSearchTerm] = useState('');
    const [showMemberDropdown, setShowMemberDropdown] = useState(false);
    const [assigningAsset, setAssigningAsset] = useState(false);
    const [updatingAssetStatusId, setUpdatingAssetStatusId] = useState(null);
    const [assignedHandovers, setAssignedHandovers] = useState([]);
    const [loadingHandovers, setLoadingHandovers] = useState(false);
    const [selectedHandover, setSelectedHandover] = useState(null);
    const [showHandoverModal, setShowHandoverModal] = useState(false);
    const [updatingHandoverItemId, setUpdatingHandoverItemId] = useState(null);
    const [timesheetLoading, setTimesheetLoading] = useState(() => !window.safeSessionStorage.getItem('tp_allTeamTimesheets'));
    const [expandedTimesheets, setExpandedTimesheets] = useState(new Set());
    const [selectedTimesheet, setSelectedTimesheet] = useState(null);
    const [showTimesheetModal, setShowTimesheetModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [holdComment, setHoldComment] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showExpenseRejectModal, setShowExpenseRejectModal] = useState(false);
    const [expenseDetail, setExpenseDetail] = useState(null);
    const [expenseRejectReason, setExpenseRejectReason] = useState('');
    const [expenseToAction, setExpenseToAction] = useState(null);
    const [showHoldModal, setShowHoldModal] = useState(false);
    const [timesheetToAction, setTimesheetToAction] = useState(null);
    const [entryToAction, setEntryToAction] = useState(null);
    const [showEntryRejectModal, setShowEntryRejectModal] = useState(false);
    const [showEntriesModal, setShowEntriesModal] = useState(false);
    const [selectedEntries, setSelectedEntries] = useState([]);
    const [selectedTsInfo, setSelectedTsInfo] = useState(null);
    const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
    const [adjustmentForm, setAdjustmentForm] = useState({
        employeeId: '',
        leaveType: '',
        adjustmentType: 'ADDITION',
        days: '',
        reason: ''
    });
    const [adjustmentSubmitting, setAdjustmentSubmitting] = useState(false);
    const [leaveTypes, setLeaveTypes] = useState([]);
    const [employeeBalances, setEmployeeBalances] = useState({});
    const [balanceLoading, setBalanceLoading] = useState(false);
    const [teamBalances, setTeamBalances] = useState(() => getCached('teamBalances', {}));
    const [loadingBalances, setLoadingBalances] = useState(false);
    const [stats, setStats] = useState(() => getCached('stats', {
        totalTeam: 0,
        presentToday: 0,
        onLeave: 0,
        lateArrivals: 0
    }));
    const [whosOutToday, setWhosOutToday] = useState(() => getCached('whosOutToday', []));
    const [teamSearchTerm, setTeamSearchTerm] = useState('');
    const [adjSearchTerm, setAdjSearchTerm] = useState('');

    // Attendance calendar state
    const [attendanceCalendar, setAttendanceCalendar] = useState(() => getCached('attendanceCalendar', []));
    const [attMonth, setAttMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [calendarLoading, setCalendarLoading] = useState(false);
    const [showLeaveDetailModal, setShowLeaveDetailModal] = useState(false);
    const [showLeaveRejectModal, setShowLeaveRejectModal] = useState(false);
    const [leaveRejectionReason, setLeaveRejectionReason] = useState('');
    const [showWfhDetailModal, setShowWfhDetailModal] = useState(false);
    const [selectedLeave, setSelectedLeave] = useState(null);
    const [selectedWfh, setSelectedWfh] = useState(null);
    const [managerLimits, setManagerLimits] = useState({});
    const [showExitModal, setShowExitModal] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [approvalFilter, setApprovalFilter] = useState('all');
    const [approvalSourceFilter, setApprovalSourceFilter] = useState('all'); // 'all', 'direct', 'delegated'
    const [submittingAction, setSubmittingAction] = useState({ id: null, action: null });
    const [showDecisionModal, setShowDecisionModal] = useState(false);
    const [decisionAction, setDecisionAction] = useState('APPROVE'); // 'APPROVE' or 'REJECT'
    const [activeRequest, setActiveRequest] = useState(null);
    const [decisionComment, setDecisionComment] = useState('');

    // Delegation management state
    const [myDelegations, setMyDelegations] = useState({ assignedByMe: [], delegatedToMe: [] });
    const [eligibleDelegates, setEligibleDelegates] = useState([]);
    const [showDelegationModal, setShowDelegationModal] = useState(false);
    const [creatingDelegation, setCreatingDelegation] = useState(false);
    const [filterActiveDelegations, setFilterActiveDelegations] = useState(true);
    const [delegationForm, setDelegationForm] = useState({
        delegateeId: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        scope: 'ALL',
        reason: ''
    });

    // Clock effect
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
 
    // Trigger auto clock-out on mount to ensure attendance data is fresh
    useEffect(() => {
        const triggerAutoClockOut = async () => {
            const now = Date.now();
            if (autoClockOutTriggered && now - autoClockOutTime < 60000) return;
            autoClockOutTriggered = true;
            autoClockOutTime = now;
            try {
                await timeEntryAPI.triggerAutoClockOut();
                console.log('✅ Auto clock-out check triggered successfully');
            } catch (err) {
                console.warn('⚠️ Auto clock-out trigger failed (non-critical):', err);
            }
        };
 
        triggerAutoClockOut();
    }, []);
    const [selectedExitRequest, setSelectedExitRequest] = useState(null);
    const [exitLwd, setExitLwd] = useState('');
    const [exitManagerComments, setExitManagerComments] = useState('');

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

    const fetchDelegations = async () => {
        try {
            const [delRes, candRes] = await Promise.all([
                delegationAPI.getMyDelegations(),
                delegationAPI.getEligibleDelegates()
            ]);
            setMyDelegations(delRes.data || { assignedByMe: [], delegatedToMe: [] });
            setEligibleDelegates(candRes.data || []);
        } catch (err) {
            console.warn("Could not fetch delegations:", err);
        }
    };

    const handleCreateDelegation = async (e) => {
        e.preventDefault();
        if (!delegationForm.delegateeId) {
            toast.error("Please select a manager or HR/CEO to delegate authority to");
            return;
        }
        if (!delegationForm.startDate || !delegationForm.endDate) {
            toast.error("Please select both start and end dates");
            return;
        }
        const todayStr = new Date().toISOString().split('T')[0];
        if (delegationForm.endDate < todayStr) {
            toast.error("End date cannot be in the past");
            return;
        }
        if (delegationForm.startDate > delegationForm.endDate) {
            toast.error("Start date cannot be after end date");
            return;
        }

        // Circular delegation check on client side: Check if delegatee currently has an active delegation to me
        const currentScope = delegationForm.scope || 'ALL';
        const circularActive = (myDelegations?.delegatedToMe || []).find(d => {
            if (d.status !== 'ACTIVE') return false;
            if (Number(d.delegatorId) !== Number(delegationForm.delegateeId)) return false;
            const scopeOverlap = currentScope === 'ALL' || d.scope === 'ALL' || d.scope === currentScope;
            if (!scopeOverlap) return false;
            return delegationForm.startDate <= d.endDate && delegationForm.endDate >= d.startDate;
        });

        if (circularActive) {
            toast.error(`Circular delegation blocked! ${circularActive.delegatorName || 'The selected peer'} already has an active delegation to you for overlapping dates (${circularActive.startDate} to ${circularActive.endDate}).`);
            return;
        }

        // Check for overlapping active outgoing delegations
        const overlappingActive = (myDelegations?.assignedByMe || []).find(d => {
            if (d.status !== 'ACTIVE') return false;
            const scopeOverlap = currentScope === 'ALL' || d.scope === 'ALL' || d.scope === currentScope;
            if (!scopeOverlap) return false;
            // Overlap condition: start <= d.endDate && end >= d.startDate
            return delegationForm.startDate <= d.endDate && delegationForm.endDate >= d.startDate;
        });

        if (overlappingActive) {
            toast.error(`Delegation date overlap! You already have an ACTIVE delegation (${overlappingActive.startDate} to ${overlappingActive.endDate}, Scope: ${overlappingActive.scope}). Please revoke it or pick non-overlapping dates.`);
            return;
        }

        try {
            setCreatingDelegation(true);
            const res = await delegationAPI.createDelegation({
                delegateeId: Number(delegationForm.delegateeId),
                startDate: delegationForm.startDate,
                endDate: delegationForm.endDate,
                scope: currentScope,
                reason: delegationForm.reason || ''
            });
            toast.success(res.data?.message || "Approval delegation created successfully!");
            setShowDelegationModal(false);
            setDelegationForm({
                delegateeId: '',
                startDate: new Date().toISOString().split('T')[0],
                endDate: '',
                scope: 'ALL',
                reason: ''
            });
            fetchDelegations();
            fetchTeamData();
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || "Failed to create delegation");
        } finally {
            setCreatingDelegation(false);
        }
    };

    const handleRevokeDelegation = async (id) => {
        if (!window.confirm("Are you sure you want to revoke this approval delegation early?")) return;
        try {
            await delegationAPI.revokeDelegation(id);
            toast.success("Delegation revoked successfully");
            fetchDelegations();
            fetchTeamData();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to revoke delegation");
        }
    };

    const fetchLeaveTypes = async () => {
        try {
            // Managers use the employee/manager-facing endpoint to avoid 403 errors
            const res = await employeeAPI.getActiveLeaveTypes();
            setLeaveTypes(res.data || []);
        } catch (err) {
            console.error('Failed to fetch leave types', err);
        }
    };

    const fetchEmployeeBalances = async (empId) => {
        if (!empId) return;
        try {
            setBalanceLoading(true);
            // Use reporting API as it calculates actual available balance (defaults + adjustments)
            const res = await reportingAPI.getLeaveBalanceReport({ search: empId });
            const balances = {};
            
            // The reporting API returns a paginated list of employee balances
            const employeeData = res.data?.data?.find(d => 
                String(d.employeeId).toLowerCase() === String(empId).toLowerCase()
            ) || res.data?.data?.[0]; // Fallback to first match if search is specific

            if (employeeData && employeeData.leaveBalances) {
                employeeData.leaveBalances.forEach(item => {
                    const code = item.leaveTypeCode || item.leaveType;
                    balances[code] = item.availableBalance ?? item.balance ?? 0;
                });
            } else {
                // Manual balance fallback if reporting doesn't yield results
                try {
                    const manualRes = await leaveBalanceAPI.getBalance(empId);
                    if (manualRes.data) {
                        if (Array.isArray(manualRes.data)) {
                            manualRes.data.forEach(item => {
                                const code = item.leaveTypeCode || item.leaveType;
                                balances[code] = item.balance || item.availableBalance || 0;
                            });
                        } else {
                            Object.assign(balances, manualRes.data);
                        }
                    }
                } catch (e) {
                    // 404 expected if no manual overrides exist yet
                }
            }
            setEmployeeBalances(balances);
        } catch (err) {
            console.error('Failed to fetch employee balances', err);
            setEmployeeBalances({});
        } finally {
            setBalanceLoading(false);
        }
    };


    // Deep-link support for email notifications:
    // /manager/team?tab=timesheets&employeeId=EMP_ID&weekStart=YYYY-MM-DD
    const deepLinkTab = (searchParams.get('tab') || '').toLowerCase();
    const deepLinkEmployeeId = searchParams.get('employeeId') || '';
    const deepLinkWeekStart = searchParams.get('weekStart') || '';



    useEffect(() => {
        const allowedTabs = new Set(['overview', 'attendance', 'approvals', 'timesheets', 'tasks', 'documents', 'adjustments']);
        if (deepLinkTab && allowedTabs.has(deepLinkTab)) {
            setActiveTab(deepLinkTab);
        }
    }, [deepLinkTab]);

    useEffect(() => {
        // Initial load or view mode switch
        fetchTeamData();
    }, [user, isOrgView]);

    const isFetchingTeamData = React.useRef(false);

    useEffect(() => {
        if (activeTab === 'overview') {
            fetchTeamData(false); // Silent refresh for overview
        }
        if (activeTab === 'timesheets') {
            fetchPendingTimesheets();
        }
        if (activeTab === 'attendance') {
            fetchAttendanceCalendar();
        }
        if (activeTab === 'asset-management') {
            fetchTeamAssets();
        }
    }, [activeTab, isOrgView, timesheetWeekFilter, timesheetMonthFilter]);

    // Re-fetch calendar when month changes
    useEffect(() => {
        if (activeTab === 'attendance') {
            fetchAttendanceCalendar();
        }
    }, [attMonth]);

    // Fetch all reportee balances for the Adjustments tab
    useEffect(() => {
        const fetchAllBalances = async () => {
            if (activeTab !== 'adjustments') return;
            try {
                if (Object.keys(teamBalances).length === 0) {
                    setLoadingBalances(true);
                }

                // Ensure team members are available for this tab (Overview search must not hide them)
                if (!teamMembers || teamMembers.length === 0) {
                    try {
                        let members = [];
                        const managerKey = user?.employeeId || user?.employeeIdString || user?.username;
                        if (managerKey) {
                            try {
                                const teamOverviewRes = await teamAPI.getTeamOverview(managerKey);
                                members = Array.isArray(teamOverviewRes.data) ? teamOverviewRes.data : [];
                            } catch {
                                try {
                                    const subordinatesRes = await reportingAPI.getSubordinates(managerKey);
                                    members = Array.isArray(subordinatesRes.data) ? subordinatesRes.data : [];
                                } catch {
                                    members = [];
                                }
                            }
                        }
                        if (members.length === 0) {
                            try {
                                const unifiedRes = await unifiedEmployeeAPI.getEmployees(isOrgView ? 'ORG' : 'TEAM');
                                const data = unifiedRes?.data;
                                if (Array.isArray(data)) members = data;
                                else if (Array.isArray(data?.employees)) members = data.employees;
                                else if (Array.isArray(data?.data)) members = data.data;
                            } catch {
                                /* ignore */
                            }
                        }
                        // Exclude the manager themselves from adjustment cards when using TEAM list
                        const selfIds = new Set(
                            [user?.employeeId, user?.employeeIdString, user?.id, user?.username]
                                .filter(Boolean)
                                .map((v) => String(v).toUpperCase())
                        );
                        const cleaned = members.filter((m) => {
                            const id = String(m.employeeId || m.employeeIdString || m.id || '').toUpperCase();
                            return id && !selfIds.has(id);
                        });
                        if (cleaned.length > 0) {
                            setTeamMembers(cleaned);
                            setCache('teamMembers', cleaned);
                        }
                    } catch (memberErr) {
                        console.warn('Failed to refresh team members for adjustments', memberErr);
                    }
                }

                const res = await reportingAPI.getLeaveBalanceReport({ size: 500, page: 0 });
                const balanceMap = {};
                const reportMembers = [];
                if (res.data?.data && Array.isArray(res.data.data)) {
                    res.data.data.forEach(emp => {
                        const empId = String(emp.employeeId || emp.employeeIdString || '').toUpperCase();
                        if (empId && emp.leaveBalances) {
                            balanceMap[empId] = {};
                            emp.leaveBalances.forEach(lb => {
                                const code = lb.leaveTypeCode || lb.leaveType;
                                balanceMap[empId][code] = lb.availableBalance ?? lb.balance ?? 0;
                                balanceMap[empId][code + '_USED'] = lb.usedLeaves ?? 0;
                                balanceMap[empId][code + '_QUOTA'] = (lb.openingBalance ?? 0) + (lb.accruedLeaves ?? 0) || lb.annualQuota || 0;
                            });
                        }
                        if (empId) {
                            reportMembers.push({
                                id: emp.id,
                                employeeId: emp.employeeId || emp.employeeIdString,
                                employeeIdString: emp.employeeIdString || emp.employeeId,
                                firstName: emp.firstName || (emp.employeeName || '').split(' ')[0] || '',
                                lastName: emp.lastName || (emp.employeeName || '').split(' ').slice(1).join(' ') || '',
                                departmentName: emp.departmentName || emp.department || '',
                                department: emp.departmentName || emp.department || '',
                                isActive: emp.isActive !== false,
                            });
                        }
                    });
                }
                setTeamBalances(balanceMap);
                setCache('teamBalances', balanceMap);

                // If team list is still empty, fall back to leave-balance report employees
                setTeamMembers((prev) => {
                    if (Array.isArray(prev) && prev.length > 0) return prev;
                    if (reportMembers.length === 0) return prev;
                    setCache('teamMembers', reportMembers);
                    return reportMembers;
                });
            } catch (err) {
                console.error('Failed to fetch team leave balances', err);
            } finally {
                setLoadingBalances(false);
            }
        };
        fetchAllBalances();
    }, [activeTab, user?.employeeId, user?.employeeIdString, user?.username, user?.id, isOrgView]);

    useEffect(() => {
        const fetchLimits = async () => {
            try {
                const res = await teamAPI.getLeaveLimits();
                setManagerLimits(res.data || {});
            } catch (err) {
                console.warn('Failed to fetch manager limits', err);
            }
        };
        fetchLimits();
    }, []);

    useEffect(() => {
        if (showAdjustmentModal && leaveTypes.length === 0) {
            fetchLeaveTypes();
        }
    }, [showAdjustmentModal]);

    useEffect(() => {
        if (showAdjustmentModal && adjustmentForm.employeeId) {
            fetchEmployeeBalances(adjustmentForm.employeeId);
        }
    }, [showAdjustmentModal, adjustmentForm.employeeId]);

    const fetchAttendanceCalendar = useCallback(async () => {
        if (isFetchingAttendanceCalendar) return;
        try {
            isFetchingAttendanceCalendar = true;
            if (attendanceCalendar.length === 0) {
                setCalendarLoading(true);
            }
            const [y, m] = attMonth.split('-').map(Number);
            const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
            const endDate = new Date(y, m, 0).toISOString().split('T')[0];
            // isOrgView (admin on /admin/team) Ã¢â€ â€™ fetch all-org calendar; manager Ã¢â€ â€™ team only
            const res = isOrgView
                ? await managerAnalyticsAPI.getOrgAttendance(startDate, endDate)
                : await managerAnalyticsAPI.getTeamAttendance(startDate, endDate);
            const calendarData = res.data?.calendar || [];
            setAttendanceCalendar(calendarData);
            setCache('attendanceCalendar', calendarData);
        } catch (e) {
            console.error('Attendance calendar fetch error', e);
            toast.error('Failed to load attendance calendar');
        } finally {
            isFetchingAttendanceCalendar = false;
            setCalendarLoading(false);
        }
    }, [attMonth, isOrgView]);

    const [loadingTeamAssets, setLoadingTeamAssets] = useState(false);
    const [selectedMemberAssets, setSelectedMemberAssets] = useState(null);

    const fetchTeamAssets = async (force = false) => {
        if (isFetchingTeamAssets && !force) return;
        try {
            isFetchingTeamAssets = true;
            if (teamAssets.length === 0) {
                setLoadingTeamAssets(true);
            }
            if (assignedHandovers.length === 0) {
                setLoadingHandovers(true);
            }
            if (teamTickets.length === 0) {
                setLoadingTickets(true);
            }
            const [assetsRes, availableRes, handoversRes, ticketsRes] = await Promise.all([
                managerAssetAPI.getTeamAssets(isOrgView),
                managerAssetAPI.getAvailableAssets(),
                exitAPI.getMyAssignedHandovers().catch(() => ({ data: [] })),
                managerAssetAPI.getTickets().catch(() => ({ data: [] })),
            ]);
            const assets = assetsRes.data || [];
            setTeamAssets(assets);
            setAvailableAssets(availableRes.data || []);
            setAssignedHandovers(Array.isArray(handoversRes?.data) ? handoversRes.data : []);
            setTeamTickets(ticketsRes?.data || []);
            setCache('teamAssets', assets);
        } catch (err) {
            console.warn('Failed to fetch team assets', err);
            toast.error(err.response?.data?.message || 'Failed to load team assets');
        } finally {
            isFetchingTeamAssets = false;
            setLoadingTeamAssets(false);
            setLoadingHandovers(false);
            setLoadingTickets(false);
        }
    };

    const openMemberAssetsModal = (member) => {
        const memberDbId = Number(getTeamMemberDbId(member));
        const memberAssets = teamAssets.filter(asset => asset.assignedToId === memberDbId);
        setSelectedMemberAssets({
            member,
            assets: memberAssets,
        });
        setShowAssetModal(true);
    };

    const openAssignAssetModal = (member = null) => {
        const dbId = member ? getTeamMemberDbId(member) : '';
        setAssetAssignForm({
            employeeId: dbId,
            assetId: '',
            notes: '',
            location: '',
            assetName: '',
            assetType: 'LAPTOP',
        });
        if (member) {
            setMemberSearchTerm(`${member.firstName || ''} ${member.lastName || ''}`.trim() + ` (${member.employeeId || ''})`);
        } else {
            setMemberSearchTerm('');
        }
        setShowMemberDropdown(false);
        setAssetAssignMode('new');
        setShowAssignAssetModal(true);
        fetchTeamAssets(true);
    };

    const handleAssignTeamAsset = async () => {
        const employeeId = Number(assetAssignForm.employeeId);
        if (!assetAssignForm.employeeId || !Number.isFinite(employeeId)) {
            toast.error('Select a valid team member');
            return;
        }

        if (assetAssignMode === 'new') {
            const assetName = (assetAssignForm.assetName || '').trim();
            if (!assetName) {
                toast.error('Enter an asset name');
                return;
            }
            try {
                setAssigningAsset(true);
                await managerAssetAPI.createAndAssignAsset({
                    employeeId,
                    assetName,
                    assetType: assetAssignForm.assetType || 'OTHER',
                    notes: assetAssignForm.notes || undefined,
                    location: assetAssignForm.location || undefined,
                }, isOrgView);
                toast.success('Asset added and assigned to team member');
                setShowAssignAssetModal(false);
                setAssetAssignForm({ employeeId: '', assetId: '', notes: '', location: '', assetName: '', assetType: 'LAPTOP' });
                setMemberSearchTerm('');
                fetchTeamAssets();
            } catch (err) {
                toast.error(err.response?.data?.message || 'Failed to add asset');
            } finally {
                setAssigningAsset(false);
            }
            return;
        }

        const assetId = Number(assetAssignForm.assetId);
        if (!assetAssignForm.assetId || !Number.isFinite(assetId)) {
            toast.error(availableAssets.length === 0
                ? 'No assets in inventory — switch to Assign New mode'
                : 'Select an asset from inventory');
            return;
        }
        try {
            setAssigningAsset(true);
            await managerAssetAPI.assignAsset({
                employeeId,
                assetId,
                notes: assetAssignForm.notes || undefined,
                location: assetAssignForm.location || undefined,
            }, isOrgView);
            toast.success('Asset assigned to team member');
            setShowAssignAssetModal(false);
            setAssetAssignForm({ employeeId: '', assetId: '', notes: '', location: '', assetName: '', assetType: 'LAPTOP' });
            fetchTeamAssets();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to assign asset');
        } finally {
            setAssigningAsset(false);
        }
    };

    const handleReturnTeamAsset = async (assetId) => {
        if (!window.confirm('Mark this asset as returned from the team member?')) return;
        try {
            await managerAssetAPI.returnAsset(assetId, isOrgView);
            toast.success('Asset returned');
            const res = await managerAssetAPI.getTeamAssets(isOrgView);
            const assets = res.data || [];
            setTeamAssets(assets);
            setCache('teamAssets', assets);
            if (selectedMemberAssets) {
                setSelectedMemberAssets(prev => prev ? {
                    ...prev,
                    assets: assets.filter(a => a.assignedToId === Number(getTeamMemberDbId(prev.member))),
                } : prev);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to return asset');
        }
    };

    const handleUpdateTeamAssetStatus = async (assetId, status) => {
        if (!assetId || !status) return;
        try {
            setUpdatingAssetStatusId(assetId);
            await managerAssetAPI.updateAssetStatus(assetId, status, isOrgView);
            toast.success('Asset status updated');
            const res = await managerAssetAPI.getTeamAssets(isOrgView);
            const assets = res.data || [];
            setTeamAssets(assets);
            setCache('teamAssets', assets);
            if (selectedMemberAssets) {
                setSelectedMemberAssets(prev => prev ? {
                    ...prev,
                    assets: assets.filter(a => a.assignedToId === Number(getTeamMemberDbId(prev.member))),
                } : prev);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Update failed');
        } finally {
            setUpdatingAssetStatusId(null);
        }
    };

    const handleUpdateTicketStatus = async (ticket, status) => {
        try {
            await managerAssetAPI.updateTicket(ticket.id, { status });
            toast.success(`Ticket marked as ${status.replace('_', ' ')}`);
            fetchTeamAssets();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update ticket status');
        }
    };

    const handleUpdateHandoverItemStatus = async (itemId, status) => {
        if (!itemId || !status) return;
        try {
            setUpdatingHandoverItemId(itemId);
            await exitAPI.updateAssetItem(itemId, { status });
            toast.success('Asset handover status updated');
            const handoversRes = await exitAPI.getMyAssignedHandovers();
            const handovers = Array.isArray(handoversRes?.data) ? handoversRes.data : [];
            setAssignedHandovers(handovers);
            if (selectedHandover) {
                const refreshed = handovers.find(h => h.id === selectedHandover.id);
                if (refreshed) setSelectedHandover(refreshed);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Update failed');
        } finally {
            setUpdatingHandoverItemId(null);
        }
    };

    const fetchTeamData = async (showGlobalLoading = true) => {
        if (isFetchingTeamData.current) return;
        
        const isAdminUser = hasAdminAccess && hasAdminAccess();

        // For admins on org view, allow proceeding even without employeeId
        if (!isAdminUser && !user?.employeeId) {
            setLoading(false);
            return;
        }

        isFetchingTeamData.current = true;
        const hasCache = window.safeSessionStorage.getItem('tp_teamMembers');
        if (showGlobalLoading && !hasCache) setLoading(true);
        try {
            const today = formatDateLocal(new Date());

            // 1. Members
            const membersPromise = (async () => {
                let members = [];
                try {
                    if (user?.employeeId) {
                        const teamOverviewRes = await teamAPI.getTeamOverview(user.employeeId);
                        members = teamOverviewRes.data || [];
                    }
                } catch (err) {
                    try {
                        if (user?.employeeId) {
                            const subordinatesRes = await reportingAPI.getSubordinates(user.employeeId);
                            members = subordinatesRes.data || [];
                        }
                    } catch (fallbackErr) {
                        members = [];
                    }
                }

                if (isOrgView) {
                    try {
                        const allEmployeesRes = await adminAPI.getAllEmployees();
                        let allEmployees = [];
                        if (allEmployeesRes.data) {
                            if (allEmployeesRes.data.employees && Array.isArray(allEmployeesRes.data.employees)) {
                                allEmployees = allEmployeesRes.data.employees;
                            } else if (Array.isArray(allEmployeesRes.data)) {
                                allEmployees = allEmployeesRes.data;
                            } else if (allEmployeesRes.data.data && Array.isArray(allEmployeesRes.data.data)) {
                                allEmployees = allEmployeesRes.data.data;
                            }
                        }
                        members = allEmployees;
                    } catch (err) {
                        try {
                            const unassignedRes = await teamAPI.getAdminTeamOverview();
                            let unassignedEmployees = [];
                            if (unassignedRes.data) {
                                if (unassignedRes.data.items && Array.isArray(unassignedRes.data.items)) {
                                    unassignedEmployees = unassignedRes.data.items;
                                } else if (Array.isArray(unassignedRes.data)) {
                                    unassignedEmployees = unassignedRes.data;
                                } else if (unassignedRes.data.employees && Array.isArray(unassignedRes.data.employees)) {
                                    unassignedEmployees = unassignedRes.data.employees;
                                }
                            }
                            const existingIds = new Set(members.map(m => {
                                const id = m.employeeId || m.id || m.employeeIdString;
                                return id ? String(id) : null;
                            }).filter(Boolean));
                            const additionalMembers = unassignedEmployees.filter(emp => {
                                const empId = emp.employeeId || emp.id || emp.employeeIdString || emp.employee_id;
                                const empIdStr = empId ? String(empId) : null;
                                return empIdStr && !existingIds.has(empIdStr);
                            });
                            members = [...members, ...additionalMembers];
                        } catch (fallbackErr) {
                        }
                    }
                }
                return members;
            })();

            // 2. Attendance Data
            const attendancePromise = (async () => {
                let attendanceData = [];
                try {
                    if (isOrgView) {
                        const attendanceRes = await teamAPI.getAdminTeamAttendance(today);
                        if (attendanceRes.data) {
                            if (Array.isArray(attendanceRes.data)) {
                                attendanceData = attendanceRes.data;
                            } else if (attendanceRes.data.data && Array.isArray(attendanceRes.data.data)) {
                                attendanceData = attendanceRes.data.data;
                            } else if (attendanceRes.data.attendance && Array.isArray(attendanceRes.data.attendance)) {
                                attendanceData = attendanceRes.data.attendance;
                            } else if (attendanceRes.data.items && Array.isArray(attendanceRes.data.items)) {
                                attendanceData = attendanceRes.data.items;
                            }
                        }
                    } else if (user?.employeeId) {
                        const attendanceRes = await teamAPI.getTeamAttendance(user.employeeId, today);
                        if (attendanceRes.data?.teamMembers && Array.isArray(attendanceRes.data.teamMembers)) {
                            attendanceData = attendanceRes.data.teamMembers;
                        } else if (attendanceRes.data && Array.isArray(attendanceRes.data)) {
                            attendanceData = attendanceRes.data;
                        } else if (attendanceRes.data?.data && Array.isArray(attendanceRes.data.data)) {
                            attendanceData = attendanceRes.data.data;
                        }
                    }
                } catch (err) {
                    console.error("Error fetching team attendance:", err);
                    attendanceData = [];
                }
                return attendanceData;
            })();

            // 3. Leaves
            const leavesPromise = (async () => {
                let myTeamLeaves = [];
                try {
                    if (isOrgView) {
                        try {
                            const allRes = await getAllLeaveRequests();
                            let allLeaves = [];
                            if (Array.isArray(allRes)) {
                                allLeaves = allRes;
                            } else if (allRes && Array.isArray(allRes.data)) {
                                allLeaves = allRes.data;
                            } else if (allRes?.leaveRequests && Array.isArray(allRes.leaveRequests)) {
                                allLeaves = allRes.leaveRequests;
                            } else {
                                allLeaves = [];
                            }
                            myTeamLeaves = allLeaves.filter(l => {
                                const st = String(l.status || '').trim().toUpperCase();
                                return st === 'PENDING' || st === 'SUBMITTED';
                            });
                        } catch (adminErr) {
                            try {
                                const pendingRes = await getPendingLeaveRequests();
                                let allPendingLeaves = [];
                                if (Array.isArray(pendingRes)) {
                                    allPendingLeaves = pendingRes;
                                } else if (Array.isArray(pendingRes.data)) {
                                    allPendingLeaves = pendingRes.data;
                                }
                                myTeamLeaves = allPendingLeaves.filter(l => {
                                    const st = String(l.status || '').trim().toUpperCase();
                                    return st === 'PENDING' || st === 'SUBMITTED';
                                });
                            } catch (fallbackErr) {
                                myTeamLeaves = [];
                            }
                        }
                    } else if (user?.employeeId) {
                        const leavesRes = await teamAPI.getTeamLeaveRequests(user.employeeId);
                        myTeamLeaves = Array.isArray(leavesRes.data) ? leavesRes.data : [];
                        myTeamLeaves = myTeamLeaves.filter(l => {
                            const st = String(l.status || '').trim().toUpperCase();
                            const mst = String(l.managerStatus || '').trim().toUpperCase();
                            // Exclude if already decided or cancelled
                            const nonPending = ['APPROVED', 'REJECTED', 'CANCELLED', 'CANCELED', 'ACCEPTED', 'SKIPPED', 'FORWARDED_TO_HR'];
                            if (nonPending.includes(st) || nonPending.includes(mst)) return false;
                            return st === 'PENDING' || st === 'SUBMITTED' || mst === 'PENDING' || mst === 'SUBMITTED';
                        });
                        
                        // If direct team requests list is empty, also try getPendingLeaveRequests fallback
                        if (myTeamLeaves.length === 0 && user?.id) {
                            try {
                                const pendingRes = await teamAPI.getPendingLeaveRequests(user.id);
                                const pendingList = Array.isArray(pendingRes.data) ? pendingRes.data : (Array.isArray(pendingRes.data?.requests) ? pendingRes.data.requests : []);
                                if (pendingList.length > 0) {
                                    myTeamLeaves = pendingList.filter(l => {
                                        const st = String(l.status || '').trim().toUpperCase();
                                        const mst = String(l.managerStatus || '').trim().toUpperCase();
                                        const nonPending = ['APPROVED', 'REJECTED', 'CANCELLED', 'CANCELED', 'ACCEPTED', 'SKIPPED', 'FORWARDED_TO_HR'];
                                        if (nonPending.includes(st) || nonPending.includes(mst)) return false;
                                        return st === 'PENDING' || st === 'SUBMITTED' || mst === 'PENDING' || mst === 'SUBMITTED';
                                    });
                                }
                            } catch {
                                // fallback ignored
                            }
                        }
                    }
                } catch (err) {
                    myTeamLeaves = [];
                }
                return myTeamLeaves;
            })();

            // 4. Manager limits
            const limitsPromise = teamAPI.getLeaveLimits().then(res => res.data || {}).catch(() => ({}));

            // 5. WFH
            const wfhPromise = (async () => {
                let myPendingWfh = [];
                try {
                    if (isOrgView) {
                        const wfhRes = await wfhAPI.getPending();
                        myPendingWfh = Array.isArray(wfhRes?.data) ? wfhRes.data : (Array.isArray(wfhRes) ? wfhRes : []);
                    } else if (user?.employeeId) {
                        const wfhRes = await wfhAPI.getManagerPending();
                        myPendingWfh = Array.isArray(wfhRes?.data) ? wfhRes.data : (Array.isArray(wfhRes) ? wfhRes : []);
                    }
                    myPendingWfh = myPendingWfh.filter(w => String(w.status || '').toUpperCase() === 'PENDING');
                } catch (err) {
                    console.warn('WFH fetch failed:', err?.response?.status, err?.message);
                    myPendingWfh = [];
                }
                return myPendingWfh;
            })();

            // 6. Expenses
            const expensesPromise = (async () => {
                let myPendingExpenses = [];
                try {
                    if (isOrgView || isAdminUser) {
                        const expRes = await adminAPI.getExpenses();
                        const expList = Array.isArray(expRes?.data) ? expRes.data : [];
                        myPendingExpenses = expList.filter(e => String(e.status || '').toUpperCase() === 'SUBMITTED');
                    } else {
                        const expRes = await teamAPI.getTeamExpenses(user?.employeeId);
                        const expList = Array.isArray(expRes?.data) ? expRes.data : [];
                        myPendingExpenses = expList.filter(e => String(e.status || '').toUpperCase() === 'SUBMITTED');
                    }
                } catch (err) {
                    myPendingExpenses = [];
                }
                return myPendingExpenses;
            })();

            // 7. Exit Requests
            const exitPromise = (async () => {
                let myPendingExit = [];
                try {
                    if (isOrgView || isAdminUser) {
                        const exitRes = await exitAPI.getAllExitRequests();
                        const exitList = Array.isArray(exitRes?.data) ? exitRes.data : (Array.isArray(exitRes) ? exitRes : []);
                        myPendingExit = exitList.filter(e => String(e.status || '').toUpperCase() === 'PENDING');
                    } else {
                        const exitRes = await exitAPI.getTeamExitRequests(user?.employeeId);
                        const exitList = Array.isArray(exitRes?.data) ? exitRes.data : (Array.isArray(exitRes) ? exitRes : []);
                        myPendingExit = exitList.filter(e => String(e.status || '').toUpperCase() === 'PENDING');
                    }
                } catch (err) {
                    console.warn('Exit requests fetch failed:', err?.response?.status, err?.message);
                    myPendingExit = [];
                }
                return myPendingExit;
            })();

            // 8. Out Today
            const outTodayPromise = (async () => {
                const now = new Date();
                const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const isDateInRange = (dateStr, start, end) => {
                    if (!dateStr || (!start && !end)) return false;
                    const parseDate = (val) => {
                        if (!val) return null;
                        if (Array.isArray(val)) return new Date(val[0], val[1] - 1, val[2]);
                        if (typeof val === 'string' && val.includes('-')) {
                            const p = val.split('T')[0].split('-');
                            if (p[0].length === 4) return new Date(p[0], p[1] - 1, p[2]);
                            if (p[2] && p[2].length === 4) return new Date(p[2], p[1] - 1, p[0]);
                        }
                        const d = new Date(val);
                        return isNaN(d.getTime()) ? null : d;
                    };
                    const target = parseDate(dateStr);
                    const s = parseDate(start) || target;
                    const e = parseDate(end) || target;
                    if (!target || !s || !e) return false;
                    target.setHours(0, 0, 0, 0);
                    s.setHours(0, 0, 0, 0);
                    e.setHours(0, 0, 0, 0);
                    return target >= s && target <= e;
                };
                const blobColors = ['#e8f5a3', '#fce4ec', '#ffcdd2', '#bbdefb', '#c8e6c9', '#e1bee7'];
                const getBlobColor = (index, leaveType = '') => {
                    const key = (leaveType || '').toLowerCase();
                    if (key.includes('sick')) return '#fee2e2';
                    if (key.includes('casual')) return '#e0e7ff';
                    if (key.includes('remote') || key.includes('wfh')) return '#dcfce7';
                    if (key.includes('personal')) return '#fef3c7';
                    if (key.includes('vacation') || key.includes('annual')) return '#f3e8ff';
                    return blobColors[index % blobColors.length];
                };

                const parseDateObj = (val) => {
                    if (!val) return null;
                    if (Array.isArray(val)) return new Date(val[0], val[1] - 1, val[2]);
                    if (typeof val === 'string' && val.includes('-')) {
                        const p = val.split('T')[0].split('-');
                        if (p[0].length === 4) return new Date(p[0], p[1] - 1, p[2]);
                        if (p[2] && p[2].length === 4) return new Date(p[2], p[1] - 1, p[0]);
                    }
                    const d = new Date(val);
                    return isNaN(d.getTime()) ? null : d;
                };

                const formatCardDates = (sDate, eDate, todayObj) => {
                    if (!sDate && !eDate) return { label: 'Scheduled', isToday: false, isUpcoming: false };
                    const start = sDate || eDate;
                    const end = eDate || sDate;
                    
                    const isToday = todayObj >= start && todayObj <= end;
                    const isUpcoming = start > todayObj;
                    
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const fmt = (d) => `${monthNames[d.getMonth()]} ${d.getDate()}`;
                    
                    let dateText = '';
                    if (start.getTime() === end.getTime()) {
                        dateText = isToday ? 'Today' : fmt(start);
                    } else {
                        if (isToday) {
                            dateText = `Today - ${fmt(end)}`;
                        } else {
                            dateText = `${fmt(start)} - ${fmt(end)}`;
                        }
                    }
                    return { label: dateText, isToday, isUpcoming };
                };

                let outList = [];
                try {
                    const todayDate = new Date();
                    todayDate.setHours(0, 0, 0, 0);

                    let leaveList = [];
                    if (isOrgView) {
                        const res = await getAcceptedLeaveRequests();
                        const data = res?.data || res;
                        leaveList = Array.isArray(data) ? data : (data?.leaveRequests || data?.content || []);
                    } else if (user?.employeeId) {
                        try {
                            const res = await teamAPI.getTeamLeaveForWhosOut();
                            const d = res?.data;
                            leaveList = d?.leaveRequests != null ? d.leaveRequests : (Array.isArray(d) ? d : (d?.content || []));
                            if (leaveList.length === 0) {
                                const altRes = await teamAPI.getTeamLeaveRequests(user.employeeId);
                                const ad = altRes?.data || altRes;
                                leaveList = Array.isArray(ad) ? ad : (ad?.content || []);
                            }
                        } catch (e) {
                            const fallbackRes = await teamAPI.getTeamLeaveRequests(user.employeeId);
                            const fd = fallbackRes?.data || fallbackRes;
                            leaveList = Array.isArray(fd) ? fd : (fd?.content || []);
                        }
                    }

                    const approved = leaveList.filter(r => ['APPROVED', 'ACCEPTED'].includes((r.status || '').toUpperCase()));
                    const leavesTodayAndUpcoming = approved
                        .map((r, i) => {
                            const s = parseDateObj(r.startDate || r.date || r.from);
                            const e = parseDateObj(r.endDate || r.date || r.to) || s;
                            if (s) s.setHours(0, 0, 0, 0);
                            if (e) e.setHours(0, 0, 0, 0);
                            if (!s && !e) return null;
                            const effectiveEnd = e || s;
                            // Keep today or upcoming
                            if (effectiveEnd < todayDate) return null;

                            const name = r.employeeName || [r.firstName, r.lastName].filter(Boolean).join(' ') || r.employeeId || 'Employee';
                            const leaveType = r.leaveTypeName || r.leaveType || 'Leave';
                            const isRemote = isWfhCode(leaveType) || String(leaveType).toLowerCase().includes('remote');
                            let label = 'Work From Home';
                            if (!isRemote) {
                                const formatted = formatLeaveTypeLabel(leaveType);
                                const rawUpper = String(leaveType).toUpperCase();
                                if (formatted.toLowerCase().includes('leave')) {
                                    label = formatted;
                                } else if (['AL', 'SL', 'CL', 'PL', 'EL', 'ML'].includes(rawUpper)) {
                                    label = `Leave (${rawUpper})`;
                                } else {
                                    label = `${formatted} Leave`;
                                }
                            }
                            const dateInfo = formatCardDates(s, e, todayDate);

                            return {
                                name,
                                role: label,
                                avatar: r.profilePhoto || null,
                                employeeId: r.employeeId || null,
                                blobColor: getBlobColor(i, leaveType),
                                startDate: s,
                                endDate: e,
                                dateText: dateInfo.label,
                                isToday: dateInfo.isToday,
                                isUpcoming: dateInfo.isUpcoming,
                                type: isRemote ? 'WFH' : 'LEAVE'
                            };
                        })
                        .filter(Boolean);

                    let wfhList = [];
                    try {
                        // For WFH history and upcoming:
                        const wfhRes = (isOrgView || isAdminUser) ? await wfhAPI.getAccepted() : (user?.employeeId ? await wfhAPI.getManagerHistory() : []);
                        const wd = wfhRes?.data || wfhRes;
                        wfhList = Array.isArray(wd) ? wd : (wd?.requests || wd?.content || []);
                        
                        if (wfhList.length === 0 && user?.employeeId) {
                            const altWfh = await wfhAPI.getTeamOut(todayStr);
                            const ad = altWfh?.data || altWfh;
                            wfhList = Array.isArray(ad) ? ad : (ad?.requests || ad?.content || []);
                        }
                    } catch (e) {
                        const fb = user?.employeeId ? await wfhAPI.getManagerHistory() : [];
                        const fbd = fb?.data || fb;
                        wfhList = Array.isArray(fbd) ? fbd : (fbd?.content || fbd?.requests || []);
                    }

                    const wfhTodayAndUpcoming = wfhList
                        .filter(w => ['APPROVED', 'ACCEPTED'].includes((w.status || '').toUpperCase()))
                        .map((w, i) => {
                            const s = parseDateObj(w.startDate || w.date || w.wfhDate || w.from);
                            const e = parseDateObj(w.endDate || w.date || w.wfhDate || w.to) || s;
                            if (s) s.setHours(0, 0, 0, 0);
                            if (e) e.setHours(0, 0, 0, 0);
                            if (!s && !e) return null;
                            const effectiveEnd = e || s;
                            // Keep today or upcoming
                            if (effectiveEnd < todayDate) return null;

                            const dateInfo = formatCardDates(s, e, todayDate);
                            return {
                                name: w.employeeName || w.employeeCode || w.employeeId || 'Employee',
                                role: 'Work From Home',
                                avatar: null,
                                employeeId: w.employeeCode || w.employeeId || null,
                                blobColor: getBlobColor(leavesTodayAndUpcoming.length + i, 'wfh'),
                                startDate: s,
                                endDate: e,
                                dateText: dateInfo.label,
                                isToday: dateInfo.isToday,
                                isUpcoming: dateInfo.isUpcoming,
                                type: 'WFH'
                            };
                        })
                        .filter(Boolean);

                    // Combine and sort chronologically (earliest startDate first)
                    outList = [...leavesTodayAndUpcoming, ...wfhTodayAndUpcoming].sort((a, b) => {
                        const aTime = a.startDate ? a.startDate.getTime() : 0;
                        const bTime = b.startDate ? b.startDate.getTime() : 0;
                        return aTime - bTime;
                    });
                    
                } catch (e) {
                    console.error("Error fetching outToday:", e);
                    outList = [];
                }
                return outList;
            })();

            const [
                members,
                attendanceData,
                myTeamLeaves,
                limits,
                myPendingWfh,
                myPendingExpenses,
                myPendingExit,
                outToday
            ] = await Promise.all([
                membersPromise,
                attendancePromise,
                leavesPromise,
                limitsPromise,
                wfhPromise,
                expensesPromise,
                exitPromise,
                outTodayPromise
            ]);

            setTeamMembers(members);
            setCache('teamMembers', members);

            setPendingLeaves(myTeamLeaves);
            setCache('pendingLeaves', myTeamLeaves);

            setManagerLimits(limits);

            setPendingWfh(myPendingWfh);
            setCache('pendingWfh', myPendingWfh);

            setPendingExpenses(myPendingExpenses);
            setCache('pendingExpenses', myPendingExpenses);

            setPendingExitRequests(myPendingExit);
            setCache('pendingExitRequests', myPendingExit);

            setWhosOutToday(outToday);
            setCache('whosOutToday', outToday);

            // Process and merge attendance data
            let processedAttendance = [];

            const normalizeAttendanceRecord = (att, member = {}) => {
                const firstName = att.firstName || member.firstName || '';
                const lastName = att.lastName || member.lastName || '';
                const employeeName = att.employeeName
                    || member.fullName
                    || member.name
                    || (firstName && lastName ? `${firstName} ${lastName}` : null)
                    || firstName
                    || lastName
                    || 'Employee';
                const clockIn = resolveAttendanceClockTime(att, 'in');
                const clockOut = resolveAttendanceClockTime(att, 'out');
                return {
                    ...member,
                    ...att,
                    employeeId: att.employeeId || member.employeeId || member.employeeIdString || '',
                    employeeIdString: att.employeeIdString || member.employeeIdString || att.employeeId || member.employeeId || '',
                    employeeName,
                    firstName: firstName || employeeName.split(' ')[0] || '',
                    lastName: lastName || employeeName.split(' ').slice(1).join(' ') || '',
                    status: att.status || member.status || 'ABSENT',
                    remark: att.remark || att.statusReason || member.remark || '',
                    clockInTime: clockIn,
                    clockOutTime: clockOut,
                    totalHours: att.totalHours || att.workHours || att.total_hours || member.totalHours || '--',
                    workHours: att.totalHours || att.workHours || att.total_hours || member.workHours || '--',
                };
            };

            // Manager team view: team-attendance API already returns clock times per member
            if (!isOrgView && attendanceData.length > 0) {
                processedAttendance = attendanceData.map((att) => normalizeAttendanceRecord(att));
            } else if (members.length > 0) {
                // Initialise all members as ABSENT
                processedAttendance = members.map(m => ({
                    ...m,
                    employeeName: m.fullName || m.name || (m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : null) || m.firstName || m.lastName || 'Employee',
                    employeeId: m.employeeId || m.employeeIdString || '',
                    employeeIdString: m.employeeIdString || m.employeeId || '',
                    status: 'ABSENT',
                    clockInTime: '--:--',
                    clockOutTime: '--:--',
                    totalHours: '--',
                    workHours: '--',
                }));

                // Update with actual attendance data if available
                if (attendanceData && attendanceData.length > 0) {
                    attendanceData.forEach(att => {
                        const attEmpId = resolveAttendanceEmployeeCode(att);
                        if (!attEmpId) return;

                        const index = processedAttendance.findIndex(p => resolveAttendanceEmployeeCode(p) === attEmpId);

                        if (index !== -1) {
                            processedAttendance[index] = normalizeAttendanceRecord(att, processedAttendance[index]);
                        } else if (isOrgView) {
                            processedAttendance.push(normalizeAttendanceRecord(att));
                        }
                    });
                }
            } else if (attendanceData && attendanceData.length > 0) {
                processedAttendance = attendanceData.map((att) => normalizeAttendanceRecord(att));
            }

            setTeamAttendance(processedAttendance);
            setCache('teamAttendance', processedAttendance);

            const attendanceArray = processedAttendance;
            const presentCount = attendanceArray.filter(a => {
                const st = String(a.status || '').toUpperCase();
                const loc = String(a.workLocation || '').toUpperCase();
                return st === 'PRESENT' || st === 'WFH' || loc === 'WORK_FROM_HOME' || loc === 'FROM_HOME' || loc === 'WFH' || Boolean(a.isWfh);
            }).length;
            const leaveCount = attendanceArray.filter(a => {
                const st = String(a.status || '').toUpperCase();
                return st === 'ON_LEAVE' || st === 'LEAVE';
            }).length;
            const lateCount = attendanceArray.filter(a => {
                const st = String(a.status || '').toUpperCase();
                return st === 'LATE';
            }).length;

            // Prefer member roster size; fall back to attendance rows so UI never shows "9 of 0"
            const totalTeamCount = Math.max(
                Array.isArray(members) ? members.length : 0,
                attendanceArray.length,
                presentCount + leaveCount
            );

            const s = {
                totalTeam: totalTeamCount,
                presentToday: presentCount,
                onLeave: leaveCount,
                lateArrivals: lateCount
            };
            setStats(s);
            setCache('stats', s);

        } catch (error) {
            // Fallback/Mock data if API fails or is empty for demo
            setStats({
                totalTeam: 0,
                presentToday: 0,
                onLeave: 0,
                lateArrivals: 0
            });
            setTeamMembers([]);
            setTeamAttendance([]);
            setPendingLeaves([]);
            setPendingWfh([]);
            setPendingExpenses([]);
        } finally {
            isFetchingTeamData.current = false;
            // Always set loading to false, even if there was an error
            setLoading(false);
        }
    };

    const handleExitResponse = async (id, action, comments = '') => {
        try {
            setSubmittingAction({ id, action });
            if (action === 'APPROVE') {
                await exitAPI.approveExitRequest(id, { action: 'APPROVE', comments: comments || 'Approved by Manager' });
                toast.success('Exit request approved');
            } else {
                await exitAPI.rejectExitRequest(id, { action: 'REJECT', comments: comments || 'Rejected by Manager' });
                toast.success('Exit request rejected');
            }
            setShowExitModal(false);
            // Refresh list
            let list = [];
            try {
                const res = isOrgView
                    ? await exitAPI.getAllExitRequests()
                    : await exitAPI.getTeamExitRequests();
                list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            } catch (fetchErr) {
                console.warn('Failed to refresh exit requests', fetchErr);
            }
            setPendingExitRequests(list.filter(e => String(e.status || '').toUpperCase() === 'PENDING'));
        } catch (err) {
            toast.error(err.response?.data?.message || 'Action failed');
        } finally {
            setSubmittingAction({ id: null, action: null });
        }
    };

    const handleLeaveResponse = async (leaveId, status, comment = '') => {
        try {
            setSubmittingAction({ id: leaveId, action: status });
            const isAdminUser = hasAdminAccess && hasAdminAccess();
            // ... (rest of the logic)
            const currentUser = getCurrentUser();
            const isHR = (() => {
                if (!currentUser) return false;
                if (currentUser.roles && Array.isArray(currentUser.roles)) {
                    return currentUser.roles.some(role => ['HR', 'CEO'].includes(String(role).trim().toUpperCase()));
                }
                let roleValue = currentUser.employeeRoleName || '';
                if (!roleValue && currentUser.role) {
                    if (typeof currentUser.role === 'string') roleValue = currentUser.role;
                    else if (currentUser.role.name) roleValue = currentUser.role.name;
                }
                return ['HR', 'CEO'].includes(String(roleValue).trim().toUpperCase());
            })();

            const approverName = (user?.firstName && user?.lastName)
                ? `${user.firstName} ${user.lastName}`
                : user?.fullName || user?.name || user?.employeeId || (isHR ? 'HR Employee' : (isAdminUser ? 'Admin' : 'Manager'));

            const roleLabel = isHR ? 'HR' : (isAdminUser ? 'Admin' : 'Manager');
            const responseMessage = comment || `${status} by ${approverName} (${roleLabel})`;

            if (status === 'DIRECT_TO_HR' || status === 'FORWARD_TO_HR') {
                await teamAPI.directLeaveRequestToHr(leaveId, user?.id, responseMessage);
                toast.success('Leave request redirected to HR successfully');
                fetchTeamData();
                return;
            }

            if (isAdminUser) {
                if (status === 'APPROVED') await teamAPI.approveAdminLeaveRequest(leaveId, responseMessage);
                else if (status === 'REJECTED') await teamAPI.rejectAdminLeaveRequest(leaveId, responseMessage);
                else await respondToLeaveRequest(leaveId, { status, response: responseMessage });
            } else {
                if (status === 'APPROVED') await teamAPI.approveLeaveRequest(leaveId, user?.id, responseMessage);
                else if (status === 'REJECTED') await teamAPI.rejectLeaveRequest(leaveId, user?.id, responseMessage);
                else await respondToLeaveRequest(leaveId, { status, response: responseMessage });
            }
            toast.success(`Leave request ${status.toLowerCase()}`);
            fetchTeamData();
        } catch (error) {
            toast.error(`Failed to ${status === 'DIRECT_TO_HR' ? 'redirect to HR' : status.toLowerCase()} leave: ${error.response?.data?.message || error.message}`);
        } finally {
            setSubmittingAction({ id: null, action: null });
        }
    };

    // Helper formatting functions for expenses
    const formatAmount = (amount, currency = 'INR') => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency || 'INR',
        }).format(amount || 0);
    };

    const formatShortDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };



    const handleExpenseReject = async () => {
        if (!expenseToAction || !expenseRejectReason.trim()) return;
        try {
            setSubmittingAction({ id: expenseToAction.id, action: 'REJECTED' });
            if (isAdminUser) {
                await adminAPI.rejectExpense(expenseToAction.id, expenseRejectReason.trim());
            } else {
                await teamAPI.rejectTeamExpense(expenseToAction.id, expenseRejectReason.trim());
            }
            toast.success('Expense rejected');
            setShowExpenseRejectModal(false);
            setExpenseRejectReason('');
            setExpenseToAction(null);
            fetchTeamData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to reject expense');
        } finally {
            setSubmittingAction({ id: null, action: null });
        }
    };

    const handleExpenseApprove = async (id) => {
        try {
            setSubmittingAction({ id, action: 'APPROVED' });
            if (isAdminUser) {
                await adminAPI.approveExpense(id);
            } else {
                await teamAPI.approveTeamExpense(id);
            }
            toast.success('Expense approved');
            fetchTeamData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to approve expense');
        } finally {
            setSubmittingAction({ id: null, action: null });
        }
    };

    const handleWfhResponse = async (wfhId, status, comment = '') => {
        try {
            setSubmittingAction({ id: wfhId, action: status });
            const responseMessage = comment || (status === 'APPROVED' ? 'Approved by manager' : 'Rejected by manager');
            await wfhAPI.respond(wfhId, { status, response: responseMessage });
            toast.success(`WFH request ${status.toLowerCase()}`);
            fetchTeamData();
        } catch (error) {
            toast.error(`Failed to ${status.toLowerCase()} WFH: ${error.response?.data?.message || error.message}`);
        } finally {
            setSubmittingAction({ id: null, action: null });
        }
    };

    const handleDecisionConfirm = async () => {
        if (!activeRequest) return;
        
        if (decisionAction === 'REJECT' && !decisionComment.trim()) {
            toast.error("Please provide a reason for rejection.");
            return;
        }

        const req = activeRequest;
        const id = req.id;
        const comment = decisionComment.trim();

        try {
            if (decisionAction === 'DIRECT_TO_HR') {
                if (req.reqType === 'LEAVE') await handleLeaveResponse(id, 'DIRECT_TO_HR', comment || 'Forwarded directly to HR by manager');
            } else if (decisionAction === 'APPROVE') {
                if (req.reqType === 'LEAVE') await handleLeaveResponse(id, 'APPROVED', comment);
                else if (req.reqType === 'WFH') await handleWfhResponse(id, 'APPROVED', comment);
                else if (req.reqType === 'EXPENSE') await handleExpenseApprove(id);
                else if (req.reqType === 'EXIT') await handleExitResponse(id, 'APPROVE', comment);
            } else {
                if (req.reqType === 'LEAVE') await handleLeaveResponse(id, 'REJECTED', comment);
                else if (req.reqType === 'WFH') await handleWfhResponse(id, 'REJECTED', comment);
                else if (req.reqType === 'EXPENSE') {
                    setSubmittingAction({ id: req.id, action: 'REJECTED' });
                    if (isAdminUser) {
                        await adminAPI.rejectExpense(req.id, comment);
                    } else {
                        await teamAPI.rejectTeamExpense(req.id, comment);
                    }
                    toast.success('Expense rejected');
                    fetchTeamData();
                }
                else if (req.reqType === 'EXIT') await handleExitResponse(id, 'REJECT', comment);
            }
        } catch (err) {
            console.error("Action failed", err);
        } finally {
            setShowDecisionModal(false);
            setActiveRequest(null);
            setDecisionComment('');
            setSubmittingAction({ id: null, action: null });
            // Close any open detail modals
            setShowLeaveDetailModal(false);
            setShowWfhDetailModal(false);
            setExpenseDetail(null);
            setShowExitModal(false);
        }
    };

    const fetchPendingTimesheets = async () => {
        if (isFetchingPendingTimesheets) return;

        const isAdminUser = hasAdminAccess && hasAdminAccess();

        // Allow proceeding if user is logged in
        if (!isAdminUser && !user) {
            setTimesheetLoading(false);
            return;
        }

        isFetchingPendingTimesheets = true;
        // Only show spinner if we have no cached data to show
        if (allTeamTimesheets.length === 0) {
            setTimesheetLoading(true);
        }
        try {
            // ALWAYS fetch reportees (direct subordinates) first to ensure we have the latest list
            let teamMembersList = [];
            try {
                // For all users, fetch their direct subordinates (reportees) if employee ID is available
                const empIdToUse = user?.employeeId || user?.id || user?.employeeIdString || user?.username;
                if (empIdToUse) {
                    const subordinatesRes = await reportingAPI.getSubordinates(empIdToUse);
                    const members = subordinatesRes.data || [];
                    teamMembersList = Array.isArray(members) ? members : [];
                }
            } catch (err) {
                // Fallback to cached team members if fetch fails
                teamMembersList = teamMembers.length > 0 ? teamMembers : [];
            }

            let adminPendingTimesheets = [];
            // For admins on org view: Use dedicated backend API to get pending timesheets
            if (isOrgView) {
                try {
                    // Debug: Check if method exists
                    if (!adminAPI.getAdminPendingTimesheets) {
                        throw new Error('getAdminPendingTimesheets method not found');
                    }
                    // Use the new admin pending timesheets endpoint
                    const pendingRes = await adminAPI.getAdminPendingTimesheets();
                    // Handle different response structures
                    if (Array.isArray(pendingRes)) {
                        adminPendingTimesheets = pendingRes;
                    } else if (pendingRes && Array.isArray(pendingRes.data)) {
                        adminPendingTimesheets = pendingRes.data;
                    } else if (pendingRes?.data && Array.isArray(pendingRes.data.data)) {
                        adminPendingTimesheets = pendingRes.data.data;
                    }
                } catch (adminErr) {
                    // Fall through to regular manager flow as fallback
                }
            }

            // For regular managers (or HR on team view): Continue with existing logic
            if (!isOrgView) {
                try {
                    // Get unassigned employees (no reporting manager)
                    const unassignedRes = await teamAPI.getAdminTeamOverview();
                    let unassignedEmployees = [];

                    // Try multiple possible response structures
                    if (unassignedRes.data) {
                        if (unassignedRes.data.items && Array.isArray(unassignedRes.data.items)) {
                            unassignedEmployees = unassignedRes.data.items;
                        } else if (unassignedRes.data.data && Array.isArray(unassignedRes.data.data)) {
                            unassignedEmployees = unassignedRes.data.data;
                        } else if (Array.isArray(unassignedRes.data)) {
                            unassignedEmployees = unassignedRes.data;
                        } else if (unassignedRes.data.employees && Array.isArray(unassignedRes.data.employees)) {
                            unassignedEmployees = unassignedRes.data.employees;
                        }
                    }

                    // Combine: reportees + unassigned employees
                    const existingIds = new Set(teamMembersList.map(m => {
                        const id = m.employeeId || m.id || m.employeeIdString;
                        return id ? String(id) : null;
                    }).filter(Boolean));

                    // Add unassigned employees
                    const additionalUnassigned = unassignedEmployees.filter(emp => {
                        const empId = emp.employeeId || emp.id || emp.employeeIdString || emp.employee_id;
                        const empIdStr = empId ? String(empId) : null;
                        return empIdStr && !existingIds.has(empIdStr);
                    });

                    teamMembersList = [...teamMembersList, ...additionalUnassigned];
                } catch (err) {
                }
            }

            // Fetch timesheets for multiple weeks (last 8 weeks) to catch all pending submissions
            // This ensures we get all SUBMITTED timesheets, not just the current week
            const today = new Date();
            const allTimesheets = [...adminPendingTimesheets];

            // Helper function to get week start date
            const getWeekStart = (date) => {
                const d = new Date(date);
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                const ws = new Date(d.getFullYear(), d.getMonth(), diff);
                const yyyy = ws.getFullYear();
                const mm = String(ws.getMonth() + 1).padStart(2, '0');
                const dd = String(ws.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            };

            // Decide which weeks to fetch: individual selected week or all weeks in selected month if "All" is chosen
            let startDate = null;
            let endDate = null;
            let targetWeek = null;

            if (timesheetWeekFilter) {
                targetWeek = timesheetWeekFilter;
            } else {
                // Fetch all weeks in the selected month
                const [year, month] = timesheetMonthFilter.split('-');
                const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                // Start of month
                startDate = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-01`;
                // End of month
                const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
                endDate = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
            }
            
            try {
                // For admins on org view: Use admin-specific endpoint which returns ALL timesheets
                // For managers/HR on team view: Use manager endpoint which returns team timesheets
                const response = isOrgView
                    ? await teamAPI.getAdminTeamTimesheets(targetWeek, startDate, endDate)
                    : await teamAPI.getTeamTimesheets(targetWeek, startDate, endDate);

                if (response) {
                    let fetchedTimesheets = [];
                    if (response.data && Array.isArray(response.data)) {
                        fetchedTimesheets = response.data;
                    } else if (response.data?.timesheets && Array.isArray(response.data.timesheets)) {
                        fetchedTimesheets = response.data.timesheets;
                    } else if (response.data?.data && Array.isArray(response.data.data)) {
                        fetchedTimesheets = response.data.data;
                    }
                    allTimesheets.push(...fetchedTimesheets);
                }
            } catch (err) {
                // Fallback to unified endpoint if specific endpoint fails
                try {
                    const fallbackParams = targetWeek ? { week: targetWeek } : { startDate, endDate };
                    const fallbackResponse = await api.get('/timesheets', { params: fallbackParams });
                    let fetchedTimesheets = [];
                    if (fallbackResponse.data && Array.isArray(fallbackResponse.data)) {
                        fetchedTimesheets = fallbackResponse.data;
                    } else if (fallbackResponse.data?.timesheets && Array.isArray(fallbackResponse.data.timesheets)) {
                        fetchedTimesheets = fallbackResponse.data.timesheets;
                    } else if (fallbackResponse.data?.data && Array.isArray(fallbackResponse.data.data)) {
                        fetchedTimesheets = fallbackResponse.data.data;
                    }
                    allTimesheets.push(...fetchedTimesheets);
                } catch (fallbackErr) {
                    console.error("Failed to fetch timesheets with fallback:", fallbackErr);
                }
            }

            // Remove duplicates based on timesheet ID
            const uniqueTimesheets = [];
            const seenIds = new Set();
            for (const ts of allTimesheets) {
                if (ts.id && !seenIds.has(ts.id)) {
                    seenIds.add(ts.id);
                    uniqueTimesheets.push(ts);
                }
            }

            const timesheets = uniqueTimesheets;


            // Get team member IDs - Check ALL possible fields where employee ID might be stored
            let teamMemberIds = [];

            // For admins on org view: Build list of employee IDs that are HR or unassigned
            // For managers/HR on team view: Use their direct reportees
            if (isOrgView) {
                // Extract employee IDs from unassigned employees (includes HR)
                teamMemberIds = teamMembersList.flatMap(m => {
                    const ids = [];

                    // Extract numeric ID (check multiple possible fields)
                    const numericId = m.employeeId || m.id || m.employee?.employeeId || m.employee?.id || m.employeeIdNumber;
                    if (numericId) {
                        const normalized = String(numericId).trim();
                        ids.push(normalized);
                    }

                    // Extract string ID (check multiple possible fields)
                    const stringId = m.employeeIdString || m.employee?.employeeIdString || m.username || m.employeeId || m.employee?.employeeId;
                    if (stringId) {
                        const normalized = String(stringId).trim().toUpperCase();
                        ids.push(normalized);
                    }

                    // Also check for employeeId in the root if it's a string
                    if (m.employeeId && typeof m.employeeId === 'string' && !ids.includes(m.employeeId.toUpperCase())) {
                        ids.push(m.employeeId.trim().toUpperCase());
                    }

                    return ids;
                }).filter(Boolean);

            } else {
                // For managers: Extract employee IDs from all possible fields (both numeric and string)
                teamMemberIds = teamMembersList.flatMap(m => {
                    const ids = [];

                    // Extract numeric ID (check multiple possible fields)
                    const numericId = m.employeeId || m.id || m.employee?.employeeId || m.employee?.id || m.employeeIdNumber;
                    if (numericId) {
                        const normalized = String(numericId).trim();
                        ids.push(normalized);
                    }

                    // Extract string ID (check multiple possible fields)
                    const stringId = m.employeeIdString || m.employee?.employeeIdString || m.username || m.employeeId || m.employee?.employeeId;
                    if (stringId) {
                        const normalized = String(stringId).trim().toUpperCase();
                        ids.push(normalized);
                    }

                    // Also check for employeeId in the root if it's a string
                    if (m.employeeId && typeof m.employeeId === 'string' && !ids.includes(m.employeeId.toUpperCase())) {
                        ids.push(m.employeeId.trim().toUpperCase());
                    }


                    return ids;
                }).filter(Boolean);

            }

            // Filter only SUBMITTED timesheets (pending approval)
            // For all users (managers, admins, HRs): exclude their own timesheet and only include timesheets from direct reportees
            const managerEmployeeId = user?.employeeId || user?.id;
            const managerEmployeeIdString = user?.employeeIdString || user?.username;

            // Normalize both numeric and string IDs for comparison
            const managerIdNormalized = managerEmployeeId ? String(managerEmployeeId).trim() : '';
            const managerIdStringNormalized = managerEmployeeIdString ? String(managerEmployeeIdString).trim().toUpperCase() : '';


            const filteredTimesheets = timesheets.filter(ts => {
                // Get timesheet employee ID from various possible fields
                const timesheetEmployeeId = ts.employeeId || ts.employee?.employeeId || ts.employee?.id;
                const timesheetEmployeeIdString = ts.employeeIdString || ts.employee?.employeeIdString || ts.employee?.username;

                if (!timesheetEmployeeId && !timesheetEmployeeIdString) {
                    return false;
                }

                // Normalize both numeric and string IDs
                const timesheetIdNormalized = timesheetEmployeeId ? String(timesheetEmployeeId).trim() : '';
                const timesheetIdStringNormalized = timesheetEmployeeIdString ? String(timesheetEmployeeIdString).trim().toUpperCase() : '';

                // CRITICAL: Always exclude user's own timesheet (for all users: managers, admins, HRs)
                const isOwnTimesheet =
                    (managerIdNormalized && timesheetIdNormalized && timesheetIdNormalized === managerIdNormalized) ||
                    (managerIdStringNormalized && timesheetIdStringNormalized && timesheetIdStringNormalized === managerIdStringNormalized) ||
                    (managerIdNormalized && timesheetIdStringNormalized && timesheetIdStringNormalized === managerIdNormalized) ||
                    (managerIdStringNormalized && timesheetIdNormalized && timesheetIdNormalized === managerIdStringNormalized);

                if (isOwnTimesheet) {
                    return false;
                }

                if (isOrgView) {
                    return true;
                }

                // If teamMemberIds were successfully retrieved, check if timesheet belongs to reportee
                if (teamMemberIds.length > 0) {
                    const isReportee =
                        (timesheetIdNormalized && teamMemberIds.some(tmId => String(tmId).trim() === timesheetIdNormalized)) ||
                        (timesheetIdStringNormalized && teamMemberIds.some(tmId => String(tmId).trim().toUpperCase() === timesheetIdStringNormalized)) ||
                        (timesheetIdNormalized && teamMemberIds.some(tmId => {
                            const tmIdStr = String(tmId).trim();
                            return tmIdStr === timesheetIdNormalized || tmIdStr.toUpperCase() === timesheetIdNormalized;
                        })) ||
                        (timesheetIdStringNormalized && teamMemberIds.some(tmId => {
                            const tmIdStr = String(tmId).trim().toUpperCase();
                            return tmIdStr === timesheetIdStringNormalized;
                        }));

                    if (isReportee) return true;
                }

                // The /api/manager/timesheets backend endpoint already filters by logged-in manager's team
                return true;
            });

            setAllTeamTimesheets(filteredTimesheets);

            // Final safety check: Include SUBMITTED/DRAFT and APPROVED timesheets with pending entries
            const finalPending = filteredTimesheets.filter(ts => {
                const status = ts.status ? String(ts.status).trim().toUpperCase() : '';

                // APPROVED timesheets with pending (unapproved/unrejected) entries should appear as pending
                if (status === 'APPROVED') {
                    const tsEntries = ts.entries || [];
                    const hasPending = tsEntries.some(e => (e.status || 'SUBMITTED') === 'SUBMITTED' || e.status === 'PENDING');
                    return hasPending;
                }

                // SUBMITTED or PENDING status
                if (status === 'SUBMITTED' || status === 'PENDING') {
                    return true;
                }

                return false;
            });


            setPendingTimesheets(finalPending);
            setCache('allTeamTimesheets', filteredTimesheets);
            setCache('pendingTimesheets', finalPending);
        } catch (error) {
            toast.error('Failed to fetch timesheets');
            setPendingTimesheets([]);
        } finally {
            isFetchingPendingTimesheets = false;
            setTimesheetLoading(false);
        }
    };

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

    const handleTimesheetApprove = async (timesheetId) => {
        try {
            setSubmittingAction({ id: timesheetId, action: 'APPROVE' });
            const isAdminUser = hasAdminAccess && hasAdminAccess();
            // Get manager/admin's name from user object
            const managerName = user?.fullName ||
                user?.name ||
                `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
                user?.username ||
                (isAdminUser ? 'Admin' : 'Manager');

            // Get current date and time
            const approvedAt = new Date().toISOString();

            // Use dedicated API for timesheet approval (admin or manager)
            const approvalRequest = {
                comment: `Approved by ${managerName}`,
                approvedByName: managerName,
                approvedAt: approvedAt
            };

            if (isAdminUser) {
                await teamAPI.approveAdminTimesheet(timesheetId, approvalRequest);
            } else {
                await teamAPI.approveTimesheet(timesheetId, approvalRequest);
            }
            toast.success('Timesheet approved successfully');
            fetchPendingTimesheets();
        } catch (error) {
            toast.error(`Failed to approve timesheet: ${error.response?.data?.error || error.response?.data?.message || error.message}`);
        } finally {
            setSubmittingAction({ id: null, action: null });
        }
    };

    const handleEntryApprove = async (entryId, timesheetId) => {
        try {
            const isAdminUser = hasAdminAccess && hasAdminAccess();
            // Get manager/admin's name from user object
            const managerName = user?.fullName ||
                user?.name ||
                `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
                user?.username ||
                (isAdminUser ? 'Admin' : 'Manager');

            // Use dedicated API for entry approval (admin or manager)
            const approvalRequest = {
                comment: `Entry approved by ${managerName}`
            };

            if (isAdminUser) {
                await teamAPI.approveAdminTimesheetEntry(timesheetId, entryId, approvalRequest);
            } else {
                await teamAPI.approveTimesheetEntry(timesheetId, entryId, approvalRequest);
            }
            toast.success('Entry approved successfully');
            fetchPendingTimesheets();
        } catch (error) {
            toast.error(`Failed to approve entry: ${error.response?.data?.error || error.response?.data?.message || error.message}`);
        }
    };

    const openEntryRejectModal = (entry, timesheet) => {
        setEntryToAction(entry);
        setTimesheetToAction(timesheet);
        setRejectionReason('');
        setShowEntryRejectModal(true);
    };

    const handleEntryReject = async () => {
        if (!entryToAction || !rejectionReason.trim()) {
            toast.error('Please provide a rejection reason');
            return;
        }
        try {
            setSubmittingAction({ id: entryToAction.id, action: 'REJECT' });
            const isAdminUser = hasAdminAccess && hasAdminAccess();
            // Get manager/admin's name from user object
            const managerName = user?.fullName ||
                user?.name ||
                `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
                user?.username ||
                (isAdminUser ? 'Admin' : 'Manager');

            // Use dedicated API for entry rejection (admin or manager)
            const rejectionRequest = {
                comment: `Entry rejected by ${managerName}`,
                rejectionReason: rejectionReason || ''
            };

            if (isAdminUser) {
                await teamAPI.rejectAdminTimesheetEntry(timesheetToAction?.id, entryToAction.id, rejectionRequest);
            } else {
                await teamAPI.rejectTimesheetEntry(timesheetToAction?.id, entryToAction.id, rejectionRequest);
            }
            toast.success('Entry rejected');
            setShowEntryRejectModal(false);
            setRejectionReason('');
            setEntryToAction(null);
            setTimesheetToAction(null);
            fetchPendingTimesheets();
        } catch (error) {
            toast.error(`Failed to reject entry: ${error.response?.data?.error || error.message}`);
        } finally {
            setSubmittingAction({ id: null, action: null });
        }
    };

    const handleTimesheetReject = async () => {
        if (!timesheetToAction || !rejectionReason.trim()) {
            toast.error('Please provide a rejection reason');
            return;
        }
        try {
            const isAdminUser = hasAdminAccess && hasAdminAccess();
            // Get manager/admin's name from user object
            const managerName = user?.fullName ||
                user?.name ||
                `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
                user?.username ||
                (isAdminUser ? 'Admin' : 'Manager');

            // Get current date and time
            const rejectedAt = new Date().toISOString();

            // Use dedicated API for timesheet rejection (admin or manager)
            const rejectionRequest = {
                comment: `Rejected by ${managerName}`,
                rejectionReason: rejectionReason,
                rejectedByName: managerName,
                rejectedAt: rejectedAt
            };

            if (isAdminUser) {
                await teamAPI.rejectAdminTimesheet(timesheetToAction.id, rejectionRequest);
            } else {
                await teamAPI.rejectTimesheet(timesheetToAction.id, rejectionRequest);
            }
            toast.success('Timesheet rejected');
            setShowRejectModal(false);
            setRejectionReason('');
            setTimesheetToAction(null);
            fetchPendingTimesheets();
        } catch (error) {
            toast.error(`Failed to reject timesheet: ${error.response?.data?.error || error.message}`);
        }
    };

    const handleTimesheetHold = async () => {
        if (!timesheetToAction) return;
        // Hold is essentially adding a comment without changing status
        try {
            const isAdminUser = hasAdminAccess && hasAdminAccess();
            // Use dedicated API for holding timesheet (admin or manager)
            if (isAdminUser) {
                await teamAPI.holdAdminTimesheet(timesheetToAction.id, holdComment || 'Held for review');
            } else {
                await teamAPI.holdTimesheet(timesheetToAction.id, holdComment || 'Held for review');
            }
            toast.success('Timesheet held for review');
            setShowHoldModal(false);
            setHoldComment('');
            setTimesheetToAction(null);
            fetchPendingTimesheets();
        } catch (error) {
            toast.error(`Failed to hold timesheet: ${error.response?.data?.error || error.response?.data?.message || error.message}`);
        }
    };

    const openRejectModal = (timesheet) => {
        setTimesheetToAction(timesheet);
        setRejectionReason('');
        setShowRejectModal(true);
    };

    const openHoldModal = (timesheet) => {
        setTimesheetToAction(timesheet);
        setHoldComment('');
        setShowHoldModal(true);
    };

    const portalTitle = isOrgView ? "My Org" : "My Team";
    const portalSubtitle = isOrgView ? "Organization Overview" : "Team Overview";

    if (loading) {
        return (
            <>
                <Header title={portalTitle} subtitle={portalSubtitle} />
                <div className="dashboard-container manager-portal-page" style={{ padding: '18px 24px 24px' }}>
                    {/* Tab Navigation Skeleton */}
                    <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '10px', marginBottom: '20px' }}>
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="nt-skeleton" style={{ flex: 1, height: '36px', borderRadius: '8px' }} />
                        ))}
                    </div>

                    {/* Main Content Card Skeleton */}
                    <div className="card mp-card-inset" style={{ padding: '20px', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', background: '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9', marginBottom: '20px' }}>
                            <div>
                                <div className="nt-skeleton" style={{ width: '160px', height: '18px', marginBottom: '6px', borderRadius: '4px' }} />
                                <div className="nt-skeleton" style={{ width: '240px', height: '12px', borderRadius: '4px' }} />
                            </div>
                            <div className="nt-skeleton" style={{ width: '180px', height: '32px', borderRadius: '6px' }} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="nt-skeleton" style={{ height: '70px', borderRadius: '8px' }} />
                            ))}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="nt-skeleton" style={{ height: '54px', borderRadius: '8px' }} />
                            ))}
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Header title={portalTitle} subtitle={portalSubtitle} />

            <div className="dashboard-container manager-portal-page">
                <style>{`
                    ::-webkit-scrollbar { width: 6px; height: 6px; }
                    ::-webkit-scrollbar-track { background: #fff; }
                    ::-webkit-scrollbar-thumb { background: #eef0f4; border-radius: 10px; border: 1px solid #fff; }
                    ::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
                    * { scrollbar-width: thin; scrollbar-color: #eef0f4 #fff; }

                    .dashboard-tabs { display: flex; align-items: stretch; gap: 4px; background: #f1f5f9; padding: 4px; border-radius: 10px; margin-bottom: 12px; border: 1px solid rgba(0,0,0,0.05); }
                    .dashboard-tab { flex: 1; padding: 8px 12px; height: 36px; border-radius: 8px; border: none; background: transparent; font-size: 13px; font-weight: 600; color: #64748b; cursor: pointer; transition: all 0.2s; white-space: nowrap; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box; }
                    .dashboard-tab.active { background: #fff; color: #0f1117; box-shadow: 0 2px 6px rgba(0,0,0,0.06); }
                    .dashboard-tab:hover:not(.active) { background: rgba(255,255,255,0.5); color: #334155; }

                    .manager-portal-page {
                        padding: 20px 24px;
                        min-width: 0;
                        max-width: 100%;
                        box-sizing: border-box;
                    }
                    .mp-tabs {
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        background: #f1f5f9;
                        padding: 4px;
                        border-radius: 10px;
                        margin-bottom: 12px; /* reduced from 20px */
                        border: 1px solid rgba(0,0,0,0.05);
                        width: 100%;
                        min-width: 0;
                        height: 44px; /* Standardize tab height footprint */
                        box-sizing: border-box;
                        flex-wrap: nowrap;
                        overflow-x: auto;
                        -webkit-overflow-scrolling: touch;
                        scrollbar-width: none;
                        overscroll-behavior-x: contain;
                    }
                    .mp-tabs::-webkit-scrollbar {
                        display: none;
                    }
                    .mp-tab {
                        flex: 0 0 auto;
                        min-width: max-content;
                        padding: 0 14px;
                        height: 36px;
                        border-radius: 8px;
                        border: none;
                        background: transparent;
                        font-size: 13px;
                        font-weight: 600;
                        color: #64748b;
                        cursor: pointer;
                        transition: all 0.2s;
                        white-space: nowrap;
                        text-align: center;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        gap: 6px;
                        box-sizing: border-box;
                    }
                    .mp-tab.active {
                        background: #fff;
                        color: #0f1117;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.06);
                    }
                    .mp-tab:hover:not(.active) { background: rgba(255,255,255,0.5); color: #334155; }
                    .mp-tab-badge {
                        background: var(--error-light);
                        color: var(--error);
                        padding: 2px 6px;
                        border-radius: 10px;
                        font-size: 10px;
                        font-weight: 700;
                        flex-shrink: 0;
                        line-height: 1.2;
                    }
                    .mp-tabs-hint {
                        display: none;
                        font-size: 11px;
                        color: #94a3b8;
                        text-align: center;
                        margin: -8px 0 10px;
                    }
                    .mp-section { padding: 0; }
                    .mp-section-wide { padding: 0; }
                    .mp-card-inset { margin: 0; }

                    @media (max-width: 1200px) {
                        .mp-tabs {
                            flex-wrap: nowrap;
                            overflow-x: auto;
                            -webkit-overflow-scrolling: touch;
                            scrollbar-width: none;
                            overscroll-behavior-x: contain;
                        }
                        .mp-tabs::-webkit-scrollbar { display: none; }
                        .mp-tab { flex: 0 0 auto; min-width: max-content; }
                        .mp-tabs-hint { display: block; }
                    }

                    @media (max-width: 768px) {
                        .manager-portal-page {
                            padding: 10px 10px 16px !important;
                        }
                        .mp-tabs { 
                            margin-bottom: 12px; 
                            gap: 4px;
                            padding: 3px;
                            border-radius: 8px;
                        }
                        .mp-tab { 
                            padding: 0 10px; 
                            font-size: 11px; 
                            height: 32px;
                            border-radius: 6px;
                        }
                        .mp-tab-badge {
                            padding: 1px 4px;
                            font-size: 9px;
                        }
                        .mp-section,
                        .mp-section-wide {
                            padding-left: 0 !important;
                            padding-right: 0 !important;
                        }
                        .mp-card-inset {
                            margin-left: 0 !important;
                            margin-right: 0 !important;
                            padding: 12px 14px !important;
                            border-radius: 8px !important;
                        }
                        .team-table-hd {
                            flex-direction: column;
                            align-items: stretch;
                            gap: 8px;
                        }
                        .team-srch-wrap {
                            width: 100%;
                            min-width: 0;
                        }
                        .team-srch-wrap input {
                            background: transparent;
                            background-color: transparent;
                            padding: 0;
                        }
                        .approvals-header {
                            flex-direction: column;
                            align-items: flex-start;
                            gap: 8px;
                        }
                        .ts-filters { padding-left: 0 !important; gap: 8px !important; flex-direction: column; align-items: stretch !important; }
                        .ts-card { margin-left: 0 !important; margin-right: 0 !important; }
                        .cards-grid,
                        .asset-grid,
                        .adj-grid {
                            grid-template-columns: 1fr !important;
                        }
                        .asset-metrics {
                            grid-template-columns: 1fr !important;
                        }
                        .adj-stats-grid {
                            grid-template-columns: repeat(2, 1fr) !important;
                        }
                        .ai-bar {
                            flex-direction: row !important;
                            align-items: flex-start !important;
                            gap: 8px !important;
                            padding: 10px 12px !important;
                        }
                        .att-card-hd {
                            flex-direction: column !important;
                            align-items: stretch !important;
                            gap: 8px !important;
                        }
                        .att-srch-box {
                            width: 100% !important;
                            box-sizing: border-box !important;
                        }
                        .clock-card {
                            padding: 12px 14px !important;
                        }
                        .clock-time {
                            font-size: 20px !important;
                        }
                        .clock-stats {
                            grid-template-columns: repeat(4, 1fr) !important;
                            gap: 4px !important;
                        }
                        .clock-stat {
                            padding: 6px 2px !important;
                        }
                        .clock-stat-val {
                            font-size: 12px !important;
                        }
                        .clock-stat-lbl {
                            font-size: 8px !important;
                        }
                    }

                    .ov-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; margin-top: 8px; }
                    @media (max-width: 1024px) { .ov-grid { grid-template-columns: repeat(2, 1fr); } }
                    @media (max-width: 640px) { .ov-grid { grid-template-columns: 1fr; } }
                    .ov-card { background: #fff; border: 1px solid rgba(0,0,0,0.06); border-radius: 10px; padding: 14px 16px; box-shadow: none; transition: all 0.2s; cursor: default; display: flex; flex-direction: column; gap: 6px; }
                    .ov-card:hover { transform: none; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
                    .ov-icon-box { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 2px; }
                    .ov-lbl { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
                    .ov-num { font-size: 24px; font-weight: 800; color: #0f1117; line-height: 1; }
                    .ov-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
                    
                    .team-table-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; margin-top: 14px; gap: 10px; }
                    .team-table-title { font-size: 14px; font-weight: 700; color: #0f1117; margin: 0; padding-left: 0; }
                    .team-srch-wrap { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; padding: 0 12px; width: 260px; height: 36px; box-sizing: border-box; box-shadow: none; }
                    .team-srch-wrap input { border: none; outline: none; font-size: 13px; color: #0f1117; width: 100%; height: 100%; }
                    
                    .u-av { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #fff; }
                    .emp-info-grid { display: flex; align-items: center; gap: 12px; }
                    .emp-nm { font-weight: 600; color: #0f1117; font-size: 13px; }
                    .emp-id-sub { font-size: 11px; color: #94a3b8; font-family: 'DM Mono', monospace; }
                    
                    .stat-badge { padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
                    .stat-badge-active { background: #f0fdf4; color: #166534; }
                    .stat-badge-inactive { background: #fef2f2; color: #991b1b; }

                    /* Attendance Specific Redesign */
                    .att-layout { display: grid; grid-template-columns: 1fr 300px; gap: 14px; margin-bottom: 14px; }
                    @media (max-width: 1200px) { .att-layout { grid-template-columns: 1fr; } }
                    
                    .ai-bar { background: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; display: flex; align-items: center; gap: 10px; }
                    .ai-dot { width: 8px; height: 8px; border-radius: 50%; background: #3b82f6; animation: pulse 2s infinite; }
                    .ai-text { font-size: 13px; color: #1e3a8a; line-height: 1.45; flex: 1; }
                    
                    .clock-card { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); border-radius: 10px; padding: 16px; color: #fff; box-shadow: none; position: relative; overflow: hidden; }
                    .clock-time { font-size: 28px; font-weight: 700; font-family: 'DM Mono', monospace; margin-bottom: 4px; }
                    .clock-date { font-size: 12px; opacity: 0.8; margin-bottom: 12px; }
                    .clock-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
                    .clock-stat { background: rgba(255,255,255,0.15); border-radius: 8px; padding: 8px 4px; text-align: center; }
                    .clock-stat-val { font-size: 14px; font-weight: 700; }
                    .clock-stat-lbl { font-size: 9px; text-transform: uppercase; opacity: 0.7; margin-top: 2px; }
                    
                    .presence-card { background: #fff; border: 1px solid rgba(0,0,0,0.06); border-radius: 10px; padding: 14px 16px; box-shadow: none; }
                    .presence-title { font-size: 13px; font-weight: 700; color: #0f1117; margin-bottom: 12px; }
                    
                    .att-table-v2 { width: 100%; border-collapse: collapse; }
                    .att-table-v2 th { background: #f8fafc; padding: 10px 14px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; text-align: left; border-bottom: 1px solid #f1f5f9; }
                    .att-table-v2 td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; font-size: 13px; }
                    .att-status-p { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 8px; }
                    .att-time { font-family: 'DM Mono', monospace; font-size: 12px; color: #334155; font-weight: 500; }
                    
                    .dur-wrapper { display: flex; flex-direction: column; gap: 4px; }
                    .dur-track { width: 60px; height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden; }
                    .dur-fill { height: 100%; border-radius: 2px; }
                    
                    .live-pill { display: flex; align-items: center; gap: 6px; background: #f0fdf4; color: #166534; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; }
                    .live-ping { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; animation: pulse 1.5s infinite; }
                    
                    /* Timesheet Approvals Redesign */
                    .ts-filters { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 4px; padding-left: 12px; }
                    .ts-chip { padding: 0 14px; height: 34px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #e2e8f0; background: #fff; color: #64748b; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; box-sizing: border-box; }
                    .ts-chip:hover { background: #f8fafc; color: #0f172a; }
                    .ts-chip.active { background: #1a4ff0; color: #fff; border-color: #1a4ff0; }
                    .ts-chip .tc { font-size: 10px; font-weight: 800; background: rgba(0,0,0,0.08); padding: 1px 6px; border-radius: 6px; }
                    .ts-chip.active .tc { background: rgba(255,255,255,0.22); }
                    
                    .ts-card { background: #fff; border: 1px solid #f1f5f9; border-radius: 10px; margin: 0 12px 14px 12px; box-shadow: none; transition: all 0.2s; border-left: 3px solid #e2e8f0; }
                    .ts-card:hover { transform: none; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border-color: #e2e8f0; }
                    .ts-card-body { display: grid; grid-template-columns: 200px 100px 120px 1fr; align-items: stretch; }
                    @media (max-width: 1200px) { .ts-card-body { grid-template-columns: 180px 90px 110px 1fr; } }
                    @media (max-width: 1024px) { 
                        .ts-card-body { grid-template-columns: 1fr 1fr; } 
                        .ts-card-body > div { border-bottom: 1px solid #f1f5f9; }
                        .ts-act-col { grid-column: span 2; border-bottom: none !important; }
                    }
                    
                    .ts-col { padding: 14px 16px; border-right: 1px solid #f1f5f9; display: flex; flex-direction: column; justify-content: center; }
                    .ts-act-col { padding: 12px 14px; border-right: none; }
                    .ts-col:last-child { border-right: none; }
                    
                    .ts-week-lbl { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
                    .ts-week-val { font-size: 13px; font-weight: 700; color: #0f172a; }
                    
                    .ts-hrs-num { font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1; }
                    .ts-hrs-lbl { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-top: 4px; }
                    
                    .ts-day-bars { display: flex; gap: 4px; align-items: flex-end; height: 28px; margin-top: 10px; }
                    .ts-db { width: 12px; border-radius: 3px 3px 0 0; background: #f1f5f9; transition: height 0.3s; display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden; }
                    .ts-bar-bill { background: #3b82f6; width: 100%; }
                    .ts-bar-nb { background: #cbd5e1; width: 100%; }
                    .ts-db.on { background: transparent; }
                    
                    .btn-ts { padding: 0 14px; height: 34px; border-radius: 8px; font-size: 12px; font-weight: 700; transition: all 0.2s; cursor: pointer; border: 1px solid transparent; display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box; }
                    .btn-ts-approve { background: #10b981; color: #fff; }
                    .btn-ts-approve:hover { background: #059669; }
                    .btn-ts-reject { background: #ef4444; color: #fff; }
                    .btn-ts-reject:hover { background: #dc2626; }
                    .btn-ts-view { background: #f8fafc; color: #64748b; border-color: #e2e8f0; }
                    .btn-ts-view:hover { background: #f1f5f9; color: #0f172a; }
                    
                    /* Unified Approvals Redesign */
                    .approvals-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; margin-top: 6px; flex-wrap: wrap; gap: 12px; }
                    .approvals-title-group { flex: 1; }
                    .approvals-title { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
                    .approvals-sub { font-size: 12px; color: #64748b; }
                    
                    .filters-strip { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 4px; }
                    .chip-filter { padding: 0 14px; height: 34px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #e2e8f0; background: #fff; color: #64748b; transition: all 0.2s; white-space: nowrap; display: inline-flex; align-items: center; box-sizing: border-box; }
                    .chip-filter:hover { background: #f8fafc; color: #0f172a; }
                    .chip-filter.active { background: #1a4ff0; color: #fff; border-color: #1a4ff0; }
                    
                    .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 16px; min-height: 120px; }
                    .request-card { background: #fff; border: 1px solid #f1f5f9; border-radius: 10px; padding: 14px 16px; box-shadow: none; transition: all 0.2s; display: flex; flex-direction: column; position: relative; }
                    .request-card:hover { transform: none; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border-color: #e2e8f0; }
                    
                    .rc-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
                    .rc-type-badge { position: absolute; top: 12px; right: 12px; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
                    .type-leave { background: #f5f3ff; color: #7c3aed; }
                    .type-wfh { background: #eff6ff; color: #2563eb; }
                    .type-expense { background: #fff7ed; color: #ea580c; }
                    .type-exit { background: #fef2f2; color: #dc2626; }
                    
                    .rc-body { flex: 1; display: flex; flex-direction: column; gap: 6px; }
                    .rc-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155; }
                    .rc-row svg { opacity: 0.5; color: #64748b; flex-shrink: 0; }
                    
                    .rc-actions { display: flex; gap: 6px; margin-top: 10px; padding-top: 10px; border-top: 1px solid #f1f5f9; }
                    .btn-card { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 10px; height: 32px; border-radius: 8px; font-size: 12px; font-weight: 700; transition: all 0.2s; cursor: pointer; border: 1px solid transparent; box-sizing: border-box; }
                    .btn-card:active { transform: scale(0.97); }
                    .btn-card-approve { background: #10b981; color: #fff; }
                    .btn-card-approve:hover { background: #059669; }
                    .btn-card-reject { background: #ef4444; color: #fff; }
                    .btn-card-reject:hover { background: #dc2626; }
                    .btn-card-details { background: #f8fafc; color: #64748b; border-color: #e2e8f0; }
                    .btn-card-details:hover { background: #f1f5f9; color: #0f172a; }
                    
                    
                    /* Team Asset Management */
                    .asset-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 0 4px 16px 4px; }
                    .asset-m-card { background: #fff; padding: 16px 18px; border-radius: 10px; border: 1px solid #f1f5f9; box-shadow: none; }
                    .asset-m-lbl { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
                    .asset-m-val { font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1; }
                    
                    .asset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; padding: 0 4px 16px 4px; }
                    .asset-card { background: #fff; border: 1px solid #f1f5f9; border-radius: 10px; padding: 16px 18px; box-shadow: none; transition: all 0.2s; display: flex; flex-direction: column; }
                    .asset-card:hover { transform: none; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border-color: #e2e8f0; }
                    
                    .asset-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; gap: 8px; }
                    .asset-count { font-size: 11px; color: #94a3b8; font-weight: 700; }
                    
                    .asset-items { display: flex; flex-direction: column; gap: 8px; flex: 1; }
                    .asset-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #f1f5f9; }
                    .asset-nm { font-size: 13px; font-weight: 600; color: #1e293b; }
                    .asset-tag { font-size: 10px; color: #64748b; font-family: monospace; }
                    
                    .asset-actions { display: flex; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #f1f5f9; }
                    .btn-asset { flex: 1; padding: 0 12px; height: 34px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; border: 1px solid transparent; display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box; }
                    .btn-asset-view { background: #f8fafc; color: #64748b; border-color: #e2e8f0; }
                    .btn-asset-view:hover { background: #f1f5f9; color: #0f172a; }
                    .btn-asset-add { background: #1a4ff0; color: #fff; }
                    .btn-asset-add:hover { background: #1541c9; }
                    
                    @keyframes pulse { 0% { transform: scale(0.95); opacity: 0.5; } 50% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(0.95); opacity: 0.5; } }
                    
                    /* Leave Adjustments Redesign Styles */
                    .adj-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; padding: 0 4px; gap: 12px; flex-wrap: wrap; }
                    .adj-title-group { display: flex; flex-direction: column; gap: 4px; }
                    .adj-page-title { font-size: 16px; font-weight: 800; color: #111827; letter-spacing: -0.02em; margin: 0; }
                    .adj-page-sub { font-size: 12px; color: #6b7280; font-weight: 500; margin: 0; }
                    
                    .adj-alert { 
                        display: flex; align-items: center; gap: 10px; padding: 10px 14px; 
                        background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; 
                        margin: 0 4px 14px 4px; color: #92400e; font-size: 13px; line-height: 1.45;
                        box-shadow: none;
                    }
                    
                    .adj-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 14px; margin-bottom: 14px; padding: 0 4px; }
                    
                    .adj-card { 
                        background: #fff; border: 1px solid #f1f5f9; border-radius: 10px; 
                        padding: 14px 16px; box-shadow: none; transition: all 0.2s ease;
                        display: flex; flex-direction: column; gap: 12px; position: relative;
                        overflow: hidden;
                    }
                    .adj-card:hover { transform: none; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border-color: #e2e8f0; }
                    
                    .adj-card-top { display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 8px; }
                    .adj-emp-group { display: flex; align-items: center; gap: 10px; }
                    .adj-avatar { 
                        width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; 
                        font-weight: 700; font-size: 12px; color: #fff; box-shadow: none; flex-shrink: 0;
                    }
                    .adj-name-info { display: flex; flex-direction: column; gap: 2px; }
                    .adj-emp-name { font-size: 13px; font-weight: 700; color: #111827; }
                    .adj-emp-meta { font-size: 10px; color: #6b7280; font-family: monospace; font-weight: 600; text-transform: uppercase; }
                    
                    .adj-badge { 
                        padding: 3px 8px; border-radius: 99px; font-size: 10px; font-weight: 700; 
                        background: #f0fdf4; color: #16a34a; border: 1px solid #dcfce7;
                    }
                    
                    .adj-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
                    .adj-stat-box { 
                        background: #f8fafc; border-radius: 8px; padding: 8px 4px; text-align: center; 
                        display: flex; flex-direction: column; gap: 4px; border: 1px solid #f1f5f9;
                        min-width: 0;
                    }
                    .adj-stat-val { font-size: 15px; font-weight: 800; font-family: monospace; line-height: 1; }
                    .adj-stat-lbl { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.02em; white-space: normal; line-height: 1.2; word-break: break-word; }
                    
                    .adj-btn-full { 
                        width: 100%; padding: 0 12px; height: 36px; border-radius: 8px; font-size: 13px; font-weight: 700; 
                        background: #4f46e5; color: #fff; border: none; cursor: pointer; 
                        transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
                        box-sizing: border-box;
                    }
                    .adj-btn-full:hover { background: #4338ca; box-shadow: none; }
                `}</style>
                {/* Standard Tabs */}
                <div className="mp-tabs" role="tablist" aria-label="Organization sections">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'overview'}
                        className={`mp-tab ${activeTab === 'overview' ? 'active' : ''}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        {isOrgView ? "Org Members" : "Team Overview"}
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'attendance'}
                        className={`mp-tab ${activeTab === 'attendance' ? 'active' : ''}`}
                        onClick={() => setActiveTab('attendance')}
                    >
                        Attendance
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'approvals'}
                        className={`mp-tab ${activeTab === 'approvals' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('approvals'); fetchTeamData(); }}
                    >
                        Leave, WFH & Expense Approvals
                        {(pendingLeaves.length + pendingWfh.length + pendingExpenses.length + pendingExitRequests.length) > 0 && (
                            <span className="mp-tab-badge">
                                {pendingLeaves.length + pendingWfh.length + pendingExpenses.length + pendingExitRequests.length}
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'timesheets'}
                        className={`mp-tab ${activeTab === 'timesheets' ? 'active' : ''}`}
                        onClick={() => setActiveTab('timesheets')}
                    >
                        Timesheet Approvals
                        {(() => {
                            const count = pendingTimesheets.filter(ts => {
                                if (!timesheetWeekFilter) return true;
                                const weekValue = ts.weekStartDate || ts.weekStart;
                                if (!weekValue) return false;
                                const normalize = (val) => String(val).match(/^(\d{4}-\d{2}-\d{2})/) ? String(val).match(/^(\d{4}-\d{2}-\d{2})/)[1] : String(val).trim();
                                return normalize(weekValue) === normalize(timesheetWeekFilter);
                            }).length;
                            return count > 0 && (
                                <span className="mp-tab-badge">
                                    {count}
                                </span>
                            );
                        })()}
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'asset-management'}
                        className={`mp-tab ${activeTab === 'asset-management' ? 'active' : ''}`}
                        onClick={() => setActiveTab('asset-management')}
                    >
                        Asset Management
                        {(() => {
                            const activeTickets = teamTickets.filter(t => t?.status !== 'CLOSED').length;
                            const activeHandovers = assignedHandovers.length;
                            const count = activeTickets + activeHandovers;
                            return count > 0 && (
                                <span className="mp-tab-badge">
                                    {count}
                                </span>
                            );
                        })()}
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'adjustments'}
                        className={`mp-tab ${activeTab === 'adjustments' ? 'active' : ''}`}
                        onClick={() => setActiveTab('adjustments')}
                    >
                        Leave Adjustments
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'delegations'}
                        className={`mp-tab ${activeTab === 'delegations' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('delegations'); fetchDelegations(); }}
                    >
                        Approval Delegation
                        {myDelegations?.assignedByMe?.filter(d => d.status === 'ACTIVE').length > 0 && (
                            <span className="mp-tab-badge" style={{ background: '#4f46e5' }}>
                                {myDelegations.assignedByMe.filter(d => d.status === 'ACTIVE').length}
                            </span>
                        )}
                    </button>
                </div>
                <p className="mp-tabs-hint">Swipe left or right to see all tabs</p>

                {activeTab === 'overview' && (
                    <>

                        {/* Redesigned KPI Strip - Now Tab Specific */}
                        <div className="ov-grid mp-section">
                            {[
                                { label: 'Total team', value: stats.totalTeam, icon: Users, color: '#4f46e5', sub: 'Active members' },
                                { label: 'Present Today', value: stats.presentToday, icon: UserCheck, color: '#10b981', sub: 'In office / remote' },
                                { label: 'On Leave', value: stats.onLeave, icon: Calendar, color: '#8b5cf6', sub: 'Planned absences' },
                                { label: 'Late / Absent', value: stats.lateArrivals, icon: Clock, color: '#ef4444', sub: 'Attention needed' },
                            ].map((s, i) => {
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
                        {/* Who's Out & Remote (Today & Upcoming) - section */}
                        <div className="card mp-card-inset" style={{ marginBottom: 0, padding: '16px 20px', borderRadius: '12px' }}>
                            <div className="card-header" style={{ padding: 0, marginBottom: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <h3 className="card-title" style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#1e293b' }}>
                                        {isOrgView ? "Org Out & Remote Schedule" : "Who's Out & Remote Schedule"}
                                    </h3>
                                    <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                                        Today & Upcoming
                                    </span>
                                </div>
                                {whosOutToday.length > 0 && (
                                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                                        {whosOutToday.length} {whosOutToday.length === 1 ? 'person' : 'people'}
                                    </span>
                                )}
                            </div>
                            <div className="card-body" style={{ padding: 0 }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', justifyContent: 'flex-start', alignItems: 'stretch' }}>
                                    {whosOutToday.length === 0 ? (
                                        <p style={{ color: 'var(--gray-500)', margin: 0, fontSize: '14px' }}>No upcoming leaves or remote work scheduled</p>
                                    ) : (
                                        whosOutToday.map((person, idx) => (
                                            <div
                                                key={`${person.name}-${person.employeeId || idx}-${person.dateText || ''}`}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    textAlign: 'center',
                                                    width: '118px',
                                                    minWidth: '110px',
                                                    padding: '10px 8px 8px',
                                                    background: '#ffffff',
                                                    border: '1px solid #f1f5f9',
                                                    borderRadius: '10px',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <div style={{ position: 'relative', width: 52, height: 52, marginBottom: 8 }}>
                                                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', backgroundColor: person.blobColor || '#e2e8f0', opacity: 0.9 }} />
                                                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 42, height: 42, background: '#f8fafc', color: '#334155', fontSize: '0.78rem', fontWeight: 700, border: '2px solid #fff', boxShadow: '0 2px 5px rgba(0,0,0,0.06)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        {person.avatar ? (
                                                            <img src={person.avatar} alt={person.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <span>{String(person.name).split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <p
                                                    style={{
                                                        fontWeight: 600,
                                                        color: '#1e293b',
                                                        fontSize: '0.74rem',
                                                        lineHeight: 1.25,
                                                        margin: '0 0 2px',
                                                        width: '100%',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}
                                                    title={person.name}
                                                >
                                                    {person.name}
                                                </p>
                                                <p
                                                    style={{
                                                        fontSize: '0.65rem',
                                                        color: '#64748b',
                                                        lineHeight: 1.2,
                                                        margin: '0 0 4px',
                                                        fontWeight: 500,
                                                        width: '100%',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}
                                                    title={person.role}
                                                >
                                                    {person.role}
                                                </p>
                                                <div style={{ marginTop: 'auto', paddingTop: '4px', width: '100%' }}>
                                                    <span
                                                        style={{
                                                            display: 'inline-block',
                                                            fontSize: '0.62rem',
                                                            fontWeight: 600,
                                                            padding: '2px 6px',
                                                            borderRadius: '6px',
                                                            background: person.isToday ? '#fee2e2' : '#eff6ff',
                                                            color: person.isToday ? '#b91c1c' : '#1d4ed8',
                                                            width: '100%',
                                                            boxSizing: 'border-box',
                                                            textAlign: 'center',
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis'
                                                        }}
                                                        title={person.dateText}
                                                    >
                                                        {person.dateText || (person.isToday ? 'Today' : 'Upcoming')}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="card mp-card-inset" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', marginTop: '20px' }}>
                            <div className="team-table-hd" style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', background: '#fff', margin: 0 }}>
                                <h3 className="team-table-title">{isOrgView ? "Organization Members" : "Direct Reports"}</h3>
                                <div className="team-srch-wrap">
                                    <Search size={14} style={{ color: '#94a3b8' }} />
                                    <input
                                        type="text"
                                        placeholder="Search by name, ID, dept or role..."
                                        value={teamSearchTerm}
                                        onChange={(e) => setTeamSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="employee-table" style={{ margin: 0 }}>
                                    <thead style={{ backgroundColor: '#f8fafc' }}>
                                        <tr>
                                            <th style={{ padding: '14px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Employee / ID</th>
                                            <th style={{ padding: '14px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Dept / Role</th>
                                            <th style={{ padding: '14px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                                            <th style={{ padding: '14px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Contact Information</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            const term = teamSearchTerm.toLowerCase();
                                            const filteredTeamMembers = teamMembers.filter(member => {
                                                if (!term) return true;
                                                const name = `${member.firstName || ''} ${member.lastName || ''}`.toLowerCase();
                                                const empId = String(member.employeeId || member.employeeIdString || '').toLowerCase();
                                                const designation = (member.positionTitle || member.designation || member.position?.title || member.jobTitle || '').toLowerCase();
                                                const dept = (member.departmentName || member.department || member.position?.department?.departmentName || '').toLowerCase();
                                                const rm = (member.reportingManagerName || `${member.reportingManager?.firstName || ''} ${member.reportingManager?.lastName || ''}`).toLowerCase();
                                                const role = String(member.employeeRoleName || member.role?.name || member.role || '').toLowerCase();
                                                const email = (member.email || '').toLowerCase();
                                                const phone = (member.emergencyPhone || member.phone || member.phoneNumber || '').toLowerCase();
                                                return name.includes(term) || empId.includes(term) || designation.includes(term) || dept.includes(term) || rm.includes(term) || role.includes(term) || email.includes(term) || phone.includes(term);
                                            });

                                            if (filteredTeamMembers.length === 0) {
                                                return <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>{isOrgView ? "No org members found" : "No team members matching your search"}</td></tr>;
                                            }

                                            return filteredTeamMembers.map((member, idx) => {
                                                const initials = `${member.firstName?.[0] || ''}${member.lastName?.[0] || ''}`.toUpperCase() || 'EM';
                                                const rowColors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
                                                const color = rowColors[idx % rowColors.length];
                                                
                                                return (
                                                    <tr key={member.id || member.employeeId || member.employeeIdString || `member-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '16px 20px' }}>
                                                            <div className="emp-info-grid">
                                                                <div className="u-av" style={{ background: `${color}15`, color: color }}>
                                                                    {initials}
                                                                </div>
                                                                <div>
                                                                    <div className="emp-nm">{member.firstName} {member.lastName}</div>
                                                                    <div className="emp-id-sub">{member.employeeId || member.employeeIdString || 'EMP-XXXX'}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '16px 20px' }}>
                                                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                                                                {member.positionTitle || member.designation || member.position?.title || member.jobTitle || 'Team Member'}
                                                            </div>
                                                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                                {member.departmentName || member.department || member.position?.department?.departmentName || 'General'}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '16px 20px' }}>
                                                            <span className={`stat-badge ${member.status?.toLowerCase() === 'active' || member.isActive ? 'stat-badge-active' : 'stat-badge-inactive'}`}>
                                                                {member.status || (member.isActive ? 'Active' : 'Inactive')}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '16px 20px' }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b' }}>
                                                                    <Mail size={12} style={{ color: '#94a3b8' }} />
                                                                    <span>{member.email || 'no-email@company.com'}</span>
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b' }}>
                                                                    <Phone size={12} style={{ color: '#94a3b8' }} />
                                                                    <span>{member.emergencyPhone || member.phone || member.phoneNumber || 'Contact not added'}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            });
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'attendance' && (() => {
                    const displayTotalTeam = Math.max(
                        Number(stats.totalTeam) || 0,
                        Array.isArray(teamMembers) ? teamMembers.length : 0,
                        Array.isArray(teamAttendance) ? teamAttendance.length : 0,
                        Number(stats.presentToday) || 0
                    );
                    const displayPresent = Math.min(Number(stats.presentToday) || 0, displayTotalTeam || (Number(stats.presentToday) || 0));
                    const attendanceRate = safePercent(displayPresent, displayTotalTeam);

                    return (
                    <div className="card mp-card-inset" style={{ padding: '16px 20px', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', background: '#fff' }}>
                        {/* AI Insight Bar */}
                        <div className="ai-bar" style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px' }}>
                            <div className="ai-dot"></div>
                            <div className="ai-text">
                                <strong>AI Insight:</strong>{' '}
                                {displayTotalTeam > 0
                                    ? <>{displayPresent} of {displayTotalTeam} members checked in.</>
                                    : <>No team attendance data available yet.</>}
                                {displayTotalTeam > 0 && (
                                    stats.lateArrivals > 0
                                        ? ` ${stats.lateArrivals} members have delayed arrivals today.`
                                        : ' All members are on track with shift starts.'
                                )}
                                {displayTotalTeam > 0 && (
                                    <> Attendance rate is holding at <strong>{attendanceRate}%</strong> today.</>
                                )}
                            </div>
                        </div>

                        <div className="att-layout" style={{ marginBottom: '20px' }}>
                            {/* Main Attendance Table Card */}
                            <div className="card" style={{ padding: 0, border: '1px solid #f1f5f9', borderRadius: '8px', boxShadow: 'none' }}>
                                <div className="card-header att-card-hd" style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <h3 className="card-title" style={{ fontSize: '15px', margin: 0 }}>Today's Attendance</h3>
                                        <div className="live-pill">
                                            <div className="live-ping"></div>
                                            LIVE
                                        </div>
                                    </div>
                                    <div className="att-srch-box" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 10px', height: '30px', width: '220px' }}>
                                        <Search size={14} style={{ color: '#94a3b8' }} />
                                        <input
                                            type="text"
                                            placeholder="Search attendance..."
                                            value={attSearchTerm}
                                            onChange={(e) => setAttSearchTerm(e.target.value)}
                                            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', width: '100%', color: '#0f172a' }}
                                        />
                                    </div>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="att-table-v2">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '220px' }}>Employee</th>
                                                <th>Status</th>
                                                <th>Check In</th>
                                                <th>Check Out</th>
                                                <th>Duration</th>
                                                <th>Hours</th>
                                                <th>Remark</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const filteredAtt = (teamAttendance || []).filter(record => {
                                                    if (!attSearchTerm) return true;
                                                    const s = attSearchTerm.toLowerCase();
                                                    const name = `${record.firstName || ''} ${record.lastName || ''}`.toLowerCase();
                                                    const empId = String(record.employeeId || '').toLowerCase();
                                                    const status = String(record.status || '').toLowerCase();
                                                    const location = String(record.workLocation || '').toLowerCase();
                                                    return name.includes(s) || empId.includes(s) || status.includes(s) || location.includes(s);
                                                });

                                                if (filteredAtt.length === 0) {
                                                    return <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No attendance records found matching search</td></tr>;
                                                }

                                                return filteredAtt.map((record, idx) => {
                                                    const initials = `${record.firstName?.[0] || ''}${record.lastName?.[0] || ''}`.toUpperCase() || 'EM';
                                                
                                                // Status mapping from the real API response
                                                const apiStatus = String(record.status || '').toUpperCase();
                                                const isPresent = apiStatus === 'PRESENT';
                                                const isOnLeave = apiStatus === 'ON_LEAVE' || apiStatus === 'LEAVE';
                                                const isAwaiting = apiStatus === 'AWAITING SHIFT' || apiStatus === 'AWAITING_SHIFT';
                                                const isNotClocked = apiStatus === 'NOT CLOCKED IN YET' || apiStatus === 'NOT_CLOCKED_IN';
                                                
                                                // Deterministic row coloring for icons
                                                const rowColors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
                                                const color = rowColors[idx % rowColors.length];
                                                
                                                // Duration percentage based on status
                                                const durPct = record.clockOutTime && record.clockOutTime !== '--:--' ? 100 : (isPresent ? 45 : 0);

                                                return (
                                                    <tr key={record.id || record.employeeId || idx}>
                                                        <td>
                                                            <div className="emp-info-grid">
                                                                <div className="u-av" style={{ background: `${color}15`, color: color, width: '32px', height: '32px', fontSize: '11px' }}>
                                                                    {initials}
                                                                </div>
                                                                <div>
                                                                    <div className="emp-nm">{record.firstName} {record.lastName}</div>
                                                                    <div className="emp-id-sub">{record.employeeId || 'EMP-XXXX'} • {formatWorkLocationLabel(record.workLocation, { compact: true, fallback: 'Office' })}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {isPresent ? (
                                                                <span className="att-status-p" style={{ background: '#f0fdf4', color: '#166534' }}>
                                                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.5s infinite' }}></div>
                                                                    Present
                                                                </span>
                                                            ) : isOnLeave ? (
                                                                <span className="att-status-p" style={{ background: '#f5f3ff', color: '#5b21b6' }}>
                                                                    On Leave
                                                                </span>
                                                            ) : isAwaiting ? (
                                                                <span className="att-status-p" style={{ background: '#fffbeb', color: '#92400e' }}>
                                                                    Awaiting Shift
                                                                </span>
                                                            ) : isNotClocked ? (
                                                                <span className="att-status-p" style={{ background: '#f8fafc', color: '#64748b' }}>
                                                                    Not Clocked In
                                                                </span>
                                                            ) : (
                                                                <span className="att-status-p" style={{ background: '#eff6ff', color: '#1e40af' }}>
                                                                    {formatWorkLocationLabel(apiStatus, { compact: true, fallback: apiStatus.replace(/_/g, ' ') })}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td><span className="att-time">{formatTimeTo12h(record.clockInTime)}</span></td>
                                                        <td>
                                                            <span className="att-time" style={{ color: record.clockOutTime && record.clockOutTime !== '--:--' ? '#4b5563' : (isPresent ? '#10b981' : '#94a3b8') }}>
                                                                {record.clockOutTime && record.clockOutTime !== '--:--' ? formatTimeTo12h(record.clockOutTime) : (isPresent ? 'Live' : '--:--')}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="dur-wrapper">
                                                                <div className="dur-track">
                                                                    <div className="dur-fill" style={{ width: `${durPct}%`, background: record.clockOutTime && record.clockOutTime !== '--:--' ? '#3b82f6' : (isPresent ? '#10b981' : '#e2e8f0') }}></div>
                                                                </div>
                                                                <div style={{ fontSize: '10px', color: '#64748b' }}>{isPresent ? 'Active' : record.clockOutTime && record.clockOutTime !== '--:--' ? 'Done' : '—'}</div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'DM Mono', color: '#0f1117' }}>
                                                                {record.totalHours || record.workHours || '--'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {isPresent ? (
                                                                <div className="live-pill" style={{ width: 'fit-content', padding: '2px 8px' }}>
                                                                    <div className="live-ping"></div>
                                                                    LIVE
                                                                </div>
                                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                    <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>{record.remark || record.statusReason || 'Awaiting'}</span>
                                                                    {record.leaveType && <span style={{ fontSize: '9px', color: '#94a3b8' }}>{formatLeaveTypeLabel(record.leaveType, { compact: true })}</span>}
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Right Panel Widgets */}
                            {(() => {
                                const wfhCount = (teamAttendance || []).filter(r => {
                                    const loc = String(r.workLocation || '').toUpperCase();
                                    const st = String(r.status || '').toUpperCase();
                                    return loc === 'WFH' || loc === 'WORK_FROM_HOME' || loc === 'FROM_HOME' || st === 'WFH' || isWfhCode(loc) || Boolean(r.isWfh);
                                }).length;
                                const activeWfh = stats.wfhToday ?? wfhCount;

                                return (
                                    <div className="rp" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        <div className="clock-card">
                                            <div className="clock-time">{currentTime.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                                            <div className="clock-date">{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
                                            <div className="clock-stats">
                                                <div className="clock-stat">
                                                    <div className="clock-stat-val">{displayPresent}</div>
                                                    <div className="clock-stat-lbl">In</div>
                                                </div>
                                                <div className="clock-stat">
                                                    <div className="clock-stat-val">{activeWfh}</div>
                                                    <div className="clock-stat-lbl">WFH</div>
                                                </div>
                                                <div className="clock-stat">
                                                    <div className="clock-stat-val">{stats.onLeave}</div>
                                                    <div className="clock-stat-lbl">Leave</div>
                                                </div>
                                                <div className="clock-stat">
                                                    <div className="clock-stat-val">{stats.lateArrivals}</div>
                                                    <div className="clock-stat-lbl">Late</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="presence-card">
                                            <h4 className="presence-title">Today's Presence</h4>
                                            <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 16px' }}>
                                                <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                                                    <circle cx="18" cy="18" r="16" fill="transparent" stroke="#f1f5f9" strokeWidth="3" />
                                                    <circle cx="18" cy="18" r="16" fill="transparent" stroke="#10b981" strokeWidth="3" strokeDasharray={`${attendanceRate} 100`} strokeLinecap="round" />
                                                </svg>
                                                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f1117' }}>{attendanceRate}%</div>
                                                    <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em' }}>Present</div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {[
                                                    { label: 'Present', val: displayPresent, color: '#10b981' },
                                                    { label: 'WFH', val: activeWfh, color: '#3b82f6' },
                                                    { label: 'Not Clocked In', val: Math.max(0, displayTotalTeam - displayPresent - (stats.onLeave || 0)), color: '#fca5a5' },
                                                    { label: 'On Leave', val: stats.onLeave, color: '#8b5cf6' }
                                                ].map((item, i) => (
                                                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                                                            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: item.color }}></div>
                                                            {item.label}
                                                        </div>
                                                        <div style={{ fontWeight: 700, color: '#0f1117' }}>{item.val}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Attendance Calendar Section */}
                        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                            {renderAttendanceCalendar(attendanceCalendar, attMonth, setAttMonth, fetchAttendanceCalendar, calendarLoading)}
                        </div>
                    </div>
                    );
                })()}

                {activeTab === 'approvals' && (() => {
                    const nonPendingStatuses = ['APPROVED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'CANCELED', 'SKIPPED', 'FORWARDED_TO_HR'];
                    const allPending = [
                        ...pendingLeaves.filter(l => {
                            const mst = String(l.managerStatus || '').trim().toUpperCase();
                            const st = String(l.status || '').trim().toUpperCase();
                            if (nonPendingStatuses.includes(st) || nonPendingStatuses.includes(mst)) return false;
                            return st === 'PENDING' || st === 'SUBMITTED' || mst === 'PENDING' || mst === 'SUBMITTED';
                        }).map(l => {
                            const rawType = String(l.leaveType || l.leaveTypeName || l.leaveTypeCode || '').toUpperCase();
                            const isWfh = isWfhCode(l.leaveType || l.leaveTypeName || l.leaveTypeCode) || 
                                          rawType === 'WFH' || 
                                          rawType.includes('WORK_FROM_HOME') ||
                                          rawType.includes('WORK FROM HOME') ||
                                          rawType.includes('REMOTE') ||
                                          String(l.type || '').toUpperCase() === 'WFH' ||
                                          Boolean(l.isWfh);
                            return { ...l, reqType: isWfh ? 'WFH' : 'LEAVE' };
                        }),
                        ...pendingWfh.filter(w => {
                            const st = String(w.status || '').trim().toUpperCase();
                            return !nonPendingStatuses.includes(st) && (st === 'PENDING' || st === 'SUBMITTED');
                        }).map(w => ({ ...w, reqType: 'WFH' })),
                        ...pendingExpenses.filter(e => {
                            const t = String(e.reqType || e.type || '').toUpperCase();
                            const st = String(e.status || '').trim().toUpperCase();
                            return t !== 'WFH' && t !== 'LEAVE' && !nonPendingStatuses.includes(st) && (st === 'SUBMITTED' || st === 'PENDING');
                        }).map(e => ({ ...e, reqType: 'EXPENSE' })),
                        ...pendingExitRequests.filter(x => {
                            const st = String(x.status || '').trim().toUpperCase();
                            return !nonPendingStatuses.includes(st) && (st === 'PENDING' || st === 'SUBMITTED');
                        }).map(x => ({ ...x, reqType: 'EXIT' }))
                    ].sort((a, b) => new Date(b.createdAt || b.submittedAt || 0) - new Date(a.createdAt || a.submittedAt || 0));

                    const handleExportApprovals = () => {
                        if (!allPending || allPending.length === 0) {
                            toast.error("No pending requests to export");
                            return;
                        }
                        const headers = ["RequestType", "EmployeeName", "EmployeeID", "SubmittedDate", "Details", "Status"];
                        const rows = [headers.join(",")];
                        allPending.forEach(r => {
                            const details = r.reason || r.description || r.purpose || r.comments || `${r.startDate || ''} to ${r.endDate || ''}`;
                            const row = [
                                r.reqType || '',
                                r.employeeName || `${r.firstName || ''} ${r.lastName || ''}`.trim(),
                                r.employeeId || '',
                                r.createdAt || r.submittedAt || r.startDate || '',
                                details || '',
                                r.status || 'PENDING'
                            ];
                            rows.push(row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","));
                        });
                        const csvString = "\uFEFF" + rows.join("\n");
                        const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `approvals_export_${new Date().toISOString().split('T')[0]}.csv`;
                        a.click();
                        toast.success("Approvals exported to CSV");
                    };

                    const normApprovalFilter = (approvalFilter || 'all').toLowerCase().trim();
                    const byType = (normApprovalFilter === 'all' || normApprovalFilter === 'pending')
                        ? allPending 
                        : allPending.filter(r => (r.reqType || '').toLowerCase() === normApprovalFilter);

                    const filtered = byType.filter(r => {
                        if (approvalSourceFilter === 'delegated') return Boolean(r.isDelegated);
                        if (approvalSourceFilter === 'direct') return !r.isDelegated;
                        return true;
                    });

                    return (
                        <div className="card mp-card-inset" style={{ padding: '16px 20px', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', background: '#fff' }}>
                            <div className="approvals-header" style={{ paddingBottom: '14px', borderBottom: '1px solid #f1f5f9', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                                <div className="approvals-title-group">
                                    <h2 className="approvals-title" style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>Leave, WFH & Expense Approvals</h2>
                                    <p className="approvals-sub" style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Review and act on pending requests from your direct team and delegated managers</p>
                                </div>
                                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                     <div className="filters-strip" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0, padding: 0 }}>
                                         {[
                                             { label: 'All Requests', val: 'all', count: allPending.length },
                                             { label: 'Leave', val: 'leave', count: allPending.filter(r => (r.reqType || '').toUpperCase() === 'LEAVE').length },
                                             { label: 'WFH', val: 'wfh', count: allPending.filter(r => (r.reqType || '').toUpperCase() === 'WFH').length },
                                             { label: 'Expense', val: 'expense', count: allPending.filter(r => (r.reqType || '').toUpperCase() === 'EXPENSE').length },
                                             { label: 'Exit', val: 'exit', count: allPending.filter(r => (r.reqType || '').toUpperCase() === 'EXIT').length }
                                         ].map(f => {
                                             const isActive = (approvalFilter || 'all').toLowerCase() === f.val.toLowerCase();
                                             return (
                                                 <button 
                                                     type="button"
                                                     key={f.val} 
                                                     className={`chip-filter ${isActive ? 'active' : ''}`}
                                                     onClick={(e) => {
                                                         e.stopPropagation();
                                                         setApprovalFilter(f.val);
                                                     }}
                                                     style={{ 
                                                         height: '30px', 
                                                         padding: '0 12px', 
                                                         fontSize: '12px', 
                                                         cursor: 'pointer',
                                                         background: isActive ? '#1a4ff0' : '#fff',
                                                         color: isActive ? '#fff' : '#64748b',
                                                         borderColor: isActive ? '#1a4ff0' : '#e2e8f0',
                                                         fontWeight: isActive ? 700 : 500,
                                                         outline: 'none',
                                                         display: 'inline-flex',
                                                         alignItems: 'center'
                                                     }}
                                                 >
                                                     {f.label}
                                                     {f.count > 0 && (
                                                         <span style={{ 
                                                             marginLeft: '6px', 
                                                             fontSize: '11px', 
                                                             fontWeight: 700,
                                                             padding: '1px 6px',
                                                             borderRadius: '10px',
                                                             background: isActive ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                                                             color: isActive ? '#fff' : '#475569',
                                                             pointerEvents: 'none'
                                                         }}>
                                                             {f.count}
                                                         </span>
                                                     )}
                                                 </button>
                                             );
                                         })}
                                     </div>
                                     <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f8fafc', padding: '2px 4px', borderRadius: '8px', border: '1px solid #e2e8f0' }} title="Filter by Request Source (Direct Reportees vs Delegated from Peer Managers)">
                                         <button
                                             type="button"
                                             className={`btn ${approvalSourceFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                                             style={{ height: '26px', padding: '0 8px', fontSize: '11px', borderRadius: '6px' }}
                                             onClick={() => setApprovalSourceFilter('all')}
                                             title="View all requests (Direct Team + Delegated)"
                                         >
                                             All Sources
                                             <span style={{ marginLeft: '4px', fontSize: '10px', opacity: 0.85 }}>({allPending.length})</span>
                                         </button>
                                         <button
                                             type="button"
                                             className={`btn ${approvalSourceFilter === 'direct' ? 'btn-primary' : 'btn-ghost'}`}
                                             style={{ height: '26px', padding: '0 8px', fontSize: '11px', borderRadius: '6px' }}
                                             onClick={() => setApprovalSourceFilter('direct')}
                                             title="Only requests from employees directly reporting to you"
                                         >
                                             Direct Team
                                             <span style={{ marginLeft: '4px', fontSize: '10px', opacity: 0.85 }}>({allPending.filter(r => !r.isDelegated).length})</span>
                                         </button>
                                         <button
                                             type="button"
                                             className={`btn ${approvalSourceFilter === 'delegated' ? 'btn-primary' : 'btn-ghost'}`}
                                             style={{ height: '26px', padding: '0 8px', fontSize: '11px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                             onClick={() => setApprovalSourceFilter('delegated')}
                                             title="Requests delegated from other managers to you"
                                         >
                                             <Shield size={12} color={approvalSourceFilter === 'delegated' ? '#fff' : '#6366f1'} />
                                             Delegated
                                             {allPending.filter(r => r.isDelegated).length > 0 && (
                                                 <span style={{ fontSize: '10px', background: approvalSourceFilter === 'delegated' ? 'rgba(255,255,255,0.3)' : '#6366f1', color: '#fff', borderRadius: '10px', padding: '1px 5px' }}>
                                                     {allPending.filter(r => r.isDelegated).length}
                                                 </span>
                                             )}
                                         </button>
                                     </div>
                                     <button className="btn" onClick={handleExportApprovals} style={{ height: '30px', padding: '0 12px', fontSize: '12px' }}>Export</button>
                                 </div>
                            </div>

                            {(loading && allPending.length === 0) ? (
                                <div className="cards-grid">
                                    {[1, 2, 3, 4, 5, 6].map(i => (
                                        <div key={i} className="request-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div className="nt-skeleton" style={{ width: '60px', height: '16px', borderRadius: '12px' }} />
                                                <div className="nt-skeleton" style={{ width: '80px', height: '12px', borderRadius: '4px' }} />
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div className="nt-skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                                                    <div className="nt-skeleton" style={{ width: '130px', height: '14px', borderRadius: '4px' }} />
                                                    <div className="nt-skeleton" style={{ width: '100px', height: '10px', borderRadius: '4px' }} />
                                                </div>
                                            </div>
                                            <div className="nt-skeleton" style={{ width: '100%', height: '14px', borderRadius: '4px' }} />
                                            <div className="nt-skeleton" style={{ width: '70%', height: '12px', borderRadius: '4px' }} />
                                            <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                                                <div className="nt-skeleton" style={{ flex: 1, height: '32px', borderRadius: '6px' }} />
                                                <div className="nt-skeleton" style={{ flex: 1, height: '32px', borderRadius: '6px' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="cards-grid">
                                    {filtered.length === 0 ? (
                                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #e2e8f0' }}>
                                            <div style={{ fontSize: '32px', marginBottom: '12px' }}>💤</div>
                                            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#334155' }}>No pending {approvalFilter !== 'all' ? approvalFilter : ''} requests</h3>
                                            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>You're all caught up with your team's approvals!</p>
                                        </div>
                                    ) : (
                                    filtered.map((req, idx) => {
                                        const initials = req.employeeName?.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || (req.firstName?.[0] || 'EM');
                                        const rowColors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
                                        const color = rowColors[idx % rowColors.length];
                                        
                                        return (
                                            <div className="request-card" key={`${req.reqType}-${req.id || idx}`}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                                    <div className={`rc-type-badge type-${(req.reqType || 'leave').toLowerCase()}`}>{req.reqType}</div>
                                                    {req.isDelegated && (
                                                        <span style={{ 
                                                            display: 'inline-flex', 
                                                            alignItems: 'center', 
                                                            gap: '4px', 
                                                            fontSize: '11px', 
                                                            fontWeight: 600, 
                                                            color: '#4338ca', 
                                                            background: '#e0e7ff', 
                                                            padding: '2px 8px', 
                                                            borderRadius: '12px',
                                                            border: '1px solid #c7d2fe'
                                                        }}>
                                                            <Shield size={12} color="#4338ca" />
                                                            Delegated from {req.delegatedFrom || 'Manager'}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="rc-header">
                                                    <div className="u-av" style={{ background: `${color}15`, color: color, width: '40px', height: '40px', fontSize: '13px' }}>
                                                        {initials}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{req.employeeName || `${req.firstName} ${req.lastName}`}</div>
                                                        <div style={{ fontSize: '11px', color: '#64748b' }}>{req.employeeId || req.id} · {req.departmentName || 'Information Technology'}</div>
                                                    </div>
                                                </div>
                                                
                                                <div className="rc-body">
                                                    <div className="rc-row">
                                                        <Calendar size={14} />
                                                        <strong>{req.startDate ? `${req.startDate} - ${req.endDate}` : req.dates || req.submittedAt || req.createdAt}</strong>
                                                        {req.duration && <span style={{ color: '#94a3b8' }}>({req.duration} days)</span>}
                                                        {req.totalDays && <span style={{ color: '#94a3b8' }}>({req.totalDays} days)</span>}
                                                        {req.totalAmount && <span style={{ fontWeight: 700, color: '#0f172a' }}>{formatAmount(req.totalAmount, req.currency)}</span>}
                                                    </div>
                                                    <div className="rc-row">
                                                        <Info size={14} />
                                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {req.reason || req.title || req.leaveType || 'No reason provided'}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                                                        {(() => {
                                                            const reqStatus = (req.reqType === 'LEAVE' ? (isOrgView ? (req.status || 'PENDING') : (req.managerStatus || 'PENDING')) : (req.status || 'PENDING')).toUpperCase();
                                                            const isPending = reqStatus === 'PENDING' || reqStatus === 'SUBMITTED';
                                                            const isApproved = reqStatus === 'APPROVED' || reqStatus === 'ACCEPTED' || reqStatus.includes('APPROV');
                                                            const isSkipped = reqStatus === 'SKIPPED';
                                                            return (
                                                                <span className="stat-badge" style={{ 
                                                                    background: isSkipped ? '#eff6ff' : isPending ? '#fef3c7' : isApproved ? '#dcfce7' : '#fee2e2',
                                                                    color: isSkipped ? '#1d4ed8' : isPending ? '#92400e' : isApproved ? '#166534' : '#991b1b',
                                                                    fontSize: '10px'
                                                                }}>
                                                                    {isSkipped ? 'FORWARDED TO HR' : reqStatus}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>

                                                <div className="rc-actions" style={{ justifyContent: 'flex-end' }}>
                                                    {(() => {
                                                        const reqStatus = (req.reqType === 'LEAVE' ? (isOrgView ? (req.status || 'PENDING') : (req.managerStatus || 'PENDING')) : (req.status || 'PENDING')).toUpperCase();
                                                        const isPending = reqStatus === 'PENDING' || reqStatus === 'SUBMITTED';
                                                        const reqEmpId = String(req.employeeId || req.employee?.employeeId || '').trim().toLowerCase();
                                                        const currentEmpId = String(user?.employeeId || '').trim().toLowerCase();
                                                        const isSelfRequest = Boolean(currentEmpId && reqEmpId && currentEmpId === reqEmpId);

                                                        if (isPending) {
                                                            if (isSelfRequest) {
                                                                return (
                                                                    <span style={{ 
                                                                        fontSize: '11px', 
                                                                        color: '#64748b', 
                                                                        background: '#f1f5f9', 
                                                                        padding: '4px 10px', 
                                                                        borderRadius: '6px', 
                                                                        fontWeight: 600,
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px'
                                                                    }}>
                                                                        Self Request (No Self-Approval)
                                                                    </span>
                                                                );
                                                            }
                                                            return (
                                                                <>
                                                                    <button 
                                                                        className="btn-card btn-card-approve"
                                                                        disabled={submittingAction.id === req.id}
                                                                        onClick={() => {
                                                                            setActiveRequest(req);
                                                                            setDecisionAction('APPROVE');
                                                                            setDecisionComment('');
                                                                            setShowDecisionModal(true);
                                                                        }}
                                                                    >
                                                                        {submittingAction.id === req.id && submittingAction.action?.toUpperCase().includes('APPROV') ? (
                                                                            <RefreshCw size={14} className="animate-spin" />
                                                                        ) : (
                                                                            <CheckCircle size={14} />
                                                                        )}
                                                                        Approve
                                                                    </button>
                                                                    <button 
                                                                        className="btn-card btn-card-reject"
                                                                        disabled={submittingAction.id === req.id}
                                                                        onClick={() => {
                                                                            setActiveRequest(req);
                                                                            setDecisionAction('REJECT');
                                                                            setDecisionComment('');
                                                                            setShowDecisionModal(true);
                                                                        }}
                                                                    >
                                                                        {submittingAction.id === req.id && submittingAction.action?.toUpperCase().includes('REJECT') ? (
                                                                            <RefreshCw size={14} className="animate-spin" />
                                                                        ) : (
                                                                            <X size={14} />
                                                                        )}
                                                                        Reject
                                                                    </button>
                                                                </>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                    <button 
                                                        className="btn-card btn-card-details"
                                                        style={(() => {
                                                            const reqStatus = (req.reqType === 'LEAVE' ? (isOrgView ? (req.status || 'PENDING') : (req.managerStatus || 'PENDING')) : (req.status || 'PENDING')).toUpperCase();
                                                            const isPending = reqStatus === 'PENDING' || reqStatus === 'SUBMITTED';
                                                            return isPending ? {} : { flex: 'none', minWidth: '90px' };
                                                        })()}
                                                        onClick={() => {
                                                            if (req.reqType === 'LEAVE') { setSelectedLeave(req); setShowLeaveDetailModal(true); }
                                                            if (req.reqType === 'WFH') { setSelectedWfh(req); setShowWfhDetailModal(true); }
                                                            if (req.reqType === 'EXPENSE') setExpenseDetail(req);
                                                            if (req.reqType === 'EXIT') {
                                                                setSelectedExitRequest(req);
                                                                setExitLwd(req.lastWorkingDay ? new Date(req.lastWorkingDay).toISOString().split('T')[0] : '');
                                                                setExitManagerComments('');
                                                                setShowExitModal(true);
                                                            }
                                                        }}
                                                    >
                                                        Details
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                );
            })()}

                {activeTab === 'adjustments' && (() => {
                    const term = adjSearchTerm.trim().toLowerCase();
                    const filteredMembers = teamMembers.filter(member => {
                        if (!term) return true;
                        const name = `${member.firstName || ''} ${member.lastName || ''} ${member.fullName || member.name || ''}`.toLowerCase();
                        const empId = String(member.employeeId || member.employeeIdString || member.id || '').toLowerCase();
                        const dept = (member.departmentName || member.department || '').toLowerCase();
                        return name.includes(term) || empId.includes(term) || dept.includes(term);
                    });

                    return (
                        <div className="card mp-card-inset" style={{ padding: '16px 20px', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', background: '#fff', animation: 'fadeIn 0.4s ease-out' }}>
                            <div className="approvals-header" style={{ paddingBottom: '14px', borderBottom: '1px solid #f1f5f9', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                                <div className="approvals-title-group">
                                    <h2 className="approvals-title" style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>Leave Balance Adjustments</h2>
                                    <p className="approvals-sub" style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Manually adjust leave balances for your team members</p>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <div className="team-srch-wrap" style={{ minWidth: 220 }}>
                                        <Search size={14} style={{ color: '#94a3b8' }} />
                                        <input
                                            type="text"
                                            placeholder="Search team members..."
                                            value={adjSearchTerm}
                                            onChange={(e) => setAdjSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <button
                                        className="hr-btn-primary"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0 12px', height: '36px', borderRadius: '6px', fontSize: '12px', fontWeight: 500 }}
                                        onClick={() => setShowAdjustmentModal(true)}
                                    >
                                        <Plus size={14} />
                                        New Adjustment
                                    </button>
                                </div>
                            </div>

                            <div className="adj-alert" style={{ marginBottom: '16px' }}>
                                <Info size={18} style={{ flexShrink: 0 }} />
                                <span>
                                    All leave balance changes are <strong>logged for audit purposes</strong> and cannot be reversed without manager approval.
                                </span>
                            </div>

                            {(loading || (loadingBalances && Object.keys(teamBalances).length === 0 && filteredMembers.length === 0 && teamMembers.length === 0)) ? (
                                <div className="adj-grid">
                                    {[1, 2, 3, 4, 5, 6].map(i => (
                                        <div key={i} className="adj-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div className="nt-skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                                                    <div className="nt-skeleton" style={{ width: '130px', height: '14px', borderRadius: '4px' }} />
                                                    <div className="nt-skeleton" style={{ width: '100px', height: '10px', borderRadius: '4px' }} />
                                                </div>
                                                <div className="nt-skeleton" style={{ width: '50px', height: '18px', borderRadius: '12px' }} />
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                                <div className="nt-skeleton" style={{ height: '44px', borderRadius: '6px' }} />
                                                <div className="nt-skeleton" style={{ height: '44px', borderRadius: '6px' }} />
                                                <div className="nt-skeleton" style={{ height: '44px', borderRadius: '6px' }} />
                                                <div className="nt-skeleton" style={{ height: '44px', borderRadius: '6px' }} />
                                            </div>
                                            <div className="nt-skeleton" style={{ width: '100%', height: '34px', borderRadius: '6px' }} />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="adj-grid">
                                    {filteredMembers.length === 0 ? (
                                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 24px', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #e2e8f0' }}>
                                            <Users size={36} style={{ color: '#cbd5e1', marginBottom: '10px' }} />
                                            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                                                {term
                                                    ? 'No employees found matching your search'
                                                    : (teamMembers.length === 0
                                                        ? 'No team members found. Make sure reporting lines are set up for your reportees.'
                                                        : 'No employees to show.')}
                                            </p>
                                            {term && (
                                                <button
                                                    type="button"
                                                    className="lv-btn-outline"
                                                    style={{ marginTop: 12 }}
                                                    onClick={() => setAdjSearchTerm('')}
                                                >
                                                    Clear search
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        filteredMembers.map((member, idx) => {
                                            const initials = `${member.firstName?.[0] || (member.fullName || member.name || 'E')[0] || 'E'}${member.lastName?.[0] || ''}`.toUpperCase();
                                            const empId = member.employeeId || member.employeeIdString || member.id;
                                            const empIdNorm = String(empId).toUpperCase();
                                            
                                            // Use real balances if available
                                            const balances = teamBalances[empIdNorm] || {};
                                            // Mapping based on common leave type codes in the system
                                            const annualLeave = balances['ANNUAL_LEAVE'] || balances['AL'] || 0;
                                            const annualQuota = balances['ANNUAL_LEAVE_QUOTA'] || balances['AL_QUOTA'] || 0;
                                            const sickLeave = balances['SICK_LEAVE'] || balances['SL'] || 0;
                                            const sickQuota = balances['SICK_LEAVE_QUOTA'] || balances['SL_QUOTA'] || 0;
                                            const displayName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.fullName || member.name || empId;

                                            return (
                                                <div key={empId || idx} className="adj-card">
                                                    <div className="adj-card-top">
                                                        <div className="adj-emp-group">
                                                            <div className="adj-avatar" style={{ 
                                                                background: `linear-gradient(135deg, ${['#6366f1', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'][idx % 6]}, ${['#4f46e5', '#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626'][idx % 6]})`
                                                            }}>
                                                                {initials}
                                                            </div>
                                                            <div className="adj-name-info">
                                                                <div className="adj-emp-name">{displayName}</div>
                                                                <div className="adj-emp-meta">{empId} • {member.departmentName || member.department || '—'}</div>
                                                            </div>
                                                        </div>
                                                        <span className="adj-badge">Active</span>
                                                    </div>

                                                    <div className="adj-stats-grid">
                                                        <div className="adj-stat-box">
                                                            <div className="adj-stat-val" style={{ color: '#10b981' }}>{annualLeave}</div>
                                                            <div className="adj-stat-lbl">Annual Available</div>
                                                        </div>
                                                        <div className="adj-stat-box">
                                                            <div className="adj-stat-val" style={{ color: '#64748b' }}>{annualQuota - annualLeave}</div>
                                                            <div className="adj-stat-lbl">Annual Consumed</div>
                                                        </div>
                                                        <div className="adj-stat-box">
                                                            <div className="adj-stat-val" style={{ color: '#8b5cf6' }}>{sickLeave}</div>
                                                            <div className="adj-stat-lbl">Sick Available</div>
                                                        </div>
                                                        <div className="adj-stat-box">
                                                            <div className="adj-stat-val" style={{ color: '#64748b' }}>{sickQuota - sickLeave}</div>
                                                            <div className="adj-stat-lbl">Sick Consumed</div>
                                                        </div>
                                                    </div>

                                                    <button
                                                        className="adj-btn-full"
                                                        onClick={() => {
                                                            setAdjustmentForm(prev => ({ ...prev, employeeId: empId }));
                                                            setShowAdjustmentModal(true);
                                                        }}
                                                    >
                                                        <RefreshCw size={14} />
                                                        Adjust Balance
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })()}

                {activeTab === 'delegations' && (() => {
                    const rawAssigned = myDelegations?.assignedByMe || [];
                    const rawReceived = myDelegations?.delegatedToMe || [];

                    const assigned = filterActiveDelegations 
                        ? rawAssigned.filter(d => d.status === 'ACTIVE') 
                        : rawAssigned;
                    const received = filterActiveDelegations 
                        ? rawReceived.filter(d => d.status === 'ACTIVE') 
                        : rawReceived;

                    return (
                        <div className="card mp-card-inset" style={{ padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '12px', background: '#fff', animation: 'fadeIn 0.3s ease-out' }}>
                            <div className="approvals-header" style={{ paddingBottom: '16px', borderBottom: '1px solid #f1f5f9', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                                <div className="approvals-title-group">
                                    <h2 className="approvals-title" style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Shield size={18} color="#4f46e5" />
                                        Approval Delegation
                                    </h2>
                                    <p className="approvals-sub" style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                                        Temporarily delegate your approval authorities (Leave, WFH, Expense, Timesheet, Exit) to peer managers or team members while on leave or traveling.
                                    </p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', cursor: 'pointer', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                        <input
                                            type="checkbox"
                                            checked={filterActiveDelegations}
                                            onChange={(e) => setFilterActiveDelegations(e.target.checked)}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        Active Rules Only
                                    </label>
                                    <button
                                        type="button"
                                        className="hr-btn-primary"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0 14px', height: '36px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}
                                        onClick={() => {
                                            fetchDelegations();
                                            setShowDelegationModal(true);
                                        }}
                                    >
                                        <Plus size={16} />
                                        + Add Delegation
                                    </button>
                                </div>
                            </div>

                            {/* Section 1: Delegations Assigned by Me */}
                            <div style={{ marginBottom: '32px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                                        My Outgoing Delegations (Authority I Delegated)
                                    </h3>
                                    <span style={{ fontSize: '12px', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '10px' }}>
                                        {assigned.length} {filterActiveDelegations ? 'active' : ''} rule{assigned.length !== 1 ? 's' : ''}
                                    </span>
                                </div>

                                {assigned.length === 0 ? (
                                    <div style={{ padding: '32px', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                                            You currently have no outgoing delegation rules. Click <strong>+ Add Delegation</strong> above to assign temporary approval rights.
                                        </p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                                        {assigned.map((del) => {
                                            const isActive = del.status === 'ACTIVE';
                                            const isExpired = del.status === 'EXPIRED';
                                            const isRevoked = del.status === 'REVOKED';

                                            return (
                                                <div key={del.id} style={{ 
                                                    border: '1px solid #e2e8f0', 
                                                    borderRadius: '10px', 
                                                    padding: '16px', 
                                                    background: isActive ? '#faf5ff' : '#ffffff',
                                                    position: 'relative'
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                        <div>
                                                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                                                                {del.delegateeName || del.delegateeEmployeeCode}
                                                            </div>
                                                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                                                                {del.delegateeEmployeeCode} {del.delegateeDesignation ? `• ${del.delegateeDesignation}` : ''}
                                                            </div>
                                                        </div>
                                                        <span style={{ 
                                                            fontSize: '11px', 
                                                            fontWeight: 600, 
                                                            padding: '2px 8px', 
                                                            borderRadius: '12px',
                                                            background: isActive ? '#dcfce7' : isRevoked ? '#fee2e2' : '#f1f5f9',
                                                            color: isActive ? '#166534' : isRevoked ? '#991b1b' : '#64748b'
                                                        }}>
                                                            {del.status}
                                                        </span>
                                                    </div>

                                                    <div style={{ fontSize: '12px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '4px', margin: '12px 0' }}>
                                                        <div><strong>Period:</strong> {del.startDate} to {del.endDate}</div>
                                                        <div><strong>Scope:</strong> <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>{del.scope}</span></div>
                                                        {del.reason && <div><strong>Reason:</strong> {del.reason}</div>}
                                                    </div>

                                                    {isActive && (
                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-danger"
                                                                style={{ height: '28px', padding: '0 10px', fontSize: '11px' }}
                                                                onClick={() => handleRevokeDelegation(del.id)}
                                                            >
                                                                Revoke Early
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Section 2: Delegations Received by Me */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                                        Delegated to Me (Authority I Received from Peers)
                                    </h3>
                                    <span style={{ fontSize: '12px', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '10px' }}>
                                        {received.length} {filterActiveDelegations ? 'active' : ''} rule{received.length !== 1 ? 's' : ''}
                                    </span>
                                </div>

                                {received.length === 0 ? (
                                    <div style={{ padding: '32px', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                                            {filterActiveDelegations 
                                                ? 'No peer manager has currently active delegated approval rights to you. Uncheck "Active Rules Only" to see history.' 
                                                : 'No peer manager has delegated approval rights to you.'}
                                        </p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                                        {received.map((del) => (
                                            <div key={del.id} style={{ 
                                                border: '1px solid #e2e8f0', 
                                                borderRadius: '10px', 
                                                padding: '16px', 
                                                background: del.status === 'ACTIVE' ? '#eff6ff' : '#ffffff' 
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                                                            {del.delegatorName || del.delegatorEmployeeCode}
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                                                            Manager {del.delegatorEmployeeCode} {del.delegatorDesignation ? `• ${del.delegatorDesignation}` : ''}
                                                        </div>
                                                    </div>
                                                    <span style={{ 
                                                        fontSize: '11px', 
                                                        fontWeight: 600, 
                                                        padding: '2px 8px', 
                                                        borderRadius: '12px',
                                                        background: del.status === 'ACTIVE' ? '#dcfce7' : '#f1f5f9',
                                                        color: del.status === 'ACTIVE' ? '#166534' : '#64748b'
                                                    }}>
                                                        {del.status}
                                                    </span>
                                                </div>

                                                <div style={{ fontSize: '12px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '4px', margin: '12px 0' }}>
                                                    <div><strong>Period:</strong> {del.startDate} to {del.endDate}</div>
                                                    <div><strong>Scope:</strong> <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>{del.scope}</span></div>
                                                    {del.reason && <div><strong>Reason:</strong> {del.reason}</div>}
                                                </div>

                                                {del.status === 'ACTIVE' && (
                                                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #e0e7ff', fontSize: '11px', color: '#1d4ed8' }}>
                                                        🛡️ You have authority to review and approve their team's requests under the <strong>Approvals</strong> tab.
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}

                {activeTab === 'timesheets' && (() => {
                    const allTs = allTeamTimesheets.filter(ts => {
                        const status = (ts.status || '').toUpperCase();
                        if (status === 'DRAFT') return false;

                        if (!timesheetWeekFilter) return true;
                        const weekValue = ts.weekStartDate || ts.weekStart;
                        if (!weekValue) return false;
                        const normalize = (val) => String(val).match(/^(\d{4}-\d{2}-\d{2})/) ? String(val).match(/^(\d{4}-\d{2}-\d{2})/)[1] : String(val).trim();
                        return normalize(weekValue) === normalize(timesheetWeekFilter);
                    });

                    // Dynamic counts
                    const counts = {
                        all: allTs.length,
                        draft: allTs.filter(ts => (ts.status || '').toUpperCase() === 'DRAFT').length,
                        submitted: allTs.filter(ts => {
                            const tsStatus = (ts.status || '').toUpperCase();
                            if (tsStatus === 'SUBMITTED' || tsStatus === 'PENDING') return true;
                            return (ts.entries || []).some(e => {
                                const isApp = Boolean(e.approved) || e.status === 'APPROVED';
                                const isRej = Boolean(e.rejected) || e.status === 'REJECTED';
                                const isCan = e.isCancelled || e.cancelled || e.status === 'CANCELLED';
                                return !isApp && !isRej && !isCan && e.status !== 'DRAFT';
                            });
                        }).length,
                        approved: allTs.filter(ts => 
                            (ts.status || '').toUpperCase() === 'APPROVED' ||
                            (ts.entries || []).some(e => Boolean(e.approved) || e.status === 'APPROVED')
                        ).length,
                        rejected: allTs.filter(ts => 
                            (ts.status || '').toUpperCase() === 'REJECTED' ||
                            (ts.entries || []).some(e => Boolean(e.rejected) || e.status === 'REJECTED')
                        ).length
                    };

                    const displayTs = (() => {
                        const tab = timesheetSubTab.toUpperCase();
                        if (tab === 'ALL') return allTs;
                        if (tab === 'SUBMITTED') return allTs.filter(ts => {
                            const tsStatus = (ts.status || '').toUpperCase();
                            if (tsStatus === 'SUBMITTED' || tsStatus === 'PENDING') return true;
                            return (ts.entries || []).some(e => {
                                const isApp = Boolean(e.approved) || e.status === 'APPROVED';
                                const isRej = Boolean(e.rejected) || e.status === 'REJECTED';
                                const isCan = e.isCancelled || e.cancelled || e.status === 'CANCELLED';
                                return !isApp && !isRej && !isCan && e.status !== 'DRAFT';
                            });
                        });
                        if (tab === 'APPROVED') return allTs.filter(ts => 
                            (ts.status || '').toUpperCase() === 'APPROVED' ||
                            (ts.entries || []).some(e => Boolean(e.approved) || e.status === 'APPROVED')
                        );
                        if (tab === 'REJECTED') return allTs.filter(ts => 
                            (ts.status || '').toUpperCase() === 'REJECTED' ||
                            (ts.entries || []).some(e => Boolean(e.rejected) || e.status === 'REJECTED')
                        );
                        return allTs.filter(ts => (ts.status || '').toUpperCase() === tab);
                    })();

                    return (
                        <div className="card mp-card-inset" style={{ padding: '16px 20px', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', background: '#fff' }}>
                            <div className="approvals-header" style={{ paddingBottom: '14px', borderBottom: '1px solid #f1f5f9', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                                <div className="approvals-title-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <h2 className="approvals-title" style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Timesheet Approvals</h2>
                                    <div className="ts-filters" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0, padding: 0 }}>
                                        {['All', 'Submitted', 'Approved', 'Rejected'].map(f => (
                                            <div 
                                                key={f} 
                                                className={`ts-chip ${timesheetSubTab.toUpperCase() === f.toUpperCase() ? 'active' : ''}`}
                                                onClick={() => setTimesheetSubTab(f.toUpperCase())}
                                                style={{ height: '30px', padding: '0 10px', fontSize: '12px', cursor: 'pointer' }}
                                            >
                                                {f} <span className="tc">{counts[f.toLowerCase()]}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Month:</label>
                                        <select
                                            value={timesheetMonthFilter}
                                            onChange={(e) => {
                                                setTimesheetMonthFilter(e.target.value);
                                                const [year, month] = e.target.value.split('-');
                                                const firstDay = new Date(parseInt(year), parseInt(month) - 1, 1);
                                                const day = firstDay.getDay();
                                                const diff = firstDay.getDate() - day + (day === 0 ? -6 : 1);
                                                const monday = new Date(firstDay.getFullYear(), firstDay.getMonth(), diff);
                                                const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
                                                setTimesheetWeekFilter(weekStart);
                                            }}
                                            style={{
                                                padding: '0 8px',
                                                height: '30px',
                                                fontSize: '12px',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '6px',
                                                background: '#fff',
                                                fontWeight: 600,
                                                minWidth: '130px',
                                                boxSizing: 'border-box'
                                            }}
                                        >
                                            {Array.from({ length: 12 }).map((_, i) => {
                                                const today = new Date();
                                                const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
                                                const monthValue = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
                                                return (
                                                    <option key={monthValue} value={monthValue}>
                                                        {monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Week:</label>
                                        <select
                                            value={timesheetWeekFilter}
                                            onChange={(e) => setTimesheetWeekFilter(e.target.value)}
                                            style={{
                                                padding: '0 8px',
                                                height: '30px',
                                                fontSize: '12px',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '6px',
                                                background: '#fff',
                                                fontWeight: 600,
                                                minWidth: '160px',
                                                boxSizing: 'border-box'
                                            }}
                                        >
                                            <option value="">All Weeks</option>
                                            {(() => {
                                                const [year, month] = timesheetMonthFilter.split('-');
                                                const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                                                const weeks = [];
                                                const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
                                                const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
                                                
                                                let current = new Date(firstDay);
                                                const day = current.getDay();
                                                const diff = current.getDate() - day + (day === 0 ? -6 : 1);
                                                current.setDate(diff);
                                                
                                                while (current <= lastDay) {
                                                    const weekStart = new Date(current);
                                                    const weekEnd = new Date(current);
                                                    weekEnd.setDate(weekEnd.getDate() + 6);
                                                    
                                                    if (weekEnd > lastDay) {
                                                        weekEnd.setTime(lastDay.getTime());
                                                    }
                                                    
                                                    const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
                                                    weeks.push({
                                                        value: weekStartStr,
                                                        label: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                                                    });
                                                    
                                                    current.setDate(current.getDate() + 7);
                                                }
                                                
                                                return weeks.map(week => (
                                                    <option key={week.value} value={week.value}>
                                                        {week.label}
                                                    </option>
                                                ));
                                            })()}
                                        </select>
                                    </div>
                                    <button className="btn" onClick={fetchPendingTimesheets} style={{ height: '30px', padding: '0 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <RefreshCw size={12} className={timesheetLoading ? 'animate-spin' : ''} /> Refresh
                                    </button>
                                </div>
                            </div>

                            <div className="ts-list">
                                {timesheetLoading ? (
                                    <div style={{ textAlign: 'center', padding: '100px' }}>
                                        <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid #f1f5f9', borderTop: '4px solid #1a4ff0', borderRadius: '50%', margin: '0 auto 16px' }}></div>
                                        <p style={{ color: '#64748b', fontWeight: 500 }}>Fetching timesheets...</p>
                                    </div>
                                ) : displayTs.length === 0 ? (
                                    <div style={{ margin: '0 24px', textAlign: 'center', padding: '80px', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #e2e8f0' }}>
                                        <div style={{ fontSize: '32px', marginBottom: '16px' }}>🌫️</div>
                                        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#334155' }}>No {timesheetSubTab.toLowerCase()} timesheets</h3>
                                        <p style={{ fontSize: '14px', color: '#64748b' }}>Try changing the week or status filter</p>
                                    </div>
                                ) : (() => {
                                    // Group timesheets by employee
                                    const groupedByEmployee = displayTs.reduce((acc, ts) => {
                                        const empKey = ts.employeeIdString || ts.employeeId || ts.employeeName;
                                        if (!acc[empKey]) {
                                            acc[empKey] = {
                                                employeeName: ts.employeeName,
                                                employeeId: ts.employeeIdString || ts.employeeId,
                                                timesheets: []
                                            };
                                        }
                                        acc[empKey].timesheets.push(ts);
                                        return acc;
                                    }, {});

                                    // Sort employees by name
                                    const sortedEmployees = Object.values(groupedByEmployee).sort((a, b) => 
                                        a.employeeName.localeCompare(b.employeeName)
                                    );

                                    return sortedEmployees.map((empGroup, empIdx) => {
                                        const initials = empGroup.employeeName?.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'EM';
                                        const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                                        const color = colors[empIdx % colors.length];

                                        // Sort timesheets by week start date (newest first)
                                        const sortedTimesheets = empGroup.timesheets.sort((a, b) => 
                                            new Date(b.weekStartDate) - new Date(a.weekStartDate)
                                        );

                                        return (
                                            <div key={empGroup.employeeId || empIdx} style={{ marginBottom: '24px' }}>
                                                {/* Employee Header */}
                                                <div style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    gap: '12px', 
                                                    padding: '16px 24px', 
                                                    background: '#f8fafc', 
                                                    borderRadius: '12px',
                                                    marginBottom: '12px',
                                                    border: '1px solid #e2e8f0'
                                                }}>
                                                    <div className="u-av" style={{ background: `${color}15`, color: color, width: '48px', height: '48px', fontSize: '16px' }}>
                                                        {initials}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{empGroup.employeeName}</div>
                                                        <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>{empGroup.employeeId}</div>
                                                    </div>
                                                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                                                        {sortedTimesheets.length} {sortedTimesheets.length === 1 ? 'week' : 'weeks'}
                                                    </div>
                                                </div>
                                                {/* Timesheet Cards for this Employee */}
                                                {sortedTimesheets.map((ts, tsIdx) => {
                                                    const status = (ts.status || '').toUpperCase();
                                                    
                                                    // Filter entries dynamically based on selected tab
                                                    const subTab = timesheetSubTab.toUpperCase();
                                                    const filteredEntries = (ts.entries || []).filter(e => {
                                                        const isEntryCancelled = e.isCancelled || e.cancelled || e.status === 'CANCELLED';
                                                        if (isEntryCancelled) {
                                                            return subTab === 'ALL' || subTab === 'CANCELLED';
                                                        }
                                                        const isApproved = Boolean(e.approved) || e.status === 'APPROVED';
                                                        const isRejected = Boolean(e.rejected) || e.status === 'REJECTED';
                                                        if (subTab === 'SUBMITTED') {
                                                            return !isApproved && !isRejected && e.status !== 'DRAFT';
                                                        }
                                                        if (subTab === 'APPROVED') {
                                                            return isApproved;
                                                        }
                                                        if (subTab === 'REJECTED') {
                                                            return isRejected;
                                                        }
                                                        return true; // 'ALL' tab
                                                    });

                                                    // Calculate billable and non-billable hours from filtered entries
                                                    const billableHours = filteredEntries.reduce((sum, e) => 
                                                        e.billable ? sum + getTimesheetEntryHours(e) : sum, 0
                                                    );
                                                    const nonBillableHours = filteredEntries.reduce((sum, e) => 
                                                        !e.billable ? sum + getTimesheetEntryHours(e) : sum, 0
                                                    );
                                                    const totalHours = billableHours + nonBillableHours;
                                                    
                                                    return (
                                                        <div className="ts-card" key={ts.id || tsIdx} style={{ borderLeftColor: status === 'APPROVED' ? '#10b981' : status === 'REJECTED' ? '#ef4444' : '#e2e8f0', margin: '0 24px 12px 24px' }}>
                                                            <div className="ts-card-body">
                                                                <div className="ts-col" style={{ minWidth: '200px' }}>
                                                                    <div className="ts-week-lbl" style={{ fontSize: '11px' }}>Week</div>
                                                                    <div className="ts-week-val" style={{ fontSize: '12px' }}>
                                                                        {new Date(ts.weekStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(ts.weekEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                    </div>
                                                                    <div className="ts-day-bars" style={{ height: '24px' }}>
                                                                        {(() => {
                                                                            const dayData = Array(7).fill(0).map(() => ({ billable: 0, nonBillable: 0 }));
                                                                            filteredEntries.forEach(e => {
                                                                                const dateValue = e.workDate || e.date || e.entryDate;
                                                                                if (!dateValue) return;
                                                                                const dateObj = new Date(dateValue);
                                                                                if (isNaN(dateObj.getTime())) return;
                                                                                const day = dateObj.getDay();
                                                                                const adjDay = day === 0 ? 6 : day - 1;
                                                                                const hrs = getTimesheetEntryHours(e);
                                                                                if (dayData[adjDay]) {
                                                                                    if (e.billable) dayData[adjDay].billable += hrs;
                                                                                    else dayData[adjDay].nonBillable += hrs;
                                                                                }
                                                                            });
                                                                            const overallMax = Math.max(...dayData.map(d => d.billable + d.nonBillable), 8);
                                                                            
                                                                            return dayData.map((d, i) => {
                                                                                const total = d.billable + d.nonBillable;
                                                                                return (
                                                                                    <div key={i} className="ts-db" style={{ height: total > 0 ? `${(total / overallMax) * 100}%` : '4px' }} title={`Billable: ${formatHoursAndMinutes(d.billable)}, Non-billable: ${formatHoursAndMinutes(d.nonBillable)}`}>
                                                                                        <div className="ts-bar-nb" style={{ height: total > 0 ? `${(d.nonBillable / total) * 100}%` : '0%' }}></div>
                                                                                        <div className="ts-bar-bill" style={{ height: total > 0 ? `${(d.billable / total) * 100}%` : '0%' }}></div>
                                                                                    </div>
                                                                                );
                                                                            });
                                                                        })()}
                                                                    </div>
                                                                </div>
 
                                                                <div className="ts-col" style={{ minWidth: '100px', textAlign: 'center' }}>
                                                                    <div className="ts-hrs-num" style={{ fontSize: '20px' }}>{formatHoursAndMinutes(totalHours)}</div>
                                                                    <div className="ts-hrs-lbl" style={{ fontSize: '11px' }}>Total Hours</div>
                                                                    <div style={{ marginTop: '2px', fontSize: '10px', color: '#64748b' }}>
                                                                        <span style={{ color: '#10b981', fontWeight: 600 }}>{formatHoursAndMinutes(billableHours)}</span> bill
                                                                    </div>
                                                                    <div style={{ fontSize: '10px', color: '#64748b' }}>
                                                                        <span style={{ color: '#ef4444', fontWeight: 600 }}>{formatHoursAndMinutes(nonBillableHours)}</span> non-bill
                                                                    </div>
                                                                </div>

                                                                <div className="ts-col" style={{ minWidth: '120px' }}>
                                                                    <div className="ts-week-lbl" style={{ fontSize: '11px' }}>Submitted</div>
                                                                    <div className="ts-week-val" style={{ fontSize: '12px' }}>{ts.submittedAt ? new Date(ts.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</div>
                                                                    <div style={{ marginTop: '4px' }}>
                                                                        <span className="stat-badge" style={{ 
                                                                            background: status === 'APPROVED' ? '#dcfce7' : status === 'REJECTED' ? '#fee2e2' : status === 'DRAFT' ? '#f1f5f9' : '#eff6ff',
                                                                            color: status === 'APPROVED' ? '#166534' : status === 'REJECTED' ? '#991b1b' : status === 'DRAFT' ? '#475569' : '#1e40af',
                                                                            fontSize: '9px',
                                                                            padding: '2px 6px'
                                                                        }}>
                                                                            {status || 'SUBMITTED'}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <div className="ts-col ts-act-col" style={{ borderRight: 'none', flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', paddingRight: '24px' }}>
                                                                    {status === 'SUBMITTED' && timesheetSubTab.toUpperCase() !== 'APPROVED' && (
                                                                        <button 
                                                                            className="btn-ts btn-ts-approve"
                                                                            disabled={submittingAction.id === ts.id}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleTimesheetApprove(ts.id);
                                                                            }}
                                                                            style={{ 
                                                                                fontSize: '12px', 
                                                                                height: '38px',
                                                                                minWidth: '140px',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                gap: '8px',
                                                                                borderRadius: '10px' 
                                                                            }}
                                                                        >
                                                                            {submittingAction.id === ts.id ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />} Approve All
                                                                        </button>
                                                                    )}
                                                                    <button 
                                                                        className="btn-ts btn-ts-view" 
                                                                        style={{ 
                                                                            fontSize: '12px', 
                                                                            height: '38px',
                                                                            minWidth: '140px',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            gap: '8px',
                                                                            borderRadius: '10px', 
                                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)' 
                                                                        }}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const subTab = timesheetSubTab.toUpperCase();
                                                                            const filtered = (ts.entries || []).filter(entry => {
                                                                                const isEntryCancelled = entry.isCancelled || entry.cancelled || entry.status === 'CANCELLED';
                                                                                if (isEntryCancelled) {
                                                                                    return subTab === 'ALL' || subTab === 'CANCELLED';
                                                                                }
                                                                                const isApproved = Boolean(entry.approved) || entry.status === 'APPROVED';
                                                                                const isRejected = Boolean(entry.rejected) || entry.status === 'REJECTED';
                                                                                if (subTab === 'SUBMITTED') {
                                                                                    return !isApproved && !isRejected && entry.status !== 'DRAFT';
                                                                                }
                                                                                if (subTab === 'APPROVED') {
                                                                                    return isApproved;
                                                                                }
                                                                                if (subTab === 'REJECTED') {
                                                                                    return isRejected;
                                                                                }
                                                                                return true;
                                                                            });
                                                                            setSelectedEntries(filtered);
                                                                            setSelectedTsInfo(ts);
                                                                            setShowEntriesModal(true);
                                                                        }}
                                                                    >
                                                                        <Eye size={14} /> View Details
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    );
                })()}
                {activeTab === 'tasks' && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Team Tasks</h3>
                        </div>
                        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                            <div style={{ 
                                backgroundColor: 'var(--primary-50)', 
                                width: '64px', 
                                height: '64px', 
                                borderRadius: '50%', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                margin: '0 auto 20px'
                            }}>
                                <CheckSquare size={32} style={{ color: 'var(--primary-600)' }} />
                            </div>
                            <h4 style={{ marginBottom: '8px' }}>Task Management</h4>
                            <p style={{ color: 'var(--gray-500)', maxWidth: '400px', margin: '0 auto' }}>
                                Team task overview and assignments are currently managed through the Planner.
                            </p>
                            <button 
                                className="hr-btn-primary" 
                                style={{ marginTop: '24px' }}
                                onClick={() => navigate(isAdminUser ? '/admin/planner' : '/employee/planner')}
                            >
                                Go to Planner
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'documents' && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Employee Documents</h3>
                        </div>
                        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                            <div style={{ 
                                backgroundColor: 'var(--primary-50)', 
                                width: '64px', 
                                height: '64px', 
                                borderRadius: '50%', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                margin: '0 auto 20px'
                            }}>
                                <FileText size={32} style={{ color: 'var(--primary-600)' }} />
                            </div>
                            <h4 style={{ marginBottom: '8px' }}>Document Verification</h4>
                            <p style={{ color: 'var(--gray-500)', maxWidth: '400px', margin: '0 auto' }}>
                                View and verify documents uploaded by your team members.
                            </p>
                            <p style={{ color: 'var(--gray-400)', fontSize: '13px', marginTop: '12px' }}>
                                This feature is being enhanced to provide a better verification experience.
                            </p>
                        </div>
                    </div>
                )}

                {activeTab === 'asset-management' && (() => {
                    return (
                        <div className="card mp-card-inset" style={{ padding: '16px 20px', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', background: '#fff' }}>
                            <div className="approvals-header" style={{ paddingBottom: '14px', borderBottom: '1px solid #f1f5f9', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                                <div className="approvals-title-group">
                                    <h2 className="approvals-title" style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>Team Asset Management</h2>
                                    <p className="approvals-sub" style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Track active return requests, status updates, and exit clearances for team assets</p>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="btn" onClick={fetchTeamAssets} style={{ height: '30px', padding: '0 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <RefreshCw size={12} className={loadingTeamAssets ? 'animate-spin' : ''} /> Refresh
                                    </button>
                                </div>
                            </div>

                            {((loadingTeamAssets || loadingTickets || loadingHandovers) && teamAssets.length === 0 && teamTickets.length === 0 && assignedHandovers.length === 0) ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px', padding: '0 4px 16px' }}>
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="asset-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div className="nt-skeleton" style={{ width: '120px', height: '14px', borderRadius: '4px' }} />
                                                <div className="nt-skeleton" style={{ width: '70px', height: '18px', borderRadius: '12px' }} />
                                            </div>
                                            <div className="nt-skeleton" style={{ width: '160px', height: '16px', borderRadius: '4px' }} />
                                            <div className="nt-skeleton" style={{ width: '100%', height: '12px', borderRadius: '4px' }} />
                                            <div className="nt-skeleton" style={{ width: '140px', height: '10px', borderRadius: '4px' }} />
                                            <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                                                <div className="nt-skeleton" style={{ flex: 1, height: '28px', borderRadius: '6px' }} />
                                                <div className="nt-skeleton" style={{ flex: 1, height: '28px', borderRadius: '6px' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    {assignedHandovers.length > 0 && (
                                        <div style={{ marginBottom: '20px' }}>
                                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', padding: '0 4px' }}>
                                                Exit Asset Clearances ({assignedHandovers.length})
                                            </div>
                                            <div className="asset-grid">
                                                {assignedHandovers.map((handover) => (
                                                    <div className="asset-card" key={handover.id}>
                                                        <div className="asset-top">
                                                            <div>
                                                                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                                                                    {handover.employeeName || 'Exiting Employee'}
                                                                </div>
                                                                <div style={{ fontSize: '10px', color: '#64748b' }}>
                                                                    {handover.employeeEmployeeId || '—'} · LWD {handover.lastWorkingDay ? new Date(handover.lastWorkingDay).toLocaleDateString() : 'TBD'}
                                                                </div>
                                                            </div>
                                                            <div className="asset-count">{(handover.assetItems || []).length} Items</div>
                                                        </div>
                                                        <div className="asset-actions">
                                                            <button
                                                                className="btn-asset btn-asset-view"
                                                                onClick={() => {
                                                                    setSelectedHandover(handover);
                                                                    setShowHandoverModal(true);
                                                                }}
                                                            >
                                                                View All
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {teamTickets.filter(t => t?.status !== 'CLOSED').length > 0 && (
                                        <div style={{ marginBottom: '20px' }}>
                                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', padding: '0 4px' }}>
                                                Asset Support Tickets ({teamTickets.filter(t => t?.status !== 'CLOSED').length})
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px', padding: '0 4px' }}>
                                                {teamTickets.filter(t => t?.status !== 'CLOSED').map((ticket) => (
                                                    <div className="asset-card" key={ticket.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px 18px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                            <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                                                                {ticket.ticketNumber} · <span style={{ color: '#4f46e5' }}>{ticket.ticketType || 'REPAIR'}</span>
                                                            </span>
                                                            <span style={{ 
                                                                fontSize: '11px', 
                                                                fontWeight: 700, 
                                                                color: ticket.status === 'OPEN' ? '#b45309' : ticket.status === 'IN_PROGRESS' ? '#1e40af' : '#15803d', 
                                                                background: ticket.status === 'OPEN' ? '#fef3c7' : ticket.status === 'IN_PROGRESS' ? '#dbeafe' : '#dcfce7', 
                                                                padding: '2px 8px', 
                                                                borderRadius: '999px',
                                                                textTransform: 'uppercase'
                                                            }}>
                                                                {ticket.status}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                                                            {ticket.subject}
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                                                            {ticket.description}
                                                        </div>
                                                        <div className="asset-card-meta" style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                            {ticket.assetName} ({ticket.assetCode || 'AST-N/A'}) · Priority: <span style={{ fontWeight: 700 }}>{ticket.priority || 'MEDIUM'}</span>
                                                        </div>
                                                        <div style={{ fontSize: '11px', color: '#64748b', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px' }}>
                                                            Raised by: <strong>{ticket.raisedByName || ticket.raisedByUsername}</strong>
                                                        </div>
                                                        {ticket.imageUrl && (
                                                            <div style={{ marginTop: '8px' }}>
                                                                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>Issue Attachment:</div>
                                                                {ticket.imageUrl.toLowerCase().endsWith('.pdf') ? (
                                                                    <a href={ticket.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 600, textDecoration: 'underline' }}>View PDF Attachment</a>
                                                                ) : (
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <a href={ticket.imageUrl} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                                                                            <img 
                                                                                src={ticket.imageUrl} 
                                                                                alt="Issue Preview" 
                                                                                style={{ width: '60px', height: '60px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #e2e8f0' }} 
                                                                            />
                                                                        </a>
                                                                        <a href={ticket.imageUrl} target="_blank" rel="noreferrer" style={{ 
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            padding: '4px 8px', 
                                                                            borderRadius: '4px', 
                                                                            background: '#4f46e5', 
                                                                            color: '#ffffff', 
                                                                            fontSize: '10px', 
                                                                            fontWeight: 600, 
                                                                            textDecoration: 'none',
                                                                            boxShadow: '0 1px 3px rgba(79, 70, 229, 0.15)'
                                                                        }}>
                                                                            View Attachment
                                                                        </a>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                        {ticket.resolutionImageUrl && (
                                                            <div style={{ marginTop: '8px' }}>
                                                                <div style={{ fontSize: '11px', color: '#15803d', marginBottom: '4px', fontWeight: 600 }}>Resolution Attachment:</div>
                                                                {ticket.resolutionImageUrl.toLowerCase().endsWith('.pdf') ? (
                                                                    <a href={ticket.resolutionImageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#15803d', fontWeight: 600, textDecoration: 'underline' }}>View PDF Resolution</a>
                                                                ) : (
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <a href={ticket.resolutionImageUrl} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                                                                            <img 
                                                                                src={ticket.resolutionImageUrl} 
                                                                                alt="Resolution Preview" 
                                                                                style={{ width: '60px', height: '60px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #dcfce7' }} 
                                                                            />
                                                                        </a>
                                                                        <a href={ticket.resolutionImageUrl} target="_blank" rel="noreferrer" style={{ 
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            padding: '4px 8px', 
                                                                            borderRadius: '4px', 
                                                                            background: '#15803d', 
                                                                            color: '#ffffff', 
                                                                            fontSize: '10px', 
                                                                            fontWeight: 600, 
                                                                            textDecoration: 'none',
                                                                            boxShadow: '0 1px 3px rgba(21, 128, 61, 0.15)'
                                                                        }}>
                                                                            View Resolution
                                                                        </a>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                        {ticket.resolutionNotes && (
                                                            <div style={{ fontSize: '11px', color: '#15803d', background: '#dcfce7', padding: '6px 10px', borderRadius: '6px', marginTop: '6px' }}>
                                                                Resolution: <strong>{ticket.resolutionNotes}</strong>
                                                            </div>
                                                        )}
                                                        <div className="asset-card-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderTop: '1px solid #f1f5f9', paddingTop: '10px', marginTop: '4px' }}>
                                                            {['IN_PROGRESS', 'RESOLVED', 'CLOSED'].filter((s) => s !== ticket.status).map((s) => (
                                                                <button 
                                                                    key={s} 
                                                                    type="button" 
                                                                    onClick={() => handleUpdateTicketStatus(ticket, s)}
                                                                    style={{
                                                                        padding: '4px 8px',
                                                                        borderRadius: '6px',
                                                                        border: '1px solid #cbd5e1',
                                                                        background: '#fff',
                                                                        fontSize: '11px',
                                                                        fontWeight: 600,
                                                                        color: '#374151',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                                                                    onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                                                                >
                                                                    {s.replace('_', ' ')}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {teamTickets.filter(t => t?.status !== 'CLOSED').length === 0 && assignedHandovers.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '40px 24px', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #e2e8f0', margin: '0 4px' }}>
                                            <div style={{ fontSize: '28px', marginBottom: '12px' }}>🎫</div>
                                            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#334155', margin: '0 0 6px' }}>No Active Asset Tickets</h3>
                                            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Your team has not raised any support or return tickets.</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })()}
            </div>

            {/* Reject Timesheet Modal */}
            {showRejectModal && timesheetToAction && (
                <div className="hr-modal-overlay" onClick={() => setShowRejectModal(false)}>
                    <div className="hr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', width: '90%' }}>
                        <div className="hr-modal-header">
                            <h2>Reject Timesheet</h2>
                            <button className="hr-modal-close" onClick={() => setShowRejectModal(false)}><X size={20} /></button>
                        </div>
                        <div className="hr-modal-body">
                            <p style={{ marginBottom: '16px', fontSize: '14px' }}>
                                Rejecting timesheet for <strong>{timesheetToAction.employeeName}</strong>
                            </p>
                            <div className="hr-form-group">
                                <label>Rejection Reason *</label>
                                <textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Please provide a reason for rejection"
                                    rows={4}
                                    required
                                    style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                                />
                            </div>
                        </div>
                        <div className="hr-modal-footer" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                className="hr-btn-secondary"
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setRejectionReason('');
                                    setTimesheetToAction(null);
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="hr-btn-primary"
                                onClick={handleTimesheetReject}
                                disabled={!rejectionReason.trim()}
                                style={{ backgroundColor: '#ef4444' }}
                            >
                                Reject Timesheet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hold Timesheet Modal */}
            {showHoldModal && timesheetToAction && (
                <div className="hr-modal-overlay" onClick={() => setShowHoldModal(false)}>
                    <div className="hr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', width: '90%' }}>
                        <div className="hr-modal-header">
                            <h2>Hold Timesheet</h2>
                            <button className="hr-modal-close" onClick={() => setShowHoldModal(false)}><X size={20} /></button>
                        </div>
                        <div className="hr-modal-body">
                            <p style={{ marginBottom: '16px', fontSize: '14px' }}>
                                Holding timesheet for <strong>{timesheetToAction.employeeName}</strong> for review
                            </p>
                            <div className="hr-form-group">
                                <label>Hold Comment (Optional)</label>
                                <textarea
                                    value={holdComment}
                                    onChange={(e) => setHoldComment(e.target.value)}
                                    placeholder="Add a comment about why this is being held"
                                    rows={4}
                                    style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                                />
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '8px' }}>
                                Note: The timesheet will remain in SUBMITTED status with your comment.
                            </p>
                        </div>
                        <div className="hr-modal-footer" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                className="hr-btn-secondary"
                                onClick={() => {
                                    setShowHoldModal(false);
                                    setHoldComment('');
                                    setTimesheetToAction(null);
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="hr-btn-primary"
                                onClick={handleTimesheetHold}
                                style={{ backgroundColor: '#f59e0b' }}
                            >
                                Hold Timesheet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Entry Modal */}
            {showEntryRejectModal && entryToAction && timesheetToAction && (
                <div className="hr-modal-overlay" onClick={() => setShowEntryRejectModal(false)}>
                    <div className="hr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', width: '90%' }}>
                        <div className="hr-modal-header">
                            <h2>Reject Entry</h2>
                            <button className="hr-modal-close" onClick={() => setShowEntryRejectModal(false)}><X size={20} /></button>
                        </div>
                        <div className="hr-modal-body">
                            <p style={{ marginBottom: '16px', fontSize: '14px' }}>
                                Rejecting entry for <strong>{timesheetToAction.employeeName}</strong>
                            </p>
                            <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', fontSize: '12px' }}>
                                <div><strong>Date:</strong> {entryToAction.workDate ? new Date(entryToAction.workDate).toLocaleDateString() : 'N/A'}</div>
                                <div><strong>Project:</strong> {entryToAction.projectName || entryToAction.projectNameSnapshot || 'Unassigned'}</div>
                                <div><strong>Task:</strong> {entryToAction.taskName || entryToAction.taskNameSnapshot || 'General'}</div>
                                <div><strong>Hours:</strong> {formatHoursAndMinutes(entryToAction.hours)}</div>
                                <div><strong>Description:</strong> {entryToAction.description || 'No description provided.'}</div>
                            </div>
                            <div className="hr-form-group">
                                <label>Rejection Reason *</label>
                                <textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Please provide a reason for rejecting this entry"
                                    rows={4}
                                    required
                                    style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                                />
                            </div>
                        </div>
                        <div className="hr-modal-footer" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                className="hr-btn-secondary"
                                onClick={() => {
                                    setShowEntryRejectModal(false);
                                    setRejectionReason('');
                                    setEntryToAction(null);
                                    setTimesheetToAction(null);
                                }}
                                disabled={submittingAction.id === entryToAction.id}
                            >
                                Cancel
                            </button>
                            <button
                                className="hr-btn-primary"
                                onClick={handleEntryReject}
                                disabled={!rejectionReason.trim() || submittingAction.id === entryToAction.id}
                                style={{ backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                {submittingAction.id === entryToAction.id ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        Rejecting...
                                    </>
                                ) : (
                                    'Reject Entry'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Expense Detail Modal */}
            {expenseDetail && (
                <div className="hr-modal-overlay" onClick={() => setExpenseDetail(null)}>
                    <div className="hr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', width: '92%' }}>
                        <div className="hr-modal-header">
                            <h2>{expenseDetail.title || 'Expense Details'}</h2>
                            <button className="hr-modal-close" onClick={() => setExpenseDetail(null)}><X size={20} /></button>
                        </div>
                        <div className="hr-modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Employee</div>
                                    <div style={{ fontWeight: 600 }}>{expenseDetail.employeeName || ''}</div>
                                    {expenseDetail.employeeEmployeeId && (
                                        <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{expenseDetail.employeeEmployeeId}</div>
                                    )}
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Amount</div>
                                    <div style={{ fontWeight: 700, color: 'var(--success)' }}>
                                        {formatAmount(expenseDetail.totalAmount, expenseDetail.currency)}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Submitted</div>
                                    <div style={{ fontWeight: 600 }}>{formatShortDate(expenseDetail.submittedAt)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Status</div>
                                    <div style={{ fontWeight: 600 }}>{expenseDetail.status || ''}</div>
                                </div>
                            </div>
                            {expenseDetail.description && (
                                <div style={{ marginTop: '16px' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: '6px' }}>Description</div>
                                    <div>{expenseDetail.description}</div>
                                </div>
                            )}
                            {expenseDetail.items && expenseDetail.items.length > 0 && (
                                <div style={{ marginTop: '16px' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: '8px' }}>Line items</div>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: '#f3f4f6' }}>
                                                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Category</th>
                                                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Description</th>
                                                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Date</th>
                                                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {expenseDetail.items.map((item, idx) => (
                                                    <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                        <td style={{ padding: '8px' }}>{item.category || ''}</td>
                                                        <td style={{ padding: '8px' }}>{item.description || ''}</td>
                                                        <td style={{ padding: '8px' }}>{formatShortDate(item.expenseDate)}</td>
                                                        <td style={{ padding: '8px', textAlign: 'right' }}>{formatAmount(item.amount, expenseDetail.currency)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                            {expenseDetail.receipts && expenseDetail.receipts.length > 0 && (
                                <div style={{ marginTop: '16px' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: '8px' }}>Receipts</div>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {expenseDetail.receipts.map((receipt, idx) => {
                                            const url = receipt && receipt.url ? receipt.url : receipt;
                                            const isImage = typeof url === 'string' && url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                                            return (
                                                <a
                                                    key={idx}
                                                    href={url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    style={{ display: 'inline-block', width: 110, textAlign: 'center', textDecoration: 'none', color: 'inherit' }}
                                                >
                                                    {isImage ? (
                                                        <img
                                                            src={url}
                                                            alt={`receipt-${idx}`}
                                                            style={{ width: 110, height: 82, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb' }}
                                                        />
                                                    ) : (
                                                        <div
                                                            style={{ width: 110, height: 82, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb' }}
                                                        >
                                                            <span style={{ fontSize: 12 }}>View</span>
                                                        </div>
                                                    )}
                                                    <div style={{ fontSize: 11, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {(url || '').split('/').pop()}
                                                    </div>
                                                </a>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="hr-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="hr-btn-secondary" onClick={() => setExpenseDetail(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Expense Modal */}
            {showExpenseRejectModal && expenseToAction && (
                <div className="hr-modal-overlay" onClick={() => setShowExpenseRejectModal(false)}>
                    <div className="hr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', width: '90%' }}>
                        <div className="hr-modal-header">
                            <h2>Reject Expense</h2>
                            <button className="hr-modal-close" onClick={() => setShowExpenseRejectModal(false)}><X size={20} /></button>
                        </div>
                        <div className="hr-modal-body">
                            <p style={{ marginBottom: '16px', fontSize: '14px' }}>
                                Rejecting expense for <strong>{expenseToAction.employeeName}</strong>
                            </p>
                            <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', fontSize: '12px' }}>
                                <div><strong>Title:</strong> {expenseToAction.title || 'Untitled'}</div>
                                <div><strong>Amount:</strong> {formatAmount(expenseToAction.totalAmount, expenseToAction.currency)}</div>
                                <div><strong>Submitted:</strong> {formatShortDate(expenseToAction.submittedAt)}</div>
                            </div>
                            <div className="hr-form-group">
                                <label>Rejection Reason *</label>
                                <textarea
                                    value={expenseRejectReason}
                                    onChange={(e) => setExpenseRejectReason(e.target.value)}
                                    placeholder="Please provide a reason for rejection"
                                    rows={4}
                                    required
                                    style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                                />
                            </div>
                        </div>
                        <div className="hr-modal-footer" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                className="hr-btn-secondary"
                                onClick={() => {
                                    setShowExpenseRejectModal(false);
                                    setExpenseRejectReason('');
                                    setExpenseToAction(null);
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="hr-btn-primary"
                                onClick={handleExpenseReject}
                                disabled={!expenseRejectReason.trim() || (submittingAction.id === expenseToAction.id && submittingAction.action === 'REJECT')}
                                style={{ backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                {submittingAction.id === expenseToAction.id && submittingAction.action === 'REJECT' ? (
                                    <RefreshCw size={14} className="animate-spin" />
                                ) : null}
                                Reject Expense
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Leave Detail Modal */}
            {showDecisionModal && activeRequest && (
                <div className="hr-modal-overlay" onClick={() => setShowDecisionModal(false)}>
                    <div className="hr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%', borderRadius: '16px', overflow: 'hidden' }}>
                        <div className="hr-modal-header" style={{ 
                            borderBottom: '1px solid #f1f5f9', 
                            padding: '20px 24px',
                            background: decisionAction === 'DIRECT_TO_HR' ? '#fffbeb' : (decisionAction === 'APPROVE' ? '#f0fdf4' : '#fef2f2')
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ 
                                    backgroundColor: decisionAction === 'DIRECT_TO_HR' ? '#fef3c7' : (decisionAction === 'APPROVE' ? '#dcfce7' : '#fee2e2'), 
                                    padding: '10px', 
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {decisionAction === 'DIRECT_TO_HR' ? (
                                        <ArrowRight size={24} style={{ color: '#d97706' }} />
                                    ) : decisionAction === 'APPROVE' ? (
                                        <CheckCircle size={24} style={{ color: '#16a34a' }} />
                                    ) : (
                                        <XCircle size={24} style={{ color: '#dc2626' }} />
                                    )}
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                                        {decisionAction === 'DIRECT_TO_HR' ? 'Redirect to HR' : (decisionAction === 'APPROVE' ? 'Approve Request' : 'Reject Request')}
                                    </h2>
                                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: decisionAction === 'DIRECT_TO_HR' ? '#b45309' : (decisionAction === 'APPROVE' ? '#166534' : '#991b1b'), opacity: 0.8 }}>
                                        Action for {activeRequest.reqType}
                                    </p>
                                </div>
                            </div>
                            <button className="hr-modal-close" onClick={() => setShowDecisionModal(false)} style={{ color: '#64748b' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="hr-modal-body" style={{ padding: '24px' }}>
                            <div style={{ marginBottom: '20px' }}>
                                <p style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: 1.5 }}>
                                    {decisionAction === 'DIRECT_TO_HR' ? (
                                        <>You are about to <strong>forward directly to HR</strong> the {activeRequest.reqType?.toLowerCase()} request for <strong>{activeRequest.employeeName || `${activeRequest.firstName} ${activeRequest.lastName}`}</strong> without manager approval.</>
                                    ) : (
                                        <>You are about to <strong>{decisionAction.toLowerCase()}</strong> the {activeRequest.reqType?.toLowerCase()} request for <strong>{activeRequest.employeeName || `${activeRequest.firstName} ${activeRequest.lastName}`}</strong>.</>
                                    )}
                                </p>
                            </div>
                            
                            <div className="hr-form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                                    <MessageSquare size={14} />
                                    {decisionAction === 'DIRECT_TO_HR' ? 'Forwarding Note (Optional)' : (decisionAction === 'APPROVE' ? 'Approval Feedback (Optional)' : 'Rejection Reason (Mandatory)')}
                                    {decisionAction === 'REJECT' && <span style={{ color: '#ef4444' }}>*</span>}
                                </label>
                                <textarea
                                    className="hr-time-textarea"
                                    value={decisionComment}
                                    onChange={(e) => setDecisionComment(e.target.value)}
                                    placeholder={decisionAction === 'DIRECT_TO_HR' ? "Add note for HR..." : (decisionAction === 'APPROVE' ? "Add a supportive message or notes..." : "Please explain why this request is being rejected...")}
                                    rows={4}
                                    style={{ 
                                        width: '100%', 
                                        padding: '14px', 
                                        fontSize: '14px', 
                                        borderRadius: '12px', 
                                        border: '1.5px solid #e2e8f0',
                                        backgroundColor: '#f8fafc',
                                        minHeight: '120px',
                                        outline: 'none',
                                        transition: 'all 0.2s',
                                        resize: 'none'
                                    }}
                                />
                            </div>
                        </div>
                        <div className="hr-modal-footer" style={{ 
                            padding: '16px 24px', 
                            backgroundColor: '#f8fafc', 
                            display: 'flex', 
                            gap: '12px', 
                            justifyContent: 'flex-end',
                            borderTop: '1px solid #f1f5f9'
                        }}>
                            <button
                                className="hr-btn-secondary"
                                onClick={() => setShowDecisionModal(false)}
                                style={{ padding: '10px 20px', borderRadius: '10px', fontWeight: 600 }}
                            >
                                Cancel
                            </button>
                            <button
                                className="hr-btn-primary"
                                style={{ 
                                    backgroundColor: decisionAction === 'DIRECT_TO_HR' ? '#f59e0b' : (decisionAction === 'APPROVE' ? '#22c55e' : '#ef4444'),
                                    padding: '10px 24px', 
                                    borderRadius: '10px',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    boxShadow: (submittingAction.id === activeRequest.id || (decisionAction === 'REJECT' && !decisionComment.trim())) ? 'none' : `0 4px 12px ${decisionAction === 'DIRECT_TO_HR' ? 'rgba(245, 158, 11, 0.2)' : (decisionAction === 'APPROVE' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)')}`,
                                    opacity: (submittingAction.id === activeRequest.id || (decisionAction === 'REJECT' && !decisionComment.trim())) ? 0.5 : 1,
                                    cursor: (submittingAction.id === activeRequest.id || (decisionAction === 'REJECT' && !decisionComment.trim())) ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease',
                                    border: 'none',
                                    color: '#fff'
                                }}
                                disabled={submittingAction.id === activeRequest.id || (decisionAction === 'REJECT' && !decisionComment.trim())}
                                onClick={handleDecisionConfirm}
                            >
                                {submittingAction.id === activeRequest.id ? (
                                    <RefreshCw size={16} className="animate-spin" />
                                ) : (
                                    decisionAction === 'DIRECT_TO_HR' ? <ArrowRight size={16} /> : (decisionAction === 'APPROVE' ? <CheckCircle size={16} /> : <AlertCircle size={16} />)
                                )}
                                Confirm {decisionAction === 'DIRECT_TO_HR' ? 'Redirect to HR' : (decisionAction === 'APPROVE' ? 'Approval' : 'Rejection')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showLeaveDetailModal && selectedLeave && (() => {
                const code = getLeaveTypeCode(selectedLeave.leaveType);
                const limit = managerLimits[code];
                const totalDays = selectedLeave.totalDays || selectedLeave.duration || 0;
                const isLimitExceeded = limit !== null && limit !== undefined && totalDays > limit;

                const isForwardedToHr = (selectedLeave.managerResponse && selectedLeave.managerResponse.toLowerCase().includes('forwarded directly to hr')) ||
                    (selectedLeave.adminResponse && selectedLeave.adminResponse.toLowerCase().includes('forwarded directly to hr'));

                // Live Flow Logic
                const getManagerStep = () => {
                    if (isForwardedToHr) return { icon: <ArrowRight size={16} />, color: '#3b82f6', statusText: 'Forwarded to HR' };
                    const status = selectedLeave.managerStatus;
                    if (status === 'SKIPPED') return { icon: <Clock size={16} />, color: '#9ca3af', statusText: 'Skipped' };
                    if (status === 'APPROVED') return { icon: <CheckCircle size={16} />, color: '#10b981', statusText: 'Approved' };
                    if (status === 'REJECTED') return { icon: <XCircle size={16} />, color: '#ef4444', statusText: 'Rejected' };
                    return { icon: <Clock size={16} />, color: '#3b82f6', statusText: 'Pending' };
                };

                const getAdminStep = () => {
                    const status = selectedLeave.status;
                    if (status === 'APPROVED') return { icon: <CheckCircle size={16} />, color: '#10b981', statusText: 'Approved' };
                    if (status === 'REJECTED') return { icon: <XCircle size={16} />, color: '#ef4444', statusText: 'Rejected' };
                    if (isForwardedToHr || selectedLeave.managerStatus === 'SKIPPED') return { icon: <Clock size={16} />, color: '#3b82f6', statusText: 'Pending' };
                    if (selectedLeave.managerStatus === 'PENDING') return { icon: <Clock size={16} />, color: '#9ca3af', statusText: 'Waiting' };
                    return { icon: <Clock size={16} />, color: '#3b82f6', statusText: 'Pending' };
                };

                const managerStep = getManagerStep();
                const adminStep = getAdminStep();

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
                                        <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>ID: #{selectedLeave.id}</p>
                                    </div>
                                </div>
                                <button className="hr-modal-close" onClick={() => setShowLeaveDetailModal(false)} style={{ fontSize: '20px' }}><X size={20} /></button>
                            </div>

                            <div className="hr-modal-body" style={{ padding: '16px' }}>
                                {/* Employee Info Section */}
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', backgroundColor: '#f9fafb', padding: '10px', borderRadius: '10px', border: '1px solid #f3f4f6' }}>
                                    <img
                                        src={`https://ui-avatars.com/api/?name=${selectedLeave.employeeName}&background=6366f1&color=fff&size=128`}
                                        style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }}
                                        alt=""
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedLeave.employeeName}</div>
                                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '1px' }}>{selectedLeave.employeeId || 'ID N/A'} {selectedLeave.department || 'No Dept'}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{
                                            display: 'inline-block',
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            fontSize: '10px',
                                            fontWeight: 600,
                                            backgroundColor: '#fef3c7',
                                            color: '#92400e'
                                        }}>
                                            {selectedLeave.status || 'PENDING'}
                                        </span>
                                    </div>
                                </div>

                                {selectedLeave.isDelegated && (
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '8px', 
                                        marginBottom: '14px', 
                                        padding: '8px 12px', 
                                        borderRadius: '8px', 
                                        background: '#e0e7ff', 
                                        border: '1px solid #c7d2fe',
                                        fontSize: '12px',
                                        color: '#3730a3',
                                        fontWeight: 600
                                    }}>
                                        <Shield size={16} color="#4338ca" />
                                        <span>🛡️ Delegated Request: You are reviewing and approving this request on behalf of {selectedLeave.delegatedFrom || 'Manager'}.</span>
                                    </div>
                                )}

                                {/* Request Highlights Grid - Compact */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px' }}>
                                    <div style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                                        <div style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '2px' }}>Leave Type</div>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{formatLeaveTypeLabel(selectedLeave.leaveType)}</div>
                                    </div>
                                    <div style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                                        <div style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '2px' }}>Duration</div>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{totalDays} {totalDays === 1 ? 'Day' : 'Days'}</div>
                                    </div>
                                    <div style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', gridColumn: 'span 2' }}>
                                        <div style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '2px' }}>Period</div>
                                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>{selectedLeave.startDate} to {selectedLeave.endDate}</div>
                                    </div>
                                </div>

                                {/* Reason Section */}
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Reason</div>
                                    <div style={{ backgroundColor: '#fff7ed', padding: '8px 10px', borderRadius: '6px', borderLeft: '3px solid #f97316', fontSize: '12px', color: '#4b5563', lineHeight: 1.4 }}>
                                        {selectedLeave.reason || 'No reason provided.'}
                                    </div>
                                    {selectedLeave.supportingDocumentPath && (
                                        <div style={{ marginTop: '10px' }}>
                                            <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Supporting Document</div>
                                            <a 
                                                href={selectedLeave.supportingDocumentPath}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px',
                                                    fontSize: '12px',
                                                    color: '#2563eb',
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
                                            { label: 'Employee', name: selectedLeave.employeeName, icon: <CheckCircle size={14} />, color: '#10b981', statusText: 'Submitted' },
                                            { label: 'Manager', name: selectedLeave.managerName || 'Manager', ...managerStep },
                                            ...((isLimitExceeded || isForwardedToHr || selectedLeave.managerStatus === 'SKIPPED') ? [{ label: 'HR / Admin', name: 'Final Approval', ...adminStep }] : [])
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
                                        style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px' }}
                                    >
                                        Close
                                    </button>
                                    {(() => {
                                        const reqStatus = (isOrgView ? (selectedLeave.status || 'PENDING') : (selectedLeave.managerStatus || 'PENDING')).toUpperCase();
                                        const isPending = reqStatus === 'PENDING' || reqStatus === 'SUBMITTED';
                                        const reqEmpId = String(selectedLeave.employeeId || selectedLeave.employee?.employeeId || '').trim().toLowerCase();
                                        const currentEmpId = String(user?.employeeId || '').trim().toLowerCase();
                                        const isSelfRequest = Boolean(currentEmpId && reqEmpId && currentEmpId === reqEmpId);

                                        if (isPending) {
                                            if (isSelfRequest) {
                                                return (
                                                    <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '6px 12px', borderRadius: '6px', fontWeight: 600 }}>
                                                        Self Request (No Self-Approval)
                                                    </span>
                                                );
                                            }
                                            return (
                                                <>
                                                    {!isOrgView && (
                                                        <button
                                                            className="hr-btn-primary"
                                                            disabled={submittingAction.id === selectedLeave.id}
                                                            onClick={() => {
                                                                setActiveRequest({ ...selectedLeave, reqType: 'LEAVE' });
                                                                setDecisionAction('DIRECT_TO_HR');
                                                                setDecisionComment('Forwarded directly to HR by manager');
                                                                setShowDecisionModal(true);
                                                                setShowLeaveDetailModal(false);
                                                            }}
                                                            style={{ backgroundColor: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', fontSize: '12px' }}
                                                        >
                                                            {submittingAction.id === selectedLeave.id && submittingAction.action === 'DIRECT_TO_HR' ? (
                                                                <RefreshCw size={14} className="animate-spin" />
                                                            ) : (
                                                                <ArrowRight size={14} />
                                                            )}
                                                            Direct to HR
                                                        </button>
                                                    )}
                                                    <button
                                                        className="hr-btn-primary"
                                                        disabled={submittingAction.id === selectedLeave.id}
                                                        onClick={() => {
                                                            setActiveRequest({ ...selectedLeave, reqType: 'LEAVE' });
                                                            setDecisionAction('APPROVE');
                                                            setDecisionComment('');
                                                            setShowDecisionModal(true);
                                                            setShowLeaveDetailModal(false);
                                                        }}
                                                        style={{ backgroundColor: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', fontSize: '12px' }}
                                                    >
                                                        {submittingAction.id === selectedLeave.id && submittingAction.action === 'APPROVED' ? (
                                                            <RefreshCw size={14} className="animate-spin" />
                                                        ) : (
                                                            <CheckCircle size={14} />
                                                        )}
                                                        Approve
                                                    </button>
                                                    <button
                                                        className="hr-btn-primary"
                                                        disabled={submittingAction.id === selectedLeave.id}
                                                        onClick={() => {
                                                            setActiveRequest({ ...selectedLeave, reqType: 'LEAVE' });
                                                            setDecisionAction('REJECT');
                                                            setDecisionComment('');
                                                            setShowDecisionModal(true);
                                                            setShowLeaveDetailModal(false);
                                                        }}
                                                        style={{ backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', fontSize: '12px' }}
                                                    >
                                                        <XCircle size={14} /> Reject
                                                    </button>
                                                </>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Leave Rejection Modal */}

            {/* WFH Request Details Modal */}
            {showWfhDetailModal && selectedWfh && (() => {
                const totalDays = selectedWfh.totalDays || selectedWfh.duration || 0;

                return (
                    <div className="hr-modal-overlay" onClick={() => setShowWfhDetailModal(false)}>
                        <div className="hr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', width: '95%', borderRadius: '12px' }}>
                            <div className="hr-modal-header" style={{ borderBottom: '1px solid #e5e7eb', padding: '10px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ backgroundColor: '#f0fdf4', padding: '6px', borderRadius: '8px' }}>
                                        <Clock size={18} style={{ color: '#10b981' }} />
                                    </div>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#111827' }}>WFH Request Details</h2>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>ID: #{selectedWfh.id}</p>
                                    </div>
                                </div>
                                <button className="hr-modal-close" onClick={() => setShowWfhDetailModal(false)} style={{ fontSize: '20px' }}><X size={20} /></button>
                            </div>

                            <div className="hr-modal-body" style={{ padding: '16px' }}>
                                {/* Employee Info Section */}
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', backgroundColor: '#f9fafb', padding: '10px', borderRadius: '10px', border: '1px solid #f3f4f6' }}>
                                    <img
                                        src={`https://ui-avatars.com/api/?name=${selectedWfh.employeeName}&background=10b981&color=fff&size=128`}
                                        style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }}
                                        alt=""
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedWfh.employeeName}</div>
                                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '1px' }}>{selectedWfh.employeeId || 'ID N/A'} {selectedWfh.department || 'No Dept'}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        {(() => {
                                            const s = (selectedWfh.status || 'PENDING').toUpperCase();
                                            const m = (selectedWfh.managerStatus || 'PENDING').toUpperCase();
                                            const displayStatus = (s === 'PENDING' && m === 'APPROVED') ? 'Pending HR Approval' : s;
                                            return (
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    fontSize: '10px',
                                                    fontWeight: 600,
                                                    backgroundColor: (s === 'APPROVED') ? '#dcfce7' : (s === 'REJECTED') ? '#fee2e2' : '#fef3c7',
                                                    color: (s === 'APPROVED') ? '#166534' : (s === 'REJECTED') ? '#991b1b' : '#92400e'
                                                }}>
                                                    {displayStatus}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* Request Highlights Grid - Compact */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px' }}>
                                    <div style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                                        <div style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '2px' }}>Request Type</div>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Work From Home</div>
                                    </div>
                                    <div style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                                        <div style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '2px' }}>Duration</div>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{totalDays} {totalDays === 1 ? 'Day' : 'Days'}</div>
                                    </div>
                                    <div style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', gridColumn: 'span 2' }}>
                                        <div style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '2px' }}>Period</div>
                                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>{selectedWfh.startDate} to {selectedWfh.endDate}</div>
                                    </div>
                                </div>

                                {/* Reason Section */}
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Reason</div>
                                    <div style={{ backgroundColor: '#f0fdf4', padding: '8px 10px', borderRadius: '6px', borderLeft: '3px solid #10b981', fontSize: '12px', color: '#4b5563', lineHeight: 1.4 }}>
                                        {selectedWfh.reason || 'No reason provided.'}
                                    </div>
                                </div>

                                {/* Approval Flow Section - Compact with Live Marks */}
                                {(selectedWfh.status || '').toUpperCase() !== 'CANCELLED' && (
                                    <div>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Approval Flow</span>
                                        {selectedWfh.managerStatus === 'APPROVED' && selectedWfh.status === 'PENDING' && (
                                            <span style={{ fontSize: '9px', color: '#3b82f6', backgroundColor: '#eff6ff', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                                Awaiting HR Approval (Limit Exceeded)
                                            </span>
                                        )}
                                        {selectedWfh.managerStatus === 'PENDING' && selectedWfh.status === 'PENDING' && (totalDays > (managerLimits['WFH'] !== undefined ? managerLimits['WFH'] : 2)) && (
                                            <span style={{ fontSize: '9px', color: '#f59e0b', backgroundColor: '#fffbe6', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                                2-Level Approval (Limit Exceeded)
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', padding: '0 5px' }}>
                                        {/* Connector Line */}
                                        <div style={{ position: 'absolute', top: '16px', left: '30px', right: '30px', height: '1.5px', backgroundColor: '#e5e7eb', zIndex: 0 }}></div>

                                        {/* Flow Steps */}
                                        {(() => {
                                            const reqStatus = (selectedWfh.status || 'PENDING').toUpperCase();
                                            const mStatus = (selectedWfh.managerStatus || 'PENDING').toUpperCase();

                                            const getManagerStep = () => {
                                                if (mStatus === 'APPROVED') return { icon: <CheckCircle size={14} />, color: '#10b981', statusText: 'Approved' };
                                                if (mStatus === 'REJECTED') return { icon: <XCircle size={14} />, color: '#ef4444', statusText: 'Rejected' };
                                                if (reqStatus === 'APPROVED') return { icon: <CheckCircle size={14} />, color: '#10b981', statusText: 'Approved' };
                                                if (reqStatus === 'REJECTED') return { icon: <XCircle size={14} />, color: '#ef4444', statusText: 'Rejected' };
                                                return { icon: <Clock size={14} />, color: '#3b82f6', statusText: 'Pending' };
                                            };

                                            const getAdminStep = () => {
                                                if (reqStatus === 'APPROVED') return { icon: <CheckCircle size={14} />, color: '#10b981', statusText: 'Approved' };
                                                if (reqStatus === 'REJECTED') return { icon: <XCircle size={14} />, color: '#ef4444', statusText: 'Rejected' };
                                                if (mStatus === 'APPROVED' && reqStatus === 'PENDING') return { icon: <Clock size={14} />, color: '#3b82f6', statusText: 'Pending' };
                                                return { icon: <Clock size={14} />, color: '#9ca3af', statusText: 'Waiting' };
                                            };

                                            const managerStep = getManagerStep();
                                            const adminStep = getAdminStep();

                                            // Check manager WFH limit (default or configured limit for code 'WFH')
                                            const wfhLimit = managerLimits['WFH'] !== undefined ? managerLimits['WFH'] : 2;
                                            const isLimitExceeded = wfhLimit !== null && totalDays > wfhLimit;

                                            // Show 3rd step (HR / Admin) when limit is exceeded, or manager approved while overall status is pending, or admin responded
                                            const isTwoLevelRequired = isLimitExceeded || (mStatus === 'APPROVED' && reqStatus === 'PENDING') || !!selectedWfh.adminName || !!selectedWfh.adminResponse;

                                            const steps = [
                                                { label: 'Employee', name: selectedWfh.employeeName, icon: <CheckCircle size={14} />, color: '#10b981', statusText: 'Submitted' },
                                                { label: 'Manager', name: selectedWfh.managerName || 'Reporting Manager', ...managerStep },
                                                ...(isTwoLevelRequired ? [{ label: 'HR / Admin', name: selectedWfh.adminName || 'HR/Admin Approval', ...adminStep }] : [])
                                            ];

                                            return steps.map((step, i) => (
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
                                            ));
                                        })()}
                                    </div>
                                </div>
                                )}
                            </div>

                            <div className="hr-modal-footer" style={{ borderTop: '1px solid #e5e7eb', padding: '10px 16px', backgroundColor: '#f9fafb', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                    <button
                                        className="hr-btn-secondary"
                                        onClick={() => setShowWfhDetailModal(false)}
                                        style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px' }}
                                    >
                                        Close
                                    </button>
                                    {(() => {
                                        const reqStatus = (selectedWfh.status || 'PENDING').toUpperCase();
                                        const isPending = reqStatus === 'PENDING' || reqStatus === 'SUBMITTED';
                                        if (isPending) {
                                            return (
                                                <>
                                                    <button
                                                        className="hr-btn-primary"
                                                        disabled={submittingAction.id === selectedWfh.id}
                                                        onClick={() => {
                                                            setActiveRequest({ ...selectedWfh, reqType: 'WFH' });
                                                            setDecisionAction('APPROVE');
                                                            setDecisionComment('');
                                                            setShowDecisionModal(true);
                                                            setShowWfhDetailModal(false);
                                                        }}
                                                        style={{ backgroundColor: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', fontSize: '12px' }}
                                                    >
                                                        {submittingAction.id === selectedWfh.id && submittingAction.action === 'APPROVED' ? (
                                                            <RefreshCw size={14} className="animate-spin" />
                                                        ) : (
                                                            <CheckCircle size={14} />
                                                        )}
                                                        Approve
                                                    </button>
                                                    <button
                                                        className="hr-btn-primary"
                                                        disabled={submittingAction.id === selectedWfh.id}
                                                        onClick={() => {
                                                            setActiveRequest({ ...selectedWfh, reqType: 'WFH' });
                                                            setDecisionAction('REJECT');
                                                            setDecisionComment('');
                                                            setShowDecisionModal(true);
                                                            setShowWfhDetailModal(false);
                                                        }}
                                                        style={{ backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', fontSize: '12px' }}
                                                    >
                                                        {submittingAction.id === selectedWfh.id && submittingAction.action === 'REJECTED' ? (
                                                            <RefreshCw size={14} className="animate-spin" />
                                                        ) : (
                                                            <XCircle size={14} />
                                                        )}
                                                        Reject
                                                    </button>
                                                </>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Timesheet Entries Detail Modal */}
            {showEntriesModal && selectedTsInfo && (
                <div className="hr-modal-overlay" style={{ backdropFilter: 'blur(4px)', zIndex: 2000, overflowY: 'auto', padding: '20px 0' }}>
                    <div className="hr-modal-container" style={{ maxWidth: '1600px', width: '96%', backgroundColor: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', height: '90vh', maxHeight: '90vh' }}>
                        <style>{`
                            .timesheet-entries-scroll {
                                scrollbar-color: #ffffff #ffffff;
                                scrollbar-width: thin;
                            }
                            .timesheet-entries-scroll::-webkit-scrollbar {
                                width: 8px;
                                height: 8px;
                            }
                            .timesheet-entries-scroll::-webkit-scrollbar-track {
                                background: #ffffff;
                            }
                            .timesheet-entries-scroll::-webkit-scrollbar-thumb {
                                background: #ffffff;
                                border: 1px solid #e5e7eb;
                                border-radius: 999px;
                            }
                        `}</style>
                        <div className="hr-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
                            <div>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>Timesheet Daily Entries</h3>
                                <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>
                                    {selectedTsInfo.employeeName} | {new Date(selectedTsInfo.weekStartDate).toLocaleDateString()} to {new Date(selectedTsInfo.weekEndDate).toLocaleDateString()}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowEntriesModal(false)}
                                aria-label="Close"
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    background: '#ffffff',
                                    color: '#111827',
                                    fontSize: '22px',
                                    lineHeight: 1,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="hr-modal-body timesheet-entries-scroll" style={{ padding: '0', flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
                            <div className="timesheet-entries-scroll" style={{ overflowX: 'auto', padding: '20px' }}>
                                <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                <thead style={{ backgroundColor: '#f8fafc' }}>
                                    <tr>
                                        <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#475569', width: '8%' }}>Date</th>
                                        <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#475569', width: '8%' }}>Project</th>
                                        <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#475569', width: '8%' }}>Task</th>
                                        <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#475569', width: '10%' }}>Log Time</th>
                                        <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#475569', width: '36%' }}>Description</th>
                                        <th style={{ padding: '12px 10px', textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#475569', width: '4%' }}>Hours</th>
                                        <th style={{ padding: '12px 10px', textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#475569', width: '6%' }}>Billable</th>
                                        <th style={{ padding: '12px 10px', textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#475569', width: '7%' }}>Status</th>
                                        <th style={{ padding: '12px 10px', textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#475569', width: '13%' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedEntries.length > 0 ? (
                                        selectedEntries.map((entry, idx) => {
                                            const isEntryCancelled = entry.isCancelled || entry.cancelled || entry.status === 'CANCELLED';
                                            const entryStatus = isEntryCancelled ? 'CANCELLED' : (entry.status || 'PENDING');
                                            const entryDate = entry.workDate || entry.date || entry.entryDate;
                                            const projectName = entry.projectName || entry.projectNameSnapshot || entry.project?.projectName || 'N/A';
                                            const taskName = entry.taskName || entry.taskNameSnapshot || entry.task?.taskName || 'N/A';
                                            const hoursValue = entry.hours ?? entry.totalHours ?? 0;

                                            return (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '12px 10px', fontSize: '13px' }}>{entryDate ? new Date(entryDate).toLocaleDateString() : 'N/A'}</td>
                                                <td style={{ padding: '12px 10px', fontSize: '13px' }}>{projectName}</td>
                                                <td style={{ padding: '12px 10px', fontSize: '13px' }}>
                                                    {taskName}
                                                    {entry.halfDayType && (
                                                        <div style={{ fontSize: '10px', color: '#92400e', fontWeight: 700, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                                            {entry.halfDayType === 'MORNING_HALF' ? 'Morning Half' : 'Afternoon Half'}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '12px 10px', fontSize: '12px', color: '#475569', fontWeight: 500 }}>
                                                    {(() => {

                                                        const start = formatTimeTo12h(entry.clockIn);
                                                        const end = formatTimeTo12h(entry.clockOut);
                                                        if (start && end && start !== '--:--' && end !== '--:--') return `${start} - ${end}`;
                                                        if (start || end) return start || end;
                                                        return '--:--';
                                                    })()}
                                                </td>
                                                <td style={{ padding: '12px 10px', fontSize: '14px', color: '#1f2937', wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: '1.5' }}>{entry.description || '-'}</td>
                                                <td style={{ padding: '12px 10px', textAlign: 'center', fontSize: '13px', fontWeight: 600 }}>{formatHoursAndMinutes(hoursValue)}</td>
                                                <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                                                    <span style={{
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '11px',
                                                        fontWeight: 600,
                                                        backgroundColor: entry.billable ? '#d1fae5' : '#fee2e2',
                                                        color: entry.billable ? '#065f46' : '#991b1b'
                                                    }}>
                                                        {entry.billable ? 'Yes' : 'No'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                                                    {entryStatus === 'CANCELLED' ? (
                                                        <span style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#e2e8f0', color: '#475569', borderRadius: '6px', fontWeight: 700 }}>Cancelled</span>
                                                    ) : entryStatus === 'APPROVED' ? (
                                                        <span style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '6px', fontWeight: 700 }}>Approved</span>
                                                    ) : entryStatus === 'REJECTED' ? (
                                                        <span style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '6px', fontWeight: 700 }}>Rejected</span>
                                                    ) : entryStatus === 'DRAFT' ? (
                                                        <span style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#f1f5f9', color: '#334155', borderRadius: '6px', fontWeight: 700 }}>Draft</span>
                                                    ) : (
                                                        <span style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '6px', fontWeight: 700 }}>Pending</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                                                    {entryStatus === 'DRAFT' ? (
                                                        <span style={{ fontSize: '12px', color: '#64748b' }}>Not Submitted</span>
                                                    ) : entryStatus !== 'PENDING' && entryStatus !== 'SUBMITTED' ? (
                                                        <span style={{ fontSize: '12px', color: '#64748b' }}>Completed</span>
                                                    ) : (
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                            <button
                                                                onClick={() => {
                                                                    if (!selectedTsInfo?.id) return;
                                                                    handleEntryApprove(entry.id, selectedTsInfo.id);
                                                                    setSelectedEntries((prev) => prev.map((currentEntry, currentIndex) => (
                                                                        currentIndex === idx ? { ...currentEntry, status: 'APPROVED' } : currentEntry
                                                                    )));
                                                                }}
                                                                style={{
                                                                    padding: '5px 10px',
                                                                    fontSize: '11px',
                                                                    backgroundColor: '#10b981',
                                                                    color: '#ffffff',
                                                                    border: 'none',
                                                                    borderRadius: '6px',
                                                                    cursor: 'pointer',
                                                                    fontWeight: 600
                                                                }}
                                                                title="Approve Entry"
                                                            >
                                                                Approve
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setShowEntriesModal(false);
                                                                    openEntryRejectModal(entry, selectedTsInfo);
                                                                }}
                                                                style={{
                                                                    padding: '5px 10px',
                                                                    fontSize: '11px',
                                                                    backgroundColor: '#ef4444',
                                                                    color: '#ffffff',
                                                                    border: 'none',
                                                                    borderRadius: '6px',
                                                                    cursor: 'pointer',
                                                                    fontWeight: 600
                                                                }}
                                                                title="Reject Entry"
                                                            >
                                                                Reject
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )})
                                    ) : (
                                        <tr>
                                            <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>No entries available for this timesheet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                            </div>
                        </div>
                        <div className="hr-modal-footer" style={{ borderTop: '1px solid #e5e7eb', padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#f9fafb', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                            {selectedTsInfo && (selectedTsInfo.status || '').toUpperCase() === 'SUBMITTED' && timesheetSubTab.toUpperCase() !== 'APPROVED' && (
                                <button 
                                    className="btn-ts btn-ts-approve"
                                    disabled={submittingAction.id === selectedTsInfo.id}
                                    onClick={async () => {
                                        await handleTimesheetApprove(selectedTsInfo.id);
                                        setShowEntriesModal(false);
                                    }}
                                    style={{ padding: '8px 24px', borderRadius: '10px' }}
                                >
                                    {submittingAction.id === selectedTsInfo.id ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />} Approve All
                                </button>
                            )}
                            <button
                                className="hr-btn-secondary"
                                onClick={() => setShowEntriesModal(false)}
                                style={{ padding: '8px 24px', fontWeight: 600, backgroundColor: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '10px' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAdjustmentModal && (
                <div className="modal-overlay" onClick={() => setShowAdjustmentModal(false)} style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div className="modal-content white-scrollbar" onClick={(e) => e.stopPropagation()} style={{
                        backgroundColor: '#ffffff', borderRadius: '12px', width: '92%', maxWidth: '440px',
                        padding: '20px 24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', border: '1px solid #f1f5f9',
                        maxHeight: '90vh', overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9', marginBottom: '16px' }}>
                            <div>
                                <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0, lineHeight: 1.3 }}>Adjust Leave Balance</h2>
                                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>Update leave allowance for selected team member</p>
                            </div>
                            <button onClick={() => setShowAdjustmentModal(false)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer', color: '#64748b', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}><X size={16} /></button>
                        </div>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            setAdjustmentSubmitting(true);
                            try {
                                // Map the leave type code to the full name expected by the LeaveBalance entity
                                const backendLeaveType = getLeaveTypeCode(adjustmentForm.leaveType);
                                
                                await leaveBalanceAPI.adjustBalance({
                                    ...adjustmentForm,
                                    leaveType: backendLeaveType,
                                    days: parseFloat(adjustmentForm.days)
                                });
                                toast.success('Leave balance adjusted successfully');
                                setShowAdjustmentModal(false);
                                setAdjustmentForm({
                                    employeeId: '',
                                    leaveType: '',
                                    adjustmentType: 'ADDITION',
                                    days: '',
                                    reason: ''
                                });
                            } catch (err) {
                                toast.error(err.response?.data?.message || 'Failed to adjust balance');
                            } finally {
                                setAdjustmentSubmitting(false);
                            }
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '12px', color: '#334155' }}>
                                        Select Employee <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <select
                                        className="form-select"
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '13px', color: '#0f172a', outline: 'none', height: '36px' }}
                                        value={adjustmentForm.employeeId}
                                        onChange={(e) => setAdjustmentForm({ ...adjustmentForm, employeeId: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Employee</option>
                                        {teamMembers.length === 0 && (
                                            <option value="" disabled>No team members found</option>
                                        )}
                                        {teamMembers.map(emp => {
                                            const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.fullName || emp.name || emp.employeeId;
                                            return (
                                            <option key={emp.employeeId || emp.id} value={emp.employeeId || emp.id}>
                                                {name} ({emp.employeeId || emp.employeeIdString || emp.id})
                                            </option>
                                            );
                                        })}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '12px', color: '#334155' }}>
                                        Leave Type <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <select
                                        className="form-select"
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '13px', color: '#0f172a', outline: 'none', height: '36px' }}
                                        value={adjustmentForm.leaveType}
                                        onChange={(e) => setAdjustmentForm({ ...adjustmentForm, leaveType: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Leave Type</option>
                                        {leaveTypes.map(type => (
                                            <option key={type.id || type.leaveTypeCode} value={type.leaveTypeCode}>
                                                {type.leaveTypeName}
                                            </option>
                                        ))}
                                    </select>
                                    {adjustmentForm.employeeId && adjustmentForm.leaveType && (
                                        <div style={{ marginTop: '6px', padding: '6px 10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#64748b' }}>Current Balance:</span>
                                            {balanceLoading ? (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4338ca', fontWeight: 500 }}>
                                                    <RefreshCw size={12} className="animate-spin" /> Loading...
                                                </span>
                                            ) : (
                                                <span style={{ fontWeight: '700', color: (employeeBalances[adjustmentForm.leaveType] || 0) > 0 ? '#16a34a' : '#ea580c' }}>
                                                    {employeeBalances[adjustmentForm.leaveType] || 0} days
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '12px', color: '#334155' }}>
                                            Adjustment Type <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <select
                                            className="form-select"
                                            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '13px', color: '#0f172a', outline: 'none', height: '36px' }}
                                            value={adjustmentForm.adjustmentType}
                                            onChange={(e) => setAdjustmentForm({ ...adjustmentForm, adjustmentType: e.target.value })}
                                            required
                                        >
                                            <option value="ADDITION">Addition (+)</option>
                                            <option value="DEDUCTION">Deduction (-)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '12px', color: '#334155' }}>
                                            Number of Days <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            min="0"
                                            className="form-input"
                                            placeholder="e.g. 1.5"
                                            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '13px', color: '#0f172a', outline: 'none', height: '36px', boxSizing: 'border-box' }}
                                            value={adjustmentForm.days}
                                            onChange={(e) => setAdjustmentForm({ ...adjustmentForm, days: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                        <label style={{ fontWeight: '600', fontSize: '12px', color: '#334155' }}>
                                            Reason <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <span style={{ fontSize: '11px', color: adjustmentForm.reason?.length >= 3000 ? '#ef4444' : '#94a3b8' }}>
                                            {adjustmentForm.reason?.length || 0}/3000
                                        </span>
                                    </div>
                                    <textarea
                                        className="form-textarea"
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', minHeight: '80px', fontSize: '13px', color: '#0f172a', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                                        value={adjustmentForm.reason}
                                        onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                                        required
                                        maxLength={3000}
                                        placeholder="Reason for adjustment..."
                                    />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowAdjustmentModal(false)}
                                        style={{ padding: '0 14px', height: '32px', borderRadius: '6px', fontWeight: '500', fontSize: '12px', background: '#fff', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer' }}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={adjustmentSubmitting}
                                        style={{ 
                                            opacity: adjustmentSubmitting ? 0.7 : 1, 
                                            padding: '0 16px', 
                                            height: '32px',
                                            borderRadius: '6px', 
                                            fontWeight: '500',
                                            fontSize: '12px',
                                            backgroundColor: '#4f46e5',
                                            color: 'white',
                                            border: 'none',
                                            cursor: adjustmentSubmitting ? 'not-allowed' : 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        {adjustmentSubmitting ? <RefreshCw size={12} className="animate-spin" /> : null}
                                        Save Adjustment
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Exit Request Details Modal */}
            {showExitModal && selectedExitRequest && (
                <div className="hr-modal-overlay" onClick={() => setShowExitModal(false)} style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="hr-modal" onClick={(e) => e.stopPropagation()} style={{ width: '95%', maxWidth: '1000px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: '14px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
                        {/* Dark Header/Hero Section */}
                        <div style={{
                            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
                            color: '#fff',
                            padding: '24px 20px',
                            position: 'relative'
                        }}>
                            <button 
                                onClick={() => setShowExitModal(false)}
                                style={{ position: 'absolute', top: '20px', right: '20px', background: '#fff', border: 'none', color: '#1e1b4b', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 20 }}
                                title="Close Modal"
                            >
                                <X size={20} />
                            </button>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', paddingRight: '40px' }}>
                                <div>
                                    <div style={{ fontSize: '10px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>EXIT MANAGEMENT</div>
                                    <h2 style={{ fontSize: '20px', margin: '2px 0 0 0', fontWeight: 700 }}>Resignation Request</h2>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                    <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></div>
                                        Pending
                                    </span>
                                    <span style={{ fontSize: '10px', opacity: 0.8, background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', fontWeight: 500 }}>Manager Action</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{
                                    width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700,
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    {selectedExitRequest.employeeName?.[0] || 'E'}
                                </div>
                                <div>
                                    <div style={{ fontSize: '18px', fontWeight: 700 }}>{selectedExitRequest.employeeName}</div>
                                    <div style={{ fontSize: '13px', opacity: 0.8, fontWeight: 500 }}>{selectedExitRequest.position || 'Employee'} · {selectedExitRequest.department || 'General'}</div>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '24px', marginTop: '20px' }}>
                                <div>
                                    <div style={{ fontSize: '10px', opacity: 0.6, marginBottom: '2px', textTransform: 'uppercase', fontWeight: 600 }}>Applied on</div>
                                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{new Date(selectedExitRequest.createdAt).toLocaleDateString()}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '10px', opacity: 0.6, marginBottom: '2px', textTransform: 'uppercase', fontWeight: 600 }}>Last working day</div>
                                    <div style={{ fontWeight: 600, fontSize: '13px', color: exitLwd ? '#fff' : '#fcd34d' }}>{exitLwd ? new Date(exitLwd).toLocaleDateString() : 'Not set'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '10px', opacity: 0.6, marginBottom: '2px', textTransform: 'uppercase', fontWeight: 600 }}>Days elapsed</div>
                                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{Math.floor((new Date() - new Date(selectedExitRequest.createdAt)) / (1000 * 60 * 60 * 24))} days</div>
                                </div>
                            </div>

                            <div style={{ background: '#ffffff', borderRadius: '10px', padding: '10px 12px', marginTop: '16px', display: 'flex', gap: '10px', border: '1px solid #e5e7eb', color: '#111827' }}>
                               <div style={{ background: '#f3f4f6', padding: '6px', borderRadius: '6px', height: 'fit-content' }}>
                                    <Info size={14} style={{ color: '#4b5563' }} />
                               </div>
                               <div>
                                    <div style={{ fontSize: '9px', color: '#6b7280', marginBottom: '2px', fontWeight: 700, textTransform: 'uppercase' }}>Reason</div>
                                    <div style={{ fontWeight: 500, fontSize: '12px', lineHeight: 1.4 }}>{selectedExitRequest.reason}</div>
                               </div>
                            </div>
                        </div>

                        {/* White Progress Section - Scrollable */}
                        <div style={{ padding: '24px 20px', background: '#fff', flex: 1, overflowY: 'auto' }} className="white-scrollbar">
                            <style>{`
                                .white-scrollbar::-webkit-scrollbar { width: 6px; }
                                .white-scrollbar::-webkit-scrollbar-track { background: #f9fafb; }
                                .white-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                                .white-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
                            `}</style>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '24px' }}>APPROVAL PROGRESS</div>
                            
                            {/* Vertical Timeline */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                {/* Step 1: Submitted */}
                                <div style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#dcfce7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #86efac', zIndex: 2 }}>
                                            <CheckCircle size={18} />
                                        </div>
                                        <div style={{ width: '2px', height: '40px', background: '#86efac', margin: '4px 0' }}></div>
                                    </div>
                                    <div style={{ paddingBottom: '32px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>Submitted by employee</div>
                                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>Request logged on {new Date(selectedExitRequest.createdAt).toLocaleDateString()}</div>
                                        <div style={{ marginTop: '8px' }}>
                                            <span style={{ background: '#f0fdf4', color: '#166534', padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, border: '1px solid #dcfce7' }}> Completed</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Step 2: Manager Approval */}
                                <div style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #ddd6fe', zIndex: 2 }}>
                                            <Users size={18} />
                                        </div>
                                        <div style={{ width: '2px', height: '40px', background: '#e5e7eb', margin: '4px 0' }}></div>
                                    </div>
                                    <div style={{ paddingBottom: '32px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>Manager approval</div>
                                            <span style={{ background: '#f5f3ff', color: '#7c3aed', padding: '1px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>YOU</span>
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px', maxWidth: '350px' }}>This step requires your decision before HR can proceed</div>
                                        <div style={{ marginTop: '8px' }}>
                                            <span style={{ background: '#fff', color: '#6366f1', padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, border: '1px dotted #6366f1', display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6366f1' }}></div>
                                                Awaiting your action
                                            </span>
                                        </div>

                                        {/* Action Box inside timeline */}
                                        <div style={{ background: '#f5f3ff', borderRadius: '12px', padding: '16px', marginTop: '16px', border: '1px solid #ddd6fe', display: 'flex', gap: '12px' }}>
                                            <div style={{ background: '#ecf0ff', padding: '8px', borderRadius: '8px', height: 'fit-content' }}>
                                                <AlertCircle size={18} style={{ color: '#4338ca' }} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '13px', color: '#312e81' }}>Review & respond</div>
                                                <div style={{ fontSize: '12px', color: '#4338ca', marginTop: '4px', lineHeight: 1.4 }}>
                                                    {selectedExitRequest.status === 'PENDING' 
                                                        ? 'Approve to forward to HR, or reject to close the request.' 
                                                        : 'Approve to forward to HR, or reject to close the request. You can also set the last working day below.'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Step 3: HR Approval */}
                                <div style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f3f4f6', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #e5e7eb', zIndex: 2 }}>
                                            <UserCheck size={18} />
                                        </div>
                                        <div style={{ width: 'x2px', height: '40px', background: '#f3f4f6', margin: '4px 0' }}></div>
                                    </div>
                                    <div style={{ paddingBottom: '32px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#9ca3af' }}>HR approval</div>
                                        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Unlocks after manager approval</div>
                                        <div style={{ marginTop: '8px' }}>
                                            <span style={{ background: '#f9fafb', color: '#9ca3af', padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, border: '1px solid #e5e7eb' }}>Pending</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {selectedExitRequest.status !== 'PENDING' && (
                                <div style={{ background: '#fffbeb', borderRadius: '16px', padding: '20px', marginTop: '12px', border: '1px solid #fde68a' }}>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#92400e', marginBottom: '12px', textTransform: 'uppercase' }}>SET LAST WORKING DAY</label>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <input 
                                            type="date" 
                                            value={exitLwd}
                                            onChange={(e) => setExitLwd(e.target.value)}
                                            style={{ flex: 1, padding: '12px 16px', borderRadius: '10px', border: '1px solid #fcd34d', background: '#fff', fontSize: '14px', fontWeight: 500, outline: 'none' }}
                                        />
                                        <button 
                                            className='hr-btn-secondary' 
                                            style={{ padding: '0 20px', borderRadius: '10px', height: '46px', background: '#fff', border: '1px solid #fcd34d', fontWeight: 600, color: '#92400e' }}
                                            onClick={() => setExitLwd(new Date().toISOString().split('T')[0])}
                                        >
                                            Today
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div style={{ marginTop: '24px' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#4b5563', marginBottom: '12px', textTransform: 'uppercase' }}>MANAGER COMMENTS (INTERNAL)</label>
                                <textarea 
                                    placeholder="Add notes for HR or internal record optional..."
                                    value={exitManagerComments}
                                    onChange={(e) => setExitManagerComments(e.target.value)}
                                    style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', background: '#f9fafb', minHeight: '100px', fontSize: '14px', outline: 'none', resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '24px' }}>
                                <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '12px', border: '1px solid #f3f4f6' }}>
                                    <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 800, marginBottom: '4px' }}>REQUEST ID</div>
                                    <div style={{ fontWeight: 700, color: '#111827', fontSize: '12px' }}>{selectedExitRequest.requestId || String(selectedExitRequest.id || '').toUpperCase()}</div>
                                </div>
                                <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '12px', border: '1px solid #f3f4f6' }}>
                                    <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 800, marginBottom: '4px' }}>NOTICE PERIOD</div>
                                    <div style={{ fontWeight: 700, color: '#92400e' }}>{selectedExitRequest.noticePeriod || 'Not confirmed'}</div>
                                </div>
                                <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '12px', border: '1px solid #f3f4f6' }}>
                                    <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 800, marginBottom: '4px' }}>DEPARTMENT</div>
                                    <div style={{ fontWeight: 700, color: '#111827' }}>{selectedExitRequest.department || 'Engineering'}</div>
                                </div>
                                <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '12px', border: '1px solid #f3f4f6' }}>
                                    <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 800, marginBottom: '4px' }}>TYPE</div>
                                    <div style={{ fontWeight: 700, color: '#111827' }}>{selectedExitRequest.type || 'Voluntary'}</div>
                                </div>
                            </div>
                        </div>

                        {(() => {
                            const reqStatus = (selectedExitRequest.status || 'PENDING').toUpperCase();
                            const isPending = reqStatus === 'PENDING' || reqStatus === 'SUBMITTED';
                            return (
                                <div style={{ 
                                    padding: '16px 24px', 
                                    borderTop: '1px solid #f3f4f6', 
                                    display: 'flex', 
                                    justifyContent: isPending ? 'space-between' : 'flex-end', 
                                    background: '#fff', 
                                    alignItems: 'center', 
                                    position: 'sticky', 
                                    bottom: 0, 
                                    zIndex: 10 
                                }}>
                                    {isPending ? (
                                        <>
                                            <button 
                                                onClick={() => handleExitResponse(selectedExitRequest.id, 'REJECT', exitManagerComments)}
                                                disabled={submittingAction.id === selectedExitRequest.id}
                                                style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #ef4444', color: '#ef4444', fontWeight: 700, background: '#fff', fontSize: '13px', cursor: 'pointer' }}
                                            >
                                                {submittingAction.id === selectedExitRequest.id && submittingAction.action === 'REJECT' ? <RefreshCw size={14} className="animate-spin" /> : 'Reject'}
                                            </button>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button 
                                                    onClick={() => setShowExitModal(false)}
                                                    style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #d1d5db', color: '#374151', fontWeight: 600, background: '#fff', fontSize: '13px', cursor: 'pointer' }}
                                                >
                                                    Close
                                                </button>
                                                <button 
                                                    disabled={submittingAction.id === selectedExitRequest.id}
                                                    onClick={async () => {
                                                        // If LWD changed, update it first
                                                        if (exitLwd && exitLwd !== (selectedExitRequest.lastWorkingDay ? new Date(selectedExitRequest.lastWorkingDay).toISOString().split('T')[0] : '')) {
                                                            try {
                                                                await exitAPI.updateLastWorkingDay(selectedExitRequest.id, { lastWorkingDay: exitLwd });
                                                            } catch (err) {
                                                                console.error('Failed to update LWD', err);
                                                            }
                                                        }
                                                        handleExitResponse(selectedExitRequest.id, 'APPROVE', exitManagerComments);
                                                    }}
                                                    style={{ 
                                                        padding: '8px 24px', 
                                                        borderRadius: '8px', 
                                                        background: 'linear-gradient(to right, #4f46e5, #4338ca)', 
                                                        color: '#fff', 
                                                        fontWeight: 700, 
                                                        border: 'none', 
                                                        fontSize: '13px', 
                                                        cursor: 'pointer',
                                                        boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.4)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px'
                                                    }}
                                                >
                                                    {submittingAction.id === selectedExitRequest.id && submittingAction.action === 'APPROVE' ? (
                                                        <RefreshCw size={14} className="animate-spin" />
                                                    ) : null}
                                                    Approve & forward
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <button 
                                            onClick={() => setShowExitModal(false)}
                                            style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #d1d5db', color: '#374151', fontWeight: 600, background: '#fff', fontSize: '13px', cursor: 'pointer' }}
                                        >
                                            Close
                                        </button>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Team Member Assets Modal */}
            {showAssetModal && selectedMemberAssets && (
                <div className="hr-modal-overlay" onClick={() => setShowAssetModal(false)}>
                    <div className="hr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', width: '95%', borderRadius: '12px' }}>
                        <div className="hr-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ backgroundColor: '#eff6ff', padding: '10px', borderRadius: '10px' }}>
                                    <Monitor size={20} style={{ color: '#3b82f6' }} />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>Team Member Assets</h2>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                                        {`${selectedMemberAssets.member.firstName || ''} ${selectedMemberAssets.member.lastName || ''}`.trim() || selectedMemberAssets.member.employeeId}
                                    </p>
                                </div>
                            </div>
                            <button className="hr-modal-close" onClick={() => setShowAssetModal(false)}><X size={20} /></button>
                        </div>

                        <div className="hr-modal-body" style={{ padding: '20px' }}>
                            <div style={{ overflowX: 'auto', border: '1px solid #f1f5f9', borderRadius: '12px' }}>
                                <table className="employee-table" style={{ margin: 0 }}>
                                    <thead style={{ backgroundColor: '#fdfdfd' }}>
                                        <tr>
                                            <th style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>Asset</th>
                                            <th style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>Type</th>
                                            <th style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>Status</th>
                                            <th style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>Assigned Date</th>
                                            <th style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedMemberAssets.assets.length === 0 ? (
                                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No assets assigned to this team member</td></tr>
                                        ) : (
                                            selectedMemberAssets.assets.map((asset) => (
                                                <tr key={asset.id}>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <div style={{ fontWeight: 600, fontSize: '13px', color: '#334155' }}>{asset.assetName || asset.assetId}</div>
                                                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{asset.assetId}</div>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569' }}>{asset.assetType || '—'}</td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <select
                                                            value={asset.status || 'ASSIGNED'}
                                                            disabled={updatingAssetStatusId === asset.id}
                                                            onChange={(e) => handleUpdateTeamAssetStatus(asset.id, e.target.value)}
                                                            style={{
                                                                fontSize: '12px',
                                                                padding: '6px 10px',
                                                                borderRadius: '8px',
                                                                border: '1px solid #e2e8f0',
                                                                background: '#fff',
                                                                minWidth: '130px',
                                                            }}
                                                        >
                                                            <option value="ASSIGNED">Assigned</option>
                                                            <option value="MAINTENANCE">Maintenance</option>
                                                            <option value="DAMAGED">Damaged</option>
                                                            <option value="LOST">Lost</option>
                                                        </select>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569' }}>
                                                        {asset.assignedDate ? new Date(asset.assignedDate).toLocaleDateString() : '—'}
                                                    </td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <button
                                                            className="hr-btn-secondary"
                                                            style={{ fontSize: '11px', padding: '4px 10px' }}
                                                            onClick={() => handleReturnTeamAsset(asset.id)}
                                                        >
                                                            Return Asset
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="hr-modal-footer" style={{ borderTop: '1px solid #f1f5f9', padding: '16px 20px', backgroundColor: '#fcfcfc' }}>
                            <button className="hr-btn-secondary" onClick={() => setShowAssetModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Exit Asset Handover Modal */}
            {showHandoverModal && selectedHandover && (
                <div className="hr-modal-overlay" onClick={() => setShowHandoverModal(false)}>
                    <div className="hr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', width: '95%', borderRadius: '12px' }}>
                        <div className="hr-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                            <div>
                                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>Exit Asset Clearance</h2>
                                <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                                    {selectedHandover.employeeName} ({selectedHandover.employeeEmployeeId || '—'})
                                </p>
                            </div>
                            <button className="hr-modal-close" onClick={() => setShowHandoverModal(false)}><X size={20} /></button>
                        </div>
                        <div className="hr-modal-body" style={{ padding: '20px' }}>
                            {selectedHandover.notes && (
                                <div style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '10px', fontSize: '12px', color: '#475569' }}>
                                    {selectedHandover.notes}
                                </div>
                            )}
                            <div style={{ overflowX: 'auto', border: '1px solid #f1f5f9', borderRadius: '12px' }}>
                                <table className="employee-table" style={{ margin: 0 }}>
                                    <thead style={{ backgroundColor: '#fdfdfd' }}>
                                        <tr>
                                            <th style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>Asset</th>
                                            <th style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>Type</th>
                                            <th style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(selectedHandover.assetItems || []).length === 0 ? (
                                            <tr><td colSpan="3" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No asset items listed</td></tr>
                                        ) : (
                                            selectedHandover.assetItems.map((item) => (
                                                <tr key={item.id}>
                                                    <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: '13px' }}>{item.assetName}</td>
                                                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569' }}>{item.assetType || '—'}</td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <select
                                                            value={item.status || 'PENDING'}
                                                            disabled={updatingHandoverItemId === item.id}
                                                            onChange={(e) => handleUpdateHandoverItemStatus(item.id, e.target.value)}
                                                            style={{
                                                                fontSize: '12px',
                                                                padding: '6px 10px',
                                                                borderRadius: '8px',
                                                                border: '1px solid #e2e8f0',
                                                                background: '#fff',
                                                                minWidth: '130px',
                                                            }}
                                                        >
                                                            <option value="PENDING">Pending</option>
                                                            <option value="RETURNED">Returned</option>
                                                            <option value="MISSING">Missing</option>
                                                            <option value="DAMAGED">Damaged</option>
                                                        </select>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="hr-modal-footer" style={{ borderTop: '1px solid #f1f5f9', padding: '16px 20px', backgroundColor: '#fcfcfc' }}>
                            <button className="hr-btn-secondary" onClick={() => setShowHandoverModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign Asset Modal */}
            {showAssignAssetModal && (
                <div className="hr-modal-overlay" style={{ zIndex: 1200 }} onClick={() => setShowAssignAssetModal(false)}>
                    <div className="hr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', width: '95%', borderRadius: '12px' }}>
                        <div className="hr-modal-header">
                            <h2>Assign New Asset</h2>
                            <button type="button" className="hr-modal-close" onClick={() => setShowAssignAssetModal(false)}><X size={20} /></button>
                        </div>
                        <div className="hr-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => setAssetAssignMode('existing')}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        background: assetAssignMode === 'existing' ? '#fff' : 'transparent',
                                        color: assetAssignMode === 'existing' ? '#1a4ff0' : '#64748b',
                                        boxShadow: assetAssignMode === 'existing' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                    }}
                                >
                                    From inventory
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAssetAssignMode('new')}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        background: assetAssignMode === 'new' ? '#fff' : 'transparent',
                                        color: assetAssignMode === 'new' ? '#1a4ff0' : '#64748b',
                                        boxShadow: assetAssignMode === 'new' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                    }}
                                >
                                    Assign New
                                </button>
                            </div>

                            <div className="hr-form-group" style={{ position: 'relative' }}>
                                <label>Team Member *</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        placeholder="Search and select team member by name or ID..."
                                        value={memberSearchTerm}
                                        onChange={(e) => {
                                            setMemberSearchTerm(e.target.value);
                                            setShowMemberDropdown(true);
                                            setAssetAssignForm(prev => ({ ...prev, employeeId: '' }));
                                        }}
                                        onFocus={() => setShowMemberDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowMemberDropdown(false), 200)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 30px 8px 8px',
                                            borderRadius: '6px',
                                            border: '1px solid #d1d5db',
                                            fontSize: '13px'
                                        }}
                                    />
                                    {assetAssignForm.employeeId && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMemberSearchTerm('');
                                                setAssetAssignForm(prev => ({ ...prev, employeeId: '' }));
                                                setShowMemberDropdown(false);
                                            }}
                                            style={{
                                                position: 'absolute',
                                                right: '8px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                border: 'none',
                                                background: 'transparent',
                                                cursor: 'pointer',
                                                color: '#94a3b8',
                                                fontSize: '14px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                {showMemberDropdown && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        zIndex: 1000,
                                        background: '#fff',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        maxHeight: '200px',
                                        overflowY: 'auto',
                                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)'
                                    }}>
                                        {teamMembers
                                            .filter(m => getTeamMemberDbId(m))
                                            .filter(m => {
                                                const name = `${m.firstName || ''} ${m.lastName || ''}`.toLowerCase();
                                                const empId = String(m.employeeId || '').toLowerCase();
                                                const query = memberSearchTerm.toLowerCase();
                                                const selectedStr = `${m.firstName || ''} ${m.lastName || ''} (${m.employeeId || ''})`.toLowerCase();
                                                if (selectedStr === query) return true;
                                                return name.includes(query) || empId.includes(query);
                                            })
                                            .map(member => {
                                                const dbId = getTeamMemberDbId(member);
                                                if (!dbId) return null;
                                                const label = `${member.firstName || ''} ${member.lastName || ''}`.trim() + ` (${member.employeeId})`;
                                                const isSelected = String(assetAssignForm.employeeId) === String(dbId);
                                                return (
                                                    <div
                                                        key={dbId}
                                                        onMouseDown={() => {
                                                            setAssetAssignForm(prev => ({ ...prev, employeeId: String(dbId) }));
                                                            setMemberSearchTerm(label);
                                                            setShowMemberDropdown(false);
                                                        }}
                                                        style={{
                                                            padding: '8px 12px',
                                                            cursor: 'pointer',
                                                            fontSize: '13px',
                                                            background: isSelected ? '#eff6ff' : '#fff',
                                                            color: isSelected ? '#1d4ed8' : '#374151',
                                                            fontWeight: isSelected ? '600' : '400',
                                                            borderBottom: '1px solid #f3f4f6'
                                                        }}
                                                    >
                                                        {label}
                                                    </div>
                                                );
                                            })}
                                        {teamMembers
                                            .filter(m => getTeamMemberDbId(m))
                                            .filter(m => {
                                                const name = `${m.firstName || ''} ${m.lastName || ''}`.toLowerCase();
                                                const empId = String(m.employeeId || '').toLowerCase();
                                                const query = memberSearchTerm.toLowerCase();
                                                return name.includes(query) || empId.includes(query);
                                            }).length === 0 && (
                                            <div style={{ padding: '8px 12px', fontSize: '13px', color: '#94a3b8', textAlign: 'center' }}>
                                                No matching team members
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {assetAssignMode === 'existing' ? (
                                <div className="hr-form-group">
                                    <label>Available Asset *</label>
                                    {availableAssets.length === 0 ? (
                                        <div style={{ padding: '12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '12px', color: '#92400e' }}>
                                            No assets available in inventory. Use <strong>Assign New</strong> to register and assign one.
                                        </div>
                                    ) : (
                                        <select
                                            value={assetAssignForm.assetId}
                                            onChange={(e) => setAssetAssignForm({ ...assetAssignForm, assetId: e.target.value })}
                                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                        >
                                            <option value="">Select asset</option>
                                            {availableAssets.map(asset => (
                                                <option key={asset.id} value={asset.id}>
                                                    {asset.assetName || asset.assetId} ({asset.assetType || 'General'})
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div className="hr-form-group">
                                        <label>Asset Name *</label>
                                        <input
                                            type="text"
                                            value={assetAssignForm.assetName}
                                            onChange={(e) => setAssetAssignForm({ ...assetAssignForm, assetName: e.target.value })}
                                            placeholder="e.g. Dell Latitude 5420"
                                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                        />
                                    </div>
                                    <div className="hr-form-group">
                                        <label>Asset Type</label>
                                        <select
                                            value={assetAssignForm.assetType}
                                            onChange={(e) => setAssetAssignForm({ ...assetAssignForm, assetType: e.target.value })}
                                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                        >
                                            {ASSET_TYPE_OPTIONS.map(type => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}

                            <div className="hr-form-group">
                                <label>Location</label>
                                <input
                                    type="text"
                                    value={assetAssignForm.location}
                                    onChange={(e) => setAssetAssignForm({ ...assetAssignForm, location: e.target.value })}
                                    placeholder="Optional location"
                                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                />
                            </div>
                            <div className="hr-form-group">
                                <label>Notes</label>
                                <textarea
                                    value={assetAssignForm.notes}
                                    onChange={(e) => setAssetAssignForm({ ...assetAssignForm, notes: e.target.value })}
                                    placeholder="Optional notes"
                                    rows={3}
                                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                />
                            </div>
                        </div>
                        <div className="hr-modal-footer" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button type="button" className="hr-btn-secondary" onClick={() => setShowAssignAssetModal(false)}>Cancel</button>
                            <button
                                type="button"
                                className="hr-btn-primary"
                                disabled={assigningAsset}
                                onClick={handleAssignTeamAsset}
                            >
                                {assigningAsset ? 'Saving...' : (assetAssignMode === 'new' ? 'Assign New' : 'Assign Asset')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Approval Delegation Modal */}
            {showDelegationModal && (
                <div className="hr-modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1100, backdropFilter: 'blur(4px)'
                }}>
                    <div className="hr-modal-card" style={{
                        background: '#fff', borderRadius: '14px', width: '90%', maxWidth: '520px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        overflow: 'hidden', animation: 'scaleUp 0.2s ease-out'
                    }}>
                        <div className="hr-modal-header" style={{
                            padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: '#f8fafc'
                        }}>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Shield size={18} color="#4f46e5" />
                                Add Approval Delegation
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowDelegationModal(false)}
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', fontSize: '18px' }}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreateDelegation}>
                            <div className="hr-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div style={{ fontSize: '12px', color: '#475569', background: '#eff6ff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                                    Delegate your approval rights to a peer manager or HR/CEO during your absence. Regular employees without managerial or leadership roles are excluded.
                                </div>

                                <div className="hr-form-group">
                                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' }}>
                                        Delegate To (Manager / HR / CEO) *
                                    </label>
                                    <select
                                        value={delegationForm.delegateeId}
                                        onChange={(e) => setDelegationForm({ ...delegationForm, delegateeId: e.target.value })}
                                        required
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                                    >
                                        <option value="">-- Select an eligible Manager or HR/CEO --</option>
                                        {eligibleDelegates.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.name} ({c.employeeId}) {c.designation ? `• ${c.designation}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="hr-form-group">
                                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' }}>
                                            Start Date *
                                        </label>
                                        <input
                                            type="date"
                                            value={delegationForm.startDate}
                                            min={new Date().toISOString().split('T')[0]}
                                            onChange={(e) => setDelegationForm({ ...delegationForm, startDate: e.target.value })}
                                            required
                                            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                                        />
                                    </div>
                                    <div className="hr-form-group">
                                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' }}>
                                            End Date *
                                        </label>
                                        <input
                                            type="date"
                                            value={delegationForm.endDate}
                                            min={delegationForm.startDate || new Date().toISOString().split('T')[0]}
                                            onChange={(e) => setDelegationForm({ ...delegationForm, endDate: e.target.value })}
                                            required
                                            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                                        />
                                    </div>
                                </div>

                                <div className="hr-form-group">
                                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' }}>
                                        Scope of Authority
                                    </label>
                                    <select
                                        value={delegationForm.scope}
                                        onChange={(e) => setDelegationForm({ ...delegationForm, scope: e.target.value })}
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                                    >
                                        <option value="ALL">ALL (Leaves, WFH, Expenses)</option>
                                        <option value="LEAVE">LEAVE Requests Only</option>
                                        <option value="WFH">WFH Requests Only</option>
                                        <option value="EXPENSE">Expense Claims Only</option>
                                    </select>
                                </div>

                                <div className="hr-form-group">
                                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' }}>
                                        Reason / Handover Note
                                    </label>
                                    <textarea
                                        value={delegationForm.reason}
                                        onChange={(e) => setDelegationForm({ ...delegationForm, reason: e.target.value })}
                                        placeholder="e.g. On annual leave from 15th to 25th Oct. Handing over team approvals."
                                        rows={3}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical' }}
                                    />
                                </div>
                            </div>

                            <div className="hr-modal-footer" style={{
                                padding: '14px 20px', borderTop: '1px solid #f1f5f9',
                                display: 'flex', justifyContent: 'flex-end', gap: '10px',
                                background: '#f8fafc'
                            }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowDelegationModal(false)}
                                    style={{ height: '36px', padding: '0 16px', fontSize: '13px' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={creatingDelegation}
                                    style={{ height: '36px', padding: '0 18px', fontSize: '13px', fontWeight: 600 }}
                                >
                                    {creatingDelegation ? 'Delegating...' : 'Confirm Delegation'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>

    );
};

/* Ã¢â€â‚¬Ã¢â€â‚¬ Attendance Calendar renderer (copied from ManagerAnalytics) Ã¢â€â‚¬Ã¢â€â‚¬ */
function renderAttendanceCalendar(calendar, month, setMonth, refresh, isLoading) {
    const calStyles = {
        card: { padding: '8px 0', marginBottom: 20 },
        cardTitle: { fontSize: 16, fontWeight: 600, color: '#1e293b', marginBottom: 14, margin: '0 0 14px 0' },
        table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
        th: { textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: '#475569', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontSize: 13 },
        td: { padding: '10px 14px', borderBottom: '1px solid #f1f5f9', color: '#1e293b' },
        refreshBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#3b82f6' },
        dateInput: { padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, color: '#1e293b', background: '#fff' },
    };

    const totalPresent = calendar.reduce((a, s) => a + (s.presentDays || 0) + (s.wfhDays || 0), 0);
    const totalAbsent = calendar.reduce((a, s) => a + (s.absentDays || 0), 0);
    const totalLeave = calendar.reduce((a, s) => a + (s.leaveDays || 0), 0);
    const totalWfh = calendar.reduce((a, s) => a + (s.wfhDays || 0), 0);

    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const days = [];
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(new Date(y, m - 1, i));
    }

    const monthLabel = new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

    const goMonth = (dir) => {
        const dt = new Date(y, m - 1 + dir, 1);
        setMonth(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
    };

    const cellColor = { P: '#10b981', W: '#3b82f6', L: '#f59e0b', H: '#e2e8f0', HD: '#a855f7', A: '#fecaca', F: '#ffffff' };
    const cellText  = { P: '#fff', W: '#fff', L: '#fff', H: '#64748b', HD: '#fff', A: '#b91c1c', F: '#cbd5e1' };

    return (
        <>
            {/* Month picker */}
            <div className="mp-section" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <button onClick={() => goMonth(-1)} style={{ ...calStyles.refreshBtn, padding: '6px 12px' }}>&larr;</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        style={{ ...calStyles.dateInput, fontSize: 14, fontWeight: 600 }}
                    />
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#334155' }}>{monthLabel}</span>
                </div>
                <button onClick={() => goMonth(1)} style={{ ...calStyles.refreshBtn, padding: '6px 12px' }}>&rarr;</button>
                <button onClick={refresh} style={calStyles.refreshBtn}>
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>


            {/* Calendar grid */}
            <div style={calStyles.card}>
                <h3 className="mp-section" style={calStyles.cardTitle}>Attendance Calendar</h3>
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading calendar...</div>
                ) : (
                    <div className="custom-attendance-scrollbar" style={{ overflowX: 'auto', paddingBottom: '12px' }}>
                        <style>{`
                            .custom-attendance-scrollbar::-webkit-scrollbar { height: 6px; }
                            .custom-attendance-scrollbar::-webkit-scrollbar-track { background: #f8fafc; }
                            .custom-attendance-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                            .custom-attendance-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
                        `}</style>
                        <table style={{ ...calStyles.table, fontSize: 11, borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%' }}>
                            <thead>
                                <tr>
                                    <th style={{ ...calStyles.th, position: 'sticky', left: 0, background: '#fff', zIndex: 2, width: 80, minWidth: 80, borderBottom: '2px solid #e2e8f0', fontSize: 11, padding: '8px' }}>Employee</th>
                                    {days.map((d, i) => {
                                        const dayName = ['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()];
                                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                        return (
                                            <th key={i} style={{
                                                textAlign: 'center', padding: '2px 0',
                                                width: 22, minWidth: 22, fontSize: 8, fontWeight: 600,
                                                color: isWeekend ? '#94a3b8' : '#334155',
                                                borderBottom: '2px solid #e2e8f0',
                                                background: isWeekend ? '#f8fafc' : '#fff',
                                            }}>
                                                <div style={{ fontSize: 10, fontWeight: 700 }}>{d.getDate()}</div>
                                                <div style={{ fontSize: 8, fontWeight: 400, color: isWeekend ? '#94a3b8' : '#64748b' }}>{dayName}</div>
                                            </th>
                                        );
                                    })}
                                    <th style={{ ...calStyles.th, textAlign: 'center', fontSize: 8, width: 28, borderBottom: '2px solid #e2e8f0', color: '#10b981', padding: '4px' }}>P</th>
                                    <th style={{ ...calStyles.th, textAlign: 'center', fontSize: 8, width: 28, borderBottom: '2px solid #e2e8f0', color: '#3b82f6', padding: '4px' }}>W</th>
                                    <th style={{ ...calStyles.th, textAlign: 'center', fontSize: 8, width: 28, borderBottom: '2px solid #e2e8f0', color: '#f59e0b', padding: '4px' }}>L</th>
                                    <th style={{ ...calStyles.th, textAlign: 'center', fontSize: 8, width: 28, borderBottom: '2px solid #e2e8f0', color: '#ef4444', padding: '4px' }}>A</th>
                                </tr>
                            </thead>
                            <tbody>
                                {calendar.map((emp, rowIdx) => (
                                    <tr key={rowIdx}>
                                        <td style={{
                                            position: 'sticky', left: 0, background: '#fff', zIndex: 1,
                                            whiteSpace: 'nowrap', padding: '4px 8px', width: 80,
                                            borderBottom: '1px solid #f1f5f9',
                                        }}>
                                            <div style={{ fontWeight: 600, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.employeeName}</div>
                                            <div style={{ fontSize: 8, color: '#64748b' }}>{emp.employeeId}</div>
                                        </td>
                                        {days.map((d, colIdx) => {
                                            const dayNum = String(d.getDate());
                                            const code = emp.days?.[dayNum] || '-';
                                            const bg = cellColor[code] || 'transparent';
                                            const fg = cellText[code] || '#cbd5e1';
                                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                            return (
                                                <td key={colIdx} style={{ textAlign: 'center', padding: '2px 0', width: 22, borderBottom: '1px solid #f1f5f9', background: isWeekend ? '#fafbfc' : 'transparent' }}>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                        width: 22, height: 22, borderRadius: '50%',
                                                        fontSize: 9, fontWeight: 700,
                                                        background: bg, color: fg,
                                                        border: code === 'F' ? '1px solid #e2e8f0' : code === '-' ? '1px dashed #e2e8f0' : 'none',
                                                    }}>
                                                        {code !== '-' ? code : ''}
                                                    </span>
                                                </td>
                                            );
                                        })}
                                        <td style={{ textAlign: 'center', fontWeight: 600, color: '#10b981', padding: '2px', borderBottom: '1px solid #f1f5f9', fontSize: 9, width: 28 }}>{emp.presentDays || 0}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 600, color: '#3b82f6', padding: '2px', borderBottom: '1px solid #f1f5f9', fontSize: 9, width: 28 }}>{emp.wfhDays || 0}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 600, color: '#f59e0b', padding: '2px', borderBottom: '1px solid #f1f5f9', fontSize: 9, width: 28 }}>{emp.leaveDays || 0}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 600, color: '#ef4444', padding: '2px', borderBottom: '1px solid #f1f5f9', fontSize: 9, width: 28 }}>{emp.absentDays || 0}</td>
                                    </tr>
                                ))}
                                {calendar.length === 0 && (
                                    <tr><td colSpan={days.length + 5} style={{ ...calStyles.td, textAlign: 'center', color: '#94a3b8' }}>No attendance data</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Legend */}
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

export default Team;

