import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  Calendar,
  Home,
  Building2,
  User,
  Lock,
  Loader2,
  Eye,
  KeyRound,
  Briefcase,
  LogOut,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Header from '../components/Header';
import {
  employeeAPI,
  adminAPI,
  wfhAPI,
  exitAPI,
} from '../services/api';
import './EmployeeSettings.css';

const DAY_LABELS = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
];

function formatTimeLabel(time) {
  if (!time) return null;
  const parts = String(time).split(':').map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0])) return time;
  const h = parts[0];
  const m = parts[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatLimit(value) {
  if (value === null || value === undefined || value === '') return 'Unlimited';
  return String(value);
}

function ReadonlyBadge() {
  return (
    <span className="es-readonly-badge">
      <Eye size={12} aria-hidden="true" />
      View only
    </span>
  );
}

export default function EmployeeSettings() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [weekendConfig, setWeekendConfig] = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [wfhPolicy, setWfhPolicy] = useState(null);
  const [wfhAvailability, setWfhAvailability] = useState(null);
  const [noticePeriod, setNoticePeriod] = useState(null);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [
          profileRes,
          weekendRes,
          leaveRes,
          wfhPolicyRes,
          wfhAvailRes,
          noticeRes,
        ] = await Promise.all([
          employeeAPI.getEmployeeProfile().catch(() => null),
          adminAPI.getWeekendConfig().catch(() => null),
          employeeAPI.getActiveLeaveTypes().catch(() => null),
          wfhAPI.getPolicy().catch(() => null),
          wfhAPI.getAvailability().catch(() => null),
          exitAPI.getMyNoticePeriod().catch(() => null),
        ]);
        if (cancelled) return;

        const p = profileRes?.data ?? profileRes ?? null;
        setProfile(p);

        const weekendData = weekendRes?.data ?? weekendRes;
        if (weekendData && typeof weekendData === 'object') {
          setWeekendConfig(weekendData);
        }

        const types = leaveRes?.data ?? leaveRes;
        setLeaveTypes(Array.isArray(types) ? types : []);

        setWfhPolicy(wfhPolicyRes?.data ?? null);
        setWfhAvailability(wfhAvailRes?.data ?? null);

        const notice = noticeRes?.data ?? noticeRes;
        setNoticePeriod(notice);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    setSavingPassword(true);
    try {
      await employeeAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      });
      toast.success('Password updated successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(
        err.response?.data?.message || err.response?.data?.error || 'Failed to update password'
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const shiftLabel = (() => {
    const name = profile?.shiftName || profile?.shift?.name;
    const start = formatTimeLabel(profile?.shiftStartTime || profile?.shift?.startTime);
    const end = formatTimeLabel(profile?.shiftEndTime || profile?.shift?.endTime);
    const details = profile?.shiftDetails;
    if (name && start && end) return `${name} (${start} – ${end})`;
    if (start && end) return `${start} – ${end}`;
    if (details) return details;
    if (name) return name;
    return 'Not assigned';
  })();

  const weekOffDays = weekendConfig
    ? DAY_LABELS.filter((d) => weekendConfig[d.key]).map((d) => d.label)
    : [];

  const noticeLabel = (() => {
    if (!noticePeriod) return null;
    if (typeof noticePeriod === 'number') return `${noticePeriod} days`;
    const days =
      noticePeriod.noticePeriodDays ??
      noticePeriod.defaultNoticePeriodDays ??
      noticePeriod.days;
    if (days != null) return `${days} days`;
    return null;
  })();

  return (
    <div className="main-content employee-settings-page">
      <Header
        title="Settings"
        subtitle="Update your account and view company policies that apply to you"
      />

      <div className="page-content">
        {loading ? (
          <div className="es-loading">
            <Loader2 size={32} className="es-spinner" aria-hidden="true" />
            <p>Loading settings…</p>
          </div>
        ) : (
          <div className="es-layout">
            {/* —— Editable —— */}
            <section className="es-section">
              <div className="es-section-head">
                <h2>Your account</h2>
                <p>Changes you are allowed to make</p>
              </div>

              <div className="es-card es-card-editable">
                <div className="es-card-head">
                  <span className="es-card-icon es-icon-profile">
                    <User size={22} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>Profile</h3>
                    <p>Personal details, contact info, and photo</p>
                  </div>
                </div>
                <Link to="/employee/profile" className="es-btn-primary">
                  Edit my profile
                </Link>
              </div>

              <div className="es-card es-card-editable">
                <div className="es-card-head">
                  <span className="es-card-icon es-icon-password">
                    <KeyRound size={22} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>Password</h3>
                    <p>Update your login password</p>
                  </div>
                </div>
                <form className="es-form" onSubmit={handlePasswordSubmit}>
                  <label>
                    <span>Current password</span>
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    <span>New password</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))
                      }
                      required
                      minLength={6}
                    />
                  </label>
                  <label>
                    <span>Confirm new password</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))
                      }
                      required
                      minLength={6}
                    />
                  </label>
                  <button type="submit" className="es-btn-primary" disabled={savingPassword}>
                    {savingPassword ? 'Saving…' : 'Update password'}
                  </button>
                </form>
              </div>
            </section>

            {/* —— Read-only org info —— */}
            <section className="es-section">
              <div className="es-section-head es-section-readonly">
                <div>
                  <h2>Company policies</h2>
                  <p>Set by HR — you can view but not change these</p>
                </div>
                <ReadonlyBadge />
              </div>

              <div className="es-grid">
                <div className="es-card">
                  <div className="es-card-head">
                    <span className="es-card-icon es-icon-shift">
                      <Clock size={22} aria-hidden="true" />
                    </span>
                    <div>
                      <h3>Your shift</h3>
                      <p>Assigned working hours</p>
                    </div>
                    <Lock size={16} className="es-lock" aria-hidden="true" />
                  </div>
                  <p className="es-highlight">{shiftLabel}</p>
                  {profile?.shiftType && (
                    <p className="es-muted">Type: {profile.shiftType}</p>
                  )}
                </div>

                <div className="es-card">
                  <div className="es-card-head">
                    <span className="es-card-icon es-icon-org">
                      <Building2 size={22} aria-hidden="true" />
                    </span>
                    <div>
                      <h3>Work details</h3>
                      <p>Your placement in the organization</p>
                    </div>
                    <Lock size={16} className="es-lock" aria-hidden="true" />
                  </div>
                  <ul className="es-facts">
                    <li>
                      <span>Employee ID</span>
                      <strong>{profile?.employeeId || profile?.empId || '—'}</strong>
                    </li>
                    <li>
                      <span>Department</span>
                      <strong>
                        {profile?.departmentName ||
                          profile?.department?.name ||
                          profile?.department ||
                          '—'}
                      </strong>
                    </li>
                    <li>
                      <span>Designation</span>
                      <strong>
                        {profile?.designation ||
                          profile?.positionName ||
                          profile?.position ||
                          '—'}
                      </strong>
                    </li>
                    <li>
                      <span>Reporting manager</span>
                      <strong>
                        {profile?.reportingManagerName ||
                          profile?.managerName ||
                          '—'}
                      </strong>
                    </li>
                    <li>
                      <span>Location</span>
                      <strong>
                        {profile?.workLocation ||
                          profile?.locationName ||
                          profile?.location ||
                          '—'}
                      </strong>
                    </li>
                  </ul>
                </div>

                <div className="es-card">
                  <div className="es-card-head">
                    <span className="es-card-icon es-icon-weekend">
                      <Calendar size={22} aria-hidden="true" />
                    </span>
                    <div>
                      <h3>Weekends / week off</h3>
                      <p>Non-working days for attendance</p>
                    </div>
                    <Lock size={16} className="es-lock" aria-hidden="true" />
                  </div>
                  {weekOffDays.length > 0 ? (
                    <div className="es-chips">
                      {weekOffDays.map((d) => (
                        <span key={d} className="es-chip">
                          {d}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="es-muted">Weekend configuration not available.</p>
                  )}
                </div>

                <div className="es-card es-card-wide">
                  <div className="es-card-head">
                    <span className="es-card-icon es-icon-leave">
                      <Briefcase size={22} aria-hidden="true" />
                    </span>
                    <div>
                      <h3>Leave types</h3>
                      <p>Leave categories configured for your organization</p>
                    </div>
                    <Lock size={16} className="es-lock" aria-hidden="true" />
                  </div>
                  {leaveTypes.length > 0 ? (
                    <table className="es-table">
                      <thead>
                        <tr>
                          <th>Leave type</th>
                          <th>Code</th>
                          <th>Annual quota</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaveTypes.map((lt) => (
                          <tr key={lt.id || lt.leaveTypeCode}>
                            <td>{lt.leaveTypeName || '—'}</td>
                            <td>
                              <code className="es-code">{lt.leaveTypeCode || '—'}</code>
                            </td>
                            <td>
                              {lt.defaultLeaveCount != null
                                ? lt.defaultLeaveCount
                                : lt.maxDays != null
                                  ? lt.maxDays
                                  : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="es-muted">No active leave types found.</p>
                  )}
                  <p className="es-hint">
                    Your actual balance may differ — check{' '}
                    <Link to="/employee/leaves">My Leaves</Link> for current balances.
                  </p>
                </div>

                <div className="es-card">
                  <div className="es-card-head">
                    <span className="es-card-icon es-icon-wfh">
                      <Home size={22} aria-hidden="true" />
                    </span>
                    <div>
                      <h3>WFH policy</h3>
                      <p>Work from home rules</p>
                    </div>
                    <Lock size={16} className="es-lock" aria-hidden="true" />
                  </div>
                  {wfhPolicy ? (
                    <>
                      <ul className="es-facts">
                        <li>
                          <span>Max per week</span>
                          <strong>{formatLimit(wfhPolicy.maxDaysPerWeek)}</strong>
                        </li>
                        <li>
                          <span>Max per month</span>
                          <strong>{formatLimit(wfhPolicy.maxDaysPerMonth)}</strong>
                        </li>
                        <li>
                          <span>Weekends</span>
                          <strong>{wfhPolicy.allowWeekends ? 'Allowed' : 'Not allowed'}</strong>
                        </li>
                        <li>
                          <span>Holidays</span>
                          <strong>{wfhPolicy.allowHolidays ? 'Allowed' : 'Not allowed'}</strong>
                        </li>
                      </ul>
                      {wfhAvailability && (
                        <div className="es-availability">
                          <p className="es-availability-title">Your remaining WFH allowance</p>
                          <div className="es-availability-pills">
                            <span>
                              This week:{' '}
                              <strong>{wfhAvailability.remainingThisWeek ?? '—'}</strong>
                            </span>
                            <span>
                              This month:{' '}
                              <strong>{wfhAvailability.remainingThisMonth ?? '—'}</strong>
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="es-muted">WFH policy not available.</p>
                  )}
                </div>

                {noticeLabel && (
                  <div className="es-card">
                    <div className="es-card-head">
                      <span className="es-card-icon es-icon-exit">
                        <LogOut size={22} aria-hidden="true" />
                      </span>
                      <div>
                        <h3>Notice period</h3>
                        <p>Applies if you resign from the company</p>
                      </div>
                      <Lock size={16} className="es-lock" aria-hidden="true" />
                    </div>
                    <p className="es-highlight">{noticeLabel}</p>
                  </div>
                )}
              </div>

              <p className="es-footer-note">
                Need a policy changed? Contact your HR team or administrator — employees cannot
                edit organization settings.
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
