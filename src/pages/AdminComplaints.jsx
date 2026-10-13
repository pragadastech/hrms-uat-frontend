import React, { useState, useEffect, useMemo } from 'react';
import {
    MessageSquare, CheckCircle, Clock, AlertTriangle,
    Search, Filter, Send, XCircle, RefreshCw, X, User, Calendar
} from 'lucide-react';
import { complaintAPI } from '../services/api';
import Header from '../components/Header';
import './Complaints.css';

export default function AdminComplaints() {
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('ALL'); // ALL, PENDING, URGENT, RESOLVED
    const [searchTerm, setSearchTerm] = useState('');

    // Response Modal
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [responseText, setResponseText] = useState('');
    const [answering, setAnswering] = useState(false);

    useEffect(() => {
        fetchComplaints();
    }, []);

    const fetchComplaints = async () => {
        setLoading(true);
        try {
            const res = await complaintAPI.getAllComplaints();
            setComplaints(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error("Failed to fetch complaints", e);
        } finally {
            setTimeout(() => setLoading(false), 400);
        }
    };

    const stats = useMemo(() => {
        const total = complaints.length;
        const pending = complaints.filter(c => c.status === 'PENDING' || c.status === 'IN_PROGRESS').length;
        const urgent = complaints.filter(c => c.priority === 'URGENT' || c.priority === 'HIGH').length;
        const resolved = complaints.filter(c => c.status === 'RESOLVED').length;
        return { total, pending, urgent, resolved };
    }, [complaints]);

    const filteredComplaints = useMemo(() => {
        return complaints.filter(ticket => {
            const matchesSearch =
                ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (ticket.employeeName && ticket.employeeName.toLowerCase().includes(searchTerm.toLowerCase()));

            if (!matchesSearch) return false;

            if (filter === 'ALL') return true;
            if (filter === 'PENDING') return ticket.status === 'PENDING' || ticket.status === 'IN_PROGRESS';
            if (filter === 'URGENT') return ticket.priority === 'URGENT' || ticket.priority === 'HIGH';
            if (filter === 'RESOLVED') return ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
            return true;
        });
    }, [complaints, filter, searchTerm]);

    const handleResponse = async (e) => {
        e.preventDefault();
        if (!selectedTicket || !responseText.trim()) return;

        setAnswering(true);
        try {
            await complaintAPI.respondToComplaint(selectedTicket.id, {
                adminResponse: responseText,
                response: responseText,
                status: 'RESOLVED'
            });
            setSelectedTicket(null);
            setResponseText('');
            fetchComplaints();
        } catch (e) {
            console.error('Failed to send response', e.response?.data || e);
            alert('Failed to send response: ' + (e.response?.data?.message || e.message));
        } finally {
            setAnswering(false);
        }
    };

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
            case 'LOW': return 'priority-low';
            default: return '';
        }
    };

    return (
        <div className="complaints-wrapper">
            <Header title="Help Desk Management" subtitle="Monitor and resolve employee concerns effectively" />

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
                        <div className="stat-icon" style={{ background: '#fff7ed' }}>
                            <AlertTriangle className="text-orange-600" size={24} style={{ color: '#ea580c' }} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-label">Urgent / High</span>
                            <span className="stat-count">{stats.urgent}</span>
                        </div>
                    </div>
                    <div className="complaint-stat-card">
                        <div className="stat-icon" style={{ background: '#fef2f2' }}>
                            <Clock className="text-rose-600" size={24} style={{ color: '#e11d48' }} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-label">Pending Review</span>
                            <span className="stat-count">{stats.pending}</span>
                        </div>
                    </div>
                </div>

                {/* Controls Section */}
                <div className="complaints-controls">
                    <div className="controls-left">
                        <div className="search-bar">
                            <input
                                type="text"
                                placeholder="Search by subject or employee..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="status-tabs">
                            {['ALL', 'PENDING', 'URGENT', 'RESOLVED'].map(f => (
                                <button
                                    key={f}
                                    className={`status-tab ${filter === f ? 'active' : ''}`}
                                    onClick={() => setFilter(f)}
                                >
                                    {f.charAt(0) + f.slice(1).toLowerCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button className="add-employee-btn" onClick={fetchComplaints} title="Refresh">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>

                {/* Tickets Grid */}
                <div className="complaints-grid">
                    {loading ? (
                        Array(6).fill(0).map((_, i) => (
                            <div key={i} className="complaint-card animate-pulse" style={{ height: '140px', background: '#f9fafb' }}></div>
                        ))
                    ) : (
                        filteredComplaints.map(ticket => (
                            <div key={ticket.id} className="complaint-card" onClick={() => setSelectedTicket(ticket)}>
                                <div className="complaint-header">
                                    <h3 className="complaint-title">{ticket.subject}</h3>
                                    {getStatusBadge(ticket.status)}
                                </div>

                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                                        {ticket.employeeName ? ticket.employeeName.charAt(0) : 'A'}
                                    </div>
                                    <span className="text-xs font-semibold text-gray-700">{ticket.employeeName || 'Anonymous'}</span>
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
                                    <div className="flex items-center gap-1">
                                        <Calendar size={12} />
                                        {new Date(ticket.createdAt).toLocaleDateString()}
                                    </div>
                                    {ticket.adminResponse ? (
                                        <div className="response-badge">
                                            <CheckCircle size={12} />
                                            Answered
                                        </div>
                                    ) : (
                                        <span className="text-xs text-indigo-600 font-bold">Needs Response</span>
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
                            <h3 className="text-xl font-bold text-gray-900 mb-2">No tickets found</h3>
                            <p className="text-gray-500 mb-0">Adjust your search or filters to find what you're looking for.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Response Modal */}
            {selectedTicket && (
                <div className="modal-overlay" onClick={() => setSelectedTicket(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="flex flex-col">
                                <h3 className="text-xl font-bold">Ticket Response</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    {getStatusBadge(selectedTicket.status)}
                                    <span className="text-xs text-gray-500 font-medium">
                                        From: {selectedTicket.employeeName || 'Anonymous'}
                                    </span>
                                </div>
                            </div>
                            <button className="close-modal-btn" onClick={() => setSelectedTicket(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="bg-gray-50 p-4 rounded-2xl mb-6">
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Ticket Subject</div>
                                <div className="text-base font-bold text-gray-900 mb-3">{selectedTicket.subject}</div>
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Message</div>
                                <p className="text-sm text-gray-800 leading-relaxed">{selectedTicket.message}</p>
                            </div>

                            {selectedTicket.adminResponse ? (
                                <div className="admin-response-box mb-6">
                                    <div className="response-header">
                                        <MessageSquare size={16} /> Previous Response
                                    </div>
                                    <p className="text-sm text-indigo-900">{selectedTicket.adminResponse}</p>
                                </div>
                            ) : null}

                            <form onSubmit={handleResponse} className="complaint-form">
                                <div className="form-group">
                                    <label>Your Response</label>
                                    <textarea
                                        className="form-textarea"
                                        placeholder="Address the employee's concern..."
                                        required
                                        value={responseText}
                                        onChange={e => setResponseText(e.target.value)}
                                        style={{ minHeight: '90px' }}
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1 italic">
                                        Note: Submitting a response will mark this ticket as RESOLVED.
                                    </p>
                                </div>

                                <div className="modal-footer" style={{ padding: '14px 0 0 0', background: 'transparent' }}>
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={() => setSelectedTicket(null)}
                                        style={{ flex: 1, padding: '8px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={answering || !responseText.trim()}
                                        className="add-employee-btn"
                                        style={{ flex: 1, padding: '8px 12px', borderRadius: '10px', justifyContent: 'center' }}
                                    >
                                        {answering ? 'Sending...' : 'Send & Resolve'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

