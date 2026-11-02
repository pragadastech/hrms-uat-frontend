import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt, RefreshCw, CheckCircle, XCircle, Eye, Calendar, User, X,
  Search, Clock, ShieldCheck, DollarSign
} from 'lucide-react';
import { teamAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import Header from '../components/Header';
import './ExpenseManagement.css';

const STATUS_CONFIG = {
  SUBMITTED: { label: 'Pending Manager', color: '#b45309', bg: 'rgba(245, 158, 11, 0.1)', icon: <Clock size={12} /> },
  MANAGER_APPROVED: { label: 'Manager Approved', color: '#059669', bg: 'rgba(16, 185, 129, 0.1)', icon: <CheckCircle size={12} /> },
  FINANCE_APPROVED: { label: 'Finance Approved', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.1)', icon: <ShieldCheck size={12} /> },
  FINAL_APPROVED: { label: 'Approved', color: '#059669', bg: 'rgba(16, 185, 129, 0.1)', icon: <CheckCircle size={12} /> },
  APPROVED: { label: 'Approved', color: '#059669', bg: 'rgba(16, 185, 129, 0.1)', icon: <CheckCircle size={12} /> },
  REJECTED: { label: 'Rejected', color: '#dc2626', bg: 'rgba(239, 68, 68, 0.1)', icon: <XCircle size={12} /> },
  DRAFT: { label: 'Draft', color: 'var(--gray-500)', bg: 'var(--gray-50)', icon: null },
  CANCELLED: { label: 'Cancelled', color: 'var(--gray-500)', bg: 'var(--gray-50)', icon: null },
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
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return String(value);
  }
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
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [detailExpense, setDetailExpense] = useState(null);
  const [approveModal, setApproveModal] = useState(null);
  const [approveComment, setApproveComment] = useState('');
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const monthInputRef = React.useRef(null);

  const fetchExpenses = async (monthOverride) => {
    try {
      setLoading(true);
      const monthToFetch = monthOverride !== undefined ? monthOverride : selectedMonth;
      const res = await teamAPI.getTeamExpenses(null, monthToFetch || undefined);
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
    fetchExpenses(selectedMonth);
  }, [selectedMonth]);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      const matchesStatus = filterStatus === 'ALL' || e.status === filterStatus;
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch = !term ||
        (e.title && e.title.toLowerCase().includes(term)) ||
        (e.employeeName && e.employeeName.toLowerCase().includes(term)) ||
        (e.employeeEmployeeId && e.employeeEmployeeId.toLowerCase().includes(term));
      return matchesStatus && matchesSearch;
    });
  }, [expenses, filterStatus, searchTerm]);

  const stats = useMemo(() => {
    const total = expenses.length;
    const pending = expenses.filter((e) => e.status === 'SUBMITTED').length;
    const approved = expenses.filter((e) => e.status === 'MANAGER_APPROVED' || e.status === 'APPROVED' || e.status === 'FINAL_APPROVED').length;
    const rejected = expenses.filter((e) => e.status === 'REJECTED').length;
    return { total, pending, approved, rejected };
  }, [expenses]);

  const handleApprove = async () => {
    if (!approveModal) return;
    try {
      await teamAPI.approveTeamExpense(approveModal.id);
      toast.success('Expense approved and forwarded to finance');
      setApproveModal(null);
      setApproveComment('');
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
    <div className="main-content">
      <Header title="Team Expenses" subtitle="Review and approve your team's expense claims" />

      <div className="page-content" style={{ padding: '14px 16px 20px' }}>
        
        {/* KPI Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px', marginBottom: '14px' }}>
          <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
            <div style={{ padding: '8px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', borderRadius: '10px' }}>
              <Receipt size={18} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--gray-500)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Requests</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--dark-500)', lineHeight: 1.2 }}>{stats.total}</div>
            </div>
          </div>

          <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
            <div style={{ padding: '8px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderRadius: '10px' }}>
              <Clock size={18} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--gray-500)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pending Review</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--dark-500)', lineHeight: 1.2 }}>{stats.pending}</div>
            </div>
          </div>

          <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
            <div style={{ padding: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '10px' }}>
              <CheckCircle size={18} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--gray-500)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Approved</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--dark-500)', lineHeight: 1.2 }}>{stats.approved}</div>
            </div>
          </div>

          <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
            <div style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '10px' }}>
              <XCircle size={18} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--gray-500)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Rejected</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--dark-500)', lineHeight: 1.2 }}>{stats.rejected}</div>
            </div>
          </div>
        </div>

        {/* Toolbar Filter */}
        <div className="card" style={{ padding: '8px 12px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap', margin: '0 0 14px 0', overflowX: 'auto' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '180px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input
              type="search"
              placeholder="Search by title, employee..."
              className="form-input"
              style={{ paddingLeft: '30px', height: '32px', fontSize: '12px', width: '100%' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div 
            className="expense-date-wrap" 
            title="Filter by month"
            style={{ height: '32px', borderRadius: '8px', padding: '0 8px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--white-5)', border: '1px solid var(--expense-border)', flexShrink: 0 }}
            onClick={() => {
              try {
                monthInputRef.current?.showPicker();
              } catch (e) {
                monthInputRef.current?.focus();
              }
            }}
          >
            <Calendar size={13} style={{ color: 'var(--primary-600)', cursor: 'pointer', flexShrink: 0 }} />
            <input
              ref={monthInputRef}
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              aria-label="Filter by month"
              style={{ fontSize: '12px' }}
            />
            {selectedMonth && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMonth('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  color: 'var(--gray-400)',
                  marginLeft: '2px'
                }}
                title="Clear month filter"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <select
            className="form-input"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ height: '32px', fontSize: '12px', minWidth: '135px', width: 'auto', flexShrink: 0 }}
            aria-label="Filter by status"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUBMITTED">Pending Manager</option>
            <option value="MANAGER_APPROVED">Manager Approved</option>
            <option value="FINANCE_APPROVED">Finance Approved</option>
            <option value="FINAL_APPROVED">Final Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <button 
            type="button" 
            className="btn-secondary" 
            onClick={() => fetchExpenses()} 
            disabled={loading}
            style={{ height: '32px', padding: '0 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Expenses Content */}
        {loading && expenses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 16px' }}>
            <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--primary-600)', margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--gray-500)', fontSize: '13px' }}>Loading team expenses...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '36px 16px', borderStyle: 'dashed' }}>
            <Receipt size={40} style={{ color: 'var(--gray-300)', margin: '0 auto 12px' }} />
            <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--dark-500)', marginBottom: '4px' }}>
              {expenses.length === 0 ? 'No expense requests found' : 'No matching expenses'}
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--gray-500)', maxWidth: '320px', margin: '0 auto' }}>
              {expenses.length === 0
                ? 'No team expense claims have been submitted yet.'
                : 'Try adjusting your search terms or status filter.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
            {filtered.map((exp) => {
              const status = statusConf(exp.status);
              return (
                <div key={exp.id} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', margin: 0, borderLeft: `4px solid ${status.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--dark-500)', margin: 0, flex: 1, lineHeight: 1.3 }}>
                      {exp.title || 'Untitled Expense'}
                    </h3>
                    <span
                      style={{
                        background: status.bg,
                        color: status.color,
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: '700',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0
                      }}
                    >
                      {status.icon}
                      {status.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--gray-600)', marginBottom: '8px' }}>
                    <User size={13} style={{ color: 'var(--gray-400)' }} />
                    <span><strong>{exp.employeeName || 'Unknown'}</strong> {exp.employeeEmployeeId ? `(${exp.employeeEmployeeId})` : ''}</span>
                  </div>

                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary-600)', marginBottom: '8px' }}>
                    {formatAmount(exp.totalAmount, exp.currency)}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--gray-400)', marginTop: 'auto', marginBottom: '12px' }}>
                    <Calendar size={13} />
                    <span>Submitted {formatDate(exp.submittedAt || exp.createdAt)}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--gray-10)' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ flex: 1, height: '32px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={() => setDetailExpense(exp)}
                    >
                      <Eye size={14} /> Details
                    </button>
                    {exp.status === 'SUBMITTED' && (
                      <>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ height: '32px', padding: '0 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#059669', borderColor: '#059669' }}
                          onClick={() => setApproveModal(exp)}
                        >
                          <CheckCircle size={14} /> Approve
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ height: '32px', padding: '0 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#dc2626', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                          onClick={() => setRejectModal(exp)}
                        >
                          <XCircle size={14} /> Reject
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

      {/* Redesigned Detail Modal */}
      {detailExpense && (
        <div
          className="expense-modal-overlay"
          onClick={() => setDetailExpense(null)}
          style={{ background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '580px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden',
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.18)',
              border: '1px solid var(--gray-10)'
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-10)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--white-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', borderRadius: '10px' }}>
                  <Receipt size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--dark-500)', margin: 0, lineHeight: 1.3 }}>
                    {detailExpense.title || 'Expense Details'}
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <User size={12} />
                    <span>{detailExpense.employeeName} {detailExpense.employeeEmployeeId ? `(${detailExpense.employeeEmployeeId})` : ''}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDetailExpense(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '8px',
                  color: 'var(--gray-400)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Top Overview Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ background: 'var(--light-5, #f8fafc)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--gray-10)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: '2px' }}>Amount</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--primary-600)' }}>
                    {formatAmount(detailExpense.totalAmount, detailExpense.currency)}
                  </div>
                </div>

                <div style={{ background: 'var(--light-5, #f8fafc)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--gray-10)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: '2px' }}>Submitted</div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--dark-500)', marginTop: '2px' }}>
                    {formatDate(detailExpense.submittedAt || detailExpense.createdAt)}
                  </div>
                </div>

                <div style={{ background: 'var(--light-5, #f8fafc)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--gray-10)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: '4px' }}>Status</div>
                  <span
                    style={{
                      background: statusConf(detailExpense.status).bg,
                      color: statusConf(detailExpense.status).color,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: '700',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {statusConf(detailExpense.status).icon}
                    {statusConf(detailExpense.status).label}
                  </span>
                </div>
              </div>

              {/* Description */}
              {detailExpense.description && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                    Description
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--gray-700, #334155)', background: 'var(--light-5, #f8fafc)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--gray-10)', lineHeight: 1.45 }}>
                    {detailExpense.description}
                  </div>
                </div>
              )}

              {/* Expense Items Breakdown */}
              {detailExpense.items && detailExpense.items.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                    Expense Items ({detailExpense.items.length})
                  </div>
                  <div style={{ border: '1px solid var(--gray-10)', borderRadius: '10px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'var(--light-5, #f8fafc)', borderBottom: '1px solid var(--gray-10)', color: 'var(--gray-500)', fontSize: '11px', textTransform: 'uppercase', fontWeight: '700' }}>
                          <th style={{ padding: '8px 12px' }}>Category</th>
                          <th style={{ padding: '8px 12px' }}>Description</th>
                          <th style={{ padding: '8px 12px' }}>Date</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailExpense.items.map((item, i) => (
                          <tr key={i} style={{ borderBottom: i === detailExpense.items.length - 1 ? 'none' : '1px solid var(--gray-5)' }}>
                            <td style={{ padding: '10px 12px', fontWeight: '600', color: 'var(--dark-500)' }}>
                              {CATEGORY_LABELS[item.category] || item.category}
                            </td>
                            <td style={{ padding: '10px 12px', color: 'var(--gray-600)' }}>
                              {item.description || '—'}
                            </td>
                            <td style={{ padding: '10px 12px', color: 'var(--gray-500)' }}>
                              {formatDate(item.expenseDate)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: 'var(--primary-600)' }}>
                              {formatAmount(item.amount, detailExpense.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Receipts Preview */}
              {detailExpense.receipts && detailExpense.receipts.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                    Attached Receipts ({detailExpense.receipts.length})
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {detailExpense.receipts.map((r, i) => {
                      const url = (r && r.url) ? r.url : r;
                      const isImage = typeof url === 'string' && url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                      return (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            width: '100px',
                            textDecoration: 'none',
                            color: 'inherit',
                            padding: '6px',
                            borderRadius: '10px',
                            border: '1px solid var(--gray-10)',
                            background: 'var(--light-5, #f8fafc)'
                          }}
                        >
                          {isImage ? (
                            <img src={url} alt={`receipt-${i}`} style={{ width: '88px', height: '64px', objectFit: 'cover', borderRadius: '6px' }} />
                          ) : (
                            <div style={{ width: '88px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', background: 'var(--white-5)', color: 'var(--primary-600)', fontSize: '12px', fontWeight: '600' }}>
                              📄 View File
                            </div>
                          )}
                          <span style={{ fontSize: '10px', marginTop: '4px', maxWidth: '88px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--gray-500)' }}>
                            {(r?.originalFileName || (url || '').split('/').pop())}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Rejection Reason */}
              {detailExpense.rejectionReason && (
                <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '10px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#dc2626', textTransform: 'uppercase', marginBottom: '2px' }}>
                    Rejection Reason
                  </div>
                  <p style={{ fontSize: '12px', color: '#991b1b', margin: 0, lineHeight: 1.4 }}>
                    {detailExpense.rejectionReason}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gray-10)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--white-5)' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDetailExpense(null)}
                style={{ height: '34px', padding: '0 16px', fontSize: '12px' }}
              >
                Close
              </button>

              {detailExpense.status === 'SUBMITTED' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setRejectModal(detailExpense);
                    }}
                    style={{ height: '34px', padding: '0 14px', fontSize: '12px', color: '#dc2626', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                  >
                    <XCircle size={14} style={{ marginRight: '4px' }} /> Reject
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setApproveModal(detailExpense)}
                    style={{ height: '34px', padding: '0 16px', fontSize: '12px', background: '#059669', borderColor: '#059669' }}
                  >
                    <CheckCircle size={14} style={{ marginRight: '4px' }} /> Approve
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approve Confirmation Modal */}
      {approveModal && (
        <div
          className="expense-modal-overlay"
          onClick={() => { setApproveModal(null); setApproveComment(''); }}
          style={{ background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '440px', padding: 0, overflow: 'hidden', borderRadius: '16px', border: '1px solid var(--gray-10)', boxShadow: '0 24px 48px rgba(0, 0, 0, 0.22)' }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-10)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--white-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', background: 'rgba(16, 185, 129, 0.12)', color: '#059669', borderRadius: '10px' }}>
                  <CheckCircle size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--dark-500)', margin: 0 }}>Approve Expense</h3>
                  <p style={{ fontSize: '12px', color: 'var(--gray-500)', margin: '2px 0 0 0' }}>
                    Forward claim to finance for payout
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setApproveModal(null); setApproveComment(''); }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '16px 20px' }}>
              <div style={{ background: 'var(--light-5, #f8fafc)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--gray-10)', marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--dark-500)', marginBottom: '4px' }}>
                  {approveModal.title || 'Untitled Expense'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--gray-600)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{approveModal.employeeName}</span>
                  <span style={{ fontWeight: '700', color: 'var(--primary-600)' }}>
                    {formatAmount(approveModal.totalAmount, approveModal.currency)}
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--dark-500)', marginBottom: '4px' }}>
                  Comments (optional)
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box', fontSize: '12px' }}
                  placeholder="Add an approval note or remark for finance..."
                  value={approveComment}
                  onChange={(e) => setApproveComment(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setApproveModal(null); setApproveComment(''); }}
                  style={{ height: '34px', padding: '0 14px', fontSize: '12px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleApprove}
                  style={{ height: '34px', padding: '0 16px', fontSize: '12px', background: '#059669', borderColor: '#059669' }}
                >
                  Confirm Approval
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div
          className="expense-modal-overlay"
          onClick={() => { setRejectModal(null); setRejectReason(''); }}
          style={{ background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '440px', padding: 0, overflow: 'hidden', borderRadius: '16px', border: '1px solid var(--gray-10)', boxShadow: '0 24px 48px rgba(0, 0, 0, 0.22)' }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-10)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--white-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', borderRadius: '10px' }}>
                  <XCircle size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--dark-500)', margin: 0 }}>Reject Expense</h3>
                  <p style={{ fontSize: '12px', color: 'var(--gray-500)', margin: '2px 0 0 0' }}>
                    Decline this submitted claim
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '16px 20px' }}>
              <div style={{ background: 'var(--light-5, #f8fafc)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--gray-10)', marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--dark-500)', marginBottom: '4px' }}>
                  {rejectModal.title || 'Untitled Expense'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--gray-600)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{rejectModal.employeeName}</span>
                  <span style={{ fontWeight: '700', color: 'var(--primary-600)' }}>
                    {formatAmount(rejectModal.totalAmount, rejectModal.currency)}
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--dark-500)', marginBottom: '4px' }}>
                  Reason (optional)
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box', fontSize: '12px' }}
                  placeholder="Provide a reason for rejection..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setRejectModal(null); setRejectReason(''); }}
                  style={{ height: '34px', padding: '0 14px', fontSize: '12px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleReject}
                  style={{ height: '34px', padding: '0 16px', fontSize: '12px', background: '#dc2626', borderColor: '#dc2626' }}
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
