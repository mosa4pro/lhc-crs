import React, { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ChatProvider } from './context/ChatContext';
import { Layout } from './components/Layout';
import { PermissionGuard } from './components/PermissionGuard';
import { LoginPage } from './pages/LoginPage';
import { normalizeDigits } from './utils/constants';

// ===== Lazy-loaded pages =====
const StudentsPage = lazy(() => import('./pages/StudentsPage').then(m => ({ default: m.StudentsPage })));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage').then(m => ({ default: m.SubscriptionPage })));
const StudentProfilePage = lazy(() => import('./pages/StudentProfilePage').then(m => ({ default: m.StudentProfilePage })));
const ManageCoursesPage = lazy(() => import('./pages/ManageCoursesPage').then(m => ({ default: m.ManageCoursesPage })));
const ManageDiplomasPage = lazy(() => import('./pages/ManageDiplomasPage').then(m => ({ default: m.ManageDiplomasPage })));
const ManageSectionsPage = lazy(() => import('./pages/ManageSectionsPage').then(m => ({ default: m.ManageSectionsPage })));
const AddToSectionPage = lazy(() => import('./pages/AddToSectionPage').then(m => ({ default: m.AddToSectionPage })));
const RequestCoursePage = lazy(() => import('./pages/RequestCoursePage').then(m => ({ default: m.RequestCoursePage })));
const AttendancePage = lazy(() => import('./pages/AttendancePage').then(m => ({ default: m.AttendancePage })));

const GradesPage = lazy(() => import('./pages/GradesPage').then(m => ({ default: m.GradesPage })));
const AcademicReportsPage = lazy(() => import('./pages/AcademicReportsPage').then(m => ({ default: m.AcademicReportsPage })));
const AdminSettingsPage = lazy(() => import('./pages/AdminSettingsPage').then(m => ({ default: m.AdminSettingsPage })));
const AdminAlertsPage = lazy(() => import('./pages/AdminSystemPage').then(m => ({ default: m.AdminAlertsPage })));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
const StudentManagementPage = lazy(() => import('./pages/StudentManagementPage').then(m => ({ default: m.StudentManagementPage })));
const AdminEntitiesPage = lazy(() => import('./pages/AdminEntitiesPage').then(m => ({ default: m.AdminEntitiesPage })));
const AdminRoomsPage = lazy(() => import('./pages/AdminRoomsPage').then(m => ({ default: m.AdminRoomsPage })));
const StudentAccountsPage = lazy(() => import('./pages/StudentAccountsPage').then(m => ({ default: m.StudentAccountsPage })));
const AdminEmployeesPage = lazy(() => import('./pages/AdminEmployeesPage').then(m => ({ default: m.AdminEmployeesPage })));
const EmployeeSalariesPage = lazy(() => import('./pages/EmployeeSalariesPage').then(m => ({ default: m.EmployeeSalariesPage })));
const LecturerAccountsPage = lazy(() => import('./pages/LecturerAccountsPage').then(m => ({ default: m.LecturerAccountsPage })));
const InstructorAccountsPage = lazy(() => import('./pages/InstructorAccountsPage').then(m => ({ default: m.InstructorAccountsPage })));
const SmartQueriesPage = lazy(() => import('./pages/SmartQueriesPage').then(m => ({ default: m.SmartQueriesPage })));
const FinInstallmentsPage = lazy(() => import('./pages/FinInstallmentsPage').then(m => ({ default: m.FinInstallmentsPage })));
const FinReceiptsPage = lazy(() => import('./pages/FinReceiptsPage').then(m => ({ default: m.FinReceiptsPage })));
const SettlementPage = lazy(() => import('./pages/SettlementPage').then(m => ({ default: m.SettlementPage })));
const WhatsAppPage = lazy(() => import('./pages/WhatsAppPage').then(m => ({ default: m.WhatsAppPage })));
const AdminAnnouncementsPage = lazy(() => import('./pages/AdminAnnouncementsPage').then(m => ({ default: m.AdminAnnouncementsPage })));
const ReportBuilderPage = lazy(() => import('./pages/ReportBuilderPage').then(m => ({ default: m.ReportBuilderPage })));
const UserSettingsPage = lazy(() => import('./pages/UserSettingsPage').then(m => ({ default: m.UserSettingsPage })));
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));

