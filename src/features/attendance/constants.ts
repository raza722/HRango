import markAbsentIcon from '@/assets/attendance/action-absent.svg'
import editIcon from '@/assets/attendance/action-edit.svg'
import missingPunchIcon from '@/assets/attendance/action-missing-punch.svg'
import overtimeIcon from '@/assets/attendance/action-overtime.svg'
import relaxationActionIcon from '@/assets/attendance/action-relaxation.svg'
import viewIcon from '@/assets/attendance/action-view.svg'
import absentIcon from '@/assets/attendance/status-absent.svg'
import halfDayIcon from '@/assets/attendance/status-half-day.svg'
import holidayIcon from '@/assets/attendance/status-holiday.svg'
import leaveIcon from '@/assets/attendance/status-leave.svg'
import officialVisitIcon from '@/assets/attendance/status-official-visit.svg'
import presentIcon from '@/assets/attendance/status-present.svg'
import restDayIcon from '@/assets/attendance/status-rest-day.svg'
import sandwichIcon from '@/assets/attendance/status-sandwich.svg'
import shortDayIcon from '@/assets/attendance/status-short-day.svg'
import weekendIcon from '@/assets/attendance/status-weekend.svg'
import wfhIcon from '@/assets/attendance/status-wfh.svg'
import yetToStartIcon from '@/assets/attendance/status-yet-to-start.svg'

import type {
  AbsenceMark,
  DayFlag,
  DaysOverview,
  DayStatus,
  PunchSource,
  PunchStatus,
  PunchType,
  TimeSheetAction,
} from './types/attendance.types'

export interface DayStatusMeta {
  label: string
  /** Legend wording when it differs from the cell ("Rest Days"). */
  legendLabel?: string
  /** Icon exported from the Attendance Overview legend in Figma. */
  icon: string
}

export const DAY_STATUS_META: Record<DayStatus, DayStatusMeta> = {
  present: { label: 'Present', icon: presentIcon },
  absent: { label: 'Absent', icon: absentIcon },
  holiday: { label: 'Holiday', icon: holidayIcon },
  half_day: { label: 'Half day', icon: halfDayIcon },
  short_day: { label: 'Short Day', icon: shortDayIcon },
  leave: { label: 'Leave', icon: leaveIcon },
  sandwich: { label: 'Sandwich', icon: sandwichIcon },
  official_visit: { label: 'Official Visit', icon: officialVisitIcon },
  yet_to_start: { label: 'Yet to Start', icon: yetToStartIcon },
  weekend: { label: 'Weekend', icon: weekendIcon },
  rest_day: { label: 'Rest Day', legendLabel: 'Rest Days', icon: restDayIcon },
  wfh: { label: 'WFH/Remote', icon: wfhIcon },
}

/** The day's flags, shown as small marks beside the state. */
export const DAY_FLAG_LABELS: Record<DayFlag, string> = {
  late: 'Late Arrival',
  early: 'Early Left',
  grace: 'Grace',
  overtime: 'Overtime',
  missing_punch: 'Missing Punch',
  relaxation: 'Relaxation',
  official_visit: 'Official Visit',
  half_leave: 'Half leave',
  short_leave: 'Short leave',
}

/** Days that count as "Present" (the person worked). */
export const PRESENT_STATUSES: ReadonlySet<DayStatus> = new Set<DayStatus>([
  'present',
  'wfh',
  'half_day',
  'short_day',
  'official_visit',
])

/** Days with nothing to clock: no Edit. */
export const OFF_STATUSES: ReadonlySet<DayStatus> = new Set<DayStatus>([
  'holiday',
  'weekend',
  'rest_day',
  'sandwich',
])

/** Clock In / Clock Out status chips, colours sampled from the All Time Sheet frame. */
export const PUNCH_STATUS_META: Record<PunchStatus, { label: string; className: string }> = {
  on_time: { label: 'Present', className: 'bg-[#2CBD4D] text-white' },
  grace: { label: 'Grace', className: 'bg-[#7DBE3C] text-white' },
  late: { label: 'Late Arrival', className: 'bg-[#DC8F1E] text-white' },
  early: { label: 'Early Left', className: 'bg-[#5A7FE0] text-white' },
  overtime: { label: 'Overtime', className: 'bg-[#C2338B] text-white' },
  missing: { label: 'Missing Punch', className: 'bg-[#F17D5B] text-white' },
  absent: { label: 'Absent', className: 'bg-[#E50141] text-white' },
}

/** A tile of "Days Overview This Month": a count of the summary, or minutes shown as hours. */
export interface OverviewTile {
  key: string
  label: string
  className: string
  value: (summary: DaysOverview) => number
  /** Minutes: shown as hours. */
  minutes?: boolean
}

