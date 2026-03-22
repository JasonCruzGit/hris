import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";

export const orgRouter = Router();
orgRouter.use(authMiddleware);

orgRouter.get("/companies", async (_req, res) => {
  const items = await prisma.company.findMany({ include: { branches: true } });
  res.json({ items });
});

const companySchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
});

orgRouter.post(
  "/companies",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
    const parsed = companySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const c = await prisma.company.create({ data: parsed.data });
    res.status(201).json(c);
  }
);

orgRouter.get("/departments", async (_req, res) => {
  const items = await prisma.department.findMany({ orderBy: { name: "asc" } });
  res.json({ items });
});

const deptSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
});

orgRouter.post(
  "/departments",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
    const parsed = deptSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const d = await prisma.department.create({ data: parsed.data });
    res.status(201).json(d);
  }
);

orgRouter.get("/positions", async (_req, res) => {
  const items = await prisma.position.findMany({ orderBy: { title: "asc" } });
  res.json({ items });
});

const posSchema = z.object({
  title: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
});

orgRouter.post(
  "/positions",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
    const parsed = posSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const p = await prisma.position.create({ data: parsed.data });
    res.status(201).json(p);
  }
);

const branchSchema = z.object({
  companyId: z.string(),
  name: z.string().min(1),
  code: z.string().min(1),
  address: z.string().optional(),
});

orgRouter.post(
  "/branches",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
    const parsed = branchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const b = await prisma.branch.create({ data: parsed.data });
    res.status(201).json(b);
  }
);

const branchSchedulePatch = z.object({
  scheduleStartTime: z.string().optional(),
  scheduleEndTime: z.string().optional(),
  graceLateMins: z.number().optional(),
  expectedWorkMins: z.number().optional(),
  name: z.string().optional(),
  address: z.string().optional(),
});

orgRouter.patch(
  "/branches/:id",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
    const id = String(req.params.id);
    const parsed = branchSchedulePatch.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const b = await prisma.branch.update({
      where: { id },
      data: parsed.data,
    });
    res.json(b);
  }
);
