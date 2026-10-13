import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Calendar, 
  RefreshCw, 
  Download, 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Briefcase,
  MapPin,
  TrendingUp,
  FileText,
  UserCheck,
  UserX,
  Wifi,
  CalendarDays
} from 'lucide-react';
import { reportingAPI } from '../../services/api';
import toast from 'react-hot-toast';
import Header from '../../components/Header';

const COLORS_PALETTE = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

const STATUS_BADGE = ({ status }) => {
  const cfg = {
    'PRESENT': { bg: '#ecfdf5', text: '#059669', dot: '#10b981', label: 'Present' },
    'WFH': { bg: '#eff6ff', text: '#2563eb', dot: '#3b82f6', label: 'WFH' },
    'ABSENT': { bg: '#fef2f2', text: '#dc2626', dot: '#ef4444', label: 'Absent' },
    'LEAVE': { bg: '#fffbeb', text: '#d97706', dot: '#f59e0b', label: 'On Leave' },
    'HOLIDAY': { bg: '#f5f3ff', text: '#7c3aed', dot: '#8b5cf6', label: 'Holiday' },
    'OPTIONAL_HOLIDAY': { bg: '#fdf2f8', text: '#db2777', dot: '#ec4899', label: 'Optional Holiday' }
  };
  const s = cfg[status] || { bg: '#f8fafc', text: '#64748b', dot: '#94a3b8', label: status };
  return (
    <div style={{ 
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 8px', borderRadius: '20px', background: s.bg,
      color: s.text, fontSize: '11px', fontWeight: 600
    }}>
      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: s.dot }}></div>
      {s.label}
    </div>
  );
};

