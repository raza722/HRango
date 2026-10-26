import type { WarningPenalty, WarningPolicy } from '@/features/warning'

import { createMockCollection } from '../collection'
import { randomHex } from '../utils'

/**
 * Mock tables of the Warning module, shaped like `att.warning_policy` and `att.penalty_rule`.
 * Penalties are stored apart (as the API lists them) and joined into their policy on read.
 */

/** A policy as stored: the API shape without the joined penalties and the frontend aliases. */
export type PolicyRecord = Omit<WarningPolicy, 'penalties' | 'policyName' | 'timeSpan'>

/** A penalty rule as stored (the list row without the policy's title and kind). */
export type PenaltyRecord = Omit<WarningPenalty, 'policyTitle' | 'appliesTo'>

/** Server time stamps are UTC without a zone, as the API sends them. */
export function serverNow(date: Date = new Date()): string {
  return date.toISOString().slice(0, 19)
}

export const newRowVersion = (): string => randomHex(8)

function daysAgo(days: number, hour = 9): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  date.setUTCHours(hour, 0, 0, 0)
  return serverNow(date)
}

function policy(
  record: Omit<PolicyRecord, 'rowVersion' | 'updatedAt'> & { updatedAt?: string | null },
): PolicyRecord {
  return { updatedAt: null, ...record, rowVersion: newRowVersion() }
}

function seedPolicies(): PolicyRecord[] {
  return [
    policy({
      id: '1',
      title: 'Late',
      appliesTo: 'late_arrival',
      period: 'month',
      graceMinutes: 60,
      weekStartDay: null,
      weekEndDay: null,
      isActive: true,
      rules: [{ clockEvent: 'clock_in', minutes: 10, occurrenceCount: 3 }],
      warningCount: 4,
      createdAt: daysAgo(40),
      updatedAt: daysAgo(1, 10),
    }),
    policy({
      id: '2',
      title: 'Early Departure',
      appliesTo: 'early_departure',
      period: 'week',
      graceMinutes: 30,
      weekStartDay: 'mon',
      weekEndDay: 'fri',
      isActive: true,
      rules: [{ clockEvent: 'clock_out', minutes: 15, occurrenceCount: 2 }],
      warningCount: 0,
      createdAt: daysAgo(30),
    }),
    policy({
      id: '3',
      title: 'Overtime Cap',
      appliesTo: 'overtime',
      period: 'day',
      graceMinutes: null,
      weekStartDay: null,
      weekEndDay: null,
      isActive: true,
      rules: [
        { clockEvent: 'clock_in', minutes: 30, occurrenceCount: 1 },
        { clockEvent: 'clock_out', minutes: 120, occurrenceCount: 1 },
      ],
      warningCount: 0,
      createdAt: daysAgo(20),
    }),
    policy({
      id: '4',
      title: 'Half Day Leave',
      appliesTo: 'half_day_leave',
      period: 'year',
      graceMinutes: null,
      weekStartDay: null,
      weekEndDay: null,
      isActive: false,
      rules: [{ clockEvent: 'clock_in', minutes: 0, occurrenceCount: 5 }],
      warningCount: 0,
      createdAt: daysAgo(10),
    }),
    policy({
      id: '5',
      title: 'Grace',
      appliesTo: 'late_arrival',
      period: 'year',
      graceMinutes: 600,
      weekStartDay: null,
      weekEndDay: null,
      isActive: true,
      rules: [{ clockEvent: 'clock_in', minutes: 5, occurrenceCount: 1 }],
      warningCount: 0,
      createdAt: daysAgo(2),
    }),
    policy({
      id: '6',
      title: 'Late Night Shift',
      appliesTo: 'late_arrival',
      period: 'week',
      graceMinutes: 20,
      weekStartDay: 'sat',
      weekEndDay: 'thu',
      isActive: true,
      rules: [{ clockEvent: 'clock_in', minutes: 10, occurrenceCount: 2 }],
      warningCount: 0,
      createdAt: daysAgo(1),
    }),
  ]
}

function seedPenalties(): PenaltyRecord[] {
  const rule = (
    id: string,
    warningPolicyId: string,
    afterCount: number,
    period: PenaltyRecord['period'],
    penaltyType: PenaltyRecord['penaltyType'],
    percentage: number,
    deduction: PenaltyRecord['deduction'],
    leave: { id: string; title: string } | null = null,
  ): PenaltyRecord => ({
    id,
    warningPolicyId,
    afterCount,
    period,
    penaltyType,
    percentage,
    deduction,
    leaveTypeId: leave?.id ?? null,
    leaveTypeTitle: leave?.title ?? null,
    createdAt: daysAgo(5),
  })
  const casual = { id: 'lt_casual', title: 'Casual Leaves' }
  return [
    rule('1', '1', 1, 'month', 'half_day', 50, 'payroll'),
    rule('2', '1', 2, 'month', 'full_day', 100, 'both', casual),
    rule('3', '2', 1, 'month', 'percentage', 25, 'payroll'),
    rule('4', '3', 3, 'month', 'half_day', 50, 'leave', casual),
    rule('5', '5', 1, 'year', 'percentage', 10, 'payroll'),
    rule('6', '6', 2, 'week', 'full_day', 100, 'payroll'),
  ]
}

export const warningPolicies = createMockCollection<PolicyRecord>({
  storageKey: 'hrms-mock-warning-policies-v2',
  seed: seedPolicies,
})

export const warningPenalties = createMockCollection<PenaltyRecord>({
  storageKey: 'hrms-mock-warning-penalties-v2',
  seed: seedPenalties,
})

/** Next numeric id of a collection (the API's ids are BIGINT strings). */
export function nextId(items: readonly { id: string }[]): string {
  return String(items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1)
}

/** The policy as the API returns it: its penalty rules (in count order) joined in. */
export function presentPolicy(
  record: PolicyRecord,
): Omit<WarningPolicy, 'policyName' | 'timeSpan'> {
  const penalties = warningPenalties
    .all()
    .filter((penalty) => penalty.warningPolicyId === record.id)
    .sort((a, b) => a.period.localeCompare(b.period) || a.afterCount - b.afterCount)
    .map(
      ({
        id,
        afterCount,
        period,
        penaltyType,
        percentage,
        deduction,
        leaveTypeId,
        leaveTypeTitle,
      }) => ({
        id,
        afterCount,
        period,
        penaltyType,
        percentage,
        deduction,
        leaveTypeId,
        leaveTypeTitle,
      }),
    )
  return { ...record, penalties }
}
