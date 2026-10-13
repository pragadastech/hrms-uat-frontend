import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, LogOut, ArrowUpCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/**
 * SubscriptionGate component that monitors the subscription status
 * and displays a non-dismissible modal if the subscription has expired.
 * Non-admin employees are silently logged out and redirected to login.
 */
const SubscriptionGate = ({ children }) => {
  const { planInfo, logout, hasAdminAccess, isAuthenticated, sessionType } = useAuth();
  const navigate = useNavigate();

  const isExpired = isAuthenticated() && sessionType !== 'super-admin' && planInfo?.isExpired === true;
  const isUpgradePath = window.location.pathname === '/admin/organization-setup';

  // Don't show for super-admin or unauthenticated users
  if (!isAuthenticated() || sessionType === 'super-admin') {
    return <>{children}</>;
  }

  if (!isExpired || isUpgradePath) {
    return <>{children}</>;
  }

  const handleLogout = () => {
    logout(true);
    navigate('/login');
  };

  const handleUpgrade = () => {
    navigate('/admin/organization-setup');
  };

  const styles = {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      animation: 'subGateFadeIn 0.4s ease-out'
    },
    modal: {
      width: '100%',
      maxWidth: '440px',
      backgroundColor: 'var(--white-5, #ffffff)',
      borderRadius: '24px',
      overflow: 'hidden',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      position: 'relative',
      animation: 'subGateSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
    },
    accent: {
      height: '6px',
      background: 'linear-gradient(90deg, #ef4444 0%, #f97316 50%, #ef4444 100%)'
    },
    content: {
      padding: '40px 32px'
    },
    iconWrapper: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: '24px'
    },
    iconContainer: {
      padding: '20px',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderRadius: '50%',
      color: '#ef4444'
    },
    title: {
      fontSize: '24px',
      fontWeight: '700',
      textAlign: 'center',
      color: 'var(--dark-500, #111827)',
      marginBottom: '12px',
      letterSpacing: '-0.02em'
    },
    description: {
      fontSize: '15px',
      lineHeight: '1.6',
      textAlign: 'center',
      color: 'var(--gray-500, #6b7280)',
      marginBottom: '32px'
    },
    buttonStack: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    },
    primaryBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '14px',
      backgroundColor: 'var(--primary-600, #4f46e5)',
      color: '#ffffff',
      fontWeight: '600',
      fontSize: '15px',
      borderRadius: '12px',
      transition: 'all 0.2s ease',
      boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)',
      cursor: 'pointer'
    },
    secondaryBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '14px',
      backgroundColor: 'var(--gray-10, #f3f4f6)',
      color: 'var(--dark-500, #374151)',
      fontWeight: '600',
      fontSize: '15px',
      borderRadius: '12px',
      transition: 'all 0.2s ease',
      cursor: 'pointer'
    },
    logoutBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '14px',
      backgroundColor: '#ef4444',
      color: '#ffffff',
      fontWeight: '600',
      fontSize: '15px',
      borderRadius: '12px',
      transition: 'all 0.2s ease',
      boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)',
      cursor: 'pointer'
    },
    footerText: {
      marginTop: '24px',
      textAlign: 'center',
      fontSize: '11px',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      fontWeight: '600',
      color: 'var(--gray-400, #9ca3af)'
    }
  };

  return (
    <>
      <style>
        {`
          @keyframes subGateFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes subGateSlideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .sub-gate-btn:hover {
            transform: translateY(-2px);
            filter: brightness(1.1);
          }
          .sub-gate-btn:active {
            transform: translateY(0);
          }
        `}
      </style>

      <div style={{ filter: 'blur(5px)', pointerEvents: 'none' }}>
        {children}
      </div>

      <div style={styles.overlay}>
        <div style={styles.modal}>
          <div style={styles.accent} />
          
          <div style={styles.content}>
            <div style={styles.iconWrapper}>
              <div style={styles.iconContainer}>
                <AlertCircle size={48} strokeWidth={1.5} />
              </div>
            </div>

            <h2 style={styles.title}>Subscription Expired</h2>
            
            <p style={styles.description}>
              {hasAdminAccess() 
                ? "Your subscription has expired. Please upgrade/renewal your plan to continue using HRMS features."
                : "Your subscription has expired. Please contact your administrator to upgrade/renew the plan and regain access."
              }
            </p>

            <div style={styles.buttonStack}>
              {hasAdminAccess() && (
                <button
                  onClick={handleUpgrade}
                  className="sub-gate-btn"
                  style={styles.primaryBtn}
                >
                  <ArrowUpCircle size={20} />
                  Upgrade Plan
                </button>
              )}
              
              <button
                onClick={handleLogout}
                className="sub-gate-btn"
                style={hasAdminAccess() ? styles.secondaryBtn : styles.logoutBtn}
              >
                <LogOut size={20} />
                Logout
              </button>
            </div>
            
            <p style={styles.footerText}>
              Platform Access Restricted
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default SubscriptionGate;
