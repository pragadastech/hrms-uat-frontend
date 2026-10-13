import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Calendar,
  Search,
  Upload,
  X,
  Eye,
  CheckCircle,
  XCircle,
  Loader2,
  Users,
  ClipboardList,
  Clock,
  Plus,
  Scale,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import Header from '../components/Header';
import LeaveHistoryImportModal from '../components/LeaveHistoryImportModal';
import LeaveAdjustmentsPanel from '../components/LeaveAdjustmentsPanel';
import './Leaves.css';
import {
  getPendingLeaveRequests,
  getAllLeaveRequests,
  getAcceptedLeaveRequests,
  getRejectedLeaveRequests,
  respondToLeaveRequest,
  employeeAPI,
} from '../services/api';

const parseLeaveList = (res) => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.leaveRequests)) return res.leaveRequests;
  if (Array.isArray(res.data)) return res.data;
  return [];
};

const formatLeaveType = (request) => {
  if (typeof request.leaveType === 'object') {
    return request.leaveType.name || request.leaveType.leaveTypeName || request.leaveType.code || 'Leave';
  }
  return request.leaveType || request.leaveTypeName || 'Leave';
};

const getEmployeeName = (request) =>
  request.employeeName ||
  (request.employee?.firstName && request.employee?.lastName
    ? `${request.employee.firstName} ${request.employee.lastName}`
    : 'N/A');

const getEmployeeId = (request) =>
  request.employeeId || request.employee?.employeeId || '';

