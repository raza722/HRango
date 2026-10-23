import { describe, expect, it } from 'vitest'

import { createDefaultRosterValues, toRosterInput } from '../utils/roster-mappers'
import { rosterGroupFormSchema, type RosterGroupFormValues } from './roster-group-form.schema'

function issuePaths(values: RosterGroupFormValues): string[] {
  const result = rosterGroupFormSchema.safeParse(values)
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
}

/** Monday–Friday 09:00–17:00, weekend off. */
function officeHours(): RosterGroupFormValues {
  const values = createDefaultRosterValues()
  return {
    ...values,
    title: 'Office hours',
    days: values.days.map((day) =>
      day.isWeekend ? day : { ...day, clockIn: '09:00', clockOut: '17:00' },
    ),
  }
}

describe('rosterGroupFormSchema', () => {
  it('accepts a normal week', () => {
    expect(issuePaths(officeHours())).toEqual([])
  })

  it('needs a title and both times on every working day', () => {
    const values = officeHours()
    values.title = '  '
    values.days[0] = { ...values.days[0]!, clockOut: '' }
    values.days[1] = { ...values.days[1]!, clockOut: '09:00' }
    expect(issuePaths(values)).toEqual(['title', 'days.0.clockOut', 'days.1.clockOut'])
  })

  it('wants at least one working day', () => {
    const values = officeHours()
    values.days = values.days.map((day) => ({ ...day, isWeekend: true, clockIn: '', clockOut: '' }))
    expect(issuePaths(values)).toEqual(['days'])
  })

  it('checks the default pair when "Apply For All" is on, instead of each day', () => {
    const values = { ...createDefaultRosterValues(), title: 'Shift', applyToAll: true }
    expect(issuePaths(values)).toEqual(['clockIn', 'clockOut'])
    expect(issuePaths({ ...values, clockIn: '22:00', clockOut: '06:00' })).toEqual([])
  })
})

describe('toRosterInput', () => {
  it('copies the default times to working days under "Apply For All" and clears weekends', () => {
    const input = toRosterInput({
      ...createDefaultRosterValues(),
      title: ' Night ',
      applyToAll: true,
      clockIn: '22:00',
      clockOut: '06:00',
    })
    expect(input.title).toBe('Night')
    expect(input.days[0]).toEqual({
      day: 'monday',
      isWeekend: false,
      clockIn: '22:00',
      clockOut: '06:00',
    })
    expect(input.days[6]).toEqual({ day: 'sunday', isWeekend: true, clockIn: null, clockOut: null })
  })
})
