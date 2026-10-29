import { endOfMonth, format, startOfMonth } from 'date-fns'

import {
  formatLocal,
  type Holiday,
  minutesBetween,
  shiftLocal,
  toLocal,
} from '@/features/attendance'
import type { RosterGroup } from '@/features/roster'
import {
  type BreakType,
  eachDay,
  nextDay,
  plannedMinutes,
  type ScheduleEntry,
  weekdayOf,
} from '@/features/scheduling'

import { DIRECTORY } from '../employees/seed'
import { approvedOvertimeOn } from '../requests/standard/kinds/overtime'
import { rosterGroups } from '../roster/handlers'
import { scheduleEntries } from '../scheduling/handlers'
import { CURRENT_EMPLOYEE_ID } from '../scheduling/seed'
import { holidayFor } from './audience'
import {
  attendanceEdits,
  attendanceIgnored,
  attendancePunches,
  type DayEdit,
  dayId,
  type StoredPunch,
} from './db'
import { currentSettings, holidays, machineFor, machineSync } from './settings-db'
import {
  type AttendanceBreak,
  type DaysOverview,
  type DayStatus,
  GRACE_MINUTES,
  type LocalDateTime,
  OFF_STATUSES,
  OVERTIME_THRESHOLD_MINUTES,
  PRESENT_STATUSES,
  type PunchLog,
  type PunchSource,
  type PunchStatus,
  type PunchType,
  type TimeSheetDay,
  WARNING_LIMIT,
} from './types'

/**
 * Builds attendance from the Scheduling data: each scheduled shift gets
 * machine punches (generated the same way every time for a person and day),
 * then HR's edits and manual punches are laid on top. Changing a schedule in
 * the Scheduling module changes the attendance it produces.
 */

/** Everything a request needs, read once. */
export interface Snapshot {
  today: string
  now: LocalDateTime
  schedule: Map<string, ScheduleEntry>
  edits: Map<string, DayEdit>
  punches: Map<string, StoredPunch[]>
  rosters: Map<string, RosterGroup>
  /** Each person's home branch, for their machines. */
  branches: Map<string, string | null>
  /** Last time each machine was read today. */
  machineSync: Map<string, LocalDateTime>
  holidays: Holiday[]
  minimumWorkableMinutes: number | null
  /** Punches HR ignored: still in the log, not counted. */
  ignored: Set<string>
}

export function takeSnapshot(now = new Date()): Snapshot {
  const punches = new Map<string, StoredPunch[]>()
  for (const punch of attendancePunches.all()) {
    const key = dayId(punch.employeeId, punch.date)
    punches.set(key, [...(punches.get(key) ?? []), punch])
  }
  return {
    today: format(now, 'yyyy-MM-dd'),
    now: formatLocal(now),
    schedule: new Map(
      scheduleEntries.all().map((entry) => [dayId(entry.employeeId, entry.date), entry]),
    ),
    edits: new Map(attendanceEdits.all().map((edit) => [edit.id, edit])),
    punches,
    rosters: new Map(rosterGroups.all().map((group) => [group.id, group])),
    branches: new Map(DIRECTORY.map((employee) => [employee.id, employee.branchId])),
    machineSync: new Map(machineSync.all().map((machine) => [machine.id, machine.lastSyncedAt])),
    holidays: holidays.all(),
    minimumWorkableMinutes: currentSettings().basic.minimumWorkableMinutes,
    ignored: new Set(attendanceIgnored.all().map((item) => item.id)),
  }
}

// --- generated punches ---------------------------------------------------------

/** FNV-1a hash + mulberry32: the same seed always gives the same numbers. */
function random(seed: string): () => number {
  let state = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index)
    state = Math.imul(state, 16777619)
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

type Scenario =
  | 'on-time'
  | 'late'
  | 'early-left'
  | 'missing-out'
  | 'overtime'
  | 'absent'
  | 'leave'
  | 'half-leave'
  | 'short-leave'
  | 'leave-applied'
  | 'official-duty'
  | 'official-visit'

/** Cumulative odds of each kind of day, out of 1. */
const SCENARIOS: readonly [number, Scenario][] = [
  [0.05, 'absent'],
  [0.08, 'leave'],
  [0.1, 'half-leave'],
  [0.12, 'short-leave'],
  [0.13, 'leave-applied'],
  [0.15, 'official-duty'],
  [0.17, 'official-visit'],
  [0.27, 'late'],
  [0.32, 'early-left'],
  [0.35, 'missing-out'],
  [0.43, 'overtime'],
]

