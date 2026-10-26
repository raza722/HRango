import type { PolicyFormRule, PolicyFormValues } from '../schemas/policy-form.schema'
import {
  type AppliesTo,
  CLOCK_EVENTS_FOR,
  type ClockEvent,
  type WarningPolicy,
  type WarningPolicyInput,
} from '../types/warning-policy.types'

/** A fresh rule for the given clock event. */
export function createEmptyRule(clockEvent: ClockEvent = 'clock_in'): PolicyFormRule {
  return { clockEvent, minutes: '0', occurrenceCount: '1' }
}

/** The next rule to add: the first clock event the policy allows that has no rule yet. */
export function createNextRule(
  appliesTo: AppliesTo,
  rules: readonly PolicyFormRule[],
): PolicyFormRule | null {
  const free = CLOCK_EVENTS_FOR[appliesTo].find(
    (event) => !rules.some((rule) => rule.clockEvent === event),
  )
  return free ? createEmptyRule(free) : null
}

export function createDefaultFormValues(): PolicyFormValues {
  return {
    appliesTo: 'late_arrival',
    title: '',
    period: 'month',
    graceMinutes: '',
    weekStartDay: '',
    weekEndDay: '',
    isActive: true,
    rules: [createEmptyRule('clock_in')],
  }
}

/** Form values -> `WarningPolicyIn` (strings to numbers; week days only for weekly policies). */
export function toPolicyInput(values: PolicyFormValues, rowVersion?: string): WarningPolicyInput {
  const weekly = values.period === 'week'
  return {
    title: values.title.trim(),
    appliesTo: values.appliesTo,
    period: values.period,
    graceMinutes: values.graceMinutes === '' ? null : Number(values.graceMinutes),
    weekStartDay: weekly && values.weekStartDay !== '' ? values.weekStartDay : null,
    weekEndDay: weekly && values.weekEndDay !== '' ? values.weekEndDay : null,
    isActive: values.isActive,
    rules: values.rules.map((rule) => ({
      clockEvent: rule.clockEvent,
      minutes: Number(rule.minutes),
      occurrenceCount: Number(rule.occurrenceCount),
    })),
    ...(rowVersion ? { rowVersion } : {}),
  }
}

/** `WarningPolicyOut` -> form values, for editing. */
export function toFormValues(policy: WarningPolicy): PolicyFormValues {
  return {
    appliesTo: policy.appliesTo,
    title: policy.title,
    period: policy.period,
    graceMinutes: policy.graceMinutes === null ? '' : String(policy.graceMinutes),
    weekStartDay: policy.weekStartDay ?? '',
    weekEndDay: policy.weekEndDay ?? '',
    isActive: policy.isActive,
    rules: policy.rules.map((rule) => ({
      clockEvent: rule.clockEvent,
      minutes: String(rule.minutes),
      occurrenceCount: String(rule.occurrenceCount),
    })),
  }
}
