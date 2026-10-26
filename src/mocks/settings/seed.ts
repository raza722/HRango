import type {
  City,
  Company,
  Country,
  GeneralSettings,
  GeoPlace,
  JobTitle,
  OrgArea,
  OrgBranch,
  OrgLocation,
  State,
} from '@/features/settings'

import { randomHex } from '../utils'

/**
 * Mock tables of Settings → Control Panel. Records are stored without the names and counts
 * the API adds to its answers (`handlers.ts` adds them); ids keep the readable mock prefixes.
 */
export type MockLocation = Omit<OrgLocation, 'companyName' | 'branchCount'>
export type MockArea = Omit<OrgArea, 'locationName' | 'branchCount'>
export type MockBranch = Omit<
  OrgBranch,
  | 'companyName'
  | 'locationName'
  | 'areaName'
  | 'managerName'
  | 'countryCode'
  | 'countryName'
  | 'stateCode'
  | 'stateName'
  | 'cityName'
  | 'employeeCount'
>
export type MockJobTitle = Omit<JobTitle, 'headCount'>
export type MockGeneralSettings = Omit<GeneralSettings, 'countryName'>

/** The active company of the mock session (the API answers for one company at a time). */
export const CURRENT_COMPANY_ID = 'co_topedge'

export const COMPANIES: Company[] = [
  { id: 'co_topedge', name: 'Top Edge Technologies', isCurrent: true },
  { id: 'co_topedge_me', name: 'Top Edge Solutions FZ-LLC', isCurrent: false },
]

export const COUNTRIES: Country[] = [
  { id: 'cn_pk', code: 'PK', name: 'Pakistan' },
  { id: 'cn_ae', code: 'AE', name: 'United Arab Emirates' },
  { id: 'cn_gb', code: 'GB', name: 'United Kingdom' },
  { id: 'cn_us', code: 'US', name: 'United States' },
]

const state = (code: string, name: string): State => {
  const countryCode = code.slice(0, 2)
  return {
    id: `st_${code.toLowerCase().replace('-', '_')}`,
    code,
    name,
    countryId: `cn_${countryCode.toLowerCase()}`,
    countryCode,
  }
}

export const STATES: State[] = [
  state('PK-PB', 'Punjab'),
  state('PK-SD', 'Sindh'),
  state('PK-IS', 'Islamabad Capital Territory'),
  state('PK-KP', 'Khyber Pakhtunkhwa'),
  state('AE-DU', 'Dubai'),
  state('AE-AZ', 'Abu Dhabi'),
  state('GB-ENG', 'England'),
  state('GB-SCT', 'Scotland'),
  state('US-CA', 'California'),
  state('US-NY', 'New York'),
]

/** Kept for the attendance mock (holiday rules pick regions by code). */
export const REGIONS = STATES

/** A city; `regionCode` repeats `stateCode` for the attendance mock's holiday rules. */
export type MockCity = City & { regionCode: string }

const city = (id: string, name: string, stateCode: string): MockCity => ({
  id,
  name,
  stateId: `st_${stateCode.toLowerCase().replace('-', '_')}`,
  stateCode,
  regionCode: stateCode,
})

export const CITIES: MockCity[] = [
  city('ct_lhr', 'Lahore', 'PK-PB'),
  city('ct_rwp', 'Rawalpindi', 'PK-PB'),
  city('ct_fsd', 'Faisalabad', 'PK-PB'),
  city('ct_mux', 'Multan', 'PK-PB'),
  city('ct_khi', 'Karachi', 'PK-SD'),
  city('ct_hdd', 'Hyderabad', 'PK-SD'),
  city('ct_isb', 'Islamabad', 'PK-IS'),
  city('ct_pew', 'Peshawar', 'PK-KP'),
  city('ct_abt', 'Abbottabad', 'PK-KP'),
  city('ct_dxb', 'Dubai', 'AE-DU'),
  city('ct_auh', 'Abu Dhabi', 'AE-AZ'),
  city('ct_lon', 'London', 'GB-ENG'),
  city('ct_man', 'Manchester', 'GB-ENG'),
  city('ct_edi', 'Edinburgh', 'GB-SCT'),
  city('ct_sfo', 'San Francisco', 'US-CA'),
  city('ct_lax', 'Los Angeles', 'US-CA'),
  city('ct_nyc', 'New York City', 'US-NY'),
]

