import type { AudienceCriteria, Holiday, HolidayRule } from '@/features/attendance'

import { type DirectoryEmployee, findEmployee } from '../employees/seed'
import { profileOf } from '../scheduling/seed'
import { branches } from '../settings/handlers'
import { joiningDate } from './seed'
import { nationalityOf, religionOf } from './settings-db'

/** Where a person sits in the organisation, for criteria and holiday rules. */
function placeOf(employee: DirectoryEmployee) {
  const branch = employee.branchId ? branches.find(employee.branchId) : undefined
  return {
    branchId: branch?.id ?? null,
    locationId: branch?.locationId ?? null,
    areaId: branch?.areaId ?? null,
    countryCode: branch?.countryCode ?? null,
    regionCode: branch?.regionCode ?? null,
    cityId: branch?.cityId ?? null,
  }
}

const within = (values: readonly string[], value: string | null) =>
  values.length === 0 || (value !== null && values.includes(value))

/** Does one criteria row take in this person? Empty fields match everyone. */
export function matchesCriteria(employee: DirectoryEmployee, criteria: AudienceCriteria): boolean {
  if (criteria.target === 'employees') return criteria.employeeIds.includes(employee.id)
  const place = placeOf(employee)
  const profile = profileOf(employee)
  const joined = joiningDate(employee)
  return (
    within(criteria.departments, employee.department) &&
    within(criteria.locations, place.locationId) &&
    within(criteria.designations, employee.jobTitle) &&
    within(criteria.grades, profile.grade) &&
    within(criteria.religions, religionOf(employee)) &&
    within(criteria.jobTitles, employee.jobTitle) &&
    within(criteria.nationalities, nationalityOf(employee)) &&
    within(criteria.areas, place.areaId) &&
    within(criteria.branches, place.branchId) &&
    (criteria.joiningFrom === null || joined >= criteria.joiningFrom) &&
    (criteria.joiningTo === null || joined <= criteria.joiningTo)
  )
}

/** A rule applies to everyone it names; any rule is enough. */
export function matchesAudience(
  employee: DirectoryEmployee,
  allEmployees: boolean,
  criteria: readonly AudienceCriteria[],
): boolean {
  return allEmployees || criteria.some((row) => matchesCriteria(employee, row))
}

function matchesRule(employee: DirectoryEmployee, rule: HolidayRule): boolean {
  const place = placeOf(employee)
  switch (rule.type) {
    case 'religion':
      return rule.religion === null || religionOf(employee) === rule.religion
    case 'geo-location':
      return (
        (rule.countryCode === null || rule.countryCode === place.countryCode) &&
        (rule.regionCode === null || rule.regionCode === place.regionCode) &&
        (rule.cityId === null || rule.cityId === place.cityId)
      )
    case 'organization':
      return (
        (rule.locationId === null || rule.locationId === place.locationId) &&
        (rule.branchId === null || rule.branchId === place.branchId)
      )
    case 'employee':
      return rule.employeeIds.includes(employee.id)
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
