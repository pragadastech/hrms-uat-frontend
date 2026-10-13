import React, { useState } from 'react';
import { Download, Search, RefreshCcw, FileText } from 'lucide-react';
import './Reports.css';

const BaseReportPage = ({
    title,
    columns,
    data,
    loading,
    filters,
    onRefresh,
    onExport,
    totalCount
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    const safeData = Array.isArray(data) ? data : [];

    const filteredData = safeData.filter(item => {
        if (!searchTerm) return true;
        const searchStr = searchTerm.toLowerCase();

        // Helper to check values recursively
        const checkValue = (val) => {
            if (val === null || val === undefined) return false;
            
            if (typeof val === 'object' && !Array.isArray(val)) {
                return Object.values(val).some(checkValue);
            }
            
            if (Array.isArray(val)) {
                return val.some(checkValue);
            }

            const stringVal = String(val).toLowerCase();
            if (stringVal.includes(searchStr)) return true;

            if (typeof val === 'boolean') {
                return (val ? 'yes' : 'no').includes(searchStr);
            }

            return false;
        };

        return Object.values(item).some(checkValue);
    });

    return (
        <div className="report-container">
            <header className="report-header">
                <div className="report-title-section">
                    <h1>{title}</h1>
                    <div className="report-count-badge">
                        {searchTerm ? `${filteredData.length} matching of ` : ''}{totalCount || safeData.length} records
                    </div>
                </div>
                <div className="report-actions">
                    <button
                        onClick={onRefresh}
                        className="action-btn-secondary"
                        title="Refresh Data"
                        disabled={loading}
                    >
                        <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => onExport(filteredData)}
                        className="action-btn-primary"
                    >
                        <Download size={18} />
                        <span>Export CSV</span>
                    </button>
                </div>
            </header>

            <div className="report-toolbar">
                <div className="global-search-container">
                    <label className="filter-label">Global Search</label>
                    <div className="search-wrapper">
                        <div className="search-icon-box">
                            <Search size={18} />
                        </div>
                        <input
                            type="text"
                            placeholder="Type employee, project, task, status..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="global-search-input-new"
                        />
                    </div>
                </div>
                <div className="filters-group">
                    {filters}
                </div>
            </div>

            <div className="report-table-card">
                <div className="report-table-scroll">
                    <table className="report-table">
                        <thead>
                            <tr>
                                {columns.map((col, idx) => (
                                    <th key={idx}>{col.header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i}>
                                        {columns.map((_, j) => (
                                            <td key={j}><div className="skeleton" style={{ height: '20px', width: '100%' }}></div></td>
                                        ))}
                                    </tr>
                                ))
                            ) : filteredData.length > 0 ? (
                                filteredData.map((row, rowIdx) => (
                                    <tr key={rowIdx}>
                                        {columns.map((col, colIdx) => (
                                            <td key={colIdx}>
                                                {col.render ? col.render(row) : row[col.key]}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={columns.length} style={{ padding: '3rem', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'var(--gray-500)' }}>
                                            <FileText size={48} strokeWidth={1} />
                                            <p>No records found matching your criteria.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default BaseReportPage;
