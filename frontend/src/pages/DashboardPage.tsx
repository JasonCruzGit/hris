import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type Stats = {
  employeeCount: number;
  activeEmployees: number;
  attendanceToday: number;
  pendingLeaves: number;
  lastPayrollRun: { id: string; payDate: string; status: string } | null;
};

export function DashboardPage() {
  const { user } = useAuth();
  const canHr = ["SUPER_ADMIN", "HR_ADMIN"].includes(user?.role ?? "");
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expiring, setExpiring] = useState<{ items: { id: string; title: string; expiresAt: string | null }[] } | null>(
    null
  );
  const [cronMsg, setCronMsg] = useState<string | null>(null);

  useEffect(() => {
    api<Stats>("/api/dashboard/stats")
      .then((r) => setStats(r))
      .catch(() => setError("Could not load dashboard"));
  }, []);

  useEffect(() => {
    const t = localStorage.getItem("hris_theme");
    if (t === "dark") document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    if (!canHr) return;
    api<{ items: { id: string; title: string; expiresAt: string | null }[] }>("/api/employees/documents/expiring?days=60")
      .then(setExpiring)
      .catch(() => {});
  }, [canHr]);

  async function runDocAlerts() {
    setCronMsg(null);
    try {
      const r = await api<{ documents: number; notificationsSent: number }>(
        "/api/cron/document-expiry-alerts?days=30",
        { method: "POST" }
      );
      setCronMsg(`Alerts queued: ${r.documents} document(s), ${r.notificationsSent} HR notification(s).`);
    } catch (e) {
      setCronMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-1 text-slate-500">Overview of workforce and operations</p>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric title="Employees (scope)" value={stats?.employeeCount ?? "—"} />
        <Metric title="Active" value={stats?.activeEmployees ?? "—"} />
        <Metric title="Attendance today" value={stats?.attendanceToday ?? "—"} />
        <Metric title="Pending leave" value={stats?.pendingLeaves ?? "—"} />
      </div>
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-medium">Latest payroll run</h2>
        <p className="mt-2 text-sm text-slate-500">
          {stats?.lastPayrollRun
            ? `${stats.lastPayrollRun.status} · ${new Date(stats.lastPayrollRun.payDate).toLocaleDateString()}`
            : "No runs yet"}
        </p>
      </div>

      {canHr && (
        <div className="mt-8 space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-medium">HR tools</h2>
          <p className="text-sm text-slate-500">
            Company filter in the header scopes employee lists. Use document expiry to trigger in-app reminders.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-slate-900"
              onClick={() => void runDocAlerts()}
            >
              Notify HR — document expiries (30d)
            </button>
          </div>
          {cronMsg && <p className="text-sm text-green-700 dark:text-green-400">{cronMsg}</p>}
          <div>
            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Expiring soon (60d)</h3>
            <ul className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {(expiring?.items ?? []).length === 0 && <li>None</li>}
              {(expiring?.items ?? []).map((d) => (
                <li key={d.id}>
                  {d.title} · expires {d.expiresAt ? new Date(d.expiresAt).toLocaleDateString() : "—"}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
