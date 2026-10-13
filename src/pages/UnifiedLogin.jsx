import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Loader2, LogIn, Shield, Users, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { employeeAPI, adminAPI, onboardingAPI } from '../services/api';
import axios from 'axios';

export default function UnifiedLogin() {
    const [formData, setFormData] = useState({
        username: '',
        password: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [otpLoading, setOtpLoading] = useState(false);
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');
    const [loginType, setLoginType] = useState(null); // will be set based on response
    const [detectedRole, setDetectedRole] = useState(null); // Role detected from username
    const [isDualRoleEmail, setIsDualRoleEmail] = useState(false);
    const [checkingRole, setCheckingRole] = useState(false);
    const [tenantId, setTenantId] = useState('');
    const debounceTimer = useRef(null);
    const [fieldErrors, setFieldErrors] = useState({ username: '', password: '' });
    const [targetEmail, setTargetEmail] = useState('');
    const [otpMessage, setOtpMessage] = useState('');
    const [otpCooldown, setOtpCooldown] = useState(0);
    const [resendLoading, setResendLoading] = useState(false);
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotOpen, setForgotOpen] = useState(false);
    const [forgotValue, setForgotValue] = useState('');
    const [forgotError, setForgotError] = useState('');
    const [forgotSuccess, setForgotSuccess] = useState('');
    
    // Contact Admin Dialog state
    const [contactAdminOpen, setContactAdminOpen] = useState(false);
    const [orgSearchQuery, setOrgSearchQuery] = useState('');
    const [orgSearchResults, setOrgSearchResults] = useState([]);
    const [searchingOrgs, setSearchingOrgs] = useState(false);
    const [selectedOrg, setSelectedOrg] = useState(null);
    const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
    const [contactingStatus, setContactingStatus] = useState({ loading: false, success: '', error: '' });

    const { employeeLogin, adminLogin, verifyOtp, resendOtp } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const OTP_RESEND_SECONDS = 60;

    // Check for tenant ID
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const tenantParam = urlParams.get('tenantId');
        const storedTenantId = window.safeSessionStorage.getItem('currentTenantId');

        if (tenantParam) {
            setTenantId(tenantParam);
            window.safeSessionStorage.setItem('currentTenantId', tenantParam);
        } else if (storedTenantId) {
            setTenantId(storedTenantId);
        }
    }, []);

    // Show access-disabled message when redirected from SubscriptionGate or blocked login
    useEffect(() => {
        if (location.state?.accessDisabled) {
            setError('Access disabled. Please contact your administrator.');
        }
    }, [location.state?.accessDisabled]);

    useEffect(() => {
        if (!showOtpInput || otpCooldown <= 0) return undefined;
        const id = setInterval(() => {
            setOtpCooldown((seconds) => (seconds <= 1 ? 0 : seconds - 1));
        }, 1000);
        return () => clearInterval(id);
    }, [showOtpInput, otpCooldown > 0]);

    const formatOtpCooldown = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${String(secs).padStart(2, '0')}`;
    };

    const startOtpCooldown = (seconds = OTP_RESEND_SECONDS) => {
        setOtpCooldown(seconds || OTP_RESEND_SECONDS);
    };

    const resetOtpFlow = () => {
        setShowOtpInput(false);
        setOtp('');
        setOtpCooldown(0);
        setResendLoading(false);
        setError('');
    };

    // Check role based on username
    const checkUsernameRole = async (username) => {
        if (!username || username.trim().length < 2) {
            setDetectedRole(null);
            return;
        }

        try {
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
            console.log(`🔍 [UnifiedLogin] Checking role for username: ${username}`);

            if (username.includes('@')) {
                // For emails, check both in parallel to detect dual-role conflict
                const [empRes, adminRes] = await Promise.all([
                    axios.get(`${apiBaseUrl}/employee/auth/check-username/${username}`).catch(() => ({ data: { exists: false } })),
                    axios.get(`${apiBaseUrl}/admin/auth/check-username/${username}`).catch(() => ({ data: { exists: false } }))
                ]);

                const existsInEmp = empRes?.data?.exists;
                const existsInAdmin = adminRes?.data?.exists;

                if (existsInEmp && existsInAdmin) {
                    console.log(`🔄 [UnifiedLogin] Email ${username} exists as BOTH employee and admin`);
                    setDetectedRole('employee');
                    setIsDualRoleEmail(true);
                } else if (existsInEmp) {
                    setDetectedRole('employee');
                    setIsDualRoleEmail(false);
                } else if (existsInAdmin) {
                    setDetectedRole('admin');
                    setIsDualRoleEmail(false);
                } else {
                    setDetectedRole(null);
                    setIsDualRoleEmail(false);
                }
            } else {
                // For non-emails (Employee ID or Admin Username), keep original sequential logic
                const employeeResponse = await axios.get(`${apiBaseUrl}/employee/auth/check-username/${username}`).catch(() => null);
                if (employeeResponse?.data?.exists) {
                    setDetectedRole('employee');
                    setIsDualRoleEmail(false);
                    return;
                }

                const adminResponse = await axios.get(`${apiBaseUrl}/admin/auth/check-username/${username}`).catch(() => null);
                if (adminResponse?.data?.exists) {
                    setDetectedRole('admin');
                    setIsDualRoleEmail(false);
                    return;
                }
                setDetectedRole(null);
                setIsDualRoleEmail(false);
            }
        } catch (err) {
            console.error('❌ [UnifiedLogin] Role check error:', err);
            setDetectedRole(null);
        } finally {
            setCheckingRole(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Clear error when user starts typing
        if (error) setError('');

        // Clear field-level validation error
        if (fieldErrors[name]) {
            setFieldErrors(prev => ({ ...prev, [name]: '' }));
        }

        // Debounced role check for username field
        if (name === 'username') {
            // Clear previous timer
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }

            // Set new timer for 500ms delay
            debounceTimer.current = setTimeout(() => {
                checkUsernameRole(value);
            }, 500);
        }
    };

    const validateField = (name, value) => {
        // Simple validation only for presence, no specific messages
        const trimmed = (value || '').trim();
        if (!trimmed) return 'Required';
        return '';
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        const msg = validateField(name, value);
        if (msg !== fieldErrors[name]) {
            setFieldErrors(prev => ({ ...prev, [name]: msg }));
        }
    };

    const validateForm = () => {
        const usernameError = validateField('username', formData.username);
        const passwordError = validateField('password', formData.password);
        setFieldErrors({ username: usernameError, password: passwordError });
        return !usernameError && !passwordError;
    };

    const attemptLogin = async (loginFunction, redirectPath, loginTypeName) => {
        try {
            console.log(`🔍 [UnifiedLogin] Attempting ${loginTypeName} login for: ${formData.username}`);
            const result = await loginFunction({
                username: formData.username,
                password: formData.password
            }, tenantId);

            console.log(`🔍 [UnifiedLogin] Login result for ${loginTypeName}:`, result);

            if (result.success) {
                // Check if OTP is required (for employee logins)
                console.log(`🔍 [UnifiedLogin] Checking otpRequired:`, result.data?.otpRequired);
                if (result.data?.otpRequired === true) {
                    console.log('✅ [UnifiedLogin] OTP Required detected, showing input');
                    setTargetEmail(result.data.email || formData.username);
                    setOtpMessage(result.data.message || "We've sent a 6-digit code to your email.");
                    setShowOtpInput(true);
                    startOtpCooldown(result.data.otpResendAfterSeconds);
                    setLoading(false);
                    return true;
                }

                console.log(`✅ [UnifiedLogin] ${loginTypeName} login successful`);
                setLoginType(loginTypeName);
                // Small delay to show the role detection animation
                setTimeout(async () => {
                    // For admin logins, check onboarding status
                    if (loginTypeName === 'admin') {
                        // Use onboarding status from login response if available, otherwise fallback to check API
                        let onboardingCompleted = result.data?.onboardingCompleted;

                        if (onboardingCompleted === undefined || onboardingCompleted === null) {
                            try {
                                const onboardingRes = await onboardingAPI.getMyOnboardingState();
                                onboardingCompleted = onboardingRes?.data?.onboardingCompleted;
                            } catch (onboardingErr) {
                                console.error('Onboarding check error:', onboardingErr);
                                // On failure, preserve existing window.safeLocalStorage value instead of forcing false
                                const existing = window.safeLocalStorage.getItem('adminOnboardingComplete');
                                if (existing === 'true') {
                                    onboardingCompleted = true;
                                } else {
                                    onboardingCompleted = false;
                                }
                            }
                        }

                        // Update window.safeLocalStorage for ProtectedRoute — never clobber a verified complete flag
                        if (onboardingCompleted) {
                            window.safeLocalStorage.setItem('adminOnboardingComplete', 'true');
                        } else if (window.safeLocalStorage.getItem('adminOnboardingComplete') !== 'true') {
                            window.safeLocalStorage.setItem('adminOnboardingComplete', 'false');
                        }
                        // Also sync the stored admin user object
                        try {
                            const storedAdmin = window.safeSessionStorage.getItem('adminUser');
                            if (storedAdmin) {
                                const parsed = JSON.parse(storedAdmin);
                                parsed.onboardingCompleted = !!onboardingCompleted;
                                window.safeSessionStorage.setItem('adminUser', JSON.stringify(parsed));
                            }
                        } catch (e) { /* ignore */ }

                        // If onboarding is completed, go to dashboard; otherwise go to setup
                        const defaultTarget = onboardingCompleted
                            ? '/admin/dashboard'
                            : '/admin/welcome-setup';

                        const from = location.state?.from?.pathname || defaultTarget;
                        navigate(from, { replace: true });
                    } else {
                        // For non-admin logins, use the original redirect path
                        const from = location.state?.from?.pathname || redirectPath;
                        navigate(from, { replace: true });
                    }
                }, 800);
                return true;
            }
            // If login failed, return the error message
            console.log(`❌ [UnifiedLogin] ${loginTypeName} login failed:`, result.message);
            return { success: false, message: result.message || 'Login failed' };
        } catch (err) {
            console.error(`❌ [UnifiedLogin] ${loginTypeName} login attempt error:`, err);
            const msg =
                err.response?.data?.message ||
                err.message ||
                'Network error. Please check your connection and try again.';
            return { success: false, message: msg };
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return;

        if (!validateForm()) {
            setError('User not found. Please check your Employee ID / work email or password and try again');
            return;
        }

        setLoading(true);

        // When role is known, call only the relevant API (avoids calling both)
        if (detectedRole === 'employee') {
            const result = await attemptLogin(
                employeeLogin,
                '/employee/dashboard',
                'employee'
            );
            if (result === true) {
                setLoading(false);
                return;
            }
            setError(result.message || 'User not found. Please check your credentials.');
            setLoading(false);
            return;
        }
        if (detectedRole === 'admin') {
            const result = await attemptLogin(
                adminLogin,
                '/admin/dashboard',
                'admin'
            );
            if (result === true) {
                setLoading(false);
                return;
            }
            setError(result.message || 'User not found. Please check your credentials.');
            setLoading(false);
            return;
        }

        // Role unknown: try employee login first, then admin
        // Only try admin if employee login fails with "not found" type errors
        console.log('🔍 [UnifiedLogin] Role unknown, trying employee login first...');
        const employeeResult = await attemptLogin(
            employeeLogin,
            '/employee/dashboard',
            'employee'
        );
        if (employeeResult === true) {
            console.log('✅ [UnifiedLogin] Employee login succeeded');
            setLoading(false);
            return;
        }

        // Check if employee login failed due to "not found" vs "invalid password"
        // Only try admin login if employee was truly not found (not if password was wrong)
        const employeeErrorMsg = typeof employeeResult === 'object' ? employeeResult.message?.toLowerCase() || '' : '';
        // Try admin login only if the error suggests the employee doesn't exist
        // Don't try admin if it's a password error or account inactive error
        const shouldTryAdmin = employeeErrorMsg.includes('employee not found') ||
            employeeErrorMsg.includes('no valid employee') ||
            (employeeErrorMsg.includes('not found') && !employeeErrorMsg.includes('password') && !employeeErrorMsg.includes('inactive'));

        if (shouldTryAdmin) {
            console.log('❌ [UnifiedLogin] Employee login failed, trying admin login...', employeeResult);
            // Try admin login - this is important for admin users whose role wasn't detected
            console.log('🔍 [UnifiedLogin] Attempting admin login...');
            const adminResult = await attemptLogin(
                adminLogin,
                '/admin/dashboard',
                'admin'
            );
            if (adminResult === true) {
                console.log('✅ [UnifiedLogin] Admin login succeeded');
                setLoading(false);
                return;
            }
            console.log('❌ [UnifiedLogin] Admin login also failed', adminResult);

            // Both failed - show the more specific error message
            // Prefer employee error if it's more specific, otherwise use admin error
            const finalError = typeof employeeResult === 'object' ? employeeResult.message : 'User not found. Please check your Employee ID / work email or password and try again';
            console.log('❌ [UnifiedLogin] Both logins failed, showing error:', finalError);
            setError(finalError);
        } else {
            // Employee login failed with a specific error (like wrong password), don't try admin
            const errorMsg = typeof employeeResult === 'object' ? employeeResult.message : 'User not found. Please check your Employee ID / work email or password and try again';
            console.log('❌ [UnifiedLogin] Employee login failed with specific error, not trying admin:', errorMsg);
            setError(errorMsg);
        }
        setLoading(false);
    };

    const handleResendOtp = async () => {
        if (otpCooldown > 0 || resendLoading || otpLoading) return;
        setError('');
        setResendLoading(true);
        try {
            const result = await resendOtp({
                username: formData.username,
                password: formData.password
            }, detectedRole || 'employee', tenantId);

            if (result.success && result.data?.otpRequired) {
                setOtp('');
                setTargetEmail(result.data.email || formData.username);
                setOtpMessage(result.data.message || "We've sent a new 6-digit code to your email.");
                startOtpCooldown(result.data.otpResendAfterSeconds);
            } else {
                setError(result.message || 'Failed to resend OTP. Please try again.');
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to resend OTP. Please try again.');
        } finally {
            setResendLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');
        if (!otp || otp.length !== 6) {
            setError('Please enter a valid 6-digit OTP');
            return;
        }

        setOtpLoading(true);
        try {
            console.log(`🔍 [UnifiedLogin] Verifying OTP for ${detectedRole || 'employee'}: ${formData.username}`);
            const result = await verifyOtp(formData.username, otp, detectedRole || 'employee');

            if (result.success) {
                console.log('✅ [UnifiedLogin] OTP verification successful');
                const targetRole = detectedRole || 'employee';
                setLoginType(targetRole);
                
                setTimeout(() => {
                    if (targetRole === 'admin') {
                        // For admin OTP verify, respect onboarding status
                        const onboardingCompleted = result.data?.onboardingCompleted;
                        const defaultTarget = onboardingCompleted
                            ? '/admin/dashboard'
                            : '/admin/welcome-setup';
                        const from = location.state?.from?.pathname || defaultTarget;
                        navigate(from, { replace: true });
                    } else {
                        const defaultPath = '/employee/dashboard';
                        const from = location.state?.from?.pathname || defaultPath;
                        navigate(from, { replace: true });
                    }
                }, 800);
            } else {
                setError(result.message || 'Invalid OTP. Please try again.');
            }
        } catch (err) {
            console.error('❌ [UnifiedLogin] OTP verification error:', err);
            setError(err.message || 'Verification failed. Please try again.');
        } finally {
            setOtpLoading(false);
        }
    };

    // Handle employee ID based organization lookup
    const handleEmployeeIdSearch = async (query) => {
        setOrgSearchQuery(query);
        if (query.trim().length < 2) {
            setOrgSearchResults([]);
            return;
        }

        setSearchingOrgs(true);
        try {
            const { publicSignupAPI } = await import('../services/api');
            const res = await publicSignupAPI.searchByEmployeeId(query);
            setOrgSearchResults(res.data || []);
        } catch (err) {
            console.error('Employee ID search error:', err);
        } finally {
            setSearchingOrgs(false);
        }
    };

    // Handle sending message to admin
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!selectedOrg) return;

        setContactingStatus({ loading: true, success: '', error: '' });
        try {
            const { publicSignupAPI } = await import('../services/api');
            const res = await publicSignupAPI.messageAdmin(selectedOrg.domain, contactForm);
            if (res.data?.success) {
                setContactingStatus({ loading: false, success: 'Your message has been sent successfully. The administrator will contact you soon.', error: '' });
                setContactForm({ name: '', email: '', message: '' });
            } else {
                setContactingStatus({ loading: false, success: '', error: res.data?.message || 'Failed to send message.' });
            }
        } catch (err) {
            setContactingStatus({ loading: false, success: '', error: err.response?.data?.message || 'An error occurred while sending the message.' });
        }
    };

    // Dynamic theme based on detected login type (real-time or after login)
    // Lock active role during loading to prevent theme background and icon flickering mid-attempt
    const stableRoleRef = useRef(null);
    if (!loading && !otpLoading) {
        stableRoleRef.current = detectedRole || loginType;
    }

    const getThemeColors = () => {
        const activeRole = stableRoleRef.current;

        if (activeRole === 'admin') {
            return {
                primary: '#8b5cf6',
                primaryHover: '#7c3aed',
                secondary: '#f3e8ff',
                gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                icon: Shield,
                iconColor: '#8b5cf6',
                bgBlob1: '#e0e7ff',
                bgBlob2: '#f3e8ff',
            };
        } else if (activeRole === 'employee') {
            return {
                primary: '#6366f1',
                primaryHover: '#4f46e5',
                secondary: '#e0e7ff',
                gradient: 'linear-gradient(135deg, #667eea 0%, #4facfe 100%)',
                icon: Users,
                iconColor: '#6366f1',
                bgBlob1: '#e0e7ff',
                bgBlob2: '#e0e7ff',
            };
        }
        // Default state (before role detection)
        return {
            primary: '#6366f1',
            primaryHover: '#4f46e5',
            secondary: '#e0e7ff',
            gradient: 'linear-gradient(135deg, #667eea 0%, #6366f1 100%)',
            icon: LogIn,
            iconColor: '#6366f1',
            bgBlob1: '#e0e7ff',
            bgBlob2: '#e0e7ff',
        };
    };

    const theme = getThemeColors();
    const IconComponent = theme.icon;

    return (
        <>
            <style>
                {`
                @media (max-width: 1024px) {
                    .unified-login-form-side {
                        padding: 40px 32px !important;
                    }
                }
                @media (max-width: 768px) {
                    .unified-login-root {
                        flex-direction: column !important;
                    }
                    .unified-login-form-side {
                        padding: 40px 24px !important;
                        min-height: 100vh !important;
                    }
                    .unified-login-illustration-side {
                        display: none !important;
                    }
                    .unified-login-box {
                        max-width: 100% !important;
                        margin-top: 0 !important;
                    }
                }

                .unified-contact-dialog::-webkit-scrollbar {
                    display: none;
                }

                .unified-contact-list::-webkit-scrollbar {
                    display: none;
                }
            `}
            </style>
            <div
                className="unified-login-root"
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'row',
                    fontFamily: "'Inter', sans-serif",
                    backgroundColor: '#0f172a',
                }}
            >
                {/* Left side – form */}
                <div
                    className="unified-login-form-side"
                    style={{
                        flex: 1,
                        backgroundColor: '#ffffff',
                        padding: '40px 64px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                    }}
                >
                    <div
                        className="unified-login-box"
                        style={{
                            maxWidth: 360,
                            width: '100%',
                            marginTop: 24,
                            marginLeft: 'auto',
                            marginRight: 'auto',
                        }}
                    >
                        {/* Logo at top of form */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                marginBottom: 24,
                            }}
                        >
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 999,
                                    background: '#ef4444',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    fontWeight: 700,
                                    flexShrink: 0,
                                }}
                            >
                                P
                            </div>
                            <span style={{ fontWeight: 700, fontSize: 18, color: '#111827' }}>
                                Pragva‑HRMS
                            </span>
                        </div>
                        {location.state?.message && (
                            <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, backgroundColor: '#dcfce7', border: '1px solid #86efac', color: '#166534', fontSize: 14 }}>
                                {location.state.message}
                            </div>
                        )}
                        <h1
                            style={{
                                fontSize: 32,
                                fontWeight: 700,
                                color: '#0f172a',
                                lineHeight: 1.15,
                                marginBottom: 6,
                            }}
                        >
                            Hello,
                            <br />
                            Welcome Back
                        </h1>
                        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 32 }}>
                            Employee login with password, or request an OTP if configured.
                        </p>

                        {showOtpInput ? (
                            <form key="otp-form" onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div
                                    style={{
                                        backgroundColor: '#eff6ff',
                                        border: '1px solid #bfdbfe',
                                        color: '#1e40af',
                                        padding: '12px',
                                        borderRadius: 10,
                                        fontSize: 13,
                                        marginBottom: 10,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10
                                    }}
                                >
                                    <Shield size={18} className="text-blue-600" style={{ flexShrink: 0 }} />
                                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                        <span style={{ fontWeight: 600 }}>{otpMessage.includes('Attempt') ? otpMessage.split('.')[0] + '.' : "We've sent a 6-digit code to:"}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, minWidth: 0, flexWrap: 'wrap' }}>
                                            <strong 
                                                title={targetEmail} 
                                                style={{ 
                                                    fontSize: 13, 
                                                    wordBreak: 'break-all', 
                                                    overflowWrap: 'anywhere',
                                                    maxWidth: '100%',
                                                    lineHeight: 1.3
                                                }}
                                            >
                                                {targetEmail}
                                            </strong>
                                            <button 
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    resetOtpFlow();
                                                }}
                                                style={{ 
                                                    border: 'none', 
                                                    background: 'none', 
                                                    color: '#2563eb', 
                                                    fontSize: 12, 
                                                    fontWeight: 600, 
                                                    cursor: 'pointer',
                                                    padding: '0 4px',
                                                    textDecoration: 'underline',
                                                    flexShrink: 0
                                                }}
                                            >
                                                Edit
                                            </button>
                                        </div>
                                        {otpMessage.includes('Attempt') && (
                                            <span style={{ fontSize: 11, marginTop: 4, color: otpMessage.includes('5/5') ? '#b91c1c' : '#1e40af', fontWeight: 500 }}>
                                                {otpMessage.match(/\(Attempt \d\/\d\)/)?.[0]}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label
                                        htmlFor="otp"
                                        style={{
                                            display: 'block',
                                            fontSize: 14,
                                            fontWeight: 500,
                                            color: '#374151',
                                            marginBottom: 8,
                                        }}
                                    >
                                        Verification Code
                                    </label>
                                    <input
                                        type="text"
                                        id="otp"
                                        name="otp"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        autoComplete="one-time-code"
                                        autoCorrect="off"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="Enter 6-digit code"
                                        required
                                        maxLength={6}
                                        disabled={otpLoading}
                                        autoFocus
                                        style={{
                                            width: '100%',
                                            padding: '12px 14px',
                                            borderRadius: 10,
                                            border: '1px solid #cbd5e1',
                                            fontSize: 18,
                                            fontWeight: 700,
                                            letterSpacing: 6,
                                            textAlign: 'center',
                                            color: '#0f172a',
                                            outline: 'none',
                                            backgroundColor: '#f8fafc',
                                        }}
                                    />
                                </div>

                                <div
                                    style={{
                                        maxHeight: error ? '120px' : '0px',
                                        opacity: error ? 1 : 0,
                                        overflow: 'hidden',
                                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                    }}
                                >
                                    <div
                                        style={{
                                            backgroundColor: '#fef2f2',
                                            border: '1px solid #fecaca',
                                            color: '#b91c1c',
                                            padding: '10px 12px',
                                            borderRadius: 10,
                                            fontSize: 13,
                                            lineHeight: 1.4,
                                        }}
                                    >
                                        {error}
                                    </div>
                                </div>

                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 6,
                                        fontSize: 13,
                                        color: '#6b7280',
                                        minHeight: 22,
                                    }}
                                >
                                    {otpCooldown > 0 ? (
                                        <>
                                            <Clock size={14} />
                                            <span>Resend OTP in <strong style={{ color: '#1e40af', fontVariantNumeric: 'tabular-nums' }}>{formatOtpCooldown(otpCooldown)}</strong></span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Didn’t receive the code?</span>
                                            <button
                                                type="button"
                                                onClick={handleResendOtp}
                                                disabled={resendLoading || otpLoading}
                                                style={{
                                                    border: 'none',
                                                    background: 'none',
                                                    color: '#2563eb',
                                                    fontSize: 13,
                                                    fontWeight: 600,
                                                    cursor: resendLoading || otpLoading ? 'not-allowed' : 'pointer',
                                                    padding: 0,
                                                    opacity: resendLoading || otpLoading ? 0.7 : 1,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 4,
                                                }}
                                            >
                                                {resendLoading ? (
                                                    <>
                                                        <Loader2 className="animate-spin" size={14} />
                                                        Sending...
                                                    </>
                                                ) : (
                                                    'Resend OTP'
                                                )}
                                            </button>
                                        </>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={otpLoading}
                                    style={{
                                        marginTop: 10,
                                        padding: '12px',
                                        borderRadius: 999,
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                        color: 'white',
                                        fontSize: 14,
                                        fontWeight: 600,
                                        cursor: otpLoading ? 'not-allowed' : 'pointer',
                                        opacity: otpLoading ? 0.8 : 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8,
                                        boxShadow: '0 8px 20px rgba(37, 99, 235, 0.35)',
                                    }}
                                >
                                    {otpLoading ? (
                                        <>
                                            <Loader2 className="animate-spin" size={18} />
                                            Verifying...
                                        </>
                                    ) : (
                                        <>
                                            <Shield size={18} />
                                            Verify & Sign In
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        resetOtpFlow();
                                    }}
                                    disabled={otpLoading}
                                    style={{
                                        border: 'none',
                                        background: 'none',
                                        color: '#6b7280',
                                        fontSize: 13,
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        marginTop: 8,
                                        textDecoration: 'underline'
                                    }}
                                >
                                    Back to login
                                </button>
                            </form>
                        ) : (
                            <form key="login-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div>
                                    <label
                                        htmlFor="username"
                                        style={{
                                            display: 'block',
                                            fontSize: 14,
                                            fontWeight: 500,
                                            color: '#374151',
                                            marginBottom: 8,
                                        }}
                                    >
                                        {detectedRole === 'admin' ? 'Admin Username' : 'Work Email / Employee ID'}
                                    </label>
                                    <input
                                        type="text"
                                        id="username"
                                        name="username"
                                        value={formData.username}
                                        onChange={handleInputChange}
                                        onBlur={handleBlur}
                                        placeholder={detectedRole === 'admin' ? 'Enter your admin username' : 'Enter your email or employee ID'}
                                        required
                                        disabled={loading}
                                        style={{
                                            width: '100%',
                                            padding: '10px 14px',
                                            borderRadius: 10,
                                            border: '1px solid #e5e7eb',
                                            fontSize: 14,
                                            color: '#111827',
                                            outline: 'none',
                                            backgroundColor: loading ? '#f9fafb' : '#f9fafb',
                                        }}
                                    />
                                    {detectedRole === 'admin' && !isDualRoleEmail && (
                                        <p style={{ fontSize: 12, color: '#4f46e5', marginTop: 6, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Shield size={14} /> Admin account detected. Please use your username.
                                        </p>
                                    )}
                                    {isDualRoleEmail && (
                                        <div style={{ marginTop: 8, padding: '10px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8 }}>
                                            <p style={{ fontSize: 12, color: '#9a3412', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                <Users size={14} /> Dual Role Account Detected
                                            </p>
                                            <p style={{ fontSize: 11, color: '#c2410c', lineHeight: 1.4 }}>
                                                This email is used for both Employee and Admin roles. 
                                                <br />
                                                <strong>For Admin access:</strong> Please provide your <strong>Admin Username</strong> instead.
                                            </p>
                                        </div>
                                    )}
                                    {/* fieldErrors removed for unified look */}
                                </div>

                                <div>
                                    <label
                                        htmlFor="password"
                                        style={{
                                            display: 'block',
                                            fontSize: 14,
                                            fontWeight: 500,
                                            color: '#374151',
                                            marginBottom: 8,
                                        }}
                                    >
                                        Password
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            id="password"
                                            name="password"
                                            value={formData.password}
                                            onChange={handleInputChange}
                                            onBlur={handleBlur}
                                            placeholder="Enter your password"
                                            required
                                            disabled={loading}
                                            style={{
                                                width: '100%',
                                                padding: '10px 44px 10px 14px',
                                                borderRadius: 10,
                                                border: '1px solid #e5e7eb',
                                                fontSize: 14,
                                                color: '#111827',
                                                outline: 'none',
                                                backgroundColor: loading ? '#f9fafb' : '#f9fafb',
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            disabled={loading}
                                            style={{
                                                position: 'absolute',
                                                right: 16,
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: '#9ca3af',
                                                display: 'flex',
                                                alignItems: 'center',
                                            }}
                                        >
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                    {/* fieldErrors removed for unified look */}
                                </div>

                                <div
                                    style={{
                                        maxHeight: error ? '120px' : '0px',
                                        opacity: error ? 1 : 0,
                                        overflow: 'hidden',
                                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                    }}
                                >
                                    <div
                                        style={{
                                            backgroundColor: '#fef2f2',
                                            border: '1px solid #fecaca',
                                            color: '#b91c1c',
                                            padding: '10px 12px',
                                            borderRadius: 10,
                                            fontSize: 13,
                                            lineHeight: 1.4,
                                        }}
                                    >
                                        {error}
                                    </div>
                                </div>

                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginTop: 2,
                                        fontSize: 13,
                                        color: '#4b5563',
                                    }}
                                >
                                    <div style={{ display: 'none' }}>
                                        {/* Remember Me removed per request */}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setForgotOpen(true);
                                            setForgotValue(formData.username || '');
                                            setForgotError('');
                                            setForgotSuccess('');
                                        }}
                                        style={{
                                            border: 'none',
                                            background: 'none',
                                            color: '#4f46e5',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Forgot Password?
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{
                                        marginTop: 10,
                                        height: 44,
                                        borderRadius: 999,
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                        color: 'white',
                                        fontSize: 14,
                                        fontWeight: 600,
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        opacity: loading ? 0.8 : 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8,
                                        boxShadow: '0 8px 20px rgba(37, 99, 235, 0.35)',
                                    }}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="animate-spin" size={18} />
                                            {loginType ? 'Signing in...' : 'Verifying...'}
                                        </>
                                    ) : (
                                        <>
                                            <LogIn size={18} />
                                            Sign In
                                        </>
                                    )}
                                </button>

                                <div
                                    style={{
                                        marginTop: 16,
                                        fontSize: 13,
                                        color: '#6b7280',
                                        textAlign: 'left',
                                    }}
                                >
                                    Don’t have access?{' '}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setContactAdminOpen(true);
                                            setOrgSearchQuery('');
                                            setOrgSearchResults([]);
                                            setSelectedOrg(null);
                                            setContactForm({ name: '', email: '', message: '' });
                                            setContactingStatus({ loading: false, success: '', error: '' });
                                        }}
                                        style={{
                                            border: 'none',
                                            background: 'none',
                                            color: '#2563eb',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Contact your administrator
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>

                {/* Right side – illustration */}
                <div
                    className="unified-login-illustration-side"
                    style={{
                        flex: 1,
                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e3a8a 100%)',
                        color: '#e5e7eb',
                        position: 'relative',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '40px 32px',
                    }}
                >
                    {/* Soft clouds / blobs */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 40,
                            left: 80,
                            width: 140,
                            height: 140,
                            borderRadius: '999px',
                            background: 'rgba(59,130,246,0.35)',
                            filter: 'blur(40px)',
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            top: 120,
                            right: 120,
                            width: 120,
                            height: 120,
                            borderRadius: '999px',
                            background: 'rgba(37,99,235,0.45)',
                            filter: 'blur(36px)',
                        }}
                    />

                    <div
                        style={{
                            position: 'relative',
                            maxWidth: 420,
                            width: '100%',
                            textAlign: 'center',
                        }}
                    >
                        {/* Phone card */}
                        <div
                            style={{
                                margin: '0 auto 32px auto',
                                width: 220,
                                height: 360,
                                borderRadius: 32,
                                background: 'rgba(15,23,42,0.35)',
                                border: '1px solid rgba(148, 163, 184, 0.4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 18px 40px rgba(15,23,42,0.5)',
                            }}
                        >
                            <div
                                style={{
                                    width: 180,
                                    height: 300,
                                    borderRadius: 24,
                                    background:
                                        'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,64,175,0.9) 100%)',
                                    border: '1px solid rgba(148, 163, 184, 0.4)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#e5e7eb',
                                }}
                            >
                                <div
                                    style={{
                                        width: 42,
                                        height: 42,
                                        borderRadius: 999,
                                        border: '2px solid rgba(148,163,184,0.7)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: 16,
                                    }}
                                >
                                    <IconComponent size={26} color="#38bdf8" />
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                                    Secure Employee
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 600 }}>Authentication</div>
                            </div>
                        </div>

                        <h2
                            style={{
                                fontSize: 22,
                                fontWeight: 700,
                                marginBottom: 8,
                                color: '#f9fafb',
                            }}
                        >
                            Secure Access to Your Workspace
                        </h2>
                        <p style={{ fontSize: 14, color: '#e5e7eb', maxWidth: 340, margin: '0 auto' }}>
                            Manage your work life with our secure employee and admin portal. Single
                            sign‑on, role‑based access, and real‑time insights.
                        </p>
                    </div>
                </div>
            </div>

            {/* Forgot Password overlay */}
            {forgotOpen && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(15,23,42,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 50,
                    }}
                    onClick={() => {
                        if (!forgotLoading) {
                            setForgotOpen(false);
                            setForgotValue('');
                            setForgotError('');
                            setForgotSuccess('');
                        }
                    }}
                >
                    <div
                        style={{
                            width: '100%',
                            maxWidth: 420,
                            margin: '0 16px',
                            backgroundColor: '#ffffff',
                            borderRadius: 16,
                            boxShadow: '0 20px 40px rgba(15,23,42,0.35)',
                            padding: '20px 20px 16px 20px',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2
                            style={{
                                fontSize: 20,
                                fontWeight: 600,
                                color: '#0f172a',
                                textAlign: 'center',
                                marginBottom: 8,
                            }}
                        >
                            Forgot Password
                        </h2>
                        <p
                            style={{
                                fontSize: 13,
                                color: '#6b7280',
                                textAlign: 'center',
                                marginBottom: 16,
                            }}
                        >
                            {detectedRole === 'admin'
                                ? 'Enter your admin username or email to reset your password.'
                                : detectedRole === 'employee'
                                ? 'Enter your employee ID or work email to reset your password.'
                                : 'Enter your admin username, employee ID, or email to reset your password.'}
                        </p>
                        {forgotSuccess ? (
                            <div
                                style={{
                                    marginBottom: 12,
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    border: '1px solid #bbf7d0',
                                    backgroundColor: '#f0fdf4',
                                    color: '#166534',
                                    fontSize: 13,
                                }}
                            >
                                {forgotSuccess}
                            </div>
                        ) : (
                            <>
                                <input
                                    autoFocus
                                    type="text"
                                    value={forgotValue}
                                    onChange={(e) => {
                                        setForgotValue(e.target.value);
                                        setForgotError('');
                                    }}
                                    disabled={forgotLoading}
                                    placeholder={
                                        detectedRole === 'admin'
                                            ? 'Admin username or email'
                                            : 'Employee ID or email'
                                    }
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 10,
                                        border: '1px solid #e5e7eb',
                                        backgroundColor: '#f9fafb',
                                        fontSize: 14,
                                        color: '#111827',
                                        outline: 'none',
                                        marginBottom: 8,
                                    }}
                                />
                                {forgotError && (
                                    <div
                                        style={{
                                            marginBottom: 8,
                                            padding: '8px 10px',
                                            borderRadius: 8,
                                            border: '1px solid #fecaca',
                                            backgroundColor: '#fef2f2',
                                            color: '#b91c1c',
                                            fontSize: 12,
                                        }}
                                    >
                                        {forgotError}
                                    </div>
                                )}
                            </>
                        )}

                        <div
                            style={{
                                marginTop: 12,
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: 8,
                            }}
                        >
                            <button
                                type="button"
                                disabled={forgotLoading}
                                onClick={() => {
                                    setForgotOpen(false);
                                    setForgotValue('');
                                    setForgotError('');
                                    setForgotSuccess('');
                                }}
                                style={{
                                    padding: '8px 14px',
                                    borderRadius: 999,
                                    border: 'none',
                                    backgroundColor: '#e5e7eb',
                                    color: '#374151',
                                    fontSize: 13,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>
                            {!forgotSuccess && (
                                <button
                                    type="button"
                                    disabled={forgotLoading}
                                    onClick={async () => {
                                        if (!forgotValue.trim()) {
                                            setForgotError('Please enter your email, username, or employee ID.');
                                            return;
                                        }
                                        setForgotLoading(true);
                                        setForgotError('');
                                        setForgotSuccess('');
                                        try {
                                            const trimmed = forgotValue.trim();
                                            if (isDualRoleEmail && trimmed.includes('@')) {
                                                setForgotError(
                                                    'This email is linked to both admin and employee accounts. Use your admin username to reset the admin password.'
                                                );
                                                return;
                                            }

                                            const useAdminApi =
                                                detectedRole === 'admin' ||
                                                (!detectedRole && !trimmed.includes('@'));

                                            const res = useAdminApi
                                                ? await adminAPI.forgotPassword(trimmed)
                                                : await employeeAPI.forgotPassword(trimmed);

                                            setForgotSuccess(
                                                res.data?.message ||
                                                'If this account exists, a password reset email has been sent.'
                                            );
                                        } catch (err) {
                                            const serverMsg =
                                                err?.response?.data?.error || err?.response?.data?.message;
                                            if (err?.response?.status === 404) {
                                                setForgotError(
                                                    'Account not found. Please check your username, email, or employee ID.'
                                                );
                                            } else {
                                                setForgotError(serverMsg || 'Failed to send reset email.');
                                            }
                                        } finally {
                                            setForgotLoading(false);
                                        }
                                    }}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: 999,
                                        border: 'none',
                                        backgroundColor: '#2563eb',
                                        color: '#ffffff',
                                        fontSize: 13,
                                        fontWeight: 600,
                                        cursor: forgotLoading ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    {forgotLoading ? (
                                        <Loader2 className="animate-spin" size={16} />
                                    ) : (
                                        'Submit'
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Contact Admin Overlay */}
            {contactAdminOpen && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(15,23,42,0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 100,
                        padding: '16px',
                        backdropFilter: 'blur(4px)',
                    }}
                    onClick={() => {
                        if (!contactingStatus.loading) setContactAdminOpen(false);
                    }}
                >
                    <div
                        className="unified-contact-dialog"
                        style={{
                            width: '100%',
                            maxWidth: 500,
                            backgroundColor: '#ffffff',
                            borderRadius: 24,
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            padding: '32px',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            position: 'relative',
                            msOverflowStyle: 'none',
                            scrollbarWidth: 'none',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 8, textAlign: 'center' }}>
                            Contact Your Admin
                        </h2>
                        <p style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24 }}>
                            Enter your Employee ID to find your organization's administrator.
                        </p>

                        {!selectedOrg ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="Enter your Employee ID..."
                                        value={orgSearchQuery}
                                        onChange={(e) => handleEmployeeIdSearch(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '12px 16px',
                                            borderRadius: 12,
                                            border: '1px solid #e2e8f0',
                                            fontSize: 15,
                                            outline: 'none',
                                            transition: 'border-color 0.2s',
                                            borderColor: orgSearchQuery.length >= 2 ? '#2563eb' : '#e2e8f0'
                                        }}
                                    />
                                    {searchingOrgs && (
                                        <div style={{ position: 'absolute', right: 12, top: 12 }}>
                                            <Loader2 className="animate-spin" size={18} color="#94a3b8" />
                                        </div>
                                    )}
                                </div>

                                <div className="unified-contact-list" style={{ minHeight: 100, maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                                    {orgSearchResults.length > 0 ? (
                                        orgSearchResults.map((org) => (
                                            <div
                                                key={org.domain}
                                                onClick={() => setSelectedOrg(org)}
                                                style={{
                                                    padding: '12px 16px',
                                                    borderRadius: 12,
                                                    border: '1px solid #f1f5f9',
                                                    backgroundColor: '#f8fafc',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{org.name}</div>
                                                        <div style={{ fontSize: 12, color: '#64748b' }}>{org.domain}</div>
                                                    </div>
                                                    <div style={{ fontSize: 10, backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: 4, color: '#475569' }}>
                                                        Found for: {org.employeeName}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : orgSearchQuery.length >= 2 && !searchingOrgs ? (
                                        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
                                            No organizations found matching "{orgSearchQuery}"
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
                                            Start typing to search...
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{
                                    padding: '12px',
                                    borderRadius: 12,
                                    backgroundColor: '#eff6ff',
                                    border: '1px solid #dbeafe',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontSize: 12, color: '#1e40af', fontWeight: 600 }}>Selected Organization</div>
                                        <div style={{ fontWeight: 700, color: '#1e3a8a' }}>{selectedOrg.name}</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedOrg(null)}
                                        style={{ fontSize: 12, color: '#2563eb', border: 'none', background: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                        Change
                                    </button>
                                </div>

                                {selectedOrg.adminName && (
                                    <div style={{ fontSize: 13, color: '#475569' }}>
                                        <strong>Admin:</strong> {selectedOrg.adminName}
                                    </div>
                                )}

                                {contactingStatus.success ? (
                                    <div style={{
                                        padding: '16px',
                                        borderRadius: 12,
                                        backgroundColor: '#f0fdf4',
                                        border: '1px solid #bbf7d0',
                                        color: '#166534',
                                        textAlign: 'center',
                                        fontSize: 14
                                    }}>
                                        {contactingStatus.success}
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            <input
                                                required
                                                type="text"
                                                placeholder="Your Full Name"
                                                value={contactForm.name}
                                                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', outline: 'none' }}
                                            />
                                            <input
                                                required
                                                type="email"
                                                placeholder="Your Email Address"
                                                value={contactForm.email}
                                                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', outline: 'none' }}
                                            />
                                            <textarea
                                                required
                                                placeholder="How can your administrator help?"
                                                rows={4}
                                                value={contactForm.message}
                                                onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', outline: 'none', resize: 'none' }}
                                            />
                                        </div>

                                        {contactingStatus.error && (
                                            <div style={{ color: '#b91c1c', fontSize: 12, textAlign: 'center' }}>
                                                {contactingStatus.error}
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={contactingStatus.loading}
                                            style={{
                                                padding: '12px',
                                                borderRadius: 999,
                                                border: 'none',
                                                background: '#2563eb',
                                                color: 'white',
                                                fontWeight: 600,
                                                cursor: contactingStatus.loading ? 'not-allowed' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 8,
                                                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                                            }}
                                        >
                                            {contactingStatus.loading ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={18} />
                                                    Sending...
                                                </>
                                            ) : (
                                                'Send Message'
                                            )}
                                        </button>
                                    </>
                                )}
                            </form>
                        )}

                        <div style={{ marginTop: 24, textAlign: 'center' }}>
                            <button
                                type="button"
                                onClick={() => setContactAdminOpen(false)}
                                style={{
                                    border: 'none',
                                    background: 'none',
                                    color: '#64748b',
                                    fontSize: 14,
                                    cursor: 'pointer'
                                }}
                            >
                                {contactingStatus.success ? 'Close' : 'Cancel'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
