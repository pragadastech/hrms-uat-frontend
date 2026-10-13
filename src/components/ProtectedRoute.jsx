import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { onboardingAPI } from '../services/api';

const markOnboardingCompleteLocally = () => {
    try {
        window.safeLocalStorage.setItem('adminOnboardingComplete', 'true');
        const storedAdmin = window.safeSessionStorage.getItem('adminUser');
        if (storedAdmin) {
            const parsed = JSON.parse(storedAdmin);
            parsed.onboardingCompleted = true;
            window.safeSessionStorage.setItem('adminUser', JSON.stringify(parsed));
        }
    } catch (e) {
        // ignore storage errors
    }
};

const readLocalOnboardingComplete = () => {
    if (typeof window === 'undefined') return false;
    if (window.safeLocalStorage.getItem('adminOnboardingComplete') === 'true') {
        return true;
    }
    try {
        const storedAdmin = window.safeSessionStorage.getItem('adminUser');
        if (storedAdmin) {
            const parsed = JSON.parse(storedAdmin);
            if (parsed.onboardingCompleted === true) {
                markOnboardingCompleteLocally();
                return true;
            }
        }
    } catch (e) {
        // ignore
    }
    return false;
};

const ProtectedRoute = ({ children, requireAdmin = false, requireSuperAdmin = false }) => {
    const location = useLocation();
    const [onboardingGate, setOnboardingGate] = useState(() =>
        readLocalOnboardingComplete() ? 'complete' : 'checking'
    );

    // Safely get auth context - must call hooks unconditionally
    let isAuthenticated, hasAdminAccess, loading, sessionType, user, authError = null;
    try {
        const authContext = useAuth();
        isAuthenticated = authContext.isAuthenticated;
        hasAdminAccess = authContext.hasAdminAccess;
        loading = authContext.loading;
        sessionType = authContext.sessionType;
        user = authContext.user;
    } catch (error) {
        authError = error;
        console.warn('Auth context not available in ProtectedRoute:', error);
        isAuthenticated = () => false;
        hasAdminAccess = () => false;
        loading = false;
        sessionType = null;
        user = null;
    }

    // Safely get tenant context
    let currentTenant;
    try {
        const tenantContext = useTenant();
        currentTenant = tenantContext.currentTenant;
    } catch (error) {
        console.warn('Tenant context not available in ProtectedRoute:', error);
        currentTenant = null;
    }

    const isOnboardingRoute =
        location.pathname.startsWith('/admin/welcome-setup') ||
        location.pathname.startsWith('/admin/setup');

    // Server-side onboarding truth for admin portal routes
    useEffect(() => {
        if (authError || loading || !requireAdmin || requireSuperAdmin) {
            return undefined;
        }
        if (!isAuthenticated?.()) {
            return undefined;
        }
        if (!hasAdminAccess?.()) {
            // Still allow effect for HR/CEO checked later; compute below after auth known
        }

        // Already known complete — still soft-sync in background in case storage was repaired
        if (readLocalOnboardingComplete()) {
            setOnboardingGate('complete');
            return undefined;
        }

        let cancelled = false;
        setOnboardingGate((prev) => (prev === 'complete' ? prev : 'checking'));

        (async () => {
            try {
                const res = await onboardingAPI.getMyOnboardingState();
                if (cancelled) return;

                const completed = res?.data?.onboardingCompleted === true;
                const isTenantAdmin = res?.data?.isTenantAdmin === true;

                if (completed) {
                    markOnboardingCompleteLocally();
                    setOnboardingGate('complete');
                    return;
                }

                // Only tenant admins must complete the setup wizard.
                // HR/CEO (and other admin-portal roles that are not tenant admins)
                // should never be trapped on the wizard for an already-running tenant.
                if (!isTenantAdmin) {
                    markOnboardingCompleteLocally();
                    setOnboardingGate('complete');
                    return;
                }

                window.safeLocalStorage.setItem('adminOnboardingComplete', 'false');
                setOnboardingGate('incomplete');
            } catch (err) {
                console.warn('Onboarding verification failed in ProtectedRoute:', err);
                if (cancelled) return;
                // Do NOT fail open (marking complete on error hides the wizard for new orgs).
                // If local storage says complete, trust it; otherwise show 'incomplete' so
                // the wizard is presented and the admin can complete setup.
                if (readLocalOnboardingComplete()) {
                    setOnboardingGate('complete');
                } else {
                    setOnboardingGate('incomplete');
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [
        authError,
        loading,
        requireAdmin,
        requireSuperAdmin,
        location.pathname,
        sessionType,
    ]);

    // If auth context was not available, redirect to login
    if (authError) {
        return <Navigate to="/login" replace />;
    }

    if (loading) {
        return (
            <div className="loading-container" style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                flexDirection: 'column',
                gap: '16px'
            }}>
                <div className="animate-spin" style={{ width: '32px', height: '32px', border: '3px solid #f3f3f3', borderTop: '3px solid #6366f1', borderRadius: '50%' }}></div>
                <p>Loading...</p>
            </div>
        );
    }

    if (!isAuthenticated()) {
        return <Navigate to="/login" state={{ from: location.pathname }} replace />;
    }

    if (requireSuperAdmin) {
        if (sessionType !== 'super-admin') {
            return <Navigate to="/403" replace />;
        }
    } else if (requireAdmin) {
        if (!hasAdminAccess()) {
            let hasHRRole = false;
            if (user) {
                if (user.roles && Array.isArray(user.roles)) {
                    hasHRRole = user.roles.some(role =>
                        ['HR', 'CEO'].includes(String(role).trim().toUpperCase())
                    );
                }
                if (!hasHRRole && user.permissions && Array.isArray(user.permissions)) {
                    hasHRRole = user.permissions.includes('ADMIN_PORTAL_ACCESS');
                }
            }

            if (!hasHRRole) {
                return <Navigate to="/employee/dashboard" replace />;
            }
        }

        if (!isOnboardingRoute) {
            if (onboardingGate === 'checking') {
                return (
                    <div className="loading-container" style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '100vh',
                        flexDirection: 'column',
                        gap: '16px'
                    }}>
                        <div className="animate-spin" style={{ width: '32px', height: '32px', border: '3px solid #f3f3f3', borderTop: '3px solid #6366f1', borderRadius: '50%' }}></div>
                        <p>Checking setup status…</p>
                    </div>
                );
            }

            if (onboardingGate === 'incomplete') {
                return <Navigate to="/admin/welcome-setup" replace />;
            }
        }
    }

    return children;
};

export default ProtectedRoute;
