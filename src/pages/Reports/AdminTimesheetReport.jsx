import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  Calendar, 
  RefreshCw, 
  Download, 
  Users, 
  Clock, 
  Target, 
  Briefcase,
  TrendingUp,
  FileText,
  Clock3,
  CalendarDays
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { timesheetAPI } from '../../services/api';
import toast from 'react-hot-toast';
import Header from '../../components/Header';

const COLORS_PALETTE = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

const formatHours = (h) => {
  if (!h && h !== 0) return '0:00';
  const numHours = parseFloat(h);
  if (isNaN(numHours)) return '0:00';
  
  const absHours = Math.abs(numHours);
  const hours = Math.floor(absHours);
  const minutes = Math.round((absHours - hours) * 60);
  
  const finalH = minutes === 60 ? hours + 1 : hours;
  const finalM = minutes === 60 ? 0 : minutes;
  
  const sign = numHours < 0 ? '-' : '';
  return `${sign}${finalH}:${String(finalM).padStart(2, '0')}`;
};

const formatTimeTo12h = (timeStr) => {
  if (!timeStr) return '-';
  try {
    const [h, m] = timeStr.split(':');
    const hh = parseInt(h);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  } catch (e) { return timeStr; }
};

const AdminTimesheetReport = () => {
  const startDateRef = useRef(null);
  const endDateRef = useRef(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [serverStats, setServerStats] = useState(null);
  const [filters, setFilters] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = now;
    
    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    return {
      startDate: fmt(start),
      endDate: fmt(end),
      billable: 'ALL'
    };
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await timesheetAPI.getApprovedEntries(filters.startDate, filters.endDate);
      const data = response.data;
      setEntries(data?.entries || []);
      
      // Store analytics metadata from server
      setServerStats({
        totalHours: data?.totalHours || 0,
        billableCount: data?.billableCount || 0,
        nonBillableCount: data?.nonBillableCount || 0,
        hoursByProject: data?.hoursByProject || {},
        hoursByEmployee: data?.hoursByEmployee || {},
        hoursByDate: data?.hoursByDate || {},
        hoursByTask: data?.hoursByTask || {},
        employeeBreakdown: data?.employeeBreakdown || {}
      });
    } catch (error) {
      console.error('Error fetching timesheet report:', error);
      toast.error('Failed to fetch timesheet report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters.startDate, filters.endDate]);

  // Derived data for metrics and cards
  const stats = useMemo(() => {
    const filtered = entries.filter(e => {
      if (filters.billable === 'YES') return e.billable;
      if (filters.billable === 'NO') return !e.billable;
      return true;
    });

    const searchFiltered = filtered.filter(e => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (
        e.employeeName?.toLowerCase().includes(s) ||
        e.employeeId?.toLowerCase().includes(s) ||
        e.projectName?.toLowerCase().includes(s) ||
        e.taskName?.toLowerCase().includes(s) ||
        e.description?.toLowerCase().includes(s)
      );
    });

    const employeeMap = searchFiltered.reduce((acc, e) => {
      const id = e.employeeId || 'N/A';
      if (!acc[id]) {
        acc[id] = {
          id,
          name: e.employeeName,
          totalHours: 0,
          billableHours: 0,
          nonBillableHours: 0,
          entries: [],
          entryCount: 0
        };
      }
      acc[id].totalHours += (e.hours || 0);
      if (e.billable) acc[id].billableHours += (e.hours || 0);
      else acc[id].nonBillableHours += (e.hours || 0);
      acc[id].entries.push(e);
      acc[id].entryCount += 1;
      return acc;
    }, {});

    const employeeList = Object.values(employeeMap).sort((a, b) => b.totalHours - a.totalHours);
    
    // Use server-side stats if available, otherwise calculate locally
    const totalHours = serverStats ? serverStats.totalHours : employeeList.reduce((acc, e) => acc + e.totalHours, 0);
    const billableCount = serverStats ? serverStats.billableCount : filtered.filter(e => e.billable).length;
    const nonBillableCount = serverStats ? serverStats.nonBillableCount : filtered.filter(e => !e.billable).length;
    
    const billableHours = employeeList.reduce((acc, e) => acc + e.billableHours, 0);
    const nonBillableHours = employeeList.reduce((acc, e) => acc + e.nonBillableHours, 0);
    const billPct = totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0;
    const avgPerPerson = employeeList.length > 0 ? (totalHours / employeeList.length) : 0;

    return {
      employeeList,
      totalHours,
      billableHours,
      nonBillableHours,
      billPct,
      avgPerPerson,
      activeEmployees: employeeList.length,
      filteredEntries: searchFiltered
    };
  }, [entries, filters.billable, searchTerm]);

  const handleExport = () => {
    const headers = ['Employee Name', 'Employee ID', 'Date', 'Project', 'Task', 'Hours', 'Billable', 'Description'];
    const csvContent = [
      headers.join(','),
      ...stats.filteredEntries.map(row => [
        `"${row.employeeName}"`,
        `"${row.employeeId}"`,
        row.workDate,
        `"${row.projectName}"`,
        `"${row.taskName}"`,
        row.hours,
        row.billable ? 'Yes' : 'No',
        `"${(row.description || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const ts = new Date().getTime();
    link.download = `Timesheet_Report_${filters.startDate}_to_${filters.endDate}_${ts}.csv`;
    link.click();
    toast.success('Report exported successfully');
  };

  return (
    <div className="main-content report-redesign-page">
      <Header 
        title="Timesheet Intelligence" 
        subtitle="Organization-wide productivity and billable analysis" 
      />

      <div className="ts-dashboard-content" style={{ padding: '14px 16px 20px' }}>
        {/* Controls Row */}
        <div className="ts-page-header">
          <div className="ts-hcontrols">
            <div className="ts-search-wrap">
              <Search size={16} style={{ color: '#9ca3b0' }} />
              <input 
                placeholder="Search employee, project, task..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="ts-date-wrap">
              <Calendar 
                size={14} 
                style={{ color: '#6366f1', cursor: 'pointer' }} 
                onClick={() => {
                  if (startDateRef.current) {
                    try {
                      startDateRef.current.showPicker();
                    } catch (err) {
                      startDateRef.current.focus();
                    }
                  }
                }}
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
                onClick={() => {
                  if (endDateRef.current) {
                    try {
                      endDateRef.current.showPicker();
                    } catch (err) {
                      endDateRef.current.focus();
                    }
                  }
                }}
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
                className={`ts-chip ${filters.billable === 'ALL' ? 'active' : ''}`} 
                onClick={() => setFilters(p => ({ ...p, billable: 'ALL' }))}
              >All</button>
              <button 
                className={`ts-chip ${filters.billable === 'YES' ? 'active' : ''}`} 
                onClick={() => setFilters(p => ({ ...p, billable: 'YES' }))}
              >Billable</button>
              <button 
                className={`ts-chip ${filters.billable === 'NO' ? 'active' : ''}`} 
                onClick={() => setFilters(p => ({ ...p, billable: 'NO' }))}
              >Non-billable</button>
            </div>
          </div>
        </div>

        {/* AI Insight Banner */}
        <div className="ts-ai-banner">
          <div className="ts-ai-dot"></div>
          <div className="ts-ai-text">
            <strong>Organizational Insight:</strong> The current billable efficiency is <strong>{stats.billPct}%</strong>. 
            Across {stats.activeEmployees} active contributors, <strong>{formatHours(stats.billableHours)}h</strong> were directly logged to client projects. 
            The remaining <strong>{formatHours(stats.nonBillableHours)}h</strong> represents internal operations, training, and support activities.
          </div>
        </div>

        {/* Metrics Row */}
        <div className="ts-metrics-row">
          <div className="ts-metric">
            <span className="ts-metric-lbl">Active Contributors</span>
            <span className="ts-metric-val ts-bl">{stats.activeEmployees}</span>
            <span className="ts-metric-sub">Across all departments</span>
          </div>
          <div className="ts-metric">
            <span className="ts-metric-lbl">Total Hours Logged</span>
            <span className="ts-metric-val">{formatHours(stats.totalHours)}</span>
            <span className="ts-metric-sub">Total effort in period</span>
          </div>
          <div className="ts-metric">
            <span className="ts-metric-lbl">Billable Efficiency</span>
            <span className="ts-metric-val ts-gn">{stats.billPct}%</span>
            <span className="ts-metric-sub ts-gn">{formatHours(stats.billableHours)}h logged</span>
          </div>
          <div className="ts-metric">
            <span className="ts-metric-lbl">Operational Load</span>
            <span className="ts-metric-val ts-rd">{100 - stats.billPct}%</span>
            <span className="ts-metric-sub ts-rd">{formatHours(stats.nonBillableHours)}h non-billable</span>
          </div>
          <div className="ts-metric">
            <span className="ts-metric-lbl">Avg Intensity</span>
            <span className="ts-metric-val ts-am">{formatHours(stats.avgPerPerson)}h</span>
            <span className="ts-metric-sub">Hours per contributor</span>
          </div>
        </div>

        {/* Charts Row */}
        {serverStats && (
          <div className="ts-charts-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div className="ts-card" style={{ padding: '12px' }}>
              <div className="ts-card-header" style={{ marginBottom: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Productivity Trend</h3>
                <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Total hours logged per day</p>
              </div>
              <div style={{ width: '100%', height: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={Object.entries(serverStats.hoursByDate || {}).map(([date, hours]) => ({ date, hours })).sort((a,b) => a.date.localeCompare(b.date))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#94a3b8' }} 
                      tickFormatter={(val) => val.split('-').slice(1).join('/')}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip 
                      cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px' }}
                    />
                    <Bar dataKey="hours" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="ts-card" style={{ padding: '12px' }}>
              <div className="ts-card-header" style={{ marginBottom: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Project Allocation</h3>
                <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Hour distribution by project</p>
              </div>
              <div style={{ width: '100%', height: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(serverStats.hoursByProject || {}).map(([name, value]) => ({ name, value }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {Object.entries(serverStats.hoursByProject || {}).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS_PALETTE[index % COLORS_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                       contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Employee Cards Grid */}
        <div className="ts-sec-header" style={{ marginTop: '12px' }}>
          <span className="ts-sec-title">Efficiency Leaderboard</span>
          <span className="ts-sec-hint">Sorted by total hours logged</span>
        </div>

        <div className="ts-emp-grid">
          {stats.employeeList.map((emp, idx) => {
            const billPct = emp.totalHours > 0 ? (emp.billableHours / emp.totalHours) * 100 : 0;
            const effColor = billPct >= 70 ? '#10b981' : billPct >= 40 ? '#f59e0b' : '#ef4444';
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
                    <div className="ts-card-id">{emp.id}</div>
                  </div>
                </div>
                <div className="ts-hours-big">{formatHours(emp.totalHours)}</div>
                <div className="ts-hours-sub">{emp.entryCount} total entries logged</div>
                
                <div className="ts-bar-track">
                  <div className="ts-bar-bill" style={{ width: `${billPct}%`, background: effColor }}></div>
                </div>
                
                <div className="ts-pill-row">
                  <span className="ts-pill ts-pill-g">{formatHours(emp.billableHours)}h Bill</span>
                  <span className="ts-pill ts-pill-r">{formatHours(emp.nonBillableHours)}h Non-Billable</span>
                </div>
                
                <div className="ts-card-footer">
                  <span className="ts-eff-lbl">Billable Rate</span>
                  <span className="ts-eff-val" style={{ color: effColor }}>{Math.round(billPct)}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detailed Table */}
        <div className="ts-sec-header" style={{ marginTop: '16px' }}>
          <span className="ts-sec-title">Detailed Audit Log</span>
        </div>
        
        <div className="ts-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="ts-table">
              <thead>
                <tr>
                  <th className="ts-th">Employee</th>
                  <th className="ts-th">Date</th>
                  <th className="ts-th">Project / Task</th>
                  <th className="ts-th">Hours</th>
                  <th className="ts-th" style={{ textAlign: 'center' }}>Billable</th>
                  <th className="ts-th">Approved By</th>
                  <th className="ts-th">Submitted</th>
                  <th className="ts-th">Approved</th>
                  <th className="ts-th">Description</th>
                </tr>
              </thead>
              <tbody>
                {stats.filteredEntries.map((e, idx) => (
                  <tr key={idx} className={idx % 2 !== 0 ? 'ts-row-alt' : ''}>
                    <td className="ts-td">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="ts-avatar" style={{ width: '24px', height: '24px', fontSize: '10px', background: '#f1f5f9', color: '#64748b' }}>
                          {e.employeeName?.split(' ').map(n=>n[0]).join('')}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{e.employeeName}</div>
                          <div style={{ fontSize: '10px', color: '#94a3b8' }}>{e.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="ts-td" style={{ fontFamily: 'monospace', color: '#64748b' }}>{e.workDate}</td>
                    <td className="ts-td">
                      <div style={{ fontWeight: 600 }}>{e.projectName}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{e.taskName}</div>
                    </td>
                    <td className="ts-td">
                      <div style={{ fontWeight: 700, color: '#1e293b' }}>{formatHours(e.hours)}</div>
                    </td>
                    <td className="ts-td" style={{ textAlign: 'center' }}>
                      {e.billable 
                        ? <span style={{ color: '#10b981', fontWeight: 600 }}>Yes</span>
                        : <span style={{ color: '#ef4444', fontWeight: 600 }}>No</span>
                      }
                    </td>
                    <td className="ts-td">
                      <div style={{ fontWeight: 500 }}>{e.approvedByName || '-'}</div>
                    </td>
                    <td className="ts-td" style={{ fontSize: '11px', color: '#64748b' }}>
                      {e.submittedAt ? new Date(e.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                    </td>
                    <td className="ts-td" style={{ fontSize: '11px', color: '#64748b' }}>
                      {e.approvedAt ? new Date(e.approvedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                    </td>
                    <td className="ts-td">
                      <div style={{ maxWidth: '150px' }} className="text-truncate" title={e.description}>
                        {e.description || '-'}
                      </div>
                    </td>
                  </tr>
                ))}
                {stats.filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '24px 12px', color: '#94a3b8' }}>
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
        .ts-search-wrap input { border: none; outline: none; width: 100%; font-size: 13px; background: transparent; color: #0f172a; }

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
        
        .text-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        @media (max-width: 900px) {
          .ts-charts-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 768px) {
          .ts-dashboard-content { padding: 10px 10px 16px !important; }
          .ts-metrics-row { grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; }
        }
      `}</style>
    </div>
  );
};

export default AdminTimesheetReport;
