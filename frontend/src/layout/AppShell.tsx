import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { FloatingNotificationToast } from "../components/FloatingNotificationToast";
import { TutorialTour } from "../components/TutorialTour";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Role } from "../api/client";
import type { NotificationItem } from "../lib/notifications";
import { playNotificationSound, resolveNotificationPath } from "../lib/notifications";

type NavItem = { to: string; label: string; roles?: Role[] };

/** Grouped sidebar navigation (flat Employees + top-level Employee DB removed — use People → Employee database). */
const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [{ to: "/", label: "Dashboard" }],
  },
  {
    title: "Core HR",
    items: [
      { to: "/leave", label: "Leave" },
      { to: "/attendance", label: "Attendance" },
      { to: "/payroll", label: "Payroll" },
    ],
  },
  {
    title: "Talent & development",
    items: [
      { to: "/recruitment", label: "Recruitment & careers" },
      { to: "/performance", label: "Performance" },
      { to: "/training", label: "Training" },
    ],
  },
  {
    title: "Insights",
    items: [{ to: "/reports", label: "Reports", roles: ["SUPER_ADMIN", "HR_ADMIN", "DEPARTMENT_HEAD"] }],
  },
];

/** Employee records by category (replaces separate /employees list — detail lives here). */
const peopleNav: NavItem[] = [
  { to: "/employee-database/regular", label: "Employee database", roles: ["SUPER_ADMIN", "HR_ADMIN", "DEPARTMENT_HEAD"] },
  { to: "/employee-database/job-order", label: "Job order", roles: ["SUPER_ADMIN", "HR_ADMIN", "DEPARTMENT_HEAD"] },
  { to: "/employee-database/contract-of-service", label: "Contract of service", roles: ["SUPER_ADMIN", "HR_ADMIN", "DEPARTMENT_HEAD"] },
];

/** Sidebar targets for the upcoming employee-focused system (routes + placeholders in place). */
const employeeWorkspaceNav: NavItem[] = [
  { to: "/request-document", label: "Request document" },
  { to: "/employee-files", label: "Employee files" },
  { to: "/messages", label: "Messages" },
  { to: "/announcements", label: "Announcements" },
];

function roleAllowed(role: Role, item: { roles?: Role[] }) {
  if (!item.roles) return true;
  return item.roles.includes(role);
}

