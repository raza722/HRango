import { addDays, format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api-error'
import { allocations, assets } from '@/mocks/assets/db'
import { signIn } from '@/test/test-utils'

import { assetsApi } from './api/assets.api'

async function refusal(call: Promise<unknown>) {
  try {
    await call
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('The call was not refused')
}

describe('Assets mock checks', () => {
  it('refuses an allocation dated in the future', async () => {
    signIn()
    const free = assets
      .all()
      .find(
        (asset) =>
          asset.status === 'active' &&
          !allocations.all().some((row) => row.assetId === asset.id && !row.deallocatedOn),
      )
    if (!free) throw new Error('No free asset')
    const refused = await refusal(
      assetsApi.allocate({
        assetId: free.id,
        employeeId: 'em_kashif',
        allocatedOn: format(addDays(new Date(), 3), 'yyyy-MM-dd'),
        description: null,
        fileId: null,
      }),
    )
    expect(refused.status).toBe(422)
    expect(refused.fieldErrors.allocatedOn).toBe('An allocation cannot start in the future.')
  })

  it('refuses a Current Value it cannot keep exactly', async () => {
    signIn()
    const refused = await refusal(
      assetsApi.createAsset({
        name: 'Server rack',
        assetTypeId: 'at_storage',
        identificationNo: null,
        isTaxable: false,
        assetCondition: 'new',
        manufacturer: null,
        model: null,
        currentValue: 1e20,
        acquiredDate: null,
        description: null,
        fileId: null,
      }),
    )
    expect(refused.status).toBe(422)
    expect(refused.fieldErrors.currentValue).toBe(
      'Current value can be at most 999,999,999,999.99.',
    )
  })
})
