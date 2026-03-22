import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireHrOrAdmin, requireRoles } from "../middleware/rbac.js";
import { employeeByIdWhere, employeeScope } from "../lib/access.js";

export const performanceRouter = Router();
performanceRouter.use(authMiddleware);

performanceRouter.get("/reviews", requireHrOrAdmin, async (req, res) => {
  const scope = employeeScope(req.auth!);
  const where: Prisma.PerformanceReviewWhereInput = {
    employee: { is: scope },
  };
  const items = await prisma.performanceReview.findMany({
    where,
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
      reviewer: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { periodEnd: "desc" },
  });
  res.json({ items });
});

const reviewSchema = z.object({
  employeeId: z.string(),
  reviewerId: z.string(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  rating: z.number().optional(),
  comments: z.string().optional(),
  kpisJson: z.string().optional(),
});

performanceRouter.get("/my-reviews", requireRoles("EMPLOYEE"), async (req, res) => {
  if (!req.auth!.employeeId) {
    res.status(403).json({ error: "Profile not linked" });
    return;
  }
  const items = await prisma.performanceReview.findMany({
    where: { employeeId: req.auth!.employeeId },
    include: {
      reviewer: { select: { firstName: true, lastName: true } },
    },
    orderBy: { periodEnd: "desc" },
  });
  res.json({ items });
});

performanceRouter.post(
  "/reviews",
  requireRoles("SUPER_ADMIN", "HR_ADMIN", "DEPARTMENT_HEAD"),
  async (req, res) => {
    const parsed = reviewSchema.safeParse(req.body);
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
    const r = await prisma.performanceReview.create({
      data: parsed.data,
    });
    res.status(201).json(r);
  }
);
