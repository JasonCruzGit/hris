import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";

export const auditRouter = Router();
auditRouter.use(authMiddleware);

auditRouter.get(
  "/",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
    const { page = "1", pageSize = "50" } = req.query;
    const take = Math.min(200, Math.max(1, parseInt(String(pageSize), 10) || 50));
    const skip = (Math.max(1, parseInt(String(page), 10) || 1) - 1) * take;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { email: true, role: true } } },
      }),
      prisma.auditLog.count(),
    ]);
    res.json({ items, total });
  }
);
