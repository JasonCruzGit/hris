import type { Prisma } from "@prisma/client";
import type { AuthUser } from "../middleware/auth.js";

export function employeeScope(auth: AuthUser): Prisma.EmployeeWhereInput {
  if (auth.role === "SUPER_ADMIN" || auth.role === "HR_ADMIN") {
    return {};
  }
  if (auth.role === "DEPARTMENT_HEAD" && auth.departmentIdAsHead) {
    return { departmentId: auth.departmentIdAsHead };
  }
  if (auth.role === "EMPLOYEE" && auth.employeeId) {
    return { id: auth.employeeId };
  }
  return { id: "__none__" };
}

export function employeeByIdWhere(
  auth: AuthUser,
  employeeId: string
): Prisma.EmployeeWhereInput {
  return { AND: [{ id: employeeId }, employeeScope(auth)] };
}
