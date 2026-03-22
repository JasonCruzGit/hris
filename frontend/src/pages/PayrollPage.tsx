import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type Run = { id: string; payDate: string; periodStart: string; periodEnd: string; status: string; _count: { lines: number } };
type Line = {
  id: string;
  grossPay: string;
  netPay: string;
  employee: { id: string; firstName: string; lastName: string; employeeNumber: string };
};

export function PayrollPage() {
  const { user } = useAuth();
  const canHr = ["SUPER_ADMIN", "HR_ADMIN"].includes(user?.role ?? "");
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [newRun, setNewRun] = useState({
    periodStart: "",
    periodEnd: "",
    payDate: "",
  });

  function loadRuns() {
    api<{ items: Run[] }>("/api/payroll/runs")
      .then((r) => setRuns(r.items))
      .catch(() => setError("Could not load payroll"));
  }

  useEffect(() => {
    loadRuns();
  }, []);

  useEffect(() => {
    if (!selectedRun) {
      setLines([]);
      return;
    }
    api<{ items: Line[] }>(`/api/payroll/lines?payrollRunId=${encodeURIComponent(selectedRun)}`)
      .then((r) => setLines(r.items))
      .catch(() => setError("Could not load lines"));
  }, [selectedRun]);

  async function createRun(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api("/api/payroll/runs", {
        method: "POST",
        body: JSON.stringify({
          periodStart: newRun.periodStart,
          periodEnd: newRun.periodEnd,
          payDate: newRun.payDate,
        }),
      });
      setMsg("Payroll run created.");
      loadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function generate(id: string) {
    setMsg(null);
    try {
      const r = await api<{ count: number }>(`/api/payroll/runs/${id}/generate`, { method: "POST" });
      setMsg(`Generated ${r.count} line(s).`);
      loadRuns();
      setSelectedRun(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Payroll</h1>
        <p className="text-slate-500">Runs, PH tables (JSON), PDF payslips, Excel export</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-green-700 dark:text-green-400">{msg}</p>}

      {canHr && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-medium">New payroll run</h2>
          <form className="mt-3 grid gap-3 text-sm" onSubmit={createRun}>
            <label>
              Period start
              <input
                type="date"
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={newRun.periodStart}
                onChange={(e) => setNewRun((n) => ({ ...n, periodStart: e.target.value }))}
              />
            </label>
            <label>
              Period end
              <input
                type="date"
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={newRun.periodEnd}
                onChange={(e) => setNewRun((n) => ({ ...n, periodEnd: e.target.value }))}
              />
            </label>
            <label>
              Pay date
              <input
                type="date"
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={newRun.payDate}
                onChange={(e) => setNewRun((n) => ({ ...n, payDate: e.target.value }))}
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-white dark:bg-white dark:text-slate-900"
            >
              Create run
            </button>
          </form>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-medium">Runs</h2>
        <div className="space-y-3">
          {runs.map((run) => (
            <div
              key={run.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <div className="font-medium">{run.status}</div>
                <div className="text-sm text-slate-500">
                  Pay {new Date(run.payDate).toLocaleDateString()} · {run._count.lines} lines · period{" "}
                  {new Date(run.periodStart).toLocaleDateString()} – {new Date(run.periodEnd).toLocaleDateString()}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {canHr && (
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-3 py-1 text-sm dark:border-slate-600"
                    onClick={() => void generate(run.id)}
                  >
                    Generate lines
                  </button>
                )}
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1 text-sm ${
                    selectedRun === run.id
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "border border-slate-300 dark:border-slate-600"
                  }`}
                  onClick={() => setSelectedRun(run.id)}
                >
                  View lines
                </button>
                {canHr && (
                  <a
                    className="rounded-lg border border-slate-300 px-3 py-1 text-sm dark:border-slate-600"
                    href={`/api/reports/payroll.xlsx?payrollRunId=${run.id}`}
                  >
                    Excel
                  </a>
                )}
              </div>
            </div>
          ))}
          {runs.length === 0 && <p className="text-slate-500">No payroll runs yet.</p>}
        </div>
      </section>

      {selectedRun && (
        <section>
          <h2 className="mb-3 font-medium">Lines</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Gross</th>
                  <th className="px-4 py-3">Net</th>
                  <th className="px-4 py-3">Payslip</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3">
                      {l.employee.firstName} {l.employee.lastName}{" "}
                      <span className="font-mono text-xs text-slate-500">{l.employee.employeeNumber}</span>
                    </td>
                    <td className="px-4 py-3">{l.grossPay}</td>
                    <td className="px-4 py-3">{l.netPay}</td>
                    <td className="px-4 py-3">
                      <a
                        className="text-slate-900 underline dark:text-white"
                        href={`/api/payroll/lines/${l.id}/payslip.pdf`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
