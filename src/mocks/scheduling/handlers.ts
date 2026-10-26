import { addDays, format, parseISO } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  type BoardEmployee,
  type BoardPage,
  type BoardRestDay,
  type BoardRow,
  type BoardShift,
  type BreakType,
  type BulkDeleteResult,
  type BulkEditResult,
  type DayTotal,
  type GeoFence,
  patternDates,
  plannedMinutes,
  type ScheduleBatchResult,
  type ScheduleBreak,
  type ScheduleDetail,
  type ScheduleEntry,
  type SchedulingOption,
  WEEKDAYS,
  type YearMonth,
  type YearPage,
} from '@/features/scheduling'
import type { ApiItem } from '@/types/api'

import { createMockCollection } from '../collection'
import { DIRECTORY, type DirectoryEmployee, findEmployee } from '../employees/seed'
import { enrollments, rosterGroups } from '../roster/handlers'
import { branches, jobTitles } from '../settings/handlers'
import { apiPath, createId, errorResponse, latency, readPageParams, requireAuth } from '../utils'
import {
  CURRENT_EMPLOYEE_ID,
  profileOf,
  type RestDayBatchRecord,
  seedEntries,
  seedGeoFences,
  seedRestDayBatches,
} from './seed'
import {
  apiTime,
  breakTypes,
  isOvernightSlot,
  type MockTimeSlot,
  resetTimeSlotsDb,
  slotByTimes,
  timeSlots,
  workableMinutesOf,
} from './time-slots'

/*
 * `/api/scheduling/schedules` and `/api/scheduling/options/...` as the backend serves them
 * (`backend/app/routers/scheduling.py`). The records keep the old one-entry-per-day shape the
 * other modules' mocks read and write; the handlers answer in the API's shapes. The settings
 * tabs (`/scheduling/settings/...`: rest days, break types, holidays) are mocked by
 * Attendance (`src/mocks/attendance/settings-handlers.ts`).
 */

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
  resetTimeSlotsDb()
}

const base = (path: string) => apiPath(`/scheduling${path}`)
const today = () => format(new Date(), 'yyyy-MM-dd')
const nextDate = (day: string) => format(addDays(parseISO(day), 1), 'yyyy-MM-dd')
/** A stand-in for SQL Server's rowversion: changes whenever the record is saved. */
const rowVersionOf = (updatedAt: string) => Date.parse(updatedAt).toString(16).padStart(16, '0')
const slugOf = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-')

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

const notFound = () => errorResponse(404, 'The schedule was not found.', { code: 'NOT_FOUND' })

// --- validation ------------------------------------------------------------------------------

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
const id = z.union([z.string().min(1), z.number().int()]).transform(String)

const breakSchema = z.object({
  breakTypeId: id,
  startTime: time,
  endTime: time,
  isInclusive: z.boolean().default(false),
})

const batchSchema = z.object({
  startDate: day,
  endDate: day,
  timeSlotId: id.nullish(),
  rosterGroupId: id.nullish(),
  weekdays: z.array(z.number().int().min(1).max(7)).max(7).default([]),
  repeatEveryWeeks: z.number().int().min(0).max(8).default(0),
  step: z.number().int().min(1).max(8).default(1),
  geoFenceId: id.nullish(),
  isWfh: z.boolean().default(false),
  employeeIds: z.array(id).max(5000).default([]),
  breaks: z.array(breakSchema).max(20).nullish(),
  replaceExisting: z.boolean().default(false),
})

const defaultShiftSchema = z.object({
  startDate: day,
  endDate: day,
  employeeIds: z.array(id).min(1).max(5000),
  replaceExisting: z.boolean().default(false),
})

const scheduleSchema = z.object({
  employeeId: id.nullish(),
  workDate: day,
  timeSlotId: id,
  startTime: time.nullish(),
  endTime: time.nullish(),
  geoFenceId: id.nullish(),
  isWfh: z.boolean().default(false),
  breaks: z.array(breakSchema).max(20).nullish(),
  rowVersion: z.string().nullish(),
})

const swapSchema = z.object({
  withScheduleId: id.nullish(),
  withEmployeeId: id.nullish(),
  rowVersion: z.string().nullish(),
})

const bulkDeleteSchema = z.object({
  ids: z.array(id).max(5000).nullish(),
  startDate: day.nullish(),
  endDate: day.nullish(),
  employeeIds: z.array(id).max(5000).default([]),
  allEmployees: z.boolean().default(false),
  deleteRestDays: z.boolean().default(false),
})

const bulkEditSchema = z.object({
  ids: z.array(id).min(1).max(5000),
  timeSlotId: id.nullish(),
  geoFenceId: id.nullish(),
  clearGeoFence: z.boolean().default(false),
  isWfh: z.boolean().nullish(),
})

