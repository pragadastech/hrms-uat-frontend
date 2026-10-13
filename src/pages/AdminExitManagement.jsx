import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Building, UserX, Clock, CheckCircle, XCircle, AlertCircle,
    FileText, Briefcase, Calendar, ChevronRight, Search, Filter,
    MoreVertical, Shield, ShieldAlert, LogOut, LayoutDashboard,
    Check, X, AlertTriangle, MessageSquare, ArrowRight, Trash2,
    RefreshCw, Download, Edit, Info, Quote, Laptop, HardDrive,
    Star, ChevronLeft, CheckCircle2, Smile, Frown, Meh, Send, ClipboardCheck, ClipboardList, Archive,
    Fingerprint, Building2, Circle
} from 'lucide-react';
import { exitAPI, adminAPI, reportingAPI } from '../services/api';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import './AdminExitManagement.css';

// --- Constants for Exit Interview ---
const REASON_OPTIONS = [
    'Personal/Family Reasons', 'Better Compensation', 'Career Growth',
    'Work-Life Balance', 'Health Issues', 'Management/Culture',
    'Relocation', 'Further Education', 'Starting Own Venture', 'Other'
];
const AGREEMENT_OPTIONS = ['Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree'];
const QUALITY_OPTIONS = ['Excellent', 'Good', 'Average', 'Poor', 'N/A'];
const SATISFACTION_OPTIONS = ['Highly Satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Highly Dissatisfied'];

