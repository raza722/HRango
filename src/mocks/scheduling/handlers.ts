import { format } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import type { RosterGroup } from '@/features/roster'
import {
  type ActiveShift,
  type BatchResult,
  type BoardPage,
  type BoardRow,
  BREAK_TYPES,
  eachDay,
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPES,
  GENDERS,
  type GeoFence,
  type PickableEmployee,
  plannedMinutes,
  repeatDates,
  scheduleDates,
  type ScheduleEntry,
  type SchedulingLookups,
  type TimeSlotRules,
  weekdayOf,
  WEEKDAYS,
} from '@/features/scheduling'
import type { ApiItem } from '@/types/api'

import { geoFenceSettings } from '../attendance/settings-db'
import { createMockCollection } from '../collection'
import { DIRECTORY, type DirectoryEmployee, findEmployee } from '../employees/seed'
import { rosterGroups } from '../roster/handlers'
import { branches } from '../settings/handlers'
import { apiPath, createId, errorResponse, latency, readPageParams, requireAuth } from '../utils'
import {
  CURRENT_EMPLOYEE_ID,
  profileOf,
  type RestDayBatchRecord,
  seedEntries,
  seedGeoFences,
  seedRestDayBatches,
  slotFor,
} from './seed'

export const scheduleEntries = createMockCollection<ScheduleEntry>({
  storageKey: 'hrms-mock-schedule-entries',
  seed: seedEntries,
})
export const geoFences = createMockCollection<GeoFence>({
  storageKey: 'hrms-mock-geo-fences',
  seed: seedGeoFences,
})

export const restDayBatches = createMockCollection<RestDayBatchRecord>({
  storageKey: 'hrms-mock-rest-day-batches',
  seed: seedRestDayBatches,
})

export function resetSchedulingDb(): void {
  scheduleEntries.reset()
  geoFences.reset()
  restDayBatches.reset()
}

const base = (path: string) => apiPath(`/scheduling${path}`)
const invalid = (message = 'Some fields are not valid.') =>
  errorResponse(422, message, { code: 'VALIDATION_FAILED' })
const today = () => format(new Date(), 'yyyy-MM-dd')
const ok = (result: Partial<BatchResult>) =>
  HttpResponse.json<ApiItem<BatchResult>>({
    data: { created: 0, updated: 0, deleted: 0, skipped: 0, ...result },
  })

async function readBody<T>(request: Request, schema: z.ZodType<T>) {
  const body: unknown = await request.json().catch(() => null)
  return schema.safeParse(body)
}

// --- validation ----------------------------------------------------------------

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const ids = z.array(z.string().min(1))

const breakSchema = z.object({
  type: z.enum(BREAK_TYPES),
  startDate: day,
  endDate: day,
  startTime: time,
  endTime: time,
  description: z.string().max(200),
  inclusive: z.boolean(),
})

const slotSchema = z.object({
  name: z.string().trim().min(1).max(60),
  isOvernight: z.boolean(),
  reverseDecision: z.boolean(),
  mode: z.enum(['fixed', 'flexible', 'total']),
  workableMinutes: z.number().int().min(0).max(1440).nullable(),
  totalMinutes: z.number().int().min(0).max(100_000).nullable(),
  shortOvertime: z.boolean(),
  fullOvertime: z.boolean(),
  overtimeMinutes: z.number().int().min(0).max(1440).nullable(),
})

const repeatSchema = z.object({
  everyWeeks: z.number().int().min(1).max(8),
  from: day,
  to: day,
  weekdays: z.array(z.enum(WEEKDAYS)).min(1),
  step: z.number().int().min(1).max(8),
})

const createSchema = z.object({
  startDate: day,
  endDate: day,
  rosterGroupId: z.string().min(1),
  geoFenceIds: ids,
  repeat: repeatSchema.nullable(),
  restDays: z.boolean(),
  workFromHome: z.boolean(),
  breaks: z.array(breakSchema).max(20),
  slot: slotSchema,
  clockIn: time.nullable(),
  clockOut: time.nullable(),
  employeeIds: ids.min(1),
})

const patchSchema = z.object({
  rosterGroupId: z.string().min(1).optional(),
  geoFenceIds: ids.optional(),
  workFromHome: z.boolean().optional(),
  restDay: z.boolean().optional(),
  slot: slotSchema.partial().optional(),
  breaks: z.array(breakSchema).max(20).optional(),
})

const shapeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('circle'),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radiusMeters: z.number().min(10).max(50_000),
  }),
  z.object({
    type: z.literal('polygon'),
    points: z
      .array(
        z.object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        }),
      )
      .min(3)
      .max(50),
  }),
])

// --- helpers -------------------------------------------------------------------

const ROSTER_DAY_INDEX = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 } as const

/** The roster's times for a date: a working day's clock in/out, or a weekend. */
function rosterDay(group: RosterGroup, date: string) {
  const pattern = group.days[ROSTER_DAY_INDEX[weekdayOf(date)]]
  if (!pattern || pattern.isWeekend || !pattern.clockIn || !pattern.clockOut) return null
  return { clockIn: pattern.clockIn, clockOut: pattern.clockOut }
}

function entryAt(employeeId: string, date: string) {
  return scheduleEntries
    .all()
    .find((entry) => entry.employeeId === employeeId && entry.date === date)
}

/** Writes an entry for an employee and date, replacing whatever was there. */
function upsert(
  entry: Omit<ScheduleEntry, 'id' | 'createdAt' | 'updatedAt'>,
): 'created' | 'updated' {
  const now = new Date().toISOString()
  const existing = entryAt(entry.employeeId, entry.date)
  if (existing) {
    scheduleEntries.update(existing.id, { ...existing, ...entry, updatedAt: now })
    return 'updated'
  }
  scheduleEntries.insert({ ...entry, id: createId('se'), createdAt: now, updatedAt: now })
  return 'created'
}

function knownEmployees(employeeIds: readonly string[]) {
  return [...new Set(employeeIds)].filter((id) => findEmployee(id))
}

const isOvernightPair = (clockIn: string, clockOut: string) => clockOut < clockIn

function toPickable(employee: DirectoryEmployee): PickableEmployee {
  return {
    id: employee.id,
    code: profileOf(employee).code,
    name: employee.name,
    designation: employee.jobTitle,
  }
}

function locationOf(employee: DirectoryEmployee): string | null {
  return employee.branchId ? (branches.find(employee.branchId)?.locationId ?? null) : null
}

/** Employees matching the Select Employees / board filters. */
function filterEmployees(url: URL): DirectoryEmployee[] {
  const param = (key: string) => url.searchParams.get(key) ?? ''
  const search = param('search').trim().toLowerCase()
  return DIRECTORY.filter((employee) => {
    const profile = profileOf(employee)
    const checks: [string, string | null][] = [
      ['employeeId', employee.id],
      ['department', employee.department],
      ['designation', employee.jobTitle],
      ['grade', profile.grade],
      ['group', profile.group],
      ['employmentType', profile.employmentType],
      ['gender', profile.gender],
      ['branchId', employee.branchId],
      ['locationId', locationOf(employee)],
      ['status', profile.status],
    ]
    if (!checks.every(([key, value]) => !param(key) || param(key) === value)) return false
    return (
      !search ||
      [employee.name, profile.code, employee.jobTitle, employee.department].some((text) =>
        text.toLowerCase().includes(search),
      )
    )
  })
}

// --- handlers ------------------------------------------------------------------

