import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";

const sendSchema = z.object({
  body: z.string().trim().min(1),
});

export const messagesRouter = Router();
messagesRouter.use(authMiddleware);

messagesRouter.get("/threads", async (req, res) => {
  const me = req.auth!.id;
  const messages = await prisma.message.findMany({
    where: {
      OR: [{ senderUserId: me }, { recipientUserId: me }],
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      senderUser: { select: { id: true, email: true, role: true } },
      recipientUser: { select: { id: true, email: true, role: true } },
    },
  });
  const map = new Map<
    string,
    {
      userId: string;
      email: string;
      role: string;
      updatedAt: string;
      unread: number;
      lastMessage: string;
    }
  >();
  for (const m of messages) {
    const other = m.senderUserId === me ? m.recipientUser : m.senderUser;
    const current = map.get(other.id);
    if (!current) {
      map.set(other.id, {
        userId: other.id,
        email: other.email,
        role: other.role,
        updatedAt: m.createdAt.toISOString(),
        unread: m.recipientUserId === me && !m.readAt ? 1 : 0,
        lastMessage: m.body,
      });
    } else if (m.recipientUserId === me && !m.readAt) {
      current.unread += 1;
    }
  }
  res.json({ items: Array.from(map.values()) });
});

messagesRouter.get("/with/:userId", async (req, res) => {
  const me = req.auth!.id;
  const other = String(req.params.userId);
  const items = await prisma.message.findMany({
    where: {
      OR: [
        { senderUserId: me, recipientUserId: other },
        { senderUserId: other, recipientUserId: me },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 300,
  });
  await prisma.message.updateMany({
    where: { senderUserId: other, recipientUserId: me, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ items });
});

messagesRouter.patch("/read-all", async (req, res) => {
  const n = await prisma.message.updateMany({
    where: { recipientUserId: req.auth!.id, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ count: n.count });
});

messagesRouter.post("/with/:userId", async (req, res) => {
  const toUserId = String(req.params.userId);
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const to = await prisma.user.findUnique({ where: { id: toUserId }, select: { id: true } });
  if (!to) {
    res.status(404).json({ error: "Recipient not found" });
    return;
  }
  const [sender, msg] = await prisma.$transaction([
    prisma.user.findUnique({
      where: { id: req.auth!.id },
      select: {
        email: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.message.create({
      data: {
        senderUserId: req.auth!.id,
        recipientUserId: toUserId,
        body: parsed.data.body,
      },
    }),
  ]);
  const senderName = sender?.employee
    ? `${sender.employee.firstName} ${sender.employee.lastName}`
    : sender?.email ?? "A user";
  await prisma.notification.create({
    data: {
      userId: toUserId,
      title: `New message from ${senderName}`,
      body: parsed.data.body.slice(0, 120),
      channel: "IN_APP",
    },
  });
  res.status(201).json(msg);
});

messagesRouter.get("/contacts", async (req, res) => {
  if (req.auth!.role === "EMPLOYEE") {
    const items = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ["SUPER_ADMIN", "HR_ADMIN", "DEPARTMENT_HEAD"] },
      },
      select: { id: true, email: true, role: true },
      orderBy: { email: "asc" },
    });
    res.json({ items });
    return;
  }

  const items = await prisma.user.findMany({
    where: {
      isActive: true,
      role: "EMPLOYEE",
    },
    select: {
      id: true,
      email: true,
      role: true,
      employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
    },
    orderBy: { email: "asc" },
  });
  res.json({ items });
});
