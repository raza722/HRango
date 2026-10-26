import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { withoutRecord } from '@/lib/paginated-cache'
import { useCan } from '@/lib/permissions'
import type { Paginated } from '@/types/api'

import { warningHistoryKeys } from '../api/warning-history.api'
import {
  leaveTypeOptionsQueryOptions,
  type PenaltyListParams,
  warningPenaltiesQueryOptions,
  warningPenaltyApi,
  warningPenaltyKeys,
  warningPenaltyQueryOptions,
} from '../api/warning-penalty.api'
import { warningPolicyKeys } from '../api/warning-policy.queries'
import type { WarningPenalty, WarningPenaltyInput } from '../types/warning-penalty.types'
import type { WarningPolicy } from '../types/warning-policy.types'
import { penaltyRuleToInput } from '../utils/penalty-mappers'

/** One page of penalty rules (each with its policy); the previous page stays while the next loads. */
export function useWarningPenalties(params: PenaltyListParams) {
  return useQuery(warningPenaltiesQueryOptions(params))
}

/** The policy whose penalties are edited; pass `undefined` to stay idle. */
export function useWarningPenalty(policyId: string | undefined) {
  return useQuery({
    ...warningPenaltyQueryOptions(policyId ?? ''),
    enabled: policyId !== undefined && policyId !== '',
  })
}

/** Active leave types for "Deduction: Leave / Both" (only fetched with leave-type access). */
export function useLeaveTypeOptions(enabled = true) {
  const allowed = useCan('leaves.settings.types.view')
  return useQuery({ ...leaveTypeOptionsQueryOptions(), enabled: enabled && allowed })
}

/** After a save: the policy's detail, the penalty lists and the History log are stale. */
function useOnPenaltiesSaved() {
  const queryClient = useQueryClient()
  return async (policy: WarningPolicy) => {
    queryClient.setQueryData(warningPolicyKeys.detail(policy.id), policy)
    void queryClient.invalidateQueries({ queryKey: warningHistoryKeys.all })
    void queryClient.invalidateQueries({ queryKey: warningPolicyKeys.lists() })
    await queryClient.invalidateQueries({ queryKey: warningPenaltyKeys.lists() })
  }
}

interface SaveVariables {
  policyId: string
  /** Every penalty rule of the policy, and its rowVersion. */
  input: WarningPenaltyInput
}

/** Saves a policy's penalty rules (replacing the ones it had). */
export function useUpdateWarningPenalty() {
  const onSaved = useOnPenaltiesSaved()
  return useMutation({
    mutationFn: ({ policyId, input }: SaveVariables) => warningPenaltyApi.save(policyId, input),
    meta: { successMessage: 'Penalties saved' },
    onSuccess: onSaved,
  })
}

/** Same as {@link useUpdateWarningPenalty}: penalties are always saved per policy. */
export const useCreateWarningPenalty = useUpdateWarningPenalty

/**
 * Removes one penalty rule from the list: reads its policy (rules and rowVersion) and saves the
 * policy's penalties without it. The row disappears at once and comes back if the API refuses.
 */
export function useDeleteWarningPenalty() {
  const queryClient = useQueryClient()
  const onSaved = useOnPenaltiesSaved()
  return useMutation({
    mutationFn: async (penalty: WarningPenalty) => {
      const policy = await queryClient.query({
        ...warningPenaltyQueryOptions(penalty.warningPolicyId),
        staleTime: 0,
      })
      return warningPenaltyApi.save(policy.id, {
        penalties: policy.penalties
          .filter((rule) => rule.id !== penalty.id)
          .map(penaltyRuleToInput),
        rowVersion: policy.rowVersion,
      })
    },
    meta: { errorMessage: 'Could not delete the penalty. It has been restored.' },
    onMutate: async (penalty) => {
      await queryClient.cancelQueries({ queryKey: warningPenaltyKeys.lists() })
      const snapshot = queryClient.getQueriesData<Paginated<WarningPenalty>>({
        queryKey: warningPenaltyKeys.lists(),
      })
      queryClient.setQueriesData<Paginated<WarningPenalty>>(
        { queryKey: warningPenaltyKeys.lists() },
        (page) => (page ? withoutRecord(page, penalty.id) : page),
      )
      return { snapshot }
    },
    onError: (_error, _penalty, onMutateResult) => {
      onMutateResult?.snapshot.forEach(([queryKey, page]) => {
        queryClient.setQueryData(queryKey, page)
      })
    },
    onSuccess: async (policy) => {
      toast.success(`Penalty removed from “${policy.title}”`)
      await onSaved(policy)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: warningPenaltyKeys.lists() }),
  })
}
