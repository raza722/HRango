import type { GeoFenceShape } from '@/features/scheduling'
import type { Paginated } from '@/types/api'

import type { LocalDateTime, PunchLog, PunchSource, PunchType } from './attendance.types'

/** Attendance → Settings → Basic. */
export interface BasicSettings {
  ignorePunchType: boolean
  useCheckInOutForBreaks: boolean
  shortDurationOnNonFlexible: boolean
  /** "Employee can mark punch from their dashboard" (Clock In / Clock Out). */
  dashboardPunch: boolean
  multiShiftPerDay: boolean
  pictureOnDashboardPunch: boolean
  /** Worked minutes below this make the day a Short Day. */
  minimumWorkableMinutes: number | null
}

/** Attendance → Settings → Scheduling. */
export interface SchedulingSettings {
  geoFenceRequiredOnShift: boolean
  ignoreRestDaysForLeaves: boolean
}

export interface AttendanceSettings {
  basic: BasicSettings
  scheduling: SchedulingSettings
}

export interface BreakTypeRecord {
  id: string
  name: string
  startIdentifier: string
  endIdentifier: string
  createdAt: string
  updatedAt: string
}

export interface BreakTypeInput {
  name: string
  startIdentifier: string
  endIdentifier: string
}

/** Who a rule applies to: an organisation slice, or named people. */
export interface AudienceCriteria {
  id: string
  target: 'organization' | 'employees'
  departments: string[]
  locations: string[]
  designations: string[]
  grades: string[]
  religions: string[]
  jobTitles: string[]
  nationalities: string[]
  areas: string[]
  branches: string[]
  joiningFrom: string | null
  joiningTo: string | null
  employeeIds: string[]
}

export const IP_MODES = ['netmask', 'range'] as const
export type IpMode = (typeof IP_MODES)[number]

export interface IpRestriction {
  id: string
  code: string
  name: string
  mode: IpMode
  ipv4: string
  ipv6: string | null
  subnetMask: string | null
  rangeStart: string | null
  rangeEnd: string | null
  count: number | null
  allEmployees: boolean
  criteria: AudienceCriteria[]
  active: boolean
  createdAt: string
  updatedAt: string
}

export type IpRestrictionInput = Omit<IpRestriction, 'id' | 'code' | 'createdAt' | 'updatedAt'>

/** A geo fence as Settings shows it (the same fences Scheduling picks from). */
export interface GeoFenceSetting {
  id: string
  code: string
  name: string
  shape: GeoFenceShape
  forShift: boolean
  allEmployees: boolean
  criteria: AudienceCriteria[]
  active: boolean
  createdAt: string
}

export type GeoFenceSettingInput = Omit<GeoFenceSetting, 'id' | 'code' | 'createdAt'>

export const HOLIDAY_RULE_TYPES = ['religion', 'geo-location', 'organization', 'employee'] as const
export type HolidayRuleType = (typeof HOLIDAY_RULE_TYPES)[number]

/** Narrows a holiday to some people; a holiday without rules is for everyone. */
export interface HolidayRule {
  id: string
  name: string
  type: HolidayRuleType
  religion: string | null
  countryCode: string | null
  regionCode: string | null
  cityId: string | null
  locationId: string | null
  branchId: string | null
  employeeIds: string[]
}

export interface Holiday {
  id: string
  name: string
  startDate: string
  endDate: string
  description: string
  /** Nobody is expected at work; otherwise the day is marked but still worked. */
  attendanceExempt: boolean
  rules: HolidayRule[]
  createdAt: string
  updatedAt: string
}

export type HolidayInput = Omit<Holiday, 'id' | 'createdAt' | 'updatedAt'>

/** One row of Settings → Rest Days: a person and a rest day from a rest-day batch. */
export interface RestDayRow {
  id: string
  batchId: string
  employee: { id: string; name: string; code: string }
  date: string
  payable: boolean
}

export interface RestDayBatch {
  id: string
  startDate: string
  repeat: { everyWeeks: number; from: string; to: string; weekdays: string[]; step: number }
  payable: boolean
  employees: { id: string; name: string; code: string; designation: string }[]
  dates: string[]
  createdAt: string
}

export interface SettingsLookups {
  departments: string[]
  locations: { id: string; name: string }[]
  designations: string[]
  grades: string[]
  religions: string[]
  jobTitles: string[]
  nationalities: string[]
  areas: { id: string; name: string }[]
  branches: { id: string; name: string }[]
  employees: { id: string; name: string; code: string; designation: string }[]
  countries: { code: string; name: string }[]
  regions: { code: string; name: string; countryCode: string }[]
  cities: { id: string; name: string; regionCode: string }[]
}

export interface ListParams {
  page: number
  pageSize: number
  search?: string
}

export type SettingsPage<T> = Paginated<T>

// --- Attendance Logs --------------------------------------------------------------------

export interface MachineInfo {
  id: string
  /** "Machine (MCH-00001)". */
  label: string
  branch: string | null
  lastSyncedAt: LocalDateTime | null
}

export interface AttendanceLogRow extends PunchLog {
  date: string
  employee: { id: string; name: string; code: string }
  /** Manual and imported punches can be edited or deleted; machine ones cannot. */
  editable: boolean
}

export interface AttendanceLogParams {
  from: string
  to: string
  page: number
  pageSize: number
  employeeId?: string
  type?: PunchType
  source?: PunchSource
}

export interface AttendanceLogInput {
  employeeId: string
  date: string
  time: string
  type: PunchType
  description: string
}

export interface MachineImportResult {
  machines: (MachineInfo & { checkIns: number; checkOuts: number })[]
  imported: number
}

export interface FileImportRow {
  employeeCode: string
  date: string
  time: string
  type: PunchType
}

export interface FileImportResult {
  created: number
  skipped: number
  errors: string[]
}
