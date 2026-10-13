import React, { useState, useEffect } from 'react';
import {
  Package, RefreshCw, Monitor, Smartphone, HardDrive,
  Headphones, Briefcase, Ticket, History, X
} from 'lucide-react';
import { employeeAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import Header from '../components/Header';
import './AssetManagement.css';

const assetTypes = [
  { value: 'LAPTOP', label: 'Laptop', icon: Monitor },
  { value: 'MOBILE', label: 'Mobile', icon: Smartphone },
  { value: 'TABLET', label: 'Tablet', icon: Smartphone },
  { value: 'MONITOR', label: 'Monitor', icon: Monitor },
  { value: 'KEYBOARD', label: 'Keyboard', icon: HardDrive },
  { value: 'MOUSE', label: 'Mouse', icon: HardDrive },
  { value: 'HEADPHONES', label: 'Headphones', icon: Headphones },
  { value: 'CHARGER', label: 'Charger', icon: HardDrive },
  { value: 'BAG', label: 'Bag/Case', icon: Briefcase },
  { value: 'OTHER', label: 'Other', icon: HardDrive },
];

const statusConfig = {
  AVAILABLE: { label: 'Available', color: '#059669', bg: '#D1FAE5' },
  ASSIGNED: { label: 'Assigned', color: '#2563EB', bg: '#DBEAFE' },
  MAINTENANCE: { label: 'Maintenance', color: '#D97706', bg: '#FEF3C7' },
  RETIRED: { label: 'Retired', color: '#6B7280', bg: '#F3F4F6' },
  LOST: { label: 'Lost', color: '#DC2626', bg: '#FEE2E2' },
  DAMAGED: { label: 'Damaged', color: '#DC2626', bg: '#FEE2E2' },
};

const ticketTypes = ['REPAIR', 'DAMAGE', 'LOST', 'REPLACEMENT', 'MAINTENANCE'];

function formatDate(value) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

const formatEventType = (type) => {
  switch (type) {
    case 'CREATED': return 'Asset Created';
    case 'UPDATED': return 'Asset Details Updated';
    case 'ASSIGNED': return 'Asset Assigned';
    case 'RETURNED': return 'Asset Returned';
    case 'TRANSFERRED': return 'Asset Transferred';
    case 'STATUS_CHANGED': return 'Status Changed';
    case 'MAINTENANCE_LOGGED': return 'Maintenance Logged';
    case 'TICKET_OPENED': return 'Support Ticket Opened';
    case 'TICKET_UPDATED': return 'Support Ticket Updated';
    case 'TICKET_CLOSED': return 'Support Ticket Closed';
    case 'WARRANTY_ALERT': return 'Warranty Alert';
    default: return type ? type.replace(/_/g, ' ') : 'Event';
  }
};

const getEventTypeStyle = (type) => {
  switch (type) {
    case 'CREATED': return { color: '#475569', bg: '#f1f5f9' };
    case 'UPDATED': return { color: '#475569', bg: '#f1f5f9' };
    case 'ASSIGNED': return { color: '#1d4ed8', bg: '#dbeafe' };
    case 'RETURNED': return { color: '#047857', bg: '#d1fae5' };
    case 'TRANSFERRED': return { color: '#7c3aed', bg: '#ede9fe' };
    case 'STATUS_CHANGED': return { color: '#0369a1', bg: '#e0f2fe' };
    case 'MAINTENANCE_LOGGED': return { color: '#b45309', bg: '#fef3c7' };
    case 'TICKET_OPENED': return { color: '#b91c1c', bg: '#fee2e2' };
    case 'TICKET_UPDATED': return { color: '#a21caf', bg: '#fdf4ff' };
    case 'TICKET_CLOSED': return { color: '#15803d', bg: '#dcfce7' };
    case 'WARRANTY_ALERT': return { color: '#c2410c', bg: '#ffedd5' };
    default: return { color: '#475569', bg: '#f1f5f9' };
  }
};

export default function MyAssets() {
  const [assets, setAssets] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    assetId: '', ticketType: 'REPAIR', priority: 'MEDIUM', subject: '', description: '', imageUrl: '',
  });

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedAssetHistory, setSelectedAssetHistory] = useState(null);
  const [history, setHistory] = useState([]);
  const [assetTickets, setAssetTickets] = useState([]);
  const [assetMaintenance, setAssetMaintenance] = useState([]);
  const [historyTab, setHistoryTab] = useState('lifecycle');
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchMyAssets = async () => {
    try {
      setLoading(true);
      const [assetsRes, ticketsRes] = await Promise.allSettled([
        employeeAPI.getMyAssets(),
        employeeAPI.getMyAssetTickets(),
      ]);
      setAssets(assetsRes.status === 'fulfilled' && Array.isArray(assetsRes.value?.data) ? assetsRes.value.data : []);
      setTickets(ticketsRes.status === 'fulfilled' && Array.isArray(ticketsRes.value?.data) ? ticketsRes.value.data : []);
    } catch (error) {
      console.error('Error fetching my assets:', error);
      setAssets([]);
      toast.error(error.response?.data?.message || 'Failed to load your assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyAssets();
  }, []);

  const openHistoryModal = async (asset) => {
    setSelectedAssetHistory(asset);
    setShowHistoryModal(true);
    setHistoryTab('lifecycle');
    setHistory([]);
    setAssetTickets([]);
    setAssetMaintenance([]);
    setLoadingHistory(true);
    try {
      const [historyRes, maintenanceRes] = await Promise.allSettled([
        employeeAPI.getAssetHistory(asset.id),
        employeeAPI.getAssetMaintenance(asset.id)
      ]);
      if (historyRes.status === 'fulfilled' && Array.isArray(historyRes.value?.data)) {
        setHistory(historyRes.value.data);
      }
      if (maintenanceRes.status === 'fulfilled' && Array.isArray(maintenanceRes.value?.data)) {
        setAssetMaintenance(maintenanceRes.value.data);
      }
      const filteredTickets = tickets.filter(t => t.assetId === asset.id || t.assetCode === asset.assetId);
      setAssetTickets(filteredTickets);
    } catch (err) {
      console.error('Failed to load asset details', err);
      toast.error('Failed to load history details');
    } finally {
      setLoadingHistory(false);
    }
  };

  const getTypeIcon = (type) => {
    const t = assetTypes.find((x) => x.value === type);
    return t ? t.icon : HardDrive;
  };

  const handleFileChange = async (e, setUrlCallback) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB limit');
      return;
    }

    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.pdf'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExtensions.includes(fileExt)) {
      toast.error('Unsupported file format. Only PDF, PNG, JPG, JPEG, WEBP are supported');
      return;
    }

    setUploadingFile(true);
    try {
      const res = await employeeAPI.uploadAssetFile(file);
      if (res.data?.url) {
        setUrlCallback(res.data.url);
        toast.success('File uploaded successfully');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'File upload failed');
    } finally {
      setUploadingFile(false);
    }
  };

  const openTicket = (asset) => {
    setTicketForm({
      assetId: asset?.id || '',
      ticketType: 'REPAIR',
      priority: 'MEDIUM',
      subject: asset ? `${asset.assetName} issue` : '',
      description: '',
      imageUrl: '',
    });
    setShowTicketModal(true);
  };

  const handleRaiseTicket = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await employeeAPI.raiseAssetTicket({
        ...ticketForm,
        assetId: Number(ticketForm.assetId),
        imageUrl: ticketForm.imageUrl || null,
      });
      toast.success('Ticket submitted');
      setShowTicketModal(false);
      fetchMyAssets();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to raise ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="main-content asset-page">
      <Header title="My Assets" subtitle="Equipment assigned to you" />

      <div className="page-content">
        <div className="asset-header-bar">
          <div>
            <h1>My Assets</h1>
            <p className="asset-subtitle">View assets and raise repair / damage / lost / replacement tickets</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="asset-cta" style={{ background: '#4f46e5' }} onClick={() => openTicket(null)} disabled={!assets.length}>
              <Ticket size={18} /> Raise ticket
            </button>
            <button type="button" className="asset-cta" onClick={fetchMyAssets} disabled={loading}>
              <RefreshCw size={18} />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="asset-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="asset-skeleton asset-skeleton-card" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div className="asset-empty">
            <div className="asset-empty-icon">
              <Package size={28} />
            </div>
            <h3>No assets assigned</h3>
            <p>You don’t have any assets assigned yet. Contact IT or Asset Management if you need equipment.</p>
          </div>
        ) : (
          <div className="asset-grid">
            {assets.map((asset) => {
              const TypeIcon = getTypeIcon(asset.assetType);
              const status = statusConfig[asset.status] || statusConfig.ASSIGNED;
              return (
                <div key={asset.id} className="asset-card">
                  <div className="asset-card-top">
                    <div className="asset-card-icon">
                      <TypeIcon size={24} />
                    </div>
                    <span className="asset-card-type-badge">{asset.assetType || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '16px', width: '100%', marginBottom: '12px', flexGrow: 1 }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <h3 className="asset-card-title">{asset.assetName || asset.assetId || 'Unnamed asset'}</h3>
                      <p className="asset-card-meta" style={{ margin: '2px 0 6px 0' }}>
                        {[asset.brand, asset.model].filter(Boolean).join(' · ') || asset.assetId || '—'}
                      </p>
                      <div className="asset-card-meta" style={{ fontSize: '0.85rem', marginTop: '4px', opacity: 0.9, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {[
                          asset.serialNumber && `Serial: ${asset.serialNumber}`,
                          asset.assignedDate && `Assigned: ${formatDate(asset.assignedDate)}`,
                          asset.location && `Location: ${asset.location}`,
                          asset.assignedBy && `Assigned By: ${asset.assignedBy}`
                        ]
                          .filter(Boolean)
                          .map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center' }}>
                              {idx > 0 ? `· ${item}` : item}
                            </div>
                          ))}
                      </div>
                      {asset.warrantyExpiry && (
                        <p className="asset-card-meta" style={{ marginTop: '8px', marginBottom: 0 }}>Warranty expiry: {formatDate(asset.warrantyExpiry)}</p>
                      )}
                      {asset.configuration && (
                        <p className="asset-card-meta" style={{ marginTop: '8px', marginBottom: 0 }}><strong>Configuration:</strong> {asset.configuration}</p>
                      )}
                      {asset.notes && (
                        <p className="asset-card-meta" style={{ marginTop: '4px', marginBottom: 0 }}><strong>Notes:</strong> {asset.notes}</p>
                      )}
                      {asset.imageUrl && asset.imageUrl.toLowerCase().endsWith('.pdf') && (
                        <div style={{ marginTop: '4px' }}>
                          <a href={asset.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 600, textDecoration: 'underline' }}>View PDF Doc</a>
                        </div>
                      )}
                    </div>
                    {asset.imageUrl && !asset.imageUrl.toLowerCase().endsWith('.pdf') && (
                      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '4px' }}>
                        <a href={asset.imageUrl} target="_blank" rel="noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
                          <img 
                            src={asset.imageUrl} 
                            alt="Asset preview" 
                            style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0', display: 'block', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} 
                          />
                        </a>
                        <a href={asset.imageUrl} target="_blank" rel="noreferrer" style={{ 
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: '8px', 
                          padding: '5px 10px', 
                          borderRadius: '6px', 
                          background: '#4f46e5', 
                          color: '#ffffff', 
                          fontSize: '11px', 
                          fontWeight: 600, 
                          textAlign: 'center',
                          border: 'none',
                          textDecoration: 'none',
                          boxShadow: '0 2px 4px rgba(79, 70, 229, 0.15)',
                          transition: 'background-color 0.2s'
                        }}>
                          View Image
                        </a>
                      </div>
                    )}
                  </div>
                  <span
                    className="asset-card-status"
                    style={{ background: status.bg, color: status.color }}
                  >
                    {status.label}
                  </span>
                  <div className="asset-card-actions" style={{ marginTop: 10, display: 'flex', gap: '8px' }}>
                    <button type="button" onClick={() => openTicket(asset)} style={{ flex: 1 }}>
                      <Ticket size={16} /> Report issue
                    </button>
                    <button type="button" onClick={() => openHistoryModal(asset)} style={{ flex: 1, backgroundColor: '#4b5563', color: '#ffffff' }}>
                      <History size={16} /> View History
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tickets.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <h3 style={{ marginBottom: 16, fontSize: '16px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>My tickets</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {tickets.map((t) => (
                <div key={t.id} className="asset-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                      {t.ticketNumber} · <span style={{ color: '#4f46e5' }}>{t.ticketType || 'REPAIR'}</span>
                    </span>
                    <span style={{ 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      color: t.status === 'OPEN' ? '#b45309' : t.status === 'IN_PROGRESS' ? '#1e40af' : '#15803d', 
                      background: t.status === 'OPEN' ? '#fef3c7' : t.status === 'IN_PROGRESS' ? '#dbeafe' : '#dcfce7', 
                      padding: '2px 8px', 
                      borderRadius: '999px',
                      textTransform: 'uppercase'
                    }}>
                      {t.status || 'OPEN'}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                    {t.subject}
                  </div>
                  {t.description && (
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {t.description}
                    </div>
                  )}
                  {t.imageUrl && (
                    <div style={{ marginTop: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Attachment: </span>
                      {t.imageUrl.toLowerCase().endsWith('.pdf') ? (
                        <a href={t.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#4f46e5', fontWeight: 600, textDecoration: 'underline' }}>View PDF</a>
                      ) : (
                        <a href={t.imageUrl} target="_blank" rel="noreferrer">
                          <img src={t.imageUrl} alt="Ticket attachment" style={{ maxWidth: '80px', maxHeight: '80px', borderRadius: '4px', border: '1px solid #e2e8f0', display: 'block', marginTop: '2px' }} />
                        </a>
                      )}
                    </div>
                  )}
                  {t.resolutionNotes && (
                    <div style={{ fontSize: '11px', color: '#15803d', background: '#dcfce7', padding: '6px 10px', borderRadius: '6px', marginTop: '6px' }}>
                      Resolution: <strong>{t.resolutionNotes}</strong>
                    </div>
                  )}
                  {t.resolutionImageUrl && (
                    <div style={{ marginTop: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#15803d' }}>Resolution Attachment: </span>
                      {t.resolutionImageUrl.toLowerCase().endsWith('.pdf') ? (
                        <a href={t.resolutionImageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#15803d', fontWeight: 600, textDecoration: 'underline' }}>View Resolution PDF</a>
                      ) : (
                        <a href={t.resolutionImageUrl} target="_blank" rel="noreferrer">
                          <img src={t.resolutionImageUrl} alt="Resolution attachment" style={{ maxWidth: '80px', maxHeight: '80px', borderRadius: '4px', border: '1px solid #e2e8f0', display: 'block', marginTop: '2px' }} />
                        </a>
                      )}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: '10px', marginTop: '4px' }}>
                    <span>Asset: <strong style={{ color: '#475569' }}>{t.assetName}</strong></span>
                    <span>Reported: <strong>{formatDate(t.reportedAt)}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showTicketModal && (
        <div className="asset-modal-overlay" onClick={() => !submitting && setShowTicketModal(false)}>
          <div className="asset-modal" onClick={(e) => e.stopPropagation()}>
            <div className="asset-modal-header"><h2>Raise asset ticket</h2></div>
            <div className="asset-modal-body">
              <form onSubmit={handleRaiseTicket}>
                <div className="asset-field">
                  <label>Asset *</label>
                  <select required value={ticketForm.assetId} onChange={(e) => setTicketForm({ ...ticketForm, assetId: e.target.value })}>
                    <option value="">Select asset</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>{a.assetName} ({a.assetId})</option>
                    ))}
                  </select>
                </div>
                <div className="asset-form-grid">
                  <div className="asset-field">
                    <label>Type *</label>
                    <select value={ticketForm.ticketType} onChange={(e) => setTicketForm({ ...ticketForm, ticketType: e.target.value })}>
                      {ticketTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="asset-field">
                    <label>Priority</label>
                    <select value={ticketForm.priority} onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}>
                      {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div className="asset-field">
                  <label>Subject *</label>
                  <input required value={ticketForm.subject} onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })} />
                </div>
                <div className="asset-field">
                  <label>Description</label>
                  <textarea value={ticketForm.description} onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })} />
                </div>
                <div className="asset-field" style={{ marginBottom: '16px' }}>
                  <label>Upload Support Photo / Invoice (Optional)</label>
                  <input 
                    type="file" 
                    accept="image/*,application/pdf" 
                    onChange={(e) => handleFileChange(e, (url) => setTicketForm(prev => ({ ...prev, imageUrl: url })))}
                    disabled={uploadingFile}
                  />
                  {uploadingFile && <p style={{ fontSize: '12px', color: '#6366f1', margin: '4px 0 0 0' }}>Uploading...</p>}
                  {ticketForm.imageUrl && (
                    <p style={{ fontSize: '12px', color: '#10b981', margin: '4px 0 0 0' }}>
                      ✓ Uploaded: <a href={ticketForm.imageUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>View file</a>
                    </p>
                  )}
                </div>
                <div className="asset-modal-actions">
                  <button type="button" className="asset-btn-secondary" onClick={() => setShowTicketModal(false)}>Cancel</button>
                  <button type="submit" className="asset-btn-primary" disabled={submitting || uploadingFile}>{submitting ? 'Submitting…' : 'Submit'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {showHistoryModal && selectedAssetHistory && (
        <div className="asset-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="asset-modal" style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div className="asset-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Asset History</h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                  {selectedAssetHistory.assetName} ({selectedAssetHistory.assetId || 'AST-N/A'})
                </p>
              </div>
              <button 
                onClick={() => setShowHistoryModal(false)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="asset-modal-tabs" style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '8px', width: 'fit-content', marginBottom: '16px', flexShrink: 0 }}>
              <button 
                onClick={() => setHistoryTab('lifecycle')} 
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: historyTab === 'lifecycle' ? '#fff' : 'transparent',
                  color: historyTab === 'lifecycle' ? '#0f172a' : '#475569',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Lifecycle & Assignments ({history.length})
              </button>
              <button 
                onClick={() => setHistoryTab('tickets')} 
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: historyTab === 'tickets' ? '#fff' : 'transparent',
                  color: historyTab === 'tickets' ? '#0f172a' : '#475569',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Repairs & Issues ({assetTickets.length})
              </button>
              <button 
                onClick={() => setHistoryTab('maintenance')} 
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: historyTab === 'maintenance' ? '#fff' : 'transparent',
                  color: historyTab === 'maintenance' ? '#0f172a' : '#475569',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Maintenance Logs ({assetMaintenance.length})
              </button>
            </div>

            <div className="asset-modal-body" style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', marginBottom: '20px' }}>
              {loadingHistory ? (
                <p style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>Loading history...</p>
              ) : historyTab === 'lifecycle' ? (
                history.length === 0 ? (
                  <p style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>No history recorded yet.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {history.map((h) => {
                      const badgeStyle = getEventTypeStyle(h.eventType);
                      return (
                        <div key={h.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <span style={{ 
                              fontSize: '11px', 
                              fontWeight: 700, 
                              color: badgeStyle.color, 
                              background: badgeStyle.bg, 
                              padding: '2px 8px', 
                              borderRadius: '999px',
                              textTransform: 'uppercase',
                              display: 'inline-block'
                            }}>
                              {formatEventType(h.eventType)}
                            </span>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                              {formatDate(h.createdAt)}
                            </span>
                          </div>
                          <div style={{ fontSize: '13px', color: '#334155', marginTop: '6px', fontWeight: 500 }}>
                            {h.notes || `${h.fromStatus || ''} → ${h.toStatus || ''}`}
                          </div>
                          <div className="asset-card-meta" style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                            Action by: <strong>{h.performedBy || 'System'}</strong>
                          </div>
                          {h.eventType === 'ASSIGNED' && h.toEmployeeName && (
                            <div className="asset-card-meta" style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', background: '#f8fafc', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
                              Assigned to: <strong>{h.toEmployeeName}</strong>
                            </div>
                          )}
                          {h.eventType === 'RETURNED' && h.fromEmployeeName && (
                            <div className="asset-card-meta" style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', background: '#f8fafc', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
                              Returned by: <strong>{h.fromEmployeeName}</strong>
                            </div>
                          )}
                          {h.eventType === 'TRANSFERRED' && (h.fromEmployeeName || h.toEmployeeName) && (
                            <div className="asset-card-meta" style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', background: '#f8fafc', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
                              Transfer: <strong>{h.fromEmployeeName || 'None'}</strong> → <strong>{h.toEmployeeName || 'None'}</strong>
                            </div>
                          )}
                          {h.imageUrl && (
                            <div style={{ marginTop: '8px' }}>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>Attachment: </span>
                              {h.imageUrl.toLowerCase().endsWith('.pdf') ? (
                                <a href={h.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#4f46e5', fontWeight: 600, textDecoration: 'underline' }}>View PDF</a>
                              ) : (
                                <a href={h.imageUrl} target="_blank" rel="noreferrer">
                                  <img src={h.imageUrl} alt="Event attachment" style={{ maxWidth: '100px', maxHeight: '100px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'block', marginTop: '4px' }} />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : historyTab === 'tickets' ? (
                assetTickets.length === 0 ? (
                  <p style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>No support tickets or repairs recorded.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {assetTickets.map((t) => (
                      <div key={t.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                            {t.ticketNumber} · <span style={{ color: '#4f46e5' }}>{t.ticketType || 'REPAIR'}</span>
                          </span>
                          <span style={{ 
                            fontSize: '11px', 
                            fontWeight: 700, 
                            color: t.status === 'OPEN' ? '#b45309' : t.status === 'IN_PROGRESS' ? '#1e40af' : '#15803d', 
                            background: t.status === 'OPEN' ? '#fef3c7' : t.status === 'IN_PROGRESS' ? '#dbeafe' : '#dcfce7', 
                            padding: '2px 8px', 
                            borderRadius: '999px',
                            textTransform: 'uppercase'
                          }}>{t.status}</span>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: '#334155', marginTop: '6px' }}>{t.subject}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{t.description}</div>
                        {t.imageUrl && (
                          <div style={{ marginTop: '6px' }}>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>Attachment: </span>
                            {t.imageUrl.toLowerCase().endsWith('.pdf') ? (
                              <a href={t.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 600, textDecoration: 'underline' }}>View PDF</a>
                            ) : (
                              <a href={t.imageUrl} target="_blank" rel="noreferrer">
                                <img src={t.imageUrl} alt="Ticket attachment" style={{ maxWidth: '80px', maxHeight: '80px', borderRadius: '4px', border: '1px solid #e2e8f0', display: 'block', marginTop: '2px' }} />
                              </a>
                            )}
                          </div>
                        )}
                        {t.resolutionNotes && (
                          <div style={{ fontSize: '11px', color: '#15803d', background: '#dcfce7', padding: '6px 10px', borderRadius: '6px', marginTop: '6px' }}>
                            Resolution: <strong>{t.resolutionNotes}</strong>
                          </div>
                        )}
                        {t.resolutionImageUrl && (
                          <div style={{ marginTop: '6px' }}>
                            <span style={{ fontSize: '11px', color: '#15803d' }}>Resolution Attachment: </span>
                            {t.resolutionImageUrl.toLowerCase().endsWith('.pdf') ? (
                              <a href={t.resolutionImageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#15803d', fontWeight: 600, textDecoration: 'underline' }}>View Resolution PDF</a>
                            ) : (
                              <a href={t.resolutionImageUrl} target="_blank" rel="noreferrer">
                                <img src={t.resolutionImageUrl} alt="Resolution attachment" style={{ maxWidth: '80px', maxHeight: '80px', borderRadius: '4px', border: '1px solid #e2e8f0', display: 'block', marginTop: '2px' }} />
                              </a>
                            )}
                          </div>
                        )}
                        <div className="asset-card-meta" style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                          Priority: <strong>{t.priority}</strong> · Raised: {formatDate(t.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                assetMaintenance.length === 0 ? (
                  <p style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>No maintenance history logged.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {assetMaintenance.map((m) => (
                      <div key={m.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                            {m.maintenanceType || 'GENERAL'}
                          </span>
                          <span style={{ fontSize: '12px', color: '#059669', background: '#d1fae5', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                            Cost: ₹{m.cost || '0.00'}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#334155', marginTop: '4px' }}>{m.description || 'No description provided.'}</div>
                        {m.outcomeNotes && (
                          <div style={{ fontSize: '11px', color: '#334155', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', marginTop: '6px' }}>
                            Outcome: <strong>{m.outcomeNotes}</strong>
                          </div>
                        )}
                        {m.imageUrl && (
                          <div style={{ marginTop: '8px' }}>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>Attachment: </span>
                            {m.imageUrl.toLowerCase().endsWith('.pdf') ? (
                              <a href={m.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#4f46e5', fontWeight: 600, textDecoration: 'underline' }}>View PDF</a>
                            ) : (
                              <a href={m.imageUrl} target="_blank" rel="noreferrer">
                                <img src={m.imageUrl} alt="Maintenance attachment" style={{ maxWidth: '100px', maxHeight: '100px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'block', marginTop: '4px' }} />
                              </a>
                            )}
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                          <span>Log added on: <strong>{formatDate(m.createdAt)}</strong></span>
                          {m.completedAt && <span>Completed: <strong>{formatDate(m.completedAt)}</strong></span>}
                        </div>
                        {m.vendor && (
                          <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                            Vendor: <strong>{m.vendor}</strong>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>

            <div className="asset-modal-footer" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
              <button 
                onClick={() => setShowHistoryModal(false)}
                style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#475569', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
