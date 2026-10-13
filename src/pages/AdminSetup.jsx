import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Shield, Loader2, CheckCircle2, Mail, Phone, User, Lock } from 'lucide-react';
import { adminAuthAPI } from '../services/api';

export default function AdminSetup() {
  const navigate = useNavigate();
  const { dummyTenantId, token } = useParams();

  const [validating, setValidating] = useState(true);
  const [validationError, setValidationError] = useState('');
  const [tenantInfo, setTenantInfo] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Real-time validation states
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState(null); // null, true, false
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [passwordCriteria, setPasswordCriteria] = useState({
    length: false,
    upper: false,
    lower: false,
    number: false,
    special: false
  });

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    username: '',
    password: '',
    confirmPassword: '',
    adminCode: '',
  });

  // Real-time debounce for availability checks
  useEffect(() => {
    if (!formData.email) {
      setEmailAvailable(null);
      return;
    }
    const emailRegex = /^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(formData.email)) {
      setEmailAvailable(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setCheckingEmail(true);
        const res = await adminAuthAPI.checkEmail(formData.email);
        setEmailAvailable(!res.data.exists);
      } catch (err) {
        console.error('Email check failed', err);
      } finally {
        setCheckingEmail(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.email]);

  useEffect(() => {
    if (!formData.username || formData.username.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setCheckingUsername(true);
        const res = await adminAuthAPI.checkUsername(formData.username);
        setUsernameAvailable(!res.data.exists);
      } catch (err) {
        console.error('Username check failed', err);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.username]);

  useEffect(() => {
    const p = formData.password;
    setPasswordCriteria({
      length: p.length >= 8,
      upper: /[A-Z]/.test(p),
      lower: /[a-z]/.test(p),
      number: /[0-9]/.test(p),
      special: /[@$!%*?&]/.test(p)
    });
  }, [formData.password]);

  useEffect(() => {
    const validate = async () => {
      try {
        setValidating(true);
        setValidationError('');

        const res = await adminAuthAPI.validateSetupToken(dummyTenantId, token);
        const data = res?.data || res;

        if (!data?.valid) {
          setValidationError(data?.message || 'This admin setup link is invalid or has expired.');
          setValidating(false);
          return;
        }

        // Store tenant + setup token for registration API
        if (data.tenantId) {
          window.safeSessionStorage.setItem('currentTenantId', String(data.tenantId));
        }
        window.safeSessionStorage.setItem('adminSetupToken', token);

        setTenantInfo({
          tenantName: data.tenantName,
          tenantDomain: data.tenantDomain,
        });
      } catch (err) {
        console.error('Admin setup validation failed', err);
        const msg =
          err.response?.data?.message ||
          err.response?.data?.error ||
          'This admin setup link is invalid or has expired.';
        setValidationError(msg);
      } finally {
        setValidating(false);
      }
    };

    if (dummyTenantId && token) {
      validate();
    } else {
      setValidationError('Missing setup information in the link.');
      setValidating(false);
    }
  }, [dummyTenantId, token]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Restrict First Name and Last Name to letters and spaces only
    if (name === 'firstName' || name === 'lastName') {
      const lettersOnly = value.replace(/[^a-zA-Z\s]/g, '');
      setFormData((prev) => ({ ...prev, [name]: lettersOnly }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    if (error) setError('');
  };

  const validateForm = () => {
    // First name validation
    if (!formData.firstName.trim()) {
      setError('First name is required.');
      return false;
    }

    // Last name validation
    if (!formData.lastName.trim()) {
      setError('Last name is required.');
      return false;
    }

    // Email validation
    if (!formData.email.trim()) {
      setError('Please enter your email.');
      return false;
    }
    const emailRegex = /^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (emailAvailable === false) {
      setError('This email is already registered or invalid.');
      return false;
    }

    // Username validation
    if (!formData.username.trim()) {
      setError('Please choose an admin username.');
      return false;
    }
    if (formData.username.trim().length < 3) {
      setError('Username must be at least 3 characters long.');
      return false;
    }
    if (usernameAvailable === false) {
      setError('This username is already taken.');
      return false;
    }

    // Password validation - check all criteria
    if (!passwordCriteria.length || !passwordCriteria.upper || !passwordCriteria.lower || !passwordCriteria.number || !passwordCriteria.special) {
      setError('Password must be at least 8 characters and contain uppercase, lowercase, number, and special character (@$!%*?&).');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }

    // Admin code validation
    if (!formData.adminCode.trim()) {
      setError('Please enter the admin setup code from your email.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const payload = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phoneNumber: formData.phoneNumber.trim() || null,
        adminLevel: null, // backend defaults to ADMIN
        adminCode: formData.adminCode.trim(),
      };

      const res = await adminAuthAPI.register(payload);
      const data = res?.data || res;

      if (data?.token) {
        setSuccessMessage('Admin account created successfully. Redirecting to dashboard...');
        // Store admin session info similar to AuthContext pattern (sessionType = admin)
        window.safeSessionStorage.setItem('adminToken', data.token);
        window.safeSessionStorage.setItem('adminUser', JSON.stringify({
          username: data.username,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          onboardingCompleted: data.onboardingCompleted
        }));
        window.safeSessionStorage.setItem('sessionType', 'admin');
        window.safeSessionStorage.setItem('adminLoginTime', new Date().toISOString());

        // Update onboarding status in window.safeLocalStorage for ProtectedRoute guard
        if (data.onboardingCompleted !== undefined) {
          window.safeLocalStorage.setItem('adminOnboardingComplete', String(data.onboardingCompleted));
        }

        setTimeout(() => {
          navigate('/admin/dashboard', { replace: true });
        }, 1200);
      } else {
        setError(data?.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      console.error('Admin setup registration error', err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    fontSize: '14px',
    color: '#111827',
    outline: 'none',
    backgroundColor: 'white',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', sans-serif",
        backgroundColor: '#fff',
        position: 'relative',
        overflow: 'hidden',
        padding: '24px 16px',
      }}
    >
      {/* Background blobs similar to auth pages */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '-10%',
          width: '520px',
          height: '520px',
          background: '#e0e7ff',
          filter: 'blur(80px)',
          borderRadius: '50%',
          opacity: 0.5,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-10%',
          right: '-10%',
          width: '420px',
          height: '420px',
          background: '#f3e8ff',
          filter: 'blur(80px)',
          borderRadius: '50%',
          opacity: 0.5,
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '32px 28px',
          borderRadius: 24,
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          border: '1px solid #eef2ff',
          boxShadow: '0 20px 40px rgba(15, 23, 42, 0.08)',
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: 1.2,
                color: '#4f46e5',
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Admin Setup
            </div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: '#111827',
                margin: 0,
              }}
            >
              Create your first admin
            </h1>
            <p
              style={{
                marginTop: 6,
                fontSize: 13,
                color: '#6b7280',
              }}
            >
              This account will manage HR for your organization.
            </p>
          </div>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: '#f3e8ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Shield size={26} color="#8b5cf6" />
          </div>
        </div>

        {tenantInfo && (
          <div
            style={{
              marginBottom: 16,
              padding: '10px 12px',
              borderRadius: 12,
              backgroundColor: '#eff6ff',
              border: '1px solid #dbeafe',
              fontSize: 13,
              color: '#1d4ed8',
            }}
          >
            <strong>{tenantInfo.tenantName}</strong>{' '}
            {tenantInfo.tenantDomain ? `(${tenantInfo.tenantDomain})` : ''}
          </div>
        )}

        {validating && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '16px 0',
              color: '#6b7280',
              fontSize: 14,
            }}
          >
            <Loader2 className="animate-spin" size={18} />
            Validating setup link...
          </div>
        )}

        {!validating && validationError && (
          <div
            style={{
              marginTop: 4,
              padding: '12px',
              borderRadius: 12,
              border: '1px solid #fecaca',
              backgroundColor: '#fef2f2',
              color: '#b91c1c',
              fontSize: 13,
            }}
          >
            {validationError}
          </div>
        )}

        {!validating && !validationError && (
          <>
            {error && (
              <div
                style={{
                  marginBottom: 12,
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid #fecaca',
                  backgroundColor: '#fef2f2',
                  color: '#b91c1c',
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}
            {successMessage && (
              <div
                style={{
                  marginBottom: 12,
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid #bbf7d0',
                  backgroundColor: '#f0fdf4',
                  color: '#166534',
                  fontSize: 13,
                }}
              >
                {successMessage}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label
                    htmlFor="firstName"
                    style={{
                      display: 'block',
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#374151',
                      marginBottom: 6,
                    }}
                  >
                    First Name
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={handleChange}
                      style={{ ...inputStyle, paddingLeft: 34 }}
                      placeholder="Admin First Name"
                      maxLength={50}
                      pattern="[a-zA-Z\s]+"
                      title="First name can only contain letters and spaces"
                    />
                    <User
                      size={16}
                      style={{
                        position: 'absolute',
                        left: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#9ca3af',
                      }}
                    />
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label
                    htmlFor="lastName"
                    style={{
                      display: 'block',
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#374151',
                      marginBottom: 6,
                    }}
                  >
                    Last Name
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={handleChange}
                      style={{ ...inputStyle, paddingLeft: 34 }}
                      placeholder="Admin Last Name"
                      maxLength={50}
                      pattern="[a-zA-Z\s]+"
                      title="Last name can only contain letters and spaces"
                    />
                    <User
                      size={16}
                      style={{
                        position: 'absolute',
                        left: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#9ca3af',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="email"
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: 6,
                  }}
                >
                  Work Email
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    style={{
                      ...inputStyle,
                      paddingLeft: 34,
                      borderColor: emailAvailable === true ? '#10b981' : emailAvailable === false ? '#ef4444' : '#e5e7eb'
                    }}
                    placeholder="you@company.com"
                  />
                  <Mail
                    size={16}
                    style={{
                      position: 'absolute',
                      left: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: emailAvailable === true ? '#10b981' : emailAvailable === false ? '#ef4444' : '#9ca3af',
                    }}
                  />
                  <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                    {checkingEmail && <Loader2 size={14} className="animate-spin" color="#6b7280" />}
                    {emailAvailable === false && formData.email && (
                      <span style={{ fontSize: 10, color: '#ef4444' }}>
                        {/^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(formData.email) ? 'Already Registered' : 'Invalid Format'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label
                    htmlFor="username"
                    style={{
                      display: 'block',
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#374151',
                      marginBottom: 6,
                    }}
                  >
                    Admin Username
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="username"
                      name="username"
                      type="text"
                      required
                      value={formData.username}
                      onChange={handleChange}
                      style={{
                        ...inputStyle,
                        paddingLeft: 34,
                        borderColor: usernameAvailable === true ? '#10b981' : usernameAvailable === false ? '#ef4444' : '#e5e7eb'
                      }}
                      placeholder="e.g. hr.admin"
                      minLength={3}
                      maxLength={50}
                    />
                    <User
                      size={16}
                      style={{
                        position: 'absolute',
                        left: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: usernameAvailable === true ? '#10b981' : usernameAvailable === false ? '#ef4444' : '#9ca3af',
                      }}
                    />
                    <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                      {checkingUsername && <Loader2 size={14} className="animate-spin" color="#6b7280" />}
                      {usernameAvailable === false && <span style={{ fontSize: 10, color: '#ef4444' }}>Already Taken</span>}
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label
                    htmlFor="phoneNumber"
                    style={{
                      display: 'block',
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#374151',
                      marginBottom: 6,
                    }}
                  >
                    Phone (optional)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="phoneNumber"
                      name="phoneNumber"
                      type="text"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      style={{ ...inputStyle, paddingLeft: 34 }}
                      placeholder="+91 98765 43210"
                      maxLength={20}
                    />
                    <Phone
                      size={16}
                      style={{
                        position: 'absolute',
                        left: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#9ca3af',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label
                    htmlFor="password"
                    style={{
                      display: 'block',
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#374151',
                      marginBottom: 6,
                    }}
                  >
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      style={{ ...inputStyle, paddingLeft: 34 }}
                      placeholder="Min 8 chars, A, a, 1, @"
                      minLength={8}
                    />
                    <Lock
                      size={16}
                      style={{
                        position: 'absolute',
                        left: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#9ca3af',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                    <div style={{ fontSize: '10px', color: passwordCriteria.length ? '#10b981' : '#9ca3af', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      {passwordCriteria.length ? '✓' : '○'} 8+ chars
                    </div>
                    <div style={{ fontSize: '10px', color: passwordCriteria.upper ? '#10b981' : '#9ca3af', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      {passwordCriteria.upper ? '✓' : '○'} Upper
                    </div>
                    <div style={{ fontSize: '10px', color: passwordCriteria.lower ? '#10b981' : '#9ca3af', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      {passwordCriteria.lower ? '✓' : '○'} Lower
                    </div>
                    <div style={{ fontSize: '10px', color: passwordCriteria.number ? '#10b981' : '#9ca3af', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      {passwordCriteria.number ? '✓' : '○'} Number
                    </div>
                    <div style={{ fontSize: '10px', color: passwordCriteria.special ? '#10b981' : '#9ca3af', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      {passwordCriteria.special ? '✓' : '○'} Special
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label
                    htmlFor="confirmPassword"
                    style={{
                      display: 'block',
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#374151',
                      marginBottom: 6,
                    }}
                  >
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    style={{
                      ...inputStyle,
                      borderColor: formData.confirmPassword && formData.password === formData.confirmPassword ? '#10b981' : formData.confirmPassword ? '#ef4444' : '#e5e7eb'
                    }}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="adminCode"
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: 6,
                  }}
                >
                  Admin Setup Code
                </label>
                <input
                  id="adminCode"
                  name="adminCode"
                  type="text"
                  required
                  value={formData.adminCode}
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="Enter the code from your email"
                />
                <p
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: '#6b7280',
                  }}
                >
                  Use the code shown in your "Complete Admin Setup" email.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 4,
                  padding: '12px',
                  borderRadius: '999px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #7c3aed 100%)',
                  color: 'white',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.8 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Creating admin...
                  </>
                ) : (
                  <>
                    Complete Admin Setup
                    <CheckCircle2 size={18} />
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

