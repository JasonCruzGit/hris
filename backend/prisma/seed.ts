import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);

  const company = await prisma.company.upsert({
    where: { code: "MAIN" },
    update: {},
    create: { name: "Acme Corporation", code: "MAIN" },
  });

  const branch = await prisma.branch.upsert({
    where: { companyId_code: { companyId: company.id, code: "HQ" } },
    update: {},
    create: {
      companyId: company.id,
      name: "Headquarters",
      code: "HQ",
      address: "Makati, Philippines",
    },
  });

  const deptEngineering = await prisma.department.upsert({
    where: { code: "ENG" },
    update: {},
    create: { name: "Engineering", code: "ENG", description: "Product & engineering" },
  });

  const deptHr = await prisma.department.upsert({
    where: { code: "HR" },
    update: {},
    create: { name: "Human Resources", code: "HR", description: "People operations" },
  });

  const position = await prisma.position.upsert({
    where: { code: "SWE" },
    update: {},
    create: { title: "Software Engineer", code: "SWE", description: "Builds product" },
  });

  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@hris.local" },
    update: {},
    create: {
      email: "superadmin@hris.local",
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });

  const hrAdmin = await prisma.user.upsert({
    where: { email: "hradmin@hris.local" },
    update: {},
    create: {
      email: "hradmin@hris.local",
      passwordHash,
      role: "HR_ADMIN",
    },
  });

  const deptHeadUser = await prisma.user.upsert({
    where: { email: "depthead@hris.local" },
    update: {},
    create: {
      email: "depthead@hris.local",
      passwordHash,
      role: "DEPARTMENT_HEAD",
    },
  });

  await prisma.department.update({
    where: { id: deptEngineering.id },
    data: { headUserId: deptHeadUser.id },
  });

  const empUser = await prisma.user.upsert({
    where: { email: "employee@hris.local" },
    update: {},
    create: {
      email: "employee@hris.local",
      passwordHash,
      role: "EMPLOYEE",
    },
  });

  const employee = await prisma.employee.upsert({
    where: { employeeNumber: "EMP-0001" },
    update: {},
    create: {
      employeeNumber: "EMP-0001",
      userId: empUser.id,
      firstName: "Ana",
      lastName: "Santos",
      email: "employee@hris.local",
      hireDate: new Date("2023-01-15"),
      departmentId: deptEngineering.id,
      positionId: position.id,
      branchId: branch.id,
      basicSalary: 75000,
      employmentStatus: "ACTIVE",
      qrEmployeeId: "QR-DEMO-EMP-0001",
    },
  });

  await prisma.leaveType.upsert({
    where: { code: "VAC" },
    update: {},
    create: { name: "Vacation", code: "VAC", maxDaysPerYear: 15, isPaid: true },
  });
  await prisma.leaveType.upsert({
    where: { code: "SICK" },
    update: {},
    create: { name: "Sick", code: "SICK", maxDaysPerYear: 15, isPaid: true },
  });

  const vacation = await prisma.leaveType.findUniqueOrThrow({ where: { code: "VAC" } });
  const year = new Date().getFullYear();
  await prisma.leaveBalance.upsert({
    where: {
      employeeId_leaveTypeId_year: {
        employeeId: employee.id,
        leaveTypeId: vacation.id,
        year,
      },
    },
    update: {},
    create: {
      employeeId: employee.id,
      leaveTypeId: vacation.id,
      year,
      entitledDays: 15,
      usedDays: 0,
    },
  });

  const jobCount = await prisma.jobPosting.count();
  if (jobCount === 0) {
    await prisma.jobPosting.create({
      data: {
        title: "Senior Software Engineer",
        department: "Engineering",
        location: "Makati",
        description: "Design and ship HRIS features. Stack: TypeScript, React, Node, PostgreSQL.",
        status: "OPEN",
      },
    });
  }

  console.log("Seed complete.");
  console.log("Users (password: ChangeMe123!):");
  console.log("- superadmin@hris.local (SUPER_ADMIN)");
  console.log("- hradmin@hris.local (HR_ADMIN)");
  console.log("- depthead@hris.local (DEPARTMENT_HEAD) — heads Engineering");
  console.log("- employee@hris.local (EMPLOYEE) — linked to", employee.employeeNumber);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
