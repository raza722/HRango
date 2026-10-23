import {
  addDays,
  addYears,
  endOfMonth,
  endOfYear,
  getDaysInMonth,
  startOfMonth,
  startOfYear,
  subDays,
} from 'date-fns'

import { parseDateValue, toDateValue } from '@/lib/date'

import type { PolicyFormPeriod, PolicyFormValues } from '../schemas/policy-form.schema'
import type {
  PolicyPeriod,
  TimeSpan,
  WarningPolicy,
  WarningPolicyInput,
} from '../types/warning-policy.types'

const EMPTY_RULE = {
  totalGraceMinutes: '',
  clockIn: '',
  clockOut: '',
  minutes: '',
} as const

/** A fresh period block for the given span, pre-filled with sensible dates. */
export function createEmptyPeriod(timeSpan: TimeSpan, now: Date = new Date()): PolicyFormPeriod {
  if (timeSpan === 'weekly') {
    return {
      startDay: 'mon',
      endDay: 'sun',
      month: now.getMonth(),
      day: 1,
      weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      ...EMPTY_RULE,
    }
  }
  const start = timeSpan === 'monthly' ? startOfMonth(now) : startOfYear(now)
  const end = timeSpan === 'monthly' ? endOfMonth(now) : endOfYear(now)
  return {
    startDay: toDateValue(start),
    endDay: toDateValue(end),
    month: now.getMonth(),
    day: 1,
    weekdays: [],
    ...EMPTY_RULE,
  }
}

/** The block that follows `previous` ("Add Year" starts the day after the last year ends). */
export function createNextPeriod(
  timeSpan: TimeSpan,
  previous: PolicyFormPeriod | undefined,
): PolicyFormPeriod {
  const previousEnd = previous ? parseDateValue(previous.endDay) : undefined
  if (timeSpan === 'weekly' || !previousEnd) return createEmptyPeriod(timeSpan)

  const start = addDays(previousEnd, 1)
  const end = timeSpan === 'monthly' ? endOfMonth(start) : subDays(addYears(start, 1), 1)
  return {
    ...createEmptyPeriod(timeSpan, start),
    startDay: toDateValue(start),
    endDay: toDateValue(end),
  }
}

export function createDefaultFormValues(): PolicyFormValues {
  return {
    policyName: 'grace-minutes',
    title: '',
    timeSpan: 'yearly',
    clockEvent: 'clock-in',
    periods: [createEmptyPeriod('yearly')],
  }
}

/** Number of "Day N" chips for a period: 7 for weekly, else the days of the selected month. */
export function getDayCount(
  timeSpan: TimeSpan,
  period: Pick<PolicyFormPeriod, 'startDay' | 'month'>,
): number {
  if (timeSpan === 'weekly') return 7
  const year = (parseDateValue(period.startDay) ?? new Date()).getFullYear()
  return getDaysInMonth(new Date(year, period.month, 1))
}

/** Form values -> API payload (strings to numbers, span-specific fields cleaned). */
export function toPolicyInput(values: PolicyFormValues): WarningPolicyInput {
  const weekly = values.timeSpan === 'weekly'
  return {
    policyName: values.policyName,
    title: values.title.trim(),
    timeSpan: values.timeSpan,
    clockEvent: values.clockEvent,
    periods: values.periods.map((period): PolicyPeriod => ({
      startDay: period.startDay,
      endDay: period.endDay,
      month: weekly ? null : period.month,
      day: period.day,
      weekdays: weekly ? period.weekdays : [],
      totalGraceMinutes: Number(period.totalGraceMinutes),
      clockIn: period.clockIn,
      clockOut: period.clockOut,
      minutes: Number(period.minutes),
    })),
  }
}

/** API record -> form values, for editing. */
export function toFormValues(policy: WarningPolicy): PolicyFormValues {
  return {
    policyName: policy.policyName,
    title: policy.title,
    timeSpan: policy.timeSpan,
    clockEvent: policy.clockEvent,
    periods: policy.periods.map((period) => ({
      startDay: period.startDay,
      endDay: period.endDay,
      month: period.month ?? new Date().getMonth(),
      day: period.day,
      weekdays: [...period.weekdays],
      totalGraceMinutes: String(period.totalGraceMinutes),
      clockIn: period.clockIn,
      clockOut: period.clockOut,
      minutes: String(period.minutes),
    })),
  }
}
