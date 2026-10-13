import React, { useState, useEffect, useMemo } from 'react';
import {
    Trophy, Plus, Calendar, Clock, CheckCircle, XCircle,
    AlertCircle, ChevronRight, MessageSquare, Sparkles, Award,
    History, Send, RefreshCw, X
} from 'lucide-react';
import { achievementAPI } from '../services/api';
import Header from '../components/Header';
import { toast } from 'react-hot-toast';

export default function Achievements() {
    const [achievements, setAchievements] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showApplyModal, setShowApplyModal] = useState(false);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [currentMonth, setCurrentMonth] = useState('');

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
            setAchievements(Array.isArray(res.data) ? res.data : []);
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
            // Pre-fill month
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
        if (!formData.title || !formData.description || !formData.monthYear) {
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
        return { approved, pending };
    }, [achievements]);

    const getStatusStyle = (status) => {
        const styles = {
            PENDING: { bg: 'rgba(245, 158, 11, 0.1)', color: '#b45309', icon: <Clock size={12} /> },
            APPROVED: { bg: 'rgba(16, 185, 129, 0.1)', color: '#065f46', icon: <CheckCircle size={12} /> },
            REJECTED: { bg: 'rgba(239, 68, 68, 0.1)', color: '#991b1b', icon: <XCircle size={12} /> }
        };
        return styles[status] || { bg: 'var(--gray-50)', color: 'var(--gray-500)', icon: null };
    };

    return (
        <div className="main-content">
            <Header title="Recognition Hub" subtitle="Celebrate your milestones and achievements" />

            <div className="page-content" style={{ padding: '14px 16px 20px' }}>

                {/* Banner */}
                <div style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    color: '#white',
                    boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.3)',
                    marginBottom: '12px',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                }}>
                    <div style={{ position: 'relative', zIndex: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ padding: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '10px', backdropFilter: 'blur(10px)' }}>
                                <Sparkles size={18} color="#fff" />
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.9)' }}>
                                Monthly Recognition
                            </span>
                        </div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#fff', marginBottom: '6px', maxWidth: '600px', lineHeight: '1.2' }}>
                            Share Your Success, {new Date().toLocaleDateString(undefined, { month: 'long' })}!
                        </h2>
                        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', marginBottom: '12px', maxWidth: '500px', lineHeight: '1.5' }}>
                            Your contributions drive our culture forward. Tell us about your wins and get recognized by the community.
                        </p>
                        
                        {!hasSubmitted ? (
                            <button
                                onClick={() => setShowApplyModal(true)}
                                style={{
                                    backgroundColor: '#fff',
                                    color: '#6366f1',
                                    padding: '0 14px',
                                    height: '36px',
                                    borderRadius: '10px',
                                    fontWeight: '700',
                                    fontSize: '13px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    transition: 'all 0.2s',
                                    boxSizing: 'border-box'
                                }}
                            >
                                <Plus size={18} /> Submit Achievement
                            </button>
                        ) : (
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 12px',
                                background: 'rgba(255,255,255,0.1)',
                                borderRadius: '10px',
                                border: '1px solid rgba(255,255,255,0.2)',
                                backdropFilter: 'blur(10px)',
                                color: '#fff',
                                fontSize: '13px',
                                fontWeight: '600'
                            }}>
                                <CheckCircle size={18} style={{ color: '#4ade80' }} />
                                Recognition submitted for this month
                            </div>
                        )}
                    </div>
                    {/* Decorative Background Icon */}
                    <Trophy size={180} style={{ position: 'absolute', right: '-20px', bottom: '-40px', color: 'rgba(255,255,255,0.08)', transform: 'rotate(15deg)' }} />
                </div>

                {/* Summary Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                    <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '10px' }}>
                            <Award size={20} />
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', color: 'var(--gray-500)', fontWeight: '600', marginBottom: '2px' }}>Approved Awards</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--dark-500)' }}>{stats.approved}</div>
                        </div>
                    </div>
                    <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', borderRadius: '10px' }}>
                            <History size={20} />
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', color: 'var(--gray-500)', fontWeight: '600', marginBottom: '2px' }}>Total Submissions</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--dark-500)' }}>{achievements.length}</div>
                        </div>
                    </div>
                </div>

                {/* History Section */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--dark-500)' }}>Recognition Timeline</h3>
                    <div style={{ height: '1px', flex: 1, background: 'var(--gray-10)' }}></div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '28px 16px' }}>
                        <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--primary-600)', margin: '0 auto 12px' }} />
                        <p style={{ color: 'var(--gray-500)' }}>Loading history...</p>
                    </div>
                ) : achievements.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '28px 16px', borderStyle: 'dashed' }}>
                        <Trophy size={40} style={{ color: 'var(--gray-200)', margin: '0 auto 12px' }} />
                        <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--dark-500)', marginBottom: '4px' }}>Your wall of fame is empty</h4>
                        <p style={{ fontSize: '13px', color: 'var(--gray-500)', maxWidth: '300px', margin: '0 auto' }}>Submit your first achievement to start your recognition journey.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '12px' }}>
                        {achievements.map(ach => {
                            const style = getStatusStyle(ach.status);
                            return (
                                <div key={ach.id} className="card" style={{ padding: '0', overflow: 'hidden', borderLeft: `4px solid ${style.color}` }}>
                                    <div style={{ padding: '14px 16px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary-600)', background: 'var(--primary-5)', padding: '3px 8px', borderRadius: '6px' }}>
                                                    {new Date(ach.monthYear).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                                </div>
                                                <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--dark-500)' }}>{ach.title}</h4>
                                            </div>
                                            <span style={{ 
                                                backgroundColor: style.bg, 
                                                color: style.color,
                                                padding: '3px 8px',
                                                borderRadius: '99px',
                                                fontSize: '11px',
                                                fontWeight: '700',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                {style.icon}
                                                {ach.status}
                                            </span>
                                        </div>
                                        
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                            <div style={{ flex: 1, minWidth: '240px' }}>
                                                <p style={{ fontSize: '13px', color: 'var(--gray-600)', lineHeight: '1.5', background: 'var(--gray-50)', padding: '12px', borderRadius: '10px', marginBottom: '10px' }}>
                                                    {ach.description}
                                                </p>
                                                <div style={{ fontSize: '12px', color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Clock size={14} /> Submitted on {new Date(ach.submittedAt).toLocaleDateString()}
                                                </div>
                                            </div>

                                            {ach.adminComments && (
                                                <div style={{ width: '100%', maxWidth: '320px', background: 'var(--primary-5)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--primary-10)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-700)', fontWeight: '700', fontSize: '12px', marginBottom: '6px' }}>
                                                        <MessageSquare size={14} /> Admin Feedback
                                                    </div>
                                                    <p style={{ fontSize: '13px', color: 'var(--primary-800)', fontStyle: 'italic', lineHeight: '1.5' }}>
                                                        "{ach.adminComments}"
                                                    </p>
                                                </div>
                                            )}
                                        </div>
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
                    <div className="card" style={{ width: '100%', maxWidth: '650px', padding: '0' }}>
                        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--gray-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ padding: '8px', background: 'var(--primary-5)', color: 'var(--primary-600)', borderRadius: '10px' }}>
                                    <Send size={18} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.05rem', fontWeight: '800' }}>Submit Recognition</h3>
                                    <p style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                                        Sharing wins for {new Date(formData.monthYear).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowApplyModal(false)} className="btn-icon-sm"><X size={20} /></button>
                        </div>
                        
                        <form onSubmit={handleSubmit} style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'grid', gap: '12px', marginBottom: '14px' }}>
                                <div>
                                    <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>Achievement Title</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        style={{ width: '100%' }}
                                        required
                                        maxLength={255}
                                        placeholder="Briefly state your achievement (e.g., Closed Q3 targets early)"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <label className="form-label">Full Description</label>
                                        <span style={{ fontSize: '11px', color: formData.description.length > 900 ? '#ef4444' : 'var(--gray-400)' }}>
                                            {formData.description.length}/1000 characters
                                        </span>
                                    </div>
                                    <textarea
                                        className="form-input"
                                        style={{ width: '100%', resize: 'none', minHeight: '90px' }}
                                        rows={4}
                                        required
                                        maxLength={1000}
                                        placeholder="Tell us about the impact of your work, any metrics, or who you collaborated with..."
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                            </div>
                            
                            <div style={{ padding: '12px 14px', background: 'var(--amber-50)', borderRadius: '10px', display: 'flex', gap: '10px', marginBottom: '14px' }}>
                                <AlertCircle size={16} style={{ color: 'var(--amber-600)', flexShrink: 0 }} />
                                <p style={{ fontSize: '12px', color: 'var(--amber-700)', lineHeight: '1.5' }}>
                                    Your submission will be reviewed by the culture team. Approved achievements will be featured on the organization wall of fame!
                                </p>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button type="button" onClick={() => setShowApplyModal(false)} className="btn-secondary">Cancel</button>
                                <button type="submit" className="btn-primary" style={{ padding: '0 16px', height: '36px' }}>Submit Now</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
