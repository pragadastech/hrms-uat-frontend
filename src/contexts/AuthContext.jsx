import React, { createContext, useContext, useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { adminAuthAPI, authAPI, superAdminAuthAPI, featureAPI } from '../services/api';

const sanitizeMsg = (str) => {
  if (typeof str !== 'string') return str;
  // Remove all HTML tag patterns
  let clean = str.replace(/<[^>]*>/g, '');
  // Escape remaining HTML special characters
  return clean
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Create the Auth Context (exported for providers that need to handle missing context, e.g. during HMR)
export const AuthContext = createContext();

// Custom hook to use the Auth Context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [adminUser, setAdminUser] = useState(null);
  const [superAdminUser, setSuperAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionType, setSessionType] = useState(null);
  const [currentTenantId, setCurrentTenantId] = useState(null);
  const [hasDualRole, setHasDualRole] = useState(false); // New state for dual role
  const [availableFeatures, setAvailableFeatures] = useState(() => {
    const stored = window.safeSessionStorage.getItem('availableFeatures');
    return stored ? JSON.parse(stored) : [];
  });
  const [roleAllowedModules, setRoleAllowedModules] = useState(() => {
    const stored = window.safeSessionStorage.getItem('roleAllowedModules');
    if (!stored || stored === 'null') return null;
    try { return JSON.parse(stored); } catch { return null; }
  });
  const [moduleCrud, setModuleCrud] = useState(() => {
    const stored = window.safeSessionStorage.getItem('moduleCrud');
    if (!stored || stored === 'null') return null;
    try { return JSON.parse(stored); } catch { return null; }
  });
  const [dashboardWidgets, setDashboardWidgets] = useState(() => {
    const stored = window.safeSessionStorage.getItem('dashboardWidgets');
    if (!stored || stored === 'null') return null;
    try { return JSON.parse(stored); } catch { return null; }
  });
  const [planInfo, setPlanInfo] = useState(() => {
    const stored = window.safeSessionStorage.getItem('planInfo');
    return stored ? JSON.parse(stored) : null;
  });
  const [rolePermissions, setRolePermissions] = useState(() => {
    const stored = window.safeSessionStorage.getItem('rolePermissions');
    return stored ? JSON.parse(stored) : [];
  });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSessionTimeout, setShowSessionTimeout] = useState(false);
  const [isCancelLoading, setIsCancelLoading] = useState(false);
  const [isSignOutLoading, setIsSignOutLoading] = useState(false);

  // Initialize auth state from window.safeSessionStorage
  useEffect(() => {
    const initAuth = () => {
      try {
        const storedUser = window.safeSessionStorage.getItem('user');
        const storedAdminUser = window.safeSessionStorage.getItem('adminUser');
        const storedSuperAdminUser = window.safeSessionStorage.getItem('superAdminUser');
        const storedSessionType = window.safeSessionStorage.getItem('sessionType');
        const storedTenantId = window.safeSessionStorage.getItem('currentTenantId');
        const storedHasDualRole = window.safeSessionStorage.getItem('hasDualRole'); // Read stored dual role
        const storedFeatures = window.safeSessionStorage.getItem('availableFeatures');
        const storedPlanInfo = window.safeSessionStorage.getItem('planInfo');

        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
        if (storedAdminUser) {
          setAdminUser(JSON.parse(storedAdminUser));
        }
        if (storedSuperAdminUser) {
          setSuperAdminUser(JSON.parse(storedSuperAdminUser));
        }
        if (storedSessionType) {
          setSessionType(storedSessionType);
        }
        if (storedTenantId) {
          setCurrentTenantId(storedTenantId);
        }
        if (storedHasDualRole) {
          setHasDualRole(storedHasDualRole === 'true');
        }
        if (storedFeatures) {
          setAvailableFeatures(JSON.parse(storedFeatures));
        }
        if (storedPlanInfo) {
          setPlanInfo(JSON.parse(storedPlanInfo));
        }
        const storedRolePermissions = window.safeSessionStorage.getItem('rolePermissions');
        if (storedRolePermissions) {
          setRolePermissions(JSON.parse(storedRolePermissions));
        }

        // Restore adminOnboardingComplete in window.safeLocalStorage from stored admin user data
        // This prevents stale/missing flags from causing random welcome-setup redirects
        if (storedAdminUser && storedSessionType === 'admin') {
          try {
            const parsedAdmin = JSON.parse(storedAdminUser);
            if (parsedAdmin.onboardingCompleted === true) {
              window.safeLocalStorage.setItem('adminOnboardingComplete', 'true');
            }
          } catch (e) {
            // ignore parse errors
          }
        }
      } catch (error) {
        console.error('Error initializing auth state:', error);
        // Do not clear auth data on network errors or transient 500s
      } finally {
        setLoading(false);
      }

      // Soft-sync onboarding from server for admin portal sessions (non-blocking)
      const sessionTypeForSync = window.safeSessionStorage.getItem('sessionType');
      const hasDual = window.safeSessionStorage.getItem('hasDualRole') === 'true';
      if (sessionTypeForSync === 'admin' || hasDual) {
        import('../services/api')
          .then(({ onboardingAPI }) => onboardingAPI.getMyOnboardingState())
          .then((onboardingRes) => {
            if (onboardingRes?.data?.onboardingCompleted === true || onboardingRes?.data?.isTenantAdmin === false) {
              window.safeLocalStorage.setItem('adminOnboardingComplete', 'true');
              const storedAdmin = window.safeSessionStorage.getItem('adminUser');
              if (storedAdmin) {
                try {
                  const parsedAdmin = JSON.parse(storedAdmin);
                  parsedAdmin.onboardingCompleted = true;
                  window.safeSessionStorage.setItem('adminUser', JSON.stringify(parsedAdmin));
                } catch (e) { /* ignore */ }
              }
            }
          })
          .catch(() => { /* ProtectedRoute will verify again when needed */ });
      }
    };

    const handleSessionExpired = () => {
      setShowSessionTimeout(true);
    };

    window.addEventListener('session-expired', handleSessionExpired);

    initAuth();

    return () => {
      window.removeEventListener('session-expired', handleSessionExpired);
    };
  }, []);

  // Refresh plan/module features on mount so sidebar reflects DB/plan changes
  // (e.g. PAYROLL/Finance added to trial) instead of keeping a stale sessionStorage list.
  useEffect(() => {
    if (!loading && isAuthenticated() && sessionType !== 'super-admin') {
      fetchFeatureAccess();
    }
  }, [loading, sessionType]);

  // Clear all auth data
  const clearAuthData = () => {
    setUser(null);
    setAdminUser(null);
    setSuperAdminUser(null);
    setSessionType(null);
    setCurrentTenantId(null);
    setHasDualRole(false);

    window.safeSessionStorage.removeItem('user');
    window.safeSessionStorage.removeItem('adminUser');
    window.safeSessionStorage.removeItem('superAdminUser');
    window.safeSessionStorage.removeItem('sessionType');
    window.safeSessionStorage.removeItem('currentTenantId');
    window.safeSessionStorage.removeItem('employeeToken');
    window.safeSessionStorage.removeItem('adminToken');
    window.safeSessionStorage.removeItem('superAdminToken');
    window.safeSessionStorage.removeItem('employeeLoginTime');
    window.safeSessionStorage.removeItem('adminLoginTime');
    window.safeSessionStorage.removeItem('superAdminLoginTime');
    window.safeSessionStorage.removeItem('hasDualRole');
    window.safeSessionStorage.removeItem('availableFeatures');
    window.safeSessionStorage.removeItem('roleAllowedModules');
    window.safeSessionStorage.removeItem('moduleCrud');
    window.safeSessionStorage.removeItem('dashboardWidgets');
    window.safeSessionStorage.removeItem('planInfo');
    window.safeSessionStorage.removeItem('rolePermissions');
    window.safeLocalStorage.removeItem('adminOnboardingComplete');
    setModuleCrud(null);
    setRolePermissions([]);
  };

  // Fetch feature access info
  const fetchFeatureAccess = async (targetSessionType = null) => {
    try {
      const currentType = targetSessionType || sessionType;
      if (currentType === 'super-admin') return null;

      const response = await featureAPI.getAccess(currentTenantId);
      if (response && response.data) {
        const features = response.data.availableFeatures || [];
        const roleModules = response.data.roleAllowedModules ?? null;
        const widgets = response.data.dashboardWidgets ?? null;
        const crud = response.data.moduleCrud ?? null;
        const rolePerms = response.data.rolePermissions ?? [];
        const plan = {
          planName: response.data.planName,
          isTrial: response.data.isTrial,
          isExpired: response.data.isExpired,
          remainingDays: response.data.remainingDays,
          endDate: response.data.endDate,
          isExpiringSoon: response.data.isExpiringSoon === true,
          expiryWarningDays: response.data.expiryWarningDays ?? 7,
        };

        setAvailableFeatures(features);
        setRoleAllowedModules(roleModules);
        setModuleCrud(crud);
        setDashboardWidgets(widgets);
        setPlanInfo(plan);
        setRolePermissions(rolePerms);
        window.safeSessionStorage.setItem('availableFeatures', JSON.stringify(features));
        window.safeSessionStorage.setItem('roleAllowedModules', JSON.stringify(roleModules));
        window.safeSessionStorage.setItem('moduleCrud', JSON.stringify(crud));
        window.safeSessionStorage.setItem('dashboardWidgets', JSON.stringify(widgets));
        window.safeSessionStorage.setItem('planInfo', JSON.stringify(plan));
        window.safeSessionStorage.setItem('rolePermissions', JSON.stringify(rolePerms));
        return { features, plan, roleModules, widgets, crud, rolePermissions: rolePerms };
      }
    } catch (error) {
      console.error('Error fetching feature access:', error);
      // If we're authenticated but feature fetch fails, set minimal default features
      if (isAuthenticated()) {
        const fallbackFeatures = ['DASHBOARD', 'EMPLOYEE_MANAGEMENT', 'ATTENDANCE', 'LEAVE_MANAGEMENT', 'NOTICES', 'SETTINGS', 'ORGANIZATION'];
        setAvailableFeatures(fallbackFeatures);
        window.safeSessionStorage.setItem('availableFeatures', JSON.stringify(fallbackFeatures));
      }
    }
    return null;
  };

  // Employee Login (tenantId optional - sent as X-Tenant-ID for multi-tenant lookup)
  const employeeLogin = async (credentials, tenantId = null) => {
    try {
      const response = await authAPI.login(credentials, tenantId);
      console.log('📡 [AuthContext] API Response:', response.data);

      // Check if response has token or OTP required (indicating success or next step)
      if (response.data && (response.data.token || response.data.otpRequired)) {
        // If OTP is required, return success early so the UI can switch to OTP input
        if (response.data.otpRequired) {
          console.log('🔑 [AuthContext] OTP Required detected in response');
          return { success: true, data: response.data };
        }

        // Extract user data and token from response
        const { token, ...userData } = response.data;

        // CRITICAL: Store token FIRST before any state updates or API calls
        // This ensures the axios interceptor can use it immediately
        window.safeSessionStorage.setItem('employeeToken', token);
        window.safeSessionStorage.setItem('sessionType', 'employee');
        window.safeSessionStorage.setItem('employeeLoginTime', new Date().toISOString());

        // Store user data and tenant (support multiple backend key shapes)
        window.safeSessionStorage.setItem('user', JSON.stringify(userData));
        const tenantId = userData.tenantId ?? userData.tenant_id ?? userData.organizationId ?? userData.organization_id;
        if (tenantId != null) {
          const value = String(tenantId);
          window.safeSessionStorage.setItem('currentTenantId', value);
          setCurrentTenantId(value);
        }

        // NOTE: Do NOT set adminOnboardingComplete here — employee login data
        // should not overwrite the admin onboarding flag.

        // Update state AFTER storage is complete
        setUser(userData);
        setSessionType('employee');

        // Check for dual role AFTER token is stored and state is updated
        // Use a longer delay to ensure token is available in interceptor and all state is synced
        try {
          // Wait longer to ensure token is set in interceptor and window.safeSessionStorage is fully synced
          await new Promise(resolve => setTimeout(resolve, 300));

          // Double-check token is available before making the call
          const tokenCheck = window.safeSessionStorage.getItem('employeeToken');
          if (!tokenCheck) {
            console.warn('Token not available for dual role check, skipping');
            setHasDualRole(false);
            window.safeSessionStorage.setItem('hasDualRole', 'false');
            // Clear any stale admin/super-admin session data
            setAdminUser(null);
            setSuperAdminUser(null);
            window.safeSessionStorage.removeItem('adminToken');
            window.safeSessionStorage.removeItem('adminUser');
            window.safeSessionStorage.removeItem('adminLoginTime');
            window.safeSessionStorage.removeItem('superAdminToken');
            window.safeSessionStorage.removeItem('superAdminUser');
            window.safeSessionStorage.removeItem('superAdminLoginTime');
          } else {
            const dualRoleResponse = await authAPI.checkDualRole();
            const isDualRole = dualRoleResponse.data?.hasDualRole || dualRoleResponse.data === true;
            setHasDualRole(isDualRole);
            window.safeSessionStorage.setItem('hasDualRole', String(isDualRole));
            if (!isDualRole) {
              // Clear any stale admin/super-admin session data
              setAdminUser(null);
              setSuperAdminUser(null);
              window.safeSessionStorage.removeItem('adminToken');
              window.safeSessionStorage.removeItem('adminUser');
              window.safeSessionStorage.removeItem('adminLoginTime');
              window.safeSessionStorage.removeItem('superAdminToken');
              window.safeSessionStorage.removeItem('superAdminUser');
              window.safeSessionStorage.removeItem('superAdminLoginTime');
            }
          }
        } catch (dualRoleError) {
          // Silently handle dual role check failures - don't log as error or fail login
          // This is a non-critical check that shouldn't block login
          console.warn('Dual role check failed (non-critical):', dualRoleError?.response?.status || dualRoleError?.message);
          setHasDualRole(false);
          window.safeSessionStorage.setItem('hasDualRole', 'false');
          // Clear any stale admin/super-admin session data
          setAdminUser(null);
          setSuperAdminUser(null);
          window.safeSessionStorage.removeItem('adminToken');
          window.safeSessionStorage.removeItem('adminUser');
          window.safeSessionStorage.removeItem('adminLoginTime');
          window.safeSessionStorage.removeItem('superAdminToken');
          window.safeSessionStorage.removeItem('superAdminUser');
          window.safeSessionStorage.removeItem('superAdminLoginTime');
          // Don't throw or fail login - this is optional functionality
        }

        // Fetch features after successful login
        const featureResult = await fetchFeatureAccess('employee');



        return { success: true, data: userData };
      }

      // If no token, treat as failed login
      return { success: false, message: response.data?.message || 'Login failed' };
    } catch (error) {
      console.error('Employee login error:', error);
      // Clear any partial session data on error
      window.safeSessionStorage.removeItem('employeeToken');
      window.safeSessionStorage.removeItem('user');
      window.safeSessionStorage.removeItem('sessionType');
      return {
        success: false,
        message: sanitizeMsg(error.response?.data?.message || error.message || 'Login failed')
      };
    }
  };

  // Verify OTP
  const verifyOtp = async (username, otp, type = 'employee') => {
    try {
      console.log(`🔍 [AuthContext] Verifying OTP for ${type}: ${username}`);
      const response = type === 'admin' 
        ? await adminAuthAPI.verifyOtp({ username, otp })
        : await authAPI.verifyOtp({ username, otp });

      if (response.data && response.data.token) {
        const { token, ...userData } = response.data;

        if (type === 'admin') {
          setAdminUser(userData);
          setSessionType('admin');
          window.safeSessionStorage.setItem('adminToken', token);
          window.safeSessionStorage.setItem('adminUser', JSON.stringify(userData));
          window.safeSessionStorage.setItem('sessionType', 'admin');
          window.safeSessionStorage.setItem('adminLoginTime', new Date().toISOString());
          
          // Always clear the stale flag first so a brand-new org admin always sees the wizard.
          window.safeLocalStorage.removeItem('adminOnboardingComplete');
          if (userData.onboardingCompleted === true) {
            window.safeLocalStorage.setItem('adminOnboardingComplete', 'true');
          } else if (userData.onboardingCompleted === false) {
            window.safeLocalStorage.setItem('adminOnboardingComplete', 'false');
          }
          await fetchFeatureAccess('admin');
        } else {
          window.safeSessionStorage.setItem('employeeToken', token);
          window.safeSessionStorage.setItem('sessionType', 'employee');
          window.safeSessionStorage.setItem('employeeLoginTime', new Date().toISOString());
          window.safeSessionStorage.setItem('user', JSON.stringify(userData));

          const tenantId = userData.tenantId ?? userData.tenant_id;
          if (tenantId != null) {
            const value = String(tenantId);
            window.safeSessionStorage.setItem('currentTenantId', value);
            setCurrentTenantId(value);
          }

          setUser(userData);
          setSessionType('employee');

          // Fetch dual role and features
          try {
            await new Promise(resolve => setTimeout(resolve, 300));
            const dualRoleResponse = await authAPI.checkDualRole();
            const isDualRole = dualRoleResponse.data?.hasDualRole || dualRoleResponse.data === true;
            setHasDualRole(isDualRole);
            window.safeSessionStorage.setItem('hasDualRole', String(isDualRole));
          } catch (e) {
            console.warn('Dual role check failed:', e);
          }

          await fetchFeatureAccess('employee');
        }

        return { success: true, data: userData };
      }

      return { success: false, message: response.data?.message || 'Verification failed' };
    } catch (error) {
      console.error('OTP verification error:', error);
      return {
        success: false,
        message: sanitizeMsg(error.response?.data?.message || error.message || 'Verification failed')
      };
    }
  };

  const resendOtp = async (credentials, type = 'employee', tenantId = null) => {
    try {
      const response = type === 'admin'
        ? await adminAuthAPI.resendOtp(credentials)
        : await authAPI.resendOtp(credentials, tenantId);

      if (response.data?.otpRequired) {
        return { success: true, data: response.data };
      }

      return {
        success: false,
        message: response.data?.message || 'Failed to resend OTP'
      };
    } catch (error) {
      return {
        success: false,
        message: sanitizeMsg(error.response?.data?.message || error.message || 'Failed to resend OTP')
      };
    }
  };

  // Admin Login
  const adminLogin = async (credentials, tenantId = null) => {
    try {
      // Store tenant ID if provided
      if (tenantId) {
        setCurrentTenantId(tenantId);
        window.safeSessionStorage.setItem('currentTenantId', tenantId);
      }

      const response = await adminAuthAPI.login(credentials);

      // Check if response has token or OTP required
      if (response.data && (response.data.token || response.data.otpRequired)) {
        if (response.data.otpRequired) {
          console.log('🔑 [AuthContext] Admin OTP Required detected');
          return { success: true, data: response.data };
        }

        // Extract admin data and token from response
        const { token, ...adminData } = response.data;

        setAdminUser(adminData);
        setSessionType('admin');

        // Store in window.safeSessionStorage
        window.safeSessionStorage.setItem('adminUser', JSON.stringify(adminData));
        window.safeSessionStorage.setItem('sessionType', 'admin');
        window.safeSessionStorage.setItem('adminToken', token);
        window.safeSessionStorage.setItem('adminLoginTime', new Date().toISOString());

        // Update onboarding status in window.safeLocalStorage for ProtectedRoute guard.
        // Always clear the stale flag first so a brand-new org admin always sees the wizard.
        // Then re-set it based on the live login response.
        window.safeLocalStorage.removeItem('adminOnboardingComplete');
        if (adminData.onboardingCompleted === true) {
          window.safeLocalStorage.setItem('adminOnboardingComplete', 'true');
        } else if (adminData.onboardingCompleted === false) {
          window.safeLocalStorage.setItem('adminOnboardingComplete', 'false');
        }
        // If onboardingCompleted is undefined (not in response), ProtectedRoute will re-check /onboarding/me

        // Fetch features after successful login
        await fetchFeatureAccess('admin');

        return { success: true, data: adminData };
      }

      // If no token, treat as failed login
      return { success: false, message: response.data.message || 'Login failed' };
    } catch (error) {
      console.error('Admin login error:', error);
      return {
        success: false,
        message: sanitizeMsg(error.response?.data?.message || 'Login failed')
      };
    }
  };

  // Super Admin Login
  const superAdminLogin = async (credentials) => {
    try {
      const response = await superAdminAuthAPI.login(credentials);

      // Check if response has token (indicating success)
      if (response.data.token) {
        // Extract super admin data and token from response
        const { token, ...superAdminData } = response.data;

        setSuperAdminUser(superAdminData);
        setSessionType('super-admin');

        // Store in window.safeSessionStorage
        window.safeSessionStorage.setItem('superAdminUser', JSON.stringify(superAdminData));
        window.safeSessionStorage.setItem('sessionType', 'super-admin');
        window.safeSessionStorage.setItem('superAdminToken', token);
        window.safeSessionStorage.setItem('superAdminLoginTime', new Date().toISOString());

        return { success: true, data: superAdminData };
      }

      // If no token, treat as failed login
      return { success: false, message: response.data.message || 'Login failed' };
    } catch (error) {
      console.error('Super admin login error:', error);
      return {
        success: false,
        message: sanitizeMsg(error.response?.data?.message || 'Login failed')
      };
    }
  };

  // Switch to Employee Mode
  const switchToEmployeeMode = async () => {
    try {
      const response = await authAPI.switchToEmployeeMode();
      const responseData = response.data;

      // Check if response has token (indicating success) - similar to login
      if (responseData.token) {
        const { token, ...userData } = responseData;
        setUser(userData);
        setSessionType('employee');

        setHasDualRole(true);
        window.safeSessionStorage.setItem('hasDualRole', 'true');

        // Store employee token
        window.safeSessionStorage.setItem('user', JSON.stringify(userData));
        window.safeSessionStorage.setItem('sessionType', 'employee');
        window.safeSessionStorage.setItem('employeeToken', token);
        window.safeSessionStorage.setItem('employeeLoginTime', new Date().toISOString());

        // Fetch features after switch
        await fetchFeatureAccess('employee');

        return { success: true, data: userData };
      }

      return { success: false, message: responseData.message || 'Switch failed' };
    } catch (error) {
      console.error('Switch to employee mode error:', error);
      return {
        success: false,
        message: sanitizeMsg(error.response?.data?.message || 'Switch failed')
      };
    }
  };

  // Switch to Admin Mode
  const switchToAdminMode = async () => {
    try {
      const response = await authAPI.switchToAdminMode();
      const responseData = response.data;

      // Check if response has token (indicating success)
      if (responseData.token) {
        const { token, ...adminData } = responseData;
        setAdminUser(adminData);
        setSessionType('admin');

        setHasDualRole(true);
        window.safeSessionStorage.setItem('hasDualRole', 'true');

        // Store admin token
        window.safeSessionStorage.setItem('adminUser', JSON.stringify(adminData));
        window.safeSessionStorage.setItem('sessionType', 'admin');
        window.safeSessionStorage.setItem('adminToken', token);
        window.safeSessionStorage.setItem('adminLoginTime', new Date().toISOString());

        // Update onboarding status in window.safeLocalStorage for ProtectedRoute guard
        if (adminData.onboardingCompleted === true) {
          window.safeLocalStorage.setItem('adminOnboardingComplete', 'true');
        } else if (adminData.onboardingCompleted === false && window.safeLocalStorage.getItem('adminOnboardingComplete') !== 'true') {
          window.safeLocalStorage.setItem('adminOnboardingComplete', 'false');
        }

        // Fetch features after switch
        await fetchFeatureAccess('admin');

        return { success: true, data: adminData };
      }

      return { success: false, message: responseData.message || 'Switch failed' };
    } catch (error) {
      console.error('Switch to admin mode error:', error);
      return {
        success: false,
        message: sanitizeMsg(error.response?.data?.message || 'Switch failed')
      };
    }
  };

  // Logout
  const logout = (bypassConfirm = false) => {
    if (bypassConfirm === true) {
      clearAuthData();
      window.location.replace('/login');
    } else {
      setShowLogoutConfirm(true);
    }
  };

  // Check if user is authenticated
  const isAuthenticated = () => {
    return !!(user || adminUser || superAdminUser);
  };

  // Check if user has admin access
  const hasAdminAccess = () => {
    // Only trust admin/super-admin users when sessionType matches
    if ((sessionType === 'admin' && adminUser) || (sessionType === 'super-admin' && superAdminUser)) {
      return true;
    }

    // Check if employee has HR role or ADMIN_PORTAL_ACCESS permission
    if (user) {
      // Check roles array
      if (user.roles && Array.isArray(user.roles)) {
        const hasHRRole = user.roles.some(role =>
          ['HR', 'CEO'].includes(String(role).trim().toUpperCase())
        );
        if (hasHRRole) {
          return true;
        }
      }

      // Check permissions array
      if (user.permissions && Array.isArray(user.permissions)) {
        if (user.permissions.includes('ADMIN_PORTAL_ACCESS')) {
          return true;
        }
      }

      // Fallback: check old role fields for backward compatibility
      const roleValue = user.employeeRoleName || (user.role?.name || user.role);
      if (roleValue && ['HR', 'CEO'].includes(String(roleValue).trim().toUpperCase())) {
        return true;
      }
    }

    return false;
  };

  // Check if user has employee access
  const hasEmployeeAccess = () => {
    return !!user;
  };

  // Check if tenant has access to a specific module (and role allows it when configured)
  const hasModule = (moduleName) => {
    if (sessionType === 'super-admin') return true;

    const key = String(moduleName || '').toUpperCase();

    // Always allow core modules if authenticated as admin part of safety
    const coreModules = ['DASHBOARD', 'ORGANIZATION', 'SETTINGS'];
    if (sessionType === 'admin' && coreModules.includes(key)) {
      return true;
    }

    // Pure Admin users (role === 'ADMIN') bypass all module/role restrictions —
    // they should see the full admin sidebar regardless of roleAllowedModules.
    const currentUserObj = sessionType === 'admin' ? (adminUser || user) : user;
    const userRoles = currentUserObj?.roles || [];
    const isPureAdmin = userRoles.some(r => String(r).toUpperCase() === 'ADMIN');
    if (sessionType === 'admin' && isPureAdmin) {
      // Still respect tenant plan features (availableFeatures), but bypass role module restrictions
      if (!availableFeatures || availableFeatures.length === 0) return true;
      let tenantKey = key;
      if (key === 'MY_ASSETS' || key === 'TEAM_ASSETS') tenantKey = 'ASSETS';
      return availableFeatures.includes(tenantKey) || coreModules.includes(key);
    }

    if (!availableFeatures || availableFeatures.length === 0) {
      // If we're authenticated but features haven't loaded yet, 
      // return true for core modules, false for others to prevent flickering/stalls
      return coreModules.includes(key);
    }

    let tenantKey = key;
    if (key === 'MY_ASSETS' || key === 'TEAM_ASSETS') {
      tenantKey = 'ASSETS';
    } else if (key === 'PLANNER') {
      tenantKey = 'PROJECT_MANAGEMENT';
    }
    const tenantAllows = availableFeatures.includes(tenantKey);
    if (!tenantAllows) return false;

    // null / undefined = no role restriction configured
    if (roleAllowedModules == null) return true;
    if (!Array.isArray(roleAllowedModules) || roleAllowedModules.length === 0) {
      return coreModules.includes(key);
    }
    
    const allowed = roleAllowedModules.map((m) => String(m).toUpperCase());
    if (allowed.includes(key)) return true;

    // Child-to-Parent Module Mapping
    const parentMap = {
      'ATTENDANCE': 'WORKFORCE',
      'TIMESHEETS': 'WORKFORCE',
      'LEAVE_MANAGEMENT': 'WORKFORCE',
      'WFH': 'WORKFORCE',
      'EXPENSES': 'WORKFORCE',
      'HOLIDAYS': 'WORKFORCE',
      'EMPLOYEE_MANAGEMENT': 'PEOPLE_ORG',
      'DOCUMENTS': 'PEOPLE_ORG',
      'ASSETS': 'PEOPLE_ORG',
      'MY_ASSETS': 'PEOPLE_ORG',
      'TEAM_ASSETS': 'PEOPLE_ORG',
      'ORGANIZATION': 'PEOPLE_ORG',
      'WORK_STATUS': 'PEOPLE_ORG',
      'NOTICES': 'CULTURE',
      'COMPLAINTS': 'CULTURE',
      'ACHIEVEMENTS': 'CULTURE',
      'GAMES': 'CULTURE',
      'PAYROLL': 'FINANCE'
    };

    const parentKey = parentMap[key];
    if (parentKey && allowed.includes(parentKey)) return true;

    return false;
  };

  const hasCrudPermission = (moduleName, operation) => {
    if (sessionType === 'super-admin') return true;
    
    // Pure Admin users bypass CRUD restrictions — they have full access
    const currentUserObj = sessionType === 'admin' ? (adminUser || user) : user;
    const userRoles = currentUserObj?.roles || [];
    const isPureAdmin = userRoles.some(r => String(r).toUpperCase() === 'ADMIN');
    if (sessionType === 'admin' && isPureAdmin) return true;
    
    if (!moduleCrud) return true;
    
    let key = String(moduleName).toUpperCase();
    const op = String(operation).toLowerCase();
    
    if (key === 'ASSETS') {
      if (moduleCrud['TEAM_ASSETS']) {
        return !!moduleCrud['TEAM_ASSETS'][op];
      }
      if (moduleCrud['MY_ASSETS']) {
        return !!moduleCrud['MY_ASSETS'][op];
      }
    }
    
    if (key === 'PROJECT_MANAGEMENT') {
      key = 'PROJECT_MANAGEMENT_PROJECTS';
    }
    
    if (moduleCrud[key]) {
      return !!moduleCrud[key][op];
    }
    return true;
  };

  const hasDashboardWidget = (widgetKey) => {
    if (sessionType === 'super-admin') return true;
    if (dashboardWidgets == null) return true;
    if (!Array.isArray(dashboardWidgets) || dashboardWidgets.length === 0) return false;
    return dashboardWidgets.map((w) => String(w).toUpperCase()).includes(String(widgetKey || '').toUpperCase());
  };

  // Update user data (current session by default)
  const updateUserData = (updates = {}, targetSessionType = null) => {
    const effectiveSessionType = targetSessionType || sessionType;
    if (effectiveSessionType === 'admin') {
      setAdminUser(prev => {
        const next = { ...(prev || {}), ...(updates || {}) };
        window.safeSessionStorage.setItem('adminUser', JSON.stringify(next));
        return next;
      });
      return;
    }
    if (effectiveSessionType === 'super-admin') {
      setSuperAdminUser(prev => {
        const next = { ...(prev || {}), ...(updates || {}) };
        window.safeSessionStorage.setItem('superAdminUser', JSON.stringify(next));
        return next;
      });
      return;
    }

    // Default to employee session
    setUser(prev => {
      const next = { ...(prev || {}), ...(updates || {}) };
      window.safeSessionStorage.setItem('user', JSON.stringify(next));
      return next;
    });

    const derivedTenantId = updates?.tenantId ?? updates?.tenant_id ?? updates?.organizationId ?? updates?.organization_id;
    if (derivedTenantId != null) {
      const value = String(derivedTenantId);
      window.safeSessionStorage.setItem('currentTenantId', value);
      setCurrentTenantId(value);
    }
  };

  // Get current user based on session type
  const getCurrentUser = () => {
    switch (sessionType) {
      case 'employee':
        return user;
      case 'admin':
        return adminUser;
      case 'super-admin':
        return superAdminUser;
      default:
        return null;
    }
  };

  // Context value
  const value = {
    // State
    user,
    adminUser,
    superAdminUser,
    loading,
    sessionType,
    currentTenantId,
    hasDualRole, // Expose hasDualRole
    availableFeatures,
    roleAllowedModules,
    rolePermissions,
    moduleCrud,
    dashboardWidgets,
    planInfo,

    // Methods
    employeeLogin,
    verifyOtp,
    resendOtp,
    adminLogin,
    superAdminLogin,
    switchToEmployeeMode,
    switchToAdminMode,
    logout,

    // Helpers
    isAuthenticated,
    hasAdminAccess,
    hasEmployeeAccess,
    getCurrentUser,
    updateUserData,
    hasModule,
    hasCrudPermission,
    hasDashboardWidget,
    fetchFeatureAccess,
    clearAuthData,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {showLogoutConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999
        }}>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
            .btn-spinner {
              animation: spin 1s linear infinite;
              display: inline-block;
            }
          `}</style>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            width: '90%',
            maxWidth: '400px',
            padding: '32px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
            border: '1px solid #f1f5f9',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '24px'
            }}>
              <LogOut size={26} />
            </div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#0f172a',
              marginBottom: '8px'
            }}>
              Confirm Sign Out
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#64748b',
              lineHeight: 1.5,
              marginBottom: '28px'
            }}>
              Are you sure you want to sign out? You will need to log back in to access your dashboard.
            </p>
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center'
            }}>
              <button
                type="button"
                disabled={isSignOutLoading}
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isSignOutLoading ? 0.7 : 1
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSignOutLoading}
                onClick={() => {
                  setIsSignOutLoading(true);
                  clearAuthData();
                  window.location.replace("/login");
                }}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isSignOutLoading ? 0.7 : 1
                }}
              >
                {isSignOutLoading && (
                  <span className="btn-spinner" style={{ marginRight: '8px', display: 'flex', alignItems: 'center' }}>
                    <svg style={{ width: '14px', height: '14px' }} viewBox="0 0 24 24">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </span>
                )}
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
      {showSessionTimeout && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            width: '90%',
            maxWidth: '400px',
            padding: '32px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
            border: '1px solid #f1f5f9',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#fef3c7',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '24px'
            }}>
              <svg style={{ width: '28px', height: '28px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#0f172a',
              marginBottom: '8px'
            }}>
              Session Expired
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#64748b',
              lineHeight: 1.5,
              marginBottom: '28px'
            }}>
              Your session has timed out. To keep your account secure and continue working, please log back in.
            </p>
            <div style={{
              display: 'flex',
              justifyContent: 'center'
            }}>
              <button
                type="button"
                onClick={() => {
                  clearAuthData();
                  window.location.replace("/login");
                }}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                Log In Again
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export default AuthContext;