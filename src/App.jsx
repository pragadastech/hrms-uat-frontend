import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { TenantProvider } from './contexts/TenantContext';
import { FeatureAccessProvider, FeatureGate } from './contexts/FeatureAccessContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { Toaster } from 'react-hot-toast';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import SubscriptionGate from './components/SubscriptionGate';

// Existing Pages
import Dashboard from './pages/Dashboard';
import AllEmployees from './pages/AllEmployees';
const AddEmployee = React.lazy(() => import('./pages/AddEmployee'));
import LandingPage from './pages/LandingPage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import DataProtectionPolicy from './pages/DataProtectionPolicy';
import DataRetentionPolicy from './pages/DataRetentionPolicy';
import EmployeeDetails from './pages/EmployeeDetails';
import AllDepartments from './pages/AllDepartments';
import Attendance from './pages/Attendance';
import Leaves from './pages/Leaves';
import AdminLeaves from './pages/AdminLeaves';
import AdminLeaveAdjustments from './pages/AdminLeaveAdjustments';
import Wfh from './pages/Wfh';
import AdminWfh from './pages/AdminWfh';
import ManagerWfh from './pages/ManagerWfh';
import AdminSettings from './pages/AdminSettings';
import AdminLocationSettings from './pages/AdminLocationSettings';
import EmployeeSettings from './pages/EmployeeSettings';
import AdminNoticeBoard from './pages/AdminNoticeBoard';
import NoticeBoard from './pages/NoticeBoard';
import AdminDocuments from './pages/AdminDocuments';
import Documents from './pages/Documents';
import AdminComplaints from './pages/AdminComplaints';
import Complaints from './pages/Complaints';
import AdminPayslipManagement from './pages/AdminPayslipManagement';
import AdminPayrollSync from './pages/AdminPayrollSync';
import EmployeePayslips from './pages/EmployeePayslips';
import AdminExitManagement from './pages/AdminExitManagement';
import EmployeeExitManagement from './pages/EmployeeExitManagement';
import AdminAchievements from './pages/AdminAchievements';
import Achievements from './pages/Achievements';
import Holidays from './pages/Holidays';
import DepartmentDetails from './pages/DepartmentDetails';
import UnifiedLogin from './pages/UnifiedLogin';
import AcceptInvitation from './pages/AcceptInvitation';
import EmployeeSelfFill from './pages/EmployeeSelfFill';
import EmailAction from './pages/EmailAction';
import ResetPassword from './pages/ResetPassword';
import PlaceholderPage from './pages/PlaceholderPage';
import UserAccessControl from './pages/UserAccessControl';
import AssetManagement from './pages/AssetManagement';
import MyAssets from './pages/MyAssets';
import ExpenseManagement from './pages/ExpenseManagement';
import MyExpenses from './pages/MyExpenses';
import ManagerExpenses from './pages/ManagerExpenses';
import TeamAssetManagement from './pages/TeamAssetManagement';
import WorkStatus from './pages/WorkStatus';
import AdminWorkStatus from './pages/AdminWorkStatus';
import ExtraHours from './pages/ExtraHours';
import Help from './pages/Help';
import EOQNomination from './pages/EOQNomination';
import EOQReview from './pages/EOQReview';
import EOQFull from './pages/EOQFull';
import AdminExtraHours from './pages/AdminExtraHours';
import FunWellness from './components/FunWellness';
import Leaderboard from './components/games/Leaderboard';
import Team from './pages/ManagerPortal';
import ManagerAnalytics from './pages/ManagerAnalytics';
import ReportingManagement from './pages/ReportingManagement';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import SuperAdminTenants from './pages/SuperAdminTenants';
import SuperAdminPlans from './pages/SuperAdminPlans';
import SuperAdminBilling from './pages/SuperAdminBilling';
import SuperAdminDemoRequests from './pages/SuperAdminDemoRequests';
import SuperAdminLogin from './pages/SuperAdminLogin';
import SuperAdminRegister from './pages/SuperAdminRegister';
import TenantRegistration from './pages/TenantRegistration';
import AdminSetup from './pages/AdminSetup';
import AdminWelcomeSetup from './pages/AdminWelcomeSetup';
import Notifications from './pages/Notifications';
import PlannerBoard from './pages/PlannerBoard';
import ProjectManagement from './pages/ProjectManagement';
import UserManagement from './pages/UserManagement';
import OrganizationSetup from './pages/OrganizationSetup';
import AdminLeaveReport from './pages/Reports/AdminLeaveReport';
import AdminAttendanceReport from './pages/Reports/AdminAttendanceReport';
import AdminTimesheetReport from './pages/Reports/AdminTimesheetReport';
import NotFound404 from './pages/NotFound404';

