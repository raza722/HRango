import { format } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  type ClockState,
  DAY_STATUS_META,
  type DayDetail,
  type DaysOverview,
  formatSheetDate,
  type HistoryEntry,
  type OverviewPage,
  type OverviewRow,
  type TimeSheetDay as WireDay,
  weekdayName,
} from '@/features/attendance'
import { eachDay } from '@/features/scheduling'
import type { ApiItem, Paginated } from '@/types/api'

import { lookupPage, toEmployeeLookup } from '../employees/lookup'
import { DIRECTORY, type DirectoryEmployee, findEmployee } from '../employees/seed'
import { CURRENT_EMPLOYEE_ID, profileOf } from '../scheduling/seed'
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
  dayVersion,
  fromWire,
  toSummary,
  toWireBreak,
  toWireDay,
  toWirePunch,
  wire,
  wireStatus,
} from './backend'
import {
  attendanceEdits,
  attendanceHistory,
  attendancePunches,
  type DayEdit,
  dayId,
  personRef,
} from './db'
import { computeRange, monthRange, type Snapshot, takeSnapshot } from './engine'
import { breakTypes, currentSettings } from './settings-db'

export { resetAttendanceDb } from './db'

/**
 * The attendance API as the backend has it (`app/routers/attendance.py`): overview, time sheet
 * (+ summary, export, process), days (+ history), clock. The engine builds the days from the
 * Scheduling mock; `backend.ts` puts them into the API's shapes.
 */

const base = (path: string) => apiPath(`/attendance${path}`)
const invalid = (message: string, fieldErrors?: Record<string, string>) =>
  errorResponse(422, message, {
    code: 'VALIDATION_FAILED',
    ...(fieldErrors ? { fieldErrors } : {}),
  })
const notFound = (what = 'Time sheet day') =>
  errorResponse(404, `${what} not found`, { code: 'NOT_FOUND' })

/** Longest time sheet range (a year), as the API allows. */
const MAX_SHEET_DAYS = 366

async function readBody<T>(request: Request, schema: z.ZodType<T>) {
  const body: unknown = await request.json().catch(() => null)
  return schema.safeParse(body)
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
/** `yyyy-MM-ddTHH:mm[:ss]`. */
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/)

const editSchema = z.object({
  expectedIn: localDateTime.nullable().optional(),
  expectedOut: localDateTime.nullable().optional(),
  firstIn: localDateTime.nullable().optional(),
  lastOut: localDateTime.nullable().optional(),
  markedStatus: z.enum(['absent', 'half_day', 'short_day']).nullable().optional(),
  comments: z.string().max(4000).nullable().optional(),
  breaks: z
    .array(
      z.object({
        breakTypeId: z.string().nullable().optional(),
        outAt: localDateTime,
        inAt: localDateTime.nullable().optional(),
      }),
    )
    .max(50)
    .default([]),
  rowVersion: z.string().nullable().optional(),
})

const ok = <T>(data: T) => HttpResponse.json<ApiItem<T>>({ data })

// --- people and days -------------------------------------------------------------------

type Tab = 'my' | 'subordinates' | 'all'

const tabOf = (url: URL, fallback: Tab): Tab => {
  const tab = url.searchParams.get('tab')
  return tab === 'my' || tab === 'subordinates' || tab === 'all' ? tab : fallback
}

/** `PM Design Team` matches `PM Design Team`, `pm-design-team` or `dep_pm_design_team`. */
function sameDepartment(name: string, id: string): boolean {
  const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '')
  return slug(id).endsWith(slug(name))
}

/** The people a tab and the filters reach. */
function people(url: URL, tab: Tab): DirectoryEmployee[] {
  const param = (key: string) => url.searchParams.get(key) ?? ''
  const search = param('q').trim().toLowerCase()
  return DIRECTORY.filter((employee) => {
    const profile = profileOf(employee)
    if (tab === 'my' && employee.id !== CURRENT_EMPLOYEE_ID) return false
    if (tab === 'subordinates' && profile.managerId !== CURRENT_EMPLOYEE_ID) return false
    if (param('employeeStatus') && profile.status !== param('employeeStatus')) return false
    if (param('employeeId') && employee.id !== param('employeeId')) return false
    // The directory has department names only: the mock matches the id against the name.
    if (param('departmentId') && !sameDepartment(employee.department, param('departmentId'))) {
      return false
    }
    return (
      !search ||
      [employee.name, profile.code, employee.jobTitle].some((text) =>
        text.toLowerCase().includes(search),
      )
    )
  })
}

