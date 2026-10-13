import React, { useState, useRef, useEffect, useContext } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { AuthContext } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { useSidebar } from '../contexts/SidebarContext';
import { organizationAPI, getApiBaseUrl } from '../services/api';
import Logo from '../assets/Logo.png';
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarCheck,
  DollarSign,
  Briefcase,
  UserSearch,
  FileText,
  CalendarDays,
  Settings,
  Sun,
  Moon,
  Trophy,
  LogOut,
  MessageSquare,
  StickyNote,
  ScrollText,
  Box,
  ChevronRight,
  ChevronLeft,
  Clock,
  PanelLeftClose,
  PanelLeft,
  User,
  HelpCircle,
  BarChart3,
  KanbanSquare,
  Shield,
  UserCog,
  Building
} from 'lucide-react';


// Define the Flyout Navigation Structure
const adminNavGroups = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/admin/dashboard',
    type: 'single',
    module: 'DASHBOARD'
  },
  {
    id: 'my-team',
    label: 'My Team',
    icon: Users,
    path: '/manager/team',
    type: 'single',
    module: 'ORGANIZATION'
  },
  {
    id: 'people',
    label: 'People & Org',
    icon: Users,
    type: 'group',
    subItems: [
      { path: '/admin/employees', label: 'All Employees', module: 'EMPLOYEE_MANAGEMENT', permission: 'PEOPLE_ORG_EMPLOYEES_VIEW', scope: 'ORGANIZATION', crudModule: 'PEOPLE_ORG_EMPLOYEES' },
      { path: '/admin/reporting-management', label: 'Reporting Management', module: 'EMPLOYEE_MANAGEMENT', permission: 'PEOPLE_ORG_REPORTING_VIEW', scope: 'ORGANIZATION', crudModule: 'PEOPLE_ORG_REPORTING' },
      { path: '/admin/team', label: 'My Org', module: 'ORGANIZATION', permission: 'PEOPLE_ORG_ORGANIZATION_VIEW', scope: 'ORGANIZATION', crudModule: 'PEOPLE_ORG_ORGANIZATION' },
      { path: '/admin/projects', label: 'Project Management', module: 'PROJECT_MANAGEMENT', permission: 'PROJECT_MANAGEMENT_PROJECTS_VIEW', scope: 'TEAM', crudModule: 'PROJECT_MANAGEMENT_PROJECTS' },
      { path: '/admin/work-status', label: 'Work Status', module: 'WORK_STATUS', permission: 'WORKFORCE_ATTENDANCE_VIEW', scope: 'OWN' },
      { path: '/admin/documents', label: 'Documents', module: 'DOCUMENTS', permission: 'PEOPLE_ORG_DOCUMENTS_VIEW', scope: 'DEPARTMENT', crudModule: 'PEOPLE_ORG_DOCUMENTS_VIEW' },
      { path: '/admin/assets', label: 'Assets', module: 'ASSETS', permission: 'PEOPLE_ORG_ASSETS_VIEW', scope: 'ORGANIZATION', crudModule: 'PEOPLE_ORG_ASSETS' },
      { path: '/admin/exit', label: 'Exit Management', module: 'EMPLOYEE_MANAGEMENT', permission: 'PEOPLE_ORG_EXIT_VIEW', scope: 'TEAM', crudModule: 'PEOPLE_ORG_EXIT' }
    ]
  },
  {
    id: 'time',
    label: 'Workforce',
    icon: CalendarCheck,
    type: 'group',
    subItems: [
      { path: '/admin/time-office', label: 'Attendance & Timesheets', module: 'ATTENDANCE', permission: 'WORKFORCE_ATTENDANCE_VIEW', scope: 'OWN', crudModule: 'WORKFORCE_ATTENDANCE_VIEW' },
      { path: '/admin/my-leaves', label: 'Apply Leave', module: 'LEAVE_MANAGEMENT', permission: 'WORKFORCE_LEAVE_VIEW', scope: 'OWN', crudModule: 'WORKFORCE_LEAVE_SELF' },
      { path: '/admin/leaves', label: 'Leaves', module: 'LEAVE_MANAGEMENT', permission: 'WORKFORCE_LEAVE_VIEW', scope: 'ORGANIZATION', crudModule: 'WORKFORCE_LEAVE' },
      { path: '/admin/leave-adjustments', label: 'Leave Adjustments', module: 'LEAVE_MANAGEMENT', permission: 'WORKFORCE_LEAVE_ADJUST', scope: 'ORGANIZATION', crudModule: 'WORKFORCE_LEAVE_ADJUST' },
      { path: '/admin/wfh', label: 'Work From Home', module: 'WFH', permission: 'WORKFORCE_WFH_VIEW', scope: 'OWN', crudModule: 'WORKFORCE_WFH_SELF' },
      { path: '/admin/expenses', label: 'Expenses', module: 'EXPENSES', permission: 'WORKFORCE_EXPENSES_VIEW', scope: 'OWN', crudModule: 'WORKFORCE_EXPENSES_SELF' },
      { path: '/admin/holidays', label: 'Holidays', module: 'HOLIDAYS', permission: 'WORKFORCE_HOLIDAYS_VIEW', scope: 'ORGANIZATION', crudModule: 'WORKFORCE_HOLIDAYS_VIEW' }
    ]
  },
  {
    id: 'recruitment',
    label: 'Recruitment',
    icon: Briefcase,
    type: 'group',
    subItems: [
      { path: '/admin/jobs', label: 'Jobs', module: 'EMPLOYEE_MANAGEMENT', permission: 'PEOPLE_ORG_EMPLOYEES_VIEW', scope: 'ORGANIZATION', crudModule: 'PEOPLE_ORG_EMPLOYEES' },
      { path: '/admin/candidates', label: 'Candidates', module: 'EMPLOYEE_MANAGEMENT', permission: 'PEOPLE_ORG_EMPLOYEES_VIEW', scope: 'ORGANIZATION', crudModule: 'PEOPLE_ORG_EMPLOYEES' }
    ]
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: DollarSign,
    type: 'group',
    subItems: [
      { path: '/admin/payroll', label: 'Payroll', module: 'PAYROLL', permissions: ['PAYROLL_VIEW', 'FINANCE_PAYROLL_VIEW', 'FINANCE_PAYROLL_MANAGE', 'TENANT_MANAGE'], scope: 'ORGANIZATION', crudModule: 'FINANCE_PAYROLL' },
      { path: '/admin/payroll-sync', label: 'Payroll Sync', module: 'PAYROLL', permissions: ['FINANCE_PAYROLL_SYNC_VIEW', 'FINANCE_PAYROLL_SYNC_MANAGE', 'PAYROLL_VIEW', 'FINANCE_PAYROLL_VIEW', 'FINANCE_PAYROLL_MANAGE', 'TENANT_MANAGE'], scope: 'ORGANIZATION', crudModule: 'FINANCE_PAYROLL_SYNC' }
    ]
  },
  {
    id: 'engagement',
    label: 'Culture',
    icon: MessageSquare,
    type: 'group',
    subItems: [
      { path: '/admin/notices', label: 'Notice Board', module: 'NOTICES', permission: 'CULTURE_NOTICE_BOARD_VIEW', scope: 'ORGANIZATION', crudModule: 'CULTURE_NOTICE_BOARD' },
      { path: '/admin/complaints', label: 'Complaints', module: 'COMPLAINTS', permission: 'CULTURE_COMPLAINTS_VIEW', scope: 'OWN', crudModule: 'CULTURE_COMPLAINTS' },
      { path: '/admin/achievements', label: 'Achievements', module: 'ACHIEVEMENTS', permission: 'CULTURE_ACHIEVEMENTS_VIEW', scope: 'ORGANIZATION', crudModule: 'CULTURE_ACHIEVEMENTS' },
      { path: '/admin/eoq/review', label: 'Employee of Quarter', module: 'ACHIEVEMENTS', permission: 'CULTURE_EMPLOYEE_OF_QUARTER_VIEW', scope: 'ORGANIZATION', crudModule: 'CULTURE_EMPLOYEE_OF_QUARTER' },
      { path: '/eoq', label: 'Employee of the Quarter', module: 'ACHIEVEMENTS', permission: 'CULTURE_EMPLOYEE_OF_QUARTER_VIEW', scope: 'OWN', crudModule: 'CULTURE_EMPLOYEE_OF_QUARTER' },
      { path: '/admin/fun-wellness', label: 'Fun & Wellness', module: 'GAMES', permission: 'CULTURE_FUN_WELLNESS_VIEW', scope: 'ORGANIZATION', crudModule: 'CULTURE_FUN_WELLNESS' },
      { path: '/admin/notifications', label: 'Notifications', module: 'NOTICES', permission: 'CULTURE_NOTIFICATIONS_VIEW', scope: 'OWN', crudModule: 'CULTURE_NOTIFICATIONS' }
    ]
  },
  {
    id: 'manage-account',
    label: 'Manage Account',
    icon: Shield,
    type: 'group',
    subItems: [
      { path: '/admin/users', label: 'Users', module: 'SETTINGS', permission: 'MANAGE_ACCOUNT_USERS_VIEW', scope: 'ORGANIZATION', crudModule: 'MANAGE_ACCOUNT_USERS' },
      { path: '/admin/organization-setup', label: 'Organization Setup', module: 'ORGANIZATION', permission: 'MANAGE_ACCOUNT_SYSTEM_SETTINGS_VIEW', scope: 'OWN', crudModule: 'MANAGE_ACCOUNT_SYSTEM_SETTINGS' },
      { path: '/admin/location-settings', label: 'Location Settings', module: 'SETTINGS', permission: 'MANAGE_ACCOUNT_SYSTEM_SETTINGS_VIEW', scope: 'OWN', crudModule: 'MANAGE_ACCOUNT_SYSTEM_SETTINGS' },
      { path: '/admin/user-access-control', label: 'Roles & Permissions', module: 'SETTINGS', permission: 'MANAGE_ACCOUNT_ROLES_PERMISSIONS_VIEW', scope: 'ORGANIZATION', crudModule: 'MANAGE_ACCOUNT_ROLES_PERMISSIONS' },
      { path: '/admin/settings', label: 'System Settings', module: 'SETTINGS', permission: 'MANAGE_ACCOUNT_SYSTEM_SETTINGS_VIEW', scope: 'ORGANIZATION', crudModule: 'MANAGE_ACCOUNT_SYSTEM_SETTINGS' }
    ]
  },
  {
    id: 'reports',
    label: 'Analytics',
    icon: BarChart3,
    type: 'group',
    subItems: [
      { path: '/admin/reports/leave', label: 'Leave Report', module: 'EMPLOYEE_MANAGEMENT', permission: 'ANALYTICS_LEAVE_VIEW', scope: 'ORGANIZATION', crudModule: 'ANALYTICS_LEAVE' },
      { path: '/admin/reports/attendance', label: 'Attendance Report', module: 'EMPLOYEE_MANAGEMENT', permission: 'ANALYTICS_ATTENDANCE_VIEW', scope: 'ORGANIZATION', crudModule: 'ANALYTICS_ATTENDANCE' },
      { path: '/admin/reports/timesheet', label: 'Timesheet Report', module: 'EMPLOYEE_MANAGEMENT', permission: 'ANALYTICS_TIMESHEET_VIEW', scope: 'ORGANIZATION', crudModule: 'ANALYTICS_TIMESHEET' }
    ]
  },
  {
    id: 'planner',
    label: 'Planner',
    icon: KanbanSquare,
    path: '/admin/planner',
    type: 'single',
    module: 'PLANNER',
    permission: 'PLANNER_PLANNER_VIEW',
    scope: 'OWN'
  }
];

