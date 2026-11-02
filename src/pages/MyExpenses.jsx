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
          style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '820px',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden',
              borderRadius: '16px',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.2)',
              border: '1px solid var(--gray-10)'
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-10)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--white-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', borderRadius: '10px' }}>
                  <Receipt size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--dark-500)', margin: 0, lineHeight: 1.2 }}>
                    New Expense Request
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--gray-500)', margin: '2px 0 0 0' }}>
                    Submit itemized expenses and attach corresponding receipts
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !submitting && setShowModal(false)}
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
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form & Body */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, margin: 0 }}>
              <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                
                {/* Top Info Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--dark-500)', marginBottom: '4px' }}>
                      Title *
                    </label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      style={{ width: '100%', height: '36px', boxSizing: 'border-box', fontSize: '12px' }}
                      placeholder="e.g. Client visit - Mumbai"
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--dark-500)', marginBottom: '4px' }}>
                      Currency
                    </label>
                    <select
                      className="form-input"
                      style={{ width: '100%', height: '36px', boxSizing: 'border-box', fontSize: '12px' }}
                      value={form.currency}
                      onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Total Amount
                    </label>
                    <div style={{
                      height: '36px',
                      background: 'var(--light-5, #f8fafc)',
                      border: '1px solid var(--gray-10)',
                      borderRadius: '8px',
                      padding: '0 12px',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '1.05rem',
                      fontWeight: '700',
                      color: 'var(--primary-600)',
                      boxSizing: 'border-box'
                    }}>
                      {formatAmount(computeTotal(), form.currency)}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--dark-500)', marginBottom: '4px' }}>
                    Description (optional)
                  </label>
                  <textarea
                    className="form-input"
                    placeholder="Brief description or purpose of the overall expense..."
                    rows={2}
                    style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box', fontSize: '12px', minHeight: '52px' }}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>

                {/* Line Items Table */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--dark-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Line Items ({form.items.length})
                    </div>
                    <button
                      type="button"
                      onClick={addItem}
                      className="btn-secondary"
                      style={{ height: '28px', padding: '0 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--primary-600)' }}
                    >
                      <Plus size={13} /> Add Item
                    </button>
                  </div>

                  <div style={{ border: '1px solid var(--gray-10)', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '130px 1.8fr 110px 125px 105px 36px', gap: 0, background: 'var(--light-5, #f8fafc)', borderBottom: '1px solid var(--gray-10)', fontSize: '11px', fontWeight: '700', color: 'var(--gray-500)', textTransform: 'uppercase' }}>
                      <div style={{ padding: '8px 10px' }}>Category</div>
                      <div style={{ padding: '8px 10px', borderLeft: '1px solid var(--gray-10)' }}>Description</div>
                      <div style={{ padding: '8px 10px', borderLeft: '1px solid var(--gray-10)' }}>Amount</div>
                      <div style={{ padding: '8px 10px', borderLeft: '1px solid var(--gray-10)' }}>Date</div>
                      <div style={{ padding: '8px 10px', borderLeft: '1px solid var(--gray-10)' }}>Receipts</div>
                      <div style={{ borderLeft: '1px solid var(--gray-10)' }}></div>
                    </div>

                    <div>
                      {form.items.map((item, index) => (
                        <div
                          key={index}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '130px 1.8fr 110px 125px 105px 36px',
                            gap: 0,
                            borderBottom: index === form.items.length - 1 ? 'none' : '1px solid var(--gray-5)',
                            alignItems: 'center',
                            background: '#fff'
                          }}
                        >
                          {/* Category */}
                          <div style={{ padding: '6px 8px' }}>
                            <select
                              className="form-input"
                              value={item.category}
                              onChange={(e) => updateItem(index, 'category', e.target.value)}
                              style={{ width: '100%', height: '30px', padding: '0 6px', fontSize: '11px', borderRadius: '6px' }}
                            >
                              {CATEGORIES.map((c) => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Description */}
                          <div style={{ padding: '6px 8px', borderLeft: '1px solid var(--gray-5)' }}>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Describe item..."
                              value={item.description}
                              onChange={(e) => updateItem(index, 'description', e.target.value)}
                              style={{ width: '100%', height: '30px', padding: '0 8px', fontSize: '11px', borderRadius: '6px' }}
                            />
                          </div>

                          {/* Amount */}
                          <div style={{ padding: '6px 8px', borderLeft: '1px solid var(--gray-5)' }}>
                            <div style={{ position: 'relative' }}>
                              <span style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--gray-400)', fontWeight: '600' }}>
                                {form.currency === 'INR' ? '₹' : '$'}
                              </span>
                              <input
                                type="number"
                                className="form-input"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={item.amount}
                                onChange={(e) => updateItem(index, 'amount', e.target.value)}
                                style={{ width: '100%', height: '30px', padding: '0 6px 0 18px', fontSize: '11px', fontWeight: '600', borderRadius: '6px' }}
                              />
                            </div>
                          </div>

                          {/* Date */}
                          <div style={{ padding: '6px 8px', borderLeft: '1px solid var(--gray-5)' }}>
                            <input
                              type="date"
                              className="form-input"
                              value={item.expenseDate}
                              onChange={(e) => updateItem(index, 'expenseDate', e.target.value)}
                              style={{ width: '100%', height: '30px', padding: '0 6px', fontSize: '11px', borderRadius: '6px' }}
                            />
                          </div>

                          {/* Upload Receipts */}
                          <div style={{ padding: '6px 8px', borderLeft: '1px solid var(--gray-5)' }}>
                            <label
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '0 6px',
                                height: '30px',
                                borderRadius: '6px',
                                border: '1px dashed var(--gray-20, #cbd5e1)',
                                cursor: 'pointer',
                                fontSize: '11px',
                                color: item.receipts?.length > 0 ? 'var(--primary-600)' : 'var(--gray-500)',
                                background: item.receipts?.length > 0 ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                                justifyContent: 'center',
                                boxSizing: 'border-box'
                              }}
                              title="Upload receipt files (images or PDFs)"
                            >
                              <Upload size={12} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65px' }}>
                                {item.receipts?.length > 0 ? `${item.receipts.length} File${item.receipts.length > 1 ? 's' : ''}` : 'Upload'}
                              </span>
                              <input
                                type="file"
                                multiple
                                onChange={(e) => addReceipts(index, e.target.files)}
                                style={{ display: 'none' }}
                              />
                            </label>
                          </div>

                          {/* Remove row */}
                          <div style={{ padding: '6px 4px', borderLeft: '1px solid var(--gray-5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              disabled={form.items.length <= 1}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: form.items.length <= 1 ? 'var(--gray-300)' : '#dc2626',
                                cursor: form.items.length <= 1 ? 'not-allowed' : 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Remove item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer Actions */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gray-10)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--white-5)' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => !submitting && setShowModal(false)}
                  style={{ height: '34px', padding: '0 16px', fontSize: '12px' }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                  style={{ height: '34px', padding: '0 18px', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {submitting && <RefreshCw size={13} className="animate-spin" />}
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