const StudentPortalPage = lazy(() => import('./pages/StudentPortalPage').then(m => ({ default: m.StudentPortalPage })));
const InstructorPortalPage = lazy(() => import('./pages/InstructorPortalPage').then(m => ({ default: m.InstructorPortalPage })));
const EmployeePortalPage = lazy(() => import('./pages/EmployeePortalPage').then(m => ({ default: m.EmployeePortalPage })));
const PortalSelectorPage = lazy(() => import('./pages/PortalSelectorPage').then(m => ({ default: m.PortalSelectorPage })));

// ===== Loading Screen =====
const LoadingScreen = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', flexDirection: 'column', gap: 16
  }}>
    <div style={{
      width: 52, height: 52, borderRadius: '50%',
      border: '3px solid var(--glass-border)',
      borderTop: '3px solid var(--primary)',
      animation: 'spin 0.8s linear infinite'
    }} />
    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>جارٍ التحميل...</p>
  </div>
);

// ===== Protected Route =====
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// ===== Role-based portal guard =====
const PortalRoute = ({ children, portal }: { children: React.ReactNode; portal: string }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  const portals = (user.portals || []).map(p => p.toUpperCase());
  if (!portals.includes(portal.toUpperCase())) {
    return <Navigate to="/portal" replace />;
  }
  return <>{children}</>;
};

// ===== Role-based layout guard =====
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  const portals = user.portals || [];
  if (portals.includes('STUDENT') && !portals.includes('ADMIN')) return <Navigate to="/student-portal" replace />;
  if (portals.includes('INSTRUCTOR') && !portals.includes('ADMIN')) return <Navigate to="/instructor-portal" replace />;
  return <>{children}</>;
};

// ===== Global navigation helper for desktop Quick Links =====
declare global { interface Window { __navigate?: (path: string) => void; } }

// ===== Global Digit Normalizer =====
const DigitNormalizer = () => {
  useEffect(() => {
    const handler = (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) return;
      if (target.type === 'password') return;

      const start = target.selectionStart;
      const normalized = normalizeDigits(target.value);
      if (normalized !== target.value) {
        target.value = normalized;
        if (typeof start === 'number') target.setSelectionRange(start, start);
      }
    };
    document.addEventListener('input', handler, true);
    return () => document.removeEventListener('input', handler, true);
  }, []);
  return null;
};

function App() {
  return (
    <AuthProvider>
      <DigitNormalizer />
        <Suspense fallback={<LoadingScreen />}>
          <ThemeProvider>
            <ChatProvider>
              <AppRoutes />
            </ChatProvider>
          </ThemeProvider>
        </Suspense>
    </AuthProvider>
  );
}

