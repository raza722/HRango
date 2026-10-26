import type { AudienceTarget, Holiday, HolidayRule, TargetType } from '@/features/attendance'

import { type DirectoryEmployee, findEmployee } from '../employees/seed'
import { profileOf } from '../scheduling/seed'
import { branches } from '../settings/handlers'
import { joiningDate } from './seed'
import { nationalityOf, religionOf } from './settings-db'

/** Where a person sits in the organisation, for targets and holiday rules. */
function placeOf(employee: DirectoryEmployee) {
  const branch = employee.branchId ? branches.find(employee.branchId) : undefined
  return {
    branchId: branch?.id ?? null,
    locationId: branch?.locationId ?? null,
    areaId: branch?.areaId ?? null,
    countryId: branch?.countryId ?? null,
    stateId: branch?.stateId ?? null,
    cityId: branch?.cityId ?? null,
  }
}

/** What a person is for one kind of target (ids, or names for religion and nationality). */
function valueOf(employee: DirectoryEmployee, type: TargetType): string | null {
  const place = placeOf(employee)
  switch (type) {
    case 'employee':
      return employee.id
    case 'country':
      return place.countryId
    case 'location':
      return place.locationId
    case 'branch':
      return place.branchId
    case 'area':
      return place.areaId
    case 'department':
      return employee.department
    case 'designation':
    case 'job_title':
      return employee.jobTitle
    case 'grade':
      return profileOf(employee).grade
    case 'religion':
      return religionOf(employee)
    case 'nationality':
      return nationalityOf(employee)
  }
}

/**
 * Does a fence or restriction take in this person? As the API decides: targets of the same
 * kind are alternatives, different kinds must all match; the joining window narrows it.
 */
export function matchesTargets(
  employee: DirectoryEmployee,
  appliesToAll: boolean,
  targets: readonly AudienceTarget[],
  joining: { from: string | null; to: string | null } = { from: null, to: null },
): boolean {
  if (appliesToAll) return true
  const joined = joiningDate(employee)
  if (joining.from && joined < joining.from) return false
  if (joining.to && joined > joining.to) return false
  const kinds = new Set(targets.map((target) => target.targetType))
  return [...kinds].every((kind) => {
    const value = valueOf(employee, kind)
    return targets.some(
      (target) => target.targetType === kind && (target.targetId ?? target.targetValue) === value,
    )
  })
}

function matchesRule(employee: DirectoryEmployee, rule: HolidayRule): boolean {
  const place = placeOf(employee)
  switch (rule.ruleType) {
    case 'religion':
      return rule.religion === null || religionOf(employee) === rule.religion
    case 'geo_location':
      return (
        (rule.countryId === null || rule.countryId === place.countryId) &&
        (rule.stateId === null || rule.stateId === place.stateId) &&
        (rule.cityId === null || rule.cityId === place.cityId)
      )
    case 'org_structure':
      return (
        (rule.locationId === null || rule.locationId === place.locationId) &&
        (rule.branchId === null || rule.branchId === place.branchId)
      )
    case 'employee':
      return rule.employeeId === employee.id
  }
}

/**
 * The attendance-exempt holiday a person has on a date, if any. A holiday
 * without rules is for everyone; with rules, for anyone a rule takes in.
 */
export function holidayFor(
  list: readonly Holiday[],
  employeeId: string,
  date: string,
): Holiday | null {
  const employee = findEmployee(employeeId)
  return (
    list.find(
      (holiday) =>
        holiday.attendanceExempt &&
        holiday.startDate <= date &&
        holiday.endDate >= date &&
        (holiday.rules.length === 0 ||
          (employee !== undefined && holiday.rules.some((rule) => matchesRule(employee, rule)))),
    ) ?? null
  )
}
