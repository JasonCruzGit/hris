import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { employeeScope } from "../lib/access.js";

export const dashboardRouter = Router();
dashboardRouter.use(authMiddleware);

dashboardRouter.get("/stats", async (req, res) => {
  const scope = employeeScope(req.auth!);
  const [employeeCount, activeEmployees, attendanceToday, pendingLeaves] = await Promise.all([
    prisma.employee.count({ where: scope }),
    prisma.employee.count({ where: { ...scope, employmentStatus: "ACTIVE" } }),
    prisma.attendance.count({
      where: {
        workDate: new Date(new Date().toISOString().slice(0, 10)),
        employee: { is: scope },
      },
    }),
    prisma.leaveRequest.count({
      where: {
        status: "PENDING",
        employee: { is: scope },
      },
    }),
  ]);

  const payrollRuns = await prisma.payrollRun.findMany({
    orderBy: { payDate: "desc" },
    take: 1,
  });

  res.json({
    employeeCount,
    activeEmployees,
    attendanceToday,
    pendingLeaves,
    lastPayrollRun: payrollRuns[0] ?? null,
  });
});
