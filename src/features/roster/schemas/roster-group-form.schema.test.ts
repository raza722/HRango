import { describe, expect, it } from 'vitest'

import type { RosterGroupDetail } from '../types/roster.types'
import {
  createDefaultRosterValues,
  toRosterFormValues,
  toRosterInput,
} from '../utils/roster-mappers'
import { rosterGroupFormSchema, type RosterGroupFormValues } from './roster-group-form.schema'

function issuePaths(values: RosterGroupFormValues): string[] {
  const result = rosterGroupFormSchema.safeParse(values)
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
}

/** Monday–Friday on time slot 1, weekend off. */
function officeHours(): RosterGroupFormValues {
  const values = createDefaultRosterValues(new Date(2026, 10, 2))
  return {
    ...values,
    title: 'Office hours',
    days: values.days.map((day) => (day.isDayOff ? day : { ...day, timeSlotId: '1' })),
  }
}

describe('rosterGroupFormSchema', () => {
  it('accepts a normal week', () => {
    expect(issuePaths(officeHours())).toEqual([])
  })

  it('needs a title, a start date and a time slot on every working day', () => {
    const values = officeHours()
    values.title = '  '
    values.fromDate = ''
    values.days[0] = { ...values.days[0]!, timeSlotId: '' }
    expect(issuePaths(values)).toEqual(['title', 'fromDate', 'days.0.timeSlotId'])
  })

  it('wants at least one working day and an end on or after the start', () => {
    const values = officeHours()
    values.toDate = '2026-11-01'
    values.days = values.days.map((day) => ({ ...day, isDayOff: true, timeSlotId: '' }))
    expect(issuePaths(values)).toEqual(['toDate', 'days'])
  })

  it('checks the default slot when "Apply For All" is on, instead of each day', () => {
    const values = { ...createDefaultRosterValues(), title: 'Shift', applyToAll: true }
    expect(issuePaths(values)).toEqual(['defaultTimeSlotId'])
    expect(issuePaths({ ...values, defaultTimeSlotId: '2' })).toEqual([])
  })
})

describe('toRosterInput', () => {
  it('copies the default slot to working days under "Apply For All" and clears days off', () => {
    const input = toRosterInput(
      {
        ...createDefaultRosterValues(new Date(2026, 10, 2)),
        title: ' Night ',
        applyToAll: true,
        defaultTimeSlotId: '2',
      },
      'AAAA',
    )
    expect(input.title).toBe('Night')
    expect(input.fromDate).toBe('2026-11-02')
    expect(input.toDate).toBeNull()
    expect(input.rowVersion).toBe('AAAA')
    expect(input.days[0]).toEqual({ weekday: 1, isDayOff: false, timeSlotId: '2' })
    expect(input.days[6]).toEqual({ weekday: 7, isDayOff: true, timeSlotId: null })
  })
})

describe('toRosterFormValues', () => {
  it('reads a week on one slot back as "Apply For All"', () => {
    const day = (weekday: number, slot: string | null) => ({
      weekday,
      isDayOff: slot === null,
      timeSlotId: slot,
      timeSlotCode: null,
      timeSlotName: null,
      startTime: null,
      endTime: null,
      isOvernight: null,
      durationMinutes: null,
      workableMinutes: null,
    })
    const group: RosterGroupDetail = {
      id: '1',
      title: 'Office',
      fromDate: '2026-10-01',
      toDate: null,
      description: null,
      isActive: true,
      enrolledCount: 0,
      workingDays: null,
      days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => day(weekday, weekday <= 5 ? '1' : null)),
      createdAt: '2026-10-01T00:00:00',
      updatedAt: null,
      rowVersion: 'AAAA',
    }
    const values = toRosterFormValues(group)
    expect(values.applyToAll).toBe(true)
    expect(values.defaultTimeSlotId).toBe('1')
    expect(values.days[5]).toEqual({ day: 'saturday', isDayOff: true, timeSlotId: '' })
  })
})
