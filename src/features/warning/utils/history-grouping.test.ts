import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { WarningHistoryEntry } from '../types/warning-history.types'
import { describeHistoryEntry, describeHistoryValue, groupHistoryByDay } from './history-grouping'

/** `performedAt` as the API sends it: UTC without a zone. */
function utc(date: Date): string {
  return date.toISOString().slice(0, 19)
}

function entry(id: string, performedAt: string, extra: Partial<WarningHistoryEntry> = {}) {
  return {
    id,
    performedAt,
    actionName: 'update',
    policyId: '1',
    policyTitle: 'Grace',
    fieldName: 'grace_minutes',
    oldValue: '30',
    newValue: '60',
    performedByUserId: '1',
    performedByName: 'Administrator',
    ...extra,
  } satisfies WarningHistoryEntry
}

describe('groupHistoryByDay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 7, 8, 16, 0)) // Thursday 8 August 2024, as in the design
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reads UTC times, labels today and yesterday and keeps the newest-first order', () => {
    const days = groupHistoryByDay([
      entry('a', utc(new Date(2024, 7, 8, 15, 54))),
      entry('b', utc(new Date(2024, 7, 8, 9, 10))),
      entry('c', utc(new Date(2024, 7, 7, 15, 54))),
      entry('d', utc(new Date(2024, 7, 1, 12, 0))),
    ])

    expect(days.map((day) => day.label)).toEqual([
      'Today - Thursday, August 8, 2024',
      'Yesterday - Wednesday, August 7, 2024',
      'Thursday, August 1, 2024',
    ])
    expect(days[0]!.entries.map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('describes an entry in one line', () => {
    expect(describeHistoryEntry(entry('a', utc(new Date())))).toBe(
      'Policy updated — Grace (Total Grace Minutes)',
    )
    expect(
      describeHistoryEntry(
        entry('b', utc(new Date()), {
          actionName: 'delete',
          policyTitle: null,
          fieldName: 'title',
          oldValue: 'Probation grace',
        }),
      ),
    ).toBe('Policy deleted — Probation grace')
  })

  it('summarises logged values', () => {
    expect(describeHistoryValue('applies_to', 'late_arrival')).toBe('Late Arrival')
    expect(describeHistoryValue('penalties', '[{"id":1},{"id":2}]')).toBe('2 penalties')
    expect(describeHistoryValue('rules', null)).toBe('—')
  })
})