const AdminAttendanceReport = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [serverStats, setServerStats] = useState(null);
  const [filters, setFilters] = useState(() => {
    const now = new Date();
    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    return {
      date: fmt(now),
      attendanceStatus: ''
    };
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await reportingAPI.getDailyAttendanceReport(filters);
      const resData = response.data;
      setData(resData?.data || []);
      
      // Store analytics metadata from server
      setServerStats({
        statusCounts: resData?.statusCounts || {},
        totalHours: resData?.totalHours || 0,
        totalCount: resData?.totalCount || 0
      });
    } catch (error) {
      console.error('Error fetching attendance intelligence:', error);
      toast.error('Failed to fetch attendance intelligence');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters.date, filters.attendanceStatus]);

  const stats = useMemo(() => {
    // Priority to server stats, fallback to local calculation
    const present = serverStats?.statusCounts?.PRESENT || data.filter(d => d.status === 'PRESENT').length;
    const wfh = serverStats?.statusCounts?.WFH || data.filter(d => d.status === 'WFH').length;
    const absent = serverStats?.statusCounts?.ABSENT || data.filter(d => d.status === 'ABSENT').length;
    const leave = serverStats?.statusCounts?.LEAVE || data.filter(d => d.status === 'LEAVE').length;
    const totalHours = serverStats?.totalHours || data.reduce((acc, d) => acc + parseFloat(d.totalHours || 0), 0);

    const filtered = data.filter(d => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (
        d.employeeName?.toLowerCase().includes(s) ||
        d.employeeId?.toLowerCase().includes(s) ||
        d.department?.toLowerCase().includes(s) ||
        d.workLocation?.toLowerCase().includes(s)
      );
    });

    return {
      present,
      wfh,
      absent,
      leave,
      totalHours,
      filteredData: filtered
    };
  }, [data, serverStats, searchTerm]);

  const handleExport = () => {
    const headers = ['Employee Name', 'Employee ID', 'Department', 'Status', 'Clock In', 'Clock Out', 'Total Hours', 'Work Location'];
    const csvContent = [
      headers.join(','),
      ...stats.filteredData.map(row => [
        `"${row.employeeName}"`,
        `"${row.employeeId}"`,
        `"${row.department || ''}"`,
        row.status,
        row.checkInTime || '',
        row.checkOutTime || '',
        row.totalHours || '0',
        `"${row.workLocation || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Attendance_Intelligence_Report_${filters.date}.csv`;
    link.click();
    toast.success('Report exported successfully');
  };

  const kpis = [
    { label: 'Present Today', value: stats.present, icon: UserCheck, color: '#10b981', sub: 'In-office staff' },
    { label: 'WFH Active', value: stats.wfh, icon: Wifi, color: '#3b82f6', sub: 'Remote working' },
    { label: 'Absent', value: stats.absent, icon: UserX, color: '#ef4444', sub: 'Not clocked in' },
    { label: 'On Leave', value: stats.leave, icon: CalendarDays, color: '#f59e0b', sub: 'Approved absence' },
    { label: 'Total Hours', value: stats.totalHours.toFixed(1), icon: Clock, color: '#8b5cf6', sub: 'Org-wide productivity' },
  ];

  return (
    <div className="main-content report-redesign-page">
      <Header 
        title="Attendance Intelligence" 
        subtitle="Real-time workforce presence and productivity metrics" 
      />

      <div className="ts-dashboard-content" style={{ padding: '14px 16px 20px' }}>
        {/* Controls Row */}
        <div className="ts-page-header">
          <div className="ts-hcontrols">
            <div className="ts-search-wrap">
              <Search size={16} style={{ color: '#9ca3b0', flexShrink: 0 }} aria-hidden />
              <input
                type="search"
                placeholder="Filter by name, ID or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Filter attendance records"
              />
            </div>
            
            <div className="ts-date-wrap">
              <Calendar size={14} style={{ color: '#6366f1' }} />
              <input 
                type="date" 
                value={filters.date} 
                onChange={(e) => setFilters(p => ({ ...p, date: e.target.value }))} 
              />
              <select 
                value={filters.attendanceStatus}
                onChange={(e) => setFilters(p => ({ ...p, attendanceStatus: e.target.value }))}
                style={{ marginLeft: '6px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              >
                <option value="">All Statuses</option>
                <option value="PRESENT">Present</option>
                <option value="WFH">WFH</option>
                <option value="ABSENT">Absent</option>
                <option value="LEAVE">Leave</option>
                <option value="OPTIONAL_HOLIDAY">Optional Holiday</option>
              </select>
              <button onClick={fetchData} className="ts-refresh-btn-mini" title="Refresh">
                <RefreshCw size={14} className={loading ? 'ts-spin' : ''} />
              </button>
              <button onClick={handleExport} className="ts-refresh-btn-mini" title="Export CSV">
                <Download size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="ov-grid" style={{ marginBottom: '12px' }}>
          {kpis.map((k, i) => {
            const Icon = k.icon;
            return (
              <div key={i} className="ov-card">
                <div className="ov-icon-box" style={{ background: `${k.color}12` }}>
                  <Icon size={16} color={k.color} />
                </div>
                <div className="ov-num">{k.value}</div>
                <div className="ov-lbl">{k.label}</div>
                <div className="ov-sub">{k.sub}</div>
              </div>
            );
          })}
        </div>

        {/* AI Insight Banner */}
        <div className="ts-ai-banner" style={{ marginBottom: '12px' }}>
          <div className="ts-ai-spark">✨</div>
          <div className="ts-ai-content">
            <div className="ts-ai-title">Workforce Presence Insight</div>
            <div className="ts-ai-text">
              Organization is operating at <strong>{((stats.present + stats.wfh) / (stats.present + stats.wfh + stats.absent + stats.leave + 0.001) * 100).toFixed(0)}% capacity</strong> today. 
              {stats.absent > 5 ? ` High absenteeism (${stats.absent}) detected — consider reviewing attendance policy compliance.` : ' Attendance levels are within healthy organizational thresholds.'}
              {stats.wfh > stats.present ? ' Remote work is currently the primary mode of operation.' : ' On-site presence is leading today.'}
            </div>
          </div>
        </div>

        {/* Attendance Table */}
        <div className="ts-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="team-table-hd" style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
            <h3 className="team-table-title" style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
              Detailed Attendance Audit &ndash; {new Date(filters.date).toLocaleDateString(undefined, { dateStyle: 'long' })}
            </h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="ts-table">
              <thead>
                <tr>
                  <th className="ts-th">Employee</th>
                  <th className="ts-th">Department</th>
                  <th className="ts-th">Status</th>
                  <th className="ts-th">Clock In / Out</th>
                  <th className="ts-th">Total Hours</th>
                  <th className="ts-th">Work Location</th>
                </tr>
              </thead>
              <tbody>
                {stats.filteredData.map((row, i) => {
                  const initials = (row.employeeName || '').split(' ').map(n => n[0]).join('');
                  return (
                    <tr key={i} className={i % 2 === 0 ? '' : 'ts-row-alt'}>
                      <td className="ts-td">
                        <div className="emp-info">
                          <div className="u-av" style={{ 
                            background: `${COLORS_PALETTE[i % COLORS_PALETTE.length]}15`,
                            color: COLORS_PALETTE[i % COLORS_PALETTE.length]
                          }}>
                            {initials}
                          </div>
                          <div>
                            <div className="emp-nm-row">{row.employeeName}</div>
                            <div className="emp-id-sub">{row.employeeId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="ts-td">
                        <div style={{ fontWeight: 500, color: '#475569' }}>{row.department || '-'}</div>
                      </td>
                      <td className="ts-td">
                        <STATUS_BADGE status={row.status} />
                      </td>
                      <td className="ts-td">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 500, color: '#1e293b' }}>
                            <Clock size={12} color="#10b981" /> {row.checkInTime || '--:--'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748b' }}>
                            <Clock size={12} color="#ef4444" /> {row.checkOutTime || '--:--'}
                          </div>
                        </div>
                      </td>
                      <td className="ts-td">
                        <div style={{ fontWeight: 700, color: '#6366f1', fontFamily: 'DM Mono' }}>
                          {parseFloat(row.totalHours || 0).toFixed(1)}
                        </div>
                      </td>
                      <td className="ts-td">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={14} color="#94a3b8" />
                          <span style={{ fontSize: '13px', color: '#475569' }}>{row.workLocation || '-'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {stats.filteredData.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px 12px', color: '#94a3b8' }}>
                      <FileText size={36} style={{ margin: '0 auto 8px', opacity: 0.2 }} />
                      <div>No attendance records found for the selected criteria.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .report-redesign-page {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
          background: #f8fafc;
        }
        .ts-dashboard-content {
          width: 100%;
          max-width: none;
          margin: 0;
          box-sizing: border-box;
        }
        .ts-page-header {
          margin-bottom: 12px;
        }
        .ts-hcontrols {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .ts-search-wrap {
          display: flex;
          align-items: center;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 0 12px;
          height: 34px;
          flex: 1;
          min-width: 220px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }
        .ts-search-wrap:focus-within {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }
        .ts-search-wrap input {
          border: none;
          outline: none;
          margin-left: 8px;
          width: 100%;
          font-size: 13px;
          color: #1e293b;
          background: transparent;
          background-color: transparent;
          padding: 0;
          box-shadow: none;
        }
        .ts-search-wrap input::placeholder {
          color: #94a3b8;
        }
        .ts-search-wrap input:focus {
          outline: none;
          box-shadow: none;
        }
        .ts-date-wrap {
          display: flex;
          align-items: center;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 0 10px;
          height: 34px;
          gap: 6px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
          box-sizing: border-box;
        }
        .ts-date-wrap input {
          border: none;
          outline: none;
          font-size: 12px;
          color: #475569;
          font-weight: 500;
          background: transparent;
          background-color: transparent;
          padding: 0;
          box-shadow: none;
        }
        .ts-date-wrap select {
          background: transparent;
          background-color: transparent;
        }
        .ts-refresh-btn-mini {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #64748b;
          transition: all 0.2s;
          box-sizing: border-box;
        }
        .ts-refresh-btn-mini:hover {
          background: #f1f5f9;
          color: #6366f1;
          border-color: #6366f1;
        }
        .ts-spin { animation: ts-spin 1s linear infinite; }
        @keyframes ts-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .ov-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
        }
        .ov-card {
          background: #fff;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
          transition: transform 0.2s;
        }
        .ov-card:hover { transform: translateY(-1px); }
        .ov-icon-box {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
        }
        .ov-num { font-size: 20px; font-weight: 800; color: #1e293b; margin-bottom: 2px; }
        .ov-lbl { font-size: 12px; font-weight: 600; color: #64748b; }
        .ov-sub { font-size: 10px; color: #94a3b8; margin-top: 2px; }

        .ts-ai-banner {
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          border-radius: 10px;
          padding: 10px 12px;
          color: #fff;
          display: flex;
          gap: 10px;
          align-items: center;
          box-shadow: 0 4px 10px -3px rgba(79, 70, 229, 0.2);
        }
        .ts-ai-spark { font-size: 18px; }
        .ts-ai-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.9; margin-bottom: 2px; }
        .ts-ai-text { font-size: 13px; line-height: 1.45; font-weight: 500; }

        .ts-card { background: #fff; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04); }
        .ts-table { width: 100%; border-collapse: collapse; }
        .ts-th { padding: 8px 12px; background: #f8fafc; text-align: left; font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #f1f5f9; }
        .ts-td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        .ts-row-alt { background: #fbfcfd; }
        .emp-info { display: flex; align-items: center; gap: 8px; }
        .u-av { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
        .emp-nm-row { font-size: 13px; font-weight: 600; color: #1e293b; }
        .emp-id-sub { font-size: 10px; color: #64748b; }

        @media (max-width: 768px) {
          .ts-dashboard-content { padding: 10px 10px 16px !important; }
          .ov-grid { grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; }
        }
      `}} />
    </div>
  );
};

export default AdminAttendanceReport;
