import React, { createContext, useContext, useState, useEffect } from 'react';
import { featureAccessAPI } from '../services/featureAccess';
import { AuthContext } from './AuthContext';

const FeatureAccessContext = createContext();

export const useFeatureAccess = () => {
    const context = useContext(FeatureAccessContext);
    if (!context) {
        throw new Error('useFeatureAccess must be used within a FeatureAccessProvider');
    }
    return context;
};

export const FeatureAccessProvider = ({ children }) => {
    const [featureAccess, setFeatureAccess] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Use raw context so we don't throw during HMR when AuthProvider may be temporarily unmounted
    const authContext = useContext(AuthContext);
    const user = authContext?.user ?? null;
    const authLoading = authContext?.loading ?? true;

    const loadFeatureAccess = async () => {
        try {
            setLoading(true);
            const tenantId = window.safeSessionStorage.getItem('currentTenantId');

            const response = await featureAccessAPI.getFeatureAccess();
            setFeatureAccess(response.data);
            setError(null);
        } catch (err) {
            console.error('Error loading feature access:', err);
            setError(err.message);
            // Set minimal default features on error (no WORKFLOWS, HOLIDAYS)
            const fallbackFeatures = {
                availableFeatures: ['DASHBOARD', 'EMPLOYEE_MANAGEMENT', 'ATTENDANCE', 'LEAVE_MANAGEMENT', 'NOTICES', 'SETTINGS'],
                restrictedFeatures: [],
                isTrial: false,
                planName: 'Unknown'
            };
            setFeatureAccess(fallbackFeatures);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Wait for auth to finish loading before attempting to load feature access
        if (authLoading) {
            // Still loading, keep waiting
            return;
        }

        // Only load feature access after authentication is complete and user is available
        if (user) {
            // Add a small delay to ensure tenant context is set
            const timer = setTimeout(() => {
                loadFeatureAccess();
            }, 100);
            return () => clearTimeout(timer);
        } else {
            // No user logged in, reset feature access
            setFeatureAccess(null);
            setLoading(false);
            setError(null);
        }
    }, [authLoading, user]);

    // Listen for tenant changes and refresh feature access
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === 'currentTenantId' && user) {
                loadFeatureAccess();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [user]);

    const hasFeature = (feature) => {
        // Prefer AuthContext.hasModule — includes subscription ∩ role module access
        if (authContext?.hasModule) {
            return authContext.hasModule(feature);
        }

        const featUpper = feature.toUpperCase();
        const coreModules = ['DASHBOARD', 'ORGANIZATION', 'SETTINGS'];
        const isCore = coreModules.includes(featUpper);

        if (authContext) {
            if (authContext.availableFeatures && authContext.availableFeatures.length > 0) {
                return authContext.availableFeatures.includes(featUpper);
            }
            if (isCore && authContext.sessionType === 'admin') return true;
        }

        if (!featureAccess) return isCore && authContext?.sessionType === 'admin';
        return featureAccess.availableFeatures?.includes(featUpper) || false;
    };

    const isFeatureRestricted = (feature) => {
        if (!featureAccess) return true;
        return featureAccess.restrictedFeatures?.includes(feature.toUpperCase()) || false;
    };

    const refreshFeatureAccess = async () => {
        if (authContext?.fetchFeatureAccess) {
            await authContext.fetchFeatureAccess();
        }
        await loadFeatureAccess();
    };

    const value = {
        featureAccess: featureAccess || (authContext?.availableFeatures ? { availableFeatures: authContext.availableFeatures, planName: authContext.planInfo?.planName } : null),
        loading: loading && !authContext?.availableFeatures,
        error,
        hasFeature,
        isFeatureRestricted,
        refreshFeatureAccess
    };

    return (
        <FeatureAccessContext.Provider value={value}>
            {children}
        </FeatureAccessContext.Provider>
    );
};

// Feature Access Component for conditional rendering
export const FeatureGate = ({ feature, children, fallback = null, showRestrictedMessage = false }) => {
    const { hasFeature, loading } = useFeatureAccess();

    if (loading) {
        return <div>Loading...</div>;
    }

    if (hasFeature(feature)) {
        return children;
    }

    if (showRestrictedMessage) {
        return (
            <div style={{
                padding: '20px',
                textAlign: 'center',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: '4px',
                margin: '10px 0',
                color: '#856404'
            }}>
                <h4>🔒 Feature Restricted</h4>
                <p>This feature is not available in your current plan. Please upgrade to access this functionality.</p>
            </div>
        );
    }

    return fallback;
};

// Feature Access Button Component
export const FeatureButton = ({ feature, children, onClick, ...props }) => {
    const { hasFeature } = useFeatureAccess();

    const handleClick = (e) => {
        if (!hasFeature(feature)) {
            e.preventDefault();
            alert('This feature is not available in your current plan. Please upgrade to access this functionality.');
            return;
        }
        if (onClick) {
            onClick(e);
        }
    };

    return (
        <button
            {...props}
            onClick={handleClick}
            disabled={!hasFeature(feature)}
            style={{
                ...props.style,
                opacity: hasFeature(feature) ? 1 : 0.5,
                cursor: hasFeature(feature) ? 'pointer' : 'not-allowed'
            }}
        >
            {children}
        </button>
    );
};

// Feature Access Link Component
export const FeatureLink = ({ feature, children, to, ...props }) => {
    const { hasFeature } = useFeatureAccess();

    const handleClick = (e) => {
        if (!hasFeature(feature)) {
            e.preventDefault();
            alert('This feature is not available in your current plan. Please upgrade to access this functionality.');
            return;
        }
    };

    return (
        <a
            {...props}
            href={hasFeature(feature) ? to : '#'}
            onClick={handleClick}
            style={{
                ...props.style,
                opacity: hasFeature(feature) ? 1 : 0.5,
                cursor: hasFeature(feature) ? 'pointer' : 'not-allowed',
                textDecoration: hasFeature(feature) ? 'none' : 'line-through'
            }}
        >
            {children}
        </a>
    );
};
