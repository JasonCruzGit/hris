import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { uploadsRoot } from "../lib/uploadsRoot.js";

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsRoot()),
    filename: (_req, file, cb) =>
      cb(null, `resume-${Date.now()}-${file.originalname.replace(/[^\w.-]/g, "_")}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const publicRecruitmentRouter = Router();

publicRecruitmentRouter.get("/jobs", async (_req, res) => {
  const items = await prisma.jobPosting.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      department: true,
      location: true,
      description: true,
      status: true,
      createdAt: true,
    },
  });
  res.json({ items });
});

const applySchema = z.object({
  jobPostingId: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
});

publicRecruitmentRouter.post("/apply", upload.single("resume"), async (req, res) => {
  const raw = applySchema.safeParse(req.body);
  if (!raw.success) {
    res.status(400).json({ error: raw.error.flatten() });
    return;
  }
  const job = await prisma.jobPosting.findFirst({
    where: { id: raw.data.jobPostingId, status: "OPEN" },
  });
  if (!job) {
    res.status(404).json({ error: "Job not found or closed" });
    return;
  }
  const resumePath = req.file?.filename ?? null;
  const a = await prisma.applicant.create({
    data: {
      ...raw.data,
      resumePath,
    },
  });
  res.status(201).json({ id: a.id, message: "Application received" });
});
