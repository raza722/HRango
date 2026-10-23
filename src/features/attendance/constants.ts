import markAbsentIcon from '@/assets/attendance/action-absent.svg'
import editIcon from '@/assets/attendance/action-edit.svg'
import missingPunchIcon from '@/assets/attendance/action-missing-punch.svg'
import overtimeIcon from '@/assets/attendance/action-overtime.svg'
import relaxationActionIcon from '@/assets/attendance/action-relaxation.svg'
import viewIcon from '@/assets/attendance/action-view.svg'
import absentIcon from '@/assets/attendance/status-absent.svg'
import earlyLeftIcon from '@/assets/attendance/status-early-left.svg'
import halfDayIcon from '@/assets/attendance/status-half-day.svg'
import halfLeaveIcon from '@/assets/attendance/status-half-leave.svg'
import holidayIcon from '@/assets/attendance/status-holiday.svg'
import lateArrivalIcon from '@/assets/attendance/status-late-arrival.svg'
import leaveIcon from '@/assets/attendance/status-leave.svg'
import leaveAppliedIcon from '@/assets/attendance/status-leave-applied.svg'
import officialDutyIcon from '@/assets/attendance/status-official-duty.svg'
import officialVisitIcon from '@/assets/attendance/status-official-visit.svg'
import presentIcon from '@/assets/attendance/status-present.svg'
import relaxationIcon from '@/assets/attendance/status-relaxation.svg'
import restDayIcon from '@/assets/attendance/status-rest-day.svg'
import sandwichIcon from '@/assets/attendance/status-sandwich.svg'
import shortDayIcon from '@/assets/attendance/status-short-day.svg'
import shortLeaveIcon from '@/assets/attendance/status-short-leave.svg'
import weekendIcon from '@/assets/attendance/status-weekend.svg'
import wfhIcon from '@/assets/attendance/status-wfh.svg'
import workableHoursIcon from '@/assets/attendance/status-workable-hours.svg'
import workableShiftsIcon from '@/assets/attendance/status-workable-shifts.svg'
import yetToStartIcon from '@/assets/attendance/status-yet-to-start.svg'

import type {
  AbsenceMark,
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
  'half-day': { label: 'Half day', icon: halfDayIcon },
  'short-day': { label: 'Short Day', icon: shortDayIcon },
  leave: { label: 'Leave', icon: leaveIcon },
  'half-leave': { label: 'Half leave', icon: halfLeaveIcon },
  'short-leave': { label: 'Short leave', icon: shortLeaveIcon },
  sandwich: { label: 'Sandwich', icon: sandwichIcon },
  'official-visit': { label: 'Official Visit', icon: officialVisitIcon },
  'leave-applied': { label: 'Leave Applied', icon: leaveAppliedIcon },
  'yet-to-start': { label: 'Yet to Start', icon: yetToStartIcon },
  weekend: { label: 'Weekend', icon: weekendIcon },
  'workable-shifts': { label: 'Workable shifts', icon: workableShiftsIcon },
  'workable-hours': { label: 'Workable hours', icon: workableHoursIcon },
  'late-arrival': { label: 'Late Arrival', icon: lateArrivalIcon },
  'early-left': { label: 'Early Left', icon: earlyLeftIcon },
  'rest-day': { label: 'Rest Day', legendLabel: 'Rest Days', icon: restDayIcon },
  relaxation: { label: 'Relaxation', icon: relaxationIcon },
  'official-duty': { label: 'Official Duty', icon: officialDutyIcon },
  wfh: { label: 'WFH/Remote', icon: wfhIcon },
}

/** Days that count as "Present" in the overview totals (the person worked). */
export const PRESENT_STATUSES: ReadonlySet<DayStatus> = new Set<DayStatus>([
  'present',
  'late-arrival',
  'early-left',
  'relaxation',
  'wfh',
  'workable-shifts',
  'workable-hours',
  'half-day',
  'short-day',
  'half-leave',
  'short-leave',
  'official-visit',
  'official-duty',
])

/** Days with nothing to clock: no Edit, Missing Punch or Overtime. */
export const OFF_STATUSES: ReadonlySet<DayStatus> = new Set<DayStatus>([
  'holiday',
  'weekend',
  'rest-day',
  'sandwich',
])

/** Clock In / Clock Out status chips, colours sampled from the All Time Sheet frame. */
export const PUNCH_STATUS_META: Record<PunchStatus, { label: string; className: string }> = {
  present: { label: 'Present', className: 'bg-[#2CBD4D] text-white' },
  'late-arrival': { label: 'Late Arrival', className: 'bg-[#DC8F1E] text-white' },
  'early-left': { label: 'Early Left', className: 'bg-[#5A7FE0] text-white' },
  'missing-punch': { label: 'Missing Punch', className: 'bg-[#F17D5B] text-white' },
  absent: { label: 'Absent', className: 'bg-[#E50141] text-white' },
}

/** "Days Overview This Month" tiles, in the design's order. */
export const OVERVIEW_TILES: readonly {
  key: Exclude<keyof DaysOverview, 'month'>
  label: string
  className: string
}[] = [
  { key: 'absent', label: 'Absent', className: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15' },
  { key: 'holiday', label: 'Holiday', className: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15' },
  {
    key: 'lateArrival',
    label: 'Late Arrival',
    className: 'bg-orange-100 text-orange-600 dark:bg-orange-500/15',
  },
  {
    key: 'present',
    label: 'Present',
    className: 'bg-green-100 text-green-600 dark:bg-green-500/15',
  },
  {
    key: 'weekend',
    label: 'Weekend',
    className: 'bg-neutral-200 text-neutral-600 dark:bg-neutral-500/20 dark:text-neutral-300',
  },
  {
    key: 'yetToStart',
    label: 'Yet To Start',
    className: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15',
  },
  {
    key: 'overtime',
    label: 'Overtime',
    className: 'bg-pink-100 text-pink-500 dark:bg-pink-500/15',
  },
  { key: 'warnings', label: 'Warnings', className: 'bg-red-200 text-red-600 dark:bg-red-500/20' },
  {
    key: 'penalty',
    label: 'Penalty',
    className: 'bg-orange-200 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
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
  'check-in': 'Check In',
  'check-out': 'Check Out',
  'break-out': 'Break Out',
  'break-in': 'Break In',
}

export const PUNCH_SOURCE_LABELS: Record<PunchSource, string> = {
  machine: 'Import from Machine',
  manual: 'Manual',
  dashboard: 'Dashboard',
  request: 'Punch Request',
  import: 'Imported File',
}

/** A late arrival within this many minutes still counts as on time. */
export const GRACE_MINUTES = 5
/** Overtime starts counting after this many minutes past the clock out. */
export const OVERTIME_THRESHOLD_MINUTES = 15
/** Warnings in a month that make one penalty (100% in the Warnings column). */
export const WARNING_LIMIT = 5

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
