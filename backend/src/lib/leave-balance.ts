import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "./prisma.js";

type Db = Pick<typeof prisma, "leaveRequest">;

/**
 * Sum of totalDays for approved leave in a calendar year (matches leave decision logic).
 * Only APPROVED requests count; PENDING and REJECTED do not.
 */
export async function sumApprovedLeaveDays(
  db: Db,
  employeeId: string,
  leaveTypeId: string,
  year: number
): Promise<Decimal> {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const result = await db.leaveRequest.aggregate({
    where: {
      employeeId,
      leaveTypeId,
      status: "APPROVED",
      startDate: { gte: start, lt: end },
    },
    _sum: { totalDays: true },
  });
  const raw = result._sum.totalDays;
  if (raw == null) return new Decimal(0);
  if (raw instanceof Decimal) return raw;
  return new Decimal(String(raw));
}

type DbSync = Pick<typeof prisma, "leaveRequest" | "leaveBalance" | "leaveType">;

/**
 * Sets LeaveBalance.usedDays from approved requests only (source of truth).
 * Creates a row when there is usage or an existing balance row to update.
 */
export async function syncLeaveBalanceUsedFromApprovedRequests(
  db: DbSync,
  employeeId: string,
  leaveTypeId: string,
  year: number
): Promise<void> {
  const used = await sumApprovedLeaveDays(db, employeeId, leaveTypeId, year);
  const lt = await db.leaveType.findUnique({ where: { id: leaveTypeId } });
  if (!lt) return;
  const entitledDefault = lt.maxDaysPerYear ? new Decimal(lt.maxDaysPerYear) : new Decimal(15);
  const existing = await db.leaveBalance.findUnique({
    where: {
      employeeId_leaveTypeId_year: {
        employeeId,
        leaveTypeId,
        year,
      },
    },
  });
  const entitled = existing?.entitledDays ?? entitledDefault;

  if (!existing && used.isZero()) return;

  await db.leaveBalance.upsert({
    where: {
      employeeId_leaveTypeId_year: {
        employeeId,
        leaveTypeId,
        year,
      },
    },
    create: {
      employeeId,
      leaveTypeId,
      year,
      entitledDays: entitled,
      usedDays: used,
    },
    update: {
      usedDays: used,
    },
  });
}
