import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { FloatingNotificationToast } from "../components/FloatingNotificationToast";
import { TutorialTour } from "../components/TutorialTour";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { NotificationItem } from "../lib/notifications";
import { playNotificationSound, resolveNotificationPath } from "../lib/notifications";

/** Self-service only — staff tools (HR, recruitment ATS, performance, training admin) are not linked here. */
const primaryNav: { to: string; label: string; end?: boolean }[] = [
  { to: "/", label: "Home", end: true },
  { to: "/notifications", label: "Notifications" },
  { to: "/leave", label: "Leave" },
  { to: "/attendance", label: "Attendance" },
  { to: "/payroll", label: "Payroll" },
  { to: "/my-performance", label: "Performance" },
  { to: "/my-training", label: "Training" },
];

const workspaceNav: { to: string; label: string }[] = [
  { to: "/request-document", label: "Request document" },
  { to: "/employee-files", label: "Employee files" },
  { to: "/messages", label: "Messages" },
  { to: "/announcements", label: "Announcements" },
];

export function EmployeeAppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const profileTo = user?.employee?.id ? `/employees/${user.employee.id}` : "/";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [floating, setFloating] = useState<NotificationItem | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (user?.role !== "EMPLOYEE") return;
    let disposed = false;
    const poll = async () => {
      try {
        const res = await api<{ items: NotificationItem[] }>("/api/notifications");
        if (disposed) return;
        setUnreadNotifications(res.items.filter((n) => !n.readAt).length);
        const ids = new Set(res.items.map((n) => n.id));
        if (!initializedRef.current) {
          initializedRef.current = true;
          knownIdsRef.current = ids;
          return;
        }
        const newItems = res.items.filter((n) => !knownIdsRef.current.has(n.id));
        knownIdsRef.current = ids;
        if (newItems.length > 0) {
          setFloating(newItems[0]!);
          playNotificationSound();
        }
      } catch {
        if (!disposed) setUnreadNotifications(0);
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), 12000);
    return () => {
      disposed = true;
      window.clearInterval(id);
    };
  }, [user?.role]);

  useEffect(() => {
    if (!floating) return;
    const t = window.setTimeout(() => setFloating(null), 6500);
    return () => window.clearTimeout(t);
  }, [floating?.id]);

  const refreshUnread = () => {
    api<{ items: { readAt: string | null }[] }>("/api/notifications")
      .then((r) => setUnreadNotifications(r.items.filter((n) => !n.readAt).length))
      .catch(() => {});
  };

  useEffect(() => {
    if (user?.role !== "EMPLOYEE") return;
    refreshUnread();
  }, [user?.role, location.pathname]);

  const toggleDark = () => {
    document.documentElement.classList.toggle("dark");
    localStorage.setItem(
      "hris_theme",
      document.documentElement.classList.contains("dark") ? "dark" : "light"
    );
  };

  const NavLinks = () => (
    <>
      {primaryNav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            [
              "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
              isActive
                ? "bg-emerald-800 text-white dark:bg-emerald-500/90 dark:text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
            ].join(" ")
          }
        >
          <span>{item.label}</span>
          {item.to === "/notifications" && unreadNotifications > 0 && (
            <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {unreadNotifications > 99 ? "99+" : unreadNotifications}
            </span>
          )}
        </NavLink>
      ))}
      <NavLink
        to={profileTo}
        onClick={() => setMobileOpen(false)}
        className={({ isActive }) =>
          [
            "block rounded-lg px-3 py-2 text-sm font-medium transition",
            isActive
              ? "bg-emerald-800 text-white dark:bg-emerald-500/90 dark:text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
          ].join(" ")
        }
      >
        My profile
      </NavLink>
      <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Workspace
        </div>
        <div className="space-y-1">
          {workspaceNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                [
                  "block rounded-lg px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-emerald-800 text-white dark:bg-emerald-500/90 dark:text-white"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/80 to-slate-50 text-slate-900 dark:from-slate-950 dark:to-slate-950 dark:text-slate-100">
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div className="flex min-h-screen">
        <aside
          data-tour="employee-sidebar"
          className={[
            "fixed inset-y-0 left-0 z-50 w-64 transform border-r border-emerald-200/80 bg-white shadow-lg transition-transform dark:border-emerald-900/50 dark:bg-slate-900 md:static md:translate-x-0 md:shadow-none",
            mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          ].join(" ")}
        >
          <div className="flex h-full flex-col p-4">
            <div className="mb-6 px-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Employee portal
              </div>
              <div className="text-lg font-semibold">HRIS</div>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto">
              <NavLinks />
            </nav>
          </div>
        </aside>
        <div className="flex min-h-screen flex-1 flex-col md:pl-0">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-emerald-200/60 bg-white/90 px-4 py-3 backdrop-blur dark:border-emerald-900/40 dark:bg-slate-900/90">
            <div className="flex items-center gap-3">
              <button
                type="button"
                data-tour="employee-menu"
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800"
                onClick={() => setMobileOpen((o) => !o)}
                aria-label="Open menu"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400 md:hidden">Portal</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <NavLink
                data-tour="employee-notifications"
                to="/notifications"
                className={({ isActive }) =>
                  [
                    "relative flex h-9 w-9 items-center justify-center rounded-lg border transition",
                    isActive
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-200"
                      : "border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
                  ].join(" ")
                }
                title="Notifications"
                aria-label="Notifications"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {unreadNotifications > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                )}
              </NavLink>
              <button
                type="button"
                onClick={toggleDark}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700"
              >
                Theme
              </button>
              <div className="hidden text-right text-sm sm:block">
                <div className="max-w-[140px] truncate font-medium sm:max-w-[200px]">{user?.email}</div>
                <div className="text-xs text-slate-500">Employee</div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white dark:bg-emerald-600"
              >
                Sign out
              </button>
            </div>
          </header>
          <main data-tour="employee-main" className="flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
      <TutorialTour variant="employee" userId={user?.id} />
      {floating && (
        <FloatingNotificationToast
          variant="employee"
          title={floating.title}
          body={floating.body}
          subtitle="New notification"
          onDismiss={() => setFloating(null)}
          onOpen={() => {
            navigate(resolveNotificationPath(floating, "employee"));
            setFloating(null);
          }}
        />
      )}
    </div>
  );
}
