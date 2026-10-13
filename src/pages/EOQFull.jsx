import React, { useEffect, useState, useMemo } from 'react';
import { employeeOfQuarterAPI, eoqAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    Trophy, Award, History, Plus, Users, 
    Calendar, ArrowRight, Star, Quote, 
    ChevronRight, Sparkles, Medal
} from 'lucide-react';
import Header from '../components/Header';

const WINNER_STATUSES = ['PUBLISHED', 'APPROVED'];

const normalizeEoqRecord = (raw) => {
    if (!raw) return null;
    const displayName =
        raw.name ||
        raw.employeeName ||
        raw.candidateName ||
        [raw.firstName, raw.lastName].filter(Boolean).join(' ').trim() ||
        'Unknown';

    let quarter = raw.quarter;
    let year = raw.year;
    if ((!quarter || year == null) && raw.quarterYear) {
        const match = String(raw.quarterYear).match(/(Q[1-4])\s*(\d{4})?/i);
        if (match) {
            quarter = quarter || match[1]?.toUpperCase();
            if (year == null && match[2]) year = Number(match[2]);
        }
    }

    return {
        ...raw,
        displayName,
        quarter,
        year,
        notes: raw.notes || raw.reason || raw.selectionReason || raw.reviewNotes,
    };
};

const sortEoqByRecency = (list) =>
    [...list].sort((a, b) => {
        const ta = a.updatedAt || a.createdAt || 0;
        const tb = b.updatedAt || b.createdAt || 0;
        return new Date(tb).getTime() - new Date(ta).getTime();
    });

const fetchPublishedNominations = async () => {
    for (const status of WINNER_STATUSES) {
        try {
            const resp = await eoqAPI.getNominationsByStatus(status);
            const list = resp?.data;
            if (Array.isArray(list) && list.length) return sortEoqByRecency(list);
        } catch {
            // try next status
        }
    }
    return [];
};

