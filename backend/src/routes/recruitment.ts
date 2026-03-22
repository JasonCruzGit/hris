import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireHrOrAdmin, requireRoles } from "../middleware/rbac.js";
import { logAudit } from "../lib/audit.js";

export const recruitmentRouter = Router();
recruitmentRouter.use(authMiddleware);

recruitmentRouter.get("/jobs", requireHrOrAdmin, async (_req, res) => {
  const items = await prisma.jobPosting.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ items });
});

recruitmentRouter.get(
  "/applicants",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (_req, res) => {
    const items = await prisma.applicant.findMany({
      orderBy: { createdAt: "desc" },
      include: { jobPosting: { select: { title: true } } },
    });
    res.json({ items });
  }
);

const jobSchema = z.object({
  title: z.string().min(1),
  department: z.string().optional(),
  location: z.string().optional(),
  description: z.string().min(1),
  status: z.string().optional(),
});

recruitmentRouter.post(
  "/jobs",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
    const parsed = jobSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const j = await prisma.jobPosting.create({ data: parsed.data });
    res.status(201).json(j);
  }
);

const applicantSchema = z.object({
  jobPostingId: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
});

recruitmentRouter.post(
  "/applicants",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
  const parsed = applicantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const a = await prisma.applicant.create({ data: parsed.data });
  res.status(201).json(a);
  }
);

recruitmentRouter.patch(
  "/applicants/:id/stage",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
    const id = String(req.params.id);
    const schema = z.object({ stage: z.enum(["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED", "REJECTED"]) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const a = await prisma.applicant.update({
      where: { id },
      data: { stage: parsed.data.stage },
    });
    await logAudit(req, "STAGE", "Applicant", id);
    res.json(a);
  }
);

const interviewSchema = z.object({
  scheduledAt: z.coerce.date(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

recruitmentRouter.post(
  "/applicants/:id/interviews",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
    const applicantId = String(req.params.id);
    const parsed = interviewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const i = await prisma.interview.create({
      data: { applicantId, ...parsed.data },
    });
    res.status(201).json(i);
  }
);