/** Text the time sheet search box matches. */
function searchText(row: WireDay): string {
  return [
    row.employeeName,
    row.employeeCode,
    formatSheetDate(row.workDate),
    weekdayName(row.workDate),
    row.timeSlotName ?? '',
    DAY_STATUS_META[row.dayStatus].label,
  ]
    .join(' ')
    .toLowerCase()
}

function sheetDays(snap: Snapshot, employees: DirectoryEmployee[], from: string, to: string) {
  return employees.flatMap((employee) =>
    computeRange(snap, employee.id, from, to).map((item) => toWireDay(item, employee)),
  )
}

/** Reads fromDate / toDate; an error response when they are missing or too far apart. */
function readRange(url: URL, maxDays: number) {
  const from = url.searchParams.get('fromDate') ?? ''
  const to = url.searchParams.get('toDate') ?? ''
  if (!day.safeParse(from).success || !day.safeParse(to).success) {
    return { error: invalid('Give fromDate and toDate.', { fromDate: 'Field required' }) }
  }
  if (to < from) {
    return { error: invalid('The end date is before the start date.', { toDate: 'Too early' }) }
  }
  if (eachDay(from, to).length > maxDays) {
    return { error: invalid(`Choose at most ${maxDays} days.`, { toDate: 'Too far' }) }
  }
  return { from, to }
}

function filteredSheet(url: URL, fallbackTab: Tab, from: string, to: string) {
  const dayStatus = url.searchParams.get('dayStatus')
  const flag = url.searchParams.get('flag')
  const search = (url.searchParams.get('q') ?? '').trim().toLowerCase()
  // q matches people first; when it names nobody, it searches the days instead.
  const reached = people(url, tabOf(url, fallbackTab))
  const withoutQ = new URL(url)
  withoutQ.searchParams.delete('q')
  const set = reached.length > 0 || !search ? reached : people(withoutQ, tabOf(url, fallbackTab))
  return sheetDays(takeSnapshot(), set, from, to)
    .filter((row) => !dayStatus || row.dayStatus === dayStatus)
    .filter((row) => !flag || row.flags.includes(flag as WireDay['flags'][number]))
    .filter((row) => reached.length > 0 || !search || searchText(row).includes(search))
    .sort(
      (a, b) =>
        b.workDate.localeCompare(a.workDate) || a.employeeName.localeCompare(b.employeeName),
    )
}

/** Finds the person and day of a `/days/:employeeId/:date` request. */
function resolveDay(params: Record<string, string | readonly string[] | undefined>) {
  const employeeId = typeof params.employeeId === 'string' ? params.employeeId : ''
  const date = typeof params.date === 'string' ? params.date : ''
  const employee = findEmployee(employeeId)
  if (!employee || !day.safeParse(date).success) return null
  return { employee, date }
}

function detailOf(employee: DirectoryEmployee, date: string): DayDetail | null {
  const computed = computeRange(takeSnapshot(), employee.id, date, date)[0]
  if (!computed) return null
  const wireDay = toWireDay(computed, employee)
  return {
    day: wireDay,
    flags: wireDay.flags.map((flag) => ({
      flag,
      minutes:
        flag === 'late' || flag === 'grace'
          ? wireDay.lateMinutes
          : flag === 'early'
            ? wireDay.earlyLeftMinutes
            : flag === 'overtime'
              ? wireDay.overtimeAfterMinutes
              : null,
    })),
    breaks: computed.breaks.map(toWireBreak),
    punches: computed.logs.map((log) => toWirePunch(log, employee)),
  }
}

