import type {
  AttendanceBreak as WireBreak,
  DayFlag,
  DaysOverview as WireSummary,
  DayStatus as WireStatus,
  PunchLog as WirePunch,
  PunchSource as WireSource,
  PunchStatus as WireChip,
  PunchType as WireType,
  TimeSheetDay as WireDay,
} from '@/features/attendance'
import { nextDay } from '@/features/scheduling'

import type { DirectoryEmployee } from '../employees/seed'
import { profileOf } from '../scheduling/seed'
import { attendanceEdits, attendanceIgnored, dayId } from './db'
import type { ComputedDay } from './engine'
import { breakTypes } from './settings-db'
import type {
  AttendanceBreak,
  DayStatus,
  LocalDateTime,
  PunchLog,
  PunchSource,
  PunchStatus,
  PunchType,
} from './types'

/**
 * Translates the mock engine's days and punches into the backend's shapes
 * (`app/schemas/attendance.py`): snake_case states and chips, flags, local
 * date-times with seconds, string ids, row versions.
 */

/** `2026-10-20T09:05` → `2026-10-20T09:05:00`, as the API sends local date-times. */
export const wire = (value: LocalDateTime | null): string | null => (value ? `${value}:00` : null)

/** `2026-10-20T09:05:00` (or without seconds) → `2026-10-20T09:05`. */
export const fromWire = (value: string): LocalDateTime => value.slice(0, 16)

const TYPE_TO_WIRE: Record<PunchType, WireType> = {
  'check-in': 'check_in',
  'check-out': 'check_out',
  'break-out': 'break_out',
  'break-in': 'break_in',
}
const TYPE_FROM_WIRE: Record<WireType, PunchType> = {
  check_in: 'check-in',
  check_out: 'check-out',
  break_out: 'break-out',
  break_in: 'break-in',
}
export const punchTypeFromWire = (type: WireType): PunchType => TYPE_FROM_WIRE[type]

const SOURCE_TO_WIRE: Record<PunchSource, WireSource> = {
  machine: 'biometric',
  manual: 'manual',
  dashboard: 'web',
  request: 'punch_request',
  import: 'import_file',
}
export const sourceToWire = (source: PunchSource): WireSource => SOURCE_TO_WIRE[source]

/** The engine's 21 states → the API's day status and flags. */
const STATE: Record<DayStatus, { status: WireStatus; flags: DayFlag[] }> = {
  present: { status: 'present', flags: [] },
  absent: { status: 'absent', flags: [] },
  holiday: { status: 'holiday', flags: [] },
  'half-day': { status: 'half_day', flags: [] },
  'short-day': { status: 'short_day', flags: [] },
  leave: { status: 'leave', flags: [] },
  'half-leave': { status: 'present', flags: ['half_leave'] },
  'short-leave': { status: 'present', flags: ['short_leave'] },
  sandwich: { status: 'sandwich', flags: [] },
  'official-visit': { status: 'official_visit', flags: ['official_visit'] },
  'leave-applied': { status: 'absent', flags: [] },
  'yet-to-start': { status: 'yet_to_start', flags: [] },
  weekend: { status: 'weekend', flags: [] },
  'workable-shifts': { status: 'present', flags: [] },
  'workable-hours': { status: 'present', flags: [] },
  'late-arrival': { status: 'present', flags: ['late'] },
  'early-left': { status: 'present', flags: ['early'] },
  'rest-day': { status: 'rest_day', flags: [] },
  relaxation: { status: 'present', flags: ['relaxation'] },
  'official-duty': { status: 'official_visit', flags: [] },
  wfh: { status: 'wfh', flags: [] },
}

const CHIP: Record<PunchStatus, WireChip> = {
  present: 'on_time',
  'late-arrival': 'late',
  'early-left': 'early',
  'missing-punch': 'missing',
  absent: 'absent',
}

/** The API status of a computed day (a day without a schedule is a weekend there). */
export function wireStatus(status: DayStatus | null): WireStatus {
  return status ? STATE[status].status : 'weekend'
}

const breakName = (id: string) => breakTypes.find(id)?.name ?? null

