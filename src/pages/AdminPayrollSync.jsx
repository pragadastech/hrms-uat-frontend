import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import { payrollSyncAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  RefreshCw,
  Users,
  CalendarDays,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Info,
  Link2,
  ArrowRight,
} from 'lucide-react';

function currentMonthValue() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
}

export default function AdminPayrollSync() {
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [syncingEmployees, setSyncingEmployees] = useState(false);
  const [syncingTime, setSyncingTime] = useState(false);
  const [payrollMonth, setPayrollMonth] = useState(currentMonthValue());
  const [lastEmployeeResult, setLastEmployeeResult] = useState(null);
  const [lastTimeResult, setLastTimeResult] = useState(null);

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await payrollSyncAPI.getStatus();
      setStatus(res.data || null);
    } catch (e) {
      setStatus(null);
      const msg =
        e.response?.data?.error ||
        e.response?.data?.message ||
        e.message ||
        'Failed to load sync status';
      toast.error(msg);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const syncEmployees = async () => {
    if (
      !window.confirm(
        'Push all active employees in your organization to Payroll?\n\nCreates/updates identity fields from HRMS. Employees removed or inactivated in HRMS are removed from Payroll. CTC/bank stay in Payroll.'
      )
    ) {
      return;
    }
    setSyncingEmployees(true);
    setLastEmployeeResult(null);
    try {
      const res = await payrollSyncAPI.syncAllEmployees();
      setLastEmployeeResult(res.data);
      const synced = res.data?.synced ?? 0;
      const deactivated = res.data?.deactivated ?? 0;
      const failed = res.data?.failed ?? 0;
      if (failed > 0) {
        toast.error(`Synced ${synced}, removed ${deactivated}, failed ${failed}`);
      } else {
        toast.success(
          deactivated > 0
            ? `Synced ${synced} employee(s); removed ${deactivated} no longer active in HRMS`
            : `Synced ${synced} employee(s) to Payroll`
        );
      }
    } catch (e) {
      const msg =
        e.response?.data?.error ||
        e.response?.data?.message ||
        e.message ||
        'Employee sync failed';
      toast.error(msg);
    } finally {
      setSyncingEmployees(false);
    }
  };

  const syncTime = async () => {
    if (!/^\d{4}-\d{2}$/.test(payrollMonth)) {
      toast.error('Use month format YYYY-MM');
      return;
    }
    if (
      !window.confirm(
        `Push LOP / attendance time summary for ${payrollMonth} to Payroll for your organization?`
      )
    ) {
      return;
    }
    setSyncingTime(true);
    setLastTimeResult(null);
    try {
      const res = await payrollSyncAPI.syncTimeForMonth(payrollMonth);
      setLastTimeResult(res.data);
      const upserted = res.data?.upserted ?? 0;
      toast.success(`Pushed time summary for ${upserted} employee(s)`);
    } catch (e) {
      const msg =
        e.response?.data?.error ||
        e.response?.data?.message ||
        e.message ||
        'Time sync failed';
      toast.error(msg);
    } finally {
      setSyncingTime(false);
    }
  };

  const enabled = status?.payrollIntegrationEnabled === true;
  const payrollAppUrl = status?.payrollAppUrl;

  return (
    <div className="main-content flex flex-col h-screen">
      <Header
        title="Payroll Sync"
        subtitle="Optional bridge › HRMS → Pragva Payroll when both products are used"
      />

      <div className="page-content flex-1 overflow-y-auto p-6" style={{ background: '#f8fafc' }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 flex gap-3">
            <Info size={18} className="shrink-0 mt-0.5 text-slate-500" />
            <div>
              <p className="font-medium text-slate-800">HRMS and Payroll are separate products</p>
              <p className="mt-0.5">
                Use HRMS alone for people ops, or Payroll alone for pay (add staff in Payroll).
                When both are purchased under the same Suite company, Sync keeps tenancy aligned
                and pushes roster/time one-way into Payroll.
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  {loadingStatus ? (
                    <RefreshCw size={20} className="animate-spin text-gray-400" />
                  ) : enabled ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    <AlertCircle size={20} />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Integration status</h2>
                  <p className="text-sm text-gray-500">
                    {loadingStatus
                      ? 'Checking connection…'
                      : enabled
                        ? 'Connected — one-way HRMS → Payroll for this Suite company'
                        : 'Off — HRMS works alone. Enable only if this company also uses Pragva Payroll.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`badge ${enabled ? 'badge-active' : 'badge-inactive'}`}
                >
                  {loadingStatus ? 'Checking' : enabled ? 'Enabled' : 'Disabled'}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={loadStatus}
                  title="Refresh status"
                  disabled={loadingStatus}
                >
                  <RefreshCw size={18} className={loadingStatus ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="stat-card !p-4 !mb-0">
                <div className="stat-card-header">
                  <span className="stat-card-title">Direction</span>
                  <div className="stat-card-icon" style={{ background: '#eef2ff', color: '#4f46e5' }}>
                    <ArrowRight size={16} />
                  </div>
                </div>
                <div className="stat-card-value !text-base !mt-2">
                  {status?.direction || 'hrms_to_payroll_only'}
                </div>
              </div>
              <div className="stat-card !p-4 !mb-0">
                <div className="stat-card-header">
                  <span className="stat-card-title">Scope</span>
                  <div className="stat-card-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                    <Users size={16} />
                  </div>
                </div>
                <div className="stat-card-value !text-base !mt-2">Current tenant only</div>
              </div>
              <div className="stat-card !p-4 !mb-0">
                <div className="stat-card-header">
                  <span className="stat-card-title">Payroll app</span>
                  <div className="stat-card-icon" style={{ background: '#fff7ed', color: '#ea580c' }}>
                    <Link2 size={16} />
                  </div>
                </div>
                <div className="stat-card-value !text-base !mt-2">
                  {payrollAppUrl ? (
                    <a
                      href={payrollAppUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Open <ExternalLink size={14} />
                    </a>
                  ) : (
                    <span className="text-gray-400 text-sm font-normal">Not configured</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Employee sync */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Users size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Sync all employees</h2>
                <p className="text-sm text-gray-500">
                  Push identity fields (ID, name, email, department, joining date, active flag).
                  CTC and bank details stay in Payroll.
                </p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <button
                type="button"
                className="add-employee-btn"
                disabled={!enabled || syncingEmployees}
                onClick={syncEmployees}
              >
                {syncingEmployees ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <Users size={18} />
                )}
                {syncingEmployees ? 'Syncing employees…' : 'Sync all employees'}
              </button>

              {lastEmployeeResult && (
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <div className="flex flex-wrap gap-4 text-sm mb-2">
                    <span className="font-medium text-emerald-700">
                      Synced: {lastEmployeeResult.synced ?? 0}
                    </span>
                    <span
                      className={`font-medium ${
                        (lastEmployeeResult.failed ?? 0) > 0 ? 'text-amber-700' : 'text-gray-600'
                      }`}
                    >
                      Failed: {lastEmployeeResult.failed ?? 0}
                    </span>
                  </div>
                  {Array.isArray(lastEmployeeResult.errors) &&
                    lastEmployeeResult.errors.length > 0 && (
                      <ul className="mt-2 space-y-1 text-sm text-amber-800 list-disc pl-5 max-h-40 overflow-y-auto">
                        {lastEmployeeResult.errors.map((err) => (
                          <li key={err}>{err}</li>
                        ))}
                      </ul>
                    )}
                </div>
              )}
            </div>
          </div>

          {/* Time sync */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <CalendarDays size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Sync month time / LOP / OT</h2>
                <p className="text-sm text-gray-500">
                  Push attendance-based LOP and approved OT so Payroll can prorate salary for the
                  month.
                </p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Payroll month</label>
                  <input
                    type="month"
                    value={payrollMonth}
                    onChange={(e) => setPayrollMonth(e.target.value)}
                    className="form-input bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 block"
                  />
                </div>
                <button
                  type="button"
                  className="add-employee-btn"
                  disabled={!enabled || syncingTime}
                  onClick={syncTime}
                >
                  {syncingTime ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <CalendarDays size={18} />
                  )}
                  {syncingTime ? 'Syncing time…' : 'Sync time for month'}
                </button>
              </div>

              {lastTimeResult && (
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
                  <span className="font-medium text-gray-900">
                    Month: {lastTimeResult.payroll_month || payrollMonth}
                  </span>
                  {' · '}
                  Upserted: {lastTimeResult.upserted ?? 0}
                  {lastTimeResult.message ? ` — ${lastTimeResult.message}` : ''}
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex gap-3 rounded-xl border border-indigo-100 bg-indigo-50/80 p-4 text-sm text-indigo-900">
            <Info size={18} className="shrink-0 mt-0.5 text-indigo-600" />
            <p>
              Use <strong>Sync all employees</strong> for the first push (and after bulk HR
              changes). Use <strong>Sync time</strong> each month before running payroll in the
              Payroll app.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
