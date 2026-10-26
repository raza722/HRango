import { format, subDays, subYears } from 'date-fns'

import { toProfile } from '../attendance/seed'
import { findEmployee } from '../employees/seed'
import { profileOf } from '../scheduling/seed'
import { branches } from '../settings/handlers'

/*
 * People as the Assets and Off Boarding mocks show them, built from the shared mock
 * directory (codes and branches as the attendance / settings mocks give them).
 */

export interface MockPerson {
  id: string
  code: string
  name: string
  departmentName: string
  designationName: string
  branchId: string | null
  branchName: string | null
  locationId: string | null
  locationName: string | null
  companyName: string
  joiningDate: string | null
  photoUrl: string | null
  email: string
  phone: string
  dateOfBirth: string
}

/** A steady number per person, for the sample birthday and phone. */
function hashOf(id: string) {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 1_000_003
  return hash
}

export function personOf(id: string): MockPerson | undefined {
  const employee = findEmployee(id)
  if (!employee) return undefined
  const profile = toProfile(employee)
  const hash = hashOf(id)
  const [first = '', ...rest] = employee.name
    .replace(/^Dr\s+/, '')
    .toLowerCase()
    .split(/\s+/)
  const branch = employee.branchId ? branches.find(employee.branchId) : undefined
  return {
    id,
    code: profile.code,
    name: employee.name,
    departmentName: employee.department,
    designationName: employee.jobTitle,
    branchId: employee.branchId,
    branchName: profile.branch,
    locationId: branch?.locationId ?? null,
    locationName: profile.location,
    companyName: profile.company ?? 'TopEdge Technologies',
    joiningDate: profile.joiningDate || null,
    photoUrl: profile.photoUrl,
    email: `${[first, ...rest].join('.')}@topedge.tech`,
    phone: `03${String(hash % 10)}${String((hash >> 3) % 10)}-${String(1_000_000 + (hash % 9_000_000)).slice(0, 7)}`,
    dateOfBirth: format(subDays(subYears(new Date(), 24 + (hash % 28)), hash % 330), 'yyyy-MM-dd'),
  }
}

/** Still working here (the scheduling profile's status). */
export const isActive = (id: string) => {
  const employee = findEmployee(id)
  return employee ? profileOf(employee).status === 'active' : false
}

const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Whether a department / designation id from `GET /organisation/lookups/{kind}` names this
 * unit. The mocks of that route build ids from the name (`dep_human-resource-management`),
 * so the id is compared with the name, ignoring its prefix and punctuation.
 */
export const sameUnit = (id: string, name: string | null) =>
  name !== null && (id === name || squash(id.replace(/^[a-z]{2,4}_/, '')) === squash(name))