/** A fresh row version, as the API's `rowversion` columns hand out (16 hex digits). */
export const newRowVersion = () => randomHex(8)

/** Places "Search Location" can find (a stand-in for a real geocoding service). */
export const PLACES: GeoPlace[] = [
  {
    id: 'pl_1',
    label: 'Top Edge Technologies, Gulberg III, Lahore',
    latitude: 31.5136,
    longitude: 74.3434,
  },
  { id: 'pl_2', label: 'Johar Town, Lahore', latitude: 31.4697, longitude: 74.2728 },
  { id: 'pl_3', label: 'DHA Phase 5, Lahore', latitude: 31.4627, longitude: 74.4086 },
  {
    id: 'pl_4',
    label: 'Arfa Software Technology Park, Lahore',
    latitude: 31.4757,
    longitude: 74.3424,
  },
  { id: 'pl_5', label: 'Blue Area, Islamabad', latitude: 33.7104, longitude: 73.0605 },
  { id: 'pl_6', label: 'F-7 Markaz, Islamabad', latitude: 33.7213, longitude: 73.0545 },
  { id: 'pl_7', label: 'Saddar, Rawalpindi', latitude: 33.5973, longitude: 73.0479 },
  { id: 'pl_8', label: 'Shahrah-e-Faisal, Karachi', latitude: 24.8718, longitude: 67.0802 },
  { id: 'pl_9', label: 'Clifton, Karachi', latitude: 24.8138, longitude: 67.0299 },
  { id: 'pl_10', label: 'I.I. Chundrigar Road, Karachi', latitude: 24.8495, longitude: 67.0066 },
  { id: 'pl_11', label: 'University Road, Peshawar', latitude: 34.0007, longitude: 71.4859 },
  { id: 'pl_12', label: 'Gagan Thall, Abbottabad', latitude: 34.1489, longitude: 73.2462 },
  { id: 'pl_13', label: 'Faisalabad Industrial Estate', latitude: 31.4504, longitude: 73.135 },
  { id: 'pl_14', label: 'Dubai Internet City, Dubai', latitude: 25.0957, longitude: 55.1572 },
  { id: 'pl_15', label: 'Business Bay, Dubai', latitude: 25.1857, longitude: 55.2681 },
  { id: 'pl_16', label: 'Al Maryah Island, Abu Dhabi', latitude: 24.501, longitude: 54.3896 },
  { id: 'pl_17', label: 'Canary Wharf, London', latitude: 51.5054, longitude: -0.0235 },
  { id: 'pl_18', label: 'King’s Cross, London', latitude: 51.5308, longitude: -0.1238 },
  { id: 'pl_19', label: 'Spinningfields, Manchester', latitude: 53.4808, longitude: -2.2513 },
  { id: 'pl_20', label: 'SoMa, San Francisco', latitude: 37.7785, longitude: -122.4056 },
  { id: 'pl_21', label: 'Midtown Manhattan, New York', latitude: 40.7549, longitude: -73.984 },
]

const stamp = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()

