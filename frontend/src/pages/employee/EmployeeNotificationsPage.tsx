import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export function EmployeeNotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markAllBusy, setMarkAllBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api<{ items: NotificationItem[] }>("/api/notifications");
      setItems(r.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  async function markRead(id: string) {
    setBusyId(id);
    try {
      await api(`/api/notifications/${id}/read`, { method: "PATCH" });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    } catch {
      setError("Could not update notification");
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    setMarkAllBusy(true);
    try {
      await api("/api/notifications/read-all", { method: "PATCH" });
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    } catch {
      setError("Could not mark all as read");
    } finally {
      setMarkAllBusy(false);
    }
  }

  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <nav className="mb-1 text-xs text-slate-500 dark:text-slate-400">
            <Link to="/" className="hover:text-emerald-700 dark:hover:text-emerald-400">
              Home
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-slate-700 dark:text-slate-300">Notifications</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            In-app messages for your account, including leave decisions and other updates.
          </p>
        </div>
        {unread > 0 && (
          <button
            type="button"
            disabled={markAllBusy}
            onClick={() => void markAllRead()}
            className="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-900 shadow-sm transition hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
          >
            {markAllBusy ? "Marking…" : `Mark all read (${unread})`}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/40">
          <p className="text-slate-600 dark:text-slate-300">No notifications yet.</p>
          <p className="mt-2 text-sm text-slate-500">When HR approves leave or other events occur, they will appear here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => {
            const isUnread = !n.readAt;
            return (
              <li key={n.id}>
                <article
                  className={[
                    "rounded-2xl border px-4 py-4 shadow-sm transition sm:px-5",
                    isUnread
                      ? "border-emerald-300/80 bg-white ring-1 ring-emerald-200/50 dark:border-emerald-800/60 dark:bg-slate-900 dark:ring-emerald-900/30"
                      : "border-slate-200/90 bg-white/90 dark:border-slate-800 dark:bg-slate-900/60",
                  ].join(" ")}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isUnread && (
                          <span className="inline-flex rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            New
                          </span>
                        )}
                        <h2 className="font-semibold text-slate-900 dark:text-slate-100">{n.title}</h2>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                        {n.body}
                      </p>
                      <p className="mt-3 text-xs text-slate-500 dark:text-slate-500">
                        {new Date(n.createdAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                    {isUnread && (
                      <button
                        type="button"
                        disabled={busyId === n.id}
                        onClick={() => void markRead(n.id)}
                        className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {busyId === n.id ? "…" : "Mark read"}
                      </button>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
