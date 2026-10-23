import { describe, expect, it } from 'vitest'

import { dayEditSchema, type DayEditValues, toDayEditInput } from '../schemas/time-sheet.schema'
import type { TimeSheetDay } from '../types/attendance.types'
import {
  formatClockTime,
  formatDuration,
  formatExpected,
  formatSheetDate,
  minutesBetween,
} from './local-time'
import { logsToCsv, parseLogsCsv } from './logs-csv'
import { rowActions } from './row-actions'

const DAY: TimeSheetDay = {
  employeeId: 'em_test',
  date: '2024-08-01',
  slotName: 'Morning Work',
  expectedIn: '10:00',
  expectedOut: '17:00',
  checkIn: '2024-08-01T10:25',
  checkOut: null,
  clockInStatus: 'late-arrival',
  clockOutStatus: 'missing-punch',
  lateMinutes: 25,
  earlyMinutes: 0,
  durationMinutes: null,
  expectedMinutes: 420,
  workedMinutes: null,
  breakMinutes: 0,
  shiftWorkedMinutes: null,
  overtimeMinutes: 0,
  approvedOvertimeMinutes: null,
  warning: null,
  status: 'late-arrival',
  manuallyUpdated: false,
  relaxed: false,
}

const VALUES: DayEditValues = {
  checkInDate: '2024-08-01',
  checkInTime: '10:00',
  checkOutDate: '2024-08-01',
  checkOutTime: '17:00',
  markAbsent: false,
  markHalfDay: false,
  markShortDay: false,
  breaks: [],
}

const messages = (values: DayEditValues) => {
  const result = dayEditSchema.safeParse(values)
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('time sheet formatting', () => {
  it('prints dates, times and durations as the time sheet does', () => {
    expect(formatSheetDate('2024-08-01')).toBe('01-Aug-2024')
    expect(formatExpected('10:00')).toBe('Expected 10 AM')
    expect(formatExpected('09:30')).toBe('Expected 9:30 AM')
    expect(formatClockTime('2024-08-05T10:07')).toBe('10:07 AM')
    expect(formatDuration(0)).toBe('0m')
    expect(formatDuration(65)).toBe('1h 05m')
    expect(formatDuration(120)).toBe('2h')
    expect(minutesBetween('2024-08-05T22:00', '2024-08-06T06:30')).toBe(510)
  })
})

describe('row actions', () => {
  it('offers only View on My, and the fixes a day needs on All', () => {
    expect(rowActions(DAY, 'my', '2024-08-22')).toEqual(['view'])
    expect(rowActions(DAY, 'all', '2024-08-22')).toEqual([
      'edit',
      'missing-punch',
      'relaxation',
      'view',
    ])
    expect(
      rowActions(
        { ...DAY, status: 'absent', clockInStatus: 'absent', clockOutStatus: 'absent' },
        'all',
        '2024-08-22',
      ),
    ).toEqual(['edit', 'view', 'absent'])
    expect(
      rowActions(
        {
          ...DAY,
          status: 'present',
          clockInStatus: 'present',
          clockOutStatus: 'present',
          overtimeMinutes: 90,
        },
        'all',
        '2024-08-22',
      ),
    ).toEqual(['edit', 'view', 'overtime'])
    expect(
      rowActions(
        { ...DAY, status: 'weekend', clockInStatus: null, clockOutStatus: null },
        'all',
        '2024-08-22',
      ),
    ).toEqual(['view'])
  })
})

describe('time sheet edit form', () => {
  it('accepts a normal day and needs check out after check in', () => {
    expect(messages(VALUES)).toEqual([])
    expect(messages({ ...VALUES, checkOutTime: '09:00' })).toContain(
      'Check out must be after check in',
    )
    expect(messages({ ...VALUES, checkInTime: '' })).toContain('Enter the check in time')
  })

  it('keeps breaks inside the worked hours', () => {
    const row = {
      type: 'lunch' as const,
      outDate: '2024-08-01',
      outTime: '13:00',
      inDate: '2024-08-01',
      inTime: '13:30',
      description: '',
    }
    expect(messages({ ...VALUES, breaks: [row] })).toEqual([])
    expect(messages({ ...VALUES, breaks: [{ ...row, inTime: '12:00' }] })).toContain(
      'Break in must be after break out',
    )
    expect(messages({ ...VALUES, breaks: [{ ...row, outTime: '08:00' }] })).toContain(
      'Must be after check in',
    )
    expect(messages({ ...VALUES, breaks: [{ ...row, type: '' }] })).toContain('Choose a break type')
  })

  it('sends an absent day without times or breaks', () => {
    expect(toDayEditInput({ ...VALUES, markAbsent: true, markHalfDay: true })).toEqual({
      checkIn: null,
      checkOut: null,
      markAbsent: true,
      markHalfDay: false,
      markShortDay: false,
      breaks: [],
    })
    expect(toDayEditInput(VALUES)).toMatchObject({
      checkIn: '2024-08-01T10:00',
      checkOut: '2024-08-01T17:00',
    })
  })
})

describe('attendance log files', () => {
  it('reads good lines and explains the bad ones by line number', () => {
    const { rows, errors } = parseLogsCsv(
      [
        'Employee Code,Date,Time,Punch Type',
        'Id-003,2026-10-19,9:02,Check In',
        ',2026-10-19,09:00,check-in',
        'Id-004,19/10/2026,09:00,check-in',
        'Id-005,2026-10-19,17:05,lunch',
        '',
      ].join('\r\n'),
    )
    expect(rows).toEqual([
      { employeeCode: 'Id-003', date: '2026-10-19', time: '09:02', type: 'check-in' },
    ])
    expect(errors).toEqual([
      'Line 3: the employee code is missing',
      'Line 4: the date must be yyyy-mm-dd',
      'Line 5: the punch type must be check-in, check-out, break-out or break-in',
    ])
    expect(parseLogsCsv('').errors).toEqual(['The file is empty.'])
  })

  it('quotes descriptions with commas when downloading', () => {
    const csv = logsToCsv([
      {
        id: 'p1',
        type: 'check-in',
        at: '2026-10-19T09:02',
        source: 'manual',
        description: 'Gate, then lift',
        manuallyUpdated: true,
        machineId: null,
        date: '2026-10-19',
        employee: { id: 'em_omar', name: 'Omar Siddiqui', code: 'Id-003' },
        editable: true,
      },
    ])
    expect(csv.split('\n')[1]).toBe(
      'Omar Siddiqui,Id-003,Check In,2026-10-19 09:02,Manual,,"Gate, then lift"',
    )
  })
})