// --- records ⇄ API shapes ----------------------------------------------------------------------

const hhmm = (value: string) => value.slice(0, 5)

/** The old records' break kinds ⇄ the seeded break types. */
const BREAK_KIND_BY_TYPE: Record<string, BreakType> = {
  bt_lunch: 'lunch',
  bt_prayer: 'prayer',
  bt_rest: 'rest',
}
const typeIdOf = (kind: BreakType) =>
  Object.entries(BREAK_KIND_BY_TYPE).find(([, value]) => value === kind)?.[0] ?? 'bt_rest'

/** The slot an entry follows: its id when known, else the slot with the same clock times. */
function slotOf(entry: ScheduleEntry): MockTimeSlot {
  const known = entry.timeSlotId ? timeSlots.find(entry.timeSlotId) : undefined
  const byTimes = known ?? slotByTimes(entry.clockIn, entry.clockOut)
  return (
    byTimes ?? {
      id: 'ts_custom',
      code: 'TS-CUSTOM',
      name: entry.slot.name,
      color: null,
      startTime: entry.clockIn ?? '09:00',
      endTime: entry.clockOut ?? '17:00',
      isFlexible: entry.slot.mode === 'flexible',
      workableMinutes: entry.slot.workableMinutes,
      fullOvertime: entry.slot.fullOvertime,
      shortOvertime: entry.slot.shortOvertime,
      breaks: [],
      createdAt: entry.createdAt,
    }
  )
}

/** Local wall-clock start and end; an end at or before the start is the next day. */
function span(date: string, clockIn: string, clockOut: string) {
  const overnight = hhmm(clockOut) <= hhmm(clockIn)
  return {
    startAt: `${date}T${apiTime(hhmm(clockIn))}`,
    endAt: `${overnight ? nextDate(date) : date}T${apiTime(hhmm(clockOut))}`,
    isOvernight: overnight,
  }
}

const fenceOf = (entry: ScheduleEntry) => {
  const fenceId = entry.geoFenceIds[0] ?? null
  return {
    geoFenceId: fenceId,
    geoFenceName: fenceId ? (geoFences.find(fenceId)?.name ?? null) : null,
  }
}

function toBoardShift(entry: ScheduleEntry): BoardShift {
  const slot = slotOf(entry)
  const times = span(entry.date, entry.clockIn ?? slot.startTime, entry.clockOut ?? slot.endTime)
  return {
    id: entry.id,
    workDate: entry.date,
    startAt: times.startAt,
    endAt: times.endAt,
    timeSlotId: slot.id,
    timeSlotCode: slot.code,
    timeSlotName: slot.name,
    timeSlotColor: slot.color,
    isFlexible: slot.isFlexible,
    isOvernight: times.isOvernight,
    ...fenceOf(entry),
    isWfh: entry.workFromHome,
    plannedMinutes: plannedMinutes(entry),
    scheduleBatchId: entry.batchId,
    rowVersion: rowVersionOf(entry.updatedAt),
  }
}

function toRestDay(entry: ScheduleEntry): BoardRestDay {
  return {
    id: entry.id,
    restDate: entry.date,
    isPayable: entry.restDayPayable,
    restDayRuleId: restDayBatches.find(entry.batchId) ? entry.batchId : null,
    requestId: null,
  }
}

function toDetail(entry: ScheduleEntry): ScheduleDetail {
  const shift = toBoardShift(entry)
  const employee = findEmployee(entry.employeeId)
  const slot = slotOf(entry)
  return {
    ...shift,
    employeeId: entry.employeeId,
    employeeCode: employee ? profileOf(employee).code : entry.employeeId,
    employeeName: employee?.name ?? 'Unknown employee',
    fullOvertime: slot.fullOvertime,
    shortOvertime: slot.shortOvertime,
    isRestDay: false,
    breaks: entry.breaks.map((item, index) => {
      const typeId = typeIdOf(item.type)
      const times = span(entry.date, item.startTime, item.endTime)
      return {
        id: `${entry.id}_b${index}`,
        breakTypeId: typeId,
        breakTypeName: breakTypes.find(typeId)?.name ?? item.description,
        startAt: times.startAt,
        endAt: times.endAt,
        isInclusive: item.inclusive,
      }
    }),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }
}

