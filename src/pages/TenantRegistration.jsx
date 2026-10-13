import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, CheckCircle2, Building2, ArrowRight, Loader2, AlertCircle, MapPin, Navigation, Map as MapIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { publicSignupAPI } from '../services/api';

// ── Validation Constants (mirror backend SignupValidationService) ──────
const COMPANY_NAME_BLACKLIST = new Set([
  'test', 'demo', 'sample', 'xyz', 'abc', 'trial',
  'fake', 'dummy', 'example', 'temp', 'temporary',
  'testing', 'null', 'none', 'asdf', 'qwerty',
  'aaa', 'bbb', 'ccc', 'zzz', 'foobar', 'foo', 'bar',
]);

const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'yahoo.in', 'yahoo.co.in',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'aol.com', 'icloud.com', 'me.com', 'mac.com',
  'mail.com', 'email.com', 'usa.com',
  'yandex.com', 'yandex.ru', 'protonmail.com', 'proton.me',
  'zoho.com', 'rediffmail.com', 'inbox.com',
  'gmx.com', 'gmx.net', 'fastmail.com',
]);

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com', '10minutemail.com', 'guerrillamail.com',
  'tempmail.com', 'throwaway.email', 'temp-mail.org',
  'fakeinbox.com', 'sharklasers.com', 'guerrillamailblock.com',
  'grr.la', 'dispostable.com', 'yopmail.com',
  'trashmail.com', 'trashmail.net', 'trashmail.me',
  'mohmal.com', 'getnada.com', 'maildrop.cc',
  'mailnesia.com', 'tempail.com', 'tempr.email',
  'discard.email', 'discardmail.com', 'discardmail.de',
  'mailcatch.com', 'harakirimail.com', 'crazymailing.com',
  'mailexpire.com', 'mytemp.email', 'throwam.com',
  'burnermail.io', 'emailondeck.com', 'mintemail.com',
  'mt2015.com', 'thankyou2010.com', 'spamgourmet.com',
  'mailnull.com', 'spamhereplease.com', 'safetymail.info',
  'binkmail.com', 'spaml.com',
  // Blocked by request
  'necub.com', 'tempail.com',
]);

/** Extract domain from an email address */
const getEmailDomain = (email) => {
  if (!email || !email.includes('@')) return '';
  return email.split('@').pop().toLowerCase().trim();
};

/** Check if an email uses a personal domain */
const isPersonalEmail = (email) => {
  const domain = getEmailDomain(email);
  // Block necub.com and tempail.com explicitly
  if (domain === 'necub.com' || domain === 'tempail.com') return true;
  // Block any email like zuspajafye@necub.com (random string @ necub.com)
  if (domain === 'necub.com') {
    // Block all necub.com emails
    return true;
  }
  return PERSONAL_EMAIL_DOMAINS.has(domain) || DISPOSABLE_EMAIL_DOMAINS.has(domain);
};

/** Check if company name contains blacklisted words */
const hasBlacklistedWord = (name) => {
  if (!name) return false;
  const words = name.toLowerCase().trim().split(/\s+/);
  return words.some((w) => COMPANY_NAME_BLACKLIST.has(w.replace(/[^a-z0-9]/g, '')));
};

