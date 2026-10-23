import type {
  City,
  Company,
  Country,
  Employee,
  GeneralSettings,
  GeoPlace,
  JobTitle,
  OrgArea,
  OrgBranch,
  OrgLocation,
  Region,
} from '@/features/settings'

import { DIRECTORY } from '../employees/seed'

export const COMPANIES: Company[] = [
  { id: 'co_topedge', name: 'Top Edge Technologies' },
  { id: 'co_topedge_me', name: 'Top Edge Solutions FZ-LLC' },
]

/** Branch Manager options: everyone in the shared mock directory. */
export const EMPLOYEES: Employee[] = DIRECTORY.map(({ id, name, jobTitle }) => ({
  id,
  name,
  jobTitle,
}))

export const COUNTRIES: Country[] = [
  { code: 'PK', name: 'Pakistan' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
]

export const REGIONS: Region[] = [
  { code: 'PK-PB', name: 'Punjab', countryCode: 'PK' },
  { code: 'PK-SD', name: 'Sindh', countryCode: 'PK' },
  { code: 'PK-IS', name: 'Islamabad Capital Territory', countryCode: 'PK' },
  { code: 'PK-KP', name: 'Khyber Pakhtunkhwa', countryCode: 'PK' },
  { code: 'AE-DU', name: 'Dubai', countryCode: 'AE' },
  { code: 'AE-AZ', name: 'Abu Dhabi', countryCode: 'AE' },
  { code: 'GB-ENG', name: 'England', countryCode: 'GB' },
  { code: 'GB-SCT', name: 'Scotland', countryCode: 'GB' },
  { code: 'US-CA', name: 'California', countryCode: 'US' },
  { code: 'US-NY', name: 'New York', countryCode: 'US' },
]

export const CITIES: City[] = [
  { id: 'ct_lhr', name: 'Lahore', regionCode: 'PK-PB' },
  { id: 'ct_rwp', name: 'Rawalpindi', regionCode: 'PK-PB' },
  { id: 'ct_fsd', name: 'Faisalabad', regionCode: 'PK-PB' },
  { id: 'ct_mux', name: 'Multan', regionCode: 'PK-PB' },
  { id: 'ct_khi', name: 'Karachi', regionCode: 'PK-SD' },
  { id: 'ct_hdd', name: 'Hyderabad', regionCode: 'PK-SD' },
  { id: 'ct_isb', name: 'Islamabad', regionCode: 'PK-IS' },
  { id: 'ct_pew', name: 'Peshawar', regionCode: 'PK-KP' },
  { id: 'ct_abt', name: 'Abbottabad', regionCode: 'PK-KP' },
  { id: 'ct_dxb', name: 'Dubai', regionCode: 'AE-DU' },
  { id: 'ct_auh', name: 'Abu Dhabi', regionCode: 'AE-AZ' },
  { id: 'ct_lon', name: 'London', regionCode: 'GB-ENG' },
  { id: 'ct_man', name: 'Manchester', regionCode: 'GB-ENG' },
  { id: 'ct_edi', name: 'Edinburgh', regionCode: 'GB-SCT' },
  { id: 'ct_sfo', name: 'San Francisco', regionCode: 'US-CA' },
  { id: 'ct_lax', name: 'Los Angeles', regionCode: 'US-CA' },
  { id: 'ct_nyc', name: 'New York City', regionCode: 'US-NY' },
]

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

export function seedLocations(): OrgLocation[] {
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
    },
  ]
}

export function seedAreas(): OrgArea[] {
  return [
    {
      id: 'ar_gulberg',
      name: 'Gulberg',
      locationId: 'lc_lhr',
      description: '',
      createdAt: stamp(80),
      updatedAt: stamp(80),
    },
    {
      id: 'ar_johar',
      name: 'Johar Town',
      locationId: 'lc_lhr',
      description: '',
      createdAt: stamp(79),
      updatedAt: stamp(79),
    },
    {
      id: 'ar_blue',
      name: 'Blue Area',
      locationId: 'lc_isb',
      description: 'Commercial district.',
      createdAt: stamp(78),
      updatedAt: stamp(78),
    },
    {
      id: 'ar_sharea',
      name: 'Shahrah-e-Faisal',
      locationId: 'lc_khi',
      description: '',
      createdAt: stamp(77),
      updatedAt: stamp(77),
    },
    {
      id: 'ar_dic',
      name: 'Internet City',
      locationId: 'lc_dxb',
      description: '',
      createdAt: stamp(76),
      updatedAt: stamp(76),
    },
  ]
}