export default function AdminLeaves() {
  const { user } = useAuth();
  const hasHrOrCeoRole = Array.isArray(user?.roles)
    && user.roles.some((role) => ['HR', 'CEO'].includes(String(role).trim().toUpperCase()));
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const initialTab = searchParams.get('tab') === 'adjustments' ? 'adjustments' : 'pending';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState('ALL');
  const [adminLeaveTypeFilter, setAdminLeaveTypeFilter] = useState('ALL');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeActionType, setActiveActionType] = useState(null);
  const [confirmingLeave, setConfirmingLeave] = useState(null);
  const [confirmReason, setConfirmReason] = useState('');

  const [pendingRequests, setPendingRequests] = useState([]);
  const [acceptedLeaveRequests, setAcceptedLeaveRequests] = useState([]);
  const [rejectedLeaveRequests, setRejectedLeaveRequests] = useState([]);
  const [allLeaveRequests, setAllLeaveRequests] = useState([]);

  const cancelledRequests = useMemo(() => {
    return allLeaveRequests.filter((r) => (r.status || '').toUpperCase() === 'CANCELLED');
  }, [allLeaveRequests]);

  const fetchAdminLeaveData = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, allRes, acceptedRes, rejectedRes] = await Promise.allSettled([
        getPendingLeaveRequests(),
        getAllLeaveRequests(),
        getAcceptedLeaveRequests(),
        getRejectedLeaveRequests(),
      ]);

      setPendingRequests(
        pendingRes.status === 'fulfilled' ? parseLeaveList(pendingRes.value) : []
      );
      setAllLeaveRequests(allRes.status === 'fulfilled' ? parseLeaveList(allRes.value) : []);
      setAcceptedLeaveRequests(
        acceptedRes.status === 'fulfilled' ? parseLeaveList(acceptedRes.value) : []
      );
      setRejectedLeaveRequests(
        rejectedRes.status === 'fulfilled' ? parseLeaveList(rejectedRes.value) : []
      );
    } catch (err) {
      console.error('Error fetching admin leave data:', err);
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminLeaveData();
    employeeAPI.getActiveLeaveTypes().catch(() => {});
  }, [fetchAdminLeaveData]);

  useEffect(() => {
    if (searchParams.get('tab') === 'adjustments') {
      setActiveTab('adjustments');
    }
  }, [searchParams]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'adjustments') {
      setSearchParams({ tab: 'adjustments' });
    } else {
      setSearchParams({});
    }
  };

  const getCurrentLeaveList = useCallback(() => {
    switch (activeTab) {
      case 'pending':
        return pendingRequests;
      case 'approved':
        return acceptedLeaveRequests;
      case 'rejected':
        return rejectedLeaveRequests;
      case 'cancelled':
        return cancelledRequests;
      case 'all':
        return allLeaveRequests;
      case 'adjustments':
        return [];
      default:
        return pendingRequests;
    }
  }, [activeTab, pendingRequests, acceptedLeaveRequests, rejectedLeaveRequests, cancelledRequests, allLeaveRequests]);

  const filteredLeaves = useMemo(() => {
    const list = getCurrentLeaveList();
    const searchTerm = adminSearchQuery.toLowerCase().trim().replace(/\s+/g, ' ');

    return list.filter((request) => {
      const empName = getEmployeeName(request).toLowerCase();
      const empId = String(getEmployeeId(request)).toLowerCase();
      const leaveStatus = (request.status || '').toUpperCase();
      const lType = request.leaveType || request.leaveTypeName || '';

      const matchesSearch =
        !searchTerm ||
        empName.replace(/\s+/g, ' ').includes(searchTerm) ||
        empId.includes(searchTerm);
      const matchesStatus = adminStatusFilter === 'ALL' || leaveStatus === adminStatusFilter;
      const matchesType = adminLeaveTypeFilter === 'ALL' || lType === adminLeaveTypeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [getCurrentLeaveList, adminSearchQuery, adminStatusFilter, adminLeaveTypeFilter]);

  const uniqueLeaveTypes = useMemo(() => {
    return [...new Set(getCurrentLeaveList().map((r) => formatLeaveType(r)).filter(Boolean))];
  }, [getCurrentLeaveList]);

  const heroStats = useMemo(
    () => ({
      pending: pendingRequests.length,
      approved: acceptedLeaveRequests.length,
      rejected: rejectedLeaveRequests.length,
      cancelled: cancelledRequests.length,
      total: allLeaveRequests.length,
    }),
    [pendingRequests, acceptedLeaveRequests, rejectedLeaveRequests, cancelledRequests, allLeaveRequests]
  );

  const handleLeaveAction = async (leaveId, status, reasonFromModal) => {
    let action = 'Rejected';
    if (status === 'APPROVED') action = 'Approved';
    if (status === 'CANCELLED') action = 'Cancelled';

    const approverName =
      user?.firstName && user?.lastName
        ? `${user.firstName} ${user.lastName}`
        : user?.fullName || user?.name || 'Admin';

    let responseMsg = `${status} by ${approverName} (Admin)`;
    if (status === 'REJECTED' || status === 'CANCELLED') {
      responseMsg = `${status} by ${approverName} (Admin): ${reasonFromModal || ''}`;
    }

    setActionLoading(true);
    setActiveActionType(status);
    try {
      await respondToLeaveRequest(leaveId, { status, response: responseMsg });
      toast.success(`Leave request ${action.toLowerCase()} successfully`);
      setShowDetailModal(false);
      setSelectedLeave(null);
      setConfirmingLeave(null);
      fetchAdminLeaveData();
    } catch (error) {
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        `Failed to ${action.toLowerCase()} leave request`;
      toast.error(errorMessage);
    } finally {
      setActionLoading(false);
      setActiveActionType(null);
    }
  };

  const tabLabels = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    all: 'All requests',
    adjustments: 'Leave Adjustments',
  };

  return (
    <div className="main-content leaves-page">
      <Header
        title="All Leaves"
        subtitle="Review, approve, and manage organization-wide leave requests"
      />

      <div className="page-content" style={{ padding: '14px 16px 20px' }}>
        <section className="lv-hero" aria-label="Leave management overview">
          <div className="lv-hero-content">
            <span className="lv-hero-eyebrow">
              <Users size={14} aria-hidden="true" />
              Organization
            </span>
            <h2 className="lv-hero-title">Leave management</h2>
            <p className="lv-hero-sub">
              Search and filter requests across your organization. Approve or reject pending
              applications from one place.
            </p>
            <div className="lv-hero-metrics">
              <div className="lv-hero-metric">
                <span className="lv-hero-metric-val">{heroStats.pending}</span>
                <span className="lv-hero-metric-lbl">Pending</span>
              </div>
              <div className="lv-hero-metric">
                <span className="lv-hero-metric-val">{heroStats.approved}</span>
                <span className="lv-hero-metric-lbl">Approved</span>
              </div>
              <div className="lv-hero-metric">
                <span className="lv-hero-metric-val">{heroStats.rejected}</span>
                <span className="lv-hero-metric-lbl">Rejected</span>
              </div>
              <div className="lv-hero-metric">
                <span className="lv-hero-metric-val">{heroStats.cancelled}</span>
                <span className="lv-hero-metric-lbl">Cancelled</span>
              </div>
              <div className="lv-hero-metric">
                <span className="lv-hero-metric-val">{heroStats.total}</span>
                <span className="lv-hero-metric-lbl">Total requests</span>
              </div>
            </div>
          </div>
          <div className="lv-hero-actions">
            {hasHrOrCeoRole && (
              <Link to="/admin/my-leaves" className="lv-btn-secondary" style={{ textDecoration: 'none' }}>
                <Plus size={18} aria-hidden="true" />
                Apply leave
              </Link>
            )}
            <Link to="/admin/leave-adjustments" className="lv-btn-secondary" style={{ textDecoration: 'none' }}>
              <Scale size={18} aria-hidden="true" />
              Leave Adjustments
            </Link>
            <button type="button" className="lv-btn-primary lv-btn-import" onClick={() => setShowImportModal(true)}>
              <Upload size={18} aria-hidden="true" />
              Import history
            </button>
          </div>
        </section>

        {activeTab !== 'adjustments' && (
        <div className="lv-filter-bar">
          <div className="lv-search-wrap">
            <input
              type="search"
              className="lv-search-input"
              placeholder="Search by employee name or ID…"
              value={adminSearchQuery}
              onChange={(e) => setAdminSearchQuery(e.target.value)}
              aria-label="Search leave requests"
            />
          </div>
          <select
            className="lv-year-select"
            value={adminLeaveTypeFilter}
            onChange={(e) => setAdminLeaveTypeFilter(e.target.value)}
            aria-label="Filter by leave type"
          >
            <option value="ALL">All leave types</option>
            {uniqueLeaveTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            className="lv-year-select"
            value={adminStatusFilter}
            onChange={(e) => setAdminStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        )}

        <div className="lv-toolbar" style={{ marginBottom: 12 }}>
          <div className="lv-segmented lv-segmented-wide" role="tablist" aria-label="Leave management tabs">
            {['pending', 'approved', 'rejected', 'cancelled', 'all', 'adjustments'].map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={activeTab === tab ? 'active' : ''}
                onClick={() => handleTabChange(tab)}
              >
                {tabLabels[tab]}
                {tab === 'pending' && heroStats.pending > 0 && (
                  <span className="lv-tab-badge">{heroStats.pending}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'adjustments' ? (
          <LeaveAdjustmentsPanel embedded={false} />
        ) : (
        <section className="lv-history-section" aria-labelledby="admin-leaves-table-heading">
          <div className="lv-section-head">
            <div>
              <h2 id="admin-leaves-table-heading" className="lv-section-title">
                <ClipboardList size={18} className="lv-section-icon" aria-hidden="true" />
                {tabLabels[activeTab]}
              </h2>
              <p className="lv-section-desc">
                {loading ? 'Loading…' : `${filteredLeaves.length} request(s) shown`}
              </p>
            </div>
            <button type="button" className="lv-btn-outline" onClick={fetchAdminLeaveData} disabled={loading}>
              {loading ? <Loader2 size={16} className="lv-spin" /> : <Clock size={16} />}
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="lv-loading-panel">
              <Loader2 size={32} className="lv-spin" aria-hidden="true" />
              <p>Loading leave requests…</p>
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="lv-empty-history">
              <Calendar size={48} aria-hidden="true" />
              <p>No {activeTab} leave requests match your filters.</p>
            </div>
          ) : (
            <div className="lv-table-wrap">
              <table className="lv-table lv-table-admin">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Leave type</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Days</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Applied</th>
                    <th>Approved by</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaves.map((request, idx) => {
                    const status = (request.status || 'PENDING').toLowerCase();
                    const isApprovedOrRejected = ['approved', 'rejected'].includes(status);
                    const approverName =
                      request.adminName || request.managerName || request.approvedByName;
                    const approvalDate =
                      request.adminResponseDate || request.managerResponseDate;

                    return (
                      <tr key={request.id || idx}>
                        <td>
                          <div className="lv-employee-cell">
                            <img
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(getEmployeeName(request))}&background=0891b2&color=fff`}
                              className="lv-avatar"
                              alt=""
                            />
                            <div>
                              <div className="lv-emp-name">{getEmployeeName(request)}</div>
                              <div className="lv-emp-id">{getEmployeeId(request)}</div>
                            </div>
                          </div>
                        </td>
                        <td>{formatLeaveType(request)}</td>
                        <td>
                          {request.startDate
                            ? typeof request.startDate === 'string'
                              ? request.startDate
                              : new Date(request.startDate).toLocaleDateString()
                            : '—'}
                        </td>
                        <td>
                          {request.endDate
                            ? typeof request.endDate === 'string'
                              ? request.endDate
                              : new Date(request.endDate).toLocaleDateString()
                            : '—'}
                        </td>
                        <td>{request.totalDays || request.days || request.duration || '—'}</td>
                        <td className="lv-cell-reason">{request.reason || '—'}</td>
                        <td>
                          <span className={`lv-status ${status}`}>{request.status || 'PENDING'}</span>
                        </td>
                        <td className="lv-cell-muted">
                          {request.createdAt
                            ? new Date(request.createdAt).toLocaleDateString()
                            : '—'}
                        </td>
                        <td>
                          {isApprovedOrRejected && approverName ? (
                            <div className="lv-approver-block">
                              <div className="lv-approver-name">{approverName}</div>
                              {approvalDate && (
                                <div className="lv-approver-date">
                                  {new Date(approvalDate).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="lv-cell-muted">—</span>
                          )}
                        </td>
                        <td>
                          <div className="lv-row-actions">
                            <button
                              type="button"
                              className="lv-icon-btn"
                              title="View details"
                              onClick={() => {
                                setSelectedLeave(request);
                                setShowDetailModal(true);
                              }}
                            >
                              <Eye size={16} />
                            </button>
                            {activeTab === 'pending' && status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  className="lv-icon-btn lv-icon-btn-success"
                                  title="Approve"
                                  disabled={actionLoading}
                                  onClick={() => handleLeaveAction(request.id, 'APPROVED')}
                                >
                                  <CheckCircle size={16} />
                                </button>
                                <button
                                  type="button"
                                  className="lv-icon-btn lv-icon-btn-danger"
                                  title="Reject"
                                  disabled={actionLoading}
                                  onClick={() => handleLeaveAction(request.id, 'REJECTED')}
                                >
                                  <XCircle size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        )}
      </div>

      {showDetailModal && selectedLeave && (
        <div
          className="lv-modal-overlay"
          onClick={() => setShowDetailModal(false)}
          role="presentation"
        >
          <div
            className="lv-modal lv-modal-detail"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="leave-detail-title"
          >
            <div className="lv-modal-header">
              <h2 id="leave-detail-title">Leave request details</h2>
              <button
                type="button"
                className="lv-modal-close"
                onClick={() => setShowDetailModal(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="lv-modal-body">
              <div className="lv-detail-employee">
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(getEmployeeName(selectedLeave))}&background=0891b2&color=fff&size=128`}
                  className="lv-detail-avatar"
                  alt=""
                />
                <div>
                  <div className="lv-emp-name">{getEmployeeName(selectedLeave)}</div>
                  <div className="lv-emp-id">{getEmployeeId(selectedLeave)}</div>
                </div>
                <span className={`lv-status ${(selectedLeave.status || 'pending').toLowerCase()}`}>
                  {selectedLeave.status || 'PENDING'}
                </span>
              </div>

              <div className="lv-detail-grid">
                <div className="lv-detail-item">
                  <span className="lv-detail-label">Leave type</span>
                  <span>{formatLeaveType(selectedLeave)}</span>
                </div>
                <div className="lv-detail-item">
                  <span className="lv-detail-label">Duration</span>
                  <span>
                    {selectedLeave.totalDays || selectedLeave.days || selectedLeave.duration || '—'}{' '}
                    days
                  </span>
                </div>
                <div className="lv-detail-item lv-detail-item-wide">
                  <span className="lv-detail-label">Period</span>
                  <span>
                    {selectedLeave.startDate} — {selectedLeave.endDate}
                  </span>
                </div>
              </div>

              <div className="lv-detail-reason">
                <span className="lv-detail-label">Reason</span>
                <p>{selectedLeave.reason || 'No reason provided.'}</p>
              </div>

              {selectedLeave.supportingDocumentPath && (
                <div className="lv-detail-reason" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span className="lv-detail-label" style={{ margin: 0 }}>Supporting Document</span>
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
                      color: '#0891b2',
                      backgroundColor: '#ecfeff',
                      border: '1px solid #a5f3fc',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      textDecoration: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      width: 'fit-content'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#cffafe'; }}
                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#ecfeff'; }}
                  >
                    View Attachment
                  </a>
                </div>
              )}

              {(selectedLeave.adminResponse || selectedLeave.managerResponse) && (
                <div className="lv-detail-reason lv-detail-response">
                  <span className="lv-detail-label">Response</span>
                  <p>{selectedLeave.adminResponse || selectedLeave.managerResponse}</p>
                </div>
              )}
            </div>

            {(selectedLeave.status || '').toUpperCase() === 'PENDING' && (
              <div className="lv-modal-footer">
                <button type="button" className="lv-btn-cancel" onClick={() => setShowDetailModal(false)}>
                  Close
                </button>
                <button
                  type="button"
                  className="lv-btn-cancel lv-btn-reject-outline"
                  disabled={actionLoading}
                  onClick={() => { setConfirmingLeave({ request: selectedLeave, action: 'CANCELLED' }); setConfirmReason(''); }}
                >
                  Cancel Leave
                </button>
                <button
                  type="button"
                  className="lv-btn-cancel lv-btn-reject-outline"
                  disabled={actionLoading}
                  onClick={() => { setConfirmingLeave({ request: selectedLeave, action: 'REJECTED' }); setConfirmReason(''); }}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="lv-btn-primary"
                  disabled={actionLoading}
                  onClick={() => { setConfirmingLeave({ request: selectedLeave, action: 'APPROVED' }); setConfirmReason(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {actionLoading && activeActionType === 'APPROVED' ? (
                    <>
                      <Loader2 size={16} className="lv-spin" />
                      Approving...
                    </>
                  ) : (
                    'Approve'
                  )}
                </button>
              </div>
            )}

            {['APPROVED', 'ACCEPTED'].includes((selectedLeave.status || '').toUpperCase()) && (
              <div className="lv-modal-footer">
                <button type="button" className="lv-btn-cancel" onClick={() => setShowDetailModal(false)}>
                  Close
                </button>
                <button
                  type="button"
                  className="lv-btn-cancel lv-btn-reject-outline"
                  disabled={actionLoading}
                  onClick={() => { setConfirmingLeave({ request: selectedLeave, action: 'CANCELLED' }); setConfirmReason(''); }}
                >
                  Cancel Leave
                </button>
              </div>
            )}

            {!['PENDING', 'APPROVED', 'ACCEPTED'].includes((selectedLeave.status || '').toUpperCase()) && (
              <div className="lv-modal-footer">
                <button type="button" className="lv-btn-cancel" onClick={() => setShowDetailModal(false)}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <LeaveHistoryImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={() => {
          fetchAdminLeaveData();
          setShowImportModal(false);
        }}
      />

      {confirmingLeave && (
        <div
          className="lv-modal-overlay"
          style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setConfirmingLeave(null)}
        >
          <div
            className="lv-modal"
            style={{ maxWidth: '400px', width: '90%', padding: '24px', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: '#1e293b' }}>
              {confirmingLeave.action === 'APPROVED' ? 'Confirm Approval' : confirmingLeave.action === 'CANCELLED' ? 'Confirm Cancellation' : 'Confirm Rejection'}
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
              Are you sure you want to {confirmingLeave.action === 'APPROVED' ? 'approve' : confirmingLeave.action === 'CANCELLED' ? 'cancel' : 'reject'} this leave request? This action cannot be undone.
            </p>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Feedback {confirmingLeave.action === 'APPROVED' ? '(Optional)' : '(Mandatory)'}
              </label>
              <textarea
                value={confirmReason}
                onChange={(e) => setConfirmReason(e.target.value)}
                placeholder={`Please enter feedback for ${confirmingLeave.action === 'APPROVED' ? 'approval (optional)' : confirmingLeave.action === 'CANCELLED' ? 'cancellation' : 'rejection'}...`}
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
                onClick={() => setConfirmingLeave(null)}
                disabled={actionLoading}
              >
                Go Back
              </button>
              <button 
                type="button"
                className="lv-btn-primary"
                style={{ 
                  background: confirmingLeave.action === 'APPROVED' ? '#0891b2' : '#ef4444', 
                  borderColor: confirmingLeave.action === 'APPROVED' ? '#0891b2' : '#ef4444', 
                  color: '#fff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px' 
                }}
                onClick={() => {
                  if (confirmingLeave.action !== 'APPROVED' && !confirmReason.trim()) {
                    toast.error('Reason is required');
                    return;
                  }
                  handleLeaveAction(confirmingLeave.request.id, confirmingLeave.action, confirmReason.trim());
                }}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <Loader2 size={16} className="lv-spin" />
                    Processing...
                  </>
                ) : (
                  confirmingLeave.action === 'APPROVED' ? 'Confirm Approve' : confirmingLeave.action === 'CANCELLED' ? 'Confirm Cancel' : 'Confirm Reject'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
