import type { Request, Response, NextFunction } from "express";
import type { Role } from "@prisma/client";

export function requireRoles(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!allowed.includes(req.auth.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function requireHrOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const ok =
    req.auth.role === "SUPER_ADMIN" ||
    req.auth.role === "HR_ADMIN" ||
    req.auth.role === "DEPARTMENT_HEAD";
  if (!ok) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}