export default function TenantRegistration() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [accountForm, setAccountForm] = useState({
    email: '',
  });

  const [otp, setOtp] = useState('');
  const [tempToken, setTempToken] = useState(null);

  const [orgForm, setOrgForm] = useState({
    orgName: '',
    domain: '',
    industry: '',
    companySize: '',
    address: '',
    latitude: '',
    longitude: '',
  });

  const [domainStatus, setDomainStatus] = useState({
    checkedDomain: '',
    available: null,
    message: '',
  });

  const [emailStatus, setEmailStatus] = useState({
    checkedEmail: '',
    exists: null,
    message: '',
  });
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const emailCheckTimer = useRef(null);
  const domainCheckTimer = useRef(null);

  // ── Company name validation state ──
  const [nameWarning, setNameWarning] = useState('');
  // ── Email domain validation state ──
  const [emailDomainWarning, setEmailDomainWarning] = useState('');
  // Track domain/email mismatch error for submit button logic
  const domainEmailMismatch = (accountForm.email.includes('@') && orgForm.domain.trim())
    ? (getEmailDomain(accountForm.email) !== orgForm.domain.trim().toLowerCase())
    : false;
  // Manual address fallback (D-01): allows users who deny geolocation to type address
  const [manualAddress, setManualAddress] = useState(false);

  const resetErrors = () => {
    setError('');
    setSuccessMessage('');
  };

  // ── Check email availability via backend ──
  const checkEmailAvailability = async (email) => {
    try {
      const res = await publicSignupAPI.checkEmailExists(email);
      const data = res?.data || res;
      setEmailStatus({
        checkedEmail: email,
        exists: data?.exists ?? null,
        message: data?.message || '',
      });
    } catch (err) {
      console.error('Email availability check error:', err);
      setEmailStatus({ checkedEmail: email, exists: null, message: '' });
    }
  };

  const handleAccountChange = (e) => {
    const { name, value } = e.target;
    setAccountForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');

    if (name === 'email') {
      // Reset email-related state while typing or changing email
      setEmailStatus({ checkedEmail: '', exists: null, message: '' });
      setEmailDomainWarning('');
      setSuccessMessage('');

      // Client-side: check for personal/disposable email domains immediately
      const trimmed = value.trim();
      if (trimmed && trimmed.includes('@')) {
        const domain = getEmailDomain(trimmed);
        if (PERSONAL_EMAIL_DOMAINS.has(domain)) {
          setEmailDomainWarning('Personal email domains (e.g., gmail.com) are not allowed. Please use your company email.');
        } else if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
          setEmailDomainWarning('Disposable/temporary email addresses are not allowed.');
        }
      }

      // Debounced availability check
      if (emailCheckTimer.current) {
        clearTimeout(emailCheckTimer.current);
      }
      emailCheckTimer.current = setTimeout(() => {
        const t = value.trim();
        if (t && t.includes('@') && !isPersonalEmail(t)) {
          checkEmailAvailability(t);
        }
      }, 500);
    }
  };

  const handleOrgChange = (e) => {
    const { name, value } = e.target;
    setOrgForm((prev) => ({ ...prev, [name]: value }));

    // ── Company Name: real-time blacklist and length check ──
    if (name === 'orgName') {
      const trimmed = value.trim();
      if (trimmed.length > 0 && trimmed.length < 3) {
        setNameWarning('Company name must be at least 3 characters long.');
      } else if (hasBlacklistedWord(value)) {
        setNameWarning('Please enter a valid company name. Test/demo names are not allowed.');
      } else {
        setNameWarning('');
      }
    }

    // ── Domain: real-time validation ──
    if (name === 'domain') {
      setDomainStatus({ checkedDomain: '', available: null, message: '' });
      if (domainCheckTimer.current) {
        clearTimeout(domainCheckTimer.current);
      }
      domainCheckTimer.current = setTimeout(() => {
        let trimmed = value.trim();
        // Remove protocol if present
        trimmed = trimmed.replace(/^https?:\/\//i, '').replace(/\/$/, '');
        if (trimmed) {
          // Client-side: block personal/disposable domains immediately
          if (PERSONAL_EMAIL_DOMAINS.has(trimmed.toLowerCase())) {
            setDomainStatus({ checkedDomain: trimmed, available: false, message: 'Personal email domains (e.g., gmail.com) are not allowed as company domains.' });
            return;
          }
          if (DISPOSABLE_EMAIL_DOMAINS.has(trimmed.toLowerCase())) {
            setDomainStatus({ checkedDomain: trimmed, available: false, message: 'Disposable/temporary domains are not allowed.' });
            return;
          }

          setOrgForm((prev) => ({ ...prev, domain: trimmed }));
          setDomainStatus({ checkedDomain: trimmed, available: null, message: 'Checking domain...' });
          checkDomainAvailability(trimmed);
        }
      }, 500);
    }
    if (name === 'address') {
      if (!orgForm.latitude && !orgForm.longitude) {
        setManualAddress(true);
      }
    }
    if (error) setError('');
  };

  const handleGetLocation = () => {
    if ("geolocation" in navigator) {
      toast.loading('Detecting location...', { id: 'location-detect' });
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setOrgForm(prev => ({
            ...prev,
            latitude: latitude.toFixed(6),
            longitude: longitude.toFixed(6)
          }));

          try {
            // Simple reverse geocoding using Nominatim (open source)
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
            const data = await response.json();
            if (data && data.display_name) {
              setOrgForm(prev => ({
                ...prev,
                address: data.display_name
              }));
              toast.success('Location detected successfully!', { id: 'location-detect' });
            } else {
              toast.success(`Coords: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, { id: 'location-detect' });
            }
          } catch (err) {
            console.error('Reverse geocoding error:', err);
            toast.success(`Coords: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, { id: 'location-detect' });
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          toast.error('Unable to get location: ' + error.message, { id: 'location-detect' });
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      toast.error("Geolocation is not supported by this browser.");
    }
  };

  // Helper to check if a domain exists by trying to fetch its homepage
  async function checkDomainExists(domain) {
    // Disallow protocol in domain
    if (/^https?:\/\//i.test(domain)) {
      setDomainStatus({ checkedDomain: domain, available: false, message: 'Please enter only the domain name, not the URL (e.g., example.com)' });
      return false;
    }
    setDomainStatus((prev) => ({ ...prev, message: 'Checking domain...', available: null }));
    try {
      // Try to fetch the domain homepage (http)
      const response = await fetch(`https://${domain}`, { method: 'HEAD', mode: 'no-cors' });
      // If fetch does not throw, assume domain exists (no-cors mode can't check status)
      return true;
    } catch (err) {
      // Try http if https fails
      try {
        await fetch(`http://${domain}`, { method: 'HEAD', mode: 'no-cors' });
        return true;
      } catch (e) {
        return false;
      }
    }
  }

  const checkDomainAvailability = async (domain) => {
    try {
      const res = await publicSignupAPI.domainAvailability(domain);
      const data = res?.data || res;
      setDomainStatus({
        checkedDomain: domain,
        available: data?.available ?? null,
        message: data?.message || (data?.available ? 'Domain is available' : 'Domain is already in use'),
      });
    } catch (err) {
      console.error('Domain availability error', err);
      setDomainStatus({
        checkedDomain: domain,
        available: null,
        message: 'Unable to check domain right now.',
      });
    }
  };

  const validateAccountStep = () => {
    const email = accountForm.email.trim();
    if (!email) {
      setError('Please enter your work email.');
      return false;
    }
    // Block personal/disposable email domains
    if (isPersonalEmail(email)) {
      setError('Please use a company email address. Personal email domains (e.g., gmail.com, yahoo.com) are not allowed.');
      return false;
    }
    if (
      emailStatus.checkedEmail &&
      emailStatus.checkedEmail === email &&
      emailStatus.exists === true
    ) {
      setError(emailStatus.message || 'This email is already registered. Please login instead.');
      return false;
    }
    return true;
  };

  const handleAccountSubmit = async (e) => {
    e.preventDefault();
    resetErrors();

    if (!validateAccountStep()) return;

    setLoading(true);
    try {
      // Step 1: initiate signup (backend handles OTP generation and delivery)
      await publicSignupAPI.signup(accountForm.email);

      // Successfully initiated (OTP is already sent by the 'signup' endpoint)
      setStep(2);
      setSuccessMessage('We have sent a 6-digit verification code to your email.');
    } catch (err) {
      console.error('Tenant signup error detail:', {
        status: err.response?.status,
        data: err.response?.data,
        headers: err.response?.headers
      });
      
      const status = err.response?.status;
      const data = err.response?.data;
      
      let msg = 'Unable to start signup. Please try again.';

      // Try to extract message from various possible response formats
      if (data) {
        if (typeof data === 'string') {
          msg = data;
        } else if (data.message) {
          msg = data.message;
        } else if (data.error) {
          msg = data.error;
        }
      }

      // Special handling for rate limiting - prioritize this message if detected in status OR content
      if (status === 429 || (typeof data === 'string' && data.includes('429')) || (msg && msg.toLowerCase().includes('too many requests'))) {
        msg = 'Verification code requests are limited to once per minute. Please wait before trying again.';
      } else if (status === 400 && msg === 'Unable to start signup. Please try again.') {
        msg = 'The email address provided is invalid or not allowed. Please use a work email.';
      }

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    resetErrors();

    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await publicSignupAPI.verifyOtp(accountForm.email, otp);
      const data = res?.data || res;

      if (!data?.verified) {
        setError('Verification failed. Please check the code and try again.');
        setLoading(false);
        return;
      }

      setTempToken(data.tempToken || null);
      setStep(3);
      setSuccessMessage('Email verified successfully. Tell us about your company.');
    } catch (err) {
      console.error('OTP verification error', err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Unable to verify code. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const validateOrgStep = () => {
    if (!orgForm.orgName.trim() || orgForm.orgName.trim().length < 3) {
      setError('Please enter a valid company name (at least 3 characters).');
      return false;
    }
    // 1. Company name blacklist
    if (hasBlacklistedWord(orgForm.orgName)) {
      setError('Please enter a valid company name. Test/demo/sample names are not allowed.');
      return false;
    }
    if (!orgForm.domain.trim()) {
      setError('Please enter your company domain.');
      return false;
    }
    // 2. Block personal/disposable domains
    const domainLower = orgForm.domain.trim().toLowerCase();
    if (PERSONAL_EMAIL_DOMAINS.has(domainLower) || DISPOSABLE_EMAIL_DOMAINS.has(domainLower)) {
      setError('Please use a valid company domain. Personal and disposable email domains are not allowed.');
      return false;
    }
    // 3. Email ↔ Domain match
    const emailDomain = getEmailDomain(accountForm.email);
    if (emailDomain && domainLower && emailDomain !== domainLower) {
      setError(`Your email domain (@${emailDomain}) does not match the company domain (${domainLower}). Please use an email on the same domain.`);
      return false;
    }
    if (!orgForm.industry.trim()) {
      setError('Please select your industry.');
      return false;
    }
    if (!orgForm.companySize.trim()) {
      setError('Please select your company size.');
      return false;
    }
    // Address: require text address. Location coordinates are optional.
    const addressStr = orgForm.address.trim();
    if (!addressStr) {
      setError('Please enter your company address.');
      return false;
    }
    if (addressStr.length < 5) {
      setError('Company address must be at least 5 characters long.');
      return false;
    }

    // 11. Duplicate domain check
    if (
      domainStatus.checkedDomain &&
      domainStatus.checkedDomain === orgForm.domain.trim() &&
      domainStatus.available === false
    ) {
      setError(domainStatus.message || 'This domain is already in use. Please choose a different domain.');
      return false;
    }
    return true;
  };

  const handleOrgSubmit = async (e) => {
    e.preventDefault();
    resetErrors();

    if (!validateOrgStep()) return;

    setLoading(true);
    try {
      const payload = {
        orgName: orgForm.orgName.trim(),
        domain: orgForm.domain.trim(),
        industry: orgForm.industry.trim(),
        companySize: orgForm.companySize.trim(),
        contactEmail: accountForm.email.trim(),
        address: orgForm.address.trim() || null,
        latitude: orgForm.latitude || null,
        longitude: orgForm.longitude || null,
      };

      await publicSignupAPI.tenantRegister(payload, tempToken);

      setRegistrationComplete(true);
      setSuccessMessage('Tenant registered successfully.');
    } catch (err) {
      console.error('Tenant registration error', err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Unable to complete registration. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { id: 1, label: 'Account' },
      { id: 2, label: 'Verify Email' },
      { id: 3, label: 'Company' },
    ];

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}
      >
        {steps.map((s, index) => {
          const isActive = step === s.id;
          const isCompleted = step > s.id;
          return (
            <div
              key={s.id}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '999px',
                  border: isActive || isCompleted ? 'none' : '1px solid #e5e7eb',
                  background: isCompleted
                    ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                    : isActive
                      ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
                      : 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow:
                    isActive || isCompleted
                      ? '0 4px 10px rgba(79,70,229,0.25)'
                      : 'none',
                  color: isActive || isCompleted ? 'white' : '#6b7280',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {isCompleted ? <CheckCircle2 size={18} /> : s.id}
              </div>
              <div style={{ marginLeft: 8 }}>
                <div
                  style={{
                    fontSize: 12,
                    textTransform: 'uppercase',
                    color: isActive || isCompleted ? '#4f46e5' : '#9ca3af',
                    letterSpacing: 0.05,
                  }}
                >
                  Step {s.id}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#111827',
                  }}
                >
                  {s.label}
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    marginLeft: 12,
                    marginRight: 12,
                    borderRadius: 999,
                    background:
                      step > s.id
                        ? 'linear-gradient(90deg, #4f46e5 0%, #22c55e 100%)'
                        : '#e5e7eb',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const commonInputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    fontSize: '14px',
    color: '#111827',
    outline: 'none',
    backgroundColor: 'white',
  };

  const renderAccountStep = () => (
    <form
      onSubmit={handleAccountSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      <div>
        <label
          htmlFor="email"
          style={{
            display: 'block',
            fontSize: '14px',
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
            value={accountForm.email}
            onChange={handleAccountChange}
            style={{ ...commonInputStyle, paddingLeft: 36 }}
            placeholder="you@company.com"
          />
          <Mail
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9ca3af',
            }}
          />
          {accountForm.email.trim() && emailStatus.message && (
            <span
              title={emailStatus.message}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'default',
              }}
            >
              {emailStatus.exists === true ? (
                <AlertCircle size={18} color="#b91c1c" />
              ) : emailStatus.exists === false ? (
                <CheckCircle2 size={18} color="#16a34a" />
              ) : null}
            </span>
          )}
        </div>
        {/* Email domain warning */}
        {emailDomainWarning && (
          <p style={{ marginTop: 4, fontSize: 12, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={12} />
            {emailDomainWarning}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          marginTop: 4,
          padding: '12px',
          borderRadius: '999px',
          border: 'none',
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          color: 'white',
          fontSize: '15px',
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
            Starting your trial...
          </>
        ) : (
          <>
            Continue
            <ArrowRight size={18} />
          </>
        )}
      </button>
    </form>
  );

  const renderOtpStep = () => (
    <form
      onSubmit={handleVerifyOtp}
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      <div>
        <label
          htmlFor="otp"
          style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 500,
            color: '#374151',
            marginBottom: 6,
          }}
        >
          Enter Verification Code
        </label>
        <input
          id="otp"
          name="otp"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          autoCorrect="off"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
          style={{
            ...commonInputStyle,
            letterSpacing: 8,
            textAlign: 'center',
            fontWeight: 700,
            fontSize: '18px',
          }}
          placeholder="123456"
        />
        <p
          style={{
            marginTop: 6,
            fontSize: 12,
            color: '#6b7280',
          }}
        >
          We sent a 6-digit code to{' '}
          <span style={{ fontWeight: 500 }}>{accountForm.email}</span>.
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
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          color: 'white',
          fontSize: '15px',
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
            Verifying...
          </>
        ) : (
          <>
            Verify Email
            <CheckCircle2 size={18} />
          </>
        )}
      </button>

      <button
        type="button"
        onClick={() => {
          // Go back to email step and clear OTP-related state
          setStep(1);
          setOtp('');
          setTempToken(null);
          setEmailStatus({ checkedEmail: '', exists: null, message: '' });
          setSuccessMessage('');
        }}
        disabled={loading}
        style={{
          marginTop: 4,
          padding: '10px',
          borderRadius: 999,
          border: 'none',
          background: 'transparent',
          color: '#6b7280',
          fontSize: 13,
          fontWeight: 500,
          cursor: loading ? 'not-allowed' : 'pointer',
          textDecoration: 'underline',
        }}
      >
        Change email
      </button>
    </form>
  );

  const renderOrgStep = () => (
    <form
      onSubmit={handleOrgSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
    >
      <div>
        <label
          htmlFor="orgName"
          style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 500,
            color: '#374151',
            marginBottom: 6,
          }}
        >
          Company Name
        </label>
        <div style={{ position: 'relative' }}>
          <input
            id="orgName"
            name="orgName"
            type="text"
            required
            value={orgForm.orgName}
            onChange={handleOrgChange}
            style={{ ...commonInputStyle, paddingLeft: 36 }}
            placeholder="Acme Technologies Pvt Ltd"
          />
          <Building2
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9ca3af',
            }}
          />
        </div>
        {/* Company name blacklist warning */}
        {nameWarning && (
          <p style={{ marginTop: 4, fontSize: 12, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={12} />
            {nameWarning}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="domain"
          style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 500,
            color: '#374151',
            marginBottom: 6,
          }}
        >
          Company Domain
        </label>
        <div style={{ position: 'relative' }}>
          <input
            id="domain"
            name="domain"
            type="text"
            required
            value={orgForm.domain}
            onChange={handleOrgChange}
            style={commonInputStyle}
            placeholder="yourcompany.com"
          />
          {orgForm.domain.trim() && domainStatus.message && (
            <span
              title={domainStatus.message}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'default',
              }}
            >
              {domainStatus.available === false ? (
                <AlertCircle size={18} color="#b91c1c" />
              ) : domainStatus.available === true ? (
                <CheckCircle2 size={18} color="#16a34a" />
              ) : null}
            </span>
          )}
        </div>
        {/* Domain status message */}
        {orgForm.domain.trim() && domainStatus.message && domainStatus.available === false && (
          <p style={{ marginTop: 4, fontSize: 12, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={12} />
            {domainStatus.message}
          </p>
        )}
        {/* Email-Domain mismatch warning */}
        {domainEmailMismatch && (
          <p style={{ marginTop: 4, fontSize: 12, color: '#d97706', display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={12} />
            {`Your email domain (@${getEmailDomain(accountForm.email)}) doesn't match company domain (${orgForm.domain.trim().toLowerCase()}).`}
          </p>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 160 }}>
          <label
            htmlFor="industry"
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: '#374151',
              marginBottom: 6,
            }}
          >
            Industry
          </label>
          <select
            id="industry"
            name="industry"
            value={orgForm.industry}
            onChange={handleOrgChange}
            style={commonInputStyle}
            required
          >
            <option value="">Select industry</option>
            <option value="IT & Software">IT & Software</option>
            <option value="Consulting">Consulting</option>
            <option value="Manufacturing">Manufacturing</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Education">Education</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div style={{ flex: 1, minWidth: 160 }}>
          <label
            htmlFor="companySize"
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: '#374151',
              marginBottom: 6,
            }}
          >
            Company Size
          </label>
          <select
            id="companySize"
            name="companySize"
            value={orgForm.companySize}
            onChange={handleOrgChange}
            style={commonInputStyle}
            required
          >
            <option value="">Select team size</option>
            <option value="1-10">1-10 people</option>
            <option value="11-50">11-50 people</option>
            <option value="51-200">51-200 people</option>
            <option value="201-500">201-500 people</option>
            <option value="500+">500+ people</option>
          </select>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label
            htmlFor="address"
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: '#374151',
            }}
          >
            Company Address
          </label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {!manualAddress && (
              <button
                type="button"
                id="btn-detect-location"
                onClick={handleGetLocation}
                style={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#4f46e5',
                  background: '#eef2ff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Navigation size={12} />
                Detect Live Location
              </button>
            )}
            <button
              type="button"
              id="btn-toggle-manual-address"
              onClick={() => {
                setManualAddress(m => !m);
                // Clear coordinates when switching to manual so validation doesn't silently pass old coords
                if (!manualAddress) {
                  setOrgForm(prev => ({ ...prev, latitude: '', longitude: '' }));
                }
                if (error) setError('');
              }}
              style={{
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: 600,
                color: manualAddress ? '#16a34a' : '#6b7280',
                background: manualAddress ? '#f0fdf4' : '#f3f4f6',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <MapIcon size={11} />
              {manualAddress ? 'Using manual entry' : 'Enter manually'}
            </button>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <textarea
            id="address"
            name="address"
            rows={2}
            value={orgForm.address}
            onChange={handleOrgChange}
            readOnly={!manualAddress && !!(orgForm.latitude && orgForm.longitude)}
            style={{
              ...commonInputStyle,
              paddingLeft: '36px',
              resize: 'vertical',
              background: (!manualAddress && !!(orgForm.latitude && orgForm.longitude)) ? '#f9fafb' : undefined,
            }}
            placeholder={manualAddress
              ? 'Type your full company address (e.g. 123 MG Road, Bengaluru, Karnataka)'
              : 'Detect live location or switch to manual entry'}
          />
          <MapPin
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '12px',
              color: '#9ca3af',
            }}
          />
        </div>
        {(orgForm.latitude || orgForm.longitude) && !manualAddress && (
          <div style={{ marginTop: 4, fontSize: '10px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={10} />
            Live location captured: {orgForm.latitude}, {orgForm.longitude}
          </div>
        )}
        {manualAddress && (
          <p style={{ marginTop: 4, fontSize: '11px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={11} />
            Location coordinates won't be recorded. You can add them later in settings.
          </p>
        )}
      </div>

      {/* Submit button: visible once all required fields are filled.
          In manual-address mode, lat/lng are not required. */}
      {orgForm.orgName.trim() &&
        orgForm.domain.trim() &&
        orgForm.industry.trim() &&
        orgForm.companySize.trim() &&
        orgForm.address.trim() ? (
        <button
          type="submit"
          disabled={loading || !!error || domainEmailMismatch}
          style={{
            marginTop: 4,
            padding: '12px',
            borderRadius: '999px',
            border: 'none',
            background: loading || !!error || domainEmailMismatch
              ? 'linear-gradient(135deg, #a1a1aa 0%, #6b7280 100%)'
              : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            color: 'white',
            fontSize: '15px',
            fontWeight: 600,
            cursor: loading || !!error || domainEmailMismatch ? 'not-allowed' : 'pointer',
            opacity: loading || !!error || domainEmailMismatch ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Creating your tenant...
            </>
          ) : (
            <>
              Start Free Trial
              <ArrowRight size={18} />
            </>
          )}
        </button>
      ) : null}
    </form>
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'row',
        fontFamily: "'Inter', sans-serif",
        backgroundColor: '#0f172a',
      }}
    >
      {/* Left panel – signup form, same style family as login */}
      <div
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
          style={{
            maxWidth: 560,
            width: '100%',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 18,
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 10px',
                  borderRadius: 999,
                  backgroundColor: '#eef2ff',
                  color: '#4f46e5',
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.08,
                  marginBottom: 6,
                }}
              >
                Start Free Trial
              </div>
              <h1
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#0f172a',
                  margin: 0,
                }}
              >
                Create your Pragva workspace
              </h1>
              <p
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  color: '#6b7280',
                }}
              >
                15-day free trial · No credit card required · Modern multi-tenant HRMS.
              </p>
            </div>
          </div>

          {renderStepIndicator()}

          {/* Alerts */}
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
          {successMessage && !registrationComplete && (
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

          {registrationComplete && (
            <div
              style={{
                marginTop: 8,
                marginBottom: 16,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 16,
              }}
            >
              {/* Left column: summary */}
              <div
                style={{
                  flex: '1 1 260px',
                  padding: '14px 14px 12px 14px',
                  borderRadius: 16,
                  border: '1px solid #bbf7d0',
                  backgroundColor: '#f0fdf4',
                  color: '#166534',
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Your workspace is ready!</div>
                <p style={{ margin: '0 0 6px 0' }}>
                  We’ve sent an <strong>Admin Setup</strong> email to{' '}
                  <span style={{ fontWeight: 600 }}>{accountForm.email}</span>.
                </p>
                <p style={{ margin: 0, fontSize: 12 }}>
                  This email lets you create the first admin account for your organization and start
                  using Pragva HRMS.
                </p>
              </div>

              {/* Right column: clear next steps and CTA */}
              <div
                style={{
                  flex: '1 1 220px',
                  padding: '14px 14px 12px 14px',
                  borderRadius: 16,
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#f9fafb',
                  color: '#111827',
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Next steps</div>
                <ol style={{ margin: '4px 0 8px 18px', padding: 0 }}>
                  <li>Open your inbox for the admin email.</li>
                  <li>Click <strong>“Complete Admin Setup”</strong> in that email.</li>
                  <li>Enter the <strong>Admin Setup Code</strong> shown in the email.</li>
                  <li>Create your first admin username and password.</li>
                </ol>
                <p style={{ margin: '0 0 4px 0', fontSize: 12, color: '#4b5563' }}>
                  Tip: Check your spam or promotions folder if you don’t see the email.
                </p>
                <p style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>
                  Still not received it? Contact support at{' '}
                  <a href="mailto:info@pragva.in" style={{ color: '#4f46e5', fontWeight: 500 }}>
                    info@pragva.in
                  </a>
                  .
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  style={{
                    marginTop: 4,
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 999,
                    border: 'none',
                    background:
                      'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                  }}
                >
                  I have completed admin setup – Go to login
                </button>
              </div>
            </div>
          )}

          {/* Step content */}
          {!registrationComplete && (
            <>
              {step === 1 && renderAccountStep()}
              {step === 2 && renderOtpStep()}
              {step === 3 && renderOrgStep()}
            </>
          )}

          {/* Footer link (pre-registration) */}
          {!registrationComplete && (
            <div
              style={{
                marginTop: 20,
                textAlign: 'center',
                fontSize: 13,
                color: '#6b7280',
              }}
            >
              Already using Pragva?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#4f46e5',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Sign in
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right panel – gradient illustration, matching login style */}
      <div
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
          {/* Simple phone illustration reused for signup context */}
          <div
            style={{
              margin: '0 auto 28px auto',
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
                <CheckCircle2 size={26} color="#38bdf8" />
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                Pragva workspace
              </div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>ready to launch</div>
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
            Get your organization onboarded in minutes
          </h2>
          <p style={{ fontSize: 14, color: '#e5e7eb', maxWidth: 340, margin: '0 auto' }}>
            Create a tenant, invite admins, and start managing attendance, leaves, and assets
            from a single, secure HRMS platform.
          </p>
        </div>
      </div>
    </div>
  );
}

