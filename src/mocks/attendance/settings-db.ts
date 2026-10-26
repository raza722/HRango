import { format, subDays } from 'date-fns'

import type {
  AttendanceSettings,
  AudienceTarget,
  BreakTypeRecord,
  Holiday,
  HolidayRule,
  IpRestriction,
  LocalDateTime,
  RestDayRule,
} from '@/features/attendance'

import { createMockCollection } from '../collection'
import { type DirectoryEmployee, findEmployee } from '../employees/seed'
import { profileOf } from '../scheduling/seed'

const stamp = (days: number) => subDays(new Date(), days).toISOString()

let versionCounter = 0
/** A new opaque rowVersion, as the API hands back after every write. */
export function nextRowVersion(): string {
  versionCounter += 1
  return `0x${Date.now().toString(16).padStart(12, '0')}${versionCounter.toString(16).padStart(4, '0')}`
}

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
      allowMultiShift: true,
      pictureOnDashboardPunch: true,
      minimumWorkableMinutes: 0,
      lateGraceMinutes: 5,
      rowVersion: '0x0000000000000001',
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
  rowVersion: `0x${String(days).padStart(16, '0')}`,
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

const branchTarget = (id: string): AudienceTarget => ({
  targetType: 'branch',
  targetId: id,
  targetValue: null,
})

function ip(
  number: number,
  extra: Partial<IpRestriction> & Pick<IpRestriction, 'ipv4'>,
): IpRestriction {
  const targets = extra.targets ?? []
  return {
    id: `ipr_${number}`,
    code: `IPR-${String(number).padStart(5, '0')}`,
    ipv6: null,
    netmask: null,
    rangeStart: null,
    rangeEnd: null,
    appliesToAll: targets.length === 0,
    isActive: true,
    addressCount: null,
    targetCount: targets.length,
    createdAt: stamp(60 - number),
    updatedAt: stamp(30 - number),
    rowVersion: `0x${String(number).padStart(16, '0')}`,
    ...extra,
    targets,
  }
}

function seedIpRestrictions(): IpRestriction[] {
  return [
    ip(1, { ipv4: '192.168.2.38/31', addressCount: 2 }),
    ip(2, { ipv4: '192.168.10.0', netmask: '255.255.255.0', addressCount: 256 }),
    ip(3, { ipv4: '10.20.0.0/16', addressCount: 65536, targets: [branchTarget('br_lhr_jt')] }),
    ip(4, { ipv4: '172.16.5.0/24', addressCount: 256 }),
    ip(5, {
      ipv4: null,
      rangeStart: '192.168.50.10',
      rangeEnd: '192.168.50.60',
      addressCount: 51,
    }),
    ip(6, {
      ipv4: '10.50.1.0/24',
      ipv6: '2001:0db8:85a3::/64',
      addressCount: null,
      targets: [{ targetType: 'location', targetId: 'lc_dxb', targetValue: null }],
    }),
    ip(7, { ipv4: '10.8.0.0/24', addressCount: 256, isActive: false }),
  ]
}

/**
 * Settings → Geo Fencing details of the fences Scheduling picks from (the name and the drawing
 * live in Scheduling's `geoFences`). Scheduling reads `id` and `active`.
 */
export interface GeoFenceSettings {
  id: string
  code: string
  forShift: boolean
  allEmployees: boolean
  targets: AudienceTarget[]
  joiningFromDate: string | null
  joiningToDate: string | null
  active: boolean
  updatedAt: string | null
  rowVersion: string
}

function seedGeoFenceSettings(): GeoFenceSettings[] {
  const fence = (id: string, number: number, extra: Partial<GeoFenceSettings> = {}) => ({
    id,
    code: `GF-${String(number).padStart(5, '0')}`,
    forShift: true,
    allEmployees: true,
    targets: [],
    joiningFromDate: null,
    joiningToDate: null,
    active: true,
    updatedAt: null,
    rowVersion: `0x${String(number).padStart(16, '0')}`,
    ...extra,
  })
  return [
    fence('gf_001', 1),
    fence('gf_002', 2, { forShift: false }),
    fence('gf_003', 3, { allEmployees: false, targets: [branchTarget('br_lhr_ho')] }),
    fence('gf_004', 4, { forShift: false }),
    fence('gf_005', 5, { allEmployees: false, targets: [branchTarget('br_lhr_jt')] }),
    fence('gf_006', 6),
  ]
}

