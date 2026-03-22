import { Router } from "express";
import * as XLSX from "xlsx";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { employeeScope } from "../lib/access.js";

export const reportsRouter = Router();
reportsRouter.use(authMiddleware);

reportsRouter.get("/employees", async (req, res) => {
  const items = await prisma.employee.findMany({
    where: employeeScope(req.auth!),
    include: { department: true, position: true },
  });
  res.json({ items });
});

reportsRouter.get(
  "/payroll.xlsx",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
    const { payrollRunId } = req.query;
    if (typeof payrollRunId !== "string") {
      res.status(400).json({ error: "payrollRunId required" });
      return;
    }
    const lines = await prisma.payrollLine.findMany({
      where: { payrollRunId },
      include: { employee: true, payrollRun: true },
    });
    const rows = lines.map((l) => ({
      EmployeeNumber: l.employee.employeeNumber,
      LastName: l.employee.lastName,
      FirstName: l.employee.firstName,
      Gross: Number(l.grossPay),
      Net: Number(l.netPay),
      SSS: Number(l.sssEmployee),
      PhilHealth: Number(l.philhealthEmployee),
      PagIBIG: Number(l.pagibigEmployee),
      Tax: Number(l.withholdingTax),
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Payroll");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="payroll-${payrollRunId}.xlsx"`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buf);
  }
);
