/**
 * Settings → Control Panel data model.
 * Organisation hierarchy: Company → Location → Area → Branch; Job Titles stand alone.
 * (The designs label the parent select "Branch" but every placeholder says
 * "Select Company", and the Branch form picks a Location and an Area.)
 */

export interface Company {
  id: string
  name: string
}

/** Someone who can manage a branch. */
export interface Employee {
  id: string
  name: string
  jobTitle: string
}

export interface Country {
  code: string
  name: string
}

export interface Region {
  code: string
  name: string
  countryCode: string
}

export interface City {
  id: string
  name: string
  regionCode: string
}

/** A result of "Search Location". */
export interface GeoPlace {
  id: string
  label: string
  latitude: number
  longitude: number
}

interface Timestamps {
  createdAt: string
  updatedAt: string
}

export interface OrgLocation extends Timestamps {
  id: string
  name: string
  employeePrefix: string
  companyId: string
  description: string
  latitude: number | null
  longitude: number | null
}

export interface OrgArea extends Timestamps {
  id: string
  name: string
  locationId: string
  description: string
}

export interface OrgBranch extends Timestamps {
  id: string
  name: string
  employeePrefix: string
  companyId: string
  locationId: string
  areaId: string | null
  managerId: string | null
  description: string
  countryCode: string | null
  regionCode: string | null
  cityId: string | null
  latitude: number | null
  longitude: number | null
}

export interface JobTitle extends Timestamps {
  id: string
  name: string
  limitHeadCount: boolean
  /** Required when `limitHeadCount` is on. */
  maxHeadCount: number | null
  description: string
}

/** List rows carry display names resolved by the API. */
export interface LocationRow extends OrgLocation {
  companyName: string
}
export interface AreaRow extends OrgArea {
  locationName: string
}
export interface BranchRow extends OrgBranch {
  companyName: string
  locationName: string
  areaName: string | null
  managerName: string | null
  cityName: string | null
}
export type JobTitleRow = JobTitle

type Input<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>
export type OrgLocationInput = Input<OrgLocation>
export type OrgAreaInput = Input<OrgArea>
export type OrgBranchInput = Input<OrgBranch>
export type JobTitleInput = Input<JobTitle>

export const WEEK_START_DAYS = ['monday', 'saturday', 'sunday'] as const
export type WeekStartDay = (typeof WEEK_START_DAYS)[number]

export const DATE_FORMATS = ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'dd MMM yyyy'] as const
export type DateFormat = (typeof DATE_FORMATS)[number]

/** Settings → Control Panel → General Settings. */
export interface GeneralSettings {
  organizationName: string
  legalName: string
  email: string
  phone: string
  website: string
  address: string
  timezone: string
  currency: string
  dateFormat: DateFormat
  weekStartsOn: WeekStartDay
  /** Month the fiscal year starts in, 1–12. */
  fiscalYearStartMonth: number
  updatedAt: string
}

export type GeneralSettingsInput = Omit<GeneralSettings, 'updatedAt'>
