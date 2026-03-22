import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { employeeByIdWhere, employeeScope } from "../lib/access.js";
import { logAudit } from "../lib/audit.js";
import { computeAttendanceMetrics } from "../services/attendance-schedule.js";

export const attendanceRouter = Router();
attendanceRouter.use(authMiddleware);

async function branchScheduleForEmployee(employeeId: string) {
  const e = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { branch: true },
  });
  if (!e?.branch) return null;
  return {
    scheduleStartTime: e.branch.scheduleStartTime,
    scheduleEndTime: e.branch.scheduleEndTime,
    graceLateMins: e.branch.graceLateMins,
    expectedWorkMins: e.branch.expectedWorkMins,
  };
}

attendanceRouter.get("/", async (req, res) => {
  const { employeeId, from, to, page = "1", pageSize = "50" } = req.query;
  const take = Math.min(200, Math.max(1, parseInt(String(pageSize), 10) || 50));
  const skip = (Math.max(1, parseInt(String(page), 10) || 1) - 1) * take;

  const scope = employeeScope(req.auth!);
  const where: Prisma.AttendanceWhereInput = {
    employee: { is: scope },
  };

  if (typeof employeeId === "string" && employeeId) {
    const allowed = await prisma.employee.findFirst({
      where: employeeByIdWhere(req.auth!, employeeId),
      select: { id: true },
    });
    if (!allowed) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    where.employeeId = employeeId;
  }

  if ((typeof from === "string" && from) || (typeof to === "string" && to)) {
    where.workDate = {};
    if (typeof from === "string" && from) {
      where.workDate.gte = new Date(from);
    }
    if (typeof to === "string" && to) {
      where.workDate.lte = new Date(to);
    }
  }

  const [items, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      skip,
      take,
      orderBy: { workDate: "desc" },
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } } },
    }),
    prisma.attendance.count({ where }),
  ]);

  res.json({ items, total });
});

const upsertSchema = z.object({
  employeeId: z.string(),
  workDate: z.coerce.date(),
  timeIn: z.coerce.date().optional(),
  timeOut: z.coerce.date().optional(),
  source: z.enum(["MANUAL", "BIOMETRIC", "INTEGRATION", "QR"]).optional(),
  notes: z.string().optional(),
});

async function applyScheduleMetrics(
  employeeId: string,
  timeIn: Date | undefined,
  timeOut: Date | undefined
) {
  const sched = await branchScheduleForEmployee(employeeId);
  if (!timeIn || !timeOut) {
    return { isLate: false, undertimeMins: 0, overtimeMins: 0 };
  }
  return computeAttendanceMetrics(timeIn, timeOut, sched);
}

attendanceRouter.post(
  "/",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const metrics = await applyScheduleMetrics(
      parsed.data.employeeId,
      parsed.data.timeIn,
      parsed.data.timeOut
    );
    const row = await prisma.attendance.upsert({
      where: {
        employeeId_workDate: {
          employeeId: parsed.data.employeeId,
          workDate: parsed.data.workDate,
        },
      },
      create: {
        ...parsed.data,
        ...metrics,
        source: parsed.data.source ?? "MANUAL",
      },
      update: {
        timeIn: parsed.data.timeIn,
        timeOut: parsed.data.timeOut,
        source: parsed.data.source,
        ...metrics,
        notes: parsed.data.notes,
      },
    });
    await logAudit(req, "UPSERT", "Attendance", row.id);
    res.status(201).json(row);
  }
);

attendanceRouter.post("/self", async (req, res) => {
  if (!req.auth!.employeeId) {
    res.status(403).json({ error: "No employee profile linked" });
    return;
  }
  const schema = upsertSchema.omit({ employeeId: true });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const metrics = await applyScheduleMetrics(
    req.auth!.employeeId,
    parsed.data.timeIn,
    parsed.data.timeOut
  );
  const row = await prisma.attendance.upsert({
    where: {
      employeeId_workDate: {
        employeeId: req.auth!.employeeId,
        workDate: parsed.data.workDate,
      },
    },
    create: { ...parsed.data, employeeId: req.auth!.employeeId, source: "MANUAL", ...metrics },
    update: {
      timeIn: parsed.data.timeIn,
      timeOut: parsed.data.timeOut,
      source: "MANUAL",
      ...metrics,
      notes: parsed.data.notes,
    },
  });
  res.status(201).json(row);
});

const qrSchema = z.object({
  qrEmployeeId: z.string().min(1),
  workDate: z.coerce.date().optional(),
  timeIn: z.coerce.date().optional(),
  timeOut: z.coerce.date().optional(),
});

attendanceRouter.post(
  "/qr-scan",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
    const parsed = qrSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const emp = await prisma.employee.findUnique({
      where: { qrEmployeeId: parsed.data.qrEmployeeId },
    });
    if (!emp) {
      res.status(404).json({ error: "Unknown QR code" });
      return;
    }
    const workDate = parsed.data.workDate ?? new Date(new Date().toISOString().slice(0, 10));
    const timeIn = parsed.data.timeIn ?? new Date();
    const timeOut = parsed.data.timeOut;
    const metrics = await applyScheduleMetrics(emp.id, timeIn, timeOut ?? timeIn);

    const row = await prisma.attendance.upsert({
      where: {
        employeeId_workDate: { employeeId: emp.id, workDate },
      },
      create: {
        employeeId: emp.id,
        workDate,
        timeIn,
        timeOut: timeOut ?? null,
        source: "QR",
        ...metrics,
      },
      update: {
        timeIn,
        timeOut: timeOut ?? undefined,
        source: "QR",
        ...metrics,
      },
    });
    await logAudit(req, "QR", "Attendance", row.id);
    res.status(201).json(row);
  }
);