const rule = (id: string, extra: Partial<HolidayRule>): HolidayRule => ({
  id,
  ruleType: 'org_structure',
  employeeId: null,
  employeeName: null,
  locationId: null,
  locationName: null,
  branchId: null,
  branchName: null,
  countryId: null,
  countryName: null,
  stateId: null,
  stateName: null,
  cityId: null,
  cityName: null,
  religion: null,
  ...extra,
})

/** National holidays of Pakistan, the company's day and a few for some people only. */
const HOLIDAY_DAYS: { day: string; name: string; description: string; rules?: HolidayRule[] }[] = [
  { day: '02-05', name: 'Kashmir Solidarity Day', description: 'Public holiday.' },
  {
    day: '03-21',
    name: 'Nowruz',
    description: 'Persian New Year.',
    rules: [rule('hr_nowruz', { ruleType: 'religion', religion: 'Parsi' })],
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
    rules: [
      rule('hr_uae', {
        ruleType: 'org_structure',
        locationId: 'lc_dxb',
        locationName: 'Dubai',
        branchId: 'br_dxb',
        branchName: 'Dubai Office',
      }),
    ],
  },
  { day: '12-25', name: 'Quaid-e-Azam Day', description: 'Public holiday; also Christmas Day.' },
]

function seedHolidays(): Holiday[] {
  const year = new Date().getFullYear()
  return [year - 1, year, year + 1].flatMap((value) =>
    HOLIDAY_DAYS.map((item) => {
      const date = `${value}-${item.day}`
      const rules = (item.rules ?? []).map((entry) => ({ ...entry, id: `${entry.id}_${value}` }))
      return {
        id: `hol_${value}_${item.day}`,
        name: item.name,
        holidayType: rules.length > 0 ? ('local' as const) : ('public' as const),
        startDate: date,
        endDate: date,
        description: item.description,
        attendanceExempt: true,
        dayCount: 1,
        ruleCount: rules.length,
        rules,
        createdAt: stamp(120),
        updatedAt: stamp(120),
        rowVersion: `0x${String(value).padStart(12, '0')}${item.day.replace('-', '')}`,
      }
    }),
  )
}

/** A rule's people as the API lists them. */
export function ruleEmployees(ids: readonly string[]): RestDayRule['employees'] {
  return ids.flatMap((id) => {
    const employee = findEmployee(id)
    return employee
      ? [
          {
            employeeId: id,
            employeeCode: profileOf(employee).code,
            employeeName: employee.name,
            departmentName: employee.department,
            designationName: employee.jobTitle,
          },
        ]
      : []
  })
}

/** One seeded rule: two people rest on Saturdays this month. */
function seedRestDayRules(): RestDayRule[] {
  const now = new Date()
  const first = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd')
  const last = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd')
  const employees = ruleEmployees(['em_kamal', 'em_rabia'])
  return [
    {
      id: 'rdr_1',
      fromDate: first,
      toDate: last,
      weekdays: [6],
      repeatEveryWeeks: 0,
      step: 1,
      isPayable: true,
      employeeCount: employees.length,
      restDayCount: employees.length * 4,
      employees,
      createdAt: stamp(10),
      updatedAt: null,
      rowVersion: '0x0000000000000101',
    },
  ]
}

// --- collections -------------------------------------------------------------------------------

// Keys end in "-api": records saved in the old (pre-API) shape are not read back.
export const settingsStore = createMockCollection<AttendanceSettings & { id: string }>({
  storageKey: 'hrms-mock-attendance-settings-api',
  seed: () => [{ id: 'settings', ...defaultSettings() }],
})
export const breakTypes = createMockCollection<BreakTypeRecord>({
  storageKey: 'hrms-mock-break-types-api',
  seed: seedBreakTypes,
})
export const ipRestrictions = createMockCollection<IpRestriction>({
  storageKey: 'hrms-mock-ip-restrictions-api',
  seed: seedIpRestrictions,
})
export const geoFenceSettings = createMockCollection<GeoFenceSettings>({
  storageKey: 'hrms-mock-geo-fence-settings-api',
  seed: seedGeoFenceSettings,
})
export const holidays = createMockCollection<Holiday>({
  storageKey: 'hrms-mock-holidays-api',
  seed: seedHolidays,
})
export const restDayRules = createMockCollection<RestDayRule>({
  storageKey: 'hrms-mock-rest-day-rules-api',
  seed: seedRestDayRules,
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
  restDayRules.reset()
  machineSync.reset()
}
