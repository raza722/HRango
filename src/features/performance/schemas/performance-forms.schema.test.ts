import { describe, expect, it } from 'vitest'

import { formatScore } from '../utils/format'
import {
  cycleWeightTotal,
  finaliseFormSchema,
  goalFormSchema,
  goalToForm,
  kpiFormSchema,
  kpiToForm,
  participantsFormSchema,
} from './performance-forms.schema'

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  (result.error?.issues ?? []).map((issue) => issue.message)

describe('Performance forms', () => {
  it('refuses a negative target on a goal and on a KPI', () => {
    const goal = { ...goalToForm(null, 'em_shelley'), title: 'Hire faster', dueDate: '2026-12-31' }
    expect(messages(goalFormSchema.safeParse({ ...goal, targetValue: '-5' }))).toEqual([
      "The target can't be below 0",
    ])
    expect(goalFormSchema.safeParse({ ...goal, targetValue: '30' }).success).toBe(true)
    const kpi = { ...kpiToForm(null), name: 'Time to hire' }
    expect(messages(kpiFormSchema.safeParse({ ...kpi, targetValue: '-1' }))).toEqual([
      "The target can't be below 0",
    ])
  })

  it('takes a final score with at most two decimals', () => {
    const schema = finaliseFormSchema(1, 5)
    const base = {
      outcome: 'no_change' as const,
      changeType: 'percent' as const,
      changeValue: '',
      effectiveDate: '',
      finalComments: '',
    }
    expect(messages(schema.safeParse({ ...base, finalScore: '4.555' }))).toEqual([
      'Use at most 2 decimal places',
    ])
    expect(schema.safeParse({ ...base, finalScore: '4.55' }).success).toBe(true)
  })

  it('asks for people or a department before adding participants', () => {
    expect(
      messages(participantsFormSchema.safeParse({ employeeIds: [], departmentId: null })),
    ).toEqual(['Choose employees or a department to add'])
    expect(
      participantsFormSchema.safeParse({ employeeIds: [], departmentId: 'dep_hr' }).success,
    ).toBe(true)
  })

  it('adds the cycle’s other goal weights to the one being edited', () => {
    const others = [
      { id: 'g1', weight: 60, status: 'in_progress' as const },
      { id: 'g2', weight: 30, status: 'not_started' as const },
      { id: 'g3', weight: 50, status: 'cancelled' as const },
    ]
    expect(cycleWeightTotal(others, null, '20')).toBe(110)
    // Editing g2 counts its new weight instead of the stored one; cancelled goals do not count.
    expect(cycleWeightTotal(others, 'g2', '40')).toBe(100)
  })

  it('shows every score with two decimals', () => {
    expect(formatScore(3)).toBe('3.00')
    expect(formatScore(4.55)).toBe('4.55')
    expect(formatScore(null)).toBe('—')
  })
})
