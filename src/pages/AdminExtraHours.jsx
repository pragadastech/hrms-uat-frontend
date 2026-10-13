import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import api from '../services/api';
import { formatHours } from '../utils/timeUtils';
import { utils, writeFile } from 'xlsx';
import {
    CheckCircle2,
    Calendar,
    Search,
    Download,
    RefreshCw,
    Clock,
    User,
    ChevronDown,
    ChevronUp,
    FileSpreadsheet,
    Briefcase,
    Zap,
    ExternalLink,
    Filter
} from 'lucide-react';

export default function AdminExtraHours() {
    const [loading, setLoading] = useState(false);
    const [entries, setEntries] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [serverStats, setServerStats] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    
    // ... rest of state
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [expandedEmployees, setExpandedEmployees] = useState(new Set());
    
    // Date range state - default to current month present month
    const getCurrentMonthRange = () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month
        
        // Ensure we handle local timezone offset for the ISO string
        const offset = now.getTimezoneOffset() * 60000;
        const localStart = new Date(start.getTime() - offset);
        const localEnd = new Date(end.getTime() - offset);

        return {
            start: localStart.toISOString().split('T')[0],
            end: localEnd.toISOString().split('T')[0]
        };
    };
    
    const [dateRange, setDateRange] = useState(getCurrentMonthRange());

    useEffect(() => {
        fetchApprovedBillableEntries();
    }, [dateRange.start, dateRange.end]);

    const fetchApprovedBillableEntries = async () => {
        setLoading(true);
        try {
            const response = await api.get('/timesheets/approved-entries', { 
                params: { 
                    startDate: dateRange.start,
                    endDate: dateRange.end,
                    onlyBillable: true
                } 
            });
            
            const data = response.data;
            let allEntries = [];
            if (data?.entries) {
                allEntries = data.entries;
            } else if (Array.isArray(data)) {
                allEntries = data;
            }
            
            // Store analytics metadata from server
            setServerStats({
                totalHours: data?.totalHours || 0,
                billableCount: data?.billableCount || 0,
                hoursByEmployee: data?.hoursByEmployee || {}
            });
            
            allEntries.sort((a, b) => new Date(b.workDate) - new Date(a.workDate));
            setEntries(allEntries);
        } catch (error) {
            console.error('Error fetching approved billable entries:', error);
            setEntries([]);
        } finally {
            setLoading(false);
        }
    };

    const handleExportToExcel = () => {
        if (entries.length === 0) return;

        const worksheetData = entries.map(entry => ({
            'Work Date': entry.workDate || entry.work_date,
            'Employee ID': entry.employeeId,
            'Employee Name': entry.employeeName,
            'Department': entry.department || 'N/A',
            'Project': entry.projectName || entry.projectNameSnapshot || 'N/A',
            'Task': entry.taskName || entry.taskNameSnapshot || 'N/A',
            'Hours': formatHours(entry.hours),
            'Description': entry.description || '',
            'Approved By': entry.approvedByName || 'System',
            'Approved At': entry.approvedAt ? new Date(entry.approvedAt).toLocaleString() : 'N/A'
        }));

        const worksheet = utils.json_to_sheet(worksheetData);
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, 'Approved Hours');
        
        // Auto-size columns
        const colWidths = Object.keys(worksheetData[0]).map(key => ({
            wch: Math.max(key.length, ...worksheetData.map(row => String(row[key]).length)) + 2
        }));
        worksheet['!cols'] = colWidths;

        writeFile(workbook, `Approved_Extra_Hours_${dateRange.start}_to_${dateRange.end}.xlsx`);
    };



    const filteredEntries = entries.filter(entry => {
        const s = searchTerm.toLowerCase();
        return (
            (entry.employeeName || '').toLowerCase().includes(s) ||
            (entry.employeeId || '').toLowerCase().includes(s) ||
            (entry.projectName || '').toLowerCase().includes(s) ||
            (entry.description || '').toLowerCase().includes(s)
        );
    });

    const groupedEntries = React.useMemo(() => {
        const grouped = {};
        filteredEntries.forEach(entry => {
            const key = entry.employeeId || entry.employeeName;
            if (!grouped[key]) {
                grouped[key] = {
                    ...entry,
                    totalHours: 0,
                    entries: []
                };
            }
            grouped[key].entries.push(entry);
            grouped[key].totalHours += parseFloat(entry.hours || 0);
        });
        return Object.values(grouped).sort((a, b) => b.totalHours - a.totalHours);
    }, [filteredEntries]);

    const idxLast = currentPage * rowsPerPage;
    const idxFirst = idxLast - rowsPerPage;
    const currentGroups = groupedEntries.slice(idxFirst, idxLast);

    const toggleExpand = (id) => {
        setExpandedEmployees(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <div className="main-content" style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
            <Header 
                title="Billable Extra Hours" 
                subtitle="High-fidelity audit of all approved billable work entries across the organization." 
            />

            <div className="page-content" style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
                
                {/* Visual Stats Bar */}
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
                    gap: '20px', 
                    marginBottom: '24px' 
                }}>
                    <div className="card no-hover" style={{ padding: '20px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', border: 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.9 }}>
                            <span style={{ fontSize: '14px', fontWeight: 500 }}>Total Approved Hours</span>
                            <Zap size={18} />
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px' }}>
                            {formatHours(serverStats ? serverStats.totalHours : entries.reduce((acc, curr) => acc + parseFloat(curr.hours || 0), 0))}
                        </div>
                        <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>Across {entries.length} entries</div>
                    </div>

                    <div className="card no-hover" style={{ padding: '20px', border: '1px solid #e2e8f0', background: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
                            <span style={{ fontSize: '14px', fontWeight: 500 }}>Active Contributors</span>
                            <User size={18} />
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: '#1e293b' }}>
                            {serverStats ? Object.keys(serverStats.hoursByEmployee).length : groupedEntries.length}
                        </div>
                        <div style={{ fontSize: '12px', marginTop: '4px', color: '#94a3b8' }}>Distinct employees</div>
                    </div>

                    <div className="card no-hover" style={{ padding: '20px', border: '1px solid #e2e8f0', background: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
                            <span style={{ fontSize: '14px', fontWeight: 500 }}>Avg. Per Employee</span>
                            <Clock size={18} />
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: '#1e293b' }}>
                            {serverStats && Object.keys(serverStats.hoursByEmployee).length > 0 
                                ? formatHours(serverStats.totalHours / Object.keys(serverStats.hoursByEmployee).length)
                                : groupedEntries.length > 0 ? formatHours(entries.reduce((acc, curr) => acc + parseFloat(curr.hours || 0), 0) / groupedEntries.length) : '0:00'}
                        </div>
                        <div style={{ fontSize: '12px', marginTop: '4px', color: '#94a3b8' }}>Billable efficiency</div>
                    </div>
                </div>

                <div className="card no-hover" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', backgroundColor: 'white' }}>
                    
                    {/* Filter Section with Glassmorphism Search */}
                    <div style={{ 
                        padding: '24px', 
                        borderBottom: '1px solid #f1f5f9', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        gap: '24px',
                        flexWrap: 'wrap'
                    }}>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                            <div style={{ 
                                position: 'relative',
                                background: '#f8fafc',
                                borderRadius: '12px',
                                padding: '4px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                border: '1px solid #e2e8f0',
                                width: '320px'
                            }}>
                                <Search size={18} style={{ color: '#94a3b8', marginRight: '10px' }} />
                                <input 
                                    type="text" 
                                    placeholder="Search audits..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ 
                                        background: 'transparent',
                                        border: 'none',
                                        padding: '8px 0',
                                        fontSize: '14px',
                                        outline: 'none',
                                        width: '100%',
                                        color: '#334155'
                                    }}
                                />
                            </div>

                            <div 
                                style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '12px', 
                                    background: '#f8fafc', 
                                    padding: '6px 16px', 
                                    borderRadius: '12px', 
                                    border: '1px solid #e2e8f0',
                                    cursor: 'pointer'
                                }}
                                onClick={(e) => {
                                    // Trigger the first date picker when the container is clicked
                                    const firstInput = e.currentTarget.querySelector('input');
                                    if (firstInput && firstInput.showPicker) firstInput.showPicker();
                                }}
                            >
                                <Calendar size={16} style={{ color: '#3b82f6' }} />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input 
                                        type="date" 
                                        title="Start Date"
                                        value={dateRange.start}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => setDateRange(p => ({ ...p, start: e.target.value }))}
                                        style={{ 
                                            border: 'none', 
                                            background: 'transparent', 
                                            fontSize: '13px', 
                                            color: '#1e293b', 
                                            fontWeight: 600,
                                            outline: 'none',
                                            cursor: 'pointer'
                                        }}
                                    />
                                    <span style={{ color: '#cbd5e1', fontWeight: 700 }}>→</span>
                                    <input 
                                        type="date" 
                                        title="End Date"
                                        value={dateRange.end}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => setDateRange(p => ({ ...p, end: e.target.value }))}
                                        style={{ 
                                            border: 'none', 
                                            background: 'transparent', 
                                            fontSize: '13px', 
                                            color: '#1e293b', 
                                            fontWeight: 600,
                                            outline: 'none',
                                            cursor: 'pointer'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button 
                                onClick={handleExportToExcel}
                                disabled={entries.length === 0}
                                style={{ 
                                    padding: '10px 20px',
                                    borderRadius: '12px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    fontWeight: 600,
                                    fontSize: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: entries.length === 0 ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    opacity: entries.length === 0 ? 0.6 : 1,
                                    boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)'
                                }}
                            >
                                <FileSpreadsheet size={18} />
                                Export Excel
                            </button>
                            <button 
                                onClick={fetchApprovedBillableEntries}
                                className={loading ? 'spinning' : ''}
                                style={{ 
                                    padding: '10px 14px',
                                    borderRadius: '12px',
                                    background: 'white',
                                    color: '#64748b',
                                    border: '1px solid #e2e8f0',
                                    cursor: 'pointer'
                                }}
                            >
                                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    {/* Modern Table Layout */}
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8fafc' }}>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Employee</th>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Total Hours</th>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Role/Dept</th>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Status</th>
                                    <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && groupedEntries.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                                            <div className="shimmer-rect" style={{ height: '40px', width: '100%', marginBottom: '12px' }}></div>
                                            <div className="shimmer-rect" style={{ height: '40px', width: '100%', marginBottom: '12px' }}></div>
                                            <div className="shimmer-rect" style={{ height: '40px', width: '100%' }}></div>
                                        </td>
                                    </tr>
                                ) : currentGroups.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ padding: '80px 24px', textAlign: 'center' }}>
                                            <div style={{ color: '#cbd5e1', marginBottom: '16px' }}><Search size={48} style={{ margin: '0 auto' }} /></div>
                                            <div style={{ fontSize: '16px', fontWeight: 600, color: '#64748b' }}>No verified extra hours found</div>
                                            <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: '4px' }}>Try adjusting your date range or search filters.</div>
                                        </td>
                                    </tr>
                                ) : currentGroups.map((group) => {
                                    const expanded = expandedEmployees.has(group.employeeId);
                                    return (
                                        <React.Fragment key={group.employeeId}>
                                            <tr 
                                                onClick={() => toggleExpand(group.employeeId)}
                                                style={{ 
                                                    borderBottom: '1px solid #f1f5f9',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s',
                                                    backgroundColor: expanded ? '#f1f5f9' : 'transparent'
                                                }}
                                                onMouseOver={(e) => !expanded && (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                                onMouseOut={(e) => !expanded && (e.currentTarget.style.backgroundColor = 'transparent')}
                                            >
                                                <td style={{ padding: '16px 24px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <div style={{ 
                                                            width: '40px', 
                                                            height: '40px', 
                                                            borderRadius: '12px', 
                                                            background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: '#4338ca',
                                                            fontWeight: 700,
                                                            fontSize: '14px'
                                                        }}>
                                                            {group.employeeName?.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px' }}>{group.employeeName}</div>
                                                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>{group.employeeId}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '16px 24px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '15px' }}>{formatHours(group.totalHours)}</span>
                                                        <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Hrs</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '16px 24px' }}>
                                                    <div style={{ fontSize: '13px', color: '#475569', fontWeight: 500 }}>{group.department || 'General'}</div>
                                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Core Engineering</div>
                                                </td>
                                                <td style={{ padding: '16px 24px' }}>
                                                    <div style={{ 
                                                        display: 'inline-flex', 
                                                        alignItems: 'center', 
                                                        gap: '4px', 
                                                        padding: '4px 10px', 
                                                        borderRadius: '20px', 
                                                        background: '#ecfdf5', 
                                                        color: '#059669',
                                                        fontSize: '11px',
                                                        fontWeight: 700
                                                    }}>
                                                        <CheckCircle2 size={12} />
                                                        VERIFIED
                                                    </div>
                                                </td>
                                                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                                    <div style={{ color: '#94a3b8' }}>
                                                        {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Expandable Details Container - List Wise */}
                                            {expanded && (
                                                <tr>
                                                    <td colSpan={5} style={{ padding: '0px', backgroundColor: '#fcfcfd' }}>
                                                        <div style={{ padding: '0 24px 24px 72px' }}>
                                                            <div style={{ 
                                                                backgroundColor: 'white', 
                                                                borderRadius: '0 0 12px 12px', 
                                                                border: '1px solid #e2e8f0',
                                                                borderTop: 'none',
                                                                overflow: 'hidden'
                                                            }}>
                                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                                                    <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                                        <tr>
                                                                            <th style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Date</th>
                                                                            <th style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Project / Task</th>
                                                                            <th style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Description</th>
                                                                            <th style={{ padding: '10px 16px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Hours</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {group.entries.map((entry, i) => (
                                                                            <tr key={i} style={{ borderBottom: i === group.entries.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                                                                <td style={{ padding: '12px 16px', color: '#475569', whiteSpace: 'nowrap' }}>
                                                                                    {new Date(entry.workDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                                                                                </td>
                                                                                <td style={{ padding: '12px 16px' }}>
                                                                                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{entry.projectName || entry.projectNameSnapshot}</div>
                                                                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{entry.taskName || entry.taskNameSnapshot}</div>
                                                                                </td>
                                                                                <td style={{ padding: '12px 16px', color: '#64748b', maxWidth: '400px' }}>
                                                                                    <div style={{ 
                                                                                        overflow: 'hidden',
                                                                                        textOverflow: 'ellipsis',
                                                                                        display: '-webkit-box',
                                                                                        WebkitLineClamp: '2',
                                                                                        WebkitBoxOrient: 'vertical'
                                                                                    }}>
                                                                                        {entry.description || '-'}
                                                                                    </div>
                                                                                </td>
                                                                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                                                    <span style={{ fontWeight: 700, color: '#3b82f6', fontFamily: 'monospace' }}>
                                                                                        {formatHours(entry.hours)}
                                                                                    </span>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Premium Pagination */}
                    <div style={{ padding: '20px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white' }}>
                        <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                            Showing <span style={{ color: '#1e293b', fontWeight: 700 }}>{idxFirst + 1}</span> to <span style={{ color: '#1e293b', fontWeight: 700 }}>{Math.min(idxLast, groupedEntries.length)}</span> of <span style={{ color: '#1e293b', fontWeight: 700 }}>{groupedEntries.length}</span> verified contributors
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                style={{ 
                                    padding: '8px 16px', 
                                    borderRadius: '8px', 
                                    background: 'white', 
                                    border: '1px solid #e2e8f0', 
                                    color: '#475569',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                    opacity: currentPage === 1 ? 0.5 : 1
                                }}
                            >
                                Previous
                            </button>
                            <button 
                                onClick={() => setCurrentPage(p => p + 1)}
                                disabled={idxLast >= groupedEntries.length}
                                style={{ 
                                    padding: '8px 16px', 
                                    borderRadius: '8px', 
                                    background: 'white', 
                                    border: '1px solid #e2e8f0', 
                                    color: '#475569',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: idxLast >= groupedEntries.length ? 'not-allowed' : 'pointer',
                                    opacity: idxLast >= groupedEntries.length ? 0.5 : 1
                                }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes shimmer {
                    0% { background-position: -468px 0 }
                    100% { background-position: 468px 0 }
                }
                .shimmer-rect {
                    background: #f6f7f8;
                    background-image: linear-gradient(to right, #f6f7f8 0%, #edeef1 20%, #f6f7f8 40%, #f6f7f8 100%);
                    background-repeat: no-repeat;
                    background-size: 800px 104px;
                    display: inline-block;
                    position: relative;
                    animation-duration: 1s;
                    animation-fill-mode: forwards;
                    animation-iteration-count: infinite;
                    animation-name: shimmer;
                    animation-timing-function: linear;
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
