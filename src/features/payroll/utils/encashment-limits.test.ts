import { describe, expect, it } from 'vitest'

import type { LeaveTypeOption } from '../types/payroll.types'
import { encashmentLimitText, encashmentRefusal } from './encashment-limits'

const type = (patch: Partial<LeaveTypeOption>): LeaveTypeOption => ({
  id: 'lt_annual',
  name: 'Annual Leave',
  allowEncashment: true,
  encashmentMin: null,
  encashmentMax: null,
  ...patch,
})

describe('encashment limits', () => {
  it('words the limits in days per person', () => {
    expect(encashmentLimitText(type({ encashmentMin: 1, encashmentMax: 10 }))).toBe(
      'Encashment limit: 1 to 10 days per person. Anyone with fewer than 1 day left is left out, and anyone with more than 10 days is paid for 10.',
    )
    expect(encashmentLimitText(type({ encashmentMax: 1 }))).toBe(
      'Encashment limit: at most 1 day per person; anyone with more is paid for 1.',
    )
    expect(encashmentLimitText(type({ encashmentMin: 3 }))).toBe(
      'Encashment limit: at least 3 days per person; anyone with fewer left is left out.',
    )
    expect(encashmentLimitText(type({}))).toBe(
      "No encashment limit: each person's unused Annual Leave days are paid.",
    )
  })

  it('refuses a type whose Encashment is off, and nothing else', () => {
    const off = type({ name: 'Unpaid Leave', allowEncashment: false })
    expect(encashmentLimitText(off)).toBe(
      'Encashment is turned off for Unpaid Leave (Leave Settings → Leave Types).',
    )
    expect(encashmentRefusal(off)).toBe(
      'Unpaid Leave cannot be encashed: turn on Encashment for it in Leave Settings → Leave Types',
    )
    expect(encashmentRefusal(type({ encashmentMin: 1, encashmentMax: 10 }))).toBeNull()
    // A type the lookup has not read: the API decides.
    expect(encashmentRefusal(undefined)).toBeNull()
  })
})
