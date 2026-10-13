import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound404() {
  const navigate = useNavigate();

  const handleGoHome = () => {
    // Determine the right dashboard without touching auth context,
    // so the session is never disturbed by landing on this page.
    const sessionType = window.safeSessionStorage?.getItem('sessionType');
    if (sessionType === 'admin') {
      navigate('/admin/dashboard', { replace: true });
    } else if (sessionType === 'super-admin') {
      navigate('/super-admin/dashboard', { replace: true });
    } else if (sessionType === 'employee') {
      navigate('/employee/dashboard', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Animated number */}
        <div style={styles.errorCode}>
          <span style={styles.four}>4</span>
          <span style={styles.zero}>0</span>
          <span style={styles.four}>4</span>
        </div>

        {/* Illustration */}
        <div style={styles.illustrationWrapper}>
          <svg viewBox="0 0 200 120" style={styles.svg} aria-hidden="true">
            {/* Ground */}
            <ellipse cx="100" cy="108" rx="80" ry="8" fill="#e2e8f0" />
            {/* Sign post */}
            <rect x="96" y="40" width="8" height="68" rx="2" fill="#94a3b8" />
            {/* Sign */}
            <rect x="56" y="18" width="88" height="34" rx="6" fill="#6366f1" />
            <text x="100" y="40" textAnchor="middle" fill="white" fontSize="12" fontWeight="700" fontFamily="Inter, sans-serif">
              PAGE NOT
            </text>
            <text x="100" y="46" textAnchor="middle" fill="white" fontSize="7" fontFamily="Inter, sans-serif">
              FOUND
            </text>
            {/* Arrow pointing left */}
            <path d="M44 35 L56 28 L56 42 Z" fill="#6366f1" />
          </svg>
        </div>

        <h1 style={styles.title}>Oops! Page not found</h1>
        <p style={styles.subtitle}>
          The page you're looking for doesn't exist or may have been moved.
          Your session is safe — you're still logged in.
        </p>

        <div style={styles.buttonGroup}>
          <button
            id="btn-go-home-404"
            onClick={handleGoHome}
            style={styles.primaryBtn}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(99,102,241,0.4)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(99,102,241,0.3)';
            }}
          >
            ← Go to My Dashboard
          </button>
          <button
            id="btn-go-back-404"
            onClick={() => navigate(-1)}
            style={styles.secondaryBtn}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#f1f5f9';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 50%, #f0fdf4 100%)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    padding: '24px',
  },
  card: {
    background: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(20px)',
    borderRadius: '24px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.8) inset',
    padding: '56px 48px',
    textAlign: 'center',
    maxWidth: '480px',
    width: '100%',
    border: '1px solid rgba(255,255,255,0.6)',
  },
  errorCode: {
    display: 'flex',
    justifyContent: 'center',
    gap: '4px',
    marginBottom: '8px',
    lineHeight: 1,
  },
  four: {
    fontSize: '96px',
    fontWeight: '900',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    letterSpacing: '-4px',
  },
  zero: {
    fontSize: '96px',
    fontWeight: '900',
    background: 'linear-gradient(135deg, #06b6d4, #6366f1)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    letterSpacing: '-4px',
  },
  illustrationWrapper: {
    margin: '8px auto 24px',
    width: '160px',
  },
  svg: {
    width: '100%',
    height: 'auto',
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#1e293b',
    margin: '0 0 12px',
    letterSpacing: '-0.3px',
  },
  subtitle: {
    fontSize: '15px',
    color: '#64748b',
    lineHeight: '1.6',
    margin: '0 0 32px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  primaryBtn: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '13px 28px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 15px rgba(99,102,241,0.3)',
    fontFamily: 'inherit',
  },
  secondaryBtn: {
    background: 'transparent',
    color: '#64748b',
    border: '1.5px solid #e2e8f0',
    borderRadius: '12px',
    padding: '13px 24px',
    fontSize: '15px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
    fontFamily: 'inherit',
  },
};
