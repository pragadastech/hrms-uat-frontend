import React, { useState, useEffect } from 'react';
import {
    FileText, Upload, Download, Trash2, Eye,
    CheckCircle, Clock, AlertCircle, X, Plus, RefreshCw, File as FileIcon, ExternalLink
} from 'lucide-react';
import { documentAPI } from '../services/api';
import Header from '../components/Header';

export default function Documents() {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewDoc, setViewDoc] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);

    // Upload State
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadData, setUploadData] = useState({ type: '', file: null });
    const [uploading, setUploading] = useState(false);

    const keyDocuments = [
        { id: 'AADHAR_CARD', label: 'Aadhaar Card' },
        { id: 'PAN_CARD', label: 'PAN Card' },
        { id: 'PASSPORT', label: 'Passport' },
        { id: 'PASSPORT_SIZE_PHOTO', label: 'Passport Size Photo' },
        { id: 'DRIVING_LICENSE', label: 'Driving License' },
        { id: 'EDUCATIONAL_CERTIFICATE', label: 'Educational Certificate' },
        { id: 'EXPERIENCE_CERTIFICATE', label: 'Experience Certificate' },
        { id: 'BANK_PASSBOOK', label: 'Bank Passbook' },
        { id: 'ADDRESS_PROOF', label: 'Address Proof' },
        { id: 'OTHER', label: 'Other' },
    ];

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const res = await documentAPI.getMyDocuments();
            setDocuments(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error("Failed to fetch documents", e);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setUploadData({ ...uploadData, file: e.target.files[0] });
        }
    };

    const handleUpload = async (e) => {
        if (e) e.preventDefault();
        if (!uploadData.type || !uploadData.file) {
            return;
        }

        setUploading(true);
        try {
            await documentAPI.uploadDocument(uploadData.type, uploadData.file);
            setShowUploadModal(false);
            setUploadData({ type: '', file: null });
            fetchDocuments();
        } catch (e) {
            alert('Upload failed: ' + (e.response?.data?.message || e.message));
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this document?')) {
            try {
                await documentAPI.deleteMyDocument(id);
                fetchDocuments();
            } catch (e) { alert('Delete failed'); }
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
                const res = await documentAPI.downloadMyDocument(doc.id);
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', doc.originalFileName);
                document.body.appendChild(link);
                link.click();
                link.remove();
            }
        } catch (e) {
            console.error("Download failed", e);
            alert("Download failed");
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
                const res = await documentAPI.downloadMyDocument(doc.id);
                const url = window.URL.createObjectURL(new Blob([res.data], { type: mime || 'application/pdf' }));
                setPreviewUrl(url);
            } catch (e) {
                console.error("Preview failed", e);
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

    const getStatusBadge = (verified) => {
        if (verified) return <span className="hr-doc-status verified"><CheckCircle size={10} /> Verified</span>;
        return <span className="hr-doc-status pending"><Clock size={10} /> Pending</span>;
    };

    return (
        <div className="main-content">
            <Header title="Document" subtitle="Manage your official records and identity proofs" />

            <div className="page-content">
                <div className="hr-docs-container">
                    {/* Left Column: Upload Form (Visible as Card on desktop, or can be toggled) */}
                    <div className="hr-docs-sidebar">
                        <div className="hr-upload-card">
                            <div className="hr-upload-card-header">
                                <h3>Upload Document</h3>
                                <p>Add new documents to your profile</p>
                            </div>

                            <form className="hr-upload-form" onSubmit={handleUpload}>
                                <div className="hr-form-group">
                                    <label>Document Type</label>
                                    <select
                                        className="hr-modern-select"
                                        value={uploadData.type}
                                        onChange={e => setUploadData({ ...uploadData, type: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Type</option>
                                        {keyDocuments.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                                    </select>
                                </div>

                                <div className="hr-form-group">
                                    <label>Select File</label>
                                    <div className={`hr-drop-zone ${uploadData.file ? 'has-file' : ''}`}>
                                        <input
                                            type="file"
                                            onChange={handleFileChange}
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            required
                                        />
                                        {uploadData.file ? (
                                            <div className="hr-file-info">
                                                <FileIcon size={32} className="hr-file-icon" />
                                                <div className="hr-file-name">{uploadData.file.name}</div>
                                                <div className="hr-file-size">{(uploadData.file.size / 1024).toFixed(1)} KB</div>
                                                <button type="button" className="hr-remove-file" onClick={() => setUploadData({ ...uploadData, file: null })}>
                                                    <X size={14} /> Remove
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="hr-drop-content">
                                                <div className="hr-upload-icon-wrapper">
                                                    <Upload size={24} />
                                                </div>
                                                <span className="hr-drop-text">Click to browse or drag file</span>
                                                <span className="hr-drop-hint">PDF, JPG, PNG (Max 10MB)</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="hr-upload-actions">
                                    <button
                                        type="button"
                                        className="hr-btn-cancel"
                                        onClick={() => {
                                            setUploadData({ type: '', file: null });
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="hr-btn-upload"
                                        disabled={uploading || !uploadData.file || !uploadData.type}
                                    >
                                        {uploading ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
                                        {uploading ? 'Uploading...' : 'Upload'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Right Column: Document List */}
                    <div className="hr-docs-main">
                        <div className="hr-docs-list-header">
                            <h2 className="hr-section-title">My Documents ({documents.length})</h2>
                            <button className="hr-refresh-btn" onClick={fetchDocuments} title="Refresh">
                                <RefreshCw size={16} />
                            </button>
                        </div>

                        {loading ? (
                            <div className="hr-loading-state">
                                <RefreshCw className="animate-spin" size={32} />
                                <p>Loading your documents...</p>
                            </div>
                        ) : documents.length === 0 ? (
                            <div className="hr-empty-docs">
                                <div className="hr-empty-icon">
                                    <FileIcon size={48} />
                                </div>
                                <h3>No documents found</h3>
                                <p>Start by uploading your first document on the left.</p>
                            </div>
                        ) : (
                            <div className="hr-docs-grid">
                                {documents.map(doc => (
                                    <div key={doc.id} className="hr-doc-card">
                                        <div className="hr-doc-card-top">
                                            <div className={`hr-doc-icon-box ${doc.mimeType?.includes('pdf') ? 'pdf' : 'img'}`}>
                                                <FileText size={20} />
                                            </div>
                                            {getStatusBadge(doc.isVerified)}
                                        </div>

                                        <div className="hr-doc-card-body">
                                            <h4 title={doc.originalFileName}>{doc.originalFileName}</h4>
                                            <div className="hr-doc-type">
                                                {doc.documentType?.replace(/_/g, ' ')}
                                            </div>
                                        </div>

                                        <div className="hr-doc-card-footer">
                                            <div className="hr-doc-meta">
                                                <span>{(doc.fileSize / 1024).toFixed(0)} KB</span>
                                                <span className="dot">•</span>
                                                <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                                            </div>
                                            <div className="hr-doc-actions">
                                                <button onClick={() => handleView(doc)} title="View Details">
                                                    <Eye size={16} />
                                                </button>
                                                <button onClick={() => handleDownload(doc)} title="Download">
                                                    <Download size={16} />
                                                </button>
                                                {!doc.isVerified && (
                                                    <button onClick={() => handleDelete(doc.id)} className="delete" title="Delete">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Details Modal */}
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
                                        viewDoc.mimeType?.includes('image') ? (
                                            <img src={previewUrl} alt="Preview" className="hr-img-preview" />
                                        ) : (viewDoc.mimeType?.includes('pdf') || (viewDoc.originalFileName && viewDoc.originalFileName.match(/\.pdf$/i))) ? (
                                            <div style={{ width: '100%', height: '100%', minHeight: '450px', display: 'flex', flexDirection: 'column' }}>
                                                <iframe
                                                    src={previewUrl.startsWith('http') ? `https://docs.google.com/gview?url=${encodeURIComponent(previewUrl)}&embedded=true` : `${previewUrl}#toolbar=0`}
                                                    title="PDF Preview"
                                                    className="hr-pdf-preview"
                                                    style={{ width: '100%', height: '400px', border: 'none', borderRadius: '6px' }}
                                                />
                                                <div style={{ padding: '10px 14px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '0 0 6px 6px', marginTop: '6px' }}>
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
                                                <FileIcon size={48} />
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
                                            <span className="label">Status:</span>
                                            {getStatusBadge(viewDoc.isVerified)}
                                        </div>
                                        <div className="hr-detail-item">
                                            <span className="label">File Size:</span>
                                            <span className="value">{(viewDoc.fileSize / 1024).toFixed(2)} KB</span>
                                        </div>
                                        <div className="hr-detail-item">
                                            <span className="label">Uploaded:</span>
                                            <span className="value">{new Date(viewDoc.uploadDate).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    {viewDoc.isVerified && (
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
                                            {viewDoc.verificationNotes && (
                                                <div className="hr-v-notes">
                                                    <AlertCircle size={14} />
                                                    <p>{viewDoc.verificationNotes}</p>
                                                </div>
                                            )}
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