export default function EOQFull() {
    const [current, setCurrent] = useState(null);
    const [history, setHistory] = useState([]);
    const [myNominations, setMyNominations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const { getCurrentUser, hasAdminAccess } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        let mounted = true;
        const fetch = async () => {
            try {
                setLoading(true);
                setFetchError(null);
                const currentUser = getCurrentUser();
                const nominatorId =
                    currentUser?.employeeId ||
                    currentUser?.employee_id ||
                    currentUser?.id ||
                    null;

                const [cur, histResp, myResp] = await Promise.allSettled([
                    employeeOfQuarterAPI.getCurrentEmployeeOfTheQuarter(),
                    employeeOfQuarterAPI.getHistoricalEmployeesOfTheQuarter(),
                    nominatorId ? eoqAPI.getMyNominations(nominatorId) : Promise.resolve({ data: [] }),
                ]);

                if (!mounted) return;

                const curData = cur.status === 'fulfilled' ? cur.value : null;
                const histData = histResp.status === 'fulfilled' ? histResp.value : null;
                const myData = myResp.status === 'fulfilled' ? myResp.value?.data : [];

                setMyNominations(Array.isArray(myData) ? myData : []);

                if (curData) {
                    const histList = Array.isArray(histData) ? histData : histData ? [histData] : [];
                    setCurrent(normalizeEoqRecord(curData));
                    setHistory(histList.map(normalizeEoqRecord).filter(Boolean));
                    return;
                }

                const histList = Array.isArray(histData) ? histData : histData ? [histData] : [];
                if (histList.length) {
                    const normalized = sortEoqByRecency(histList.map(normalizeEoqRecord).filter(Boolean));
                    setHistory(normalized);
                    setCurrent(normalized[0] || null);
                    return;
                }

                const nominations = await fetchPublishedNominations();
                if (!mounted) return;
                const normalized = nominations.map(normalizeEoqRecord).filter(Boolean);
                setHistory(normalized);
                setCurrent(normalized[0] || null);
            } catch (e) {
                console.error('EOQ fetch failed', e);
                if (mounted) {
                    setFetchError('Unable to load Employee of the Quarter data. Please try again.');
                    setCurrent(null);
                    setHistory([]);
                }
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetch();
        return () => { mounted = false; };
    }, [getCurrentUser]);

    const myStats = useMemo(
        () => ({
            total: myNominations.length,
            approved: myNominations.filter((n) => WINNER_STATUSES.includes(n.status)).length,
            pending: myNominations.filter((n) => n.status === 'PENDING').length,
        }),
        [myNominations]
    );

    const isAdmin = hasAdminAccess();

    return (
        <div className="main-content">
            <Header 
                title="Hall of Fame" 
                subtitle="Celebrating our exceptional stars and their milestones" 
            />

            <div className="page-content" style={{ padding: '14px 16px 20px' }}>

                {fetchError && (
                    <div className="card" style={{ padding: '12px 14px', marginBottom: '12px', borderColor: 'var(--red-200)', background: 'var(--red-50)' }}>
                        <p style={{ margin: 0, color: 'var(--red-700)' }}>{fetchError}</p>
                    </div>
                )}

                {/* Personal Stats & Actions */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '14px', alignItems: 'stretch' }}>
                    <div className="card" style={{ flex: 1, minWidth: '280px', padding: '14px 16px', display: 'flex', gap: '14px', background: 'var(--primary-5)', border: '1px solid var(--primary-10)' }}>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary-700)', textTransform: 'uppercase', marginBottom: '10px' }}>My Participation</h3>
                            <div style={{ display: 'flex', gap: '20px' }}>
                                <div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--dark-500)' }}>{myStats.total}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>Nominations</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--emerald-600)' }}>{myStats.approved}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>Approved</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--amber-600)' }}>{myStats.pending}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>Pending</div>
                                </div>
                            </div>
                        </div>
                        <div style={{ width: '1px', background: 'var(--primary-10)' }}></div>
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
                            <button 
                                onClick={() =>
                                    navigate('/employee/eoq/nominate', {
                                        state: { returnTo: location.state?.returnTo || location.pathname },
                                    })
                                }
                                className="btn-primary"
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', height: '34px', width: '100%', fontSize: '13px', boxSizing: 'border-box' }}
                            >
                                <Plus size={16} /> New Nomination
                            </button>
                            {isAdmin && (
                                <button 
                                    onClick={() => navigate('/admin/eoq/review')}
                                    className="btn-secondary"
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', height: '34px', width: '100%', background: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
                                >
                                    <Star size={16} /> Admin Review
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Spotlight Section */}
                <div style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <div style={{ padding: '6px', background: 'var(--amber-50)', color: 'var(--amber-600)', borderRadius: '10px' }}>
                            <Medal size={18} />
                        </div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--dark-500)', margin: 0 }}>Current Employee of the Quarter</h2>
                    </div>

                    {loading ? (
                        <div className="card" style={{ padding: '28px 16px', textAlign: 'center' }}>
                            <div className="animate-spin" style={{ margin: '0 auto 12px' }}><Sparkles size={28} color="var(--primary-600)" /></div>
                            <p style={{ color: 'var(--gray-500)', margin: 0 }}>Loading our stars...</p>
                        </div>
                    ) : current ? (
                        <div className="card" style={{ 
                            background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', 
                            color: '#fff',
                            padding: '0',
                            overflow: 'hidden',
                            position: 'relative'
                        }}>
                            <div style={{ position: 'absolute', right: '-30px', top: '-30px', opacity: 0.1 }}>
                                <Trophy size={180} />
                            </div>
                            
                            <div style={{ display: 'flex', flexWrap: 'wrap', position: 'relative', zIndex: 2 }}>
                                <div style={{ 
                                    padding: '16px 18px', 
                                    flex: '1', 
                                    minWidth: '260px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center'
                                }}>
                                    <div style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '6px', 
                                        padding: '4px 10px', 
                                        background: 'rgba(255,215,0,0.15)', 
                                        color: '#ffd700', 
                                        borderRadius: '99px',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        marginBottom: '12px',
                                        width: 'fit-content'
                                    }}>
                                        <Sparkles size={12} />
                                        WINNER: {current.quarter || current.quarterYear || '—'} {current.year ?? ''}
                                    </div>
                                    <h1 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                                        {current.displayName}
                                    </h1>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', color: 'rgba(255,255,255,0.7)' }}>
                                        <Users size={16} />
                                        <span style={{ fontSize: '14px' }}>Excellence in Contribution</span>
                                    </div>
                                    
                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                                        <Quote size={18} style={{ marginBottom: '8px', color: '#ffd700' }} />
                                        <p style={{ fontSize: '13px', lineHeight: '1.6', fontStyle: 'italic', color: 'rgba(255,255,255,0.9)', margin: 0 }}>
                                            {current.notes || "Exceptional performance and dedication towards organizational goals."}
                                        </p>
                                    </div>
                                </div>
                                
                                <div style={{ 
                                    width: '280px', 
                                    maxWidth: '100%',
                                    background: 'rgba(255,255,255,0.03)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '16px',
                                    borderLeft: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ 
                                            position: 'absolute', 
                                            inset: '-8px', 
                                            background: 'linear-gradient(45deg, #ffd700, #ff8c00)', 
                                            borderRadius: '20px', 
                                            opacity: 0.3,
                                            filter: 'blur(12px)'
                                        }}></div>
                                        <img 
                                            src={current.avatar || current.profilePhoto || '/public/default-avatar.png'} 
                                            alt="Winner" 
                                            style={{ 
                                                width: '160px', 
                                                height: '160px', 
                                                objectFit: 'cover', 
                                                borderRadius: '16px',
                                                border: '3px solid rgba(255,255,255,0.2)',
                                                position: 'relative',
                                                zIndex: 3
                                            }} 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="card" style={{ padding: '28px 16px', textAlign: 'center', borderStyle: 'dashed' }}>
                            <Trophy size={40} style={{ color: 'var(--gray-200)', margin: '0 auto 12px' }} />
                            <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--dark-500)', marginBottom: '4px' }}>The stage is set!</h3>
                            <p style={{ color: 'var(--gray-500)', maxWidth: '400px', margin: '0 auto', fontSize: '13px' }}>No employee has been selected for the current quarter yet. Be the one to nominate a deserving colleague.</p>
                        </div>
                    )}
                </div>

                {/* History Section */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <div style={{ padding: '6px', background: 'var(--indigo-50)', color: 'var(--indigo-600)', borderRadius: '10px' }}>
                            <History size={16} />
                        </div>
                        <h2 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--dark-500)', margin: 0 }}>Previous Winners</h2>
                    </div>

                    {!loading && history.length > 1 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                            {history.filter((_, idx) => idx !== 0 || !current).map((h, idx) => (
                                <div key={idx} className="card" style={{ padding: '12px 14px', display: 'flex', gap: '12px', alignItems: 'center', transition: 'transform 0.2s' }}>
                                    <img 
                                        src={h.avatar || h.profilePhoto || '/public/default-avatar.png'} 
                                        alt="Winner" 
                                        style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '10px' }} 
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary-600)', textTransform: 'uppercase', marginBottom: '2px' }}>
                                            {h.quarter || h.quarterYear || '—'} {h.year ?? ''}
                                        </div>
                                        <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--dark-500)', marginBottom: '2px' }}>
                                            {h.displayName}
                                        </h4>
                                        <div style={{ fontSize: '11px', color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Award size={12} /> Outstanding Star
                                        </div>
                                    </div>
                                    <button className="btn-icon-sm" style={{ background: 'var(--gray-50)' }}>
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : !loading && (
                        <div style={{ padding: '24px 16px', textAlign: 'center', background: 'var(--gray-50)', borderRadius: '10px', border: '1px solid var(--gray-10)' }}>
                            <p style={{ color: 'var(--gray-500)', fontStyle: 'italic', margin: 0, fontSize: '13px' }}>Historical winners will appear here once archived.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
