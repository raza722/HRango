import { act, renderHook, waitFor } from '@testing-library/react'
import { delay, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { server } from '@/mocks/node'
import { apiPath, errorResponse } from '@/mocks/utils'
import { createQueryWrapper, createTestQueryClient, signIn } from '@/test/test-utils'
import type { Paginated } from '@/types/api'

import { warningPoliciesQueryOptions, warningPolicyKeys } from '../api/warning-policy.queries'
import type { WarningPolicy } from '../types/warning-policy.types'
import { useDeleteWarningPolicy } from './use-warning-policy-mutations'

const params = { page: 1, pageSize: 5 }

async function setup() {
  const queryClient = createTestQueryClient()
  await queryClient.query(warningPoliciesQueryOptions(params))
  const cachedIds = () =>
    queryClient
      .getQueryData<Paginated<WarningPolicy>>(warningPolicyKeys.list(params))
      ?.data.map((policy) => policy.id) ?? []
  const { result } = renderHook(() => useDeleteWarningPolicy(), {
    wrapper: createQueryWrapper(queryClient),
  })
  const target = queryClient.getQueryData<Paginated<WarningPolicy>>(warningPolicyKeys.list(params))!
    .data[0]!
  return { queryClient, result, target, cachedIds }
}

describe('useDeleteWarningPolicy', () => {
  beforeEach(() => {
    signIn()
  })

  it('removes the row at once and keeps it removed when the API agrees', async () => {
    const { result, target, cachedIds } = await setup()

    act(() => {
      result.current.mutate(target)
    })

    // Optimistic: gone before the server has answered.
    await waitFor(() => {
      expect(cachedIds()).not.toContain(target.id)
    })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(cachedIds()).not.toContain(target.id)
  })

  it('puts the row back when the API refuses', async () => {
    server.use(
      http.delete(apiPath('/warning-policies/:id'), async () => {
        // Long enough for waitFor (50 ms polling) to observe the optimistic state.
        await delay(250)
        return errorResponse(500, 'Database unavailable')
      }),
    )
    const { result, target, cachedIds } = await setup()

    act(() => {
      result.current.mutate(target)
    })

    await waitFor(() => {
      expect(cachedIds()).not.toContain(target.id)
    })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error?.message).toBe('Database unavailable')
    expect(cachedIds()).toContain(target.id)
  })
})
