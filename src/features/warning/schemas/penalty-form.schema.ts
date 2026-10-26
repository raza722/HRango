import { z } from 'zod'

import { DEDUCTIONS, PENALTY_PERIODS, PENALTY_TYPES } from '../types/warning-penalty.types'
import { wholeNumberField } from './shared'

/** One "+ Add Penalty" block (`PenaltyRuleIn`). Numbers stay strings while editing. */
export const penaltyRuleSchema = z
  .object({
    afterCount: wholeNumberField('Count', 1, 100),
    period: z.enum(PENALTY_PERIODS, { error: 'Select a time span' }),
    penaltyType: z.enum(PENALTY_TYPES, { error: 'Select a penalty type' }),
    percentage: z.string().trim(),
    deduction: z.enum(DEDUCTIONS, { error: 'Select a deduction' }),
    leaveTypeId: z.string(),
  })
  .superRefine((rule, ctx) => {
    if (rule.penaltyType === 'percentage') {
      const value = Number(rule.percentage)
      if (rule.percentage === '' || !Number.isFinite(value) || value <= 0 || value > 100) {
        ctx.addIssue({
          code: 'custom',
          path: ['percentage'],
          message: 'Give a percentage of a day above 0 and up to 100',
        })
      }
    }
    if (rule.deduction !== 'payroll' && rule.leaveTypeId === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['leaveTypeId'],
        message: 'Choose the leave type the deduction is taken from',
      })
    }
  })

/** The penalty form: the policy, then its penalty rules (saved together, replacing the old ones). */
export const penaltyFormSchema = z
  .object({
    policyId: z.string().min(1, 'Select a policy'),
    rules: z.array(penaltyRuleSchema).max(50),
  })
  .superRefine((values, ctx) => {
    const seen = new Set<string>()
    values.rules.forEach((rule, index) => {
      const key = `${rule.period}:${Number(rule.afterCount)}`
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['rules', index, 'afterCount'],
          message: 'Another penalty has the same count and time span',
        })
      }
      seen.add(key)
    })
  })

export type PenaltyFormValues = z.infer<typeof penaltyFormSchema>
export type PenaltyFormRule = PenaltyFormValues['rules'][number]
