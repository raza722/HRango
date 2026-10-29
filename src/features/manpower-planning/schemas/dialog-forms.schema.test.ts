import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api-error'
import { durations } from '@/mocks/manpower-planning/db'
import { signIn } from '@/test/test-utils'

import { manpowerApi } from '../api/manpower.api'
import { formatAmount, formatCount } from '../utils/format'
import { makeDurationFormSchema } from './dialog-forms.schema'

const saved = [
  { id: 'bd_2025', name: '2025', startDate: '2025-01-01', endDate: '2025-12-31' },
  { id: 'bd_2026', name: '2026', startDate: '2026-01-01', endDate: '2026-12-31' },
]

describe('Budget durations', () => {
  it('refuses a duration that overlaps another, naming it', () => {
    const schema = makeDurationFormSchema(saved)
    const result = schema.safeParse({
      name: '2026 H2',
      startDate: '2026-07-01',
      endDate: '2027-06-30',
      isCurrent: false,
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]).toMatchObject({
      path: ['startDate'],
      message: 'These dates overlap the 2026 budget duration (1 Jan 2026 – 31 Dec 2026)',
    })
    expect(
      schema.safeParse({
        name: '2027',
        startDate: '2027-01-01',
        endDate: '2027-12-31',
        isCurrent: false,
      }).success,
    ).toBe(true)
    // Editing a duration does not clash with itself.
    expect(
      makeDurationFormSchema(saved, 'bd_2026').safeParse({
        name: '2026',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        isCurrent: true,
      }).success,
    ).toBe(true)
  })

  it('is refused by the mock as by the form (422 on startDate)', async () => {
    signIn()
    const before = durations.all().length
    let refused: ApiError | undefined
    try {
      await manpowerApi.createDuration({
        name: 'Overlap',
        startDate: '2025-06-01',
        endDate: '2025-09-30',
        isCurrent: false,
      })
    } catch (error) {
      if (error instanceof ApiError) refused = error
    }
    expect(refused?.status).toBe(422)
    expect(refused?.fieldErrors.startDate).toBe('These dates overlap the 2025 budget duration.')
    expect(durations.all()).toHaveLength(before)
  })

  it('stamps a new record with the caller and a UTC time (the mock)', async () => {
    signIn()
    const saved = await manpowerApi.createDuration({
      name: '2030',
      startDate: '2030-01-01',
      endDate: '2030-12-31',
      isCurrent: false,
    })
    expect(saved.createdByName).toBe('Shelley Kannes')
    // With its Z, the page shows it in the viewer's time zone (not UTC as local).
    expect(saved.createdAt).toMatch(/Z$/)
  })

  it('formats amounts with separators and counts without leading zeros', () => {
    expect(formatAmount(305000)).toBe('305,000')
    expect(formatAmount(1234.6)).toBe('1,235')
    expect(formatCount(2)).toBe('2')
  })
})