export function seedBranches(): OrgBranch[] {
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
      countryCode: 'PK',
      regionCode: 'PK-PB',
      cityId: 'ct_lhr',
      latitude: 31.5136,
      longitude: 74.3434,
      createdAt: stamp(70),
      updatedAt: stamp(5),
    },
    {
      id: 'br_lhr_jt',
      name: 'Johar Town Delivery Centre',
      employeePrefix: 'TE-JT',
      companyId: 'co_topedge',
      locationId: 'lc_lhr',
      areaId: 'ar_johar',
      managerId: 'em_bilal',
      description: '',
      countryCode: 'PK',
      regionCode: 'PK-PB',
      cityId: 'ct_lhr',
      latitude: 31.4697,
      longitude: 74.2728,
      createdAt: stamp(60),
      updatedAt: stamp(15),
    },
    {
      id: 'br_isb',
      name: 'Islamabad Office',
      employeePrefix: 'TE-ISB',
      companyId: 'co_topedge',
      locationId: 'lc_isb',
      areaId: 'ar_blue',
      managerId: 'em_omar',
      description: '',
      countryCode: 'PK',
      regionCode: 'PK-IS',
      cityId: 'ct_isb',
      latitude: 33.7104,
      longitude: 73.0605,
      createdAt: stamp(50),
      updatedAt: stamp(25),
    },
    {
      id: 'br_khi',
      name: 'Karachi Sales Office',
      employeePrefix: 'TE-KHI',
      companyId: 'co_topedge',
      locationId: 'lc_khi',
      areaId: 'ar_sharea',
      managerId: 'em_sara',
      description: '',
      countryCode: 'PK',
      regionCode: 'PK-SD',
      cityId: 'ct_khi',
      latitude: 24.8718,
      longitude: 67.0802,
      createdAt: stamp(40),
      updatedAt: stamp(12),
    },
    {
      id: 'br_dxb',
      name: 'Dubai Regional Office',
      employeePrefix: 'TE-DXB',
      companyId: 'co_topedge_me',
      locationId: 'lc_dxb',
      areaId: 'ar_dic',
      managerId: 'em_daniel',
      description: '',
      countryCode: 'AE',
      regionCode: 'AE-DU',
      cityId: 'ct_dxb',
      latitude: 25.0957,
      longitude: 55.1572,
      createdAt: stamp(30),
      updatedAt: stamp(8),
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
      countryCode: 'PK',
      regionCode: 'PK-PB',
      cityId: 'ct_rwp',
      latitude: 33.5973,
      longitude: 73.0479,
      createdAt: stamp(20),
      updatedAt: stamp(3),
    },
  ]
}

export function seedJobTitles(): JobTitle[] {
  const job = (
    id: string,
    name: string,
    max: number | null,
    description = '',
    age = 50,
  ): JobTitle => ({
    id,
    name,
    limitHeadCount: max !== null,
    maxHeadCount: max,
    description,
    createdAt: stamp(age),
    updatedAt: stamp(Math.floor(age / 3)),
  })
  return [
    job('jt_hrm', 'HR Manager', 2, 'Owns people operations and policy.', 60),
    job('jt_swe', 'Software Engineer', null, 'Builds and maintains products.', 58),
    job('jt_sse', 'Senior Software Engineer', 25, '', 56),
    job('jt_qa', 'QA Engineer', 10, '', 54),
    job('jt_pm', 'Project Manager', 6, '', 52),
    job('jt_acc', 'Accountant', 4, '', 50),
    job('jt_exec', 'Marketing Executive', null, '', 48),
  ]
}

export function seedGeneralSettings(): GeneralSettings {
  return {
    organizationName: 'Top Edge Technologies',
    legalName: 'Top Edge Technologies (Private) Limited',
    email: 'hr@topedge.tech',
    phone: '+92 42 3577 0000',
    website: 'https://topedge.tech',
    address: '45-B, Gulberg III, Lahore, Pakistan',
    timezone: 'Asia/Karachi',
    currency: 'PKR',
    dateFormat: 'dd MMM yyyy',
    weekStartsOn: 'monday',
    fiscalYearStartMonth: 7,
    updatedAt: stamp(14),
  }
}
