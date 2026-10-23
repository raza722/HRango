import { format } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  ENROLLMENT_SORT_KEYS,
  ENROLLMENT_STATUSES,
  type EnrollmentCandidate,
  ROSTER_DAYS,
  type RosterEnrollment,
  type RosterEnrollmentRow,
  type RosterGroup,
  type RosterGroupRow,
} from '@/features/roster'
import type { ApiItem, Paginated } from '@/types/api'

import { createMockCollection } from '../collection'
import { DIRECTORY, findEmployee } from '../employees/seed'
import { branches, locations } from '../settings/handlers'
import {
  apiPath,
  createId,
  errorResponse,
  latency,
  paginate,
  readPageParams,
  requireAuth,
} from '../utils'
import { seedEnrollments, seedRosterGroups } from './seed'

export const rosterGroups = createMockCollection<RosterGroup>({
  storageKey: 'hrms-mock-roster-groups',
  seed: seedRosterGroups,
})
export const enrollments = createMockCollection<RosterEnrollment>({
  storageKey: 'hrms-mock-roster-enrollments',
  seed: seedEnrollments,
})

export function resetRosterDb(): void {
  rosterGroups.reset()
  enrollments.reset()
}

const GROUPS = apiPath('/roster-groups')

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable()
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const rosterGroupSchema = z
  .object({
    title: z.string().trim().min(1).max(60),
    isActive: z.boolean(),
    clockIn: time,
    clockOut: time,
    applyToAll: z.boolean(),
    days: z
      .array(
        z.object({
          day: z.enum(ROSTER_DAYS),
          isWeekend: z.boolean(),
          clockIn: time,
          clockOut: time,
        }),
      )
      .length(7),
  })
  .refine(
    (group) =>
      group.days.every((entry, index) => entry.day === ROSTER_DAYS[index]) &&
      group.days.some((entry) => !entry.isWeekend) &&
      group.days.every(
        (entry) =>
          entry.isWeekend ||
          (entry.clockIn !== null && entry.clockOut !== null && entry.clockIn !== entry.clockOut),
      ),
  )

const enrollSchema = z.object({
  employeeIds: z.array(z.string().min(1)).min(1).max(200),
  startDate: date,
  endDate: date.nullable(),
  branchId: z.string().min(1).nullable(),
})

const today = () => format(new Date(), 'yyyy-MM-dd')

const activeEnrollmentOf = (employeeId: string) =>
  enrollments.all().find((item) => item.employeeId === employeeId && item.status === 'active')

const enrolledCount = (groupId: string) =>
  enrollments.all().filter((item) => item.rosterGroupId === groupId && item.status === 'active')
    .length

const toGroupRow = (group: RosterGroup): RosterGroupRow => ({
  ...group,
  enrolledCount: enrolledCount(group.id),
})

function toEnrollmentRow(enrollment: RosterEnrollment): RosterEnrollmentRow {
  const employee = findEmployee(enrollment.employeeId)
  const branch = enrollment.branchId ? branches.find(enrollment.branchId) : undefined
  const location = branch ? locations.find(branch.locationId) : undefined
  return {
    ...enrollment,
    employeeName: employee?.name ?? 'Unknown employee',
    department: employee?.department ?? '',
    designation: employee?.jobTitle ?? '',
    branchName: branch?.name ?? null,
    locationName: location?.name ?? null,
  }
}

const notFound = () => errorResponse(404, 'The roster group was not found.', { code: 'NOT_FOUND' })

function duplicateTitle(title: string, existingId?: string): Response | null {
  const wanted = title.trim().toLowerCase()
  const clash = rosterGroups
    .all()
    .some((group) => group.id !== existingId && group.title.toLowerCase() === wanted)
  return clash
    ? errorResponse(409, 'A roster group with this title already exists.', {
        code: 'DUPLICATE_TITLE',
        fieldErrors: { title: 'Choose a different title' },
      })
    : null
}

async function readBody<T>(request: Request, schema: z.ZodType<T>) {
  const body: unknown = await request.json().catch(() => null)
  return schema.safeParse(body)
}

const invalid = () =>
  errorResponse(422, 'Some fields are not valid.', { code: 'VALIDATION_FAILED' })

