import { z } from 'zod'

import { CLOCK_EVENTS, POLICY_NAMES, TIME_SPANS } from '../types/warning-policy.types'
import { checkPeriodRange, checkTimeOrder, timeField, titleField, weekdaySchema } from './shared'

const MINUTES_PATTERN = /^\d{1,4}$/

/** Whole minutes typed into a text box (kept as a string while editing). */
const minutesField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .regex(MINUTES_PATTERN, `${label} must be a whole number`)

/**
 * One period block. Text inputs stay strings in the form (so an empty box is
 * representable); `toPolicyInput` converts them to numbers for the API.
 */
export const policyPeriodSchema = z
  .object({
    startDay: z.string(),
    endDay: z.string(),
    month: z.number().int().min(0).max(11),
    day: z.number().int().min(1).max(31),
    weekdays: z.array(weekdaySchema),
    totalGraceMinutes: minutesField('Total grace minutes'),
    clockIn: timeField('Clock in'),
    clockOut: timeField('Clock out'),
    minutes: minutesField('Minutes'),
  })
  .superRefine((period, ctx) => {
    checkTimeOrder(
      ctx,
      period.clockIn,
      period.clockOut,
      ['clockOut'],
      'Must be later than clock in',
    )
    if (
      MINUTES_PATTERN.test(period.minutes) &&
      MINUTES_PATTERN.test(period.totalGraceMinutes) &&
      Number(period.minutes) > Number(period.totalGraceMinutes)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['minutes'],
        message: 'Cannot be more than the total grace minutes',
      })
    }
  })

/**
 * Policy form. Fields that depend on the time span (dates vs. weekdays) are
 * checked in `superRefine`, so one flat shape serves all three sub-forms.
 */
export const policyFormSchema = z
  .object({
    policyName: z.enum(POLICY_NAMES, { error: 'Select a policy' }),
    title: titleField,
    timeSpan: z.enum(TIME_SPANS, { error: 'Select a time span' }),
    clockEvent: z.enum(CLOCK_EVENTS, { error: 'Select a clock event' }),
    periods: z.array(policyPeriodSchema).min(1, 'Add at least one period').max(12),
  })
  .superRefine((values, ctx) => {
    values.periods.forEach((period, index) => {
      checkPeriodRange(ctx, values.timeSpan, period, ['periods', index])
    })
  })

export type PolicyFormValues = z.infer<typeof policyFormSchema>
export type PolicyFormPeriod = PolicyFormValues['periods'][number]
