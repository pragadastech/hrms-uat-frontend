import React, { useEffect, useState } from 'react';
import { eoqAPI } from '../services/api';
import toast from 'react-hot-toast';
import Header from '../components/Header';
import { 
    CheckCircle, XCircle, Star, ExternalLink, 
    MessageSquare, User, Calendar, Clock, 
    AlertCircle, Search, Filter, RefreshCw
} from 'lucide-react';

const normalizeEoqStatus = (status) => {
    const value = String(status || '').trim().toUpperCase();
    if (value === 'SHORTLIST') return 'SHORTLISTED';
    return value;
};

const mergeNominations = (lists) => {
    const byId = new Map();
    lists.flat().forEach((item) => {
        if (item?.id != null) {
            byId.set(item.id, item);
        }
    });
    return Array.from(byId.values());
};

const EOQReview = () => {
    const [nominations, setNominations] = useState([]);
    const [allNominations, setAllNominations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [pendingResult, approvedResult, shortlistedResult, rejectedResult] = await Promise.allSettled([
                eoqAPI.getPendingNominations(),
                eoqAPI.getNominationsByStatus('APPROVED'),
                eoqAPI.getNominationsByStatus('SHORTLISTED'),
                eoqAPI.getNominationsByStatus('REJECTED'),
            ]);

            const pending = pendingResult.status === 'fulfilled' ? (pendingResult.value.data || []) : [];
            const approved = approvedResult.status === 'fulfilled' ? (approvedResult.value.data || []) : [];
            const shortlisted = shortlistedResult.status === 'fulfilled' ? (shortlistedResult.value.data || []) : [];
            const rejected = rejectedResult.status === 'fulfilled' ? (rejectedResult.value.data || []) : [];

            setNominations(pending);
            setAllNominations(mergeNominations([pending, approved, shortlisted, rejected]));
        } catch (err) {
            console.error(err);
            toast.error('Failed to load nominations');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAllData(); }, []);

    const stats = React.useMemo(() => ({
        pending: nominations.length,
        shortlisted: allNominations.filter((n) => normalizeEoqStatus(n.status) === 'SHORTLISTED').length,
        approved: allNominations.filter((n) => normalizeEoqStatus(n.status) === 'APPROVED').length,
        rejected: allNominations.filter((n) => normalizeEoqStatus(n.status) === 'REJECTED').length,
    }), [nominations, allNominations]);

    const handleAction = async (id, action) => {
        try {
            const response = await eoqAPI.reviewNomination(id, 'ADMIN', action, `${action} via Admin Hub`);
            const updated = response?.data;

            setNominations((prev) => prev.filter((n) => n.id !== id));
            setAllNominations((prev) => {
                const remaining = prev.filter((n) => n.id !== id);
                if (updated?.id) {
                    return [...remaining, updated];
                }
                return remaining;
            });

            toast.success(`Nomination ${action.toLowerCase()} successfully`);
            fetchAllData();
        } catch (err) {
            console.error(err);
            toast.error('Action failed');
        }
    };

    const filteredNominations = nominations.filter(n => 
        n.candidateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.candidateEmployeeId?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="main-content">
            <Header 
                title="Nomination Review" 
                subtitle="Evaluate and celebrate the outstanding stars of this quarter" 
            />
            
            <div className="page-content" style={{ padding: '14px 16px 20px' }}>
                {/* Statistics Dashboard */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                    <div className="card" style={{ padding: '12px 14px', borderLeft: '4px solid var(--amber-500)', background: 'var(--amber-50)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <div style={{ padding: '6px', background: '#fff', borderRadius: '8px', color: 'var(--amber-600)' }}><Clock size={16} /></div>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--amber-800)', textTransform: 'uppercase' }}>Pending</span>
                        </div>
                        <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--amber-900)' }}>{stats.pending}</div>
                    </div>
                    <div className="card" style={{ padding: '12px 14px', borderLeft: '4px solid var(--indigo-500)', background: 'var(--indigo-50)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <div style={{ padding: '6px', background: '#fff', borderRadius: '8px', color: 'var(--indigo-600)' }}><Star size={16} /></div>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--indigo-800)', textTransform: 'uppercase' }}>Shortlisted</span>
                        </div>
                        <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--indigo-900)' }}>{stats.shortlisted}</div>
                    </div>
                    <div className="card" style={{ padding: '12px 14px', borderLeft: '4px solid var(--emerald-500)', background: 'var(--emerald-50)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <div style={{ padding: '6px', background: '#fff', borderRadius: '8px', color: 'var(--emerald-600)' }}><CheckCircle size={16} /></div>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--emerald-800)', textTransform: 'uppercase' }}>Approved</span>
                        </div>
                        <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--emerald-900)' }}>{stats.approved}</div>
                    </div>
                    <div className="card" style={{ padding: '12px 14px', borderLeft: '4px solid var(--rose-500)', background: 'var(--rose-50)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <div style={{ padding: '6px', background: '#fff', borderRadius: '8px', color: 'var(--rose-600)' }}><XCircle size={16} /></div>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--rose-800)', textTransform: 'uppercase' }}>Rejected</span>
                        </div>
                        <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--rose-900)' }}>{stats.rejected}</div>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="card" style={{ padding: '10px 12px', marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '240px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                            <input
                                type="text"
                                placeholder="Search candidates..."
                                className="form-input"
                                style={{ paddingLeft: '36px', width: '100%', height: '34px' }}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <button
                        onClick={fetchAllData}
                        className="btn-icon"
                        style={{ background: 'var(--white-5)', border: '1px solid var(--gray-10)' }}
                        title="Refresh"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {loading && nominations.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '28px 16px' }}>
                        <RefreshCw size={32} className="animate-spin text-primary-600" style={{ margin: '0 auto 12px' }} />
                        <p style={{ color: 'var(--gray-500)' }}>Fetching nominations...</p>
                    </div>
                ) : filteredNominations.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '28px 16px', borderStyle: 'dashed' }}>
                        <Star size={40} style={{ color: 'var(--gray-200)', margin: '0 auto 12px' }} />
                        <h4 style={{ color: 'var(--dark-500)', fontWeight: '600', marginBottom: '4px' }}>No pending nominations</h4>
                        <p style={{ color: 'var(--gray-500)', fontSize: '13px' }}>All caught up! Check back later for new submissions.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                        {filteredNominations.map(n => (
                            <div key={n.id} className="card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--gray-5)', background: 'var(--gray-50)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '36px', height: '36px', background: 'var(--primary-600)', color: '#fff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700' }}>
                                            {n.candidateName?.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--dark-500)' }}>{n.candidateName}</h3>
                                            <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>ID: {n.candidateEmployeeId}</div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary-600)' }}>{n.quarter} {n.year}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>Submitted: {new Date(n.createdAt).toLocaleDateString()}</div>
                                    </div>
                                </div>

                                <div style={{ padding: '12px 14px', flex: 1 }}>
                                    <div style={{ marginBottom: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--gray-400)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px' }}>
                                            <MessageSquare size={12} /> Reason for Nomination
                                        </div>
                                        <p style={{ fontSize: '13px', color: 'var(--gray-700)', lineHeight: '1.5', background: 'var(--gray-50)', padding: '10px 12px', borderRadius: '10px' }}>
                                            {n.reason}
                                        </p>
                                    </div>

                                    {n.evidenceLinks && (
                                        <div style={{ marginBottom: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--gray-400)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px' }}>
                                                <ExternalLink size={12} /> Evidence & Supporting Docs
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {n.evidenceLinks.split(',').map((u, i) => (
                                                    <a 
                                                        key={i} 
                                                        href={u.trim()} 
                                                        target="_blank" 
                                                        rel="noreferrer"
                                                        style={{ 
                                                            fontSize: '11px', 
                                                            color: 'var(--primary-600)', 
                                                            background: 'var(--primary-5)', 
                                                            padding: '4px 8px', 
                                                            borderRadius: '6px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            textDecoration: 'none',
                                                            fontWeight: '600'
                                                        }}
                                                    >
                                                        Link {i+1} <ExternalLink size={10} />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ fontSize: '12px', color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <User size={14} /> Nominated by: <span style={{ fontWeight: '600' }}>{n.nominatorEmployeeId}</span>
                                    </div>
                                </div>

                                <div style={{ padding: '10px 12px', borderTop: '1px solid var(--gray-5)', background: 'var(--gray-50)', display: 'flex', gap: '8px' }}>
                                    <button 
                                        className="btn-secondary" 
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#fff', height: '34px', fontSize: '12px' }}
                                        onClick={() => handleAction(n.id, 'SHORTLIST')}
                                    >
                                        <Star size={14} /> Shortlist
                                    </button>
                                    <button 
                                        className="btn-primary" 
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '34px', fontSize: '12px' }}
                                        onClick={() => handleAction(n.id, 'APPROVE')}
                                    >
                                        <CheckCircle size={14} /> Approve
                                    </button>
                                    <button 
                                        className="btn-danger" 
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '34px', fontSize: '12px' }}
                                        onClick={() => handleAction(n.id, 'REJECT')}
                                    >
                                        <XCircle size={14} /> Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EOQReview;
