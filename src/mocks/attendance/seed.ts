import avatarUrl from '@/assets/images/avatar-shelley-kannes.png'

import { type DirectoryEmployee } from '../employees/seed'
import { CURRENT_EMPLOYEE_ID, profileOf } from '../scheduling/seed'
import { branches, locations } from '../settings/handlers'
import { COMPANIES } from '../settings/seed'
import type { AttendanceEmployee, AttendanceProfile } from './types'

export function toAttendanceEmployee(employee: DirectoryEmployee): AttendanceEmployee {
  const profile = profileOf(employee)
  return {
    id: employee.id,
    code: profile.code,
    name: employee.name,
    department: employee.department,
    designation: employee.jobTitle,
    status: profile.status,
  }
}

/** A stable joining date per person, between 2018 and 2025. */
export function joiningDate(employee: DirectoryEmployee): string {
  let hash = 0
  for (let index = 0; index < employee.id.length; index += 1) {
    hash = (hash * 31 + employee.id.charCodeAt(index)) % 100_000
  }
  const year = 2018 + (hash % 8)
  const month = (hash % 12) + 1
  const day = (hash % 27) + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function toProfile(employee: DirectoryEmployee): AttendanceProfile {
  const branch = employee.branchId ? branches.find(employee.branchId) : undefined
  const location = branch ? locations.find(branch.locationId) : undefined
  return {
    ...toAttendanceEmployee(employee),
    branch: branch?.name ?? null,
    location: location?.name ?? null,
    company: COMPANIES.find((company) => company.id === branch?.companyId)?.name ?? null,
    joiningDate: joiningDate(employee),
    photoUrl: employee.id === CURRENT_EMPLOYEE_ID ? avatarUrl : null,
  }
}
