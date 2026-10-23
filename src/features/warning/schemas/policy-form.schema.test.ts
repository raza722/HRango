import { describe, expect, it } from 'vitest'

import { createEmptyPeriod, toPolicyInput } from '../utils/policy-mappers'
import { policyFormSchema, type PolicyFormValues } from './policy-form.schema'

function validYearly(): PolicyFormValues {
  return {
    policyName: 'grace-minutes',
    title: 'Annual grace',
    timeSpan: 'yearly',
    clockEvent: 'clock-in',
    periods: [
      {
        ...createEmptyPeriod('yearly', new Date(2026, 3, 10)),
        totalGraceMinutes: '600',
        clockIn: '09:00',
        clockOut: '18:00',
        minutes: '15',
      },
    ],
  }
}

/** Issue paths as dotted strings, e.g. "periods.0.clockOut". */
function issuePaths(values: PolicyFormValues): string[] {
  const result = policyFormSchema.safeParse(values)
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
}

describe('policyFormSchema', () => {
  it('accepts a complete yearly policy', () => {
    expect(issuePaths(validYearly())).toEqual([])
  })

  it('requires clock out to be later than clock in', () => {
    const values = validYearly()
    values.periods[0] = { ...values.periods[0]!, clockIn: '18:00', clockOut: '09:00' }
    expect(issuePaths(values)).toContain('periods.0.clockOut')
  })

  it('caps per-occurrence minutes at the total grace minutes', () => {
    const values = validYearly()
    values.periods[0] = { ...values.periods[0]!, totalGraceMinutes: '10', minutes: '30' }
    expect(issuePaths(values)).toContain('periods.0.minutes')
  })

  it('needs at least one weekday for weekly policies', () => {
    const values: PolicyFormValues = {
      ...validYearly(),
      timeSpan: 'weekly',
      periods: [{ ...validYearly().periods[0]!, ...createEmptyPeriod('weekly'), weekdays: [] }],
    }
    expect(issuePaths(values)).toContain('periods.0.weekdays')
  })

  it('limits a monthly period to 31 days', () => {
    const values: PolicyFormValues = {
      ...validYearly(),
      timeSpan: 'monthly',
      periods: [{ ...validYearly().periods[0]!, startDay: '2026-01-01', endDay: '2026-03-01' }],
    }
    expect(issuePaths(values)).toContain('periods.0.endDay')
  })

  it('maps form strings to API numbers', () => {
    const input = toPolicyInput(validYearly())
    expect(input.periods[0]).toMatchObject({ totalGraceMinutes: 600, minutes: 15, weekdays: [] })
  })
})
