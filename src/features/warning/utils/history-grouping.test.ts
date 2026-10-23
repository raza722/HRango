import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { WarningHistoryEntry } from '../types/warning-history.types'
import { describeHistoryEntry, groupHistoryByDay } from './history-grouping'

function entry(id: string, occurredAt: string): WarningHistoryEntry {
  return {
    id,
    occurredAt,
    entity: 'policy',
    action: 'updated',
    recordId: 'wp_1',
    recordTitle: 'Grace',
    actor: 'Shelley Kannes',
  }
}

describe('groupHistoryByDay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 7, 8, 16, 0)) // Thursday 8 August 2024, as in the design
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('labels today and yesterday and keeps the newest-first order', () => {
    const days = groupHistoryByDay([
      entry('a', new Date(2024, 7, 8, 15, 54).toISOString()),
      entry('b', new Date(2024, 7, 8, 9, 10).toISOString()),
      entry('c', new Date(2024, 7, 7, 15, 54).toISOString()),
      entry('d', new Date(2024, 7, 1, 12, 0).toISOString()),
    ])

    expect(days.map((day) => day.label)).toEqual([
      'Today - Thursday, August 8, 2024',
      'Yesterday - Wednesday, August 7, 2024',
      'Thursday, August 1, 2024',
    ])
    expect(days[0]!.entries.map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('describes an entry in one line', () => {
    expect(describeHistoryEntry(entry('a', new Date().toISOString()))).toBe(
      'Policy updated — Grace',
    )
  })
})
