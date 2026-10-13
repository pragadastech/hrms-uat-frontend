import { useState } from 'react';
import { X, Upload, CheckCircle, AlertCircle, Loader2, FileText, Trash2, Download, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { leaveBalanceAPI } from '../services/api';

export default function LeaveHistoryImportModal({ isOpen, onClose, onImportSuccess }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setResult(null);
        }
    };

    const handleDownloadTemplate = () => {
        const headers = ['employeeId', 'leaveType', 'startDate', 'endDate', 'days', 'session', 'reason', 'status', 'approvedBy'];
        const sampleRow = ['EMP001', 'ANNUAL_LEAVE', '2023-12-01', '2023-12-02', '2', 'FULL_DAY', 'Historical data migration', 'APPROVED', 'John Doe'];
        const csvContent = [headers, sampleRow].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "leave_history_template.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImport = async () => {
        if (!file) {
            toast.error('Please select a file to import');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        setLoading(true);
        try {
            const res = await leaveBalanceAPI.importHistory(formData);
            setResult(res.data);
            if (res.data.successCount > 0) {
                toast.success(`Successfully imported ${res.data.successCount} records!`);
                if (onImportSuccess) onImportSuccess();
            }
            if (res.data.errorCount > 0) {
                toast.error(`${res.data.errorCount} records failed during import.`);
            }
        } catch (error) {
            console.error('Import error:', error);
            toast.error(error.response?.data?.message || 'Failed to import leave history');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const modalStyles = {
        overlay: {
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.3s ease-out'
        },
        container: {
            backgroundColor: '#ffffff',
            width: '100%',
            maxWidth: '650px',
            borderRadius: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        },
        header: {
            padding: '24px 32px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, #ffffff, #f8fafc)'
        },
        body: {
            padding: '32px',
            maxHeight: '70vh',
            overflowY: 'auto'
        },
        footer: {
            padding: '20px 32px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            flexDirection: 'row-reverse',
            gap: '12px'
        },
        instructionCard: {
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '24px'
        },
        uploadZone: {
            border: '2px dashed #e2e8f0',
            borderRadius: '20px',
            padding: '40px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative'
        },
        btnPrimary: {
            backgroundColor: '#6366f1',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '12px',
            fontWeight: '600',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.2)',
            border: 'none',
            cursor: 'pointer'
        },
        btnSecondary: {
            backgroundColor: '#ffffff',
            color: '#334155',
            padding: '12px 24px',
            borderRadius: '12px',
            fontWeight: '600',
            fontSize: '14px',
            border: '1px solid #e2e8f0',
            transition: 'all 0.2s ease'
        }
    };

    return (
        <div style={modalStyles.overlay} onClick={onClose}>
            <div style={modalStyles.container} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={modalStyles.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ backgroundColor: '#6366f1', color: 'white', padding: '10px', borderRadius: '12px' }}>
                            <Upload size={22} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>Import Leave History</h3>
                            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Migrate bulk historical records seamlessly</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        style={{ background: '#f1f5f9', color: '#94a3b8', padding: '8px', borderRadius: '50%', border: 'none' }}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="custom-scrollbar" style={modalStyles.body}>
                    {!result ? (
                        <>
                            {/* Import Instructions */}
                            <div style={modalStyles.instructionCard}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                    <Info size={16} style={{ color: '#6366f1' }} />
                                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>Import Instructions</h4>
                                </div>
                                <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <li style={{ fontSize: '12px', color: '#475569', display: 'flex', gap: '8px' }}>
                                        <span style={{ color: '#6366f1' }}>•</span> 
                                        <span>Supported formats: <strong>.csv, .xlsx, .xls</strong></span>
                                    </li>
                                    <li style={{ fontSize: '12px', color: '#475569', display: 'flex', gap: '8px' }}>
                                        <span style={{ color: '#6366f1' }}>•</span> 
                                        <span>Columns: <strong>employeeId, leaveType, startDate, endDate, days, session, reason, status, approvedBy</strong></span>
                                    </li>
                                    <li style={{ fontSize: '12px', color: '#475569', display: 'flex', gap: '8px' }}>
                                        <span style={{ color: '#6366f1' }}>•</span> 
                                        <span>Values for leaveType: <strong>ANNUAL_LEAVE, SICK_LEAVE, CASUAL_LEAVE, etc.</strong></span>
                                    </li>
                                    <li style={{ fontSize: '12px', color: '#475569', display: 'flex', gap: '8px' }}>
                                        <span style={{ color: '#6366f1' }}></span> 
                                        <span>Values for session: <strong>FULL_DAY, MORNING_HALF, AFTERNOON_HALF</strong></span>
                                    </li>
                                    <li style={{ fontSize: '12px', color: '#475569', display: 'flex', gap: '8px' }}>
                                        <span style={{ color: '#6366f1' }}>•</span> 
                                        <span>Supported date formats: <strong>YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY</strong>, etc.</span>
                                    </li>
                                </ul>
                                
                                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                                    <button 
                                        onClick={handleDownloadTemplate}
                                        style={{ background: 'none', color: '#6366f1', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', padding: 0 }}
                                    >
                                        <Download size={14} /> Download Sample Template
                                    </button>
                                </div>
                            </div>

                            {/* Upload Zone */}
                            <div 
                                style={{
                                    ...modalStyles.uploadZone,
                                    backgroundColor: file ? '#f5f7ff' : '#ffffff',
                                    borderColor: file ? '#6366f1' : '#e2e8f0'
                                }}
                            >
                                <input
                                    type="file"
                                    id="leave-import-file"
                                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                                    accept=".csv,.xlsx,.xls"
                                    onChange={handleFileChange}
                                />
                                {file ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: '16px' }}>
                                            <FileText size={32} style={{ color: '#6366f1' }} />
                                        </div>
                                        <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>{file.name}</p>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{(file.size / 1024).toFixed(1)} KB</p>
                                        <div style={{ marginTop: '16px' }}>
                                            <button 
                                                onClick={(e) => { e.preventDefault(); setFile(null); }}
                                                style={{ background: '#fee2e2', color: '#ef4444', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', border: 'none' }}
                                            >
                                                Remove File
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ backgroundColor: '#f1f5f9', padding: '16px', borderRadius: '50%', marginBottom: '16px' }}>
                                            <Upload size={32} style={{ color: '#94a3b8' }} />
                                        </div>
                                        <p style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>Click to upload or drag and drop</p>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>CSV or Excel files only</p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '20px', padding: '24px', textAlign: 'center' }}>
                                    <div style={{ backgroundColor: '#22c55e', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyCenter: 'center', margin: '0 auto 12px auto' }}>
                                        <CheckCircle size={18} style={{ margin: 'auto' }} />
                                    </div>
                                    <p style={{ margin: 0, fontSize: '28px', fontWeight: '900', color: '#15803d' }}>{result.successCount}</p>
                                    <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '1px' }}>Success</p>
                                </div>
                                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '20px', padding: '24px', textAlign: 'center' }}>
                                    <div style={{ backgroundColor: '#ef4444', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyCenter: 'center', margin: '0 auto 12px auto' }}>
                                        <AlertCircle size={18} style={{ margin: 'auto' }} />
                                    </div>
                                    <p style={{ margin: 0, fontSize: '28px', fontWeight: '900', color: '#b91c1c' }}>{result.errorCount}</p>
                                    <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '1px' }}>Failed</p>
                                </div>
                            </div>

                            {result.errors && result.errors.length > 0 && (
                                <div style={{ border: '1px solid #f1f5f9', borderRadius: '16px', overflow: 'hidden' }}>
                                    <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                            <thead style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0, zIndex: 1 }}>
                                                <tr>
                                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>Row</th>
                                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>Error Details</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {result.errors.map((err, i) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '12px 16px', fontWeight: '800', color: '#0f172a' }}>#{err.row}</td>
                                                        <td style={{ padding: '12px 16px', color: '#ef4444', fontWeight: '500' }}>{err.error}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <button 
                                onClick={() => setResult(null)}
                                style={{ width: '100%', padding: '14px', borderRadius: '16px', border: '2px dashed #e2e8f0', background: 'none', color: '#6366f1', fontWeight: '700', fontSize: '13px' }}
                            >
                                Import Another Batch
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={modalStyles.footer}>
                    {!result && (
                        <button
                            type="button"
                            disabled={!file || loading}
                            onClick={handleImport}
                            style={{
                                ...modalStyles.btnPrimary,
                                opacity: (!file || loading) ? 0.5 : 1,
                                cursor: (!file || loading) ? 'not-allowed' : 'pointer',
                                border: 'none',
                                color: 'white'
                            }}
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : null}
                            {loading ? 'Processing...' : 'Start Import'}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        style={modalStyles.btnSecondary}
                    >
                        {result ? 'Finish' : 'Cancel'}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}
