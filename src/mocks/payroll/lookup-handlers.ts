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

function organisation(kind: string): LookupItem[] {
  switch (kind) {
    case 'branches':
      return branches.all().map((branch) => ({ id: branch.id, name: branch.name }))
    case 'locations':
      return locations.all().map((location) => ({ id: location.id, name: location.name }))
    case 'designations':
    case 'job-titles':
      return jobTitles.all().map((title) => ({ id: title.id, name: title.name }))
    case 'departments':
      return [...new Set(DIRECTORY.map((employee) => employee.department))]
        .sort()
        .map((name) => ({ id: `dep_${slug(name)}`, name }))
    default:
      return []
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
    const rows = DIRECTORY.map(lookupRow).filter((row) => inactive || row.status === 'active')
    return HttpResponse.json(lookupPage(rows, url))
  }),

  http.get(apiPath('/organisation/lookups/:kind'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    return HttpResponse.json<ApiItem<LookupItem[]>>({ data: organisation(String(params.kind)) })
  }),

  http.get(apiPath('/scheduling/options/time-slots'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    return HttpResponse.json<ApiItem<TimeSlotOption[]>>({ data: timeSlotOptions() })
  }),
]
