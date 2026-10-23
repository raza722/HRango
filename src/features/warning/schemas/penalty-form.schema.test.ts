import { describe, expect, it } from 'vitest'

import { createEmptyRule, toPenaltyInput } from '../utils/penalty-mappers'
import { penaltyFormSchema, type PenaltyFormValues } from './penalty-form.schema'

function validPenalty(): PenaltyFormValues {
  return {
    policyName: 'late-arrival',
    title: 'Late arrival penalty',
    scaleType: 'number',
    rules: [{ ...createEmptyRule('weekly'), count: '2', from: '09:00', to: '09:30', points: '5' }],
  }
}

function issuePaths(values: PenaltyFormValues): string[] {
  const result = penaltyFormSchema.safeParse(values)
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
}

describe('penaltyFormSchema', () => {
  it('accepts a complete weekly penalty', () => {
    expect(issuePaths(validPenalty())).toEqual([])
  })

  it('requires To to be later than From', () => {
    const values = validPenalty()
    values.rules[0] = { ...values.rules[0]!, from: '10:00', to: '09:00' }
    expect(issuePaths(values)).toContain('rules.0.to')
  })

  it('caps percentages at 100 but allows bigger point counts', () => {
    const values = validPenalty()
    values.rules[0] = { ...values.rules[0]!, points: '150' }
    expect(issuePaths(values)).toEqual([])
    expect(issuePaths({ ...values, scaleType: 'percentage' })).toContain('rules.0.points')
  })

  it('checks the date range of monthly rules', () => {
    const values = validPenalty()
    values.rules[0] = {
      ...values.rules[0]!,
      timeSpan: 'monthly',
      startDay: '2026-05-10',
      endDay: '2026-05-01',
      weekdays: [],
    }
    expect(issuePaths(values)).toContain('rules.0.endDay')
  })

  it('maps form strings to API numbers and drops weekdays for non-weekly rules', () => {
    const values = validPenalty()
    values.rules.push({ ...createEmptyRule('monthly'), from: '09:00', to: '10:00', points: '3' })
    const [weekly, monthly] = toPenaltyInput(values).rules
    expect(weekly).toMatchObject({
      count: 2,
      points: 5,
      weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    })
    expect(monthly).toMatchObject({ count: 1, points: 3, weekdays: [] })
  })
})
