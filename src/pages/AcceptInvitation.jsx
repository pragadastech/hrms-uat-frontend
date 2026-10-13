import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { validateInvitationToken, acceptInvitation } from '../services/api';
import './AcceptInvitation.css';

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [loading, setLoading] = useState(!!token);
  const [validating, setValidating] = useState(!!token);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });

  useEffect(() => {
    if (!token) {
      setError('Invalid link. No invitation token found.');
      setValidating(false);
      setLoading(false);
      return;
    }
    const validate = async () => {
      try {
        setValidating(true);
        setError('');
        const res = await validateInvitationToken(token);
        setInfo({ employeeId: res.employeeId, email: res.email });
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Invalid or expired invitation link.');
      } finally {
        setValidating(false);
        setLoading(false);
      }
    };
    validate();
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await acceptInvitation({
        token,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });
      navigate('/login', { state: { message: 'Password set successfully. You can now log in.' }, replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to set password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const eyeOpen = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

  const eyeClosed = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 7 11 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.526 13.526 0 0 0 1 12s4 8 11 8a9.953 9.953 0 0 0 5.39-1.61" />
      <line x1="1" y1="1" x2="23" y2="23" style={{ display: 'none' }} />
    </svg>
  );

  if (validating) {
    return (
      <div className="invite-page-wrapper">
        <div style={{ textAlign: 'center' }}>
          <div className="invite-spinner-dark"></div>
          <p style={{ color: '#888', fontSize: '14px', fontWeight: 500 }}>Verifying link...</p>
        </div>
      </div>
    );
  }

  if (!token || (error && !info)) {
    return (
      <div className="invite-page-wrapper">
        <div className="invite-card-new">
          <div className="invite-brand">
            <div className="invite-brand-dot"></div>
            <span className="invite-brand-name">Pragva HRMS</span>
          </div>

          <h1>Error</h1>
          <p className="invite-sub">{error || 'This invitation link is not valid.'}</p>

          <button
            type="button"
            className="invite-btn"
            onClick={() => navigate('/login')}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="invite-page-wrapper">
      <div className="invite-card-new">
        <div className="invite-brand">
          <div className="invite-brand-dot"></div>
          <span className="invite-brand-name">Pragva HRMS</span>
        </div>

        <h1>Set your password</h1>
        <p className="invite-sub">
          For <strong>{info?.email || 'this account'}</strong>
        </p>

        <div className={`invite-error-box ${error ? 'show' : ''}`} id="error-box">
          {error}
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="invite-field">
            <label htmlFor="password">Password</label>
            <div className="invite-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                placeholder="At least 6 characters"
                autoComplete="new-password"
                value={formData.password}
                onChange={handleChange}
              />
              <button
                type="button"
                className="invite-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? eyeClosed : eyeOpen}
              </button>
            </div>
          </div>

          <div className="invite-field">
            <label htmlFor="confirm">Confirm password</label>
            <div className="invite-input-wrap">
              <input
                type={showConfirm ? 'text' : 'password'}
                id="confirm"
                name="confirmPassword"
                placeholder="Re-enter password"
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={handleChange}
              />
              <button
                type="button"
                className="invite-eye-btn"
                onClick={() => setShowConfirm(!showConfirm)}
                aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirm ? eyeClosed : eyeOpen}
              </button>
            </div>
          </div>

          <button type="submit" className="invite-btn" disabled={loading}>
            {loading ? <div className="invite-spinner-new"></div> : 'Activate account'}
          </button>
        </form>

        <div className="invite-footer">
          Already have an account? <a onClick={() => navigate('/login')}>Sign in</a>
        </div>
      </div>
    </div>
  );
}