function notificationMeta(item: NotificationItem) {
  if (item.title.toLowerCase() === "new message" || item.title.toLowerCase().startsWith("new message")) {
    return { type: "message", sender: null as string | null, initials: "M" };
  }
  if (item.title.startsWith("New message from ")) {
    const sender = item.title.replace("New message from ", "").trim();
    const initials = sender
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("");
    return { type: "message", sender, initials: initials || "M" };
  }
  return { type: "general", sender: null as string | null, initials: "N" };
}

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const role = user?.role ?? "EMPLOYEE";
  const isAdminArea = role !== "EMPLOYEE";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [floating, setFloating] = useState<NotificationItem | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const navSectionBlocks = navSections
    .map((section) => ({
      title: section.title,
      items: section.items.filter((n) => roleAllowed(role, n)),
    }))
    .filter((section) => section.items.length > 0);

  const peopleLinks = peopleNav.filter((n) => roleAllowed(role, n));
  const workspaceLinks = employeeWorkspaceNav.filter((n) => roleAllowed(role, n));
  const unreadCount = useMemo(() => notifications.filter((n) => !n.readAt).length, [notifications]);

  const toggleDark = () => {
    document.documentElement.classList.toggle("dark");
    localStorage.setItem(
      "hris_theme",
      document.documentElement.classList.contains("dark") ? "dark" : "light"
    );
  };

  useEffect(() => {
    if (!isAdminArea) return;
    let disposed = false;
    const poll = async () => {
      try {
        const res = await api<{ items: NotificationItem[] }>("/api/notifications");
        if (disposed) return;
        setNotifError(null);
        setNotifications(res.items);
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
      } catch (e) {
        if (!disposed) {
          setNotifError(e instanceof Error ? e.message : "Could not load notifications");
        }
      }
    };
    void poll();
    const id = window.setInterval(() => {
      void poll();
    }, 12000);
    return () => {
      disposed = true;
      window.clearInterval(id);
    };
  }, [isAdminArea]);

  useEffect(() => {
    if (!floating) return;
    const t = window.setTimeout(() => setFloating(null), 6500);
    return () => window.clearTimeout(t);
  }, [floating?.id]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const markAsRead = async (id: string) => {
    try {
      await api(`/api/notifications/${id}/read`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n))
      );
    } catch {
      // no-op
    }
  };

  const markAllRead = async () => {
    try {
      await api<{ count: number }>("/api/notifications/read-all", { method: "PATCH" });
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    } catch {
      // no-op
    }
  };

  const onNotificationClick = async (n: NotificationItem) => {
    await markAsRead(n.id);
    setNotifOpen(false);
    navigate(resolveNotificationPath(n, "staff"));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {mobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <div className="flex min-h-screen">
        <aside
          id="staff-sidebar-nav"
          data-tour="staff-sidebar"
          className={[
            "fixed inset-y-0 left-0 z-50 w-[min(100vw-3rem,16rem)] max-w-[16rem] shrink-0 transform border-r border-slate-200 bg-white p-4 shadow-lg transition-transform dark:border-slate-800 dark:bg-slate-900 lg:static lg:w-64 lg:translate-x-0 lg:shadow-none",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          ].join(" ")}
        >
          <div className="mb-8 px-2">
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">HRIS</div>
            <div className="text-lg font-semibold">Control Center</div>
          </div>
          <nav className="space-y-0">
            {navSectionBlocks.map((section, idx) => (
              <div
                key={section.title}
                className={
                  idx === 0
                    ? ""
                    : "mt-5 border-t border-slate-200 pt-5 dark:border-slate-800"
                }
              >
                <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {section.title}
                </div>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.to + item.label}
                      to={item.to}
                      end={item.to === "/"}
                      className={({ isActive }) =>
                        [
                          "block rounded-lg px-3 py-2 text-sm font-medium transition",
                          isActive
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                        ].join(" ")
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
            {peopleLinks.length > 0 && (
              <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-800">
                <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  People
                </div>
                <div className="space-y-1">
                  {peopleLinks.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        [
                          "block rounded-lg px-3 py-2 text-sm font-medium transition",
                          isActive
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                        ].join(" ")
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            )}
            {workspaceLinks.length > 0 && (
              <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-800">
                <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Workspace
                </div>
                <div className="space-y-1">
                  {workspaceLinks.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        [
                          "block rounded-lg px-3 py-2 text-sm font-medium transition",
                          isActive
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                        ].join(" ")
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            )}
          </nav>
        </aside>
        <div className="flex min-h-screen flex-1 flex-col">
          <header
            data-tour="staff-header"
            className="relative border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900 sm:px-4 sm:py-3"
          >
            {/* Mobile / tablet: two rows so menu + actions never overlap */}
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="inline-flex shrink-0 items-center justify-center rounded-lg border-2 border-slate-300 bg-slate-50 p-2.5 text-slate-800 shadow-sm transition hover:bg-slate-100 lg:hidden dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                onClick={() => setMobileMenuOpen((open) => !open)}
                aria-expanded={mobileMenuOpen}
                aria-controls="staff-sidebar-nav"
                aria-label="Open navigation menu"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {isAdminArea && (
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setNotifOpen((o) => !o)}
                    className="relative rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    aria-label="Open notifications"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                      <path d="M9.5 17a2.5 2.5 0 0 0 5 0" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </button>
                  {notifOpen && (
                    <div className="absolute left-0 top-12 z-40 w-[calc(100vw-2rem)] max-w-[380px] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                      <div className="mb-2 flex items-center justify-between px-1 py-1">
                        <h3 className="text-sm font-semibold">Notifications</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">{notifications.length}</span>
                          {unreadCount > 0 && (
                            <button
                              type="button"
                              onClick={() => void markAllRead()}
                              className="text-[11px] font-medium text-sky-700 hover:underline dark:text-sky-400"
                            >
                              Mark all read
                            </button>
                          )}
                        </div>
                      </div>
                      {notifError && <p className="px-2 py-1 text-xs text-red-600">{notifError}</p>}
                      <ul className="max-h-[420px] space-y-2 overflow-y-auto">
                        {notifications.length === 0 && (
                          <li className="px-2 py-6 text-center text-sm text-slate-500">No notifications</li>
                        )}
                        {notifications.map((n) => (
                          <li key={n.id}>
                            {(() => {
                              const meta = notificationMeta(n);
                              return (
                            <button
                              type="button"
                              onClick={() => void onNotificationClick(n)}
                              className={`w-full rounded-xl border px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
                                n.readAt
                                  ? "border-slate-200/70 bg-white dark:border-slate-700/70 dark:bg-slate-900"
                                  : "border-sky-200 bg-sky-50/70 dark:border-sky-900/60 dark:bg-sky-950/30"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                    meta.type === "message"
                                      ? "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300"
                                      : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                                  }`}
                                >
                                  {meta.initials}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {meta.type === "message" && meta.sender ? `Message from ${meta.sender}` : n.title}
                                  </p>
                                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>
                                  <p className="mt-1 text-[11px] text-slate-400">{new Date(n.createdAt).toLocaleString()}</p>
                                </div>
                              </div>
                            </button>
                              );
                            })()}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              <div className="truncate text-sm font-medium text-slate-600 dark:text-slate-400 lg:hidden">
                HRIS
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
              <button
                type="button"
                onClick={toggleDark}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium dark:border-slate-700"
              >
                Theme
              </button>
              <div className="min-w-0 max-w-[min(52vw,11rem)] text-right text-[11px] leading-tight sm:max-w-[14rem] sm:text-sm">
                <div className="truncate font-medium">{user?.email}</div>
                <div className="text-[10px] text-slate-500 sm:text-xs">{user?.role.replace("_", " ")}</div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-slate-900"
              >
                Sign out
              </button>
            </div>
            </div>
          </header>
          {floating && (
            <FloatingNotificationToast
              variant="admin"
              title={floating.title}
              body={floating.body}
              subtitle="New notification"
              onDismiss={() => setFloating(null)}
              onOpen={() => {
                navigate(resolveNotificationPath(floating, "staff"));
                setFloating(null);
              }}
            />
          )}
          <main data-tour="staff-main" className="flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
      <TutorialTour variant="staff" userId={user?.id} />
    </div>
  );
}