export const schedulingHandlers = [
  http.get(base('/board'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const scope = url.searchParams.get('scope') ?? 'all'
    const from = url.searchParams.get('from') ?? today()
    const to = url.searchParams.get('to') ?? from
    const rosterGroupId = url.searchParams.get('rosterGroupId')
    const { page, pageSize } = readPageParams(url)

    const inRange = scheduleEntries.all().filter((entry) => entry.date >= from && entry.date <= to)
    const byEmployee = new Map<string, ScheduleEntry[]>()
    for (const entry of inRange) {
      const list = byEmployee.get(entry.employeeId) ?? []
      list.push(entry)
      byEmployee.set(entry.employeeId, list)
    }

    const people = filterEmployees(url).filter((employee) => {
      if (scope === 'my') return employee.id === CURRENT_EMPLOYEE_ID
      if (scope === 'subordinates') return profileOf(employee).managerId === CURRENT_EMPLOYEE_ID
      return true
    })
    const matching = rosterGroupId
      ? people.filter((employee) =>
          (byEmployee.get(employee.id) ?? []).some(
            (entry) => entry.rosterGroupId === rosterGroupId,
          ),
        )
      : people

    const dayTotals: Record<string, number> = {}
    for (const employee of matching) {
      for (const entry of byEmployee.get(employee.id) ?? []) {
        dayTotals[entry.date] = (dayTotals[entry.date] ?? 0) + plannedMinutes(entry)
      }
    }

    const total = matching.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const now = today()
    const rows = matching
      .slice((page - 1) * pageSize, page * pageSize)
      .map((employee): BoardRow => {
        const entries = (byEmployee.get(employee.id) ?? []).sort((a, b) =>
          a.date.localeCompare(b.date),
        )
        const profile = profileOf(employee)
        return {
          employee: {
            id: employee.id,
            code: profile.code,
            name: employee.name,
            designation: employee.jobTitle,
            department: employee.department,
            status: profile.status,
            defaultSlot: profile.defaultSlot,
          },
          entries,
          plannedMinutes: entries.reduce((sum, entry) => sum + plannedMinutes(entry), 0),
          onShiftToday: scheduleEntries
            .all()
            .some(
              (entry) =>
                entry.employeeId === employee.id && entry.date === now && entry.kind === 'shift',
            ),
        }
      })

    return HttpResponse.json<BoardPage>({
      data: rows,
      meta: { page, pageSize, total, totalPages },
      dayTotals,
    })
  }),

  http.get(base('/active-shift'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const entry = entryAt(CURRENT_EMPLOYEE_ID, today())
    const shift: ActiveShift =
      entry?.kind === 'shift'
        ? { slotName: entry.slot.name, clockIn: entry.clockIn, clockOut: entry.clockOut }
        : { slotName: entry ? 'Rest Day' : null, clockIn: null, clockOut: null }
    return HttpResponse.json<ApiItem<ActiveShift>>({ data: shift })
  }),

  http.get(base('/lookups'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const sorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b))
    const profiles = DIRECTORY.map(profileOf)
    return HttpResponse.json<ApiItem<SchedulingLookups>>({
      data: {
        departments: sorted(DIRECTORY.map((employee) => employee.department)),
        designations: sorted(DIRECTORY.map((employee) => employee.jobTitle)),
        groups: sorted(profiles.map((profile) => profile.group)),
        grades: sorted(profiles.map((profile) => profile.grade)),
        employees: DIRECTORY.map(toPickable),
      },
    })
  }),

  http.get(base('/employees'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    for (const [key, values] of [
      ['employmentType', EMPLOYMENT_TYPES],
      ['gender', GENDERS],
      ['status', EMPLOYEE_STATUSES],
    ] as const) {
      const value = url.searchParams.get(key)
      if (value && !(values as readonly string[]).includes(value)) return invalid()
    }
    return HttpResponse.json<ApiItem<PickableEmployee[]>>({
      data: filterEmployees(url).map(toPickable),
    })
  }),

  http.get(base('/entries/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const entry = scheduleEntries.find(String(params.id))
    return entry
      ? HttpResponse.json<ApiItem<ScheduleEntry>>({ data: entry })
      : errorResponse(404, 'The schedule entry was not found.', { code: 'NOT_FOUND' })
  }),

  http.post(base('/schedules'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, createSchema)
    if (!parsed.success) return invalid()
    const input = parsed.data
    if (input.endDate < input.startDate) {
      return errorResponse(422, 'The end date is before the start date.', {
        fieldErrors: { endDate: 'Pick a date on or after the start date' },
      })
    }
    const group = rosterGroups.find(input.rosterGroupId)
    if (!group) {
      return errorResponse(422, 'Select a time roster.', {
        fieldErrors: { rosterGroupId: 'Select a time roster' },
      })
    }
    const dates = scheduleDates(input.startDate, input.endDate, input.repeat)
    if (dates.length === 0) {
      return errorResponse(422, 'These dates and repeat settings leave no days to schedule.', {
        code: 'NO_DATES',
      })
    }
    const result: BatchResult = { created: 0, updated: 0, deleted: 0, skipped: 0 }
    const batchId = createId('batch')
    for (const employeeId of knownEmployees(input.employeeIds)) {
      for (const date of dates) {
        const roster = rosterDay(group, date)
        if (!roster && !input.restDays) {
          result.skipped += 1
          continue
        }
        const clockIn = roster ? (input.clockIn ?? roster.clockIn) : null
        const clockOut = roster ? (input.clockOut ?? roster.clockOut) : null
        const outcome = upsert({
          employeeId,
          date,
          kind: roster ? 'shift' : 'rest',
          rosterGroupId: group.id,
          clockIn,
          clockOut,
          workFromHome: roster ? input.workFromHome : false,
          geoFenceIds: roster ? input.geoFenceIds : [],
          breaks: roster ? input.breaks : [],
          slot: {
            ...input.slot,
            isOvernight:
              input.slot.isOvernight ||
              (clockIn !== null && clockOut !== null && isOvernightPair(clockIn, clockOut)),
          },
          restDayPayable: false,
          batchId,
        })
        result[outcome] += 1
      }
    }
    return ok(result)
  }),

  http.post(base('/apply-default'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(
      request,
      z.object({
        startDate: day,
        endDate: day,
        rosterGroupId: z.string().min(1),
        employeeIds: ids.min(1),
      }),
    )
    if (!parsed.success) return invalid()
    const input = parsed.data
    const group = rosterGroups.find(input.rosterGroupId)
    if (!group) return invalid('Select a roster group.')
    if (input.endDate < input.startDate) return invalid('The end date is before the start date.')
    const result: BatchResult = { created: 0, updated: 0, deleted: 0, skipped: 0 }
    const batchId = createId('batch')
    for (const employeeId of knownEmployees(input.employeeIds)) {
      for (const date of eachDay(input.startDate, input.endDate)) {
        const roster = rosterDay(group, date)
        const outcome = upsert({
          employeeId,
          date,
          kind: roster ? 'shift' : 'rest',
          rosterGroupId: group.id,
          clockIn: roster?.clockIn ?? null,
          clockOut: roster?.clockOut ?? null,
          workFromHome: false,
          geoFenceIds: [],
          breaks: [],
          slot: slotFor(group, roster ? isOvernightPair(roster.clockIn, roster.clockOut) : false),
          restDayPayable: false,
          batchId,
        })
        result[outcome] += 1
      }
    }
    return ok(result)
  }),

  http.post(base('/delete-range'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(
      request,
      z.object({
        startDate: day,
        endDate: day,
        deleteRestDays: z.boolean(),
        allEmployees: z.boolean(),
        employeeIds: ids,
      }),
    )
    if (!parsed.success) return invalid()
    const input = parsed.data
    if (!input.allEmployees && input.employeeIds.length === 0) {
      return invalid('Select at least one employee.')
    }
    const chosen = new Set(input.employeeIds)
    const doomed = scheduleEntries
      .all()
      .filter(
        (entry) =>
          entry.date >= input.startDate &&
          entry.date <= input.endDate &&
          (input.allEmployees || chosen.has(entry.employeeId)) &&
          (input.deleteRestDays || entry.kind === 'shift'),
      )
    doomed.forEach((entry) => scheduleEntries.remove(entry.id))
    return ok({ deleted: doomed.length })
  }),

  http.post(base('/rest-days'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(
      request,
      z.object({
        startDate: day,
        repeat: repeatSchema,
        payable: z.boolean(),
        employeeIds: ids.min(1),
      }),
    )
    if (!parsed.success) return invalid()
    const input = parsed.data
    const dates = repeatDates(input.repeat).filter((date) => date >= input.startDate)
    if (dates.length === 0) return invalid('These settings do not land on any day.')
    const result: BatchResult = { created: 0, updated: 0, deleted: 0, skipped: 0 }
    const batchId = createId('batch')
    for (const employeeId of knownEmployees(input.employeeIds)) {
      for (const date of dates) {
        const previous = entryAt(employeeId, date)
        const outcome = upsert({
          employeeId,
          date,
          kind: 'rest',
          rosterGroupId: previous?.rosterGroupId ?? null,
          clockIn: null,
          clockOut: null,
          workFromHome: false,
          geoFenceIds: [],
          breaks: [],
          slot: previous?.slot ?? {
            name: 'Rest Day',
            isOvernight: false,
            reverseDecision: false,
            mode: 'fixed',
            workableMinutes: null,
            totalMinutes: null,
            shortOvertime: false,
            fullOvertime: false,
            overtimeMinutes: null,
          },
          restDayPayable: input.payable,
          batchId,
        })
        result[outcome] += 1
      }
    }
    restDayBatches.insert({
      id: batchId,
      startDate: input.startDate,
      repeat: input.repeat,
      payable: input.payable,
      employeeIds: knownEmployees(input.employeeIds),
      dates,
      createdAt: new Date().toISOString(),
    })
    return ok(result)
  }),

  http.patch(base('/entries/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const existing = scheduleEntries.find(String(params.id))
    if (!existing)
      return errorResponse(404, 'The schedule entry was not found.', { code: 'NOT_FOUND' })
    const parsed = await readBody(request, patchSchema)
    if (!parsed.success) return invalid()
    const updated = applyPatch(existing, parsed.data)
    if (updated instanceof Response) return updated
    scheduleEntries.update(existing.id, updated)
    return HttpResponse.json<ApiItem<ScheduleEntry>>({ data: updated })
  }),

  http.post(base('/entries/bulk-update'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, z.object({ ids: ids.min(1), patch: patchSchema }))
    if (!parsed.success) return invalid()
    let updated = 0
    for (const id of parsed.data.ids) {
      const existing = scheduleEntries.find(id)
      if (!existing) continue
      const next = applyPatch(existing, parsed.data.patch)
      if (next instanceof Response) return next
      scheduleEntries.update(existing.id, next)
      updated += 1
    }
    return ok({ updated })
  }),

  http.post(base('/entries/bulk-delete'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, z.object({ ids: ids.min(1) }))
    if (!parsed.success) return invalid()
    let deleted = 0
    let skipped = 0
    for (const id of parsed.data.ids) {
      const entry = scheduleEntries.find(id)
      // "Rest Days will not be Deleted."
      if (!entry || entry.kind === 'rest') {
        skipped += 1
        continue
      }
      scheduleEntries.remove(id)
      deleted += 1
    }
    return ok({ deleted, skipped })
  }),

  http.delete(base('/entries/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const removed = scheduleEntries.remove(String(params.id))
    return removed
      ? new HttpResponse(null, { status: 204 })
      : errorResponse(404, 'The schedule entry was not found.', { code: 'NOT_FOUND' })
  }),

  http.post(base('/entries/swap'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(
      request,
      z.object({
        entryId: z.string().min(1),
        targetEmployeeId: z.string().min(1),
        targetDate: day,
      }),
    )
    if (!parsed.success) return invalid()
    const { entryId, targetEmployeeId, targetDate } = parsed.data
    const source = scheduleEntries.find(entryId)
    if (!source)
      return errorResponse(404, 'The schedule entry was not found.', { code: 'NOT_FOUND' })
    if (!findEmployee(targetEmployeeId)) return invalid('Pick an employee to swap with.')
    if (source.employeeId === targetEmployeeId && source.date === targetDate) return ok({})
    const now = new Date().toISOString()
    const target = entryAt(targetEmployeeId, targetDate)
    if (target) {
      scheduleEntries.update(target.id, {
        ...target,
        employeeId: source.employeeId,
        date: source.date,
        updatedAt: now,
      })
    }
    scheduleEntries.update(source.id, {
      ...source,
      employeeId: targetEmployeeId,
      date: targetDate,
      updatedAt: now,
    })
    return ok({ updated: target ? 2 : 1 })
  }),

  http.post(base('/import'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(
      request,
      z.object({
        rows: z
          .array(
            z.object({
              employeeCode: z.string().min(1),
              date: day,
              clockIn: time.nullable(),
              clockOut: time.nullable(),
              restDay: z.boolean(),
            }),
          )
          .min(1)
          .max(5000),
      }),
    )
    if (!parsed.success) return invalid('The file has rows that could not be read.')
    const byCode = new Map(
      DIRECTORY.map((employee) => [profileOf(employee).code.toLowerCase(), employee]),
    )
    const result: BatchResult = { created: 0, updated: 0, deleted: 0, skipped: 0 }
    const batchId = createId('batch')
    for (const row of parsed.data.rows) {
      const employee = byCode.get(row.employeeCode.toLowerCase())
      const isShift = !row.restDay && row.clockIn !== null && row.clockOut !== null
      if (!employee || (!row.restDay && !isShift)) {
        result.skipped += 1
        continue
      }
      const outcome = upsert({
        employeeId: employee.id,
        date: row.date,
        kind: isShift ? 'shift' : 'rest',
        rosterGroupId: null,
        clockIn: isShift ? row.clockIn : null,
        clockOut: isShift ? row.clockOut : null,
        workFromHome: false,
        geoFenceIds: [],
        breaks: [],
        slot: {
          ...slotFor({ title: 'Imported Shift', days: [] }),
          isOvernight:
            isShift &&
            row.clockIn !== null &&
            row.clockOut !== null &&
            isOvernightPair(row.clockIn, row.clockOut),
        },
        restDayPayable: false,
        batchId,
      })
      result[outcome] += 1
    }
    return ok(result)
  }),

  http.get(apiPath('/geo-fences'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    // Fences switched off in Attendance → Settings → Geo Fencing are not offered.
    const inactive = new Set(
      geoFenceSettings
        .all()
        .filter((item) => !item.active)
        .map((item) => item.id),
    )
    return HttpResponse.json<ApiItem<GeoFence[]>>({
      data: geoFences
        .all()
        .filter((fence) => !inactive.has(fence.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    })
  }),

  http.post(apiPath('/geo-fences'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(
      request,
      z.object({ name: z.string().trim().min(1).max(80), shape: shapeSchema }),
    )
    if (!parsed.success) return invalid()
    const name = parsed.data.name.trim()
    if (geoFences.all().some((fence) => fence.name.toLowerCase() === name.toLowerCase())) {
      return errorResponse(409, 'A geo fence with this name already exists.', {
        code: 'DUPLICATE_NAME',
        fieldErrors: { name: 'Choose a different name' },
      })
    }
    const fence: GeoFence = {
      id: createId('gf'),
      name,
      shape: parsed.data.shape,
      createdAt: new Date().toISOString(),
    }
    geoFences.insert(fence)
    return HttpResponse.json<ApiItem<GeoFence>>({ data: fence }, { status: 201 })
  }),
]

/** Applies an edit to one entry; a new time roster brings that weekday's times. */
function applyPatch(
  entry: ScheduleEntry,
  patch: z.infer<typeof patchSchema>,
): ScheduleEntry | Response {
  let next: ScheduleEntry = { ...entry, updatedAt: new Date().toISOString() }
  if (patch.rosterGroupId && patch.rosterGroupId !== entry.rosterGroupId) {
    const group = rosterGroups.find(patch.rosterGroupId)
    if (!group) return invalid('Select a time roster.')
    const roster = rosterDay(group, entry.date) ?? firstWorkingDay(group)
    next = {
      ...next,
      rosterGroupId: group.id,
      clockIn: roster?.clockIn ?? next.clockIn,
      clockOut: roster?.clockOut ?? next.clockOut,
      slot: { ...next.slot, name: group.title },
    }
  }
  if (patch.restDay === true) next = { ...next, kind: 'rest', clockIn: null, clockOut: null }
  if (patch.restDay === false && next.kind === 'rest') {
    const group = next.rosterGroupId ? rosterGroups.find(next.rosterGroupId) : undefined
    const roster = group ? (rosterDay(group, next.date) ?? firstWorkingDay(group)) : null
    if (!roster) return invalid('Pick a time roster to turn this rest day into a shift.')
    next = { ...next, kind: 'shift', clockIn: roster.clockIn, clockOut: roster.clockOut }
  }
  if (patch.geoFenceIds) next.geoFenceIds = patch.geoFenceIds
  if (patch.workFromHome !== undefined) next.workFromHome = patch.workFromHome
  if (patch.breaks) next.breaks = patch.breaks
  if (patch.slot) {
    // A partial schema leaves out keys that were not sent.
    next.slot = { ...next.slot, ...(patch.slot as Partial<TimeSlotRules>) }
  }
  return next
}

function firstWorkingDay(group: RosterGroup) {
  const pattern = group.days.find((entry) => !entry.isWeekend && entry.clockIn && entry.clockOut)
  return pattern?.clockIn && pattern.clockOut
    ? { clockIn: pattern.clockIn, clockOut: pattern.clockOut }
    : null
}
