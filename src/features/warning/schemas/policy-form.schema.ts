import { z } from 'zod'

import {
  CLOCK_EVENTS,
  CLOCK_EVENTS_FOR,
  maxRulesFor,
  POLICY_NAMES,
  TIME_SPANS,
} from '../types/warning-policy.types'
import { optionalWholeNumberField, titleField, weekdaySchema, wholeNumberField } from './shared'

/** One rule: per clock event, the minutes a day may be off and every n-th occurrence that warns. */
export const policyRuleSchema = z.object({
  clockEvent: z.enum(CLOCK_EVENTS, { error: 'Select a clock event' }),
  minutes: wholeNumberField('Minutes', 0, 1440),
  occurrenceCount: wholeNumberField('Occurrences', 1, 100),
})

/**
 * Policy form (`WarningPolicyIn`). Text boxes stay strings while editing; `toPolicyInput`
 * converts them. Clock events must suit what the policy watches, one rule per event.
 */
export const policyFormSchema = z
  .object({
    appliesTo: z.enum(POLICY_NAMES, { error: 'Select a policy' }),
    title: titleField,
    period: z.enum(TIME_SPANS, { error: 'Select a time span' }),
    graceMinutes: optionalWholeNumberField('Total grace minutes', 0, 100000),
    weekStartDay: weekdaySchema.or(z.literal('')),
    weekEndDay: weekdaySchema.or(z.literal('')),
    isActive: z.boolean(),
    rules: z.array(policyRuleSchema).min(1, 'Add at least one rule').max(2),
  })
  .superRefine((values, ctx) => {
    const allowed = CLOCK_EVENTS_FOR[values.appliesTo]
    const seen = new Set<string>()
    values.rules.forEach((rule, index) => {
      if (!allowed.includes(rule.clockEvent)) {
        ctx.addIssue({
          code: 'custom',
          path: ['rules', index, 'clockEvent'],
          message: 'This clock event does not apply to what the policy watches',
        })
      }
      if (seen.has(rule.clockEvent)) {
        ctx.addIssue({
          code: 'custom',
          path: ['rules', index, 'clockEvent'],
          message: 'One rule per clock event',
        })
      }
      seen.add(rule.clockEvent)
    })
    if (values.rules.length > maxRulesFor(values.appliesTo)) {
      ctx.addIssue({
        code: 'custom',
        path: ['rules'],
        message: `This policy takes ${maxRulesFor(values.appliesTo)} rule`,
      })
    }
    if (values.period === 'week' && values.weekStartDay === '') {
      ctx.addIssue({ code: 'custom', path: ['weekStartDay'], message: 'Select a start day' })
    }
  })

export type PolicyFormValues = z.infer<typeof policyFormSchema>
export type PolicyFormRule = PolicyFormValues['rules'][number]
/** Legacy (kept for the barrel): Policies have rules, not period blocks. */
export type PolicyFormPeriod = PolicyFormRule
