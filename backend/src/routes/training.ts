import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireHrOrAdmin, requireRoles } from "../middleware/rbac.js";
import { employeeByIdWhere } from "../lib/access.js";

export const trainingRouter = Router();
trainingRouter.use(authMiddleware);

trainingRouter.get("/programs", requireHrOrAdmin, async (_req, res) => {
  const items = await prisma.trainingProgram.findMany({
    orderBy: { startDate: "desc" },
    include: { _count: { select: { enrollments: true } } },
  });
  res.json({ items });
});

trainingRouter.get("/my-programs", requireRoles("EMPLOYEE"), async (req, res) => {
  if (!req.auth!.employeeId) {
    res.status(403).json({ error: "Profile not linked" });
    return;
  }
  const items = await prisma.trainingEnrollment.findMany({
    where: { employeeId: req.auth!.employeeId },
    include: {
      program: {
        select: {
          id: true,
          name: true,
          description: true,
          startDate: true,
          endDate: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ items });
});

const programSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

trainingRouter.post(
  "/programs",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
    const parsed = programSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const p = await prisma.trainingProgram.create({ data: parsed.data });
    res.status(201).json(p);
  }
);

trainingRouter.post(
  "/programs/:id/enroll",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
    const programId = String(req.params.id);
    const schema = z.object({ employeeId: z.string() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const emp = await prisma.employee.findFirst({
      where: employeeByIdWhere(req.auth!, parsed.data.employeeId),
    });
    if (!emp) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    const e = await prisma.trainingEnrollment.upsert({
      where: {
        programId_employeeId: {
          programId,
          employeeId: parsed.data.employeeId,
        },
      },
      create: { programId, employeeId: parsed.data.employeeId },
      update: {},
    });
    res.status(201).json(e);
  }
);
