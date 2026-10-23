import { addDays, addMonths, endOfMonth, format, startOfMonth } from 'date-fns'

import type { RosterGroup } from '@/features/roster'
import {
  eachDay,
  type EmployeeStatus,
  type EmploymentType,
  type Gender,
  type GeoFence,
  repeatDates,
  type RepeatRule,
  type ScheduleEntry,
  type TimeSlotRules,
  weekdayOf,
} from '@/features/scheduling'

import { DIRECTORY, type DirectoryEmployee } from '../employees/seed'
import { seedRosterGroups } from '../roster/seed'

/** The signed-in demo user in the company directory. */
export const CURRENT_EMPLOYEE_ID = 'em_shelley'

/** Scheduling attributes of a directory person (code, status, group…). */
export interface SchedulingProfile {
  code: string
  status: EmployeeStatus
  employmentType: EmploymentType
  grade: string
  group: string
  gender: Gender
  managerId: string | null
  defaultSlot: string
}

const FEMALE = new Set([
  'em_shelley',
  'em_ayesha',
  'em_sara',
  'em_hina',
  'em_hamda',
  'em_areeba',
  'em_sana',
  'em_mahnoor',
  'em_zainab',
  'em_sadia',
  'em_maryam',
  'em_nida',
  'em_fatima',
  'em_rabia',
  'em_laiba',
])
const INACTIVE = new Set(['em_talha', 'em_nida'])
const NIGHT_SHIFT = new Set(['em_usman', 'em_imran', 'em_huzaifa'])
/** People who report to Shelley Kannes (the "Subordinates" tab). */
const REPORTS_TO_SHELLEY = new Set([
  'em_kaleem',
  'em_sadia',
  'em_laiba',
  'em_ayesha',
  'em_hina',
  'em_omer',
])

const GROUP_BY_DEPARTMENT: Record<string, string> = {
  Physiotherapy: 'Clinical',
  Surgery: 'Clinical',
  Software: 'Engineering',
  'Mobile App': 'Engineering',
  'Human Resource Management': 'Corporate',
  Finance: 'Corporate',
  Operations: 'Corporate',
  Sales: 'Commercial',
  Marketing: 'Commercial',
}

const TYPES: EmploymentType[] = [
  'permanent',
  'permanent',
  'permanent',
  'probation',
  'contract',
  'permanent',
  'intern',
]

export const PROFILES: Record<string, SchedulingProfile> = Object.fromEntries(
  DIRECTORY.map((employee, index): [string, SchedulingProfile] => [
    employee.id,
    {
      code: `Id-${String(index + 1).padStart(3, '0')}`,
      status: INACTIVE.has(employee.id) ? 'inactive' : 'active',
      employmentType: TYPES[index % TYPES.length] ?? 'permanent',
      grade: `G${(index % 5) + 1}`,
      group: GROUP_BY_DEPARTMENT[employee.department] ?? 'Corporate',
      gender: FEMALE.has(employee.id) ? 'female' : 'male',
      managerId: REPORTS_TO_SHELLEY.has(employee.id) ? CURRENT_EMPLOYEE_ID : null,
      defaultSlot: NIGHT_SHIFT.has(employee.id) ? 'Night Shift' : 'Day Shift',
    },
  ]),
)

export function profileOf(employee: DirectoryEmployee): SchedulingProfile {
  return (
    PROFILES[employee.id] ?? {
      code: employee.id,
      status: 'active',
      employmentType: 'permanent',
      grade: 'G1',
      group: 'Corporate',
      gender: 'male',
      managerId: null,
      defaultSlot: 'Day Shift',
    }
  )
}

export function seedGeoFences(): GeoFence[] {
  const created = new Date(Date.now() - 40 * 86_400_000).toISOString()
  const circle = (
    id: string,
    name: string,
    latitude: number,
    longitude: number,
    radiusMeters: number,
  ) => ({
    id,
    name,
    shape: { type: 'circle' as const, latitude, longitude, radiusMeters },
    createdAt: created,
  })
  return [
    circle('gf_001', 'Islamabad Blue Area (GF-001)', 33.7104, 73.0567, 300),
    circle('gf_002', 'Karachi Showroom Clifton (GF-002)', 24.8138, 67.0299, 200),
    circle('gf_004', 'Rawalpindi Saddar (GF-004)', 33.5973, 73.0479, 250),
    {
      id: 'gf_006',
      name: 'Dubai Business Bay (GF-006)',
      shape: {
        type: 'polygon',
        points: [
          { latitude: 25.1872, longitude: 55.2624 },
          { latitude: 25.1895, longitude: 55.2689 },
          { latitude: 25.1851, longitude: 55.2712 },
          { latitude: 25.1829, longitude: 55.2648 },
        ],
      },
      createdAt: created,
    },
    {
      id: 'gf_003',
      name: 'Head Office Gulberg (GF-003)',
      shape: { type: 'circle', latitude: 31.5136, longitude: 74.3434, radiusMeters: 250 },
      createdAt: created,
    },
    {
      id: 'gf_005',
      name: 'Johar Town Campus (GF-005)',
      shape: {
        type: 'polygon',
        points: [
          { latitude: 31.4712, longitude: 74.2702 },
          { latitude: 31.4721, longitude: 74.2761 },
          { latitude: 31.4679, longitude: 74.2772 },
          { latitude: 31.4668, longitude: 74.2716 },
        ],
      },
      createdAt: created,
    },
  ]
}

