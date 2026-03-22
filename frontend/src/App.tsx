import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { CompanyProvider } from "./context/CompanyContext";
import { AppShell } from "./layout/AppShell";
import { EmployeeAppShell } from "./layout/EmployeeAppShell";
import { LoginPage } from "./pages/LoginPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { LeavePage } from "./pages/LeavePage";
import { AttendancePage } from "./pages/AttendancePage";
import { PayrollPage } from "./pages/PayrollPage";
import { RecruitmentPage } from "./pages/RecruitmentPage";
import { PerformancePage } from "./pages/PerformancePage";
import { TrainingPage } from "./pages/TrainingPage";
import { ReportsPage } from "./pages/ReportsPage";
import { RequestDocumentPage } from "./pages/RequestDocumentPage";
import { EmployeeFilesPage } from "./pages/EmployeeFilesPage";
import { MessagesPage } from "./pages/MessagesPage";
import { AnnouncementsPage } from "./pages/AnnouncementsPage";
import { EmployeeDatabasePage } from "./pages/EmployeeDatabasePage";
import { MyPerformancePage } from "./pages/employee/MyPerformancePage";
import { MyTrainingPage } from "./pages/employee/MyTrainingPage";
import { EmployeeNotificationsPage } from "./pages/employee/EmployeeNotificationsPage";
import { DashboardGate, EmployeeOnly, EmployeeProfileGate, StaffOnly } from "./routing/AccessGuards";

function Protected({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-slate-600 dark:text-slate-400">Loading…</p>
      </div>
    );
  }
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

/** Employees get the dedicated portal shell; everyone else uses the admin / manager shell. */
function AppLayout() {
  const { user } = useAuth();
  if (user?.role === "EMPLOYEE") return <EmployeeAppShell />;
  return <AppShell />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <Protected>
            <CompanyProvider>
              <AppLayout />
            </CompanyProvider>
          </Protected>
        }
      >
        <Route path="/" element={<DashboardGate />} />
        <Route
          path="/employees"
          element={
            <StaffOnly>
              <EmployeesPage />
            </StaffOnly>
          }
        />
        <Route path="/employees/:id" element={<EmployeeProfileGate />} />
        <Route
          path="/employee-database"
          element={
            <StaffOnly>
              <Navigate to="/employee-database/regular" replace />
            </StaffOnly>
          }
        />
        <Route
          path="/employee-database/regular"
          element={
            <StaffOnly>
              <EmployeeDatabasePage section="regular" />
            </StaffOnly>
          }
        />
        <Route
          path="/employee-database/job-order"
          element={
            <StaffOnly>
              <EmployeeDatabasePage section="jobOrder" />
            </StaffOnly>
          }
        />
        <Route
          path="/employee-database/contract-of-service"
          element={
            <StaffOnly>
              <EmployeeDatabasePage section="contractOfService" />
            </StaffOnly>
          }
        />
        <Route path="/leave" element={<LeavePage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/payroll" element={<PayrollPage />} />
        <Route
          path="/recruitment"
          element={
            <StaffOnly>
              <RecruitmentPage />
            </StaffOnly>
          }
        />
        <Route
          path="/performance"
          element={
            <StaffOnly>
              <PerformancePage />
            </StaffOnly>
          }
        />
        <Route
          path="/training"
          element={
            <StaffOnly>
              <TrainingPage />
            </StaffOnly>
          }
        />
        <Route
          path="/reports"
          element={
            <StaffOnly>
              <ReportsPage />
            </StaffOnly>
          }
        />
        <Route path="/request-document" element={<RequestDocumentPage />} />
        <Route path="/employee-files" element={<EmployeeFilesPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route
          path="/my-performance"
          element={
            <EmployeeOnly>
              <MyPerformancePage />
            </EmployeeOnly>
          }
        />
        <Route
          path="/my-training"
          element={
            <EmployeeOnly>
              <MyTrainingPage />
            </EmployeeOnly>
          }
        />
        <Route
          path="/notifications"
          element={
            <EmployeeOnly>
              <EmployeeNotificationsPage />
            </EmployeeOnly>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
