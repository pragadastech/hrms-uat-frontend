import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Pencil, Trash2, Shield, ToggleLeft, ToggleRight, Loader2,
  LayoutDashboard, Layers, KeyRound, X, Save, Copy
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Header from '../components/Header';
import { adminAPI } from '../services/api';
import './UserAccessControl.css';

const CRUD_OPS = [
  { key: 'create', label: 'Create' },
  { key: 'read', label: 'Read' },
  { key: 'update', label: 'Update' },
  { key: 'delete', label: 'Delete' },
];

const emptyCrud = () => ({ create: false, read: false, update: false, delete: false });

const UI_FEATURE_LAYOUT = [
  {
    title: "People & Organization",
    features: [
      { key: "EMPLOYEE_MANAGEMENT", label: "Employee Management", subFeatures: ["All Employees", "Reporting Management", "Exit Management", "My Exit"] },
      { key: "ORGANIZATION", label: "My Team / My Org", subFeatures: ["My Team", "My Organization"] },
      { key: "PROJECT_MANAGEMENT", label: "Project Management", subFeatures: ["Project Management"] },
      { key: "DOCUMENTS", label: "Documents", subFeatures: ["Documents", "My Documents"] },
      { key: "ASSETS", label: "Assets", subFeatures: ["Assets", "My Assets", "Team Assets"] }
    ]
  },
  {
    title: "Workforce",
    features: [
      { key: "ATTENDANCE", label: "Attendance & Timesheets", subFeatures: ["Attendance & Timesheets"] },
      { key: "TIMESHEETS", label: "Timesheets", subFeatures: ["Timesheets"] },
      { key: "LEAVE_MANAGEMENT", label: "Leaves", subFeatures: ["Leaves"] },
      { key: "WFH", label: "Work From Home", subFeatures: ["Work From Home"] },
      { key: "EXPENSES", label: "Expenses", subFeatures: ["Expenses"] },
      { key: "HOLIDAYS", label: "Holidays", subFeatures: ["Holidays"] }
    ]
  },
  {
    title: "Recruitment",
    features: [
      { key: "EMPLOYEE_MANAGEMENT", label: "Recruitment", subFeatures: ["Recruitment", "Jobs", "Candidates"] }
    ]
  },
  {
    title: "Finance",
    features: [
      { key: "PAYROLL", label: "Finance", subFeatures: ["Payroll", "Payslips", "Payroll Sync"] }
    ]
  },
  {
    title: "Culture",
    features: [
      { key: "NOTICES", label: "Culture & Notices", subFeatures: ["Notice Board", "Complaints", "Achievements", "Employee of the Quarter", "Fun & Wellness", "Notifications"] }
    ]
  },
  {
    title: "Analytics",
    features: [
      { key: "REPORTS", label: "Analytics Reports", subFeatures: ["Leave Report", "Attendance Report", "Timesheet Report"] }
    ]
  },
  {
    title: "Planner",
    features: [
      { key: "PROJECT_MANAGEMENT", label: "Planner", subFeatures: ["Planner"] }
    ]
  },
  {
    title: "Manage Account",
    features: [
      { key: "SETTINGS", label: "Manage Account", subFeatures: ["Users", "Location Settings", "Roles & Permissions", "System Settings"] },
      { key: "ORGANIZATION", label: "Organization Setup", subFeatures: ["Organization Setup"] }
    ]
  }
];

const HR_FEATURE_LAYOUT = [
  {
    title: "Dashboard",
    features: [
      { key: "DASHBOARD", label: "Dashboard" }
    ]
  },
  {
    title: "My Team",
    features: [
      { key: "ORGANIZATION", label: "My Team" }
    ]
  },
  {
    title: "People & Organization",
    features: [
      { key: "EMPLOYEE_MANAGEMENT", label: "All Employees" },
      { key: "EMPLOYEE_MANAGEMENT", label: "Reporting Management" },
      { key: "ORGANIZATION", label: "My Organization" },
      { key: "DOCUMENTS", label: "Documents" },
      { key: "ASSETS", label: "Assets" },
      { key: "EMPLOYEE_MANAGEMENT", label: "Exit Management" },
      { key: "DOCUMENTS", label: "My Documents" },
      { key: "MY_ASSETS", label: "My Assets" },
      { key: "TEAM_ASSETS", label: "Team Assets" },
      { key: "EMPLOYEE_MANAGEMENT", label: "My Exit" }
    ]
  },
  {
    title: "Project Management",
    features: [
      { key: "PROJECT_MANAGEMENT", label: "Project Management" }
    ]
  },
  {
    title: "Workforce",
    features: [
      { key: "ATTENDANCE", label: "Attendance & Timesheets" },
      { key: "LEAVE_MANAGEMENT", label: "Apply Leave" },
      { key: "LEAVE_MANAGEMENT", label: "Leaves" },
      { key: "LEAVE_MANAGEMENT", label: "Leave Adjustments" },
      { key: "WFH", label: "Work From Home" },
      { key: "WFH", label: "Apply WFH" },
      { key: "EXPENSES", label: "Expenses" },
      { key: "EXPENSES", label: "Apply Expenses" },
      { key: "HOLIDAYS", label: "Holidays" }
    ]
  },
  {
    title: "Recruitment",
    features: [
      { key: "EMPLOYEE_MANAGEMENT", label: "Recruitment" }
    ]
  },
  {
    title: "Finance",
    features: [
      { key: "PAYROLL", label: "Finance" }
    ]
  },
  {
    title: "Culture",
    features: [
      { key: "NOTICES", label: "Notice Board" },
      { key: "COMPLAINTS", label: "Complaints" },
      { key: "ACHIEVEMENTS", label: "Achievements" },
      { key: "ACHIEVEMENTS", label: "Employee of the Quarter" },
      { key: "ACHIEVEMENTS", label: "Nominate Employee of the Quarter" },
      { key: "GAMES", label: "Fun & Wellness" },
      { key: "NOTICES", label: "Notifications" }
    ]
  },
  {
    title: "Analytics",
    features: [
      { key: "REPORTS", label: "Analytics" }
    ]
  },
  {
    title: "Planner",
    features: [
      { key: "PROJECT_MANAGEMENT", label: "Planner" }
    ]
  },
  {
    title: "Manage Account",
    features: [
      { key: "SETTINGS", label: "Manage Account" }
    ]
  }
];

const CEO_FEATURE_LAYOUT = [
  {
    title: "Dashboard",
    features: [
      { key: "DASHBOARD", label: "Dashboard" }
    ]
  },
  {
    title: "My Team",
    features: [
      { key: "ORGANIZATION", label: "My Team" }
    ]
  },
  {
    title: "People & Organization",
    features: [
      { key: "EMPLOYEE_MANAGEMENT", label: "All Employees" },
      { key: "EMPLOYEE_MANAGEMENT", label: "Reporting Management" },
      { key: "ORGANIZATION", label: "My Organization" },
      { key: "DOCUMENTS", label: "Documents" },
      { key: "ASSETS", label: "Assets" },
      { key: "EMPLOYEE_MANAGEMENT", label: "Exit Management" },
      { key: "DOCUMENTS", label: "My Documents" },
      { key: "MY_ASSETS", label: "My Assets" },
      { key: "TEAM_ASSETS", label: "Team Assets" },
      { key: "EMPLOYEE_MANAGEMENT", label: "My Exit" }
    ]
  },
  {
    title: "Project Management",
    features: [
      { key: "PROJECT_MANAGEMENT", label: "Project Management" }
    ]
  },
  {
    title: "Workforce",
    features: [
      { key: "ATTENDANCE", label: "Attendance & Timesheets" },
      { key: "LEAVE_MANAGEMENT", label: "Apply Leave" },
      { key: "LEAVE_MANAGEMENT", label: "Leaves" },
      { key: "LEAVE_MANAGEMENT", label: "Leave Adjustments" },
      { key: "WFH", label: "Work From Home" },
      { key: "WFH", label: "Apply WFH" },
      { key: "EXPENSES", label: "Expenses" },
      { key: "EXPENSES", label: "Apply Expenses" },
      { key: "HOLIDAYS", label: "Holidays" }
    ]
  },
  {
    title: "Recruitment",
    features: [
      { key: "EMPLOYEE_MANAGEMENT", label: "Recruitment" }
    ]
  },
  {
    title: "Finance",
    features: [
      { key: "PAYROLL", label: "Finance" }
    ]
  },
  {
    title: "Culture",
    features: [
      { key: "NOTICES", label: "Notice Board" },
      { key: "COMPLAINTS", label: "Complaints" },
      { key: "ACHIEVEMENTS", label: "Achievements" },
      { key: "ACHIEVEMENTS", label: "Employee of the Quarter" },
      { key: "ACHIEVEMENTS", label: "Nominate Employee of the Quarter" },
      { key: "GAMES", label: "Fun & Wellness" },
      { key: "NOTICES", label: "Notifications" }
    ]
  },
  {
    title: "Analytics",
    features: [
      { key: "REPORTS", label: "Analytics" }
    ]
  },
  {
    title: "Planner",
    features: [
      { key: "PROJECT_MANAGEMENT", label: "Planner" }
    ]
  },
  {
    title: "Manage Account",
    features: [
      { key: "SETTINGS", label: "Manage Account" }
    ]
  }
];