/** Days spent away without punching. */
const AWAY: Partial<Record<Scenario, DayStatus>> = {
  leave: 'leave',
  'leave-applied': 'leave-applied',
  'official-duty': 'official-duty',
}

/** Scheduling break types → Attendance break type ids. */
const BREAK_TYPE_MAP: Record<BreakType, string> = {
  lunch: 'lunch',
  rest: 'tea',
  personal: 'personal',
  prayer: 'prayer',
}

interface Generated {
  scenario: Scenario
  punches: PunchLog[]
  breaks: AttendanceBreak[]
}

function generate(
  snap: Snapshot,
  entry: ScheduleEntry,
  expectedIn: LocalDateTime,
  expectedOut: LocalDateTime,
): Generated {
  const rand = random(`${entry.employeeId}|${entry.date}`)
  const roll = rand()
  const scenario = SCENARIOS.find(([odds]) => roll < odds)?.[1] ?? 'on-time'
  const none = { scenario, punches: [], breaks: [] }
  const between = (min: number, max: number) => Math.round(min + rand() * (max - min))

  if (entry.date > snap.today || scenario in AWAY || scenario === 'absent') return none
  // The signed-in person punches today themselves (Clock In / Clock Out).
  if (entry.employeeId === CURRENT_EMPLOYEE_ID && entry.date === snap.today) {
    return { ...none, scenario: 'on-time' }
  }

  const span = minutesBetween(expectedIn, expectedOut)
  let checkIn = shiftLocal(expectedIn, -between(0, 10))
  let checkOut: LocalDateTime | null = shiftLocal(expectedOut, between(0, 8))
  if (scenario === 'late') checkIn = shiftLocal(expectedIn, between(10, 45))
  if (scenario === 'early-left') checkOut = shiftLocal(expectedOut, -between(20, 75))
  if (scenario === 'missing-out') checkOut = null
  if (scenario === 'overtime') checkOut = shiftLocal(expectedOut, between(30, 120))
  if (scenario === 'half-leave') checkOut = shiftLocal(expectedIn, Math.round(span / 2))
  if (scenario === 'short-leave') checkOut = shiftLocal(expectedOut, -Math.min(120, span / 2))
  if (scenario === 'official-visit') checkOut = shiftLocal(expectedIn, Math.min(180, span))

  const source: PunchSource = entry.workFromHome ? 'dashboard' : 'machine'
  const branch = snap.branches.get(entry.employeeId) ?? null
  const machine = (type: PunchType) => (source === 'machine' ? machineFor(branch, type) : null)
  // Today: only what has happened so far, and of machine punches only what
  // the machines have handed over (Attendance Logs → Import → Machine).
  const limit = (type: PunchType) => {
    const id = machine(type)
    const synced = id && entry.date === snap.today ? snap.machineSync.get(id) : undefined
    return synced && synced < snap.now ? synced : snap.now
  }
  if (checkIn > limit('check-in')) return none
  if (checkOut !== null && checkOut > limit('check-out')) checkOut = null

  const log = (type: PunchType, at: LocalDateTime, index = 0): PunchLog => ({
    id: `pl_${entry.employeeId}_${entry.date}_${type}_${index}`,
    type,
    at,
    description:
      source === 'machine'
        ? type === 'check-in' || type === 'break-in'
          ? 'Checking In ...'
          : 'Checking Out ...'
        : 'Marked from the dashboard',
    source,
    machineId: machine(type),
    manuallyUpdated: false,
  })

  const breaks = entry.breaks.flatMap((item): AttendanceBreak[] => {
    const outAt = shiftLocal(toLocal(item.startDate, item.startTime), between(0, 6))
    const inAt = shiftLocal(toLocal(item.endDate, item.endTime), between(-6, 8))
    if (outAt <= checkIn || inAt > limit('break-in') || (checkOut !== null && inAt >= checkOut))
      return []
    return [{ type: BREAK_TYPE_MAP[item.type], outAt, inAt, description: item.description }]
  })

  const punches = [
    log('check-in', checkIn),
    ...breaks.flatMap((item, index) => [
      log('break-out', item.outAt, index),
      ...(item.inAt ? [log('break-in', item.inAt, index)] : []),
    ]),
    ...(checkOut ? [log('check-out', checkOut)] : []),
  ]
  return { scenario, punches, breaks }
}

