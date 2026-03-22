import type { Request } from "express";
import { prisma } from "./prisma.js";

export async function logAudit(
  req: Request,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, unknown>
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req.auth?.id,
        action,
        entityType,
        entityId,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
        ip: req.ip,
      },
    });
  } catch {
    // ignore audit failures
  }
}