const superAdminNavGroups = [
  {
    id: 'sa-dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/super-admin/dashboard',
    type: 'single'
  },
  {
    id: 'sa-tenants',
    label: 'Tenants',
    icon: Building2,
    path: '/super-admin/tenants',
    type: 'single'
  },
  {
    id: 'sa-billing',
    label: 'Billing',
    icon: DollarSign,
    path: '/super-admin/billing',
    type: 'single'
  },
  {
    id: 'sa-demo-requests',
    label: 'Lead Requests',
    icon: MessageSquare,
    path: '/super-admin/marketing/demo-requests',
    type: 'single'
  },
  {
    id: 'sa-plans',
    label: 'Plans',
    icon: BarChart3,
    path: '/super-admin/plans',
    type: 'single'
  }
];

const employeeNavGroups = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/employee/dashboard',
    type: 'single',
    module: 'DASHBOARD'
  },
  {
    id: 'my-team',
    label: 'My Team',
    icon: Users,
    path: '/manager/team',
    type: 'single',
    module: 'ORGANIZATION',
    permission: 'PEOPLE_ORG_REPORTING_VIEW',
    scope: 'TEAM'
  },
  {
    id: 'projects',
    label: 'Project Management',
    icon: Briefcase,
    path: '/manager/projects',
    type: 'single',
    module: 'PROJECT_MANAGEMENT',
    permission: 'PROJECT_MANAGEMENT_PROJECTS_VIEW',
    scope: 'TEAM'
  },
  {
    id: 'time',
    label: 'Workforce',
    icon: CalendarCheck,
    type: 'group',
    subItems: [
      { path: '/employee/time-office', label: 'Attendance & Timesheets', module: 'ATTENDANCE', permission: 'WORKFORCE_ATTENDANCE_VIEW', scope: 'OWN' },
      { path: '/employee/leaves', label: 'My Leaves', module: 'LEAVE_MANAGEMENT', permission: 'WORKFORCE_LEAVE_VIEW', scope: 'OWN', crudModule: 'WORKFORCE_LEAVE_SELF' },
      { path: '/employee/wfh', label: 'Work From Home', module: 'WFH', permission: 'WORKFORCE_WFH_VIEW', scope: 'OWN' },
      { path: '/employee/expenses', label: 'My Expenses', module: 'EXPENSES', permission: 'WORKFORCE_EXPENSES_VIEW', scope: 'OWN' },
      { path: '/manager/expenses', label: 'Team Expenses', module: 'EXPENSES', permission: 'WORKFORCE_EXPENSES_VIEW', scope: 'TEAM' },
      { path: '/employee/holidays', label: 'Holidays', module: 'HOLIDAYS', permission: 'WORKFORCE_HOLIDAYS_VIEW', scope: 'OWN' },
      { path: '/employee/work-status', label: 'Work Status', module: 'WORK_STATUS', permission: 'WORKFORCE_ATTENDANCE_VIEW', scope: 'OWN' }
    ]
  },
  {
    id: 'people',
    label: 'People & Org',
    icon: Users,
    type: 'group',
    subItems: [
      { path: '/documents', label: 'Documents', module: 'DOCUMENTS' },
      { path: '/employee/assets', label: 'My Assets', module: 'MY_ASSETS', permission: 'PEOPLE_ORG_ASSETS_VIEW', scope: 'OWN' },
      { path: '/manager/assets', label: 'Team Assets', module: 'TEAM_ASSETS', permission: 'PEOPLE_ORG_ASSETS_VIEW', scope: 'TEAM' },
      { path: '/exit', label: 'Exit Management', module: 'EMPLOYEE_MANAGEMENT', permission: 'PEOPLE_ORG_EXIT_VIEW', scope: 'TEAM' }
    ]
  },
  {
    id: 'planner',
    label: 'Planner',
    icon: KanbanSquare,
    path: '/employee/planner',
    type: 'single',
    module: 'PLANNER',
    permission: 'PLANNER_PLANNER_VIEW',
    scope: 'OWN'
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: DollarSign,
    type: 'group',
    subItems: [
      { path: '/payroll', label: 'Payslips', module: 'PAYROLL', permission: 'PAYSLIP_VIEW', scope: 'OWN' }
    ]
  },
  {
    id: 'engagement',
    label: 'Culture',
    icon: MessageSquare,
    type: 'group',
    subItems: [
      { path: '/notices', label: 'Notice Board', module: 'NOTICES', permission: 'CULTURE_NOTICE_BOARD_VIEW', scope: 'OWN' },
      { path: '/complaints', label: 'Complaints', module: 'COMPLAINTS', permission: 'CULTURE_COMPLAINTS_VIEW', scope: 'OWN' },
      { path: '/achievements', label: 'Achievements', module: 'ACHIEVEMENTS', permission: 'CULTURE_ACHIEVEMENTS_VIEW', scope: 'OWN' },
      { path: '/employee/eoq/nominate', label: 'Nominate EOQ', module: 'ACHIEVEMENTS', permission: 'CULTURE_EMPLOYEE_OF_QUARTER_NOMINATE', scope: 'OWN' },
      { path: '/eoq', label: 'Employee of the Quarter', module: 'ACHIEVEMENTS', permission: 'CULTURE_EMPLOYEE_OF_QUARTER_VIEW', scope: 'OWN' },
      { path: '/employee/fun-wellness', label: 'Fun & Wellness', module: 'GAMES', permission: 'CULTURE_FUN_WELLNESS_VIEW', scope: 'OWN' },
      { path: '/notifications', label: 'Notifications', module: 'NOTICES', permission: 'CULTURE_NOTIFICATIONS_VIEW', scope: 'OWN' }
    ]
  },
  {
    id: 'manager-analytics',
    label: 'Team Analytics',
    icon: BarChart3,
    type: 'group',
    module: 'ORGANIZATION',
    subItems: [
      { path: '/manager/analytics', label: 'Team Overview', permission: 'TEAM_ANALYTICS_TEAM_OVERVIEW_VIEW', scope: 'TEAM' },
      { path: '/manager/leave-analytics', label: 'Leave Analytics', permission: 'TEAM_ANALYTICS_LEAVE_ANALYTICS_VIEW', scope: 'TEAM' },
      { path: '/manager/timesheet-analytics', label: 'Timesheet Analytics', permission: 'TEAM_ANALYTICS_TIMESHEET_ANALYTICS_VIEW', scope: 'TEAM' },
      { path: '/manager/wfh', label: 'Team WFH', module: 'WFH', permission: 'TEAM_ANALYTICS_TEAM_WFH_VIEW', scope: 'TEAM' }
    ]
  }
];

