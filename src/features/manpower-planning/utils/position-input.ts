import type { EmployeePosition, EmployeePositionInput } from '../types/manpower.types'

/** A stored position → the body `PUT /positions/{id}` takes (Activate / Deactivate). */
export function positionInputOf(position: EmployeePosition): EmployeePositionInput {
  return {
    code: position.code,
    jobTitleId: position.jobTitleId,
    branchId: position.branchId,
    employeeGroupId: position.employeeGroupId,
    divisionId: position.divisionId,
    departmentId: position.departmentId,
    subDepartmentId: position.subDepartmentId,
    costCenterId: position.costCenterId,
    gradeId: position.gradeId,
    reportsToId: position.reportsToId,
    employeeId: position.employeeId,
    status: position.status,
    minSalary: position.minSalary ?? 0,
    maxSalary: position.maxSalary ?? 0,
    rowVersion: position.rowVersion,
  }
}
