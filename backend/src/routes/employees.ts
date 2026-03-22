import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { employeeByIdWhere, employeeScope } from "../lib/access.js";
import { logAudit } from "../lib/audit.js";
import { uploadsRoot } from "../lib/uploadsRoot.js";

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsRoot()),
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${file.originalname.replace(/[^\w.-]/g, "_")}`),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const uploadPhoto = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsRoot()),
    filename: (_req, file, cb) =>
      cb(null, `emp-${Date.now()}-${file.originalname.replace(/[^\w.-]/g, "_")}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
      return;
    }
    cb(null, true);
  },
});

function employeeToJson(emp: Record<string, unknown>) {
  const { photoPath, photoMimeType, ...rest } = emp as {
    photoPath?: string | null;
    photoMimeType?: string | null;
  };
  return {
    ...rest,
    photoUrl: photoPath ? `/uploads/${photoPath}` : null,
  };
}

export const employeesRouter = Router();
employeesRouter.use(authMiddleware);

employeesRouter.get(
  "/documents/expiring",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
    const days = Math.min(365, Math.max(1, Number(req.query.days ?? 30)));
    const now = new Date();
    const until = new Date(now);
    until.setDate(until.getDate() + days);
    const items = await prisma.employeeDocument.findMany({
      where: {
        expiresAt: { not: null, lte: until, gte: now },
      },
      orderBy: { expiresAt: "asc" },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
      },
    });
    res.json({ items });
  }
);

const selfPatchSchema = z.object({
  phone: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  emergencyContacts: z.array(
    z.object({
      name: z.string(),
      relationship: z.string(),
      phone: z.string(),
      email: z.string().optional(),
    })
  ).optional(),
});

employeesRouter.patch("/me", async (req, res) => {
  const empId = req.auth!.employeeId;
  if (!empId) {
    res.status(403).json({ error: "No employee profile linked" });
    return;
  }
  const parsed = selfPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { emergencyContacts, ...rest } = parsed.data;
  const updated = await prisma.$transaction(async (tx) => {
    if (emergencyContacts) {
      await tx.emergencyContact.deleteMany({ where: { employeeId: empId } });
      if (emergencyContacts.length) {
        await tx.emergencyContact.createMany({
          data: emergencyContacts.map((c) => ({
            employeeId: empId,
            name: c.name,
            relationship: c.relationship,
            phone: c.phone,
            email: c.email ?? undefined,
          })),
        });
      }
    }
    return tx.employee.update({
      where: { id: empId },
      data: {
        ...(rest.phone !== undefined ? { phone: rest.phone } : {}),
        ...(rest.address !== undefined ? { address: rest.address } : {}),
        ...(rest.email !== undefined
          ? { email: rest.email === "" ? null : rest.email }
          : {}),
      },
      include: {
        department: true,
        position: true,
        branch: true,
        emergencyContacts: true,
      },
    });
  });
  await logAudit(req, "SELF_UPDATE", "Employee", updated.id);
  res.json(employeeToJson(updated as unknown as Record<string, unknown>));
});

const emergencySchema = z.object({
  name: z.string(),
  relationship: z.string(),
  phone: z.string(),
  email: z.string().optional(),
});

const createSchema = z.object({
  employeeNumber: z.string().min(1),
  firstName: z.string().min(1),
  middleName: z.string().optional(),
  lastName: z.string().min(1),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.string().optional(),
  nationality: z.string().optional(),
  civilStatus: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  hireDate: z.coerce.date(),
  employmentStatus: z.enum(["ACTIVE", "PROBATIONARY", "ON_LEAVE", "TERMINATED"]).optional(),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
  branchId: z.string().optional(),
  managerId: z.string().optional(),
  basicSalary: z.coerce.number().nonnegative(),
  payFrequency: z.string().optional(),
  currency: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  tin: z.string().optional(),
  sssNumber: z.string().optional(),
  philhealthNumber: z.string().optional(),
  pagibigNumber: z.string().optional(),
  emergencyContacts: z.array(emergencySchema).optional(),
  userEmail: z.string().email().optional(),
  userPassword: z.string().min(8).optional(),
});

employeesRouter.get("/", async (req, res) => {
  const { search, departmentId, companyId, page = "1", pageSize = "20" } = req.query;
  const take = Math.min(100, Math.max(1, parseInt(String(pageSize), 10) || 20));
  const skip = (Math.max(1, parseInt(String(page), 10) || 1) - 1) * take;

  const scope = employeeScope(req.auth!);
  const filters: Prisma.EmployeeWhereInput[] = [scope];
  if (typeof companyId === "string" && companyId) {
    filters.push({ branch: { companyId } });
  }
  if (typeof departmentId === "string" && departmentId) {
    filters.push({ departmentId });
  }
  if (typeof search === "string" && search.trim()) {
    const q = search.trim();
    filters.push({
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { employeeNumber: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  const where: Prisma.EmployeeWhereInput = { AND: filters };

  const [items, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      skip,
      take,
      orderBy: { lastName: "asc" },
      include: {
        department: true,
        position: true,
        branch: true,
      },
    }),
    prisma.employee.count({ where }),
  ]);

  res.json({ items, total, page: Math.max(1, parseInt(String(page), 10) || 1), pageSize: take });
});

employeesRouter.get("/:id", async (req, res) => {
  const id = String(req.params.id);
  const employee = await prisma.employee.findFirst({
    where: employeeByIdWhere(req.auth!, id),
    include: {
      department: true,
      position: true,
      branch: true,
      manager: { select: { id: true, firstName: true, lastName: true } },
      emergencyContacts: true,
      documents: true,
      user: { select: { id: true, email: true, role: true, isActive: true } },
    },
  });
  if (!employee) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(employeeToJson(employee as unknown as Record<string, unknown>));
});

employeesRouter.post(
  "/:id/photo",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  uploadPhoto.single("photo"),
  async (req, res) => {
    const id = String(req.params.id);
    if (!req.file) {
      res.status(400).json({ error: "No image file uploaded" });
      return;
    }
    const existing = await prisma.employee.findFirst({
      where: employeeByIdWhere(req.auth!, id),
    });
    if (!existing) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // ignore
      }
      res.status(404).json({ error: "Not found" });
      return;
    }
    const filename = req.file.filename;
    const mime = req.file.mimetype;
    const prev = existing.photoPath;
    await prisma.employee.update({
      where: { id: existing.id },
      data: { photoPath: filename, photoMimeType: mime },
    });
    if (prev && prev !== filename) {
      try {
        fs.unlinkSync(path.join(uploadsRoot(), prev));
      } catch {
        // ignore
      }
    }
    await logAudit(req, "UPDATE", "Employee", existing.id, { photo: true });
    res.json({
      photoUrl: `/uploads/${filename}`,
    });
  }
);

