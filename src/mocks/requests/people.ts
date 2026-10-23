import type { RequestEmployee } from '@/features/requests'

import { personRef } from '../attendance/db'
import { toProfile } from '../attendance/seed'
import { type DirectoryEmployee, findEmployee } from '../employees/seed'
import { CURRENT_EMPLOYEE_ID, profileOf } from '../scheduling/seed'
import { activeDelegatorsOf } from './settings-db'

export const ME = CURRENT_EMPLOYEE_ID

/** Who leads each department when the person has no direct manager on file. */
const DEPARTMENT_HEADS: Record<string, string> = {
  Software: 'em_bilal',
  'Mobile App': 'em_bilal',
  Operations: 'em_ayesha',
  Sales: 'em_daniel',
  Marketing: 'em_jack',
  Finance: 'em_hina',
  'Human Resource Management': 'em_shelley',
  Physiotherapy: 'em_hamda',
  Surgery: 'em_kamal',
}

/** The country manager approves for department heads and for HR itself. */
export const TOP_MANAGER = 'em_daniel'
/** The second HR manager approves the HR manager's own requests. */
const DEPUTY_HR = 'em_kaleem'

/**
 * Whose approvals the person takes over while those people are away
 * (Requests → Settings → Delegation; seeded with Bilal Ahmed's going to the
 * signed-in HR manager). Pass a request type to count only delegations of it.
 */
export function delegatorsOf(personId: string, type?: string): string[] {
  return activeDelegatorsOf(personId, type)
}

/** The head of the person's department; above a head, the country manager. */
export function departmentHeadOf(employee: DirectoryEmployee): string {
  const head = DEPARTMENT_HEADS[employee.department]
  if (head && head !== employee.id) return head
  return employee.id === TOP_MANAGER ? ME : TOP_MANAGER
}

/** Head of a named department ("Finance"), for the flow's HOD Finance / HOD Admin nodes. */
export function headOfDepartment(department: string): string {
  return DEPARTMENT_HEADS[department] ?? TOP_MANAGER
}

export function lineManagerOf(employee: DirectoryEmployee): string {
  const manager = profileOf(employee).managerId
  if (manager) return manager
  return departmentHeadOf(employee)
}

/** The final authority: the HR manager, or their deputy for the HR manager's own requests. */
export function hrManagerFor(employee: DirectoryEmployee): string {
  return employee.id === ME ? DEPUTY_HR : ME
}

export function requestEmployee(employee: DirectoryEmployee): RequestEmployee {
  const profile = toProfile(employee)
  return {
    id: profile.id,
    name: profile.name,
    code: profile.code,
    department: profile.department,
    designation: profile.designation,
    company: profile.company,
    branch: profile.branch,
    location: profile.location,
    joiningDate: profile.joiningDate,
    photoUrl: profile.photoUrl,
  }
}

export function ref(id: string) {
  return personRef(id)
}

export function mustFind(id: string): DirectoryEmployee {
  const employee = findEmployee(id)
  if (!employee) throw new Error(`Unknown employee ${id}`)
  return employee
}
