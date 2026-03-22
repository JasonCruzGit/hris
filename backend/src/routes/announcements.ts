import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { uploadsRoot } from "../lib/uploadsRoot.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireHrOrAdmin } from "../middleware/rbac.js";

const createSchema = z.object({
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  body: z.string().trim().min(1),
  audience: z.string().trim().min(1),
  pinned: z.boolean().optional(),
});

const updateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  summary: z.string().trim().min(1).optional(),
  body: z.string().trim().min(1).optional(),
  audience: z.string().trim().min(1).optional(),
  pinned: z.boolean().optional(),
});

export const announcementsRouter = Router();
announcementsRouter.use(authMiddleware);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsRoot()),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`),
  }),
});

announcementsRouter.get("/", async (_req, res) => {
  const items = await prisma.announcement.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
  res.json({
    items: items.map((a) => ({
      ...a,
      imageUrl: a.imagePath ? `/uploads/${a.imagePath}` : null,
    })),
  });
});

announcementsRouter.post("/", requireHrOrAdmin, upload.single("image"), async (req, res) => {
  const parsed = createSchema.safeParse({
    title: req.body.title,
    summary: req.body.summary,
    body: req.body.body,
    audience: req.body.audience,
    pinned: req.body.pinned === "true",
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  if (req.file && !req.file.mimetype.startsWith("image/")) {
    res.status(400).json({ error: "Only image files are allowed" });
    return;
  }
  const row = await prisma.announcement.create({
    data: {
      ...parsed.data,
      pinned: parsed.data.pinned ?? false,
      imagePath: req.file?.filename ?? null,
      imageMimeType: req.file?.mimetype ?? null,
      authorUserId: req.auth!.id,
    },
  });
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  await prisma.$transaction(
    users.map((u) =>
      prisma.notification.create({
        data: {
          userId: u.id,
          title: `Announcement: ${row.title}`,
          body: row.summary,
          channel: "IN_APP",
        },
      })
    )
  );
  res.status(201).json({
    ...row,
    imageUrl: row.imagePath ? `/uploads/${row.imagePath}` : null,
  });
});

announcementsRouter.patch("/:id", requireHrOrAdmin, async (req, res) => {
  const id = String(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const updated = await prisma.announcement.update({
    where: { id },
    data: parsed.data,
  });
  res.json({
    ...updated,
    imageUrl: updated.imagePath ? `/uploads/${updated.imagePath}` : null,
  });
});

announcementsRouter.delete("/:id", requireHrOrAdmin, async (req, res) => {
  const id = String(req.params.id);
  await prisma.announcement.delete({ where: { id } });
  res.status(204).send();
});