export function seedLocations(): MockLocation[] {
  return [
    {
      id: 'lc_lhr',
      name: 'Lahore',
      employeePrefix: 'LHR',
      companyId: 'co_topedge',
      description: 'Head office and main development centre.',
      latitude: 31.5136,
      longitude: 74.3434,
      createdAt: stamp(120),
      updatedAt: stamp(10),
      rowVersion: newRowVersion(),
    },
    {
      id: 'lc_isb',
      name: 'Islamabad',
      employeePrefix: 'ISB',
      companyId: 'co_topedge',
      description: 'Federal capital office.',
      latitude: 33.7104,
      longitude: 73.0605,
      createdAt: stamp(110),
      updatedAt: stamp(30),
      rowVersion: newRowVersion(),
    },
    {
      id: 'lc_khi',
      name: 'Karachi',
      employeePrefix: 'KHI',
      companyId: 'co_topedge',
      description: 'Sales and support.',
      latitude: 24.8718,
      longitude: 67.0802,
      createdAt: stamp(100),
      updatedAt: stamp(40),
      rowVersion: newRowVersion(),
    },
    {
      id: 'lc_dxb',
      name: 'Dubai',
      employeePrefix: 'DXB',
      companyId: 'co_topedge_me',
      description: 'Middle East regional office.',
      latitude: 25.0957,
      longitude: 55.1572,
      createdAt: stamp(90),
      updatedAt: stamp(20),
      rowVersion: newRowVersion(),
    },
  ]
}

export function seedAreas(): MockArea[] {
  return [
    {
      id: 'ar_gulberg',
      name: 'Gulberg',
      locationId: 'lc_lhr',
      description: null,
      createdAt: stamp(80),
      updatedAt: stamp(80),
      rowVersion: newRowVersion(),
    },
    {
      id: 'ar_johar',
      name: 'Johar Town',
      locationId: 'lc_lhr',
      description: null,
      createdAt: stamp(79),
      updatedAt: stamp(79),
      rowVersion: newRowVersion(),
    },
    {
      id: 'ar_blue',
      name: 'Blue Area',
      locationId: 'lc_isb',
      description: 'Commercial district.',
      createdAt: stamp(78),
      updatedAt: stamp(78),
      rowVersion: newRowVersion(),
    },
    {
      id: 'ar_sharea',
      name: 'Shahrah-e-Faisal',
      locationId: 'lc_khi',
      description: null,
      createdAt: stamp(77),
      updatedAt: stamp(77),
      rowVersion: newRowVersion(),
    },
    {
      id: 'ar_dic',
      name: 'Internet City',
      locationId: 'lc_dxb',
      description: null,
      createdAt: stamp(76),
      updatedAt: stamp(76),
      rowVersion: newRowVersion(),
    },
  ]
}

