import { format } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  ENROLLMENT_STATUSES,
  ROSTER_DAYS,
  type RosterEnrollment,
  type RosterGroupDay,
  type RosterGroupDetail,
} from '@/features/roster'
import type { ApiItem, Paginated } from '@/types/api'

import { createMockCollection } from '../collection'
import { findEmployee } from '../employees/seed'
import { profileOf } from '../scheduling/seed'
import {
  apiTime,
  isOvernightSlot,
  spanOf,
  timeSlots,
  workableMinutesOf,
} from '../scheduling/time-slots'
import { branches } from '../settings/handlers'
import {
  apiPath,
  createId,
  errorResponse,
  latency,
  paginate,
  readPageParams,
  requireAuth,
} from '../utils'
import {
  type MockEnrollment,
  type MockRosterDay,
  type MockRosterGroup,
  seedEnrollments,
  seedRosterGroups,
} from './seed'

/*
 * `/api/roster/...` as the backend serves it (`backend/app/routers/roster.py`). The records
 * keep the old shape the other modules' mocks read; the handlers answer in the API's shape.
 */

export const rosterGroups = createMockCollection<MockRosterGroup>({
  storageKey: 'hrms-mock-roster-groups-v2',
  seed: seedRosterGroups,
})
export const enrollments = createMockCollection<MockEnrollment>({
  storageKey: 'hrms-mock-roster-enrollments-v2',
  seed: seedEnrollments,
})

export function resetRosterDb(): void {
  rosterGroups.reset()
  enrollments.reset()
}

const GROUPS = apiPath('/roster/groups')
const ENROLMENTS = apiPath('/roster/enrolments')

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const id = z.union([z.string().min(1), z.number().int()]).transform(String)

const rosterGroupSchema = z.object({
  title: z.string().trim().min(1).max(200),
  fromDate: date,
  toDate: date.nullish(),
  description: z.string().nullish(),
  isActive: z.boolean().default(true),
  days: z
    .array(
      z.object({
        weekday: z.number().int().min(1).max(7),
        isDayOff: z.boolean().default(false),
        timeSlotId: id.nullish(),
      }),
    )
    .min(1)
    .max(7),
  rowVersion: z.string().nullish(),
})

const enrolSchema = z.object({
  employeeIds: z.array(id).min(1).max(1000),
  startDate: date,
  endDate: date.nullish(),
})

const enrolmentEditSchema = z.object({
  startDate: date,
  endDate: date.nullish(),
  rowVersion: z.string().nullish(),
})

const discontinueSchema = z.object({
  endDate: date.nullish(),
  rowVersion: z.string().nullish(),
})

const today = () => format(new Date(), 'yyyy-MM-dd')
/** A stand-in for SQL Server's rowversion: changes whenever the record is saved. */
const rowVersionOf = (updatedAt: string) => Date.parse(updatedAt).toString(16).padStart(16, '0')

async function readBody<T>(request: Request, schema: z.ZodType<T>) {
  const body: unknown = await request.json().catch(() => null)
  return schema.safeParse(body)
}

function invalid(error: z.ZodError) {
  const fieldErrors = Object.fromEntries(
    error.issues.map((issue) => [String(issue.path[0] ?? 'body'), issue.message]),
  )
  return errorResponse(422, 'Some fields are not valid.', {
    code: 'VALIDATION_FAILED',
    fieldErrors,
  })
}

const fieldError = (status: number, code: string, field: string, message: string) =>
  errorResponse(status, message, { code, fieldErrors: { [field]: message } })

const notFound = (what = 'roster group') =>
  errorResponse(404, `The ${what} was not found.`, { code: 'NOT_FOUND' })

const isCurrent = (item: MockEnrollment) => item.status === 'active'

const enrolledCount = (groupId: string) =>
  enrollments.all().filter((item) => item.rosterGroupId === groupId && isCurrent(item)).length

