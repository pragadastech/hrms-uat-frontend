import React, { useState, useEffect } from 'react';
import {
  Receipt, RefreshCw, CheckCircle, XCircle, Eye, Calendar, User, X
} from 'lucide-react';
import { teamAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import Header from '../components/Header';
import './ExpenseManagement.css';

const STATUS_CONFIG = {
  SUBMITTED: { label: 'Pending Manager', color: '#2563EB', bg: '#DBEAFE' },
  MANAGER_APPROVED: { label: 'Manager Approved', color: '#059669', bg: '#D1FAE5' },
  FINANCE_APPROVED: { label: 'Finance Approved', color: '#7C3AED', bg: '#EDE9FE' },
  FINAL_APPROVED: { label: 'Final Approved', color: '#059669', bg: '#D1FAE5' },
  APPROVED: { label: 'Approved', color: '#059669', bg: '#D1FAE5' },
  REJECTED: { label: 'Rejected', color: '#DC2626', bg: '#FEE2E2' },
  DRAFT: { label: 'Draft', color: '#6B7280', bg: '#F3F4F6' },
  CANCELLED: { label: 'Cancelled', color: '#6B7280', bg: '#F3F4F6' },
};

const CATEGORY_LABELS = {
  TRAVEL: 'Travel',
  MEALS: 'Meals',
  ACCOMMODATION: 'Accommodation',
  OFFICE_SUPPLIES: 'Office Supplies',
  SOFTWARE: 'Software',
  COMMUNICATION: 'Communication',
  OTHER: 'Other',
};

function formatDate(value) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

function formatAmount(amount, currency = 'INR') {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function ManagerExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('SUBMITTED');
  const [detailExpense, setDetailExpense] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const res = await teamAPI.getTeamExpenses();
      setExpenses(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load team expenses');
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const filtered = expenses.filter(
    (e) => filterStatus === 'ALL' || e.status === filterStatus
  );

  const stats = {
    pending: expenses.filter((e) => e.status === 'SUBMITTED').length,
    approved: expenses.filter((e) => e.status === 'MANAGER_APPROVED').length,
    rejected: expenses.filter((e) => e.status === 'REJECTED').length,
  };

  const handleApprove = async (id) => {
    try {
      await teamAPI.approveTeamExpense(id);
      toast.success('Expense approved and sent to finance');
      setDetailExpense(null);
      fetchExpenses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve');
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    try {
      await teamAPI.rejectTeamExpense(rejectModal.id, rejectReason);
      toast.success('Expense rejected');
      setRejectModal(null);
      setRejectReason('');
      setDetailExpense(null);
      fetchExpenses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject');
    }
  };

  const statusConf = (s) => STATUS_CONFIG[s] || STATUS_CONFIG.SUBMITTED;

  return (
    <div className="main-content expense-page">
      <Header title="Team Expenses" subtitle="Review and approve your team expenses" />

      <div className="page-content" style={{ padding: '14px 16px 20px' }}>
        <div className="expense-header-bar">
          <div>
            <h1>Team Expenses</h1>
            <p className="expense-subtitle">Approve or reject submitted expenses</p>
          </div>
          <button type="button" className="expense-cta" onClick={fetchExpenses} disabled={loading}>
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>

        <div className="expense-stats">
          <div className="expense-stat-card">
            <div className="stat-label">Pending</div>
            <div className="stat-value">{stats.pending}</div>
          </div>
          <div className="expense-stat-card">
            <div className="stat-label">Manager approved</div>
            <div className="stat-value">{stats.approved}</div>
          </div>
          <div className="expense-stat-card">
            <div className="stat-label">Rejected</div>
            <div className="stat-value">{stats.rejected}</div>
          </div>
        </div>

        <div className="expense-toolbar">
          <select
            className="expense-filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="ALL">All statuses</option>
            {Object.entries(STATUS_CONFIG).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="expense-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="expense-skeleton expense-skeleton-card" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="expense-empty">
            <div className="expense-empty-icon">
              <Receipt size={32} />
            </div>
            <h3>No expenses found</h3>
            <p>
              {expenses.length === 0
                ? 'No expense requests have been submitted yet.'
                : 'No expenses match the selected filter.'}
            </p>
          </div>
        ) : (
          <div className="expense-grid">
            {filtered.map((exp) => {
              const status = statusConf(exp.status);
              return (
                <div key={exp.id} className="expense-card">
                  <h3 className="expense-card-title">{exp.title || 'Untitled'}</h3>
                  <p className="expense-card-meta">
                    <User size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    {exp.employeeName} ({exp.employeeEmployeeId})
                  </p>
                  <div className="expense-card-amount">
                    {formatAmount(exp.totalAmount, exp.currency)}
                  </div>
                  <span
                    className="expense-card-status"
                    style={{ background: status.bg, color: status.color }}
                  >
                    {status.label}
                  </span>
                  <p className="expense-card-meta" style={{ marginBottom: 0 }}>
                    <Calendar size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    {formatDate(exp.submittedAt)}
                  </p>
                  <div className="expense-card-actions">
                    <button
                      type="button"
                      className="expense-btn-secondary"
                      style={{ flex: 0 }}
                      onClick={() => setDetailExpense(exp)}
                      title="View details"
                    >
                      <Eye size={16} />
                    </button>
                    {exp.status === 'SUBMITTED' && (
                      <>
                        <button
                          type="button"
                          className="expense-btn-approve"
                          onClick={() => handleApprove(exp.id)}
                        >
                          <CheckCircle size={16} /> Approve
                        </button>
                        <button
                          type="button"
                          className="expense-btn-reject"
                          onClick={() => setRejectModal(exp)}
                        >
                          <XCircle size={16} /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detailExpense && (
        <div
          className="expense-modal-overlay"
          onClick={() => setDetailExpense(null)}
        >
          <div className="expense-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="expense-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>{detailExpense.title || 'Expense details'}</h2>
              <button 
                type="button" 
                className="expense-modal-close" 
                onClick={() => setDetailExpense(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--expense-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="expense-modal-body">
              <div className="expense-detail-section">
                <h4>Employee</h4>
                <p>{detailExpense.employeeName} ({detailExpense.employeeEmployeeId})</p>
              </div>
              <div className="expense-detail-section">
                <h4>Amount</h4>
                <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--expense-primary)' }}>
                  {formatAmount(detailExpense.totalAmount, detailExpense.currency)}
                </p>
              </div>
              <div className="expense-detail-section">
                <h4>Status</h4>
                <span
                  className="expense-card-status"
                  style={{ background: statusConf(detailExpense.status).bg, color: statusConf(detailExpense.status).color }}
                >
                  {statusConf(detailExpense.status).label}
                </span>
              </div>
              {detailExpense.description && (
                <div className="expense-detail-section">
                  <h4>Description</h4>
                  <p>{detailExpense.description}</p>
                </div>
              )}
              {detailExpense.items && detailExpense.items.length > 0 && (
                <div className="expense-detail-section expense-detail-items">
                  <h4>Line items</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Description</th>
                        <th>Date</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailExpense.items.map((item, i) => (
                        <tr key={i}>
                          <td>{CATEGORY_LABELS[item.category] || item.category}</td>
                          <td>{item.description || '—'}</td>
                          <td>{formatDate(item.expenseDate)}</td>
                          <td>{formatAmount(item.amount, detailExpense.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {detailExpense.receipts && detailExpense.receipts.length > 0 && (
                <div className="expense-detail-section">
                  <h4>Receipts</h4>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {detailExpense.receipts.map((r, i) => {
                      const url = (r && r.url) ? r.url : r;
                      const isImage = typeof url === 'string' && url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                      return (
                        <a key={i} href={url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', width: 96, textAlign: 'center', textDecoration: 'none', color: 'inherit' }}>
                          {isImage ? (
                            <img src={url} alt={`receipt-${i}`} style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--expense-border)' }} />
                          ) : (
                            <div style={{ width: 96, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid var(--expense-border)', background: 'var(--expense-surface)' }}>
                              <span style={{ fontSize: 12 }}>View</span>
                            </div>
                          )}
                          <div style={{ fontSize: 12, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(url || '').split('/').pop()}</div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
              {detailExpense.rejectionReason && (
                <div className="expense-detail-section">
                  <h4>Rejection reason</h4>
                  <p style={{ color: '#dc2626' }}>{detailExpense.rejectionReason}</p>
                </div>
              )}
              <div className="expense-modal-actions">
                <button
                  type="button"
                  className="expense-btn-secondary"
                  onClick={() => setDetailExpense(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div
          className="expense-modal-overlay"
          onClick={() => setRejectModal(null)}
        >
          <div className="expense-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="expense-modal-header">
              <h2>Reject expense</h2>
            </div>
            <div className="expense-modal-body">
              <p className="expense-card-meta" style={{ marginBottom: 12 }}>
                Reject &quot;{rejectModal.title}&quot; by {rejectModal.employeeName}?
              </p>
              <div className="expense-field">
                <label htmlFor="reject-reason">Reason (optional)</label>
                <textarea
                  id="reject-reason"
                  rows={3}
                  placeholder="Provide a reason for rejection"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
              <div className="expense-modal-actions">
                <button
                  type="button"
                  className="expense-btn-secondary"
                  onClick={() => { setRejectModal(null); setRejectReason(''); }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="expense-btn-reject"
                  style={{ flex: 1 }}
                  onClick={handleReject}
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
