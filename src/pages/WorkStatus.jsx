import { useState, useEffect, useRef } from 'react';
import {
    Briefcase,
    Search,
    Clock,
    Home,
    Building2,
    CalendarOff,
    Filter,
    Check,
    Plus,
    X,
    Info,
    Mic,
    Calendar,
    Paperclip,

    Type,

    Edit2,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { workStatusAPI } from '../services/api';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const quillModules = {
    toolbar: [
        ['bold', 'italic', 'underline'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        [{ 'align': [] }],
        ['link']
    ],
};

const quillFormats = [
    'bold', 'italic', 'underline', 'list', 'bullet', 'align', 'link'
];

export default function WorkStatus() {
    const { user } = useAuth();
    const [statuses, setStatuses] = useState([]);
    const [filteredStatuses, setFilteredStatuses] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showInputRow, setShowInputRow] = useState(false);
    const [submitting, setSubmitting] = useState(false);


    const [editingStatusId, setEditingStatusId] = useState(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(5);

    // Advanced Filter State
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [activeFilters, setActiveFilters] = useState({
        month: '',
        statusTypes: [],
        search: ''
    });
    // Temporary state for inside the modal
    const [tempFilters, setTempFilters] = useState({
        month: '',
        statusTypes: [],
        search: ''
    });

    // Stats
    const [stats, setStats] = useState({
        total: 0,
        wfo: 0,
        wfh: 0,
        leave: 0
    });

    // Form State
    const [newStatus, setNewStatus] = useState({
        statusType: 'WORKING',
        workDate: new Date().toISOString().split('T')[0],
        statusText: '',
        challenges: '',
        taskForTomorrow: ''
    });

    // Voice Input State
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);

    const initialContentRef = useRef('');
    const formRef = useRef(null);

    // Scroll to form when it opens
    useEffect(() => {
        if (showInputRow && formRef.current) {
            formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [showInputRow, editingStatusId]);


    const toggleListening = () => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    const stopListening = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    };

    const startListening = () => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            // Save current content to append to
            initialContentRef.current = newStatus.statusText;

            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onstart = () => {
                setIsListening(true);
            };

            recognition.onresult = (event) => {
                let sessionTranscript = '';

                // Concatenate all results from this session
                for (let i = 0; i < event.results.length; i++) {
                    sessionTranscript += event.results[i][0].transcript;
                }

                const transcript = sessionTranscript;

                // Update state based on initial content + current full transcript
                setNewStatus(prev => {
                    let baseText = initialContentRef.current;
                    let newText = '';

                    // Handle empty or default Quill state
                    if (!baseText || baseText === '<p><br></p>') {
                        newText = `<p>${transcript}</p>`;
                    } else if (baseText.endsWith('</p>')) {
                        // Append to the last paragraph
                        newText = baseText.slice(0, -4) + ' ' + transcript + '</p>';
                    } else {
                        // Just append
                        newText = baseText + ' ' + transcript;
                    }

                    return {
                        ...prev,
                        statusText: newText
                    };
                });
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error', event.error);
                if (event.error === 'not-allowed') {
                    alert('Microphone access denied.');
                    setIsListening(false);
                }
                // Don't stop on 'no-speech' to allow pauses
            };

            recognition.onend = () => {
                // Determine if we should really stop or if it was just a pause/network glitch
                // Ideally, we rely on manual stop. 
                // However, the API might stop itself. We update state to reflect reality.
                // Check if recognitionRef is still active? 
                // Simplifying: if it ends, we just update UI.
                setIsListening(false);
            };

            recognitionRef.current = recognition;
            recognition.start();
        } else {
            alert('Browser does not support voice recognition.');
        }
    };

    useEffect(() => {
        fetchStatuses();
    }, []);

    useEffect(() => {
        let result = statuses;

        // 1. Filter by Search (Global or Modal)
        const searchTerm = (activeFilters.search || '').toLowerCase();
        if (searchTerm) {
            result = result.filter(status =>
                (status.statusText && status.statusText.toLowerCase().includes(searchTerm)) ||
                (status.challenges && status.challenges.toLowerCase().includes(searchTerm)) ||
                (status.taskForTomorrow && status.taskForTomorrow.toLowerCase().includes(searchTerm))
            );
        }

        // 2. Filter by Month
        if (activeFilters.month) {
            result = result.filter(status => {
                const d = new Date(status.workDate || status.date);
                const statusMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return statusMonth === activeFilters.month;
            });
        }

        // 3. Filter by Status Type
        if (activeFilters.statusTypes.length > 0) {
            result = result.filter(status => activeFilters.statusTypes.includes(status.statusType));
        }

        setFilteredStatuses(result);
        setCurrentPage(1);
    }, [statuses, activeFilters]);

    const handleOpenFilter = () => {
        setTempFilters(activeFilters);
        setShowFilterModal(true);
    };

    const handleApplyFilters = () => {
        setActiveFilters(tempFilters);
        setShowFilterModal(false);
    };

    const toggleStatusTypeFilter = (type) => {
        setTempFilters(prev => {
            const types = prev.statusTypes.includes(type)
                ? prev.statusTypes.filter(t => t !== type)
                : [...prev.statusTypes, type];
            return { ...prev, statusTypes: types };
        });
    };

    const fetchStatuses = async () => {
        try {
            setLoading(true);
            const response = await workStatusAPI.getMyWorkStatuses();
            let data = [];
            if (response.data) {
                data = Array.isArray(response.data) ? response.data :
                    (response.data.data && Array.isArray(response.data.data)) ? response.data.data : [];
            }

            // Sort by date desc
            data.sort((a, b) => new Date(b.workDate || b.date) - new Date(a.workDate || a.date));

            setStatuses(data);
            calculateStats(data);
        } catch (error) {
            console.error('Error fetching work statuses:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (data) => {
        const counts = {
            total: data.length,
            wfo: data.filter(s => ['WFO', 'WORKING'].includes(s.statusType)).length,
            wfh: data.filter(s => s.statusType === 'WFH').length,
            leave: data.filter(s => ['Leave', 'LEAVE'].includes(s.statusType)).length
        };
        setStats(counts);
    };

    // Pagination Logic
    const indexOfLastItem = currentPage * rowsPerPage;
    const indexOfFirstItem = indexOfLastItem - rowsPerPage;
    const currentItems = filteredStatuses.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredStatuses.length / rowsPerPage);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);



    // ... existing useState for newStatus ...

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!newStatus.statusText || newStatus.statusText === '<p><br></p>') {
            // Validation handled in UI, but good to have here too
            return;
        }

        // Check for duplicate date (only if NOT editing the same day's status)
        // Note: For edit, we allow keeping the same date.
        const existingStatus = statuses.find(s =>
            (s.workDate || s.date).split('T')[0] === newStatus.workDate &&
            s.id !== editingStatusId
        );

        if (existingStatus) {
            alert('A work status for this date already exists. Please edit the existing status instead.');
            return;
        }

        setSubmitting(true);
        try {
            if (editingStatusId) {
                // Update existing status
                await workStatusAPI.updateMyWorkStatus(
                    editingStatusId,
                    newStatus.statusText,
                    newStatus.challenges,
                    newStatus.taskForTomorrow,
                    newStatus.statusType
                );
            } else {
                // Create new status
                await workStatusAPI.submitWorkStatus(
                    newStatus.statusText,
                    newStatus.challenges,
                    newStatus.taskForTomorrow,
                    newStatus.statusType,
                    newStatus.workDate
                );
            }

            resetForm();
            fetchStatuses();
        } catch (error) {
            console.error('Error submitting status:', error);
            alert('Failed to submit status. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (status) => {
        setNewStatus({
            statusType: status.statusType || 'WORKING',
            workDate: (status.workDate || status.date).split('T')[0],
            statusText: status.statusText || '',
            challenges: status.challenges || '',
            taskForTomorrow: status.taskForTomorrow || ''
        });
        setEditingStatusId(status.id);
        setShowInputRow(true);

        setEditingStatusId(status.id);
        setShowInputRow(true);
    };

    const resetForm = () => {
        setShowInputRow(false);
        setEditingStatusId(null);
        setNewStatus({
            statusType: 'WORKING',
            workDate: new Date().toISOString().split('T')[0],
            statusText: '',
            challenges: '',
            taskForTomorrow: ''
        });
    };

    const getStatusColor = (type) => {
        switch (type) {
            case 'WFO':
            case 'WORKING': return 'var(--success)';
            case 'WFH': return 'var(--primary-500)';
            case 'Half Day':
            case 'HALF_DAY': return 'var(--warning)';
            case 'Leave':
            case 'LEAVE': return 'var(--error)';
            default: return 'var(--gray-500)';
        }
    };

    const getStatusBg = (type) => {
        switch (type) {
            case 'WFO':
            case 'WORKING': return 'var(--success-bg)';
            case 'WFH': return 'var(--primary-10)';
            case 'Half Day':
            case 'HALF_DAY': return 'var(--warning-bg)';
            case 'Leave':
            case 'LEAVE': return 'var(--error-bg)';
            default: return 'var(--gray-5)';
        }
    };

    const getStatusIcon = (type) => {
        switch (type) {
            case 'WFO':
            case 'WORKING': return <Building2 size={14} />;
            case 'WFH': return <Home size={14} />;
            case 'Leave':
            case 'LEAVE': return <CalendarOff size={14} />;
            default: return <Clock size={14} />;
        }
    };

    return (
        <div className="main-content">
            <Header title="Work Status" subtitle="Track your daily progress" />

            <div className="page-content">

                {/* Submit Status Form Section */}
                {showInputRow && (
                    <div ref={formRef} className="card" style={{ marginBottom: '16px', transform: 'none', transition: 'none', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' }}>
                        <div className="card-header">
                            <div>
                                <h3 className="card-title">{editingStatusId ? 'Update Work Status' : 'Submit Work Status'}</h3>
                                <p style={{ fontSize: '11px', color: 'var(--gray-500)', margin: '4px 0 0 0' }}>Fill in your daily work status and submit</p>
                            </div>
                        </div>

                        <div className="card-body">




                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '16px', marginBottom: '16px' }}>
                                {/* Date Selection */}
                                <div className="form-group">
                                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--gray-500)', marginBottom: '6px' }}>Select Date (Today or Past Date)</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="date"
                                            value={newStatus.workDate}
                                            onChange={(e) => setNewStatus({ ...newStatus, workDate: e.target.value })}
                                            className="filter-select"
                                            style={{
                                                width: '100%',
                                                paddingRight: '36px',
                                                height: '38px'
                                            }}
                                        />
                                        <Calendar size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
                                    </div>
                                    <p style={{ fontSize: '11px', color: 'var(--gray-500)', marginTop: '4px', margin: 0 }}>You can submit status for today or any past date you missed</p>
                                </div>

                                {/* Status Type */}
                                <div className="form-group">
                                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--gray-500)', marginBottom: '6px' }}>Status Type</label>
                                    <select
                                        value={newStatus.statusType}
                                        onChange={(e) => setNewStatus({ ...newStatus, statusType: e.target.value })}
                                        className="filter-select"
                                        style={{
                                            width: '100%',
                                            height: '38px'
                                        }}
                                    >
                                        <option value="WORKING">Working</option>
                                        <option value="WFH">WFH</option>
                                        <option value="HALF_DAY">Half Day</option>
                                        <option value="LEAVE">On Leave</option>
                                    </select>
                                </div>
                            </div>

                            {/* Description RTE */}
                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <label style={{ fontSize: '13px', color: 'var(--gray-500)' }}>Work Status Description <span style={{ color: 'var(--error)' }}>*</span></label>
                                    <button
                                        onClick={toggleListening}
                                        style={{
                                            background: isListening ? 'var(--error)' : 'var(--primary-500)',
                                            border: 'none',
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white',
                                            cursor: 'pointer',
                                            animation: isListening ? 'pulse 1.5s infinite' : 'none'
                                        }} title="Voice Input">
                                        <Mic size={14} />
                                    </button>
                                </div>
                                <div className="quill-wrapper">
                                    <ReactQuill
                                        theme="snow"
                                        value={newStatus.statusText}
                                        onChange={(value) => setNewStatus({ ...newStatus, statusText: value })}
                                        modules={quillModules}
                                        formats={quillFormats}
                                        placeholder="Describe your work activities, progress, or any updates for the selected date..."
                                        style={{ background: 'white', borderRadius: '6px', border: '1px solid var(--gray-20)', overflow: 'hidden' }}
                                    />
                                </div>
                                {(!newStatus.statusText || newStatus.statusText === '<p><br></p>') && submitting && <p style={{ fontSize: '11px', color: 'var(--error)', marginTop: '4px', margin: 0 }}>Work status description is required</p>}
                            </div>

                            {/* Challenges */}
                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '13px', color: 'var(--gray-500)', marginBottom: '6px' }}>Challenges (Optional)</label>
                                <textarea
                                    placeholder="Any blockers or issues faced?"
                                    value={newStatus.challenges}
                                    onChange={(e) => setNewStatus({ ...newStatus, challenges: e.target.value })}
                                    className="filter-select"
                                    style={{
                                        width: '100%',
                                        minHeight: '80px',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>

                            {/* Task For Tomorrow */}
                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '13px', color: 'var(--gray-500)', marginBottom: '6px' }}>Plan for Tomorrow (Optional)</label>
                                <textarea
                                    placeholder="What do you plan to work on tomorrow?"
                                    value={newStatus.taskForTomorrow}
                                    onChange={(e) => setNewStatus({ ...newStatus, taskForTomorrow: e.target.value })}
                                    className="filter-select"
                                    style={{
                                        width: '100%',
                                        minHeight: '80px',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={resetForm}
                                    className="filter-btn"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="add-employee-btn"
                                    style={{
                                        opacity: submitting ? 0.7 : 1
                                    }}
                                >
                                    {submitting ? 'Submitting...' : (editingStatusId ? 'Update Status' : 'Submit Status')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Merged Card: Toolbar + Table */}
                <div className="card no-hover" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {/* Toolbar Header */}
                    <div style={{
                        padding: '20px 24px',
                        borderBottom: '1px solid var(--gray-10)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <h3 className="card-title" style={{ fontSize: '16px', margin: 0 }}>My Work Status</h3>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={handleOpenFilter}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '8px 12px',
                                    border: '1px solid var(--gray-20)',
                                    borderRadius: '6px',
                                    background: 'white',
                                    color: 'var(--gray-600)',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    cursor: 'pointer'
                                }}
                            >
                                <Filter size={14} />
                                Filter
                                {(activeFilters.month || activeFilters.statusTypes.length > 0) && (
                                    <span style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        width: '6px', height: '6px', borderRadius: '50%',
                                        background: 'var(--primary-500)'
                                    }} />
                                )}
                            </button>
                            {!showInputRow && (
                                <button
                                    onClick={() => setShowInputRow(true)}
                                    className="add-employee-btn"
                                >
                                    <Plus size={18} />
                                    Submit Status
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Status List Table */}
                    <div className="employee-table-container">
                        <table className="employee-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '12%', paddingLeft: '24px' }}>Date</th>
                                    <th style={{ width: '10%' }}>Type</th>
                                    <th style={{ width: '30%' }}>Work Done</th>
                                    <th style={{ width: '20%' }}>Challenges</th>
                                    <th style={{ width: '20%' }}>Plan for Tomorrow</th>
                                    <th style={{ width: '8%', textAlign: 'center' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--gray-500)' }}>
                                            <div className="loading-indicator">
                                                <div className="spinner"></div>
                                                Loading...
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredStatuses.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ padding: '60px', textAlign: 'center', color: 'var(--gray-500)' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                                <Briefcase size={32} color="var(--gray-300)" />
                                                <p>No status updates found matching your criteria.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    currentItems.map((status, index) => (
                                        <tr key={index}>
                                            <td style={{ fontWeight: 500, paddingLeft: '24px' }}>
                                                {new Date(status.workDate || status.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </td>
                                            <td>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '4px 10px',
                                                    borderRadius: '999px',
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    backgroundColor: getStatusBg(status.statusType),
                                                    color: getStatusColor(status.statusType),
                                                }}>
                                                    {getStatusIcon(status.statusType)}
                                                    {status.statusType}
                                                </span>
                                            </td>
                                            <td style={{ color: 'var(--dark-500)', lineHeight: '1.5' }}>
                                                <div
                                                    className="rich-text-content"
                                                    style={{
                                                        wordBreak: 'break-word',
                                                        overflowWrap: 'anywhere',
                                                        maxWidth: '300px'
                                                    }}
                                                    dangerouslySetInnerHTML={{ __html: status.statusText || '' }}
                                                />
                                            </td>
                                            <td style={{ color: 'var(--gray-500)' }}>
                                                <div
                                                    style={{
                                                        wordBreak: 'break-word',
                                                        maxWidth: '200px'
                                                    }}
                                                    dangerouslySetInnerHTML={{ __html: status.challenges || '-' }}
                                                />
                                            </td>
                                            <td style={{ color: 'var(--gray-500)' }}>
                                                <div
                                                    style={{
                                                        wordBreak: 'break-word',
                                                        maxWidth: '200px'
                                                    }}
                                                    dangerouslySetInnerHTML={{ __html: status.taskForTomorrow || '-' }}
                                                />
                                            </td>
                                            <td style={{ textAlign: 'center', color: 'var(--gray-400)' }}>
                                                {(() => {
                                                    const statusDate = new Date(status.workDate || status.date);
                                                    const today = new Date();
                                                    const diffTime = Math.abs(today - statusDate);
                                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                                    // Allow edit within 7 days
                                                    if (diffDays <= 7) {
                                                        return (
                                                            <button
                                                                onClick={() => handleEdit(status)}
                                                                style={{
                                                                    background: 'none',
                                                                    border: 'none',
                                                                    cursor: 'pointer',
                                                                    color: 'var(--primary-600)',
                                                                    padding: '4px'
                                                                }}
                                                                title="Edit Status"
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                        );
                                                    }
                                                    return '-';
                                                })()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div >

                    {/* Pagination Footer */}
                    {
                        !loading && filteredStatuses.length > 0 && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                padding: '16px',
                                borderTop: '1px solid var(--gray-10)',
                                color: 'var(--gray-500)',
                                fontSize: '13px',
                                background: 'white',
                                borderBottomLeftRadius: '12px',
                                borderBottomRightRadius: '12px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span>Rows per page:</span>
                                        <select
                                            value={rowsPerPage}
                                            onChange={(e) => {
                                                setRowsPerPage(Number(e.target.value));
                                                setCurrentPage(1);
                                            }}
                                            style={{
                                                border: '1px solid var(--gray-20)',
                                                borderRadius: '4px',
                                                padding: '4px 8px',
                                                fontSize: '13px',
                                                color: 'var(--dark-500)',
                                                outline: 'none',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value={5}>5</option>
                                            <option value={10}>10</option>
                                            <option value={25}>25</option>
                                            <option value={50}>50</option>
                                        </select>
                                    </div>

                                    <span>
                                        {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredStatuses.length)} of {filteredStatuses.length}
                                    </span>

                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button
                                            onClick={() => paginate(currentPage - 1)}
                                            disabled={currentPage === 1}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '28px',
                                                height: '28px',
                                                border: '1px solid var(--gray-20)',
                                                borderRadius: '4px',
                                                background: currentPage === 1 ? 'var(--gray-5)' : 'white',
                                                color: currentPage === 1 ? 'var(--gray-300)' : 'var(--gray-600)',
                                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                        <button
                                            onClick={() => paginate(currentPage + 1)}
                                            disabled={currentPage === totalPages}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '28px',
                                                height: '28px',
                                                border: '1px solid var(--gray-20)',
                                                borderRadius: '4px',
                                                background: currentPage === totalPages ? 'var(--gray-5)' : 'white',
                                                color: currentPage === totalPages ? 'var(--gray-300)' : 'var(--gray-600)',
                                                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    }
                </div>
            </div>
            {/* Filter Modal */}
            {
                showFilterModal && (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        background: 'rgba(0,0,0,0.4)',
                        backdropFilter: 'blur(2px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div style={{
                            background: 'white',
                            borderRadius: '16px',
                            width: '400px',
                            maxWidth: '90%',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                            overflow: 'hidden',
                            animation: 'scaleIn 0.2s ease-out'
                        }}>
                            {/* Header */}
                            <div style={{
                                padding: '20px 24px',
                                borderBottom: '1px solid var(--gray-10)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--dark-500)' }}>Filter</h3>
                                <button onClick={() => setShowFilterModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}>
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Body */}
                            <div style={{ padding: '24px' }}>
                                {/* Search */}
                                <div style={{ marginBottom: '24px' }}>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                        border: '1px solid var(--gray-20)', borderRadius: '8px',
                                        padding: '10px 14px'
                                    }}>
                                        <Search size={16} color="var(--gray-400)" />
                                        <input
                                            type="text"
                                            placeholder="Search Work Status"
                                            value={tempFilters.search}
                                            onChange={(e) => setTempFilters({ ...tempFilters, search: e.target.value })}
                                            style={{ border: 'none', outline: 'none', fontSize: '14px', width: '100%', color: 'var(--dark-500)' }}
                                        />
                                    </div>
                                </div>

                                {/* Month Filter */}
                                <div style={{ marginBottom: '24px' }}>
                                    <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--dark-500)' }}>Select Month</h4>
                                    <input
                                        type="month"
                                        value={tempFilters.month}
                                        onChange={(e) => setTempFilters({ ...tempFilters, month: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            border: '1px solid var(--gray-20)',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            color: 'var(--dark-500)',
                                            fontFamily: 'inherit'
                                        }}
                                    />
                                </div>

                                {/* Status Type Filter */}
                                <div>
                                    <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--dark-500)' }}>Status Type</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        {['WFO', 'WFH', 'Leave', 'Half Day'].map(type => (
                                            <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--gray-600)' }}>
                                                <div
                                                    onClick={() => toggleStatusTypeFilter(type)}
                                                    style={{
                                                        width: '18px', height: '18px',
                                                        borderRadius: '4px',
                                                        border: tempFilters.statusTypes.includes(type) ? 'none' : '1px solid var(--gray-300)',
                                                        background: tempFilters.statusTypes.includes(type) ? 'var(--primary-600)' : 'white',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    {tempFilters.statusTypes.includes(type) && <Check size={12} color="white" />}
                                                </div>
                                                {type}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div style={{
                                padding: '16px 24px',
                                borderTop: '1px solid var(--gray-10)',
                                display: 'flex', justifyContent: 'space-between', gap: '12px'
                            }}>
                                <button
                                    onClick={() => setShowFilterModal(false)}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        border: '1px solid var(--gray-20)',
                                        borderRadius: '8px',
                                        background: 'white',
                                        color: 'var(--dark-500)',
                                        fontWeight: 500,
                                        fontSize: '14px'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleApplyFilters}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        border: 'none',
                                        borderRadius: '8px',
                                        background: 'var(--primary-600)',
                                        color: 'white',
                                        fontWeight: 500,
                                        fontSize: '14px',
                                        boxShadow: '0 4px 6px rgba(124, 91, 191, 0.2)'
                                    }}
                                >
                                    Apply
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

function StatCard({ label, value, icon, bg }) {
    return (
        <div className="stat-card">
            <div className="stat-card-header">
                <div style={{
                    width: '32px', height: '32px', borderRadius: '6px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: bg
                }}>
                    {icon}
                </div>
                <span className="stat-card-title">{label}</span>
            </div>
            <div className="stat-card-value" style={{ fontSize: '20px' }}>
                {value}
            </div>
        </div>
    );
}