// --- one day -------------------------------------------------------------------

export interface ComputedDay {
  day: TimeSheetDay
  breaks: AttendanceBreak[]
  logs: PunchLog[]
  /** What this day adds to the monthly warning count, if anything. */
  warningKind: 'late' | 'absent' | null
}

const NOT_WORKED: ReadonlySet<DayStatus> = new Set<DayStatus>([
  ...OFF_STATUSES,
  'absent',
  'leave',
  'leave-applied',
  'official-duty',
  'yet-to-start',
])
/** Leaving early is the point of these days, so it is not "Early Left". */
const EARLY_EXPECTED: ReadonlySet<DayStatus> = new Set<DayStatus>([
  'half-leave',
  'short-leave',
  'official-visit',
  'half-day',
  'short-day',
])

const later = (a: LocalDateTime, b: LocalDateTime) => (a > b ? a : b)
const earlier = (a: LocalDateTime, b: LocalDateTime) => (a < b ? a : b)

function isRosterWeekend(snap: Snapshot, entry: ScheduleEntry): boolean {
  const group = entry.rosterGroupId ? snap.rosters.get(entry.rosterGroupId) : undefined
  if (!group) return true
  const index = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(weekdayOf(entry.date))
  return group.days[index]?.isWeekend ?? true
}

