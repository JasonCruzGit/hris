import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type Row = {
  id: string;
  workDate: string;
  timeIn: string | null;
  timeOut: string | null;
  source: string;
  isLate: boolean;
  undertimeMins: number;
  overtimeMins: number;
  employee: { employeeNumber: string; firstName: string; lastName: string };
};

const PAGE_SIZE = 25;

const SOURCE_LABEL: Record<string, string> = {
  MANUAL: "Manual",
  QR: "QR / kiosk",
  BIOMETRIC: "Biometric",
  INTEGRATION: "Integration",
};

function formatMins(m: number): string {
  if (!m || m <= 0) return "—";
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  return min ? `${h}h ${min}m` : `${h}h`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultFromISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export function AttendancePage() {
  const { user } = useAuth();
  const role = user?.role ?? "EMPLOYEE";
  const canHr = ["SUPER_ADMIN", "HR_ADMIN"].includes(role);
  const isEmployee = !!user?.employee;
  /** Hide name/number column only for employees viewing solely their own rows. */
  const showEmployeeCol = !(role === "EMPLOYEE" && isEmployee);
  /** Two side-by-side form columns only when both self-service and HR QR are visible. */
  const dualFormColumns = isEmployee && canHr;

  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState(defaultFromISO);
  const [to, setTo] = useState(todayISO);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [selfSaving, setSelfSaving] = useState(false);
  const [qrSaving, setQrSaving] = useState(false);

  const [self, setSelf] = useState({
    workDate: todayISO(),
    timeIn: "",
    timeOut: "",
  });
  const [qr, setQr] = useState({
    id: "",
    workDate: todayISO(),
    timeIn: "",
    timeOut: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const r = await api<{ items: Row[]; total: number }>(`/api/attendance?${params.toString()}`);
      setItems(r.items);
      setTotal(r.total);
    } catch {
      setError("Could not load attendance");
    } finally {
      setLoading(false);
    }
  }, [page, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [from, to]);

  const filteredItems = useMemo(() => {
    if (!showEmployeeCol || !employeeFilter.trim()) return items;
    const q = employeeFilter.trim().toLowerCase();
    return items.filter((a) => {
      const name = `${a.employee.firstName} ${a.employee.lastName}`.toLowerCase();
      const num = a.employee.employeeNumber.toLowerCase();
      return name.includes(q) || num.includes(q);
    });
  }, [items, employeeFilter, showEmployeeCol]);

  const lateOnPage = useMemo(() => filteredItems.filter((a) => a.isLate).length, [filteredItems]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function logSelf(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setError(null);
    setSelfSaving(true);
    const body: Record<string, string> = { workDate: self.workDate };
    if (self.timeIn) body.timeIn = new Date(`${self.workDate}T${self.timeIn}`).toISOString();
    if (self.timeOut) body.timeOut = new Date(`${self.workDate}T${self.timeOut}`).toISOString();
    try {
      await api("/api/attendance/self", { method: "POST", body: JSON.stringify(body) });
      setMsg("Attendance saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSelfSaving(false);
    }
  }

  async function scanQr(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setError(null);
    setQrSaving(true);
    try {
      const body: Record<string, string> = { qrEmployeeId: qr.id.trim() };
      body.workDate = qr.workDate;
      if (qr.timeIn) body.timeIn = new Date(`${qr.workDate}T${qr.timeIn}`).toISOString();
      if (qr.timeOut) body.timeOut = new Date(`${qr.workDate}T${qr.timeOut}`).toISOString();
      await api("/api/attendance/qr-scan", { method: "POST", body: JSON.stringify(body) });
      setMsg("QR attendance recorded.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "QR failed");
    } finally {
      setQrSaving(false);
    }
  }

  function setSelfToday() {
    setSelf((s) => ({ ...s, workDate: todayISO() }));
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-12">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Attendance</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            View time logs and record attendance. Late, undertime, and overtime follow each branch&apos;s schedule and grace
            rules.
          </p>
        </div>
      </div>

      {error && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      )}
      {msg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100">
          {msg}
        </div>
      )}

      <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">In date range</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">{total}</p>
          <p className="mt-1 text-xs text-slate-500">Total log entries matching filters</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Late (this page)</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-amber-700 dark:text-amber-300">{lateOnPage}</p>
          <p className="mt-1 text-xs text-slate-500">Rows flagged late on the current page</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Page</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {page}
            <span className="text-lg font-normal text-slate-400"> / {totalPages}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">{PAGE_SIZE} rows per page</p>
        </div>
      </div>

      <div className={`grid w-full min-w-0 gap-6 ${dualFormColumns ? "lg:grid-cols-2 lg:items-start" : "grid-cols-1"}`}>
        {isEmployee && (
          <section className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Log my attendance</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Add or update your times for a workday. Leave times blank only if you need to clear them via support.
                </p>
              </div>
              <button
                type="button"
                onClick={setSelfToday}
                className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Today
              </button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={logSelf}>
              <label className="block text-sm">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Work date</span>
                <input
                  type="date"
                  required
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  value={self.workDate}
                  onChange={(e) => setSelf((s) => ({ ...s, workDate: e.target.value }))}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Time in
                  </span>
                  <input
                    type="time"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    value={self.timeIn}
                    onChange={(e) => setSelf((s) => ({ ...s, timeIn: e.target.value }))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Time out
                  </span>
                  <input
                    type="time"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    value={self.timeOut}
                    onChange={(e) => setSelf((s) => ({ ...s, timeOut: e.target.value }))}
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={selfSaving}
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 sm:w-auto"
              >
                {selfSaving ? "Saving…" : "Save attendance"}
              </button>
            </form>
          </section>
        )}

        {canHr && (
          <section className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">QR / kiosk (HR)</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Scan or enter an employee&apos;s QR id. Optional times default to now when omitted.
                </p>
              </div>
            </div>
            <form className="mt-5 space-y-4" onSubmit={scanQr}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block min-w-0 text-sm">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    QR employee id
                  </span>
                  <input
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-mono text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    placeholder="Value from employee QR"
                    value={qr.id}
                    onChange={(e) => setQr((q) => ({ ...q, id: e.target.value }))}
                    required
                    autoComplete="off"
                  />
                </label>
                <label className="block min-w-0 text-sm">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Work date</span>
                  <input
                    type="date"
                    required
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    value={qr.workDate}
                    onChange={(e) => setQr((q) => ({ ...q, workDate: e.target.value }))}
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Time in (optional)
                  </span>
                  <input
                    type="time"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    value={qr.timeIn}
                    onChange={(e) => setQr((q) => ({ ...q, timeIn: e.target.value }))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Time out (optional)
                  </span>
                  <input
                    type="time"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    value={qr.timeOut}
                    onChange={(e) => setQr((q) => ({ ...q, timeOut: e.target.value }))}
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={qrSaving}
                  className="w-full rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 sm:w-auto dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
                >
                  {qrSaving ? "Recording…" : "Record QR attendance"}
                </button>
              </div>
            </form>
          </section>
        )}

        {!isEmployee && !canHr && (
          <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
            <p className="font-medium text-slate-800 dark:text-slate-200">No self-service profile</p>
            <p className="mt-1">Your account is not linked to an employee record. You can still review attendance you are allowed to see.</p>
          </section>
        )}
      </div>

      <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-slate-50/90 px-4 py-4 sm:px-6 dark:border-slate-800 dark:bg-slate-950/50">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent logs</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Pick a date range, then search or change page.</p>
          <div
            className={`mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:items-end lg:gap-4 ${
              showEmployeeCol ? "lg:grid-cols-12" : "lg:grid-cols-2"
            }`}
          >
            <label className={`text-sm ${showEmployeeCol ? "lg:col-span-2" : ""}`}>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">From</span>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className={`text-sm ${showEmployeeCol ? "lg:col-span-2" : ""}`}>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">To</span>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            {showEmployeeCol && (
              <label className="text-sm sm:col-span-2 lg:col-span-8">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Filter name / ID (this page)
                </span>
                <input
                  type="search"
                  placeholder="Search loaded rows…"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                />
              </label>
            )}
          </div>
        </div>

        <div className="overflow-hidden">
          <div className="overflow-x-auto" aria-busy={loading}>
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Date</th>
                  {showEmployeeCol && <th className="whitespace-nowrap px-4 py-3">Employee</th>}
                  <th className="whitespace-nowrap px-4 py-3">In</th>
                  <th className="whitespace-nowrap px-4 py-3">Out</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                  <th className="whitespace-nowrap px-4 py-3">UT / OT</th>
                  <th className="whitespace-nowrap px-4 py-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={showEmployeeCol ? 7 : 6} className="px-4 py-12 text-center text-slate-500">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
                        Loading attendance…
                      </span>
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={showEmployeeCol ? 7 : 6} className="px-4 py-14 text-center text-slate-500 dark:text-slate-400">
                      No rows for this range
                      {showEmployeeCol && employeeFilter.trim() ? " (or no name matches on this page)" : ""}.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((a) => (
                    <tr key={a.id} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {new Date(a.workDate).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      {showEmployeeCol && (
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {a.employee.firstName} {a.employee.lastName}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{a.employee.employeeNumber}</div>
                        </td>
                      )}
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                        {a.timeIn ? new Date(a.timeIn).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                        {a.timeOut ? new Date(a.timeOut).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {!a.timeIn || !a.timeOut ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            Incomplete
                          </span>
                        ) : a.isLate ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                            Late
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
                            On time
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        <span title="Undertime">{formatMins(a.undertimeMins)}</span>
                        <span className="mx-1 text-slate-300 dark:text-slate-600">/</span>
                        <span title="Overtime">{formatMins(a.overtimeMins)}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {SOURCE_LABEL[a.source] ?? a.source}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
