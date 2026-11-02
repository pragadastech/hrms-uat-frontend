import axios from 'axios';

export const getApiBaseUrl = () => {
  // Priority 1: Environment variable fallback
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // Priority 2: Development mode - use relative URL for Vite proxy
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return '/api'; // Use relative URL for Vite proxy
  }

  // Priority 4: Development fallback
  return 'http://localhost:8080/api';
};

export const API_BASE_URL = getApiBaseUrl();

// Debug logging for API configuration


// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 10000, // 10 second timeout
  withCredentials: false, // Disabled to prevent iOS Safari Intelligent Tracking Prevention blocks
});





// Helper function to clear all tokens
const clearAllTokens = () => {
  window.safeSessionStorage.removeItem('adminToken');
  window.safeSessionStorage.removeItem('employeeToken');
  window.safeSessionStorage.removeItem('superAdminToken');
  window.safeSessionStorage.removeItem('sessionType');
};

// Helper function to get current token based on most recent session
const getCurrentToken = () => {
  const sessionType = window.safeSessionStorage.getItem('sessionType');
  const adminToken = window.safeSessionStorage.getItem('adminToken');
  const employeeToken = window.safeSessionStorage.getItem('employeeToken');
  const superAdminToken = window.safeSessionStorage.getItem('superAdminToken');

  // Priority 1: Trust explicit sessionType if corresponding token exists
  if (sessionType === 'admin' && adminToken) {
    return adminToken;
  }
  if (sessionType === 'employee' && employeeToken) {
    return employeeToken;
  }
  if (sessionType === 'super-admin' && superAdminToken) {
    return superAdminToken;
  }

  // Priority 2: Fallback logic (timestamps/validation) if sessionType is missing or mismatch
  const adminLoginTime = window.safeSessionStorage.getItem('adminLoginTime');
  const employeeLoginTime = window.safeSessionStorage.getItem('employeeLoginTime');
  const superAdminLoginTime = window.safeSessionStorage.getItem('superAdminLoginTime');

  // Single token present (and sessionType didn't match or was null)
  if (superAdminToken && !adminToken && !employeeToken) return superAdminToken;
  if (adminToken && !employeeToken && !superAdminToken) return adminToken;
  if (employeeToken && !adminToken && !superAdminToken) return employeeToken;

  // Both tokens present – pick the most recent valid session instead of clearing
  if ((adminToken ? 1 : 0) + (employeeToken ? 1 : 0) + (superAdminToken ? 1 : 0) >= 2) {
    // If we reach here, sessionType is unreliable, so we trust timestamps
    const adminTs = adminLoginTime ? Date.parse(adminLoginTime) : 0;
    const employeeTs = employeeLoginTime ? Date.parse(employeeLoginTime) : 0;
    const superAdminTs = superAdminLoginTime ? Date.parse(superAdminLoginTime) : 0;
    const maxTs = Math.max(adminTs, employeeTs, superAdminTs);

    if (maxTs > 0) {
      if (maxTs === superAdminTs) return superAdminToken;
      if (maxTs === adminTs) return adminToken;
      return employeeToken;
    }
  }

  return null;
};

// Helper function to get session type, consistent with token selection
const getSessionType = () => {
  const sessionType = window.safeSessionStorage.getItem('sessionType');
  if (sessionType) return sessionType;

  // Fallback if sessionType missing (legacy/safety)
  const adminToken = window.safeSessionStorage.getItem('adminToken');
  const employeeToken = window.safeSessionStorage.getItem('employeeToken');
  const superAdminToken = window.safeSessionStorage.getItem('superAdminToken');

  if (superAdminToken && !adminToken && !employeeToken) return 'super-admin';
  if (adminToken && !employeeToken && !superAdminToken) return 'admin';
  if (employeeToken && !adminToken && !superAdminToken) return 'employee';

  return null;
};

// Derive tenant ID from stored user when currentTenantId is missing (e.g. backend returns it inside user object)
const getTenantIdForRequest = () => {
  let tenantId = window.safeSessionStorage.getItem('currentTenantId');
  if (tenantId) return tenantId;
  try {
    const sessionType = getSessionType();
    const raw = sessionType === 'admin'
      ? window.safeSessionStorage.getItem('adminUser')
      : sessionType === 'employee'
        ? window.safeSessionStorage.getItem('user')
        : null;
    if (!raw) return null;
    const data = JSON.parse(raw);
    const id = data.tenantId ?? data.tenant_id ?? data.organizationId ?? data.organization_id;
    if (id != null) {
      const value = String(id);
      window.safeSessionStorage.setItem('currentTenantId', value);
      return value;
    }
  } catch (_) { }
  return null;
};

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // Add auth token
    const token = getCurrentToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      // Log warning for debugging - but don't block public endpoints
      const isPublicEndpoint =
        config.url?.includes('/auth/login') ||
        config.url?.includes('/auth/register') ||
        config.url?.includes('/auth/check-username') ||
        config.url?.includes('/auth/check-email') ||
        config.url?.includes('/auth/forgot-password') ||
        config.url?.includes('/auth/reset-password') ||
        config.url?.includes('/employee/forgot-password') ||
        config.url?.includes('/employee/reset-password') ||
        config.url?.includes('/admin/auth/forgot-password') ||
        config.url?.includes('/admin/auth/reset-password') ||
        config.url?.includes('/public/') ||
        config.url?.includes('/invitations/') ||
        config.url?.includes('/email-actions/') ||
        config.url?.includes('/auth/setup/');

      if (!isPublicEndpoint) {
        console.warn('⚠️ [API] Request made without token:', config.url, 'Token available:', !!token);
      }
    }

    // Add tenant header (from window.safeSessionStorage or derived from stored user)
    try {
      const tenantId = getTenantIdForRequest();
      if (tenantId) {
        config.headers['X-Tenant-ID'] = tenantId;
      }
    } catch { }

    // If data is FormData, CRITICALLY remove Content-Type header to let browser set it with boundary
    // This is essential for multipart/form-data requests to work correctly
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
      // Also ensure Accept header doesn't interfere
      // Don't delete Accept, but make sure Content-Type is gone
    }

    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error(`[API Request Error] ${error?.config?.url}:`, error?.message);
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    console.log(`[API Response] ${response.status} ${response.config?.url}`);
    return response;
  },
  (error) => {
    console.error(`[API Response Error/Canceled] ${error?.config?.url} Code: ${error?.code} Msg: ${error?.message} Status: ${error?.response?.status}`);
    // Get URL info first for all checks
    const requestUrl = error.config?.url || '';
    const baseURL = error.config?.baseURL || '';
    const fullUrl = error.request?.responseURL || (baseURL ? `${baseURL}${requestUrl}` : requestUrl);
    const url = requestUrl; // Alias for compatibility

    // Suppress 404 errors for employee-of-quarter/current (expected when no current employee)
    // Check both full URL and path - handle various URL formats
    const isEmployeeOfQuarterCurrent =
      url.includes('/employee-of-quarter/current') ||
      fullUrl.includes('/employee-of-quarter/current') ||
      requestUrl.includes('/employee-of-quarter/current') ||
      error.config?.url?.endsWith('/employee-of-quarter/current') ||
      (error.config?.url && error.config.url.indexOf('/employee-of-quarter/current') !== -1);

    if (error.response?.status === 404 && isEmployeeOfQuarterCurrent) {
      // Return a response object instead of rejecting to prevent error logging
      // This allows the calling code to handle 404 gracefully
      // Note: Browser network tab will still show 404, but axios won't log it as an error
      return Promise.resolve({
        status: 404,
        statusText: 'Not Found',
        data: null,
        headers: error.response?.headers || {},
        config: error.config,
        request: error.request
      });
    }

    // Don't logout on 401/403/400 for certain endpoints that might return these for business logic reasons
    const isKraProgressEndpoint = requestUrl.includes('/pms/kra/employee/kra') ||
      requestUrl.includes('/pms/kra/progress/update') ||
      requestUrl.includes('/pms/kra/progress/review') ||
      requestUrl.includes('/pms/kra/my') ||
      fullUrl.includes('/pms/kra/employee/kra') ||
      fullUrl.includes('/pms/kra/progress/update') ||
      fullUrl.includes('/pms/kra/progress/review') ||
      fullUrl.includes('/pms/kra/my');
    const isKraTemplateEndpoint = requestUrl.includes('/pms/kra-template/') ||
      requestUrl.includes('/kra-template/') ||
      fullUrl.includes('/pms/kra-template/') ||
      fullUrl.includes('/kra-template/');
    const isReviewMeetingEndpoint = requestUrl.includes('/api/review/meeting') ||
      requestUrl.includes('/review/meeting') ||
      fullUrl.includes('/api/review/meeting') ||
      fullUrl.includes('/review/meeting');
    const isReviewEndpoint = requestUrl.includes('/api/review/') ||
      requestUrl.includes('/review/') ||
      fullUrl.includes('/api/review/') ||
      fullUrl.includes('/review/');
    const isExitManagementEndpoint = requestUrl.includes('/exit/') ||
      requestUrl.includes('/api/exit/') ||
      fullUrl.includes('/exit/') ||
      fullUrl.includes('/api/exit/');
    const isLeaveEndpoint = requestUrl.includes('/leave-requests') ||
      requestUrl.includes('/employee/leave-requests') ||
      fullUrl.includes('/leave-requests') ||
      fullUrl.includes('/employee/leave-requests');
    const isLeaveTypesEndpoint = requestUrl.includes('/leave-types') ||
      fullUrl.includes('/leave-types') ||
      requestUrl.includes('/employee/leave-types') ||
      fullUrl.includes('/employee/leave-types');
    const isWfhEndpoint = requestUrl.includes('/wfh') || fullUrl.includes('/wfh');
    const isReportingOrManagerEndpoint = requestUrl.includes('/reporting/') || requestUrl.includes('/manager/') || fullUrl.includes('/reporting/') || fullUrl.includes('/manager/');
    const isCheckDualRoleEndpoint = requestUrl.includes('/check-dual-role') ||
      requestUrl.includes('/auth/check-dual-role') ||
      fullUrl.includes('/check-dual-role') ||
      fullUrl.includes('/auth/check-dual-role');
    // Dashboard / post-login endpoints that may return 403 (e.g. tenant not ready, permission) - never logout
    const isDashboardOptionalEndpoint =
      requestUrl.includes('/employee/profile') ||
      requestUrl.includes('/employee/auth/profile') ||
      fullUrl.includes('/employee/profile') ||
      fullUrl.includes('/organization/dashboard-metrics') ||
      requestUrl.includes('/organization/dashboard-metrics') ||
      fullUrl.includes('/employee/assets') ||
      requestUrl.includes('/employee/assets') ||
      fullUrl.includes('/api/features/access') ||
      requestUrl.includes('/api/features/access') ||
      fullUrl.includes('/features/access') ||
      requestUrl.includes('/features/access');

    const isNotificationEndpoint =
      requestUrl.includes('/notifications/') ||
      fullUrl.includes('/notifications/');

    const isSubscriptionEndpoint = requestUrl.includes('/subscription/upgrade') ||
      requestUrl.includes('/admin/subscription/upgrade') ||
      fullUrl.includes('/subscription/upgrade') ||
      fullUrl.includes('/admin/subscription/upgrade');

    // Check for employee creation/update endpoints - these can return 400/401/403 for validation/duplicate errors
    const isEmployeeCreateEndpoint =
      requestUrl.includes('/admin/employees/create') ||
      fullUrl.includes('/admin/employees/create') ||
      (requestUrl.includes('/admin/employees/enhanced') && (error.config?.method === 'post' || error.config?.method === 'put')) ||
      (fullUrl.includes('/admin/employees/enhanced') && (error.config?.method === 'post' || error.config?.method === 'put'));

    // Employee departments (read-only) - 403 may mean endpoint not implemented yet
    const isEmployeeDepartmentsEndpoint =
      requestUrl.includes('/employee/departments') ||
      fullUrl.includes('/employee/departments');
    // Admin departments read (GET) - employee may try fallback for department list
    const isAdminDepartmentsRead =
      (requestUrl.includes('/admin/departments') || fullUrl.includes('/admin/departments')) &&
      (error.config?.method === 'get' || !error.config?.method);

    // Check for timesheet endpoints - comprehensive check (case-insensitive)
    const lowerRequestUrl = requestUrl.toLowerCase();
    const lowerFullUrl = fullUrl.toLowerCase();
    const isTimesheetEndpoint =
      lowerRequestUrl.includes('/timesheet/') ||
      lowerRequestUrl.includes('/timesheets') ||
      lowerRequestUrl.includes('/employee/timesheet/') ||
      lowerRequestUrl.includes('/manager/timesheets') ||
      lowerRequestUrl.includes('/admin/timesheets') ||
      lowerRequestUrl.includes('timesheet') ||
      lowerFullUrl.includes('/timesheet/') ||
      lowerFullUrl.includes('/timesheets') ||
      lowerFullUrl.includes('/employee/timesheet/') ||
      lowerFullUrl.includes('/manager/timesheets') ||
      lowerFullUrl.includes('/admin/timesheets') ||
      lowerFullUrl.includes('timesheet') ||
      // Also check for project/task endpoints used in timesheet entry
      lowerRequestUrl.includes('/projects') ||
      lowerRequestUrl.includes('/tasks') ||
      lowerFullUrl.includes('/projects') ||
      lowerFullUrl.includes('/tasks');

    const isSystemSettingsRead = (requestUrl.includes('/system-settings/') || fullUrl.includes('/system-settings/')) && (error.config?.method === 'get' || !error.config?.method);

    // Never logout on 403 Forbidden for KRA, review, exit, leave, leave-types, WFH, reporting/manager portal, dual role check, dashboard optional, notifications, subscription, employee creation, employee departments, system settings read, or timesheet endpoints (403 can be permission, not auth).
    // CRITICAL: If the response status is 401 Unauthorized, we MUST show the relogin timeout modal, even for these endpoints, because the user's session has actually expired!
    if (error.response?.status === 403 && (isKraProgressEndpoint || isKraTemplateEndpoint || isReviewMeetingEndpoint || isReviewEndpoint || isExitManagementEndpoint || isLeaveEndpoint || isLeaveTypesEndpoint || isWfhEndpoint || isReportingOrManagerEndpoint || isCheckDualRoleEndpoint || isDashboardOptionalEndpoint || isNotificationEndpoint || isTimesheetEndpoint || isSubscriptionEndpoint || isEmployeeCreateEndpoint || isEmployeeDepartmentsEndpoint || isAdminDepartmentsRead || isSystemSettingsRead)) {
      if (isTimesheetEndpoint) {
        console.log('🛡️ [API] Timesheet endpoint access forbidden (403), preserving session:', requestUrl);
      }
      return Promise.reject(error);
    }

    // Don't logout on 400 errors (bad request) - these are validation errors, not auth errors
    if (error.response?.status === 400) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      // Don't logout for login endpoints
      const isLoginEndpoint = error.config?.url?.includes('/auth/login') ||
        error.config?.url?.includes('/login');

      if (isLoginEndpoint) {
        return Promise.reject(error);
      }

      // Determine session type BEFORE clearing tokens
      const currentSessionType = getSessionType();
      const adminToken = window.safeSessionStorage.getItem('adminToken');
      const employeeToken = window.safeSessionStorage.getItem('employeeToken');
      const superAdminToken = window.safeSessionStorage.getItem('superAdminToken');

      // Don't logout immediately after login - give time for token/tenant to be set and first requests to settle
      // Check if we just logged in (within last 15 seconds)
      const employeeLoginTime = window.safeSessionStorage.getItem('employeeLoginTime');
      const adminLoginTime = window.safeSessionStorage.getItem('adminLoginTime');
      const superAdminLoginTime = window.safeSessionStorage.getItem('superAdminLoginTime');

      const recentLoginTime = employeeLoginTime || adminLoginTime || superAdminLoginTime;
      if (recentLoginTime) {
        const loginTimestamp = Date.parse(recentLoginTime);
        const now = Date.now();
        const timeSinceLogin = now - loginTimestamp;

        // If login was less than 15 seconds ago, don't logout - backend may still return 401 for metrics/assets during init
        if (timeSinceLogin < 15000) {
          console.warn('⚠️ [API] 401 error within 15 seconds of login, not logging out (possible race/backend delay)', requestUrl);
          return Promise.reject(error);
        }
      }

      // Log detailed error info to identify root cause of logout
      console.error('🚫 [API] UNAUTHORIZED (401) - LOGGING OUT', {
        url: requestUrl,
        status: error.response?.status,
        sessionType: currentSessionType,
        hasToken: !!(adminToken || employeeToken || superAdminToken),
        time: new Date().toISOString()
      });

      // Persist logout reason for debugging after redirect
      try {
        window.safeSessionStorage.setItem('last_logout_reason', JSON.stringify({
          url: requestUrl,
          status: error.response?.status,
          timestamp: Date.now()
        }));
      } catch (e) {}

      // Always trigger logout if we hold any token in window.safeSessionStorage
      if (adminToken || employeeToken || superAdminToken) {
        
        // Clear all token and session data immediately to prevent infinite API call loops
        window.safeSessionStorage.removeItem('superAdminToken');
        window.safeSessionStorage.removeItem('superAdminUser');
        window.safeSessionStorage.removeItem('adminToken');
        window.safeSessionStorage.removeItem('adminUser');
        window.safeSessionStorage.removeItem('employeeToken');
        window.safeSessionStorage.removeItem('user');
        window.safeSessionStorage.removeItem('sessionType');
        window.safeLocalStorage.removeItem('token');

        // Dispatch custom session-expired event so AuthContext can show a premium timeout modal
        // This avoids abrupt page kickouts and keeps a consistent UX
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('session-expired'));
        }
      }
      // If no matching token found, don't redirect (might be a legitimate 401)

      // Legacy cleanup
      window.safeLocalStorage.removeItem('token');
    }

    // Handle 403 Forbidden - indicate permission issue but NEVER logout
    if (error.response?.status === 403) {
      console.warn('🛡️ [API] FORBIDDEN (403) - Access denied but session preserved:', requestUrl);
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);