export function computeDay(snap: Snapshot, employeeId: string, date: string): ComputedDay {
  const key = dayId(employeeId, date)
  const entry = snap.schedule.get(key)
  const edit = snap.edits.get(key)
  const holiday = holidayFor(snap.holidays, employeeId, date)
  // Nobody is expected on a holiday, whatever the schedule says.
  const shift =
    !holiday && entry?.kind === 'shift' && entry.clockIn !== null && entry.clockOut !== null
      ? entry
      : undefined
  const expectedIn = shift?.clockIn ? toLocal(date, shift.clockIn) : null
  const expectedOut =
    shift?.clockIn && shift.clockOut
      ? toLocal(shift.clockOut < shift.clockIn ? nextDay(date) : date, shift.clockOut)
      : null

  const generated =
    shift && expectedIn && expectedOut && !holiday
      ? generate(snap, shift, expectedIn, expectedOut)
      : null
  const stored = (snap.punches.get(key) ?? []).map((punch) => ({
    ...punch,
    machineId: punch.machineId ?? null,
  }))
  const machineLogs = [...(generated?.punches ?? []), ...stored]
  const counted = machineLogs.filter((log) => !snap.ignored.has(log.id))
  const firstIn = counted.filter((log) => log.type === 'check-in').sort(byTime)[0]?.at ?? null
  const lastOut =
    counted
      .filter((log) => log.type === 'check-out')
      .sort(byTime)
      .at(-1)?.at ?? null
  // A typed-in time shows in the log only when it differs from the punch.
  const editLogs: PunchLog[] = [
    ...(edit?.checkIn && edit.checkIn !== firstIn ? [editLog(key, 'check-in', edit.checkIn)] : []),
    ...(edit?.checkOut && edit.checkOut !== lastOut
      ? [editLog(key, 'check-out', edit.checkOut)]
      : []),
  ]
  const logs = [...machineLogs, ...editLogs].sort(byTime)

  const markAbsent = edit?.markAbsent === true
  const checkIn = markAbsent ? null : edit?.checkIn !== undefined ? edit.checkIn : firstIn
  const checkOut = markAbsent ? null : edit?.checkOut !== undefined ? edit.checkOut : lastOut
  const breaks = markAbsent ? [] : (edit?.breaks ?? generated?.breaks ?? [])
  const relaxed = edit?.relaxationReason !== undefined
  // Times typed in by HR decide the day; the sample scenario only shapes untouched days.
  const edited = edit?.checkIn !== undefined || edit?.checkOut !== undefined
  const scenario = edited ? null : (generated?.scenario ?? null)
  const isFuture = date > snap.today
  const stillOpen = date === snap.today && expectedOut !== null && snap.now < expectedOut

  const lateMinutes = checkIn && expectedIn ? Math.max(0, minutesBetween(expectedIn, checkIn)) : 0
  const earlyMinutes =
    checkOut && expectedOut ? Math.max(0, minutesBetween(checkOut, expectedOut)) : 0
  const durationMinutes =
    checkIn && checkOut ? Math.max(0, minutesBetween(checkIn, checkOut)) : null
  const breakMinutes = checkIn
    ? breaks.reduce(
        (sum, item) => sum + (item.inAt ? Math.max(0, minutesBetween(item.outAt, item.inAt)) : 0),
        0,
      )
    : null
  const workedMinutes =
    durationMinutes === null ? null : Math.max(0, durationMinutes - (breakMinutes ?? 0))
  const shiftWorkedMinutes =
    checkIn && checkOut && expectedIn && expectedOut
      ? Math.max(
          0,
          minutesBetween(later(checkIn, expectedIn), earlier(checkOut, expectedOut)) -
            (breakMinutes ?? 0),
        )
      : null
  const extra = checkOut && expectedOut ? minutesBetween(expectedOut, checkOut) : 0

  let status: DayStatus | null
  if (holiday) status = 'holiday'
  else if (!entry) status = null
  else if (entry.kind === 'rest') status = isRosterWeekend(snap, entry) ? 'weekend' : 'rest-day'
  else if (edit?.status) status = edit.status
  else if (markAbsent) status = 'absent'
  else if (edit?.markHalfDay) status = 'half-day'
  else if (edit?.markShortDay) status = 'short-day'
  else if (scenario && AWAY[scenario] && !checkIn) status = AWAY[scenario] ?? null
  else if (isFuture || (stillOpen && !checkIn)) status = 'yet-to-start'
  else if (!checkIn && !checkOut) status = 'absent'
  else if (scenario === 'half-leave' || scenario === 'short-leave' || scenario === 'official-visit')
    status = scenario
  else if (relaxed) status = 'relaxation'
  else if (entry.workFromHome) status = 'wfh'
  else if (lateMinutes > GRACE_MINUTES) status = 'late-arrival'
  else if (checkOut && earlyMinutes > GRACE_MINUTES) status = 'early-left'
  else if (entry.rosterGroupId === 'rg_flexible' || entry.slot.mode === 'flexible')
    status = 'workable-hours'
  else if (entry.rosterGroupId === 'rg_part' || entry.slot.mode === 'total')
    status = 'workable-shifts'
  else status = 'present'

  // Settings → Basic → Minimum Workable Minutes: a finished day under it is a Short Day.
  if (
    snap.minimumWorkableMinutes !== null &&
    workedMinutes !== null &&
    workedMinutes < snap.minimumWorkableMinutes &&
    (status === 'present' || status === 'late-arrival' || status === 'early-left')
  ) {
    status = 'short-day'
  }

  const worked = status !== null && !NOT_WORKED.has(status)
  let clockInStatus: PunchStatus | null = null
  let clockOutStatus: PunchStatus | null = null
  if (status === 'absent') {
    clockInStatus = 'absent'
    clockOutStatus = 'absent'
  } else if (worked) {
    clockInStatus = !checkIn
      ? 'missing-punch'
      : lateMinutes > GRACE_MINUTES && !relaxed
        ? 'late-arrival'
        : 'present'
    clockOutStatus = checkOut
      ? earlyMinutes > GRACE_MINUTES && !relaxed && !EARLY_EXPECTED.has(status ?? 'present')
        ? 'early-left'
        : 'present'
      : stillOpen
        ? null
        : 'missing-punch'
  }

  const day: TimeSheetDay = {
    employeeId,
    date,
    slotName: shift ? shift.slot.name : null,
    expectedIn: shift?.clockIn ?? null,
    expectedOut: shift?.clockOut ?? null,
    checkIn,
    checkOut,
    clockInStatus,
    clockOutStatus,
    lateMinutes,
    earlyMinutes,
    durationMinutes,
    expectedMinutes: shift ? plannedMinutes(shift) : null,
    workedMinutes,
    breakMinutes,
    shiftWorkedMinutes,
    overtimeMinutes: worked && extra >= OVERTIME_THRESHOLD_MINUTES ? extra : 0,
    // What Overtime approved: written on the day when an approver approves; the seeded
    // approvals (never approved through the screen) are read from the requests themselves.
    approvedOvertimeMinutes:
      edit?.approvedOvertimeMinutes ?? (approvedOvertimeOn(employeeId, date) || null),
    warning: null,
    status,
    manuallyUpdated: edit !== undefined || stored.some((punch) => punch.manuallyUpdated),
    relaxed,
  }
  return {
    day,
    breaks,
    logs,
    warningKind:
      status === 'late-arrival' ? 'late' : status === 'absent' && !isFuture ? 'absent' : null,
  }
}

