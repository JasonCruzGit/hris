import { useEffect, useState } from "react";
import { api } from "../api/client";

type Emp = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  department: { name: string } | null;
};

export function ReportsPage() {
  const [items, setItems] = useState<Emp[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: Emp[] }>("/api/reports/employees")
      .then((r) => setItems(r.items))
      .catch(() => setError("Could not load report data"));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Reports</h1>
      <p className="text-slate-500">Employee export snapshot (scope-aware)</p>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Department</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="px-4 py-3 font-mono text-xs">{e.employeeNumber}</td>
                <td className="px-4 py-3">
                  {e.firstName} {e.lastName}
                </td>
                <td className="px-4 py-3">{e.department?.name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Payroll Excel export: GET /api/reports/payroll.xlsx?payrollRunId=… (HR admin)
      </p>
    </div>
  );
}
