
import { useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Lock } from 'lucide-react';
import Logo from '../assets/Logo.png';
import { employeeAPI, adminAPI } from '../services/api';

const PASSWORD_BLACKLIST = [
  '123456789',
  '0987654321',
  'aaaaaaaaaaaaaaaa',
  'qqqqqqqqqqqq',
  '7777777772222222',
];

function validatePassword(pw) {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one digit.';
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw)) return 'Password must contain at least one special character.';
  if (PASSWORD_BLACKLIST.some(bad => pw.toLowerCase() === bad.toLowerCase())) return 'This password is too common or insecure.';
  return '';
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const token = searchParams.get('token');
  const isAdminReset =
    searchParams.get('type') === 'admin' ||
    location.pathname.includes('/admin/reset-password');
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formData, setFormData] = useState({ newPassword: '', confirmPassword: '' });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('Invalid link. No reset token found.');
      return;
    }
    const pwError = validatePassword(formData.newPassword);
    if (pwError) {
      setError(pwError);
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const resetApi = isAdminReset ? adminAPI : employeeAPI;
      await resetApi.resetPassword(token, formData.newPassword, formData.confirmPassword);
      navigate('/login', {
        state: {
          message: isAdminReset
            ? 'Admin password reset successfully. You can now sign in with your new password.'
            : 'Password reset successfully. You can now log in with your new password.',
        },
        replace: true,
      });
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Failed to reset password. Link may have expired.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f6fa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ maxWidth: 400, width: '100%', background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb', padding: 32, textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px auto', fontSize: 28, color: '#6366f1', fontWeight: 700 }}>P</div>
          <div style={{ fontWeight: 700, fontSize: 20, color: '#22223b', marginBottom: 2 }}>Pragva-HRMS</div>
          <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 18 }}>Human Resource Management System</div>
          <p style={{ color: '#b91c1c', marginBottom: 18, fontSize: 15 }}>Invalid or missing reset link. Please use the link from your email.</p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            style={{ padding: '10px 0', width: '100%', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 600, fontSize: 15, marginTop: 8, cursor: 'pointer' }}
          >
            ← Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ maxWidth: 340, width: '100%', background: '#fff', borderRadius: 14, boxShadow: '0 4px 18px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '22px 20px 0 20px', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <img
              src={Logo}
              alt="Pragva Logo"
              style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover', background: '#fff', border: '1px solid #e5e7eb' }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 20, color: '#18181b', marginBottom: 2 }}>Pragva-HRMS</div>
              <div style={{ color: '#71717a', fontSize: 13 }}>Human Resource Management System</div>
            </div>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#18181b', margin: 0, marginBottom: 6 }}>
            {isAdminReset ? 'Reset admin password' : 'Reset your password'}
          </h1>
          <p style={{ color: '#52525b', fontSize: 15, marginBottom: 0 }}>
            Enter a new password below. Use the link from your password reset email.
          </p>
        </div>
        <div style={{ padding: '20px' }}>
          {error && (
            <div style={{ marginBottom: 18, padding: '10px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 14 }}>{error}</div>
          )}
          <form onSubmit={handleSubmit} autoComplete="off">
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontWeight: 500, fontSize: 15, color: '#18181b', marginBottom: 6 }}>New password</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  placeholder="Min. 8 characters, 1 uppercase, 1 lowercase, 1 digit, 1 special"
                  minLength={8}
                  required
                  autoComplete="new-password"
                  style={{ width: '100%', padding: '12px 44px 12px 14px', borderRadius: 8, border: '1px solid #27272a', fontSize: 16, background: '#18181b08', color: '#18181b', outline: 'none', fontWeight: 500, letterSpacing: 0.5 }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((s) => !s)}
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: 6, borderRadius: 6 }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                </button>
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontWeight: 500, fontSize: 15, color: '#18181b', marginBottom: 6 }}>Confirm new password</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                  style={{ width: '100%', padding: '12px 44px 12px 14px', borderRadius: 8, border: '1px solid #27272a', fontSize: 16, background: '#18181b08', color: '#18181b', outline: 'none', fontWeight: 500, letterSpacing: 0.5 }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirm((s) => !s)}
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: 6, borderRadius: 6 }}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff size={22} /> : <Eye size={22} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '13px 0', borderRadius: 8, border: '1px solid #27272a', background: '#18181b', color: '#fff', fontWeight: 600, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 8, transition: 'background 0.2s' }}
            >
              <Lock size={20} style={{ marginRight: 6 }} />
              {loading ? 'Resetting...' : 'Reset password'}
            </button>
          </form>
          <div style={{ margin: '24px 0 0 0', color: '#71717a', fontSize: 14, textAlign: 'center' }}>
            {isAdminReset
              ? 'After resetting, sign in with your admin username and new password.'
              : 'After resetting, you can log in with your email or employee ID and the new password.'}
          </div>
          <button
            type="button"
            onClick={() => navigate('/login')}
            style={{ margin: '24px 0 0 0', width: '100%', padding: '12px 0', borderRadius: 8, border: '1px solid #27272a', background: '#fff', color: '#18181b', fontWeight: 600, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            ← Back to login
          </button>
        </div>
      </div>
    </div>
  );
}
