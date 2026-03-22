import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

type Summary = {
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    department: { name: string } | null;
    position: { title: string } | null;
    branch: { name: string } | null;
    employmentStatus: string;
  };
  leaveBalances: {
    id: string;
    year: number;
    entitledDays: string;
    usedDays: string;
    leaveType: { name: string; code: string };
  }[];
  pendingLeaveRequests: number;
  attendanceDaysThisWeek: number;
  unreadNotifications: number;
  lastPayslip: {
    id: string;
    netPay: string;
    payDate: string;
    periodEnd: string;
  } | null;
};

type AnnouncementSlide = {
  id: string;
  title: string;
  summary: string;
  audience: string;
  pinned: boolean;
  createdAt: string;
  imageUrl?: string | null;
};

type NotifPreview = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export function EmployeeDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Summary | null>(null);
  const [slides, setSlides] = useState<AnnouncementSlide[]>([]);
  const [notifPreview, setNotifPreview] = useState<NotifPreview[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<Summary>("/api/employee/summary"),
      api<{ items: NotifPreview[] }>("/api/notifications"),
      api<{ items: AnnouncementSlide[] }>("/api/announcements"),
    ])
      .then(([summary, notifs, announcements]) => {
        setData(summary);
        setNotifPreview(notifs.items.slice(0, 5));
        setSlides(announcements.items.slice(0, 8));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load summary"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = window.setInterval(() => {
      setSlideIndex((i) => (i + 1) % slides.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [slides.length]);

  if (loading) {
    return <p className="text-slate-500">Loading your portal…</p>;
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/30">
        <h1 className="text-lg font-semibold text-amber-950 dark:text-amber-100">Employee access</h1>
        <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-200/90">
          {error ?? "Unable to load your profile."} If you just received this account, ask HR to link your employee
          record to your login.
        </p>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Signed in as {user?.email}</p>
      </div>
    );
  }

  const e = data.employee;
  const activeSlide = slides[slideIndex];

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {activeSlide ? (
          <div className="grid gap-0 lg:grid-cols-[1.3fr_1fr]">
            <div className="p-6 lg:p-8">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Announcements</p>
                {activeSlide.pinned && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                    Pinned
                  </span>
                )}
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {activeSlide.title}
              </h2>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {activeSlide.summary}
              </p>
              <p className="mt-4 text-xs text-slate-500">
                {activeSlide.audience} • {new Date(activeSlide.createdAt).toLocaleDateString()}
              </p>

              {slides.length > 1 && (
                <div className="mt-5 flex items-center justify-between gap-3">
                  <div className="flex gap-1.5">
                    {slides.map((s, i) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSlideIndex(i)}
                        className={`h-1.5 rounded-full transition ${
                          i === slideIndex ? "w-8 bg-slate-900 dark:bg-slate-200" : "w-3 bg-slate-300 dark:bg-slate-700"
                        }`}
                        aria-label={`Go to announcement ${i + 1}`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSlideIndex((i) => (i - 1 + slides.length) % slides.length)}
                      className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      aria-label="Previous announcement"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlideIndex((i) => (i + 1) % slides.length)}
                      className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      aria-label="Next announcement"
                    >
                      →
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="relative min-h-[220px] border-t border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950 lg:min-h-[260px] lg:border-l lg:border-t-0">
              {activeSlide.imageUrl ? (
                <img
                  src={activeSlide.imageUrl}
                  alt={activeSlide.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  No image attached for this announcement.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Announcements</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">No announcements available.</p>
          </div>
        )}
      </section>

      <header>
        <p className="text-sm text-slate-500">Welcome back</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {e.firstName} {e.lastName}
        </h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          {e.position?.title ?? "—"} · {e.department?.name ?? "—"}
          {e.branch && ` · ${e.branch.name}`}
        </p>
        <p className="mt-1 font-mono text-xs text-slate-500">{e.employeeNumber}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Pending leave"
          value={data.pendingLeaveRequests}
          hint="Awaiting approval"
          to="/leave"
        />
        <MetricCard
          title="Attendance (7 days)"
          value={data.attendanceDaysThisWeek}
          hint="Days with a log"
          to="/attendance"
        />
        <MetricCard title="Unread" value={data.unreadNotifications} hint="In-app notifications" to="/notifications" />
        <Link
          to={data.lastPayslip ? `/payroll` : "/payroll"}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
        >
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Last payslip</div>
          {data.lastPayslip ? (
            <>
              <div className="mt-2 text-2xl font-semibold tabular-nums">
                PHP {Number(data.lastPayslip.netPay).toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Pay date {new Date(data.lastPayslip.payDate).toLocaleDateString()}
              </div>
            </>
          ) : (
            <div className="mt-2 text-sm text-slate-500">No payslips yet</div>
          )}
          <div className="mt-2 text-xs font-medium text-sky-700 dark:text-sky-400">View payroll →</div>
        </Link>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Notifications</h2>
          <Link
            to="/notifications"
            className="text-sm font-medium text-sky-700 hover:underline dark:text-sky-400"
          >
            Open inbox →
          </Link>
        </div>
        {notifPreview.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No notifications yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {notifPreview.map((n) => (
              <li key={n.id}>
                <Link
                  to="/notifications"
                  className="block rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 transition hover:border-emerald-200 hover:bg-emerald-50/50 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/20"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {!n.readAt && (
                      <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                        New
                      </span>
                    )}
                    <span className="font-medium text-slate-900 dark:text-slate-100">{n.title}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{n.body}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {new Date(n.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Leave balances</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {data.leaveBalances.length === 0 && <li className="text-sm text-slate-500">No balances on file</li>}
          {data.leaveBalances.slice(0, 6).map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-950/50"
            >
              <div>
                <div className="font-medium">{b.leaveType.name}</div>
                <div className="text-xs text-slate-500">{b.year}</div>
              </div>
              <div className="text-right text-sm tabular-nums">
                <span className="font-semibold">{b.usedDays}</span>
                <span className="text-slate-400"> / </span>
                <span>{b.entitledDays}</span>
              </div>
            </li>
          ))}
        </ul>
        <Link to="/leave" className="mt-4 inline-block text-sm font-medium text-sky-700 dark:text-sky-400">
          Request leave →
        </Link>
      </section>

      <section className="flex flex-wrap gap-3">
        <QuickLink to="/request-document" label="Request document" />
        <QuickLink to="/employee-files" label="My files" />
        <QuickLink to="/announcements" label="Announcements" />
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  hint,
  to,
}: {
  title: string;
  value: number;
  hint: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    >
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </Link>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
    >
      {label}
    </Link>
  );
}
