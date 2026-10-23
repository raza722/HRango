import {
  addYears,
  endOfMonth,
  endOfYear,
  getDaysInMonth,
  startOfMonth,
  startOfYear,
  subDays,
} from 'date-fns'

import { parseDateValue, toDateValue } from '@/lib/date'

import type { PenaltyFormRule, PenaltyFormValues } from '../schemas/penalty-form.schema'
import type {
  PenaltyRule,
  WarningPenalty,
  WarningPenaltyInput,
} from '../types/warning-penalty.types'
import type { TimeSpan } from '../types/warning-policy.types'

/** Start/end defaults for a span: Mon–Sun, this month, or this calendar year. */
export function defaultRange(timeSpan: TimeSpan, now: Date = new Date()) {
  if (timeSpan === 'weekly') return { startDay: 'mon', endDay: 'sun' }
  const start = timeSpan === 'monthly' ? startOfMonth(now) : startOfYear(now)
  const end = timeSpan === 'monthly' ? endOfMonth(now) : endOfYear(now)
  return { startDay: toDateValue(start), endDay: toDateValue(end) }
}

/** End of a period that starts on `start`: end of that month, or one year later minus a day. */
export function rangeEndFor(timeSpan: Exclude<TimeSpan, 'weekly'>, start: Date): Date {
  return timeSpan === 'monthly' ? endOfMonth(start) : subDays(addYears(start, 1), 1)
}

/** A fresh "+ Add Penalty" block. */
export function createEmptyRule(timeSpan: TimeSpan = 'weekly'): PenaltyFormRule {
  return {
    count: '1',
    timeSpan,
    ...defaultRange(timeSpan),
    day: 1,
    weekdays: timeSpan === 'weekly' ? ['mon', 'tue', 'wed', 'thu', 'fri'] : [],
    from: '',
    to: '',
    points: '',
    penaltyType: 'half-day',
    deduction: 'payroll',
    badgeColor: 'red',
  }
}

export function createDefaultPenaltyValues(): PenaltyFormValues {
  return {
    policyName: 'grace-minutes',
    title: '',
    scaleType: 'number',
    rules: [createEmptyRule()],
  }
}

/** "Day N" chips: 7 for a week, else the days in the start date's month. */
export function getRuleDayCount(rule: Pick<PenaltyFormRule, 'timeSpan' | 'startDay'>): number {
  if (rule.timeSpan === 'weekly') return 7
  return getDaysInMonth(parseDateValue(rule.startDay) ?? new Date())
}

export function toPenaltyInput(values: PenaltyFormValues): WarningPenaltyInput {
  return {
    policyName: values.policyName,
    title: values.title.trim(),
    scaleType: values.scaleType,
    rules: values.rules.map((rule): PenaltyRule => ({
      count: Number(rule.count),
      timeSpan: rule.timeSpan,
      startDay: rule.startDay,
      endDay: rule.endDay,
      day: rule.day,
      weekdays: rule.timeSpan === 'weekly' ? rule.weekdays : [],
      from: rule.from,
      to: rule.to,
      points: Number(rule.points),
      penaltyType: rule.penaltyType,
      deduction: rule.deduction,
      badgeColor: rule.badgeColor,
    })),
  }
}

export function toPenaltyFormValues(penalty: WarningPenalty): PenaltyFormValues {
  return {
    policyName: penalty.policyName,
    title: penalty.title,
    scaleType: penalty.scaleType,
    rules: penalty.rules.map((rule) => ({
      ...rule,
      count: String(rule.count),
      weekdays: [...rule.weekdays],
      points: String(rule.points),
    })),
  }
}
