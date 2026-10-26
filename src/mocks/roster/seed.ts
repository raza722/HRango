import {
  ROSTER_DAYS,
  type RosterDay,
  type RosterDaySchedule,
  type RosterGroup,
} from '@/features/roster'

import { seedTimeSlots } from '../scheduling/time-slots'

const stamp = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()

/**
 * A mock roster day: the time slot it follows (what the API stores) plus the slot's clock
 * times (what the other modules' mocks read).
 */
export interface MockRosterDay extends RosterDaySchedule {
  timeSlotId: string | null
}

/** A mock roster group: the old record the other mocks read, plus the API's fields. */
export interface MockRosterGroup extends RosterGroup {
  fromDate: string
  toDate: string | null
  description: string | null
  days: MockRosterDay[]
}

/** A mock enrolment (`branchId` is kept for the other mocks; the API has none). */
export interface MockEnrollment {
  id: string
  rosterGroupId: string
  employeeId: string
  /** `yyyy-MM-dd`. */
  startDate: string
  endDate: string | null
  branchId: string | null
  status: 'active' | 'discontinued'
  createdAt: string
  updatedAt: string
}

/** The seven days for these slots per weekday; other days are off. */
export function rosterWeek(slotsByDay: Partial<Record<RosterDay, string>>): MockRosterDay[] {
  const slots = new Map(seedTimeSlots().map((slot) => [slot.id, slot]))
  return ROSTER_DAYS.map((day) => {
    const slot = slotsByDay[day] ? slots.get(slotsByDay[day]) : undefined
    return slot
      ? {
          day,
          isWeekend: false,
          clockIn: slot.startTime,
          clockOut: slot.endTime,
          timeSlotId: slot.id,
        }
      : { day, isWeekend: true, clockIn: null, clockOut: null, timeSlotId: null }
  })
}

const on = (slotId: string, days: readonly RosterDay[]) =>
  Object.fromEntries(days.map((day) => [day, slotId])) as Partial<Record<RosterDay, string>>

const WEEKDAYS: readonly RosterDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

export function seedRosterGroups(): MockRosterGroup[] {
  const group = (
    id: string,
    title: string,
    days: MockRosterDay[],
    age: number,
    defaults: { clockIn: string; clockOut: string } | null = null,
  ): MockRosterGroup => ({
    id,
    title,
    isActive: true,
    clockIn: defaults?.clockIn ?? null,
    clockOut: defaults?.clockOut ?? null,
    applyToAll: defaults !== null,
    fromDate: '2026-01-01',
    toDate: null,
    description: null,
    days,
    createdAt: stamp(age),
    updatedAt: stamp(Math.floor(age / 2)),
  })

  return [
    // The "View" design: two shift patterns in one week.
    group(
      'rg_hybrid',
      'Hybrid Work',
      rosterWeek({
        ...on('rg_hybrid', ['monday', 'tuesday', 'wednesday']),
        ...on('ts_hybrid_eve', ['thursday', 'friday', 'saturday', 'sunday']),
      }),
      90,
    ),
    group('rg_morning', 'Morning Work', rosterWeek(on('rg_morning', WEEKDAYS)), 80, {
      clockIn: '09:00',
      clockOut: '17:00',
    }),
    group(
      'rg_flexible',
      'Flexible working',
      rosterWeek({
        ...on('rg_flexible', ['monday', 'tuesday', 'wednesday', 'thursday']),
        friday: 'ts_flexible_short',
      }),
      70,
    ),
    // Ends after midnight: 16:00 → 00:30 is 510 minutes.
    group(
      'rg_swing',
      'Swing Shift Doctors',
      rosterWeek(on('rg_swing', [...WEEKDAYS, 'saturday'])),
      60,
      { clockIn: '16:00', clockOut: '00:30' },
    ),
    group(
      'rg_part',
      'Part Time',
      rosterWeek(on('rg_part', ['monday', 'tuesday', 'wednesday', 'thursday'])),
      50,
      { clockIn: '09:00', clockOut: '13:00' },
    ),
  ]
}

/** The 22 people on "Hybrid Work" in the design, plus two who have left it. */
const HYBRID_ACTIVE = [
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
  'em_usman',
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
]

const BRANCH_OF: Record<string, string> = {
  em_hamda: 'br_lhr_ho',
  em_huzaifa: 'br_lhr_ho',
  em_kamal: 'br_lhr_ho',
  em_saad: 'br_lhr_jt',
  em_haroon: 'br_lhr_jt',
  em_rehan: 'br_lhr_jt',
}

export function seedEnrollments(): MockEnrollment[] {
  const active = HYBRID_ACTIVE.map((employeeId, index): MockEnrollment => ({
    id: `re_${String(index + 1).padStart(3, '0')}`,
    rosterGroupId: 'rg_hybrid',
    employeeId,
    startDate: '2026-08-16',
    endDate: null,
    branchId: BRANCH_OF[employeeId] ?? null,
    status: 'active',
    createdAt: stamp(65 - index),
    updatedAt: stamp(65 - index),
  }))
  const left: MockEnrollment[] = [
    {
      id: 're_101',
      rosterGroupId: 'rg_hybrid',
      employeeId: 'em_talha',
      startDate: '2026-06-01',
      endDate: '2026-09-15',
      branchId: 'br_rwp',
      status: 'discontinued',
      createdAt: stamp(140),
      updatedAt: stamp(35),
    },
    {
      id: 're_102',
      rosterGroupId: 'rg_hybrid',
      employeeId: 'em_nida',
      startDate: '2026-07-01',
      endDate: '2026-10-01',
      branchId: null,
      status: 'discontinued',
      createdAt: stamp(110),
      updatedAt: stamp(19),
    },
  ]
  return [...active, ...left]
}
