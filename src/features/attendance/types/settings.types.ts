import type { Paginated } from '@/types/api'

/**
 * Attendance → Settings, as the API has them (`/api/attendance/settings/...` and, for the
 * scheduling tabs, `/api/scheduling/settings/...`). Edits send the `rowVersion` last read.
 */

/** `GET/PUT /attendance/settings/basic`. */
export interface BasicSettings {
  ignorePunchType: boolean
  useCheckInOutForBreaks: boolean
  shortDurationOnNonFlexible: boolean
  /** "Employee can mark punch from their dashboard" (Clock In / Clock Out). */
  dashboardPunch: boolean
  /** "Allow Multi Shift on single day" (Scheduling reads it). */
  allowMultiShift: boolean
  pictureOnDashboardPunch: boolean
  /** Worked minutes below this make a finished day a Short Day; 0 = the day's expected minutes. */
  minimumWorkableMinutes: number
  /** Minutes after the expected start that do not count as late (a Grace flag instead). */
  lateGraceMinutes: number
  rowVersion: string | null
}

/**
 * Attendance → Settings → Scheduling. The API has no endpoint for these switches yet; only the
 * mock API serves `/attendance/settings/scheduling`.
 */
export interface SchedulingSettings {
  geoFenceRequiredOnShift: boolean
  ignoreRestDaysForLeaves: boolean
}

/** Both forms together (the mock API's stored settings). */
export interface AttendanceSettings {
  basic: BasicSettings
  scheduling: SchedulingSettings
}