function toDayOut(day: MockRosterDay, weekday: number): RosterGroupDay {
  const slot = day.timeSlotId ? timeSlots.find(day.timeSlotId) : undefined
  if (day.isWeekend || !slot) {
    return {
      weekday,
      isDayOff: true,
      timeSlotId: null,
      timeSlotCode: null,
      timeSlotName: null,
      startTime: null,
      endTime: null,
      isOvernight: null,
      durationMinutes: null,
      workableMinutes: null,
    }
  }
  return {
    weekday,
    isDayOff: false,
    timeSlotId: slot.id,
    timeSlotCode: slot.code,
    timeSlotName: slot.name,
    startTime: apiTime(slot.startTime),
    endTime: apiTime(slot.endTime),
    isOvernight: isOvernightSlot(slot),
    durationMinutes: spanOf(slot.startTime, slot.endTime),
    workableMinutes: workableMinutesOf(slot),
  }
}

function toGroupOut(group: MockRosterGroup, withDays: boolean): RosterGroupDetail {
  return {
    id: group.id,
    title: group.title,
    fromDate: group.fromDate,
    toDate: group.toDate,
    description: group.description,
    isActive: group.isActive,
    enrolledCount: enrolledCount(group.id),
    workingDays: withDays ? null : group.days.filter((day) => !day.isWeekend).length,
    days: withDays ? group.days.map((day, index) => toDayOut(day, index + 1)) : [],
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    rowVersion: rowVersionOf(group.updatedAt),
  }
}

function toEnrolmentOut(item: MockEnrollment): RosterEnrollment {
  const employee = findEmployee(item.employeeId)
  const group = rosterGroups.find(item.rosterGroupId)
  const branch = employee?.branchId ? branches.find(employee.branchId) : undefined
  return {
    id: item.id,
    rosterGroupId: item.rosterGroupId,
    rosterGroupTitle: group?.title ?? '',
    employeeId: item.employeeId,
    employeeCode: employee ? profileOf(employee).code : item.employeeId,
    employeeName: employee?.name ?? 'Unknown employee',
    departmentName: employee?.department ?? null,
    designationName: employee?.jobTitle ?? null,
    branchName: branch?.name ?? null,
    startDate: item.startDate,
    endDate: item.endDate,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    rowVersion: rowVersionOf(item.updatedAt),
  }
}

/** Turns the API's week into the mock record's days (slot ids plus their clock times). */
function toMockDays(input: z.infer<typeof rosterGroupSchema>['days']): MockRosterDay[] | string {
  const byWeekday = new Map(input.map((day) => [day.weekday, day]))
  const days: MockRosterDay[] = []
  for (const [index, name] of ROSTER_DAYS.entries()) {
    const day = byWeekday.get(index + 1)
    if (!day || day.isDayOff) {
      days.push({ day: name, isWeekend: true, clockIn: null, clockOut: null, timeSlotId: null })
      continue
    }
    const slot = day.timeSlotId ? timeSlots.find(day.timeSlotId) : undefined
    if (!slot) return `days.${index}.timeSlotId`
    days.push({
      day: name,
      isWeekend: false,
      clockIn: slot.startTime,
      clockOut: slot.endTime,
      timeSlotId: slot.id,
    })
  }
  return days
}

function duplicateTitle(title: string, existingId?: string): Response | null {
  const wanted = title.trim().toLowerCase()
  const clash = rosterGroups
    .all()
    .some((group) => group.id !== existingId && group.title.toLowerCase() === wanted)
  return clash
    ? fieldError(
        409,
        'ROSTER_GROUP_DUPLICATE',
        'title',
        'A roster group with this title already exists.',
      )
    : null
}

/** Two periods overlap (`null` end = open-ended). */
const overlaps = (aStart: string, aEnd: string | null, bStart: string, bEnd: string | null) =>
  aStart <= (bEnd ?? '9999-12-31') && bStart <= (aEnd ?? '9999-12-31')

