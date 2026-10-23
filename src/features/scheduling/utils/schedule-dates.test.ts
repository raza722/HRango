import { describe, expect, it } from 'vitest'

import { parseScheduleCsv } from './schedule-csv'
import {
  eachDay,
  formatRange,
  periodRange,
  repeatDates,
  scheduleDates,
  weekBands,
} from './schedule-dates'
import { formatClock, formatHours, spanMinutes } from './shift-hours'

describe('schedule dates', () => {
  it('builds the board periods: Sunday weeks, months and years', () => {
    expect(periodRange('week', '2024-08-13')).toEqual({ from: '2024-08-11', to: '2024-08-17' })
    expect(periodRange('month', '2024-08-13')).toEqual({ from: '2024-08-01', to: '2024-08-31' })
    expect(periodRange('year', '2024-08-13')).toEqual({ from: '2024-01-01', to: '2024-12-31' })
    expect(formatRange('2024-08-01', '2024-08-31')).toBe('Aug 1,24 - Aug 31,24')
  })

  it('labels week bands as drawn ("Aug- Week 3")', () => {
    expect(weekBands(eachDay('2024-08-10', '2024-08-17'))).toEqual([
      { label: 'Aug- Week 2', span: 1, key: '2024-08-10' },
      { label: 'Aug- Week 3', span: 7, key: '2024-08-11' },
    ])
  })

  it('repeats on the chosen weekdays every N weeks, Step weeks at a time', () => {
    // Every 2 weeks, Wed–Fri, from Mon 19 Aug 2024: weeks of 19 Aug and 2 Sep.
    const dates = repeatDates({
      everyWeeks: 2,
      from: '2024-08-19',
      to: '2024-09-08',
      weekdays: ['wed', 'thu', 'fri'],
      step: 1,
    })
    expect(dates).toEqual([
      '2024-08-21',
      '2024-08-22',
      '2024-08-23',
      '2024-09-04',
      '2024-09-05',
      '2024-09-06',
    ])

    const twoOn = repeatDates({
      everyWeeks: 3,
      from: '2024-08-19',
      to: '2024-09-08',
      weekdays: ['mon'],
      step: 2,
    })
    expect(twoOn).toEqual(['2024-08-19', '2024-08-26'])
  })

  it('keeps repeat dates inside the schedule range', () => {
    const rule = {
      everyWeeks: 1,
      from: '2024-08-01',
      to: '2024-08-31',
      weekdays: ['mon' as const],
      step: 1,
    }
    expect(scheduleDates('2024-08-10', '2024-08-20', rule)).toEqual(['2024-08-12', '2024-08-19'])
    expect(scheduleDates('2024-08-10', '2024-08-12', null)).toEqual([
      '2024-08-10',
      '2024-08-11',
      '2024-08-12',
    ])
  })
})

describe('shift hours', () => {
  it('measures overnight shifts and prints times like the cells', () => {
    expect(spanMinutes('22:00', '06:00')).toBe(480)
    expect(formatHours(0)).toBe('0m')
    expect(formatHours(420)).toBe('7h')
    expect(formatHours(5760)).toBe('96h')
    expect(formatClock('17:00')).toBe('05:00 Pm')
    expect(formatClock('10:00')).toBe('10:00 Am')
  })
})

describe('schedule CSV import', () => {
  it('reads good lines and explains bad ones', () => {
    const { rows, errors } = parseScheduleCsv(
      [
        'Employee Code,Date,Clock In,Clock Out,Rest Day',
        'Id-003,2026-11-02,9:00,17:00,no',
        'Id-003,2026-11-08,,,yes',
        'Id-004,02/11/2026,09:00,17:00,no',
        ',2026-11-02,09:00,17:00,no',
      ].join('\n'),
    )
    expect(rows).toEqual([
      {
        employeeCode: 'Id-003',
        date: '2026-11-02',
        clockIn: '09:00',
        clockOut: '17:00',
        restDay: false,
      },
      { employeeCode: 'Id-003', date: '2026-11-08', clockIn: null, clockOut: null, restDay: true },
    ])
    expect(errors).toHaveLength(2)
  })
})