/** Slot rules for a roster group's ordinary shifts. */
export function slotFor(
  group: Pick<RosterGroup, 'title' | 'days'>,
  overnight = false,
): TimeSlotRules {
  return {
    name: group.title,
    isOvernight: overnight,
    reverseDecision: false,
    mode: 'fixed',
    workableMinutes: null,
    totalMinutes: null,
    shortOvertime: false,
    fullOvertime: false,
    overtimeMinutes: null,
  }
}

/** Which roster each person works in the sample data. */
function rosterOf(employeeId: string): string {
  if (['em_usman', 'em_imran'].includes(employeeId)) return 'rg_swing'
  if (['em_fatima', 'em_rabia'].includes(employeeId)) return 'rg_part'
  if (['em_asad', 'em_kashif'].includes(employeeId)) return 'rg_flexible'
  if (
    [
      'em_hamda',
      'em_huzaifa',
      'em_kamal',
      'em_saad',
      'em_haroon',
      'em_rehan',
      'em_kaleem',
      'em_jack',
      'em_areeba',
      'em_faisal',
      'em_sana',
      'em_mahnoor',
      'em_bilal',
      'em_zainab',
      'em_hamza',
      'em_ayesha',
      'em_hina',
      'em_omer',
      'em_sadia',
      'em_daniyal',
      'em_maryam',
    ].includes(employeeId)
  ) {
    return 'rg_hybrid'
  }
  return 'rg_morning'
}

const ROSTER_DAY_INDEX = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 } as const

/** Last month, this month and next month around today, so the board is never empty. */
export function seedRange(): { from: string; to: string } {
  const today = new Date()
  return {
    from: format(startOfMonth(addMonths(today, -1)), 'yyyy-MM-dd'),
    to: format(endOfMonth(addMonths(today, 1)), 'yyyy-MM-dd'),
  }
}

/** A "Create New Rest Day" batch: the rule and who it gave rest days to. */
export interface RestDayBatchRecord {
  id: string
  startDate: string
  repeat: RepeatRule
  payable: boolean
  employeeIds: string[]
  dates: string[]
  createdAt: string
}

/** Two rest-day batches, so Attendance → Settings → Rest Days has rows. */
export function seedRestDayBatches(): RestDayBatchRecord[] {
  const today = new Date()
  const day = (offset: number) => format(addDays(today, offset), 'yyyy-MM-dd')
  const batch = (
    id: string,
    weekday: RepeatRule['weekdays'][number],
    everyWeeks: number,
    payable: boolean,
    employeeIds: string[],
  ): RestDayBatchRecord => {
    const repeat: RepeatRule = {
      everyWeeks,
      from: day(-21),
      to: day(28),
      weekdays: [weekday],
      step: 1,
    }
    return {
      id,
      startDate: day(-21),
      repeat,
      payable,
      employeeIds,
      dates: repeatDates(repeat),
      createdAt: new Date(Date.now() - 25 * 86_400_000).toISOString(),
    }
  }
  return [
    batch('batch_rd_1', 'wed', 2, false, ['em_laiba', 'em_omar']),
    batch('batch_rd_2', 'fri', 3, true, ['em_hamza']),
  ]
}

export function seedEntries(): ScheduleEntry[] {
  const groups = new Map(seedRosterGroups().map((group) => [group.id, group]))
  const { from, to } = seedRange()
  const days = eachDay(from, to)
  const stamp = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const entries: ScheduleEntry[] = []

  for (const employee of DIRECTORY) {
    if (INACTIVE.has(employee.id)) continue
    const group = groups.get(rosterOf(employee.id))
    if (!group) continue
    const onSite =
      employee.branchId === 'br_lhr_ho'
        ? ['gf_003']
        : employee.branchId === 'br_lhr_jt'
          ? ['gf_005']
          : []

    for (const date of days) {
      const weekday = weekdayOf(date)
      const pattern = group.days[ROSTER_DAY_INDEX[weekday]]
      if (!pattern) continue
      const hybrid = group.id === 'rg_hybrid'
      const workFromHome = hybrid && (weekday === 'mon' || weekday === 'fri')
      const isShift = !pattern.isWeekend && pattern.clockIn !== null && pattern.clockOut !== null
      entries.push({
        id: `se_${employee.id}_${date}`,
        employeeId: employee.id,
        date,
        kind: isShift ? 'shift' : 'rest',
        rosterGroupId: group.id,
        clockIn: isShift ? pattern.clockIn : null,
        clockOut: isShift ? pattern.clockOut : null,
        workFromHome: isShift && workFromHome,
        geoFenceIds: isShift && !workFromHome ? onSite : [],
        breaks:
          isShift && group.id === 'rg_morning'
            ? [
                {
                  type: 'lunch',
                  startDate: date,
                  endDate: date,
                  startTime: '13:00',
                  endTime: '14:00',
                  description: 'Lunch',
                  inclusive: false,
                },
              ]
            : [],
        slot: slotFor(group, isShift && (pattern.clockOut ?? '') < (pattern.clockIn ?? '')),
        restDayPayable: false,
        batchId: 'batch_seed',
        createdAt: stamp,
        updatedAt: stamp,
      })
    }
  }
  // The seeded rest-day batches replace those days' shifts.
  for (const batch of seedRestDayBatches()) {
    for (const employeeId of batch.employeeIds) {
      for (const date of batch.dates) {
        const index = entries.findIndex(
          (item) => item.employeeId === employeeId && item.date === date,
        )
        const current = entries[index]
        if (!current) continue
        entries[index] = {
          ...current,
          kind: 'rest',
          clockIn: null,
          clockOut: null,
          workFromHome: false,
          geoFenceIds: [],
          breaks: [],
          restDayPayable: batch.payable,
          batchId: batch.id,
        }
      }
    }
  }
  return entries
}
