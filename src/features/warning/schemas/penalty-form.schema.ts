import { z } from 'zod'

import {
  BADGE_COLORS,
  DEDUCTIONS,
  PENALTY_TYPES,
  SCALE_TYPES,
} from '../types/warning-penalty.types'
import { POLICY_NAMES, TIME_SPANS } from '../types/warning-policy.types'
import { checkPeriodRange, checkTimeOrder, timeField, titleField, weekdaySchema } from './shared'

const POINTS_PATTERN = /^\d{1,3}$/

/** One "+ Add Penalty" block. `count` and `points` stay strings while editing. */
export const penaltyRuleSchema = z
  .object({
    count: z.string().regex(/^(?:[1-9]|10)$/, 'Pick how many warnings trigger it'),
    timeSpan: z.enum(TIME_SPANS, { error: 'Select a time span' }),
    startDay: z.string(),
    endDay: z.string(),
    day: z.number().int().min(1).max(31),
    weekdays: z.array(weekdaySchema),
    from: timeField('From'),
    to: timeField('To'),
    points: z
      .string()
      .trim()
      .min(1, 'Points are required')
      .regex(POINTS_PATTERN, 'Use a whole number'),
    penaltyType: z.enum(PENALTY_TYPES, { error: 'Select a penalty type' }),
    deduction: z.enum(DEDUCTIONS, { error: 'Select a deduction' }),
    badgeColor: z.enum(BADGE_COLORS, { error: 'Select a badge colour' }),
  })
  .superRefine((rule, ctx) => {
    checkTimeOrder(ctx, rule.from, rule.to, ['to'], 'Must be later than From')
    checkPeriodRange(ctx, rule.timeSpan, rule, [])
  })

/** The penalty form: policy details plus one or more penalty rules. */
export const penaltyFormSchema = z
  .object({
    policyName: z.enum(POLICY_NAMES, { error: 'Select a policy' }),
    title: titleField,
    scaleType: z.enum(SCALE_TYPES, { error: 'Select a type of scale' }),
    rules: z.array(penaltyRuleSchema).min(1, 'Add at least one penalty').max(10),
  })
  .superRefine((values, ctx) => {
    if (values.scaleType !== 'percentage') return
    values.rules.forEach((rule, index) => {
      if (POINTS_PATTERN.test(rule.points) && Number(rule.points) > 100) {
        ctx.addIssue({
          code: 'custom',
          path: ['rules', index, 'points'],
          message: 'A percentage cannot be more than 100',
        })
      }
    })
  })

export type PenaltyFormValues = z.infer<typeof penaltyFormSchema>
export type PenaltyFormRule = PenaltyFormValues['rules'][number]
