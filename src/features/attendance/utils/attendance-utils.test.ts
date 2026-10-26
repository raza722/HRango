import { describe, expect, it } from 'vitest'

import { fromWire, normalizeDay, toWire, utcStamp } from '../api/attendance.api'
import { dayEditSchema, type DayEditValues, toDayEditInput } from '../schemas/time-sheet.schema'
import type { TimeSheetDay } from '../types/attendance.types'
import {
  formatClockTime,
  formatDuration,
  formatExpected,
  formatSheetDate,
  minutesBetween,
} from './local-time'
import { parseLogsCsv } from './logs-csv'
import { rowActions } from './row-actions'

/** A day as the API sends it (after the api layer trimmed the seconds). */
const DAY: TimeSheetDay = {
  id: '6',
  employeeId: '15',
  employeeCode: 'TE-LHR-0007',
  employeeName: 'RQ Staff',
  departmentName: 'RQ Requests Dept',
  workDate: '2024-08-01',
  scheduleId: '158',
  timeSlotId: '1',
  timeSlotName: 'Morning Work',
  expectedIn: '2024-08-01T10:00',
  expectedOut: '2024-08-01T17:00',
  expectedMinutes: 420,
  firstIn: '2024-08-01T10:25',
  lastOut: null,
  workedMinutes: null,
  breakMinutes: 0,
  shiftWorkedMinutes: null,
  lateMinutes: 25,
  earlyLeftMinutes: 0,
  overtimeBeforeMinutes: 0,
  overtimeAfterMinutes: 0,
  approvedOvertimeMinutes: 0,
  graceConsumedMinutes: 0,
  dayStatus: 'present',
  markedStatus: null,
  leaveRequestId: null,
  isManuallyUpdated: false,
  isFrozen: false,
  comments: null,
  processedAt: '2024-08-02T00:10:00',
  flags: ['late', 'missing_punch'],
  warningCount: 0,
  penaltyType: null,
  penaltyPercentage: null,
  clockInStatus: 'late',
  clockOutStatus: 'missing',
  rowVersion: '0000000000002c39',
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
  comments: '',
}

const messages = (values: DayEditValues) => {
  const result = dayEditSchema.safeParse(values)
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('time sheet formatting', () => {
  it('prints dates, times and durations as the time sheet does', () => {
    expect(formatSheetDate('2024-08-01')).toBe('01-Aug-2024')
    expect(formatExpected('10:00')).toBe('Expected 10 AM')
    expect(formatExpected('2024-08-01T09:30')).toBe('Expected 9:30 AM')
    expect(formatClockTime('2024-08-05T10:07')).toBe('10:07 AM')
    expect(formatDuration(0)).toBe('0m')
    expect(formatDuration(65)).toBe('1h 05m')
    expect(formatDuration(120)).toBe('2h')
    expect(minutesBetween('2024-08-05T22:00', '2024-08-06T06:30')).toBe(510)
  })
})

describe('the wire', () => {
  it('trims local date-times to minutes and adds the seconds back', () => {
    expect(fromWire('2026-10-20T09:05:00')).toBe('2026-10-20T09:05')
    expect(fromWire(null)).toBeNull()
    expect(toWire('2026-10-20T09:05')).toBe('2026-10-20T09:05:00')
    expect(toWire(null)).toBeNull()
  })

  it('reads record stamps as UTC and decimals as numbers', () => {
    expect(utcStamp('2026-10-26T05:43:49')).toBe('2026-10-26T05:43:49Z')
    expect(utcStamp('2026-10-26T05:43:49Z')).toBe('2026-10-26T05:43:49Z')
    const day = normalizeDay({
      ...DAY,
      expectedIn: '2024-08-01T10:00:00',
      penaltyPercentage: '50.00' as unknown as number,
    })
    expect(day.expectedIn).toBe('2024-08-01T10:00')
    expect(day.penaltyPercentage).toBe(50)
  })
})

describe('row actions', () => {
  it('offers only View on My, and Edit beside View on Subordinates and All', () => {
    expect(rowActions(DAY, 'my', '2024-08-22')).toEqual(['view'])
    expect(rowActions(DAY, 'all', '2024-08-22')).toEqual(['edit', 'view'])
    expect(rowActions(DAY, 'subordinates', '2024-08-22')).toEqual(['edit', 'view'])
    expect(rowActions(DAY, 'all', '2024-08-22', false)).toEqual(['view'])
    expect(rowActions({ ...DAY, isFrozen: true }, 'all', '2024-08-22')).toEqual(['view'])
    expect(rowActions({ ...DAY, dayStatus: 'weekend' }, 'all', '2024-08-22')).toEqual(['view'])
    expect(rowActions(DAY, 'all', '2024-07-31')).toEqual(['view'])
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

  it('keeps breaks inside the worked hours; the break type is optional', () => {
    const row = {
      type: '3',
      outDate: '2024-08-01',
      outTime: '13:00',
      inDate: '2024-08-01',
      inTime: '13:30',
    }
    expect(messages({ ...VALUES, breaks: [row] })).toEqual([])
    expect(messages({ ...VALUES, breaks: [{ ...row, type: '' }] })).toEqual([])
    expect(messages({ ...VALUES, breaks: [{ ...row, inTime: '12:00' }] })).toContain(
      'Break in must be after break out',
    )
    expect(messages({ ...VALUES, breaks: [{ ...row, outTime: '08:00' }] })).toContain(
      'Must be after check in',
    )
  })

  it('sends DayEditIn: the mark, no times on an absent day, the expected times and rowVersion', () => {
    expect(toDayEditInput({ ...VALUES, markAbsent: true, markHalfDay: true }, DAY)).toEqual({
      expectedIn: '2024-08-01T10:00',
      expectedOut: '2024-08-01T17:00',
      firstIn: null,
      lastOut: null,
      markedStatus: 'absent',
      comments: null,
      breaks: [],
      rowVersion: '0000000000002c39',
    })
    expect(
      toDayEditInput(
        {
          ...VALUES,
          markShortDay: true,
          comments: ' Gate was down ',
          breaks: [{ type: '', outDate: '2024-08-01', outTime: '13:00', inDate: '', inTime: '' }],
        },
        DAY,
      ),
    ).toMatchObject({
      firstIn: '2024-08-01T10:00',
      lastOut: '2024-08-01T17:00',
      markedStatus: 'short_day',
      comments: 'Gate was down',
      breaks: [{ breakTypeId: null, outAt: '2024-08-01T13:00', inAt: null }],
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
        'Id-006,2026-10-19,13:00,break_out',
        '',
      ].join('\r\n'),
    )
    expect(rows).toEqual([
      { line: 2, employeeCode: 'Id-003', punchedAt: '2026-10-19T09:02', punchType: 'check_in' },
      { line: 6, employeeCode: 'Id-006', punchedAt: '2026-10-19T13:00', punchType: 'break_out' },
    ])
    expect(errors).toEqual([
      'Line 3: the employee code is missing',
      'Line 4: the date must be yyyy-mm-dd',
      'Line 5: the punch type must be check_in, check_out, break_out or break_in',
    ])
    expect(parseLogsCsv('').errors).toEqual(['The file is empty.'])
  })
})
