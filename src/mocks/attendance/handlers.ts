import { format } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  ABSENCE_MARK_LABELS,
  ABSENCE_MARKS,
  type AttendanceComment,
  type AttendanceLookups,
  type ClockState,
  DAY_STATUS_META,
  type DayDetail,
  type DaysOverview,
  formatClockTime,
  formatDuration,
  formatSheetDate,
  type HistoryEntry,
  isLocalDateTime,
  type LocalDateTime,
  type OverviewPage,
  type OverviewRow,
  PRESENT_STATUSES,
  PUNCH_STATUS_META,
  type PunchLog,
  type TimeSheetData,
  type TimeSheetDay,
  weekdayName,
} from '@/features/attendance'
import { eachDay } from '@/features/scheduling'
import type { ApiItem, Paginated } from '@/types/api'

import { DIRECTORY, type DirectoryEmployee, findEmployee } from '../employees/seed'
import { CURRENT_EMPLOYEE_ID, profileOf } from '../scheduling/seed'
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
  attendanceComments,
  attendanceEdits,
  attendanceHistory,
  attendancePunches,
  type DayEdit,
  dayId,
  personRef,
} from './db'
import { computeRange, daysOverview, monthRange, takeSnapshot } from './engine'
import { toAttendanceEmployee, toProfile } from './seed'
import { breakTypes, currentSettings } from './settings-db'

export { resetAttendanceDb } from './db'

const base = (path: string) => apiPath(`/attendance${path}`)
const invalid = (message: string, fieldErrors?: Record<string, string>) =>
  errorResponse(422, message, {
    code: 'VALIDATION_FAILED',
    ...(fieldErrors ? { fieldErrors } : {}),
  })
const notFound = () => errorResponse(404, 'That day could not be found.', { code: 'NOT_FOUND' })

/** Longest time sheet range served at once. */
const MAX_RANGE_DAYS = 93

