import { readFileSync } from "node:fs";
import { join } from "node:path";

export type PayrollInputs = {
  basicPay: number;
  allowances: number;
  overtimePay: number;
  otherDeductions?: number;
};

export type PayrollComputation = {
  grossPay: number;
  sssEmployee: number;
  philhealthEmployee: number;
  pagibigEmployee: number;
  withholdingTax: number;
  otherDeductions: number;
  netPay: number;
  tableVersion: string;
};

type TablesFile = {
  version: string;
  sssMonthlySalaryBrackets: { min: number; max: number; employeeContribution: number }[];
  philhealth: { rate: number; employeeShare: number; floorPremium: number; ceilingPremium: number };
  pagibig: { rate: number; maxEmployee: number };
  withholdingMonthly: { min: number; max: number; rate: number; base: number }[];
};

let cached: TablesFile | null = null;

function loadTables(): TablesFile {
  if (cached) return cached;
  const path = join(process.cwd(), "data", "ph-payroll-tables.json");
  cached = JSON.parse(readFileSync(path, "utf8")) as TablesFile;
  return cached;
}

function num(v: unknown): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === "number") return v;
  return Number(v);
}

function sssEmployeeShare(tables: TablesFile, monthlySalary: number): number {
  const m = monthlySalary;
  for (const b of tables.sssMonthlySalaryBrackets) {
    if (m >= b.min && m <= b.max) return b.employeeContribution;
  }
  return tables.sssMonthlySalaryBrackets[tables.sssMonthlySalaryBrackets.length - 1]!.employeeContribution;
}

function philhealthEE(tables: TablesFile, gross: number): number {
  const ph = tables.philhealth;
  const premium = Math.min(
    ph.ceilingPremium,
    Math.max(ph.floorPremium, gross * ph.rate)
  );
  return Math.round(premium * ph.employeeShare * 100) / 100;
}

function pagibigEE(tables: TablesFile, basic: number): number {
  const p = tables.pagibig;
  return Math.min(Math.round(basic * p.rate * 100) / 100, p.maxEmployee);
}

function withholdingMonthly(tables: TablesFile, taxableMonthly: number): number {
  const x = taxableMonthly;
  for (const row of tables.withholdingMonthly) {
    if (x >= row.min && x <= row.max) {
      const tax = row.base + Math.max(0, x - row.min) * row.rate;
      return Math.max(0, Math.round(tax * 100) / 100);
    }
  }
  const last = tables.withholdingMonthly[tables.withholdingMonthly.length - 1]!;
  return Math.max(0, Math.round((last.base + Math.max(0, x - last.min) * last.rate) * 100) / 100);
}

/**
 * Philippines payroll using versioned JSON tables under /data/ph-payroll-tables.json.
 * Validate brackets against official agency releases before production use.
 */
export function computePhilippinesPayroll(input: PayrollInputs): PayrollComputation {
  const tables = loadTables();
  const basic = num(input.basicPay);
  const allowances = num(input.allowances);
  const ot = num(input.overtimePay);
  const other = num(input.otherDeductions);

  const gross = basic + allowances + ot;

  const sssEmployee = sssEmployeeShare(tables, basic);
  const philhealthEmployee = philhealthEE(tables, gross);
  const pagibigEmployee = pagibigEE(tables, basic);

  const taxable = Math.max(0, gross - sssEmployee - philhealthEmployee - pagibigEmployee);
  const withholdingTax = withholdingMonthly(tables, taxable);

  const net =
    gross -
    sssEmployee -
    philhealthEmployee -
    pagibigEmployee -
    withholdingTax -
    other;

  return {
    grossPay: Math.round(gross * 100) / 100,
    sssEmployee: Math.round(sssEmployee * 100) / 100,
    philhealthEmployee: Math.round(philhealthEmployee * 100) / 100,
    pagibigEmployee: Math.round(pagibigEmployee * 100) / 100,
    withholdingTax: Math.round(withholdingTax * 100) / 100,
    otherDeductions: other,
    netPay: Math.round(net * 100) / 100,
    tableVersion: tables.version,
  };
}
