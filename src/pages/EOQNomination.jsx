import React, { useState } from 'react';
import { eoqAPI } from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import { 
    User, IdCard, MessageSquare, Link as LinkIcon, 
    Calendar, CheckCircle2, AlertCircle, Send, X 
} from 'lucide-react';

const EOQNomination = () => {
    const [candidateEmployeeId, setCandidateEmployeeId] = useState('');
    const [candidateName, setCandidateName] = useState('');
    const [reason, setReason] = useState('');
    const [evidenceLinks, setEvidenceLinks] = useState('');
    const [quarter, setQuarter] = useState('Q1');
    const [year, setYear] = useState(new Date().getFullYear());
    const navigate = useNavigate();
    const location = useLocation();
    const { getCurrentUser } = useAuth();
    const currentUser = getCurrentUser();
    const derivedNominatorId = currentUser?.employeeId || currentUser?.employee_id || currentUser?.id || currentUser?.employeeIdString || null;
    const derivedName = `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim();
    const [nominateSelf, setNominateSelf] = useState(false);

    const handleCancel = () => {
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        const returnTo = location.state?.returnTo;
        const destination =
            typeof returnTo === 'string' &&
            returnTo.startsWith('/') &&
            returnTo !== '/employee/eoq/nominate'
                ? returnTo
                : '/achievements';
        navigate(destination, { replace: true, state: null });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { candidateEmployeeId, candidateName, reason, evidenceLinks, quarter, year };
            const nominatorIdToSend = nominateSelf ? derivedNominatorId : undefined;
            await eoqAPI.submitNomination(payload, nominatorIdToSend);
            toast.success('Nomination submitted successfully!');
            navigate('/eoq');
        } catch (err) {
            console.error(err);
            toast.error('Failed to submit nomination');
        }
    };

    return (
        <div className="main-content">
            <Header 
                title="Nominate a Star" 
                subtitle="Recognize the hard work and dedication of your colleagues" 
            />
            
            <div className="page-content" style={{ padding: '14px 16px 20px', maxWidth: '100%' }}>
                <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 16px', background: 'var(--primary-600)', color: '#fff' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '2px' }}>Nomination Form</h3>
                        <p style={{ fontSize: '12px', opacity: 0.9, margin: 0 }}>Fill out the details below to nominate an employee of the quarter.</p>
                    </div>
                    
                    <form onSubmit={handleSubmit} style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                            <div className="hr-form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                                    <IdCard size={14} className="text-primary-600" /> Candidate Employee ID
                                </label>
                                <input 
                                    required 
                                    className="form-input" 
                                    style={{ width: '100%', height: '34px' }}
                                    placeholder="e.g. EMP123"
                                    value={candidateEmployeeId} 
                                    onChange={e => setCandidateEmployeeId(e.target.value)} 
                                    disabled={nominateSelf}
                                />
                            </div>
                            <div className="hr-form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                                    <User size={14} className="text-primary-600" /> Candidate Name
                                </label>
                                <input 
                                    required 
                                    className="form-input" 
                                    style={{ width: '100%', height: '34px' }}
                                    placeholder="Enter full name"
                                    value={candidateName} 
                                    onChange={e => setCandidateName(e.target.value)} 
                                    disabled={nominateSelf}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '14px' }}>
                            <label style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '10px', 
                                padding: '10px 12px', 
                                background: nominateSelf ? 'var(--primary-5)' : 'var(--gray-50)', 
                                border: '1px solid',
                                borderColor: nominateSelf ? 'var(--primary-20)' : 'var(--gray-10)',
                                borderRadius: '10px', 
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}>
                                <input 
                                    type="checkbox" 
                                    checked={nominateSelf} 
                                    onChange={(e) => {
                                        const val = e.target.checked;
                                        setNominateSelf(val);
                                        if (val && derivedNominatorId) {
                                            setCandidateEmployeeId(derivedNominatorId);
                                            setCandidateName(derivedName);
                                        } else {
                                            setCandidateEmployeeId('');
                                            setCandidateName('');
                                        }
                                    }} 
                                    style={{ width: '16px', height: '16px' }}
                                />
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: nominateSelf ? 'var(--primary-700)' : 'var(--dark-500)' }}>Nominate Myself</div>
                                    <div style={{ fontSize: '11px', color: nominateSelf ? 'var(--primary-600)' : 'var(--gray-500)' }}>I want to showcase my own achievements for this quarter</div>
                                </div>
                            </label>
                        </div>

                        <div className="hr-form-group" style={{ marginBottom: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600' }}>
                                    <MessageSquare size={14} className="text-primary-600" /> Reason for Nomination
                                </label>
                                <span style={{ fontSize: '11px', color: 'var(--gray-400)' }}>{reason.length}/1000</span>
                            </div>
                            <textarea 
                                rows={4} 
                                required 
                                className="form-input" 
                                style={{ width: '100%', resize: 'none', minHeight: '90px' }}
                                placeholder="Describe why this candidate deserves to be the Employee of the Quarter..."
                                value={reason} 
                                onChange={e => setReason(e.target.value)} 
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                            <div className="hr-form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                                    <LinkIcon size={14} className="text-primary-600" /> Evidence Links
                                </label>
                                <input 
                                    className="form-input" 
                                    style={{ width: '100%', height: '34px' }}
                                    placeholder="Comma separated URLs"
                                    value={evidenceLinks} 
                                    onChange={e => setEvidenceLinks(e.target.value)} 
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div className="hr-form-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                                        <Calendar size={14} className="text-primary-600" /> Quarter
                                    </label>
                                    <select 
                                        className="form-input" 
                                        style={{ width: '100%', height: '34px' }}
                                        value={quarter} 
                                        onChange={e => setQuarter(e.target.value)}
                                    >
                                        <option value="Q1">Q1</option>
                                        <option value="Q2">Q2</option>
                                        <option value="Q3">Q3</option>
                                        <option value="Q4">Q4</option>
                                    </select>
                                </div>
                                <div className="hr-form-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                                        Year
                                    </label>
                                    <input 
                                        type="number" 
                                        className="form-input" 
                                        style={{ width: '100%', height: '34px' }}
                                        value={year} 
                                        onChange={e => setYear(Number(e.target.value))} 
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--gray-10)', paddingTop: '14px' }}>
                            <button 
                                type="button" 
                                onClick={handleCancel} 
                                className="btn-secondary" 
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '36px' }}
                            >
                                <X size={16} /> Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="btn-primary" 
                                style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '36px' }}
                            >
                                <Send size={16} /> Submit Nomination
                            </button>
                        </div>
                    </form>
                </div>

                <div style={{ marginTop: '12px', padding: '12px 14px', background: 'var(--primary-5)', borderRadius: '10px', border: '1px solid var(--primary-10)', display: 'flex', gap: '10px' }}>
                    <AlertCircle size={18} className="text-primary-600" style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: '12px', color: 'var(--primary-800)', lineHeight: '1.5' }}>
                        <strong>Did you know?</strong> High-quality nominations usually include specific metrics, examples of teamwork, and links to successful project outcomes. Your feedback helps our culture thrive!
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EOQNomination;
