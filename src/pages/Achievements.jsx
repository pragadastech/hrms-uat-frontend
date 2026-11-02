import React, { useState, useEffect, useMemo } from 'react';
import {
    Trophy, Plus, Calendar, Clock, CheckCircle, XCircle,
    AlertCircle, Search, MessageSquare, Sparkles, Award,
    History, Send, RefreshCw, X
} from 'lucide-react';
import { achievementAPI } from '../services/api';
import Header from '../components/Header';
import { toast } from 'react-hot-toast';

function formatMonthYear(val) {
    if (!val) return '—';
    try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return String(val);
        return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } catch (e) {
        return String(val);
    }
}

function formatDate(val) {
    if (!val) return '—';
    try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return String(val);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
        return String(val);
    }
}

const STATUS_CONFIG = {
    PENDING: { bg: 'rgba(245, 158, 11, 0.1)', color: '#b45309', label: 'Pending Review', icon: <Clock size={12} /> },
    APPROVED: { bg: 'rgba(16, 185, 129, 0.1)', color: '#059669', label: 'Approved', icon: <CheckCircle size={12} /> },
    REJECTED: { bg: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', label: 'Rejected', icon: <XCircle size={12} /> }
};

export default function Achievements() {
    const [achievements, setAchievements] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showApplyModal, setShowApplyModal] = useState(false);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [currentMonth, setCurrentMonth] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        monthYear: ''
    });

    useEffect(() => {
        fetchData();
        checkSubmission();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await achievementAPI.getMyAchievements();
            setAchievements(Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
        } catch (e) {
            console.error("Fetch error", e);
            toast.error("Failed to load achievements");
        } finally {
            setLoading(false);
        }
    };

    const checkSubmission = async () => {
        try {
            const now = new Date();
            const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            setCurrentMonth(monthStr);
            setFormData(prev => ({ ...prev, monthYear: monthStr }));

            const res = await achievementAPI.checkSubmission(monthStr);
            const isSubmitted = typeof res?.hasSubmitted === 'boolean' 
                ? res.hasSubmitted 
                : typeof res?.data?.hasSubmitted === 'boolean' 
                    ? res.data.hasSubmitted 
                    : (res?.data === true || res === true);
            setHasSubmitted(!!isSubmitted);
        } catch (e) {
            console.error("Check submission error", e);
            setHasSubmitted(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title.trim() || !formData.description.trim() || !formData.monthYear) {
            toast.error("All fields are required");
            return;
        }

        try {
            await achievementAPI.submitAchievement(formData);
            toast.success("Achievement submitted successfully!");
            setShowApplyModal(false);
            setFormData({ title: '', description: '', monthYear: currentMonth });
            fetchData();
            checkSubmission();
        } catch (e) {
            toast.error(e.response?.data?.message || "Submission failed");
        }
    };

    const stats = useMemo(() => {
        const approved = achievements.filter(a => a.status === 'APPROVED').length;
        const pending = achievements.filter(a => a.status === 'PENDING').length;
        const rejected = achievements.filter(a => a.status === 'REJECTED').length;
        return { total: achievements.length, approved, pending, rejected };
    }, [achievements]);

    const filteredAchievements = useMemo(() => {
        return achievements.filter(ach => {
            const matchesStatus = statusFilter === 'ALL' || ach.status === statusFilter;
            const term = searchTerm.trim().toLowerCase();
            if (!term) return matchesStatus;

            const formattedMonth = formatMonthYear(ach.monthYear).toLowerCase();
            const formattedDate = formatDate(ach.submittedAt || ach.createdAt).toLowerCase();
            const rawMonth = (ach.monthYear || '').toLowerCase();
            const title = (ach.title || '').toLowerCase();
            const desc = (ach.description || '').toLowerCase();
            const comments = (ach.adminComments || '').toLowerCase();

            const matchesSearch =
                title.includes(term) ||
                desc.includes(term) ||
                formattedMonth.includes(term) ||
                rawMonth.includes(term) ||
                formattedDate.includes(term) ||
                comments.includes(term);

            return matchesStatus && matchesSearch;
        });
    }, [achievements, statusFilter, searchTerm]);

    const getStatusStyle = (status) => {
        return STATUS_CONFIG[status] || { bg: 'var(--gray-50)', color: 'var(--gray-500)', label: status || 'Pending', icon: null };
    };

    return (
        <div className="main-content">
            <Header title="Recognition Hub" subtitle="Celebrate your milestones and achievements" />

            <div className="page-content" style={{ padding: '14px 16px 20px' }}>

                {/* Streamlined Monthly Action Banner */}
                <div style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    color: '#fff',
                    boxShadow: '0 4px 20px rgba(99, 102, 241, 0.25)',
                    marginBottom: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '14px',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ zIndex: 2, maxWidth: '640px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(255,255,255,0.18)', borderRadius: '999px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                            <Sparkles size={13} color="#fff" />
                            {new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} Spotlight
                        </div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff', margin: '0 0 4px 0', lineHeight: 1.3 }}>
                            Share Your Wins & Milestones
                        </h2>
                        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', margin: 0, lineHeight: 1.4 }}>
                            Submit your monthly key accomplishments to receive recognition from leadership and teammates.
                        </p>
                    </div>

                    <div style={{ zIndex: 2 }}>
                        {!hasSubmitted ? (
                            <button
                                type="button"
                                onClick={() => setShowApplyModal(true)}
                                style={{
                                    backgroundColor: '#fff',
                                    color: '#6366f1',
                                    padding: '0 16px',
                                    height: '38px',
                                    borderRadius: '10px',
                                    fontWeight: '700',
                                    fontSize: '13px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                                    transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                                }}
                            >
                                <Plus size={16} /> Submit Achievement
                            </button>
                        ) : (
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 14px',
                                background: 'rgba(255,255,255,0.18)',
                                borderRadius: '10px',
                                border: '1px solid rgba(255,255,255,0.25)',
                                color: '#fff',
                                fontSize: '13px',
                                fontWeight: '600'
                            }}>
                                <CheckCircle size={16} style={{ color: '#4ade80' }} />
                                Submitted for this month
                            </div>
                        )}
                    </div>
                    {/* Decorative Background Icon */}
                    <Trophy size={140} style={{ position: 'absolute', right: '-15px', bottom: '-35px', color: 'rgba(255,255,255,0.08)', transform: 'rotate(12deg)', pointerEvents: 'none' }} />
                </div>

                {/* Summary Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                    <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                        <div style={{ padding: '8px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', borderRadius: '10px' }}>
                            <History size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--gray-500)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Submissions</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--dark-500)', lineHeight: 1.2 }}>{stats.total}</div>
                        </div>
                    </div>

                    <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                        <div style={{ padding: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '10px' }}>
                            <Award size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--gray-500)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Approved Awards</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--dark-500)', lineHeight: 1.2 }}>{stats.approved}</div>
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
                </div>

                {/* Toolbar */}
                <div className="card" style={{ padding: '8px 12px', marginBottom: '14px', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '240px', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                            <input
                                type="search"
                                placeholder="Search achievements..."
                                className="form-input"
                                style={{ paddingLeft: '30px', height: '32px', fontSize: '12px', width: '100%' }}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <select
                            className="form-input"
                            style={{ height: '32px', fontSize: '12px', width: 'auto', minWidth: '110px', maxWidth: '130px', flexShrink: 0 }}
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            aria-label="Filter by status"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="PENDING">Pending</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={fetchData}
                        className="btn-secondary"
                        style={{ height: '32px', padding: '0 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
                        title="Refresh list"
                        disabled={loading}
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                {/* Achievements List */}
                {loading && achievements.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px 16px' }}>
                        <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--primary-600)', margin: '0 auto 12px' }} />
                        <p style={{ color: 'var(--gray-500)', fontSize: '13px' }}>Loading achievements...</p>
                    </div>
                ) : filteredAchievements.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '36px 16px', borderStyle: 'dashed' }}>
                        <Trophy size={40} style={{ color: 'var(--gray-300)', margin: '0 auto 12px' }} />
                        <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--dark-500)', marginBottom: '4px' }}>
                            {achievements.length === 0 ? 'No achievements submitted yet' : 'No matching achievements'}
                        </h4>
                        <p style={{ fontSize: '13px', color: 'var(--gray-500)', maxWidth: '320px', margin: '0 auto' }}>
                            {achievements.length === 0
                                ? 'Submit your first achievement of the month to be recognized on the company board.'
                                : 'Try clearing your search or status filter to see other entries.'}
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '10px' }}>
                        {filteredAchievements.map(ach => {
                            const style = getStatusStyle(ach.status);
                            return (
                                <div key={ach.id} className="card" style={{ padding: '14px 16px', borderLeft: `4px solid ${style.color}`, margin: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary-600)', background: 'var(--primary-5, rgba(99,102,241,0.08))', padding: '2px 8px', borderRadius: '6px' }}>
                                                {formatMonthYear(ach.monthYear)}
                                            </span>
                                            <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--dark-500)', margin: 0 }}>
                                                {ach.title}
                                            </h4>
                                        </div>
                                        <span style={{ 
                                            backgroundColor: style.bg, 
                                            color: style.color,
                                            padding: '2px 8px',
                                            borderRadius: '999px',
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            flexShrink: 0
                                        }}>
                                            {style.icon}
                                            {style.label}
                                        </span>
                                    </div>
                                    
                                    <p style={{ fontSize: '13px', color: 'var(--gray-600)', lineHeight: '1.5', margin: '0 0 10px 0' }}>
                                        {ach.description}
                                    </p>

                                    {ach.adminComments && (
                                        <div style={{ background: 'var(--primary-5, rgba(99,102,241,0.06))', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.15)', marginBottom: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-700)', fontWeight: '700', fontSize: '11px', marginBottom: '4px' }}>
                                                <MessageSquare size={13} /> Admin Feedback
                                            </div>
                                            <p style={{ fontSize: '12px', color: 'var(--primary-800)', margin: 0, fontStyle: 'italic', lineHeight: 1.4 }}>
                                                "{ach.adminComments}"
                                            </p>
                                        </div>
                                    )}

                                    <div style={{ fontSize: '11px', color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={13} />
                                        <span>Submitted on {formatDate(ach.submittedAt || ach.createdAt)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Submission Modal */}
            {showApplyModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '560px', padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--gray-10)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ padding: '8px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', borderRadius: '10px' }}>
                                    <Send size={16} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0, color: 'var(--dark-500)' }}>Submit Monthly Achievement</h3>
                                    <p style={{ fontSize: '12px', color: 'var(--gray-500)', margin: '2px 0 0 0' }}>
                                        For {formatMonthYear(formData.monthYear)}
                                    </p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setShowApplyModal(false)} className="btn-icon-sm" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                                <X size={18} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} style={{ padding: '16px' }}>
                            <div style={{ display: 'grid', gap: '12px', marginBottom: '14px' }}>
                                <div>
                                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: 'var(--dark-500)' }}>
                                        Title *
                                    </label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        style={{ width: '100%', boxSizing: 'border-box' }}
                                        required
                                        maxLength={255}
                                        placeholder="e.g. Delivered payment gateway integration ahead of schedule"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <label className="form-label" style={{ fontSize: '12px', fontWeight: '600', color: 'var(--dark-500)' }}>
                                            Description *
                                        </label>
                                        <span style={{ fontSize: '11px', color: formData.description.length > 900 ? '#ef4444' : 'var(--gray-400)' }}>
                                            {formData.description.length}/1000
                                        </span>
                                    </div>
                                    <textarea
                                        className="form-input"
                                        style={{ width: '100%', resize: 'vertical', minHeight: '90px', boxSizing: 'border-box' }}
                                        rows={4}
                                        required
                                        maxLength={1000}
                                        placeholder="Describe the contribution, impact on team/business, or project milestones achieved..."
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                            </div>
                            
                            <div style={{ padding: '10px 12px', background: 'var(--amber-50, #fffbeb)', borderRadius: '8px', display: 'flex', gap: '8px', marginBottom: '16px', border: '1px solid #fef3c7' }}>
                                <AlertCircle size={15} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
                                <p style={{ fontSize: '12px', color: '#b45309', lineHeight: 1.4, margin: 0 }}>
                                    Submissions are reviewed by the team. Approved awards appear on the organization wall of fame.
                                </p>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button type="button" onClick={() => setShowApplyModal(false)} className="btn-secondary" style={{ padding: '0 14px', height: '34px', fontSize: '13px' }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" style={{ padding: '0 16px', height: '34px', fontSize: '13px', fontWeight: '600' }}>
                                    Submit
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