function saveGroup(
  input: z.infer<typeof rosterGroupSchema>,
  existing: MockRosterGroup | undefined,
): MockRosterGroup | Response {
  const clash = duplicateTitle(input.title, existing?.id)
  if (clash) return clash
  if (input.toDate && input.toDate < input.fromDate) {
    return fieldError(422, 'VALIDATION_FAILED', 'toDate', 'The end date is before the start date.')
  }
  const days = toMockDays(input.days)
  if (typeof days === 'string') {
    return fieldError(422, 'VALIDATION_FAILED', 'days', 'Pick a time slot for every working day.')
  }
  if (days.every((day) => day.isWeekend)) {
    return fieldError(422, 'VALIDATION_FAILED', 'days', 'Keep at least one working day.')
  }
  if (existing && input.rowVersion && input.rowVersion !== rowVersionOf(existing.updatedAt)) {
    return errorResponse(409, 'Someone else changed this roster group. Reload it.', {
      code: 'CONCURRENCY',
    })
  }
  const now = new Date().toISOString()
  // The old default pair follows the first working day, for the other mocks.
  const first = days.find((day) => !day.isWeekend)
  return {
    id: existing?.id ?? createId('rg'),
    title: input.title.trim(),
    isActive: input.isActive,
    clockIn: first?.clockIn ?? null,
    clockOut: first?.clockOut ?? null,
    applyToAll:
      new Set(days.filter((day) => !day.isWeekend).map((day) => day.timeSlotId)).size === 1,
    fromDate: input.fromDate,
    toDate: input.toDate ?? null,
    description: input.description?.trim() ? input.description.trim() : null,
    days,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
}

export const rosterHandlers = [
  http.get(GROUPS, async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const { page, pageSize } = readPageParams(url)
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const active = url.searchParams.get('isActive')
    const items = rosterGroups
      .all()
      .filter((group) => !q || group.title.toLowerCase().includes(q))
      .filter((group) => active === null || String(group.isActive) === active)
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((group) => toGroupOut(group, false))
    return HttpResponse.json<Paginated<RosterGroupDetail>>(paginate(items, page, pageSize))
  }),

  http.get<{ id: string }>(`${GROUPS}/:id`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const group = rosterGroups.find(params.id)
    if (!group) return notFound()
    return HttpResponse.json<ApiItem<RosterGroupDetail>>({ data: toGroupOut(group, true) })
  }),

  http.post(GROUPS, async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, rosterGroupSchema)
    if (!parsed.success) return invalid(parsed.error)
    const saved = saveGroup(parsed.data, undefined)
    if (saved instanceof Response) return saved
    rosterGroups.insert(saved)
    return HttpResponse.json<ApiItem<RosterGroupDetail>>(
      { data: toGroupOut(saved, true) },
      { status: 201 },
    )
  }),

  http.put<{ id: string }>(`${GROUPS}/:id`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const existing = rosterGroups.find(params.id)
    if (!existing) return notFound()
    const parsed = await readBody(request, rosterGroupSchema)
    if (!parsed.success) return invalid(parsed.error)
    const saved = saveGroup(parsed.data, existing)
    if (saved instanceof Response) return saved
    rosterGroups.update(existing.id, saved)
    return HttpResponse.json<ApiItem<RosterGroupDetail>>({ data: toGroupOut(saved, true) })
  }),

  http.delete<{ id: string }>(`${GROUPS}/:id`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const group = rosterGroups.find(params.id)
    if (!group) return notFound()
    if (enrollments.all().some((item) => item.rosterGroupId === group.id)) {
      return errorResponse(409, 'Employees are enrolled in this roster group. Remove them first', {
        code: 'CONFLICT',
      })
    }
    rosterGroups.remove(group.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get<{ id: string }>(`${GROUPS}/:id/enrolments`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    if (!rosterGroups.find(params.id)) return notFound()
    const url = new URL(request.url)
    const { page, pageSize } = readPageParams(url)
    const status = ENROLLMENT_STATUSES.find((value) => value === url.searchParams.get('status'))
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const rows = enrollments
      .all()
      .filter((item) => item.rosterGroupId === params.id && (!status || item.status === status))
      .map(toEnrolmentOut)
      .filter(
        (row) =>
          !q ||
          row.employeeName.toLowerCase().includes(q) ||
          row.employeeCode.toLowerCase().includes(q),
      )
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
    return HttpResponse.json<Paginated<RosterEnrollment>>(paginate(rows, page, pageSize))
  }),

  http.post<{ id: string }>(`${GROUPS}/:id/enrolments`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const group = rosterGroups.find(params.id)
    if (!group) return notFound()
    const parsed = await readBody(request, enrolSchema)
    if (!parsed.success) return invalid(parsed.error)
    const { employeeIds, startDate } = parsed.data
    const endDate = parsed.data.endDate ?? group.toDate
    if (startDate < group.fromDate || (group.toDate && startDate > group.toDate)) {
      return fieldError(
        422,
        'VALIDATION_FAILED',
        'startDate',
        "The start date is outside the roster group's period.",
      )
    }
    if (endDate && endDate < startDate) {
      return fieldError(
        422,
        'VALIDATION_FAILED',
        'endDate',
        'The end date is before the start date.',
      )
    }
    const clash = employeeIds.some((employeeId) =>
      enrollments
        .all()
        .some(
          (item) =>
            item.employeeId === employeeId &&
            isCurrent(item) &&
            overlaps(item.startDate, item.endDate, startDate, endDate),
        ),
    )
    if (clash) {
      return fieldError(
        409,
        'ENROLMENT_OVERLAP',
        'employeeIds',
        'One or more employees are already on a roster for these dates.',
      )
    }
    const now = new Date().toISOString()
    const created = employeeIds.map((employeeId) =>
      enrollments.insert({
        id: createId('re'),
        rosterGroupId: group.id,
        employeeId,
        startDate,
        endDate,
        branchId: findEmployee(employeeId)?.branchId ?? null,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }),
    )
    return HttpResponse.json<{ data: RosterEnrollment[] }>(
      { data: created.map(toEnrolmentOut) },
      { status: 201 },
    )
  }),

  http.get<{ id: string }>(`${ENROLMENTS}/:id`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const item = enrollments.find(params.id)
    if (!item) return notFound('enrolment')
    return HttpResponse.json<ApiItem<RosterEnrollment>>({ data: toEnrolmentOut(item) })
  }),

  http.put<{ id: string }>(`${ENROLMENTS}/:id`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const item = enrollments.find(params.id)
    if (!item) return notFound('enrolment')
    const parsed = await readBody(request, enrolmentEditSchema)
    if (!parsed.success) return invalid(parsed.error)
    const next: MockEnrollment = {
      ...item,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate ?? null,
      updatedAt: new Date().toISOString(),
    }
    enrollments.update(item.id, next)
    return HttpResponse.json<ApiItem<RosterEnrollment>>({ data: toEnrolmentOut(next) })
  }),

  http.patch<{ id: string }>(`${ENROLMENTS}/:id/discontinue`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const item = enrollments.find(params.id)
    if (!item) return notFound('enrolment')
    const parsed = await readBody(request, discontinueSchema)
    if (!parsed.success) return invalid(parsed.error)
    const next: MockEnrollment = {
      ...item,
      endDate: parsed.data.endDate ?? today(),
      status: 'discontinued',
      updatedAt: new Date().toISOString(),
    }
    enrollments.update(item.id, next)
    return HttpResponse.json<ApiItem<RosterEnrollment>>({ data: toEnrolmentOut(next) })
  }),

  http.delete<{ id: string }>(`${ENROLMENTS}/:id`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    if (!enrollments.remove(params.id)) return notFound('enrolment')
    return new HttpResponse(null, { status: 204 })
  }),
]
