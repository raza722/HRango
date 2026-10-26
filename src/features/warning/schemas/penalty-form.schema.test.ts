import { describe, expect, it } from 'vitest'

import { createEmptyRule, toPenaltyInput } from '../utils/penalty-mappers'
import { penaltyFormSchema, type PenaltyFormValues } from './penalty-form.schema'

function validPenalty(): PenaltyFormValues {
  return { policyId: '1', rules: [createEmptyRule('month', 1)] }
}

function issuePaths(values: PenaltyFormValues): string[] {
  const result = penaltyFormSchema.safeParse(values)
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
}

describe('penaltyFormSchema', () => {
  it('accepts a half-day payroll penalty', () => {
    expect(issuePaths(validPenalty())).toEqual([])
  })

  it('needs a policy', () => {
    expect(issuePaths({ ...validPenalty(), policyId: '' })).toContain('policyId')
  })

  it('needs a percentage between 0 and 100 for percentage penalties', () => {
    const values = validPenalty()
    values.rules[0] = { ...values.rules[0]!, penaltyType: 'percentage', percentage: '150' }
    expect(issuePaths(values)).toContain('rules.0.percentage')
    values.rules[0] = { ...values.rules[0], percentage: '25' }
    expect(issuePaths(values)).toEqual([])
  })

  it('needs a leave type when the deduction touches leave', () => {
    const values = validPenalty()
    values.rules[0] = { ...values.rules[0]!, deduction: 'both' }
    expect(issuePaths(values)).toContain('rules.0.leaveTypeId')
  })

  it('refuses two penalties with the same count and time span', () => {
    const values = validPenalty()
    values.rules.push(createEmptyRule('month', 1))
    expect(issuePaths(values)).toContain('rules.1.afterCount')
  })

  it('maps form strings to the API body', () => {
    const values = validPenalty()
    values.rules.push({
      ...createEmptyRule('year', 2),
      penaltyType: 'percentage',
      percentage: '25',
      deduction: 'leave',
      leaveTypeId: 'lt_casual',
    })
    expect(toPenaltyInput(values, 'rv1')).toEqual({
      rowVersion: 'rv1',
      penalties: [
        {
          afterCount: 1,
          period: 'month',
          penaltyType: 'half_day',
          percentage: null,
          deduction: 'payroll',
          leaveTypeId: null,
        },
        {
          afterCount: 2,
          period: 'year',
          penaltyType: 'percentage',
          percentage: 25,
          deduction: 'leave',
          leaveTypeId: 'lt_casual',
        },
      ],
    })
  })
})
