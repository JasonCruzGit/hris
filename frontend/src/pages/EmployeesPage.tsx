import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useCompany } from "../context/CompanyContext";

type Row = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  department: { name: string } | null;
  position: { title: string } | null;
};

export function EmployeesPage() {
  const { companyId } = useCompany();
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams({ page: "1", pageSize: "50" });
    if (search.trim()) q.set("search", search.trim());
    if (companyId) q.set("companyId", companyId);
    api<{ items: Row[]; total: number }>(`/api/employees?${q.toString()}`)
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
      })
      .catch(() => setError("Failed to load employees"));
  }, [search, companyId]);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Employees</h1>
          <p className="text-slate-500">{total} records {companyId ? "(company filter)" : ""}</p>
        </div>
        <input
          placeholder="Search name or number…"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Position</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="px-4 py-3 font-mono text-xs">{e.employeeNumber}</td>
                <td className="px-4 py-3">
                  <Link className="font-medium text-slate-900 underline dark:text-white" to={`/employees/${e.id}`}>
                    {e.firstName} {e.lastName}
                  </Link>
                </td>
                <td className="px-4 py-3">{e.department?.name ?? "—"}</td>
                <td className="px-4 py-3">{e.position?.title ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