employeesRouter.post(
  "/",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const data = parsed.data;
    const { emergencyContacts, userEmail, userPassword, ...rest } = data;

    const created = await prisma.$transaction(async (tx) => {
      let userId: string | undefined;
      if (userEmail && userPassword) {
        const bcrypt = await import("bcryptjs");
        const passwordHash = await bcrypt.hash(userPassword, 10);
        const user = await tx.user.create({
          data: {
            email: userEmail.toLowerCase(),
            passwordHash,
            role: "EMPLOYEE",
          },
        });
        userId = user.id;
      }

      const emp = await tx.employee.create({
        data: {
          ...rest,
          email: rest.email || undefined,
          userId,
          emergencyContacts: emergencyContacts?.length
            ? {
                create: emergencyContacts.map((c) => ({
                  name: c.name,
                  relationship: c.relationship,
                  phone: c.phone,
                  email: c.email,
                })),
              }
            : undefined,
        },
        include: {
          department: true,
          position: true,
          emergencyContacts: true,
        },
      });
      return emp;
    });

    await logAudit(req, "CREATE", "Employee", created.id, { employeeNumber: created.employeeNumber });
    res.status(201).json(employeeToJson(created as unknown as Record<string, unknown>));
  }
);

const patchSchema = createSchema.partial();

employeesRouter.patch(
  "/:id",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const id = String(req.params.id);
    const existing = await prisma.employee.findFirst({
      where: employeeByIdWhere(req.auth!, id),
    });
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const data = parsed.data;
    const { emergencyContacts, userEmail, userPassword, ...rest } = data;

    const updated = await prisma.$transaction(async (tx) => {
      if (userEmail && userPassword) {
        const bcrypt = await import("bcryptjs");
        const passwordHash = await bcrypt.hash(userPassword, 10);
        if (existing.userId) {
          await tx.user.update({
            where: { id: existing.userId },
            data: { email: userEmail.toLowerCase(), passwordHash },
          });
        } else {
          const user = await tx.user.create({
            data: {
              email: userEmail.toLowerCase(),
              passwordHash,
              role: "EMPLOYEE",
            },
          });
          await tx.employee.update({
            where: { id: existing.id },
            data: { userId: user.id },
          });
        }
      }

      if (emergencyContacts) {
        await tx.emergencyContact.deleteMany({ where: { employeeId: existing.id } });
        await tx.emergencyContact.createMany({
          data: emergencyContacts.map((c) => ({
            employeeId: existing.id,
            name: c.name,
            relationship: c.relationship,
            phone: c.phone,
            email: c.email,
          })),
        });
      }

      return tx.employee.update({
        where: { id: existing.id },
        data: {
          ...rest,
          email: rest.email === "" ? null : rest.email,
        },
        include: {
          department: true,
          position: true,
          branch: true,
          emergencyContacts: true,
        },
      });
    });

    await logAudit(req, "UPDATE", "Employee", updated.id);
    res.json(employeeToJson(updated as unknown as Record<string, unknown>));
  }
);

employeesRouter.delete(
  "/:id",
  requireRoles("SUPER_ADMIN"),
  async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.employee.findFirst({
      where: employeeByIdWhere(req.auth!, id),
    });
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (existing.photoPath) {
      try {
        fs.unlinkSync(path.join(uploadsRoot(), existing.photoPath));
      } catch {
        // ignore
      }
    }
    await prisma.employee.delete({ where: { id: existing.id } });
    await logAudit(req, "DELETE", "Employee", existing.id);
    res.status(204).send();
  }
);

const docUploadSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  expiresAt: z.coerce.date().optional(),
});

employeesRouter.post(
  "/:id/documents",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  upload.single("file"),
  async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.employee.findFirst({
      where: employeeByIdWhere(req.auth!, id),
    });
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "file required" });
      return;
    }
    const meta = docUploadSchema.safeParse(req.body);
    if (!meta.success) {
      res.status(400).json({ error: meta.error.flatten() });
      return;
    }
    const doc = await prisma.employeeDocument.create({
      data: {
        employeeId: existing.id,
        title: meta.data.title,
        category: meta.data.category,
        fileName: req.file.originalname,
        filePath: req.file.filename,
        mimeType: req.file.mimetype,
        expiresAt: meta.data.expiresAt,
      },
    });
    await logAudit(req, "UPLOAD", "EmployeeDocument", doc.id);
    res.status(201).json(doc);
  }
);