/** `/scheduling/settings/break-types`. */
export interface BreakTypeRecord {
  id: string
  name: string
  /** What a device or a log sends when the break starts (break out). */
  startIdentifier: string
  /** What it sends when the break ends (break in). */
  endIdentifier: string
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface BreakTypeInput {
  name: string
  startIdentifier: string
  endIdentifier: string
  rowVersion?: string | null
}

// --- who a fence or a restriction applies to ----------------------------------------------

/** Kinds of target; one value per target. Same kind = any of them, different kinds = all. */
export const TARGET_TYPES = [
  'employee',
  'country',
  'location',
  'branch',
  'area',
  'department',
  'designation',
  'grade',
  'job_title',
  'religion',
  'nationality',
] as const
export type TargetType = (typeof TARGET_TYPES)[number]

/** Religion and nationality are names (`targetValue`); the rest are ids (`targetId`). */
export const VALUE_TARGET_TYPES: readonly TargetType[] = ['religion', 'nationality']

export interface AudienceTarget {
  targetType: TargetType
  targetId: string | null
  targetValue: string | null
}

/** The targets as the form edits them: the chosen ids or names per kind. */
export type AudienceCriteria = Record<TargetType, string[]>

// --- IP restrictions ---------------------------------------------------------------------------

/** How the form asks for the address (the API keeps both an address and a range). */
export const IP_MODES = ['netmask', 'range'] as const
export type IpMode = (typeof IP_MODES)[number]

/** `/attendance/settings/ip-restrictions`. */
export interface IpRestriction {
  id: string
  code: string
  /** An IPv4 address or network (`192.168.2.0/24`), with an optional `netmask`. */
  ipv4: string | null
  ipv6: string | null
  netmask: string | null
  rangeStart: string | null
  rangeEnd: string | null
  appliesToAll: boolean
  isActive: boolean
  /** How many addresses it allows (the design's "Count"), computed by the API. */
  addressCount: number | null
  targetCount: number
  /** On the single record; the list may leave it out (`null`). */
  targets: AudienceTarget[] | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface IpRestrictionInput {
  ipv4: string | null
  ipv6: string | null
  netmask: string | null
  rangeStart: string | null
  rangeEnd: string | null
  appliesToAll: boolean
  isActive: boolean
  targets: AudienceTarget[]
  rowVersion?: string | null
}

// --- geo fences ----------------------------------------------------------------------------------

export interface GeoPoint {
  lat: number
  lng: number
}

export type GeoFenceShapeKind = 'circle' | 'polygon'

/** `/attendance/settings/geo-fences` (the fences Scheduling picks from). */
export interface GeoFenceSetting {
  id: string
  code: string
  name: string
  shape: GeoFenceShapeKind
  centerLat: number | null
  centerLng: number | null
  radiusM: number | null
  polygonPoints: GeoPoint[] | null
  appliesToAll: boolean
  /** Only people who joined in this window (optional). */
  joiningFromDate: string | null
  joiningToDate: string | null
  /** "For Shift": shifts can require it. */
  isForShift: boolean
  isActive: boolean
  targetCount: number
  targets: AudienceTarget[] | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface GeoFenceSettingInput {
  name: string
  shape: GeoFenceShapeKind
  centerLat: number | null
  centerLng: number | null
  radiusM: number | null
  polygonPoints: GeoPoint[] | null
  appliesToAll: boolean
  joiningFromDate: string | null
  joiningToDate: string | null
  isForShift: boolean
  isActive: boolean
  targets: AudienceTarget[]
  rowVersion?: string | null
}

// --- holidays ------------------------------------------------------------------------------------

export const HOLIDAY_TYPES = ['public', 'local'] as const
export type HolidayType = (typeof HOLIDAY_TYPES)[number]

export const HOLIDAY_RULE_TYPES = ['religion', 'geo_location', 'org_structure', 'employee'] as const
export type HolidayRuleType = (typeof HOLIDAY_RULE_TYPES)[number]

/** Narrows a holiday to some people; a holiday without rules is for everyone. */
export interface HolidayRuleInput {
  ruleType: HolidayRuleType
  employeeId: string | null
  /** org_structure: a location and a branch in it. */
  locationId: string | null
  branchId: string | null
  /** geo_location: a country, a state in it and a city in that state (the employee's branch). */
  countryId: string | null
  stateId: string | null
  cityId: string | null
  religion: string | null
}

export interface HolidayRule extends HolidayRuleInput {
  id: string
  employeeName: string | null
  locationName: string | null
  branchName: string | null
  countryName: string | null
  stateName: string | null
  cityName: string | null
}

/** `/scheduling/settings/holidays`. */
export interface Holiday {
  id: string
  name: string
  holidayType: HolidayType
  startDate: string
  endDate: string
  description: string | null
  /** On: nobody is expected at work. Off: listed, but still a working day. */
  attendanceExempt: boolean
  dayCount: number
  /** On the list only. */
  ruleCount: number | null
  /** On the single record only (empty on the list). */
  rules: HolidayRule[]
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface HolidayInput {
  name: string
  holidayType: HolidayType
  startDate: string
  endDate: string
  description: string | null
  attendanceExempt: boolean
  rules: HolidayRuleInput[]
  rowVersion?: string | null
}

// --- rest days -----------------------------------------------------------------------------------

export interface RestDayRuleEmployee {
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string | null
  designationName: string | null
}

/** `/scheduling/settings/rest-days`: people get rest days on chosen weekdays between two dates. */
export interface RestDayRule {
  id: string
  fromDate: string
  toDate: string
  /** 1 = Monday … 7 = Sunday. */
  weekdays: number[]
  /** 0 = every week; n = a cycle of n weeks of which the first `step` weeks are on. */
  repeatEveryWeeks: number
  step: number
  isPayable: boolean
  employeeCount: number
  /** Rest days the rule made (dates already rest days elsewhere are not counted). */
  restDayCount: number
  /** On the single record only. */
  employees: RestDayRuleEmployee[]
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface RestDayRuleInput {
  fromDate: string
  toDate: string
  weekdays: number[]
  repeatEveryWeeks: number
  step: number
  isPayable: boolean
  employeeIds: string[]
  rowVersion?: string | null
}

/** `POST /scheduling/settings/rest-days/delete-range`. */
export interface RestDayRangeDelete {
  startDate: string
  endDate: string
  employeeIds: string[]
  allEmployees: boolean
}

export interface BulkDeleteResult {
  deletedSchedules: number
  deletedRestDays: number
}

// --- pickers -------------------------------------------------------------------------------------

/** A `GET /employees/lookup` row (the endpoint answers pages: `{data, meta}`). */
export interface EmployeeOption {
  id: string
  code: string
  name: string
  designationName: string | null
  jobTitleName: string | null
  departmentId?: string | null
  departmentName: string | null
  branchId?: string | null
  branchName: string
  status: string
  photoUrl?: string | null
}

/** `GET /organisation/lookups/{kind}`. */
export interface LookupOption {
  id: string
  name: string
  code?: string | null
  parentId?: string | null
}

export const ORG_LOOKUP_KINDS = [
  'locations',
  'areas',
  'branches',
  'departments',
  'designations',
  'grades',
  'job-titles',
] as const
export type OrgLookupKind = (typeof ORG_LOOKUP_KINDS)[number]

/** `GET /organisation/geo/countries | states | cities`. */
export interface CountryOption {
  id: string
  code: string
  name: string
}

export interface StateOption {
  id: string
  code: string
  name: string
  countryId: string
  countryCode: string
}

export interface CityOption {
  id: string
  name: string
  stateId: string
  stateCode: string
}

export interface ListParams {
  page: number
  pageSize: number
  q?: string
}

export type SettingsPage<T> = Paginated<T>
