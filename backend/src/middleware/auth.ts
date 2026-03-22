import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import type { Role, User } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";

export type AuthUser = User & {
  employeeId: string | null;
  departmentIdAsHead: string | null;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export function signToken(payload: { sub: string; role: Role }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; role: Role };
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: {
        employee: { select: { id: true } },
        departmentHead: { select: { id: true } },
      },
    });
    if (!user || !user.isActive) {
      res.status(401).json({ error: "Invalid session" });
      return;
    }
    req.auth = {
      ...user,
      employeeId: user.employee?.id ?? null,
      departmentIdAsHead: user.departmentHead?.id ?? null,
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
