import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X, ArrowUpCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const DISMISS_KEY = 'subscriptionExpiryWarningDismissed';

/**
 * Shows a dismissible banner on login when the tenant plan is expiring soon.
 * Expired subscriptions are handled by SubscriptionGate.
 */
const SubscriptionExpiryAlert = ({ children }) => {
  const { planInfo, hasAdminAccess, isAuthenticated, sessionType } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  const shouldShow =
    isAuthenticated() &&
    sessionType !== 'super-admin' &&
    planInfo?.isExpiringSoon === true &&
    planInfo?.isExpired !== true &&
    !dismissed;

  useEffect(() => {
    if (!planInfo?.endDate) {
      setDismissed(false);
      return;
    }
    const stored = window.safeSessionStorage.getItem(DISMISS_KEY);
    setDismissed(stored === planInfo.endDate);
  }, [planInfo?.endDate, planInfo?.isExpiringSoon]);

  const handleDismiss = () => {
    if (planInfo?.endDate) {
      window.safeSessionStorage.setItem(DISMISS_KEY, planInfo.endDate);
    }
    setDismissed(true);
  };

  const handleUpgrade = () => {
    if (hasAdminAccess()) {
      navigate('/admin/organization-setup');
    }
  };

  const remainingDays = planInfo?.remainingDays;
  const planName = planInfo?.planName || 'Your plan';
  const daysText =
    remainingDays === 0
      ? 'expires today'
      : remainingDays === 1
        ? 'expires tomorrow'
        : `expires in ${remainingDays} days`;

  return (
    <>
      {shouldShow && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9998,
            background: 'linear-gradient(90deg, #fef3c7 0%, #fde68a 100%)',
            borderBottom: '1px solid #f59e0b',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <div
            style={{
              maxWidth: 1200,
              margin: '0 auto',
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <AlertTriangle size={20} color="#b45309" aria-hidden="true" />
            <div style={{ flex: 1, minWidth: 200, color: '#92400e', fontSize: 14, lineHeight: 1.5 }}>
              <strong>{planName}</strong> {daysText}
              {planInfo?.endDate ? ` (${planInfo.endDate})` : ''}.
              {hasAdminAccess()
                ? ' Renew or upgrade now to avoid service interruption.'
                : ' Please contact your administrator to renew the plan.'}
            </div>
            {hasAdminAccess() && (
              <button
                type="button"
                onClick={handleUpgrade}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  background: '#4f46e5',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <ArrowUpCircle size={16} />
                Renew / Upgrade
              </button>
            )}
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss subscription warning"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                color: '#92400e',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
      <div style={{ paddingTop: shouldShow ? 52 : 0 }}>{children}</div>
    </>
  );
};

export default SubscriptionExpiryAlert;
