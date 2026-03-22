import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { DashboardPage } from "../pages/DashboardPage";
import { EmployeeDashboardPage } from "../pages/employee/EmployeeDashboardPage";
import { EmployeeProfilePage } from "../pages/EmployeeProfilePage";

/** Staff / managers — not rank-and-file employee portal. */
export function StaffOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role === "EMPLOYEE") return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Employee portal only routes. */
export function EmployeeOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "EMPLOYEE") return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Admin home vs employee home. */
export function DashboardGate() {
  const { user } = useAuth();
  if (user?.role === "EMPLOYEE") return <EmployeeDashboardPage />;
  return <DashboardPage />;
}

/** Employees may only open their own profile record. */
export function EmployeeProfileGate() {
  const { id } = useParams();
  const { user } = useAuth();
  if (user?.role === "EMPLOYEE") {
    if (!user.employee?.id) {
      return (
        <div className="max-w-md rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/40">
          <h1 className="font-semibold text-amber-950 dark:text-amber-100">Profile not linked</h1>
          <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-200/90">
            Your login is not connected to an employee record yet. Contact HR to complete onboarding.
          </p>
        </div>
      );
    }
    if (id !== user.employee.id) {
      return <Navigate to={`/employees/${user.employee.id}`} replace />;
    }
  }
  return <EmployeeProfilePage />;
}