/** The old record's breaks for a shift: the ones sent, or the slot's own. */
function recordBreaks(
  date: string,
  slot: MockTimeSlot,
  sent: z.infer<typeof breakSchema>[] | null | undefined,
): ScheduleBreak[] {
  const rows = sent ?? slot.breaks
  return rows.map((row) => ({
    type: BREAK_KIND_BY_TYPE[row.breakTypeId] ?? 'personal',
    startDate: date,
    endDate: date,
    startTime: hhmm(row.startTime),
    endTime: hhmm(row.endTime),
    description: breakTypes.find(row.breakTypeId)?.name ?? 'Break',
    inclusive: row.isInclusive,
  }))
}

interface ShiftFields {
  employeeId: string
  date: string
  slot: MockTimeSlot
  rosterGroupId: string | null
  clockIn?: string | null | undefined
  clockOut?: string | null | undefined
  geoFenceId: string | null | undefined
  isWfh: boolean
  breaks: z.infer<typeof breakSchema>[] | null | undefined
  batchId: string
}

/** A shift as the old record (the other mocks read clock times and slot rules). */
function shiftRecord(fields: ShiftFields): Omit<ScheduleEntry, 'id' | 'createdAt' | 'updatedAt'> {
  const { slot } = fields
  const clockIn = fields.clockIn ? hhmm(fields.clockIn) : slot.startTime
  const clockOut = fields.clockOut ? hhmm(fields.clockOut) : slot.endTime
  return {
    employeeId: fields.employeeId,
    date: fields.date,
    kind: 'shift',
    rosterGroupId: fields.rosterGroupId,
    timeSlotId: slot.id,
    clockIn,
    clockOut,
    workFromHome: fields.isWfh,
    geoFenceIds: fields.geoFenceId ? [fields.geoFenceId] : [],
    breaks: recordBreaks(fields.date, slot, fields.breaks),
    slot: {
      name: slot.name,
      isOvernight: isOvernightSlot({ startTime: clockIn, endTime: clockOut }),
      reverseDecision: false,
      mode: slot.isFlexible ? 'flexible' : 'fixed',
      workableMinutes: slot.isFlexible ? workableMinutesOf(slot) : null,
      totalMinutes: null,
      shortOvertime: slot.shortOvertime,
      fullOvertime: slot.fullOvertime,
      overtimeMinutes: null,
    },
    restDayPayable: false,
    batchId: fields.batchId,
  }
}

const entriesOn = (employeeId: string, date: string) =>
  scheduleEntries.all().filter((entry) => entry.employeeId === employeeId && entry.date === date)
const shiftOn = (employeeId: string, date: string) =>
  entriesOn(employeeId, date).find((entry) => entry.kind === 'shift')
const restOn = (employeeId: string, date: string) =>
  entriesOn(employeeId, date).find((entry) => entry.kind === 'rest')

function insertShift(record: Omit<ScheduleEntry, 'id' | 'createdAt' | 'updatedAt'>) {
  const now = new Date().toISOString()
  return scheduleEntries.insert({ ...record, id: createId('se'), createdAt: now, updatedAt: now })
}

// --- the board ---------------------------------------------------------------------------------

/** The usual slot of a mock person (`hr.employee.default_time_slot_id`). */
const defaultSlotOf = (employee: DirectoryEmployee) =>
  timeSlots.find(profileOf(employee).defaultSlot === 'Night Shift' ? 'rg_swing' : 'rg_morning')

const enrolmentOn = (employeeId: string, date: string) =>
  enrollments
    .all()
    .find(
      (item) =>
        item.employeeId === employeeId &&
        item.startDate <= date &&
        (item.endDate === null || item.endDate >= date),
    )

/** People the board shows: the tab, then the API's filters (ids from the lookups). */
function boardPeople(url: URL, from: string, to: string): DirectoryEmployee[] {
  const param = (key: string) => url.searchParams.get(key) ?? ''
  const tab = param('tab') || 'all'
  const q = param('q').trim().toLowerCase()
  const inRange = scheduleEntries.all().filter((entry) => entry.date >= from && entry.date <= to)
  return DIRECTORY.filter((employee) => {
    const profile = profileOf(employee)
    if (tab === 'my' && employee.id !== CURRENT_EMPLOYEE_ID) return false
    if (tab === 'subordinates' && profile.managerId !== CURRENT_EMPLOYEE_ID) return false
    if (q && !`${employee.name} ${profile.code}`.toLowerCase().includes(q)) return false
    const branch = employee.branchId ? branches.find(employee.branchId) : undefined
    const designation = jobTitles.find(param('designationId'))
    const checks: [string, boolean][] = [
      ['employeeId', employee.id === param('employeeId')],
      ['departmentId', `dep_${slugOf(employee.department)}` === param('departmentId')],
      ['branchId', employee.branchId === param('branchId')],
      ['locationId', branch?.locationId === param('locationId')],
      ['designationId', designation?.name === employee.jobTitle],
      ['gradeId', `gr_${slugOf(profile.grade)}` === param('gradeId')],
      ['employeeGroupId', `grp_${slugOf(profile.group)}` === param('employeeGroupId')],
      ['employmentTypeId', `et_${profile.employmentType}` === param('employmentTypeId')],
      ['employeeStatus', profile.status === param('employeeStatus')],
      [
        'timeSlotId',
        inRange.some(
          (entry) =>
            entry.employeeId === employee.id &&
            entry.kind === 'shift' &&
            slotOf(entry).id === param('timeSlotId'),
        ),
      ],
      [
        'rosterGroupId',
        enrollments
          .all()
          .some(
            (item) =>
              item.employeeId === employee.id &&
              item.rosterGroupId === param('rosterGroupId') &&
              item.startDate <= to &&
              (item.endDate === null || item.endDate >= from),
          ),
      ],
    ]
    return checks.every(([key, matches]) => !param(key) || matches)
  })
}