function writeEdit(employeeId: string, date: string, patch: Partial<DayEdit>): void {
  const id = dayId(employeeId, date)
  const existing = attendanceEdits.find(id)
  const next: DayEdit = {
    ...(existing ?? { id, employeeId, date }),
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  if (existing) attendanceEdits.update(id, next)
  else attendanceEdits.insert(next)
}

/** One audit line per changed field, as `core.audit_log` keeps them. */
function audit(
  employeeId: string,
  date: string,
  field: string,
  from: string | null,
  to: string | null,
) {
  attendanceHistory.insert({
    id: createId('ah'),
    employeeId,
    date,
    editedBy: personRef(CURRENT_EMPLOYEE_ID),
    action: field,
    detail: JSON.stringify([from, to]),
    at: new Date().toISOString(),
  })
}

/** A stored history line as `HistoryOut` (older seed lines carry free text). */
function toWireHistory(entry: ReturnType<typeof attendanceHistory.all>[number]): HistoryEntry {
  let oldValue: string | null = null
  let newValue: string | null = null
  let fieldName: string | null = null
  try {
    const parsed: unknown = entry.detail ? JSON.parse(entry.detail) : null
    if (Array.isArray(parsed) && parsed.length === 2) {
      oldValue = typeof parsed[0] === 'string' ? parsed[0] : null
      newValue = typeof parsed[1] === 'string' ? parsed[1] : null
      fieldName = entry.action
    }
  } catch {
    // An older free-text line: only its action is shown.
  }
  return {
    id: entry.id,
    fieldName,
    oldValue,
    newValue,
    actionName: fieldName ? 'update' : entry.action,
    // The API sends UTC without a zone.
    performedAt: entry.at.replace(/\.\d+Z$|Z$/, ''),
    performedByUserId: entry.editedBy.id,
    performedByName: entry.editedBy.name,
  }
}

function csv(rows: (string | number | null)[][], fileName: string) {
  const quote = (value: string | number | null) => {
    const text = value === null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return new HttpResponse(rows.map((row) => row.map(quote).join(',')).join('\n') + '\n', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}

// --- clock -------------------------------------------------------------------------------

function todaysClockPunches() {
  const today = format(new Date(), 'yyyy-MM-dd')
  return attendancePunches
    .all()
    .filter(
      (punch) =>
        punch.employeeId === CURRENT_EMPLOYEE_ID &&
        punch.date === today &&
        (punch.type === 'check-in' || punch.type === 'check-out'),
    )
    .reverse()
    .sort((a, b) => a.at.localeCompare(b.at))
}

function clockState(): ClockState {
  const basic = currentSettings().basic
  const me = findEmployee(CURRENT_EMPLOYEE_ID)
  const last = todaysClockPunches().at(-1)
  const clockedIn = last?.type === 'check-in'
  return {
    allowed: basic.dashboardPunch,
    reason: basic.dashboardPunch
      ? null
      : 'Clocking in from the dashboard is switched off. Use the attendance machine.',
    photoRequired: basic.pictureOnDashboardPunch,
    locationRequired: false,
    employeeId: CURRENT_EMPLOYEE_ID,
    employeeName: me?.name ?? null,
    now: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
    clockedIn,
    nextPunchType: clockedIn ? 'check_out' : 'check_in',
    lastPunchType: last ? (last.type === 'check-in' ? 'check_in' : 'check_out') : null,
    lastPunchedAt: last ? wire(last.at) : null,
    expectedIn: null,
    expectedOut: null,
  }
}

// --- handlers ----------------------------------------------------------------------------

/** Permission codes of the attendance screens (and their settings tabs). */
const ATTENDANCE_CODE = /^(attendance|scheduling\.settings)\./

export const attendanceHandlers = [
  /**
   * `GET /employees/lookup` for the attendance screens' pickers: the directory people the
   * attendance mock works with. Other screens' lookups fall through to their own mocks.
   */
  http.get(apiPath('/employees/lookup'), async ({ request }) => {
    const url = new URL(request.url)
    if (!ATTENDANCE_CODE.test(url.searchParams.get('permission') ?? '')) return undefined
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const branchName = (id: string | null) => (id ? (branches.find(id)?.name ?? '') : '')
    // Former staff only with `includeInactive=true`, as the API does.
    const includeInactive = url.searchParams.get('includeInactive') === 'true'
    const rows = DIRECTORY.map((employee) => ({
      ...toEmployeeLookup(employee, branchName),
      code: profileOf(employee).code,
      status: profileOf(employee).status,
    }))
      .filter((row) => includeInactive || row.status === 'active')
      .sort((a, b) => a.name.localeCompare(b.name))
    return HttpResponse.json(lookupPage(rows, url))
  }),

  http.get(base('/overview'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const month = url.searchParams.get('month') ?? ''
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return invalid('Month must be yyyy-mm.', { month: 'Month must be yyyy-mm.' })
    }
    const snap = takeSnapshot()
    const { from, to } = monthRange(month)
    const { page, pageSize } = readPageParams(url)
    const result = paginate(people(url, tabOf(url, 'all')), page, pageSize)
    const rows = result.data.map((employee): OverviewRow => {
      const days = computeRange(snap, employee.id, from, to)
        .filter((item) => item.day.status !== null)
        .map((item) => toWireDay(item, employee))
      const count = (test: (row: WireDay) => boolean) => days.filter(test).length
      return {
        employeeId: employee.id,
        employeeCode: profileOf(employee).code,
        employeeName: employee.name,
        departmentName: employee.department,
        designationName: employee.jobTitle,
        employeeStatus: profileOf(employee).status,
        totals: {
          totalDays: days.length,
          present: count((row) => row.dayStatus === 'present' || row.dayStatus === 'wfh'),
          absent: count((row) => row.dayStatus === 'absent'),
          holiday: count((row) => row.dayStatus === 'holiday'),
          daysOff: count((row) => row.dayStatus === 'weekend' || row.dayStatus === 'rest_day'),
          leave: count((row) => row.dayStatus === 'leave'),
          lateArrival: count((row) => row.flags.includes('late')),
          earlyLeft: count((row) => row.flags.includes('early')),
        },
        days: Object.fromEntries(days.map((row) => [row.workDate, row.dayStatus])),
      }
    })
    return HttpResponse.json<OverviewPage>({ ...result, data: rows, days: eachDay(from, to) })
  }),

  http.get(base('/overview/export'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const month = url.searchParams.get('month') ?? ''
    if (!/^\d{4}-\d{2}$/.test(month)) return invalid('Month must be yyyy-mm.')
    const snap = takeSnapshot()
    const { from, to } = monthRange(month)
    const dates = eachDay(from, to)
    const rows = people(url, tabOf(url, 'all')).map((employee) => {
      const statuses = new Map(
        computeRange(snap, employee.id, from, to).map((item) => [
          item.day.date,
          item.day.status ? wireStatus(item.day.status) : null,
        ]),
      )
      return [
        profileOf(employee).code,
        employee.name,
        employee.department,
        ...dates.map((date) => statuses.get(date) ?? null),
      ]
    })
    return csv(
      [['Employee Code', 'Employee Name', 'Department', ...dates], ...rows],
      `attendance-overview-${month}.csv`,
    )
  }),

  http.get(base('/time-sheet'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const range = readRange(url, MAX_SHEET_DAYS)
    if (range.error) return range.error
    const rows = filteredSheet(url, 'my', range.from, range.to)
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json<Paginated<WireDay>>(paginate(rows, page, pageSize))
  }),

  http.get(base('/time-sheet/export'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const range = readRange(url, MAX_SHEET_DAYS)
    if (range.error) return range.error
    const rows = filteredSheet(url, 'all', range.from, range.to)
    return csv(
      [
        ['Employee Code', 'Employee Name', 'Department', 'Date', 'Time Slot', 'Clock In'],
        ...rows.map((row) => [
          row.employeeCode,
          row.employeeName,
          row.departmentName,
          row.workDate,
          row.timeSlotName,
          row.firstIn,
        ]),
      ],
      `time-sheet-${range.from}-${range.to}.csv`,
    )
  }),

  http.get(base('/time-sheet/summary'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const range = readRange(url, MAX_SHEET_DAYS)
    if (range.error) return range.error
    const reached = people(url, tabOf(url, 'my'))
    const days = sheetDays(takeSnapshot(), reached, range.from, range.to)
    return ok<DaysOverview>(toSummary(days, range.from, range.to, reached.length))
  }),

  http.post(base('/time-sheet/process'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(
      request,
      z.object({
        fromDate: day,
        toDate: day,
        employeeIds: z
          .array(z.union([z.string(), z.number()]))
          .nullable()
          .optional(),
        overwriteManual: z.boolean().optional(),
      }),
    )
    if (!parsed.success || parsed.data.toDate < parsed.data.fromDate) {
      return invalid('Choose a date range.', { toDate: 'The end date is before the start date.' })
    }
    const { fromDate, toDate, employeeIds } = parsed.data
    const employees = employeeIds?.length ?? DIRECTORY.length
    return ok({ processedDays: employees * eachDay(fromDate, toDate).length, employees })
  }),

  http.get(base('/clock'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    return ok<ClockState>(clockState())
  }),

  http.post(base('/clock'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const state = clockState()
    if (!state.allowed) {
      return errorResponse(403, state.reason ?? 'Not allowed.', { code: 'DASHBOARD_PUNCH_OFF' })
    }
    const parsed = await readBody(
      request,
      z.object({
        punchType: z.enum(['check_in', 'check_out']).nullable().optional(),
        photoFileId: z.union([z.string(), z.number()]).nullable().optional(),
      }),
    )
    const body = parsed.success ? parsed.data : {}
    if (state.photoRequired && !body.photoFileId) {
      return invalid('Take a picture to clock in.', { photoFileId: 'Take a picture to clock in.' })
    }
    const type = (body.punchType ?? state.nextPunchType) === 'check_out' ? 'check-out' : 'check-in'
    const now = new Date()
    const punch = attendancePunches.insert({
      id: createId('pl'),
      employeeId: CURRENT_EMPLOYEE_ID,
      date: format(now, 'yyyy-MM-dd'),
      type,
      at: format(now, "yyyy-MM-dd'T'HH:mm"),
      description: '',
      source: 'dashboard',
      machineId: null,
      manuallyUpdated: false,
    })
    const me = findEmployee(CURRENT_EMPLOYEE_ID)
    if (!me) return notFound('Employee')
    return HttpResponse.json({ data: toWirePunch(punch, me) }, { status: 201 })
  }),

  http.get(base('/days/:employeeId/:date'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const target = resolveDay(params)
    if (!target) return notFound('Employee')
    const detail = detailOf(target.employee, target.date)
    return detail ? ok<DayDetail>(detail) : notFound()
  }),

  http.put(base('/days/:employeeId/:date'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const target = resolveDay(params)
    if (!target) return notFound('Employee')
    const { employee, date } = target
    if (employee.id === CURRENT_EMPLOYEE_ID) {
      return errorResponse(403, 'You cannot edit your own time sheet.', { code: 'FORBIDDEN' })
    }
    const parsed = await readBody(request, editSchema)
    if (!parsed.success) return invalid('Some fields are not valid.')
    const input = parsed.data
    if (input.rowVersion !== dayVersion(employee.id, date)) {
      return errorResponse(409, 'Someone else changed this day. Reload it and try again', {
        code: 'CONFLICT',
      })
    }
    if (input.firstIn && input.lastOut && input.lastOut <= input.firstIn) {
      return invalid('Check out must be after check in.', {
        lastOut: 'Check out must be after check in.',
      })
    }
    if (input.breaks.some((item) => item.inAt && item.inAt <= item.outAt)) {
      return invalid('Each break needs a break-out time, and its break-in after it.', {
        breaks: 'Each break needs a break-out time, and its break-in after it.',
      })
    }
    if (input.breaks.some((item) => item.breakTypeId && !breakTypes.find(item.breakTypeId))) {
      return invalid('Break type not found.', { breaks: 'Break type not found.' })
    }

    const before = detailOf(employee, date)
    const absent = input.markedStatus === 'absent'
    const toLocal = (value: string | null | undefined) => (value ? fromWire(value) : null)
    writeEdit(employee.id, date, {
      checkIn: absent ? null : toLocal(input.firstIn),
      checkOut: absent ? null : toLocal(input.lastOut),
      markAbsent: absent,
      markHalfDay: input.markedStatus === 'half_day',
      markShortDay: input.markedStatus === 'short_day',
      breaks: input.breaks.map((item) => ({
        type: item.breakTypeId ?? '',
        outAt: fromWire(item.outAt),
        inAt: toLocal(item.inAt),
        description: '',
      })),
      comments: input.comments ?? null,
      status: undefined,
    })
    if (before) {
      const was = before.day
      const changes: [string, string | null, string | null][] = [
        ['first_in', was.firstIn, input.firstIn ? wire(fromWire(input.firstIn)) : null],
        ['last_out', was.lastOut, input.lastOut ? wire(fromWire(input.lastOut)) : null],
        ['marked_status', was.markedStatus, input.markedStatus ?? null],
        ['comments', was.comments, input.comments ?? null],
      ]
      for (const [field, from, to] of changes) {
        if (from !== to) audit(employee.id, date, field, from, to)
      }
    }
    const detail = detailOf(employee, date)
    return detail ? ok<DayDetail>(detail) : notFound()
  }),

  http.get(base('/days/:employeeId/:date/history'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const target = resolveDay(params)
    if (!target) return notFound('Employee')
    const { page, pageSize } = readPageParams(new URL(request.url))
    const entries = attendanceHistory
      .all()
      .filter((item) => item.employeeId === target.employee.id && item.date === target.date)
      .sort((a, b) => b.at.localeCompare(a.at))
      .map(toWireHistory)
    return HttpResponse.json<Paginated<HistoryEntry>>(paginate(entries, page, pageSize))
  }),
]
