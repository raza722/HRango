import { format, subDays } from 'date-fns'

import type {
  AttendanceSettings,
  AudienceCriteria,
  BreakTypeRecord,
  Holiday,
  HolidayRule,
  IpRestriction,
  LocalDateTime,
} from '@/features/attendance'

import { createMockCollection } from '../collection'
import type { DirectoryEmployee } from '../employees/seed'

const stamp = (days: number) => subDays(new Date(), days).toISOString()

// --- people: the extra facts criteria and holiday rules match on -----------------------

const RELIGION_BY_ID: Record<string, string> = {
  em_daniel: 'Christianity',
  em_jack: 'Christianity',
  em_kamal: 'Hinduism',
  em_maryam: 'Christianity',
  em_rabia: 'Parsi',
}

export function religionOf(employee: DirectoryEmployee): string {
  return RELIGION_BY_ID[employee.id] ?? 'Islam'
}

export function nationalityOf(employee: DirectoryEmployee): string {
  if (employee.id === 'em_daniel' || employee.id === 'em_jack') return 'British'
  return employee.branchId === 'br_dxb' ? 'Emirati' : 'Pakistani'
}

// --- machines -------------------------------------------------------------------------

/** Biometric machines, two per branch (check in, check out) and one spare. */
const MACHINES_BY_BRANCH: Record<string, [number, number]> = {
  br_lhr_ho: [1, 2],
  br_lhr_jt: [3, 4],
  br_isb: [5, 6],
  br_khi: [7, 8],
  br_rwp: [9, 10],
  br_dxb: [11, 12],
}

export const machineCode = (number: number) =>
  `MCH-${String(number).padStart(number > 9 ? 6 : 5, '0')}`

export const MACHINE_IDS = Array.from({ length: 13 }, (_, index) => machineCode(index + 1))

export function machineFor(branchId: string | null, type: string): string {
  const [entry, exit] = (branchId ? MACHINES_BY_BRANCH[branchId] : undefined) ?? [13, 13]
  return machineCode(type === 'check-out' || type === 'break-in' ? exit : entry)
}

export function machineBranch(machineId: string): string | null {
  const number = Number(machineId.slice(4))
  return Object.entries(MACHINES_BY_BRANCH).find(([, pair]) => pair.includes(number))?.[0] ?? null
}

export interface MachineSync {
  id: string
  /** Punches up to this time today have been read from the machine. */
  lastSyncedAt: LocalDateTime
}

function seedMachineSync(): MachineSync[] {
  const today = format(new Date(), 'yyyy-MM-dd')
  return MACHINE_IDS.map((id) => ({ id, lastSyncedAt: `${today}T09:30` }))
}

// --- settings ------------------------------------------------------------------------------

export function defaultSettings(): AttendanceSettings {
  return {
    basic: {
      ignorePunchType: true,
      useCheckInOutForBreaks: true,
      shortDurationOnNonFlexible: true,
      dashboardPunch: true,
      multiShiftPerDay: true,
      pictureOnDashboardPunch: true,
      minimumWorkableMinutes: null,
    },
    scheduling: { geoFenceRequiredOnShift: true, ignoreRestDaysForLeaves: true },
  }
}

const breakType = (id: string, label: string, days: number): BreakTypeRecord => ({
  id,
  name: `${label} Break`,
  startIdentifier: `${label} Break Out`,
  endIdentifier: `${label} Break In`,
  createdAt: stamp(days),
  updatedAt: stamp(days),
})

/** The list of the Break Types frame, plus Personal (used by Scheduling). */
function seedBreakTypes(): BreakTypeRecord[] {
  return [
    breakType('prayer', 'Prayer', 90),
    breakType('lunch', 'Lunch', 89),
    breakType('official-work', 'Official Work', 88),
    breakType('smoking', 'Smoking', 87),
    breakType('game', 'Game', 86),
    breakType('fun', 'Fun', 85),
    breakType('event', 'Event', 84),
    breakType('tea', 'Tea', 83),
    breakType('personal', 'Personal', 82),
  ]
}

export const emptyCriteria = (id: string): AudienceCriteria => ({
  id,
  target: 'organization',
  departments: [],
  locations: [],
  designations: [],
  grades: [],
  religions: [],
  jobTitles: [],
  nationalities: [],
  areas: [],
  branches: [],
  joiningFrom: null,
  joiningTo: null,
  employeeIds: [],
})

function ip(
  number: number,
  name: string,
  ipv4: string,
  extra: Partial<IpRestriction> = {},
): IpRestriction {
  return {
    id: `ipr_${number}`,
    code: `IPR-${String(number).padStart(5, '0')}`,
    name,
    mode: 'netmask',
    ipv4,
    ipv6: null,
    subnetMask: null,
    rangeStart: null,
    rangeEnd: null,
    count: null,
    allEmployees: true,
    criteria: [],
    active: true,
    createdAt: stamp(60 - number),
    updatedAt: stamp(30 - number),
    ...extra,
  }
}

