/** Derive late / undertime / overtime from branch schedule and clock times. */

function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map((x) => Number(x));
  if (Number.isNaN(h)) return 9 * 60;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

export type ScheduleFields = {
  scheduleStartTime: string;
  scheduleEndTime: string;
  graceLateMins: number;
  expectedWorkMins: number;
};

const DEFAULT_SCHEDULE: ScheduleFields = {
  scheduleStartTime: "09:00",
  scheduleEndTime: "18:00",
  graceLateMins: 15,
  expectedWorkMins: 480,
};

export function computeAttendanceMetrics(
  timeIn: Date | null,
  timeOut: Date | null,
  schedule: Partial<ScheduleFields> | null
): { isLate: boolean; undertimeMins: number; overtimeMins: number } {
  const s = { ...DEFAULT_SCHEDULE, ...schedule };
  if (!timeIn || !timeOut) {
    return { isLate: false, undertimeMins: 0, overtimeMins: 0 };
  }

  const startM = parseHHMM(s.scheduleStartTime);
  const lateAfter = startM + s.graceLateMins;
  const inM = minutesOfDay(timeIn);

  const isLate = inM > lateAfter;

  const workedMins = Math.max(0, Math.round((timeOut.getTime() - timeIn.getTime()) / 60_000));
  const expected = s.expectedWorkMins;

  let undertimeMins = 0;
  let overtimeMins = 0;
  if (workedMins < expected) undertimeMins = expected - workedMins;
  else if (workedMins > expected) overtimeMins = workedMins - expected;

  return { isLate, undertimeMins, overtimeMins };
}
