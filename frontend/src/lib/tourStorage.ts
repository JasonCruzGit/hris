const PREFIX = "hris_tutorial_v1";

export function tourStorageKey(userId: string, variant: "staff" | "employee"): string {
  return `${PREFIX}_${variant}_${userId}`;
}

export function hasCompletedTour(userId: string, variant: "staff" | "employee"): boolean {
  try {
    return localStorage.getItem(tourStorageKey(userId, variant)) === "1";
  } catch {
    return true;
  }
}

export function markTourCompleted(userId: string, variant: "staff" | "employee"): void {
  try {
    localStorage.setItem(tourStorageKey(userId, variant), "1");
  } catch {
    // ignore quota / private mode
  }
}
