import { describe, expect, it } from 'vitest'

import type { ScheduleEntry } from '@/features/scheduling'

import { seedRosterGroups } from '../roster/seed'
import { slotFor } from '../scheduling/seed'
import { type DayEdit, dayId } from './db'
import { computeDay, computeRange, type Snapshot } from './engine'

const PERSON = 'em_test'
const morning = seedRosterGroups().find((group) => group.id === 'rg_morning')

function entry(date: string, kind: 'shift' | 'rest' = 'shift'): ScheduleEntry {
  if (!morning) throw new Error('Morning Work roster missing from the seed')
  return {
    id: `se_${date}`,
    employeeId: PERSON,
    date,
    kind,
    rosterGroupId: 'rg_morning',
    clockIn: kind === 'shift' ? '09:00' : null,
    clockOut: kind === 'shift' ? '17:00' : null,
    workFromHome: false,
    geoFenceIds: [],
    breaks: [],
    slot: slotFor(morning),
    restDayPayable: false,
    batchId: 'test',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  }
}

/** A month of Morning Work (Mon–Fri) with HR's edits; "today" is 31 March 2026. */
function snapshot(
  edits: Omit<DayEdit, 'id' | 'employeeId' | 'updatedAt'>[],
  overrides: Partial<Snapshot> = {},
): Snapshot {
  const schedule = new Map<string, ScheduleEntry>()
  for (let day = 1; day <= 31; day += 1) {
    const date = `2026-03-${String(day).padStart(2, '0')}`
    const weekday = new Date(`${date}T00:00`).getDay()
    schedule.set(
      dayId(PERSON, date),
      entry(date, weekday === 0 || weekday === 6 ? 'rest' : 'shift'),
    )
  }
  return {
    today: '2026-03-31',
    now: '2026-03-31T20:00',
    schedule,
    edits: new Map(
      edits.map((edit) => [
        dayId(PERSON, edit.date),
        { ...edit, id: dayId(PERSON, edit.date), employeeId: PERSON, updatedAt: '' },
      ]),
    ),
    punches: new Map(),
    rosters: new Map(seedRosterGroups().map((group) => [group.id, group])),
    branches: new Map(),
    machineSync: new Map(),
    holidays: [
      {
        id: 'hol_test',
        name: 'Pakistan Day',
        holidayType: 'public',
        startDate: '2026-03-23',
        endDate: '2026-03-23',
        description: '',
        attendanceExempt: true,
        dayCount: 1,
        ruleCount: 0,
        rules: [],
        createdAt: '',
        updatedAt: '',
        rowVersion: 'v1',
      },
    ],
    minimumWorkableMinutes: null,
    ignored: new Set(),
    ...overrides,
  }
}

const worked = (date: string, checkIn: string, checkOut: string) => ({
  date,
  checkIn: `${date}T${checkIn}`,
  checkOut: `${date}T${checkOut}`,
  breaks: [],
})

