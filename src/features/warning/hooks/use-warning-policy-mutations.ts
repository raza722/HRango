import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { withoutRecord } from '@/lib/paginated-cache'
import type { Paginated } from '@/types/api'

import { warningHistoryKeys } from '../api/warning-history.api'
import { warningPolicyApi } from '../api/warning-policy.api'
import { warningPolicyKeys } from '../api/warning-policy.queries'
import type { WarningPolicy, WarningPolicyInput } from '../types/warning-policy.types'

/**
 * Creates a policy, seeds its detail cache and refreshes every policy list
 * (and the History log). Server errors toast globally; `fieldErrors` are left
 * to the form.
 */
export function useCreateWarningPolicy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: WarningPolicyInput) => warningPolicyApi.create(input),
    meta: { successMessage: 'Policy saved' },
    onSuccess: async (policy) => {
      queryClient.setQueryData(warningPolicyKeys.detail(policy.id), policy)
      void queryClient.invalidateQueries({ queryKey: warningHistoryKeys.all })
      await queryClient.invalidateQueries({ queryKey: warningPolicyKeys.lists() })
    },
  })
}

interface UpdateVariables {
  id: string
  input: WarningPolicyInput
}

/** Updates a policy, writes the result to its detail cache and refreshes the lists. */
export function useUpdateWarningPolicy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: UpdateVariables) => warningPolicyApi.update(id, input),
    meta: { successMessage: 'Policy updated' },
    onSuccess: async (policy) => {
      queryClient.setQueryData(warningPolicyKeys.detail(policy.id), policy)
      void queryClient.invalidateQueries({ queryKey: warningHistoryKeys.all })
      await queryClient.invalidateQueries({ queryKey: warningPolicyKeys.lists() })
    },
  })
}

/**
 * Deletes a policy optimistically: the row disappears at once, comes back if
 * the server refuses, and the lists are refetched either way.
 */
export function useDeleteWarningPolicy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (policy: WarningPolicy) => warningPolicyApi.remove(policy.id),
    meta: { errorMessage: 'Could not delete the policy. It has been restored.' },
    onMutate: async (policy) => {
      // Stop in-flight refetches from overwriting the optimistic state.
      await queryClient.cancelQueries({ queryKey: warningPolicyKeys.lists() })
      const snapshot = queryClient.getQueriesData<Paginated<WarningPolicy>>({
        queryKey: warningPolicyKeys.lists(),
      })
      queryClient.setQueriesData<Paginated<WarningPolicy>>(
        { queryKey: warningPolicyKeys.lists() },
        (page) => (page ? withoutRecord(page, policy.id) : page),
      )
      return { snapshot }
    },
    onError: (_error, _policy, onMutateResult) => {
      onMutateResult?.snapshot.forEach(([queryKey, page]) => {
        queryClient.setQueryData(queryKey, page)
      })
    },
    onSuccess: (_data, policy) => {
      queryClient.removeQueries({ queryKey: warningPolicyKeys.detail(policy.id) })
      void queryClient.invalidateQueries({ queryKey: warningHistoryKeys.all })
      toast.success(`“${policy.title}” deleted`)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: warningPolicyKeys.lists() }),
  })
}
