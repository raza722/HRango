import { format, isToday, isYesterday } from 'date-fns'

import { POLICY_NAME_LABELS, TIME_SPAN_LABELS } from '../constants'
import type { WarningHistoryEntry } from '../types/warning-history.types'
import { POLICY_NAMES, TIME_SPANS } from '../types/warning-policy.types'
import { parseServerTime } from './server-time'

export interface HistoryDay {
  /** `yyyy-MM-dd`, stable React key. */
  key: string
  /** "Today - Thursday, August 8, 2024", "Yesterday - …" or just the date. */
  label: string
  entries: WarningHistoryEntry[]
}

/** Heading for one day of the log, as drawn in the History dialog. */
export function dayLabel(date: Date): string {
  const long = format(date, 'EEEE, MMMM d, yyyy')
  if (isToday(date)) return `Today - ${long}`
  if (isYesterday(date)) return `Yesterday - ${long}`
  return long
}

/** Groups log entries (newest first) by local calendar day, keeping their order. */
export function groupHistoryByDay(entries: readonly WarningHistoryEntry[]): HistoryDay[] {
  const days = new Map<string, HistoryDay>()
  for (const entry of entries) {
    const date = parseServerTime(entry.performedAt)
    if (!date) continue
    const key = format(date, 'yyyy-MM-dd')
    const day = days.get(key) ?? { key, label: dayLabel(date), entries: [] }
    day.entries.push(entry)
    days.set(key, day)
  }
  return [...days.values()]
}

/** Labels of the audit log's field names (the policy's columns). */
export const HISTORY_FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  applies_to: 'Policy Name',
  period: 'Time Span',
  grace_minutes: 'Total Grace Minutes',
  week_start_day: 'Week Start Day',
  week_end_day: 'Week End Day',
  is_active: 'Active',
  rules: 'Rules',
  penalties: 'Penalties',
}

const ACTION_LABELS: Record<string, string> = {
  create: 'created',
  update: 'updated',
  delete: 'deleted',
}

/** The policy's title as the API joins it, else the logged title. */
export function historyRecordTitle(entry: WarningHistoryEntry): string {
  if (entry.policyTitle) return entry.policyTitle
  if (entry.fieldName === 'title') return entry.oldValue ?? entry.newValue ?? 'Policy'
  return 'Policy'
}

/** One-line description: "Policy updated — Late (Penalties)". */
export function describeHistoryEntry(entry: WarningHistoryEntry): string {
  const action = ACTION_LABELS[entry.actionName ?? ''] ?? entry.actionName ?? 'changed'
  const field =
    entry.actionName === 'update' && entry.fieldName
      ? ` (${HISTORY_FIELD_LABELS[entry.fieldName] ?? entry.fieldName})`
      : ''
  return `Policy ${action} — ${historyRecordTitle(entry)}${field}`
}

function labelOf<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
  value: string,
): string {
  const match = values.find((item) => item === value)
  return match ? labels[match] : value
}

/** A logged value in words (JSON lists of rules or penalties are summarised as a count). */
export function describeHistoryValue(field: string | null, value: string | null): string {
  if (value === null || value === '') return '—'
  if (field === 'applies_to') return labelOf(POLICY_NAMES, POLICY_NAME_LABELS, value)
  if (field === 'period') return labelOf(TIME_SPANS, TIME_SPAN_LABELS, value)
  if (field === 'is_active') return value === 'true' || value === '1' ? 'Yes' : 'No'
  if (field === 'rules' || field === 'penalties') {
    try {
      const parsed: unknown = JSON.parse(value)
      if (Array.isArray(parsed)) {
        const one = field === 'rules' ? 'rule' : 'penalty'
        const many = field === 'rules' ? 'rules' : 'penalties'
        return `${parsed.length} ${parsed.length === 1 ? one : many}`
      }
    } catch {
      return value
    }
  }
  return value
}
