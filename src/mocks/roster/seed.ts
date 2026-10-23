import {
  ROSTER_DAYS,
  type RosterDay,
  type RosterDaySchedule,
  type RosterEnrollment,
  type RosterGroup,
} from '@/features/roster'

const stamp = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()

/** A week where `times` maps working days to [clock in, clock out]; other days are weekend. */
function week(times: Partial<Record<RosterDay, [string, string]>>): RosterDaySchedule[] {
  return ROSTER_DAYS.map((day) => {
    const shift = times[day]
    return shift
      ? { day, isWeekend: false, clockIn: shift[0], clockOut: shift[1] }
      : { day, isWeekend: true, clockIn: null, clockOut: null }
  })
}

const weekdays = (clockIn: string, clockOut: string, days: readonly RosterDay[]) =>
  Object.fromEntries(days.map((day) => [day, [clockIn, clockOut]])) as Partial<
    Record<RosterDay, [string, string]>
  >

export function seedRosterGroups(): RosterGroup[] {
  const group = (
    id: string,
    title: string,
    days: RosterDaySchedule[],
    age: number,
    defaults: { clockIn: string; clockOut: string } | null = null,
  ): RosterGroup => ({
    id,
    title,
    isActive: true,
    clockIn: defaults?.clockIn ?? null,
    clockOut: defaults?.clockOut ?? null,
    applyToAll: defaults !== null,
    days,
    createdAt: stamp(age),
    updatedAt: stamp(Math.floor(age / 2)),
  })

  return [
    // The "View" design: two shift patterns in one week.
    group(
      'rg_hybrid',
      'Hybrid Work',
      week({
        ...weekdays('16:15', '18:15', ['monday', 'tuesday', 'wednesday']),
        ...weekdays('20:10', '21:15', ['thursday', 'friday', 'saturday', 'sunday']),
      }),
      90,
    ),
    group(
      'rg_morning',
      'Morning Work',
      week(weekdays('09:00', '17:00', ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])),
      80,
      { clockIn: '09:00', clockOut: '17:00' },
    ),
    group(
      'rg_flexible',
      'Flexible working',
      week({
        ...weekdays('10:00', '16:00', ['monday', 'tuesday', 'wednesday', 'thursday']),
        friday: ['10:00', '13:00'],
      }),
      70,
    ),
    // Ends after midnight: 16:00 → 00:30 is 510 minutes.
    group(
      'rg_swing',
      'Swing Shift Doctors',
      week(
        weekdays('16:00', '00:30', [
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
        ]),
      ),
      60,
      { clockIn: '16:00', clockOut: '00:30' },
    ),
    group(
      'rg_part',
      'Part Time',
      week(weekdays('09:00', '13:00', ['monday', 'tuesday', 'wednesday', 'thursday'])),
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

export function seedEnrollments(): RosterEnrollment[] {
  const active = HYBRID_ACTIVE.map((employeeId, index): RosterEnrollment => ({
    id: `re_${String(index + 1).padStart(3, '0')}`,
    rosterGroupId: 'rg_hybrid',
    employeeId,
    startDate: '2026-08-16',
    endDate: null,
    // The design leaves Location and Branch empty for most rows.
    branchId: BRANCH_OF[employeeId] ?? null,
    status: 'active',
    createdAt: stamp(65 - index),
    updatedAt: stamp(65 - index),
  }))
  const left: RosterEnrollment[] = [
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