function boardEmployee(
  employee: DirectoryEmployee,
  shifts: readonly ScheduleEntry[],
): BoardEmployee {
  const profile = profileOf(employee)
  const slot = defaultSlotOf(employee)
  return {
    id: employee.id,
    code: profile.code,
    name: employee.name,
    designationName: employee.jobTitle,
    departmentName: employee.department,
    status: profile.status,
    defaultTimeSlotId: slot?.id ?? null,
    defaultTimeSlotName: slot?.name ?? null,
    plannedMinutes: shifts.reduce((sum, entry) => sum + plannedMinutes(entry), 0),
    shiftCount: shifts.length,
  }
}

function rangeOf(url: URL) {
  const from = url.searchParams.get('from') ?? today()
  const to = url.searchParams.get('to') ?? from
  return { from, to }
}

function entriesIn(from: string, to: string) {
  const byEmployee = new Map<string, ScheduleEntry[]>()
  for (const entry of scheduleEntries.all()) {
    if (entry.date < from || entry.date > to) continue
    byEmployee.set(entry.employeeId, [...(byEmployee.get(entry.employeeId) ?? []), entry])
  }
  return byEmployee
}

const byDate = (a: ScheduleEntry, b: ScheduleEntry) => a.date.localeCompare(b.date)

// --- writes ------------------------------------------------------------------------------------

type BatchInput = z.infer<typeof batchSchema>

/** Who a batch schedules on a date: those named, or the roster's members that day. */
function batchPeople(input: BatchInput, date: string): string[] {
  if (input.employeeIds.length > 0) return input.employeeIds
  if (!input.rosterGroupId) return []
  return enrollments
    .all()
    .filter(
      (item) =>
        item.rosterGroupId === input.rosterGroupId &&
        item.startDate <= date &&
        (item.endDate === null || item.endDate >= date),
    )
    .map((item) => item.employeeId)
}

/** The slot a roster group plans on a date, or null on its day off. */
function rosterSlotOn(groupId: string, date: string): MockTimeSlot | null {
  const group = rosterGroups.find(groupId)
  const weekday = (parseISO(date).getDay() + 6) % 7
  const pattern = group?.days[weekday]
  if (!pattern || pattern.isWeekend || !pattern.timeSlotId) return null
  return timeSlots.find(pattern.timeSlotId) ?? null
}

interface PlannedShift {
  employeeId: string
  date: string
  slot: MockTimeSlot
  rosterGroupId: string | null
}

/**
 * Writes planned shifts: rest days are skipped, existing shifts refuse the whole batch (409)
 * unless `replaceExisting`, which replaces them.
 */
function writeBatch(
  planned: readonly PlannedShift[],
  options: {
    replaceExisting: boolean
    geoFenceId?: string | null | undefined
    isWfh?: boolean
    breaks?: z.infer<typeof breakSchema>[] | null | undefined
  },
): { created: number; replaced: number; skippedRestDays: number; batchId: string } | Response {
  const working = planned.filter((item) => !restOn(item.employeeId, item.date))
  const skippedRestDays = planned.length - working.length
  const taken = working.filter((item) => shiftOn(item.employeeId, item.date))
  if (taken.length > 0 && !options.replaceExisting) {
    return fieldError(
      409,
      'SCHEDULE_DAY_TAKEN',
      'employeeIds',
      'Some employees already have a shift on these dates. Replace them or pick other dates.',
    )
  }
  const batchId = createId('batch')
  for (const item of taken) {
    const existing = shiftOn(item.employeeId, item.date)
    if (existing) scheduleEntries.remove(existing.id)
  }
  for (const item of working) {
    insertShift(
      shiftRecord({
        ...item,
        geoFenceId: options.geoFenceId,
        isWfh: options.isWfh ?? false,
        breaks: options.breaks,
        batchId,
      }),
    )
  }
  return { created: working.length, replaced: taken.length, skippedRestDays, batchId }
}