export function seedBranches(): MockBranch[] {
  return [
    {
      id: 'br_lhr_ho',
      name: 'Lahore Head Office',
      employeePrefix: 'TE-LHR',
      companyId: 'co_topedge',
      locationId: 'lc_lhr',
      areaId: 'ar_gulberg',
      managerId: 'em_ayesha',
      description: 'Corporate headquarters, Gulberg III.',
      countryId: 'cn_pk',
      stateId: 'st_pk_pb',
      cityId: 'ct_lhr',
      latitude: 31.5136,
      longitude: 74.3434,
      createdAt: stamp(70),
      updatedAt: stamp(5),
      rowVersion: newRowVersion(),
    },
    {
      id: 'br_lhr_jt',
      name: 'Johar Town Delivery Centre',
      employeePrefix: 'TE-JT',
      companyId: 'co_topedge',
      locationId: 'lc_lhr',
      areaId: 'ar_johar',
      managerId: 'em_bilal',
      description: null,
      countryId: 'cn_pk',
      stateId: 'st_pk_pb',
      cityId: 'ct_lhr',
      latitude: 31.4697,
      longitude: 74.2728,
      createdAt: stamp(60),
      updatedAt: stamp(15),
      rowVersion: newRowVersion(),
    },
    {
      id: 'br_isb',
      name: 'Islamabad Office',
      employeePrefix: 'TE-ISB',
      companyId: 'co_topedge',
      locationId: 'lc_isb',
      areaId: 'ar_blue',
      managerId: 'em_omar',
      description: null,
      countryId: 'cn_pk',
      stateId: 'st_pk_is',
      cityId: 'ct_isb',
      latitude: 33.7104,
      longitude: 73.0605,
      createdAt: stamp(50),
      updatedAt: stamp(25),
      rowVersion: newRowVersion(),
    },
    {
      id: 'br_khi',
      name: 'Karachi Sales Office',
      employeePrefix: 'TE-KHI',
      companyId: 'co_topedge',
      locationId: 'lc_khi',
      areaId: 'ar_sharea',
      managerId: 'em_sara',
      description: null,
      countryId: 'cn_pk',
      stateId: 'st_pk_sd',
      cityId: 'ct_khi',
      latitude: 24.8718,
      longitude: 67.0802,
      createdAt: stamp(40),
      updatedAt: stamp(12),
      rowVersion: newRowVersion(),
    },
    {
      id: 'br_dxb',
      name: 'Dubai Regional Office',
      employeePrefix: 'TE-DXB',
      companyId: 'co_topedge_me',
      locationId: 'lc_dxb',
      areaId: 'ar_dic',
      managerId: 'em_daniel',
      description: null,
      countryId: 'cn_ae',
      stateId: 'st_ae_du',
      cityId: 'ct_dxb',
      latitude: 25.0957,
      longitude: 55.1572,
      createdAt: stamp(30),
      updatedAt: stamp(8),
      rowVersion: newRowVersion(),
    },
    {
      id: 'br_rwp',
      name: 'Rawalpindi Support Desk',
      employeePrefix: 'TE-RWP',
      companyId: 'co_topedge',
      locationId: 'lc_isb',
      areaId: null,
      managerId: null,
      description: 'Satellite support desk serving the twin cities.',
      countryId: 'cn_pk',
      stateId: 'st_pk_pb',
      cityId: 'ct_rwp',
      latitude: 33.5973,
      longitude: 73.0479,
      createdAt: stamp(20),
      updatedAt: stamp(3),
      rowVersion: newRowVersion(),
    },
  ]
}

export function seedJobTitles(): MockJobTitle[] {
  const job = (
    id: string,
    name: string,
    max: number | null,
    description: string | null = null,
    age = 50,
  ): MockJobTitle => ({
    id,
    name,
    limitHeadCount: max !== null,
    maxHeadCount: max,
    description,
    createdAt: stamp(age),
    updatedAt: stamp(Math.floor(age / 3)),
    rowVersion: newRowVersion(),
  })
  return [
    job('jt_hrm', 'HR Manager', 2, 'Owns people operations and policy.', 60),
    job('jt_swe', 'Software Engineer', null, 'Builds and maintains products.', 58),
    job('jt_sse', 'Senior Software Engineer', 25, null, 56),
    job('jt_qa', 'QA Engineer', 10, null, 54),
    job('jt_pm', 'Project Manager', 6, null, 52),
    job('jt_acc', 'Accountant', 4, null, 50),
    job('jt_exec', 'Marketing Executive', null, null, 48),
  ]
}

export function seedGeneralSettings(): MockGeneralSettings {
  return {
    id: CURRENT_COMPANY_ID,
    organizationName: 'Top Edge Technologies',
    legalName: 'Top Edge Technologies (Private) Limited',
    email: 'hr@topedge.tech',
    phone: '+92 42 3577 0000',
    website: 'https://topedge.tech',
    address: '45-B, Gulberg III, Lahore, Pakistan',
    countryId: 'cn_pk',
    timezone: 'Asia/Karachi',
    currency: 'PKR',
    dateFormat: 'dd MMM yyyy',
    weekStartsOn: 'monday',
    fiscalYearStartMonth: 7,
    isActive: true,
    createdAt: stamp(400),
    updatedAt: stamp(14),
    rowVersion: newRowVersion(),
  }
}
