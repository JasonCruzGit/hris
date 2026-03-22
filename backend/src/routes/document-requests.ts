import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireHrOrAdmin, requireRoles } from "../middleware/rbac.js";

const statusMap = {
  Submitted: "SUBMITTED",
  "In review": "IN_REVIEW",
  Ready: "READY",
  Closed: "CLOSED",
} as const;

const statusReverseMap: Record<string, keyof typeof statusMap> = {
  SUBMITTED: "Submitted",
  IN_REVIEW: "In review",
  READY: "Ready",
  CLOSED: "Closed",
};

const createSchema = z.object({
  docType: z.string().trim().min(1),
  purpose: z.string().trim().min(1),
  delivery: z.string().trim().min(1),
  urgency: z.string().trim().min(1),
  notes: z.string().trim().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["Submitted", "In review", "Ready", "Closed"]),
  statusNote: z.string().trim().optional(),
});

export const documentRequestsRouter = Router();
documentRequestsRouter.use(authMiddleware);

documentRequestsRouter.post("/", requireRoles("EMPLOYEE"), async (req, res) => {
  const employeeId = req.auth!.employeeId;
  if (!employeeId) {
    res.status(403).json({ error: "No employee profile is linked to this account." });
    return;
  }
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const row = await prisma.documentRequest.create({
    data: {
      employeeId,
      requestedByUserId: req.auth!.id,
      docType: parsed.data.docType,
      purpose: parsed.data.purpose,
      delivery: parsed.data.delivery,
      urgency: parsed.data.urgency,
      notes: parsed.data.notes ?? null,
    },
  });
  const hrUsers = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["SUPER_ADMIN", "HR_ADMIN", "DEPARTMENT_HEAD"] } },
    select: { id: true },
  });
  await prisma.$transaction(
    hrUsers.map((u) =>
      prisma.notification.create({
        data: {
          userId: u.id,
          title: "New document request",
          body: `${parsed.data.docType} submitted`,
          channel: "IN_APP",
        },
      })
    )
  );
  res.status(201).json({
    ...row,
    status: statusReverseMap[row.status] ?? "Submitted",
  });
});

documentRequestsRouter.get("/mine", requireRoles("EMPLOYEE"), async (req, res) => {
  const employeeId = req.auth!.employeeId;
  if (!employeeId) {
    res.status(403).json({ error: "No employee profile is linked to this account." });
    return;
  }
  const items = await prisma.documentRequest.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    items: items.map((r) => ({
      ...r,
      status: statusReverseMap[r.status] ?? "Submitted",
    })),
  });
});

documentRequestsRouter.get("/", requireHrOrAdmin, async (req, res) => {
  const where =
    req.auth!.role === "DEPARTMENT_HEAD" && req.auth!.departmentIdAsHead
      ? { employee: { departmentId: req.auth!.departmentIdAsHead } }
      : {};
  const items = await prisma.documentRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      employee: {
        select: { id: true, employeeNumber: true, firstName: true, lastName: true, department: { select: { name: true } } },
      },
      requestedByUser: { select: { email: true } },
    },
  });
  res.json({
    items: items.map((r) => ({
      ...r,
      status: statusReverseMap[r.status] ?? "Submitted",
    })),
  });
});

documentRequestsRouter.patch("/:id/status", requireHrOrAdmin, async (req, res) => {
  const id = String(req.params.id);
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const existing = await prisma.documentRequest.findUnique({
    where: { id },
    include: { employee: { select: { departmentId: true } }, requestedByUser: { select: { id: true } } },
  });
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (
    req.auth!.role === "DEPARTMENT_HEAD" &&
    req.auth!.departmentIdAsHead &&
    existing.employee.departmentId !== req.auth!.departmentIdAsHead
  ) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const updated = await prisma.documentRequest.update({
    where: { id },
    data: {
      status: statusMap[parsed.data.status],
      statusNote: parsed.data.statusNote ?? null,
    },
  });
  await prisma.notification.create({
    data: {
      userId: existing.requestedByUserId,
      title: "Document request update",
      body: `Status changed to ${parsed.data.status}`,
      channel: "IN_APP",
    },
  });
  res.json({
    ...updated,
    status: statusReverseMap[updated.status] ?? "Submitted",
  });
});
