export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

/** Pleasant two-tone chime for new in-app notifications (requires user gesture on some browsers). */
export function playNotificationSound(): void {
  try {
    const AC =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const playTone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.03);
    };
    playTone(880, 0, 0.1);
    playTone(1174, 0.11, 0.12);
    setTimeout(() => void ctx.close(), 450);
  } catch {
    // Autoplay or AudioContext blocked
  }
}

export function resolveNotificationPath(
  item: NotificationItem,
  mode: "staff" | "employee" = "staff"
): string {
  const haystack = `${item.title} ${item.body}`.toLowerCase();
  if (mode === "employee") {
    if (haystack.includes("message")) return "/messages";
    if (haystack.includes("document")) return "/request-document";
    if (haystack.includes("announcement")) return "/announcements";
    if (haystack.includes("leave")) return "/leave";
    if (haystack.includes("attendance")) return "/attendance";
    if (haystack.includes("payslip") || haystack.includes("payroll")) return "/payroll";
    if (haystack.includes("performance") || haystack.includes("review")) return "/my-performance";
    if (haystack.includes("training")) return "/my-training";
    return "/notifications";
  }
  const matchers: Array<{ test: (s: string) => boolean; path: string }> = [
    { test: (s) => s.includes("message"), path: "/messages" },
    { test: (s) => s.includes("document request"), path: "/request-document" },
    { test: (s) => s.includes("announcement"), path: "/announcements" },
    { test: (s) => s.includes("leave"), path: "/leave" },
    { test: (s) => s.includes("attendance"), path: "/attendance" },
    { test: (s) => s.includes("payslip") || s.includes("payroll"), path: "/payroll" },
    { test: (s) => s.includes("recruitment") || s.includes("applicant") || s.includes("interview"), path: "/recruitment" },
    { test: (s) => s.includes("performance") || s.includes("review"), path: "/performance" },
    { test: (s) => s.includes("training"), path: "/training" },
    { test: (s) => s.includes("report"), path: "/reports" },
    { test: (s) => s.includes("employee"), path: "/employee-database/regular" },
  ];
  const found = matchers.find((m) => m.test(haystack));
  return found?.path ?? "/notifications";
}