// Helpers to read context for ad-hoc headers (uses same tenant resolution as request interceptor)
const getTenantIdFromStorage = () => {
  try {
    return getTenantIdForRequest();
  } catch {
    return null;
  }
};

const getSetupTokenFromStorage = () => {
  try {
    return window.safeSessionStorage.getItem('adminSetupToken');
  } catch {
    return null;
  }
};

// Auth API
export const authAPI = {
  login: (credentials, tenantId = null) => {
    const config = tenantId ? { headers: { 'X-Tenant-ID': String(tenantId) } } : {};
    return api.post('/employee/auth/login', credentials, config);
  },
  register: (userData) => api.post('/employee/auth/register', userData),

  switchToEmployeeMode: () => api.post('/employee/auth/switch-to-employee'),
  switchToAdminMode: () => api.post('/employee/auth/switch-to-admin'),
  checkDualRole: () => api.get('/employee/auth/check-dual-role'),
  verifyOtp: (data) => api.post('/employee/auth/verify-otp', data),
  resendOtp: (data, tenantId = null) => {
    const config = tenantId ? { headers: { 'X-Tenant-ID': String(tenantId) } } : {};
    return api.post('/employee/auth/resend-otp', data, config);
  },

};

// Admin Auth API
export const adminAuthAPI = {
  login: (credentials) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId }, timeout: 30000 } : { timeout: 30000 }; // 30 seconds for login
    return api.post('/admin/auth/login', credentials, config);
  },
  register: (userData) => {
    const tenantId = getTenantIdFromStorage();
    const setupToken = getSetupTokenFromStorage();
    const headers = {};
    if (tenantId) headers['X-Tenant-ID'] = tenantId;
    if (setupToken) headers['X-Setup-Token'] = setupToken;
    const config = Object.keys(headers).length ? { headers } : {};
    return api.post('/admin/auth/register', userData, config);
  },
  validateSetupToken: (dummyTenantId, token) =>
    api.get(`/admin/auth/setup/${encodeURIComponent(dummyTenantId)}/${encodeURIComponent(token)}`),
  checkEmail: (email) => api.get(`/admin/auth/check-email/${email}`),
  checkUsername: (username) => api.get(`/admin/auth/check-username/${username}`),
  getRegistrationCode: () => api.get('/admin/auth/registration-code'),
  getOrganizationsByUsername: (username) => api.get(`/admin/auth/organizations-by-username/${username}`, { timeout: 30000 }), // 30 seconds for organization lookup
  verifyOtp: (data) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.post('/admin/auth/verify-otp', data, config);
  },
  resendOtp: (data) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.post('/admin/auth/resend-otp', data, config);
  },
};

// Employee Directory API (Safe, non-admin endpoints for Celebrations & Workplace Presence)
export const employeeDirectoryAPI = {
  getDirectory: () => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get('/employee/directory', config);
  },
  getApprovedLeavesToday: () => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get('/employee/approved-leaves-today', config);
  },
};

// Admin API
export const adminAPI = {
  getAllEmployees: (params = {}) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId }, params } : { params };
    return api.get('/admin/employees', config);
  },
  bulkImportEmployees: (payloads) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.post('/admin/employees/bulk-import', payloads, config);
  },
  getAdminAccessEmployees: () => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get('/admin/employees/admin-access', config);
  },
  getActiveEmployees: () => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get('/admin/employees/active', config);
  },
  getEmployeeById: (id) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get(`/admin/employees/${id}`, config);
  },
  getEmployeeByEmployeeId: (employeeId) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get(`/admin/employees/employee-id/${employeeId}`, config);
  },
  getEmployeesByDepartment: (department) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get(`/admin/employees/department/${department}`, config);
  },
  createEmployee: (employeeData) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.post('/admin/employees', employeeData, config);
  },
  updateEmployee: (id, employeeData) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.put(`/admin/employees/${id}`, employeeData, config);
  },
  toggleEmployeeStatus: (id) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.patch(`/admin/employees/${id}/toggle-status`, {}, config);
  },
  toggleEmployeeEmailMuted: (id) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.patch(`/admin/employees/${id}/toggle-email-muted`, {}, config);
  },
  deleteEmployee: (id) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.delete(`/admin/employees/${id}`, config);
  },
  permanentlyDeleteEmployee: (id) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.delete(`/admin/employees/${id}/permanent`, config);
  },
  checkEmployeeEmail: (email) =>
    api.get(`/admin/check-employee-email/${encodeURIComponent(String(email).trim())}`),
  checkEmployeeId: (employeeId) => api.get(`/admin/check-employee-id/${employeeId}`),


  // Admin Management API
  getAllAdmins: () => api.get('/admin/admins'),
  getActiveAdmins: () => api.get('/admin/admins/active'),
  toggleAdminStatus: (id) => api.patch(`/admin/admins/${id}/toggle-status`),
  deleteAdmin: (id) => api.delete(`/admin/admins/${id}`),
  permanentlyDeleteAdmin: (id) => api.delete(`/admin/admins/${id}/permanent`),

  // Employee Roles API
  getAllEmployeeRoles: () => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get('/admin/employee-roles', config);
  },
  getActiveEmployeeRoles: () => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get('/admin/employee-roles/active', config);
  },
  createEmployeeRole: (payload) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.post('/admin/employee-roles', payload, config);
  },
  updateEmployeeRole: (id, payload) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.put(`/admin/employee-roles/${id}`, payload, config);
  },
  deleteEmployeeRole: (id) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.delete(`/admin/employee-roles/${id}`, config);
  },
  toggleEmployeeRoleStatus: (id) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.patch(`/admin/employee-roles/${id}/toggle-status`, {}, config);
  },
  getRolePermissionCatalog: () => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get('/admin/role-permissions/catalog', config);
  },
  getEmployeeLimit: () => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get('/admin/subscription/employee-limit', config);
  },
  // Admin Profile Management
  getAdminProfile: () => api.get('/admin/profile'),
  updateProfile: (formData) => {
    // Check if formData contains a file
    const hasFile = formData instanceof FormData &&
      Array.from(formData.entries()).some(([key, value]) =>
        value instanceof File || value instanceof Blob
      );

    const config = {};
    if (hasFile) {
      config.headers = {
        'Content-Type': 'multipart/form-data',
      };
    }

    return api.put('/admin/profile', formData, config);
  },

  // System Settings - Notice Period
  getNoticePeriodConfig: () => api.get('/settings/notice-period'),
  setDefaultNoticePeriod: (days) => api.post(`/settings/notice-period/default?noticePeriodDays=${days}`),
  getWeekendConfig: () => api.get('/settings/weekoff'),
  updateWeekendConfig: (config) => api.post('/settings/weekoff', config),

  // System Settings - WFH Policy
  getWfhPolicyConfig: () => api.get('/admin/system-settings/wfh-policy'),
  updateWfhPolicyConfig: (config) => api.put('/admin/system-settings/wfh-policy', config),
  changePassword: (passwordData) => api.put('/admin/change-password', passwordData),
  forgotPassword: (usernameOrEmail) => api.post('/admin/auth/forgot-password', { usernameOrEmail }),
  resetPassword: (token, newPassword, confirmPassword) => api.post('/admin/auth/reset-password', { token, newPassword, confirmPassword }),

  // Shift Management API
  getAllShifts: () => api.get('/admin/shifts'),
  getShiftById: (id) => api.get(`/admin/shifts/${id}`),
  createShift: (shiftData) => api.post('/admin/shifts', shiftData),
  updateShift: (id, shiftData) => api.put(`/admin/shifts/${id}`, shiftData),
  deleteShift: (id) => api.delete(`/admin/shifts/${id}`),
  assignShiftToEmployee: (employeeId, shiftId) => api.patch(`/admin/employees/${employeeId}/assign-shift?shiftId=${shiftId}`),
  removeShiftFromEmployee: (employeeId) => api.patch(`/admin/employees/${employeeId}/remove-shift`),

  // Department Management API
  getAllDepartments: () => api.get('/admin/departments'),
  getActiveDepartments: () => api.get('/admin/departments/active'),
  getDepartmentById: (id) => api.get(`/admin/departments/${id}`),
  createDepartment: (departmentData) => api.post('/admin/departments', departmentData),
  updateDepartment: (id, departmentData) => api.put(`/admin/departments/${id}`, departmentData),
  deleteDepartment: (id) => api.delete(`/admin/departments/${id}`),
  toggleDepartmentStatus: (id) => api.patch(`/admin/departments/${id}/toggle-status`),

  // Position Management API
  getAllPositions: () => api.get('/admin/positions'),
  getActivePositions: () => api.get('/admin/positions/active'),
  getPositionById: (id) => api.get(`/admin/positions/${id}`),
  createPosition: (positionData) => api.post('/admin/positions', positionData),
  updatePosition: (id, positionData) => api.put(`/admin/positions/${id}`, positionData),
  deletePosition: (id) => api.delete(`/admin/positions/${id}`),
  togglePositionStatus: (id) => api.patch(`/admin/positions/${id}/toggle-status`),

  // Enhanced Employee Management API (aliases for form usage)
  createEnhancedEmployee: (employeeData) => api.post('/admin/employees/enhanced', employeeData),
  getEnhancedEmployeeById: (id) => api.get(`/admin/employees/enhanced/${id}`),
  updateEnhancedEmployee: (id, employeeData) => api.put(`/admin/employees/enhanced/${id}`, employeeData),

  // Employee self-fill invite (HR sends form link to employee)
  sendEmployeeSelfFillInvite: (data) => api.post('/admin/employee-self-fill/send', data),
  getEmployeeSelfFillByEmail: (email) => api.get('/admin/employee-self-fill/by-email', { params: { email } }),
  getEmployeeSelfFillById: (id) => api.get(`/admin/employee-self-fill/${id}`),
  previewSelfFillDocument: (id, field) => api.get(`/admin/employee-self-fill/${id}/documents/${field}/preview`, { responseType: 'blob' }),
  downloadSelfFillDocument: (id, field) => api.get(`/admin/employee-self-fill/${id}/documents/${field}/download`, { responseType: 'blob' }),
  deleteSelfFillDocument: (id, field) => api.delete(`/admin/employee-self-fill/${id}/documents/${field}`),

  // Employee Role Management API
  getAllEmployeeRoles: () => api.get('/admin/employee-roles'),
  getActiveEmployeeRoles: () => api.get('/admin/employee-roles/active'),
  getEmployeeRoleById: (id) => api.get(`/admin/employee-roles/${id}`),
  createEmployeeRole: (employeeRoleData) => api.post('/admin/employee-roles', employeeRoleData),
  updateEmployeeRole: (id, employeeRoleData) => api.put(`/admin/employee-roles/${id}`, employeeRoleData),
  deleteEmployeeRole: (id, employeeRoleData) => api.delete(`/admin/employee-roles/${id}`),
  toggleEmployeeRoleStatus: (id) => api.patch(`/admin/employee-roles/${id}/toggle-status`),
  getRolePermissionCatalog: () => api.get('/admin/role-permissions/catalog'),

  // Leave Management API
  getAllLeaveTypes: () => api.get('/admin/leave-management/leave-types'),
  getActiveLeaveTypes: () => api.get('/admin/leave-management/leave-types/active'),
  getLeaveTypeById: (id) => api.get(`/admin/leave-management/leave-types/${id}`),
  createLeaveType: (leaveTypeData, createdBy) => api.post('/admin/leave-management/leave-types', leaveTypeData, { params: { createdBy } }),
  updateLeaveType: (id, leaveTypeData, updatedBy) => api.put(`/admin/leave-management/leave-types/${id}`, leaveTypeData, { params: { updatedBy } }),
  deleteLeaveType: (id) => api.delete(`/admin/leave-management/leave-types/${id}`),
  toggleLeaveTypeStatus: (id) => api.patch(`/admin/leave-management/leave-types/${id}/toggle-status`),
  getCarryforwardLeaveTypes: () => api.get('/admin/leave-management/leave-types/carryforward'),
  getAvailableLeaveTypeCodes: () => api.get('/admin/leave-management/leave-types/available-codes'),
  getLeaveTypeCodeByName: (leaveTypeName) => api.get(`/admin/leave-management/leave-types/code-by-name/${leaveTypeName}`),

  // System Settings - Manager Leave Limits
  getManagerLeaveLimits: () => api.get('/admin/system-settings/manager-leave-limits'),
  updateManagerLeaveLimits: (limitsByCode) => api.put('/admin/system-settings/manager-leave-limits', limitsByCode),

  // System Settings - Manager Approval Email CC Config
  getManagerApprovalCcConfig: () => api.get('/admin/notification-config/manager-approval-cc'),
  updateManagerApprovalCcConfig: (data) => api.put('/admin/notification-config/manager-approval-cc', data),

  // System Settings - Employee ID Format
  getEmployeeIdFormat: () => api.get('/admin/system-settings/employee-id-format'),
  checkPrefixAvailability: (prefix) => api.get('/admin/system-settings/employee-id-format/check-prefix', { params: { prefix } }),
  updateEmployeeIdFormat: (formatData) => api.put('/admin/system-settings/employee-id-format', formatData),
  getTwoFactorConfig: () => api.get('/admin/system-settings/two-factor-auth'),
  updateTwoFactorConfig: (config) => api.put('/admin/system-settings/two-factor-auth', config),

  // Utility Endpoints
  getCurrentYear: () => api.get('/admin/leave-management/current-year'),
  getAvailableYears: () => api.get('/admin/leave-management/available-years'),

  // Asset Management API
  getAllAssets: () => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get('/admin/assets', config);
  },
  getAssetById: (id) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get(`/admin/assets/${id}`, config);
  },
  getAssetByAssetId: (assetId) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get(`/admin/assets/asset-id/${assetId}`, config);
  },
  getAssetsByType: (assetType) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get(`/admin/assets/type/${assetType}`, config);
  },
  getAssetsByStatus: (status) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get(`/admin/assets/status/${status}`, config);
  },
  getAvailableAssets: () => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get('/admin/assets/available', config);
  },
  getAssignedAssets: () => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get('/admin/assets/assigned', config);
  },
  getAssetsByEmployee: (employeeId) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get(`/admin/assets/employee/${employeeId}`, config);
  },
  searchAssets: (searchTerm) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get(`/admin/assets/search?searchTerm=${searchTerm}`, config);
  },
  getAssetsWithExpiringWarranty: () => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get('/admin/assets/warranty-expiring', config);
  },
  createAsset: (assetData) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.post('/admin/assets', assetData, config);
  },
  updateAsset: (id, assetData) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.put(`/admin/assets/${id}`, assetData, config);
  },
  assignAsset: (assignmentData) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.post('/admin/assets/assign', assignmentData, config);
  },
  returnAsset: (assetId) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.post(`/admin/assets/${assetId}/return`, null, config);
  },
  updateAssetStatus: (assetId, statusData) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.patch(`/admin/assets/${assetId}/status`, statusData, config);
  },
  deleteAsset: (id) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.delete(`/admin/assets/${id}`, config);
  },
  getAssetDashboard: () => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get('/admin/assets/dashboard', config);
  },
  getAssetActivity: (limit = 50) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get('/admin/assets/activity', { params: { limit }, ...config });
  },
  getAssetHistory: (id) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get(`/admin/assets/${id}/history`, config);
  },
  transferAsset: (data) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.post('/admin/assets/transfer', data, config);
  },
  getAssetTickets: (status) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get('/admin/assets/tickets', { params: status ? { status } : {}, ...config });
  },
  getAssetTicketsForAsset: (id) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get(`/admin/assets/${id}/tickets`, config);
  },
  createAssetTicket: (data) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.post('/admin/assets/tickets', data, config);
  },
  updateAssetTicket: (ticketId, data) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.put(`/admin/assets/tickets/${ticketId}`, data, config);
  },
  getAssetMaintenance: () => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get('/admin/assets/maintenance', config);
  },
  getAssetMaintenanceForAsset: (id) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get(`/admin/assets/${id}/maintenance`, config);
  },
  addAssetMaintenance: (data) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.post('/admin/assets/maintenance', data, config);
  },

  // Expense Management
  getAllExpenses: () => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get('/admin/expenses', config);
  },
  getExpenseById: (id) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get(`/admin/expenses/${id}`, config);
  },
  approveExpense: (id) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.patch(`/admin/expenses/${id}/final-approve`, null, config);
  },
  financeApproveExpense: (id) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.patch(`/admin/expenses/${id}/finance-approve`, null, config);
  },
  finalApproveExpense: (id) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.patch(`/admin/expenses/${id}/final-approve`, null, config);
  },
  rejectExpense: (id, rejectionReason) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.patch(`/admin/expenses/${id}/reject`, { rejectionReason: rejectionReason || '' }, config);
  },
  uploadAssetFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/assets/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// Locations API (tenant-scoped, admin-only)
