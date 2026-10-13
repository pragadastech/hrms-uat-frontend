import React, { useState, useEffect } from 'react';
import {
  Receipt, Plus, RefreshCw, Trash2, DollarSign, Calendar, X, Upload, Trash
} from 'lucide-react';
import { employeeAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import Header from '../components/Header';
import './ExpenseManagement.css';

const CATEGORIES = [
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'MEALS', label: 'Meals' },
  { value: 'ACCOMMODATION', label: 'Accommodation' },
  { value: 'OFFICE_SUPPLIES', label: 'Office Supplies' },
  { value: 'SOFTWARE', label: 'Software' },
  { value: 'COMMUNICATION', label: 'Communication' },
  { value: 'OTHER', label: 'Other' },
];

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

function formatDate(value) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

function formatAmount(amount, currency = 'INR') {
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    minimumFractionDigits: 2,
  }).format(num);
}

const emptyItem = () => ({
  category: 'OTHER',
  description: '',
  amount: '',
  expenseDate: new Date().toISOString().slice(0, 10),
  receipts: [],
});

export default function MyExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    totalAmount: '',
    currency: 'INR',
    items: [emptyItem()],
  });

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const res = await employeeAPI.getMyExpenses();
      setExpenses(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to load expenses');
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const addItem = () => {
    setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  };

  const removeItem = (index) => {
    if (form.items.length <= 1) return;
    setForm((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== index),
    }));
  };

  const updateItem = (index, field, value) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addReceipts = (index, files) => {
    const arr = Array.from(files || []);
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) => i === index ? { ...item, receipts: [...(item.receipts||[]), ...arr] } : item),
    }));
  };

  const removeReceipt = (index, fileIndex) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) => {
        if (i !== index) return item;
        const newReceipts = (item.receipts || []).filter((_, j) => j !== fileIndex);
        return { ...item, receipts: newReceipts };
      }),
    }));
  };

  const computeTotal = () => {
    let sum = 0;
    form.items.forEach((item) => {
      const n = parseFloat(item.amount);
      if (!isNaN(n)) sum += n;
    });
    return sum;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const total = computeTotal();
    if (total <= 0) {
      toast.error('Add at least one item with a positive amount.');
      return;
    }
    if (!form.title.trim()) {
      toast.error('Title is required.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        totalAmount: total,
        currency: form.currency || 'INR',
        items: form.items
          .filter((item) => item.amount && parseFloat(item.amount) > 0)
          .map((item) => ({
            category: item.category || 'OTHER',
            description: item.description || undefined,
            amount: parseFloat(item.amount),
            expenseDate: item.expenseDate || null,
          })),
      };

      const hasFiles = form.items.some(it => Array.isArray(it.receipts) && it.receipts.length > 0);
      if (hasFiles) {
        const fd = new FormData();
        fd.append('payload', JSON.stringify(payload));
        form.items.forEach((it) => {
          (it.receipts || []).forEach((file) => {
            fd.append('receipts', file, file.name);
          });
        });
        await employeeAPI.submitExpense(fd);
      } else {
        await employeeAPI.submitExpense(payload);
      }
      toast.success('Expense submitted successfully');
      setShowModal(false);
      setForm({ title: '', description: '', totalAmount: '', currency: 'INR', items: [emptyItem()] });
      fetchExpenses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit expense');
    } finally {
      setSubmitting(false);
    }
  };

  const statusConf = (s) => STATUS_CONFIG[s] || STATUS_CONFIG.SUBMITTED;

  return (
    <div className="main-content expense-page">
      <Header title="My Expenses" subtitle="Submit and track your expense requests" />

      <div className="page-content" style={{ padding: '14px 16px 20px' }}>
        <div className="expense-header-bar">
          <div>
            <h1>My Expenses</h1>
            <p className="expense-subtitle">Submit reimbursement requests and view their status</p>
          </div>
          <button
            type="button"
            className="expense-cta"
            onClick={() => {
              setForm({ title: '', description: '', totalAmount: '', currency: 'INR', items: [emptyItem()] });
              setShowModal(true);
            }}
          >
            <Plus size={18} />
            New expense
          </button>
        </div>

        {loading ? (
          <div className="expense-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="expense-skeleton expense-skeleton-card" />
            ))}
          </div>
        ) : expenses.length === 0 ? (
          <div className="expense-empty">
            <div className="expense-empty-icon">
              <Receipt size={32} />
            </div>
            <h3>No expenses yet</h3>
            <p>Submit your first expense request for reimbursement.</p>
            <button
              type="button"
              className="expense-cta"
              style={{ marginTop: 16 }}
              onClick={() => setShowModal(true)}
            >
              <Plus size={18} />
              New expense
            </button>
          </div>
        ) : (
          <div className="expense-grid">
            {expenses.map((exp) => {
              const status = statusConf(exp.status);
              return (
                <div key={exp.id} className="expense-card">
                  <h3 className="expense-card-title">{exp.title || 'Untitled'}</h3>
                  {exp.description && (
                    <p className="expense-card-meta">{exp.description}</p>
                  )}
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
                    Submitted {formatDate(exp.submittedAt)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div
          className="expense-modal-overlay"
          onClick={() => !submitting && setShowModal(false)}
        >
          <div className="expense-modal expense-modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="expense-modal-header expense-modal-header--split">
              <h2>New expense request</h2>
              <button type="button" className="expense-modal-close" onClick={() => setShowModal(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form className="expense-modal-form" onSubmit={handleSubmit}>
            <div className="expense-modal-body expense-modal-body--padded">
                <div className="expense-form-row-top">
                  <div className="expense-field expense-field--flex-2">
                    <label>Title *</label>
                    <input
                      type="text"
                      required
                      className="expense-form-control"
                      placeholder="e.g. Client visit - Mumbai"
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    />
                  </div>
                  <div className="expense-field expense-field--flex-1">
                    <label>Currency</label>
                    <select
                      className="expense-form-control"
                      value={form.currency}
                      onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                  <div className="expense-field expense-field--flex-1">
                    <label>Total Amount</label>
                    <div className="expense-form-control expense-total-display">
                      {formatAmount(computeTotal(), form.currency)}
                    </div>
                  </div>
                </div>

                <div className="expense-field" style={{ marginBottom: '14px' }}>
                  <label>Description (optional)</label>
                  <textarea
                    className="expense-form-control"
                    placeholder="Brief description of the overall expense"
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>

                <div className="expense-items-block">
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', marginBottom: '10px' }}>Line Items</h4>
                  
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr 1fr 1fr 1fr 40px', gap: '0', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <div style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Category</div>
                      <div style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderLeft: '1px solid #e2e8f0' }}>Description</div>
                      <div style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderLeft: '1px solid #e2e8f0' }}>Amount</div>
                      <div style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderLeft: '1px solid #e2e8f0' }}>Date</div>
                      <div style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderLeft: '1px solid #e2e8f0' }}>Receipts</div>
                      <div style={{ borderLeft: '1px solid #e2e8f0' }}></div>
                    </div>
                    
                    <div>
                      {form.items.map((item, index) => (
                        <div key={index} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr 1fr 1fr 1fr 40px', gap: '0', borderBottom: index === form.items.length - 1 ? 'none' : '1px solid #e2e8f0', alignItems: 'stretch' }}>
                          <div style={{ padding: '10px' }}>
                            <select
                              className="expense-form-control"
                              value={item.category}
                              onChange={(e) => updateItem(index, 'category', e.target.value)}
                              style={{ padding: '8px', borderRadius: '8px', fontSize: '13px', minHeight: '34px' }}
                            >
                              {CATEGORIES.map((c) => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ padding: '10px', borderLeft: '1px solid #f1f5f9' }}>
                            <input
                              type="text"
                              className="expense-form-control"
                              placeholder="Describe item..."
                              value={item.description}
                              onChange={(e) => updateItem(index, 'description', e.target.value)}
                              style={{ padding: '8px', borderRadius: '8px', fontSize: '13px', minHeight: '34px' }}
                            />
                          </div>
                          <div style={{ padding: '10px', borderLeft: '1px solid #f1f5f9' }}>
                            <div style={{ position: 'relative' }}>
                              <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>{form.currency === 'INR' ? '₹' : '$'}</span>
                              <input
                                type="number"
                                className="expense-form-control"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={item.amount}
                                onChange={(e) => updateItem(index, 'amount', e.target.value)}
                                style={{ padding: '8px 8px 8px 22px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, minHeight: '34px' }}
                              />
                            </div>
                          </div>
                          <div style={{ padding: '10px', borderLeft: '1px solid #f1f5f9' }}>
                            <input
                              type="date"
                              className="expense-form-control"
                              value={item.expenseDate}
                              onChange={(e) => updateItem(index, 'expenseDate', e.target.value)}
                              style={{ padding: '7px 8px', borderRadius: '8px', fontSize: '13px', minHeight: '34px' }}
                            />
                          </div>
                          <div style={{ padding: '10px', borderLeft: '1px solid #f1f5f9' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px', borderRadius: '8px', border: '1px dashed #cbd5e1', cursor: 'pointer', fontSize: '11px', color: '#64748b', justifyContent: 'center', minHeight: '34px', boxSizing: 'border-box' }}>
                              <Upload size={14} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.receipts?.length > 0 ? `${item.receipts.length} Files` : 'Upload'}</span>
                              <input
                                type="file"
                                multiple
                                onChange={(e) => addReceipts(index, e.target.files)}
                                style={{ display: 'none' }}
                              />
                            </label>
                          </div>
                          <div style={{ padding: '10px', borderLeft: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                              title="Remove item"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={addItem}
                    style={{ marginTop: '16px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, background: 'white', border: '1.5px solid var(--expense-primary)', borderRadius: '10px', color: 'var(--expense-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Plus size={16} /> Add Another Item
                  </button>
                </div>

            </div>
            <div className="expense-modal-footer">
              <button
                type="button"
                className="expense-btn-secondary expense-btn-footer"
                onClick={() => !submitting && setShowModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="expense-btn-primary expense-btn-footer"
                disabled={submitting}
              >
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
