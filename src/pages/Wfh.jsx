import { useState, useEffect } from 'react';
import { Calendar, Plus, Home, Loader2, CheckCircle, XCircle, Clock, Edit2, Trash2, Info, AlertTriangle, Eye, X, ShieldAlert, PartyPopper, TrendingUp, ClipboardList } from 'lucide-react';
import { wfhAPI, holidayCalendarAPI } from '../services/api';
import Header from '../components/Header';
import DatePicker from '../components/DatePicker';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import './Leaves.css';
import './Wfh.css';

export default function Wfh() {
  const { user, hasCrudPermission } = useAuth();
  const canCreate = hasCrudPermission ? hasCrudPermission('WORKFORCE_WFH_SELF', 'create') : true;
  const canRead = hasCrudPermission ? hasCrudPermission('WORKFORCE_WFH_SELF', 'read') : true;
  const canUpdate = hasCrudPermission ? hasCrudPermission('WORKFORCE_WFH_SELF', 'update') : true;
  const canDelete = hasCrudPermission ? hasCrudPermission('WORKFORCE_WFH_SELF', 'update') : true;

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null); // WFH request being edited
  const [form, setForm] = useState({ startDate: '', endDate: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(null); // ID of request being cancelled
  const [holidays, setHolidays] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeSubTab, setActiveSubTab] = useState('summary');
  const [viewModal, setViewModal] = useState(null);

  const today = new Date().toLocaleDateString('en-CA');

  const getNextDateStr = (baseDateStr, days) => {
    if (!baseDateStr) return '';
    const parts = baseDateStr.split('-').map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString('en-CA');
  };

  const maxEndDateStr = form.startDate ? getNextDateStr(form.startDate, 7) : '';

  const isHolidayDate = (dateStr) =>
    holidays.some((h) => {
      const hDate = h.date?.includes?.('T') ? h.date.split('T')[0] : String(h.date).slice(0, 10);
      return hDate === dateStr;
    });

  const validateWfhDate = (dateStr) => {
    if (!dateStr) return false;
    const parts = dateStr.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const day = d.getDay();
    if (!policy?.allowWeekends && (day === 0 || day === 6)) {
      toast.error('WFH requests are not allowed on weekends.');
      return false;
    }
    if (!policy?.allowHolidays && isHolidayDate(dateStr)) {
      toast.error('WFH requests are not allowed on holidays.');
      return false;
    }
    return true;
  };

  const dateFromPicker = (dateObj) => {
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return '';
    return dateObj.toLocaleDateString('en-CA');
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      const startOfFilterYear = `${selectedYear}-01-01`;
      const endOfFilterYear = `${selectedYear}-12-31`;
      const res = await wfhAPI.getMyRequests(startOfFilterYear, endOfFilterYear);
      const data = Array.isArray(res?.data) ? res.data : (res?.data?.data ?? []);
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching WFH requests:', err);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchHolidays = async () => {
    try {
      const res = await holidayCalendarAPI.getActiveHolidays();
      setHolidays(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching holidays:', err);
    }
  };

  const fetchPolicy = async () => {
    try {
      const res = await wfhAPI.getPolicy();
      setPolicy(res?.data || null);
    } catch (err) {
      console.error('Error fetching WFH policy:', err);
    }
  };

  const fetchAvailability = async () => {
    try {
      const res = await wfhAPI.getAvailability();
      setAvailability(res?.data || null);
    } catch (err) {
      console.error('Error fetching WFH availability:', err);
    }
  };

  useEffect(() => {
    if (canRead) {
      fetchList();
    } else {
      setLoading(false);
    }
  }, [selectedYear, canRead]);

  useEffect(() => {
    if (canRead) {
      fetchHolidays();
      fetchPolicy();
      fetchAvailability();
    }
  }, [canRead]);

  const openCreateModal = () => {
    setEditingRequest(null);
    setForm({ startDate: '', endDate: '', reason: '' });
    setShowModal(true);
  };

  const openEditModal = (row) => {
    setEditingRequest(row);
    setForm({
      startDate: row.startDate || '',
      endDate: row.endDate || '',
      reason: row.reason || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if limits are reached (only for new requests)
    if (!editingRequest && availability && policy) {
      if (policy.maxDaysPerWeek > 0 && availability.remainingThisWeek <= 0) {
        toast.error('You have already reached the weekly WFH limit.');
        return;
      }
      if (policy.maxDaysPerMonth > 0 && availability.remainingThisMonth <= 0) {
        toast.error('You have reached the monthly WFH limit.');
        return;
      }
    }

    // Mandatory reason validation
    if (!form.reason?.trim()) {
      toast.error('Please provide a reason for WFH.');
      return;
    }

    if (!form.startDate || !form.endDate) {
      toast.error('Please fill start date and end date.');
      return;
    }

    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Start date <= End date validation
    if (end < start) {
      toast.error('End date cannot be before start date.');
      return;
    }

    // Past date validation (unless policy allows)
    if (!policy?.allowPastDates && start < now) {
      toast.error('WFH requests cannot be created for past dates.');
      return;
    }

    // Weekend validation (unless policy allows)
    if (!policy?.allowWeekends) {
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        if (day === 0 || day === 6) {
          toast.error('WFH requests are not allowed on weekends or holidays.');
          return;
        }
      }
    }

    // Holiday validation (unless policy allows)
    if (!policy?.allowHolidays) {
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const isHoliday = holidays.some(h => new Date(h.date).toISOString().split('T')[0] === dateStr);
        if (isHoliday) {
          toast.error('WFH requests are not allowed on weekends or holidays.');
          return;
        }
      }
    }

    // Limit validation (only for new requests, not edits)
    if (!editingRequest && availability && policy) {
      // Calculate working days in request
      let requestWorkingDays = 0;
      let tempDate = new Date(start);
      while (tempDate <= end) {
        const day = tempDate.getDay();
        const dateStr = tempDate.toISOString().split('T')[0];
        const isWeekend = day === 0 || day === 6;
        const isHoliday = holidays.some(h => new Date(h.date).toISOString().split('T')[0] === dateStr);
        if (!isWeekend && !isHoliday) {
          requestWorkingDays++;
        }
        tempDate.setDate(tempDate.getDate() + 1);
      }

      // Check if this request itself exceeds any limit
      if (policy.maxDaysPerWeek > 0 && requestWorkingDays > policy.maxDaysPerWeek) {
        toast.error('You have already reached the weekly WFH limit.');
        return;
      }
      if (policy.maxDaysPerMonth > 0 && requestWorkingDays > policy.maxDaysPerMonth) {
        toast.error('You have reached the monthly WFH limit.');
        return;
      }

      // Monthly limit check
      if (policy.maxDaysPerMonth > 0 && availability.remainingThisMonth < requestWorkingDays) {
        toast.error('You have reached the monthly WFH limit.');
        return;
      }

      // Weekly limit check (check each week the request spans)
      const startOfWeek = new Date(start);
      const dayOfWeek = startOfWeek.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Get Monday of this week
      startOfWeek.setDate(startOfWeek.getDate() - daysToMonday);
      
      if (policy.maxDaysPerWeek > 0) {
        let currentWeekStart = new Date(startOfWeek);
        while (currentWeekStart <= end) {
          const currentWeekEnd = new Date(currentWeekStart);
          currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
          
          // Count working days in this week that overlap with request
          let weeklyRequestDays = 0;
          const overlapStart = start > currentWeekStart ? start : currentWeekStart;
          const overlapEnd = end < currentWeekEnd ? end : currentWeekEnd;
          
          let tempOverlap = new Date(overlapStart);
          while (tempOverlap <= overlapEnd) {
            const day = tempOverlap.getDay();
            const dateStr = tempOverlap.toISOString().split('T')[0];
            const isWeekend = day === 0 || day === 6;
            const isHoliday = holidays.some(h => new Date(h.date).toISOString().split('T')[0] === dateStr);
            if (!isWeekend && !isHoliday) {
              weeklyRequestDays++;
            }
            tempOverlap.setDate(tempOverlap.getDate() + 1);
          }
          
          if (weeklyRequestDays > 0 && availability.remainingThisWeek < weeklyRequestDays) {
            toast.error('You have already reached the weekly WFH limit.');
            return;
          }
          currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        }
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim(),
      };

      if (editingRequest) {
        await wfhAPI.update(editingRequest.id, payload);
        toast.success('WFH request updated successfully');
      } else {
        await wfhAPI.create(payload);
        toast.success('WFH request submitted successfully');
      }
      setShowModal(false);
      setEditingRequest(null);
      setForm({ startDate: '', endDate: '', reason: '' });
      fetchList();
      fetchAvailability();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this WFH request?')) return;
    setCancelling(id);
    try {
      await wfhAPI.cancel(id);
      toast.success('WFH request cancelled successfully');
      fetchList();
      fetchAvailability();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to cancel';
      toast.error(msg);
    } finally {
      setCancelling(null);
    }
  };

  const statusBadge = (status, managerStatus) => {
    const s = (status || '').toUpperCase();
    const m = (managerStatus || '').toUpperCase();

    if (s === 'CANCELLED') {
      return <span className="hr-status-badge rejected" style={{ background: 'var(--gray-100, #f3f4f6)', color: 'var(--gray-600, #6b7280)' }}>Cancelled</span>;
    }

    if (s === 'APPROVED') {
      return <span className="hr-status-badge approved">Approved</span>;
    }

    if (s === 'REJECTED') {
      return <span className="hr-status-badge rejected">Rejected</span>;
    }

    // Manager has approved, but overall status is still pending → waiting for HR/Admin
    if (s === 'PENDING' && m === 'APPROVED') {
      return <span className="hr-status-badge pending">Pending HR Approval</span>;
    }

    return <span className="hr-status-badge pending">Pending</span>;
  };

  const getActionByName = (row) => {
    const status = (row.status || '').toUpperCase();
    const managerStatus = (row.managerStatus || '').toUpperCase();

    // If final status is set (APPROVED/REJECTED), show the actual person who took that final action
    if (status === 'APPROVED' || status === 'REJECTED') {
      // If admin name is available, it means admin or HR took the final action
      if (row.adminName) return row.adminName;
      // If no admin name but manager status is not pending, it might be the manager who finalized it (within limit)
      if (managerStatus !== 'PENDING') return row.managerName || '-';
    }

    // If status is still PENDING but manager has APPROVED, show manager name as the one who last acted
    if (status === 'PENDING' && managerStatus === 'APPROVED') {
      return row.managerName || 'Manager Approved';
    }

    return '-';
  };

  if (!canRead) {
    return (
      <div className="main-content wfh-page">
        <Header title="Work From Home" subtitle="Request and view your WFH" />
        <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '40px 24px',
            textAlign: 'center',
            maxWidth: '420px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            border: '1px solid var(--gray-100, #f3f4f6)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#fef2f2',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <ShieldAlert size={32} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Access Restricted</h3>
            <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.5, margin: 0 }}>
              You do not have permission to view or manage Work From Home requests. Please contact your organization administrator or HR to request access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Filter list by status to find pending requests
  const pendingRequests = list.filter((r) => {
    const s = (r.status || '').toUpperCase();
    return s === 'PENDING' || s === 'PENDING_HR';
  });

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

  const renderWfhLimitCard = (title, used, total, remaining, color) => {
    const percentage = total > 0 ? Math.min(100, (remaining / total) * 100) : 100;
    const circumference = 2 * Math.PI * 36;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    const usedPct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

    return (
      <article className="lv-balance-card" key={title} style={{ padding: '16px' }}>
        <div className="lv-balance-header" style={{ marginBottom: '12px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--lv-text-dark)', margin: 0 }}>{title}</h3>
        </div>

        <div className="lv-ring-wrap" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="lv-ring" style={{ width: '80px', height: '80px', position: 'relative', flexShrink: 0 }} aria-hidden="true">
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
            <div className="lv-ring-center" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span className="lv-ring-days" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--lv-text-dark)', lineHeight: 1 }}>{remaining}</span>
              <span className="lv-ring-label" style={{ fontSize: '9px', color: 'var(--lv-text-muted)', fontWeight: 500 }}>left</span>
            </div>
          </div>
          <div className="lv-progress-block" style={{ flex: 1 }}>
            <div className="lv-progress-meta" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--lv-text-muted)', marginBottom: '4px' }}>
              <span>Used</span>
              <strong>{usedPct}%</strong>
            </div>
            <div className="lv-progress-track" style={{ height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
              <div className="lv-progress-fill" style={{ width: `${usedPct}%`, backgroundColor: color, height: '100%' }} />
            </div>
            <div className="lv-progress-meta" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--lv-text-muted)' }}>
              <span>Quota limit</span>
              <strong>{total} days</strong>
            </div>
          </div>
        </div>

        <div className="lv-balance-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--lv-border)' }}>
          <div className="lv-stat-mini">
            <span style={{ display: 'block', fontSize: '11px', color: 'var(--lv-text-muted)' }}>Available</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--lv-text-dark)' }}>{remaining} days</span>
          </div>
          <div className="lv-stat-mini">
            <span style={{ display: 'block', fontSize: '11px', color: 'var(--lv-text-muted)' }}>Used</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--lv-text-dark)' }}>{used} days</span>
          </div>
        </div>
      </article>
    );
  };

  const renderSummaryTab = () => {
    return (
      <>
        {/* Pending Requests Card */}
        <div className="card" style={{ margin: 0, padding: '20px' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: 0, border: 'none', background: 'transparent', marginBottom: '16px' }}>
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '16px', fontWeight: 700 }}>
                Pending requests
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--lv-text-muted)' }}>
                {pendingRequests.length > 0
                  ? `${pendingRequests.length} request(s) awaiting approval`
                  : 'You are all caught up'}
              </p>
            </div>
            {canCreate && (
              <button
                type="button"
                className="lv-btn-outline"
                onClick={openCreateModal}
                disabled={availability && ((availability.remainingThisWeek === 0 && policy?.maxDaysPerWeek > 0) || (availability.remainingThisMonth === 0 && policy?.maxDaysPerMonth > 0))}
                title={availability && ((availability.remainingThisWeek === 0 && policy?.maxDaysPerWeek > 0) || (availability.remainingThisMonth === 0 && policy?.maxDaysPerMonth > 0)) ? 'WFH limit reached' : ''}
              >
                <Plus size={16} aria-hidden="true" />
                Request WFH
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
                <Home size={28} aria-hidden="true" />
              </div>
              <div>
                <h3>No pending WFH requests</h3>
                <p>Use Request WFH when you need to work from home.</p>
              </div>
            </div>
          ) : (
            <div className="lv-pending-grid">
              {pendingRequests.map((request, idx) => (
                <div key={request.id || `pending-wfh-${idx}`} className="lv-pending-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="lv-pending-type" style={{ fontWeight: 600, color: 'var(--lv-text-dark)' }}>Work From Home</span>
                    <span className="lv-pending-dates" style={{ fontSize: '13px', color: 'var(--lv-text-muted)' }}>
                      {request.startDate} — {request.endDate} ({request.totalDays || 1} day(s))
                    </span>
                    <div style={{ marginTop: '4px' }}>
                      {statusBadge(request.status, request.managerStatus)}
                    </div>
                  </div>
                  <div className="lv-row-actions" style={{ marginLeft: '12px' }}>
                    {canUpdate && (
                      <button
                        type="button"
                        className="lv-icon-btn"
                        title="Edit WFH request"
                        onClick={() => openEditModal(request)}
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="lv-icon-btn lv-icon-btn-danger"
                        title="Cancel WFH request"
                        onClick={() => handleCancel(request.id)}
                        disabled={cancelling === request.id}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>


        {/* WFH Limits Card */}
        {policy && (policy.maxDaysPerWeek > 0 || policy.maxDaysPerMonth > 0) && (
          <div className="card" style={{ margin: '20px 0 0 0', padding: '20px' }}>
            <div className="card-header" style={{ padding: 0, border: 'none', background: 'transparent', marginBottom: '16px' }}>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '16px', fontWeight: 700 }}>
                <Calendar size={18} color="var(--lv-primary)" />
                WFH limits & allocation
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--lv-text-muted)' }}>Available days under organization policy</p>
            </div>
            <div className="lv-balances-grid">
              {loading ? (
                Array(2).fill(0).map((_, i) => (
                  <div key={i} className="lv-balance-card">
                    <div className="nt-skeleton" style={{ width: '120px', height: '14px', marginBottom: '16px' }} />
                    <div className="nt-skeleton" style={{ width: '100%', height: '88px', borderRadius: '8px' }} />
                  </div>
                ))
              ) : (
                <>
                  {policy.maxDaysPerWeek > 0 && availability && renderWfhLimitCard(
                    'Weekly Limit',
                    availability.usedThisWeek,
                    policy.maxDaysPerWeek,
                    availability.remainingThisWeek,
                    '#2563eb'
                  )}
                  {policy.maxDaysPerMonth > 0 && availability && renderWfhLimitCard(
                    'Monthly Limit',
                    availability.usedThisMonth,
                    policy.maxDaysPerMonth,
                    availability.remainingThisMonth,
                    '#10b981'
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* WFH History Card */}
        <div className="card" style={{ margin: '20px 0 0 0', padding: '20px' }} id="wfh-history-section">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: 0, border: 'none', background: 'transparent', marginBottom: '16px' }}>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '16px', fontWeight: 700 }}>
              <ClipboardList size={18} color="var(--lv-primary)" />
              WFH history
            </h3>
            <span style={{ fontSize: '13px', color: 'var(--lv-text-muted)', fontWeight: 600 }}>
              {list.length} record(s) in {selectedYear}
            </span>
          </div>

          {loading ? (
            <div className="lv-table-wrap">
              <table className="lv-table">
                <thead>
                  <tr>
                    <th style={{ width: '10%' }}>From</th>
                    <th style={{ width: '10%' }}>To</th>
                    <th style={{ width: '6%' }}>Days</th>
                    <th style={{ width: '32%' }}>Reason</th>
                    <th style={{ width: '10%' }}>Status</th>
                    <th style={{ width: '22%' }}>Response Comment</th>
                    <th style={{ width: '10%' }}>Action By</th>
                    <th style={{ width: '10%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array(3).fill(0).map((_, i) => (
                    <tr key={i}>
                      {Array(8).fill(0).map((_, j) => (
                        <td key={j}><div className="nt-skeleton" style={{ width: '80%', height: '10px' }} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : list.length === 0 ? (
            <div className="lv-empty-history" style={{ padding: '30px', textAlign: 'center', color: 'var(--lv-text-muted)' }}>
              <Calendar size={48} aria-hidden="true" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p>No WFH history for {selectedYear}.</p>
            </div>
          ) : (
            <div className="lv-table-wrap">
              <table className="lv-table">
                <thead>
                  <tr>
                    <th style={{ width: '10%' }}>From</th>
                    <th style={{ width: '10%' }}>To</th>
                    <th style={{ width: '6%' }}>Days</th>
                    <th style={{ width: '32%' }}>Reason</th>
                    <th style={{ width: '10%' }}>Status</th>
                    <th style={{ width: '22%' }}>Response Comment</th>
                    <th style={{ width: '10%' }}>Action By</th>
                    <th style={{ width: '10%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((row) => (
                    <tr key={row.id}>
                      <td style={{ fontWeight: 600 }}>{row.startDate ? new Date(row.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</td>
                      <td style={{ fontWeight: 600 }}>{row.endDate ? new Date(row.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</td>
                      <td>{row.totalDays || 1}</td>
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
                          {row.reason || '-'}
                        </span>
                      </td>
                      <td>{statusBadge(row.status, row.managerStatus)}</td>
                      <td className="lv-cell-reason">
                        <span style={{ 
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'normal',
                          lineHeight: '1.4',
                          fontStyle: 'italic'
                        }}>
                          {row.adminResponse || row.managerResponse || '-'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{getActionByName(row)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="lv-icon-btn"
                            title="View Details"
                            onClick={() => setViewModal(row)}
                          >
                            <Eye size={16} />
                          </button>
                          {(row.status || '').toUpperCase() === 'PENDING' && (
                            <>
                              {canUpdate && (
                                <button
                                  type="button"
                                  className="lv-icon-btn"
                                  title="Edit"
                                  onClick={() => openEditModal(row)}
                                >
                                  <Edit2 size={16} />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  className="lv-icon-btn lv-icon-btn-danger"
                                  title="Cancel"
                                  onClick={() => handleCancel(row.id)}
                                  disabled={cancelling === row.id}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
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

  const renderPolicyTab = () => {
    return (
      <div className="card" style={{ margin: 0, padding: '20px' }}>
        <div className="card-header" style={{ padding: 0, border: 'none', background: 'transparent', marginBottom: '20px' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '16px', fontWeight: 700 }}>
            <Info size={18} color="var(--lv-primary)" />
            Work From Home policy & guidelines
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--lv-text-muted)' }}>
            Overview of the limits and rules configured for WFH requests
          </p>
        </div>

        <div className="lv-table-wrap">
          <table className="lv-table">
            <thead>
              <tr>
                <th>Rule / Setting</th>
                <th>Configuration</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>Weekly Limit</td>
                <td>
                  <span className="lv-status approved" style={{ display: 'inline-block' }}>
                    {policy?.maxDaysPerWeek ? `${policy.maxDaysPerWeek} days / week` : 'No Limit'}
                  </span>
                </td>
                <td>Maximum number of WFH days you can request within a single calendar week (Monday to Sunday).</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Monthly Limit</td>
                <td>
                  <span className="lv-status approved" style={{ display: 'inline-block' }}>
                    {policy?.maxDaysPerMonth ? `${policy.maxDaysPerMonth} days / month` : 'No Limit'}
                  </span>
                </td>
                <td>Maximum number of WFH days you can request within a single calendar month.</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Manager Approval Threshold</td>
                <td>
                  <span className="lv-status approved" style={{ display: 'inline-block', backgroundColor: policy?.managerLimit ? '#eff6ff' : '#f0fdf4', color: policy?.managerLimit ? '#1d4ed8' : '#15803d', border: policy?.managerLimit ? '1px solid #bfdbfe' : '1px solid #bbf7d0' }}>
                    {policy?.managerLimit !== null && policy?.managerLimit !== undefined ? `${policy.managerLimit} day(s)` : 'Unlimited'}
                  </span>
                </td>
                <td>Maximum consecutive WFH days a Manager can approve directly. Requests exceeding this threshold require 2-level approval (HR / Admin).</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Allow Weekends</td>
                <td>
                  <span className={`lv-status ${policy?.allowWeekends ? 'approved' : 'rejected'}`} style={{ display: 'inline-block' }}>
                    {policy?.allowWeekends ? 'Yes' : 'No'}
                  </span>
                </td>
                <td>Determines if WFH requests can fall on Saturdays and Sundays.</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Allow Holidays</td>
                <td>
                  <span className={`lv-status ${policy?.allowHolidays ? 'approved' : 'rejected'}`} style={{ display: 'inline-block' }}>
                    {policy?.allowHolidays ? 'Yes' : 'No'}
                  </span>
                </td>
                <td>Determines if WFH requests can overlap with public holidays.</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Allow Past Dates</td>
                <td>
                  <span className={`lv-status ${policy?.allowPastDates ? 'approved' : 'rejected'}`} style={{ display: 'inline-block' }}>
                    {policy?.allowPastDates ? 'Yes' : 'No'}
                  </span>
                </td>
                <td>Allows creating/modifying requests for dates prior to today.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (!canRead) {
    return (
      <div className="main-content wfh-page">
        <Header title="Work From Home" subtitle="Request and view your WFH" />
        <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '40px 24px',
            textAlign: 'center',
            maxWidth: '420px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            border: '1px solid var(--gray-100, #f3f4f6)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#fef2f2',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <ShieldAlert size={32} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Access Restricted</h3>
            <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.5, margin: 0 }}>
              You do not have permission to view or manage Work From Home requests. Please contact your organization administrator or HR to request access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content wfh-page leaves-page">
      <Header title="Work From Home" subtitle="Request work from home, track limits, and review your WFH history" />
      <div className="page-content" style={{ padding: '14px 16px 20px' }}>
        <div className="lv-toolbar">
          <div className="lv-segmented" role="tablist" aria-label="WFH sections">
            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'summary'}
              className={activeSubTab === 'summary' ? 'active' : ''}
              onClick={() => setActiveSubTab('summary')}
            >
              Summary
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'policy'}
              className={activeSubTab === 'policy' ? 'active' : ''}
              onClick={() => setActiveSubTab('policy')}
            >
              WFH Policy
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

        {activeSubTab === 'policy' ? renderPolicyTab() : renderSummaryTab()}
      </div>

      {showModal && (
        <div className="modal-overlay wfh-modal" style={{ backdropFilter: 'none' }} onClick={() => !submitting && (setShowModal(false), setEditingRequest(null))}>
          <div className="modal-content wfh-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="wfh-modal-title">
              {editingRequest ? 'Edit WFH Request' : 'Request Work From Home'}
            </h3>
            <form className="wfh-request-form" onSubmit={handleSubmit}>
              <div className="wfh-form-group">
                <label htmlFor="wfh-from-date">
                  From Date <span className="wfh-required">*</span>
                </label>
                <DatePicker
                  id="wfh-from-date"
                  value={form.startDate}
                  minDate={policy?.allowPastDates ? undefined : today}
                  maxDate={maxEndDateStr || undefined}
                  placeholderText="Select date"
                  onChange={(dateObj) => {
                    const val = dateFromPicker(dateObj);
                    if (!val || !validateWfhDate(val)) return;
                    let newEndDate = form.endDate;
                    const maxEnd = getNextDateStr(val, 7);
                    if (!form.endDate || form.endDate < val || form.endDate > maxEnd) {
                      newEndDate = val;
                    }
                    setForm((f) => ({ ...f, startDate: val, endDate: newEndDate }));
                  }}
                />
              </div>
              <div className="wfh-form-group">
                <label htmlFor="wfh-to-date">
                  To Date <span className="wfh-required">*</span>
                </label>
                <DatePicker
                  id="wfh-to-date"
                  value={form.endDate}
                  minDate={form.startDate || (policy?.allowPastDates ? undefined : today)}
                  maxDate={maxEndDateStr || undefined}
                  disabled={!form.startDate}
                  placeholderText="Select date"
                  onChange={(dateObj) => {
                    const val = dateFromPicker(dateObj);
                    if (!val || !validateWfhDate(val)) return;
                    setForm((f) => ({ ...f, endDate: val }));
                  }}
                />
                {!form.startDate && (
                  <p className="wfh-field-hint">Choose From Date first</p>
                )}
              </div>
              <div className="wfh-form-group">
                <label htmlFor="wfh-reason">
                  Reason <span className="wfh-required">*</span>
                </label>
                <textarea
                  id="wfh-reason"
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="Brief reason for WFH"
                  rows={3}
                  required
                />
              </div>
              <div className="wfh-form-actions">
                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); setEditingRequest(null); }} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? (editingRequest ? 'Updating...' : 'Submitting...') : (editingRequest ? 'Update' : 'Submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewModal && (
        <div className="lv-drawer-overlay" onClick={() => setViewModal(null)} role="presentation">
          <div className="lv-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="view-wfh-title">
            <div className="lv-drawer-header">
              <h2 id="view-wfh-title" style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#1e293b' }}>WFH Request Details</h2>
              <button 
                type="button" 
                onClick={() => setViewModal(null)} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-500)', padding: 0 }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="lv-drawer-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--gray-50)', marginBottom: '4px' }}>Start Date</label>
                  <p style={{ fontWeight: 500 }}>{viewModal.startDate ? new Date(viewModal.startDate).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--gray-50)', marginBottom: '4px' }}>End Date</label>
                  <p style={{ fontWeight: 500 }}>{viewModal.endDate ? new Date(viewModal.endDate).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--gray-50)', marginBottom: '4px' }}>Status</label>
                  <div>{statusBadge(viewModal.status, viewModal.managerStatus)}</div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--gray-50)', marginBottom: '4px' }}>Duration</label>
                  <p style={{ fontWeight: 500 }}>{viewModal.totalDays || '-'} Days</p>
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--gray-50)', marginBottom: '4px' }}>Reason</label>
                <div style={{ 
                  background: 'var(--gray-50)', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  fontSize: '13px',
                  color: 'var(--dark-500)',
                  border: '1px solid var(--gray-100)'
                }}>
                  {viewModal.reason || 'No reason provided'}
                </div>
              </div>
              {(viewModal.adminResponse || viewModal.managerResponse) && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--gray-50)', marginBottom: '4px' }}>Response Comment</label>
                  <p style={{ fontStyle: 'italic', fontSize: '13px' }}>{viewModal.adminResponse || viewModal.managerResponse}</p>
                </div>
              )}
              {getActionByName(viewModal) && getActionByName(viewModal) !== '-' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--gray-50)', marginBottom: '4px' }}>Action By</label>
                  <p style={{ fontWeight: 500 }}>{getActionByName(viewModal)}</p>
                </div>
              )}

              {/* Approval Flow Steps Section */}
              {(viewModal.status || '').toUpperCase() !== 'CANCELLED' && (
                <div style={{ marginTop: '16px', marginBottom: '16px', borderTop: '1px solid var(--lv-border)', paddingTop: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--lv-text-muted)' }}>Approval Flow</span>
                  {viewModal.managerStatus === 'APPROVED' && viewModal.status === 'PENDING' && (
                    <span style={{ fontSize: '9px', color: '#3b82f6', backgroundColor: '#eff6ff', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      Awaiting HR Approval (Limit Exceeded)
                    </span>
                  )}
                  {viewModal.managerStatus === 'PENDING' && viewModal.status === 'PENDING' && (viewModal.totalDays || 0) > (policy?.maxDaysPerWeek || 2) && (
                    <span style={{ fontSize: '9px', color: '#f59e0b', backgroundColor: '#fffbe6', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      2-Level Approval (Limit Exceeded)
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', padding: '0 5px' }}>
                  <div style={{ position: 'absolute', top: '16px', left: '30px', right: '30px', height: '1.5px', backgroundColor: '#e5e7eb', zIndex: 0 }}></div>
                  {(() => {
                    const reqStatus = (viewModal.status || 'PENDING').toUpperCase();
                    const mStatus = (viewModal.managerStatus || 'PENDING').toUpperCase();
                    const totalDays = viewModal.totalDays || 0;
                    const wfhLimit = policy?.maxDaysPerWeek || 2;
                    const isLimitExceeded = totalDays > wfhLimit;

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

                    // Check if 2-level approval (HR / Admin) is actually required:
                    // 1. Limit is exceeded (totalDays > wfhLimit)
                    // 2. Manager approved while overall status remains PENDING (awaiting HR)
                    // 3. Admin/HR has actually responded (adminResponse or adminName present)
                    const isTwoLevelRequired = isLimitExceeded || (mStatus === 'APPROVED' && reqStatus === 'PENDING') || (!!viewModal.adminName && viewModal.adminName !== '-') || (!!viewModal.adminResponse && !viewModal.adminResponse.toLowerCase().includes('cancelled'));

                    const steps = [
                      { label: 'Employee', name: user?.firstName ? `${user.firstName} ${user.lastName || ''}` : 'You', icon: <CheckCircle size={14} />, color: '#10b981', statusText: 'Submitted' },
                      { label: 'Manager', name: viewModal.managerName || 'Reporting Manager', ...managerStep },
                      ...(isTwoLevelRequired ? [{ label: 'HR / Admin', name: viewModal.adminName || 'HR/Admin Approval', ...adminStep }] : [])
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

              {renderTimeline(viewModal)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
