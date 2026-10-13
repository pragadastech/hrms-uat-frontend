import React, { useState, useEffect, useMemo } from 'react';
import {
    MessageSquare, Plus, AlertCircle, CheckCircle, Clock,
    XCircle, Send, RefreshCw, X, Search, Filter, Calendar, Info, User
} from 'lucide-react';
import { complaintAPI } from '../services/api';
import Header from '../components/Header';
import './Complaints.css';

export default function Complaints() {
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [viewComplaint, setViewComplaint] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [formData, setFormData] = useState({
        subject: '',
        message: '',
        category: '',
        priority: ''
    });
    const [submitting, setSubmitting] = useState(false);

    const categories = [
        { value: 'GENERAL_FEEDBACK', label: 'General Feedback' },
        { value: 'WORK_ENVIRONMENT', label: 'Work Environment' },
        { value: 'LEAVE_REQUESTS', label: 'Leave Requests' },
        { value: 'TECHNICAL_ISSUES', label: 'Technical Issues' },
        { value: 'HARASSMENT', label: 'Harassment' },
        { value: 'OTHER', label: 'Other' },
    ];

    const priorities = [
        { value: 'LOW', label: 'Low' },
        { value: 'MEDIUM', label: 'Medium' },
        { value: 'HIGH', label: 'High' },
        { value: 'URGENT', label: 'Urgent' },
    ];

    useEffect(() => {
        fetchComplaints();
    }, []);

    const fetchComplaints = async () => {
        setLoading(true);
        try {
            const res = await complaintAPI.getMyComplaints();
            setComplaints(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error("Failed to fetch complaints", e);
        } finally {
            setTimeout(() => setLoading(false), 600);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await complaintAPI.createComplaint(formData);
            setShowModal(false);
            setFormData({ subject: '', message: '', category: '', priority: '' });
            fetchComplaints();
        } catch (e) {
            console.error('Failed to submit complaint', e);
        } finally {
            setSubmitting(false);
        }
    };

    const stats = useMemo(() => {
        const total = complaints.length;
        const pending = complaints.filter(c => c.status === 'PENDING').length;
        const resolved = complaints.filter(c => c.status === 'RESOLVED').length;
        const inProgress = complaints.filter(c => c.status === 'IN_PROGRESS').length;
        return { total, pending, resolved, inProgress };
    }, [complaints]);

    const filteredComplaints = useMemo(() => {
        return complaints.filter(c => {
            const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
            const matchesSearch = c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                c.message.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesStatus && matchesSearch;
        });
    }, [complaints, statusFilter, searchQuery]);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'RESOLVED': return <span className="complaint-badge badge-resolved">Resolved</span>;
            case 'IN_PROGRESS': return <span className="complaint-badge badge-progress">In Progress</span>;
            case 'CLOSED': return <span className="complaint-badge badge-closed">Closed</span>;
            default: return <span className="complaint-badge badge-pending">Pending</span>;
        }
    };

    const getPriorityClass = (priority) => {
        switch (priority) {
            case 'URGENT': return 'priority-urgent';
            case 'HIGH': return 'priority-high';
            case 'MEDIUM': return 'priority-medium';
            default: return 'priority-low';
        }
    };

    return (
        <div className="main-content complaints-wrapper">
            <Header title="Help Desk" subtitle="Submit and track your requests confidentially" />

            <div className="complaints-container">
                {/* Stats Section */}
                <div className="complaints-stats">
                    <div className="complaint-stat-card">
                        <div className="stat-icon" style={{ background: '#eff6ff' }}>
                            <MessageSquare className="text-blue-600" size={24} style={{ color: '#3b82f6' }} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-label">Total Tickets</span>
                            <span className="stat-count">{stats.total}</span>
                        </div>
                    </div>
                    <div className="complaint-stat-card">
                        <div className="stat-icon" style={{ background: '#fffbeb' }}>
                            <Clock className="text-amber-600" size={24} style={{ color: '#d97706' }} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-label">Action Required</span>
                            <span className="stat-count">{stats.pending + stats.inProgress}</span>
                        </div>
                    </div>
                    <div className="complaint-stat-card">
                        <div className="stat-icon" style={{ background: '#ecfdf5' }}>
                            <CheckCircle className="text-emerald-600" size={24} style={{ color: '#10b981' }} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-label">Resolved</span>
                            <span className="stat-count">{stats.resolved}</span>
                        </div>
                    </div>
                </div>

                {/* Controls Section */}
                <div className="complaints-controls">
                    <div className="controls-left">
                        <div className="search-bar">
                            <input 
                                type="text" 
                                placeholder="Search your tickets..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="status-tabs">
                            {['ALL', 'PENDING', 'IN_PROGRESS', 'RESOLVED'].map(status => (
                                <button
                                    key={status}
                                    className={`status-tab ${statusFilter === status ? 'active' : ''}`}
                                    onClick={() => setStatusFilter(status)}
                                >
                                    {status === 'ALL' ? 'All Tickets' : status.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button className="add-employee-btn" onClick={() => setShowModal(true)}>
                        <Plus size={18} /> New Ticket
                    </button>
                </div>

                {/* Tickets Grid */}
                <div className="complaints-grid">
                    {loading ? (
                        Array(6).fill(0).map((_, i) => (
                            <div key={i} className="complaint-card animate-pulse" style={{ height: '140px', background: 'white' }}></div>
                        ))
                    ) : (
                        filteredComplaints.map(ticket => (
                            <div
                                key={ticket.id}
                                className="complaint-card"
                                onClick={() => setViewComplaint(ticket)}
                            >
                                <div className="complaint-header">
                                    <h3 className="complaint-title">{ticket.subject}</h3>
                                    {getStatusBadge(ticket.status)}
                                </div>

                                <p className="complaint-body">
                                    {ticket.message}
                                </p>

                                <div className="complaint-meta">
                                    <span className="complaint-badge" style={{ background: '#f3f4f6', color: '#4b5563' }}>
                                        {ticket.category.replace('_', ' ')}
                                    </span>
                                    <span className={`complaint-badge ${getPriorityClass(ticket.priority)}`}>
                                        {ticket.priority}
                                    </span>
                                </div>

                                <div className="complaint-footer">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Calendar size={14} />
                                        {new Date(ticket.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </div>
                                    {ticket.adminResponse && (
                                        <div className="response-badge">
                                            <Send size={14} />
                                            Reply Received
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}

                    {!loading && filteredComplaints.length === 0 && (
                        <div className="empty-state">
                            <div className="empty-icon">
                                <MessageSquare size={40} />
                            </div>
                            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>No tickets found</h3>
                            <p style={{ color: '#64748b', marginBottom: '14px' }}>
                                {searchQuery || statusFilter !== 'ALL' 
                                    ? "No tickets match your current filters. Try adjusting them." 
                                    : "You haven't submitted any tickets yet."}
                            </p>
                            <button className="add-employee-btn" style={{ margin: '0 auto' }} onClick={() => setShowModal(true)}>
                                <Plus size={18} /> New Ticket
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Ticket Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Create New Ticket</h3>
                            <button className="close-modal-btn" onClick={() => setShowModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleSubmit} className="complaint-form">
                                <div className="form-group">
                                    <label>Subject</label>
                                    <input
                                        className="form-input"
                                        placeholder="What is this regarding?"
                                        required
                                        maxLength={100}
                                        value={formData.subject}
                                        onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                        <label>Category</label>
                                        <select
                                            className="form-select"
                                            required
                                            value={formData.category}
                                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        >
                                            <option value="">Select Category</option>
                                            {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Priority</label>
                                        <select
                                            className="form-select"
                                            required
                                            value={formData.priority}
                                            onChange={e => setFormData({ ...formData, priority: e.target.value })}
                                        >
                                            <option value="">Select Priority</option>
                                            {priorities.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Description</label>
                                    <textarea
                                        className="form-textarea"
                                        placeholder="Please provide as much detail as possible..."
                                        required
                                        maxLength={2000}
                                        value={formData.message}
                                        onChange={e => setFormData({ ...formData, message: e.target.value })}
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                                    <button 
                                        type="button" 
                                        className="status-tab" 
                                        style={{ flex: 1, padding: '12px' }} 
                                        onClick={() => setShowModal(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="add-employee-btn" 
                                        style={{ flex: 2, justifyContent: 'center' }}
                                        disabled={submitting}
                                    >
                                        {submitting ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}
                                        {submitting ? 'Submitting...' : 'Submit Ticket'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* View Ticket Modal */}
            {viewComplaint && (
                <div className="modal-overlay" onClick={() => setViewComplaint(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <h3>Ticket Details</h3>
                                {getStatusBadge(viewComplaint.status)}
                            </div>
                            <button className="close-modal-btn" onClick={() => setViewComplaint(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div style={{ marginBottom: '14px' }}>
                                <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '8px' }}>Subject</div>
                                <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>{viewComplaint.subject}</div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px', padding: '12px 14px', background: '#f8fafc', borderRadius: '10px' }}>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>CATEGORY</div>
                                    <div style={{ fontWeight: 600 }}>{viewComplaint.category.replace('_', ' ')}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>PRIORITY</div>
                                    <div className={`complaint-badge ${getPriorityClass(viewComplaint.priority)}`} style={{ display: 'inline-block' }}>
                                        {viewComplaint.priority}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>SUBMITTED ON</div>
                                    <div style={{ fontWeight: 600 }}>{new Date(viewComplaint.createdAt).toLocaleDateString()}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>TICKET ID</div>
                                    <div style={{ fontWeight: 600 }}>#TIC-{viewComplaint.id.toString().padStart(4, '0')}</div>
                                </div>
                            </div>

                            <div style={{ marginBottom: '14px' }}>
                                <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '12px' }}>Description</div>
                                <div style={{ fontSize: '15px', color: '#334155', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>{viewComplaint.message}</div>
                            </div>

                            {viewComplaint.adminResponse ? (
                                <div className="admin-response-box">
                                    <div className="response-header">
                                        <User size={18} />
                                        Admin Response
                                    </div>
                                    <div style={{ fontSize: '15px', color: '#334155', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
                                        {viewComplaint.adminResponse}
                                    </div>
                                    <div style={{ marginTop: '12px', fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={12} />
                                        Responded on {new Date(viewComplaint.updatedAt).toLocaleDateString()}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ padding: '12px 14px', background: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a', display: 'flex', gap: '12px' }}>
                                    <Info className="text-amber-600" size={20} />
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#92400e', fontSize: '14px' }}>Pending Review</div>
                                        <div style={{ fontSize: '13px', color: '#b45309' }}>Our team is currently reviewing your request. You'll receive a notification once there's an update.</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
