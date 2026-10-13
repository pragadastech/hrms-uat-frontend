import { useState, useEffect, useMemo } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import DatePicker from '../components/DatePicker';
import {
  Calendar, Plus, Filter, Clock, Info, PartyPopper,
  Upload, X, Palmtree, TrendingUp, ClipboardList,
  Edit, Trash2, Loader2, Download, FileText, Eye
} from 'lucide-react';
import LeaveHistoryImportModal from '../components/LeaveHistoryImportModal';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import './Leaves.css';
import {
  createLeaveRequest,
  createLeaveRequestAsAdmin,
  getEmployeeLeaveRequests,
  getEmployeeLeaveRequestsAsAdmin,
  getPendingLeaveRequests,
  employeeAPI,
  getLeaveBalances,
  getLeaveBalancesAsAdmin,
  holidayCalendarAPI,
  leaveBalanceAPI,
  teamAPI,
  adminAPI,
  updateLeaveRequest,
  cancelEmployeeLeaveRequest,
  documentAPI,
  leavePolicyAPI
} from '../services/api';
import Header from '../components/Header';

const BALANCE_COLORS = ['#0891b2', '#22c55e', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
const CONSUMED_COLORS = ['#0891b2', '#f59e0b', '#ef4444', '#22c55e', '#8b5cf6', '#ec4899'];

const parseLeaveRequestList = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.leaveRequests)) return payload.leaveRequests;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
};