function seedIpRestrictions(): IpRestriction[] {
  return [
    ip(1, 'Head Office Wi-Fi', '192.168.2.38/31', { subnetMask: '255.255.255.254' }),
    ip(2, 'Head Office LAN', '192.168.10.0/24', { subnetMask: '255.255.255.0' }),
    ip(3, 'Johar Town Delivery Centre', '10.20.0.0/16', {
      allEmployees: false,
      criteria: [{ ...emptyCriteria('crit_ipr3'), branches: ['br_lhr_jt'] }],
    }),
    ip(4, 'Islamabad Office', '172.16.5.0/24', { subnetMask: '255.255.255.0' }),
    ip(5, 'Karachi Showroom', '192.168.50.0/24', {
      mode: 'range',
      rangeStart: '192.168.50.10',
      rangeEnd: '192.168.50.60',
      count: 51,
    }),
    ip(6, 'Dubai Office', '10.50.1.0/24', {
      ipv6: '2001:0db8:85a3::/64',
      allEmployees: false,
      criteria: [{ ...emptyCriteria('crit_ipr6'), locations: ['lc_dxb'] }],
    }),
    ip(7, 'Remote VPN Gateway', '10.8.0.0/24', { active: false }),
  ]
}

/** Settings → Geo Fencing details of the fences Scheduling picks from. */
export interface GeoFenceSettings {
  id: string
  code: string
  forShift: boolean
  allEmployees: boolean
  criteria: AudienceCriteria[]
  active: boolean
}

function seedGeoFenceSettings(): GeoFenceSettings[] {
  const fence = (id: string, number: number, extra: Partial<GeoFenceSettings> = {}) => ({
    id,
    code: `GF-${String(number).padStart(5, '0')}`,
    forShift: true,
    allEmployees: true,
    criteria: [],
    active: true,
    ...extra,
  })
  return [
    fence('gf_001', 1),
    fence('gf_002', 2, { forShift: false }),
    fence('gf_003', 3, {
      allEmployees: false,
      criteria: [{ ...emptyCriteria('crit_gf3'), branches: ['br_lhr_ho'] }],
    }),
    fence('gf_004', 4, { forShift: false }),
    fence('gf_005', 5, {
      allEmployees: false,
      criteria: [{ ...emptyCriteria('crit_gf5'), branches: ['br_lhr_jt'] }],
    }),
    fence('gf_006', 6),
  ]
}

const rule = (id: string, name: string, extra: Partial<HolidayRule>): HolidayRule => ({
  id,
  name,
  type: 'organization',
  religion: null,
  countryCode: null,
  regionCode: null,
  cityId: null,
  locationId: null,
  branchId: null,
  employeeIds: [],
  ...extra,
})

/** National holidays of Pakistan, the company's day and a few for some people only. */
const HOLIDAY_DAYS: { day: string; name: string; description: string; rules?: HolidayRule[] }[] = [
  { day: '02-05', name: 'Kashmir Solidarity Day', description: 'Public holiday.' },
  {
    day: '03-21',
    name: 'Nowruz',
    description: 'Persian New Year.',
    rules: [rule('hr_nowruz', 'Parsi staff', { type: 'religion', religion: 'Parsi' })],
  },
  { day: '03-23', name: 'Pakistan Day', description: 'Public holiday.' },
  { day: '05-01', name: 'Labour Day', description: 'Public holiday.' },
  { day: '08-14', name: 'Independence Day', description: 'Public holiday.' },
  {
    day: '10-05',
    name: 'Company Foundation Day',
    description: 'Top Edge Technologies was founded on this day.',
  },
  { day: '11-09', name: 'Iqbal Day', description: 'Public holiday.' },
  {
    day: '12-02',
    name: 'UAE National Day',
    description: 'Public holiday in the United Arab Emirates.',
    rules: [rule('hr_uae', 'Dubai office', { type: 'organization', locationId: 'lc_dxb' })],
  },
  { day: '12-25', name: 'Quaid-e-Azam Day', description: 'Public holiday; also Christmas Day.' },
]

function seedHolidays(): Holiday[] {
  const year = new Date().getFullYear()
  return [year - 1, year, year + 1].flatMap((value) =>
    HOLIDAY_DAYS.map((item) => {
      const date = `${value}-${item.day}`
      return {
        id: `hol_${value}_${item.day}`,
        name: item.name,
        startDate: date,
        endDate: date,
        description: item.description,
        attendanceExempt: true,
        rules: item.rules ?? [],
        createdAt: stamp(120),
        updatedAt: stamp(120),
      }
    }),
  )
}

// --- collections -------------------------------------------------------------------------------

export const settingsStore = createMockCollection<AttendanceSettings & { id: string }>({
  storageKey: 'hrms-mock-attendance-settings',
  seed: () => [{ id: 'settings', ...defaultSettings() }],
})
export const breakTypes = createMockCollection<BreakTypeRecord>({
  storageKey: 'hrms-mock-break-types',
  seed: seedBreakTypes,
})
export const ipRestrictions = createMockCollection<IpRestriction>({
  storageKey: 'hrms-mock-ip-restrictions',
  seed: seedIpRestrictions,
})
export const geoFenceSettings = createMockCollection<GeoFenceSettings>({
  storageKey: 'hrms-mock-geo-fence-settings',
  seed: seedGeoFenceSettings,
})
export const holidays = createMockCollection<Holiday>({
  storageKey: 'hrms-mock-holidays',
  seed: seedHolidays,
})
export const machineSync = createMockCollection<MachineSync>({
  storageKey: 'hrms-mock-machine-sync',
  seed: seedMachineSync,
})

export function currentSettings(): AttendanceSettings {
  const stored = settingsStore.find('settings')
  return stored ? { basic: stored.basic, scheduling: stored.scheduling } : defaultSettings()
}

export function resetAttendanceSettingsDb(): void {
  settingsStore.reset()
  breakTypes.reset()
  ipRestrictions.reset()
  geoFenceSettings.reset()
  holidays.reset()
  machineSync.reset()
}