export const locationsAPI = {
  list: (page = 0, size = 20, search = '') => {
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('size', size);
    if (search && search.trim()) params.set('search', search.trim());
    return api.get(`/locations?${params.toString()}`);
  },
  create: (payload) => api.post('/locations', payload),
  update: (id, payload) => api.put(`/locations/${id}`, payload),
  remove: (id) => api.delete(`/locations/${id}`),
};

export const preferenceAPI = {
  get: (username) => api.get(`/user-preferences/${encodeURIComponent(username)}`),
  save: (username, json) => api.put(`/user-preferences/${encodeURIComponent(username)}`, json, { headers: { 'Content-Type': 'application/json' } }),
  getMe: () => api.get('/user-preferences/me'),
  saveMeRole: (role, json) => api.put(`/user-preferences/me?role=${encodeURIComponent(role)}`, json, { headers: { 'Content-Type': 'application/json' } }),
};

// Timesheet screenshots (timer evidence)
export const timesheetScreenshotAPI = {
  getEntryScreenshots: (entryId) => api.get(`/employee/timesheet/entry/${entryId}/screenshots`),
  getDayScreenshots: (workDate) => api.get('/employee/timesheet/day-screenshots', { params: { workDate } }),
};

// Reporting API
export const reportingAPI = {
  getEmployeeTeamInfo: (employeeId) => api.get(`/reporting/employee/${employeeId}`),
  getReportingManager: (employeeId) => api.get(`/reporting/manager/${employeeId}`),
  getSubordinates: (employeeId) => api.get(`/reporting/subordinates/${employeeId}`),
  getHierarchy: (employeeId) => api.get(`/reporting/hierarchy/${employeeId}`),
  getOrgChart: () => api.get('/reporting/org-chart'),
  getAllWithManagers: () => api.get('/reporting/all-with-managers'),
  setManager: (employeeId, managerId) =>
    api.post(`/reporting/set-manager`, null, { params: { employeeId, managerId }, timeout: 30000 }),
  removeManager: (employeeId) =>
    api.post(`/reporting/remove-manager`, null, { params: { employeeId }, timeout: 30000 }),
  getPotentialManagers: (employeeId) =>
    api.get(`/reporting/potential-managers/${employeeId}`),
  getTeamAttendance: (managerId, date) => {
    const params = { managerId };
    if (date) params.date = date;
    return api.get('/reporting/team-attendance', { params });
  },
  getEmployeeMasterReport: (filters) => {
    const params = {};
    Object.keys(filters || {}).forEach(key => {
      if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') {
        params[key] = filters[key];
      }
    });
    return api.get('/reporting/employee-master-report', { params });
  },
  getExitedEmployeesReport: (filters = {}) => {
    const params = {};
    Object.keys(filters || {}).forEach(key => {
      if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') {
        params[key] = filters[key];
      }
    });
    return api.get('/reporting/exited-employees-report', { params });
  },
  getProbationReport: (filters = {}) => {
    const params = {};
    Object.keys(filters || {}).forEach(key => {
      if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') {
        params[key] = filters[key];
      }
    });
    return api.get('/reporting/probation-report', { params });
  },

  // Attendance Reports API
  getDailyAttendanceReport: (params) => api.get('/reporting/attendance/daily', { params }),
  getMonthlyAttendanceSummary: (params) => api.get('/reporting/attendance/monthly-summary', { params }),
  getLateEarlyReport: (params) => api.get('/reporting/attendance/late-early', { params }),
  getAbsenteeismReport: (params) => api.get('/reporting/attendance/absenteeism', { params }),
  getOvertimeReport: (params) => api.get('/reporting/attendance/overtime', { params }),
  getWFHReport: (params) => api.get('/reporting/attendance/wfh', { params }),
  getShiftBasedReport: (params) => api.get('/reporting/attendance/shift-based', { params }),
  getAttendanceExceptionReport: (params) => api.get('/reporting/attendance/exceptions', { params }),

  // Leave Reports API
  getLeaveSummaryReport: (params) => api.get('/reporting/leave/summary', { params }),
  getEmployeeWiseLeaveReport: (params) => api.get('/reporting/leave/employee-wise', { params }),
  getLeaveApprovalStatusReport: (params) => api.get('/reporting/leave/approval-status', { params }),
  getLeaveBalanceReport: (params) => api.get('/reporting/leave/balance', { params }),
  getLeaveTypeWiseReport: (params) => api.get('/reporting/leave/type-wise', { params }),
  getDepartmentWiseLeaveReport: (params) => api.get('/reporting/leave/department-wise', { params }),
  getOverlappingLeaveReport: (params) => api.get('/reporting/leave/overlapping', { params }),
  getLOPReport: (params) => api.get('/reporting/leave/lop', { params }),

  // Reporting Management Reports API
  getManagerEmployeeMappingReport: (params) => api.get('/reporting/reporting-management/manager-employee-mapping', { params }),
  getTeamHierarchyReport: (params) => api.get('/reporting/reporting-management/team-hierarchy', { params }),
  getUnassignedEmployeesReport: (params) => api.get('/reporting/reporting-management/unassigned-employees', { params }),
  getManagerTeamStrengthReport: (params) => api.get('/reporting/reporting-management/manager-team-strength', { params }),

  // Asset Management Reports API
  getEmployeeWiseAssetReport: (params) => api.get('/reporting/asset-management/employee-wise', { params }),
  getAssetAllocationReport: (params) => api.get('/reporting/asset-management/allocation', { params }),
  getAssetReturnReport: (params) => api.get('/reporting/asset-management/return', { params }),
  getAssetStatusReport: (params) => api.get('/reporting/asset-management/status', { params }),
  getDepartmentWiseAssetReport: (params) => api.get('/reporting/asset-management/department-wise', { params }),
  getAssetAuditReport: (params) => api.get('/reporting/asset-management/audit', { params }),
  getExitAssetClearanceReport: (params) => api.get('/reporting/asset-management/exit-clearance', { params }),

  // Performance/PMS Reports API
  getPerformanceReviewSummaryReport: (params) => api.get('/reporting/performance-review-summary', { params }),
  getPerformanceReviewEmployeeWiseReport: (params) => api.get('/reporting/performance-review-employee-wise', { params }),
  getMeetingsSummaryReport: (params) => api.get('/reporting/meetings-summary', { params }),
  getFeedbackSummaryReport: (params) => api.get('/reporting/feedback-summary', { params }),
  getPerformanceReviewDepartmentWiseReport: (params) => api.get('/reporting/performance-review-department-wise', { params }),
  getPerformanceReviewStatusReport: (params) => api.get('/reporting/performance-review-status', { params }),
  getPerformancePipReport: (params) => api.get('/reporting/performance-pip-report', { params }),
  getPerformanceRatingDistributionReport: (params) => api.get('/reporting/performance-rating-distribution', { params }),
};

