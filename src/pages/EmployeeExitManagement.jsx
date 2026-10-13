import React, { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import {
    LogOut, Plus, Upload, Clock, FileText,
    Archive, FileCheck, ArrowRight, MessageSquare, RefreshCw,
    Check, Briefcase, X, Star, ChevronLeft, ChevronRight, CheckCircle2,
    Smile, Frown, Meh, AlertCircle, Send, ClipboardCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { exitAPI } from '../services/api';

// --- Constants for Exit Interview ---
const REASON_OPTIONS = [
    'Personal/Family Reasons', 'Better Compensation', 'Career Growth',
    'Work-Life Balance', 'Health Issues', 'Management/Culture',
    'Relocation', 'Further Education', 'Starting Own Venture', 'Other'
];
const AGREEMENT_OPTIONS = ['Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree'];
const QUALITY_OPTIONS = ['Excellent', 'Good', 'Average', 'Poor', 'N/A'];
const SATISFACTION_OPTIONS = ['Highly Satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Highly Dissatisfied'];


export default function EmployeeExitManagement() {
    const [requests, setRequests] = useState([]);
    const [showApplyModal, setShowApplyModal] = useState(false);
    const [showExitInterviewModal, setShowExitInterviewModal] = useState(false);
    const [selectedExitRequest, setSelectedExitRequest] = useState(null);
    const [submittedFormData, setSubmittedFormData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [assetHandover, setAssetHandover] = useState(null);
    const [showAssetModal, setShowAssetModal] = useState(false);
    const [formData, setFormData] = useState({
        reason: '',
        reasonOption: '',
        comments: '',
        resignationLetter: null
    });
    const resignationLetterFileInputRef = useRef(null);


    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await exitAPI.getMyExitRequests();
            setRequests(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error('Failed to fetch requests', e);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenExitForm = async (req) => {
        setSelectedExitRequest(req);
        if (req.exitFormSubmitted) {
            try {
                setLoading(true);
                const res = await exitAPI.getExitForm(req.id);
                setSubmittedFormData(res.data);
                setShowExitInterviewModal(true);
            } catch (error) {
                console.error("Failed to fetch exit form", error);
                toast.error("Failed to load your previous submission");
            } finally {
                setLoading(false);
            }
        } else {
            setSubmittedFormData(null);
            setShowExitInterviewModal(true);
        }
    };

    const handleExitFormSubmit = async (requestId, payload) => {
        if (!payload.formData?.employeeSignature) {
            toast.error("Please provide your digital signature");
            return;
        }

        setLoading(true);
        try {
            await exitAPI.submitExitForm(requestId, {
                ...payload,
                digitalSignature: true
            });
            toast.success("Exit interview form submitted successfully!");
            setShowExitInterviewModal(false);
            fetchRequests();
        } catch (error) {
            console.error("Submit error:", error);
            toast.error(error.response?.data?.message || "Failed to submit form");
        } finally {
            setLoading(false);
        }
    };


    const handleViewAssetHandover = async (requestId) => {
        setLoading(true);
        try {
            const res = await exitAPI.getAssetHandover(requestId);
            setAssetHandover(res.data);
            setShowAssetModal(true);
        } catch (error) {
            console.error("Failed to fetch asset handover", error);
            toast.error("Failed to load asset handover details");
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async (e) => {
        // ... (preserving original code)
        e.preventDefault();
        if (!formData.reason) { toast.error('Reason is required'); return; }
        setLoading(true);
        try {
            const data = new FormData();
            data.append('reason', formData.reason);
            if (formData.comments) data.append('comments', formData.comments);
            if (formData.resignationLetter) data.append('resignationLetter', formData.resignationLetter);
            await exitAPI.applyResignation(data);
            toast.success('Resignation applied successfully');
            setShowApplyModal(false);
            setFormData({ reason: '', reasonOption: '', comments: '', resignationLetter: null });
            fetchRequests();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to apply');
        } finally {
            setLoading(false);
        }
    };

    const handleDocumentationUpload = async (requestId, file) => {
        if (!file) return;
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            await exitAPI.uploadSignedResignation(requestId, formData);
            toast.success("Document uploaded successfully!");
            fetchRequests();
        } catch (error) {
            console.error("Upload error:", error);
            toast.error(error.response?.data?.message || "Failed to upload document");
        } finally {
            setLoading(false);
        }
    };

    const isActive = (req) =>
        ['PENDING','MANAGER_APPROVED','HR_APPROVED','ADMIN_APPROVED','EXIT_INITIATED'].includes(req.status);

        return (
            <div className="main-content" style={{ background: '#f2f2f0', minHeight: '100vh', width: '100%' }}>
                <Header title="Exit Management" subtitle="Track your resignation progress and offboarding status" />
                <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '30px 40px 60px' }}>

                {/* ── Page header ── */}
                <div style={{ marginBottom: 28 }}>
                    <button
                        onClick={() => setShowApplyModal(true)}
                        disabled={requests.some(isActive)}
                        style={{
                            marginTop: 18,
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            background: '#fff', border: '1.5px solid #e5e7eb',
                            padding: '10px 20px', borderRadius: 10,
                            fontSize: 13, fontWeight: 700, color: '#374151',
                            cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                            opacity: requests.some(isActive) ? 0.45 : 1
                        }}
                    >
                        <Plus size={16} color="#9ca3af" strokeWidth={2.5} />
                        Apply Resignation
                    </button>
                </div>

                {/* ── Empty state ── */}
                {requests.length === 0 && !loading && (
                    <div style={{ textAlign: 'center', padding: '64px 24px', background: '#fff', borderRadius: 24, border: '1.5px dashed #e5e7eb' }}>
                        <LogOut size={44} color="#d1d5db" style={{ margin: '0 auto 16px' }} />
                        <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1f2937', margin: '0 0 6px' }}>No resignation requests</h3>
                        <p style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>Click Apply Resignation to start the process.</p>
                    </div>
                )}

                {/* ── Request cards ── */}
                {requests.map(req => {
                    const managerApproval = req.approvals?.find(a => a.approvalLevel === 'MANAGER' && a.status === 'APPROVED');
                    const hrApproved = ['HR_APPROVED','ADMIN_APPROVED','EXIT_INITIATED','EXIT_COMPLETED'].includes(req.status);
                    const managerApprovedStatus = ['MANAGER_APPROVED','HR_APPROVED','ADMIN_APPROVED','EXIT_INITIATED','EXIT_COMPLETED'].includes(req.status);
                    const closeoutInProgress = req.status === 'EXIT_INITIATED';
                    const closeoutDone = req.status === 'EXIT_COMPLETED';
                    const exitDone = req.status === 'EXIT_COMPLETED';

                    const checklist = [
                        {
                            label: 'Exit interview form',
                            desc: req.exitFormSubmitted 
                                ? `Feedback submitted on ${new Date(req.exitFormSubmittedAt).toLocaleDateString()} — responses are confidential`
                                : 'Share your feedback about your journey — required for clearance',
                            icon: <MessageSquare size={17} color="#6366f1" />,
                            iconBg: '#eef2ff',
                            done: req.exitFormSubmitted,
                            badge: req.exitFormSubmitted ? 'Completed' : 'Required',
                            badgeStyle: req.exitFormSubmitted 
                                ? { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' } 
                                : { background: '#fff5f5', color: '#ef4444', border: '1px solid #fecaca' },
                            btnText: req.exitFormSubmitted ? '→ View Response' : '→ Start',
                            isBlocked: !hrApproved || (req.exitInterviewStatus !== 'INITIATED' && req.exitInterviewStatus !== 'COMPLETED'),
                        },
                        {
                            label: 'Asset handover',
                            desc: req.assetHandoverCompleted 
                                ? 'All assets returned and verified by the asset management team' 
                                : (req.assetHandoverAssigned 
                                    ? `Scheduled — Proceed with return instructions as discussed`
                                    : 'Equipment return and verification — logistic pickup pending'),
                            icon: <Archive size={17} color="#3b82f6" />,
                            iconBg: '#eff6ff',
                            done: req.assetHandoverCompleted,
                            badge: req.assetHandoverCompleted ? 'Completed' : (req.assetHandoverAssigned ? 'In Progress' : 'Pending'),
                            badgeStyle: req.assetHandoverCompleted 
                                ? { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' } 
                                : (req.assetHandoverAssigned 
                                    ? { background: '#eff6ff', color: '#2563eb', border: '1px solid #dbeafe' }
                                    : { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }),
                            btnText: req.assetHandoverCompleted ? '✓ Verified' : (req.assetHandoverAssigned ? '→ Track Progress' : '→ Schedule'),
                            isBlocked: !hrApproved,
                        },
                        {
                            label: 'Official documentation',
                            desc: req.resignationLetterVerified
                                ? 'Your signed resignation letter has been verified and archived'
                                : (!!req.resignationLetterPath
                                    ? 'Document uploaded — currently under verification by HR'
                                    : 'Signed resignation letter upload — pending upload for audit'),
                            icon: <FileCheck size={17} color="#f59e0b" />,
                            iconBg: '#fffbeb',
                            done: req.resignationLetterVerified,
                            badge: req.resignationLetterVerified ? 'Completed' : (!!req.resignationLetterPath ? 'In Review' : 'Pending'),
                            badgeStyle: req.resignationLetterVerified
                                ? { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }
                                : (!!req.resignationLetterPath
                                    ? { background: '#eff6ff', color: '#2563eb', border: '1px solid #dbeafe' }
                                    : { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }),
                            btnText: req.resignationLetterVerified ? '✓ Verified' : (!!req.resignationLetterPath ? '→ View Document' : '↑ Upload'),
                            isBlocked: !hrApproved,
                        },
                    ];

                    const checklistDone = checklist.filter(c => c.done).length;
                    const checklistTotal = checklist.length;

                    const closeoutDoneFlag = closeoutDone || (req.assetHandoverCompleted && req.fnfTriggered);

                    const steps = [
                        {
                            label: 'Submitted by you',
                            sub: new Date(req.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                            done: true,
                            inProgress: false,
                            badge: 'Completed',
                            badgeStyle: { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' },
                            extra: null,
                        },
                        {
                            label: 'Manager endorsement',
                            sub: managerApproval
                                ? `Verified on ${new Date(managerApproval.actionDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                                : 'Awaiting departmental review',
                            done: !!managerApprovedStatus,
                            inProgress: false,
                            badge: managerApprovedStatus ? 'Approved' : 'Pending',
                            badgeStyle: managerApprovedStatus
                                ? { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }
                                : { background: '#f9fafb', color: '#9ca3af', border: '1px solid #e5e7eb' },
                            extra: managerApproval ? {
                                avatar: managerApproval.approverName?.charAt(0)?.toUpperCase() || 'M',
                                name: managerApproval.approverName,
                                comment: managerApproval.comments || 'Approved by Manager',
                            } : null,
                        },
                        {
                            label: 'HR review',
                            sub: hrApproved ? 'Process validated successfully' : 'Awaiting HR compliance review',
                            done: hrApproved,
                            inProgress: false,
                            badge: hrApproved ? 'Validated' : 'Pending',
                            badgeStyle: hrApproved
                                ? { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }
                                : { background: '#f9fafb', color: '#9ca3af', border: '1px solid #e5e7eb' },
                            extra: null,
                        },
                        {
                            label: 'Final exit closeout',
                            sub: closeoutDoneFlag ? 'Clearance & F&F processed' : 'Assets & clearance currently in progress',
                            done: closeoutDoneFlag,
                            inProgress: closeoutInProgress && !closeoutDoneFlag,
                            badge: closeoutDoneFlag ? 'Completed' : closeoutInProgress ? 'In progress' : 'Pending',
                            badgeStyle: closeoutDoneFlag
                                ? { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }
                                : closeoutInProgress
                                ? { background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' }
                                : { background: '#f9fafb', color: '#9ca3af', border: '1px solid #e5e7eb' },
                            extra: null,
                        },
                        {
                            label: 'Exit completed',
                            sub: exitDone ? 'All formalities completed' : (closeoutDoneFlag ? 'Awaiting final administrative closure' : 'Awaiting checklist completion & F&F settlement'),
                            done: exitDone,
                            inProgress: closeoutDoneFlag && !exitDone,
                            badge: exitDone ? 'Completed' : (closeoutDoneFlag ? 'In progress' : 'Pending'),
                            badgeStyle: exitDone
                                ? { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }
                                : (closeoutDoneFlag
                                    ? { background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' }
                                    : { background: '#f9fafb', color: '#9ca3af', border: '1px solid #e5e7eb' }),
                            extra: null,
                        },
                    ];

                    return (
                        <div key={req.id} style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb', marginBottom: 24 }}>

                            {/* ── Dark ID header ── */}
                            <div style={{ background: '#161b2e', padding: '28px 28px 24px', color: '#fff' }}>

                                {/* Top row */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                                    <div>
                                        <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 10 }}>
                                            {req.requestId}
                                        </div>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(134,239,172,0.1)', border: '1px solid rgba(134,239,172,0.25)', borderRadius: 999, padding: '5px 12px' }}>
                                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
                                            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#4ade80', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                                {req.status?.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 9.5, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Submitted</div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: '#d1d5db' }}>
                                            {new Date(req.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </div>
                                    </div>
                                </div>

                                {/* Two info cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                                    <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 16px' }}>
                                        <div style={{ fontSize: 9, color: '#6b7280', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Settlement target</div>
                                        <div style={{ fontSize: 18, fontWeight: 900, color: '#f9fafb', lineHeight: 1, marginBottom: 4 }}>
                                            {req.lastWorkingDay
                                                ? new Date(req.lastWorkingDay).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                                : '—'}
                                        </div>
                                        <div style={{ fontSize: 9, color: '#4b5563', fontWeight: 600 }}>F&F deadline</div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 16px' }}>
                                        <div style={{ fontSize: 9, color: '#6b7280', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Last working day</div>
                                        <div style={{ fontSize: 18, fontWeight: 900, color: req.lastWorkingDay ? '#f9fafb' : '#fbbf24', lineHeight: 1, marginBottom: 4 }}>
                                            {req.lastWorkingDay
                                                ? new Date(req.lastWorkingDay).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                                : 'Not confirmed'}
                                        </div>
                                        <div style={{ fontSize: 9, color: '#4b5563', fontWeight: 600 }}>{req.lastWorkingDay ? 'Confirmed by HR' : 'Pending HR'}</div>
                                    </div>
                                </div>

                                {/* Reason */}
                                <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, padding: '12px 16px' }}>
                                    <div style={{ fontSize: 9, color: '#4b5563', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 5 }}>Reason for departure</div>
                                    <p style={{ margin: 0, fontSize: 13.5, color: '#d1d5db', fontStyle: 'italic', fontWeight: 600 }}>"{req.reason}"</p>
                                </div>
                            </div>

                            {/* ── Lifecycle section ── */}
                            <div style={{ padding: '28px 28px 0' }}>
                                <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 24 }}>
                                    LIFECYCLE PROGRESSION
                                </div>
                                <div style={{ paddingLeft: 4 }}>
                                    {steps.map((step, idx) => {
                                        const isLast = idx === steps.length - 1;
                                        return (
                                            <div key={idx} style={{ display: 'flex', gap: 16, position: 'relative', paddingBottom: isLast ? 0 : 32 }}>
                                                {/* Stem */}
                                                {!isLast && (
                                                    <div style={{
                                                        position: 'absolute', left: 12, top: 28, bottom: 0,
                                                        width: 2,
                                                        background: step.done ? '#4ade80' : '#f3f4f6',
                                                    }} />
                                                )}
                                                {/* Dot */}
                                                <div style={{
                                                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0, zIndex: 1,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    background: step.done ? '#4ade80' : step.inProgress ? '#fff7ed' : '#f9fafb',
                                                    border: step.done ? '2px solid #4ade80' : step.inProgress ? '2px solid #fb923c' : '2px solid #e5e7eb',
                                                    boxShadow: step.done ? '0 0 0 3px rgba(74,222,128,0.15)' : 'none',
                                                }}>
                                                    {step.done
                                                        ? <Check size={13} color="#fff" strokeWidth={3.5} />
                                                        : step.inProgress
                                                        ? <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fb923c' }} />
                                                        : <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#d1d5db' }} />
                                                    }
                                                </div>

                                                {/* Content */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                                                        <div>
                                                            <div style={{ fontSize: 13.5, fontWeight: 800, color: step.done || step.inProgress ? '#111827' : '#9ca3af', lineHeight: 1.2 }}>
                                                                {step.label}
                                                            </div>
                                                            <div style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 500, marginTop: 2 }}>{step.sub}</div>
                                                        </div>
                                                        <span style={{
                                                            fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'capitalize',
                                                            padding: '3px 9px', borderRadius: 6, whiteSpace: 'nowrap', marginLeft: 10, marginTop: 2,
                                                            ...step.badgeStyle
                                                        }}>
                                                            {step.badge}
                                                        </span>
                                                    </div>
                                                    {/* Manager comment card */}
                                                    {step.extra && (
                                                        <div style={{ marginTop: 10, display: 'flex', gap: 10, background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 10, padding: '9px 12px' }}>
                                                            <div style={{
                                                                width: 24, height: 24, borderRadius: '50%', background: '#e0e7ff',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontSize: 10, fontWeight: 800, color: '#4f46e5', flexShrink: 0,
                                                            }}>
                                                                {step.extra.avatar}
                                                            </div>
                                                            <div style={{ fontSize: 11.5, color: '#374151', lineHeight: 1.4 }}>
                                                                <span style={{ fontWeight: 700 }}>{step.extra.name}</span>
                                                                {' '}—{' '}
                                                                <span style={{ color: '#6b7280', fontStyle: 'italic' }}>"{step.extra.comment}"</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ── Divider ── */}
                            <div style={{ height: 1, background: '#f3f4f6', margin: '28px 0 0' }} />

                            {/* ── Exit checklist ── */}
                            <div style={{ padding: '24px 28px 28px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', letterSpacing: '0.18em', textTransform: 'uppercase' }}>EXIT CHECKLIST</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>{checklistDone} / {checklistTotal}</span>
                                        <div style={{ width: 80, height: 5, background: '#f3f4f6', borderRadius: 999, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${checklistTotal > 0 ? (checklistDone / checklistTotal) * 100 : 0}%`, background: '#6b7280', borderRadius: 999, transition: 'width 0.8s ease' }} />
                                        </div>
                                    </div>
                                </div>
                                <p style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 500, margin: '0 0 18px' }}>Mandatory offboarding milestones</p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {checklist.map((item, idx) => (
                                        <div key={idx} style={{
                                            background: '#fafafa', border: '1px solid #f0f0ee',
                                            borderRadius: 14, padding: '14px 16px',
                                            display: 'flex', gap: 14, alignItems: 'flex-start',
                                            opacity: item.isBlocked ? 0.6 : 1,
                                            filter: item.isBlocked ? 'grayscale(0.4)' : 'none',
                                        }}>
                                            {/* Icon box */}
                                            <div style={{
                                                width: 42, height: 42, borderRadius: 12, background: item.iconBg,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                border: '1.5px solid #e5e7eb',
                                            }}>
                                                {item.icon}
                                            </div>
                                            {/* Text + action */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
                                                    <span style={{ fontSize: 13.5, fontWeight: 800, color: '#1f2937' }}>{item.label}</span>
                                                    <span style={{
                                                        fontSize: 9.5, fontWeight: 900, letterSpacing: '0.06em',
                                                        padding: '3px 10px', borderRadius: 6, flexShrink: 0,
                                                        ...(item.done ? { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' } : (item.isBlocked ? { background: '#f3f4f6', color: '#9ca3af', border: '1px solid #e5e7eb' } : item.badgeStyle))
                                                    }}>
                                                        {(item.done && item.label === 'Asset handover') ? 'Verified' : (item.done ? 'Completed' : (item.isBlocked ? 'Locked' : item.badge))}
                                                    </span>
                                                </div>
                                                <p style={{ fontSize: 11.5, color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5, fontWeight: 500 }}>{item.desc}</p>
                                                <button
                                                    disabled={item.isBlocked || (item.done && item.label !== 'Exit interview form' && item.label !== 'Official documentation')}
                                                    onClick={() => {
                                                        if (item.label === 'Exit interview form') {
                                                            handleOpenExitForm(req);
                                                        } else if (item.label === 'Asset handover' && req.assetHandoverAssigned) {
                                                            handleViewAssetHandover(req.id);
                                                        } else if (item.label === 'Official documentation') {
                                                            if (item.done || !!req.resignationLetterPath) {
                                                                toast.info("Document already submitted or verified.");
                                                            } else {
                                                                // Store request ID in a hidden attribute to retrieve on file change
                                                                resignationLetterFileInputRef.current._requestId = req.id;
                                                                resignationLetterFileInputRef.current.click();
                                                            }
                                                        } else {
                                                            toast.info(`Status: ${item.badge}. This milestone is managed by HR.`);
                                                        }
                                                    }}
                                                    style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 5,
                                                        background: item.isBlocked ? '#f9fafb' : (item.done && item.label !== 'Exit interview form' ? '#f0fdf4' : '#fff'),
                                                        border: `1.5px solid ${item.isBlocked ? '#e5e7eb' : (item.done && item.label !== 'Exit interview form' ? '#bbf7d0' : '#e5e7eb')}`,
                                                        borderRadius: 8, padding: '6px 14px',
                                                        fontSize: 11, fontWeight: 700,
                                                        color: item.isBlocked ? '#9ca3af' : (item.done && item.label !== 'Exit interview form' ? '#16a34a' : '#374151'),
                                                        cursor: item.isBlocked || (item.done && item.label !== 'Exit interview form') ? 'default' : 'pointer',
                                                        opacity: item.done && item.label !== 'Exit interview form' ? 0.7 : 1,
                                                    }}
                                                >
                                                    {item.isBlocked ? 'Awaiting Workflow' : (item.done ? (item.label === 'Exit interview form' ? '→ View Response' : '✓ Done') : item.btnText)}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ── Footer strip ── */}
                            <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
                                <span style={{ fontSize: 9.5, color: '#9ca3af', fontWeight: 600, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                    ID: {req.requestId}
                                </span>
                                <span style={{ fontSize: 9.5, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    Updated {new Date(req.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, {new Date(req.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    );
                })}

                {/* Hidden input for documentation upload */}
                <input 
                    type="file" 
                    ref={resignationLetterFileInputRef}
                    style={{ display: 'none' }}
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => {
                        const file = e.target.files[0];
                        const requestId = resignationLetterFileInputRef.current._requestId;
                        if (file && requestId) {
                            handleDocumentationUpload(requestId, file);
                        }
                    }}
                />
            </div>

            {/* ── Exit Interview Modal ── */}
            <ExitInterviewModal
                isOpen={showExitInterviewModal}
                onClose={() => setShowExitInterviewModal(false)}
                requestId={selectedExitRequest?.id}
                employeeName={selectedExitRequest?.employeeName}
                isViewOnly={selectedExitRequest?.exitFormSubmitted}
                submittedData={submittedFormData}
                onSubmit={handleExitFormSubmit}
                loading={loading}
            />

            {/* ── Apply modal ── */}
            <AnimatePresence>
                {showApplyModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}
                        onClick={(e) => e.target === e.currentTarget && setShowApplyModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 20 }}
                            style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 520, overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.25)' }}
                        >
                            {/* Modal header */}
                            <div style={{ background: '#161b2e', padding: '28px 32px', position: 'relative' }}>
                                <button onClick={() => setShowApplyModal(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                    <X size={16} color="#9ca3af" />
                                </button>
                                <h3 style={{ fontSize: 22, fontWeight: 900, color: '#f9fafb', margin: '0 0 6px' }}>Apply for Resignation</h3>
                                <p style={{ fontSize: 12.5, color: '#6b7280', margin: 0 }}>Your request will be sent to your manager, then reviewed by HR.</p>
                            </div>

                            {/* Modal form */}
                            <form onSubmit={handleApply} style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <div>
                                    <label style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: 8 }}>Reason *</label>
                                    <select
                                        required
                                        value={formData.reasonOption}
                                        onChange={e => {
                                            const v = e.target.value;
                                            setFormData({ ...formData, reasonOption: v, reason: v === 'Other' ? '' : v });
                                        }}
                                        style={{ width: '100%', padding: '11px 14px', background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13.5, fontWeight: 600, color: '#374151', outline: 'none', appearance: 'none' }}
                                    >
                                        <option value="" disabled>Select a reason…</option>
                                        <option value="Better opportunity">Better opportunity</option>
                                        <option value="Relocation">Relocation</option>
                                        <option value="Personal reasons">Personal reasons</option>
                                        <option value="Health reasons">Health reasons</option>
                                        <option value="Career change">Career change</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    {formData.reasonOption === 'Other' && (
                                        <input
                                            required
                                            value={formData.reason}
                                            onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                            placeholder="Please specify…"
                                            style={{ marginTop: 8, width: '100%', padding: '11px 14px', background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13.5, fontWeight: 600, color: '#374151', outline: 'none', boxSizing: 'border-box' }}
                                        />
                                    )}
                                </div>

                                <div>
                                    <label style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: 8 }}>Additional Comments</label>
                                    <textarea
                                        value={formData.comments}
                                        onChange={e => setFormData({ ...formData, comments: e.target.value })}
                                        placeholder="Any additional context for the review team…"
                                        rows={3}
                                        style={{ width: '100%', padding: '11px 14px', background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13.5, color: '#374151', resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: 8 }}>Resignation Letter (Optional PDF)</label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f9fafb', border: '1.5px dashed #d1d5db', borderRadius: 10, padding: '14px 16px', cursor: 'pointer' }}>
                                        <Upload size={20} color="#9ca3af" />
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{formData.resignationLetter ? formData.resignationLetter.name : 'Upload file'}</div>
                                            <div style={{ fontSize: 11, color: '#9ca3af' }}>PDF only · Max 5MB</div>
                                        </div>
                                        <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => setFormData({ ...formData, resignationLetter: e.target.files[0] })} />
                                    </label>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
                                    <button type="button" onClick={() => setShowApplyModal(false)} style={{ padding: '10px 20px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 700, color: '#6b7280', cursor: 'pointer' }}>
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={loading} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#1d4ed8', fontSize: 13, fontWeight: 800, color: '#fff', cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: loading ? 0.7 : 1 }}>
                                        {loading ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                                        Submit Resignation
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {showAssetModal && assetHandover && (
                    <AssetHandoverViewModal
                        isOpen={showAssetModal}
                        onClose={() => setShowAssetModal(false)}
                        data={assetHandover}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// --- Sub-components ---
const AssetHandoverViewModal = ({ isOpen, onClose, data }) => {
    if (!isOpen || !data) return null;

    return (
        <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(8px)' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
                <motion.div initial={{ scale: 0.95, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 30 }} style={{ background: '#fff', borderRadius: 28, width: '100%', maxWidth: 520, overflow: 'hidden', boxShadow: '0 30px 100px rgba(0,0,0,0.4)' }}>
                    <div style={{ background: '#0a0d1d', padding: '24px 32px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 900, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 4 }}>Asset Clearance</div>
                            <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>Handover Details</h2>
                        </div>
                        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} color="#94a3b8" /></button>
                    </div>
                    
                    <div style={{ padding: '32px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            {/* Schedule Info */}
                            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: 20, border: '1.5px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Handover Date</div>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Clock size={16} color="#6366f1" />
                                        {data.handoverDate || 'Not specified'}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Assigned Person</div>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>
                                        {data.assignedToName || 'Wait for instruction'}
                                    </div>
                                </div>
                            </div>

                            {/* Notes/Instructions */}
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12 }}>Handover Instructions</div>
                                <div style={{ background: '#f1f5f9', padding: '20px', borderRadius: 20, fontSize: 13, fontWeight: 600, color: '#475569', lineHeight: 1.6, border: '1.5px dashed #cbd5e1' }}>
                                    {data.notes || 'Please ensure all physical assets including laptop, charger, and ID card are ready for return at the scheduled time.'}
                                </div>
                            </div>

                            {/* Items List (if any) */}
                            {data.assetItems && data.assetItems.length > 0 && (
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12 }}>Listed Equipment</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {data.assetItems.map((item, idx) => (
                                            <div key={idx} style={{ padding: '12px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{item.itemName || item.assetName}</div>
                                                <div style={{ fontSize: 10, fontWeight: 800, color: '#6366f1', background: '#eef2ff', padding: '2px 8px', borderRadius: 4 }}>{item.itemType || item.assetType}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button onClick={onClose} style={{ marginTop: 8, padding: '14px', borderRadius: 16, background: '#0a0d1d', color: '#fff', fontWeight: 900, fontSize: 14, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                                <CheckCircle2 size={18} /> I Understand
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

const RatingControl = ({ value, onChange, disabled }) => {
    const options = [
        { val: '1', label: 'Very poor' },
        { val: '2', label: 'Poor' },
        { val: '3', label: 'Neutral' },
        { val: '4', label: 'Good' },
        { val: '5', label: 'Excellent' }
    ];

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
            {options.map((opt) => (
                <button
                    key={opt.val}
                    type="button"
                    onClick={() => !disabled && onChange(opt.val)}
                    style={{
                        padding: '12px 24px',
                        borderRadius: '16px',
                        border: `1.5px solid ${value === opt.val ? '#0f172a' : '#e2e8f0'}`,
                        background: value === opt.val ? '#f8fafc' : '#fff',
                        color: value === opt.val ? '#0f172a' : '#475569',
                        fontSize: '15px',
                        fontWeight: value === opt.val ? 800 : 600,
                        cursor: disabled ? 'default' : 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        boxShadow: value === opt.val ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
                    }}
                >
                    <span style={{ opacity: 0.5 }}>{opt.val} —</span> {opt.label}
                </button>
            ))}
        </div>
    );
};

const ExitInterviewModal = ({ isOpen, onClose, requestId, employeeName, isViewOnly, submittedData, onSubmit, loading }) => {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        digitalSignature: true,
        formData: {
            reasonForLeaving: { reasonsSelected: [], otherReason: '', comments: '' },
            jobRoleExperience: { 
                likedMost: '', dislikedMost: '', recommendations: '', overallRating: '3'
            },
            workEnvironment: {
                environmentRating: '4', managerRelationship: 'Good', teamRelationship: 'Good', comments: ''
            },
            compensationBenefits: {
                compensationSatisfaction: 'Satisfied', benefitsSatisfaction: 'Satisfied'
            },
            suggestions: '',
            rehireEligibility: { wouldRejoin: 'Yes', recommendOrganization: 'Yes' },
            employeeSignature: employeeName || '',
            employeeSignatureDate: new Date().toISOString().split('T')[0]
        }
    });

    useEffect(() => {
        if (submittedData && submittedData.formData) {
            setForm({
                digitalSignature: submittedData.digitalSignature || true,
                formData: submittedData.formData
            });
            setStep(1);
        }
    }, [submittedData, isOpen]);

    if (!isOpen) return null;

    const updateForm = (section, field, value) => {
        if (isViewOnly) return;
        setForm(prev => ({
            ...prev,
            formData: {
                ...prev.formData,
                [section]: {
                    ...prev.formData[section],
                    [field]: value
                }
            }
        }));
    };

    const updateDirectField = (field, value) => {
        if (isViewOnly) return;
        setForm(prev => ({
            ...prev,
            formData: {
                ...prev.formData,
                [field]: value
            }
        }));
    };

    const handleNext = () => setStep(s => Math.min(3, s + 1));
    const handlePrev = () => setStep(s => Math.max(1, s - 1));

    const renderStepContent = () => {
        const { formData } = form;
        if (isViewOnly) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '5px 0' }}>
                    {/* Document Info Header */}
                    <div style={{ background: '#f8fafc', padding: '20px 28px', borderRadius: 20, border: '1.5px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Submission Status</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontWeight: 800, fontSize: 15 }}>
                                <CheckCircle2 size={18} /> Form Completed
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Submission Date</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>
                                {formData.employeeSignatureDate || 'N/A'}
                            </div>
                        </div>
                    </div>

                    {/* Section 1: Overall Experience */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 6, height: 20, background: '#6366f1', borderRadius: 3 }} />
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0a0d1d' }}>1. Overall Experience & Reasons</h3>
                        </div>

                        <div style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Overall Rating</div>
                                <RatingControl value={formData.jobRoleExperience.overallRating || '3'} disabled={true} />
                            </div>

                            <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Primary Reason for Leaving</div>
                                <div style={{ padding: '12px 18px', background: '#f1f5f9', borderRadius: 12, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                                    {formData.reasonForLeaving.reasonsSelected?.[0] || 'Not specified'}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>What was enjoyed most</div>
                                    <div style={{ padding: '12px 18px', background: '#f1f5f9', borderRadius: 12, fontSize: 13, fontWeight: 600, color: '#475569', minHeight: 60, lineHeight: 1.5 }}>
                                        {formData.jobRoleExperience.likedMost || 'No response provided'}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Suggested Improvements</div>
                                    <div style={{ padding: '12px 18px', background: '#f1f5f9', borderRadius: 12, fontSize: 13, fontWeight: 600, color: '#475569', minHeight: 60, lineHeight: 1.5 }}>
                                        {formData.jobRoleExperience.dislikedMost || 'No response provided'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Environment & Relationships */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 6, height: 20, background: '#34d399', borderRadius: 3 }} />
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0a0d1d' }}>2. Environment & Satisfaction</h3>
                        </div>

                        <div style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                                {[
                                    { label: 'Manager', val: formData.workEnvironment.managerRelationship },
                                    { label: 'Team', val: formData.workEnvironment.teamRelationship },
                                    { label: 'Compensation', val: formData.compensationBenefits.compensationSatisfaction },
                                    { label: 'Benefits', val: formData.compensationBenefits.benefitsSatisfaction }
                                ].map((item, i) => (
                                    <div key={i} style={{ padding: '12px', background: '#f8fafc', borderRadius: 14, border: '1.5px solid #e2e8f0', textAlign: 'center' }}>
                                        <div style={{ fontSize: 9, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>{item.label}</div>
                                        <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>{item.val || 'N/A'}</div>
                                    </div>
                                ))}
                            </div>

                            <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Culture Feedback</div>
                                <div style={{ padding: '12px 18px', background: '#f1f5f9', borderRadius: 12, fontSize: 13, fontWeight: 600, color: '#475569', minHeight: 50, lineHeight: 1.5 }}>
                                    {formData.suggestions || 'No suggestions shared'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Final Eligibility */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 6, height: 20, background: '#fbbf24', borderRadius: 3 }} />
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0a0d1d' }}>3. Eligibility & Declaration</h3>
                        </div>

                        <div style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: 16, border: '1.5px solid #dcfce7' }}>
                                    <div style={{ fontSize: 10, fontWeight: 900, color: '#16a34a', textTransform: 'uppercase', marginBottom: 4 }}>Would you rejoin?</div>
                                    <div style={{ fontSize: 16, fontWeight: 900, color: '#166534' }}>{formData.rehireEligibility.wouldRejoin || 'No'}</div>
                                </div>
                                <div style={{ padding: '16px', background: '#eff6ff', borderRadius: 16, border: '1.5px solid #dbeafe' }}>
                                    <div style={{ fontSize: 10, fontWeight: 900, color: '#2563eb', textTransform: 'uppercase', marginBottom: 4 }}>Recommend Organization?</div>
                                    <div style={{ fontSize: 16, fontWeight: 900, color: '#1e40af' }}>{formData.rehireEligibility.recommendOrganization || 'No'}</div>
                                </div>
                            </div>

                            <div style={{ marginTop: 5, padding: '24px', background: '#f8fafc', borderRadius: 20, border: '1.5px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <div>
                                    <div style={{ fontSize: 9, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Employee Signature</div>
                                    <div style={{ fontSize: 22, fontWeight: 500, fontFamily: '"Signature", cursive', color: '#1e293b' }}>{formData.employeeSignature}</div>
                                    <div style={{ width: 220, height: 1.5, background: '#e2e8f0', marginTop: 8 }} />
                                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, marginTop: 6 }}>Digitally Signed by {employeeName}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 }}>Completed on</div>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: '#475569' }}>{formData.employeeSignatureDate}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        switch(step) {
            case 1:
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                        <div>
                            <label style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>Overall experience at the company <span style={{ color: '#ef4444' }}>*</span></label>
                            <RatingControl value={formData.jobRoleExperience.overallRating || '3'} onChange={val => updateForm('jobRoleExperience', 'overallRating', val)} disabled={isViewOnly} />
                        </div>

                        <div>
                            <label style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 12 }}>Primary reason for leaving <span style={{ color: '#ef4444' }}>*</span></label>
                            <div style={{ position: 'relative' }}>
                                <select 
                                    value={formData.reasonForLeaving.reasonsSelected?.[0] || ''} 
                                    onChange={e => updateForm('reasonForLeaving', 'reasonsSelected', [e.target.value])} 
                                    disabled={isViewOnly} 
                                    style={{ 
                                        width: '100%', padding: '16px 20px', borderRadius: 16, border: '1.5px solid #e2e8f0', 
                                        background: '#fff', fontSize: '15px', fontWeight: 600, color: '#1e293b', outline: 'none', 
                                        appearance: 'none', transition: 'all 0.2s', boxSizing: 'border-box'
                                    }}
                                >
                                    <option value="" disabled>Select a reason...</option>
                                    {REASON_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <div style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }}>
                                    <ChevronRight size={18} style={{ transform: 'rotate(90deg)' }} />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 12 }}>What did you enjoy most about working here?</label>
                            <textarea 
                                value={formData.jobRoleExperience.likedMost || ''} 
                                onChange={e => updateForm('jobRoleExperience', 'likedMost', e.target.value)} 
                                disabled={isViewOnly} 
                                placeholder="Team culture, projects, learning opportunities..." 
                                rows={4} 
                                style={{ 
                                    width: '100%', padding: '16px 20px', borderRadius: 16, border: '1.5px solid #e2e8f0', 
                                    outline: 'none', fontSize: '15px', fontWeight: 500, color: '#1e293b', resize: 'none', 
                                    boxSizing: 'border-box', background: '#fff', lineHeight: 1.6
                                }} 
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 12 }}>What could the company have done differently?</label>
                            <textarea 
                                value={formData.jobRoleExperience.dislikedMost || ''} 
                                onChange={e => updateForm('jobRoleExperience', 'dislikedMost', e.target.value)} 
                                disabled={isViewOnly} 
                                placeholder="Constructive feedback is valuable for us..." 
                                rows={4} 
                                style={{ 
                                    width: '100%', padding: '16px 20px', borderRadius: 16, border: '1.5px solid #e2e8f0', 
                                    outline: 'none', fontSize: '15px', fontWeight: 500, color: '#1e293b', resize: 'none', 
                                    boxSizing: 'border-box', background: '#fff', lineHeight: 1.6
                                }} 
                            />
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'block' }}>Manager Relationship</label>
                                <select value={formData.workEnvironment.managerRelationship || ''} onChange={e => updateForm('workEnvironment', 'managerRelationship', e.target.value)} disabled={isViewOnly} style={{ width: '100%', padding: '14px', borderRadius: 14, border: '1.5px solid #e2e8f0', fontWeight: 600, color: '#1e293b' }}>
                                    {QUALITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'block' }}>Team Relationship</label>
                                <select value={formData.workEnvironment.teamRelationship || ''} onChange={e => updateForm('workEnvironment', 'teamRelationship', e.target.value)} disabled={isViewOnly} style={{ width: '100%', padding: '14px', borderRadius: 14, border: '1.5px solid #e2e8f0', fontWeight: 600, color: '#1e293b' }}>
                                    {QUALITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'block' }}>Compensation</label>
                                <select value={formData.compensationBenefits.compensationSatisfaction || ''} onChange={e => updateForm('compensationBenefits', 'compensationSatisfaction', e.target.value)} disabled={isViewOnly} style={{ width: '100%', padding: '14px', borderRadius: 14, border: '1.5px solid #e2e8f0', fontWeight: 600 }}>
                                    {SATISFACTION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'block' }}>Benefits</label>
                                <select value={formData.compensationBenefits.benefitsSatisfaction || ''} onChange={e => updateForm('compensationBenefits', 'benefitsSatisfaction', e.target.value)} disabled={isViewOnly} style={{ width: '100%', padding: '14px', borderRadius: 14, border: '1.5px solid #e2e8f0', fontWeight: 600 }}>
                                    {SATISFACTION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 12 }}>How can we improve the work culture?</label>
                            <textarea value={formData.suggestions || ''} onChange={e => updateDirectField('suggestions', e.target.value)} disabled={isViewOnly} placeholder="Your suggestions for improvement..." rows={3} style={{ width: '100%', padding: '16px 20px', borderRadius: 16, border: '1.5px solid #e2e8f0', boxSizing: 'border-box', minHeight: 120 }} />
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                        <div style={{ background: '#f8fafc', padding: '32px', borderRadius: 24, border: '1.5px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                                <div style={{ background: '#3b82f6', color: '#fff', padding: 8, borderRadius: 10 }}>
                                    <AlertCircle size={18} />
                                </div>
                                <span style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>Official Declaration</span>
                            </div>
                            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
                                I confirm that all feedback given in this exit interview is accurate and provided to help the organization improve its employee experience. This form serves as my final digital clearance acknowledgment.
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                                <div>
                                    <label style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'block' }}>Full Name Signature</label>
                                    <input type="text" value={formData.employeeSignature || ''} onChange={e => updateDirectField('employeeSignature', e.target.value)} disabled={isViewOnly} style={{ width: '100%', padding: '14px 18px', border: '1.5px solid #e2e8f0', borderRadius: 12, fontSize: 16, fontWeight: 600, background: isViewOnly ? '#f1f5f9' : '#fff' }} />
                                </div>
                                <div>
                                    <label style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'block' }}>Submission Date</label>
                                    <input type="text" value={formData.employeeSignatureDate || ''} disabled style={{ width: '100%', padding: '14px 18px', border: '1.5px solid #e2e8f0', borderRadius: 12, background: '#f1f5f9', fontWeight: 600, color: '#64748b' }} />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 24 }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'block' }}>Would you rejoin?</label>
                                <div style={{ display: 'flex', gap: 20 }}>
                                    {['Yes', 'No', 'Maybe'].map(o => (
                                        <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: isViewOnly ? 'default' : 'pointer', fontWeight: 700, fontSize: 14, color: formData.rehireEligibility.wouldRejoin === o ? '#3b82f6' : '#64748b' }}>
                                            <input type="radio" name="wouldRejoin" checked={formData.rehireEligibility.wouldRejoin === o} onChange={() => updateForm('rehireEligibility', 'wouldRejoin', o)} disabled={isViewOnly} style={{ width: 16, height: 16 }} /> {o}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'block' }}>Recommend us?</label>
                                <div style={{ display: 'flex', gap: 20 }}>
                                    {['Yes', 'No'].map(o => (
                                        <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: isViewOnly ? 'default' : 'pointer', fontWeight: 700, fontSize: 14, color: formData.rehireEligibility.recommendOrganization === o ? '#3b82f6' : '#64748b' }}>
                                            <input type="radio" name="recommendOrganization" checked={formData.rehireEligibility.recommendOrganization === o} onChange={() => updateForm('rehireEligibility', 'recommendOrganization', o)} disabled={isViewOnly} style={{ width: 16, height: 16 }} /> {o}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(8px)' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
                <motion.div initial={{ scale: 0.95, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 30 }} style={{ background: '#fff', borderRadius: 28, width: '100%', maxWidth: 760, maxHeight: '92vh', overflow: 'hidden', boxShadow: '0 30px 100px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ background: '#0a0d1d', padding: '24px 40px', color: '#fff', position: 'relative' }}>
                        <button onClick={onClose} style={{ position: 'absolute', top: 24, right: 32, background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 12, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} aria-label="Close modal"><X size={18} color="#94a3b8" /></button>
                        <div style={{ fontSize: 10, fontWeight: 900, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 8 }}>{isViewOnly ? 'FORM VIEW · READ ONLY' : `EXIT CHECKLIST · STEP ${step} OF 3`}</div>
                        <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 4px', letterSpacing: '-0.02em' }}>{isViewOnly ? 'Exit Interview Response' : 'Exit Interview Form'}</h2>
                        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{isViewOnly ? `Submitted by ${employeeName} for final clearance` : 'Your honest feedback helps us improve — responses are confidential'}</p>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', scrollbarWidth: 'thin', scrollbarColor: '#e2e8f0 transparent' }} className="custom-scrollbar">
                        <style>{`
                            .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                            .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
                            @import url('https://fonts.googleapis.com/css2?family=Mrs+Saint+Delafield&display=swap');
                            .signature-font { font-family: 'Mrs Saint Delafield', cursive; }
                        `}</style>
                        {renderStepContent()}
                    </div>

                    <div style={{ padding: '20px 40px', borderTop: '1.5px solid #f1f5f9', display: 'flex', justifyContent: isViewOnly ? 'flex-end' : 'space-between', alignItems: 'center', background: '#fff' }}>
                        {!isViewOnly && (
                            <button onClick={handlePrev} disabled={step === 1 || loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 14, border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 800, fontSize: 13, opacity: (step === 1 || loading) ? 0.4 : 1, transition: 'all 0.2s' }}>
                                <ChevronLeft size={18} /> Previous
                            </button>
                        )}
                        <div style={{ display: 'flex', gap: 12 }}>
                            {isViewOnly ? (
                                <button onClick={onClose} style={{ padding: '12px 32px', borderRadius: 14, background: '#0a0d1d', color: '#fff', fontWeight: 900, border: 'none', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <CheckCircle2 size={16} /> Close Document
                                </button>
                            ) : (
                                step === 3 ? (
                                    <button onClick={() => onSubmit(requestId, form)} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '12px 36px', borderRadius: 14, background: 'linear-gradient(135deg, #1e1b4b 0%, #0a0d1d 100%)', color: '#fff', fontWeight: 900, border: 'none', boxShadow: '0 8px 20px rgba(10,13,29,0.2)', cursor: 'pointer', fontSize: 13 }}>
                                        {loading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />} Final Submission
                                    </button>
                                ) : (
                                    <button onClick={handleNext} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 36px', borderRadius: 14, background: '#0a0d1d', color: '#fff', fontWeight: 900, border: 'none', cursor: 'pointer', fontSize: 13 }}>
                                        Next Step <ChevronRight size={18} />
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

