import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type LeaveType = { id: string; name: string; code: string };
type LeaveRequest = {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  totalDays: string;
  reason?: string | null;
  createdAt?: string;
  decidedAt?: string | null;
  leaveType: { name: string; code?: string };
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber?: string;
    email?: string | null;
  };
};
type Balance = {
  id: string;
  year: number;
  entitledDays: string;
  usedDays: string;
  leaveType: { name: string };
};

function formatMemoDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatMemoDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "long",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function LeavePage() {
  const { user } = useAuth();
  const role = user?.role ?? "EMPLOYEE";
  const canApprove = ["SUPER_ADMIN", "HR_ADMIN", "DEPARTMENT_HEAD"].includes(role);
  const isEmployee = !!user?.employee;

  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState<"all" | "pending">("all");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [viewing, setViewing] = useState<LeaveRequest | null>(null);

  const [form, setForm] = useState({
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    totalDays: "1",
    reason: "",
  });

  function reload() {
    const q = filter === "pending" ? "?status=PENDING" : "";
    api<{ items: LeaveRequest[] }>(`/api/leave/requests${q}`)
      .then((r) => setRequests(r.items))
      .catch(() => setError("Could not load leave requests"));
  }

  useEffect(() => {
    api<{ items: LeaveType[] }>("/api/leave/types")
      .then((r) => {
        setTypes(r.items);
        if (r.items[0] && !form.leaveTypeId) setForm((f) => ({ ...f, leaveTypeId: r.items[0].id }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api<{ items: Balance[] }>("/api/leave/balances")
      .then((r) => setBalances(r.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    reload();
  }, [filter]);

  useEffect(() => {
    if (!viewing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewing(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewing]);

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api("/api/leave/requests", {
        method: "POST",
        body: JSON.stringify({
          leaveTypeId: form.leaveTypeId,
          startDate: form.startDate,
          endDate: form.endDate,
          totalDays: Number(form.totalDays),
          reason: form.reason || undefined,
        }),
      });
      setMsg("Leave request submitted.");
      reload();
      api<{ items: Balance[] }>("/api/leave/balances").then((r) => setBalances(r.items));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  async function decide(id: string, status: "APPROVED" | "REJECTED"): Promise<boolean> {
    setMsg(null);
    try {
      await api(`/api/leave/requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setMsg(`Request ${status.toLowerCase()}.`);
      reload();
      api<{ items: Balance[] }>("/api/leave/balances").then((r) => setBalances(r.items));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
      return false;
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Leave</h1>
        <p className="text-slate-500">Requests, balances, and approvals</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-green-700 dark:text-green-400">{msg}</p>}

      {isEmployee && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-medium">Balances</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {balances.map((b) => (
              <li key={b.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950">
                <span className="font-medium">{b.leaveType.name}</span> ({b.year}): used {b.usedDays} /{" "}
                {b.entitledDays}
              </li>
            ))}
            {balances.length === 0 && <li className="text-slate-500">No balances on file</li>}
          </ul>

          <h2 className="mt-6 font-medium">New request</h2>
          <form className="mt-3 grid gap-3 text-sm" onSubmit={submitRequest}>
            <label className="block">
              Type
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={form.leaveTypeId}
                onChange={(e) => setForm((f) => ({ ...f, leaveTypeId: e.target.value }))}
              >
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label>
                Start
                <input
                  type="date"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </label>
              <label>
                End
                <input
                  type="date"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </label>
            </div>
            <label>
              Total days
              <input
                type="number"
                step="0.5"
                min="0.5"
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={form.totalDays}
                onChange={(e) => setForm((f) => ({ ...f, totalDays: e.target.value }))}
              />
            </label>
            <label>
              Reason
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                rows={2}
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white dark:bg-white dark:text-slate-900"
            >
              Submit request
            </button>
          </form>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Requests</h2>
          {canApprove && (
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                className={filter === "all" ? "font-semibold" : "text-slate-500"}
                onClick={() => setFilter("all")}
              >
                All
              </button>
              <button
                type="button"
                className={filter === "pending" ? "font-semibold" : "text-slate-500"}
                onClick={() => setFilter("pending")}
              >
                Pending only
              </button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3">Days</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Employee</th>
                {canApprove && <th className="px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {requests.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3">{l.leaveType.name}</td>
                  <td className="px-4 py-3">
                    {new Date(l.startDate).toLocaleDateString()} – {new Date(l.endDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">{l.totalDays}</td>
                  <td className="px-4 py-3">{l.status}</td>
                  <td className="px-4 py-3">
                    {l.employee ? `${l.employee.firstName} ${l.employee.lastName}` : "—"}
                  </td>
                  {canApprove && (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <button
                          type="button"
                          className="text-slate-700 underline decoration-slate-400 underline-offset-2 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                          onClick={() => setViewing(l)}
                        >
                          View
                        </button>
                        {l.status === "PENDING" && (
                          <>
                            <button
                              type="button"
                              className="text-green-700 underline decoration-green-600/50 underline-offset-2 dark:text-green-400"
                              onClick={() => void decide(l.id, "APPROVED")}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="text-red-600 underline decoration-red-500/50 underline-offset-2"
                              onClick={() => void decide(l.id, "REJECTED")}
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
          onClick={() => setViewing(null)}
          role="presentation"
        >
          <div
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-sm border border-slate-200/90 bg-[#fbfaf7] shadow-2xl ring-1 ring-black/5 dark:border-slate-600 dark:bg-[#1a1916] dark:ring-white/10"
            role="dialog"
            aria-labelledby="leave-view-title"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-amber-900/15 bg-gradient-to-r from-amber-900/10 via-transparent to-amber-900/5 px-6 py-4 dark:border-amber-200/10 dark:from-amber-200/5">
              <div className="flex items-start justify-between gap-4 font-memo">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-900/70 dark:text-amber-200/60">
                    Internal correspondence
                  </p>
                  <h2 id="leave-view-title" className="mt-1 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    Leave of absence request
                  </h2>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-md px-2.5 py-1 text-sm font-medium text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
                  onClick={() => setViewing(null)}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="px-6 pb-6 pt-5">
              <div className="border-b border-slate-900/10 pb-5 font-memo text-sm dark:border-slate-100/10">
                <div className="grid gap-2.5 sm:grid-cols-[5.5rem_1fr] sm:gap-x-4 sm:gap-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Date</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {viewing.createdAt ? formatMemoDate(viewing.createdAt) : formatMemoDate(viewing.startDate)}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">From</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {viewing.employee ? (
                      <>
                        <span className="font-medium">{viewing.employee.firstName} </span>
                        <span className="font-medium">{viewing.employee.lastName}</span>
                        {viewing.employee.employeeNumber ? (
                          <span className="text-slate-500 dark:text-slate-400"> ({viewing.employee.employeeNumber})</span>
                        ) : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Subject</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {viewing.leaveType.name} leave — {viewing.totalDays} day{Number(viewing.totalDays) === 1 ? "" : "s"} requested
                  </span>
                </div>
              </div>

              <div className="font-letter text-[1.05rem] leading-relaxed text-slate-800 dark:text-slate-200">
                <p className="mt-6 text-[1.08rem] leading-[1.65]">Dear Reviewer,</p>
                <p className="mt-4 leading-[1.7]">
                  {viewing.employee ? (
                    <>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {viewing.employee.firstName} {viewing.employee.lastName}
                      </span>
                      {viewing.employee.employeeNumber ? (
                        <span className="text-slate-600 dark:text-slate-300"> ({viewing.employee.employeeNumber})</span>
                      ) : null}{" "}
                      respectfully requests{" "}
                      <span className="whitespace-nowrap font-semibold text-slate-900 dark:text-slate-100">
                        {viewing.totalDays} calendar day{Number(viewing.totalDays) === 1 ? "" : "s"}
                      </span>{" "}
                      of <span className="italic">{viewing.leaveType.name.toLowerCase()}</span> leave, beginning{" "}
                      <span className="whitespace-nowrap">{formatMemoDate(viewing.startDate)}</span> and ending{" "}
                      <span className="whitespace-nowrap">{formatMemoDate(viewing.endDate)}</span>.
                    </>
                  ) : (
                    <>
                      This request is for{" "}
                      <span className="font-semibold">{viewing.totalDays}</span> day(s) of {viewing.leaveType.name} leave from{" "}
                      {formatMemoDate(viewing.startDate)} to {formatMemoDate(viewing.endDate)}.
                    </>
                  )}
                </p>

                <div className="mt-8">
                  <p className="font-memo text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    Employee message
                  </p>
                  <div className="mt-2 border border-slate-900/12 bg-white/60 px-4 py-4 text-[0.98rem] leading-[1.65] shadow-inner dark:border-slate-100/10 dark:bg-slate-950/30">
                    {viewing.reason?.trim() ? (
                      <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">{viewing.reason}</p>
                    ) : (
                      <p className="italic text-slate-500 dark:text-slate-500">No additional remarks were provided.</p>
                    )}
                  </div>
                </div>

                <div className="mt-8 border-t border-slate-900/10 pt-4 font-memo text-sm dark:border-slate-100/10">
                  <p>
                    <span className="text-slate-500 dark:text-slate-400">Current status: </span>
                    <span
                      className={
                        viewing.status === "PENDING"
                          ? "font-semibold text-amber-800 dark:text-amber-200"
                          : viewing.status === "APPROVED"
                            ? "font-semibold text-emerald-800 dark:text-emerald-200"
                            : "font-semibold text-slate-900 dark:text-slate-100"
                      }
                    >
                      {viewing.status}
                    </span>
                  </p>
                  {viewing.createdAt && (
                    <p className="mt-1 text-slate-600 dark:text-slate-400">
                      Submitted electronically on {formatMemoDateTime(viewing.createdAt)}.
                    </p>
                  )}
                  {viewing.decidedAt && (
                    <p className="mt-1 text-slate-600 dark:text-slate-400">Decision recorded on {formatMemoDateTime(viewing.decidedAt)}.</p>
                  )}
                </div>

                <p className="mt-8 text-[1.02rem] leading-[1.65] text-slate-800 dark:text-slate-200">Respectfully,</p>
                <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                  {viewing.employee ? `${viewing.employee.firstName} ${viewing.employee.lastName}` : "Employee"}
                </p>
              </div>
            </div>

            {viewing.status === "PENDING" && (
              <div className="flex flex-wrap gap-2 border-t border-slate-900/10 bg-slate-900/[0.03] px-6 py-4 dark:border-slate-100/10 dark:bg-white/[0.02]">
                <button
                  type="button"
                  className="rounded-md bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
                  onClick={async () => {
                    const ok = await decide(viewing.id, "APPROVED");
                    if (ok) setViewing(null);
                  }}
                >
                  Approve request
                </button>
                <button
                  type="button"
                  className="rounded-md border border-red-400/80 bg-transparent px-5 py-2.5 text-sm font-semibold text-red-800 transition hover:bg-red-50 dark:border-red-500/60 dark:text-red-300 dark:hover:bg-red-950/30"
                  onClick={async () => {
                    const ok = await decide(viewing.id, "REJECTED");
                    if (ok) setViewing(null);
                  }}
                >
                  Reject request
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