const MANAGER_FEATURE_LAYOUT = [
  {
    title: "Dashboard",
    features: [
      { key: "DASHBOARD", label: "Dashboard" }
    ]
  },
  {
    title: "My Team",
    features: [
      { key: "ORGANIZATION", label: "My Team" }
    ]
  },
  {
    title: "Project Management",
    features: [
      { key: "PROJECT_MANAGEMENT", label: "Project Management" }
    ]
  },
  {
    title: "Workforce",
    features: [
      { key: "ATTENDANCE", label: "Attendance & Timesheets" },
      { key: "LEAVE_MANAGEMENT", label: "My Leaves" },
      { key: "WFH", label: "Work From Home" },
      { key: "EXPENSES", label: "My Expenses" },
      { key: "EXPENSES", label: "Team Expenses" },
      { key: "HOLIDAYS", label: "Holidays" }
    ]
  },
  {
    title: "People & Org",
    features: [
      { key: "DOCUMENTS", label: "Documents" },
      { key: "MY_ASSETS", label: "My Assets" },
      { key: "TEAM_ASSETS", label: "Team Assets" },
      { key: "EMPLOYEE_MANAGEMENT", label: "Exit Management" }
    ]
  },
  {
    title: "Planner",
    features: [
      { key: "PROJECT_MANAGEMENT", label: "Planner" }
    ]
  },
  {
    title: "Finance",
    features: [
      { key: "PAYROLL", label: "Finance" }
    ]
  },
  {
    title: "Culture",
    features: [
      { key: "NOTICES", label: "Notice Board" },
      { key: "COMPLAINTS", label: "Complaints" },
      { key: "ACHIEVEMENTS", label: "Achievements" },
      { key: "ACHIEVEMENTS", label: "Nominate EOQ" },
      { key: "ACHIEVEMENTS", label: "Employee of the Quarter" },
      { key: "GAMES", label: "Fun & Wellness" },
      { key: "NOTICES", label: "Notifications" }
    ]
  },
  {
    title: "Team Analytics",
    features: [
      { key: "REPORTS", label: "Team Overview" },
      { key: "REPORTS", label: "Leave Analytics" },
      { key: "REPORTS", label: "Timesheet Analytics" },
      { key: "REPORTS", label: "Team WFH" }
    ]
  }
];

