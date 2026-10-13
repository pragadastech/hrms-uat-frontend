import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { extraHoursAPI } from '../services/api';
import {
    Clock,
    Calendar,
    ArrowRight,
    CheckCircle2,
    XCircle,
    Hourglass
} from 'lucide-react';

export default function ExtraHours() {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [requests, setRequests] = useState([]);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        startTime: '',
        endTime: '',
        description: ''
    });
    const [calculatedHours, setCalculatedHours] = useState(0);

    useEffect(() => {
        fetchRequests();
    }, []);

    useEffect(() => {
        if (formData.startTime && formData.endTime) {
            calculateDuration(formData.startTime, formData.endTime);
        } else {
            setCalculatedHours(0);
        }
    }, [formData.startTime, formData.endTime]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await extraHoursAPI.getMyRequests();
            setRequests(res.data || []);
        } catch (error) {
            console.error('Error fetching requests:', error);
            setRequests([]);
        } finally {
            setLoading(false);
        }
    };

    const calculateDuration = (start, end) => {
        const [startHours, startMinutes] = start.split(':').map(Number);
        const [endHours, endMinutes] = end.split(':').map(Number);

        const startDate = new Date();
        startDate.setHours(startHours, startMinutes, 0);

        const endDate = new Date();
        endDate.setHours(endHours, endMinutes, 0);

        if (endDate < startDate) {
            endDate.setDate(endDate.getDate() + 1);
        }

        const diffMs = endDate - startDate;
        const diffHours = diffMs / (1000 * 60 * 60);
        setCalculatedHours(Math.max(0, diffHours.toFixed(2)));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await extraHoursAPI.submitRequest({
                ...formData,
                hours: calculatedHours
            });

            // Refresh list
            fetchRequests();

            setFormData({
                date: new Date().toISOString().split('T')[0],
                startTime: '',
                endTime: '',
                description: ''
            });
            setCalculatedHours(0);
        } catch (error) {
            console.error('Error submitting request:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'APPROVED': return 'var(--success)';
            case 'REJECTED': return 'var(--error)';
            default: return 'var(--warning)';
        }
    };

    const getStatusBg = (status) => {
        switch (status) {
            case 'APPROVED': return 'var(--success-bg)';
            case 'REJECTED': return 'var(--error-bg)';
            default: return 'var(--warning-bg)';
        }
    };

    return (
        <div className="main-content">
            <Header title="Extra Hours" subtitle="Log your overtime" />

            <div className="page-content">
                <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }}>

                    {/* Compact Form Card */}
                    <div className="card no-hover" style={{ padding: '0', overflow: 'hidden' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-10)', background: 'var(--light-5)' }}>
                            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--dark-500)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Clock size={16} className="text-primary-600" style={{ color: 'var(--primary-600)' }} />
                                New Request
                            </h3>
                        </div>

                        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--gray-500)', marginBottom: '6px' }}>Date</label>
                                <div className="input-with-icon" style={{ height: '36px' }}>
                                    <Calendar size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-500)' }} />
                                    <input
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="form-input"
                                        style={{ paddingLeft: '32px', height: '100%', fontSize: '13px' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--gray-500)', marginBottom: '6px' }}>Start</label>
                                    <input
                                        type="time"
                                        required
                                        className="form-input"
                                        value={formData.startTime}
                                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                        style={{ height: '36px', fontSize: '13px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--gray-500)', marginBottom: '6px' }}>End</label>
                                    <input
                                        type="time"
                                        required
                                        className="form-input"
                                        value={formData.endTime}
                                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                        style={{ height: '36px', fontSize: '13px' }}
                                    />
                                </div>
                            </div>

                            {/* Duration Indicator */}
                            <div style={{
                                background: 'var(--primary-5)',
                                border: '1px solid var(--primary-10)',
                                borderRadius: '8px',
                                padding: '10px 14px',
                                marginBottom: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--primary-700)' }}>Total Duration</span>
                                <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary-600)' }}>
                                    {calculatedHours} <span style={{ fontSize: '11px', fontWeight: 500 }}>hrs</span>
                                </span>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--gray-500)', marginBottom: '6px' }}>Work Description</label>
                                <textarea
                                    className="form-input"
                                    rows="3"
                                    placeholder="What did you work on?"
                                    style={{ resize: 'none', padding: '10px', fontSize: '13px' }}
                                    required
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting || calculatedHours <= 0}
                                className="primary-btn"
                                style={{ width: '100%', justifyContent: 'center', height: '40px', fontSize: '13px' }}
                            >
                                {submitting ? 'Submitting...' : 'Submit Request'}
                                {!submitting && <ArrowRight size={16} style={{ marginLeft: '8px' }} />}
                            </button>
                        </form>
                    </div>

                    {/* History List */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--dark-500)', margin: 0 }}>Recent History</h3>
                            <button className="secondary-btn" onClick={fetchRequests} style={{ padding: '4px 10px', fontSize: '11px', height: '28px' }}>Refresh</button>
                        </div>

                        {loading ? (
                            <div className="card no-hover" style={{ padding: '30px', textAlign: 'center', color: 'var(--gray-500)', fontSize: '13px' }}>Loading...</div>
                        ) : requests.length === 0 ? (
                            <div className="card no-hover" style={{ padding: '30px', textAlign: 'center', color: 'var(--gray-500)' }}>
                                <p style={{ fontSize: '13px' }}>No records found</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', paddingRight: '4px' }}>
                                {requests.map((req) => (
                                    <div key={req._id} className="card no-hover" style={{
                                        padding: '12px 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '16px',
                                        border: '1px solid var(--gray-10)'
                                    }}>
                                        {/* Date */}
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            minWidth: '40px',
                                            paddingRight: '16px',
                                            borderRight: '1px solid var(--gray-10)'
                                        }}>
                                            <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--dark-500)', lineHeight: 1 }}>{new Date(req.date).getDate()}</span>
                                            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase' }}>{new Date(req.date).toLocaleString('default', { month: 'short' })}</span>
                                        </div>

                                        {/* Content */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--dark-500)' }}>{req.description}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: 'var(--gray-500)' }}>
                                                <span>{req.startTime} - {req.endTime}</span>
                                                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--gray-20)' }}></span>
                                                <span style={{ fontWeight: 600, color: 'var(--primary-600)' }}>{req.hours} hrs</span>
                                            </div>
                                        </div>

                                        {/* Status */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '140px' }}>
                                            {/* Stepper Logic */}
                                            {(() => {
                                                const steps = [
                                                    { label: 'Pending', status: 'PENDING' },
                                                    { label: 'RM Approved', status: 'RM_APPROVED' },
                                                    { label: 'Approved', status: 'APPROVED' }
                                                ];

                                                // Determine active index
                                                let activeIndex = 0;
                                                if (req.status === 'RM_APPROVED') activeIndex = 1;
                                                if (req.status === 'APPROVED') activeIndex = 2;

                                                const isRejected = req.status === 'REJECTED';

                                                return (
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                        {steps.map((step, index) => {
                                                            const isActive = index <= activeIndex;
                                                            const isLast = index === steps.length - 1;

                                                            let circleColor = 'var(--gray-20)';
                                                            let tickColor = 'var(--gray-500)';

                                                            if (isRejected) {
                                                                // If rejected, only first step might be valid or all gray except rejected state
                                                                if (index === 0) { circleColor = 'var(--gray-20)'; tickColor = 'var(--gray-500)'; }
                                                                // This simple logic assumes rejection stops strictly at the current stage, 
                                                                // but for simplicity, we'll just show Rejected state separately or override.
                                                                // Actually, user asked for "pending, rejected" visual. 
                                                                // Let's keep it simple: if rejected, show special rejected badge instead of stepper
                                                                // OR show stepper with red X.
                                                            } else if (isActive) {
                                                                circleColor = 'var(--success)';
                                                                tickColor = 'white';
                                                                if (step.status === 'PENDING' && req.status === 'PENDING') {
                                                                    // Current active step - maybe yellow/orange?
                                                                    circleColor = 'var(--warning)';
                                                                }
                                                            }

                                                            return (
                                                                <React.Fragment key={index}>
                                                                    <div title={step.label} style={{
                                                                        width: '12px', height: '12px', borderRadius: '50%',
                                                                        background: isRejected ? (index === activeIndex ? 'var(--error)' : 'var(--gray-20)') : circleColor,
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                        position: 'relative'
                                                                    }}>
                                                                        {/* Tooltip label or tiny indicator */}
                                                                    </div>
                                                                    {!isLast && (
                                                                        <div style={{ flex: 1, height: '2px', background: isActive && !isRejected ? 'var(--success)' : 'var(--gray-10)', margin: '0 2px' }} />
                                                                    )}
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}

                                            {/* Text Status */}
                                            <div style={{ textAlign: 'right', fontSize: '10px', fontWeight: 600, color: req.status === 'REJECTED' ? 'var(--error)' : 'var(--gray-500)' }}>
                                                {req.status === 'RM_APPROVED' ? 'RM Approved' : req.status}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
