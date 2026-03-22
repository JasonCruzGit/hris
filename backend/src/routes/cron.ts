import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";

export const cronRouter = Router();
cronRouter.use(authMiddleware);

/** Notify HR users about documents expiring within the next N days (default 30). */
cronRouter.post(
  "/document-expiry-alerts",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
    const days = Math.min(90, Math.max(1, Number(req.query.days ?? 30)));
    const now = new Date();
    const until = new Date(now);
    until.setDate(until.getDate() + days);

    const docs = await prisma.employeeDocument.findMany({
      where: {
        expiresAt: { not: null, gte: now, lte: until },
      },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
      },
    });

    const hrUsers = await prisma.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "HR_ADMIN"] }, isActive: true },
      select: { id: true },
    });

    const title = `${docs.length} document(s) expiring within ${days} day(s)`;
    const body =
      docs.length === 0
        ? "No expiring documents in this window."
        : docs
            .map(
              (d) =>
                `${d.title} (${d.employee.employeeNumber} ${d.employee.firstName}) expires ${d.expiresAt?.toISOString().slice(0, 10)}`
            )
            .join("\n");

    await prisma.$transaction(
      hrUsers.map((u) =>
        prisma.notification.create({
          data: {
            userId: u.id,
            title,
            body: body.slice(0, 8000),
            channel: "IN_APP",
          },
        })
      )
    );

    res.json({ documents: docs.length, notificationsSent: hrUsers.length });
  }
);
