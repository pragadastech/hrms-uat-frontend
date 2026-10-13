import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  Calendar, 
  RefreshCw, 
  Download, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  TrendingDown,
  FileText,
  CalendarDays,
  Briefcase,
  UserCheck,
  UserMinus
} from 'lucide-react';
import { reportingAPI } from '../../services/api';
import toast from 'react-hot-toast';
import Header from '../../components/Header';

const COLORS_PALETTE = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

const AdminLeaveReport = () => {
  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [serverStats, setServerStats] = useState(null);
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

    // Group balances by employee
    const balanceMap = balances.reduce((acc, emp) => {
      const eid = String(emp.employeeId).toUpperCase();
      if (!acc[eid]) {
        acc[eid] = { 
          AL: { available: 0, used: 0, quota: 0 }, 
          SL: { available: 0, used: 0, quota: 0 } 
        };
      }
      
      if (emp.leaveBalances && Array.isArray(emp.leaveBalances)) {
        emp.leaveBalances.forEach(b => {
          const code = b.leaveTypeCode === 'ANNUAL_LEAVE' || b.leaveTypeCode === 'AL' ? 'AL' : 
                       b.leaveTypeCode === 'SICK_LEAVE' || b.leaveTypeCode === 'SL' ? 'SL' : null;
          if (code) {
            acc[eid][code] = {
              available: b.availableBalance || 0,
              used: b.usedLeaves || 0,
              quota: (b.openingBalance || 0) + (b.accruedLeaves || 0)
            };
          }
        });
      }
      return acc;
    }, {});

    // Group leaves by employee for cards
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
      balanceMap
    };
  }, [leaves, balances, searchTerm]);

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
          <span className="ts-sec-hint">Aggregated leave balance and usage</span>
        </div>

        <div className="ts-emp-grid">
          {stats.employeeList.slice(0, 12).map((emp, idx) => {
            const eidNorm = String(emp.id).toUpperCase();
            const bal = stats.balanceMap[eidNorm] || { AL: { available: 0, used: 0, quota: 0 }, SL: { available: 0, used: 0, quota: 0 } };
            
            const totalAvail = bal.AL.available + bal.SL.available;
            const totalQuota = bal.AL.quota + bal.SL.quota;
            const totalUsed = totalQuota - totalAvail;
            const usagePct = totalQuota > 0 ? Math.round((totalUsed / totalQuota) * 100) : 0;
            const effColor = usagePct >= 80 ? '#ef4444' : usagePct >= 50 ? '#f59e0b' : '#10b981';
            const initials = emp.name?.split(' ').map(n => n[0]).join('') || '?';
            
            return (
              <div key={emp.id} className="ts-emp-card">
                <div className="ts-card-top">
                  <div className="ts-avatar" style={{ 
                    background: COLORS_PALETTE[idx % COLORS_PALETTE.length] + '15', 
                    color: COLORS_PALETTE[idx % COLORS_PALETTE.length] 
                  }}>
                    {initials}
                  </div>
                  <div>
                    <div className="ts-card-name">{emp.name}</div>
                    <div className="ts-card-id">{emp.id} · {emp.dept}</div>
                  </div>
                </div>
                
                <div className="ts-hours-big" style={{ fontSize: '22px' }}>
                  {totalAvail} <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>Avail</span>
                </div>
                <div className="ts-hours-sub">{totalUsed} days consumed of {totalQuota} total</div>
                
                <div className="ts-bar-track">
                  <div className="ts-bar-bill" style={{ width: `${usagePct}%`, background: effColor }}></div>
                </div>
                
                <div className="ts-pill-row">
                  <span className="ts-pill ts-pill-g">AL: {bal.AL.available} / {bal.AL.quota}</span>
                  <span className="ts-pill ts-pill-r">SL: {bal.SL.available} / {bal.SL.quota}</span>
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
                </tr>
              </thead>
              <tbody>
                {stats.filteredLeaves.map((l, idx) => (
                  <tr key={idx} className={idx % 2 !== 0 ? 'ts-row-alt' : ''}>
                    <td className="ts-td">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="ts-avatar" style={{ width: '24px', height: '24px', fontSize: '10px', background: '#f1f5f9', color: '#64748b' }}>
                          {l.employeeName?.split(' ').map(n=>n[0]).join('')}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{l.employeeName}</div>
                          <div style={{ fontSize: '10px', color: '#94a3b8' }}>{l.employeeId}</div>
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
                  </tr>
                ))}
                {stats.filteredLeaves.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px 12px', color: '#94a3b8' }}>
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

      <style>{`
        .report-redesign-page { display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .ts-dashboard-content { animation: fadeIn 0.4s ease-out; box-sizing: border-box; width: 100%; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ts-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes ts-spin { to { transform: rotate(360deg); } }
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
        .ts-emp-card:hover { transform: translateY(-2px); box-shadow: 0 8px 16px -8px rgba(0,0,0,0.1); border-color: #6366f1; }
        .ts-emp-card::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: #6366f1; opacity: 0; transition: 0.2s; }
        .ts-emp-card:hover::after { opacity: 1; }

        .ts-card-top { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .ts-avatar { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
        .ts-card-name { font-size: 13px; font-weight: 700; color: #1e293b; }
        .ts-card-id { font-size: 11px; color: #94a3b8; font-family: monospace; }

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
        .ts-empty-st { text-align: center; color: #94a3b8; font-size: 13px; }
        
        .text-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        @media (max-width: 768px) {
          .ts-dashboard-content { padding: 10px 10px 16px !important; }
          .ts-metrics-row { grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; }
        }
      `}</style>
    </div>
  );
};

export default AdminLeaveReport;