const byTime = (a: PunchLog, b: PunchLog) => a.at.localeCompare(b.at)

function editLog(key: string, type: PunchType, at: LocalDateTime): PunchLog {
  return {
    id: `pl_edit_${key}_${type}`,
    type,
    at,
    description: 'Changed on the time sheet',
    source: 'manual',
    machineId: null,
    manuallyUpdated: true,
  }
}

// --- ranges --------------------------------------------------------------------

const ABSENCES: ReadonlySet<DayStatus | null> = new Set<DayStatus | null>(['absent', 'leave'])

/**
 * Sandwich rule: days off between two absences (or leaves) count as one
 * long absence.
 */
function applySandwich(days: ComputedDay[]): void {
  const statuses = days.map((item) => item.day.status)
  const working = (status: DayStatus | null) => status !== null && !OFF_STATUSES.has(status)
  statuses.forEach((status, index) => {
    if (status === null || !OFF_STATUSES.has(status)) return
    const before = statuses.slice(0, index).findLast(working)
    const after = statuses.slice(index + 1).find(working)
    const current = days[index]
    if (current && ABSENCES.has(before ?? null) && ABSENCES.has(after ?? null)) {
      current.day = { ...current.day, status: 'sandwich' }
    }
  })
}

/** Warnings column: late arrivals and absences count towards the monthly limit. */
function applyWarnings(days: ComputedDay[]): void {
  const counts = new Map<string, number>()
  for (const item of days) {
    if (!item.warningKind) continue
    const month = item.day.date.slice(0, 7)
    const count = (counts.get(month) ?? 0) + 1
    counts.set(month, count)
    const step = ((count - 1) % WARNING_LIMIT) + 1
    item.day = {
      ...item.day,
      warning: {
        percent: Math.round((step * 100) / WARNING_LIMIT),
        penalty:
          step === WARNING_LIMIT
            ? item.warningKind === 'late'
              ? 'Late Penalty'
              : 'Absent Penalty'
            : null,
      },
    }
  }
}

/** Days `from`–`to` of one person, with the sandwich and warning rules applied. */
export function computeRange(
  snap: Snapshot,
  employeeId: string,
  from: string,
  to: string,
): ComputedDay[] {
  // Warnings count from the 1st of the month; the sandwich rule looks a week around.
  const monthStart = format(startOfMonth(new Date(`${from}T00:00`)), 'yyyy-MM-dd')
  const days = eachDay(nextDay(monthStart, -7), nextDay(to, 7)).map((date) =>
    computeDay(snap, employeeId, date),
  )
  applySandwich(days)
  applyWarnings(days)
  return days.filter((item) => item.day.date >= from && item.day.date <= to)
}

export function monthRange(month: string): { from: string; to: string } {
  const first = new Date(`${month}-01T00:00`)
  return {
    from: format(startOfMonth(first), 'yyyy-MM-dd'),
    to: format(endOfMonth(first), 'yyyy-MM-dd'),
  }
}

/** "Days Overview This Month" counts. */
export function daysOverview(snap: Snapshot, employeeId: string): DaysOverview {
  const month = snap.today.slice(0, 7)
  const { from, to } = monthRange(month)
  const days = computeRange(snap, employeeId, from, to).map((item) => item.day)
  const count = (test: (day: TimeSheetDay) => boolean) => days.filter(test).length
  return {
    month,
    absent: count((day) => day.status === 'absent'),
    holiday: count((day) => day.status === 'holiday'),
    lateArrival: count((day) => day.status === 'late-arrival'),
    present: count((day) => day.status !== null && PRESENT_STATUSES.has(day.status)),
    weekend: count((day) => day.status === 'weekend' || day.status === 'rest-day'),
    yetToStart: count((day) => day.status === 'yet-to-start'),
    overtime: count((day) => day.overtimeMinutes > 0),
    warnings: count((day) => day.warning !== null),
    penalty: count((day) => (day.warning?.penalty ?? null) !== null),
  }
}
