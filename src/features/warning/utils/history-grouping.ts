import { format, isToday, isValid, isYesterday, parseISO } from 'date-fns'

import type { WarningHistoryEntry } from '../types/warning-history.types'

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

/** Groups log entries (newest first) by calendar day, keeping their order. */
export function groupHistoryByDay(entries: readonly WarningHistoryEntry[]): HistoryDay[] {
  const days = new Map<string, HistoryDay>()
  for (const entry of entries) {
    const date = parseISO(entry.occurredAt)
    if (!isValid(date)) continue
    const key = format(date, 'yyyy-MM-dd')
    const day = days.get(key) ?? { key, label: dayLabel(date), entries: [] }
    day.entries.push(entry)
    days.set(key, day)
  }
  return [...days.values()]
}

const ENTITY_LABELS = { policy: 'Policy', penalty: 'Penalty' } as const
const ACTION_LABELS = { created: 'created', updated: 'updated', deleted: 'deleted' } as const

/** One-line description: "Penalty updated — Late arrival penalty". */
export function describeHistoryEntry(entry: WarningHistoryEntry): string {
  return `${ENTITY_LABELS[entry.entity]} ${ACTION_LABELS[entry.action]} — ${entry.recordTitle}`
}