describe('attendance engine', () => {
  it('marks a late arrival, and a relaxed one as Relaxation', () => {
    const late = computeDay(
      snapshot([worked('2026-03-03', '09:20', '17:00')]),
      PERSON,
      '2026-03-03',
    )
    expect(late.day).toMatchObject({
      status: 'late-arrival',
      lateMinutes: 20,
      clockInStatus: 'late-arrival',
      clockOutStatus: 'present',
      durationMinutes: 460,
      workedMinutes: 460,
    })

    const relaxed = computeDay(
      snapshot([{ ...worked('2026-03-03', '09:20', '17:00'), relaxationReason: 'Traffic' }]),
      PERSON,
      '2026-03-03',
    )
    expect(relaxed.day).toMatchObject({ status: 'relaxation', clockInStatus: 'present' })
    expect(relaxed.warningKind).toBeNull()
  })

  it('counts overtime past the clock out and breaks out of worked time', () => {
    const { day } = computeDay(
      snapshot([
        {
          ...worked('2026-03-04', '08:55', '18:30'),
          breaks: [
            {
              type: 'lunch',
              outAt: '2026-03-04T13:00',
              inAt: '2026-03-04T13:45',
              description: '',
            },
          ],
        },
      ]),
      PERSON,
      '2026-03-04',
    )
    expect(day).toMatchObject({
      status: 'present',
      overtimeMinutes: 90,
      breakMinutes: 45,
      workedMinutes: 530,
      shiftWorkedMinutes: 435,
      manuallyUpdated: true,
    })
  })

  it('shows holidays and roster weekends without expected times', () => {
    const snap = snapshot([])
    expect(computeDay(snap, PERSON, '2026-03-23').day).toMatchObject({
      status: 'holiday',
      expectedIn: null,
      expectedMinutes: null,
      clockInStatus: null,
    })
    expect(computeDay(snap, PERSON, '2026-03-07').day.status).toBe('weekend')
  })

  it('turns a weekend between two absences into Sandwich', () => {
    const snap = snapshot([
      { date: '2026-03-06', markAbsent: true },
      { date: '2026-03-09', markAbsent: true },
    ])
    const days = computeRange(snap, PERSON, '2026-03-06', '2026-03-09').map((item) => item.day)
    expect(days.map((day) => day.status)).toEqual(['absent', 'sandwich', 'sandwich', 'absent'])
    expect(days[0]?.clockInStatus).toBe('absent')
  })

  it('fills the warning bar and reaches a penalty at the fifth late arrival', () => {
    const dates = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']
    const snap = snapshot(dates.map((date) => worked(date, '09:30', '17:00')))
    const warnings = computeRange(snap, PERSON, dates[0] ?? '', dates.at(-1) ?? '').map(
      (item) => item.day.warning,
    )
    expect(warnings.map((warning) => warning?.percent)).toEqual([20, 40, 60, 80, 100])
    expect(warnings.at(-1)?.penalty).toBe('Late Penalty')
    expect(warnings[0]?.penalty).toBeNull()
  })

  it('makes a finished day under the minimum workable minutes a Short Day', () => {
    const snap = snapshot(
      [worked('2026-03-03', '09:00', '15:30'), worked('2026-03-04', '09:00', '17:00')],
      { minimumWorkableMinutes: 420 },
    )
    expect(computeDay(snap, PERSON, '2026-03-03').day.status).toBe('short-day')
    expect(computeDay(snap, PERSON, '2026-03-04').day.status).toBe('present')
    expect(
      computeDay(snapshot([worked('2026-03-03', '09:00', '15:30')]), PERSON, '2026-03-03').day
        .status,
    ).toBe('early-left')
  })

  it('shows today’s machine punches only once the machine has been read', () => {
    // No branch: the spare machine MCH-00013 takes this person's punches.
    const read = (date: string, at: string) =>
      computeDay(
        snapshot([], {
          today: date,
          now: `${date}T20:00`,
          machineSync: new Map([['MCH-00013', `${date}T${at}`]]),
        }),
        PERSON,
        date,
      )
    // A day the generator has this person at work (not on leave or absent).
    const date = ['2026-03-31', '2026-03-30', '2026-03-27', '2026-03-26', '2026-03-25'].find(
      (day) => read(day, '19:00').day.checkIn !== null,
    )
    if (!date) throw new Error('No working day generated for the test person')
    expect(read(date, '07:00').day.checkIn).toBeNull()
    expect(read(date, '19:00').logs[0]).toMatchObject({
      machineId: 'MCH-00013',
      description: 'Checking In ...',
    })
  })

  it('leaves future days as Yet to Start', () => {
    const snap = { ...snapshot([]), today: '2026-03-10', now: '2026-03-10T08:00' }
    expect(computeDay(snap, PERSON, '2026-03-12').day).toMatchObject({
      status: 'yet-to-start',
      checkIn: null,
      clockInStatus: null,
    })
  })
})
