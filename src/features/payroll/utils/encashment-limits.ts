import type { LeaveTypeOption } from '../types/payroll.types'

const days = (count: number) => `${String(count)} ${count === 1 ? 'day' : 'days'}`

/**
 * A leave type's encashment rule in words, under Leave Type on the encashment form. The limits
 * are days per person and year (Leave Settings → Leave Types → Encashment Min / Max Limit); the
 * API works out each person's days from what they have left.
 */
export function encashmentLimitText(type: LeaveTypeOption): string {
  if (!type.allowEncashment) {
    return `Encashment is turned off for ${type.name} (Leave Settings → Leave Types).`
  }
  const { encashmentMin: min, encashmentMax: max } = type
  if (min !== null && max !== null) {
    return `Encashment limit: ${String(min)} to ${days(max)} per person. Anyone with fewer than ${days(min)} left is left out, and anyone with more than ${days(max)} is paid for ${String(max)}.`
  }
  if (max !== null) {
    return `Encashment limit: at most ${days(max)} per person; anyone with more is paid for ${String(max)}.`
  }
  if (min !== null) {
    return `Encashment limit: at least ${days(min)} per person; anyone with fewer left is left out.`
  }
  return `No encashment limit: each person's unused ${type.name} days are paid.`
}

/** Why Save refuses the leave type, or null when it may be encashed. */
export function encashmentRefusal(type: LeaveTypeOption | undefined): string | null {
  if (!type || type.allowEncashment) return null
  return `${type.name} cannot be encashed: turn on Encashment for it in Leave Settings → Leave Types`
}
