import { useState, useEffect } from 'react';
import { Home, Loader2, CheckCircle, XCircle, Clock, Filter, Eye, X } from 'lucide-react';
import { wfhAPI } from '../services/api';
import Header from '../components/Header';
import { toast } from 'react-hot-toast';

const TABS = [
  { id: 'pending', label: 'Pending', fetch: wfhAPI.getPending },
  { id: 'all', label: 'All', fetch: wfhAPI.getAll },
  { id: 'accepted', label: 'Accepted', fetch: wfhAPI.getAccepted },
  { id: 'rejected', label: 'Rejected', fetch: wfhAPI.getRejected },
  { id: 'cancelled', label: 'Cancelled', fetch: wfhAPI.getAll, filter: (data) => data.filter(w => String(w.status || '').toUpperCase() === 'CANCELLED') },
];

export default function AdminWfh() {
  const [activeTab, setActiveTab] = useState('pending');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState(null);
  const [responseModal, setResponseModal] = useState(null); // { id, action: 'APPROVED'|'REJECTED', response?: }
  const [viewModal, setViewModal] = useState(null); // Selected WFH request for view

  const fetchList = async () => {
    setLoading(true);
    const tab = TABS.find((t) => t.id === activeTab);
    try {
      const res = await (tab?.fetch || wfhAPI.getPending)();
      const data = Array.isArray(res?.data) ? res.data : (res?.data?.data ?? []);
      let filteredData = Array.isArray(data) ? data : [];
      if (tab?.filter) {
        filteredData = tab.filter(filteredData);
      }
      setList(filteredData);
    } catch (err) {
      console.error('Error fetching WFH:', err);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [activeTab]);

  const handleRespond = async () => {
    if (!responseModal?.id) return;
    setRespondingId(responseModal.id);
    try {
      await wfhAPI.respond(responseModal.id, {
        status: responseModal.action,
        response: responseModal.response || (responseModal.action === 'REJECTED' ? 'Rejected' : 'Approved'),
      });
      toast.success(responseModal.action === 'APPROVED' ? 'WFH request approved' : 'WFH request rejected');
      setResponseModal(null);
      fetchList();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to respond';
      toast.error(msg);
    } finally {
      setRespondingId(null);
    }
  };

  const statusBadge = (status) => {
    const s = (status || '').toUpperCase();
    if (s === 'APPROVED') return <span className="hr-status-badge approved">Approved</span>;
    if (s === 'REJECTED') return <span className="hr-status-badge rejected">Rejected</span>;
    if (s === 'CANCELLED' || s === 'CANCELED') {
      return (
        <span 
          className="hr-status-badge" 
          style={{ 
            backgroundColor: '#f1f5f9', 
            color: '#64748b', 
            border: '1px solid #cbd5e1',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 600
          }}
        >
          Cancelled
        </span>
      );
    }
    return <span className="hr-status-badge pending">Pending</span>;
  };

  const getActionByName = (row) => {
    const status = (row.status || '').toUpperCase();
    const managerStatus = (row.managerStatus || '').toUpperCase();

    if (status === 'CANCELLED' || status === 'CANCELED') {
      return row.adminResponse || 'Cancelled by employee';
    }

    if (status === 'APPROVED' || status === 'REJECTED') {
      if (row.adminName) return row.adminName;
      if (managerStatus !== 'PENDING') return row.managerName || '-';
    }

    if (status === 'PENDING' && managerStatus === 'APPROVED') {
      return row.managerName || 'Manager Approved';
    }

    return '-';
  };

  return (
    <div className="main-content">
      <Header title="Work From Home" subtitle="Review and approve WFH requests" />
      <div className="page-content">
        <div className="hr-main-tabs" style={{ marginBottom: '24px' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`hr-main-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-container">
            <Loader2 className="animate-spin" size={32} />
            <p>Loading...</p>
          </div>
        ) : list.length === 0 ? (
          <div className="hr-empty-history" style={{ padding: '2rem', textAlign: 'center' }}>
            <Home size={48} style={{ color: 'var(--gray-400)' }} />
            <p>No WFH requests in this list.</p>
          </div>
        ) : (
          <div className="hr-history-table-container">
            <table className="hr-history-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Action By</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 500 }}>{row.employeeName || row.employeeId || '-'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{row.employeeId}</div>
                      </div>
                    </td>
                    <td>{row.department || '-'}</td>
                    <td>{row.startDate ? new Date(row.startDate).toLocaleDateString() : '-'}</td>
                    <td>{row.endDate ? new Date(row.endDate).toLocaleDateString() : '-'}</td>
                    <td>{row.totalDays || '-'}</td>
                    <td>{row.reason || '-'}</td>
                    <td>{statusBadge(row.status)}</td>
                    <td style={{ fontSize: '12px', color: 'var(--dark-500)', fontWeight: '500' }}>
                      {getActionByName(row)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => setViewModal(row)}
                          title="View Details"
                        >
                          <Eye size={14} /> View
                        </button>
                        {activeTab === 'pending' && (
                          <>
                            <button
                              type="button"
                              className="btn-primary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '12px' }}
                              onClick={() => setResponseModal({ id: row.id, action: 'APPROVED' })}
                              disabled={respondingId !== null}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ 
                                padding: '0.25rem 0.5rem', 
                                fontSize: '12px',
                                border: '1px solid var(--error)',
                                color: 'var(--error)'
                              }}
                              onClick={() => setResponseModal({ id: row.id, action: 'REJECTED' })}
                              disabled={respondingId !== null}
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Details Modal */}
      {viewModal && (
        <div className="hr-modal-overlay" onClick={() => setViewModal(null)}>
          <div className="hr-modal" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="hr-modal-header">
              <h2>WFH Request Details</h2>
              <button className="hr-modal-close" onClick={() => setViewModal(null)}><X size={20} /></button>
            </div>
            <div className="hr-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--gray-500)', marginBottom: '4px' }}>Employee</label>
                  <p style={{ fontWeight: 500 }}>{viewModal.employeeName}</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--gray-500)', marginBottom: '4px' }}>Department</label>
                  <p style={{ fontWeight: 500 }}>{viewModal.department || '-'}</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--gray-500)', marginBottom: '4px' }}>Start Date</label>
                  <p style={{ fontWeight: 500 }}>{new Date(viewModal.startDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--gray-500)', marginBottom: '4px' }}>End Date</label>
                  <p style={{ fontWeight: 500 }}>{new Date(viewModal.endDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--gray-500)', marginBottom: '4px' }}>Status</label>
                  <div>{statusBadge(viewModal.status)}</div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--gray-500)', marginBottom: '4px' }}>Duration</label>
                  <p style={{ fontWeight: 500 }}>{viewModal.totalDays || '-'} Days</p>
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--gray-500)', marginBottom: '4px' }}>Reason</label>
                <div style={{ 
                  background: 'var(--gray-50)', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  fontSize: '13px',
                  color: 'var(--dark-500)',
                  border: '1px solid var(--gray-100)'
                }}>
                  {viewModal.reason || 'No reason provided'}
                </div>
              </div>
              {(viewModal.adminResponse || viewModal.managerResponse) && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--gray-500)', marginBottom: '4px' }}>Response Comment</label>
                  <p style={{ fontStyle: 'italic', fontSize: '13px' }}>{viewModal.adminResponse || viewModal.managerResponse}</p>
                </div>
              )}
              {getActionByName(viewModal) && getActionByName(viewModal) !== '-' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--gray-500)', marginBottom: '4px' }}>Action By</label>
                  <p style={{ fontWeight: 500 }}>{getActionByName(viewModal)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {responseModal && (
        <div className="hr-modal-overlay" onClick={() => !respondingId && setResponseModal(null)}>
          <div className="hr-modal" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className="hr-modal-header">
              <h2>{responseModal.action === 'APPROVED' ? 'Approve' : 'Reject'} WFH Request</h2>
              <button className="hr-modal-close" onClick={() => setResponseModal(null)} disabled={respondingId}><X size={20} /></button>
            </div>
            <div className="hr-modal-body">
              {responseModal.action === 'REJECTED' && (
                <div className="hr-form-group">
                  <label>Reason (optional)</label>
                  <textarea
                    value={responseModal.response || ''}
                    onChange={(e) => setResponseModal((r) => ({ ...r, response: e.target.value }))}
                    placeholder="Reason for rejection"
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid var(--gray-200)',
                      fontSize: '13px'
                    }}
                  />
                </div>
              )}
              {responseModal.action === 'APPROVED' && (
                <p style={{ marginBottom: '16px', fontSize: '14px' }}>Are you sure you want to approve this request?</p>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="hr-btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={() => setResponseModal(null)} disabled={respondingId}>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className={responseModal.action === 'APPROVED' ? 'btn-primary' : 'btn-secondary'} 
                  style={{ 
                    padding: '0.5rem 1rem',
                    backgroundColor: responseModal.action === 'REJECTED' ? 'var(--error)' : '',
                    color: responseModal.action === 'REJECTED' ? 'white' : '',
                    border: 'none'
                  }} 
                  onClick={handleRespond} 
                  disabled={respondingId}
                >
                  {respondingId ? 'Processing...' : responseModal.action === 'APPROVED' ? 'Approve' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
