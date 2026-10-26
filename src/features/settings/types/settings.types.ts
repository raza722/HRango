/**
 * Settings → Control Panel data model, as the API sends it (`/api/organisation/*`).
 * Organisation hierarchy: Company → Location → Area → Branch; Job Titles stand alone.
 * Every record belongs to the active company (the user's current company; `X-Company-Id`
 * switches it), so forms do not pick a company.
 */

/** `GET /organisation/lookups/companies`: companies the user may switch to. */
export interface Company {
  id: string
  name: string
  /** The company the API is answering for now. */
  isCurrent: boolean
}

/** `GET /employees/lookup`: someone a picker can offer (e.g. a branch manager). */
export interface Employee {
  id: string
  code: string
  name: string
  designationName: string | null
  jobTitleName: string | null
  departmentId: string | null
  departmentName: string | null
  branchId: string | null
  branchName: string
  status: string
  photoUrl: string | null
}

/** `GET /organisation/geo/countries`; `code` is ISO 3166-1 alpha-2 (PK). */
export interface Country {
  id: string
  code: string
  name: string
}

/** `GET /organisation/geo/states?countryId=`; `code` is ISO 3166-2 (PK-PB). */
export interface State {
  id: string
  code: string
  name: string
  countryId: string
  countryCode: string
}

/** Kept for older imports: a state / province. */
export type Region = State

/** `GET /organisation/geo/cities?stateId=`. */
export interface City {
  id: string
  name: string
  stateId: string
  stateCode: string
}

/** `GET /organisation/lookups/{kind}`: id and name for a picker. */
export interface LookupItem {
  id: string
  name: string
  code: string | null
  /** The location of an area or branch; the parent of a department. */
  parentId: string | null
}

/** A result of "Search Location" (mock geocoder only; the API has none). */
export interface GeoPlace {
  id: string
  label: string
  latitude: number
  longitude: number
}

interface Stamped {
  createdAt: string
  /** `null` until the record is first edited. */
  updatedAt: string | null
  /** Send back with edits and deletes; a stale one is refused with 409. */
  rowVersion: string
}

export interface OrgLocation extends Stamped {
  id: string
  companyId: string
  companyName: string
  name: string
  employeePrefix: string | null
  description: string | null
  latitude: number | null
  longitude: number | null
  branchCount: number
}

export interface OrgArea extends Stamped {
  id: string
  locationId: string
  locationName: string
  name: string
  description: string | null
  branchCount: number
}

export interface OrgBranch extends Stamped {
  id: string
  companyId: string
  companyName: string
  name: string
  employeePrefix: string | null
  description: string | null
  locationId: string
  locationName: string
  areaId: string | null
  areaName: string | null
  managerId: string | null
  managerName: string | null
  countryId: string | null
  countryCode: string | null
  countryName: string | null
  stateId: string | null
  stateCode: string | null
  stateName: string | null
  cityId: string | null
  cityName: string | null
  latitude: number | null
  longitude: number | null
  employeeCount: number
}

export interface JobTitle extends Stamped {
  id: string
  name: string
  limitHeadCount: boolean
  /** Required when `limitHeadCount` is on. */
  maxHeadCount: number | null
  description: string | null
  /** Employees holding the title now (not left or inactive). */
  headCount: number
}

/** List rows and single records have the same shape. */
export type LocationRow = OrgLocation
export type AreaRow = OrgArea
export type BranchRow = OrgBranch
export type JobTitleRow = JobTitle

/** Request bodies (`rowVersion` is added by the resource when editing). */
export interface OrgLocationInput {
  name: string
  employeePrefix: string | null
  description: string | null
  latitude: number | null
  longitude: number | null
}

export interface OrgAreaInput {
  name: string
  locationId: string
  description: string | null
}

export interface OrgBranchInput {
  name: string
  employeePrefix: string | null
  locationId: string
  areaId: string | null
  managerId: string | null
  description: string | null
  countryId: string | null
  stateId: string | null
  cityId: string | null
  latitude: number | null
  longitude: number | null
}

export interface JobTitleInput {
  name: string
  limitHeadCount: boolean
  maxHeadCount: number | null
  description: string | null
}

export const WEEK_START_DAYS = ['monday', 'saturday', 'sunday'] as const
export type WeekStartDay = (typeof WEEK_START_DAYS)[number]

export const DATE_FORMATS = ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'dd MMM yyyy'] as const
export type DateFormat = (typeof DATE_FORMATS)[number]

/** Settings → Control Panel → General Settings: the active company (`GET /organisation/general`). */
export interface GeneralSettings {
  id: string
  organizationName: string
  legalName: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  countryId: string | null
  countryName: string | null
  timezone: string | null
  currency: string | null
  dateFormat: string | null
  weekStartsOn: string | null
  /** Month the fiscal year starts in, 1–12. */
  fiscalYearStartMonth: number | null
  isActive: boolean
  /** The organisation's logo (sidebar); `PUT /organisation/general/logo` changes it. */
  logoFileId?: string | null
  logoUrl?: string | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** `PUT /organisation/general`. */
export interface GeneralSettingsInput {
  organizationName: string
  legalName: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  countryId: string | null
  timezone: string
  currency: string
  dateFormat: DateFormat
  weekStartsOn: WeekStartDay
  fiscalYearStartMonth: number
  rowVersion: string
}