const RootRedirect = () => {
  const { isAuthenticated, sessionType } = useAuth();
  if (!isAuthenticated()) {
    return <LandingPage />;
  }
  if (sessionType === 'super-admin') return <Navigate to="/super-admin/dashboard" replace />;
  if (sessionType === 'admin') return <Navigate to="/admin/dashboard" replace />;
  return <Navigate to="/employee/dashboard" replace />;
};

// Layout Component - now a pass-through because the layout is persistent at the root level
const Layout = ({ children }) => children;

const AppContent = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  // Public pages that don't need layout wrappers
  const isPublicPage = [
    '/',
    '/landing',
    '/login',
    '/signup',
    '/privacy-policy',
    '/terms-of-service',
    '/data-protection',
    '/data-retention',
    '/reset-password',
    '/accept-invitation',
    '/employee-self-fill',
    '/super-admin/login',
    '/admin/welcome-setup'
  ].includes(location.pathname) || location.pathname.startsWith('/admin/setup/');

  const showLayout = isAuthenticated() && !isPublicPage;

  if (!showLayout) {
    return (
      <div className="public-app-container">
        {children}
      </div>
    );
  }

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content-wrapper" style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, maxWidth: '100%', overflowX: 'hidden' }}>
        <Header global />
        <div className="main-content">
          {children}
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <TenantProvider>
      <AuthProvider>
        <FeatureAccessProvider>
          <ThemeProvider>
            <Router>
              <SubscriptionGate>
                <SidebarProvider>
                  <Toaster
                    position="top-right"
                    containerStyle={{ top: 64, right: 20, zIndex: 1100000 }}
                    toastOptions={{
                    className: 'dark:bg-gray-800 dark:text-white',
                    style: {
                      borderRadius: '4px',
                      background: 'var(--white-5)',
                      color: 'var(--dark-500)',
                    },
                  }} />
                  <AppContent>
                    <React.Suspense fallback={<div style={{height:'100vh', display:'flex', justifyContent:'center', alignItems:'center'}}>Loading...</div>}>
                      <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<RootRedirect />} />
                    <Route path="/landing" element={<LandingPage />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/terms-of-service" element={<TermsOfService />} />
                    <Route path="/data-protection" element={<DataProtectionPolicy />} />
                    <Route path="/data-retention" element={<DataRetentionPolicy />} />
                    <Route path="/signup" element={<TenantRegistration />} />
                    <Route path="/admin/setup/:dummyTenantId/:token" element={<AdminSetup />} />
                    <Route path="/login" element={<UnifiedLogin />} />
                    <Route path="/accept-invitation" element={<AcceptInvitation />} />
                    <Route path="/employee-self-fill" element={<EmployeeSelfFill />} />
                    <Route path="/email-action" element={<EmailAction />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/admin/reset-password" element={<ResetPassword />} />

                    {/* Super admin auth */}
                    <Route path="/super-admin/login" element={<SuperAdminLogin />} />

                    {/* 
                     ================================================================
                     ADMIN ROUTES 
                     ================================================================
                  */}
                    <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

                    <Route path="/admin/dashboard" element={
                      <ProtectedRoute requireAdmin={true}>
                        <Layout><Dashboard /></Layout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/welcome-setup" element={
                      <ProtectedRoute requireAdmin={true}>
                        <AdminWelcomeSetup />
                      </ProtectedRoute>
                    } />

                    <Route path="/admin/employees" element={
                      <ProtectedRoute requireAdmin={true}>
                        <FeatureGate feature="EMPLOYEE_MANAGEMENT" fallback={<Navigate to="/admin/dashboard" />}>
                          <Layout><AllEmployees /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />

                    <Route path="/admin/employees/add" element={
                      <ProtectedRoute requireAdmin={true}>
                        <FeatureGate feature="EMPLOYEE_MANAGEMENT" fallback={<Navigate to="/admin/dashboard" />}>
                          <Layout><AddEmployee /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />

                    <Route path="/admin/employees/:id/edit" element={
                      <ProtectedRoute requireAdmin={true}>
                        <FeatureGate feature="EMPLOYEE_MANAGEMENT" fallback={<Navigate to="/admin/dashboard" />}>
                          <Layout><AddEmployee /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />

                    {/* Fix for route collision: redirect /all to list view */}
                    <Route path="/admin/employees/all" element={<Navigate to="/admin/employees" replace />} />

                    <Route path="/admin/employees/:id" element={
                      <ProtectedRoute requireAdmin={true}>
                        <Layout><EmployeeDetails /></Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/admin/profile" element={
                      <ProtectedRoute requireAdmin={true}>
                        <Layout><EmployeeDetails /></Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/admin/reporting-management" element={
                      <ProtectedRoute requireAdmin={true}>
                        <FeatureGate feature="EMPLOYEE_MANAGEMENT" fallback={<Navigate to="/admin/dashboard" />}>
                          <Layout><ReportingManagement /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />

                    <Route path="/admin/departments" element={
                      <ProtectedRoute requireAdmin={true}>
                        <Layout><AllDepartments /></Layout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/departments/:departmentName" element={
                      <ProtectedRoute requireAdmin={true}>
                        <Layout><DepartmentDetails /></Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/admin/time-office" element={
                      <ProtectedRoute requireAdmin={true}>
                        <FeatureGate feature="ATTENDANCE" fallback={<Navigate to="/admin/dashboard" />}>
                          <Layout><Attendance /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />

                    <Route path="/admin/expenses" element={
                      <ProtectedRoute requireAdmin={true}>
                        <FeatureGate feature="EXPENSES" fallback={<Navigate to="/admin/dashboard" />}>
                          <Layout><ExpenseManagement /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />

                    {/* Legacy routes - redirect to time-office */}
                    <Route path="/admin/attendance" element={<Navigate to="/admin/time-office" replace />} />
                    <Route path="/admin/timesheet" element={<Navigate to="/admin/time-office" replace />} />

                    <Route path="/admin/leaves" element={
                      <ProtectedRoute requireAdmin={true}>
                        <FeatureGate feature="LEAVE_MANAGEMENT" fallback={<Navigate to="/admin/dashboard" />}>
                          <Layout><AdminLeaves /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/leave-adjustments" element={
                      <ProtectedRoute requireAdmin={true}>
                        <FeatureGate feature="LEAVE_MANAGEMENT" fallback={<Navigate to="/admin/dashboard" />}>
                          <Layout><AdminLeaveAdjustments /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />

                    <Route path="/admin/my-leaves" element={
                      <ProtectedRoute requireAdmin={true}>
                        <FeatureGate feature="LEAVE_MANAGEMENT" fallback={<Navigate to="/admin/dashboard" />}>
                          <Layout><Leaves adminSelfService /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/wfh" element={
                      <ProtectedRoute requireAdmin={true}>
                        <FeatureGate feature="WFH" fallback={<Navigate to="/admin/dashboard" />}>
                          <Layout><AdminWfh /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/expenses" element={
                      <ProtectedRoute requireAdmin={true}>
                        <FeatureGate feature="EXPENSES" fallback={<Navigate to="/admin/dashboard" />}>
                          <Layout><ExpenseManagement /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />

                    <Route path="/admin/holidays" element={
                      <ProtectedRoute requireAdmin={true}>
                        <FeatureGate feature="HOLIDAYS" fallback={<Navigate to="/admin/dashboard" />}>
                          <Layout><Holidays /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />

                    {/* Admin Placeholders for Reference Project Parity */}
                    <Route path="/admin/notices" element={<ProtectedRoute requireAdmin={true}><FeatureGate feature="NOTICES" fallback={<Navigate to="/admin/dashboard" />}><Layout><AdminNoticeBoard /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/admin/documents" element={<ProtectedRoute requireAdmin={true}><FeatureGate feature="DOCUMENTS" fallback={<Navigate to="/admin/dashboard" />}><Layout><AdminDocuments /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/admin/complaints" element={<ProtectedRoute requireAdmin={true}><FeatureGate feature="COMPLAINTS" fallback={<Navigate to="/admin/dashboard" />}><Layout><AdminComplaints /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/admin/notifications" element={<ProtectedRoute requireAdmin={true}><FeatureGate feature="NOTICES" fallback={<Navigate to="/admin/dashboard" />}><Layout><Notifications /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/notices" element={<ProtectedRoute><FeatureGate feature="NOTICES" fallback={<Navigate to="/employee/dashboard" />}><Layout><NoticeBoard /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/documents" element={<ProtectedRoute><FeatureGate feature="DOCUMENTS" fallback={<Navigate to="/employee/dashboard" />}><Layout><Documents /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/complaints" element={<ProtectedRoute><FeatureGate feature="COMPLAINTS" fallback={<Navigate to="/employee/dashboard" />}><Layout><Complaints /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/notifications" element={<ProtectedRoute><FeatureGate feature="NOTICES" fallback={<Navigate to="/employee/dashboard" />}><Layout><Notifications /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/admin/payroll" element={<ProtectedRoute requireAdmin={true}><FeatureGate feature="PAYROLL" fallback={<Navigate to="/admin/dashboard" />}><Layout><AdminPayslipManagement /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/admin/payroll-sync" element={<ProtectedRoute requireAdmin={true}><FeatureGate feature="PAYROLL" fallback={<Navigate to="/admin/dashboard" />}><Layout><AdminPayrollSync /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/payroll" element={<ProtectedRoute><FeatureGate feature="PAYROLL" fallback={<Navigate to="/employee/dashboard" />}><Layout><EmployeePayslips /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/admin/exit" element={<ProtectedRoute requireAdmin={true}><FeatureGate feature="EMPLOYEE_MANAGEMENT" fallback={<Navigate to="/admin/dashboard" />}><Layout><AdminExitManagement /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/exit" element={<ProtectedRoute><FeatureGate feature="EMPLOYEE_MANAGEMENT" fallback={<Navigate to="/employee/dashboard" />}><Layout><EmployeeExitManagement /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/admin/achievements" element={<ProtectedRoute requireAdmin={true}><FeatureGate feature="ACHIEVEMENTS" fallback={<Navigate to="/admin/dashboard" />}><Layout><AdminAchievements /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/admin/fun-wellness" element={<ProtectedRoute requireAdmin={true}><FeatureGate feature="GAMES" fallback={<Navigate to="/admin/dashboard" />}><Layout><FunWellness /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/achievements" element={<ProtectedRoute><FeatureGate feature="ACHIEVEMENTS" fallback={<Navigate to="/employee/dashboard" />}><Layout><Achievements /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/employee/fun-wellness" element={<ProtectedRoute><FeatureGate feature="GAMES" fallback={<Navigate to="/employee/dashboard" />}><Layout><FunWellness /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/employee/leaderboard" element={<ProtectedRoute><FeatureGate feature="ACHIEVEMENTS" fallback={<Navigate to="/employee/dashboard" />}><Layout><Leaderboard isStandalone={true} /></Layout></FeatureGate></ProtectedRoute>} />
                    {/* Redirect legacy /games to new path */}
                    <Route path="/games" element={<Navigate to="/employee/fun-wellness" replace />} />
                    <Route path="/admin/jobs" element={<ProtectedRoute requireAdmin={true}><FeatureGate feature="EMPLOYEE_MANAGEMENT" fallback={<Navigate to="/admin/dashboard" />}><Layout><PlaceholderPage title="Jobs" /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/admin/candidates" element={<ProtectedRoute requireAdmin={true}><FeatureGate feature="EMPLOYEE_MANAGEMENT" fallback={<Navigate to="/admin/dashboard" />}><Layout><PlaceholderPage title="Candidates" /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/admin/settings" element={<ProtectedRoute requireAdmin={true}><Layout><AdminSettings /></Layout></ProtectedRoute>} />
                    <Route path="/admin/location-settings" element={<ProtectedRoute requireAdmin={true}><Layout><AdminLocationSettings /></Layout></ProtectedRoute>} />
                    <Route path="/admin/planner" element={<ProtectedRoute requireAdmin={true}><FeatureGate feature="PLANNER" fallback={<Navigate to="/admin/dashboard" />}><Layout><PlannerBoard /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/admin/projects" element={<ProtectedRoute requireAdmin={true}><FeatureGate feature="PROJECT_MANAGEMENT" fallback={<Navigate to="/admin/dashboard" />}><Layout><ProjectManagement /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/admin/assets" element={<ProtectedRoute requireAdmin={true}><FeatureGate feature="ASSETS" fallback={<Navigate to="/admin/dashboard" />}><Layout><AssetManagement /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/admin/reports" element={<ProtectedRoute requireAdmin={true}><FeatureGate feature="REPORTS" fallback={<Navigate to="/admin/dashboard" />}><Layout><PlaceholderPage title="Reports" /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/admin/reports/leave" element={<ProtectedRoute requireAdmin={true}><Layout><AdminLeaveReport /></Layout></ProtectedRoute>} />
                    <Route path="/admin/reports/attendance" element={<ProtectedRoute requireAdmin={true}><Layout><AdminAttendanceReport /></Layout></ProtectedRoute>} />
                    <Route path="/admin/reports/timesheet" element={<ProtectedRoute requireAdmin={true}><Layout><AdminTimesheetReport /></Layout></ProtectedRoute>} />
                    <Route path="/admin/work-status" element={<ProtectedRoute requireAdmin={true}><FeatureGate feature="WORK_STATUS" fallback={<Navigate to="/admin/dashboard" />}><Layout><AdminWorkStatus /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/admin/extra-hours" element={<ProtectedRoute requireAdmin={true}><FeatureGate feature="EXTRA_HOURS" fallback={<Navigate to="/admin/dashboard" />}><Layout><AdminExtraHours /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/admin/users" element={<ProtectedRoute requireAdmin={true}><Layout><UserManagement /></Layout></ProtectedRoute>} />
                    <Route path="/admin/organization-setup" element={<ProtectedRoute requireAdmin={true}><Layout><OrganizationSetup /></Layout></ProtectedRoute>} />
                    <Route path="/admin/user-access-control" element={<ProtectedRoute requireAdmin={true}><Layout><UserAccessControl /></Layout></ProtectedRoute>} />

                    {/* Admin PMS Routes (Placeholders) */}
                    <Route path="/admin/pms/*" element={
                      <ProtectedRoute requireAdmin={true}>
                        <FeatureGate feature="PMS" fallback={<Navigate to="/admin/dashboard" />}>
                          <Layout><PlaceholderPage title="Performance Management System" /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />

                    {/*
                     ================================================================
                     SUPER ADMIN ROUTES
                     ================================================================
                  */}
                    <Route path="/super-admin" element={<Navigate to="/super-admin/dashboard" replace />} />

                    <Route path="/super-admin/dashboard" element={
                      <ProtectedRoute requireSuperAdmin={true}>
                        <Layout><SuperAdminDashboard /></Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/super-admin/tenants" element={
                      <ProtectedRoute requireSuperAdmin={true}>
                        <Layout><SuperAdminTenants /></Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/super-admin/plans" element={
                      <ProtectedRoute requireSuperAdmin={true}>
                        <Layout><SuperAdminPlans /></Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/super-admin/billing" element={
                      <ProtectedRoute requireSuperAdmin={true}>
                        <Layout><SuperAdminBilling /></Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/super-admin/marketing/demo-requests" element={
                      <ProtectedRoute requireSuperAdmin={true}>
                        <Layout><SuperAdminDemoRequests /></Layout>
                      </ProtectedRoute>
                    } />

                    {/* 
                     ================================================================
                     EMPLOYEE ROUTES 
                     ================================================================
                  */}
                    <Route path="/employee" element={<Navigate to="/employee/dashboard" replace />} />

                    <Route path="/employee/dashboard" element={
                      <ProtectedRoute>
                        <Layout><Dashboard /></Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/employee/profile" element={
                      <ProtectedRoute>
                        <Layout><EmployeeDetails /></Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/employee/settings" element={
                      <ProtectedRoute>
                        <Layout><EmployeeSettings /></Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/employee/time-office" element={
                      <ProtectedRoute>
                        <Layout><Attendance /></Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/employee/expenses" element={
                      <ProtectedRoute>
                        <FeatureGate feature="EXPENSES" fallback={<Navigate to="/employee/dashboard" />}>
                          <Layout><MyExpenses /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />

                    <Route path="/employee/eoq/nominate" element={
                      <ProtectedRoute>
                        <FeatureGate feature="ACHIEVEMENTS" fallback={<Navigate to="/employee/dashboard" />}>
                          <Layout><EOQNomination /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />

                    <Route path="/admin/eoq/review" element={
                      <ProtectedRoute requireAdmin={true}>
                        <FeatureGate feature="ACHIEVEMENTS" fallback={<Navigate to="/admin/dashboard" />}>
                          <Layout><EOQReview /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />

                    <Route path="/eoq" element={
                      <ProtectedRoute>
                        <FeatureGate feature="ACHIEVEMENTS" fallback={<Navigate to="/" />}>
                          <Layout><EOQFull /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />

                    {/* Legacy routes - redirect to time-office */}
                    <Route path="/employee/attendance" element={<Navigate to="/employee/time-office" replace />} />
                    <Route path="/employee/timesheet" element={<Navigate to="/employee/time-office" replace />} />
                    <Route path="/employee/timesheets" element={<Navigate to="/employee/time-office" replace />} />
                    <Route path="/employee/directory" element={<Navigate to="/employee/departments" replace />} />
                    <Route path="/employee/org-chart" element={<Navigate to="/employee/profile" replace />} />

                    <Route path="/employee/leaves" element={
                      <ProtectedRoute>
                        <FeatureGate feature="LEAVE_MANAGEMENT" fallback={<Navigate to="/employee/dashboard" />}>
                          <Layout><Leaves /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/employee/wfh" element={
                      <ProtectedRoute>
                        <FeatureGate feature="WFH" fallback={<Navigate to="/employee/dashboard" />}>
                          <Layout><Wfh /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />

                    <Route path="/manager/team" element={
                      <ProtectedRoute>
                        <Layout><Team /></Layout>
                      </ProtectedRoute>
                    } />
                    <Route path="/manager/wfh" element={
                      <ProtectedRoute>
                        <FeatureGate feature="WFH" fallback={<Navigate to="/employee/dashboard" />}>
                          <Layout><ManagerWfh /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/manager/analytics" element={
                      <ProtectedRoute>
                        <Layout><ManagerAnalytics defaultTab="overview" /></Layout>
                      </ProtectedRoute>
                    } />
                    <Route path="/manager/leave-analytics" element={
                      <ProtectedRoute>
                        <Layout><ManagerAnalytics defaultTab="leaves" isStandalone={true} showAdjustmentsTab={true} /></Layout>
                      </ProtectedRoute>
                    } />
                    <Route path="/manager/timesheet-analytics" element={
                      <ProtectedRoute>
                        <Layout><ManagerAnalytics defaultTab="timesheets" isStandalone={true} /></Layout>
                      </ProtectedRoute>
                    } />
                    <Route path="/manager/expenses" element={
                      <ProtectedRoute>
                        <FeatureGate feature="EXPENSES" fallback={<Navigate to="/employee/dashboard" />}>
                          <Layout><ManagerExpenses /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />
                     <Route path="/manager/projects" element={
                       <ProtectedRoute>
                         <FeatureGate feature="PROJECT_MANAGEMENT" fallback={<Navigate to="/employee/dashboard" />}>
                           <Layout><ProjectManagement /></Layout>
                         </FeatureGate>
                       </ProtectedRoute>
                     } />
                     <Route path="/manager/assets" element={
                       <ProtectedRoute>
                         <FeatureGate feature="ASSETS" fallback={<Navigate to="/employee/dashboard" />}>
                           <Layout><TeamAssetManagement /></Layout>
                         </FeatureGate>
                       </ProtectedRoute>
                     } />
                    <Route path="/admin/team" element={
                      <ProtectedRoute requireAdmin={true}>
                        <Layout><Team /></Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/employee/holidays" element={
                      <ProtectedRoute>
                        <FeatureGate feature="HOLIDAYS" fallback={<Navigate to="/employee/dashboard" />}>
                          <Layout><Holidays /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />

                    <Route path="/employee/departments" element={
                      <ProtectedRoute>
                        <Layout><AllDepartments /></Layout>
                      </ProtectedRoute>
                    } />
                    <Route path="/employee/departments/:departmentName" element={
                      <ProtectedRoute>
                        <Layout><DepartmentDetails /></Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/employee/work-status" element={
                      <ProtectedRoute>
                        <FeatureGate feature="WORK_STATUS" fallback={<Navigate to="/employee/dashboard" />}>
                          <Layout><WorkStatus /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />

                    <Route path="/employee/extra-hours" element={
                      <ProtectedRoute>
                        <FeatureGate feature="EXTRA_HOURS" fallback={<Navigate to="/employee/dashboard" />}>
                          <Layout><ExtraHours /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />

                    <Route path="/employee/planner" element={
                      <ProtectedRoute>
                        <FeatureGate feature="PLANNER" fallback={<Navigate to="/employee/dashboard" />}>
                          <Layout><PlannerBoard /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />

                    {/* Employee PMS Routes (Placeholders) */}
                    <Route path="/employee/pms/*" element={
                      <ProtectedRoute>
                        <FeatureGate feature="PMS" fallback={<Navigate to="/employee/dashboard" />}>
                          <Layout><PlaceholderPage title="My Performance" /></Layout>
                        </FeatureGate>
                      </ProtectedRoute>
                    } />

                    {/* Other Employee Placeholders */}
                    <Route path="/employee/assets" element={<ProtectedRoute><FeatureGate feature="ASSETS" fallback={<Navigate to="/employee/dashboard" />}><Layout><MyAssets /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/employee/documents" element={<ProtectedRoute><FeatureGate feature="DOCUMENTS" fallback={<Navigate to="/employee/dashboard" />}><Layout><PlaceholderPage title="My Documents" /></Layout></FeatureGate></ProtectedRoute>} />
                    <Route path="/employee/payslips" element={<ProtectedRoute><FeatureGate feature="PAYROLL" fallback={<Layout><PlaceholderPage title="Access Denied" message="Payroll features are not active for your profile. Please contact your HR administrator." /></Layout>}><Layout><PlaceholderPage title="My Payslips" /></Layout></FeatureGate></ProtectedRoute>} />

                    {/* Help & Support - accessible to all authenticated users */}
                    <Route path="/help" element={<ProtectedRoute><Layout><Help /></Layout></ProtectedRoute>} />
                    <Route path="/admin/help" element={<ProtectedRoute requireAdmin={true}><Layout><Help /></Layout></ProtectedRoute>} />
                    <Route path="/employee/help" element={<ProtectedRoute><Layout><Help /></Layout></ProtectedRoute>} />

                    {/* Catch-all: unknown/unmapped routes render 404 WITHOUT touching auth state */}
                    <Route path="*" element={<NotFound404 />} />
                      </Routes>
                    </React.Suspense>
                  </AppContent>
                </SidebarProvider>
              </SubscriptionGate>
            </Router>
          </ThemeProvider>
        </FeatureAccessProvider>
      </AuthProvider>
    </TenantProvider>
  );
}

export default App;