export default function Leaves({ adminSelfService = false }) {
  const { user, hasAdminAccess, sessionType, hasCrudPermission } = useAuth();
  const location = useLocation();
  const isAdminSelfService =
    adminSelfService || (sessionType === 'admin' && location.pathname.startsWith('/admin/my-leaves'));

  const canAccessMyLeaves = hasCrudPermission ? hasCrudPermission('WORKFORCE_LEAVE_SELF', 'read') : true;
  if (!canAccessMyLeaves && !isAdminSelfService) {
    return <Navigate to="/employee/dashboard" replace />;
  }

  const canCreateLeave = hasCrudPermission ? hasCrudPermission('WORKFORCE_LEAVE_SELF', 'create') : true;
  const canUpdateLeave = hasCrudPermission ? hasCrudPermission('WORKFORCE_LEAVE_SELF', 'update') : true;

  const hasHrOrCeoRole = Array.isArray(user?.roles)
    && user.roles.some((role) => ['HR', 'CEO'].includes(String(role).trim().toUpperCase()));
  const [activeSubTab, setActiveSubTab] = useState('summary');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [policyData, setPolicyData] = useState(null);
  const [policyLoading, setPolicyLoading] = useState(false);

  // Date range
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Leave balances - keyed by leave type code (e.g. 'AL', 'SL')
  // Each entry: { available, consumed, annual, name, code }
  const [leaveBalancesByCode, setLeaveBalancesByCode] = useState({});
  // Keep backward-compat alias for getAvailableBalance
  const leaveBalances = leaveBalancesByCode;

  // Pending requests
  const [pendingRequests, setPendingRequests] = useState([]);

  // Leave history
  const [leaveHistory, setLeaveHistory] = useState([]);

  // Active leave types from API (admin-defined for this org) – used for dropdown and "Other Leave Types" display. WFH excluded (separate module).
  const [activeLeaveTypes, setActiveLeaveTypes] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const leaveTypesForLeave = activeLeaveTypes.filter(lt => (lt.leaveTypeCode || '').toUpperCase() !== 'WFH');

  // Leave form modal
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
    halfDayType: null, // null = full day, 'MORNING_HALF' = first half, 'AFTERNOON_HALF' = second half
    supportingDocumentPath: '',
  });
  const [editingLeaveId, setEditingLeaveId] = useState(null);
  const [cancellingLeave, setCancellingLeave] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [historyLeaveTypeFilter, setHistoryLeaveTypeFilter] = useState('ALL');
  const [viewLeaveModal, setViewLeaveModal] = useState(null);

  // Adjustment Modal
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState({
    employeeId: '',
    leaveType: '',
    adjustmentType: 'ADDITION',
    days: '',
    reason: ''
  });
  const [employees, setEmployees] = useState([]);
  const [adjustmentHistory, setAdjustmentHistory] = useState([]);

  const isPrivileged = user?.roles?.some(r => ['MANAGER', 'HR', 'CEO', 'ADMIN'].includes(r.toUpperCase())) ||
    ['HR', 'CEO', 'ADMIN', 'MANAGER'].includes(user?.employeeRoleName?.toUpperCase()) ||
    hasAdminAccess();

  const hasSpecialCancelAccess = user?.roles?.some(r => ['HR', 'CEO', 'ADMIN'].includes(r.toUpperCase())) ||
    ['HR', 'CEO', 'ADMIN'].includes(user?.employeeRoleName?.toUpperCase()) ||
    hasAdminAccess();

  const renderTimeline = (req) => {
    if (!req) return null;

    const formatTimestamp = (ts) => {
      if (!ts) return '';
      try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      } catch (e) {
        return '';
      }
    };

    const status = (req.status || '').toUpperCase();
    const appliedTime = formatTimestamp(req.createdAt || req.appliedAt);
    const updatedTime = req.updatedAt && req.updatedAt !== req.createdAt ? formatTimestamp(req.updatedAt) : null;
    const actionTime = formatTimestamp(req.adminResponseDate || req.managerResponseDate);

    const timelineEvents = [];

    // 1. Applied Event
    if (appliedTime) {
      timelineEvents.push({
        title: 'Request Submitted',
        time: appliedTime,
        status: 'completed',
        color: '#2563eb'
      });
    }

    // 2. Updated Event
    if (updatedTime && status !== 'CANCELLED' && (!actionTime || req.updatedAt < (req.adminResponseDate || req.managerResponseDate))) {
      timelineEvents.push({
        title: 'Request Updated',
        time: updatedTime,
        status: 'completed',
        color: '#6366f1'
      });
    }

    // 3. Final Action Event (Approved / Rejected / Cancelled)
    if (status === 'APPROVED') {
      timelineEvents.push({
        title: 'Request Approved',
        time: actionTime || formatTimestamp(req.updatedAt),
        status: 'completed',
        color: '#10b981'
      });
    } else if (status === 'REJECTED') {
      timelineEvents.push({
        title: 'Request Rejected',
        time: actionTime || formatTimestamp(req.updatedAt),
        status: 'completed',
        color: '#ef4444'
      });
    } else if (status === 'CANCELLED') {
      timelineEvents.push({
        title: 'Request Cancelled',
        time: formatTimestamp(req.updatedAt),
        status: 'completed',
        color: '#6b7280'
      });
    } else {
      timelineEvents.push({
        title: 'Awaiting Approval',
        time: 'Pending decision',
        status: 'pending',
        color: '#f59e0b'
      });
    }

    return (
      <div style={{ marginTop: '16px', borderTop: '1px solid var(--lv-border)', paddingTop: '16px' }}>
        <h4 style={{ fontSize: '11px', color: 'var(--lv-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.04em' }}>Request Timeline</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', paddingLeft: '20px' }}>
          <div style={{
            position: 'absolute',
            left: '6px',
            top: '4px',
            bottom: '4px',
            width: '2px',
            backgroundColor: '#e2e8f0',
            zIndex: 0
          }} />

          {timelineEvents.map((evt, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  position: 'absolute',
                  left: '-18px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: evt.color,
                  border: '2px solid #fff',
                  boxShadow: '0 0 0 2px ' + evt.color + '20'
                }} />
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', display: 'block' }}>{evt.title}</span>
                </div>
              </div>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{evt.time}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  useEffect(() => {
    fetchLeaveData();
    if (isPrivileged) {
      fetchEmployeesForAdjustment();
    }
  }, [isPrivileged, isAdminSelfService]);

  useEffect(() => {
    if (activeSubTab === 'policy') {
      fetchPolicy();
    }
  }, [activeSubTab]);

  const fetchPolicy = async () => {
    setPolicyLoading(true);
    try {
      const res = await leavePolicyAPI.getLeavePolicyForEmployee();
      if (res?.data && res.data.exists !== false) {
        setPolicyData(res.data);
      } else {
        setPolicyData(null);
      }
    } catch (err) {
      console.error('Error fetching leave policy:', err);
      setPolicyData(null);
    } finally {
      setPolicyLoading(false);
    }
  };

  const handleDownloadPolicy = async () => {
    try {
      const response = await leavePolicyAPI.downloadLeavePolicy();
      const blob = new Blob([response.data], { type: policyData?.mimeType || 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', policyData?.fileName || 'Leave_Policy.pdf');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error('Error downloading policy:', err);
      toast.error('Failed to download leave policy document');
    }
  };

  const renderLeavePolicyTab = () => {
    if (policyLoading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 20px', flexDirection: 'column', gap: '12px' }}>
          <Loader2 className="animate-spin" size={36} color="var(--lv-primary)" />
          <p style={{ color: 'var(--lv-text-muted)', fontSize: '14px', fontWeight: 500 }}>Loading leave policy...</p>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Document Section */}
        <div className="card" style={{ margin: 0, padding: '20px' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '16px', fontWeight: 700 }}>
            <FileText size={18} color="var(--lv-primary)" />
            Organization Leave Policy Document
          </h3>

          {policyData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                background: 'var(--lv-primary-soft)',
                border: '1px solid rgba(8, 145, 178, 0.15)',
                borderRadius: '10px',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: 'var(--lv-primary)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--lv-text)', wordBreak: 'break-all' }}>{policyData.fileName}</h4>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--lv-text-muted)' }}>
                      Uploaded on {policyData.uploadDate} • {(policyData.fileSize / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDownloadPolicy}
                  className="lv-btn-primary"
                  style={{ height: '36px', padding: '0 16px', borderRadius: '8px' }}
                >
                  <Download size={16} />
                  Download Document
                </button>
              </div>

              {/* If pdf, show iframe preview */}
              {policyData.mimeType === 'application/pdf' && policyData.fileData && (
                <div style={{
                  border: '1px solid var(--lv-border)',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  marginTop: '8px',
                  boxShadow: 'var(--lv-shadow)'
                }}>
                  <iframe
                    src={`data:application/pdf;base64,${policyData.fileData}`}
                    title="Leave Policy PDF Preview"
                    width="100%"
                    height="600px"
                    style={{ border: 'none', display: 'block' }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 20px',
              border: '2px dashed var(--lv-border)',
              borderRadius: '12px',
              textAlign: 'center',
              gap: '12px'
            }}>
              <Info size={32} style={{ color: 'var(--lv-text-muted)', opacity: 0.6 }} />
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--dark-500)' }}>No Policy Document Uploaded</h4>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--lv-text-muted)', maxWidth: '400px' }}>
                  Your organization hasn't uploaded a leave policy file yet. Please refer to the leave rules below or contact your HR administrator.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Leave Type Guidelines Section */}
        <div className="card" style={{ margin: 0, padding: '20px' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '16px', fontWeight: 700 }}>
            <ClipboardList size={18} color="var(--lv-primary)" />
            Active Leave Types & Guidelines
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--lv-text-muted)', margin: '0 0 16px' }}>
            Below are the policy configurations, annual quotas, and application restrictions defined for each eligible leave type in your organization.
          </p>

          <div className="employee-table-container" style={{ margin: 0, border: '1px solid var(--lv-border)', borderRadius: '10px' }}>
            <table className="employee-table">
              <thead>
                <tr>
                  <th style={{ padding: '12px 16px' }}>Leave Type</th>
                  <th style={{ padding: '12px 16px' }}>Code</th>
                  <th style={{ padding: '12px 16px' }}>Annual Quota</th>
                  <th style={{ padding: '12px 16px' }}>Max Consecutive Days</th>
                  <th style={{ padding: '12px 16px' }}>Requires Document</th>
                  <th style={{ padding: '12px 16px' }}>Carry Forward</th>
                </tr>
              </thead>
              <tbody>
                {leaveTypesForLeave && leaveTypesForLeave.length > 0 ? (
                  leaveTypesForLeave.map((lt) => {
                    const code = lt.leaveTypeCode || lt.leaveTypeName || '';
                    const balanceDetails = leaveBalancesByCode[code] || {};
                    const annualQuota = balanceDetails.annual ?? lt.defaultLeaveCount ?? lt.maxDays ?? 0;

                    return (
                      <tr key={lt.id || lt.leaveTypeCode}>
                        <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--dark-500)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              backgroundColor: lt.colorCode || '#0891b2',
                              display: 'inline-block'
                            }} />
                            {lt.leaveTypeName}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 500, color: 'var(--lv-text)' }}>
                          {code}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                          {annualQuota} {annualQuota === 1 ? 'day' : 'days'}
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--lv-text-muted)' }}>
                          {lt.maxContinuousDays ? `${lt.maxContinuousDays} days` : 'No limit'}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {lt.requiresDocument ? (
                            <span className="lv-status pending" style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                              Required
                            </span>
                          ) : (
                            <span style={{ color: 'var(--lv-text-muted)', fontSize: '13px' }}>Not required</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {lt.carryForward ? (
                            <span className="lv-status approved" style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, backgroundColor: 'var(--lv-accent-soft)', color: 'var(--lv-accent)' }}>
                              Allowed
                            </span>
                          ) : (
                            <span style={{ color: 'var(--lv-text-muted)', fontSize: '13px' }}>Lapses</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--lv-text-muted)' }}>
                      No active leave types configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  /** Fetch active leave types from API – admin portal uses tenant leave types; employees use eligible types. */
  const fetchLeaveTypes = async () => {
    try {
      const res = isAdminSelfService
        ? await adminAPI.getActiveLeaveTypes()
        : await employeeAPI.getActiveLeaveTypes();
      const raw = res?.data;
      const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
      setActiveLeaveTypes(list);
      return list;
    } catch (err) {
      console.warn('Could not load active leave types:', err);
      setActiveLeaveTypes([]);
      return [];
    }
  };

  const fetchLeaveData = async () => {
    setLoading(true);
    try {
      // Attach get leave types API – load active leave types for dropdown and "Other Leave Types"
      const fetchedLeaveTypes = await fetchLeaveTypes();

      // Fetch leave balances (backend now returns List<LeaveBalanceDto>)
      let rawBalances = [];
      try {
        const balRes = isAdminSelfService ? await getLeaveBalancesAsAdmin() : await getLeaveBalances();
        rawBalances = Array.isArray(balRes) ? balRes : (Array.isArray(balRes?.data) ? balRes.data : []);
      } catch (bErr) {
        console.warn('Could not load leave balances:', bErr);
      }

      // Fetch holidays
      try {
        const holidayRes = await holidayCalendarAPI.getActiveHolidays();
        const holidayList = Array.isArray(holidayRes?.data) ? holidayRes.data : (Array.isArray(holidayRes) ? holidayRes : []);
        setHolidays(holidayList);
      } catch (hErr) {
        console.warn('Could not load holidays:', hErr);
      }

      let allRequests = [];
      if (isAdminSelfService) {
        const adminHistory = await getEmployeeLeaveRequestsAsAdmin();
        allRequests = parseLeaveRequestList(adminHistory);
      } else {
        const historyRes = await getEmployeeLeaveRequests();
        allRequests = parseLeaveRequestList(historyRes);
      }
      setLeaveHistory(allRequests);

      // Fetch manual adjustments for audit log
      try {
        const principalId = user?.employeeId || user?.id;
        if (principalId) {
          const adjRes = await leaveBalanceAPI.getAdjustments(principalId);
          setAdjustmentHistory(adjRes?.data || []);
        }
      } catch (adjErr) {
        console.warn('Could not load adjustment log:', adjErr);
        // If it's 403, and we used employeeId, try id as a fallback
        if (adjErr.response?.status === 403 && user?.id && user?.employeeId !== user?.id) {
          try {
            const fallbackRes = await leaveBalanceAPI.getAdjustments(user.id);
            setAdjustmentHistory(fallbackRes?.data || []);
          } catch (e2) {
            console.warn('Fallback adjustment log failed too:', e2);
          }
        }
      }

      const currentPendingRequests = hasAdminAccess() && !isAdminSelfService
        ? await (async () => {
        try {
          const res = await getPendingLeaveRequests();
          return res?.leaveRequests || [];
        } catch {
          return allRequests.filter(r => (r.status || '').toUpperCase() === 'PENDING');
        }
      })()
        : allRequests.filter(r => (r.status || '').toUpperCase() === 'PENDING');
      setPendingRequests(currentPendingRequests);

      // Build dynamic balance map using structured rawBalances from backend
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
        const typesToUse = (fetchedLeaveTypes || []).filter(lt => (lt.leaveTypeCode || '').toUpperCase() !== 'WFH');
        for (const lt of typesToUse) {
          const code = lt.leaveTypeCode || lt.leaveTypeName;
          const annual = lt.defaultLeaveCount ?? lt.maxDays ?? 0;
          const name = lt.leaveTypeName ? `${lt.leaveTypeName} (${code})` : code;
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
    } catch (error) {
      console.error('Error fetching leave data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeesForAdjustment = async () => {
    try {
      let res;
      if (hasAdminAccess()) {
        res = await adminAPI.getAllEmployees();
      } else {
        res = await teamAPI.getTeamOverview(user?.employeeId || user?.id);
      }
      setEmployees(res.data || []);
    } catch (err) {
      console.warn('Failed to fetch employees for adjustment dropdown', err);
    }
  };

  const handleAdjustmentSubmit = async (e) => {
    e.preventDefault();
    if (!adjustmentForm.employeeId || !adjustmentForm.leaveType || !adjustmentForm.days) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await leaveBalanceAPI.adjustBalance({
        ...adjustmentForm,
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
      fetchLeaveData();
    } catch (error) {
      console.error('Error adjusting leave balance:', error);
      toast.error(error.response?.data?.message || 'Failed to adjust leave balance');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate percentage for circular chart
  const calculatePercentage = (available, annual) => {
    if (!annual || annual <= 0) return 0;
    return Math.min(100, (available / annual) * 100);
  };

  // Handle leave request
  const handleRequestLeave = () => {
    setEditingLeaveId(null);
    setLeaveForm({ leaveType: '', startDate: '', endDate: '', reason: '', halfDayType: null, supportingDocumentPath: '' });
    setShowLeaveModal(true);
  };

  // Helper function to map leave type code to enum value
  const mapLeaveTypeCodeToEnum = (leaveTypeCode) => {
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

    // If it's already an enum value, return as is
    if (Object.values(codeToEnumMap).includes(leaveTypeCode)) {
      return leaveTypeCode;
    }

    // Try to map from code
    if (codeToEnumMap[leaveTypeCode]) {
      return codeToEnumMap[leaveTypeCode];
    }

    // Try to map from name (case-insensitive)
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

    const lowerName = leaveTypeCode.toLowerCase();
    if (nameToEnumMap[lowerName]) {
      return nameToEnumMap[lowerName];
    }

    // Fallback: try to find in activeLeaveTypes and use its code
    const activeType = activeLeaveTypes.find(lt =>
      lt.leaveTypeName === leaveTypeCode ||
      lt.leaveTypeCode === leaveTypeCode ||
      String(lt.id) === leaveTypeCode
    );

    if (activeType && activeType.leaveTypeCode) {
      return codeToEnumMap[activeType.leaveTypeCode] || activeType.leaveTypeCode;
    }

    // Last resort: return the original value (backend might handle it)
    return leaveTypeCode;
  };

  // Submit leave request
  const submitLeaveRequest = async (e) => {
    e.preventDefault();

    if (!leaveForm.leaveType) {
      toast.error('Please select a leave type');
      return;
    }

    // Check balance
    const requestedDays = calculateRequestedDuration(leaveForm.startDate, leaveForm.endDate, leaveForm.halfDayType);
    const selectedType = leaveTypesForLeave.find(lt => (lt.leaveTypeCode ?? lt.leaveTypeName ?? lt.id) === leaveForm.leaveType);
    const leaveTypeCode = selectedType?.leaveTypeCode || leaveForm.leaveType;
    

    // Check if we have a balance for this type
    const available = getAvailableBalance(leaveTypeCode);
    if (requestedDays > available) {
      toast.error(`Insufficient balance. You are requesting ${requestedDays} days, but only ${available} days are available.`);
      return;
    }

    if (selectedType?.maxContinuousDays && requestedDays > selectedType.maxContinuousDays) {
      toast.error(`This leave type allows a maximum of ${selectedType.maxContinuousDays} consecutive working days.`);
      return;
    }

    if (selectedType?.requiresDocument && !leaveForm.supportingDocumentPath?.trim()) {
      toast.error('Supporting document reference is required for this leave type.');
      return;
    }

    try {
      // Map the leave type to enum value
      const leaveTypeEnum = mapLeaveTypeCodeToEnum(leaveForm.leaveType);

      // Prepare request data with enum value
      // For half-day leave, endDate should be same as startDate
      const isHalfDay = leaveForm.halfDayType && leaveForm.halfDayType !== 'FULL_DAY';
      const requestData = {
        leaveType: leaveTypeEnum,
        startDate: leaveForm.startDate,
        endDate: isHalfDay ? leaveForm.startDate : (leaveForm.endDate || leaveForm.startDate),
        reason: leaveForm.reason,
        halfDayType: isHalfDay ? leaveForm.halfDayType : null,
        supportingDocumentPath: leaveForm.supportingDocumentPath?.trim() || null,
      };

      setSubmitting(true);
      if (editingLeaveId) {
        await updateLeaveRequest(editingLeaveId, requestData);
        toast.success('Leave request updated successfully!');
      } else if (isAdminSelfService) {
        await createLeaveRequestAsAdmin(requestData);
        toast.success('Leave request submitted successfully!');
      } else {
        await createLeaveRequest(requestData);
        toast.success('Leave request submitted successfully!');
      }
      setShowLeaveModal(false);
      setEditingLeaveId(null);
      setPreviewUrl('');
      setLeaveForm({ leaveType: '', startDate: '', endDate: '', reason: '', halfDayType: null, supportingDocumentPath: '' });
      fetchLeaveData();
    } catch (error) {
      console.error('Error submitting leave request:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to submit leave request';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to calculate duration excluding weekends and holidays
  const calculateRequestedDuration = (start, end, halfDayType) => {
    if (!start) return 0;
    if (halfDayType && halfDayType !== 'FULL_DAY') return 0.5;
    if (!end) return 1;

    let count = 0;
    let cur = new Date(start);
    const last = new Date(end);

    while (cur <= last) {
      const day = cur.getDay();
      const isWeekend = day === 0 || day === 6; // Sunday or Saturday
      const dateStr = cur.toISOString().split('T')[0];
      const isHoliday = holidays.some(h => {
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
    if (leaveBalancesByCode[code]) return leaveBalancesByCode[code].available;
    return 0;
  };

  const heroStats = useMemo(() => {
    const totalAvailable = Object.values(leaveBalancesByCode).reduce((s, b) => s + (b.available || 0), 0);
    const totalConsumed = Object.values(leaveBalancesByCode).reduce((s, b) => s + (b.consumed || 0), 0);
    const approvedThisYear = leaveHistory.filter((l) => {
      const status = (l.status || '').toUpperCase();
      if (status !== 'APPROVED') return false;
      const y = l.startDate ? new Date(l.startDate).getFullYear() : null;
      return y === selectedYear;
    }).length;
    return { totalAvailable, totalConsumed, pendingCount: pendingRequests.length, approvedThisYear };
  }, [leaveBalancesByCode, leaveHistory, pendingRequests, selectedYear]);

  const filteredHistory = useMemo(() => {
    return leaveHistory.filter((leave) => {
      const startDate = leave.startDate ? new Date(leave.startDate) : null;
      if (startDate && startDate.getFullYear() !== selectedYear) return false;
      if (historyLeaveTypeFilter === 'ALL') return true;
      const filter = historyLeaveTypeFilter.toUpperCase();
      const lType = String(leave.leaveType || leave.leaveTypeName || '').toUpperCase();
      const lCode = String(leave.leaveTypeCode || '').toUpperCase();
      return lType.includes(filter) || filter.includes(lType) || lCode === filter;
    });
  }, [leaveHistory, selectedYear, historyLeaveTypeFilter]);

  const renderLeaveBalanceCard = (title, data, color) => {
    const percentage = calculatePercentage(data.available, data.annual);
    const circumference = 2 * Math.PI * 36;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    const usedPct = data.annual > 0 ? Math.min(100, Math.round((data.consumed / data.annual) * 100)) : 0;

    return (
      <article className="lv-balance-card" key={data.code || title}>
        <div className="lv-balance-header">
          <h3>{title}</h3>
          <button
            type="button"
            className="lv-view-link"
            onClick={() => {
              setHistoryLeaveTypeFilter(data.code || title);
              document.getElementById('leave-history-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            View history
          </button>
        </div>

        <div className="lv-ring-wrap">
          <div className="lv-ring" aria-hidden="true">
            <svg viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" fill="none" stroke="#e2e8f0" strokeWidth="8" />
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="none"
                stroke={color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>
            <div className="lv-ring-center">
              <span className="lv-ring-days">{data.available}</span>
              <span className="lv-ring-label">available</span>
            </div>
          </div>
          <div className="lv-progress-block">
            <div className="lv-progress-meta">
              <span>Used</span>
              <strong>{usedPct}%</strong>
            </div>
            <div className="lv-progress-track">
              <div className="lv-progress-fill" style={{ width: `${usedPct}%`, backgroundColor: color }} />
            </div>
            <div className="lv-progress-meta">
              <span>Annual quota</span>
              <strong>{data.annual} days</strong>
            </div>
          </div>
        </div>

        <div className="lv-balance-stats">
          <div className="lv-stat-mini">
            <span>Available</span>
            <span>{data.available} days</span>
          </div>
          <div className="lv-stat-mini">
            <span>Consumed</span>
            <span>{data.consumed} days</span>
          </div>
        </div>
      </article>
    );
  };

  const formatLeaveType = (request) => {
    if (typeof request.leaveType === 'object') {
      return request.leaveType.name || request.leaveType.leaveTypeName || request.leaveType.code || 'Leave';
    }
    return request.leaveType || 'Leave';
  };

  // Pure Admin should not use Apply Leave — redirect to org leave management
  if (isAdminSelfService && !hasHrOrCeoRole) {
    return <Navigate to="/admin/leaves" replace />;
  }

  return (
    <div className="main-content leaves-page">
      <Header
        title={isAdminSelfService ? 'Apply Leave' : 'Leave'}
        subtitle={
          isAdminSelfService
            ? 'Submit and track your personal leave requests'
            : 'Request time off, track balances, and review your leave history'
        }
      />

      <div className="page-content" style={{ padding: '14px 16px 20px' }}>


        <div className="lv-toolbar">
          <div className="lv-segmented" role="tablist" aria-label="Leave sections">
            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'summary'}
              className={activeSubTab === 'summary' ? 'active' : ''}
              onClick={() => setActiveSubTab('summary')}
            >
              Summary
            </button>
            {isPrivileged && (
              <button
                type="button"
                role="tab"
                aria-selected={activeSubTab === 'adjustments'}
                className={activeSubTab === 'adjustments' ? 'active' : ''}
                onClick={() => setActiveSubTab('adjustments')}
              >
                Adjustments
              </button>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'policy'}
              className={activeSubTab === 'policy' ? 'active' : ''}
              onClick={() => setActiveSubTab('policy')}
            >
              Leave Policy
            </button>
          </div>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="lv-year-select"
            aria-label="Filter by year"
          >
            {[2024, 2025, 2026, 2027].map((year) => (
              <option key={year} value={year}>
                Year {year}
              </option>
            ))}
          </select>
        </div>

        {activeSubTab === 'adjustments' ? (
          <div className="lv-adjust-panel">
            <div className="lv-section-head">
              <div>
                <h2 className="lv-section-title">Leave balance adjustments</h2>
                <p className="lv-section-desc">
                  Update employee balances or import historical leave records. Authorized roles only.
                </p>
              </div>
              <div className="lv-adjust-actions">
                <button type="button" className="lv-btn-primary lv-btn-import" onClick={() => setShowImportModal(true)}>
                  <Upload size={16} aria-hidden="true" />
                  Import history
                </button>
                <button type="button" className="lv-btn-primary lv-btn-adjust" onClick={() => setShowAdjustmentModal(true)}>
                  <Plus size={16} aria-hidden="true" />
                  New adjustment
                </button>
              </div>
            </div>
          </div>
        ) : activeSubTab === 'policy' ? (
          renderLeavePolicyTab()
        ) : (
          <>
            <section className="lv-pending-panel" aria-labelledby="pending-leaves-heading">
              <div className="lv-section-head">
                <div>
                  <h2 id="pending-leaves-heading" className="lv-section-title">Pending requests</h2>
                  <p className="lv-section-desc">
                    {pendingRequests.length > 0
                      ? `${pendingRequests.length} request(s) awaiting approval`
                      : 'You are all caught up'}
                  </p>
                </div>
                {canCreateLeave && (
                  <button type="button" className="lv-btn-outline" onClick={handleRequestLeave}>
                    <Plus size={16} aria-hidden="true" />
                    New request
                  </button>
                )}
              </div>

              {loading ? (
                <div className="lv-pending-grid">
                  {Array(2).fill(0).map((_, i) => (
                    <div key={i} className="lv-pending-card">
                      <div className="nt-skeleton" style={{ width: '100px', height: '12px' }} />
                      <div className="nt-skeleton" style={{ width: '140px', height: '12px' }} />
                      <div className="nt-skeleton" style={{ width: '72px', height: '22px', borderRadius: '999px' }} />
                    </div>
                  ))}
                </div>
              ) : pendingRequests.length === 0 ? (
                <div className="lv-empty-state">
                  <div className="lv-empty-icon">
                    <PartyPopper size={28} aria-hidden="true" />
                  </div>
                  <div>
                    <h3>No pending leave requests</h3>
                    <p>Use Request leave when you need time off.</p>
                  </div>
                </div>
              ) : (
                <div className="lv-pending-grid">
                  {pendingRequests.map((request, idx) => (
                    <div key={request.id || `pending-leave-${idx}`} className="lv-pending-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className="lv-pending-type">{formatLeaveType(request)}</span>
                        <span className="lv-pending-dates">
                          {request.startDate} — {request.endDate}
                        </span>
                        <span className="lv-status pending" style={{ width: 'fit-content' }}>Pending</span>
                      </div>
                      <div className="lv-row-actions" style={{ marginLeft: '12px' }}>
                        {canUpdateLeave && (
                          <button
                            type="button"
                            className="lv-icon-btn"
                            title="Edit leave request"
                            onClick={() => {
                              setEditingLeaveId(request.id);
                              setLeaveForm({
                                leaveType: request.leaveType || request.leaveTypeCode || '',
                                startDate: request.startDate || '',
                                endDate: request.endDate || '',
                                reason: request.reason || '',
                                halfDayType: request.halfDayType || null,
                                supportingDocumentPath: request.supportingDocumentPath || '',
                              });
                              setShowLeaveModal(true);
                            }}
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        {canUpdateLeave && (
                          <button
                            type="button"
                            className="lv-icon-btn lv-icon-btn-danger"
                            title="Cancel leave request"
                            onClick={() => {
                              setCancellingLeave(request);
                              setCancelReason('');
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isPrivileged && hasAdminAccess() && (
                <div className="lv-adjust-actions" style={{ marginTop: '16px' }}>
                  <button type="button" className="lv-btn-outline" onClick={() => setShowImportModal(true)}>
                    <Upload size={16} aria-hidden="true" />
                    Import history
                  </button>
                </div>
              )}
            </section>

            <div className="card" style={{ margin: '20px 0 0 0', padding: '20px' }} id="leave-analytics-section">
              <div className="card-header" style={{ padding: 0, border: 'none', background: 'transparent', marginBottom: '16px' }}>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '16px', fontWeight: 700 }}>
                  <TrendingUp size={18} color="var(--lv-primary)" />
                  Leave insights
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--lv-text-muted)' }}>Patterns from your approved leave history</p>
              </div>

              <div className="lv-analytics-grid">
            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="lv-analytics-card">
                  <div className="lv-analytics-card-header">
                    <div className="nt-skeleton" style={{ width: '100px', height: '14px' }} />
                  </div>
                  <div className="nt-skeleton" style={{ width: '100%', height: '80px', borderRadius: '8px', marginTop: '16px' }} />
                </div>
              ))
            ) : (
              <>
                <div className="lv-analytics-card">
                  <div className="lv-analytics-card-header">
                    <h3>Weekly pattern</h3>
                    <Info size={16} aria-hidden="true" />
                  </div>
                  <div className="lv-weekly-chart">
                    {(() => {
                      // Build array [Mon..Sun] with count of leave days falling on that day
                      const counts = [0, 0, 0, 0, 0, 0, 0]; // Mon=0 … Sun=6
                      const approvedLeaves = leaveHistory.filter(l => (l.status || '').toUpperCase() === 'APPROVED');
                      approvedLeaves.forEach(l => {
                        if (!l.startDate || !l.endDate) return;
                        let cur = new Date(l.startDate);
                        const end = new Date(l.endDate);
                        while (cur <= end) {
                          const jsDay = cur.getDay(); // 0=Sun
                          const idx = jsDay === 0 ? 6 : jsDay - 1; // convert to Mon=0..Sun=6
                          counts[idx]++;
                          cur.setDate(cur.getDate() + 1);
                        }
                      });
                      const maxCount = Math.max(...counts, 1);
                      const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                      return dayLabels.map((day, idx) => (
                        <div key={day} className="lv-day-bar">
                          <div
                            className={`lv-bar ${idx < 5 ? 'weekday' : 'weekend'}`}
                            style={{ height: `${Math.max(8, (counts[idx] / maxCount) * 70)}px` }}
                            title={`${counts[idx]} leave day(s)`}
                          />
                          <span className="lv-day-label">{day}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                <div className="lv-analytics-card">
                  <div className="lv-analytics-card-header">
                    <h3>Consumed by type</h3>
                    <Info size={16} aria-hidden="true" />
                  </div>
                  {(() => {
                    const codes = Object.keys(leaveBalancesByCode);
                    const consumed = codes.filter((c) => leaveBalancesByCode[c].consumed > 0);
                    if (consumed.length === 0) {
                      return <div className="lv-no-data"><p>No leaves consumed yet.</p></div>;
                    }
                    return (
                      <div>
                        {consumed.map((code, i) => {
                          const b = leaveBalancesByCode[code];
                          const pct = b.annual > 0 ? Math.round((b.consumed / b.annual) * 100) : 0;
                          return (
                            <div key={code} className="lv-consumed-row">
                              <div className="lv-consumed-labels">
                                <span>{b.name}</span>
                                <span>{b.consumed} / {b.annual} days</span>
                              </div>
                              <div className="lv-progress-track">
                                <div
                                  className="lv-progress-fill"
                                  style={{
                                    width: `${Math.min(pct, 100)}%`,
                                    backgroundColor: CONSUMED_COLORS[i % CONSUMED_COLORS.length],
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                <div className="lv-analytics-card">
                  <div className="lv-analytics-card-header">
                    <h3>Monthly usage</h3>
                    <Info size={16} aria-hidden="true" />
                  </div>
                  <div className="lv-monthly-chart">
                    {(() => {
                      const currentYear = new Date().getFullYear();
                      const monthlyCounts = new Array(12).fill(0);
                      const approvedLeaves = leaveHistory.filter(l => (l.status || '').toUpperCase() === 'APPROVED');
                      approvedLeaves.forEach(l => {
                        if (!l.startDate) return;
                        const startMonth = new Date(l.startDate).getMonth();
                        const startYear = new Date(l.startDate).getFullYear();
                        if (startYear === currentYear) {
                          monthlyCounts[startMonth] += (l.totalDays || l.days || 1);
                        }
                      });
                      const maxMonth = Math.max(...monthlyCounts, 1);
                      const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      return monthLabels.map((month, idx) => (
                        <div key={month} className="lv-month-col">
                          <div
                            className="lv-month-bar"
                            style={{
                              height: `${Math.max(4, (monthlyCounts[idx] / maxMonth) * 60)}px`,
                              backgroundColor: monthlyCounts[idx] > 0 ? '#0891b2' : '#e2e8f0',
                            }}
                            title={`${monthlyCounts[idx]} days`}
                          />
                          <span className="lv-month-label">{month}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

            <div className="card" style={{ margin: '20px 0 0 0', padding: '20px' }}>
              <div className="card-header" style={{ padding: 0, border: 'none', background: 'transparent', marginBottom: '16px' }}>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '16px', fontWeight: 700 }}>
                  <Palmtree size={18} color="var(--lv-primary)" />
                  Leave balances
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--lv-text-muted)' }}>Available days by leave type for the selected period</p>
              </div>
              <div className="lv-balances-grid">
                {loading ? (
                  Array(4).fill(0).map((_, i) => (
                    <div key={i} className="lv-balance-card">
                      <div className="nt-skeleton" style={{ width: '120px', height: '14px', marginBottom: '16px' }} />
                      <div className="nt-skeleton" style={{ width: '100%', height: '88px', borderRadius: '8px' }} />
                    </div>
                  ))
                ) : (() => {
                  const codes = Object.keys(leaveBalancesByCode);
                  if (codes.length === 0) {
                    return (
                      <p className="lv-section-desc" style={{ gridColumn: '1 / -1' }}>
                        No leave types configured. Contact your administrator.
                      </p>
                    );
                  }
                  return codes.map((code, i) => {
                    const b = leaveBalancesByCode[code];
                    return renderLeaveBalanceCard(b.name, b, BALANCE_COLORS[i % BALANCE_COLORS.length]);
                  });
                })()}
              </div>
            </div>
          </>
        )}

        <div className="card" style={{ margin: '20px 0 0 0', padding: '20px' }} id="leave-history-section">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: 0, border: 'none', background: 'transparent', marginBottom: '16px' }}>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '16px', fontWeight: 700 }}>
              <ClipboardList size={18} color="var(--lv-primary)" />
              Leave history
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--lv-text-muted)', fontWeight: 600 }}>
                {filteredHistory.length} record(s) in {selectedYear}
              </span>
              {historyLeaveTypeFilter !== 'ALL' && (
                <div className="lv-filter-chip" style={{ margin: 0 }}>
                  <Filter size={14} aria-hidden="true" />
                  {historyLeaveTypeFilter}
                  <button type="button" onClick={() => setHistoryLeaveTypeFilter('ALL')}>
                    <X size={14} aria-hidden="true" />
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="lv-table-wrap">
              <table className="lv-table">
                <thead>
                  <tr>
                    <th style={{ width: '8%' }}>Leave Type</th>
                    <th style={{ width: '10%' }}>From</th>
                    <th style={{ width: '10%' }}>To</th>
                    <th style={{ width: '6%' }}>Days</th>
                    <th style={{ width: '10%' }}>Status</th>
                    <th style={{ width: '24%' }}>Reason</th>
                    <th style={{ width: '17%' }}>Manager Response</th>
                    <th style={{ width: '15%' }}>Approved By</th>
                    <th style={{ width: '10%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array(5).fill(0).map((_, i) => (
                    <tr key={i}>
                      {Array(9).fill(0).map((_, j) => (
                        <td key={j}><div className="nt-skeleton" style={{ width: '80%', height: '10px' }} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="lv-empty-history">
              <Calendar size={48} aria-hidden="true" />
              <p>No leave history for {selectedYear}{historyLeaveTypeFilter !== 'ALL' ? ` matching “${historyLeaveTypeFilter}”` : ''}.</p>
            </div>
          ) : (
            <div className="lv-table-wrap">
              <table className="lv-table">
                <thead>
                  <tr>
                    <th style={{ width: '8%' }}>Leave Type</th>
                    <th style={{ width: '10%' }}>From</th>
                    <th style={{ width: '10%' }}>To</th>
                    <th style={{ width: '6%' }}>Days</th>
                    <th style={{ width: '10%' }}>Status</th>
                    <th style={{ width: '24%' }}>Reason</th>
                    <th style={{ width: '17%' }}>Manager Response</th>
                    <th style={{ width: '15%' }}>Approved By</th>
                    <th style={{ width: '10%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((leave, idx) => (
                    <tr key={leave.id || idx}>
                      <td>{leave.leaveType || leave.leaveTypeName || 'N/A'}</td>
                      <td>{leave.startDate ? (typeof leave.startDate === 'string' ? leave.startDate : new Date(leave.startDate).toLocaleDateString()) : 'N/A'}</td>
                      <td>{leave.endDate ? (typeof leave.endDate === 'string' ? leave.endDate : new Date(leave.endDate).toLocaleDateString()) : 'N/A'}</td>
                      <td>{leave.days || leave.totalDays || 1}</td>
                      <td>
                        <span className={`lv-status ${(leave.status || '').toLowerCase()}`}>
                          {leave.status}
                        </span>
                      </td>
                      <td className="lv-cell-reason">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ 
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'normal',
                            lineHeight: '1.4'
                          }}>
                            {leave.reason || '-'}
                          </span>
                          {leave.supportingDocumentPath && (
                            <a
                              href={leave.supportingDocumentPath}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: '#0891b2',
                                fontSize: '11px',
                                textDecoration: 'underline',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                width: 'fit-content'
                              }}
                            >
                              View Attachment
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="lv-cell-reason">
                        <span style={{ 
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'normal',
                          lineHeight: '1.4'
                        }}>
                          {(() => {
                            const response = leave.adminResponse || leave.managerResponse || '';
                            if (response.startsWith('Cancelled by Employee')) {
                              return '-';
                            }
                            return response || '-';
                          })()}
                        </span>
                      </td>
                      <td>
                        {(() => {
                          // Only show approver for APPROVED or REJECTED requests
                          // Don't show managerName for PENDING requests (managerName is the assigned manager, not approver)
                          const status = leave.status || leave.leaveStatus || '';
                          const normalizedStatus = status ? String(status).trim().toUpperCase() : '';
                          const isApprovedOrRejected = normalizedStatus === 'APPROVED' || normalizedStatus === 'REJECTED';

                          if (!isApprovedOrRejected) {
                            return <span className="lv-cell-muted">-</span>;
                          }

                          // For approved/rejected requests, show admin name (final approver) if available
                          // Otherwise show manager name (initial approver) only if there's a response
                          const hasResponse = leave.adminResponse || leave.managerResponse || leave.approvedByName;
                          const approverName = leave.adminName || leave.managerName || leave.approvedByName;
                          const approvalDate = leave.adminResponseDate || leave.managerResponseDate || leave.createdAt;

                          if (approverName && approvalDate) {
                            return (
                              <div className="lv-approver-block">
                                <div className="lv-approver-name">{approverName}</div>
                                <div className="lv-approver-date">
                                  {new Date(approvalDate).toLocaleDateString()}
                                </div>
                              </div>
                            );
                          }
                          return <span className="lv-cell-muted">-</span>;
                        })()}
                      </td>
                      <td>
                        <div className="lv-row-actions">
                          {(() => {
                            const requestStatus = (leave.status || '').toUpperCase();
                            const todayStr = new Date().toISOString().split('T')[0];
                            const isPastStart = leave.startDate && leave.startDate < todayStr;
                            const response = leave.adminResponse || leave.managerResponse || '';
                            
                            return (
                              <>
                                <button
                                  type="button"
                                  className="lv-icon-btn"
                                  title="View Details"
                                  onClick={() => setViewLeaveModal(leave)}
                                >
                                  <Eye size={16} />
                                </button>
                                {requestStatus === 'PENDING' && (
                                  <button
                                    type="button"
                                    className="lv-icon-btn"
                                    title="Edit leave request"
                                    onClick={() => {
                                      setEditingLeaveId(leave.id);
                                      setPreviewUrl('');
                                      setLeaveForm({
                                        leaveType: leave.leaveType || leave.leaveTypeCode || '',
                                        startDate: leave.startDate || '',
                                        endDate: leave.endDate || '',
                                        reason: leave.reason || '',
                                        halfDayType: leave.halfDayType || null,
                                        supportingDocumentPath: leave.supportingDocumentPath || '',
                                      });
                                      setShowLeaveModal(true);
                                    }}
                                  >
                                    <Edit size={16} />
                                  </button>
                                )}
                                {(!isPastStart || hasSpecialCancelAccess) && (requestStatus === 'PENDING' || requestStatus === 'APPROVED' || requestStatus === 'ACCEPTED') && (
                                  <button
                                    type="button"
                                    className="lv-icon-btn lv-icon-btn-danger"
                                    title="Cancel leave request"
                                    onClick={() => {
                                      setCancellingLeave(leave);
                                      setCancelReason('');
                                    }}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card" style={{ margin: '20px 0 0 0', padding: '20px' }}>
          <div className="card-header" style={{ padding: 0, border: 'none', background: 'transparent', marginBottom: '16px' }}>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '16px', fontWeight: 700 }}>
              <Clock size={18} color="var(--lv-primary)" />
              Adjustment audit
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--lv-text-muted)' }}>Manual balance changes on your account</p>
          </div>

          {adjustmentHistory.length === 0 ? (
            <div className="lv-audit-empty">
              <Clock size={32} aria-hidden="true" />
              <p>No adjustments recorded yet.</p>
            </div>
          ) : (
            <div className="lv-table-wrap">
              <table className="lv-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Leave Type</th>
                    <th>Type</th>
                    <th>Days</th>
                    <th>Reason</th>
                    <th>Adjusted By</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustmentHistory.map((adj, i) => (
                    <tr key={adj.id || i}>
                      <td style={{ fontSize: '13px' }}>
                        {adj.timestamp ? new Date(adj.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                      </td>
                      <td style={{ fontWeight: 600 }}>{adj.leaveType?.replace('_', ' ')}</td>
                      <td>
                        <span className={`lv-adj-type ${adj.adjustmentType === 'ADDITION' ? 'addition' : 'deduction'}`}>
                          {adj.adjustmentType}
                        </span>
                      </td>
                      <td className={`lv-cell-days-adj ${adj.adjustmentType === 'ADDITION' ? 'addition' : 'deduction'}`}>
                        {adj.adjustmentType === 'ADDITION' ? '+' : '-'}{Math.abs(adj.daysChanged)}
                      </td>
                      <td className="lv-cell-reason" style={{ maxWidth: '300px', whiteSpace: 'normal', fontStyle: 'italic' }}>
                        {adj.reason || '-'}
                      </td>
                      <td>
                        <div className="lv-emp-name">{adj.performedByName || adj.performedBy}</div>
                        <div className="lv-emp-id">{adj.performedRole}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showLeaveModal && (
        <div className="lv-modal-overlay" onClick={() => setShowLeaveModal(false)} role="presentation">
          <div className="lv-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="request-leave-title">
            <div className="lv-modal-header">
              <h2 id="request-leave-title">{editingLeaveId ? 'Edit leave request' : 'Request leave'}</h2>
              <button type="button" className="lv-modal-close" onClick={() => setShowLeaveModal(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitLeaveRequest}>
              <div className="lv-modal-body">
                <div className="lv-form-group">
                  <label>Leave Type</label>
                  <select
                    value={leaveForm.leaveType}
                    onChange={(e) => {
                      const selectedType = e.target.value;
                      // Reset halfDayType when leave type changes
                      setLeaveForm({ ...leaveForm, leaveType: selectedType, halfDayType: null });
                    }}
                    required
                    disabled={activeLeaveTypes.length === 0}
                  >
                    <option value="">
                      {activeLeaveTypes.length === 0 ? 'No leave types configured. Contact admin.' : 'Select leave type'}
                    </option>
                    {leaveTypesForLeave.map((lt) => (
                      <option key={lt.id} value={lt.leaveTypeCode ?? lt.leaveTypeName ?? lt.id}>
                        {lt.leaveTypeName ?? lt.leaveTypeCode ?? String(lt.id)}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Half Day Selection - Show for Annual Leave and other applicable types */}
                {(() => {
                  const selectedLeaveType = leaveTypesForLeave.find(lt =>
                    (lt.leaveTypeCode ?? lt.leaveTypeName ?? String(lt.id)) === leaveForm.leaveType
                  );
                  const isAnnualLeave = selectedLeaveType?.leaveTypeCode === 'AL' ||
                    selectedLeaveType?.leaveTypeName?.toLowerCase().includes('annual');
                  const showHalfDay = isAnnualLeave && leaveForm.leaveType;

                  return showHalfDay ? (
                    <div className="lv-form-group">
                      <label htmlFor="leave-duration">Leave duration</label>
                      <select
                        id="leave-duration"
                        value={leaveForm.halfDayType || 'FULL_DAY'}
                        onChange={(e) => {
                          const value = e.target.value;
                          setLeaveForm({
                            ...leaveForm,
                            halfDayType: value === 'FULL_DAY' ? null : value,
                            endDate: value !== 'FULL_DAY' ? leaveForm.startDate : (leaveForm.endDate || leaveForm.startDate)
                          });
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
                  <div className="lv-feedback-box">
                    <div className="lv-feedback-row">
                      <span>Available balance</span>
                      <strong>
                        {(() => {
                          const selectedType = leaveTypesForLeave.find(lt => (lt.leaveTypeCode ?? lt.leaveTypeName ?? lt.id) === leaveForm.leaveType);
                          return getAvailableBalance(selectedType?.leaveTypeCode || leaveForm.leaveType);
                        })()}{' '}
                        days
                      </strong>
                    </div>
                    {leaveForm.startDate && (
                      <div className="lv-feedback-row">
                        <span>Requested duration</span>
                        <strong
                          style={{
                            color:
                              calculateRequestedDuration(leaveForm.startDate, leaveForm.endDate, leaveForm.halfDayType) >
                              getAvailableBalance(
                                leaveTypesForLeave.find((lt) => (lt.leaveTypeCode ?? lt.leaveTypeName ?? lt.id) === leaveForm.leaveType)?.leaveTypeCode || leaveForm.leaveType
                              )
                                ? '#dc2626'
                                : '#15803d',
                          }}
                        >
                          {calculateRequestedDuration(leaveForm.startDate, leaveForm.endDate, leaveForm.halfDayType)} days
                          <span style={{ fontSize: '11px', fontWeight: 400, color: '#64748b', marginLeft: 4 }}>
                            (excl. weekends & holidays)
                          </span>
                        </strong>
                      </div>
                    )}
                  </div>
                )}
                <div className="lv-form-row">
                  <div className="lv-form-group">
                    <label>From Date</label>
                    <DatePicker
                      value={leaveForm.startDate}
                      onChange={(dateObj) => {
                        if (!(dateObj instanceof Date)) return;
                        const newStartDate = dateObj.toLocaleDateString('en-CA');
                        const dateVal = new Date(dateObj);
                        dateVal.setHours(0, 0, 0, 0);
                        const day = dateVal.getDay();
                        const isWeekend = day === 0 || day === 6;
                        const isHoliday = holidays.some(h => {
                           const hDate = new Date(h.date).toLocaleDateString('en-CA');
                           return hDate === newStartDate;
                        });
                        if (isWeekend || isHoliday) {
                          toast.error('Selected date is a holiday or weekend. Please choose a working day.');
                          return;
                        }
                        // If half-day, auto-update endDate to match startDate
                        const newEndDate = leaveForm.halfDayType ? newStartDate : leaveForm.endDate;
                        setLeaveForm({ ...leaveForm, startDate: newStartDate, endDate: newEndDate });
                      }}
                    />
                  </div>
                  <div className="lv-form-group">
                    <label>To date</label>
                    <DatePicker
                      value={leaveForm.endDate}
                      minDate={leaveForm.startDate}
                      onChange={(dateObj) => {
                        if (!(dateObj instanceof Date)) return;
                        const newEndDate = dateObj.toLocaleDateString('en-CA');
                        const dateVal = new Date(dateObj);
                        const day = dateVal.getDay();
                        const isWeekend = day === 0 || day === 6;
                        const isHoliday = holidays.some(h => {
                           const hDate = new Date(h.date).toLocaleDateString('en-CA');
                           return hDate === newEndDate;
                        });
                        if (isWeekend || isHoliday) {
                          toast.error('Selected end date is a holiday or weekend. Multi-day leave must end on a working day.');
                          return;
                        }
                        setLeaveForm({ ...leaveForm, endDate: newEndDate });
                      }}
                      disabled={!!leaveForm.halfDayType}
                    />
                  </div>
                </div>
                {(() => {
                  const selectedLeaveType = leaveTypesForLeave.find(lt =>
                    (lt.leaveTypeCode ?? lt.leaveTypeName ?? String(lt.id)) === leaveForm.leaveType
                  );
                  if (!selectedLeaveType?.requiresDocument) return null;
                  return (
                    <div className="lv-form-group">
                      <label htmlFor="leave-document">Supporting document *</label>
                      <input
                        id="leave-document"
                        type="file"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          try {
                            setUploading(true);
                            const response = await documentAPI.uploadDocument('OTHER', file);
                            const s3Key = response.data.filePath || response.data.s3Key;
                            const s3Url = response.data.fileUrl;
                            setLeaveForm(prev => ({ ...prev, supportingDocumentPath: s3Key }));
                            setPreviewUrl(s3Url || '');
                            toast.success('Document uploaded successfully!');
                          } catch (err) {
                            console.error('Failed to upload document:', err);
                            toast.error(err.response?.data?.message || 'Failed to upload document');
                          } finally {
                            setUploading(false);
                          }
                        }}
                        required={!leaveForm.supportingDocumentPath}
                      />
                      {leaveForm.supportingDocumentPath && (
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#10b981' }}>✓ Document uploaded</span>
                          {(() => {
                            const fileHref = previewUrl || (leaveForm.supportingDocumentPath.startsWith('http') ? leaveForm.supportingDocumentPath : null);
                            return fileHref ? (
                              <a 
                                href={fileHref} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ fontSize: '12px', color: '#0891b2', textDecoration: 'underline' }}
                              >
                                View File
                              </a>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div className="lv-form-group">
                  <label htmlFor="leave-reason">Reason</label>
                  <textarea
                    id="leave-reason"
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    placeholder="Brief reason for your leave request"
                    rows={3}
                    required
                  />
                </div>
              </div>
              <div className="lv-modal-footer">
                <button type="button" className="lv-btn-cancel" onClick={() => setShowLeaveModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="lv-btn-primary" disabled={submitting || uploading}>
                  {submitting ? 'Submitting…' : uploading ? 'Uploading…' : editingLeaveId ? 'Update request' : 'Submit request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAdjustmentModal && (
        <div className="lv-modal-overlay" onClick={() => setShowAdjustmentModal(false)} role="presentation">
          <div className="lv-modal lv-modal-wide white-scrollbar" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="adjust-leave-title">
            <div className="lv-modal-header">
              <h2 id="adjust-leave-title">Adjust leave balance</h2>
              <button type="button" className="lv-modal-close" onClick={() => setShowAdjustmentModal(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAdjustmentSubmit}>
              <div className="lv-modal-body">
                <div className="lv-form-group">
                  <label htmlFor="adj-employee">Employee</label>
                  <select
                    id="adj-employee"
                    value={adjustmentForm.employeeId}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, employeeId: e.target.value })}
                    required
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp.employeeId || emp.id} value={emp.employeeId || emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.employeeId || emp.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lv-form-group">
                  <label htmlFor="adj-leave-type">Leave type</label>
                  <select
                    id="adj-leave-type"
                    value={adjustmentForm.leaveType}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, leaveType: e.target.value })}
                    required
                  >
                    <option value="">Select Leave Type</option>
                    {activeLeaveTypes
                      .filter(lt => (lt.leaveTypeCode || '').toUpperCase() !== 'WFH')
                      .map(type => (
                        <option key={type.id || type.leaveTypeCode} value={type.leaveTypeCode || type.leaveTypeName}>
                          {type.leaveTypeName}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="lv-form-group">
                  <label htmlFor="adj-type">Adjustment type</label>
                  <select
                    id="adj-type"
                    value={adjustmentForm.adjustmentType}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, adjustmentType: e.target.value })}
                    required
                  >
                    <option value="ADDITION">Addition (+)</option>
                    <option value="DEDUCTION">Deduction (-)</option>
                  </select>
                </div>

                <div className="lv-form-group">
                  <label htmlFor="adj-days">Days</label>
                  <input
                    id="adj-days"
                    type="number"
                    step="0.5"
                    min="0"
                    value={adjustmentForm.days}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, days: e.target.value })}
                    required
                  />
                </div>

                <div className="lv-form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label htmlFor="adj-reason">Reason</label>
                    <span style={{ fontSize: '11px', color: adjustmentForm.reason?.length >= 3000 ? '#dc2626' : '#64748b' }}>
                      {adjustmentForm.reason?.length || 0}/3000
                    </span>
                  </div>
                  <textarea
                    id="adj-reason"
                    value={adjustmentForm.reason}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                    required
                    maxLength={3000}
                    placeholder="Reason for this adjustment"
                    rows={3}
                  />
                </div>
              </div>
              <div className="lv-modal-footer">
                <button type="button" className="lv-btn-cancel" onClick={() => setShowAdjustmentModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="lv-btn-primary lv-btn-adjust" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <LeaveHistoryImportModal 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)} 
        onImportSuccess={() => {
          fetchLeaveData();
          setShowImportModal(false);
        }}
      />

      {cancellingLeave && (
        <div
          className="lv-modal-overlay"
          style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setCancellingLeave(null)}
        >
          <div
            className="lv-modal"
            style={{ maxWidth: '400px', width: '90%', padding: '24px', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: '#1e293b' }}>
              Confirm Leave Cancellation
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
              Are you sure you want to cancel this leave request? This action cannot be undone.
            </p>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Cancellation Reason (Mandatory)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Please enter a reason for cancellation..."
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
                className="lv-btn-cancel" 
                onClick={() => setCancellingLeave(null)}
                disabled={isCancelling}
              >
                Go Back
              </button>
              <button 
                type="button"
                className="lv-btn-primary"
                style={{ background: '#ef4444', borderColor: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={async () => {
                  if (!cancelReason.trim()) {
                    toast.error('Cancellation reason is required');
                    return;
                  }
                  try {
                    setIsCancelling(true);
                    await cancelEmployeeLeaveRequest(cancellingLeave.id, cancelReason.trim());
                    toast.success('Leave request cancelled successfully!');
                    setCancellingLeave(null);
                    fetchLeaveData();
                  } catch (error) {
                    const errorMessage = error.response?.data?.message || error.message || 'Failed to cancel leave request';
                    toast.error(errorMessage);
                  } finally {
                    setIsCancelling(false);
                  }
                }}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <>
                    <Loader2 size={16} className="lv-spin" />
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

      {viewLeaveModal && (
        <div className="lv-drawer-overlay" onClick={() => setViewLeaveModal(null)} role="presentation">
          <div className="lv-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="view-leave-title">
            <div className="lv-drawer-header">
              <h2 id="view-leave-title" style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#1e293b' }}>Leave Request Details</h2>
              <button 
                type="button" 
                onClick={() => setViewLeaveModal(null)} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-500)', padding: 0 }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="lv-drawer-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--lv-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Leave Type</label>
                  <p style={{ fontWeight: 600, fontSize: '14px', margin: 0, color: '#1e293b' }}>{viewLeaveModal.leaveType || viewLeaveModal.leaveTypeName || 'N/A'}</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--lv-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Duration</label>
                  <p style={{ fontWeight: 600, fontSize: '14px', margin: 0, color: '#1e293b' }}>{viewLeaveModal.days || viewLeaveModal.totalDays || 1} Day(s)</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--lv-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Start Date</label>
                  <p style={{ fontWeight: 500, fontSize: '14px', margin: 0, color: '#1e293b' }}>{viewLeaveModal.startDate ? new Date(viewLeaveModal.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--lv-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>End Date</label>
                  <p style={{ fontWeight: 500, fontSize: '14px', margin: 0, color: '#1e293b' }}>{viewLeaveModal.endDate ? new Date(viewLeaveModal.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--lv-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Status</label>
                  <div style={{ marginTop: '2px' }}>
                    <span className={`lv-status ${(viewLeaveModal.status || '').toLowerCase()}`}>
                      {viewLeaveModal.status}
                    </span>
                  </div>
                </div>
                {viewLeaveModal.supportingDocumentPath && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--lv-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Document</label>
                    <a
                      href={viewLeaveModal.supportingDocumentPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#0891b2',
                        fontSize: '13px',
                        textDecoration: 'underline',
                        fontWeight: 500,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginTop: '2px'
                      }}
                    >
                      View Attachment
                    </a>
                  </div>
                )}
              </div>
              <div style={{ marginBottom: '16px', borderTop: '1px solid var(--lv-border)', paddingTop: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--lv-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Reason</label>
                <div style={{ 
                  background: 'var(--gray-5)', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  fontSize: '13px',
                  color: '#334155',
                  border: '1px solid var(--lv-border)',
                  lineHeight: 1.5,
                  maxHeight: '120px',
                  overflowY: 'auto'
                }}>
                  {viewLeaveModal.reason || 'No reason provided'}
                </div>
              </div>
              {(viewLeaveModal.adminResponse || viewLeaveModal.managerResponse) && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--lv-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Response Comment</label>
                  <p style={{ fontStyle: 'italic', fontSize: '13px', color: '#475569', margin: 0 }}>{viewLeaveModal.adminResponse || viewLeaveModal.managerResponse}</p>
                </div>
              )}
              {(() => {
                const status = viewLeaveModal.status || '';
                const normalizedStatus = status ? String(status).trim().toUpperCase() : '';
                const isApprovedOrRejected = normalizedStatus === 'APPROVED' || normalizedStatus === 'REJECTED';
                const approverName = viewLeaveModal.adminName || viewLeaveModal.managerName || viewLeaveModal.approvedByName;
                if (isApprovedOrRejected && approverName) {
                  return (
                    <div style={{ borderTop: '1px solid var(--lv-border)', paddingTop: '12px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--lv-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Action By</label>
                      <p style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b', margin: 0 }}>{approverName}</p>
                    </div>
                  );
                }
                return null;
              })()}
              {renderTimeline(viewLeaveModal)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
