import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Search, Upload, X, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import LeaveHistoryImportModal from './LeaveHistoryImportModal';
import { adminAPI, leaveBalanceAPI, unifiedEmployeeAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { formatLeaveTypeLabel } from '../utils/labelUtils';
import '../pages/Leaves.css';

const EMPTY_FORM = {
  employeeId: '',
  leaveType: '',
  adjustmentType: 'ADDITION',
  days: '',
  reason: '',
};

const normalizeEmployeeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.employees)) return payload.employees;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.content)) return payload.content;
  return [];
};

export default function LeaveAdjustmentsPanel({
  title = 'Leave Adjustments',
  subtitle = 'Manually adjust leave balances and review the org-wide audit log',
  showImport = true,
  embedded = false,
}) {
  const { hasAdminAccess, sessionType } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchEmployees = useCallback(async () => {
    try {
      const preferOrg = (typeof hasAdminAccess === 'function' && hasAdminAccess()) || sessionType === 'admin';
      const scopesToTry = preferOrg ? ['ORG', 'TEAM'] : ['TEAM', 'ORG'];
      let list = [];

      for (const scope of scopesToTry) {
        try {
          const res = await unifiedEmployeeAPI.getEmployees(scope);
          list = normalizeEmployeeList(res?.data).filter(Boolean);
          if (list.length > 0) break;
        } catch {
          /* try next scope */
        }
      }

      if (list.length === 0) {
        try {
          const empRes = await adminAPI.getActiveEmployees();
          list = normalizeEmployeeList(empRes?.data).filter(Boolean);
        } catch {
          list = [];
        }
      }

      setEmployees(list);
    } catch (err) {
      console.warn('Failed to load employees for adjustments', err);
      setEmployees([]);
    }
  }, [hasAdminAccess, sessionType]);

  const fetchLeaveTypes = useCallback(async () => {
    try {
      const res = await adminAPI.getActiveLeaveTypes();
      const raw = res?.data;
      const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
      setLeaveTypes(list.filter((lt) => (lt.leaveTypeCode || '').toUpperCase() !== 'WFH'));
    } catch (err) {
      console.warn('Failed to load leave types', err);
      setLeaveTypes([]);
    }
  }, []);

  const fetchAdjustments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await leaveBalanceAPI.getAllAdjustments();
      const data = res?.data;
      setAdjustments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load adjustments', err);
      toast.error(err.response?.data?.message || 'Failed to load leave adjustments');
      setAdjustments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
    fetchLeaveTypes();
    fetchAdjustments();
  }, [fetchEmployees, fetchLeaveTypes, fetchAdjustments]);

  const filteredAdjustments = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return adjustments;
    return adjustments.filter((adj) => {
      const name = String(adj.employeeName || '').toLowerCase();
      const empId = String(adj.employeeId || '').toLowerCase();
      const leaveType = String(adj.leaveType || '').toLowerCase();
      const reason = String(adj.reason || '').toLowerCase();
      const by = String(adj.performedByName || adj.performedBy || '').toLowerCase();
      return name.includes(term) || empId.includes(term) || leaveType.includes(term) || reason.includes(term) || by.includes(term);
    });
  }, [adjustments, searchTerm]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.employeeId || !form.leaveType || !form.days) {
      toast.error('Employee, leave type, and days are required');
      return;
    }
    const days = parseFloat(form.days);
    if (!Number.isFinite(days) || days <= 0) {
      toast.error('Enter a valid number of days');
      return;
    }

    setSubmitting(true);
    try {
      await leaveBalanceAPI.adjustBalance({
        employeeId: form.employeeId,
        leaveType: form.leaveType,
        adjustmentType: form.adjustmentType,
        days,
        reason: form.reason,
      });
      toast.success('Leave balance adjusted');
      setShowModal(false);
      setForm(EMPTY_FORM);
      fetchAdjustments();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to save adjustment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={embedded ? 'leave-adj-panel' : 'leave-adj-panel leave-adj-panel--page'}>
      <div className="lv-filter-bar" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div className="lv-search-wrap" style={{ flex: '1', minWidth: '200px', maxWidth: '360px' }}>
          <Search size={16} className="lv-search-icon" aria-hidden />
          <input
            type="search"
            className="lv-search-input"
            placeholder="Search by employee, leave type, reason…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search leave adjustments"
            style={{ paddingLeft: '32px' }}
          />
        </div>

        <div className="lv-adjust-actions">
          <button type="button" className="lv-btn-outline" onClick={fetchAdjustments} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden />
            Refresh
          </button>
          {showImport && (
            <button type="button" className="lv-btn-primary lv-btn-import" onClick={() => setShowImportModal(true)}>
              <Upload size={16} aria-hidden />
              Import history
            </button>
          )}
          <button type="button" className="lv-btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} aria-hidden />
            New adjustment
          </button>
        </div>
      </div>

      {loading ? (
        <div className="lv-audit-empty">
          <RefreshCw size={28} className="animate-spin" aria-hidden />
          <p>Loading adjustments…</p>
        </div>
      ) : filteredAdjustments.length === 0 ? (
        <div className="lv-audit-empty">
          <Users size={32} aria-hidden />
          <p>{searchTerm ? 'No matching adjustments found.' : 'No leave adjustments recorded yet.'}</p>
          <button type="button" className="lv-btn-primary" style={{ marginTop: 12 }} onClick={() => setShowModal(true)}>
            <Plus size={16} aria-hidden />
            Create first adjustment
          </button>
        </div>
      ) : (
        <div className="lv-table-wrap">
          <table className="lv-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Leave Type</th>
                <th>Type</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Adjusted By</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdjustments.map((adj, i) => (
                <tr key={adj.id || i}>
                  <td style={{ fontSize: 13 }}>
                    {adj.timestamp
                      ? new Date(adj.timestamp).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'N/A'}
                  </td>
                  <td>
                    <div className="lv-emp-name">{adj.employeeName || 'N/A'}</div>
                    <div className="lv-emp-id">{adj.employeeId || ''}</div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatLeaveTypeLabel(adj.leaveType)}</td>
                  <td>
                    <span className={`lv-adj-type ${adj.adjustmentType === 'ADDITION' ? 'addition' : 'deduction'}`}>
                      {adj.adjustmentType || 'N/A'}
                    </span>
                  </td>
                  <td className={`lv-cell-days-adj ${adj.adjustmentType === 'ADDITION' ? 'addition' : 'deduction'}`}>
                    {adj.adjustmentType === 'ADDITION' ? '+' : '-'}
                    {Math.abs(adj.daysChanged || 0)}
                  </td>
                  <td className="lv-cell-reason" style={{ maxWidth: 280, whiteSpace: 'normal', fontStyle: 'italic' }}>
                    {adj.reason || '-'}
                  </td>
                  <td>
                    <div className="lv-emp-name">{adj.performedByName || adj.performedBy || 'N/A'}</div>
                    <div className="lv-emp-id">{adj.performedRole || ''}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="lv-modal-overlay" onClick={() => !submitting && setShowModal(false)} role="presentation">
          <div
            className="lv-modal lv-modal-wide white-scrollbar"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="admin-adjust-leave-title"
          >
            <div className="lv-modal-header">
              <h2 id="admin-adjust-leave-title">Adjust leave balance</h2>
              <button
                type="button"
                className="lv-modal-close"
                onClick={() => setShowModal(false)}
                disabled={submitting}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="lv-modal-body">
                <div className="lv-form-group">
                  <label htmlFor="admin-adj-employee">Employee</label>
                  <select
                    id="admin-adj-employee"
                    value={form.employeeId}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                    required
                  >
                    <option value="">Select employee</option>
                    {employees.length === 0 && (
                      <option value="" disabled>No team employees available</option>
                    )}
                    {employees.map((emp) => {
                      const id = emp.employeeId || emp.id;
                      const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.fullName || emp.name || id;
                      return (
                        <option key={id} value={emp.employeeId || emp.id}>
                          {name} ({emp.employeeId || emp.id})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="lv-form-group">
                  <label htmlFor="admin-adj-leave-type">Leave type</label>
                  <select
                    id="admin-adj-leave-type"
                    value={form.leaveType}
                    onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
                    required
                  >
                    <option value="">Select leave type</option>
                    {leaveTypes.map((type) => (
                      <option key={type.id || type.leaveTypeCode} value={type.leaveTypeCode || type.leaveTypeName}>
                        {type.leaveTypeName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lv-form-group">
                  <label htmlFor="admin-adj-type">Adjustment type</label>
                  <select
                    id="admin-adj-type"
                    value={form.adjustmentType}
                    onChange={(e) => setForm({ ...form, adjustmentType: e.target.value })}
                    required
                  >
                    <option value="ADDITION">Addition (+)</option>
                    <option value="DEDUCTION">Deduction (-)</option>
                  </select>
                </div>

                <div className="lv-form-group">
                  <label htmlFor="admin-adj-days">Days</label>
                  <input
                    id="admin-adj-days"
                    type="number"
                    step="0.5"
                    min="0"
                    value={form.days}
                    onChange={(e) => setForm({ ...form, days: e.target.value })}
                    required
                  />
                </div>

                <div className="lv-form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label htmlFor="admin-adj-reason">Reason</label>
                    <span style={{ fontSize: 11, color: form.reason?.length >= 3000 ? '#dc2626' : '#64748b' }}>
                      {form.reason?.length || 0}/3000
                    </span>
                  </div>
                  <textarea
                    id="admin-adj-reason"
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    required
                    maxLength={3000}
                    placeholder="Reason for this adjustment"
                    rows={3}
                  />
                </div>
              </div>
              <div className="lv-modal-footer">
                <button type="button" className="lv-btn-outline" onClick={() => setShowModal(false)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="lv-btn-primary" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <LeaveHistoryImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportSuccess={() => {
            setShowImportModal(false);
            fetchAdjustments();
          }}
        />
      )}
    </div>
  );
}