// Employee API
export const employeeAPI = {
  getProfile: () => api.get('/employee/profile'),


  // Profile Management
  getEmployeeProfile: () => api.get('/employee/profile'),
  updateProfile: (formData) => {
    // Check if formData contains a file
    const hasFile = formData instanceof FormData &&
      Array.from(formData.entries()).some(([key, value]) =>
        value instanceof File || value instanceof Blob
      );

    if (!hasFile) {
      return employeeAPI.updateProfileJson(formData);
    }

    const config = {};
    // axios will automatically set the boundary for FormData
    return api.put('/employee/profile', formData, config);
  },
  updateProfileJson: (profileData) => {
    // Convert FormData to JSON object for the fallback endpoint
    const jsonData = {};
    if (profileData instanceof FormData) {
      for (let [key, value] of profileData.entries()) {
        if (!(value instanceof File || value instanceof Blob)) {
          jsonData[key] = value;
        }
      }
    } else {
      Object.assign(jsonData, profileData);
    }

    return api.put('/employee/profile/json', jsonData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  },
  changePassword: (passwordData) => api.put('/employee/change-password', passwordData),
  forgotPassword: (employeeIdOrEmail) => api.post('/employee/forgot-password', { employeeIdOrEmail }),
  resetPassword: (token, newPassword, confirmPassword) => api.post('/employee/reset-password', { token, newPassword, confirmPassword }),

  // Asset Management
  getMyAssets: () => api.get('/employee/assets'),
  getMyAssetTickets: () => api.get('/employee/assets/tickets'),
  raiseAssetTicket: (data) => api.post('/employee/assets/tickets', data),
  getAssetHistory: (assetId) => api.get(`/employee/assets/${assetId}/history`),
  getAssetMaintenance: (assetId) => api.get(`/employee/assets/${assetId}/maintenance`),
  getAssetsByEmployeeId: (employeeId) => api.get(`/employee/assets/by-employee-id/${employeeId}`),
  checkEmployee: (employeeId) => api.get(`/employee/assets/check-employee/${employeeId}`),
  getSessionInfo: () => api.get('/employee/assets/session-info'),
  getAssetsAsAdminEmployee: () => api.get('/employee/assets/admin-as-employee'),
  uploadAssetFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/assets/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Expense Management
  getMyExpenses: () => api.get('/employee/expenses'),
  submitExpense: (data) => {
    // If caller provided a FormData (with files), send as multipart/form-data
    const isForm = data instanceof FormData;
    const config = {};
    if (isForm) {
      // Axios will automatically set Content-Type to multipart/form-data with a boundary
    }
    return api.post('/employee/expenses', data, config);
  },

  // Phone Number Visibility
  getPhoneVisibility: () => api.get('/employee/phone-visibility'),
  updatePhoneVisibility: (visible) => api.put('/employee/phone-visibility', { phoneNumberVisible: visible }),

  // Leave Management
  getActiveLeaveTypes: () => api.get('/employee/leave-types/active'),
  getAvailableLeaveTypeCodes: () => api.get('/employee/leave-types/available-codes'),
  getEmployeeLeaveRequests: () => api.get('/employee/leave-requests'),
  // Public settings needed on employee/manager UI
  getPublicManagerLeaveLimits: () => api.get('/public/system-settings/manager-leave-limits'),

  // Newly Joined Employees
  getNewlyJoinedEmployees: () => api.get('/employee/newly-joined'),

  // Departments (read-only list for employee view)
  getDepartments: () => api.get('/employee/departments'),
  getDepartmentEmployees: (departmentName) =>
    api.get(`/employee/departments/${encodeURIComponent(departmentName)}/employees`),
};

// Work Status API
export const workStatusAPI = {
  // Employee endpoints
  submitWorkStatus: (statusText, challenges, taskForTomorrow, statusType, workDate) =>
    api.post('/employee/work-status/submit', null, {
      params: { statusText, challenges, taskForTomorrow, statusType, workDate }
    }),
  getMyWorkStatuses: () => api.get('/employee/work-status/my-statuses'),
  getMyWorkStatusByDate: (date) => api.get(`/employee/work-status/my-status/${date}`),
  getMyWorkStatusesByDateRange: (startDate, endDate) =>
    api.get('/employee/work-status/my-status/range', { params: { startDate, endDate } }),
  updateMyWorkStatus: (workStatusId, statusText, challenges, taskForTomorrow, statusType) =>
    api.put(`/employee/work-status/update/${workStatusId}`, null, { params: { statusText, challenges, taskForTomorrow, statusType } }),

  // Admin endpoints
  getAllWorkStatusesByDate: (date) => api.get(`/admin/work-status/all-by-date/${date}`),
  getAllWorkStatusesByDateRange: (startDate, endDate) =>
    api.get('/admin/work-status/all-by-date-range', { params: { startDate, endDate } }),
  getAllWorkStatusesByMonth: (year, month) =>
    api.get('/admin/work-status/all-by-month', { params: { year, month } }),
  getCurrentWeekWorkStatuses: () => api.get('/admin/work-status/current-week'),
  getEmployeeWorkStatuses: (employeeId) => api.get(`/admin/work-status/employee/${employeeId}`),
  getEmployeeWorkStatusesByDateRange: (employeeId, startDate, endDate) =>
    api.get(`/admin/work-status/employee/${employeeId}/date-range`, { params: { startDate, endDate } }),
  updateWorkStatus: (workStatusId, statusText, challenges, taskForTomorrow, statusType) =>
    api.put(`/admin/work-status/update/${workStatusId}`, null, { params: { statusText, challenges, taskForTomorrow, statusType } }),
  deleteWorkStatus: (workStatusId) => api.delete(`/admin/work-status/delete/${workStatusId}`),

  // Admin comment methods
  addAdminComment: (workStatusId, comment) =>
    api.post(`/admin/work-status/${workStatusId}/comment`, { comment }),
  updateAdminComment: (workStatusId, comment) =>
    api.put(`/admin/work-status/${workStatusId}/comment`, { comment }),
  removeAdminComment: (workStatusId) =>
    api.delete(`/admin/work-status/${workStatusId}/comment`),

  // Enhanced Employee Management API
  createEnhancedEmployee: (employeeData) => api.post('/admin/employees/enhanced', employeeData),
  getEnhancedEmployeeById: (id) => api.get(`/admin/employees/enhanced/${id}`),
  updateEnhancedEmployee: (id, employeeData) => api.put(`/admin/employees/enhanced/${id}`, employeeData),

  // Employee Education API
  getEmployeeEducation: (id) => api.get(`/admin/employees/${id}/education`),
  addEmployeeEducation: (id, educationData) => api.post(`/admin/employees/${id}/education`, educationData),
  updateEmployeeEducation: (id, educationId, educationData) => api.put(`/admin/employees/${id}/education/${educationId}`, educationData),
  deleteEmployeeEducation: (id, educationId) => api.delete(`/admin/employees/${id}/education/${educationId}`),

  // Employee Work Experience API
  getEmployeeWorkExperience: (id) => api.get(`/admin/employees/${id}/work-experience`),
  addEmployeeWorkExperience: (id, workExperienceData) => api.post(`/admin/employees/${id}/work-experience`, workExperienceData),
  updateEmployeeWorkExperience: (id, workExperienceId, workExperienceData) => api.put(`/admin/employees/${id}/work-experience/${workExperienceId}`, workExperienceData),
  deleteEmployeeWorkExperience: (id, workExperienceId) => api.delete(`/admin/employees/${id}/work-experience/${workExperienceId}`),

};

// Attendance API
export const attendanceAPI = {
  // Get daily attendance
  getDailyAttendance: (date) => api.get('/attendance/daily', { params: { date } }),

  // Get attendance by date range
  getAttendanceByDateRange: (startDate, endDate) =>
    api.get('/attendance/range', { params: { startDate, endDate } }),

  // Employee-only: get own attendance by date range
  getMyAttendanceByDateRange: (startDate, endDate) =>
    api.get('/attendance/my-range', { params: { startDate, endDate } }),

  // Get employee attendance
  getEmployeeAttendance: (employeeId, startDate, endDate) =>
    api.get(`/attendance/employee/${employeeId}`, { params: { startDate, endDate } }),

  // Get attendance statistics
  getAttendanceStatistics: (date) => api.get('/attendance/statistics', { params: { date } }),


};



// Employee Analytics API
export const employeeAnalyticsAPI = {
  // Get monthly employee analytics
  getMonthlyAnalytics: (year, month) =>
    api.get('/employee-analytics/monthly', { params: { year, month } }),

  // Get current month analytics
  getCurrentMonthAnalytics: () => api.get('/employee-analytics/current-month'),


};

// Holiday Calendar API
export const holidayCalendarAPI = {
  // Admin endpoints
  uploadHolidayCalendar: (formData) => api.post('/holiday-calendars/admin/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 60000, // 60 seconds for file uploads
  }),
  updateHolidayCalendar: (id, formData) => api.put(`/holiday-calendars/admin/${id}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 60000, // 60 seconds for file uploads
  }),
  getAllHolidayCalendars: () => api.get('/holiday-calendars/admin/all'),
  deleteHolidayCalendar: (id) => api.delete(`/holiday-calendars/admin/${id}`),
  toggleHolidayCalendarStatus: (id) => api.put(`/holiday-calendars/admin/${id}/toggle-status`),

  // Employee endpoints
  getActiveHolidayCalendars: () => api.get('/holiday-calendars/employee/active'),
  getHolidayCalendarByYear: (year) => api.get(`/holiday-calendars/employee/year/${year}`),
  getHolidayCalendarById: (id) => api.get(`/holiday-calendars/employee/${id}`),

  // File endpoints
  downloadHolidayCalendar: (id) => api.get(`/holiday-calendars/${id}/download`, { responseType: 'blob' }),
  viewHolidayCalendar: (id) => api.get(`/holiday-calendars/${id}/view`),
  getHolidayCalendarFile: (id) => api.get(`/holiday-calendars/${id}/file`, { responseType: 'blob' }),

  // Defined Holidays API
  createHoliday: (holidayData) => {
    const formData = new FormData();
    formData.append('name', holidayData.name);
    formData.append('date', holidayData.date);
    formData.append('type', holidayData.type);
    formData.append('region', holidayData.region);
    if (holidayData.isOptional !== undefined) {
      formData.append('isOptional', holidayData.isOptional);
    }
    if (holidayData.selectionDeadline) {
      formData.append('selectionDeadline', holidayData.selectionDeadline);
    }
    return api.post('/holiday-calendars/admin/holidays', formData);
  },
  updateHoliday: (id, holidayData) => {
    const formData = new FormData();
    formData.append('name', holidayData.name);
    formData.append('date', holidayData.date);
    formData.append('type', holidayData.type);
    formData.append('region', holidayData.region);
    if (holidayData.isOptional !== undefined) {
      formData.append('isOptional', holidayData.isOptional);
    }
    if (holidayData.selectionDeadline) {
      formData.append('selectionDeadline', holidayData.selectionDeadline);
    }
    return api.put(`/holiday-calendars/admin/holidays/${id}`, formData);
  },
  getAllHolidays: () => api.get('/holiday-calendars/admin/holidays'),
  deleteHoliday: (id) => api.delete(`/holiday-calendars/admin/holidays/${id}`),
  toggleHolidayStatus: (id) => api.put(`/holiday-calendars/admin/holidays/${id}/toggle-status`),
  getActiveHolidays: () => api.get('/holiday-calendars/employee/holidays'),
  getHolidaysByYear: (year) => api.get(`/holiday-calendars/employee/holidays/year/${year}`),
  getOptionalHolidays: () => api.get('/holiday-calendars/employee/optional-holidays'),
  selectOptionalHoliday: (holidayId) => api.post(`/holiday-calendars/employee/optional-holidays/${holidayId}/select`),
  deselectOptionalHoliday: (holidayId) => api.delete(`/holiday-calendars/employee/optional-holidays/${holidayId}/deselect`),
  getOptionalHolidaysReport: () => api.get('/holiday-calendars/admin/optional-holidays/report'),
};



// Payslip Template API
export const payslipTemplateAPI = {
  // Admin endpoints
  uploadTemplate: (formData) => api.post('/admin/payslip-templates/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  getAllTemplates: () => api.get('/admin/payslip-templates'),
  getTemplateById: (templateId) => api.get(`/admin/payslip-templates/${templateId}`),
  getTemplateFormFields: (templateId) => api.get(`/admin/payslip-templates/${templateId}/form-fields`),
  deleteTemplate: (templateId) => api.delete(`/admin/payslip-templates/${templateId}`),
  toggleTemplateStatus: (templateId) => api.post(`/admin/payslip-templates/${templateId}/toggle-status`),
  downloadTemplate: (templateId) => api.get(`/admin/payslip-templates/${templateId}/download`, { responseType: 'blob' }),
};

// Generated Payslip API
export const generatedPayslipAPI = {
  // Admin endpoints
  generatePayslip: (data) => api.post('/admin/payslips/generate', data),
  generatePayslipDynamic: (data) => api.post('/admin/payslips/generate-dynamic', data),
  getAllPayslips: (month, year) => api.get('/admin/payslips', { params: { month, year } }),
  getPayslipById: (payslipId) => api.get(`/admin/payslips/${payslipId}`),
  deletePayslip: (payslipId) => api.delete(`/admin/payslips/${payslipId}`),
  downloadPayslip: (payslipId) => api.get(`/admin/payslips/${payslipId}/download`, { responseType: 'blob' }),

  // Employee endpoints
  getMyPayslips: () => api.get('/employee/payslips'),
  getMyPayslipById: (payslipId) => api.get(`/employee/payslips/${payslipId}`),
  downloadMyPayslip: (payslipId) => api.get(`/employee/payslips/${payslipId}/download`, { responseType: 'blob' }),
};

/** One-way HRMS → Payroll microservice sync (tenant-scoped). */
export const payrollSyncAPI = {
  getStatus: () => api.get('/admin/payroll-sync/status'),
  syncAllEmployees: () => api.post('/admin/payroll-sync/employees', {}, { timeout: 120000 }),
  syncEmployee: (id) => api.post(`/admin/payroll-sync/employees/${id}`, {}, { timeout: 30000 }),
  syncTimeForMonth: (month) => api.post(`/admin/payroll-sync/time/${month}`, {}, { timeout: 120000 }),
};

// Extra Hours API
export const extraHoursAPI = {
  // Employee
  getOwn: () => api.get('/employee/extra-hours'),
  getById: (id) => api.get(`/employee/extra-hours/${id}`),
  add: (date, fromTime, toTime, hours, description) => api.post('/employee/extra-hours', null, { params: { date, fromTime, toTime, hours, description } }),
  update: (id, date, fromTime, toTime, hours, description) => api.put(`/employee/extra-hours/${id}`, null, { params: { date, fromTime, toTime, hours, description } }),
  delete: (id) => api.delete(`/employee/extra-hours/${id}`),

  // New Methods for UI - Unified with backend paths
  getMyRequests: () => api.get('/employee/extra-hours'),
  submitRequest: (data) => {
    const params = {
      date: data.date,
      fromTime: data.startTime, // Map startTime -> fromTime
      toTime: data.endTime,     // Map endTime -> toTime
      hours: data.hours,
      description: data.description
    };
    return api.post('/employee/extra-hours', null, { params });
  },

  // Admin
  getAll: () => api.get('/admin/extra-hours'), // Get all extra hours for tenant
  getForEmployee: (employeeId) => api.get('/admin/extra-hours', { params: { employeeId } }),

  // New Admin Methods
  getAllRequests: (filters) => api.get('/admin/extra-hours', { params: filters }),
  updateStatus: (id, status, adminComment) => api.put(`/admin/extra-hours/${id}/status`, { status, adminComment }),
  getStats: () => api.get('/admin/extra-hours/stats'),
};

// Time Entry API
export const timeEntryAPI = {
  // Clock in/out - requires user confirmation
  clockIn: (employeeId, latitude = null, longitude = null, workLocation = 'OFFICE') =>
    api.post('/time-entry/clock-in', { employeeId, latitude, longitude, workLocation, userConfirmed: true }),
  clockOut: (employeeId, latitude = null, longitude = null) =>
    api.post('/time-entry/clock-out', { employeeId, latitude, longitude, userConfirmed: true }),

  // Clock in/out confirmation
  confirmClockIn: (employeeId) => api.post('/time-entry/clock-in-confirm', { employeeId }),
  confirmClockOut: (employeeId) => api.post('/time-entry/clock-out-confirm', { employeeId }),

  // Get current status
  getCurrentStatus: (employeeId) => api.get(`/time-entry/status/${employeeId}`),
  getMyStatus: () => api.get('/time-entry/my-status'),
  isClockedIn: (employeeId) => api.get(`/time-entry/is-clocked-in/${employeeId}`),
  getDetailedStatus: (employeeId) => api.get(`/time-entry/debug-status/${employeeId}`),
  getUserActionRequirements: (employeeId) => api.get(`/time-entry/user-action-requirements/${employeeId}`),


  // Get time entries
  getEmployeeTimeEntries: (employeeId, startDate, endDate) =>
    api.get(`/time-entry/employee/${employeeId}`, { params: { startDate, endDate } }),
  getDailyTimeEntries: (date) => api.get('/time-entry/daily', { params: { date } }),
  getCurrentlyClockedInEmployees: () => api.get('/time-entry/currently-clocked-in'),

  // Analytics
  getDailyAnalytics: (date) => api.get('/time-entry/analytics/daily', { params: { date } }),
  
  // Trigger auto clock-out manual check
  triggerAutoClockOut: () => api.post('/time-entry/auto-clockout'),
};

// Location API
export const locationAPI = {
  // Office location management
  getOfficeLocation: () => api.get('/admin/location/office'),
  setOfficeLocation: (locationData) => api.post('/admin/location/office', locationData),

};

// Invitation APIs
export const validateInvitationToken = async (token) => {
  const response = await api.get(`/invitations/validate/${token}`);
  return response.data;
};

export const acceptInvitation = async (data) => {
  const response = await api.post(`/invitations/accept`, data);
  return response.data;
};

export const sendInvitation = async (data) => {
  const response = await api.post(`/invitations/send`, data);
  return response.data;
};

export const resendInvitation = async (employeeId) => {
  const response = await api.post(`/admin/employees/${employeeId}/resend-invitation`);
  return response.data;
};

// Email Action APIs (Leave Approval / Rejection / Direct-to-HR from email notifications)
export const emailActionAPI = {
  getStatus: (token) => api.get('/email-actions/leave-request/status', { params: { token } }),
  validateToken: (token) => api.get('/email-actions/leave-request/validate-token', { params: { token } }),
  approve: (token) => api.post('/email-actions/leave-request/approve', null, { params: { token } }),
  managerApprove: (token) => api.post('/email-actions/leave-request/manager/approve', null, { params: { token } }),
  reject: (token, response) => api.post('/email-actions/leave-request/reject', null, { params: { token, response } }),
  managerReject: (token, response) => api.post('/email-actions/leave-request/manager/reject', null, { params: { token, response } }),
  directToHr: (token) => api.post('/email-actions/leave-request/manager/direct-to-hr', null, { params: { token } }),
};

// Employee self-fill (onboarding form sent by HR)
export const validateEmployeeSelfFillToken = async (token) => {
  const response = await api.get(`/public/employee-self-fill/validate/${token}`);
  return response.data;
};

export const submitEmployeeSelfFill = async (token, formData, files = {}) => {
  const fd = new FormData();
  const { appointmentLetter, salarySlips, relivingLetter, experienceLetter, ...form } = formData;
  fd.append('form', new Blob([JSON.stringify(form)], { type: 'application/json' }));
  if (appointmentLetter) fd.append('appointmentLetter', appointmentLetter);
  if (salarySlips) fd.append('salarySlips', salarySlips);
  if (relivingLetter) fd.append('relivingLetter', relivingLetter);
  if (experienceLetter) fd.append('experienceLetter', experienceLetter);
  const response = await api.post(`/public/employee-self-fill/${token}/submit`, fd);
  return response.data;
};

// Leave Policy API
export const leavePolicyAPI = {
  // Admin endpoints
  uploadLeavePolicy: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/admin/leave-policy/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getLeavePolicy: () => api.get('/admin/leave-policy'),
  deleteLeavePolicy: () => api.delete('/admin/leave-policy'),

  // Employee endpoints
  getLeavePolicyForEmployee: () => api.get('/employee/leave-policy'),
  downloadLeavePolicy: () => api.get('/employee/leave-policy/download', {
    responseType: 'blob',
  }),
};

// Leave Request API calls
export const createLeaveRequest = async (requestData) => {
  const response = await api.post('/leave-requests', requestData);
  return response.data;
};

export const createLeaveRequestAsAdmin = async (requestData) => {
  const response = await api.post('/leave-requests/admin-as-employee', requestData);
  return response.data;
};

export const getEmployeeLeaveRequests = async () => {
  // Prefer /employee/leave-requests (PROFILE_VIEW only). Fallback to /leave-requests (LEAVE_SELF_VIEW).
  try {
    const response = await api.get('/employee/leave-requests');
    if (response.data?.leaveRequests) {
      return { leaveRequests: response.data.leaveRequests };
    }
    if (Array.isArray(response.data)) {
      return { leaveRequests: response.data };
    }
    return response.data || { leaveRequests: [] };
  } catch (error) {
    try {
      const fallbackResponse = await api.get('/leave-requests');
      if (fallbackResponse.data?.leaveRequests) {
        return { leaveRequests: fallbackResponse.data.leaveRequests };
      }
      if (Array.isArray(fallbackResponse.data)) {
        return { leaveRequests: fallbackResponse.data };
      }
      return fallbackResponse.data || { leaveRequests: [] };
    } catch (fallbackError) {
      console.error('Error fetching leave requests:', fallbackError);
      return { leaveRequests: [] };
    }
  }
};

export const getEmployeeLeaveRequestsAsAdmin = async () => {
  const response = await api.get('/leave-requests/admin-as-employee');
  return response.data;
};

export const getLeaveBalancesAsAdmin = async () => {
  const response = await api.get('/leave-requests/admin-as-employee/balances');
  return response.data;
};

export const getAllLeaveRequests = async () => {
  const response = await api.get('/leave-requests/admin/all');
  return response.data;
};

export const getPendingLeaveRequests = async () => {
  const response = await api.get('/leave-requests/admin/pending');
  return response.data;
};

export const getAcceptedLeaveRequests = async () => {
  const response = await api.get('/leave-requests/admin/accepted');
  return response.data;
};

export const getRejectedLeaveRequests = async () => {
  const response = await api.get('/leave-requests/admin/rejected');
  return response.data;
};

export const getLeaveAnalytics = async (year) => {
  const response = await api.get('/leave-requests/admin/analytics', { params: { year } });
  return response.data;
};

export const getLeaveRequestById = async (id) => {
  const response = await api.get(`/leave-requests/${id}`);
  return response.data;
};

export const checkPositionOverlap = async (id) => {
  const response = await api.get(`/leave-requests/${id}/check-overlap`);
  return response.data;
};

export const respondToLeaveRequest = async (id, data) => {
  const response = await api.post(`/leave-requests/${id}/respond`, data);
  return response.data;
};

export const getLeaveBalances = async () => {
  const response = await api.get('/leave-requests/balances');
  return response.data;
};

export const updateLeaveRequest = async (id, data) => {
  const response = await api.put(`/leave-requests/${id}`, data);
  return response.data;
};

export const cancelEmployeeLeaveRequest = async (id, reason) => {
  const response = await api.post(`/leave-requests/${id}/cancel`, null, {
    params: reason ? { reason } : {},
  });
  return response.data;
};

// Leave Balance Adjustment API
export const leaveBalanceAPI = {
  adjustBalance: (data) => api.post('/leave/adjust-balance', data),
  getBalance: (employeeId) => api.get(`/leave/balance/${employeeId}`),
  getAllAdjustments: () => api.get('/leave/adjustments'),
  getAdjustments: (employeeId) => api.get(`/leave/adjustments/${employeeId}`),
  importHistory: (formData) => api.post('/leave/import-history', formData),
};

// WFH (Work From Home) module - separate from leave
export const wfhAPI = {
  create: (data) => api.post('/wfh', data),
  getMyRequests: (startDate, endDate) => api.get('/wfh/employee', { params: { startDate, endDate } }),
  getManagerPending: () => api.get('/wfh/manager/pending'),
  getManagerHistory: (params) => api.get('/wfh/manager/history', { params }),
  getTeamOut: (date) => api.get('/wfh/team-out', date ? { params: { date } } : {}),
  getAll: (startDate, endDate) => api.get('/wfh/admin/all', { params: { startDate, endDate } }),
  getPending: () => api.get('/wfh/admin/pending'),
  getAccepted: (startDate, endDate) => api.get('/wfh/admin/accepted', { params: { startDate, endDate } }),
  getApprovedRequests: (startDate, endDate) => api.get('/wfh/admin/accepted', { params: { startDate, endDate } }),
  getRejected: () => api.get('/wfh/admin/rejected'),
  getById: (id) => api.get(`/wfh/${id}`),
  respond: (id, data) => api.post(`/wfh/${id}/respond`, data),
  cancel: (id) => api.post(`/wfh/${id}/cancel`),
  update: (id, data) => api.put(`/wfh/${id}`, data),
  getPolicy: () => api.get('/wfh/policy'),
  getAvailability: () => api.get('/wfh/availability'),
};
// Time Debug API
export const timeDebugAPI = {
  getServerTime: () => api.get('/time-debug/server-time'),
  getTimezoneInfo: () => api.get('/time-debug/timezone-info'),
};

// Auto Clockout API
export const autoClockoutAPI = {
  getStatus: () => api.get('/auto-clockout/status'),
  triggerCheck: () => api.post('/auto-clockout/trigger'),
  checkEmployee: (employeeId) => api.get(`/auto-clockout/check-employee/${employeeId}`),
  healthCheck: () => api.get('/auto-clockout/health'),
};

// Missed Work Status API
export const missedWorkStatusAPI = {
  getCandidates: () => api.get('/missed-work-status/candidates'),
  getByDate: (date) => api.get('/missed-work-status/by-date', { params: { date } }),
  trigger: () => api.post('/missed-work-status/trigger'),
  health: () => api.get('/missed-work-status/health'),
};

// Late Clockin API
export const lateClockinAPI = {
  getStatus: () => api.get('/late-clockin/status'),
  checkEmployee: (employeeId) => api.get(`/late-clockin/check/${employeeId}`),
  triggerCheck: () => api.post('/late-clockin/trigger-check'),
  healthCheck: () => api.get('/late-clockin/health'),
};

// Complaint API
export const complaintAPI = {
  // Employee endpoints
  createComplaint: (data) => api.post('/complaints/employee', data),
  getMyComplaints: () => api.get('/complaints/employee'),
  getMyComplaintById: (complaintId) => api.get(`/complaints/employee/${complaintId}`),

  // Admin endpoints
  getAllComplaints: () => api.get('/complaints/admin/all'),
  getPendingComplaints: () => api.get('/complaints/admin/pending'),
  getUrgentComplaints: () => api.get('/complaints/admin/urgent'),
  getComplaintsByStatus: (status) => api.get(`/complaints/admin/status/${status}`),
  getComplaintById: (complaintId) => api.get(`/complaints/admin/${complaintId}`),
  respondToComplaint: (complaintId, data) => api.post(`/complaints/admin/${complaintId}/respond`, data),
  getComplaintStatistics: () => api.get('/complaints/admin/statistics'),


};

// Notification API
export const notificationAPI = {
  getMyNotifications: (unreadOnly = false) =>
    api.get('/notifications/me', { params: { unreadOnly } }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (notificationId) => api.put(`/notifications/${notificationId}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
};

// Notice API
export const noticeAPI = {
  // Employee endpoints
  getActiveNotices: () => api.get('/notices/employee'),
  getNoticeById: (noticeId) => api.get(`/notices/employee/${noticeId}`),

  // Admin endpoints
  createNotice: (data) => api.post('/notices/admin', data),
  getAllNotices: () => api.get('/notices/admin/all'),
  getAdminNoticeById: (noticeId) => api.get(`/notices/admin/${noticeId}`),
  updateNotice: (noticeId, data) => api.put(`/notices/admin/${noticeId}`, data),
  deleteNotice: (noticeId) => api.delete(`/notices/admin/${noticeId}`),
  togglePinNotice: (noticeId) => api.post(`/notices/admin/${noticeId}/toggle-pin`),
  toggleActiveNotice: (noticeId) => api.post(`/notices/admin/${noticeId}/toggle-active`),
  getNoticesByCategory: (category) => api.get(`/notices/admin/category/${category}`),
  getNoticesByPriority: (priority) => api.get(`/notices/admin/priority/${priority}`),
  getPinnedNotices: () => api.get('/notices/admin/pinned'),
  getUrgentNotices: () => api.get('/notices/admin/urgent'),
  getNoticeStatistics: () => api.get('/notices/admin/statistics'),


};

// Document API
export const documentAPI = {
  // Employee endpoints
  uploadDocument: (documentType, file) => {
    const formData = new FormData();
    formData.append('documentType', documentType);
    formData.append('file', file);
    return api.post('/documents/employee/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getMyDocuments: () => api.get('/documents/employee'),
  getMyDocumentById: (documentId) => api.get(`/documents/employee/${documentId}`),
  downloadMyDocument: (documentId) => api.get(`/documents/employee/${documentId}/download`, {
    responseType: 'blob',
  }),
  deleteMyDocument: (documentId) => api.delete(`/documents/employee/${documentId}`),

  // Admin endpoints
  getAllDocuments: () => api.get('/documents/admin/all'),
  getUnverifiedDocuments: () => api.get('/documents/admin/unverified'),
  getDocumentsByType: (documentType) => api.get(`/documents/admin/type/${documentType}`),
  getDocumentsByVerificationStatus: (isVerified) => api.get(`/documents/admin/verification/${isVerified}`),
  getDocumentById: (documentId) => api.get(`/documents/admin/${documentId}`),
  downloadDocument: (documentId) => api.get(`/documents/admin/${documentId}/download`, {
    responseType: 'blob',
  }),
  previewDocument: (documentId) => api.get(`/documents/admin/${documentId}/preview`, {
    responseType: 'blob',
  }),
  verifyDocument: (documentId, data) => api.post(`/documents/admin/${documentId}/verify`, data),
  getDocumentStatistics: () => api.get('/documents/admin/statistics'),
  getEmployeeDocuments: (employeeId) => api.get(`/documents/admin/employee/${employeeId}`),
  uploadEmployeeDocument: (employeeId, documentType, file) => {
    const formData = new FormData();
    formData.append('documentType', documentType);
    formData.append('file', file);
    return api.post(`/documents/admin/employee/${employeeId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  deleteEmployeeDocument: (employeeId, documentId) => api.delete(`/documents/admin/employee/${employeeId}/${documentId}`),
};

// Achievement API
export const achievementAPI = {
  // Employee endpoints
  submitAchievement: async (data) => {
    const response = await api.post('/achievements/employee/submit', data);
    return response.data;
  },
  getMyAchievements: async () => {
    const response = await api.get('/achievements/employee/my-achievements');
    return response.data;
  },
  getMyAchievementById: async (achievementId) => {
    const response = await api.get(`/achievements/employee/my-achievements/${achievementId}`);
    return response.data;
  },
  checkSubmission: async (monthYear) => {
    const response = await api.get('/achievements/employee/check-submission', { params: { monthYear } });
    return response.data;
  },

  // Admin endpoints
  getAllAchievements: async () => {
    const response = await api.get('/achievements/admin/all');
    return response.data;
  },
  getAchievementsByMonth: async (monthYear) => {
    const response = await api.get('/achievements/admin/by-month', { params: { monthYear } });
    return response.data;
  },
  getAchievementsByStatus: async (status) => {
    const response = await api.get('/achievements/admin/by-status', { params: { status } });
    return response.data;
  },
  getAchievementById: async (achievementId) => {
    const response = await api.get(`/achievements/admin/${achievementId}`);
    return response.data;
  },
  reviewAchievement: async (achievementId, data) => {
    const response = await api.post(`/achievements/admin/${achievementId}/review`, data);
    return response.data;
  },
  getPendingAchievements: async () => {
    const response = await api.get('/achievements/admin/pending');
    return response.data;
  },
  getApprovedAchievements: async () => {
    const response = await api.get('/achievements/admin/approved');
    return response.data;
  },



};



// Employee of the Quarter API
export const employeeOfQuarterAPI = {
  // Employee endpoints
  getCurrentEmployeeOfTheQuarter: async () => {
    // Mark this request to suppress 404 logging
    const requestConfig = {
      validateStatus: (status) => {
        // Treat 404 and 204 as success (no current employee is expected)
        // This prevents axios from throwing an error for 404
        return status === 200 || status === 204 || status === 404;
      },
      // Add a custom property to identify this request
      _suppress404Log: true
    };

    try {
      const response = await api.get('/employee-of-quarter/current', requestConfig);

      // If 404 or 204, return null (no current employee selected)
      if (response.status === 404 || response.status === 204) {
        return null;
      }
      return response.data || null;
    } catch (error) {
      // Fallback: if it's still a 404, return null (expected behavior)
      // This should not happen if validateStatus is working correctly
      if (error.response?.status === 404 || error.response?.status === 204) {
        return null;
      }
      // Only log non-404 errors
      console.error('Error fetching current employee of the quarter:', error);
      throw error;
    }
  },
  getAllEmployeesOfTheQuarter: async () => {
    const response = await api.get('/employee-of-quarter/all');
    return response.data;
  },
  getHistoricalEmployeesOfTheQuarter: async () => {
    const response = await api.get('/employee-of-quarter/historical');
    return response.data;
  },
  getEmployeeOfTheQuarterByQuarter: async (quarterYear) => {
    const response = await api.get(`/employee-of-quarter/quarter/${quarterYear}`);
    return response.data;
  },
  getEmployeesOfTheQuarterByEmployeeId: async (employeeId) => {
    const response = await api.get(`/employee-of-quarter/employee/${employeeId}`);
    return response.data;
  },

  // Admin endpoints
  selectEmployeeOfTheQuarter: async (data) => {
    const response = await api.post('/employee-of-quarter/select', data);
    return response.data;
  },
  getEmployeeOfTheQuarterById: async (id) => {
    const response = await api.get(`/employee-of-quarter/${id}`);
    return response.data;
  },
  updateEmployeeOfTheQuarter: async (id, data) => {
    const response = await api.put(`/employee-of-quarter/${id}`, data);
    return response.data;
  },
  deactivateEmployeeOfTheQuarter: async (id) => {
    const response = await api.delete(`/employee-of-quarter/${id}`);
    return response.data;
  },
};



// Quiz Question API
export const quizQuestionAPI = {
  // Admin endpoints
  importQuestionsFromCSV: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/quiz-questions/import-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getAllQuestions: () => api.get('/quiz-questions/admin/all'),
  getQuestionsByDifficulty: (difficulty) => api.get(`/quiz-questions/admin/difficulty/${difficulty}`),
  getQuestionsByCategory: (category) => api.get(`/quiz-questions/admin/category/${category}`),
  getQuestionById: (id) => api.get(`/quiz-questions/admin/${id}`),
  createQuestion: (questionData) => api.post('/quiz-questions/admin', questionData),
  updateQuestion: (id, questionData) => api.put(`/quiz-questions/admin/${id}`, questionData),
  deleteQuestion: (id) => api.delete(`/quiz-questions/admin/${id}`),
  toggleQuestionStatus: (id) => api.patch(`/quiz-questions/admin/${id}/toggle`),
  getQuestionCountByDifficulty: (difficulty) => api.get(`/quiz-questions/admin/stats/difficulty/${difficulty}`),
  getQuestionCountByCategory: (category) => api.get(`/quiz-questions/admin/stats/category/${category}`),
  getAllCategories: () => api.get('/quiz-questions/admin/categories'),
  seedDefaultQuestions: (force = false) =>
    api.post(`/quiz-questions/admin/seed-defaults?force=${force}`),

  // Employee endpoints
  getRandomQuestionsByDifficulty: (difficulty, count = 5) => api.get(`/quiz-questions/random/${difficulty}?count=${count}`),
  getRandomQuestionsByDifficultyAndCategory: (difficulty, category, count = 5) => api.get(`/quiz-questions/random/${difficulty}/${category}?count=${count}`),
};

// Quiz CSV File API (Admin manages files, not individual questions)
export const quizCSVFileAPI = {
  upload: (file, uploadedBy) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadedBy', uploadedBy);
    return api.post('/quiz-csv-files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getAll: () => api.get('/quiz-csv-files/all'),
  getById: (id) => api.get(`/quiz-csv-files/${id}`),
  delete: (id) => api.delete(`/quiz-csv-files/${id}`),
  toggle: (id) => api.patch(`/quiz-csv-files/${id}/toggle`),
  getStats: (id) => api.get(`/quiz-csv-files/${id}/stats`),
  getByStatus: (status) => api.get(`/quiz-csv-files/status/${status}`),
  getByUser: (username) => api.get(`/quiz-csv-files/user/${username}`),
  getDashboardStats: () => api.get('/quiz-csv-files/dashboard/stats'),
  getQuestions: (id) => api.get(`/quiz-csv-files/${id}/questions`),
};

// Realtime Quiz API
export const realtimeQuizAPI = {
  // Admin endpoints
  upload: (file, uploadedBy) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadedBy', uploadedBy);
    return api.post('/realtime-quiz/admin/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getAllFiles: () => api.get('/realtime-quiz/admin/files'),
  toggleFile: (fileId) => api.patch(`/realtime-quiz/admin/files/${fileId}/toggle`),
  deleteFile: (fileId) => api.delete(`/realtime-quiz/admin/files/${fileId}`),
  getQuestionsForFile: (fileId) => api.get(`/realtime-quiz/admin/files/${fileId}/questions`),

  // Employee endpoints
  getRandomQuestions: (count = 5) => api.get(`/realtime-quiz/employee/random?count=${count}`),
};

// Game Score API
export const gameScoreAPI = {
  submitScore: (scoreData) => api.post('/game-scores/submit', scoreData),
  getLeaderboardByGame: (gameId) => api.get(`/game-scores/leaderboard/game/${gameId}`),
  getLeaderboardByGameAndDifficulty: (gameId, difficulty) => api.get(`/game-scores/leaderboard/game/${gameId}/difficulty/${difficulty}`),
  getEmployeeScores: (employeeId) => api.get(`/game-scores/employee/${employeeId}`),
  getGlobalLeaderboard: () => api.get('/game-scores/leaderboard/global'),
  getGlobalLeaderboardByDifficulty: (difficulty) => api.get(`/game-scores/leaderboard/global/difficulty/${difficulty}`),
  getTopScoresByDateRange: (startDate, endDate) => api.get('/game-scores/top-scores', { params: { startDate, endDate } }),
  getTopScoresByGameAndDateRange: (gameId, startDate, endDate) => api.get(`/game-scores/top-scores/game/${gameId}`, { params: { startDate, endDate } }),
  getEmployeeBestScore: (employeeId, gameId) => api.get(`/game-scores/employee/${employeeId}/best/game/${gameId}`),
  getRecentScoresByEmployee: (employeeId, limit = 10) => api.get(`/game-scores/employee/${employeeId}/recent`, { params: { limit } }),
  deleteScore: (scoreId) => api.delete(`/game-scores/${scoreId}`),
};

// Knowledge Base API
export const knowledgeAPI = {
  getPosts: () => api.get('/knowledge/posts'),
  getPostsByAuthor: (employeeId) => api.get(`/knowledge/posts/author/${employeeId}`),
  createPost: (data) => api.post('/knowledge/posts', data),
  likePost: (postId, employeeId) => api.post(`/knowledge/posts/${postId}/like`, null, { params: { employeeId } }),
  unlikePost: (postId, employeeId) => api.post(`/knowledge/posts/${postId}/unlike`, null, { params: { employeeId } }),
};

// Feature Access APIs
export const featureAPI = {
  getAccess: (tenantId = null) => api.get('/features/access', { headers: tenantId ? { 'X-Tenant-ID': tenantId } : {} }),
  check: (feature) => api.get(`/features/check/${feature}`),
  getAll: () => api.get('/features/all'),
  getTrialRestricted: () => api.get('/features/trial-restricted'),
  getAvailable: () => api.get('/features/available'),
};

// PMS API
export const pmsAPI = {
  // KRA Types (Dynamic)
  createKraType: (kratypeName, description, createdBy = null) =>
    api.post('/pms/kra/types', null, { params: { kratypeName, description, createdBy } }),
  getKraTypes: () => api.get('/pms/kra/types'),
  getKraMasters: () => api.get('/pms/kra/master'), // Returns only position-based KRAs (legacy)
  // KRA Analytics
  getAllEmployeesKraPerformance: (kraTypeId, positionId, departmentId) =>
    api.get('/pms/kra/analytics/all-employees', {
      params: {
        ...(kraTypeId && { kraTypeId }),
        ...(positionId && { positionId }),
        ...(departmentId && { departmentId })
      }
    }),

  // KRA Header/Detail (New System)
  createOrUpdateKraHeader: (requestBody) => api.post('/pms/kra/header', requestBody),
  getKraHeaderByPositionAndType: (positionId, kraTypeId) =>
    api.get(`/pms/kra/header/position/${positionId}/type/${kraTypeId}`),
  getKraHeadersByPosition: (positionId) => api.get(`/pms/kra/header/position/${positionId}`),
  getAllKraHeaders: () => api.get('/pms/kra/headers'),
  assignKra: (kraMasterId, employeeId, assignedByEmployeeId = null) =>
    api.post('/pms/kra/assign', null, { params: { kraMasterId, employeeId, assignedByEmployeeId } }),
  assignKrasFromHeader: (kraHeaderId, employeeId, assignedByEmployeeId = null) =>
    api.post(`/pms/kra/header/${kraHeaderId}/assign`, null, { params: { employeeId, assignedByEmployeeId } }),
  getEmployeeAssignments: (employeeId) => api.get(`/pms/kra/employee/${employeeId}/assignments`),
  getEmployeeKraProgress: (employeeId) => api.get(`/pms/kra/employee/${employeeId}/kra-progress`),
  updateEmployeeKraProgress: (requestBody) => api.put('/pms/kra/employee/kra/update-progress', requestBody),
  getEmployeeKraProgressHistory: (progressId) => api.get(`/pms/kra/employee/kra-progress/${progressId}/history`),
  // Simplified KRA Progress APIs
  getEmployeeKraList: () => api.get('/pms/kra/employee/kra/list'),
  updateKraProgress: (employeeKraId, requestBody) => api.put(`/pms/kra/employee/kra/update-progress/${employeeKraId}`, requestBody),
  getKraProgressHistory: (employeeKraId) => api.get(`/pms/kra/employee/kra/history/${employeeKraId}`),
  getOverallKraProgress: () => api.get('/pms/kra/employee/kra/overall-progress'),

  // New Employee KRA Progress APIs (as per requirements)
  getMyKras: () => api.get('/pms/kra/my'),
  updateEmployeeProgress: (requestBody) => api.post('/pms/kra/progress/update', requestBody),
  reviewEmployeeProgress: (requestBody) => api.post('/pms/kra/progress/review', requestBody),
  deleteKraAssignment: (assignmentId) => api.delete(`/pms/kra/assignment/${assignmentId}`),
  getTenantAssignments: () => api.get('/pms/kra/assignments'),
  getTenantAssignmentsCount: () => api.get('/pms/kra/assignments/count'),
  recordKraProgress: (assignmentId, progressPercent, notes = '') =>
    api.post('/pms/kra/progress', null, { params: { assignmentId, progressPercent, notes } }),

  // Position-based KRA
  createPositionKra: (positionId, definition, keyResultArea, weightage, comments, kraTypeId, frequency) =>
    api.post(`/pms/kra/position/${positionId}/kra`, null, { params: { definition, keyResultArea, weightage, comments, kraTypeId, frequency } }),
  createPositionKraTemplate: (positionId, requestBody) =>
    api.post(`/pms/kra/position/${positionId}/template`, requestBody),
  getKrasForPosition: (positionId) => api.get(`/pms/kra/position/${positionId}`),
  getKrasForEmployeePosition: (employeeId) => api.get(`/pms/kra/employee/${employeeId}/position-kras`),
  autoAssignKrasForEmployee: (employeeId, assignedByEmployeeId = null) =>
    api.post(`/pms/kra/employee/${employeeId}/auto-assign`, null, { params: { assignedByEmployeeId } }),

  // Meetings
  getMeetings: () => api.get('/pms/meetings'),
  scheduleMeeting: ({ title, agenda, startsAt, occurrence, participantEmployeeIds = [], organizerEmployeeId = null }) =>
    api.post('/pms/meetings', { title, agenda, startsAt, occurrence, participantEmployeeIds, organizerEmployeeId }),
  addActionItem: (meetingId, description, assigneeEmployeeId = null, dueDate = null) =>
    api.post(`/pms/meetings/${meetingId}/action-items`, null, { params: { description, assigneeEmployeeId, dueDate } }),

  // Feedback
  getFeedback: (employeeId = null) => employeeId ? api.get(`/pms/feedback?employeeId=${employeeId}`) : api.get('/pms/feedback'),
  createFeedback: ({ type, comments, rating, createdByAdminId = null, createdByEmployeeId = null, employeeId }) =>
    api.post('/pms/feedback', null, { params: { type, comments, rating, createdByAdminId, createdByEmployeeId, employeeId } }),

  // PIP
  getPips: (employeeId = null) => employeeId ? api.get(`/pms/pip?employeeId=${employeeId}`) : api.get('/pms/pip'),
  createPip: ({ employeeId, objectives, durationDays, startDate, endDate }) =>
    api.post('/pms/pip', null, { params: { employeeId, objectives, durationDays, startDate, endDate } }),
  updatePipProgress: (pipId, progressPercent, managerNotes = null, acknowledged = null) =>
    api.post(`/pms/pip/${pipId}/progress`, null, { params: { progressPercent, managerNotes, acknowledged } }),

  // Reviews
  getAppraisals: () => api.get('/pms/reviews/appraisals'),
  getReviews: (employeeId = null) => employeeId ? api.get(`/pms/reviews?employeeId=${employeeId}`) : api.get('/pms/reviews'),
  createAppraisal: ({ type, year, quarter = null, status = null }) =>
    api.post('/pms/reviews/appraisals', null, { params: { type, year, quarter, status } }),
  createReview: ({ appraisalId, employeeId, averageRating = null, comments = null, submittedByRole = null }) =>
    api.post('/pms/reviews', null, { params: { appraisalId, employeeId, averageRating, comments, submittedByRole } }),
  uploadReviewDocument: ({ reviewId, fileName, filePath, uploadedByEmployeeId = null }) =>
    api.post(`/pms/reviews/${reviewId}/documents`, null, { params: { fileName, filePath, uploadedByEmployeeId } }),
};

// Review Cycle API (New PMS Review Module)
export const reviewAPI = {
  // Create review (HR only)
  createReview: (data) => api.post('/review/create', data),
  // Release review (HR only)
  releaseReview: (reviewId) => api.post(`/review/release/${reviewId}`),
  // Release reviews in bulk (HR only)
  releaseReviews: (data) => api.post('/reviews/release', data),
  // Get review details
  getReviewDetails: (reviewId) => api.get(`/review/${reviewId}/details`),
  // Submit self-rating (Employee)
  submitSelfRating: (data) => api.post('/review/self-rating/submit', data),
  // Submit manager rating (Manager)
  submitManagerRating: (data) => api.post('/review/manager-rating/submit', data),
  // Finalize review (HR only)
  finalizeReview: (reviewId) => api.post(`/review/hr/finalize/${reviewId}`),
  // Delete review (HR only, draft only)
  deleteReview: (reviewId) => api.delete(`/review/${reviewId}`),
  // Get all reviews for an employee
  getEmployeeReviews: (employeeId) => api.get(`/review/employee/${employeeId}`),
  // Get all reviews (HR only)
  getAllReviews: () => api.get('/review/all'),
  // Get current user's reviews
  getMyReviews: () => api.get('/review/my'),
  // Get manager reviews (Manager - reviews where user is assigned as manager)
  getManagerReviews: () => api.get('/review/manager'),
  // Meeting endpoints
  scheduleMeeting: (data) => api.post('/review/meeting/schedule', data, { timeout: 60000 }), // 60 seconds for OAuth flow
  updateMeeting: (meetingId, data) => api.put(`/review/meeting/${meetingId}`, data),
  completeMeeting: (meetingId, data) => api.post(`/review/meeting/${meetingId}/complete`, data),
  completeMyMeeting: (meetingId) => api.post(`/review/meeting/${meetingId}/complete-my`),
  deleteMeeting: (meetingId) => api.delete(`/review/meeting/${meetingId}`),
  submitMeetingFeedback: (data) => api.post('/review/meeting/feedback', data),
  submitMyMeetingFeedback: (meetingId, feedback) => api.post(`/review/meeting/${meetingId}/submit-feedback`, { meetingId, feedback }),
  getMeetingDetails: (meetingId) => api.get(`/review/meeting/${meetingId}`),
  getMeetingByReviewId: (reviewId) => api.get(`/review/${reviewId}/meeting`),
  // Skip meeting even if none is scheduled
  skipMeeting: (reviewId) => api.post(`/review/${reviewId}/meeting/skip`),
};

// KRA Template API (Dynamic Questions & Employee Answers)
export const kraTemplateAPI = {
  // Create KRA template with questions
  createKraTemplate: (data) => api.post('/pms/kra-template', data),
  // Update KRA template
  updateKraTemplate: (templateId, data) => api.put(`/pms/kra-template/${templateId}`, data),
  // Get all KRA templates (optionally filtered)
  getKraTemplates: (positionId = null, kraTypeId = null) => {
    const params = {};
    if (positionId) params.positionId = positionId;
    if (kraTypeId) params.kraTypeId = kraTypeId;
    return api.get('/pms/kra-template', { params });
  },
  // Get single KRA template
  getKraTemplate: (templateId) => api.get(`/pms/kra-template/${templateId}`),
  // Delete KRA template
  deleteKraTemplate: (templateId) => api.delete(`/pms/kra-template/${templateId}`),
  // Get Employee Review KRAs for a review
  getEmployeeReviewKras: (reviewId) => api.get(`/pms/kra-template/review/${reviewId}`),
  // Upgrade a review from legacy to template-based
  upgradeReviewToTemplates: (reviewId) => api.post(`/pms/kra-template/review/${reviewId}/upgrade`),
  // Submit self-rating with answers (Employee)
  submitSelfRatingWithAnswers: (data) => api.post('/pms/kra-template/self-rating/submit', data),
  // Submit manager rating with comments (Manager)
  submitManagerRatingWithComments: (data) => api.post('/pms/kra-template/manager-rating/submit', data),
  // Submit HR comments (HR/Admin)
  submitHrComments: (data) => api.post('/pms/kra-template/hr-comments/submit', data),
};

// Team API - Dedicated APIs for Team Portal
export const teamAPI = {
  // Team Overview - Get team members (subordinates)
  getTeamOverview: (managerId) => {
    return api.get(`/reporting/subordinates/${managerId}`);
  },

  // Leave Limits - Uses public endpoint accessible by managers
  getLeaveLimits: () => api.get('/public/system-settings/manager-leave-limits'),

  // Team Attendance
  getTeamAttendance: (managerId, date) => {
    const params = { managerId };
    if (date) params.date = date;
    return api.get('/reporting/team-attendance', { params });
  },

  // Leave Approvals
  getPendingLeaveRequests: (managerId) => {
    if (managerId) {
      return api.get(`/manager/leave-requests/pending/${managerId}`);
    }
    // Fallback to unified endpoint if no managerId
    return api.get('/leave-requests/pending');
  },
  getTeamLeaveRequests: (managerIdOrUsername) => {
    // Check if it's a numeric ID or string username
    const isNumeric = /^\d+$/.test(String(managerIdOrUsername));
    if (isNumeric) {
      // Use numeric ID endpoint
      return api.get(`/manager/leave-requests/team/${managerIdOrUsername}`);
    } else {
      // Use username endpoint for string employeeId
      return api.get(`/manager/leave-requests/team/username/${managerIdOrUsername}`);
    }
  },
  // Dedicated team-out: returns team leave for Who's Out (same for RM and teammates; does not depend on scope)
  getTeamLeaveForWhosOut: () => api.get('/leave-requests/team-out'),
  // Expense Approvals (Manager)
  getTeamExpenses: (managerIdOrParams, maybeMonth) => {
    let params = {};
    if (managerIdOrParams && typeof managerIdOrParams === 'object') {
      params = { ...managerIdOrParams };
    } else {
      if (managerIdOrParams) params.managerId = managerIdOrParams;
      if (maybeMonth) params.month = maybeMonth;
    }
    return api.get('/manager/expenses', Object.keys(params).length ? { params } : {});
  },
  approveTeamExpense: (expenseId) => api.patch(`/manager/expenses/${expenseId}/approve`),
  rejectTeamExpense: (expenseId, rejectionReason) =>
    api.patch(`/manager/expenses/${expenseId}/reject`, { rejectionReason: rejectionReason || '' }),
  approveLeaveRequest: (requestId, managerId, response) => {
    const params = managerId ? { managerId } : {};
    if (response) params.response = response;
    return api.post(`/manager/leave-requests/approve/${requestId}`, null, { params });
  },
  rejectLeaveRequest: (requestId, managerId, response) => {
    const params = managerId ? { managerId } : {};
    if (response) params.response = response;
    return api.post(`/manager/leave-requests/reject/${requestId}`, null, { params });
  },
  directLeaveRequestToHr: (requestId, managerId, response) => {
    const params = managerId ? { managerId } : {};
    if (response) params.response = response;
    return api.post(`/manager/leave-requests/direct-to-hr/${requestId}`, null, { params });
  },
  cancelLeaveRequest: (requestId, managerId, reason) => {
    const params = managerId ? { managerId } : {};
    if (reason) params.reason = reason;
    return api.post(`/manager/leave-requests/cancel/${requestId}`, null, { params });
  },
  getLeaveRequestDetails: (requestId) => {
    return api.get(`/manager/leave-requests/${requestId}`);
  },

  // Timesheet Approvals
  getTeamTimesheets: (week, startDate, endDate) => {
    const params = {};
    if (week) params.week = week;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return api.get('/manager/timesheets', { params });
  },
  getAdminTeamTimesheets: (week, startDate, endDate) => {
    const params = {};
    if (week) params.week = week;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return api.get('/admin/timesheets', { params });
  },
  getTeamTimesheetOverview: (startDate, endDate, scope) => {
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (scope) params.scope = scope;
    return api.get('/manager/timesheets/overview', { params });
  },
  approveTimesheet: (timesheetId, approvalRequest) => {
    return api.post(`/manager/timesheets/${timesheetId}/approve`, approvalRequest || {});
  },
  rejectTimesheet: (timesheetId, approvalRequest) => {
    return api.post(`/manager/timesheets/${timesheetId}/reject`, approvalRequest || {});
  },
  approveTimesheetEntry: (timesheetId, entryId, approvalRequest) => {
    return api.post(`/timesheets/${timesheetId}/entries/${entryId}/approve`, approvalRequest || {});
  },
  rejectTimesheetEntry: (timesheetId, entryId, approvalRequest) => {
    return api.post(`/timesheets/${timesheetId}/entries/${entryId}/reject`, approvalRequest || {});
  },
  holdTimesheet: (timesheetId, comment) => {
    return api.post(`/timesheets/${timesheetId}/hold`, { comment });
  },

  // Admin-specific APIs for Team Portal
  // Team Overview - Admin: Get employees with no manager and HR employees
  getAdminTeamOverview: () => {
    // Get unassigned employees (no reporting manager)
    return api.get('/reporting/reporting-management/unassigned-employees', { params: { page: 0, size: 1000 } });
  },

  // Team Attendance - Admin: Get all attendance
  getAdminTeamAttendance: (date) => {
    const params = {};
    if (date) {
      // Get attendance for date range (today)
      const startDate = date;
      const endDate = date;
      params.startDate = startDate;
      params.endDate = endDate;
      return api.get('/attendance/range', { params });
    }
    return api.get('/attendance/range', { params: { startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] } });
  },

  // Leave Approvals - Admin: Get all pending leave requests
  getAdminTeamLeaveRequests: () => {
    // Use unified endpoint with status parameter (handles scope automatically)
    return api.get('/leave-requests', { params: { status: 'PENDING' } });
  },
  // Get pending leave request approvals for admin (employees with no reporting manager only)
  getAdminPendingLeaveApprovals: () => {
    return api.get('/leave-requests/admin/pending-approvals');
  },
  approveAdminLeaveRequest: (requestId, response) => {
    return api.post(`/leave-requests/${requestId}/respond`, {
      status: 'APPROVED',
      response: response || 'Approved by Admin'
    });
  },
  rejectAdminLeaveRequest: (requestId, response) => {
    return api.post(`/leave-requests/${requestId}/respond`, {
      status: 'REJECTED',
      response: response || 'Rejected by Admin'
    });
  },

  // Timesheet Approvals - Admin: Get all timesheets
  getAdminTeamTimesheets: (week, startDate, endDate) => {
    const params = {};
    if (week) params.week = week;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return api.get('/admin/timesheets', { params });
  },
  // Get pending timesheet approvals for admin (employees with no reporting manager only)
  getAdminPendingTimesheets: () => {
    return api.get('/admin/timesheets/pending');
  },
  approveAdminTimesheet: (timesheetId, approvalRequest) => {
    return api.post(`/timesheets/${timesheetId}/approve`, approvalRequest || {});
  },
  rejectAdminTimesheet: (timesheetId, approvalRequest) => {
    return api.post(`/timesheets/${timesheetId}/reject`, approvalRequest || {});
  },
  approveAdminTimesheetEntry: (timesheetId, entryId, approvalRequest) => {
    return api.post(`/timesheets/${timesheetId}/entries/${entryId}/approve`, approvalRequest || {});
  },
  rejectAdminTimesheetEntry: (timesheetId, entryId, approvalRequest) => {
    return api.post(`/timesheets/${timesheetId}/entries/${entryId}/reject`, approvalRequest || {});
  },
  holdAdminTimesheet: (timesheetId, comment) => {
    return api.post(`/timesheets/${timesheetId}/hold`, { comment });
  }
};

export default api;

// Manager Analytics API – dedicated endpoints for manager's reportees data
export const managerAnalyticsAPI = {
  getOverview: () => api.get('/manager-analytics/overview', { timeout: 30000 }),
  getTeamAttendance: (startDate, endDate) =>
    api.get('/manager-analytics/attendance', { params: { startDate, endDate } }),
  getOrgAttendance: (startDate, endDate) =>
    api.get('/manager-analytics/org-attendance', { params: { startDate, endDate } }),
  getTeamTimesheets: (startDate, endDate, billable, page = 0, size = 25, search = '') => {
    const params = { startDate, endDate, page, size };
    if (billable && billable !== 'ALL') params.billable = billable;
    if (search) params.search = search;
    return api.get('/manager-analytics/timesheets', { params });
  },
  getTeamLeaves: (year, status) => {
    const params = {};
    if (year) params.year = year;
    if (status) params.status = status;
    return api.get('/manager-analytics/leaves', { params });
  },
  triggerWorksheetSummary: (startDate, endDate) => {
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return api.post('/ai/worksheet-summary', null, { params });
  },
  getWorksheetSummaryStatus: (auditId) =>
    api.get(`/ai/worksheet-summary/status/${auditId}`),
  approveLeaveRequest: (requestId, managerId, response) => {
    const params = managerId ? { managerId } : {};
    if (response) params.response = response;
    return api.post(`/manager/leave-requests/approve/${requestId}`, null, { params });
  },
  rejectLeaveRequest: (requestId, managerId, response) => {
    const params = managerId ? { managerId } : {};
    if (response) params.response = response;
    return api.post(`/manager/leave-requests/reject/${requestId}`, null, { params });
  },
  cancelLeaveRequest: (requestId, managerId, reason) => {
    const params = managerId ? { managerId } : {};
    if (reason) params.reason = reason;
    return api.post(`/manager/leave-requests/cancel/${requestId}`, null, { params });
  },
};

// Super Admin APIs
export const superAdminAuthAPI = {
  login: (credentials) => api.post('/super-admin/auth/login', credentials),
  register: (data) => api.post('/super-admin/auth/register', data),
};

export const superAdminAPI = {
  getDashboard: () => api.get('/super-admin/dashboard'),
  getTenants: (page = 0, size = 10) => api.get(`/super-admin/tenants?page=${page}&size=${size}`),
  updateTenantStatus: (id, active) => api.put(`/super-admin/tenants/${id}/status?active=${active}`),
  deleteTenant: (id) => api.delete(`/super-admin/tenants/${id}`),
  extendTrial: (id, newEnd) => api.put(`/super-admin/tenants/${id}/trial?newEnd=${encodeURIComponent(newEnd)}`),
  extendSubscription: (id, additionalDays) => api.post(`/super-admin/tenants/${id}/subscription/extend?additionalDays=${additionalDays}`),
  extendSubscriptionToDate: (id, endDate) => api.post(`/super-admin/tenants/${id}/subscription/extend-to-date?endDate=${encodeURIComponent(endDate)}`),
  suspendTenant: (id) => api.put(`/super-admin/tenants/${id}/suspend`),
  getTenantMetrics: (id) => api.get(`/super-admin/tenants/${id}/metrics`),

  // Subscription Plans
  getPlans: () => api.get('/super-admin/plans'),
  createPlan: (planData) => api.post('/super-admin/plans', planData),
  updatePlan: (planId, planData) => api.put(`/super-admin/plans/${planId}`, planData),
  deletePlan: (planId) => api.delete(`/super-admin/plans/${planId}`),
  togglePlanStatus: (planId) => api.put(`/super-admin/plans/${planId}/toggle-status`),

  // Billing & Transactions
  getTransactions: () => api.get('/super-admin/billing/transactions?page=0&size=100'),
  getBillingStats: () => api.get('/super-admin/billing/stats'),
  getTenantFeatures: (tenantId) => api.get(`/super-admin/billing/tenant-features/${tenantId}`),

  // Analytics
  getAnalytics: (timeRange = '30d') => api.get(`/super-admin/analytics?timeRange=${timeRange}`),
};

// Super-admin marketing endpoints
superAdminAPI.getDemoRequests = () => api.get('/super-admin/marketing/demo-requests');
superAdminAPI.getDemoRequestById = (id) => api.get(`/super-admin/marketing/demo-requests/${id}`);

// Public Signup APIs
export const publicSignupAPI = {
  signup: (email) => api.post('/public/signup', { email }),
  sendOtp: (email) => api.post('/public/send-otp', { email }),
  verifyOtp: (email, code) => api.post('/public/verify-otp', { email, code }),
  domainAvailability: (domain) => api.get(`/public/domain-availability?domain=${encodeURIComponent(domain)}`),
  tenantRegister: (payload, tempToken) => api.post('/public/tenant-register', payload, {
    headers: tempToken ? { 'X-PreTenant-Token': tempToken } : {},
  }),
  checkEmailExists: (email) => api.get(`/public/check-email-exists?email=${encodeURIComponent(email)}`),
  searchOrganizations: (query) => api.get(`/public/search-organizations?query=${encodeURIComponent(query)}`),
  searchByEmployeeId: (employeeId) => api.get(`/public/search-by-employee-id?employeeId=${encodeURIComponent(employeeId)}`),
  messageAdmin: (domain, data) => api.post(`/public/organizations/message-admin?domain=${encodeURIComponent(domain)}`, data),
};

// Organization API
export const organizationAPI = {
  get: () => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get('/organization', config);
  },
  save: async (data, isMultipart = false) => {
    const tenantId = getTenantIdFromStorage();
    const isFormData = data instanceof FormData;
    const useMultipart = isMultipart || isFormData;

    const config = {
      ...(tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {})
    };

    if (useMultipart) {
      // For multipart/form-data, CRITICALLY remove Content-Type header
      // Axios will automatically set it with the boundary parameter for FormData
      if (!config.headers) {
        config.headers = {};
      }
      // Explicitly delete Content-Type to prevent axios from using default 'application/json'
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    } else {
      config.headers = {
        ...config.headers,
        'Content-Type': 'application/json'
      };
    }

    // For FormData, use transformRequest to ensure proper handling
    if (useMultipart && isFormData) {
      config.transformRequest = [(data, headers) => {
        // Remove any Content-Type header that might have been set
        delete headers['Content-Type'];
        delete headers['content-type'];
        // Return data as-is - axios will handle FormData correctly
        return data;
      }];
    }

    return api.put('/organization', data, config);
  },
  getMetrics: () => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get('/organization/metrics', config);
  },
  getSubscription: () => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get('/organization/subscription', config);
  },
  getDashboardMetrics: () => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get('/organization/dashboard-metrics', config);
  },
  getAvailablePlans: () => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.get('/public/system-settings/subscription-plans', config);
  },
  upgradePlan: (planId) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.post('/admin/subscription/upgrade', { planId }, config);
  },
  getRazorpayKey: () => {
    return api.get('/payment/key');
  },
  createRazorpayOrder: (planId) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    return api.post(`/payment/create-order?planId=${planId}&tenantId=${tenantId}`, {}, config);
  },
  verifyPayment: (paymentData) => {
    const tenantId = getTenantIdFromStorage();
    const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
    // Build query string for GET-style params in POST request
    const params = new URLSearchParams({
      razorpayOrderId: paymentData.razorpayOrderId,
      razorpayPaymentId: paymentData.razorpayPaymentId,
      razorpaySignature: paymentData.razorpaySignature,
      planId: paymentData.planId
    });
    if (tenantId) {
      params.append('tenantId', tenantId.toString());
    }
    return api.post(`/payment/verify?${params.toString()}`, null, config);
  },
};

// Exit Management API
export const exitAPI = {
  // Employee endpoints
  getMyNoticePeriod: () => api.get('/exit/notice-period'),
  applyResignation: (formData) => {
    return api.post('/exit/apply', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getMyExitRequests: () => api.get('/exit/my-requests'),
  getMyExitRequestById: (id) => api.get(`/exit/my-requests/${id}`),
  getTeamExitRequests: (managerId) => api.get('/exit/team-requests', managerId ? { params: { managerId } } : {}),
  submitExitForm: (exitRequestId, formData) => api.post(`/exit/form/submit/${exitRequestId}`, formData),
  getExitForm: (exitRequestId) => api.get(`/exit/form/${exitRequestId}`),
  updateAssetItem: (assetItemId, itemData) => api.put(`/exit/assets/update/${assetItemId}`, itemData),
  getAssetHandover: (exitRequestId) => api.get(`/exit/assets/${exitRequestId}`),
  updateLastWorkingDay: (exitRequestId, payload) => api.patch(`/exit/last-working-day/${exitRequestId}`, payload),

  // Manager/HR/Admin endpoints
  approveExitRequest: (id, actionData) => api.post(`/exit/approve/${id}`, actionData),
  rejectExitRequest: (id, actionData) => api.post(`/exit/reject/${id}`, actionData),
  requestInfo: (id, actionData) => api.post(`/exit/request-info/${id}`, actionData),
  getExitDashboard: () => api.get('/exit/dashboard'),
  getAllExitRequests: () => api.get('/exit/all-requests'),
  getTerminations: () => api.get('/exit/terminations'),
  assignAssetHandover: (exitRequestId, handoverData) => api.post(`/exit/assets/assign/${exitRequestId}`, handoverData),
  initiateInterview: (exitRequestId) => api.post(`/exit/interview/initiate/${exitRequestId}`),
  triggerFnf: (exitRequestId) => api.post(`/exit/fnf/trigger/${exitRequestId}`),
  verifyResignationLetter: (exitRequestId) => api.post(`/exit/resignation/verify/${exitRequestId}`),
  uploadSignedResignation: (exitRequestId, formData) => api.post(`/exit/resignation/upload/${exitRequestId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  closeExit: (exitRequestId) => api.post(`/exit/close/${exitRequestId}`),
  terminateEmployee: (terminationData) => api.post('/exit/terminate', terminationData),
  getMyAssignedHandovers: () => api.get('/exit/assets/my-assignments'),
};


// Onboarding API
export const onboardingAPI = {
  getMyOnboardingState: () => api.get('/onboarding/me'),
  completeOnboarding: () => api.post('/onboarding/complete'),
};

// Project Management API
export const projectAPI = {
  // Projects
  getAllProjects: () => api.get('/admin/projects'),
  getActiveProjects: () => api.get('/admin/projects/active'),
  getProject: (id) => api.get(`/admin/projects/${id}`),
  createProject: (data) => api.post('/admin/projects', data),
  updateProject: (id, data) => api.put(`/admin/projects/${id}`, data),
  pauseProject: (id) => api.put(`/admin/projects/${id}/pause`),
  resumeProject: (id) => api.put(`/admin/projects/${id}/resume`),
  deleteProject: (id) => api.delete(`/admin/projects/${id}`),

  // Tasks
  getTasksForProject: (projectId) => api.get(`/admin/projects/${projectId}/tasks`),
  createTask: (projectId, data) => api.post(`/admin/projects/${projectId}/tasks`, data),
  updateTask: (taskId, data) => api.put(`/admin/projects/tasks/${taskId}`, data),
  deleteTask: (taskId) => api.delete(`/admin/projects/tasks/${taskId}`),

  getAllAssignments: (view, startDate, endDate) => api.get('/admin/task-assignments', { params: { view, startDate, endDate } }),
  getTaskAssignmentById: (id) => api.get(`/admin/task-assignments/${id}`),
  getAssignmentsForProject: (projectId) => api.get(`/admin/task-assignments/by-project/${projectId}`),
  getAssignmentsForTask: (taskId) => api.get(`/admin/task-assignments/by-task/${taskId}`),
  getAssignmentsForEmployee: (employeeId) => api.get(`/admin/task-assignments/by-employee/${employeeId}`),
  createTaskAssignment: (data) => api.post('/admin/task-assignments', data),
  createTaskAssignmentWithTask: (employeeId, data) => api.post('/admin/task-assignments/create-with-task', data, { params: { employeeId } }),
  updateTaskAssignment: (id, data) => api.put(`/admin/task-assignments/${id}`, data),
};

// Super-admin marketing endpoints
superAdminAPI.getDemoRequests = () => api.get('/super-admin/marketing/demo-requests');
superAdminAPI.getDemoRequestById = (id) => api.get(`/super-admin/marketing/demo-requests/${id}`);



// Timesheet API - Unified endpoints for employee self-service and management
export const timesheetAPI = {
  // SELF endpoints (for "All Timesheets", "Rejected", etc.)
  getSelfTimesheets: (status) => api.get('/timesheets/self', { params: status ? { status } : {} }),
  getMyPastDueMissedDates: (weekStart) => api.get('/timesheets/self/past-due', { params: weekStart ? { weekStart } : {} }),
  getMyRejectedTimesheetsForWeek: (weekStart) => api.get('/timesheets/self/rejected', { params: weekStart ? { weekStart } : {} }),
  getMyProjectTime: (startDate, endDate) => api.get('/timesheets/self/project-time', { params: { startDate, endDate } }),
  getMyTasks: (startDate, endDate) => api.get('/timesheets/self/tasks', { params: { startDate, endDate } }),
  getMyAllocatedProjects: (startDate, endDate) => api.get('/timesheets/self/allocated-projects', { params: { startDate, endDate } }),

  // Task management for self
  getMyAssignedTasks: () => api.get('/timesheets/self/assigned-tasks'),
  updateAssignmentStatus: (assignmentId, status) =>
    api.patch(`/timesheets/self/assignments/${assignmentId}/status`, { status }),
  createSelfTask: (taskData) => api.post('/timesheets/self/tasks', taskData),

  // Scope-based retrieval
  getApprovedEntries: (startDate, endDate, onlyBillable = false) =>
    api.get('/timesheets/approved-entries', { params: { startDate, endDate, onlyBillable }, timeout: 60000 }),
  getTimesheets: (week) => api.get('/timesheets', { params: { week } }),
  getTimesheetById: (id) => api.get(`/timesheets/${id}`),
  approveTimesheet: (id, comment) => api.post(`/timesheets/${id}/approve`, { comment }),
  rejectTimesheet: (id, comment) => api.post(`/timesheets/${id}/reject`, { comment, rejectionReason: comment }),
};

// Employee Project API
export const employeeProjectAPI = {
  getMyAssignedTasks: () => api.get('/timesheets/self/assigned-tasks'),
  getWeeklyAssignedTasks: (startDate, endDate) => 
    api.get('/timesheets/self/assigned-tasks', { params: { startDate, endDate } }),
  getAllocatedProjects: (startDate, endDate) =>
    api.get('/timesheets/self/allocated-projects', { params: { startDate, endDate } }),
  getSelfAssignment: (assignmentId) => api.get(`/timesheets/self/assignments/${assignmentId}`),
  updateAssignmentStatus: (assignmentId, status) =>
    api.patch(`/timesheets/self/assignments/${assignmentId}/status`, { status }),
  createSelfTask: (taskData) => api.post('/timesheets/self/tasks', taskData),
  getPendingTasks: (view = 'all') => api.get('/timesheets/pending-tasks', { params: { view } }),
  approveTask: (id) => api.post(`/timesheets/tasks/${id}/approve`),
  rejectTask: (id) => api.post(`/timesheets/tasks/${id}/reject`),
  getAvailableProjects: () => api.get('/timesheets/all-projects'),
};

// Marketing / Public endpoints
export const marketingAPI = {
  sendDemoRequest: (payload) => {
    return api.post('/public/demo-requests', payload);
  },
};

// Employee-of-the-Quarter (EOQ) API
export const eoqAPI = {
  submitNomination: (payload, nominatorId) => {
    const headers = nominatorId ? { headers: { 'X-NOMINATOR-ID': nominatorId } } : {};
    return api.post('/eoq/nominations', payload, headers);
  },
  getMyNominations: (nominatorId) => api.get(`/eoq/nominations/my?nominatorId=${encodeURIComponent(nominatorId)}`),
  getPendingNominations: () => api.get('/eoq/nominations/pending'),
  reviewNomination: (id, reviewerId, action, notes) => {
    const params = new URLSearchParams({
      reviewerId: String(reviewerId),
      action: String(action),
    });
    return api.patch(
      `/eoq/nominations/${id}/review?${params.toString()}`,
      notes ?? '',
      { headers: { 'Content-Type': 'text/plain' } },
    );
  },
  getNominationsByStatus: (status) => api.get(`/eoq/nominations/status/${encodeURIComponent(status)}`),
};

// Unified Employee API - Scope-based access (ORG, TEAM, SELF)
export const unifiedEmployeeAPI = {
  getEmployees: (scope) => {
    const params = {};
    if (scope) params.scope = scope;
    return api.get('/employees', { params });
  },
  getEmployeeById: (id) => api.get(`/employees/${id}`),
};

// Employee Expense API
export const employeeExpenseAPI = {
  getExpenseById: (id) => api.get(`/employee/expenses/${id}`),
};

// Manager Expense API
export const managerExpenseAPI = {
  getExpenseById: (id) => api.get(`/manager/expenses/${id}`),
};

// Manager Asset API
const managerAssetParams = (orgScope) => (orgScope ? { scope: 'org' } : {});

export const managerAssetAPI = {
  getTeamAssets: (orgScope = false) => api.get('/manager/assets', { params: managerAssetParams(orgScope) }),
  getAllAssets: () => api.get('/manager/assets/all'),
  getAvailableAssets: () => api.get('/manager/assets/available'),
  assignAsset: (assignmentData, orgScope = false) => api.post('/manager/assets/assign', assignmentData, { params: managerAssetParams(orgScope) }),
  createAndAssignAsset: (payload, orgScope = false) => api.post('/manager/assets/create-and-assign', payload, { params: managerAssetParams(orgScope) }),
  returnAsset: (assetId, orgScope = false, imageUrl = null) => {
    const params = { ...managerAssetParams(orgScope) };
    if (imageUrl) params.imageUrl = imageUrl;
    return api.post(`/manager/assets/${assetId}/return`, null, { params });
  },
  updateAssetStatus: (assetId, status, orgScope = false) => api.patch(`/manager/assets/${assetId}/status`, { status }, { params: managerAssetParams(orgScope) }),
  transferAsset: (data) => api.post('/manager/assets/transfer', data),
  getTickets: () => api.get('/manager/assets/tickets'),
  createTicket: (data) => api.post('/manager/assets/tickets', data),
  updateTicket: (ticketId, data) => api.put(`/manager/assets/tickets/${ticketId}`, data),
  addMaintenance: (data) => api.post('/manager/assets/maintenance', data),
  getAssetHistory: (id) => api.get(`/manager/assets/${id}/history`),
  getAssetMaintenanceForAsset: (id) => api.get(`/manager/assets/${id}/maintenance`),
  deleteAsset: (id) => api.delete(`/manager/assets/${id}`),
  uploadAssetFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/assets/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// Features API
export const featuresAPI = {
  getAccessInfo: () => api.get('/features/access'),
  getAllFeatures: () => api.get('/features/all'),
  getAvailableFeatures: () => api.get('/features/available'),
  updateFeatures: (enabledFeatures) => api.post('/features/update', enabledFeatures),
};

// Approval Delegation API
export const delegationAPI = {
  getMyDelegations: () => api.get('/delegations/my-delegations'),
  createDelegation: (data) => api.post('/delegations', data),
  revokeDelegation: (id) => api.delete(`/delegations/${id}/revoke`),
  getEligibleDelegates: () => api.get('/delegations/eligible-delegates'),
};