const MASTER_SIDEBAR_LAYOUT = [
  {
    title: "Dashboard",
    icon: "🏠",
    code: "DASHBOARD",
    features: [
      { name: "Dashboard", code: "DASHBOARD_DASHBOARD_VIEW", allowedOps: [] }
    ]
  },
  {
    title: "People & Organization",
    icon: "👥",
    code: "PEOPLE_ORG",
    features: [
      { name: "All Employees", code: "PEOPLE_ORG_EMPLOYEES", allowedOps: ['create', 'read', 'update', 'delete'], codeMapping: { create: "PEOPLE_ORG_EMPLOYEES_CREATE", read: "PEOPLE_ORG_EMPLOYEES_VIEW", update: "PEOPLE_ORG_EMPLOYEES_UPDATE", delete: "PEOPLE_ORG_EMPLOYEES_DELETE" }, defaultScope: "ORGANIZATION" },
      { name: "Reporting Management", code: "PEOPLE_ORG_REPORTING", allowedOps: ['read', 'update'], codeMapping: { read: "PEOPLE_ORG_REPORTING_VIEW", update: "PEOPLE_ORG_REPORTING_MANAGE" }, defaultScope: "ORGANIZATION" },
      { name: "My Team", code: "PEOPLE_ORG_REPORTING_VIEW", allowedOps: ['read', 'update'], codeMapping: { read: "PEOPLE_ORG_REPORTING_VIEW", update: "PEOPLE_ORG_REPORTING_MANAGE" }, defaultScope: "TEAM", allowedScopes: ['TEAM', 'DEPARTMENT', 'ORGANIZATION', 'TENANT'] },
      { name: "My Organization", code: "PEOPLE_ORG_ORGANIZATION", allowedOps: ['read', 'update'], codeMapping: { read: "PEOPLE_ORG_ORGANIZATION_VIEW", update: "PEOPLE_ORG_ORGANIZATION_MANAGE" }, defaultScope: "ORGANIZATION" },
      { name: "Documents", code: "PEOPLE_ORG_DOCUMENTS_VIEW", allowedOps: ['create', 'read', 'update', 'delete'], codeMapping: { create: "PEOPLE_ORG_DOCUMENTS_MANAGE", read: "PEOPLE_ORG_DOCUMENTS_VIEW", update: "PEOPLE_ORG_DOCUMENTS_MANAGE", delete: "PEOPLE_ORG_DOCUMENTS_MANAGE" }, defaultScope: "DEPARTMENT", allowedScopes: ['OWN', 'SELF', 'TEAM', 'DEPARTMENT', 'ORGANIZATION', 'TENANT'] },
      { name: "My Documents", code: "PEOPLE_ORG_DOCUMENTS_VIEW", allowedOps: ['create', 'read', 'update', 'delete'], codeMapping: { create: "PEOPLE_ORG_DOCUMENTS_MANAGE", read: "PEOPLE_ORG_DOCUMENTS_VIEW", update: "PEOPLE_ORG_DOCUMENTS_MANAGE", delete: "PEOPLE_ORG_DOCUMENTS_MANAGE" }, defaultScope: "OWN", allowedScopes: ['OWN', 'SELF'] },
      { name: "Assets", code: "PEOPLE_ORG_ASSETS", allowedOps: ['read', 'update'], codeMapping: { read: "PEOPLE_ORG_ASSETS_VIEW", update: "PEOPLE_ORG_ASSETS_MANAGE" }, defaultScope: "ORGANIZATION", allowedScopes: ['ORGANIZATION', 'TENANT'] },
      { name: "My Assets", code: "PEOPLE_ORG_ASSETS_VIEW", allowedOps: ['create', 'read', 'update', 'delete'], codeMapping: { create: "PEOPLE_ORG_ASSETS_CREATE", read: "PEOPLE_ORG_ASSETS_VIEW", update: "PEOPLE_ORG_ASSETS_UPDATE", delete: "PEOPLE_ORG_ASSETS_DELETE" }, defaultScope: "OWN", allowedScopes: ['OWN', 'SELF'] },
      { name: "Team Assets", code: "PEOPLE_ORG_ASSETS_TEAM", allowedOps: ['create', 'read', 'update', 'delete'], codeMapping: { create: "PEOPLE_ORG_ASSETS_CREATE", read: "PEOPLE_ORG_ASSETS_VIEW", update: "PEOPLE_ORG_ASSETS_UPDATE", delete: "PEOPLE_ORG_ASSETS_DELETE" }, defaultScope: "TEAM", allowedScopes: ['TEAM', 'DEPARTMENT'] },
      { name: "Exit Management", code: "PEOPLE_ORG_EXIT", allowedOps: ['create', 'read', 'update', 'delete'], codeMapping: { create: "PEOPLE_ORG_EXIT_MANAGE", read: "PEOPLE_ORG_EXIT_VIEW", update: "PEOPLE_ORG_EXIT_MANAGE", delete: "PEOPLE_ORG_EXIT_MANAGE" }, defaultScope: "TEAM", allowedScopes: ['OWN', 'SELF', 'TEAM', 'DEPARTMENT', 'ORGANIZATION', 'TENANT'] },
      { name: "My Exit", code: "PEOPLE_ORG_EXIT_VIEW", allowedOps: ['create', 'read', 'update', 'delete'], codeMapping: { create: "PEOPLE_ORG_EXIT_MANAGE", read: "PEOPLE_ORG_EXIT_VIEW", update: "PEOPLE_ORG_EXIT_MANAGE", delete: "PEOPLE_ORG_EXIT_MANAGE" }, defaultScope: "OWN", allowedScopes: ['OWN', 'SELF'] }
    ]
  },
  {
    title: "Project Management",
    icon: "📁",
    code: "PROJECT_MANAGEMENT",
    features: [
      { name: "Project Management", code: "PROJECT_MANAGEMENT_PROJECTS", allowedOps: ['create', 'read', 'update', 'delete'], codeMapping: { create: "PROJECT_MANAGEMENT_PROJECTS_CREATE", read: "PROJECT_MANAGEMENT_PROJECTS_VIEW", update: "PROJECT_MANAGEMENT_PROJECTS_UPDATE", delete: "PROJECT_MANAGEMENT_PROJECTS_DELETE" }, defaultScope: "TEAM" }
    ]
  },
  {
    title: "Workforce",
    icon: "👨💼",
    code: "WORKFORCE",
    features: [
      { name: "Attendance & Timesheets", code: "WORKFORCE_ATTENDANCE_VIEW", allowedOps: ['read'], codeMapping: { read: "WORKFORCE_ATTENDANCE_VIEW,WORKFORCE_TIMESHEETS_VIEW" }, defaultScope: "ORGANIZATION", allowedScopes: ['OWN', 'SELF', 'TEAM', 'DEPARTMENT', 'ORGANIZATION', 'TENANT'] },
      { name: "Attendance Clock-in", code: "WORKFORCE_ATTENDANCE_CLOCK", allowedOps: ['create'], codeMapping: { create: "WORKFORCE_ATTENDANCE_CLOCK" }, defaultScope: "OWN", allowedScopes: ['OWN', 'SELF'] },
      { name: "My Leaves", code: "WORKFORCE_LEAVE_SELF", allowedOps: ['create', 'read', 'update'], codeMapping: { create: "WORKFORCE_LEAVE_APPLY", read: "WORKFORCE_LEAVE_VIEW", update: "WORKFORCE_LEAVE_CANCEL" }, defaultScope: "OWN", allowedScopes: ['OWN', 'SELF'] },
      { name: "Leaves", code: "WORKFORCE_LEAVE", allowedOps: ['create', 'read', 'update', 'delete'], codeMapping: { create: "WORKFORCE_LEAVE_APPLY", read: "WORKFORCE_LEAVE_VIEW", update: "WORKFORCE_LEAVE_UPDATE", delete: "WORKFORCE_LEAVE_APPROVE" }, defaultScope: "ORGANIZATION", allowedScopes: ['TEAM', 'DEPARTMENT', 'ORGANIZATION', 'TENANT'] },
      { name: "Leave Adjustments", code: "WORKFORCE_LEAVE_ADJUST", allowedOps: ['update'], codeMapping: { update: "WORKFORCE_LEAVE_ADJUST" }, defaultScope: "ORGANIZATION" },
      { name: "Work From Home", code: "WORKFORCE_WFH_SELF", allowedOps: ['create', 'read', 'update'], codeMapping: { create: "WORKFORCE_WFH_APPLY", read: "WORKFORCE_WFH_VIEW", update: "WORKFORCE_WFH_CANCEL" }, defaultScope: "OWN", allowedScopes: ['OWN', 'SELF'] },
      { name: "Team WFH Approvals", code: "WORKFORCE_WFH_TEAM", allowedOps: ['read', 'update'], codeMapping: { read: "WORKFORCE_WFH_VIEW", update: "WORKFORCE_WFH_APPROVE" }, defaultScope: "TEAM", allowedScopes: ['TEAM', 'DEPARTMENT', 'ORGANIZATION', 'TENANT'] },
      { name: "My Expenses", code: "WORKFORCE_EXPENSES_SELF", allowedOps: ['create', 'read', 'update', 'delete'], codeMapping: { create: "WORKFORCE_EXPENSES_APPLY", read: "WORKFORCE_EXPENSES_VIEW", update: "WORKFORCE_EXPENSES_UPDATE", delete: "WORKFORCE_EXPENSES_DELETE" }, defaultScope: "OWN", allowedScopes: ['OWN', 'SELF'] },
      { name: "Team Expenses", code: "WORKFORCE_EXPENSES_TEAM", allowedOps: ['create', 'read', 'update', 'delete'], codeMapping: { create: "WORKFORCE_EXPENSES_APPLY", read: "WORKFORCE_EXPENSES_VIEW", update: "WORKFORCE_EXPENSES_APPROVE", delete: "WORKFORCE_EXPENSES_DELETE" }, defaultScope: "TEAM", allowedScopes: ['TEAM', 'DEPARTMENT', 'ORGANIZATION', 'TENANT'] },
      { name: "Holidays", code: "WORKFORCE_HOLIDAYS_VIEW", allowedOps: ['read'], codeMapping: { read: "WORKFORCE_HOLIDAYS_VIEW" }, defaultScope: "ORGANIZATION" }
    ]
  },
  {
    title: "Recruitment",
    icon: "🎯",
    code: "RECRUITMENT",
    features: [
      { name: "Recruitment", code: "RECRUITMENT_RECRUITMENT", allowedOps: ['read', 'update'], codeMapping: { read: "RECRUITMENT_RECRUITMENT_VIEW", update: "RECRUITMENT_RECRUITMENT_MANAGE" }, defaultScope: "ORGANIZATION" }
    ]
  },
  {
    title: "Finance",
    icon: "💰",
    code: "FINANCE",
    features: [
      { name: "Finance & Payroll", code: "FINANCE_PAYROLL", allowedOps: ['read', 'update', 'delete'], codeMapping: { read: "FINANCE_PAYROLL_VIEW", update: "FINANCE_PAYROLL_MANAGE", delete: "FINANCE_PAYROLL_EXPORT" }, defaultScope: "ORGANIZATION" },
      { name: "Payroll Sync", code: "FINANCE_PAYROLL_SYNC", allowedOps: ['read', 'update'], codeMapping: { read: "FINANCE_PAYROLL_SYNC_VIEW", update: "FINANCE_PAYROLL_SYNC_MANAGE" }, defaultScope: "ORGANIZATION" }
    ]
  },
  {
    title: "Culture",
    icon: "🎉",
    code: "CULTURE",
    features: [
      { name: "Notice Board", code: "CULTURE_NOTICE_BOARD", allowedOps: ['create', 'read', 'update', 'delete'], codeMapping: { create: "CULTURE_NOTICE_BOARD_CREATE", read: "CULTURE_NOTICE_BOARD_VIEW", update: "CULTURE_NOTICE_BOARD_UPDATE", delete: "CULTURE_NOTICE_BOARD_DELETE" }, defaultScope: "TENANT" },
      { name: "Complaints", code: "CULTURE_COMPLAINTS", allowedOps: ['create', 'read', 'update', 'delete'], codeMapping: { create: "CULTURE_COMPLAINTS_CREATE", read: "CULTURE_COMPLAINTS_VIEW", update: "CULTURE_COMPLAINTS_UPDATE", delete: "CULTURE_COMPLAINTS_DELETE" }, defaultScope: "OWN" },
      { name: "Achievements", code: "CULTURE_ACHIEVEMENTS", allowedOps: ['create', 'read', 'update'], codeMapping: { create: "CULTURE_ACHIEVEMENTS_CREATE", read: "CULTURE_ACHIEVEMENTS_VIEW", update: "CULTURE_ACHIEVEMENTS_MANAGE" }, defaultScope: "TENANT" },
      { name: "Employee of the Quarter", code: "CULTURE_EMPLOYEE_OF_QUARTER", allowedOps: ['create', 'read', 'update', 'delete'], codeMapping: { create: "CULTURE_EMPLOYEE_OF_QUARTER_NOMINATE", read: "CULTURE_EMPLOYEE_OF_QUARTER_VIEW", update: "CULTURE_EMPLOYEE_OF_QUARTER_APPROVE", delete: "CULTURE_EMPLOYEE_OF_QUARTER_MANAGE" }, defaultScope: "TENANT" },
      { name: "Fun & Wellness", code: "CULTURE_FUN_WELLNESS", allowedOps: ['create', 'read', 'update', 'delete'], codeMapping: { create: "CULTURE_FUN_WELLNESS_CREATE", read: "CULTURE_FUN_WELLNESS_VIEW", update: "CULTURE_FUN_WELLNESS_UPDATE", delete: "CULTURE_FUN_WELLNESS_DELETE" }, defaultScope: "TENANT" },
      { name: "Notifications", code: "CULTURE_NOTIFICATIONS", allowedOps: ['read', 'update'], codeMapping: { read: "CULTURE_NOTIFICATIONS_VIEW", update: "CULTURE_NOTIFICATIONS_MANAGE" }, defaultScope: "OWN" }
    ]
  },
  {
    title: "Analytics",
    icon: "📊",
    code: "ANALYTICS",
    features: [
      { name: "Leave Report", code: "ANALYTICS_LEAVE_VIEW", allowedOps: ['read'], codeMapping: { read: "ANALYTICS_LEAVE_VIEW" }, defaultScope: "ORGANIZATION" },
      { name: "Attendance Report", code: "ANALYTICS_ATTENDANCE_VIEW", allowedOps: ['read'], codeMapping: { read: "ANALYTICS_ATTENDANCE_VIEW" }, defaultScope: "ORGANIZATION" },
      { name: "Timesheet Report", code: "ANALYTICS_TIMESHEET_VIEW", allowedOps: ['read'], codeMapping: { read: "ANALYTICS_TIMESHEET_VIEW" }, defaultScope: "ORGANIZATION" }
    ]
  },
  {
    title: "Team Analytics",
    icon: "📊",
    code: "TEAM_ANALYTICS",
    features: [
      { name: "Team Overview", code: "TEAM_ANALYTICS_TEAM_OVERVIEW_VIEW", allowedOps: [], defaultScope: "TEAM" },
      { name: "Attendance Analytics", code: "TEAM_ANALYTICS_ATTENDANCE_ANALYTICS_VIEW", allowedOps: [], defaultScope: "TEAM" },
      { name: "Leave Analytics", code: "TEAM_ANALYTICS_LEAVE_ANALYTICS_VIEW", allowedOps: [], defaultScope: "TEAM" },
      { name: "Timesheet Analytics", code: "TEAM_ANALYTICS_TIMESHEET_ANALYTICS_VIEW", allowedOps: [], defaultScope: "TEAM" },
      { name: "Team WFH", code: "TEAM_ANALYTICS_TEAM_WFH_VIEW", allowedOps: [], defaultScope: "TEAM" }
    ]
  },
  {
    title: "Planner",
    icon: "📅",
    code: "PLANNER",
    features: [
      { name: "Planner", code: "PLANNER_PLANNER_VIEW", allowedOps: [], defaultScope: "TENANT" }
    ]
  },
  {
    title: "Manage Account",
    icon: "⚙️",
    code: "MANAGE_ACCOUNT",
    features: [
      { name: "Users", code: "MANAGE_ACCOUNT_USERS", allowedOps: ['create', 'read', 'update', 'delete'], codeMapping: { create: "MANAGE_ACCOUNT_USERS_CREATE", read: "MANAGE_ACCOUNT_USERS_VIEW", update: "MANAGE_ACCOUNT_USERS_UPDATE", delete: "MANAGE_ACCOUNT_USERS_DELETE" }, defaultScope: "TENANT" },
      { name: "Organization Setup", code: "PEOPLE_ORG_ORGANIZATION_MANAGE", allowedOps: ['update'], defaultScope: "TENANT" },
      { name: "Location Settings", code: "PEOPLE_ORG_ORGANIZATION_MANAGE_LOC", allowedOps: ['update'], codeMapping: { update: "PEOPLE_ORG_ORGANIZATION_MANAGE" }, defaultScope: "TENANT" },
      { name: "Roles & Permissions", code: "MANAGE_ACCOUNT_ROLES_PERMISSIONS", allowedOps: ['create', 'read', 'update', 'delete'], codeMapping: { create: "MANAGE_ACCOUNT_ROLES_PERMISSIONS_CREATE", read: "MANAGE_ACCOUNT_ROLES_PERMISSIONS_VIEW", update: "MANAGE_ACCOUNT_ROLES_PERMISSIONS_UPDATE", delete: "MANAGE_ACCOUNT_ROLES_PERMISSIONS_DELETE" }, defaultScope: "TENANT" },
      { name: "System Settings", code: "MANAGE_ACCOUNT_SYSTEM_SETTINGS", allowedOps: ['read', 'update'], codeMapping: { read: "MANAGE_ACCOUNT_SYSTEM_SETTINGS_VIEW", update: "MANAGE_ACCOUNT_SYSTEM_SETTINGS_MANAGE" }, defaultScope: "TENANT" }
    ]
  }
];