export default function AdminExitManagement() {
    const { getCurrentUser, sessionType } = useAuth();
    const currentUser = getCurrentUser();

    const [activeTab, setActiveTab] = useState('ALL'); // ALL, PENDING, MANAGER_APPROVED, HR_APPROVED, EXIT_INITIATED
    const [searchTerm, setSearchTerm] = useState('');
    const [requests, setRequests] = useState([]);
    const [dashboard, setDashboard] = useState(null);
    const [terminations, setTerminations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Modals
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [terminateModalOpen, setTerminateModalOpen] = useState(false);
    const [lwdModalOpen, setLwdModalOpen] = useState(false);
    const [showExitInterviewModal, setShowExitInterviewModal] = useState(false);
    const [submittedFormData, setSubmittedFormData] = useState(null);
    const [selectedRequestAssets, setSelectedRequestAssets] = useState(null);
    const [assetModalOpen, setAssetModalOpen] = useState(false);
    const [assetForm, setAssetForm] = useState({
        handoverDate: '',
        handoverPersonId: '',
        notes: ''
    });


    // Forms
    const [terminateForm, setTerminateForm] = useState({
        employeeId: '',
        terminationType: 'Involuntary',
        terminationDate: '',
        lastWorkingDay: '',
        reason: '',
        noticeBuybackAmount: 0
    });

    const [approvalComment, setApprovalComment] = useState('');
    const [employees, setEmployees] = useState([]);
    const [newLwd, setNewLwd] = useState('');

    useEffect(() => {
        fetchData();
        fetchEmployees();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [dashRes, reqRes, termRes] = await Promise.all([
                exitAPI.getExitDashboard(),
                exitAPI.getAllExitRequests(),
                exitAPI.getTerminations()
            ]);
            setDashboard(dashRes.data);
            setRequests(Array.isArray(reqRes.data) ? reqRes.data : []);
            setTerminations(Array.isArray(termRes.data) ? termRes.data : []);
        } catch (e) {
            console.error("Failed to fetch exit data", e);
            setError("Failed to load exit management data");
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const res = await adminAPI.getAllEmployees();
            const list = Array.isArray(res.data) ? res.data : res.data.employees || [];
            setEmployees(list.filter(e => e.status !== 'TERMINATED'));
        } catch (e) {
            console.error("Failed to fetch employees", e);
        }
    };

    useEffect(() => {
        if (selectedRequest) {
            const updated = requests.find(r => r.id === selectedRequest.id);
            if (updated) setSelectedRequest(updated);
        }
    }, [requests]);

    useEffect(() => {
        if (detailsModalOpen && selectedRequest) {
            fetchRequestAssets(selectedRequest.id);
        } else if (!detailsModalOpen) {
            setSelectedRequestAssets(null);
        }
    }, [detailsModalOpen, selectedRequest]);

    const fetchRequestAssets = async (requestId) => {
        try {
            const res = await exitAPI.getAssetHandover(requestId);
            setSelectedRequestAssets(res.data);
        } catch (error) {
            console.error("Failed to fetch assets", error);
        }
    };

    const filteredRequests = requests.filter(r => {
        const matchesTab = activeTab === 'ALL' ? true : r.status === activeTab;
        const matchesSearch = searchTerm ? (
            (r.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.employeeIdString || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.reason || '').toLowerCase().includes(searchTerm.toLowerCase())
        ) : true;
        return matchesTab && matchesSearch;
    });

    const handleTerminate = async (e) => {
        e.preventDefault();
        if (!terminateForm.employeeId) {
            toast.error("Please select an employee for termination");
            return;
        }
        setLoading(true);
        try {
            await exitAPI.terminateEmployee({
                ...terminateForm,
                terminationDate: new Date(terminateForm.terminationDate).toISOString().split('T')[0],
                lastWorkingDay: new Date(terminateForm.lastWorkingDay).toISOString().split('T')[0]
            });
            toast.success("Employee termination processed successfully");
            setTerminateModalOpen(false);
            setTerminateForm({
                employeeId: '',
                terminationType: 'Involuntary',
                terminationDate: '',
                lastWorkingDay: '',
                reason: '',
                noticeBuybackAmount: 0
            });
            await fetchData();
            await fetchEmployees();
        } catch (e) {
            console.error("Termination error:", e);
            toast.error(e.response?.data?.message || "Termination process failed. Please check inputs.");
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (requestObj = null) => {
        const target = requestObj || selectedRequest;
        if (!target) return;
        setLoading(true);
        try {
            if (target.status === 'EXIT_INITIATED') {
                await exitAPI.closeExit(target.id);
                toast.success(`Exit process COMPLETED for ${target.employeeName}`);
            } else if (target.status === 'HR_APPROVED') {
                // When status is HR_APPROVED, the button says "Initiate Process"
                // This triggers the checklist by initiating the interview first
                await exitAPI.initiateInterview(target.id);
                toast.success(`Offboarding checklist STARTED for ${target.employeeName}`);
            } else {
                await exitAPI.approveExitRequest(target.id, {
                    action: 'APPROVE',
                    comments: approvalComment || 'Approved',
                    lastWorkingDay: newLwd
                });
                toast.success(`Exit request for ${target.employeeName} approved`);
            }
            
            setDetailsModalOpen(false);
            setApprovalComment('');
            setNewLwd('');
            await fetchData();
        } catch (e) {
            console.error("Action error:", e);
            toast.error(e.response?.data?.message || "Action failed");
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async (requestObj = null) => {
        const target = requestObj || selectedRequest;
        if (!target) return;
        if (!approvalComment) {
            toast.error("Please provide a reason in the comments section");
            setDetailsModalOpen(true); // Ensure details modal is open if it wasn't
            return;
        }
        setLoading(true);
        try {
            await exitAPI.rejectExitRequest(target.id, {
                action: 'REJECT',
                comments: approvalComment
            });
            toast.success(`Exit request for ${target.employeeName} rejected`);
            setDetailsModalOpen(false);
            setApprovalComment('');
            await fetchData();
        } catch (e) {
            console.error("Rejection error:", e);
            toast.error(e.response?.data?.message || "Rejection failed");
        } finally {
            setLoading(false);
        }
    };

    const handleViewExitForm = async (requestId) => {
        setLoading(true);
        try {
            const res = await exitAPI.getExitForm(requestId);
            setSubmittedFormData(res.data);
            setShowExitInterviewModal(true);
        } catch (error) {
            console.error("Failed to fetch exit form", error);
            toast.error("Exit form data could not be retrieved");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateLwd = async () => {
        if (!newLwd || !selectedRequest) return;
        setLoading(true);
        try {
            await exitAPI.updateLastWorkingDay(selectedRequest.id, {
                lastWorkingDay: newLwd
            });
            toast.success("Last working day updated successfully");
            setLwdModalOpen(false);
            setDetailsModalOpen(false);
            await fetchData();
        } catch (e) {
            console.error("LWD update error:", e);
            toast.error("Failed to update LWD");
        } finally {
            setLoading(false);
        }
    };

    const handleInitiateInterview = async () => {
        if (!selectedRequest) return;
        setLoading(true);
        try {
            await exitAPI.initiateInterview(selectedRequest.id);
            toast.success("Exit interview initiated and employee notified");
            await fetchData();
            // Refresh local selectedRequest from fetched data if needed
            const updated = requests.find(r => r.id === selectedRequest.id);
            if (updated) setSelectedRequest(updated);
        } catch (e) {
            toast.error(e.response?.data?.message || "Failed to initiate interview");
        } finally {
            setLoading(false);
        }
    };

    const handleAssignAssetHandover = async (e) => {
        e.preventDefault();
        if (!selectedRequest || !assetForm.handoverPersonId) return;
        setLoading(true);
        try {
            await exitAPI.assignAssetHandover(selectedRequest.id, assetForm);
            toast.success("Asset handover assigned successfully");
            setAssetModalOpen(false);
            await fetchData();
            const updated = requests.find(r => r.id === selectedRequest.id);
            if (updated) setSelectedRequest(updated);
        } catch (e) {
            toast.error("Failed to assign asset handover");
        } finally {
            setLoading(false);
        }
    };

    const handleTriggerFnf = async () => {
        if (!selectedRequest) return;
        setLoading(true);
        try {
            await exitAPI.triggerFnf(selectedRequest.id);
            toast.success("F&F settlement triggered");
            await fetchData();
            const updated = requests.find(r => r.id === selectedRequest.id);
            if (updated) setSelectedRequest(updated);
        } catch (e) {
            toast.error("Failed to trigger F&F");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyLetter = async () => {
        if (!selectedRequest) return;
        setLoading(true);
        try {
            await exitAPI.verifyResignationLetter(selectedRequest.id);
            toast.success("Resignation letter verified");
            await fetchData();
            const updated = requests.find(r => r.id === selectedRequest.id);
            if (updated) setSelectedRequest(updated);
        } catch (e) {
            toast.error("Verification failed");
        } finally {
            setLoading(false);
        }
    };

    const getStatusStyle = (status) => {
        const styles = {
            PENDING: { bg: 'rgba(245, 158, 11, 0.1)', text: '#F59E0B', dot: '#F59E0B' },
            MANAGER_APPROVED: { bg: 'rgba(59, 130, 246, 0.1)', text: '#3B82F6', dot: '#3B82F6' },
            HR_APPROVED: { bg: 'rgba(139, 92, 246, 0.1)', text: '#8B5CF6', dot: '#8B5CF6' },
            EXIT_INITIATED: { bg: 'rgba(16, 185, 129, 0.1)', text: '#10B981', dot: '#10B981' },
            EXIT_COMPLETED: { bg: 'rgba(16, 185, 129, 0.1)', text: '#10B981', dot: '#10B981' },
            REJECTED: { bg: 'rgba(239, 68, 68, 0.1)', text: '#EF4444', dot: '#EF4444' },
            CANCELLED: { bg: 'rgba(148, 163, 184, 0.1)', text: '#94A3B8', dot: '#94A3B8' }
        };
        return styles[status] || styles.PENDING;
    };

    const statusLabels = {
        'PENDING': 'Pending',
        'MANAGER_APPROVED': 'Manager Review',
        'HR_APPROVED': 'HR Review',
        'EXIT_INITIATED': 'Exit Initiated',
        'EXIT_COMPLETED': 'Completed',
        'REJECTED': 'Rejected'
    };

    const getInitials = (name) => {
        return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : '??';
    };

    const renderStatCard = (title, value, accentColor, subLabel) => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="premium-card"
            style={{ '--card-accent': accentColor }}
        >
            <div className="stat-title">{title}</div>
            <div className="stat-value">{value}</div>
            <div className="stat-sub">{subLabel}</div>
        </motion.div>
    );

    return (
        <>
        <div className="exit-management-wrapper">
            <Header title="Exit Management" subtitle="Manage employee departures" />
            
            <div className="exit-management-container">
                {/* Custom Styled Header Area */}
                <div className="flex justify-between items-center mb-2">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-1">Exit Management</h2>
                        <p className="text-gray-500 text-xs">Track and process employee resignation requests and manager approvals</p>
                    </div>
                    <div className="header-right-actions">
                        <button className="btn-export">
                            <Download size={14} />
                            <span>Export</span>
                        </button>
                    </div>
                {/* Removed misplaced ExitInterviewModal and fragment/return here */}
                    {renderStatCard("Manager review", dashboard?.pendingManagerApproval || 0, "#3B82F6", "Active requests")}
                    {renderStatCard("HR review", dashboard?.pendingHrApproval || 0, "#8B5CF6", "Active requests")}
                    {renderStatCard("Finalizing", dashboard?.exitInitiated || 0, "#10B981", "Active requests")}
                </div>

                {/* Search & Filter Area */}
                <div className="search-filter-area">
                    <div className="search-wrapper">
                        <input
                            type="text"
                            placeholder="Search by name, department or reason..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="filter-section">
                        {['ALL', 'PENDING', 'MANAGER_APPROVED', 'HR_APPROVED', 'EXIT_INITIATED'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`tab-trigger ${activeTab === tab ? 'active' : ''}`}
                            >
                                {tab === 'ALL' ? 'Everything' : tab.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Requests Grid */}
                <div className="grid grid-cols-1 gap-8 mb-12">
                    {filteredRequests.map((req, idx) => {
                        const style = getStatusStyle(req.status);
                        const checklistTotal = 6;
                        const checklistDone = [
                            req.exitFormSubmitted,
                            req.exitInterviewStatus === 'COMPLETED',
                            req.assetHandoverAssigned,
                            req.assetHandoverCompleted,
                            req.fnfTriggered,
                            req.resignationLetterVerified || !!req.resignationLetterPath
                        ].filter(Boolean).length;

                        return (
                            <motion.div
                                key={req.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                style={{
                                    background: '#fff',
                                    borderRadius: 24,
                                    border: '1.5px solid #e8eaf0',
                                    boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
                                    overflow: 'hidden',
                                    transition: 'box-shadow 0.3s',
                                }}
                            >
                                {/* ── HEADER ── */}
                                <div style={{ padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    {/* Left: Avatar + Name */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                        <div style={{
                                            width: 68, height: 68, borderRadius: '50%',
                                            background: '#ede9fe',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 22, fontWeight: 900, color: '#6d5de3',
                                            flexShrink: 0,
                                        }}>
                                            {getInitials(req.employeeName)}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 22, fontWeight: 900, color: '#111827', lineHeight: 1.2, letterSpacing: '-0.3px' }}>
                                                {req.employeeName}
                                            </div>
                                            <div style={{ fontSize: 14, color: '#9ca3af', fontWeight: 600, marginTop: 4 }}>
                                                {req.department || 'HR'} · {req.jobTitle || 'Team Member'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Status + ID */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        {/* Status pill — orange */}
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '8px 18px', borderRadius: 999,
                                            background: '#fff7ed', border: '1.5px solid #fed7aa',
                                            fontSize: 13, fontWeight: 700, color: '#c2410c',
                                        }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316' }} />
                                            {statusLabels[req.status] || req.status}
                                        </div>
                                        {/* ID pill — gray outlined */}
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '8px 18px', borderRadius: 999,
                                            background: '#f8fafc', border: '1.5px solid #e2e8f0',
                                            fontSize: 12, fontWeight: 700, color: '#64748b',
                                            letterSpacing: '0.02em',
                                        }}>
                                            <div style={{
                                                width: 14, height: 14, border: '1.5px solid #94a3b8',
                                                borderRadius: 3, flexShrink: 0
                                            }} />
                                            {req.requestId || `EXIT-${req.id}`}
                                        </div>
                                    </div>
                                </div>

                                {/* ── BODY ── */}
                                <div style={{
                                    display: 'flex', alignItems: 'stretch',
                                    borderTop: '1.5px solid #f1f5f9', borderBottom: '1.5px solid #f1f5f9',
                                    padding: '28px 0',
                                }}>
                                    {/* Col 1: Last Working Day */}
                                    <div style={{ flex: '0 0 200px', padding: '0 28px', borderRight: '1.5px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        <div style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                            LAST WORKING<br />DAY
                                        </div>
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 8,
                                            padding: '10px 14px', borderRadius: 12,
                                            background: '#d1fae5', color: '#065f46',
                                            fontSize: 15, fontWeight: 800,
                                        }}>
                                            <div style={{ width: 14, height: 14, border: '2px solid #059669', borderRadius: 3, flexShrink: 0 }} />
                                            {req.lastWorkingDay ? new Date(req.lastWorkingDay).toLocaleDateString('en-CA') : '2026-06-05'}
                                        </div>
                                    </div>

                                    {/* Col 2: Reason for Departure */}
                                    <div style={{ flex: '0 0 220px', padding: '0 28px', borderRight: '1.5px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        <div style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                            REASON FOR<br />DEPARTURE
                                        </div>
                                        <div style={{ fontSize: 15, color: '#374151', fontStyle: 'italic', fontWeight: 600, lineHeight: 1.5 }}>
                                            "{req.reason || 'Better opportunity'}"
                                        </div>
                                    </div>

                                    {/* Col 3: Department */}
                                    <div style={{ flex: '0 0 200px', padding: '0 28px', borderRight: '1.5px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        <div style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                            DEPARTMENT
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 16, height: 16, border: '2px solid #94a3b8', borderRadius: 3, flexShrink: 0 }} />
                                            <div style={{ fontSize: 17, fontWeight: 900, color: '#111827', lineHeight: 1.3 }}>
                                                {req.department || 'Human Resources'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Col 4: Checklist Progress */}
                                    <div style={{ flex: 1, padding: '0 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        {/* Label + count */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                                CHECKLIST PROGRESS
                                            </div>
                                            <div style={{ fontSize: 13, fontWeight: 900, color: '#059669' }}>
                                                {checklistDone} / {checklistTotal} tasks
                                            </div>
                                        </div>

                                        {/* Progress bar */}
                                        <div style={{ height: 5, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${(checklistDone / checklistTotal) * 100}%`,
                                                background: '#10b981', borderRadius: 999,
                                                transition: 'width 0.7s ease',
                                            }} />
                                        </div>

                                        {/* Step circles */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', paddingTop: 4 }}>
                                            {/* Connector line */}
                                            <div style={{
                                                position: 'absolute', top: 16, left: 14, right: 14,
                                                height: 2, background: '#e2e8f0', zIndex: 0
                                            }} />
                                            {[
                                                { label: 'Manager',  done: ['MANAGER_APPROVED','HR_APPROVED','EXIT_INITIATED','EXIT_COMPLETED'].includes(req.status) },
                                                { label: 'HR Audit', done: ['HR_APPROVED','EXIT_INITIATED','EXIT_COMPLETED'].includes(req.status) },
                                                { label: 'Asset H/O', done: req.assetHandoverCompleted },
                                                { label: 'F&F',      done: req.fnfTriggered },
                                                { label: 'Final Exit', done: req.status === 'EXIT_COMPLETED', isLast: true },
                                            ].map((step, sIdx) => (
                                                <div key={sIdx} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                                    <div style={{
                                                        width: 30, height: 30, borderRadius: '50%',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        border: `2px solid ${step.done ? '#10b981' : step.isLast ? '#10b981' : '#10b981'}`,
                                                        background: step.done ? '#10b981' : '#fff',
                                                        color: step.done ? '#fff' : '#10b981',
                                                        transition: 'all 0.4s',
                                                    }}>
                                                        {step.done
                                                            ? <Check size={14} strokeWidth={3} />
                                                            : step.isLast
                                                                ? <div style={{ width: 10, height: 10, border: '1.5px solid #10b981', borderRadius: 2 }} />
                                                                : <div style={{ width: 10, height: 10, background: '#10b981', borderRadius: 2 }} />
                                                        }
                                                    </div>
                                                    <span style={{
                                                        fontSize: 9, fontWeight: 800,
                                                        color: step.done ? '#059669' : '#94a3b8',
                                                        textAlign: 'center', whiteSpace: 'nowrap',
                                                        textTransform: 'uppercase', letterSpacing: '0.03em',
                                                    }}>
                                                        {step.label}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* ── FOOTER ── */}
                                <div style={{ padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    {/* Modified date */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#9ca3af', fontWeight: 600 }}>
                                        <div style={{ width: 14, height: 14, border: '1.5px solid #cbd5e1', borderRadius: 3 }} />
                                        Modified {new Date(req.updatedAt).toLocaleDateString()}
                                    </div>

                                    {/* Action buttons — both ghost/outlined style */}
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        <button
                                            onClick={() => { setSelectedRequest(req); setDetailsModalOpen(true); }}
                                            style={{
                                                padding: '11px 28px', borderRadius: 14,
                                                border: '1.5px solid #e2e8f0',
                                                background: '#fff', color: '#111827',
                                                fontSize: 14, fontWeight: 800,
                                                cursor: 'pointer', transition: 'all 0.2s',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                        >
                                            View details
                                        </button>
                                        <button
                                            onClick={() => { setSelectedRequest(req); setDetailsModalOpen(true); }}
                                            style={{
                                                padding: '11px 28px', borderRadius: 14,
                                                border: '1.5px solid #e2e8f0',
                                                background: '#fff', color: '#111827',
                                                fontSize: 14, fontWeight: 800,
                                                cursor: 'pointer', transition: 'all 0.2s',
                                                display: 'flex', alignItems: 'center', gap: 8,
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                        >
                                            <div style={{ width: 14, height: 14, border: '1.5px solid #374151', borderRadius: 3 }} />
                                            Complete
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}

                    {filteredRequests.length === 0 && (
                        <div className="col-span-full py-32 flex flex-col items-center justify-center bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
                            <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center text-slate-200 mb-6">
                                <Search size={48} />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 mb-2">No clearance requests found</h3>
                            <p className="text-slate-400 font-medium text-sm mb-8 text-center max-w-md">
                                Try adjusting your filters or search terms to find the specific employee resignation records.
                            </p>
                            <button 
                                onClick={() => {setSearchTerm(''); setActiveTab('ALL');}}
                                className="px-8 py-3 rounded-2xl bg-white text-indigo-600 font-black text-xs uppercase tracking-widest shadow-lg border border-slate-100 hover:shadow-xl transition-all"
                            >
                                Reset all filters
                            </button>
                        </div>
                    )}
                </div>

                {/* Termination Alerts */}
                {terminations.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-6 mt-4"
                    >
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-black text-[#1E293B] flex items-center gap-3">
                                <span className="w-2 h-8 bg-red-500 rounded-full"></span>
                                Security & Access Revocations
                            </h2>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{terminations.length} RECORDS IN FILE</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {terminations.slice(0, 3).map(term => (
                                <motion.div 
                                    whileHover={{ y: -5 }}
                                    key={term.id} 
                                    className="premium-card border-l-4 border-l-red-500 !bg-white"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="font-black text-lg text-gray-800">{term.employeeName}</div>
                                        <span className="px-3 py-1 rounded-full bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-tighter">
                                            {term.terminationType}
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                                                <Calendar size={14} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-400 uppercase text-[9px]">Effective Since</div>
                                                <div className="font-bold text-gray-700">{new Date(term.terminationDate).toLocaleDateString()}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-400">
                                                <ShieldAlert size={14} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-red-400 uppercase text-[9px]">Access Status</div>
                                                <div className="font-black text-red-600">FULLY REVOKED</div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Exit Request Details Modal (Redesigned) */}
            <AnimatePresence>
                {detailsModalOpen && selectedRequest && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setDetailsModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white rounded-[20px] shadow-2xl w-full max-w-[1000px] max-h-[90vh] flex flex-col overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Dark Header/Hero Section */}
                            <div style={{
                                background: '#0a0d1d',
                                color: '#fff',
                                padding: '32px 40px',
                                position: 'relative'
                            }}>
                                <button 
                                    onClick={() => setDetailsModalOpen(false)}
                                    style={{ position: 'absolute', top: '32px', right: '40px', background: 'rgba(255,255,255,0.06)', border: 'none', color: '#94a3b8', borderRadius: '12px', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', zIndex: 20 }}
                                    title="Close Modal"
                                >
                                    <X size={20} />
                                </button>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 900, marginBottom: '8px' }}>ADMIN REVIEW · CASE #{selectedRequest.requestId || selectedRequest.id}</div>
                                        <h2 style={{ fontSize: '28px', margin: 0, fontWeight: 900, letterSpacing: '-0.02em' }}>Exit Case Review</h2>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', marginRight: '50px' }}>
                                        <span style={{ 
                                            background: 'rgba(134,239,172,0.1)', 
                                            color: '#4ade80', 
                                            padding: '8px 20px', 
                                            borderRadius: '999px', 
                                            fontSize: '11px', 
                                            fontWeight: 900, 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '10px',
                                            border: '1px solid rgba(134,239,172,0.2)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em'
                                        }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4ade80', boxShadow: '0 0 10px #4ade80' }}></div>
                                            {statusLabels[selectedRequest.status] || selectedRequest.status}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
                                    <div style={{
                                        width: '72px', height: '72px', borderRadius: '24px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 900,
                                        boxShadow: '0 10px 20px rgba(99, 102, 241, 0.2)', color: '#fff'
                                    }}>
                                        {getInitials(selectedRequest.employeeName)}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '-0.01em' }}>{selectedRequest.employeeName}</div>
                                        <div style={{ fontSize: '15px', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>{selectedRequest.jobTitle || 'Employee'} · {selectedRequest.department || 'General'}</div>
                                    </div>
                                </div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '32px' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px 20px' }}>
                                        <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.1em' }}>Submissions Date</div>
                                        <div style={{ fontWeight: 800, fontSize: '16px' }}>{new Date(selectedRequest.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px 20px' }}>
                                        <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.1em' }}>Target Exit Date</div>
                                        <div style={{ fontWeight: 800, fontSize: '16px', color: (newLwd || selectedRequest.lastWorkingDay) ? '#fff' : '#fbbf24' }}>
                                            {newLwd ? new Date(newLwd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : (selectedRequest.lastWorkingDay ? new Date(selectedRequest.lastWorkingDay).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Pending HR')}
                                        </div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px 20px' }}>
                                        <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.1em' }}>Case Duration</div>
                                        <div style={{ fontWeight: 800, fontSize: '16px' }}>{Math.floor((new Date() - new Date(selectedRequest.createdAt)) / (1000 * 60 * 60 * 24))} Days Open</div>
                                    </div>
                                </div>

                                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '16px 20px', marginTop: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '12px' }}>
                                        <Info size={18} className="text-indigo-400" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '4px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Reason for Departure</div>
                                        <div style={{ fontWeight: 600, fontSize: '14px', lineHeight: 1.5, color: '#d1d5db', fontStyle: 'italic' }}>"{selectedRequest.reason || 'No specific reason provided'}"</div>
                                    </div>
                                </div>
                            </div>

                            {/* Main Content Area */}
                            <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', padding: '32px' }} className="white-scrollbar">
                                <style>{`
                                    .white-scrollbar::-webkit-scrollbar { width: 6px; }
                                    .white-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; }
                                    .white-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                                `}</style>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Left Column: Timeline & Checklist */}
                                    <div className="space-y-6">
                                        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
                                            <div style={{ fontSize: '12px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '32px' }}>APPROVAL TRACKING</div>
                                            
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                                {/* Submissions */}
                                                <div style={{ display: 'flex', gap: '20px', position: 'relative' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#dcfce7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #86efac', zIndex: 2 }}>
                                                            <CheckCircle size={20} />
                                                        </div>
                                                        <div style={{ width: '2px', height: '48px', background: '#86efac', margin: '4px 0' }}></div>
                                                    </div>
                                                    <div style={{ paddingBottom: '40px' }}>
                                                        <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>Request Submitted</div>
                                                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Case logged by employee on {new Date(selectedRequest.createdAt).toLocaleDateString()}</div>
                                                    </div>
                                                </div>

                                                {/* Manager Stage */}
                                                <div style={{ display: 'flex', gap: '20px', position: 'relative' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                        <div style={{ 
                                                            width: '36px', height: '36px', borderRadius: '50%', 
                                                            background: ['MANAGER_APPROVED', 'HR_APPROVED', 'EXIT_INITIATED', 'EXIT_COMPLETED'].includes(selectedRequest.status) ? '#dcfce7' : '#f1f5f9', 
                                                            color: ['MANAGER_APPROVED', 'HR_APPROVED', 'EXIT_INITIATED', 'EXIT_COMPLETED'].includes(selectedRequest.status) ? '#166534' : '#94a3b8', 
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                            border: ['MANAGER_APPROVED', 'HR_APPROVED', 'EXIT_INITIATED', 'EXIT_COMPLETED'].includes(selectedRequest.status) ? '2px solid #86efac' : '2px solid #f1f5f9',
                                                            zIndex: 2 
                                                        }}>
                                                            {['MANAGER_APPROVED', 'HR_APPROVED', 'EXIT_INITIATED', 'EXIT_COMPLETED'].includes(selectedRequest.status) ? <CheckCircle size={20} /> : <Clock size={20} />}
                                                        </div>
                                                        <div style={{ width: '2px', height: '48px', background: ['MANAGER_APPROVED', 'HR_APPROVED', 'EXIT_INITIATED', 'EXIT_COMPLETED'].includes(selectedRequest.status) ? '#86efac' : '#f1f5f9', margin: '4px 0' }}></div>
                                                    </div>
                                                    <div style={{ paddingBottom: '40px' }}>
                                                        <div style={{ fontWeight: 800, fontSize: '15px', color: ['MANAGER_APPROVED', 'HR_APPROVED', 'EXIT_INITIATED', 'EXIT_COMPLETED'].includes(selectedRequest.status) ? '#0f172a' : '#94a3b8' }}>Manager Endorsement</div>
                                                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                                                            {['MANAGER_APPROVED', 'HR_APPROVED', 'EXIT_INITIATED', 'EXIT_COMPLETED'].includes(selectedRequest.status) 
                                                                ? `Verified by ${selectedRequest.managerName || 'Manager'}` 
                                                                : (selectedRequest.status === 'REJECTED' ? "Action terminated" : "Awaiting departmental head review")}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* HR Stage */}
                                                <div style={{ display: 'flex', gap: '20px', position: 'relative' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                        <div style={{ 
                                                            width: '36px', height: '36px', borderRadius: '50%', 
                                                            background: ['HR_APPROVED', 'EXIT_INITIATED', 'EXIT_COMPLETED'].includes(selectedRequest.status) ? '#dcfce7' : '#f1f5f9', 
                                                            color: ['HR_APPROVED', 'EXIT_INITIATED', 'EXIT_COMPLETED'].includes(selectedRequest.status) ? '#166534' : '#94a3b8', 
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                            border: ['HR_APPROVED', 'EXIT_INITIATED', 'EXIT_COMPLETED'].includes(selectedRequest.status) ? '2px solid #86efac' : '2px solid #f1f5f9',
                                                            zIndex: 2 
                                                        }}>
                                                            {['HR_APPROVED', 'EXIT_INITIATED', 'EXIT_COMPLETED'].includes(selectedRequest.status) ? <CheckCircle size={20} /> : <UserX size={20} />}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 800, fontSize: '15px', color: ['HR_APPROVED', 'EXIT_INITIATED', 'EXIT_COMPLETED'].includes(selectedRequest.status) ? '#0f172a' : '#94a3b8' }}>Corporate HR Approval</div>
                                                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                                                            {['HR_APPROVED', 'EXIT_INITIATED', 'EXIT_COMPLETED'].includes(selectedRequest.status) 
                                                                ? "Final validation successful" 
                                                                : "Pending HR verification and notice audit"}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Detailed Approval History */}
                                        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
                                            <div style={{ fontSize: '12px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '4px', height: '16px', background: '#6366f1', borderRadius: '4px' }}></div>
                                                Approval Workflow
                                            </div>
                                            <div className="space-y-8 relative">
                                                {/* Vertical Connector Line */}
                                                {selectedRequest.approvals && selectedRequest.approvals.length > 1 && (
                                                    <div style={{ position: 'absolute', left: '19px', top: '40px', bottom: '40px', width: '2px', background: '#f1f5f9' }}></div>
                                                )}

                                                {selectedRequest.approvals && selectedRequest.approvals.length > 0 ? (
                                                    selectedRequest.approvals.map((approval, idx) => (
                                                        <div key={approval.id} className="relative flex gap-6 items-start">
                                                            {/* Status Icon with Ring */}
                                                            <div style={{ 
                                                                width: '40px', height: '40px', borderRadius: '14px', 
                                                                background: approval.status?.toUpperCase() === 'APPROVED' ? '#ecfdf5' : '#fef2f2',
                                                                color: approval.status?.toUpperCase() === 'APPROVED' ? '#10b981' : '#ef4444',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                boxShadow: '0 4px 12px rgba(0,0,0,0.03)', zIndex: 10, flexShrink: 0,
                                                                border: `1.5px solid ${approval.status?.toUpperCase() === 'APPROVED' ? '#d1fae5' : '#fee2e2'}`
                                                            }}>
                                                                {approval.status?.toUpperCase() === 'APPROVED' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                                                            </div>

                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex flex-wrap justify-between items-start mb-2 gap-4">
                                                                    <div>
                                                                        <div className="text-[16px] font-black text-slate-900 leading-tight mb-1">{approval.approverName}</div>
                                                                        <div className="text-[11px] font-black text-slate-500 uppercase tracking-[0.1em] mb-1">{approval.approverRole || 'Manager'}</div>
                                                                        <div className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.1em]">{approval.approvalLevel} LEVEL</div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <div className="text-[12px] font-black text-slate-400 tabular-nums">
                                                                            {approval.actionDate ? new Date(approval.actionDate).toLocaleString('en-GB', { 
                                                                                day: '2-digit', month: '2-digit', year: 'numeric', 
                                                                                hour: '2-digit', minute: '2-digit', second: '2-digit' 
                                                                            }).replace(/\//g, '/') : 'Pending'}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {approval.comments && (
                                                                    <div style={{ 
                                                                        background: '#f8fafc', padding: '16px 20px', borderRadius: '18px', 
                                                                        border: '1.5px solid #f1f5f9', marginTop: '14px',
                                                                        position: 'relative', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                                                                    }}>
                                                                        <div className="text-[14px] text-slate-600 font-bold leading-relaxed italic text-indigo-900/70">
                                                                            "{approval.comments}"
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-center py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">
                                                        <div className="text-slate-400 font-bold text-sm">No entries in the workflow yet</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Exit Checklist Section */}
                                        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                                                <div style={{ fontSize: '12px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ width: '4px', height: '16px', background: '#6366f1', borderRadius: '4px' }}></div>
                                                    EXIT CHECKLIST
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl uppercase tracking-widest border border-indigo-100">
                                                        {[
                                                            selectedRequest.exitFormSubmitted,
                                                            selectedRequest.exitInterviewStatus === 'COMPLETED',
                                                            selectedRequest.assetHandoverAssigned,
                                                            selectedRequest.assetHandoverCompleted,
                                                            selectedRequest.fnfTriggered,
                                                            selectedRequest.resignationLetterVerified || !!selectedRequest.resignationLetterPath
                                                        ].filter(Boolean).length} / 6 COMPLETED
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                {[
                                                    { 
                                                        id: 'FORM', 
                                                        label: 'Exit Interview Form', 
                                                        icon: Star,
                                                        status: selectedRequest.exitFormSubmitted ? 'COMPLETED' : 
                                                                selectedRequest.exitInterviewStatus === 'INITIATED' ? 'IN_PROGRESS' : 
                                                                ['HR_APPROVED', 'EXIT_INITIATED'].includes(selectedRequest.status) ? 'ACTION_REQUIRED' : 'PENDING',
                                                        sub: selectedRequest.exitFormSubmitted ? `Submitted on ${new Date(selectedRequest.exitFormSubmittedAt || selectedRequest.updatedAt).toLocaleDateString()}` : 
                                                             selectedRequest.exitInterviewStatus === 'INITIATED' ? 'Waiting for employee feedback' : 'Initiation required',
                                                        action: selectedRequest.exitFormSubmitted ? () => handleViewExitForm(selectedRequest.id) : handleInitiateInterview,
                                                        actionLabel: selectedRequest.exitFormSubmitted ? 'View Response' : 'Initiate Interview'
                                                    },
                                                    {
                                                        id: 'ASSET_ASSIGN',
                                                        label: 'Asset Handover Assigned',
                                                        icon: Briefcase,
                                                        status: selectedRequest.assetHandoverAssigned ? 'COMPLETED' : 
                                                                (selectedRequest.exitFormSubmitted ? 'ACTION_REQUIRED' : 'PENDING'),
                                                        sub: selectedRequest.assetHandoverAssignee ? `Assigned to ${selectedRequest.assetHandoverAssignee}` : 'Pending assignment',
                                                        action: () => setAssetModalOpen(true),
                                                        actionLabel: 'Initiate Handover'
                                                    },
                                                    {
                                                        id: 'ASSET_RETURN',
                                                        label: 'Asset Handover Completed',
                                                        icon: CheckCircle2,
                                                        status: selectedRequest.assetHandoverCompleted ? 'COMPLETED' : 
                                                                (selectedRequest.assetHandoverAssigned ? 'IN_PROGRESS' : 'PENDING'),
                                                        sub: selectedRequest.assetHandoverCompletedAt ? `Completed on ${new Date(selectedRequest.assetHandoverCompletedAt).toLocaleDateString()}` : 
                                                             selectedRequest.assetHandoverAssigned ? 'Pending asset returns' : 'Waiting for assignment'
                                                    },
                                                    {
                                                        id: 'FNF',
                                                        label: 'F&F Settlement Triggered',
                                                        icon: RefreshCw,
                                                        status: selectedRequest.fnfTriggered ? 'COMPLETED' : 
                                                                (selectedRequest.assetHandoverCompleted ? 'ACTION_REQUIRED' : 'PENDING'),
                                                        sub: selectedRequest.fnfStatus || 'Clearance pending',
                                                        action: handleTriggerFnf,
                                                        actionLabel: 'Process F&F'
                                                    },
                                                    {
                                                        id: 'LETTER',
                                                        label: 'Resignation Letter Verified',
                                                        icon: FileText,
                                                        status: selectedRequest.resignationLetterVerified ? 'COMPLETED' : 
                                                                (!!selectedRequest.resignationLetterPath ? 'ACTION_REQUIRED' : 'PENDING'),
                                                        sub: selectedRequest.resignationLetterPath ? 'Document available for audit' : 'Awaiting upload',
                                                        action: handleVerifyLetter,
                                                        actionLabel: 'Verify Document'
                                                    }
                                                ].map((step, idx) => {
                                                    let statusTheme = {
                                                        bg: '#f8fafc',
                                                        color: '#64748b',
                                                        border: '#f1f5f9',
                                                        text: 'Pending',
                                                        icon: <Clock size={12} />
                                                    };

                                                    if (step.status === 'COMPLETED') {
                                                        statusTheme = {
                                                            bg: '#ecfdf5',
                                                            color: '#10b981',
                                                            border: '#d1fae5',
                                                            text: 'Completed',
                                                            icon: <CheckCircle2 size={12} />
                                                        };
                                                    } else if (step.status === 'ACTION_REQUIRED') {
                                                        statusTheme = {
                                                            bg: '#eff6ff',
                                                            color: '#3b82f6',
                                                            border: '#dbeafe',
                                                            text: 'Available',
                                                            icon: <AlertCircle size={12} />
                                                        };
                                                    } else if (step.status === 'IN_PROGRESS') {
                                                        statusTheme = {
                                                            bg: '#fff7ed',
                                                            color: '#f59e0b',
                                                            border: '#ffedd5',
                                                            text: 'In Progress',
                                                            icon: <RefreshCw size={12} className="animate-spin" />
                                                        };
                                                    }

                                                    return (
                                                        <div key={idx} className="group p-6 rounded-3xl border border-slate-100 bg-white hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300">
                                                            <div className="flex justify-between items-start mb-4">
                                                                <div className="flex gap-5">
                                                                    <div style={{ 
                                                                        width: '52px', height: '52px', borderRadius: '18px', 
                                                                        background: step.status === 'COMPLETED' ? '#ecfdf5' : '#f8fafc',
                                                                        color: step.status === 'COMPLETED' ? '#10b981' : '#94a3b8',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                        transition: 'all 0.3s',
                                                                        boxShadow: step.status === 'COMPLETED' ? '0 8px 16px rgba(16, 185, 129, 0.1)' : 'none'
                                                                    }} className="group-hover:scale-110">
                                                                        <step.icon size={24} />
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-[17px] font-black text-slate-900 leading-tight mb-1">{step.label}</div>
                                                                        <div className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">{step.sub}</div>
                                                                    </div>
                                                                </div>
                                                                <div style={{ 
                                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                                    padding: '6px 14px', borderRadius: '10px',
                                                                    background: statusTheme.bg, color: statusTheme.color,
                                                                    border: `1.5px solid ${statusTheme.border}`,
                                                                    fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em'
                                                                }}>
                                                                    {statusTheme.icon}
                                                                    {statusTheme.text}
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Flow-aligned Button */}
                                                            {(step.status === 'ACTION_REQUIRED' || (step.id === 'FORM' && step.status === 'COMPLETED')) && step.action && (
                                                                <div className="pl-[72px]">
                                                                    <button 
                                                                        onClick={step.action}
                                                                        className="px-6 py-2.5 bg-indigo-600 text-white text-[12px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-900 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 group/btn"
                                                                    >
                                                                        {step.actionLabel}
                                                                        <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Asset Details Section */}
                                        {selectedRequestAssets && selectedRequestAssets.assetItems && selectedRequestAssets.assetItems.length > 0 && (
                                            <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm mt-6">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                                                    <div style={{ fontSize: '12px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <div style={{ width: '4px', height: '16px', background: '#6366f1', borderRadius: '4px' }}></div>
                                                        ASSET HANDOVER STATUS
                                                    </div>
                                                </div>

                                                <div style={{ 
                                                    background: '#f8fafc', padding: '32px', borderRadius: '32px', 
                                                    border: '1.5px solid #f1f5f9', marginBottom: '32px'
                                                }}>
                                                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">HANDOVER PERSON:</div>
                                                    <div className="flex flex-col items-start gap-4">
                                                        <div style={{ 
                                                            width: '64px', height: '64px', borderRadius: '22px', 
                                                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                                            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: '24px', fontWeight: 900, boxShadow: '0 10px 20px rgba(99, 102, 241, 0.2)'
                                                        }}>
                                                            {getInitials(selectedRequestAssets.handoverPersonName || 'Wait')}
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <div className="text-[20px] font-black text-slate-900 leading-tight">
                                                                {selectedRequestAssets.handoverPersonName || 'Unassigned'}
                                                            </div>
                                                            <div className="text-[13px] text-indigo-600 font-black uppercase tracking-widest">
                                                                {selectedRequestAssets.handoverPersonEmployeeId ? `(${selectedRequestAssets.handoverPersonEmployeeId})` : 'N/A'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="space-y-8">
                                                    {selectedRequestAssets.assetItems.map(item => (
                                                        <div key={item.id} className="p-8 rounded-[32px] border border-slate-100 bg-white hover:border-indigo-200 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 group">
                                                            <div className="flex flex-col gap-5">
                                                                <div className="flex flex-col gap-2">
                                                                    <div className="text-[18px] font-black text-slate-800 leading-tight tracking-tight group-hover:text-indigo-600 transition-colors">
                                                                        {item.assetName}
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="p-1.5 bg-slate-100 rounded-lg text-slate-400">
                                                                            {item.assetType === 'LAPTOP' ? <Laptop size={14} /> : <HardDrive size={14} />}
                                                                        </div>
                                                                        <div className="text-[12px] text-slate-400 font-black uppercase tracking-widest">
                                                                            {item.assetType}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div style={{ 
                                                                    display: 'inline-flex', alignSelf: 'flex-start',
                                                                    padding: '8px 20px', borderRadius: '12px',
                                                                    background: item.status === 'RETURNED' ? '#ecfdf5' : item.status === 'MISSING' ? '#fef2f2' : '#fff7ed',
                                                                    color: item.status === 'RETURNED' ? '#10b981' : item.status === 'MISSING' ? '#ef4444' : '#f59e0b',
                                                                    border: `2px solid ${item.status === 'RETURNED' ? '#d1fae5' : item.status === 'MISSING' ? '#fee2e2' : '#ffedd5'}`,
                                                                    fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em'
                                                                }}>
                                                                    {item.status}
                                                                </div>

                                                                {item.comments && (
                                                                    <div style={{ 
                                                                        background: '#f8fafc', padding: '20px', borderRadius: '20px', 
                                                                        border: '1.5px solid #f1f5f9', position: 'relative'
                                                                    }}>
                                                                        <div className="text-[14px] text-slate-600 font-bold leading-relaxed italic text-indigo-900/60">
                                                                            "{item.comments}"
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                
                                                {selectedRequestAssets.notes && (
                                                    <div className="mt-12 p-8 bg-slate-900 rounded-[32px] relative overflow-hidden group border-4 border-slate-800 shadow-2xl">
                                                        <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:scale-150 transition-transform duration-1000">
                                                            <FileText size={120} color="white" />
                                                        </div>
                                                        <div className="relative z-10">
                                                            <div className="flex items-center gap-3 mb-4">
                                                                <div className="w-8 h-1 rounded-full bg-indigo-500"></div>
                                                                <div className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.3em]">HANDOVER NOTES</div>
                                                            </div>
                                                            <div className="text-[16px] text-indigo-50 font-bold leading-relaxed">
                                                                {selectedRequestAssets.notes}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                

                                            </div>
                                        )}
                                    </div>

                                    {/* Right Column: Decisions & Details */}
                                    <div className="space-y-6">
                                        {/* HR Final Review Action Box */}
                                        {selectedRequest.status === 'MANAGER_APPROVED' && (
                                            <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
                                                <div className="relative z-10">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="bg-white/20 p-2 rounded-lg backdrop-blur-md">
                                                            <AlertCircle size={20} />
                                                        </div>
                                                        <span className="text-xs font-black uppercase tracking-widest opacity-80">HR Final Review</span>
                                                    </div>
                                                    <h3 className="text-xl font-bold mb-2">Awaiting your decision</h3>
                                                    <p className="text-sm text-indigo-500 bg-white/10 p-3 rounded-xl mb-6 leading-relaxed border border-white/10">
                                                        Set the last working day, confirm notice period, then approve to initiate exit or reject the request.
                                                    </p>
                                                    <div className="flex gap-4">
                                                        <button 
                                                            onClick={() => handleApprove()}
                                                            className="bg-white text-indigo-600 border-none px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors shadow-lg"
                                                        >
                                                            Approve & Initiate Exit
                                                        </button>
                                                        <button 
                                                            onClick={() => handleReject()}
                                                            className="bg-transparent border-2 border-white/30 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-colors"
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Exit Completed Status */}
                                        {selectedRequest.status === 'EXIT_COMPLETED' && (
                                            <div className="bg-emerald-600 rounded-3xl p-8 text-white shadow-xl shadow-emerald-100 relative overflow-hidden">
                                                <div className="relative z-10">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="bg-white/20 p-2 rounded-lg backdrop-blur-md">
                                                            <Check size={20} />
                                                        </div>
                                                        <span className="text-xs font-black uppercase tracking-widest opacity-80">Offboarding Complete</span>
                                                    </div>
                                                    <h3 className="text-xl font-bold mb-2">Exit completed</h3>
                                                    <p className="text-sm text-emerald-100 leading-relaxed bg-black/5 p-3 rounded-xl border border-white/10">
                                                        Clearance, F&F settlement and offboarding tasks have been successfully finalized.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Action: LWD Update */}
                                        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                                                <div style={{ background: '#eff6ff', color: '#3b82f6', padding: '10px', borderRadius: '12px' }}>
                                                    <Calendar size={20} />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>Set Effective Exit Date</div>
                                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Override policy or confirm handover timeline</div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <input 
                                                    type="date" 
                                                    value={newLwd || (selectedRequest.lastWorkingDay ? new Date(selectedRequest.lastWorkingDay).toISOString().split('T')[0] : '')}
                                                    onChange={(e) => setNewLwd(e.target.value)}
                                                    style={{ 
                                                        flex: 1, padding: '14px 18px', borderRadius: '14px', border: '1.5px solid #e2e8f0', 
                                                        fontSize: '14px', fontWeight: 700, color: '#1e293b', outline: 'none',
                                                        background: '#f8fafc'
                                                    }}
                                                />
                                                <button 
                                                    onClick={handleUpdateLwd}
                                                    disabled={!newLwd}
                                                    style={{ 
                                                        padding: '0 24px', borderRadius: '14px', background: '#3b82f6', color: '#fff', 
                                                        fontWeight: 900, border: 'none', cursor: 'pointer', fontSize: '13px',
                                                        opacity: newLwd ? 1 : 0.5, textTransform: 'uppercase', letterSpacing: '0.05em'
                                                    }}
                                                >
                                                    {loading ? '...' : 'Update'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Comments Area */}
                                        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                                                <div style={{ background: '#fef2f2', color: '#ef4444', padding: '10px', borderRadius: '12px' }}>
                                                    <MessageSquare size={20} />
                                                </div>
                                                <div style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>Internal Comments</div>
                                            </div>
                                            <textarea 
                                                value={approvalComment}
                                                onChange={(e) => setApprovalComment(e.target.value)}
                                                placeholder="Add review notes, clearance status or reason for rejection..."
                                                style={{ 
                                                    width: '100%', minHeight: '120px', padding: '16px 20px', borderRadius: '18px', 
                                                    border: '1.5px solid #e2e8f0', background: '#f8fafc', fontSize: '14px', 
                                                    fontWeight: 600, color: '#444', outline: 'none', resize: 'none'
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions - Sticky */}
                            <div style={{ padding: '24px 32px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', background: '#fff', alignItems: 'center', position: 'sticky', bottom: 0, zIndex: 10 }}>
                                <button 
                                    onClick={() => handleReject()}
                                    disabled={loading}
                                    style={{ padding: '14px 32px', borderRadius: '14px', border: '1.5px solid #ef4444', color: '#ef4444', fontWeight: 800, background: '#fff', fontSize: '14px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                >
                                    Reject Case
                                </button>
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <button 
                                        onClick={() => {
                                            if (selectedRequest.status === 'HR_APPROVED') {
                                                if (selectedRequest.exitFormSubmitted && !selectedRequest.assetHandoverAssigned) {
                                                    setAssetModalOpen(true);
                                                } else if (selectedRequest.assetHandoverCompleted && !selectedRequest.fnfTriggered) {
                                                    handleTriggerFnf();
                                                } else {
                                                    handleApprove();
                                                }
                                            } else {
                                                handleApprove();
                                            }
                                        }}
                                        disabled={loading || ['EXIT_COMPLETED', 'REJECTED', 'CANCELLED'].includes(selectedRequest.status)}
                                        style={{ 
                                            padding: '14px 48px', 
                                            borderRadius: '16px', 
                                            background: ['EXIT_COMPLETED', 'REJECTED', 'CANCELLED'].includes(selectedRequest.status) ? '#94a3b8' : 'linear-gradient(to right, #4f46e5, #4338ca)', 
                                            color: '#fff', 
                                            fontWeight: 900, 
                                            border: 'none', 
                                            fontSize: '15px', 
                                            cursor: (loading || ['EXIT_COMPLETED', 'REJECTED', 'CANCELLED'].includes(selectedRequest.status)) ? 'not-allowed' : 'pointer',
                                            boxShadow: ['EXIT_COMPLETED', 'REJECTED', 'CANCELLED'].includes(selectedRequest.status) ? 'none' : '0 8px 16px -4px rgba(79, 70, 229, 0.4)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.06em',
                                            opacity: loading ? 0.7 : 1
                                        }}
                                    >
                                        {loading ? <RefreshCw className="animate-spin" size={20} /> : (
                                            selectedRequest.status === 'PENDING' ? 'Send to Manager' :
                                            selectedRequest.status === 'MANAGER_APPROVED' ? 'Approve Resignation' :
                                            selectedRequest.status === 'HR_APPROVED' ? (
                                                !selectedRequest.exitFormSubmitted ? 'Initiate Interview' :
                                                !selectedRequest.assetHandoverAssigned ? 'Initiate Handover' :
                                                !selectedRequest.fnfTriggered ? 'Process F&F' : 'Review Progress'
                                            ) :
                                            selectedRequest.status === 'EXIT_INITIATED' ? 'Complete Exit' :
                                            selectedRequest.status === 'EXIT_COMPLETED' ? 'Exit Completed' :
                                            selectedRequest.status === 'REJECTED' ? 'Request Rejected' : 'Process Action'
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Terminate Modal */}
            <AnimatePresence>
                {terminateModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 50 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 50 }}
                            className="modal-content-premium w-full max-w-2xl shadow-[0_50px_100px_rgba(0,0,0,0.5)] overflow-hidden"
                        >
                            <div className="p-8 bg-red-600 text-white flex items-center justify-between">
                                <div className="flex items-center gap-5">
                                    <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md">
                                        <AlertTriangle size={32} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black tracking-tight uppercase">High Priority Termination</h3>
                                        <p className="text-xs text-red-100 font-bold opacity-80 mt-1">PERMANENT ACTION • ACCESS WILL BE REVOKED IMMEDIATELY</p>
                                    </div>
                                </div>
                                <button onClick={() => setTerminateModalOpen(false)} className="p-3 hover:bg-white/20 rounded-2xl transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleTerminate} className="p-10 space-y-8">
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="flex flex-col gap-2 col-span-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Select Employee</label>
                                        <select
                                            className="w-full p-4 border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-red-50 bg-gray-50 font-bold text-gray-700"
                                            required
                                            value={terminateForm.employeeId}
                                            onChange={e => setTerminateForm({ ...terminateForm, employeeId: e.target.value })}
                                        >
                                            <option value="">Search internal directory...</option>
                                            {employees.map(e => (
                                                <option key={e.id} value={e.id}>
                                                    {e.firstName} {e.lastName} ({e.employeeId})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Effective Date</label>
                                        <input
                                            type="date"
                                            className="w-full p-4 border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-red-50 font-bold text-gray-700"
                                            required
                                            value={terminateForm.terminationDate}
                                            onChange={e => setTerminateForm({ ...terminateForm, terminationDate: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Access Expiry</label>
                                        <input
                                            type="date"
                                            className="w-full p-4 border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-red-50 font-bold text-gray-700"
                                            required
                                            value={terminateForm.lastWorkingDay}
                                            onChange={e => setTerminateForm({ ...terminateForm, lastWorkingDay: e.target.value })}
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Exit Strategy</label>
                                        <select
                                            className="w-full p-4 border border-gray-200 rounded-2xl font-bold bg-white text-gray-700"
                                            value={terminateForm.terminationType}
                                            onChange={e => setTerminateForm({ ...terminateForm, terminationType: e.target.value })}
                                        >
                                            <option value="Involuntary">Involuntary (Internal Decision)</option>
                                            <option value="Voluntary">Voluntary (Mutual Request)</option>
                                        </select>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Settlement (₹)</label>
                                        <input
                                            type="number"
                                            className="w-full p-4 border border-gray-200 rounded-2xl font-bold text-gray-700"
                                            value={terminateForm.noticeBuybackAmount}
                                            placeholder="0.00"
                                            onChange={e => setTerminateForm({ ...terminateForm, noticeBuybackAmount: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Official Substantiation</label>
                                    <textarea
                                        className="w-full p-4 border border-gray-200 rounded-2xl outline-none min-h-[100px] font-medium text-gray-600"
                                        required
                                        placeholder="Detailed reason for termination for official records..."
                                        value={terminateForm.reason}
                                        onChange={e => setTerminateForm({ ...terminateForm, reason: e.target.value })}
                                    />
                                </div>
                                <div className="pt-6 border-t flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-[10px] font-black text-red-600 bg-red-50 px-4 py-2 rounded-xl uppercase tracking-wider">
                                        <ShieldAlert size={16} /> Irreversible Audit Entry
                                    </div>
                                    <div className="flex gap-4">
                                        <button type="button" onClick={() => setTerminateModalOpen(false)} className="px-6 font-bold text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
                                        <button type="submit" className="px-10 py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-100 hover:bg-red-700 transition-all transform hover:-translate-y-1 active:scale-95 uppercase text-sm tracking-widest">Execute Case</button>
                                    </div>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <ExitInterviewModal
                isOpen={showExitInterviewModal}
                onClose={() => setShowExitInterviewModal(false)}
                requestId={selectedRequest?.id}
                employeeName={selectedRequest?.employeeName}
                isViewOnly={true}
                submittedData={submittedFormData}
                onSubmit={() => {}} 
                loading={loading}
            />

            {/* Asset Handover Modal */}
            <AnimatePresence>
                {assetModalOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
                            <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
                                <h3 className="text-xl font-bold">Assign Asset Handover</h3>
                                <button onClick={() => setAssetModalOpen(false)} className="text-white/80 hover:text-white"><X size={24} /></button>
                            </div>
                            <form onSubmit={handleAssignAssetHandover} className="p-8 space-y-6">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Handover Person</label>
                                    <select 
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700"
                                        required
                                        value={assetForm.handoverPersonId}
                                        onChange={e => setAssetForm({ ...assetForm, handoverPersonId: e.target.value })}
                                    >
                                        <option value="">Select Employee...</option>
                                        {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeId})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Handover Date</label>
                                    <input 
                                        type="date" 
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700"
                                        required
                                        value={assetForm.handoverDate}
                                        onChange={e => setAssetForm({ ...assetForm, handoverDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Asset Notes</label>
                                    <textarea 
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-medium text-slate-600 min-h-[100px]"
                                        placeholder="Specific instructions or missing items..."
                                        value={assetForm.notes}
                                        onChange={e => setAssetForm({ ...assetForm, notes: e.target.value })}
                                    />
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button type="button" onClick={() => setAssetModalOpen(false)} className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600">Cancel</button>
                                    <button type="submit" disabled={loading} className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
                                        {loading ? 'Processing...' : 'Assign Handover'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    </>
    );
}

// --- Sub-components (Reused from EmployeeExitManagement) ---
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