export const rosterHandlers = [
  http.get(GROUPS, async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const { page, pageSize } = readPageParams(url)
    const search = (url.searchParams.get('search') ?? '').trim().toLowerCase()
    const rows = rosterGroups
      .all()
      .filter((group) => !search || group.title.toLowerCase().includes(search))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(toGroupRow)
    return HttpResponse.json<Paginated<RosterGroupRow>>(paginate(rows, page, pageSize))
  }),

  http.get<{ id: string }>(`${GROUPS}/:id`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const group = rosterGroups.find(params.id)
    return group ? HttpResponse.json<ApiItem<RosterGroup>>({ data: group }) : notFound()
  }),

  http.post(GROUPS, async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, rosterGroupSchema)
    if (!parsed.success) return invalid()
    const clash = duplicateTitle(parsed.data.title)
    if (clash) return clash
    const now = new Date().toISOString()
    const group: RosterGroup = {
      ...parsed.data,
      title: parsed.data.title.trim(),
      id: createId('rg'),
      createdAt: now,
      updatedAt: now,
    }
    rosterGroups.insert(group)
    return HttpResponse.json<ApiItem<RosterGroup>>({ data: group }, { status: 201 })
  }),

  http.put<{ id: string }>(`${GROUPS}/:id`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const existing = rosterGroups.find(params.id)
    if (!existing) return notFound()
    const parsed = await readBody(request, rosterGroupSchema)
    if (!parsed.success) return invalid()
    const clash = duplicateTitle(parsed.data.title, existing.id)
    if (clash) return clash
    const updated: RosterGroup = {
      ...existing,
      ...parsed.data,
      title: parsed.data.title.trim(),
      updatedAt: new Date().toISOString(),
    }
    rosterGroups.update(existing.id, updated)
    return HttpResponse.json<ApiItem<RosterGroup>>({ data: updated })
  }),

  http.patch<{ id: string }>(`${GROUPS}/:id/status`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const existing = rosterGroups.find(params.id)
    if (!existing) return notFound()
    const parsed = await readBody(request, z.object({ isActive: z.boolean() }))
    if (!parsed.success) return invalid()
    const updated = {
      ...existing,
      isActive: parsed.data.isActive,
      updatedAt: new Date().toISOString(),
    }
    rosterGroups.update(existing.id, updated)
    return HttpResponse.json<ApiItem<RosterGroupRow>>({ data: toGroupRow(updated) })
  }),

  http.delete<{ id: string }>(`${GROUPS}/:id`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const existing = rosterGroups.find(params.id)
    if (!existing) return notFound()
    const count = enrolledCount(existing.id)
    if (count > 0) {
      return errorResponse(
        409,
        `“${existing.title}” has ${count} enrolled employee${count === 1 ? '' : 's'}. Discontinue them first.`,
        { code: 'IN_USE' },
      )
    }
    rosterGroups.remove(existing.id)
    enrollments
      .all()
      .filter((item) => item.rosterGroupId === existing.id)
      .forEach((item) => enrollments.remove(item.id))
    return new HttpResponse(null, { status: 204 })
  }),

  http.get<{ id: string }>(`${GROUPS}/:id/enrollments`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    if (!rosterGroups.find(params.id)) return notFound()

    const url = new URL(request.url)
    const { page, pageSize } = readPageParams(url)
    const status = z.enum(ENROLLMENT_STATUSES).catch('active').parse(url.searchParams.get('status'))
    const sort = z
      .enum(ENROLLMENT_SORT_KEYS)
      .nullable()
      .catch(null)
      .parse(url.searchParams.get('sort'))
    const direction = url.searchParams.get('order') === 'desc' ? -1 : 1
    const search = (url.searchParams.get('search') ?? '').trim().toLowerCase()

    const rows = enrollments
      .all()
      .filter((item) => item.rosterGroupId === params.id && item.status === status)
      .map(toEnrollmentRow)
      .filter(
        (row) =>
          !search ||
          [row.employeeName, row.department, row.designation].some((text) =>
            text.toLowerCase().includes(search),
          ),
      )
      .sort((a, b) => {
        if (!sort) return a.createdAt.localeCompare(b.createdAt)
        // Open-ended (empty) values always go last.
        const left = a[sort] ?? ''
        const right = b[sort] ?? ''
        if (left === right) return a.employeeName.localeCompare(b.employeeName)
        if (left === '') return 1
        if (right === '') return -1
        return left.localeCompare(right) * direction
      })
    return HttpResponse.json<Paginated<RosterEnrollmentRow>>(paginate(rows, page, pageSize))
  }),

  http.get<{ id: string }>(`${GROUPS}/:id/candidates`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    if (!rosterGroups.find(params.id)) return notFound()
    const search = (new URL(request.url).searchParams.get('search') ?? '').trim().toLowerCase()
    const candidates = DIRECTORY.filter(
      (employee) =>
        !search ||
        [employee.name, employee.department, employee.jobTitle].some((text) =>
          text.toLowerCase().includes(search),
        ),
    )
      .map((employee): EnrollmentCandidate => {
        const current = activeEnrollmentOf(employee.id)
        const roster = current ? rosterGroups.find(current.rosterGroupId) : undefined
        return {
          id: employee.id,
          name: employee.name,
          department: employee.department,
          designation: employee.jobTitle,
          currentRoster: roster ? { id: roster.id, title: roster.title } : null,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
    return HttpResponse.json<ApiItem<EnrollmentCandidate[]>>({ data: candidates })
  }),

  http.post<{ id: string }>(`${GROUPS}/:id/enrollments`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const group = rosterGroups.find(params.id)
    if (!group) return notFound()
    const parsed = await readBody(request, enrollSchema)
    if (!parsed.success) return invalid()
    const input = parsed.data

    if (input.endDate !== null && input.endDate < input.startDate) {
      return errorResponse(422, 'The end date is before the start date.', {
        code: 'INVALID_RANGE',
        fieldErrors: { endDate: 'Pick a date on or after the start date' },
      })
    }
    if (input.branchId && !branches.find(input.branchId)) {
      return errorResponse(422, 'Select a branch.', {
        fieldErrors: { branchId: 'Select a branch' },
      })
    }
    const unknown = input.employeeIds.filter((id) => !findEmployee(id))
    if (unknown.length > 0) return invalid()
    const busy = input.employeeIds
      .map((id) => ({ employee: findEmployee(id), current: activeEnrollmentOf(id) }))
      .filter((entry) => entry.current !== undefined)
    if (busy.length > 0) {
      const names = busy.map((entry) => entry.employee?.name ?? '').join(', ')
      return errorResponse(409, `Already on a roster: ${names}. Discontinue them there first.`, {
        code: 'ALREADY_ENROLLED',
        fieldErrors: { employeeIds: `Already on a roster: ${names}` },
      })
    }

    const now = new Date().toISOString()
    const created = [...new Set(input.employeeIds)].map((employeeId) =>
      enrollments.insert({
        id: createId('re'),
        rosterGroupId: group.id,
        employeeId,
        startDate: input.startDate,
        endDate: input.endDate,
        branchId: input.branchId,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }),
    )
    return HttpResponse.json<ApiItem<RosterEnrollmentRow[]>>(
      { data: created.map(toEnrollmentRow) },
      { status: 201 },
    )
  }),

  http.post<{ id: string }>(
    apiPath('/roster-enrollments/:id/discontinue'),
    async ({ request, params }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized
      const existing = enrollments.find(params.id)
      if (!existing) {
        return errorResponse(404, 'The enrollment was not found.', { code: 'NOT_FOUND' })
      }
      if (existing.status === 'discontinued') {
        return errorResponse(409, 'This enrollment has already ended.', { code: 'ALREADY_ENDED' })
      }
      const ended = today()
      // A future enrollment that is called off ends on the day it would have started.
      const endDate = ended < existing.startDate ? existing.startDate : ended
      const updated: RosterEnrollment = {
        ...existing,
        status: 'discontinued',
        endDate:
          existing.endDate !== null && existing.endDate < endDate ? existing.endDate : endDate,
        updatedAt: new Date().toISOString(),
      }
      enrollments.update(existing.id, updated)
      return HttpResponse.json<ApiItem<RosterEnrollmentRow>>({ data: toEnrollmentRow(updated) })
    },
  ),
]
