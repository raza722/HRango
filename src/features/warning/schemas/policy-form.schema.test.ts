import { describe, expect, it } from 'vitest'

import { createDefaultFormValues, createNextRule, toPolicyInput } from '../utils/policy-mappers'
import { policyFormSchema, type PolicyFormValues } from './policy-form.schema'

function validMonthly(): PolicyFormValues {
  return {
    ...createDefaultFormValues(),
    title: 'Late arrival',
    graceMinutes: '60',
    rules: [{ clockEvent: 'clock_in', minutes: '10', occurrenceCount: '3' }],
  }
}

/** Issue paths as dotted strings, e.g. "rules.0.clockEvent". */
function issuePaths(values: PolicyFormValues): string[] {
  const result = policyFormSchema.safeParse(values)
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
}

describe('policyFormSchema', () => {
  it('accepts a complete monthly policy', () => {
    expect(issuePaths(validMonthly())).toEqual([])
  })

  it('refuses a clock event the policy cannot measure', () => {
    const values = validMonthly()
    values.rules[0] = { ...values.rules[0]!, clockEvent: 'clock_out' }
    expect(issuePaths(values)).toContain('rules.0.clockEvent')
  })

  it('allows one rule per clock event', () => {
    const values: PolicyFormValues = {
      ...validMonthly(),
      appliesTo: 'overtime',
      rules: [
        { clockEvent: 'clock_out', minutes: '30', occurrenceCount: '1' },
        { clockEvent: 'clock_out', minutes: '60', occurrenceCount: '1' },
      ],
    }
    expect(issuePaths(values)).toContain('rules.1.clockEvent')
  })

  it('needs a start day for weekly policies', () => {
    expect(issuePaths({ ...validMonthly(), period: 'week' })).toContain('weekStartDay')
    expect(issuePaths({ ...validMonthly(), period: 'week', weekStartDay: 'mon' })).toEqual([])
  })

  it('checks the ranges of minutes and occurrences', () => {
    const values = validMonthly()
    values.rules[0] = { clockEvent: 'clock_in', minutes: '2000', occurrenceCount: '0' }
    expect(issuePaths(values)).toEqual(
      expect.arrayContaining(['rules.0.minutes', 'rules.0.occurrenceCount']),
    )
  })

  it('maps form strings to the API body and drops week days of other periods', () => {
    const input = toPolicyInput({ ...validMonthly(), weekStartDay: 'mon' }, 'rv1')
    expect(input).toMatchObject({
      appliesTo: 'late_arrival',
      period: 'month',
      graceMinutes: 60,
      weekStartDay: null,
      rules: [{ clockEvent: 'clock_in', minutes: 10, occurrenceCount: 3 }],
      rowVersion: 'rv1',
    })
    expect(toPolicyInput({ ...validMonthly(), graceMinutes: '' }).graceMinutes).toBeNull()
  })

  it('offers the free clock event as the next rule', () => {
    const rules = [{ clockEvent: 'clock_in' as const, minutes: '0', occurrenceCount: '1' }]
    expect(createNextRule('overtime', rules)?.clockEvent).toBe('clock_out')
    expect(createNextRule('late_arrival', rules)).toBeNull()
  })
})