function batchResult(
  kind: string,
  input: { startDate: string; endDate: string },
  written: { created: number; replaced: number; skippedRestDays: number; batchId: string },
  extra: Partial<ScheduleBatchResult> = {},
): ScheduleBatchResult {
  return {
    id: written.batchId,
    batchKind: kind,
    startDate: input.startDate,
    endDate: input.endDate,
    timeSlotId: null,
    timeSlotName: null,
    rosterGroupId: null,
    rosterGroupTitle: null,
    weekdays: [],
    repeatEveryWeeks: 0,
    step: 1,
    geoFenceId: null,
    isWfh: false,
    createdCount: written.created,
    replacedCount: written.replaced,
    skippedRestDays: written.skippedRestDays,
    skippedNoShift: 0,
    createdAt: new Date().toISOString(),
    ...extra,
  }
}

const options = (items: SchedulingOption[]) =>
  HttpResponse.json<{ data: SchedulingOption[] }>({ data: items })

const option = (fields: Pick<SchedulingOption, 'id' | 'name'> & Partial<SchedulingOption>) => ({
  code: null,
  startTime: null,
  endTime: null,
  isOvernight: null,
  isFlexible: null,
  ...fields,
})

// --- handlers ----------------------------------------------------------------------------------

export const schedulingHandlers = [
  // Static paths before `/schedules/:id`.
  http.get(base('/schedules/year'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const year = Number(url.searchParams.get('year') ?? new Date().getFullYear())
    const from = `${year}-01-01`
    const to = `${year}-12-31`
    const { page, pageSize } = readPageParams(url)
    const people = boardPeople(url, from, to)
    const byEmployee = entriesIn(from, to)
    const total = people.length
    const data = people.slice((page - 1) * pageSize, page * pageSize).map((employee) => {
      const entries = byEmployee.get(employee.id) ?? []
      const shifts = entries.filter((entry) => entry.kind === 'shift')
      const months: YearMonth[] = []
      for (let month = 1; month <= 12; month += 1) {
        const prefix = `${year}-${String(month).padStart(2, '0')}`
        const inMonth = entries.filter((entry) => entry.date.startsWith(prefix))
        if (inMonth.length === 0) continue
        const monthShifts = inMonth.filter((entry) => entry.kind === 'shift')
        months.push({
          month,
          plannedMinutes: monthShifts.reduce((sum, entry) => sum + plannedMinutes(entry), 0),
          shiftCount: monthShifts.length,
          restDays: inMonth.length - monthShifts.length,
        })
      }
      return { employee: boardEmployee(employee, shifts), months }
    })
    return HttpResponse.json<YearPage>({
      data,
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    })
  }),

  http.get(base('/schedules/export'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const { from, to } = rangeOf(url)
    const byEmployee = entriesIn(from, to)
    const lines = [
      'Employee Code,Employee Name,Designation,Department,Date,Schedule,Planned Minutes',
    ]
    for (const employee of boardPeople(url, from, to)) {
      const profile = profileOf(employee)
      for (const entry of (byEmployee.get(employee.id) ?? []).sort(byDate)) {
        const schedule =
          entry.kind === 'rest'
            ? 'Rest day'
            : `${slotOf(entry).name} ${entry.clockIn ?? ''}-${entry.clockOut ?? ''}${entry.workFromHome ? ' WFH' : ''}`
        lines.push(
          [
            profile.code,
            employee.name,
            employee.jobTitle,
            employee.department,
            entry.date,
            schedule,
            String(plannedMinutes(entry)),
          ].join(','),
        )
      }
    }
    return new HttpResponse(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="schedule_${from}_${to}.csv"`,
      },
    })
  }),

  http.get(base('/schedules'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const { from, to } = rangeOf(url)
    const { page, pageSize } = readPageParams(url)
    const people = boardPeople(url, from, to)
    const byEmployee = entriesIn(from, to)

    const totals = new Map<string, DayTotal>()
    for (const employee of people) {
      for (const entry of byEmployee.get(employee.id) ?? []) {
        if (entry.kind !== 'shift') continue
        const current = totals.get(entry.date) ?? {
          workDate: entry.date,
          plannedMinutes: 0,
          shiftCount: 0,
        }
        totals.set(entry.date, {
          ...current,
          plannedMinutes: current.plannedMinutes + plannedMinutes(entry),
          shiftCount: current.shiftCount + 1,
        })
      }
    }

    const total = people.length
    const rows = people.slice((page - 1) * pageSize, page * pageSize).map((employee): BoardRow => {
      const entries = (byEmployee.get(employee.id) ?? []).sort(byDate)
      const shifts = entries.filter((entry) => entry.kind === 'shift')
      return {
        employee: boardEmployee(employee, shifts),
        shifts: shifts.map(toBoardShift),
        restDays: entries.filter((entry) => entry.kind === 'rest').map(toRestDay),
        holidays: [],
      }
    })

    return HttpResponse.json<BoardPage>({
      data: rows,
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      dayTotals: [...totals.values()].sort((a, b) => a.workDate.localeCompare(b.workDate)),
    })
  }),

  http.post(base('/schedules/batches'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, batchSchema)
    if (!parsed.success) return invalid(parsed.error)
    const input = parsed.data
    if (Boolean(input.timeSlotId) === Boolean(input.rosterGroupId)) {
      return fieldError(
        422,
        'VALIDATION_FAILED',
        'timeSlotId',
        'Pick either a time slot or a roster group.',
      )
    }
    if (input.endDate < input.startDate) {
      return fieldError(
        422,
        'VALIDATION_FAILED',
        'endDate',
        'The end date is before the start date.',
      )
    }
    if (input.timeSlotId && input.employeeIds.length === 0) {
      return fieldError(422, 'VALIDATION_FAILED', 'employeeIds', 'Select at least one employee.')
    }
    const slot = input.timeSlotId ? timeSlots.find(input.timeSlotId) : undefined
    if (input.timeSlotId && !slot) {
      return fieldError(422, 'VALIDATION_FAILED', 'timeSlotId', 'The time slot was not found.')
    }
    const group = input.rosterGroupId ? rosterGroups.find(input.rosterGroupId) : undefined
    if (input.rosterGroupId && !group) {
      return fieldError(
        422,
        'VALIDATION_FAILED',
        'rosterGroupId',
        'The roster group was not found.',
      )
    }
    const weekdays = input.weekdays.map((number) => WEEKDAYS[number - 1] ?? 'mon')
    const dates = patternDates(
      input.startDate,
      input.endDate,
      weekdays,
      input.repeatEveryWeeks,
      input.step,
    )
    const planned: PlannedShift[] = []
    let skippedNoShift = 0
    for (const date of dates) {
      for (const employeeId of batchPeople(input, date)) {
        if (!findEmployee(employeeId)) continue
        const daySlot = slot ?? (group ? rosterSlotOn(group.id, date) : null)
        if (!daySlot) {
          skippedNoShift += 1
          continue
        }
        planned.push({ employeeId, date, slot: daySlot, rosterGroupId: group?.id ?? null })
      }
    }
    const written = writeBatch(planned, input)
    if (written instanceof Response) return written
    return HttpResponse.json<ApiItem<ScheduleBatchResult>>(
      {
        data: batchResult('create', input, written, {
          timeSlotId: slot?.id ?? null,
          timeSlotName: slot?.name ?? null,
          rosterGroupId: group?.id ?? null,
          rosterGroupTitle: group?.title ?? null,
          weekdays: input.weekdays,
          repeatEveryWeeks: input.repeatEveryWeeks,
          step: input.step,
          geoFenceId: input.geoFenceId ?? null,
          isWfh: input.isWfh,
          skippedNoShift,
        }),
      },
      { status: 201 },
    )
  }),

  http.post(base('/schedules/default-shift'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, defaultShiftSchema)
    if (!parsed.success) return invalid(parsed.error)
    const input = parsed.data
    if (input.endDate < input.startDate) {
      return fieldError(
        422,
        'VALIDATION_FAILED',
        'endDate',
        'The end date is before the start date.',
      )
    }
    const planned: PlannedShift[] = []
    let skippedNoShift = 0
    for (const date of patternDates(input.startDate, input.endDate, [], 0, 1)) {
      for (const employeeId of input.employeeIds) {
        const employee = findEmployee(employeeId)
        if (!employee) continue
        // The roster they are enrolled in that day, else their default time slot.
        const enrolment = enrolmentOn(employeeId, date)
        const daySlot = enrolment
          ? rosterSlotOn(enrolment.rosterGroupId, date)
          : (defaultSlotOf(employee) ?? null)
        if (!daySlot) {
          skippedNoShift += 1
          continue
        }
        planned.push({
          employeeId,
          date,
          slot: daySlot,
          rosterGroupId: enrolment?.rosterGroupId ?? null,
        })
      }
    }
    const written = writeBatch(planned, { replaceExisting: input.replaceExisting })
    if (written instanceof Response) return written
    return HttpResponse.json<ApiItem<ScheduleBatchResult>>(
      { data: batchResult('default_shift', input, written, { skippedNoShift }) },
      { status: 201 },
    )
  }),

  http.post(base('/schedules/bulk-delete'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, bulkDeleteSchema)
    if (!parsed.success) return invalid(parsed.error)
    const input = parsed.data
    let doomed: ScheduleEntry[]
    if (input.ids && input.ids.length > 0) {
      const wanted = new Set(input.ids)
      // "Rest Days will not be Deleted."
      doomed = scheduleEntries
        .all()
        .filter((entry) => wanted.has(entry.id) && entry.kind === 'shift')
    } else {
      const { startDate, endDate } = input
      if (!startDate || !endDate) {
        return fieldError(422, 'VALIDATION_FAILED', 'startDate', 'Give shift ids or a date range.')
      }
      if (!input.allEmployees && input.employeeIds.length === 0) {
        return fieldError(
          422,
          'VALIDATION_FAILED',
          'employeeIds',
          'Select employees, or all employees.',
        )
      }
      const chosen = new Set(input.employeeIds)
      doomed = scheduleEntries
        .all()
        .filter(
          (entry) =>
            entry.date >= startDate &&
            entry.date <= endDate &&
            (input.allEmployees || chosen.has(entry.employeeId)) &&
            (input.deleteRestDays || entry.kind === 'shift'),
        )
    }
    doomed.forEach((entry) => scheduleEntries.remove(entry.id))
    return HttpResponse.json<ApiItem<BulkDeleteResult>>({
      data: {
        deletedSchedules: doomed.filter((entry) => entry.kind === 'shift').length,
        deletedRestDays: doomed.filter((entry) => entry.kind === 'rest').length,
      },
    })
  }),

  http.post(base('/schedules/bulk-edit'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, bulkEditSchema)
    if (!parsed.success) return invalid(parsed.error)
    const input = parsed.data
    const slot = input.timeSlotId ? timeSlots.find(input.timeSlotId) : undefined
    if (input.timeSlotId && !slot) {
      return fieldError(422, 'VALIDATION_FAILED', 'timeSlotId', 'The time slot was not found.')
    }
    let updated = 0
    const now = new Date().toISOString()
    for (const shiftId of input.ids) {
      const entry = scheduleEntries.find(shiftId)
      if (entry?.kind !== 'shift') continue
      // A new slot brings its times and breaks; the rest stays.
      const current = slot
        ? {
            ...entry,
            ...shiftRecord({
              employeeId: entry.employeeId,
              date: entry.date,
              slot,
              rosterGroupId: entry.rosterGroupId,
              geoFenceId: entry.geoFenceIds[0],
              isWfh: entry.workFromHome,
              breaks: null,
              batchId: entry.batchId,
            }),
          }
        : entry
      scheduleEntries.update(entry.id, {
        ...current,
        geoFenceIds: input.clearGeoFence
          ? []
          : input.geoFenceId
            ? [input.geoFenceId]
            : current.geoFenceIds,
        workFromHome: input.isWfh ?? current.workFromHome,
        updatedAt: now,
      })
      updated += 1
    }
    return HttpResponse.json<ApiItem<BulkEditResult>>({ data: { updatedSchedules: updated } })
  }),

  http.post(base('/schedules'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, scheduleSchema)
    if (!parsed.success) return invalid(parsed.error)
    const input = parsed.data
    const employeeId = input.employeeId ?? ''
    if (!findEmployee(employeeId)) {
      return fieldError(422, 'VALIDATION_FAILED', 'employeeId', 'Select the employee.')
    }
    const slot = timeSlots.find(input.timeSlotId)
    if (!slot)
      return fieldError(422, 'VALIDATION_FAILED', 'timeSlotId', 'The time slot was not found.')
    if (restOn(employeeId, input.workDate)) {
      return fieldError(409, 'REST_DAY', 'workDate', 'This date is a rest day for the employee.')
    }
    if (shiftOn(employeeId, input.workDate)) {
      return fieldError(
        409,
        'SCHEDULE_DAY_TAKEN',
        'workDate',
        'The employee already has a shift on this date.',
      )
    }
    const entry = insertShift(
      shiftRecord({
        employeeId,
        date: input.workDate,
        slot,
        rosterGroupId: null,
        clockIn: input.startTime,
        clockOut: input.endTime,
        geoFenceId: input.geoFenceId,
        isWfh: input.isWfh,
        breaks: input.breaks,
        batchId: createId('batch'),
      }),
    )
    return HttpResponse.json<ApiItem<ScheduleDetail>>({ data: toDetail(entry) }, { status: 201 })
  }),

  http.get(base('/schedules/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const entry = scheduleEntries.find(String(params.id))
    if (entry?.kind !== 'shift') return notFound()
    return HttpResponse.json<ApiItem<ScheduleDetail>>({ data: toDetail(entry) })
  }),

  http.put(base('/schedules/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const entry = scheduleEntries.find(String(params.id))
    if (entry?.kind !== 'shift') return notFound()
    const parsed = await readBody(request, scheduleSchema)
    if (!parsed.success) return invalid(parsed.error)
    const input = parsed.data
    const slot = timeSlots.find(input.timeSlotId)
    if (!slot)
      return fieldError(422, 'VALIDATION_FAILED', 'timeSlotId', 'The time slot was not found.')
    if (input.rowVersion && input.rowVersion !== rowVersionOf(entry.updatedAt)) {
      return errorResponse(409, 'Someone else changed this shift. Reload it.', {
        code: 'CONCURRENCY',
      })
    }
    if (input.workDate !== entry.date) {
      if (restOn(entry.employeeId, input.workDate)) {
        return fieldError(409, 'REST_DAY', 'workDate', 'This date is a rest day for the employee.')
      }
      if (shiftOn(entry.employeeId, input.workDate)) {
        return fieldError(
          409,
          'SCHEDULE_DAY_TAKEN',
          'workDate',
          'The employee already has a shift on this date.',
        )
      }
    }
    const next: ScheduleEntry = {
      ...entry,
      ...shiftRecord({
        employeeId: entry.employeeId,
        date: input.workDate,
        slot,
        rosterGroupId: entry.rosterGroupId,
        clockIn: input.startTime,
        clockOut: input.endTime,
        geoFenceId: input.geoFenceId,
        isWfh: input.isWfh,
        breaks: input.breaks,
        batchId: entry.batchId,
      }),
      updatedAt: new Date().toISOString(),
    }
    scheduleEntries.update(entry.id, next)
    return HttpResponse.json<ApiItem<ScheduleDetail>>({ data: toDetail(next) })
  }),

  http.delete(base('/schedules/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const entry = scheduleEntries.find(String(params.id))
    if (entry?.kind !== 'shift') return notFound()
    scheduleEntries.remove(entry.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(base('/schedules/:id/swap'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const source = scheduleEntries.find(String(params.id))
    if (source?.kind !== 'shift') return notFound()
    const parsed = await readBody(request, swapSchema)
    if (!parsed.success) return invalid(parsed.error)
    const { withScheduleId, withEmployeeId } = parsed.data
    const now = new Date().toISOString()
    if (withScheduleId) {
      const other = scheduleEntries.find(withScheduleId)
      if (other?.kind !== 'shift') return notFound()
      scheduleEntries.update(other.id, { ...other, employeeId: source.employeeId, updatedAt: now })
      const moved = { ...source, employeeId: other.employeeId, updatedAt: now }
      scheduleEntries.update(source.id, moved)
      return HttpResponse.json<ApiItem<ScheduleDetail>>({ data: toDetail(moved) })
    }
    if (!withEmployeeId || !findEmployee(withEmployeeId)) {
      return fieldError(422, 'VALIDATION_FAILED', 'withEmployeeId', 'Pick a shift or an employee.')
    }
    if (restOn(withEmployeeId, source.date)) {
      return fieldError(409, 'REST_DAY', 'withEmployeeId', 'That date is a rest day for them.')
    }
    if (shiftOn(withEmployeeId, source.date)) {
      return fieldError(
        409,
        'SCHEDULE_DAY_TAKEN',
        'withEmployeeId',
        'They already have a shift on this date.',
      )
    }
    const given = { ...source, employeeId: withEmployeeId, updatedAt: now }
    scheduleEntries.update(source.id, given)
    return HttpResponse.json<ApiItem<ScheduleDetail>>({ data: toDetail(given) })
  }),

  http.get(base('/options/time-slots'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    return options(
      timeSlots
        .all()
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((slot) =>
          option({
            id: slot.id,
            name: slot.name,
            code: slot.code,
            startTime: apiTime(slot.startTime),
            endTime: apiTime(slot.endTime),
            isOvernight: isOvernightSlot(slot),
            isFlexible: slot.isFlexible,
          }),
        ),
    )
  }),

  http.get(base('/options/break-types'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    return options(breakTypes.all().map((type) => option({ id: type.id, name: type.name })))
  }),

  http.get(base('/options/roster-groups'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    return options(
      rosterGroups
        .all()
        .filter((group) => group.isActive)
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((group) => option({ id: group.id, name: group.title })),
    )
  }),
]
