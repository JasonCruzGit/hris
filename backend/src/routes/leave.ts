import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { employeeByIdWhere, employeeScope } from "../lib/access.js";
import { logAudit } from "../lib/audit.js";
import { sumApprovedLeaveDays, syncLeaveBalanceUsedFromApprovedRequests } from "../lib/leave-balance.js";
import { sendEmail } from "../services/email.js";

export const leaveRouter = Router();
leaveRouter.use(authMiddleware);

leaveRouter.get("/types", async (_req, res) => {
  const items = await prisma.leaveType.findMany({ orderBy: { name: "asc" } });
  res.json({ items });
});

const typeSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  maxDaysPerYear: z.number().optional(),
  isPaid: z.boolean().optional(),
});

leaveRouter.post(
  "/types",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
    const parsed = typeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const t = await prisma.leaveType.create({ data: parsed.data });
    res.status(201).json(t);
  }
);

leaveRouter.get("/requests", async (req, res) => {
  const scope = employeeScope(req.auth!);
  const where: Prisma.LeaveRequestWhereInput = {
    employee: { is: scope },
  };
  if (req.query.status === "PENDING") {
    where.status = "PENDING";
  }
  const items = await prisma.leaveRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { employee: true, leaveType: true },
  });
  res.json({ items });
});

const requestSchema = z.object({
  leaveTypeId: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  totalDays: z.coerce.number().positive(),
  reason: z.string().optional(),
});

leaveRouter.post("/requests", async (req, res) => {
  if (!req.auth!.employeeId) {
    res.status(403).json({ error: "No employee profile" });
    return;
  }
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const lr = await prisma.leaveRequest.create({
    data: {
      ...parsed.data,
      employeeId: req.auth!.employeeId,
    },
    include: { leaveType: true },
  });
  await logAudit(req, "CREATE", "LeaveRequest", lr.id);
  res.status(201).json(lr);
});

const decideSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

leaveRouter.patch("/requests/:id", async (req, res) => {
  const id = String(req.params.id);
  const parsed = decideSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const existing = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { employee: true, leaveType: true },
  });
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const can =
    req.auth!.role === "SUPER_ADMIN" ||
    req.auth!.role === "HR_ADMIN" ||
    (req.auth!.role === "DEPARTMENT_HEAD" &&
      req.auth!.departmentIdAsHead &&
      existing.employee.departmentId === req.auth!.departmentIdAsHead);

  if (!can) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (existing.status !== "PENDING") {
    res.status(400).json({ error: "Request already decided" });
    return;
  }

  const year = new Date(existing.startDate).getFullYear();
  const totalDays = existing.totalDays;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const entitledDefault = existing.leaveType.maxDaysPerYear
        ? new Decimal(existing.leaveType.maxDaysPerYear)
        : new Decimal(15);
      const balanceRow = await tx.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: existing.employeeId,
            leaveTypeId: existing.leaveTypeId,
            year,
          },
        },
      });
      const entitled = balanceRow?.entitledDays ?? entitledDefault;

      /** Approved days before this decision (request is still PENDING, so not included). */
      const usedBefore = await sumApprovedLeaveDays(tx, existing.employeeId, existing.leaveTypeId, year);
      const remaining = entitled.minus(usedBefore);

      if (parsed.data.status === "APPROVED" && remaining.lt(totalDays)) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const lr = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: parsed.data.status,
          approverId: req.auth!.id,
          decidedAt: new Date(),
        },
        include: { employee: true, leaveType: true },
      });

      await syncLeaveBalanceUsedFromApprovedRequests(
        tx,
        existing.employeeId,
        existing.leaveTypeId,
        year
      );

      return lr;
    });

    await logAudit(req, "DECIDE", "LeaveRequest", id, { status: parsed.data.status });

    const employeeUserId = existing.employee.userId;
    if (employeeUserId) {
      const statusWord = parsed.data.status === "APPROVED" ? "approved" : "rejected";
      const rangeLabel = `${new Date(existing.startDate).toLocaleDateString()} – ${new Date(existing.endDate).toLocaleDateString()}`;
      await prisma.notification.create({
        data: {
          userId: employeeUserId,
          title:
            parsed.data.status === "APPROVED" ? "Leave request approved" : "Leave request not approved",
          body: `Your ${existing.leaveType.name} leave request (${totalDays.toString()} day(s), ${rangeLabel}) was ${statusWord}.`,
          channel: "IN_APP",
        },
      });
    }

    const toEmail = existing.employee.email;
    if (toEmail) {
      void sendEmail({
        to: toEmail,
        subject: `Leave request ${parsed.data.status.toLowerCase()}`,
        text: `Your ${existing.leaveType.name} leave (${totalDays.toString()} day(s)) was ${parsed.data.status.toLowerCase()}.`,
      });
    }

    res.json(updated);
  } catch (e) {
    if (e instanceof Error && e.message === "INSUFFICIENT_BALANCE") {
      res.status(400).json({ error: "Insufficient leave balance for this type/year" });
      return;
    }
    throw e;
  }
});

leaveRouter.get("/balances", async (req, res) => {
  const where: Prisma.LeaveBalanceWhereInput = {
    employee: { is: employeeScope(req.auth!) },
  };
  const rows = await prisma.leaveBalance.findMany({
    where,
    include: { leaveType: true, employee: { select: { id: true, firstName: true, lastName: true } } },
  });
  const items = await Promise.all(
    rows.map(async (b) => {
      const used = await sumApprovedLeaveDays(prisma, b.employeeId, b.leaveTypeId, b.year);
      return { ...b, usedDays: used };
    })
  );
  res.json({ items });
});

const balanceSchema = z.object({
  employeeId: z.string(),
  leaveTypeId: z.string(),
  year: z.number(),
  entitledDays: z.coerce.number(),
  usedDays: z.coerce.number().optional(),
});

leaveRouter.post(
  "/balances",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
    const parsed = balanceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const empOk = await prisma.employee.findFirst({
      where: employeeByIdWhere(req.auth!, parsed.data.employeeId),
    });
    if (!empOk) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    const b = await prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: parsed.data.employeeId,
          leaveTypeId: parsed.data.leaveTypeId,
          year: parsed.data.year,
        },
      },
      create: {
        employeeId: parsed.data.employeeId,
        leaveTypeId: parsed.data.leaveTypeId,
        year: parsed.data.year,
        entitledDays: parsed.data.entitledDays,
        usedDays: parsed.data.usedDays ?? 0,
      },
      update: {
        entitledDays: parsed.data.entitledDays,
        usedDays: parsed.data.usedDays,
      },
    });
    res.status(201).json(b);
  }
);