/** A computed day as a `TimesheetDayOut`. */
export function toWireDay(item: ComputedDay, employee: DirectoryEmployee): WireDay {
  const { day } = item
  const edit = attendanceEdits.find(dayId(day.employeeId, day.date))
  const state = day.status ? STATE[day.status] : { status: 'weekend' as const, flags: [] }
  const flags = new Set<DayFlag>(state.flags)
  if (day.clockInStatus === 'late-arrival') flags.add('late')
  if (day.clockOutStatus === 'early-left') flags.add('early')
  if (day.clockInStatus === 'missing-punch' || day.clockOutStatus === 'missing-punch') {
    flags.add('missing_punch')
  }
  if (day.overtimeMinutes > 0) flags.add('overtime')
  if (day.relaxed) flags.add('relaxation')
  const grace = day.clockInStatus === 'present' && day.lateMinutes > 0
  if (grace) flags.add('grace')

  const expectedIn = day.expectedIn ? `${day.date}T${day.expectedIn}` : null
  const expectedOut =
    day.expectedIn && day.expectedOut
      ? `${day.expectedOut < day.expectedIn ? nextDay(day.date) : day.date}T${day.expectedOut}`
      : null
  const marked = edit?.markAbsent
    ? 'absent'
    : edit?.markHalfDay
      ? 'half_day'
      : edit?.markShortDay
        ? 'short_day'
        : null
  const penalty = day.warning?.penalty ?? null
  return {
    id: dayId(day.employeeId, day.date),
    employeeId: day.employeeId,
    employeeCode: profileOf(employee).code,
    employeeName: employee.name,
    departmentName: employee.department,
    workDate: day.date,
    scheduleId: day.slotName ? dayId(day.employeeId, day.date) : null,
    timeSlotId: null,
    timeSlotName: day.slotName,
    expectedIn: wire(expectedIn),
    expectedOut: wire(expectedOut),
    expectedMinutes: day.expectedMinutes,
    firstIn: wire(day.checkIn),
    lastOut: wire(day.checkOut),
    workedMinutes: day.workedMinutes,
    breakMinutes: day.breakMinutes ?? 0,
    shiftWorkedMinutes: day.shiftWorkedMinutes,
    lateMinutes: day.lateMinutes,
    earlyLeftMinutes: day.earlyMinutes,
    overtimeBeforeMinutes: 0,
    overtimeAfterMinutes: day.overtimeMinutes,
    approvedOvertimeMinutes: day.approvedOvertimeMinutes ?? 0,
    graceConsumedMinutes: grace ? day.lateMinutes : 0,
    dayStatus: state.status,
    markedStatus: marked,
    leaveRequestId: null,
    isManuallyUpdated: day.manuallyUpdated,
    isFrozen: false,
    comments: edit?.comments ?? null,
    processedAt: new Date().toISOString().slice(0, 19),
    flags: [...flags],
    warningCount: day.warning ? 1 : 0,
    penaltyType: penalty ? 'half_day' : null,
    penaltyPercentage: penalty ? 50 : null,
    clockInStatus: day.clockInStatus ? CHIP[day.clockInStatus] : null,
    clockOutStatus:
      day.clockOutStatus === 'present' && day.overtimeMinutes > 0
        ? 'overtime'
        : day.clockOutStatus
          ? CHIP[day.clockOutStatus]
          : null,
    rowVersion: dayVersion(day.employeeId, day.date),
  }
}

/** The day's rowVersion: changes with every edit. */
export function dayVersion(employeeId: string, date: string): string {
  return `day:${attendanceEdits.find(dayId(employeeId, date))?.updatedAt ?? 'v0'}`
}

/** A punch's rowVersion. */
export const punchVersion = (log: PunchLog) =>
  `punch:${log.at}:${log.type}:${log.description.length}`

/** A punch as a `PunchOut`. */
export function toWirePunch(log: PunchLog, employee: DirectoryEmployee): WirePunch {
  const stored = log.source === 'manual' || log.source === 'import'
  return {
    id: log.id,
    employeeId: employee.id,
    employeeCode: profileOf(employee).code,
    employeeName: employee.name,
    punchedAt: wire(log.at) ?? log.at,
    punchType: TYPE_TO_WIRE[log.type],
    breakTypeId: null,
    breakTypeName: null,
    source: SOURCE_TO_WIRE[log.source],
    deviceId: log.machineId,
    deviceCode: log.machineId,
    deviceName: log.machineId ? `Machine (${log.machineId})` : null,
    latitude: null,
    longitude: null,
    ipAddress: log.source === 'dashboard' ? '10.0.0.24' : null,
    photoFileId: null,
    photo: null,
    requestId: null,
    remarks: log.description || null,
    isManuallyUpdated: log.manuallyUpdated,
    isIgnored: attendanceIgnored.find(log.id) !== undefined,
    editable: stored && !log.id.startsWith('pl_edit_'),
    createdAt: new Date().toISOString().slice(0, 19),
    updatedAt: null,
    rowVersion: punchVersion(log),
  }
}

/** A break as `BreakOut`. */
export function toWireBreak(item: AttendanceBreak, index: number): WireBreak {
  const minutes =
    item.inAt !== null
      ? Math.max(
          0,
          Math.round(
            (new Date(`${item.inAt}:00`).getTime() - new Date(`${item.outAt}:00`).getTime()) /
              60_000,
          ),
        )
      : null
  return {
    id: String(index + 1),
    breakTypeId: item.type || null,
    breakTypeName: item.type ? breakName(item.type) : null,
    outAt: wire(item.outAt) ?? item.outAt,
    inAt: wire(item.inAt),
    minutes,
  }
}

/** Totals of a set of days, as `SummaryOut`. */
export function toSummary(
  days: readonly WireDay[],
  from: string,
  to: string,
  employees: number,
): WireSummary {
  const count = (status: WireStatus) => days.filter((day) => day.dayStatus === status).length
  const flagged = (flag: DayFlag) => days.filter((day) => day.flags.includes(flag)).length
  const sum = (pick: (day: WireDay) => number | null) =>
    days.reduce((total, day) => total + (pick(day) ?? 0), 0)
  return {
    fromDate: from,
    toDate: to,
    totalDays: days.length,
    employees,
    present: count('present'),
    absent: count('absent'),
    holiday: count('holiday'),
    weekend: count('weekend'),
    restDay: count('rest_day'),
    leave: count('leave'),
    halfDay: count('half_day'),
    shortDay: count('short_day'),
    wfh: count('wfh'),
    officialVisit: count('official_visit'),
    sandwich: count('sandwich'),
    yetToStart: count('yet_to_start'),
    lateArrival: flagged('late'),
    earlyLeft: flagged('early'),
    missingPunch: flagged('missing_punch'),
    workedMinutes: sum((day) => day.workedMinutes),
    overtimeMinutes: sum(
      (day) => (day.overtimeBeforeMinutes ?? 0) + (day.overtimeAfterMinutes ?? 0),
    ),
    approvedOvertimeMinutes: sum((day) => day.approvedOvertimeMinutes),
  }
}
