import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { sumApprovedLeaveDays } from "../lib/leave-balance.js";
import { uploadsRoot } from "../lib/uploadsRoot.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";

/**
 * Employee self-service API — requires a linked Employee record on the User.
 */
export const employeePortalRouter = Router();
employeePortalRouter.use(authMiddleware);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsRoot()),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`),
  }),
});

const employeeDocSchema = z.object({
  title: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  expiresAt: z.coerce.date().optional(),
});

employeePortalRouter.get("/summary", async (req, res) => {
  const employeeId = req.auth!.employeeId;
  if (!employeeId) {
    res.status(403).json({
      error: "No employee profile is linked to this account. Ask HR to connect your login.",
    });
    return;
  }

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const [
    employee,
    leaveBalanceRows,
    pendingLeaveCount,
    attendanceWeekCount,
    unreadNotifications,
    lastPayrollLine,
  ] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        department: { select: { id: true, name: true, code: true } },
        position: { select: { id: true, title: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.leaveBalance.findMany({
      where: { employeeId },
      include: { leaveType: { select: { name: true, code: true } } },
      orderBy: { year: "desc" },
      take: 12,
    }),
    prisma.leaveRequest.count({
      where: { employeeId, status: "PENDING" },
    }),
    prisma.attendance.count({
      where: {
        employeeId,
        workDate: { gte: weekAgo },
      },
    }),
    prisma.notification.count({
      where: { userId: req.auth!.id, readAt: null },
    }),
    prisma.payrollLine.findFirst({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
      include: { payrollRun: { select: { payDate: true, periodEnd: true } } },
    }),
  ]);

  if (!employee) {
    res.status(404).json({ error: "Employee record not found" });
    return;
  }

  const leaveBalances = await Promise.all(
    leaveBalanceRows.map(async (b) => {
      const used = await sumApprovedLeaveDays(prisma, b.employeeId, b.leaveTypeId, b.year);
      return {
        id: b.id,
        year: b.year,
        entitledDays: b.entitledDays,
        usedDays: used,
        leaveType: b.leaveType,
      };
    })
  );

  res.json({
    employee: {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      department: employee.department,
      position: employee.position,
      branch: employee.branch,
      employmentStatus: employee.employmentStatus,
    },
    leaveBalances,
    pendingLeaveRequests: pendingLeaveCount,
    attendanceDaysThisWeek: attendanceWeekCount,
    unreadNotifications,
    lastPayslip: lastPayrollLine
      ? {
          id: lastPayrollLine.id,
          netPay: lastPayrollLine.netPay,
          payDate: lastPayrollLine.payrollRun.payDate,
          periodEnd: lastPayrollLine.payrollRun.periodEnd,
        }
      : null,
  });
});

employeePortalRouter.get("/files", requireRoles("EMPLOYEE"), async (req, res) => {
  const employeeId = req.auth!.employeeId;
  if (!employeeId) {
    res.status(403).json({ error: "No employee profile is linked to this account." });
    return;
  }
  const items = await prisma.employeeDocument.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    items: items.map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      fileName: d.fileName,
      filePath: d.filePath,
      mimeType: d.mimeType,
      expiresAt: d.expiresAt,
      createdAt: d.createdAt,
      fileUrl: `/api/employee/files/${d.id}/download`,
    })),
  });
});

employeePortalRouter.post("/files", requireRoles("EMPLOYEE"), upload.single("file"), async (req, res) => {
  const employeeId = req.auth!.employeeId;
  if (!employeeId) {
    res.status(403).json({ error: "No employee profile is linked to this account." });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "file required" });
    return;
  }
  const parsed = employeeDocSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const doc = await prisma.employeeDocument.create({
    data: {
      employeeId,
      title: parsed.data.title ?? req.file.originalname,
      category: parsed.data.category ?? "Other",
      fileName: req.file.originalname,
      filePath: req.file.filename,
      mimeType: req.file.mimetype,
      expiresAt: parsed.data.expiresAt,
    },
  });
  res.status(201).json({
    id: doc.id,
    title: doc.title,
    category: doc.category,
    fileName: doc.fileName,
    filePath: doc.filePath,
    mimeType: doc.mimeType,
    expiresAt: doc.expiresAt,
    createdAt: doc.createdAt,
    fileUrl: `/api/employee/files/${doc.id}/download`,
  });
});

employeePortalRouter.get("/files/:id/download", requireRoles("EMPLOYEE"), async (req, res) => {
  const employeeId = req.auth!.employeeId;
  if (!employeeId) {
    res.status(403).json({ error: "No employee profile is linked to this account." });
    return;
  }
  const id = String(req.params.id);
  const doc = await prisma.employeeDocument.findFirst({ where: { id, employeeId } });
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.download(path.join(uploadsRoot(), doc.filePath), doc.fileName);
});

employeePortalRouter.delete("/files/:id", requireRoles("EMPLOYEE"), async (req, res) => {
  const employeeId = req.auth!.employeeId;
  if (!employeeId) {
    res.status(403).json({ error: "No employee profile is linked to this account." });
    return;
  }
  const id = String(req.params.id);
  const doc = await prisma.employeeDocument.findFirst({ where: { id, employeeId } });
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  await prisma.employeeDocument.delete({ where: { id: doc.id } });
  const uploadPath = path.join(uploadsRoot(), doc.filePath);
  await fs.unlink(uploadPath).catch(() => {});
  res.status(204).send();
});
