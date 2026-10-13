import { useState, useEffect } from 'react';
import { Home, CheckCircle, XCircle, Clock, Eye, X, Users, Calendar, TrendingUp, Search, ClipboardList, Check, GitCommit } from 'lucide-react';
import { wfhAPI } from '../services/api';
import Header from '../components/Header';
import { toast } from 'react-hot-toast';
import './Leaves.css';
import './Wfh.css';

const TABS = [
  { id: 'pending', label: 'Pending', fetch: wfhAPI.getManagerPending },
  { id: 'all', label: 'All', fetch: (params) => wfhAPI.getManagerHistory({ ...params, size: 1000 }) },
  { id: 'accepted', label: 'Accepted', fetch: (params) => wfhAPI.getManagerHistory({ ...params, status: 'APPROVED', size: 1000 }) },
  { id: 'rejected', label: 'Rejected', fetch: (params) => wfhAPI.getManagerHistory({ ...params, status: 'REJECTED', size: 1000 }) },
  { id: 'cancelled', label: 'Cancelled', fetch: (params) => wfhAPI.getManagerHistory({ ...params, status: 'CANCELLED', size: 1000 }) },
];

export default function ManagerWfh() {
  const [activeTab, setActiveTab] = useState('pending');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState(null);
  const [responseModal, setResponseModal] = useState(null); // { id, action: 'APPROVED'|'REJECTED', response?: }
  const [viewModal, setViewModal] = useState(null); // Selected WFH request for view
  const [searchTerm, setSearchTerm] = useState('');
  
  // Analytics State
  const [analytics, setAnalytics] = useState({
    totalRequests: 0,
    approvedDays: 0,
    pendingRequests: 0,
    topUsers: [],
    statusCounts: { approved: 0, rejected: 0, cancelled: 0, pending: 0 }
  });

  const fetchList = async () => {
    setLoading(true);
    const tab = TABS.find((t) => t.id === activeTab);
    try {
      const res = await (tab?.fetch || wfhAPI.getManagerPending)();
      let rawData = [];
      if (res?.data) {
        if (Array.isArray(res.data)) {
          rawData = res.data;
        } else if (Array.isArray(res.data.content)) {
          rawData = res.data.content;
        } else if (res.data.requests && Array.isArray(res.data.requests)) {
          rawData = res.data.requests;
        }
      } else if (Array.isArray(res)) {
        rawData = res;
      }
      setList(Array.isArray(rawData) ? rawData : []);
    } catch (err) {
      console.error('Error fetching Manager WFH:', err);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      // Load all manager WFH history to build local analytics
      const historyRes = await wfhAPI.getManagerHistory({ size: 1000 });
      const pendingRes = await wfhAPI.getManagerPending();

      let historyData = [];
      if (historyRes?.data) {
        historyData = Array.isArray(historyRes.data) 
          ? historyRes.data 
          : (Array.isArray(historyRes.data.content) ? historyRes.data.content : []);
      }

      let pendingData = [];
      if (pendingRes?.data) {
        pendingData = Array.isArray(pendingRes.data) 
          ? pendingRes.data 
          : (Array.isArray(pendingRes.data.requests) ? pendingRes.data.requests : []);
      }

      // Combine for full stats
      const allRequests = [...historyData, ...pendingData];
      
      const counts = { approved: 0, rejected: 0, cancelled: 0, pending: pendingData.length };
      let approvedDays = 0;
      const userWfhMap = {};

      historyData.forEach(req => {
        const status = (req.status || '').toUpperCase();
        const days = Number(req.totalDays) || 0;
        const empName = req.employeeName || req.employeeCode || 'Employee';

        if (status === 'APPROVED') {
          counts.approved++;
          approvedDays += days;
          userWfhMap[empName] = (userWfhMap[empName] || 0) + days;
        } else if (status === 'REJECTED') {
          counts.rejected++;
        } else if (status === 'CANCELLED' || status === 'CANCELED') {
          counts.cancelled++;
        }
      });

      const topUsers = Object.entries(userWfhMap)
        .map(([name, days]) => ({ name, days }))
        .sort((a, b) => b.days - a.days)
        .slice(0, 3);

      setAnalytics({
        totalRequests: allRequests.length,
        approvedDays,
        pendingRequests: pendingData.length,
        topUsers,
        statusCounts: counts
      });
    } catch (error) {
      console.error('Failed to compute analytics:', error);
    }
  };

  useEffect(() => {
    fetchList();
    fetchAnalytics();
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
      fetchAnalytics();
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

  const filteredList = list.filter((row) => {
    const name = (row.employeeName || row.employeeId || '').toLowerCase();
    const dept = (row.department || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    return name.includes(search) || dept.includes(search);
  });

  const renderTimelineAndApprovalSteps = (req) => {
    if (!req) return null;

    const formatTimestamp = (ts) => {
      if (!ts) return '';
      try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      } catch (e) {
        return '';
      }
    };

    const status = (req.status || '').toUpperCase();
    const rawManagerStatus = (req.managerStatus || '').toUpperCase();
    const appliedTime = formatTimestamp(req.createdAt || req.appliedAt) || 'Submitted';
    
    // Response timestamps
    const managerTime = formatTimestamp(req.managerResponseDate);
    const adminTime = formatTimestamp(req.adminResponseDate);

    const hasAdminActor = Boolean(req.adminName || req.adminResponse || req.adminId);

    // Robust Manager Status determination (with fallback for legacy records)
    let isManagerApproved = rawManagerStatus === 'APPROVED';
    let isManagerRejected = rawManagerStatus === 'REJECTED';
    let isManagerSkipped = rawManagerStatus === 'SKIPPED';

    if (status === 'APPROVED' && !hasAdminActor && !isManagerApproved && !isManagerSkipped) {
      isManagerApproved = true;
    }
    if (status === 'REJECTED' && !hasAdminActor && !isManagerRejected && !isManagerSkipped) {
      isManagerRejected = true;
    }

    // Robust Admin / HR Status determination moved further down
    // Approval Steps calculation
    const steps = [
      { title: 'Employee Submission', sub: req.employeeName || 'Employee', time: appliedTime, state: 'done' }
    ];

    // Step 2: Manager Step (Omitted if skipped, as per user request to show 2-step workflow)
    if (!isManagerSkipped) {
      let mState = 'pending';
      if (isManagerApproved) {
        mState = 'done';
      } else if (isManagerRejected) {
        mState = 'rejected';
      }
      steps.push({
        title: 'Manager Approval',
        sub: req.managerName || getActionByName(req) || 'Reporting Manager',
        time: managerTime || (isManagerApproved ? (formatTimestamp(req.updatedAt) || 'Approved') : isManagerRejected ? (formatTimestamp(req.updatedAt) || 'Rejected') : 'Pending'),
        state: mState
      });
    }

    // Robust Admin / HR Status determination
    const isAdminApproved = (status === 'APPROVED' && hasAdminActor) || (status === 'APPROVED' && rawManagerStatus === 'APPROVED' && adminTime !== '');
    const isAdminRejected = (status === 'REJECTED' && hasAdminActor) || (status === 'REJECTED' && rawManagerStatus === 'APPROVED' && adminTime !== '');
    
    // Dynamic determination of whether the 3rd step (HR) is part of this workflow
    const isHrStepNeeded = hasAdminActor || 
                           (rawManagerStatus === 'APPROVED' && status === 'PENDING') || 
                           (rawManagerStatus === 'SKIPPED' && status === 'PENDING') || 
                           isAdminApproved || isAdminRejected;

    // Step 3: HR / Admin Step (Only rendered if HR / Admin is part of the workflow)
    if (isHrStepNeeded) {
      let hState = 'pending';
      if (isAdminApproved) {
        hState = 'done';
      } else if (isAdminRejected) {
        hState = 'rejected';
      } else if (status === 'CANCELLED' || status === 'CANCELED') {
        hState = 'cancelled';
      } else if (isManagerRejected) {
        hState = 'skipped';
      }

      steps.push({
        title: 'HR / Admin Final Decision',
        sub: req.adminName || 'HR Administrator',
        time: adminTime || (isAdminApproved || isAdminRejected ? (formatTimestamp(req.updatedAt) || 'Completed') : isManagerRejected ? 'Skipped' : 'Pending'),
        state: hState
      });
    }

    // Audit Timeline Nodes
    const timelineNodes = [
      {
        title: 'Request Created',
        sub: `By ${req.employeeName || 'Employee'} · ${appliedTime}`,
        color: '#3b82f6'
      }
    ];

    if (isManagerApproved) {
      timelineNodes.push({
        title: 'Manager Approved',
        sub: `By ${req.managerName || getActionByName(req) || 'Reporting Manager'} · ${managerTime || formatTimestamp(req.updatedAt) || appliedTime}`,
        color: '#10b981'
      });
    } else if (isManagerRejected) {
      timelineNodes.push({
        title: 'Manager Rejected',
        sub: `By ${req.managerName || getActionByName(req) || 'Reporting Manager'} · ${managerTime || formatTimestamp(req.updatedAt) || appliedTime}`,
        color: '#ef4444'
      });
    } else if (isManagerSkipped) {
      timelineNodes.push({
        title: 'Manager Review Skipped',
        sub: 'No reporting manager assigned',
        color: '#64748b'
      });
    } else if (status === 'PENDING' && !isHrStepNeeded) {
      timelineNodes.push({
        title: 'Awaiting Manager Approval',
        sub: `Assigned to ${req.managerName || 'Reporting Manager'}`,
        color: '#f59e0b'
      });
    }

    if (isHrStepNeeded) {
      if (isAdminApproved) {
        timelineNodes.push({
          title: 'HR / Admin Approved',
          sub: `By ${req.adminName || getActionByName(req) || 'HR Administrator'} · ${adminTime || formatTimestamp(req.updatedAt) || appliedTime}`,
          color: '#10b981'
        });
      } else if (isAdminRejected) {
        timelineNodes.push({
          title: 'HR / Admin Rejected',
          sub: `By ${req.adminName || getActionByName(req) || 'HR Administrator'} · ${adminTime || formatTimestamp(req.updatedAt) || appliedTime}`,
          color: '#ef4444'
        });
      } else if (status === 'PENDING' && isManagerApproved) {
        timelineNodes.push({
          title: 'Awaiting HR / Admin Approval',
          sub: 'Escalated to HR/Admin for final decision',
          color: '#f59e0b'
        });
      }
    }

    if (status === 'CANCELLED' || status === 'CANCELED') {
      timelineNodes.push({
        title: 'Request Cancelled',
        sub: `Cancelled by employee ${formatTimestamp(req.updatedAt) ? '· ' + formatTimestamp(req.updatedAt) : ''}`,
        color: '#64748b'
      });
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Workflow Approval Steps */}
        <div>
          <h4 style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>
            Approval Process Steps ({steps.length}-Step Workflow)
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {steps.map((st, i) => {
              const iconColor = st.state === 'done' ? '#10b981' : st.state === 'rejected' ? '#ef4444' : st.state === 'cancelled' || st.state === 'skipped' ? '#64748b' : '#f59e0b';
              const bgColor = st.state === 'done' ? '#dcfce7' : st.state === 'rejected' ? '#fee2e2' : st.state === 'cancelled' || st.state === 'skipped' ? '#f1f5f9' : '#fef3c7';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: bgColor, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, fontSize: '11px' }}>
                    {st.state === 'done' ? '✓' : st.state === 'rejected' ? '✕' : st.state === 'cancelled' || st.state === 'skipped' ? '—' : (i + 1)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{st.title}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.sub}</div>
                  </div>
                  <div style={{ fontSize: '10px', color: st.time === 'Pending' ? '#d97706' : '#94a3b8', textAlign: 'right', flexShrink: 0, fontWeight: st.time === 'Pending' ? 600 : 400 }}>{st.time}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Vertical Audit Timeline */}
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          <h4 style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '14px', letterSpacing: '0.05em' }}>
            Audit Timeline
          </h4>
          <div style={{ position: 'relative', paddingLeft: '24px', paddingTop: '4px' }}>
            <div style={{ position: 'absolute', left: '11px', top: '10px', bottom: '16px', width: '2px', backgroundColor: '#cbd5e1' }} />

            {timelineNodes.map((node, idx) => (
              <div key={idx} style={{ position: 'relative', marginBottom: idx === timelineNodes.length - 1 ? 0 : '18px' }}>
                <div style={{ 
                  position: 'absolute', 
                  left: '-18px', 
                  top: '3px', 
                  width: '12px', 
                  height: '12px', 
                  borderRadius: '50%', 
                  backgroundColor: node.color, 
                  border: '2px solid #ffffff', 
                  boxShadow: `0 0 0 2px ${node.color}33`,
                  boxSizing: 'border-box'
                }} />
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', lineHeight: 1.3 }}>{node.title}</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{node.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="main-content wfh-page">
      <Header title="Team Work From Home" subtitle="Monitor and manage WFH requests for your team" />
      <div className="page-content">
        
        {/* WFH Team Analytics Dashboard */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
          
          <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', margin: 0 }}>
            <div style={{ padding: '12px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb' }}>
              <Users size={22} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--gray-500)', fontWeight: 500 }}>Team Approved Days</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{analytics.approvedDays} Days</div>
              <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '2px' }}>This month total</div>
            </div>
          </div>

          <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', margin: 0 }}>
            <div style={{ padding: '12px', borderRadius: '12px', background: '#fef3c7', color: '#d97706' }}>
              <Clock size={22} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--gray-500)', fontWeight: 500 }}>Pending Approvals</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{analytics.pendingRequests} Requests</div>
              <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '2px' }}>Attention required</div>
            </div>
          </div>

          <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', margin: 0 }}>
            <div style={{ padding: '12px', borderRadius: '12px', background: '#f3e8ff', color: '#7c3aed' }}>
              <TrendingUp size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', color: 'var(--gray-500)', fontWeight: 500 }}>Top WFH Requestors</div>
              <div style={{ marginTop: '4px' }}>
                {analytics.topUsers.length === 0 ? (
                  <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>No approved requests</span>
                ) : (
                  analytics.topUsers.map((u, i) => (
                    <div key={i} style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>
                      {u.name} ({u.days} days)
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', margin: 0 }}>
            <div style={{ fontSize: '12px', color: 'var(--gray-500)', fontWeight: 500, marginBottom: '8px' }}>WFH Status Distribution</div>
            <div style={{ display: 'flex', gap: '4px', height: '8px', borderRadius: '4px', overflow: 'hidden', background: '#f1f5f9' }}>
              {analytics.totalRequests === 0 ? (
                <div style={{ width: '100%', background: '#cbd5e1' }} />
              ) : (
                <>
                  <div style={{ width: `${(analytics.statusCounts.approved / analytics.totalRequests) * 100}%`, background: '#10b981' }} title="Approved" />
                  <div style={{ width: `${(analytics.statusCounts.pending / analytics.totalRequests) * 100}%`, background: '#f59e0b' }} title="Pending" />
                  <div style={{ width: `${(analytics.statusCounts.rejected / analytics.totalRequests) * 100}%`, background: '#ef4444' }} title="Rejected" />
                  <div style={{ width: `${(analytics.statusCounts.cancelled / analytics.totalRequests) * 100}%`, background: '#94a3b8' }} title="Cancelled" />
                </>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--gray-400)', marginTop: '8px', fontWeight: 600 }}>
              <span>🟢 {analytics.statusCounts.approved} App</span>
              <span>🟡 {analytics.statusCounts.pending} Pend</span>
              <span>🔴 {analytics.statusCounts.rejected} Rej</span>
            </div>
          </div>

        </div>

        {/* Requests Card Container */}
        <div className="card" style={{ margin: 0, padding: '20px' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', padding: 0, border: 'none', background: 'transparent', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                <ClipboardList size={18} color="var(--lv-primary)" />
                Team WFH requests
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--lv-text-muted)', fontWeight: 600, background: '#f1f5f9', padding: '2px 10px', borderRadius: '999px' }}>
                {filteredList.length} record(s)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div className="hr-main-tabs" style={{ margin: 0 }}>
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

              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#9ca3af' }} />
                <input
                  type="text"
                  className="to-input"
                  style={{ width: '100%', padding: '6px 10px 6px 30px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  placeholder="Search member or dept..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="lv-table-wrap">
              <table className="lv-table">
                <thead>
                  <tr>
                    <th style={{ width: '18%' }}>Employee</th>
                    <th style={{ width: '12%' }}>Department</th>
                    <th style={{ width: '10%' }}>From</th>
                    <th style={{ width: '10%' }}>To</th>
                    <th style={{ width: '6%' }}>Days</th>
                    <th style={{ width: '22%' }}>Reason</th>
                    <th style={{ width: '10%' }}>Status</th>
                    <th style={{ width: '10%' }}>Action By</th>
                    <th style={{ width: '12%', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5].map(i => (
                    <tr key={i}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(j => (
                        <td key={j}><div className="nt-skeleton" style={{ width: '80%', height: '12px', borderRadius: '4px' }} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="lv-empty-history" style={{ padding: '40px 20px', textAlign: 'center' }}>
              <Home size={40} style={{ color: 'var(--gray-400)', marginBottom: '12px', opacity: 0.5 }} />
              <h4 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 600, color: '#334155' }}>No WFH requests found</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>No requests match the selected status tab or search filter.</p>
            </div>
          ) : (
            <div className="lv-table-wrap">
              <table className="lv-table">
                <thead>
                  <tr>
                    <th style={{ width: '18%' }}>Employee</th>
                    <th style={{ width: '12%' }}>Department</th>
                    <th style={{ width: '10%' }}>From</th>
                    <th style={{ width: '10%' }}>To</th>
                    <th style={{ width: '6%' }}>Days</th>
                    <th style={{ width: '22%' }}>Reason</th>
                    <th style={{ width: '10%' }}>Status</th>
                    <th style={{ width: '10%' }}>Action By</th>
                    <th style={{ width: '12%', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((row) => (
                    <tr key={row.requestId || row.id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>{row.employeeName || row.employeeCode || '—'}</span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>{row.employeeCode || row.employeeId || '—'}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: '12px', color: '#475569' }}>{row.department || '—'}</td>
                      <td style={{ fontWeight: 600, fontSize: '12px' }}>
                        {row.startDate ? new Date(row.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ fontWeight: 600, fontSize: '12px' }}>
                        {row.endDate ? new Date(row.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ fontSize: '13px', fontWeight: 600 }}>{row.totalDays || 1}</td>
                      <td className="lv-cell-reason">
                        <span style={{ 
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'normal',
                          lineHeight: '1.4'
                        }}>
                          {row.reason || '—'}
                        </span>
                      </td>
                      <td>{statusBadge(row.status)}</td>
                      <td style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                        {getActionByName(row)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="lv-btn-outline"
                            style={{ height: '28px', padding: '0 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '6px' }}
                            onClick={() => setViewModal(row)}
                            title="View Details"
                          >
                            <Eye size={12} /> View
                          </button>
                          {activeTab === 'pending' && (
                            <>
                              <button
                                type="button"
                                className="hr-btn-primary"
                                style={{ height: '28px', padding: '0 8px', fontSize: '11px', borderRadius: '6px' }}
                                onClick={() => setResponseModal({ id: row.requestId || row.id, action: 'APPROVED' })}
                                disabled={respondingId !== null}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="lv-btn-cancel"
                                style={{ height: '28px', padding: '0 8px', fontSize: '11px', borderColor: '#ef4444', color: '#ef4444', borderRadius: '6px' }}
                                onClick={() => setResponseModal({ id: row.requestId || row.id, action: 'REJECTED' })}
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
      </div>

      {/* View Details Side Panel Drawer with Timeline & Approval Steps */}
      {viewModal && (
        <div 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(15, 23, 42, 0.45)', 
            backdropFilter: 'blur(4px)', 
            zIndex: 1100, 
            display: 'flex', 
            justifyContent: 'flex-end', 
            animation: 'mwfhFadeIn 0.2s ease-out' 
          }} 
          onClick={() => setViewModal(null)}
        >
          <style>{`
            @keyframes mwfhSlideLeft {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
            @keyframes mwfhFadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}</style>
          <div 
            style={{ 
              width: '100%', 
              maxWidth: '540px', 
              height: '100vh', 
              backgroundColor: '#ffffff', 
              boxShadow: '-8px 0 30px rgba(0, 0, 0, 0.15)', 
              display: 'flex', 
              flexDirection: 'column', 
              animation: 'mwfhSlideLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1)', 
              overflow: 'hidden' 
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Side Drawer Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '15px', boxShadow: '0 3px 10px rgba(79, 70, 229, 0.25)' }}>
                  {(viewModal.employeeName || 'EM').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>{viewModal.employeeName || 'Employee Request'}</h2>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{viewModal.employeeCode || viewModal.employeeId || '—'} · {viewModal.department || 'IT'}</span>
                </div>
              </div>
              <button 
                type="button"
                style={{ border: 'none', background: '#e2e8f0', color: '#475569', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s ease' }} 
                onClick={() => setViewModal(null)}
                title="Close drawer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Side Drawer Body - Vertical Scroll */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Key Details Grid */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>Start Date</label>
                  <span style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>
                    {viewModal.startDate ? new Date(viewModal.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>End Date</label>
                  <span style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>
                    {viewModal.endDate ? new Date(viewModal.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>Duration</label>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#4f46e5' }}>{viewModal.totalDays || 1} Day(s)</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>Status</label>
                  <div>{statusBadge(viewModal.status)}</div>
                </div>
              </div>

              {/* Reason for WFH */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Reason for WFH</label>
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', fontSize: '13px', color: '#334155', border: '1px solid #e2e8f0', lineHeight: 1.5 }}>
                  {viewModal.reason || 'No reason provided'}
                </div>
              </div>

              {/* Decision Comment */}
              {(viewModal.response || viewModal.managerComment || viewModal.adminResponse || viewModal.managerResponse || (viewModal.managerStatus || '').toUpperCase() === 'SKIPPED') && (() => {
                let commentText = viewModal.response || viewModal.managerComment || viewModal.adminResponse || viewModal.managerResponse || '';
                if ((viewModal.managerStatus || '').toUpperCase() === 'SKIPPED') {
                  commentText = commentText ? `[Manager Skipped] ${commentText}` : 'Manager Skipped';
                }
                return (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: (viewModal.status || '').toUpperCase() === 'REJECTED' ? '#991b1b' : '#166534', marginBottom: '6px' }}>
                      {(viewModal.status || '').toUpperCase() === 'PENDING' ? 'Approval Note' : 'Decision Comment'}
                    </label>
                    <div style={{ 
                      background: (viewModal.status || '').toUpperCase() === 'REJECTED' ? '#fef2f2' : '#f0fdf4', 
                      padding: '12px 14px', 
                      borderRadius: '10px', 
                      fontSize: '13px', 
                      color: (viewModal.status || '').toUpperCase() === 'REJECTED' ? '#991b1b' : '#166534', 
                      border: `1px solid ${(viewModal.status || '').toUpperCase() === 'REJECTED' ? '#fecaca' : '#bbf7d0'}`, 
                      fontStyle: 'italic' 
                    }}>
                      "{commentText}"
                    </div>
                  </div>
                );
              })()}

              {/* Action By */}
              {getActionByName(viewModal) && getActionByName(viewModal) !== '-' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f1f5f9', borderRadius: '8px', fontSize: '12px' }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>Handled By:</span>
                  <strong style={{ color: '#0f172a' }}>{getActionByName(viewModal)}</strong>
                </div>
              )}

              {/* Approval Steps & Timeline */}
              <div style={{ marginTop: '4px' }}>
                {renderTimelineAndApprovalSteps(viewModal)}
              </div>
            </div>

            {/* Side Drawer Footer Actions (if pending) */}
            {activeTab === 'pending' && (
              <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="lv-btn-cancel"
                  style={{ height: '36px', padding: '0 16px', fontSize: '12px', borderColor: '#ef4444', color: '#ef4444', borderRadius: '8px', fontWeight: 600 }}
                  onClick={() => {
                    const row = viewModal;
                    setViewModal(null);
                    setResponseModal({ id: row.requestId || row.id, action: 'REJECTED' });
                  }}
                  disabled={respondingId !== null}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="hr-btn-primary"
                  style={{ height: '36px', padding: '0 16px', fontSize: '12px', borderRadius: '8px', fontWeight: 600 }}
                  onClick={() => {
                    const row = viewModal;
                    setViewModal(null);
                    setResponseModal({ id: row.requestId || row.id, action: 'APPROVED' });
                  }}
                  disabled={respondingId !== null}
                >
                  Approve
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approve/Reject Response Dialog */}
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
                  className={responseModal.action === 'APPROVED' ? 'hr-btn-primary' : 'hr-btn-secondary'} 
                  style={{ 
                    padding: '0.5rem 1rem',
                    backgroundColor: responseModal.action === 'APPROVED' ? 'var(--primary)' : 'var(--error)',
                    color: '#fff',
                    border: 'none'
                  }}
                  onClick={handleRespond} 
                  disabled={respondingId}
                >
                  {respondingId ? 'Responding...' : responseModal.action === 'APPROVED' ? 'Approve' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
