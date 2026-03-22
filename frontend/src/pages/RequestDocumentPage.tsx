import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export type DocumentRequest = {
  id: string;
  docType: string;
  purpose: string;
  delivery: string;
  urgency: string;
  notes: string;
  status: "Submitted" | "In review" | "Ready" | "Closed";
  statusNote?: string | null;
  createdAt: string;
  employee?: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    department: { name: string } | null;
  };
  requestedByUser?: { email: string };
};

const DOC_TYPES = [
  "Certificate of employment",
  "Certificate of employment (with compensation)",
  "Company ID / access card",
  "201 / BIR / statutory copies",
  "Employment contract copy",
  "Other",
];

const DELIVERY = ["Digital (email)", "Pickup (HR)", "Internal mail"];
const URGENCY = ["Normal", "Urgent (3 business days)", "Critical (same day if possible)"] as const;

function statusClasses(status: DocumentRequest["status"]) {
  switch (status) {
    case "Submitted":
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
    case "In review":
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
    case "Ready":
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  }
}

export function RequestDocumentPage() {
  const { user } = useAuth();
  const isEmployee = user?.role === "EMPLOYEE";
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | DocumentRequest["status"]>("all");
  const [form, setForm] = useState<{
    docType: string;
    purpose: string;
    delivery: string;
    urgency: string;
    notes: string;
  }>({
    docType: DOC_TYPES[0]!,
    purpose: "",
    delivery: DELIVERY[0]!,
    urgency: URGENCY[0],
    notes: "",
  });

  useEffect(() => {
    void loadRequests();
  }, [isEmployee]);

  async function loadRequests() {
    try {
      setError(null);
      const endpoint = isEmployee ? "/api/document-requests/mine" : "/api/document-requests";
      const res = await api<{ items: DocumentRequest[] }>(endpoint);
      setRequests(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load requests");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.purpose.trim()) {
      setMsg("Please describe what you need.");
      return;
    }
    try {
      setError(null);
      await api("/api/document-requests", {
        method: "POST",
        body: JSON.stringify({
          docType: form.docType,
          purpose: form.purpose.trim(),
          delivery: form.delivery,
          urgency: form.urgency,
          notes: form.notes.trim() || undefined,
        }),
      });
      setForm({
        docType: DOC_TYPES[0]!,
        purpose: "",
        delivery: DELIVERY[0]!,
        urgency: URGENCY[0],
        notes: "",
      });
      setMsg("Request submitted.");
      setTimeout(() => setMsg(null), 3000);
      await loadRequests();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit request");
    }
  }

  async function updateStatus(id: string, status: DocumentRequest["status"]) {
    try {
      setError(null);
      await api(`/api/document-requests/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      setMsg("Status updated.");
      setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update status");
    }
  }

  const visible = filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const submittedCount = requests.filter((r) => r.status === "Submitted").length;
  const inReviewCount = requests.filter((r) => r.status === "In review").length;
  const readyCount = requests.filter((r) => r.status === "Ready").length;

  return (
    <div className="w-full space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Request document</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          {isEmployee
            ? "Ask HR for certificates, verifications, IDs, and other official documents."
            : "Review and manage employee document requests."}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Submitted</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{submittedCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">In review</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{inReviewCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Ready</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{readyCount}</p>
        </div>
      </section>

      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {msg}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-5">
        {isEmployee && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">New request</h2>
          <form className="mt-4 space-y-4" onSubmit={submit}>
            <label className="block text-sm">
              Document type
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={form.docType}
                onChange={(e) => setForm((f) => ({ ...f, docType: e.target.value }))}
              >
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Purpose / details <span className="text-red-600">*</span>
              <textarea
                required
                rows={3}
                placeholder="e.g. Visa application - need COE dated this month"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={form.purpose}
                onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              Delivery
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={form.delivery}
                onChange={(e) => setForm((f) => ({ ...f, delivery: e.target.value }))}
              >
                {DELIVERY.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Urgency
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={form.urgency}
                onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value }))}
              >
                {URGENCY.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Notes for HR
              <textarea
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Submit request
            </button>
          </form>
          </section>
        )}

        <section
          className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${
            isEmployee ? "lg:col-span-3" : "lg:col-span-5"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {isEmployee ? "Your requests" : "Employee requests"}
              </h2>
              <span className="text-xs text-slate-500">{requests.length} total</span>
            </div>
            <select
              className="w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              value={filter}
              onChange={(e) => setFilter(e.target.value as "all" | DocumentRequest["status"])}
            >
              <option value="all">All statuses</option>
              <option value="Submitted">Submitted</option>
              <option value="In review">In review</option>
              <option value="Ready">Ready</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                  <th className="pb-2 pr-3">Submitted</th>
                  {!isEmployee && <th className="pb-2 pr-3">Employee</th>}
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2 pr-3">Delivery</th>
                  {!isEmployee && <th className="pb-2 pr-3">Urgency</th>}
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={isEmployee ? 4 : 6} className="py-8 text-center text-slate-500">
                      No requests for this status yet.
                    </td>
                  </tr>
                )}
                {visible.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-3 pr-3 align-top text-slate-600 dark:text-slate-400">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    {!isEmployee && (
                      <td className="py-3 pr-3 align-top text-slate-700 dark:text-slate-300">
                        <div className="font-medium">
                          {r.employee?.firstName} {r.employee?.lastName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {r.employee?.employeeNumber}
                          {r.employee?.department?.name ? ` • ${r.employee.department.name}` : ""}
                        </div>
                      </td>
                    )}
                    <td className="py-3 pr-3 align-top">
                      <div className="font-medium">{r.docType}</div>
                      <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{r.purpose}</div>
                    </td>
                    <td className="py-3 pr-3 align-top text-slate-600">{r.delivery}</td>
                    {!isEmployee && <td className="py-3 pr-3 align-top text-slate-600">{r.urgency}</td>}
                    <td className="py-3 align-top">
                      {isEmployee ? (
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClasses(r.status)}`}>
                          {r.status}
                        </span>
                      ) : (
                        <select
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses(r.status)}`}
                          value={r.status}
                          onChange={(e) => void updateStatus(r.id, e.target.value as DocumentRequest["status"])}
                        >
                          <option>Submitted</option>
                          <option>In review</option>
                          <option>Ready</option>
                          <option>Closed</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
