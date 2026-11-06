import { http, HttpResponse } from 'msw'

import type { LookupItem, TimeSlotOption } from '@/features/payroll'
import type { ApiItem } from '@/types/api'

import { lookupPage } from '../employees/lookup'
import { DIRECTORY } from '../employees/seed'
import { rosterGroups } from '../roster/handlers'
import { branches, jobTitles, locations } from '../settings/handlers'
import { apiPath, latency, requireAuth } from '../utils'
import { lookupRow } from './people'

// The pickers payroll screens read from other modules, as the API serves them:
// GET /employees/lookup, /organisation/lookups/{kind}, /scheduling/options/time-slots.
// (Leave types come from the Leaves mock's GET /leaves/types.)

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-')

/**
 * Sub-departments: departments with a parent (Manpower Planning's plans and positions use them).
 * The API lists them with the other departments, each with its `parentId`.
 */
const SUB_DEPARTMENTS: readonly { id: string; name: string; department: string }[] = [
  { id: 'sd_accounts', name: 'Accounts', department: 'Finance' },
  { id: 'sd_audit', name: 'Audit', department: 'Finance' },
  { id: 'sd_design', name: 'Design', department: 'Mobile App' },
  { id: 'sd_digital', name: 'Digital', department: 'Marketing' },
  { id: 'sd_brand', name: 'Brand', department: 'Marketing' },
]

/**
 * `GET /organisation/lookups/departments`: the directory's departments, then the sub-departments
 * (`parentId` set); `parentId` narrows it to one department's sub-departments, as the API does.
 */
export function organisationDepartments(parentId: string | null = null): LookupItem[] {
  const departments = [...new Set(DIRECTORY.map((employee) => employee.department))]
    .sort()
    .map((name): LookupItem => ({ id: `dep_${slug(name)}`, name, parentId: null }))
  const subDepartments = SUB_DEPARTMENTS.map((item): LookupItem => ({
    id: item.id,
    name: item.name,
    parentId: `dep_${slug(item.department)}`,
  }))
  return parentId
    ? subDepartments.filter((item) => item.parentId === parentId)
    : [...departments, ...subDepartments]
}

/** The lists this mock owns; other kinds (grades, job levels…) pass on to the mocks after it. */
function organisation(kind: string, parentId: string | null = null): LookupItem[] | null {
  switch (kind) {
    case 'branches':
      // `?parentId=` is a location: only its branches (Requests → Transfer narrows by it).
      return branches
        .all()
        .filter((branch) => !parentId || branch.locationId === parentId)
        .map((branch) => ({ id: branch.id, name: branch.name, parentId: branch.locationId }))
    case 'locations':
      return locations.all().map((location) => ({ id: location.id, name: location.name }))
    case 'designations':
    case 'job-titles':
      return jobTitles.all().map((title) => ({ id: title.id, name: title.name }))
    case 'departments':
      return organisationDepartments(parentId)
    default:
      return null
  }
}

/** First "HH:mm" of a roster group's working days. */
function timeSlotOptions(): TimeSlotOption[] {
  return rosterGroups
    .all()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((group, index) => {
      const first = group.days.find((day) => !day.isWeekend && day.clockIn && day.clockOut)
      return {
        id: group.id,
        code: `TS-${String(index + 1).padStart(4, '0')}`,
        name: group.title,
        startTime: `${group.clockIn ?? first?.clockIn ?? '09:00'}:00`,
        endTime: `${group.clockOut ?? first?.clockOut ?? '17:00'}:00`,
        isOvernight: false,
        isFlexible: false,
      }
    })
}

/** The department id the lookup above gives a department name. */
export const departmentId = (name: string) => `dep_${slug(name)}`

export const payrollLookupHandlers = [
  http.get(apiPath('/employees/lookup'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const inactive = url.searchParams.get('includeInactive') === 'true'
    // `?departmentId=` and `?branchId=` narrow it, as the API's do (Manpower imports a department).
    const departmentId = url.searchParams.get('departmentId')
    const branchId = url.searchParams.get('branchId')
    const rows = DIRECTORY.map(lookupRow).filter(
      (row) =>
        (inactive || row.status === 'active') &&
        (!departmentId || row.departmentId === departmentId) &&
        (!branchId || row.branchId === branchId),
    )
    return HttpResponse.json(lookupPage(rows, url))
  }),

  http.get(apiPath('/organisation/lookups/:kind'), async ({ request, params }) => {
    const rows = organisation(
      String(params.kind),
      new URL(request.url).searchParams.get('parentId'),
    )
    if (!rows) return undefined
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    return HttpResponse.json<ApiItem<LookupItem[]>>({ data: rows })
  }),

  http.get(apiPath('/scheduling/options/time-slots'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    return HttpResponse.json<ApiItem<TimeSlotOption[]>>({ data: timeSlotOptions() })
  }),
]
