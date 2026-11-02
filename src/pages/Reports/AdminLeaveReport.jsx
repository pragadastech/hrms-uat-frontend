import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  Calendar, 
  RefreshCw, 
  Download, 
  FileText
} from 'lucide-react';
import { reportingAPI, leaveBalanceAPI } from '../../services/api';
import toast from 'react-hot-toast';
import Header from '../../components/Header';
import {
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';

const COLORS_PALETTE = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

const formatDate = (d) => {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const AdminLeaveReport = () => {
  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [serverStats, setServerStats] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const startDateRef = useRef(null);
  const endDateRef = useRef(null);
  const [filters, setFilters] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    return {
      startDate: fmt(start),
      endDate: fmt(end),
      status: '' // ALL
    };
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [leavesRes, balancesRes] = await Promise.all([
        reportingAPI.getEmployeeWiseLeaveReport(filters),
        reportingAPI.getLeaveBalanceReport()
      ]);
      
      const leavesData = leavesRes.data;
      setLeaves(leavesData?.data || []);
      setBalances(balancesRes.data?.data || []);
      
      // Store analytics metadata from server
      setServerStats({
        statusCounts: leavesData?.statusCounts || {},
        totalDays: leavesData?.totalDays || 0,
        onLeaveTodayCount: leavesData?.onLeaveTodayCount || 0
      });
    } catch (error) {
      console.error('Error fetching leave intelligence:', error);
      toast.error('Failed to fetch leave intelligence');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters.startDate, filters.endDate, filters.status]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    
    // Use server-side stats if available, otherwise calculate locally
    const totalDays = serverStats ? serverStats.totalDays : leaves.reduce((acc, l) => acc + (l.totalDays || 0), 0);
    const pendingCount = serverStats?.statusCounts?.PENDING || leaves.filter(l => l.status === 'PENDING').length;
    const approvedCount = serverStats?.statusCounts?.APPROVED || leaves.filter(l => l.status === 'APPROVED').length;
    const onLeaveToday = serverStats ? serverStats.onLeaveTodayCount : leaves.filter(l => 
      l.status === 'APPROVED' && 
      today >= l.startDate && 
      today <= l.endDate
    ).length;

    // Filter by search (Local UI filter)
    const filtered = leaves.filter(l => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (
        l.employeeName?.toLowerCase().includes(s) ||
        l.employeeId?.toLowerCase().includes(s) ||
        l.leaveTypeName?.toLowerCase().includes(s) ||
        l.reason?.toLowerCase().includes(s)
      );
    });

    // Group ALL leave type balances by employee from the balance report
    const balanceMap = balances.reduce((acc, emp) => {
      const eid = String(emp.employeeId || emp.employeeIdString || '').toUpperCase();
      if (!acc[eid]) {
        acc[eid] = {};
      }
      
      if (emp.leaveBalances && Array.isArray(emp.leaveBalances)) {
        emp.leaveBalances.forEach(b => {
          const code = (b.leaveTypeCode || b.leaveType || '').toUpperCase();
          if (code) {
            acc[eid][code] = {
              available: b.availableBalance ?? b.balance ?? 0,
              used: b.usedLeaves ?? 0,
              quota: (b.openingBalance ?? 0) + (b.accruedLeaves ?? 0) || b.annualQuota || 0
            };
          }
        });
      }
      return acc;
    }, {});

    // Full leave history per employee for modal
    const fullHistoryMap = leaves.reduce((acc, l) => {
      const eid = String(l.employeeId).toUpperCase();
      if (!acc[eid]) acc[eid] = [];
      acc[eid].push(l);
      return acc;
    }, {});

    // Group leaves by employee for cards (using search filtered or all)
    const employeeMap = filtered.reduce((acc, l) => {
      const eid = String(l.employeeId).toUpperCase();
      if (!acc[eid]) {
        acc[eid] = {
          id: l.employeeId,
          name: l.employeeName,
          dept: l.department || 'General',
          entries: [],
          totalDays: 0
        };
      }
      acc[eid].entries.push(l);
      acc[eid].totalDays += (l.totalDays || 0);
      return acc;
    }, {});

    const employeeList = Object.values(employeeMap).sort((a, b) => b.totalDays - a.totalDays);

    return {
      totalDays,
      pendingCount,
      approvedCount,
      onLeaveToday,
      employeeList,
      filteredLeaves: filtered,
      balanceMap,
      fullHistoryMap
    };
  }, [leaves, balances, searchTerm]);

  const handleLeaveAction = async (requestId, action, reason) => {
    try {
      if (action === 'approve') {
        await reportingAPI.respondToLeaveRequest ? reportingAPI.respondToLeaveRequest(requestId, { status: 'APPROVED', response: 'Approved via Admin Leave Intelligence' }) : toast.success('Approved');
        toast.success('Leave request approved');
      } else if (action === 'cancel') {
        const { cancelEmployeeLeaveRequest } = await import('../../services/api');
        await cancelEmployeeLeaveRequest(requestId, reason || 'Cancelled via Admin Leave Intelligence');
        toast.success('Leave request cancelled');
      } else {
        const { respondToLeaveRequest } = await import('../../services/api');
        await respondToLeaveRequest(requestId, { status: 'REJECTED', response: 'Rejected via Admin Leave Intelligence' });
        toast.success('Leave request rejected');
      }
      fetchData();
    } catch (e) {
      console.error('Admin leave action error', e);
      const errorMessage = e.response?.data?.message || e.response?.data?.error || e.message || 'Failed to update leave request';
      toast.error(errorMessage);
      throw e;
    }
  };

  const handleExport = () => {
    const headers = ['Employee Name', 'Employee ID', 'Leave Type', 'From', 'To', 'Days', 'Status', 'Reason'];
    const csvContent = [
      headers.join(','),
      ...stats.filteredLeaves.map(row => [
        `"${row.employeeName}"`,
        `"${row.employeeId}"`,
        `"${row.leaveTypeName || row.leaveType}"`,
        row.startDate,
        row.endDate,
        row.totalDays,
        row.status,
        `"${(row.reason || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Leave_Intelligence_Report_${filters.startDate}_to_${filters.endDate}.csv`;
    link.click();
    toast.success('Report exported successfully');
  };

  return (
    <div className="main-content report-redesign-page">
      <Header 
        title="Leave Intelligence" 
        subtitle="Organization-wide leave request patterns and workforce availability (reflects leave requests; for balance credits see Leave Adjustments)" 
      />

      <div className="ts-dashboard-content" style={{ padding: '14px 16px 20px' }}>
        {/* Controls Row */}
        <div className="ts-page-header">
          <div className="ts-hcontrols">
            <div className="ts-search-wrap">
              <Search size={16} style={{ color: '#9ca3b0' }} />
              <input 
                placeholder="Search by name, ID, or reason..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="ts-date-wrap">
              <Calendar 
                size={14} 
                style={{ color: '#6366f1', cursor: 'pointer' }} 
                onClick={() => startDateRef.current?.showPicker()} 
              />
              <input 
                ref={startDateRef}
                type="date" 
                value={filters.startDate} 
                onChange={(e) => setFilters(p => ({ ...p, startDate: e.target.value }))} 
              />
              <span className="ts-sep">→</span>
              <Calendar 
                size={14} 
                style={{ color: '#6366f1', cursor: 'pointer' }} 
                onClick={() => endDateRef.current?.showPicker()} 
              />
              <input 
                ref={endDateRef}
                type="date" 
                value={filters.endDate} 
                onChange={(e) => setFilters(p => ({ ...p, endDate: e.target.value }))} 
              />
              <button onClick={fetchData} className="ts-refresh-btn-mini" title="Refresh">
                <RefreshCw size={14} className={loading ? 'ts-spin' : ''} />
              </button>
              <button onClick={handleExport} className="ts-refresh-btn-mini" title="Export CSV">
                <Download size={14} />
              </button>
            </div>

            <div className="ts-chip-group">
              <button 
                className={`ts-chip ${filters.status === '' ? 'active' : ''}`} 
                onClick={() => setFilters(p => ({ ...p, status: '' }))}
              >All</button>
              <button 
                className={`ts-chip ${filters.status === 'PENDING' ? 'active' : ''}`} 
                onClick={() => setFilters(p => ({ ...p, status: 'PENDING' }))}
              >Pending</button>
              <button 
                className={`ts-chip ${filters.status === 'APPROVED' ? 'active' : ''}`} 
                onClick={() => setFilters(p => ({ ...p, status: 'APPROVED' }))}
              >Approved</button>
            </div>
          </div>
        </div>

        {/* AI Insight Banner */}
        <div className="ts-ai-banner">
          <div className="ts-ai-dot"></div>
          <div className="ts-ai-text">
            <strong>Workforce Insight:</strong> Reports reflect processed leave requests (manual balance credits/adjustments are logged under Leave Adjustments). There are <strong>{stats.onLeaveToday} employees</strong> on leave today. 
            Overall, <strong>{stats.totalDays.toFixed(1)} days</strong> of requested leave have been recorded in this period. 
            {stats.pendingCount > 0 ? ` There are ${stats.pendingCount} pending requests requiring attention.` : ' All leave requests have been processed.'}
          </div>
        </div>

        {/* Metrics Row */}
        <div className="ts-metrics-row">
          <div className="ts-metric">
            <span className="ts-metric-lbl">On Leave Today</span>
            <span className="ts-metric-val ts-rd">{stats.onLeaveToday}</span>
            <span className="ts-metric-sub">Active approved leaves</span>
          </div>
          <div className="ts-metric">
            <span className="ts-metric-lbl">Total Days Taken</span>
            <span className="ts-metric-val">{stats.totalDays.toFixed(1)}</span>
            <span className="ts-metric-sub">Cumulative leave days</span>
          </div>
          <div className="ts-metric">
            <span className="ts-metric-lbl">Approved Requests</span>
            <span className="ts-metric-val ts-gn">{stats.approvedCount}</span>
            <span className="ts-metric-sub">In selected period</span>
          </div>
          <div className="ts-metric">
            <span className="ts-metric-lbl">Pending Approvals</span>
            <span className="ts-metric-val ts-am">{stats.pendingCount}</span>
            <span className="ts-metric-sub">Awaiting action</span>
          </div>
          <div className="ts-metric">
            <span className="ts-metric-lbl">Total Reports</span>
            <span className="ts-metric-val ts-bl">{stats.filteredLeaves.length}</span>
            <span className="ts-metric-sub">Filtered records</span>
          </div>
        </div>

        {/* Employee Cards Grid */}
        <div className="ts-sec-header" style={{ marginTop: '12px' }}>
          <span className="ts-sec-title">Employee Leave Readiness</span>
          <span className="ts-sec-hint">Aggregated leave balance and usage · Click any employee to view full breakdown</span>
        </div>

        <div className="ts-emp-grid">
          {stats.employeeList.map((emp, idx) => {
            const eidNorm = String(emp.id).toUpperCase();
            const fullHistory = stats.fullHistoryMap[eidNorm] || emp.entries || [];
            const empBalances = stats.balanceMap[eidNorm] || {};
            
            const alData = empBalances['ANNUAL_LEAVE'] || empBalances['AL'] || { available: 0, used: 0, quota: 0 };
            const slData = empBalances['SICK_LEAVE'] || empBalances['SL'] || { available: 0, used: 0, quota: 0 };
            
            // Total available across all categories if available
            let totalAvail = 0;
            let totalQuota = 0;
            let totalConsumed = 0;

            const balanceKeys = Object.keys(empBalances);
            if (balanceKeys.length > 0) {
              balanceKeys.forEach(k => {
                const b = empBalances[k];
                totalAvail += (b.available || 0);
                totalQuota += (b.quota || 0);
                totalConsumed += (b.used || 0);
              });
            } else {
              totalAvail = alData.available + slData.available;
              totalQuota = alData.quota + slData.quota;
              totalConsumed = (totalQuota > 0 ? Math.max(0, totalQuota - totalAvail) : (alData.used + slData.used));
            }

            if (totalConsumed === 0 && emp.totalDays > 0) {
              totalConsumed = emp.totalDays;
            }

            const usagePct = totalQuota > 0 ? Math.min(100, Math.round((totalConsumed / totalQuota) * 100)) : 0;
            const effColor = usagePct >= 80 ? '#ef4444' : usagePct >= 50 ? '#f59e0b' : '#10b981';
            const initials = emp.name?.split(' ').map(n => n[0]).join('') || '?';

            const displayEmp = {
              id: emp.id,
              name: emp.name,
              dept: emp.dept,
              available: totalAvail,
              used: totalConsumed,
              quota: totalQuota,
              annualAvail: alData.available,
              annualConsumed: alData.used,
              sickAvail: slData.available,
              sickConsumed: slData.used,
              entries: fullHistory,
              type: 'leave'
            };
            
            return (
              <div 
                key={emp.id} 
                className="ts-emp-card ts-emp-card-interactive" 
                onClick={() => setSelectedEmployee(displayEmp)}
                title="Click to view detailed leave analytics & history"
              >
                <div className="ts-card-top">
                  <div className="ts-avatar" style={{ 
                    background: COLORS_PALETTE[idx % COLORS_PALETTE.length] + '15', 
                    color: COLORS_PALETTE[idx % COLORS_PALETTE.length] 
                  }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ts-card-name text-truncate">{emp.name}</div>
                    <div className="ts-card-id">{emp.id} · {emp.dept}</div>
                  </div>
                  {usagePct >= 80 && (
                    <span className="lv-risk-badge" title="High leave usage">High</span>
                  )}
                </div>
                
                <div className="ts-hours-big" style={{ fontSize: '22px' }}>
                  {totalAvail} <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>Avail</span>
                </div>
                <div className="ts-hours-sub">{totalConsumed} days consumed of {totalQuota || 18} total</div>
                
                <div className="ts-bar-track">
                  <div className="ts-bar-bill" style={{ width: `${usagePct}%`, background: effColor }}></div>
                </div>
                
                <div className="ts-pill-row">
                  <span className="ts-pill ts-pill-g">AL: {alData.available} Avail</span>
                  <span className="ts-pill ts-pill-r">SL: {slData.available} Avail</span>
                </div>
                
                <div className="ts-card-footer">
                  <span className="ts-eff-lbl">Usage Rate</span>
                  <span className="ts-eff-val" style={{ color: effColor }}>{usagePct}%</span>
                </div>
              </div>
            );
          })}
          {stats.employeeList.length === 0 && !loading && (
            <div className="ts-empty-st" style={{ gridColumn: '1 / -1', padding: '24px 12px' }}>
              No leave data found for the selected filters.
            </div>
          )}
        </div>

        {/* Detailed Table */}
        <div className="ts-sec-header" style={{ marginTop: '16px' }}>
          <span className="ts-sec-title">Leave Request Audit Log</span>
          <span className="ts-sec-hint">Showing {stats.filteredLeaves.length} organization leave records · Click any employee to open Leave Intelligence</span>
        </div>
        
        <div className="ts-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="ts-table">
              <thead>
                <tr>
                  <th className="ts-th">Employee</th>
                  <th className="ts-th">Type</th>
                  <th className="ts-th">Period</th>
                  <th className="ts-th">Days</th>
                  <th className="ts-th" style={{ textAlign: 'center' }}>Status</th>
                  <th className="ts-th">Reason</th>
                  <th className="ts-th" style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stats.filteredLeaves.map((l, idx) => {
                  const eidNorm = String(l.employeeId).toUpperCase();
                  const empBalances = stats.balanceMap[eidNorm] || {};
                  const fullHistory = stats.fullHistoryMap[eidNorm] || [l];
                  const alData = empBalances['ANNUAL_LEAVE'] || empBalances['AL'] || { available: 0, used: 0, quota: 0 };
                  const slData = empBalances['SICK_LEAVE'] || empBalances['SL'] || { available: 0, used: 0, quota: 0 };

                  const empForModal = {
                    id: l.employeeId,
                    name: l.employeeName,
                    dept: l.department || 'General',
                    available: (alData.available || 0) + (slData.available || 0),
                    used: (alData.used || 0) + (slData.used || 0),
                    quota: (alData.quota || 0) + (slData.quota || 0),
                    annualAvail: alData.available,
                    annualConsumed: alData.used,
                    sickAvail: slData.available,
                    sickConsumed: slData.used,
                    entries: fullHistory,
                    type: 'leave'
                  };

                  return (
                    <tr 
                      key={idx} 
                      className={`ts-table-row-hover ${idx % 2 !== 0 ? 'ts-row-alt' : ''}`}
                    >
                      <td className="ts-td" onClick={() => setSelectedEmployee(empForModal)} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="ts-avatar" style={{ width: '26px', height: '26px', fontSize: '11px', background: '#f1f5f9', color: '#64748b' }}>
                            {l.employeeName?.split(' ').map(n=>n[0]).join('')}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>{l.employeeName}</div>
                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>{l.employeeId} · {l.department || 'Staff'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="ts-td">
                        <span style={{ fontWeight: 600, color: '#475569' }}>{l.leaveTypeName || l.leaveType}</span>
                      </td>
                      <td className="ts-td">
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{l.startDate}</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>to {l.endDate}</div>
                      </td>
                      <td className="ts-td">
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>{l.totalDays}</div>
                      </td>
                      <td className="ts-td" style={{ textAlign: 'center' }}>
                        <span className={`ts-pill ${
                          l.status === 'APPROVED' ? 'ts-pill-g' : 
                          l.status === 'REJECTED' ? 'ts-pill-r' : ''
                        }`} style={{ 
                          fontSize: '10px',
                          background: l.status === 'PENDING' ? '#fef9c3' : '',
                          color: l.status === 'PENDING' ? '#854d0e' : '',
                          border: l.status === 'PENDING' ? '1px solid #fef08a' : ''
                        }}>
                          {l.status}
                        </span>
                      </td>
                      <td className="ts-td">
                        <div style={{ maxWidth: '200px' }} className="text-truncate" title={l.reason}>
                          {l.reason || '-'}
                        </div>
                      </td>
                      <td className="ts-td" style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="ts-view-btn"
                          onClick={() => setSelectedEmployee(empForModal)}
                        >
                          View Breakdown
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {stats.filteredLeaves.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px 12px', color: '#94a3b8' }}>
                      <FileText size={36} strokeWidth={1} style={{ opacity: 0.3, marginBottom: '8px' }} />
                      <p>No records matching your search criteria.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Admin Full Organization Leave Intelligence & Breakdown Modal */}
      <AdminLeaveModal
        emp={selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        allLeaves={leaves}
        teamBalances={stats.balanceMap}
        onAction={handleLeaveAction}
      />

      <style>{`
        .report-redesign-page { display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .ts-dashboard-content { animation: fadeIn 0.4s ease-out; box-sizing: border-box; width: 100%; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ts-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes ts-spin { to { transform: rotate(360deg); } }
        @keyframes ts-up { from { transform: translateY(14px); opacity: 0; } to { transform: none; opacity: 1; } }
        .ts-spin { animation: ts-spin 1s linear infinite; }

        .ts-page-header { margin-bottom: 12px; }
        .ts-hcontrols { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        
        .ts-search-wrap { 
          flex: 1; min-width: 220px; display: flex; align-items: center; gap: 8px; 
          background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0 12px; height: 34px;
          transition: all 0.2s; box-sizing: border-box;
        }
        .ts-search-wrap:focus-within { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
        .ts-search-wrap input { border: none; outline: none; width: 100%; font-size: 13px; background: transparent; }

        .ts-date-wrap { 
          display: flex; align-items: center; gap: 6px; background: #fff; 
          border: 1px solid #e2e8f0; border-radius: 8px; padding: 0 10px; height: 34px; box-sizing: border-box;
        }
        .ts-date-wrap input { border: none; outline: none; font-size: 12px; color: #475569; font-weight: 500; background: transparent; }
        .ts-sep { color: #94a3b8; font-weight: 700; }
        
        .ts-refresh-btn-mini { 
          width: 34px; height: 34px; border-radius: 8px; border: 1px solid #e2e8f0; 
          background: #fff; display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s; color: #64748b; box-sizing: border-box;
        }
        .ts-refresh-btn-mini:hover { background: #f8fafc; color: #6366f1; border-color: #6366f1; }

        .ts-chip-group { display: flex; gap: 4px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 3px; height: 34px; box-sizing: border-box; align-items: center; }
        .ts-chip { 
          padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; 
          color: #64748b; background: transparent; transition: all 0.2s; border: none; cursor: pointer;
        }
        .ts-chip.active { background: #6366f1; color: #fff; }
        .ts-chip:not(.active):hover { background: #f1f5f9; }

        .ts-ai-banner {
          background: #fff; border: 1px solid rgba(0,0,0,0.07); border-left: 3px solid #6366f1;
          border-radius: 10px; padding: 10px 12px; margin-bottom: 12px;
          display: flex; align-items: flex-start; gap: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }
        .ts-ai-dot { width: 7px; height: 7px; border-radius: 50%; background: #6366f1; margin-top: 5px; flex-shrink: 0; animation: ts-blink 2.5s ease-in-out infinite; }
        .ts-ai-text { font-size: 13px; color: #475569; line-height: 1.45; }
        .ts-ai-text strong { color: #1e293b; font-weight: 700; }

        .ts-metrics-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 12px; }
        .ts-metric { 
          background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; 
          display: flex; flex-direction: column; transition: transform 0.2s;
        }
        .ts-metric:hover { transform: translateY(-1px); }
        .ts-metric-lbl { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }
        .ts-metric-val { font-size: 22px; font-weight: 800; color: #1e293b; margin: 2px 0; }
        .ts-metric-val.ts-gn { color: #10b981; }
        .ts-metric-val.ts-rd { color: #ef4444; }
        .ts-metric-val.ts-am { color: #f59e0b; }
        .ts-metric-val.ts-bl { color: #6366f1; }
        .ts-metric-sub { font-size: 11px; color: #94a3b8; }
        .ts-metric-sub.ts-gn { color: #10b981; font-weight: 600; }
        .ts-metric-sub.ts-rd { color: #ef4444; font-weight: 600; }

        .ts-sec-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; gap: 8px; flex-wrap: wrap; }
        .ts-sec-title { font-size: 14px; font-weight: 700; color: #1e293b; }
        .ts-sec-hint { font-size: 11px; color: #94a3b8; }

        .ts-emp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
        .ts-emp-card {
          background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04); transition: all 0.2s;
          position: relative; overflow: hidden;
        }
        .ts-emp-card-interactive { cursor: pointer; }
        .ts-emp-card-interactive:hover { transform: translateY(-2px); box-shadow: 0 8px 16px -8px rgba(0,0,0,0.12); border-color: #6366f1; }
        .ts-emp-card::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: #6366f1; opacity: 0; transition: 0.2s; }
        .ts-emp-card:hover::after { opacity: 1; }

        .ts-card-top { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .ts-avatar { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
        .ts-card-name { font-size: 13px; font-weight: 700; color: #1e293b; }
        .ts-card-id { font-size: 11px; color: #94a3b8; font-family: monospace; }
        .lv-risk-badge { font-size: 10px; font-weight: 700; background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; }

        .ts-hours-big { font-size: 22px; font-weight: 800; color: #1e293b; line-height: 1; }
        .ts-hours-sub { font-size: 11px; color: #94a3b8; margin: 4px 0 10px; }

        .ts-bar-track { width: 100%; height: 6px; background: #f1f5f9; border-radius: 4px; margin-bottom: 10px; overflow: hidden; }
        .ts-bar-bill { height: 100%; border-radius: 4px; transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1); }

        .ts-pill-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
        .ts-pill { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 100px; text-transform: uppercase; letter-spacing: 0.02em; }
        .ts-pill-g { background: #f0fdf4; color: #10b981; border: 1px solid #bbf7d0; }
        .ts-pill-r { background: #fff1f2; color: #ef4444; border: 1px solid #fecdd3; }

        .ts-card-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid #f1f5f9; }
        .ts-eff-lbl { font-size: 11px; color: #94a3b8; font-weight: 600; }
        .ts-eff-val { font-size: 13px; font-weight: 800; font-family: monospace; }

        .ts-card { background: #fff; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
        .ts-table { width: 100%; border-collapse: collapse; }
        .ts-th { text-align: left; padding: 8px 12px; font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; border-bottom: 1px solid #f1f5f9; }
        .ts-td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #475569; }
        .ts-row-alt { background: #fcfdfe; }
        .ts-table-row-hover:hover { background: #f8fafc; }
        .ts-empty-st { text-align: center; color: #94a3b8; font-size: 13px; }
        .ts-view-btn {
          font-size: 11px; font-weight: 600; color: #4f46e5; background: #eef2ff;
          border: 1px solid #c7d2fe; padding: 4px 10px; border-radius: 6px; cursor: pointer;
          transition: all 0.2s;
        }
        .ts-view-btn:hover { background: #4f46e5; color: #fff; }
        
        .text-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        /* Modal Styles */
        .ts-overlay {
          display: none; position: fixed; inset: 0; background: rgba(10,14,26,0.6); z-index: 2000;
          align-items: center; justify-content: center; padding: 1rem; backdrop-filter: blur(4px);
        }
        .ts-overlay.open { display: flex; }
        .ts-modal {
          background: #fff; border-radius: 16px; padding: 1.5rem; width: 100%; max-width: 860px;
          position: relative; box-shadow: 0 24px 64px rgba(0,0,0,0.15); animation: ts-up 0.25s ease-out;
          color: #0f1117; max-height: 94vh; overflow-y: auto;
        }
        .ts-modal-close {
          position: absolute; top: 1rem; right: 1rem; background: #f7f8fa; border: 1px solid rgba(0,0,0,0.07);
          border-radius: 8px; width: 30px; height: 30px; cursor: pointer; color: #5c6070;
          display: flex; align-items: center; justify-content: center;
        }
        .ts-modal-close:hover { background: #eef0f4; color: #0f1117; }
        .ts-modal-head { display: flex; align-items: center; gap: 14px; margin-bottom: 1rem; }
        .ts-m-av { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; }
        .ts-m-name { font-size: 16px; font-weight: 700; color: #1e293b; }
        .ts-m-meta { font-size: 13px; color: #94a3b8; margin-top: 4px; }
        
        .lv-btn-acc { background: #10b981; color: #fff; border: none; padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; }
        .lv-btn-acc:hover { background: #059669; }
        .lv-btn-rej { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; }
        .lv-btn-rej:hover { background: #dc2626; color: #fff; }
        .lv-btn-grey { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; }
        .lv-btn-grey:hover { background: #e2e8f0; }

        .ts-modal-ai { margin-top: 1.5rem; background: #eff4ff; border-left: 4px solid #4f46e5; border-radius: 8px; padding: 1rem; display: flex; gap: 12px; }
        .ts-modal-ai-text { font-size: 13px; color: #5c6070; line-height: 1.6; }

        @media (max-width: 768px) {
          .ts-dashboard-content { padding: 10px 10px 16px !important; }
          .ts-metrics-row { grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; }
          .ts-modal { padding: 1.25rem; }
        }
      `}</style>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   AdminLeaveModal Component: Full Organization-wide Leave Intelligence
   Includes: OVERVIEW tab, Monthly activity trends, Quota distribution,
   Category-wise cards, Application history & Adjustments audit log
   ───────────────────────────────────────────────────────────── */
const AdminLeaveModal = ({ emp, onClose, allLeaves = [], teamBalances = {}, onAction }) => {
  const [mTab, setMTab] = useState('OVERVIEW');
  const [adjustments, setAdjustments] = useState([]);
  const [adjLoading, setAdjLoading] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [processingAction, setProcessingAction] = useState({ id: null, type: null });

  useEffect(() => {
    if (emp?.id && mTab === 'ADJUSTMENTS') {
      const fetchAdj = async () => {
        try {
          setAdjLoading(true);
          const res = await leaveBalanceAPI.getAdjustments(emp.id);
          setAdjustments(res.data || []);
        } catch (e) {
          console.error('Failed to fetch adjustments for employee', e);
        } finally {
          setAdjLoading(false);
        }
      };
      fetchAdj();
    }
  }, [emp?.id, mTab]);

  if (!emp) return null;

  const empIdNorm = String(emp.id).toUpperCase();
  const empLeaves = (allLeaves || []).filter(l => String(l.employeeId).toUpperCase() === empIdNorm);
  const filtered = empLeaves.filter(l => l.status === mTab);

  // Extract all leave type balances for this employee
  const rawBalances = teamBalances[empIdNorm] || {};

  const LEAVE_TYPE_META = {
    'ANNUAL_LEAVE': { label: 'Annual Leave', code: 'AL', color: '#10b981', bg: '#ecfdf5' },
    'AL': { label: 'Annual Leave', code: 'AL', color: '#10b981', bg: '#ecfdf5' },
    'SICK_LEAVE': { label: 'Sick Leave', code: 'SL', color: '#ef4444', bg: '#fef2f2' },
    'SL': { label: 'Sick Leave', code: 'SL', color: '#ef4444', bg: '#fef2f2' },
    'CASUAL_LEAVE': { label: 'Casual Leave', code: 'CL', color: '#3b82f6', bg: '#eff6ff' },
    'CL': { label: 'Casual Leave', code: 'CL', color: '#3b82f6', bg: '#eff6ff' },
    'MATERNITY_LEAVE': { label: 'Maternity Leave', code: 'ML', color: '#ec4899', bg: '#fdf2f8' },
    'ML': { label: 'Maternity Leave', code: 'ML', color: '#ec4899', bg: '#fdf2f8' },
    'PATERNITY_LEAVE': { label: 'Paternity Leave', code: 'PL', color: '#8b5cf6', bg: '#f5f3ff' },
    'PL': { label: 'Paternity Leave', code: 'PL', color: '#8b5cf6', bg: '#f5f3ff' },
    'BEREAVEMENT_LEAVE': { label: 'Bereavement Leave', code: 'BL', color: '#64748b', bg: '#f8fafc' },
    'BL': { label: 'Bereavement Leave', code: 'BL', color: '#64748b', bg: '#f8fafc' },
    'COMPENSATORY_OFF': { label: 'Compensatory Off', code: 'CO', color: '#f59e0b', bg: '#fffbeb' },
    'CO': { label: 'Compensatory Off', code: 'CO', color: '#f59e0b', bg: '#fffbeb' },
    'UNPAID_LEAVE': { label: 'Unpaid Leave', code: 'UL', color: '#94a3b8', bg: '#f1f5f9' },
    'UL': { label: 'Unpaid Leave', code: 'UL', color: '#94a3b8', bg: '#f1f5f9' }
  };

  // Build unified list of all leave types
  const leaveTypesMap = {};

  // 1. Seed with Annual & Sick
  leaveTypesMap['Annual Leave'] = {
    code: 'AL',
    label: 'Annual Leave',
    available: emp.annualAvail || 0,
    consumed: emp.annualConsumed || 0,
    quota: (emp.annualAvail || 0) + (emp.annualConsumed || 0),
    color: '#10b981',
    bg: '#ecfdf5'
  };
  leaveTypesMap['Sick Leave'] = {
    code: 'SL',
    label: 'Sick Leave',
    available: emp.sickAvail || 0,
    consumed: emp.sickConsumed || 0,
    quota: (emp.sickAvail || 0) + (emp.sickConsumed || 0),
    color: '#ef4444',
    bg: '#fef2f2'
  };

  // 2. Add all items from rawBalances
  Object.entries(rawBalances).forEach(([typeKey, data]) => {
    const meta = LEAVE_TYPE_META[typeKey] || {
      label: typeKey.replace(/_/g, ' '),
      code: typeKey.substring(0, 3).toUpperCase(),
      color: '#4f46e5',
      bg: '#eef2ff'
    };
    const avail = Number(data.available || 0);
    const used = Number(data.used || 0);
    const q = Number(data.quota || (avail + used) || 0);
    const consumed = q > 0 ? Math.max(0, q - avail) : used;

    leaveTypesMap[meta.label] = {
      code: meta.code,
      label: meta.label,
      available: avail,
      consumed: consumed,
      quota: q,
      color: meta.color,
      bg: meta.bg
    };
  });

  const allLeaveTypesList = Object.values(leaveTypesMap);

  // Leave Breakdown & Stats calculation
  const totalApprovedLeaves = empLeaves.filter(l => l.status === 'APPROVED');
  const totalPendingLeaves = empLeaves.filter(l => l.status === 'PENDING');
  const totalRejectedLeaves = empLeaves.filter(l => l.status === 'REJECTED');
  const totalCancelledLeaves = empLeaves.filter(l => l.status === 'CANCELLED');

  const approvedDays = totalApprovedLeaves.reduce((acc, l) => acc + (Number(l.totalDays) || 1), 0);
  const pendingDays = totalPendingLeaves.reduce((acc, l) => acc + (Number(l.totalDays) || 1), 0);

  // Monthly Leave Trend (Jan - Dec)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyTrendData = monthNames.map((m) => ({ month: m, approved: 0, pending: 0 }));

  empLeaves.forEach(l => {
    if (l.startDate) {
      const dt = new Date(l.startDate);
      if (!isNaN(dt.getTime())) {
        const mIdx = dt.getMonth();
        const days = Number(l.totalDays) || 1;
        if (l.status === 'APPROVED') monthlyTrendData[mIdx].approved += days;
        else if (l.status === 'PENDING') monthlyTrendData[mIdx].pending += days;
      }
    }
  });

  // Leave Type Distribution Chart Data
  const typeDistributionData = allLeaveTypesList
    .filter(t => t.consumed > 0 || t.available > 0)
    .map(t => ({
      name: t.label,
      consumed: t.consumed,
      available: t.available
    }));

  return (
    <div className="ts-overlay open" onClick={(e) => e.target.className.includes('ts-overlay') && onClose()}>
      <div className="ts-modal" style={{ maxWidth: '840px' }}>
        <button className="ts-modal-close" onClick={onClose} title="Close">✕</button>
        
        <div className="ts-modal-head" style={{ marginBottom: '14px' }}>
          <div className="ts-m-av" style={{ background: '#4f46e520', color: '#4f46e5' }}>
            {emp.name?.split(' ').map(n=>n[0]).join('') || '?'}
          </div>
          <div>
            <div className="ts-m-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {emp.name}
              <span style={{ fontSize: '11px', fontWeight: 600, background: '#eef2ff', color: '#4f46e5', padding: '2px 8px', borderRadius: '12px' }}>
                {emp.dept || 'Staff'}
              </span>
            </div>
            <div className="ts-m-meta">{emp.id} · Total Leave Records: {empLeaves.length} (Org-wide Audit)</div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="ts-chip-group" style={{ marginBottom: '1.25rem', justifyContent: 'flex-start' }}>
          <button className={`ts-chip ${mTab === 'OVERVIEW' ? 'active' : ''}`} onClick={() => setMTab('OVERVIEW')}>
            📊 Overview
          </button>
          <button className={`ts-chip ${mTab === 'PENDING' ? 'active' : ''}`} onClick={() => setMTab('PENDING')}>
            Applied ({totalPendingLeaves.length})
          </button>
          <button className={`ts-chip ${mTab === 'APPROVED' ? 'active' : ''}`} onClick={() => setMTab('APPROVED')}>
            Approved ({totalApprovedLeaves.length})
          </button>
          <button className={`ts-chip ${mTab === 'REJECTED' ? 'active' : ''}`} onClick={() => setMTab('REJECTED')}>
            Rejected ({totalRejectedLeaves.length})
          </button>
          <button className={`ts-chip ${mTab === 'CANCELLED' ? 'active' : ''}`} onClick={() => setMTab('CANCELLED')}>
            Cancelled ({totalCancelledLeaves.length})
          </button>
          <button className={`ts-chip ${mTab === 'ADJUSTMENTS' ? 'active' : ''}`} onClick={() => setMTab('ADJUSTMENTS')}>
            Adjustments
          </button>
        </div>

        {/* Content Body */}
        {mTab === 'OVERVIEW' ? (
          <div style={{ maxHeight: '520px', overflowY: 'auto', paddingRight: '4px' }}>
            {/* Top Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '1.25rem' }}>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Available Total</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#10b981', marginTop: '2px' }}>{emp.available || 0}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Days remaining</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Consumed Total</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#3b82f6', marginTop: '2px' }}>{emp.used || approvedDays || 0}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Days taken</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Pending Review</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#f59e0b', marginTop: '2px' }}>{pendingDays}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{totalPendingLeaves.length} request(s)</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Quota Utilization</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#8b5cf6', marginTop: '2px' }}>
                  {emp.quota > 0 ? Math.round(((emp.used || approvedDays) / emp.quota) * 100) : 0}%
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Of {emp.quota || 18} quota</div>
              </div>
            </div>

            {/* Graphs Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', marginBottom: '1.25rem' }}>
              {/* Monthly Trend Chart */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Monthly Leave Activity (Days)</span>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#10b981' }}></span> Approved
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f59e0b' }}></span> Pending
                    </span>
                  </div>
                </div>
                <div style={{ width: '100%', height: '170px' }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={monthlyTrendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                      <Tooltip 
                        contentStyle={{ fontSize: '12px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} 
                        formatter={(val) => [`${val} Days`, '']}
                      />
                      <Bar dataKey="approved" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={12} />
                      <Bar dataKey="pending" stackId="a" fill="#f59e0b" radius={[3, 3, 0, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Leave Type Breakdown Chart */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: '10px' }}>
                  Leave Type Usage vs Balance
                </span>
                <div style={{ width: '100%', height: '170px' }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={typeDistributionData} layout="vertical" margin={{ top: 5, right: 15, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.05)" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#475569' }} width={80} />
                      <Tooltip 
                        contentStyle={{ fontSize: '12px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                        formatter={(val, name) => [`${val} Days`, name === 'consumed' ? 'Consumed' : 'Available']}
                      />
                      <Bar dataKey="consumed" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={10} />
                      <Bar dataKey="available" fill="#10b981" radius={[0, 4, 4, 0]} barSize={10} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* All Types Leaves Cards & Info */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>All Leave Types Breakdown & Quotas</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{allLeaveTypesList.length} leave categories configured</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '10px' }}>
                {allLeaveTypesList.map((lt, idx) => {
                  const usedPct = lt.quota > 0 ? Math.min(100, Math.round((lt.consumed / lt.quota) * 100)) : 0;
                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        background: '#f8fafc', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '10px', 
                        padding: '12px',
                        borderLeft: `4px solid ${lt.color}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{lt.label}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Code: {lt.code}</div>
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '6px', background: lt.bg, color: lt.color }}>
                          {lt.quota > 0 ? `${lt.quota}d Quota` : 'Standard'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '6px' }}>
                        <span style={{ color: '#059669', fontWeight: 600 }}>Available: <strong>{lt.available}</strong>d</span>
                        <span style={{ color: '#475569' }}>Consumed: <strong>{lt.consumed}</strong>d</span>
                      </div>

                      <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${usedPct}%`, height: '100%', background: lt.color, borderRadius: '3px' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Leave History Preview */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Recent Leave Applications</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Last {Math.min(3, empLeaves.length)} of {empLeaves.length} applications</span>
              </div>
              {empLeaves.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '10px' }}>
                  No leave requests recorded for this employee.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {empLeaves.slice(0, 3).map((l, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#f8fafc', borderRadius: '8px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{l.leaveTypeName || l.leaveType}</span>
                        <span style={{ color: '#64748b' }}>({formatDate(l.startDate)} &mdash; {formatDate(l.endDate)})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, color: '#4f46e5' }}>{l.totalDays} Days</span>
                        <span style={{ 
                          fontSize: '10px', 
                          fontWeight: 700, 
                          padding: '2px 6px', 
                          borderRadius: '4px',
                          background: l.status === 'APPROVED' ? '#ecfdf5' : l.status === 'PENDING' ? '#fffbeb' : '#fef2f2',
                          color: l.status === 'APPROVED' ? '#059669' : l.status === 'PENDING' ? '#d97706' : '#dc2626'
                        }}>
                          {l.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Other Tabs: PENDING, APPROVED, REJECTED, CANCELLED, ADJUSTMENTS */
          <div style={{ maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
            {mTab === 'ADJUSTMENTS' ? (
               adjLoading ? (
                 <div style={{ textAlign: 'center', padding: '2rem' }}><RefreshCw size={20} className="ts-spin" /></div>
               ) : (
                 adjustments.length === 0 ? (
                   <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3b0', fontSize: '13px' }}>No adjustments recorded for this employee.</div>
                 ) : (
                   adjustments.map((adj, idx) => (
                     <div key={idx} className="ts-card" style={{ padding: '1rem', marginBottom: '10px', border: '1px solid rgba(0,0,0,0.06)', borderLeft: `4px solid ${adj.adjustmentType === 'ADDITION' ? '#10b981' : '#ef4444'}` }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                         <span style={{ fontWeight: 700, fontSize: '14px' }}>{adj.leaveType?.replace('_', ' ')}</span>
                         <span style={{ fontSize: '13px', fontWeight: 700, color: adj.adjustmentType === 'ADDITION' ? '#10b981' : '#ef4444' }}>
                           {adj.adjustmentType === 'ADDITION' ? '+' : '-'}{Math.abs(adj.daysChanged || 0)} Days
                         </span>
                       </div>
                       <div style={{ fontSize: '12px', color: '#9ca3b0', marginBottom: '10px' }}>
                         Adjusted on: {formatDate(adj.timestamp || adj.createdAt || adj.adjustmentDate)}
                       </div>
                       <div style={{ fontSize: '13px', color: '#5c6070', fontStyle: 'italic', background: '#f7f8fa', padding: '8px', borderRadius: '8px' }}>
                         &ldquo;{adj.reason || 'No reason provided'}&rdquo;
                       </div>
                     </div>
                   ))
                 )
               )
            ) : (
              filtered.map((l, idx) => (
                <div key={idx} className="ts-card" style={{ padding: '1rem', marginBottom: '10px', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{l.leaveTypeName || l.leaveType}</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#4f46e5' }}>{l.totalDays} Days</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3b0', marginBottom: '10px' }}>
                    {formatDate(l.startDate)} &mdash; {formatDate(l.endDate)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#5c6070', fontStyle: 'italic', background: '#f7f8fa', padding: '8px', borderRadius: '8px' }}>
                    &ldquo;{l.reason || 'No reason provided'}&rdquo;
                  </div>

                  {mTab === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button 
                        type="button"
                        className="lv-btn-acc" 
                        onClick={async () => {
                          try {
                            setProcessingAction({ id: l.id, type: 'approve' });
                            await onAction(l.id, 'approve');
                          } catch {
                            // error handled in onAction
                          } finally {
                            setProcessingAction({ id: null, type: null });
                          }
                        }}
                        disabled={processingAction.id !== null}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {processingAction.id === l.id && processingAction.type === 'approve' ? (
                          <>
                            <RefreshCw size={14} className="ts-spin" />
                            Approving...
                          </>
                        ) : (
                          'Approve'
                        )}
                      </button>
                      <button 
                        type="button"
                        className="lv-btn-rej" 
                        onClick={async () => {
                          try {
                            setProcessingAction({ id: l.id, type: 'reject' });
                            await onAction(l.id, 'reject');
                          } catch {
                            // error handled in onAction
                          } finally {
                            setProcessingAction({ id: null, type: null });
                          }
                        }}
                        disabled={processingAction.id !== null}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {processingAction.id === l.id && processingAction.type === 'reject' ? (
                          <>
                            <RefreshCw size={14} className="ts-spin" />
                            Rejecting...
                          </>
                        ) : (
                          'Reject'
                        )}
                      </button>
                      <button 
                        type="button"
                        className="lv-btn-grey" 
                        onClick={() => { setConfirmingLeave(l); setCancelReason(''); }}
                        disabled={processingAction.id !== null}
                      >
                        Cancel Leave
                      </button>
                    </div>
                  )}

                  {mTab === 'APPROVED' && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button className="lv-btn-rej" onClick={() => { setConfirmingLeave(l); setCancelReason(''); }}>Cancel Leave</button>
                    </div>
                  )}
                </div>
              ))
            )}
            {mTab !== 'ADJUSTMENTS' && filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3b0', fontSize: '13px' }}>
                No {mTab.toLowerCase()} leave requests found for this period.
              </div>
            )}
          </div>
        )}

        <div className="ts-modal-ai">
          <div className="ts-ai-dot" style={{ flexShrink: 0, marginTop: '3px', background: '#4f46e5' }}></div>
          <div className="ts-modal-ai-text">
            <strong>Organization Capacity Insight:</strong> {emp.name} has consumed <strong>{((emp.used / (emp.quota || 18)) * 100).toFixed(0)}%</strong> of their total annual leave quota. 
            {emp.used > (emp.quota * 0.8) ? ' Usage is high across the reporting year — ensure handover protocols are in place.' : ' Leave consumption is balanced across business cycles.'}
          </div>
        </div>
      </div>

      {confirmingLeave && (
        <div className="ts-overlay open" style={{ zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="ts-modal" style={{ maxWidth: '400px', width: '90%', margin: '0 auto', transform: 'none', position: 'relative' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: '#1e293b' }}>Confirm Cancel Leave</h3>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
              Are you sure you want to cancel this {((confirmingLeave.status || mTab) === 'APPROVED') ? 'approved leave' : 'leave request'}? This action cannot be undone.
            </p>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Cancellation Reason (Mandatory)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Please enter a reason..."
                style={{
                  width: '100%',
                  height: '80px',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                  resize: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button 
                type="button"
                className="lv-btn-grey" 
                onClick={() => setConfirmingLeave(null)}
                disabled={isCancelling}
              >
                Go Back
              </button>
              <button 
                type="button"
                className="lv-btn-rej"
                style={{ background: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', border: 'none' }}
                onClick={async () => {
                  if (!cancelReason.trim()) {
                    toast.error('Cancellation reason is required');
                    return;
                  }
                  try {
                    setIsCancelling(true);
                    await onAction(confirmingLeave.id, 'cancel', cancelReason.trim());
                    setConfirmingLeave(null);
                    setMTab('CANCELLED');
                  } catch {
                    // error handled in onAction
                  } finally {
                    setIsCancelling(false);
                  }
                }}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <>
                    <RefreshCw size={14} className="ts-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Confirm Cancel'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLeaveReport;
