type Props = {
  title: string;
  body: string;
  subtitle?: string;
  variant?: "admin" | "employee";
  onDismiss: () => void;
  onOpen?: () => void;
};

export function FloatingNotificationToast({
  title,
  body,
  subtitle = "New notification",
  variant = "admin",
  onDismiss,
  onOpen,
}: Props) {
  const accent =
    variant === "employee"
      ? "border-emerald-200/90 bg-white ring-emerald-500/15 dark:border-emerald-800/80 dark:bg-slate-900 dark:ring-emerald-400/20"
      : "border-slate-200 bg-white ring-slate-900/5 dark:border-slate-600 dark:bg-slate-900 dark:ring-white/10";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto fixed right-4 top-20 z-[100] w-[min(22rem,calc(100vw-2rem))] animate-slide-in-right rounded-2xl border shadow-2xl ring-1 ${accent}`}
    >
      <div className="flex gap-3 p-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ${
            variant === "employee" ? "bg-emerald-600 dark:bg-emerald-500" : "bg-sky-600 dark:bg-sky-500"
          }`}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
            <path d="M9.5 17a2.5 2.5 0 0 0 5 0" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{subtitle}</p>
          <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
          {body ? <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">{body}</p> : null}
          {onOpen && (
            <button
              type="button"
              onClick={onOpen}
              className={`mt-2 text-xs font-semibold underline underline-offset-2 ${
                variant === "employee"
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-sky-700 dark:text-sky-400"
              }`}
            >
              Open
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Dismiss"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
