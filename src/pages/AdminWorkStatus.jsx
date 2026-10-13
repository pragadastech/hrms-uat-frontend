import { useState, useEffect } from 'react';
import {
    Calendar,
    Briefcase,
    Search,
    Clock,
    Home,
    Building2,
    CalendarOff,
    Filter,
    User,
    CheckCircle2,
    XCircle,
    Eye,
    X,
    Download,
    FileText,
    BarChart3
} from 'lucide-react';
import Header from '../components/Header';
import { workStatusAPI, adminAPI } from '../services/api';

export default function AdminWorkStatus() {
    const [activeTab, setActiveTab] = useState('daily'); // 'daily' or 'reports'
    const [loading, setLoading] = useState(false);

    // Daily View State
    const [dailyDate, setDailyDate] = useState(new Date().toISOString().split('T')[0]);
    const [dailyStatuses, setDailyStatuses] = useState([]);
    const [dailyStats, setDailyStats] = useState({ totalContext: 0, submitted: 0, pending: 0, wfo: 0, wfh: 0 });
    const [viewModal, setViewModal] = useState(null);
    const [dailySearch, setDailySearch] = useState('');

    // Reports View State
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportStatuses, setReportStatuses] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState('All');
    const [reportSearch, setReportSearch] = useState('');

    useEffect(() => {
        fetchEmployees();
    }, []);

    useEffect(() => {
        if (activeTab === 'daily') {
            fetchDailyData();
        } else {
            fetchReportData();
        }
    }, [activeTab, dailyDate, startDate, endDate, selectedEmployee]);

    const fetchEmployees = async () => {
        try {
            const res = await adminAPI.getActiveEmployees();
            if (res.data) {
                const emps = Array.isArray(res.data) ? res.data : (res.data.employees || []);
                setEmployees(emps);
            }
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    const fetchDailyData = async () => {
        setLoading(true);
        try {
            const statusRes = await workStatusAPI.getAllWorkStatusesByDate(dailyDate);
            let statusData = [];
            if (statusRes.data) {
                statusData = Array.isArray(statusRes.data) ? statusRes.data :
                    (statusRes.data.data && Array.isArray(statusRes.data.data)) ? statusRes.data.data : [];
            }
            setDailyStatuses(statusData);

            // Stats calculation
            const submittedCount = statusData.length;
            const totalEmployees = employees.length || submittedCount; // Fallback if emps not loaded yet

            setDailyStats({
                totalContext: totalEmployees,
                submitted: submittedCount,
                pending: Math.max(0, totalEmployees - submittedCount),
                wfo: statusData.filter(s => ['WFO', 'WORKING'].includes(s.statusType)).length,
                wfh: statusData.filter(s => s.statusType === 'WFH').length
            });
        } catch (error) {
            console.error('Error fetching daily data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchReportData = async () => {
        setLoading(true);
        try {
            let res;
            if (selectedEmployee !== 'All') {
                res = await workStatusAPI.getEmployeeWorkStatusesByDateRange(selectedEmployee, startDate, endDate);
            } else {
                res = await workStatusAPI.getAllWorkStatusesByDateRange(startDate, endDate);
            }

            let data = [];
            if (res.data) {
                data = Array.isArray(res.data) ? res.data :
                    (res.data.data && Array.isArray(res.data.data)) ? res.data.data : [];
            }
            // Sort by date desc
            data.sort((a, b) => new Date(b.workDate || b.date) - new Date(a.workDate || a.date));
            setReportStatuses(data);
        } catch (error) {
            console.error('Error fetching report data:', error);
        } finally {
            setLoading(false);
        }
    };

    const exportReport = () => {
        const headers = ['Date', 'Employee', 'ID', 'Type', 'Work Done', 'Challenges', 'Plan for Tomorrow'];
        const csvContent = [
            headers.join(','),
            ...reportStatuses.map(s => {
                const name = s.employeeName || (s.employee ? `${s.employee.firstName} ${s.employee.lastName}` : 'Unknown');
                const empId = s.employeeIdString || (s.employee ? s.employee.employeeId : '-');
                const date = new Date(s.workDate || s.date).toLocaleDateString();

                // Strip HTML tags for CSV
                const cleanText = (text) => (text || '').replace(/<[^>]*>?/gm, ' ').replace(/"/g, '""');

                return [
                    date,
                    `"${name}"`,
                    `"${empId}"`,
                    s.statusType,
                    `"${cleanText(s.statusText)}"`,
                    `"${cleanText(s.challenges)}"`,
                    `"${cleanText(s.taskForTomorrow)}"`
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Work_Status_Report_${startDate}_to_${endDate}.csv`;
        link.click();
    };

    const filteredDailyStatuses = dailyStatuses.filter(s => {
        if (!dailySearch) return true;
        const name = s.employeeName || (s.employee ? `${s.employee.firstName} ${s.employee.lastName}` : '');
        const empId = s.employeeIdString || '';
        const searchLower = dailySearch.toLowerCase();

        return name.toLowerCase().includes(searchLower) ||
            empId.toLowerCase().includes(searchLower) ||
            (s.statusText && s.statusText.toLowerCase().includes(searchLower));
    });

    const filteredReportStatuses = reportStatuses.filter(s => {
        if (!reportSearch) return true;
        const name = s.employeeName || (s.employee ? `${s.employee.firstName} ${s.employee.lastName}` : '');
        const empId = s.employeeIdString || '';
        const searchLower = reportSearch.toLowerCase();

        return name.toLowerCase().includes(searchLower) ||
            empId.toLowerCase().includes(searchLower) ||
            (s.statusText && s.statusText.toLowerCase().includes(searchLower));
    });

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
    }

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
            <Header title="Work Status Overview" subtitle="Monitor employee daily updates" />

            <div className="page-content">
                {/* Unified Card Container */}
                <div className="card no-hover" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

                    {/* 1. Unified Toolbar (Header of the Card) */}
                    <div className="search-filter-row" style={{
                        marginBottom: '0',
                        padding: '20px 24px',
                        borderBottom: '1px solid var(--gray-10)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        flexWrap: 'nowrap'
                    }}>
                        {/* LEFT: View Switcher */}
                        <div className="segmented-control" style={{ margin: 0 }}>
                            <div
                                className={`segmented-item ${activeTab === 'daily' ? 'active' : ''}`}
                                onClick={() => setActiveTab('daily')}
                            >
                                <BarChart3 size={16} />
                                Daily Status
                            </div>
                            <div
                                className={`segmented-item ${activeTab === 'reports' ? 'active' : ''}`}
                                onClick={() => setActiveTab('reports')}
                            >
                                <FileText size={16} />
                                Reports
                            </div>
                        </div>

                        {/* RIGHT: Filters (Date/Export) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {activeTab === 'daily' ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>Date:</span>
                                    <input
                                        type="date"
                                        value={dailyDate}
                                        onChange={(e) => setDailyDate(e.target.value)}
                                        className="filter-select"
                                        style={{ width: 'auto' }}
                                    />
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="date"
                                            title="Start Date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="filter-select"
                                            style={{ width: '130px' }}
                                        />
                                        <span style={{ color: 'var(--gray-400)' }}>-</span>
                                        <input
                                            type="date"
                                            title="End Date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="filter-select"
                                            style={{ width: '130px' }}
                                        />
                                    </div>
                                    <div style={{ width: '200px' }}>
                                        <select
                                            value={selectedEmployee}
                                            onChange={(e) => setSelectedEmployee(e.target.value)}
                                            className="filter-select"
                                            style={{ width: '100%' }}
                                        >
                                            <option value="All">All Employees</option>
                                            {employees.map(emp => (
                                                <option key={emp._id} value={emp._id}>
                                                    {emp.firstName} {emp.lastName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        onClick={exportReport}
                                        className="add-employee-btn"
                                        style={{ height: '36px', whiteSpace: 'nowrap' }}
                                    >
                                        <Download size={14} />
                                        Export CSV
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* 2. Daily Stats (Inside Card, below Toolbar) */}
                    {activeTab === 'daily' && (
                        <div className="stats-grid" style={{
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            padding: '24px',
                            gap: '16px',
                            borderBottom: '1px solid var(--gray-10)',
                            margin: 0
                        }}>
                            <StatCard
                                label="Status Submitted"
                                value={`${dailyStats.submitted} / ${dailyStats.totalContext}`}
                                icon={<CheckCircle2 size={18} color="var(--success)" />}
                                bg="var(--success-bg)"
                            />
                            <StatCard
                                label="Work From Office"
                                value={dailyStats.wfo}
                                icon={<Building2 size={18} color="var(--color-4)" />}
                                bg="rgba(59, 94, 219, 0.1)"
                            />
                            <StatCard
                                label="Work From Home"
                                value={dailyStats.wfh}
                                icon={<Home size={18} color="var(--primary-500)" />}
                                bg="var(--primary-10)"
                            />
                            <StatCard
                                label="Submission Rate"
                                value={`${dailyStats.totalContext > 0 ? Math.round((dailyStats.submitted / dailyStats.totalContext) * 100) : 0}%`}
                                icon={<Briefcase size={18} color="var(--warning)" />}
                                bg="var(--warning-bg)"
                            />
                        </div>
                    )}

                    {/* 3. Daily Content (Search + Table) */}
                    {activeTab === 'daily' && (
                        <>
                            <div className="search-filter-row" style={{ padding: '16px 24px', marginBottom: 0 }}>
                                <div className="page-search" style={{ maxWidth: '300px' }}>
                                    <Search size={14} style={{ color: 'var(--gray-500)' }} />
                                    <input
                                        type="text"
                                        placeholder="Search employee or ID..."
                                        value={dailySearch}
                                        onChange={(e) => setDailySearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="employee-table-container">
                                <table className="employee-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '25%', paddingLeft: '24px' }}>Employee</th>
                                            <th style={{ width: '15%' }}>Time</th>
                                            <th style={{ width: '15%' }}>Type</th>
                                            <th style={{ width: '35%' }}>Work Done Highlight</th>
                                            <th style={{ width: '10%' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--gray-500)' }}>Loading...</td></tr>
                                        ) : filteredDailyStatuses.length === 0 ? (
                                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}>No statuses found for this date.</td></tr>
                                        ) : (
                                            filteredDailyStatuses.map((status, index) => {
                                                const name = status.employeeName || (status.employee ? `${status.employee.firstName} ${status.employee.lastName}` : 'Unknown');
                                                const role = status.employeeIdString || (status.employee ? status.employee.designation : '-');
                                                const initial = name.charAt(0) || 'U';

                                                return (
                                                    <tr key={index}>
                                                        <td style={{ paddingLeft: '24px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary-10)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '12px' }}>
                                                                    {initial}
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--dark-500)' }}>
                                                                        {name}
                                                                    </div>
                                                                    <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                                                                        {role}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td style={{ color: 'var(--gray-500)', fontSize: '13px' }}>
                                                            {new Date(status.createdAt || status.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </td>
                                                        <td>
                                                            <span style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px',
                                                                borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                                                                backgroundColor: getStatusBg(status.statusType),
                                                                color: getStatusColor(status.statusType)
                                                            }}>
                                                                {getStatusIcon(status.statusType)}
                                                                {status.statusType}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div
                                                                style={{
                                                                    color: 'var(--dark-500)',
                                                                    fontSize: '13px',
                                                                    wordBreak: 'break-word',
                                                                    whiteSpace: 'pre-wrap',
                                                                    maxWidth: '300px'
                                                                }}
                                                                dangerouslySetInnerHTML={{ __html: status.statusText || '' }}
                                                            />
                                                        </td>
                                                        <td>
                                                            <button
                                                                onClick={() => setViewModal(status)}
                                                                className="filter-btn"
                                                                style={{ padding: '6px', border: 'none', background: 'transparent' }}
                                                            >
                                                                <Eye size={16} color="var(--gray-500)" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {/* 4. Reports Content (Search + Table) */}
                    {activeTab === 'reports' && (
                        <>
                            <div className="search-filter-row" style={{ padding: '16px 24px', marginBottom: 0 }}>
                                <div className="page-search" style={{ maxWidth: '300px' }}>
                                    <Search size={14} style={{ color: 'var(--gray-500)' }} />
                                    <input
                                        type="text"
                                        placeholder="Search in reports..."
                                        value={reportSearch}
                                        onChange={(e) => setReportSearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="employee-table-container">
                                <table className="employee-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '15%', paddingLeft: '24px' }}>Date</th>
                                            <th style={{ width: '20%' }}>Employee</th>
                                            <th style={{ width: '15%' }}>Type</th>
                                            <th style={{ width: '20%' }}>Work Done</th>
                                            <th style={{ width: '15%' }}>Challenges</th>
                                            <th style={{ width: '15%' }}>Tomorrow</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'var(--gray-500)' }}>Loading...</td></tr>
                                        ) : filteredReportStatuses.length === 0 ? (
                                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}>No data found for this range.</td></tr>
                                        ) : (
                                            filteredReportStatuses.map((status, index) => {
                                                const name = status.employeeName || (status.employee ? `${status.employee.firstName} ${status.employee.lastName}` : 'Unknown');

                                                return (
                                                    <tr key={index}>
                                                        <td style={{ fontSize: '13px', color: 'var(--dark-500)', paddingLeft: '24px', verticalAlign: 'top', paddingTop: '12px' }}>
                                                            {new Date(status.workDate || status.date).toLocaleDateString()}
                                                        </td>
                                                        <td style={{ fontWeight: 500, fontSize: '13px', color: 'var(--dark-500)', verticalAlign: 'top', paddingTop: '12px' }}>
                                                            {name}
                                                        </td>
                                                        <td style={{ verticalAlign: 'top', paddingTop: '12px' }}>
                                                            <span style={{
                                                                color: getStatusColor(status.statusType),
                                                                fontWeight: 600, fontSize: '12px'
                                                            }}>
                                                                {status.statusType}
                                                            </span>
                                                        </td>
                                                        <td style={{ fontSize: '12px', color: 'var(--gray-500)', verticalAlign: 'top', paddingTop: '12px' }}>
                                                            <div
                                                                style={{
                                                                    wordBreak: 'break-word',
                                                                    overflowWrap: 'anywhere',
                                                                    maxWidth: '250px'
                                                                }}
                                                                dangerouslySetInnerHTML={{ __html: status.statusText || '' }}
                                                            />
                                                        </td>
                                                        <td style={{ fontSize: '12px', color: 'var(--gray-500)', verticalAlign: 'top', paddingTop: '12px' }}>
                                                            <div dangerouslySetInnerHTML={{ __html: status.challenges || '-' }} />
                                                        </td>
                                                        <td style={{ fontSize: '12px', color: 'var(--gray-500)', verticalAlign: 'top', paddingTop: '12px' }}>
                                                            <div dangerouslySetInnerHTML={{ __html: status.taskForTomorrow || '-' }} />
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* View Details Modal (Shared) */}
            {viewModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: 'white', borderRadius: '12px', width: '90%', maxWidth: '600px',
                        maxHeight: '90vh', overflowY: 'auto', padding: '24px', position: 'relative'
                    }}>
                        <button
                            onClick={() => setViewModal(null)}
                            style={{ position: 'absolute', right: '16px', top: '16px', border: 'none', background: 'none', cursor: 'pointer' }}
                        >
                            <X size={20} color="#9ca3af" />
                        </button>

                        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px', color: '#111827' }}>Status Details</h3>
                        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '20px' }}>
                            {new Date(viewModal.workDate || viewModal.date).toLocaleDateString()} •
                            <span style={{ color: getStatusColor(viewModal.statusType), fontWeight: 600, marginLeft: '6px' }}>{viewModal.statusType}</span>
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--primary-10)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 600 }}>
                                {(viewModal.employeeName || (viewModal.employee ? viewModal.employee.firstName : 'U')).charAt(0)}
                            </div>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                                    {viewModal.employeeName || (viewModal.employee ? `${viewModal.employee.firstName} ${viewModal.employee.lastName}` : 'Unknown Example')}
                                </h4>
                                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                                    {viewModal.employeeIdString || (viewModal.employee ? viewModal.employee.designation : 'Employee')}
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <h5 style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px' }}>Work Done</h5>
                                <div
                                    style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px', color: '#374151', fontSize: '14px', lineHeight: '1.6' }}
                                    dangerouslySetInnerHTML={{ __html: viewModal.statusText || '' }}
                                />
                            </div>

                            <div>
                                <h5 style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px' }}>Challenges</h5>
                                <div
                                    style={{ background: '#fff1f2', padding: '16px', borderRadius: '8px', color: '#9f1239', fontSize: '14px', lineHeight: '1.6' }}
                                    dangerouslySetInnerHTML={{ __html: viewModal.challenges || 'No challenges reported.' }}
                                />
                            </div>

                            <div>
                                <h5 style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px' }}>Plan for Tomorrow</h5>
                                <div
                                    style={{ background: '#f0f9ff', padding: '16px', borderRadius: '8px', color: '#0369a1', fontSize: '14px', lineHeight: '1.6' }}
                                    dangerouslySetInnerHTML={{ __html: viewModal.taskForTomorrow || 'No plan specified.' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
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
            {/* Value outside header for this layout */}
            <div className="stat-card-value" style={{ fontSize: '20px' }}>
                {value}
            </div>
        </div>
    );
}