const ROLE_SIDEBAR_FEATURES = {
  ADMIN: [
    "Dashboard",
    "All Employees", "Reporting Management", "My Team", "My Organization", "Project Management", "Documents", "My Documents", "Assets", "My Assets", "Team Assets", "Exit Management", "My Exit",
    "Attendance & Timesheets", "Attendance Clock-in", "My Leaves", "Leaves", "Leave Adjustments", "Work From Home", "Team WFH Approvals", "My Expenses", "Team Expenses", "Holidays",
    "Recruitment", "Finance & Payroll", "Payroll Sync",
    "Notice Board", "Complaints", "Achievements", "Employee of the Quarter", "Fun & Wellness", "Notifications",
    "Leave Report", "Attendance Report", "Timesheet Report",
    "Planner",
    "Users", "Organization Setup", "Location Settings", "Roles & Permissions", "System Settings"
  ],
  CEO: [
    "Dashboard", "My Team",
    "All Employees", "Reporting Management", "My Organization", "Documents", "Assets", "Exit Management", "My Documents", "My Assets", "Team Assets", "My Exit",
    "Project Management",
    "Attendance & Timesheets", "Attendance Clock-in", "My Leaves", "Leaves", "Leave Adjustments", "Work From Home", "Team WFH Approvals", "My Expenses", "Team Expenses", "Holidays",
    "Recruitment", "Finance & Payroll", "Payroll Sync",
    "Notice Board", "Complaints", "Achievements", "Employee of the Quarter", "Nominate Employee of the Quarter", "Fun & Wellness", "Notifications",
    "Leave Report", "Attendance Report", "Timesheet Report",
    "Planner",
    "Users", "Organization Setup", "Location Settings", "Roles & Permissions", "System Settings"
  ],
  HR: [
    "Dashboard", "My Team",
    "All Employees", "Reporting Management", "My Organization", "Documents", "Assets", "Exit Management", "My Documents", "My Assets", "Team Assets", "My Exit",
    "Project Management",
    "Attendance & Timesheets", "Attendance Clock-in", "My Leaves", "Leaves", "Leave Adjustments", "Work From Home", "Team WFH Approvals", "My Expenses", "Team Expenses", "Holidays",
    "Recruitment", "Finance & Payroll", "Payroll Sync",
    "Notice Board", "Complaints", "Achievements", "Employee of the Quarter", "Nominate Employee of the Quarter", "Fun & Wellness", "Notifications",
    "Leave Report", "Attendance Report", "Timesheet Report",
    "Planner",
    "Users", "Organization Setup", "Location Settings", "Roles & Permissions", "System Settings"
  ],
  MANAGER: [
    "Dashboard",
    "My Team", "Documents", "My Assets", "Team Assets", "Exit Management",
    "Project Management",
    "Attendance & Timesheets", "My Leaves", "Work From Home", "My Expenses", "Team Expenses", "Holidays",
    "Finance & Payroll",
    "Notice Board", "Complaints", "Achievements", "Nominate Employee of the Quarter", "Employee of the Quarter", "Fun & Wellness", "Notifications",
    "Team Overview", "Attendance Analytics", "Leave Analytics", "Timesheet Analytics", "Team WFH",
    "Planner"
  ],
  EMPLOYEE: [
    "Dashboard",
    "Attendance & Timesheets", "My Leaves", "Work From Home", "My Expenses", "Holidays",
    "Documents", "My Assets", "Exit Management",
    "Finance & Payroll",
    "Notice Board", "Complaints", "Achievements", "Nominate Employee of the Quarter", "Employee of the Quarter", "Fun & Wellness", "Notifications",
    "Planner"
  ]
};

