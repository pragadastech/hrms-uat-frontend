import React, { useState, useEffect, useMemo } from 'react';
import {
    Trophy, Search, Filter, RefreshCw, CheckCircle, XCircle,
    Clock, Calendar, User, MessageSquare, X, ChevronRight, Eye,
    TrendingUp, Award, BarChart3, MoreVertical
} from 'lucide-react';
import { achievementAPI } from '../services/api';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';

export default function AdminAchievements() {
    const { user } = useAuth();
    const [achievements, setAchievements] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // Modal states
    const [selectedAchievement, setSelectedAchievement] = useState(null);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewData, setReviewData] = useState({
        status: 'APPROVED',
        adminComments: ''
    });

    useEffect(() => {
        fetchAchievements();
    }, [filterStatus]);

    const fetchAchievements = async () => {
        setLoading(true);
        try {
            let res;
            if (filterStatus === 'ALL') {
                res = await achievementAPI.getAllAchievements();
            } else {
                res = await achievementAPI.getAchievementsByStatus(filterStatus);
            }
            setAchievements(Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
        } catch (e) {
            console.error("Failed to fetch achievements", e);
            toast.error("Failed to fetch achievements");
            setAchievements([]);
        } finally {
            setLoading(false);
        }
    };

    const handleReview = async () => {
        if (!selectedAchievement) return;
        try {
            await achievementAPI.reviewAchievement(selectedAchievement.id, reviewData);
            toast.success(`Achievement ${reviewData.status.toLowerCase()} successfully!`);
            setShowReviewModal(false);
            setReviewData({ status: 'APPROVED', adminComments: '' });
            setSelectedAchievement(null);
            fetchAchievements();
        } catch (e) {
            toast.error(e.response?.data?.message || "Failed to review");
        }
    };

    const filteredAchievements = achievements.filter(a =>
    (a.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.title?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const stats = useMemo(() => {
        const total = achievements.length;
        const pending = achievements.filter(a => a.status === 'PENDING').length;
        const approved = achievements.filter(a => a.status === 'APPROVED').length;
        const rejected = achievements.filter(a => a.status === 'REJECTED').length;
        return { total, pending, approved, rejected };
    }, [achievements]);

    const getStatusBadge = (status) => {
        const styles = {
            PENDING: { bg: "rgba(245, 158, 11, 0.1)", text: "#b45309", icon: <Clock size={12} /> },
            APPROVED: { bg: "rgba(16, 185, 129, 0.1)", text: "#065f46", icon: <CheckCircle size={12} /> },
            REJECTED: { bg: "rgba(239, 68, 68, 0.1)", text: "#991b1b", icon: <XCircle size={12} /> }
        };
        const style = styles[status] || { bg: "gray-100", text: "gray-800" };
        
        return (
            <span style={{ 
                backgroundColor: style.bg, 
                color: style.text,
                padding: '4px 10px',
                borderRadius: '99px',
                fontSize: '11px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
            }}>
                {style.icon}
                {status}
            </span>
        );
    };

    return (
        <div className="main-content">
            <Header title="Achievement Hub" subtitle="Nurture culture by recognizing employee excellence" />

            <div className="page-content" style={{ padding: '14px 16px 20px' }}>
                {/* Stats Section */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                    {[
                        { label: 'Total Submissions', value: stats.total, icon: BarChart3, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
                        { label: 'Pending Review', value: stats.pending, icon: Clock, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
                        { label: 'Approved', value: stats.approved, icon: Award, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
                        { label: 'Rejected', value: stats.rejected, icon: XCircle, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
                    ].map((stat, i) => (
                        <div key={i} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: stat.bg, color: stat.color }}>
                                <stat.icon size={20} />
                            </div>
                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--gray-500)', fontWeight: '500' }}>{stat.label}</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--dark-500)' }}>{stat.value}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Toolbar */}
                <div className="card" style={{ padding: '10px 12px', marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '260px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                            <input
                                type="text"
                                placeholder="Search by employee or title..."
                                className="form-input"
                                style={{ paddingLeft: '40px', width: '100%' }}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select
                            className="form-input"
                            style={{ minWidth: '150px' }}
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                        >
                            <option value="ALL">All Status</option>
                            <option value="PENDING">Pending</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                    </div>
                    <button
                        onClick={fetchAchievements}
                        className="btn-icon"
                        style={{ background: 'var(--white-5)', border: '1px solid var(--gray-10)' }}
                        title="Refresh"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Grid of Achievements */}
                {loading && achievements.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '28px 16px' }}>
                        <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--primary-600)', margin: '0 auto 12px' }} />
                        <p style={{ color: 'var(--gray-500)' }}>Fetching achievements...</p>
                    </div>
                ) : filteredAchievements.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '28px 16px', borderStyle: 'dashed' }}>
                        <Trophy size={40} style={{ color: 'var(--gray-200)', margin: '0 auto 12px' }} />
                        <h4 style={{ color: 'var(--dark-500)', fontWeight: '600', marginBottom: '4px' }}>No achievements found</h4>
                        <p style={{ color: 'var(--gray-500)', fontSize: '14px' }}>Try adjusting your filters or search terms</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                        {filteredAchievements.map(achievement => (
                            <div key={achievement.id} className="card" style={{ padding: '0', overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s' }}>
                                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--gray-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontSize: '11px', color: 'var(--primary-600)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                                            {new Date(achievement.monthYear).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                        </div>
                                        <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--dark-500)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {achievement.title}
                                        </h3>
                                    </div>
                                    {getStatusBadge(achievement.status)}
                                </div>
                                
                                <div style={{ padding: '12px 14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-600)', fontSize: '14px', fontWeight: '700' }}>
                                            {achievement.employeeName?.charAt(0)}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--dark-500)' }}>{achievement.employeeName}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>ID: {achievement.employeeIdString}</div>
                                        </div>
                                    </div>

                                    <p style={{ fontSize: '13px', color: 'var(--gray-600)', lineHeight: '1.5', height: '48px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', marginBottom: '12px' }}>
                                        {achievement.description}
                                    </p>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid var(--gray-5)' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Clock size={12} />
                                            Submitted: {new Date(achievement.submittedAt).toLocaleDateString()}
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button 
                                                onClick={() => setSelectedAchievement(achievement)}
                                                className="btn-icon-sm"
                                                style={{ color: 'var(--primary-600)', background: 'var(--primary-5)' }}
                                                title="View Details"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            {achievement.status === 'PENDING' && (
                                                <button 
                                                    onClick={() => { setSelectedAchievement(achievement); setShowReviewModal(true); }}
                                                    className="btn-icon-sm"
                                                    style={{ color: '#fff', background: 'var(--primary-600)' }}
                                                    title="Review Now"
                                                >
                                                    <TrendingUp size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Combined Detail / Review Modal */}
            {selectedAchievement && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '0' }}>
                        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--gray-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', sticky: 'top', background: '#fff', zIndex: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ padding: '8px', background: 'var(--amber-50)', color: 'var(--amber-600)', borderRadius: '8px' }}>
                                    <Trophy size={18} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.05rem', fontWeight: '700' }}>
                                        {showReviewModal ? 'Review Recognition' : 'Recognition Details'}
                                    </h3>
                                    <p style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                                        Submission for {new Date(selectedAchievement.monthYear).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => { setSelectedAchievement(null); setShowReviewModal(false); }} className="btn-icon-sm"><X size={20} /></button>
                        </div>

                        <div style={{ padding: '14px 16px', display: 'grid', gap: '14px' }}>
                            {/* Employee Card */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: 'var(--gray-50)', borderRadius: '10px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--primary-10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-600)', fontSize: '16px', fontWeight: '700' }}>
                                    {selectedAchievement.employeeName?.charAt(0)}
                                </div>
                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--dark-500)' }}>{selectedAchievement.employeeName}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Employee ID: {selectedAchievement.employeeIdString}</div>
                                </div>
                                <div style={{ marginLeft: 'auto' }}>
                                    {getStatusBadge(selectedAchievement.status)}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gap: '6px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--gray-400)', textTransform: 'uppercase' }}>Achievement Title</label>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--dark-500)' }}>{selectedAchievement.title}</div>
                            </div>

                            <div style={{ display: 'grid', gap: '6px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--gray-400)', textTransform: 'uppercase' }}>Description</label>
                                <div style={{ fontSize: '13px', color: 'var(--gray-700)', lineHeight: '1.6', whiteSpace: 'pre-wrap', background: 'var(--gray-50)', padding: '12px 14px', borderRadius: '10px' }}>
                                    {selectedAchievement.description}
                                </div>
                            </div>

                            {/* Existing Feedback */}
                            {selectedAchievement.adminComments && !showReviewModal && (
                                <div style={{ padding: '12px 14px', background: 'var(--primary-5)', borderRadius: '10px', border: '1px solid var(--primary-10)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-700)', fontWeight: '700', fontSize: '13px', marginBottom: '6px' }}>
                                        <MessageSquare size={16} /> Admin Feedback
                                    </div>
                                    <p style={{ fontSize: '13px', color: 'var(--primary-800)', fontStyle: 'italic' }}>
                                        "{selectedAchievement.adminComments}"
                                    </p>
                                </div>
                            )}

                            {/* Review Form */}
                            {showReviewModal && (
                                <div style={{ borderTop: '1px solid var(--gray-10)', paddingTop: '14px' }}>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--dark-500)', marginBottom: '10px' }}>Review Verdict</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setReviewData({ ...reviewData, status: 'APPROVED' })}
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: '10px',
                                                border: '2px solid',
                                                borderColor: reviewData.status === 'APPROVED' ? '#10b981' : 'var(--gray-10)',
                                                background: reviewData.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.05)' : '#fff',
                                                color: reviewData.status === 'APPROVED' ? '#065f46' : 'var(--gray-500)',
                                                fontWeight: '600',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <CheckCircle size={18} /> Approve
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setReviewData({ ...reviewData, status: 'REJECTED' })}
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: '10px',
                                                border: '2px solid',
                                                borderColor: reviewData.status === 'REJECTED' ? '#ef4444' : 'var(--gray-10)',
                                                background: reviewData.status === 'REJECTED' ? 'rgba(239, 68, 68, 0.05)' : '#fff',
                                                color: reviewData.status === 'REJECTED' ? '#991b1b' : 'var(--gray-500)',
                                                fontWeight: '600',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <XCircle size={18} /> Reject
                                        </button>
                                    </div>
                                    
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--dark-500)', marginBottom: '8px' }}>
                                        Feedback to Employee {reviewData.status === 'REJECTED' && <span style={{ color: '#ef4444' }}>*</span>}
                                    </label>
                                    <textarea
                                        className="form-input"
                                        rows={4}
                                        style={{ width: '100%', resize: 'none' }}
                                        placeholder={reviewData.status === 'APPROVED' ? "Great work! Keep it up... (Optional)" : "Please provide a reason for rejection... (Required)"}
                                        value={reviewData.adminComments}
                                        onChange={e => setReviewData({ ...reviewData, adminComments: e.target.value })}
                                    />
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--gray-5)', background: 'var(--gray-50)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button onClick={() => { setSelectedAchievement(null); setShowReviewModal(false); }} className="btn-secondary">Close</button>
                            {showReviewModal && (
                                <button 
                                    onClick={handleReview} 
                                    className="btn-primary"
                                    disabled={reviewData.status === 'REJECTED' && !reviewData.adminComments.trim()}
                                >
                                    Submit Recognition
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