async function readBody<T>(request: Request, schema: z.ZodType<T>) {
  const body: unknown = await request.json().catch(() => null)
  return schema.safeParse(body)
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const localDateTime = z.string().refine(isLocalDateTime, 'Use yyyy-MM-ddTHH:mm')

const breakSchema = z.object({
  type: z.string().min(1, 'Choose a break type'),
  outAt: localDateTime,
  inAt: localDateTime.nullable(),
  description: z.string().trim().max(200),
})

const editSchema = z.object({
  checkIn: localDateTime.nullable(),
  checkOut: localDateTime.nullable(),
  markAbsent: z.boolean(),
  markHalfDay: z.boolean(),
  markShortDay: z.boolean(),
  breaks: z.array(breakSchema).max(20),
})

const reason = z.string().trim().min(1).max(500)

// --- helpers -------------------------------------------------------------------

const EDITOR = () => personRef(CURRENT_EMPLOYEE_ID)
const timeText = (value: LocalDateTime | null | undefined) => (value ? formatClockTime(value) : '—')

function record(employeeId: string, date: string, action: string, detail: string | null) {
  attendanceHistory.insert({
    id: createId('ah'),
    employeeId,
    date,
    editedBy: EDITOR(),
    action,
    detail,
    at: new Date().toISOString(),
  })
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

/** The computed day, with this month's warnings applied. */
function dayOf(employeeId: string, date: string) {
  return computeRange(takeSnapshot(), employeeId, date, date)[0]
}

/** Finds the person and day of a `/days/:employeeId/:date` request. */
function resolveDay(params: Record<string, string | readonly string[] | undefined>) {
  const employeeId = typeof params.employeeId === 'string' ? params.employeeId : ''
  const date = typeof params.date === 'string' ? params.date : ''
  const employee = findEmployee(employeeId)
  if (!employee || !day.safeParse(date).success) return null
  return { employee, date }
}

function filterPeople(url: URL, scope: string): DirectoryEmployee[] {
  const param = (key: string) => url.searchParams.get(key) ?? ''
  const search = param('search').trim().toLowerCase()
  return DIRECTORY.filter((employee) => {
    const profile = profileOf(employee)
    if (scope === 'subordinates' && profile.managerId !== CURRENT_EMPLOYEE_ID) return false
    if (param('status') && profile.status !== param('status')) return false
    if (param('employeeId') && employee.id !== param('employeeId')) return false
    if (param('department') && employee.department !== param('department')) return false
    return (
      !search ||
      [employee.name, profile.code, employee.jobTitle].some((text) =>
        text.toLowerCase().includes(search),
      )
    )
  })
}

/** Text the time sheet search box matches: date, weekday, slot and statuses. */
function searchText(row: TimeSheetDay): string {
  return [
    formatSheetDate(row.date),
    weekdayName(row.date),
    row.slotName ?? '',
    row.status ? DAY_STATUS_META[row.status].label : '',
    row.clockInStatus ? PUNCH_STATUS_META[row.clockInStatus].label : '',
    row.clockOutStatus ? PUNCH_STATUS_META[row.clockOutStatus].label : '',
  ]
    .join(' ')
    .toLowerCase()
}

const ok = <T>(data: T) => HttpResponse.json<ApiItem<T>>({ data })

// --- handlers ------------------------------------------------------------------

export const attendanceHandlers = [
  http.get(base('/overview'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const snap = takeSnapshot()
    const month = /^\d{4}-\d{2}$/.test(url.searchParams.get('month') ?? '')
      ? (url.searchParams.get('month') ?? '')
      : snap.today.slice(0, 7)
    const { from, to } = monthRange(month)
    const { page, pageSize } = readPageParams(url)
    const people = filterPeople(url, url.searchParams.get('scope') ?? 'all')
    const result = paginate(people, page, pageSize)

    const rows = result.data.map((employee): OverviewRow => {
      const days = computeRange(snap, employee.id, from, to).map((item) => item.day)
      const statuses = Object.fromEntries(days.map((item) => [item.date, item.status]))
      return {
        employee: toAttendanceEmployee(employee),
        totals: {
          totalDays: days.length,
          absent: days.filter((item) => item.status === 'absent').length,
          holiday: days.filter((item) => item.status === 'holiday').length,
          present: days.filter((item) => item.status !== null && PRESENT_STATUSES.has(item.status))
            .length,
        },
        days: statuses,
      }
    })
    return HttpResponse.json<OverviewPage>({ ...result, data: rows, days: eachDay(from, to) })
  }),

  http.get(base('/time-sheet'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const snap = takeSnapshot()
    const employee = findEmployee(url.searchParams.get('employeeId') ?? CURRENT_EMPLOYEE_ID)
    if (!employee) return errorResponse(404, 'That employee could not be found.')
    const from = url.searchParams.get('from') ?? `${snap.today.slice(0, 7)}-01`
    const to = url.searchParams.get('to') ?? snap.today
    if (!day.safeParse(from).success || !day.safeParse(to).success || to < from) {
      return invalid('Choose a From date on or before the To date.')
    }
    const dates = eachDay(from, to)
    if (dates.length > MAX_RANGE_DAYS) {
      return invalid(`Choose at most ${MAX_RANGE_DAYS} days at a time.`)
    }
    const search = (url.searchParams.get('search') ?? '').trim().toLowerCase()
    const rows = computeRange(snap, employee.id, from, to)
      .map((item) => item.day)
      .filter((row) => !search || searchText(row).includes(search))
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json<TimeSheetData>({
      ...paginate(rows, page, pageSize),
      employee: toAttendanceEmployee(employee),
    })
  }),

  http.get(base('/days-overview'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const employee = findEmployee(url.searchParams.get('employeeId') ?? CURRENT_EMPLOYEE_ID)
    if (!employee) return errorResponse(404, 'That employee could not be found.')
    return ok<DaysOverview>(daysOverview(takeSnapshot(), employee.id))
  }),

  http.get(base('/lookups'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const employees = DIRECTORY.map(toAttendanceEmployee).sort((a, b) =>
      a.name.localeCompare(b.name),
    )
    return ok<AttendanceLookups>({
      employees,
      departments: [...new Set(DIRECTORY.map((employee) => employee.department))].sort((a, b) =>
        a.localeCompare(b),
      ),
    })
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
    if (!currentSettings().basic.dashboardPunch) {
      return errorResponse(
        403,
        'Punching from the dashboard is turned off in Attendance Settings.',
        {
          code: 'FORBIDDEN',
        },
      )
    }
    const now = new Date()
    const date = format(now, 'yyyy-MM-dd')
    const type = clockState().clockedIn ? 'check-out' : 'check-in'
    attendancePunches.insert({
      id: createId('pl'),
      employeeId: CURRENT_EMPLOYEE_ID,
      date,
      type,
      at: format(now, "yyyy-MM-dd'T'HH:mm"),
      description:
        type === 'check-in' ? 'Clock In from the dashboard' : 'Clock Out from the dashboard',
      source: 'dashboard',
      machineId: null,
      manuallyUpdated: false,
    })
    return ok<ClockState>(clockState())
  }),

  http.get(base('/days/:employeeId/:date'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const target = resolveDay(params)
    if (!target) return notFound()
    const computed = dayOf(target.employee.id, target.date)
    if (!computed) return notFound()
    const comments = attendanceComments
      .all()
      .filter((item) => item.employeeId === target.employee.id && item.date === target.date)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(({ id, author, text, createdAt }): AttendanceComment => ({
        id,
        author,
        text,
        createdAt,
      }))
    const edit = attendanceEdits.find(dayId(target.employee.id, target.date))
    return ok<DayDetail>({
      day: computed.day,
      profile: toProfile(target.employee),
      breaks: computed.breaks,
      comments,
      marks: {
        absent: edit?.markAbsent ?? false,
        halfDay: edit?.markHalfDay ?? false,
        shortDay: edit?.markShortDay ?? false,
      },
    })
  }),

  http.put(base('/days/:employeeId/:date'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const target = resolveDay(params)
    if (!target) return notFound()
    const parsed = await readBody(request, editSchema)
    if (!parsed.success) return invalid('Some fields are not valid.')
    const input = parsed.data
    if (!input.markAbsent && input.checkIn && input.checkOut && input.checkOut <= input.checkIn) {
      return invalid('Check out must be after check in.', {
        checkOut: 'Check out must be after check in',
      })
    }
    const unknownType = input.breaks.findIndex((item) => !breakTypes.find(item.type))
    if (unknownType !== -1) {
      return invalid('That break type no longer exists.', {
        [`breaks.${unknownType}.type`]: 'Choose a break type',
      })
    }
    const badBreak = input.breaks.findIndex((item) => item.inAt !== null && item.inAt <= item.outAt)
    if (badBreak !== -1) {
      return invalid('A break ends before it starts.', {
        [`breaks.${badBreak}.inAt`]: 'Break in must be after break out',
      })
    }
    const outside = input.breaks.findIndex(
      (item) =>
        (input.checkIn !== null && item.outAt < input.checkIn) ||
        (input.checkOut !== null && item.inAt !== null && item.inAt > input.checkOut),
    )
    if (!input.markAbsent && outside !== -1) {
      return invalid('A break falls outside the check in and check out.', {
        [`breaks.${outside}.inAt`]: 'Keep the break between check in and check out',
      })
    }

    const before = dayOf(target.employee.id, target.date)
    const { employee, date } = target
    const changes: [string, string | null][] = []
    if (before) {
      if (!input.markAbsent && input.checkIn !== before.day.checkIn) {
        changes.push([
          'Updated Check In Time',
          `${timeText(before.day.checkIn)} → ${timeText(input.checkIn)}`,
        ])
      }
      if (!input.markAbsent && input.checkOut !== before.day.checkOut) {
        changes.push([
          'Updated Check Out Time',
          `${timeText(before.day.checkOut)} → ${timeText(input.checkOut)}`,
        ])
      }
      if (JSON.stringify(input.breaks) !== JSON.stringify(before.breaks)) {
        changes.push([
          'Updated Break Types',
          `${input.breaks.length} break${input.breaks.length === 1 ? '' : 's'}`,
        ])
      }
    }
    const previous = attendanceEdits.find(dayId(employee.id, date))
    const flag = (name: string, value: boolean, was: boolean | undefined) => {
      if (value !== (was ?? false))
        changes.push([value ? `Marked ${name}` : `Cleared ${name}`, null])
    }
    flag('Absent', input.markAbsent, previous?.markAbsent)
    flag('Half Day', input.markHalfDay, previous?.markHalfDay)
    flag('Short Day', input.markShortDay, previous?.markShortDay)

    writeEdit(employee.id, date, {
      checkIn: input.markAbsent ? (previous?.checkIn ?? null) : input.checkIn,
      checkOut: input.markAbsent ? (previous?.checkOut ?? null) : input.checkOut,
      markAbsent: input.markAbsent,
      markHalfDay: input.markHalfDay,
      markShortDay: input.markShortDay,
      breaks: input.breaks,
      status: undefined,
    })
    for (const [action, detail] of changes) record(employee.id, date, action, detail)
    return ok<TimeSheetDay | undefined>(dayOf(employee.id, date)?.day)
  }),

  http.post(base('/days/:employeeId/:date/missing-punch'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const target = resolveDay(params)
    if (!target) return notFound()
    const parsed = await readBody(
      request,
      z.object({ type: z.enum(['check-in', 'check-out']), at: localDateTime, reason }),
    )
    if (!parsed.success) return invalid('Enter the punch time and a reason.')
    const { type, at, reason: why } = parsed.data
    const current = dayOf(target.employee.id, target.date)?.day
    if (type === 'check-out' && current?.checkIn && at <= current.checkIn) {
      return invalid('Check out must be after check in.', {
        at: 'Check out must be after check in',
      })
    }
    if (type === 'check-in' && current?.checkOut && at >= current.checkOut) {
      return invalid('Check in must be before check out.', {
        at: 'Check in must be before check out',
      })
    }
    attendancePunches.insert({
      id: createId('pl'),
      employeeId: target.employee.id,
      date: target.date,
      type,
      at,
      description: why,
      source: 'manual',
      machineId: null,
      manuallyUpdated: true,
    })
    // A typed-in time on the same side would hide the new punch.
    const edit = attendanceEdits.find(dayId(target.employee.id, target.date))
    if (edit) {
      writeEdit(target.employee.id, target.date, {
        ...(type === 'check-in' ? { checkIn: undefined } : { checkOut: undefined }),
        markAbsent: false,
      })
    }
    record(
      target.employee.id,
      target.date,
      'Added Missing Punch',
      `${type === 'check-in' ? 'Check In' : 'Check Out'} ${formatClockTime(at)}`,
    )
    return ok<TimeSheetDay | undefined>(dayOf(target.employee.id, target.date)?.day)
  }),

  http.post(base('/days/:employeeId/:date/relaxation'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const target = resolveDay(params)
    if (!target) return notFound()
    const parsed = await readBody(request, z.object({ reason }))
    if (!parsed.success) return invalid('Enter a reason for the relaxation.')
    const current = dayOf(target.employee.id, target.date)?.day
    if (!current || (current.lateMinutes === 0 && current.earlyMinutes === 0)) {
      return invalid('There is nothing to relax on this day.')
    }
    writeEdit(target.employee.id, target.date, { relaxationReason: parsed.data.reason })
    const waived = [
      current.lateMinutes > 0 ? `${current.lateMinutes} late` : null,
      current.earlyMinutes > 0 ? `${current.earlyMinutes} early` : null,
    ]
      .filter(Boolean)
      .join(' and ')
    record(target.employee.id, target.date, 'Applied Relaxation', `${waived} minutes waived`)
    return ok<TimeSheetDay | undefined>(dayOf(target.employee.id, target.date)?.day)
  }),

  http.post(base('/days/:employeeId/:date/absence'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const target = resolveDay(params)
    if (!target) return notFound()
    const parsed = await readBody(request, z.object({ markAs: z.enum(ABSENCE_MARKS), reason }))
    if (!parsed.success) return invalid('Choose how to record the day and give a reason.')
    const { markAs } = parsed.data
    writeEdit(target.employee.id, target.date, { status: markAs, markAbsent: false })
    record(
      target.employee.id,
      target.date,
      `Marked as ${ABSENCE_MARK_LABELS[markAs]}`,
      parsed.data.reason,
    )
    return ok<TimeSheetDay | undefined>(dayOf(target.employee.id, target.date)?.day)
  }),

  http.post(base('/days/:employeeId/:date/overtime'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const target = resolveDay(params)
    if (!target) return notFound()
    const parsed = await readBody(
      request,
      z.object({ approvedMinutes: z.number().int().min(1).max(1440), reason }),
    )
    if (!parsed.success) return invalid('Enter the minutes to approve and a reason.')
    const current = dayOf(target.employee.id, target.date)?.day
    if (!current || parsed.data.approvedMinutes > current.overtimeMinutes) {
      return invalid('You can approve up to the overtime worked.', {
        approvedMinutes: `At most ${current?.overtimeMinutes ?? 0} minutes`,
      })
    }
    writeEdit(target.employee.id, target.date, {
      approvedOvertimeMinutes: parsed.data.approvedMinutes,
    })
    record(
      target.employee.id,
      target.date,
      'Approved Overtime',
      formatDuration(parsed.data.approvedMinutes),
    )
    return ok<TimeSheetDay | undefined>(dayOf(target.employee.id, target.date)?.day)
  }),

  http.get(base('/days/:employeeId/:date/history'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const target = resolveDay(params)
    if (!target) return notFound()
    const { page, pageSize } = readPageParams(new URL(request.url))
    const entries = attendanceHistory
      .all()
      .filter((item) => item.employeeId === target.employee.id && item.date === target.date)
      .sort((a, b) => b.at.localeCompare(a.at))
      .map(({ id, editedBy, action, detail, at }): HistoryEntry => ({
        id,
        editedBy,
        action,
        detail,
        at,
      }))
    return HttpResponse.json<Paginated<HistoryEntry>>(paginate(entries, page, pageSize))
  }),

  http.get(base('/days/:employeeId/:date/logs'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const target = resolveDay(params)
    if (!target) return notFound()
    return ok<PunchLog[]>(dayOf(target.employee.id, target.date)?.logs ?? [])
  }),

  http.post(base('/days/:employeeId/:date/comments'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const target = resolveDay(params)
    if (!target) return notFound()
    const parsed = await readBody(request, z.object({ text: reason }))
    if (!parsed.success) return invalid('Type a comment first.', { text: 'Type a comment first' })
    const comment = attendanceComments.insert({
      id: createId('ac'),
      employeeId: target.employee.id,
      date: target.date,
      author: EDITOR(),
      text: parsed.data.text,
      createdAt: new Date().toISOString(),
    })
    record(target.employee.id, target.date, 'Added Comment', null)
    const { id, author, text, createdAt } = comment
    return ok<AttendanceComment>({ id, author, text, createdAt })
  }),

  http.delete(base('/days/:employeeId/:date/comments/:commentId'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const target = resolveDay(params)
    const commentId = typeof params.commentId === 'string' ? params.commentId : ''
    const comment = attendanceComments.find(commentId)
    if (!target || comment?.employeeId !== target.employee.id || comment.date !== target.date) {
      return errorResponse(404, 'That comment was already deleted.', { code: 'NOT_FOUND' })
    }
    attendanceComments.remove(commentId)
    record(target.employee.id, target.date, 'Deleted Comment', null)
    return new HttpResponse(null, { status: 204 })
  }),
]

/** The signed-in person's punches today decide Clock In or Clock Out. */
function clockState(): ClockState {
  const today = format(new Date(), 'yyyy-MM-dd')
  const punches = attendancePunches
    .all()
    .filter(
      (punch) =>
        punch.employeeId === CURRENT_EMPLOYEE_ID &&
        punch.date === today &&
        (punch.type === 'check-in' || punch.type === 'check-out'),
    )
    // Oldest first (the table lists newest first); punches in the same minute keep that order.
    .reverse()
    .sort((a, b) => a.at.localeCompare(b.at))
  const last = punches.at(-1)
  const lastPunch: PunchLog | null = last
    ? {
        id: last.id,
        type: last.type,
        at: last.at,
        description: last.description,
        source: last.source,
        machineId: null,
        manuallyUpdated: last.manuallyUpdated,
      }
    : null
  return {
    clockedIn: last?.type === 'check-in',
    lastPunch,
    allowed: currentSettings().basic.dashboardPunch,
  }
}