const AppRoutes = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { window.__navigate = navigate; }, [navigate]);

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />

      {/* Portals — standalone (no sidebar) */}
      <Route path="/employee-portal" element={<PortalRoute portal="EMPLOYEE"><EmployeePortalPage /></PortalRoute>} />
      <Route path="/portal" element={<ProtectedRoute><PortalSelectorPage /></ProtectedRoute>} />
      <Route path="/student-portal" element={<PortalRoute portal="STUDENT"><StudentPortalPage /></PortalRoute>} />
      <Route path="/instructor-portal" element={<PortalRoute portal="INSTRUCTOR"><InstructorPortalPage /></PortalRoute>} />

      {/* Protected admin layout */}
      <Route path="/" element={<AdminRoute><Layout /></AdminRoute>}>
        <Route index element={<HomePage />} />

        {/* ===== Registration ===== */}
        <Route path="students" element={<PermissionGuard perm="students.view"><StudentsPage /></PermissionGuard>} />
        <Route path="student-profile" element={<PermissionGuard perm="students.view"><StudentProfilePage /></PermissionGuard>} />
        <Route path="subscriptions" element={<PermissionGuard perm="subscriptions.add"><SubscriptionPage /></PermissionGuard>} />
        <Route path="academic-reports" element={<PermissionGuard perm="reports.academic"><AcademicReportsPage /></PermissionGuard>} />

        {/* ===== Student Affairs ===== */}
        <Route path="student-management" element={<PermissionGuard perm="students.view"><StudentManagementPage /></PermissionGuard>} />
        <Route path="grades" element={<PermissionGuard perm="students.view"><GradesPage /></PermissionGuard>} />
        <Route path="attendance" element={<PermissionGuard perm="attendance.manage"><AttendancePage /></PermissionGuard>} />
        <Route path="student-accounts" element={<PermissionGuard perm="admin.users"><StudentAccountsPage /></PermissionGuard>} />

        {/* ===== Enrollment Admin ===== */}
        <Route path="manage-courses" element={<PermissionGuard perm="courses.manage"><ManageCoursesPage /></PermissionGuard>} />
        <Route path="manage-diplomas" element={<PermissionGuard perm="diplomas.manage"><ManageDiplomasPage /></PermissionGuard>} />
        <Route path="manage-sections" element={<PermissionGuard perm="sections.manage"><ManageSectionsPage /></PermissionGuard>} />
        <Route path="add-to-section" element={<PermissionGuard perm="sections.manage"><AddToSectionPage /></PermissionGuard>} />
        <Route path="request-course" element={<PermissionGuard perm="subscriptions.add"><RequestCoursePage /></PermissionGuard>} />
        <Route path="smart-queries" element={<PermissionGuard perm="reports.academic"><SmartQueriesPage /></PermissionGuard>} />


        {/* ===== Financial ===== */}
        <Route path="installments" element={<PermissionGuard perm="finance.installments"><FinInstallmentsPage /></PermissionGuard>} />
        <Route path="receipts" element={<PermissionGuard perm="finance.installments"><FinReceiptsPage /></PermissionGuard>} />
        <Route path="settlement" element={<PermissionGuard perm="finance.settlements"><SettlementPage /></PermissionGuard>} />

        {/* ===== Employees ===== */}
        <Route path="employees" element={<PermissionGuard perm="admin.users"><AdminEmployeesPage /></PermissionGuard>} />
        <Route path="employee-salaries" element={<PermissionGuard perm="admin.users"><EmployeeSalariesPage /></PermissionGuard>} />

        {/* ===== Admin ===== */}
        <Route path="admin-entities" element={<PermissionGuard perm="admin.entities"><AdminEntitiesPage /></PermissionGuard>} />
        <Route path="admin-rooms" element={<PermissionGuard perm="admin.rooms"><AdminRoomsPage /></PermissionGuard>} />
        <Route path="lecturer-accounts" element={<PermissionGuard perm="finance.accounts"><LecturerAccountsPage /></PermissionGuard>} />
        <Route path="instructor-accounts" element={<PermissionGuard perm="admin.instructors"><InstructorAccountsPage /></PermissionGuard>} />
        <Route path="admin-users" element={<PermissionGuard perm="admin.users"><AdminUsersPage /></PermissionGuard>} />
        <Route path="admin-settings" element={<PermissionGuard perm="admin.settings"><AdminSettingsPage /></PermissionGuard>} />
        <Route path="admin-alerts" element={<PermissionGuard perm="admin.settings"><AdminAlertsPage /></PermissionGuard>} />
        <Route path="admin-announcements" element={<PermissionGuard perm="admin.announcements"><AdminAnnouncementsPage /></PermissionGuard>} />
        <Route path="whatsapp" element={<PermissionGuard perm="admin.settings"><WhatsAppPage /></PermissionGuard>} />
        <Route path="report-builder" element={<PermissionGuard perm="admin.settings"><ReportBuilderPage /></PermissionGuard>} />

        <Route path="settings" element={<UserSettingsPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

export default App;