export default function UserAccessControl() {
  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState({ features: {}, dashboardWidgets: {}, permissions: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activePanel, setActivePanel] = useState('features'); // features | crud | dashboard | permissions
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ roleName: '', description: '' });
  const [editForm, setEditForm] = useState({ roleName: '', description: '', isActive: true });
  const [enabledModules, setEnabledModules] = useState([]);
  const [moduleCrud, setModuleCrud] = useState({});
  const [dashboardWidgets, setDashboardWidgets] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [selectedRolePermissions, setSelectedRolePermissions] = useState([]);
  const [search, setSearch] = useState('');
  const [moduleSearch, setModuleSearch] = useState('');

  const allowedScopesMap = useMemo(() => {
    const map = {};
    if (catalog.modules) {
      catalog.modules.forEach(m => {
        m.features.forEach(f => {
          f.actions.forEach(a => {
            const code = a.code || `${m.code}_${f.code}_${a.action}`.toUpperCase();
            map[code] = a.allowedScopes || ['OWN', 'TEAM', 'DEPARTMENT', 'ORGANIZATION', 'TENANT'];
          });
        });
      });
    }
    return map;
  }, [catalog.modules]);

  const getFeaturePermissions = useCallback((feature) => {
    if (feature.allowedOps && feature.allowedOps.length > 0) {
      return feature.allowedOps.flatMap(op => {
        const val = feature.codeMapping?.[op] || `${feature.code}_${op.toUpperCase()}`;
        return val.includes(',') ? val.split(',').map(s => s.trim()) : [val];
      });
    }
    return [feature.code];
  }, []);

  const getMinScope = useCallback((allowedScopes) => {
    const scopesOrder = ['OWN', 'SELF', 'TEAM', 'DEPARTMENT', 'ORGANIZATION', 'TENANT'];
    let minIdx = 999;
    let minScope = 'OWN';
    allowedScopes.forEach(s => {
      const idx = scopesOrder.indexOf(s);
      if (idx !== -1 && idx < minIdx) {
        minIdx = idx;
        minScope = s;
      }
    });
    return minScope;
  }, []);

  const isScopeSufficient = useCallback((userScope, allowedScopes) => {
    const scopesOrder = ['OWN', 'SELF', 'TEAM', 'DEPARTMENT', 'ORGANIZATION', 'TENANT'];
    const minScope = getMinScope(allowedScopes);
    const uScope = (userScope === 'SELF' || userScope === 'OWN') ? 'OWN' : userScope;
    const mScope = (minScope === 'SELF' || minScope === 'OWN') ? 'OWN' : minScope;
    const uIdx = scopesOrder.indexOf(uScope);
    const mIdx = scopesOrder.indexOf(mScope);
    return uIdx !== -1 && mIdx !== -1 && uIdx >= mIdx;
  }, [getMinScope]);

  const getFeatureScope = useCallback((feature) => {
    const codes = getFeaturePermissions(feature);
    const allowedScopes = feature.allowedScopes || ['OWN', 'SELF', 'TEAM', 'DEPARTMENT', 'ORGANIZATION', 'TENANT'];
    
    // Look for exact code matches first to find the scope
    const match = selectedRolePermissions.find(rp => codes.includes(rp.permissionCode));
    if (match && isScopeSufficient(match.scope || 'OWN', allowedScopes)) {
      return match.scope;
    }
    return feature.defaultScope || 'OWN';
  }, [selectedRolePermissions, getFeaturePermissions, isScopeSufficient]);

  const isFeatureEnabled = useCallback((feature) => {
    const codes = getFeaturePermissions(feature);
    const allowedScopes = feature.allowedScopes || ['OWN', 'SELF', 'TEAM', 'DEPARTMENT', 'ORGANIZATION', 'TENANT'];
    return codes.some(c => selectedRolePermissions.some(rp => rp.permissionCode === c && (rp.scope === 'SELF' || rp.scope === 'OWN' || isScopeSufficient(rp.scope || 'OWN', allowedScopes))));
  }, [selectedRolePermissions, getFeaturePermissions, isScopeSufficient]);

  const handleToggleFeature = useCallback((feature, enable) => {
    const codes = getFeaturePermissions(feature);
    const scope = getFeatureScope(feature);
    const allowedScopes = feature.allowedScopes || ['OWN', 'SELF', 'TEAM', 'DEPARTMENT', 'ORGANIZATION', 'TENANT'];
    setSelectedRolePermissions(prev => {
      const without = prev.filter(rp => !(codes.includes(rp.permissionCode) && isScopeSufficient(rp.scope || 'OWN', allowedScopes)));
      if (!enable) return without;
      const newPerms = codes.map(c => ({
        permissionCode: c,
        scope: scope
      }));
      return [...without, ...newPerms];
    });
  }, [getFeaturePermissions, getFeatureScope, isScopeSufficient]);

  const currentLayout = useMemo(() => {
    // Dynamically filter features from the master layout config based on role requirements
    if (detail && detail.roleName) {
      const roleNameUpper = detail.roleName.toUpperCase();
      const visibleNames = ROLE_SIDEBAR_FEATURES[roleNameUpper] || null;
      if (visibleNames) {
        return MASTER_SIDEBAR_LAYOUT.map(module => {
          const filteredFeatures = module.features.filter(f => visibleNames.includes(f.name));
          if (filteredFeatures.length === 0) return null;
          // Deep clone the module object and its features to break reference sharing
          return { 
            ...module, 
            features: filteredFeatures.map(f => ({ ...f })) 
          };
        }).filter(Boolean);
      }
    }
    return MASTER_SIDEBAR_LAYOUT;
  }, [detail]);

  const handleToggleModuleAll = useCallback((moduleCode, enable) => {
    const currentRoleUpper = (detail?.roleName || detail?.name || '').toUpperCase();
    const visibleNames = ROLE_SIDEBAR_FEATURES[currentRoleUpper] || null;
    const moduleItem = currentLayout.find(m => m.title.toUpperCase() === moduleCode.toUpperCase() || m.code === moduleCode);
    if (!moduleItem) return;
    
    const features = moduleItem.features;
    setSelectedRolePermissions(prev => {
      let next = [...prev];
      features.forEach(f => {
        const codes = getFeaturePermissions(f);
        const scope = f.defaultScope || 'OWN';
        const allowedScopes = f.allowedScopes || ['OWN', 'SELF', 'TEAM', 'DEPARTMENT', 'ORGANIZATION', 'TENANT'];
        next = next.filter(rp => !(codes.includes(rp.permissionCode) && isScopeSufficient(rp.scope || 'OWN', allowedScopes)));
        if (enable) {
          codes.forEach(c => {
            next.push({ permissionCode: c, scope });
          });
        }
      });
      return next;
    });
  }, [detail, currentLayout, getFeaturePermissions, isScopeSufficient]);

  const isOpChecked = useCallback((feature, op) => {
    const rawCode = feature.codeMapping?.[op] || `${feature.code}_${op.toUpperCase()}`;
    const codes = rawCode.includes(',') ? rawCode.split(',').map(s => s.trim()) : [rawCode];
    const allowedScopes = feature.allowedScopes || ['OWN', 'SELF', 'TEAM', 'DEPARTMENT', 'ORGANIZATION', 'TENANT'];
    return codes.every(c => selectedRolePermissions.some(rp => rp.permissionCode === c && isScopeSufficient(rp.scope || 'OWN', allowedScopes)));
  }, [selectedRolePermissions, isScopeSufficient]);

  const handleToggleOp = useCallback((feature, op, enable) => {
    const rawCode = feature.codeMapping?.[op] || `${feature.code}_${op.toUpperCase()}`;
    const codes = rawCode.includes(',') ? rawCode.split(',').map(s => s.trim()) : [rawCode];
    const scope = getFeatureScope(feature);
    const allowedScopes = feature.allowedScopes || ['OWN', 'SELF', 'TEAM', 'DEPARTMENT', 'ORGANIZATION', 'TENANT'];
    setSelectedRolePermissions(prev => {
      const without = prev.filter(rp => !(codes.includes(rp.permissionCode) && isScopeSufficient(rp.scope || 'OWN', allowedScopes)));
      if (!enable) return without;
      const newPerms = codes.map(c => ({ permissionCode: c, scope }));
      return [...without, ...newPerms];
    });
  }, [getFeatureScope, isScopeSufficient]);

  const handleFeatureScopeChange = useCallback((feature, scopeVal) => {
    const codes = getFeaturePermissions(feature);
    setSelectedRolePermissions(prev =>
      prev.map(rp => codes.includes(rp.permissionCode) ? { ...rp, scope: scopeVal } : rp)
    );
  }, [getFeaturePermissions]);

  const featureEntries = useMemo(() => {
    const rawEntries = Object.entries(catalog.features || {});
    const hasAssets = rawEntries.some(([key]) => key === 'ASSETS');
    const result = [...rawEntries];
    if (hasAssets) {
      result.push(['MY_ASSETS', 'My Assets']);
      result.push(['TEAM_ASSETS', 'Team Assets']);
    }
    return result.sort((a, b) => a[1].localeCompare(b[1]));
  }, [catalog.features]);

  const filteredFeatureEntries = useMemo(() => {
    let entries = featureEntries;
    
    if (detail && detail.roleName) {
      const roleNameUpper = detail.roleName.toUpperCase();
      if (roleNameUpper === 'EMPLOYEE') {
        const employeeKeys = [
          'DASHBOARD', 'ATTENDANCE', 'LEAVE_MANAGEMENT', 'WFH', 'EXPENSES', 
          'HOLIDAYS', 'WORK_STATUS', 'DOCUMENTS', 'ASSETS', 'MY_ASSETS', 'TEAM_ASSETS', 'EMPLOYEE_MANAGEMENT', 
          'PAYROLL', 'NOTICES', 'COMPLAINTS', 'ACHIEVEMENTS', 'GAMES'
        ];
        entries = entries.filter(([key]) => employeeKeys.includes(key.toUpperCase()));
      } else if (roleNameUpper === 'MANAGER') {
        const managerKeys = [
          'DASHBOARD', 'ATTENDANCE', 'TIMESHEETS', 'LEAVE_MANAGEMENT', 'WFH', 
          'EXPENSES', 'HOLIDAYS', 'WORK_STATUS', 'DOCUMENTS', 'ASSETS', 'MY_ASSETS', 'TEAM_ASSETS', 
          'EMPLOYEE_MANAGEMENT', 'PAYROLL', 'NOTICES', 'COMPLAINTS', 'ACHIEVEMENTS', 
          'GAMES', 'ORGANIZATION', 'PROJECT_MANAGEMENT'
        ];
        entries = entries.filter(([key]) => managerKeys.includes(key.toUpperCase()));
      }
    }

    const q = moduleSearch.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(([key, label]) =>
      label.toLowerCase().includes(q) || key.toLowerCase().includes(q)
    );
  }, [featureEntries, moduleSearch, detail]);

  const widgetEntries = useMemo(
    () => Object.entries(catalog.dashboardWidgets || {}).sort((a, b) => a[1].localeCompare(b[1])),
    [catalog.dashboardWidgets]
  );

  const filteredWidgetEntries = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    if (!q) return widgetEntries;
    return widgetEntries.filter(([key, label]) =>
      label.toLowerCase().includes(q) || key.toLowerCase().includes(q)
    );
  }, [widgetEntries, moduleSearch]);

  const filteredPermissions = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    const perms = catalog.permissions || [];
    if (!q) return perms;
    return perms.filter((p) =>
      p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)
    );
  }, [catalog.permissions, moduleSearch]);

  const filteredRoles = useMemo(() => {
    // Hide 'ORG_ADMIN' / 'Org Admin' role from User Access Control roles list
    const visibleRoles = roles.filter((r) => {
      const name = String(r.roleName || r.name || '').toUpperCase();
      return name !== 'ORG_ADMIN' && name !== 'ORG ADMIN';
    });

    const q = search.trim().toLowerCase();
    if (!q) return visibleRoles;
    return visibleRoles.filter((r) =>
      String(r.roleName || r.name || '').toLowerCase().includes(q)
      || String(r.description || '').toLowerCase().includes(q)
    );
  }, [roles, search]);

  const loadRoles = useCallback(async () => {
    try {
      const [rolesRes, catalogRes] = await Promise.all([
        adminAPI.getAllEmployeeRoles(),
        adminAPI.getRolePermissionCatalog(),
      ]);
      setRoles(Array.isArray(rolesRes.data) ? rolesRes.data : []);
      setCatalog(catalogRes.data || { features: {}, dashboardWidgets: {}, permissions: [] });
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id) => {
    if (!id) return;
    setDetailLoading(true);
    try {
      const res = await adminAPI.getEmployeeRoleById(id);
      const data = res.data || {};
      setDetail(data);
      setEditForm({
        roleName: data.roleName || data.designation || data.displayName || data.name || '',
        description: data.description || '',
        isActive: data.isActive !== false,
      });
      const modules = Array.isArray(data.enabledModules)
        ? data.enabledModules
        : Object.keys(catalog.features || {});
      setEnabledModules(modules);
      setModuleCrud(data.moduleCrud || {});
      setDashboardWidgets(
        Array.isArray(data.dashboardWidgets)
          ? data.dashboardWidgets
          : Object.keys(catalog.dashboardWidgets || {})
      );
      setSelectedPermissions(Array.isArray(data.permissions) ? data.permissions : []);
      setSelectedRolePermissions(Array.isArray(data.rolePermissions) ? data.rolePermissions : []);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to load role details');
    } finally {
      setDetailLoading(false);
    }
  }, [catalog.features, catalog.dashboardWidgets]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId);
    }
  }, [selectedId, loadDetail]);

  useEffect(() => {
    if (!selectedId && roles.length > 0) {
      setSelectedId(roles[0].id);
    }
  }, [roles, selectedId]);

  const toggleModule = (key) => {
    setEnabledModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleAllModules = (on) => {
    setEnabledModules(on ? featureEntries.map(([k]) => k) : ['DASHBOARD', 'SETTINGS', 'ORGANIZATION']);
  };

  const isOpBlockedForRole = (roleName, moduleKey, opKey) => {
    if (!roleName) return false;
    const roleUpper = roleName.toUpperCase();
    if (roleUpper === 'EMPLOYEE') {
      const blocked = {
        EMPLOYEE_MANAGEMENT: ['create', 'update', 'delete'],
        DOCUMENTS: ['create', 'update', 'delete'],
        ASSETS: ['create', 'update', 'delete'],
        PAYROLL: ['create', 'update', 'delete'],
        NOTICES: ['create', 'update', 'delete'],
        ACHIEVEMENTS: ['create', 'update', 'delete'],
        GAMES: ['create', 'update', 'delete'],
        DASHBOARD: ['create', 'update', 'delete'],
        ATTENDANCE: ['create', 'update', 'delete'],
        HOLIDAYS: ['create', 'update', 'delete']
      };
      return blocked[moduleKey]?.includes(opKey) || false;
    }
    return false;
  };

  const toggleWidget = (key) => {
    setDashboardWidgets((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const setCrudFlag = (module, op, value) => {
    setModuleCrud((prev) => ({
      ...prev,
      [module]: { ...(prev[module] || emptyCrud()), [op]: value },
    }));
  };

  const togglePermission = (name) => {
    setSelectedPermissions((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.roleName.trim()) {
      toast.error('Role name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await adminAPI.createEmployeeRole({
        roleName: createForm.roleName.trim(),
        description: createForm.description.trim(),
        enabledModules: Object.keys(catalog.features || {}),
        dashboardWidgets: Object.keys(catalog.dashboardWidgets || {}),
      });
      toast.success('Role created');
      setShowCreate(false);
      setCreateForm({ roleName: '', description: '' });
      await loadRoles();
      if (res.data?.id) setSelectedId(res.data.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create role');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const computedEnabledModules = new Set(['DASHBOARD', 'ORGANIZATION', 'SETTINGS']);
      MASTER_SIDEBAR_LAYOUT.forEach(module => {
        const hasAnyEnabledFeature = module.features.some(feature => isFeatureEnabled(feature));
        if (hasAnyEnabledFeature) {
          computedEnabledModules.add(module.code.toUpperCase());
        }
      });

      const currentRoleUpper = (detail?.roleName || detail?.name || '').toUpperCase();
      const isHrOrCeo = ['HR', 'CEO'].includes(currentRoleUpper);

      const computedModuleCrud = {};
      MASTER_SIDEBAR_LAYOUT.forEach(module => {
        module.features.forEach(feature => {
          let isEnabled = isFeatureEnabled(feature);
          if (module.code === 'MANAGE_ACCOUNT' && isHrOrCeo) {
            isEnabled = true;
          }

          if (!isEnabled) {
            computedModuleCrud[feature.code] = { create: false, read: false, update: false, delete: false };
            return;
          }
          const crudObj = { create: false, read: false, update: false, delete: false };
          if (feature.allowedOps && feature.allowedOps.length > 0) {
            feature.allowedOps.forEach(op => {
              crudObj[op] = (module.code === 'MANAGE_ACCOUNT' && isHrOrCeo) ? true : isOpChecked(feature, op);
            });
          } else {
            crudObj.read = true;
          }
          computedModuleCrud[feature.code] = crudObj;
        });
      });

      // Adjust permissions array to always include MANAGE_ACCOUNT permissions at ORGANIZATION scope for HR and CEO
      let finalPermissions = [...selectedRolePermissions];
      if (isHrOrCeo) {
        const manageAccountFeatures = MASTER_SIDEBAR_LAYOUT.find(m => m.code === 'MANAGE_ACCOUNT')?.features || [];
        manageAccountFeatures.forEach(feature => {
          const codes = getFeaturePermissions(feature);
          // Remove any existing configs for these features first
          finalPermissions = finalPermissions.filter(rp => !codes.includes(rp.permissionCode));
          // Re-add them with ORGANIZATION scope
          codes.forEach(c => {
            finalPermissions.push({
              permissionCode: c,
              scope: 'ORGANIZATION'
            });
          });
        });
      }

      const payload = {
        description: editForm.description,
        isActive: editForm.isActive,
        enabledModules: Array.from(computedEnabledModules),
        moduleCrud: computedModuleCrud,
        dashboardWidgets,
        permissions: finalPermissions,
      };
      if (!detail?.isSystem) {
        payload.roleName = editForm.roleName.trim();
      }
      await adminAPI.updateEmployeeRole(selectedId, payload);
      toast.success('Role updated. Users may need to re-login for permission changes.');
      await loadRoles();
      await loadDetail(selectedId);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (role) => {
    try {
      await adminAPI.toggleEmployeeRoleStatus(role.id);
      toast.success(`Role ${role.isActive ? 'disabled' : 'enabled'}`);
      await loadRoles();
      if (selectedId === role.id) await loadDetail(role.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to toggle role');
    }
  };

  const handleDelete = async (role) => {
    if (role.isSystem) {
      toast.error('System roles cannot be deleted');
      return;
    }
    if (!window.confirm(`Delete role "${role.roleName}"? This cannot be undone.`)) return;
    try {
      await adminAPI.deleteEmployeeRole(role.id);
      toast.success('Role deleted');
      if (selectedId === role.id) {
        setSelectedId(null);
        setDetail(null);
      }
      await loadRoles();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete role');
    }
  };

  const handleClone = async (role) => {
    const name = window.prompt('Name for the new role', `${role.roleName} Copy`);
    if (!name) return;
    setSaving(true);
    try {
      const detailRes = await adminAPI.getEmployeeRoleById(role.id);
      const src = detailRes.data || {};
      const res = await adminAPI.createEmployeeRole({
        roleName: name.trim(),
        description: src.description || `Cloned from ${role.roleName}`,
        enabledModules: src.enabledModules || Object.keys(catalog.features || {}),
        moduleCrud: src.moduleCrud || {},
        dashboardWidgets: src.dashboardWidgets || Object.keys(catalog.dashboardWidgets || {}),
        permissions: src.permissions || [],
      });
      if (src.permissions?.length) {
        await adminAPI.updateEmployeeRole(res.data.id, {
          permissions: src.permissions,
          enabledModules: src.enabledModules,
          moduleCrud: src.moduleCrud,
          dashboardWidgets: src.dashboardWidgets,
        });
      }
      toast.success('Role cloned');
      await loadRoles();
      setSelectedId(res.data.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to clone role');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="main-content uac-page">
        <Header title="User Access Control" subtitle="Roles & permissions" />
        <div className="uac-loading"><Loader2 className="spin" size={24} /> Loading roles…</div>
      </div>
    );
  }

  return (
    <div className="uac-page">
      <Header title="User Access Control" subtitle="View roles, configure features, set CRUD access, and control dashboard widgets" />

      <div className="page-content uac-layout">
        <aside className="uac-sidebar card">
          <div className="uac-sidebar-head">
            <h3><Shield size={18} /> Roles</h3>
            <button type="button" className="uac-btn primary sm" disabled style={{ cursor: 'not-allowed', opacity: 0.5 }} title="Role creation is locked">
              <Plus size={16} /> New
            </button>
          </div>
          <input
            className="uac-search"
            placeholder="Search roles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ul className="uac-role-list">
            {filteredRoles.map((role) => (
              <li key={role.id}>
                  <button
                    type="button"
                    className={`uac-role-item ${selectedId === role.id ? 'active' : ''}`}
                    onClick={() => setSelectedId(role.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '12px 14px',
                      gap: '8px'
                    }}
                  >
                    <div className="uac-role-item-main" style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <span className="uac-role-name" style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{role.roleName || role.name}</span>
                      <span className="uac-role-meta" style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {role.isSystem ? 'System' : 'Custom'} · {role.assignedCount || 0} users
                      </span>
                    </div>
                    <span className={`uac-badge ${role.isActive ? 'on' : 'off'}`} style={{ flexShrink: 0 }}>
                      {role.isActive ? 'Active' : 'Off'}
                    </span>
                  </button>
              </li>
            ))}
            {filteredRoles.length === 0 && <li className="uac-empty">No roles found</li>}
          </ul>
        </aside>

        <section className="uac-main card">
          {!selectedId || detailLoading ? (
            <div className="uac-loading"><Loader2 className="spin" size={24} /> Loading role…</div>
          ) : !detail ? (
            <div className="uac-empty">Select a role to configure access</div>
          ) : (
            <>
              {(() => {
                const currentRoleUpper = (detail?.roleName || detail?.name || '').toUpperCase();
                return (
                  <div className="uac-main-head" style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderBottom: '1px solid var(--gray-100, #f3f4f6)', paddingBottom: '16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#0f172a', lineHeight: '1.2' }}>{detail.roleName || detail.name}</h2>
                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                          {detail.isSystem ? 'System Defined Role' : 'Custom Configured Role'}
                        </span>
                      </div>
                      <div className="uac-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {!detail.isSystem && (
                          <button type="button" className="uac-btn sm ghost" onClick={() => handleClone(detail)} style={{ height: '36px', padding: '0 14px', borderRadius: '8px' }}>
                            <Copy size={14} /> Clone
                          </button>
                        )}
                        <button type="button" className="uac-btn sm ghost" onClick={() => handleToggle(detail)} style={{ height: '36px', padding: '0 14px', borderRadius: '8px' }}>
                          {detail.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          {detail.isActive ? 'Disable' : 'Enable'}
                        </button>
                        {!detail.isSystem && (
                          <button type="button" className="uac-btn sm danger" onClick={() => handleDelete(detail)} style={{ height: '36px', padding: '0 14px', borderRadius: '8px' }}>
                            <Trash2 size={14} /> Delete
                          </button>
                        )}
                        <button
                          type="button"
                          className="uac-btn sm primary"
                          onClick={handleSave}
                          disabled={saving || currentRoleUpper === 'ADMIN'}
                          style={{
                            height: '36px',
                            padding: '0 16px',
                            borderRadius: '8px',
                            cursor: currentRoleUpper === 'ADMIN' ? 'not-allowed' : 'pointer',
                            opacity: currentRoleUpper === 'ADMIN' ? 0.6 : 1
                          }}
                          title={currentRoleUpper === 'ADMIN' ? 'Admin role permissions are locked' : 'Save Changes'}
                        >
                          <Save size={14} /> Save
                        </button>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', width: '100%', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 200px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>Designation:</span>
                        <input
                          value={editForm.roleName}
                          onChange={(e) => setEditForm((f) => ({ ...f, roleName: e.target.value }))}
                          disabled={detail.isSystem && (detail.roleName?.toUpperCase() === 'ADMIN' || detail.name?.toUpperCase() === 'ADMIN')}
                          style={{ 
                            padding: '6px 12px', 
                            fontSize: '13px', 
                            border: '1px solid #cbd5e1', 
                            borderRadius: '8px', 
                            width: '100%', 
                            height: '36px',
                            backgroundColor: (detail.isSystem && (detail.roleName?.toUpperCase() === 'ADMIN' || detail.name?.toUpperCase() === 'ADMIN')) ? '#f8fafc' : '#fff',
                            color: '#0f172a',
                            fontWeight: '500',
                            outline: 'none'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '2 1 300px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>Description:</span>
                        <input
                          value={editForm.description}
                          onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                          style={{ 
                            padding: '6px 12px', 
                            fontSize: '13px', 
                            border: '1px solid #cbd5e1', 
                            borderRadius: '8px', 
                            width: '100%', 
                            height: '36px',
                            backgroundColor: '#fff',
                            color: '#0f172a',
                            fontWeight: '500',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {(() => {
                const currentRoleUpper = (detail?.roleName || detail?.name || '').toUpperCase();
                const visibleNames = ROLE_SIDEBAR_FEATURES[currentRoleUpper] || null;

                return (
                  <div className="uac-panel">
                    <div className="uac-panel-toolbar" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '16px' }}>
                      <div>
                        <h4 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: '#1e293b' }}>
                          Role Permission Structure (Sidebar Layout)
                        </h4>
                        <p style={{ fontSize: '12px', margin: 0, color: '#64748b' }}>
                          Configure access, operations, and data scopes organized exactly like the user's sidebar menu.
                        </p>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {currentLayout.map((module) => {
                        const visibleFeatures = module.features;
                        if (visibleFeatures.length === 0) return null;

                        const allFeaturesEnabled = visibleFeatures.every(f => isFeatureEnabled(f));

                        return (
                          <div key={module.code} className="uac-feature-group-section" style={{ width: '100%', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '18px' }}>{module.icon}</span>
                                <span style={{ fontWeight: '800', fontSize: '15px', color: '#0f172a' }}>{module.title.toUpperCase()}</span>
                                <span style={{ fontSize: '11px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '10px', color: '#64748b', fontWeight: '600' }}>
                                  {visibleFeatures.filter(f => isFeatureEnabled(f)).length} / {visibleFeatures.length} enabled
                                </span>
                              </div>
                              {currentRoleUpper !== 'ADMIN' && (
                                <button
                                  type="button"
                                  className="uac-btn ghost sm"
                                  onClick={() => handleToggleModuleAll(module.code, !allFeaturesEnabled)}
                                  style={{ padding: '4px 10px', fontSize: '11px', height: '26px' }}
                                >
                                  {allFeaturesEnabled ? 'Disable All' : 'Enable All'}
                                </button>
                              )}
                            </div>

                            <div className="uac-crud-table-wrap" style={{ marginTop: '10px' }}>
                              <table className="uac-crud-table" style={{ width: '100%' }}>
                                <thead>
                                  <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                                    <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>Feature</th>
                                    <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', textAlign: 'center', width: '70px' }}>Access</th>
                                    <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', textAlign: 'center', width: '70px' }}>Create</th>
                                    <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', textAlign: 'center', width: '70px' }}>Read</th>
                                    <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', textAlign: 'center', width: '70px' }}>Update</th>
                                    <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', textAlign: 'center', width: '70px' }}>Delete</th>
                                    <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', width: '160px' }}>Access Scope</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {visibleFeatures.map((feature) => {
                                    let isEnabled = isFeatureEnabled(feature);
                                    let currentScope = getFeatureScope(feature);
                                    let isReadOnly = currentRoleUpper === 'ADMIN';

                                    if (module.code === 'MANAGE_ACCOUNT' && ['HR', 'CEO'].includes(currentRoleUpper)) {
                                      isEnabled = true;
                                      currentScope = 'ORGANIZATION';
                                      isReadOnly = true;
                                    }
                                    
                                    const firstCode = feature.codeMapping?.read || feature.codeMapping?.view || feature.code;
                                    const allowedScopes = allowedScopesMap[firstCode] || ['OWN', 'TEAM', 'DEPARTMENT', 'ORGANIZATION', 'TENANT'];

                                    const hasOps = feature.allowedOps && feature.allowedOps.length > 0;
                                    const supportsCreate = feature.allowedOps?.includes('create');
                                    const supportsRead = feature.allowedOps?.includes('read') || feature.allowedOps?.includes('view');
                                    const supportsUpdate = feature.allowedOps?.includes('update');
                                    const supportsDelete = feature.allowedOps?.includes('delete');

                                    return (
                                      <tr key={feature.name} style={{ borderBottom: '1px solid #f1f5f9', background: isEnabled ? '#fff' : '#f8fafc' }}>
                                        <td style={{ padding: '12px', fontSize: '12px', fontWeight: '700', color: isEnabled ? '#1e293b' : '#64748b' }}>
                                          {feature.name}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                          <label className="uac-checkbox-container" style={{ margin: '0 auto', cursor: isReadOnly ? 'not-allowed' : 'pointer' }}>
                                            <input
                                              type="checkbox"
                                              checked={isEnabled}
                                              disabled={isReadOnly}
                                              onChange={(e) => handleToggleFeature(feature, e.target.checked)}
                                            />
                                            <span className="uac-checkbox-checkmark" style={{ backgroundColor: isReadOnly && isEnabled ? '#e2e8f0' : undefined }}></span>
                                          </label>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                          {supportsCreate ? (
                                            <label className="uac-checkbox-container" style={{ margin: '0 auto', cursor: (isReadOnly || !isEnabled) ? 'not-allowed' : 'pointer' }}>
                                              <input
                                                type="checkbox"
                                                checked={isEnabled && isOpChecked(feature, 'create')}
                                                disabled={!isEnabled || isReadOnly}
                                                onChange={(e) => handleToggleOp(feature, 'create', e.target.checked)}
                                              />
                                              <span className="uac-checkbox-checkmark" style={{ backgroundColor: isReadOnly && isEnabled && isOpChecked(feature, 'create') ? '#e2e8f0' : undefined }}></span>
                                            </label>
                                          ) : hasOps ? (
                                            <span style={{ color: '#cbd5e1', fontSize: '12px' }}>—</span>
                                          ) : null}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                          {supportsRead ? (
                                            <label className="uac-checkbox-container" style={{ margin: '0 auto', cursor: (isReadOnly || !isEnabled) ? 'not-allowed' : 'pointer' }}>
                                              <input
                                                type="checkbox"
                                                checked={isEnabled && (isOpChecked(feature, 'read') || isOpChecked(feature, 'view'))}
                                                disabled={!isEnabled || isReadOnly}
                                                onChange={(e) => handleToggleOp(feature, feature.allowedOps.includes('read') ? 'read' : 'view', e.target.checked)}
                                              />
                                              <span className="uac-checkbox-checkmark" style={{ backgroundColor: isReadOnly && isEnabled && (isOpChecked(feature, 'read') || isOpChecked(feature, 'view')) ? '#e2e8f0' : undefined }}></span>
                                            </label>
                                          ) : hasOps ? (
                                            <span style={{ color: '#cbd5e1', fontSize: '12px' }}>—</span>
                                          ) : null}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                          {supportsUpdate ? (
                                            <label className="uac-checkbox-container" style={{ margin: '0 auto', cursor: (isReadOnly || !isEnabled) ? 'not-allowed' : 'pointer' }}>
                                              <input
                                                type="checkbox"
                                                checked={isEnabled && isOpChecked(feature, 'update')}
                                                disabled={!isEnabled || isReadOnly}
                                                onChange={(e) => handleToggleOp(feature, 'update', e.target.checked)}
                                              />
                                              <span className="uac-checkbox-checkmark" style={{ backgroundColor: isReadOnly && isEnabled && isOpChecked(feature, 'update') ? '#e2e8f0' : undefined }}></span>
                                            </label>
                                          ) : hasOps ? (
                                            <span style={{ color: '#cbd5e1', fontSize: '12px' }}>—</span>
                                          ) : null}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                          {supportsDelete ? (
                                            <label className="uac-checkbox-container" style={{ margin: '0 auto', cursor: (isReadOnly || !isEnabled) ? 'not-allowed' : 'pointer' }}>
                                              <input
                                                type="checkbox"
                                                checked={isEnabled && isOpChecked(feature, 'delete')}
                                                disabled={!isEnabled || isReadOnly}
                                                onChange={(e) => handleToggleOp(feature, 'delete', e.target.checked)}
                                              />
                                              <span className="uac-checkbox-checkmark" style={{ backgroundColor: isReadOnly && isEnabled && isOpChecked(feature, 'delete') ? '#e2e8f0' : undefined }}></span>
                                            </label>
                                          ) : hasOps ? (
                                            <span style={{ color: '#cbd5e1', fontSize: '12px' }}>—</span>
                                          ) : null}
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                          {allowedScopes.length > 1 ? (
                                            <select
                                              value={currentScope}
                                              disabled={!isEnabled}
                                              onChange={(e) => handleFeatureScopeChange(feature, e.target.value)}
                                              style={{ 
                                                fontSize: '11px', 
                                                padding: '3px 6px', 
                                                borderRadius: '4px', 
                                                border: '1px solid #cbd5e1', 
                                                background: isEnabled ? '#fff' : '#f1f5f9', 
                                                width: '100%',
                                                cursor: isEnabled ? 'pointer' : 'not-allowed',
                                                color: isEnabled ? '#0f172a' : '#64748b',
                                                fontWeight: 'normal'
                                              }}
                                            >
                                              {(() => {
                                                const filteredUniqueScopes = Array.from(
                                                  new Set(
                                                    allowedScopes
                                                      .map(s => s === 'SELF' ? 'OWN' : s === 'TENANT' ? 'ORGANIZATION' : s)
                                                      .filter(s => s !== 'DEPARTMENT')
                                                  )
                                                );
                                                return filteredUniqueScopes.map(scopeVal => (
                                                  <option key={scopeVal} value={scopeVal}>
                                                    {scopeVal === 'OWN' ? 'Self' : scopeVal === 'TEAM' ? 'My Team' : 'Organization'}
                                                  </option>
                                                ));
                                              })()}
                                            </select>
                                          ) : (
                                            <span style={{ fontSize: '11px', color: isEnabled ? '#64748b' : '#cbd5e1', fontWeight: '600' }}>
                                              {currentScope === 'OWN' ? 'Self' : currentScope === 'TEAM' ? 'My Team' : 'Organization'}
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </section>
      </div>

      {showCreate && (
        <div className="uac-modal-backdrop" onClick={() => !saving && setShowCreate(false)}>
          <form className="uac-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleCreate}>
            <div className="uac-modal-head">
              <h3>Create role</h3>
              <button type="button" className="uac-icon-btn" onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>
            <label>
              Role name
              <input
                autoFocus
                value={createForm.roleName}
                onChange={(e) => setCreateForm((f) => ({ ...f, roleName: e.target.value }))}
                placeholder="e.g. Finance Manager"
                required
              />
            </label>
            <label>
              Description
              <textarea
                rows={3}
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What this role can do"
              />
            </label>
            <div className="uac-modal-actions">
              <button type="button" className="uac-btn ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="uac-btn primary" disabled={saving}>
                {saving ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
