import React, { useState, useEffect, useMemo } from 'react';
import {
    FileText, CheckCircle, Clock, Search, ChevronDown, ChevronRight,
    Download, Eye, ShieldCheck, Filter, RefreshCw, User, FileCheck, AlertCircle, ExternalLink
} from 'lucide-react';
import { documentAPI } from '../services/api';
import Header from '../components/Header';

export default function AdminDocuments() {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('ALL'); // ALL, VERIFIED, PENDING

    // Verification Modal
    const [verifyDoc, setVerifyDoc] = useState(null);
    const [verifyNotes, setVerifyNotes] = useState('');

    // Preview Modal
    const [viewDoc, setViewDoc] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);

    // Accordion State
    const [expandedGroups, setExpandedGroups] = useState({});

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const res = await documentAPI.getAllDocuments();
            setDocuments(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error("Failed to fetch documents", e);
        } finally {
            setLoading(false);
        }
    };

    const groupedDocuments = useMemo(() => {
        const groups = {};
        documents.forEach(doc => {
            const key = doc.employeeId;
            if (!groups[key]) {
                groups[key] = {
                    employeeId: doc.employeeId,
                    employeeName: doc.employeeName || 'Unknown',
                    documents: []
                };
            }
            groups[key].documents.push(doc);
        });
        return Object.values(groups);
    }, [documents]);

    const filteredGroups = useMemo(() => {
        return groupedDocuments.filter(group => {
            const matchesSearch =
                group.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                group.employeeId.toString().includes(searchTerm);

            if (!matchesSearch) return false;

            if (filter === 'ALL') return true;
            if (filter === 'VERIFIED') return group.documents.every(d => d.isVerified);
            if (filter === 'PENDING') return group.documents.some(d => !d.isVerified);
            return true;
        });
    }, [groupedDocuments, searchTerm, filter]);

    const toggleGroup = (id) => {
        setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleVerify = async () => {
        if (!verifyDoc) return;
        try {
            await documentAPI.verifyDocument(verifyDoc.id, {
                isVerified: true,
                verificationNotes: verifyNotes
            });
            setVerifyDoc(null);
            setVerifyNotes('');
            fetchDocuments(); // Refresh to show updated status
        } catch (e) {
            alert('Verification failed');
        }
    };

    const handleDownload = async (doc) => {
        try {
            if (doc.fileData) {
                const link = document.createElement("a");
                link.href = `data:${doc.mimeType};base64,${doc.fileData}`;
                link.download = doc.originalFileName;
                link.click();
            } else {
                const res = await documentAPI.downloadDocument(doc.id);
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', doc.originalFileName);
                document.body.appendChild(link);
                link.click();
                link.remove();
            }
        } catch (e) {
            alert('Download failed');
        }
    };

    const handleView = async (doc) => {
        let mime = doc.mimeType;
        const name = (doc.originalFileName || '').toLowerCase();
        if (!mime || mime === 'application/octet-stream') {
            if (name.endsWith('.pdf')) mime = 'application/pdf';
            else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) mime = 'image/jpeg';
            else if (name.endsWith('.png')) mime = 'image/png';
        }
        const updatedDoc = { ...doc, mimeType: mime };
        setViewDoc(updatedDoc);

        if (doc.fileUrl || doc.s3Url) {
            setPreviewUrl(doc.fileUrl || doc.s3Url);
        } else if (doc.fileData) {
            try {
                // Convert base64 to binary byte array blob to ensure iframe PDF compatibility
                const binaryStr = window.atob(doc.fileData);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                    bytes[i] = binaryStr.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: mime || 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                setPreviewUrl(url);
            } catch (err) {
                setPreviewUrl(`data:${mime || 'application/pdf'};base64,${doc.fileData}`);
            }
        } else {
            try {
                const res = await documentAPI.downloadDocument(doc.id);
                const url = window.URL.createObjectURL(new Blob([res.data], { type: mime || 'application/pdf' }));
                setPreviewUrl(url);
            } catch (e) {
                console.error("Preview failed", e);
                alert("Could not load preview");
            }
        }
    };

    const closeViewModal = () => {
        if (previewUrl && previewUrl.startsWith('blob:')) {
            window.URL.revokeObjectURL(previewUrl);
        }
        setViewDoc(null);
        setPreviewUrl(null);
    };

    // UI Helpers
    const getStatusBadge = (verified) => {
        if (verified) return <span className="hr-doc-status verified"><CheckCircle size={10} /> Verified</span>;
        return <span className="hr-doc-status pending"><Clock size={10} /> Pending</span>;
    };

    return (
        <div className="main-content">
            <Header title="Document Verification" subtitle="Review and verify employee identity proofs and official records" />

            <div className="page-content">
                {/* Admin Controls Bar */}
                <div className="hr-admin-controls">
                    <div className="hr-search-box">
                        <Search size={16} />
                        <input
                            type="text"
                            placeholder="Search by Employee Name or ID..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="hr-filter-tabs">
                        {['ALL', 'VERIFIED', 'PENDING'].map(f => (
                            <button
                                key={f}
                                className={`hr-filter-tab ${filter === f ? 'active' : ''}`}
                                onClick={() => setFilter(f)}
                            >
                                {f === 'ALL' ? 'All' : f === 'VERIFIED' ? 'Verified' : 'Pending'}
                            </button>
                        ))}
                    </div>

                    <button className="hr-refresh-btn-large" onClick={fetchDocuments} title="Sync Documents">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Performance Summary / Stats */}
                <div className="hr-docs-stats-row">
                    <div className="hr-mini-stat">
                        <span className="label">Total Submissions</span>
                        <span className="value">{documents.length}</span>
                    </div>
                    <div className="hr-mini-stat">
                        <span className="label">Pending Review</span>
                        <span className="value text-amber-600">{documents.filter(d => !d.isVerified).length}</span>
                    </div>
                </div>

                {/* Groups List */}
                <div className="hr-admin-docs-list">
                    {loading ? (
                        <div className="hr-loading-state">
                            <RefreshCw className="animate-spin" size={32} />
                            <p>Fetching documents...</p>
                        </div>
                    ) : filteredGroups.length === 0 ? (
                        <div className="hr-empty-state-simple">
                            <AlertCircle size={40} />
                            <h3>No documents found</h3>
                            <p>Try adjusting your filters or search terms.</p>
                        </div>
                    ) : (
                        filteredGroups.map(group => {
                            const totalDocs = group.documents.length;
                            const verifiedDocs = group.documents.filter(d => d.isVerified).length;
                            const isFullyVerified = verifiedDocs === totalDocs;
                            const isExpanded = expandedGroups[group.employeeId];

                            return (
                                <div key={group.employeeId} className={`hr-emp-group-card ${isExpanded ? 'expanded' : ''}`}>
                                    <div
                                        className="hr-group-header"
                                        onClick={() => toggleGroup(group.employeeId)}
                                    >
                                        <div className="hr-emp-info">
                                            <div className="hr-emp-avatar">
                                                {group.employeeName.charAt(0)}
                                            </div>
                                            <div className="hr-emp-details">
                                                <h4>{group.employeeName}</h4>
                                                <span>ID: {group.employeeId} • {totalDocs} Documents</span>
                                            </div>
                                        </div>

                                        <div className="hr-group-status">
                                            <div className="hr-progress-text">
                                                {verifiedDocs}/{totalDocs} Verified
                                            </div>
                                            {isFullyVerified ? (
                                                <div className="hr-icon-circle success"><CheckCircle size={16} /></div>
                                            ) : (
                                                <div className="hr-icon-circle pending"><Clock size={16} /></div>
                                            )}
                                            <div className="hr-chevron">
                                                {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="hr-group-content">
                                            <div className="hr-table-responsive">
                                                <table className="hr-admin-doc-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Document Name</th>
                                                            <th>Uploaded On</th>
                                                            <th>Status</th>
                                                            <th className="text-right">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {group.documents.map(doc => (
                                                            <tr key={doc.id}>
                                                                <td>
                                                                    <div className="hr-doc-name-cell">
                                                                        <FileText size={18} className="text-indigo-500" />
                                                                        <div>
                                                                            <div className="main-name">{doc.originalFileName}</div>
                                                                            <div className="sub-type">{doc.documentType.replace(/_/g, ' ')}</div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td>{new Date(doc.uploadDate).toLocaleDateString()}</td>
                                                                <td>{getStatusBadge(doc.isVerified)}</td>
                                                                <td>
                                                                    <div className="hr-doc-actions">
                                                                        <button
                                                                            onClick={() => handleView(doc)}
                                                                            className="btn-icon-admin"
                                                                            title="Preview Document"
                                                                        >
                                                                            <Eye size={16} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDownload(doc)}
                                                                            className="btn-icon-admin"
                                                                            title="Download"
                                                                        >
                                                                            <Download size={16} />
                                                                        </button>
                                                                        {!doc.isVerified && (
                                                                            <button
                                                                                onClick={() => setVerifyDoc(doc)}
                                                                                className="btn-icon-admin verify"
                                                                                title="Verify Document"
                                                                            >
                                                                                <ShieldCheck size={16} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Verification Modal */}
            {verifyDoc && (
                <div className="hr-modal-overlay" onClick={() => setVerifyDoc(null)}>
                    <div className="hr-modal" onClick={e => e.stopPropagation()}>
                        <div className="hr-modal-header">
                            <div className="title-with-icon">
                                <FileCheck size={20} className="text-green-600" />
                                <h2>Verify Document</h2>
                            </div>
                            <button className="hr-modal-close" onClick={() => setVerifyDoc(null)}>×</button>
                        </div>
                        <div className="hr-modal-body">
                            <p className="hr-modal-desc">
                                Reviewing <strong>{verifyDoc.originalFileName}</strong> for {verifyDoc.employeeName || 'Employee'}.
                            </p>

                            <div className="hr-form-group">
                                <label>Verification Notes (Optional)</label>
                                <textarea
                                    className="hr-modern-textarea"
                                    rows={3}
                                    placeholder="Add any notes regarding this document's verification..."
                                    value={verifyNotes}
                                    onChange={e => setVerifyNotes(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="hr-modal-footer">
                            <button className="hr-btn-secondary" onClick={() => setVerifyDoc(null)}>Cancel</button>
                            <button className="hr-btn-success" onClick={handleVerify}>
                                <CheckCircle size={16} /> Confirm & Verify
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Preview Modal */}
            {viewDoc && (
                <div className="hr-modal-overlay" onClick={closeViewModal}>
                    <div className="hr-modal-preview" onClick={e => e.stopPropagation()}>
                        <div className="hr-modal-header">
                            <div className="hr-modal-header-info">
                                <h2>{viewDoc.originalFileName}</h2>
                                <span className="hr-doc-type-tag">{viewDoc.documentType.replace(/_/g, ' ')}</span>
                            </div>
                            <button className="hr-modal-close" onClick={closeViewModal}>×</button>
                        </div>

                        <div className="hr-modal-body no-padding">
                            <div className="hr-preview-main">
                                <div className="hr-file-preview-content">
                                    {previewUrl ? (
                                        (viewDoc.mimeType?.includes('image') || (viewDoc.originalFileName && viewDoc.originalFileName.match(/\.(jpg|jpeg|png|webp|gif)$/i))) ? (
                                            <img src={previewUrl} alt="Preview" className="hr-img-preview" />
                                        ) : (viewDoc.mimeType?.includes('pdf') || (viewDoc.originalFileName && viewDoc.originalFileName.match(/\.pdf$/i))) ? (
                                            <div style={{ width: '100%', height: '100%', minHeight: '450px', display: 'flex', flexDirection: 'column' }}>
                                                <iframe
                                                    src={previewUrl.startsWith('http') ? `https://docs.google.com/gview?url=${encodeURIComponent(previewUrl)}&embedded=true` : `${previewUrl}#toolbar=0`}
                                                    title="PDF Preview"
                                                    className="hr-pdf-preview"
                                                    style={{ width: '100%', height: '400px', border: 'none', borderRadius: '6px' }}
                                                />
                                                <div style={{ padding: '12px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '0 0 6px 6px' }}>
                                                    <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                                                        If your browser blocks the inline PDF, click to open directly:
                                                    </span>
                                                    <a
                                                        href={previewUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', backgroundColor: '#2563eb', color: '#ffffff', borderRadius: '6px', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}
                                                    >
                                                        <ExternalLink size={14} /> Open PDF in New Tab
                                                    </a>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="hr-no-preview">
                                                <FileText size={48} />
                                                <p>Preview not supported for this file type.</p>
                                            </div>
                                        )
                                    ) : (
                                        <div className="hr-loading-preview">
                                            <RefreshCw className="animate-spin" />
                                            <p>Generating preview...</p>
                                        </div>
                                    )}
                                </div>

                                <div className="hr-preview-sidebar">
                                    <div className="hr-detail-section">
                                        <label>Document Info</label>
                                        <div className="hr-detail-item">
                                            <span className="label">Owner:</span>
                                            <span className="value">{viewDoc.employeeName}</span>
                                        </div>
                                        <div className="hr-detail-item">
                                            <span className="label">Status:</span>
                                            {getStatusBadge(viewDoc.isVerified)}
                                        </div>
                                        <div className="hr-detail-item">
                                            <span className="label">Uploaded:</span>
                                            <span className="value">{new Date(viewDoc.uploadDate).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    {!viewDoc.isVerified ? (
                                        <div className="hr-preview-verify-actions">
                                            <button
                                                onClick={() => {
                                                    setVerifyDoc(viewDoc);
                                                    closeViewModal();
                                                }}
                                                className="hr-btn-verify-now"
                                            >
                                                <ShieldCheck size={18} /> Verify Now
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="hr-detail-section verified">
                                            <label>Verification Details</label>
                                            <div className="hr-detail-item">
                                                <span className="label">Verified By:</span>
                                                <span className="value">{viewDoc.verifiedBy}</span>
                                            </div>
                                            <div className="hr-detail-item">
                                                <span className="label">Date:</span>
                                                <span className="value">{new Date(viewDoc.verifiedDate).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="hr-preview-actions">
                                        <button onClick={() => handleDownload(viewDoc)} className="hr-btn-download-full">
                                            <Download size={18} /> Download Original
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