/** Match nav paths without false positives (e.g. /notices vs /notifications, /eoq vs /employee/eoq/nominate). */
const normalizeNavPath = (path) => (path || '').replace(/\/+$/, '') || '/';

const isNavPathActive = (itemPath, pathname) => {
  const item = normalizeNavPath(itemPath);
  const current = normalizeNavPath(pathname);
  if (!item || !current) return false;
  if (current === item) return true;

  // Standalone EOQ page — never treat nomination/admin review routes as active
  if (item === '/eoq') {
    return false;
  }
  if (item === '/admin/eoq/review' && current.startsWith('/employee/eoq')) {
    return false;
  }
  if (item === '/employee/eoq/nominate') {
    return current === '/employee/eoq/nominate';
  }

  return current.startsWith(`${item}/`);
};

const getCultureReturnTo = (location) => {
  const chained = location.state?.returnTo;
  if (typeof chained === 'string' && chained.startsWith('/') && chained !== '/employee/eoq/nominate') {
    return chained;
  }
  const current = normalizeNavPath(location.pathname);
  if (current === '/employee/eoq/nominate') {
    return '/achievements';
  }
  return current || '/achievements';
};

let globalOrganizationName = '';
let globalOrganizationLogo = null;

export default function Sidebar() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  // Use AuthContext directly so we never throw when outside AuthProvider (e.g. HMR or wrong tree)
  const authContext = useContext(AuthContext);
  const hasAdminAccess = authContext?.hasAdminAccess ?? (() => false);
  const sessionType = authContext?.sessionType ?? null;
  const isAuthenticated = authContext?.isAuthenticated ?? false;
  const logout = authContext?.logout ?? (() => { });
  const user = authContext?.getCurrentUser() ?? null;

  const { currentTenant } = useTenant();

  const resolveOrgLogoUrl = (raw) => {
    if (!raw) return null;
    const url = String(raw).trim();
    if (!url) return null;
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;

    const base = getApiBaseUrl() || '';
    if (base.startsWith('http')) {
      const origin = base.replace(/\/api\/?$/, '');
      return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
    }
    return url.startsWith('/') ? url : `/${url}`;
  };

  const pickOrgLogo = (data) => {
    if (!data) return null;
    return (
      data.logo_url ||
      data.logoUrl ||
      data.logo ||
      data.organizationLogo ||
      data.branding?.logo_url ||
      data.branding?.logoUrl ||
      null
    );
  };

  const pickOrgName = (data) => {
    if (!data) return '';
    return (
      data.company_name ||
      data.companyName ||
      data.name ||
      data.organizationName ||
      data.tenantName ||
      ''
    );
  };

  const [organizationName, setOrganizationName] = useState(() => {
    if (globalOrganizationName) return globalOrganizationName;
    const cachedName = window.safeSessionStorage.getItem('cached_org_name');
    if (cachedName) {
      globalOrganizationName = cachedName;
      return cachedName;
    }

    const tenantName = currentTenant ? (currentTenant.company_name || currentTenant.companyName || currentTenant.name || currentTenant.organizationName || currentTenant.tenantName) : '';
    if (tenantName) {
      globalOrganizationName = tenantName;
      return tenantName;
    }
    return '';
  });

  const [organizationLogo, setOrganizationLogo] = useState(() => {
    if (globalOrganizationLogo) return globalOrganizationLogo;
    const cachedLogo = window.safeSessionStorage.getItem('cached_org_logo');
    if (cachedLogo) {
      globalOrganizationLogo = cachedLogo;
      return cachedLogo;
    }

    const tenantLogo = currentTenant ? (currentTenant.logo_url || currentTenant.logoUrl || currentTenant.logo || currentTenant.organizationLogo || currentTenant.branding?.logo_url || currentTenant.branding?.logoUrl) : null;
    if (tenantLogo) {
      const url = String(tenantLogo).trim();
      let resolved = url;
      if (!url.startsWith('data:') && !url.startsWith('blob:') && !url.startsWith('http://') && !url.startsWith('https://')) {
        const base = getApiBaseUrl() || '';
        if (base.startsWith('http')) {
          const origin = base.replace(/\/api\/?$/, '');
          resolved = `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
        } else {
          resolved = url.startsWith('/') ? url : `/${url}`;
        }
      }
      globalOrganizationLogo = resolved;
      return resolved;
    }
    return null;
  });

  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || sessionType === 'super-admin') {
      globalOrganizationName = '';
      globalOrganizationLogo = null;
      setOrganizationName('');
      setOrganizationLogo(null);
      setLogoLoadFailed(false);
      return;
    }

    // Populate state from cache immediately to prevent flickering
    const cachedName = globalOrganizationName || window.safeSessionStorage.getItem('cached_org_name');
    const cachedLogo = globalOrganizationLogo || window.safeSessionStorage.getItem('cached_org_logo');
    if (cachedName) {
      setOrganizationName(cachedName);
    }
    if (cachedLogo) {
      setOrganizationLogo(cachedLogo);
    }

    let cancelled = false;
    setLogoLoadFailed(false);

    const applyOrg = (data) => {
      if (!data || cancelled) return;
      const name = pickOrgName(data);
      if (name) {
        setOrganizationName(name);
        window.safeSessionStorage.setItem('cached_org_name', name);
        globalOrganizationName = name;
      }
      const logo = pickOrgLogo(data);
      if (logo) {
        const resolvedLogo = resolveOrgLogoUrl(logo);
        setOrganizationLogo(resolvedLogo);
        window.safeSessionStorage.setItem('cached_org_logo', resolvedLogo);
        globalOrganizationLogo = resolvedLogo;
      }
    };

    const tenantName = pickOrgName(currentTenant);
    const tenantLogo = pickOrgLogo(currentTenant);
    if (tenantName) {
      setOrganizationName(tenantName);
      window.safeSessionStorage.setItem('cached_org_name', tenantName);
      globalOrganizationName = tenantName;
    }
    if (tenantLogo) {
      const resolvedLogo = resolveOrgLogoUrl(tenantLogo);
      setOrganizationLogo(resolvedLogo);
      window.safeSessionStorage.setItem('cached_org_logo', resolvedLogo);
      globalOrganizationLogo = resolvedLogo;
    }

    organizationAPI
      .get()
      .then((res) => applyOrg(res?.data))
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [
    isAuthenticated, 
    sessionType, 
    currentTenant?.id, 
    currentTenant?.company_name,
    user?.employeeId,
    user?.username,
    authContext?.currentTenantId,
    location.pathname
  ]);

  useEffect(() => {
    setLogoLoadFailed(false);
  }, [organizationLogo]);

  const displayOrganizationName = (() => {
    if (sessionType === 'super-admin') return 'Super Admin';
    const rawName = (
      organizationName ||
      currentTenant?.company_name ||
      currentTenant?.name ||
      user?.companyName ||
      user?.organizationName ||
      user?.tenantName ||
      'Organization'
    );
    return rawName === 'Infosys' ? 'Pragva-HRMS' : rawName;
  })();

  const { isCollapsed, isMobileMenuOpen, setIsMobileMenuOpen } = useSidebar() || { isCollapsed: false, isMobileMenuOpen: false };
  const [hoveredGroup, setHoveredGroup] = useState(null);
  const [flyoutSuppressed, setFlyoutSuppressed] = useState(false);
  const [flyoutPosition, setFlyoutPosition] = useState({ top: 0 });
  const [showUserMenu, setShowUserMenu] = useState(false);
  const timeoutRef = useRef(null);
  const openTimeoutRef = useRef(null);
  const userMenuRef = useRef(null);

  const dismissFlyout = () => {
    setHoveredGroup(null);
    setFlyoutSuppressed(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  // Close flyout/hover highlight when navigating (e.g. Notifications → Planner)
  useEffect(() => {
    dismissFlyout();
  }, [location.pathname, location.search, location.key]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMouseEnter = (groupId, event) => {
    setFlyoutSuppressed(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const top = Math.min(rect.top, window.innerHeight - 320);
    setFlyoutPosition({ top: Math.max(10, top) });
    openTimeoutRef.current = setTimeout(() => {
      setHoveredGroup(groupId);
      openTimeoutRef.current = null;
    }, 180);
  };

  const handleMouseLeave = () => {
    setFlyoutSuppressed(false);
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
    timeoutRef.current = setTimeout(() => {
      setHoveredGroup(null);
      timeoutRef.current = null;
    }, 200);
  };

  const currentUserObjForRoles = sessionType === 'admin' ? (authContext?.adminUser || authContext?.user) : authContext?.user;

  const hasHRRole = currentUserObjForRoles?.roles && Array.isArray(currentUserObjForRoles.roles) &&
    currentUserObjForRoles.roles.some(role => ['HR', 'CEO'].includes(role?.toUpperCase()));
  const hasAdminPortalAccess = currentUserObjForRoles?.permissions && Array.isArray(currentUserObjForRoles.permissions) &&
    currentUserObjForRoles.permissions.includes('ADMIN_PORTAL_ACCESS');

  const isManager = currentUserObjForRoles?.roles && Array.isArray(currentUserObjForRoles.roles) &&
    currentUserObjForRoles.roles.some(role => ['MANAGER', 'HR', 'CEO'].includes(String(role).toUpperCase()));

  const hasModule = authContext?.hasModule ?? (() => true);

  // HR role employees should see admin menu even if sessionType is 'employee'
  const shouldShowAdminMenu = sessionType === 'admin' ||
    sessionType === 'super-admin' ||
    hasHRRole ||
    hasAdminPortalAccess;

  // Determine if the current admin session is a pure admin (not HR/CEO with a role-specific access config).
  //
  // Reliable signal: when the backend resolves the current user's role:
  //   - Pure Admin (system admin, no role-specific config): returns roleAllowedModules = null
  //   - HR/CEO (has a saved RoleAccessConfig in DB): returns roleAllowedModules = string[]
  //
  // We also check role name fields across all available user objects as a secondary signal.
  // roleAllowedModules is the primary signal because AdminDto has NO roles field.
  const _roleAllowedModules = authContext?.roleAllowedModules;
  const _hasRoleConfig = Array.isArray(_roleAllowedModules); // null = no config = pure admin
  
  // Secondary: check role name across all possible user object shapes
  const _allUsers = [authContext?.user, authContext?.adminUser].filter(Boolean);
  const _namedRoles = _allUsers.flatMap(u => [
    ...(u?.roles || []),
    u?.employeeRoleName,
    u?.role?.name,
    u?.roleName,
    u?.designation,
  ]).filter(Boolean).map(r => String(r).toUpperCase());
  const _hasHRCEORole = _namedRoles.some(r => ['HR', 'CEO'].includes(r));

  // A session is "pure admin" only if it has NO role-specific config AND no HR/CEO role name found,
  // OR if the user's resolved roles explicitly contain "ADMIN".
  const isPureAdminSession = sessionType === 'admin' && (
    (!_hasRoleConfig && !_hasHRCEORole) ||
    _namedRoles.some(r => r.includes('ADMIN'))
  );
  
  const hasPermission = (permissionCode, requiredScope = null) => {
    if (sessionType === 'super-admin') return true;
    // Pure admin (not HR/CEO in admin portal): full access to everything
    if (isPureAdminSession) return true;
    if (!permissionCode) return true;
    
    // For HR/CEO in admin portal: derive permissions from rolePermissions (fresh from server per role).
    // Do NOT use authContext.user.permissions - that is the stale JWT from login time and causes
    // HR and CEO to see identical sidebars if they had the same permissions when they logged in.
    const rolePerms = authContext?.rolePermissions || [];
    
    if (requiredScope) {
      // Check both that the permission exists AND the scope is sufficient
      const match = rolePerms.find(rp => rp.permissionCode === permissionCode);
      if (!match) return false;
      const scopes = ['OWN', 'SELF', 'TEAM', 'DEPARTMENT', 'ORGANIZATION', 'TENANT'];
      const userScopeIdx = scopes.indexOf(match.scope === 'SELF' ? 'OWN' : (match.scope || 'OWN'));
      const reqScopeIdx = scopes.indexOf(requiredScope === 'SELF' ? 'OWN' : requiredScope);
      return userScopeIdx >= reqScopeIdx;
    }
    
    // No scope requirement: just check if the permission code exists
    return rolePerms.some(rp => rp.permissionCode === permissionCode);
  };

  // Generic filter function for nav items and groups
  const filterByFeature = (item) => {
    // Check module/plan restriction first (even pure admins cannot access modules not in subscription)
    if (item.module && !hasModule(item.module)) return false;

    // Pure admin session: bypass all permission/crud checks - show everything in plan
    if (isPureAdminSession) return true;

    // Always display Manage Account subitems in the admin portal
    if (item.path && item.path.startsWith('/admin') && [
      '/admin/users',
      '/admin/organization-setup',
      '/admin/location-settings',
      '/admin/user-access-control',
      '/admin/settings'
    ].includes(item.path)) {
      return true;
    }

    if (item.module && !hasModule(item.module)) return false;
    const allowedByPermission = Array.isArray(item.permissions) && item.permissions.length > 0
      ? item.permissions.some((code) => hasPermission(code, item.scope))
      : (!item.permission || hasPermission(item.permission, item.scope));
    if (!allowedByPermission) return false;
    // Enforce per-feature CRUD toggles from Roles & Permissions (incl. HR/CEO in admin portal)
    if (!isPureAdminSession && item.crudModule && authContext?.moduleCrud?.[item.crudModule]
        && authContext?.hasCrudPermission && !authContext.hasCrudPermission(item.crudModule, 'read')) {
      return false;
    }
    if (sessionType !== 'admin' && item.crudModule && authContext?.hasCrudPermission && !authContext.hasCrudPermission(item.crudModule, 'read')) return false;
    return true;
  };

  const processNavItems = (groups) => {
    return groups
      .filter(filterByFeature)
      .map(group => {
        // Dynamic labels based on plan
        let label = group.label;
        if (group.label === 'Attendance & Timesheets' && !hasModule('TIMESHEETS')) {
          label = 'Attendance';
        }

        if (group.id === 'my-team' || group.id === 'projects' || group.id === 'manager-analytics') {
          if (!isManager) return null;
        }

        // HR/CEO: Show 'All Attendance & Timesheets' and 'All Leaves'
        if (group.type === 'group' && group.subItems) {
          let subItems = [...group.subItems];

          // HR/CEO: Add employee centric actions to admin groups
          if (hasHRRole && groups === adminNavGroups) {
            if (group.id === 'people') {
              subItems.push(
                { path: '/documents', label: 'My Documents', module: 'DOCUMENTS' },
                { path: '/employee/assets', label: 'My Assets', module: 'MY_ASSETS' },
                { path: '/manager/assets', label: 'Team Assets', module: 'TEAM_ASSETS' },
                { path: '/exit', label: 'My Exit', module: 'EMPLOYEE_MANAGEMENT' }
              );
            } else if (group.id === 'time') {
              subItems.push(
                { path: '/employee/wfh', label: 'Apply WFH', module: 'WFH' },
                { path: '/employee/expenses', label: 'Apply Expenses', module: 'EXPENSES' }
              );
            }
          }

          const filteredSubItems = subItems.filter(item => {
            // Apply Leave is for HR/CEO self-service only — not for pure Admin
            if (item.path === '/admin/my-leaves' && !hasHRRole) {
              return false;
            }
              // Check manager status for specific paths
              if (item.path === '/manager/expenses' || item.path === '/manager/wfh' || item.path === '/manager/assets') {
                if (!isManager) return false;
              }
            // Check feature access
            return filterByFeature(item);
          }).map(item => {
            // HR/CEO override for Attendance/Leaves
            // Show standard labels for all roles
            // Check for dynamic label redirection/renaming
            if (item.label === 'Attendance & Timesheets' && !hasModule('TIMESHEETS')) {
              return { ...item, label: 'Attendance' };
            }
            return item;
          });

          if (filteredSubItems.length === 0) return null;

          return { ...group, label, subItems: filteredSubItems };
        }
        return { ...group, label };
      })
      .filter(Boolean);
  };

  const navGroups =
    shouldShowAdminMenu
      ? (sessionType === 'super-admin' ? superAdminNavGroups : processNavItems(adminNavGroups))
      : processNavItems(employeeNavGroups);

  const isGroupActive = (group) => {
    if (group.type === 'single') {
      return location.pathname === group.path;
    }
    return group.subItems?.some((item) => isNavPathActive(item.path, location.pathname));
  };

  const handleLogout = () => {
    globalOrganizationName = '';
    globalOrganizationLogo = null;
    window.safeSessionStorage.removeItem('cached_org_name');
    window.safeSessionStorage.removeItem('cached_org_logo');
    logout();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="mobile-sidebar-backdrop animate-fadeIn" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      <aside
        className={`sidebar-premium ${sessionType === 'super-admin' ? 'sa-sidebar--platform' : ''} ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'mobile-open' : ''}`}
        style={{
          width: isCollapsed ? '64px' : '200px',
          minWidth: isCollapsed ? '64px' : '200px',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
      {/* Organization logo + name at top (hidden for super admin — platform owner, not a tenant) */}
      {sessionType === 'super-admin' ? (
        <div className="sa-sidebar-platform">
          <div className={`sa-sidebar-platform-brand ${isCollapsed ? 'collapsed' : ''}`} title="PRAGVA HRMS">
            <img src={Logo} alt="" className="sa-sidebar-platform-logo" />
            {!isCollapsed && (
              <div className="sa-sidebar-platform-text">
                <span className="sa-sidebar-platform-name">PRAGVA HRMS</span>
                <span className="sa-sidebar-platform-tag">Platform Control</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="sidebar-header sidebar-org-header">
          <div
            className={`sidebar-org-brand ${isCollapsed ? 'collapsed' : ''}`}
            title={displayOrganizationName}
          >
            <div className="sidebar-org-logo-wrap" aria-hidden={isCollapsed ? 'true' : undefined}>
              {organizationLogo && !logoLoadFailed ? (
                <div
                  className="sidebar-org-logo"
                  style={{
                    backgroundImage: `url(${organizationLogo})`,
                    backgroundSize: 'contain',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    width: '100%',
                    height: '100%',
                    display: 'block'
                  }}
                />
              ) : (
                <div className="sidebar-org-icon-fallback">
                  <Building2 size={isCollapsed ? 16 : 18} strokeWidth={2.25} />
                </div>
              )}
            </div>
            {!isCollapsed && (
              <span className="sidebar-org-name">{displayOrganizationName}</span>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="sidebar-nav-premium">
        {navGroups.map((group) => (
          <div
            key={group.id || group.path}
            className={`nav-item-wrapper ${group.type === 'group' ? 'has-flyout' : ''}`}
            onMouseEnter={(e) => group.type === 'group' && handleMouseEnter(group.id, e)}
            onMouseLeave={handleMouseLeave}
          >
            {group.type === 'single' ? (
              <NavLink
                to={group.path}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${isCollapsed ? 'collapsed' : ''}`}
                end={group.path.includes('dashboard')}
                title={isCollapsed ? group.label : undefined}
              >
                <span className="nav-icon">
                  <group.icon size={20} />
                </span>
                {!isCollapsed && <span className="nav-label">{group.label}</span>}
              </NavLink>
            ) : (
              <div
                className={`nav-item group-trigger ${isGroupActive(group) ? 'active' : ''} ${hoveredGroup === group.id ? 'hovered' : ''} ${isCollapsed ? 'collapsed' : ''}`}
                title={isCollapsed ? group.label : undefined}
              >
                <span className="nav-icon">
                  <group.icon size={20} />
                </span>
                {!isCollapsed && (
                  <>
                    <span className="nav-label">{group.label}</span>
                    <ChevronRight
                      size={14}
                      className={`nav-arrow ${hoveredGroup === group.id ? 'rotated' : ''}`}
                    />
                  </>
                )}
              </div>
            )}

            {/* Flyout Menu - Fixed positioning using state */}
            {group.type === 'group' && hoveredGroup === group.id && (
              <div
                className={`flyout-menu-premium ${isCollapsed ? 'from-collapsed' : ''}`}
                style={{
                  top: flyoutPosition.top,
                  left: isCollapsed ? 64 : 200
                }}
                onMouseEnter={() => {
                  if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                  }
                }}
                onMouseLeave={handleMouseLeave}
              >
                <div className="flyout-header">{group.label}</div>
                <div className="flyout-items">
                  {group.subItems.map((subItem) => {
                    const active = isNavPathActive(subItem.path, location.pathname);
                    return (
                      <NavLink
                        key={subItem.path}
                        to={subItem.path}
                        state={
                          group.id === 'engagement' &&
                          (subItem.path === '/employee/eoq/nominate' || subItem.path === '/eoq')
                            ? { returnTo: getCultureReturnTo(location) }
                            : undefined
                        }
                        className={`flyout-item ${active ? 'active' : ''}`}
                        onClick={dismissFlyout}
                      >
                        <span className="flyout-dot" />
                        {subItem.label}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </nav>


      {/* Bottom Section */}
      <div className="sidebar-footer">
        {shouldShowAdminMenu && sessionType !== 'super-admin' && hasModule('SETTINGS') && (
          <NavLink
            to="/admin/settings"
            className={({ isActive }) =>
              `user-menu-item sidebar-settings-link${isActive ? ' active' : ''}${isCollapsed ? ' collapsed' : ''}`
            }
            title={isCollapsed ? 'Settings' : undefined}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Settings size={18} aria-hidden="true" />
            {!isCollapsed && <span>Settings</span>}
          </NavLink>
        )}

        {!shouldShowAdminMenu && (
          <NavLink
            to="/employee/settings"
            className={({ isActive }) =>
              `user-menu-item sidebar-settings-link${isActive ? ' active' : ''}${isCollapsed ? ' collapsed' : ''}`
            }
            title={isCollapsed ? 'Settings' : undefined}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Settings size={18} aria-hidden="true" />
            {!isCollapsed && <span>Settings</span>}
          </NavLink>
        )}

        {/* User Dropdown - keeping the condition for now as it's not used, but allowing logout for all */}
        {showUserMenu && !hasHRRole && (
          <div className="user-menu animate-scaleIn">
            <NavLink
              to={sessionType === 'employee' ? '/employee/profile' : '/admin/profile'}
              className="user-menu-item"
              onClick={() => setShowUserMenu(false)}
            >
              <User size={16} /> My Profile
            </NavLink>
            <NavLink
              to="/help"
              className="user-menu-item"
              onClick={() => setShowUserMenu(false)}
            >
              <HelpCircle size={16} /> Help & Support
            </NavLink>
            <div className="user-menu-divider" />
          </div>
        )}

        <button
          onClick={handleLogout}
          className={`user-menu-item logout${isCollapsed ? ' collapsed' : ''}`}
          style={{
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            padding: isCollapsed ? '10px' : '10px 12px',
            width: '100%',
            color: isCollapsed ? '#ef4444' : undefined,
            display: 'flex',
            alignItems: 'center',
            gap: isCollapsed ? 0 : 10
          }}
          title={isCollapsed ? 'Sign Out' : undefined}
        >
          <LogOut size={18} color={isCollapsed ? '#ef4444' : undefined} />
          {!isCollapsed && <span>Sign Out</span>}
        </button>

        <div
          className={`sidebar-product-brand${isCollapsed ? ' collapsed' : ''}`}
          title="PRAGVA HRMS"
        >
          <div className="sidebar-product-icon" aria-hidden="true" style={{ background: 'transparent', opacity: 1, width: '18px', height: '18px' }}>
            <img 
              src={Logo} 
              alt="Pragva Logo" 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
            />
          </div>
          {!isCollapsed && <span className="sidebar-product-text">PRAGVA HRMS</span>}
        </div>
      </div>
    </aside>
    </>
  );
}
