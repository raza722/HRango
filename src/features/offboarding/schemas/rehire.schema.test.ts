import { describe, expect, it } from 'vitest'

import { makeRehireSchema } from './rehire.schema'

describe('Rehire', () => {
  it('takes a joining date only after the last working date', () => {
    const schema = makeRehireSchema('2026-09-08')
    const before = schema.safeParse({ joiningDate: '2026-09-01' })
    expect(before.success).toBe(false)
    expect(before.error?.issues[0]?.message).toBe(
      'Choose a date after the last working date (September 8, 2026)',
    )
    expect(schema.safeParse({ joiningDate: '2026-09-08' }).success).toBe(false)
    expect(schema.safeParse({ joiningDate: '2026-09-09' }).success).toBe(true)
    expect(schema.safeParse({ joiningDate: '' }).error?.issues[0]?.message).toBe(
      'Choose the joining date',
    )
  })
})
