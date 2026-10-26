import { format, subMonths } from 'date-fns'

import type { EmployeeLookup, EmployeeProfile, EmployeeRef } from '@/features/payroll'

import { toProfile } from '../attendance/seed'
import { DIRECTORY, type DirectoryEmployee, findEmployee } from '../employees/seed'
import { profileOf } from '../scheduling/seed'
import { branches } from '../settings/handlers'
import { salaryRevisions } from './db-records'

// People as the payroll mocks (and the assets / off-boarding / requests mocks) show them.

export function employeeRef(id: string): EmployeeRef {
  const employee = findEmployee(id)
  if (!employee) {
    return { id, name: 'Unknown', code: id, department: '', designation: '', photoUrl: null }
  }
  const profile = toProfile(employee)
  return {
    id,
    name: employee.name,
    code: profile.code,
    department: employee.department,
    designation: employee.jobTitle,
    photoUrl: profile.photoUrl,
  }
}

export function employeeProfile(id: string): EmployeeProfile {
  const employee = findEmployee(id)
  const ref = employeeRef(id)
  if (!employee) return { ...ref, location: null, branch: null, company: null, joiningDate: '' }
  const profile = toProfile(employee)
  return {
    ...ref,
    location: profile.location,
    branch: profile.branch,
    company: profile.company,
    joiningDate: profile.joiningDate,
  }
}

export const isActive = (id: string) => {
  const employee = findEmployee(id)
  return employee ? profileOf(employee).status === 'active' : false
}

/** The person fields a payroll record carries (`employeeId`, `employeeCode`, `employeeName` …). */
export function personFields(id: string) {
  const profile = employeeProfile(id)
  return {
    employeeId: id,
    employeeCode: profile.code,
    employeeName: profile.name,
    departmentName: profile.department || null,
    designationName: profile.designation || null,
    jobTitleName: profile.designation || null,
    branchName: profile.branch,
    locationName: profile.location,
    joiningDate: profile.joiningDate || null,
  }
}

/** `GET /employees/lookup` row. */
export function lookupRow(employee: DirectoryEmployee): EmployeeLookup {
  const profile = employeeProfile(employee.id)
  const branch = employee.branchId ? branches.find(employee.branchId) : undefined
  return {
    id: employee.id,
    code: profile.code,
    name: employee.name,
    designationName: employee.jobTitle,
    jobTitleName: employee.jobTitle,
    departmentId: `dep_${employee.department.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    departmentName: employee.department,
    branchId: employee.branchId,
    branchName: branch?.name ?? '',
    status: isActive(employee.id) ? 'active' : 'inactive',
    photoUrl: profile.photoUrl,
  }
}

export const employeeByCode = (code: string) =>
  DIRECTORY.find((employee) => employeeRef(employee.id).code.toLowerCase() === code.toLowerCase())

/** Monthly gross before any revision: by job title, with a small per-person offset. */
export function baseSalaryOf(employee: DirectoryEmployee): number {
  const title = employee.jobTitle.toLowerCase()
  let hash = 0
  for (let index = 0; index < employee.id.length; index += 1) {
    hash = (hash * 31 + employee.id.charCodeAt(index)) % 10_007
  }
  const offset = (hash % 8) * 5_000
  const base = /head|country|gm |surgeon|anaesthetist/.test(`${title} `)
    ? 420_000
    : title.includes('manager')
      ? 300_000
      : /developer|engineer|designer|devops/.test(title)
        ? 170_000
        : title.includes('physiotherapist')
          ? 150_000
          : 110_000
  return base + offset
}

/** Monthly gross on a date: the latest revision in effect, or the starting salary. */
export function salaryOn(employeeId: string, date: string): number {
  const revision = salaryRevisions
    .all()
    .filter((item) => item.employeeId === employeeId && item.effectiveDate <= date)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0]
  if (revision) return revision.salary
  const employee = findEmployee(employeeId)
  return employee ? baseSalaryOf(employee) : 0
}

// --- dates ----------------------------------------------------------------------------------

/** `yyyy-MM-01` of a date. */
export const monthStartOf = (date: Date) => format(date, 'yyyy-MM-01')
export const thisMonthStart = () => monthStartOf(new Date())
export const lastMonthStart = () => monthStartOf(subMonths(new Date(), 1))
export const today = () => format(new Date(), 'yyyy-MM-dd')
export const stampDaysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 19)

let version = 1000
/** A fresh row version, as the API's hex timestamp. */
export const nextRowVersion = () => {
  version += 1
  return version.toString(16).padStart(16, '0')
}
