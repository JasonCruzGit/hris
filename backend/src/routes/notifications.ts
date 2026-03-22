import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { sendEmail } from "../services/email.js";

export const notificationsRouter = Router();
notificationsRouter.use(authMiddleware);

notificationsRouter.get("/", async (req, res) => {
  const items = await prisma.notification.findMany({
    where: { userId: req.auth!.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json({ items });
});

notificationsRouter.patch("/:id/read", async (req, res) => {
  const id = String(req.params.id);
  const n = await prisma.notification.updateMany({
    where: { id, userId: req.auth!.id },
    data: { readAt: new Date() },
  });
  if (n.count === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

notificationsRouter.patch("/read-all", async (req, res) => {
  const n = await prisma.notification.updateMany({
    where: { userId: req.auth!.id, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ count: n.count });
});

const broadcastSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  channel: z.enum(["IN_APP", "EMAIL"]).optional(),
});

notificationsRouter.post(
  "/broadcast",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
    const parsed = broadcastSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const channel = parsed.data.channel ?? "IN_APP";
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, email: true },
    });
    await prisma.$transaction(
      users.map((u) =>
        prisma.notification.create({
          data: {
            userId: u.id,
            title: parsed.data.title,
            body: parsed.data.body,
            channel,
          },
        })
      )
    );
    if (channel === "EMAIL") {
      for (const u of users) {
        void sendEmail({
          to: u.email,
          subject: parsed.data.title,
          text: parsed.data.body,
        });
      }
    }
    res.status(201).json({ count: users.length });
  }
);
