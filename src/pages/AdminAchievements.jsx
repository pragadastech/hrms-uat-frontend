import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Trophy, Search, RefreshCw, CheckCircle, XCircle,
    Clock, Calendar, User, MessageSquare, X, Eye, Award
} from 'lucide-react';
import { achievementAPI } from '../services/api';
import Header from '../components/Header';
import { toast } from 'react-hot-toast';

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

function formatMonthYear(value) {
    if (!value) return '—';
    try {
        const d = new Date(value);
        if (isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } catch (e) {
        return String(value);
    }
}

const STATUS_CONFIG = {
    PENDING: { label: 'Pending Review', color: '#b45309', bg: 'rgba(245, 158, 11, 0.1)', icon: <Clock size={12} /> },
    APPROVED: { label: 'Approved', color: '#059669', bg: 'rgba(16, 185, 129, 0.1)', icon: <CheckCircle size={12} /> },
    REJECTED: { label: 'Rejected', color: '#dc2626', bg: 'rgba(239, 68, 68, 0.1)', icon: <XCircle size={12} /> },
};

export default function AdminAchievements() {
    const [achievements, setAchievements] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submittingReview, setSubmittingReview] = useState(false);
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Modal states
    const [selectedAchievement, setSelectedAchievement] = useState(null);
    const [reviewModalItem, setReviewModalItem] = useState(null);
    const [reviewStatus, setReviewStatus] = useState('APPROVED');
    const [adminComments, setAdminComments] = useState('');
    const monthInputRef = useRef(null);

    const fetchAchievements = async () => {
        setLoading(true);
        try {
            let res;
            if (filterStatus === 'ALL') {
                res = await achievementAPI.getAllAchievements();
            } else {
                res = await achievementAPI.getAchievementsByStatus(filterStatus);
            }
            const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            setAchievements(data);
        } catch (e) {
            console.error("Failed to fetch achievements", e);
            toast.error("Failed to fetch achievements");
            setAchievements([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAchievements();
    }, [filterStatus]);

    const handleOpenReview = (achievement, initialStatus = 'APPROVED') => {
        setReviewModalItem(achievement);
        setReviewStatus(initialStatus);
        setAdminComments('');
    };

    const handleReviewSubmit = async () => {
        if (!reviewModalItem) return;
        if (reviewStatus === 'REJECTED' && !adminComments.trim()) {
            toast.error('Please provide a reason for rejection');
            return;
        }

        setSubmittingReview(true);
        try {
            await achievementAPI.reviewAchievement(reviewModalItem.id, {
                status: reviewStatus,
                adminComments: adminComments.trim()
            });
            toast.success(`Achievement ${reviewStatus === 'APPROVED' ? 'approved' : 'rejected'} successfully!`);
            setReviewModalItem(null);
            setAdminComments('');
            if (selectedAchievement?.id === reviewModalItem.id) {
                setSelectedAchievement(null);
            }
            fetchAchievements();
        } catch (e) {
            toast.error(e.response?.data?.message || "Failed to review achievement");
        } finally {
            setSubmittingReview(false);
        }
    };

    const filteredAchievements = useMemo(() => {
        return achievements.filter(a => {
            const matchesStatus = filterStatus === 'ALL' || a.status === filterStatus;
            
            let matchesMonth = true;
            if (selectedMonth && a.monthYear) {
                const itemDateStr = String(a.monthYear);
                matchesMonth = itemDateStr.startsWith(selectedMonth);
            }

            const term = searchTerm.trim().toLowerCase();
            const formattedMonth = formatMonthYear(a.monthYear).toLowerCase();
            const formattedDate = formatDate(a.submittedAt || a.createdAt).toLowerCase();

            const matchesSearch = !term ||
                (a.employeeName && a.employeeName.toLowerCase().includes(term)) ||
                (a.employeeIdString && a.employeeIdString.toLowerCase().includes(term)) ||
                (a.title && a.title.toLowerCase().includes(term)) ||
                (a.description && a.description.toLowerCase().includes(term)) ||
                formattedMonth.includes(term) ||
                formattedDate.includes(term);

            return matchesStatus && matchesMonth && matchesSearch;
        });
    }, [achievements, filterStatus, selectedMonth, searchTerm]);

    const stats = useMemo(() => {
        const total = achievements.length;
        const pending = achievements.filter(a => a.status === 'PENDING').length;
        const approved = achievements.filter(a => a.status === 'APPROVED').length;
        const rejected = achievements.filter(a => a.status === 'REJECTED').length;
        return { total, pending, approved, rejected };
    }, [achievements]);

    const statusConf = (status) => STATUS_CONFIG[status] || {
        label: status || 'Pending',
        color: 'var(--gray-500)',
        bg: 'var(--gray-50)',
        icon: null
    };

    return (
        <div className="main-content">
            <Header title="Recognition Hub" subtitle="Review and approve employee milestones and achievements" />

            <div className="page-content" style={{ padding: '14px 16px 20px' }}>
                {/* KPI Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                    <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                        <div style={{ padding: '8px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', borderRadius: '10px' }}>
                            <Trophy size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--gray-500)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Submissions</div>
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

                {/* Single-Row Toolbar */}
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
                        style={{ height: '32px', borderRadius: '8px', padding: '0 8px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--white-5)', border: '1px solid var(--expense-border, var(--gray-10))', flexShrink: 0 }}
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
                            style={{ fontSize: '12px', background: 'transparent', border: 'none', outline: 'none', color: 'inherit', cursor: 'pointer', fontFamily: 'inherit' }}
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
                        <option value="PENDING">Pending Review</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                    </select>

                    <button 
                        type="button" 
                        className="btn-secondary" 
                        onClick={fetchAchievements} 
                        disabled={loading}
                        style={{ height: '32px', padding: '0 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                {/* Achievements List / Grid */}
                {loading && achievements.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px 16px' }}>
                        <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--primary-600)', margin: '0 auto 12px' }} />
                        <p style={{ color: 'var(--gray-500)', fontSize: '13px' }}>Loading achievements...</p>
                    </div>
                ) : filteredAchievements.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '36px 16px', borderStyle: 'dashed' }}>
                        <Trophy size={40} style={{ color: 'var(--gray-300)', margin: '0 auto 12px' }} />
                        <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--dark-500)', marginBottom: '4px' }}>
                            {achievements.length === 0 ? 'No achievements found' : 'No matching achievements'}
                        </h4>
                        <p style={{ fontSize: '13px', color: 'var(--gray-500)', maxWidth: '340px', margin: '0 auto' }}>
                            {achievements.length === 0
                                ? 'No employee achievement submissions have been received yet.'
                                : 'Try adjusting your search terms or status filters.'}
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
                        {filteredAchievements.map(achievement => {
                            const status = statusConf(achievement.status);
                            return (
                                <div 
                                    key={achievement.id} 
                                    className="card" 
                                    style={{ 
                                        padding: '14px 16px', 
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        margin: 0, 
                                        borderLeft: `4px solid ${status.color}`,
                                        position: 'relative'
                                    }}
                                >
                                    {/* Header Row */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '11px', color: 'var(--primary-600)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
                                                {formatMonthYear(achievement.monthYear)}
                                            </div>
                                            <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--dark-500)', margin: 0, lineHeight: 1.3 }}>
                                                {achievement.title}
                                            </h3>
                                        </div>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '3px 8px',
                                            borderRadius: '999px',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            color: status.color,
                                            background: status.bg,
                                            whiteSpace: 'nowrap',
                                            flexShrink: 0
                                        }}>
                                            {status.icon}
                                            {status.label}
                                        </span>
                                    </div>

                                    {/* Employee Info */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                        <div style={{
                                            width: '26px',
                                            height: '26px',
                                            borderRadius: '50%',
                                            background: 'var(--primary-10)',
                                            color: 'var(--primary-600)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: '700',
                                            fontSize: '11px',
                                            flexShrink: 0
                                        }}>
                                            {achievement.employeeName ? achievement.employeeName.charAt(0).toUpperCase() : 'E'}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--dark-500)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {achievement.employeeName || 'Unknown Employee'}
                                            {achievement.employeeIdString && (
                                                <span style={{ marginLeft: '4px', color: 'var(--gray-400)', fontWeight: '500', fontSize: '11px' }}>
                                                    ({achievement.employeeIdString})
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Description excerpt */}
                                    <p style={{
                                        fontSize: '12px',
                                        color: 'var(--gray-600)',
                                        lineHeight: '1.5',
                                        height: '36px',
                                        overflow: 'hidden',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        margin: '0 0 10px 0',
                                        flex: 1
                                    }}>
                                        {achievement.description || 'No description provided.'}
                                    </p>

                                    {/* Admin Feedback snippet if present */}
                                    {achievement.adminComments && (
                                        <div style={{
                                            padding: '6px 8px',
                                            borderRadius: '6px',
                                            background: 'var(--light-5)',
                                            borderLeft: '2px solid var(--primary-500)',
                                            fontSize: '11px',
                                            color: 'var(--gray-600)',
                                            marginBottom: '10px',
                                            fontStyle: 'italic',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            Feedback: "{achievement.adminComments}"
                                        </div>
                                    )}

                                    {/* Card Footer */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--gray-5)', marginTop: 'auto' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Clock size={11} />
                                            {formatDate(achievement.submittedAt)}
                                        </div>

                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedAchievement(achievement)}
                                                className="btn-secondary"
                                                style={{ height: '28px', padding: '0 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                            >
                                                <Eye size={12} />
                                                Details
                                            </button>

                                            {achievement.status === 'PENDING' && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenReview(achievement, 'APPROVED')}
                                                        className="btn-primary"
                                                        style={{ height: '28px', padding: '0 10px', fontSize: '11px', background: '#059669', borderColor: '#059669' }}
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenReview(achievement, 'REJECTED')}
                                                        className="btn-danger"
                                                        style={{ height: '28px', padding: '0 8px', fontSize: '11px' }}
                                                    >
                                                        Reject
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* View Details Modal */}
            {selectedAchievement && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(2px)',
                    zIndex: 1100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px'
                }}>
                    <div className="card" style={{
                        width: '100%',
                        maxWidth: '540px',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: 0,
                        overflow: 'hidden',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '14px 18px',
                            borderBottom: '1px solid var(--gray-10)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'var(--white-5)'
                        }}>
                            <div>
                                <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--dark-500)', margin: 0 }}>
                                    {selectedAchievement.title}
                                </h3>
                                <p style={{ fontSize: '12px', color: 'var(--gray-500)', margin: '2px 0 0 0' }}>
                                    Submitted for {formatMonthYear(selectedAchievement.monthYear)}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedAchievement(null)}
                                className="btn-icon-sm"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '16px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {/* Summary Grid */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '12px',
                                padding: '12px 14px',
                                background: 'var(--light-5)',
                                borderRadius: '8px',
                                border: '1px solid var(--gray-10)'
                            }}>
                                <div>
                                    <div style={{ fontSize: '11px', color: 'var(--gray-400)', fontWeight: '600', textTransform: 'uppercase' }}>Employee</div>
                                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--dark-500)', marginTop: '2px' }}>
                                        {selectedAchievement.employeeName || '—'}
                                    </div>
                                    {selectedAchievement.employeeIdString && (
                                        <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                                            ID: {selectedAchievement.employeeIdString}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: 'var(--gray-400)', fontWeight: '600', textTransform: 'uppercase' }}>Submission Date</div>
                                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--dark-500)', marginTop: '2px' }}>
                                        {formatDate(selectedAchievement.submittedAt)}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: 'var(--gray-400)', fontWeight: '600', textTransform: 'uppercase' }}>Month & Year</div>
                                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--dark-500)', marginTop: '2px' }}>
                                        {formatMonthYear(selectedAchievement.monthYear)}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: 'var(--gray-400)', fontWeight: '600', textTransform: 'uppercase' }}>Status</div>
                                    <div style={{ marginTop: '3px' }}>
                                        {(() => {
                                            const status = statusConf(selectedAchievement.status);
                                            return (
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '2px 8px',
                                                    borderRadius: '999px',
                                                    fontSize: '11px',
                                                    fontWeight: '600',
                                                    color: status.color,
                                                    background: status.bg
                                                }}>
                                                    {status.icon}
                                                    {status.label}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <div style={{ fontSize: '11px', color: 'var(--gray-400)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>
                                    Achievement Description
                                </div>
                                <div style={{
                                    fontSize: '13px',
                                    color: 'var(--dark-500)',
                                    lineHeight: '1.6',
                                    whiteSpace: 'pre-wrap',
                                    padding: '12px 14px',
                                    background: 'var(--white-5)',
                                    border: '1px solid var(--gray-10)',
                                    borderRadius: '8px'
                                }}>
                                    {selectedAchievement.description || 'No description provided.'}
                                </div>
                            </div>

                            {/* Admin Feedback */}
                            {selectedAchievement.adminComments && (
                                <div>
                                    <div style={{ fontSize: '11px', color: 'var(--gray-400)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>
                                        Admin Feedback
                                    </div>
                                    <div style={{
                                        fontSize: '13px',
                                        color: 'var(--primary-700)',
                                        background: 'var(--primary-5)',
                                        border: '1px solid var(--primary-10)',
                                        borderRadius: '8px',
                                        padding: '12px 14px',
                                        fontStyle: 'italic',
                                        lineHeight: '1.5'
                                    }}>
                                        "{selectedAchievement.adminComments}"
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            padding: '12px 18px',
                            borderTop: '1px solid var(--gray-10)',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '8px',
                            background: 'var(--white-5)'
                        }}>
                            <button
                                type="button"
                                onClick={() => setSelectedAchievement(null)}
                                className="btn-secondary"
                                style={{ height: '32px', padding: '0 14px', fontSize: '12px' }}
                            >
                                Close
                            </button>
                            {selectedAchievement.status === 'PENDING' && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => handleOpenReview(selectedAchievement, 'REJECTED')}
                                        className="btn-danger"
                                        style={{ height: '32px', padding: '0 14px', fontSize: '12px' }}
                                    >
                                        Reject
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleOpenReview(selectedAchievement, 'APPROVED')}
                                        className="btn-primary"
                                        style={{ height: '32px', padding: '0 16px', fontSize: '12px', background: '#059669', borderColor: '#059669' }}
                                    >
                                        Approve
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Review Modal (Approve / Reject Verdict Confirmation) */}
            {reviewModalItem && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.55)',
                    backdropFilter: 'blur(2px)',
                    zIndex: 1200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px'
                }}>
                    <div className="card" style={{
                        width: '100%',
                        maxWidth: '460px',
                        padding: '18px 20px',
                        borderRadius: '12px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                        margin: 0
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--dark-500)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {reviewStatus === 'APPROVED' ? (
                                    <>
                                        <CheckCircle size={18} style={{ color: '#059669' }} />
                                        Approve Achievement
                                    </>
                                ) : (
                                    <>
                                        <XCircle size={18} style={{ color: '#dc2626' }} />
                                        Reject Achievement
                                    </>
                                )}
                            </h3>
                            <button
                                type="button"
                                onClick={() => { setReviewModalItem(null); setAdminComments(''); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: '2px' }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <p style={{ fontSize: '13px', color: 'var(--gray-600)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                            {reviewStatus === 'APPROVED' ? (
                                <>Approve <strong>"{reviewModalItem.title}"</strong> submitted by <strong>{reviewModalItem.employeeName}</strong>?</>
                            ) : (
                                <>Reject <strong>"{reviewModalItem.title}"</strong> submitted by <strong>{reviewModalItem.employeeName}</strong>?</>
                            )}
                        </p>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--dark-500)', marginBottom: '6px' }}>
                                {reviewStatus === 'APPROVED' ? 'Feedback (optional)' : 'Reason for rejection *'}
                            </label>
                            <textarea
                                className="form-input"
                                rows={3}
                                style={{ width: '100%', resize: 'none', fontSize: '12px', padding: '8px 10px' }}
                                placeholder={reviewStatus === 'APPROVED' ? "Great milestone! Keep it up..." : "Please specify why this achievement is rejected..."}
                                value={adminComments}
                                onChange={(e) => setAdminComments(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => { setReviewModalItem(null); setAdminComments(''); }}
                                disabled={submittingReview}
                                style={{ height: '32px', padding: '0 14px', fontSize: '12px' }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className={reviewStatus === 'APPROVED' ? 'btn-primary' : 'btn-danger'}
                                onClick={handleReviewSubmit}
                                disabled={submittingReview || (reviewStatus === 'REJECTED' && !adminComments.trim())}
                                style={{
                                    height: '32px',
                                    padding: '0 16px',
                                    fontSize: '12px',
                                    ...(reviewStatus === 'APPROVED' ? { background: '#059669', borderColor: '#059669' } : {})
                                }}
                            >
                                {submittingReview ? 'Processing...' : reviewStatus === 'APPROVED' ? 'Approve' : 'Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

