import { Router } from "express";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { employeeByIdWhere } from "../lib/access.js";
import { computePhilippinesPayroll } from "../services/payroll-ph.js";
import { logAudit } from "../lib/audit.js";
import { sendEmail } from "../services/email.js";

export const payrollRouter = Router();
payrollRouter.use(authMiddleware);

payrollRouter.get("/runs", async (req, res) => {
  if (req.auth!.role === "EMPLOYEE" && req.auth!.employeeId) {
    const items = await prisma.payrollRun.findMany({
      where: { lines: { some: { employeeId: req.auth!.employeeId } } },
      orderBy: { payDate: "desc" },
      include: { _count: { select: { lines: true } } },
    });
    res.json({ items });
    return;
  }
  const items = await prisma.payrollRun.findMany({
    orderBy: { payDate: "desc" },
    include: { _count: { select: { lines: true } } },
  });
  res.json({ items });
});

const runSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  payDate: z.coerce.date(),
});

payrollRouter.post(
  "/runs",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
    const parsed = runSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const run = await prisma.payrollRun.create({
      data: { ...parsed.data, status: "DRAFT" },
    });
    await logAudit(req, "CREATE", "PayrollRun", run.id);
    res.status(201).json(run);
  }
);

payrollRouter.post(
  "/runs/:id/generate",
  requireRoles("SUPER_ADMIN", "HR_ADMIN"),
  async (req, res) => {
    const id = String(req.params.id);
    const run = await prisma.payrollRun.findUnique({ where: { id } });
    if (!run) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const employees = await prisma.employee.findMany({
      where: { employmentStatus: "ACTIVE" },
    });

    const lines = await prisma.$transaction(
      employees.map((e) => {
        const basic = Number(e.basicSalary);
        const allowances = 0;
        const overtimePay = 0;
        const comp = computePhilippinesPayroll({
          basicPay: basic,
          allowances,
          overtimePay,
          otherDeductions: 0,
        });
        return prisma.payrollLine.upsert({
          where: {
            payrollRunId_employeeId: { payrollRunId: id, employeeId: e.id },
          },
          create: {
            payrollRunId: id,
            employeeId: e.id,
            basicPay: basic,
            allowances,
            overtimePay,
            grossPay: comp.grossPay,
            sssEmployee: comp.sssEmployee,
            philhealthEmployee: comp.philhealthEmployee,
            pagibigEmployee: comp.pagibigEmployee,
            withholdingTax: comp.withholdingTax,
            otherDeductions: comp.otherDeductions,
            netPay: comp.netPay,
            metaJson: JSON.stringify({ formula: "ph-tables-json", tableVersion: comp.tableVersion }),
          },
          update: {
            basicPay: basic,
            allowances,
            overtimePay,
            grossPay: comp.grossPay,
            sssEmployee: comp.sssEmployee,
            philhealthEmployee: comp.philhealthEmployee,
            pagibigEmployee: comp.pagibigEmployee,
            withholdingTax: comp.withholdingTax,
            otherDeductions: comp.otherDeductions,
            netPay: comp.netPay,
            metaJson: JSON.stringify({ formula: "ph-tables-json", tableVersion: comp.tableVersion }),
          },
        });
      })
    );

    await prisma.payrollRun.update({
      where: { id },
      data: { status: "COMPUTED" },
    });

    if (process.env.PAYROLL_NOTIFY_EMAIL === "true") {
      const withEmail = await prisma.employee.findMany({
        where: { employmentStatus: "ACTIVE", email: { not: null } },
        select: { email: true, firstName: true },
      });
      for (const e of withEmail) {
        if (e.email) {
          void sendEmail({
            to: e.email,
            subject: "Payslip available",
            text: `Hi ${e.firstName}, payroll for the period ending ${run.periodEnd.toISOString().slice(0, 10)} has been processed. Sign in to the HRIS portal to view your payslip.`,
          });
        }
      }
    }

    await logAudit(req, "GENERATE", "PayrollRun", id);
    res.json({ count: lines.length });
  }
);

payrollRouter.get("/lines", async (req, res) => {
  const { payrollRunId } = req.query;
  if (typeof payrollRunId !== "string") {
    res.status(400).json({ error: "payrollRunId required" });
    return;
  }
  const items = await prisma.payrollLine.findMany({
    where: { payrollRunId },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
    },
  });
  const filtered =
    req.auth!.role === "EMPLOYEE" && req.auth!.employeeId
      ? items.filter((l) => l.employeeId === req.auth!.employeeId)
      : items;
  res.json({ items: filtered });
});

payrollRouter.get("/lines/:id/payslip.pdf", async (req, res) => {
  const id = String(req.params.id);
  const line = await prisma.payrollLine.findUnique({
    where: { id },
    include: {
      employee: true,
      payrollRun: true,
    },
  });
  if (!line) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const allowed = await prisma.employee.findFirst({
    where: employeeByIdWhere(req.auth!, line.employeeId),
  });
  if (!allowed) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="payslip-${line.employee.employeeNumber}.pdf"`
  );

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);
  doc.fontSize(18).text("Payslip", { align: "center" });
  doc.moveDown();
  doc.fontSize(11).text(`${line.employee.firstName} ${line.employee.lastName}`);
  doc.text(`Employee #: ${line.employee.employeeNumber}`);
  doc.text(
    `Period: ${line.payrollRun.periodStart.toDateString()} – ${line.payrollRun.periodEnd.toDateString()}`
  );
  doc.moveDown();
  doc.text(`Gross: PHP ${Number(line.grossPay).toFixed(2)}`);
  doc.text(`SSS (EE): PHP ${Number(line.sssEmployee).toFixed(2)}`);
  doc.text(`PhilHealth (EE): PHP ${Number(line.philhealthEmployee).toFixed(2)}`);
  doc.text(`Pag-IBIG (EE): PHP ${Number(line.pagibigEmployee).toFixed(2)}`);
  doc.text(`Withholding: PHP ${Number(line.withholdingTax).toFixed(2)}`);
  doc.text(`Net pay: PHP ${Number(line.netPay).toFixed(2)}`);
  doc.end();
});