/** "Days Overview This Month" tiles, in the design's order (Warnings / Penalty: see the docs). */
export const OVERVIEW_TILES: readonly OverviewTile[] = [
  {
    key: 'absent',
    label: 'Absent',
    className: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15',
    value: (summary) => summary.absent,
  },
  {
    key: 'holiday',
    label: 'Holiday',
    className: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15',
    value: (summary) => summary.holiday,
  },
  {
    key: 'lateArrival',
    label: 'Late Arrival',
    className: 'bg-orange-100 text-orange-600 dark:bg-orange-500/15',
    value: (summary) => summary.lateArrival,
  },
  {
    key: 'present',
    label: 'Present',
    className: 'bg-green-100 text-green-600 dark:bg-green-500/15',
    value: (summary) => summary.present,
  },
  {
    key: 'weekend',
    label: 'Weekend',
    className: 'bg-neutral-200 text-neutral-600 dark:bg-neutral-500/20 dark:text-neutral-300',
    value: (summary) => summary.weekend + summary.restDay,
  },
  {
    key: 'yetToStart',
    label: 'Yet To Start',
    className: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15',
    value: (summary) => summary.yetToStart,
  },
  {
    key: 'leave',
    label: 'Leave',
    className: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15',
    value: (summary) => summary.leave,
  },
  {
    key: 'missingPunch',
    label: 'Missing Punch',
    className: 'bg-red-200 text-red-600 dark:bg-red-500/20',
    value: (summary) => summary.missingPunch,
  },
  {
    key: 'overtime',
    label: 'Overtime',
    className: 'bg-pink-100 text-pink-500 dark:bg-pink-500/15',
    value: (summary) => summary.overtimeMinutes,
    minutes: true,
  },
]

export interface ActionMeta {
  label: string
  icon: string
  /** Round background for the icons exported without one (glyph only). */
  backdrop?: string
}

/** Row actions with the icons of the All Time Sheet key (Edit … Overtime). */
export const ACTION_META: Record<TimeSheetAction, ActionMeta> = {
  edit: { label: 'Edit', icon: editIcon },
  'missing-punch': { label: 'Missing Punch', icon: missingPunchIcon, backdrop: 'bg-[#EE5F35]' },
  relaxation: { label: 'Relaxation', icon: relaxationActionIcon, backdrop: 'bg-[#EE5F35]' },
  view: { label: 'View', icon: viewIcon },
  absent: { label: 'Absent', icon: markAbsentIcon },
  overtime: { label: 'Overtime', icon: overtimeIcon, backdrop: 'bg-primary' },
}

export const ABSENCE_MARK_LABELS: Record<AbsenceMark, string> = {
  absent: 'Absent (unpaid)',
  leave: 'Leave',
  'half-leave': 'Half leave',
  'short-leave': 'Short leave',
  'official-duty': 'Official Duty',
  'official-visit': 'Official Visit',
  wfh: 'WFH/Remote',
}

export const PUNCH_TYPE_LABELS: Record<PunchType, string> = {
  check_in: 'Check In',
  check_out: 'Check Out',
  break_out: 'Break Out',
  break_in: 'Break In',
}

export const PUNCH_SOURCE_LABELS: Record<PunchSource, string> = {
  biometric: 'Import from Machine',
  mobile: 'Mobile App',
  web: 'Dashboard',
  manual: 'Manual',
  import_file: 'Imported File',
  punch_request: 'Punch Request',
}

/**
 * Legacy: Grace is a setting now (Settings → Basic → Late Grace Minutes); the API works the
 * statuses out. Kept so the public names stay.
 */
export const GRACE_MINUTES = 5
/** Legacy: The API computes overtime (Settings → Overtime). */
export const OVERTIME_THRESHOLD_MINUTES = 15
/** Legacy: Warnings come from the Warning policies (`warningCount` on each day). */
export const WARNING_LIMIT = 5

/** "Penalty" column wording of `penaltyType`. */
export const PENALTY_TYPE_LABELS: Record<string, string> = {
  half_day: 'Half Day',
  full_day: 'Full Day',
  percentage: 'Percentage',
}

export const EMPLOYEE_STATUS_OPTIONS = [
  { value: 'active', label: 'Active Staff' },
  { value: 'inactive', label: 'Inactive Staff' },
  { value: 'all', label: 'All Staff' },
] as const

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/** Religions offered by holiday rules and criteria, as in the Holiday Rule Create frame. */
export const RELIGIONS = [
  'African Traditional and Diasporic',
  'Agnostic',
  'Atheist',
  'Bahai',
  'Buddhism',
  'Cao Dai',
  'Chinese Traditional Religion',
  'Christianity',
  'Hinduism',
  'Islam',
  'Jainism',
  'Juche',
  'Judaism',
  'Neo-Paganism',
  'Nonreligious',
  'Rastafarianism',
  'Secular',
  'Shinto',
  'Sikhism',
  'Spiritism',
  'Tenrikyo',
  'Unitarian-Universalism',
  'Zoroastrianism',
  'Primal-Indigenous',
  'Sufi',
  'Ahmadiyya',
  'Kalash',
  'Parsi',
  'Other',
] as const

export const OVERVIEW_PAGE_SIZE = 10
export const TIME_SHEET_PAGE_SIZES = [10, 25, 50] as const
