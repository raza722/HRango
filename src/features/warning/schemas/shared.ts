import { differenceInCalendarDays } from 'date-fns'
import { z } from 'zod'

import { parseDateValue } from '@/lib/date'

import { type TimeSpan, WEEKDAYS } from '../types/warning-policy.types'

/** 24-hour `HH:mm`. */
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export const weekdaySchema = z.enum(WEEKDAYS)

/** Required `HH:mm` time from a time picker. */
export const timeField = (label: string) =>
  z.string().min(1, `${label} is required`).regex(TIME_PATTERN, 'Use a 24-hour time, e.g. 09:00')

/** "Title of Warning Policy", shared by policies and penalties. */
export const titleField = z
  .string()
  .trim()
  .min(2, 'Enter at least 2 characters')
  .max(60, 'Keep the title under 60 characters')

/** Longest allowed date range per span, in days (inclusive). */
const MAX_RANGE_DAYS: Record<Exclude<TimeSpan, 'weekly'>, number> = {
  monthly: 31,
  yearly: 366,
}

interface PeriodLike {
  startDay: string
  endDay: string
  weekdays: readonly string[]
}

/**
 * Span-dependent checks used by both the policy and the penalty schema:
 * weekly blocks need start/end weekdays and at least one working day;
 * monthly and yearly blocks need a valid date range of at most 31 / 366 days.
 *
 * @param path - Issue path of the block, e.g. `['periods', 0]`.
 */
export function checkPeriodRange(
  ctx: z.RefinementCtx,
  timeSpan: TimeSpan,
  period: PeriodLike,
  path: (string | number)[],
): void {
  const at = (field: string) => [...path, field]

  if (timeSpan === 'weekly') {
    if (!weekdaySchema.safeParse(period.startDay).success) {
      ctx.addIssue({ code: 'custom', path: at('startDay'), message: 'Select a start day' })
    }
    if (!weekdaySchema.safeParse(period.endDay).success) {
      ctx.addIssue({ code: 'custom', path: at('endDay'), message: 'Select an end day' })
    }
    if (period.weekdays.length === 0) {
      ctx.addIssue({ code: 'custom', path: at('weekdays'), message: 'Pick at least one day' })
    }
    return
  }

  const start = parseDateValue(period.startDay)
  const end = parseDateValue(period.endDay)
  if (!start) ctx.addIssue({ code: 'custom', path: at('startDay'), message: 'Pick a start date' })
  if (!end) ctx.addIssue({ code: 'custom', path: at('endDay'), message: 'Pick an end date' })
  if (!start || !end) return

  const days = differenceInCalendarDays(end, start) + 1
  if (days < 1) {
    ctx.addIssue({
      code: 'custom',
      path: at('endDay'),
      message: 'Must be on or after the start date',
    })
  } else if (days > MAX_RANGE_DAYS[timeSpan]) {
    ctx.addIssue({
      code: 'custom',
      path: at('endDay'),
      message: `A ${timeSpan === 'monthly' ? 'month' : 'year'} can span at most ${MAX_RANGE_DAYS[timeSpan]} days`,
    })
  }
}

/** Adds an issue when `later` is not after `earlier` (both `HH:mm`). */
export function checkTimeOrder(
  ctx: z.RefinementCtx,
  earlier: string,
  later: string,
  path: (string | number)[],
  message: string,
): void {
  if (TIME_PATTERN.test(earlier) && TIME_PATTERN.test(later) && later <= earlier) {
    ctx.addIssue({ code: 'custom', path, message })
  }
}
