import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { withoutRecord } from '@/lib/paginated-cache'
import type { PageParams, Paginated } from '@/types/api'

import { warningHistoryKeys } from '../api/warning-history.api'
import {
  warningPenaltiesQueryOptions,
  warningPenaltyApi,
  warningPenaltyKeys,
  warningPenaltyQueryOptions,
} from '../api/warning-penalty.api'
import type { WarningPenalty, WarningPenaltyInput } from '../types/warning-penalty.types'

/**
 * One page of penalty configurations; the previous page stays visible while
 * the next one loads.
 */
export function useWarningPenalties(params: PageParams) {
  return useQuery(warningPenaltiesQueryOptions(params))
}

/** A single penalty; pass `undefined` to stay idle (not editing). */
export function useWarningPenalty(id: string | undefined) {
  return useQuery({ ...warningPenaltyQueryOptions(id ?? ''), enabled: id !== undefined })
}

/** Creates a penalty and refreshes the penalty lists and the History log. */
export function useCreateWarningPenalty() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: WarningPenaltyInput) => warningPenaltyApi.create(input),
    meta: { successMessage: 'Penalty saved' },
    onSuccess: async (penalty) => {
      queryClient.setQueryData(warningPenaltyKeys.detail(penalty.id), penalty)
      void queryClient.invalidateQueries({ queryKey: warningHistoryKeys.all })
      await queryClient.invalidateQueries({ queryKey: warningPenaltyKeys.lists() })
    },
  })
}

/** Updates a penalty and refreshes the penalty lists and the History log. */
export function useUpdateWarningPenalty() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: WarningPenaltyInput }) =>
      warningPenaltyApi.update(id, input),
    meta: { successMessage: 'Penalty updated' },
    onSuccess: async (penalty) => {
      queryClient.setQueryData(warningPenaltyKeys.detail(penalty.id), penalty)
      void queryClient.invalidateQueries({ queryKey: warningHistoryKeys.all })
      await queryClient.invalidateQueries({ queryKey: warningPenaltyKeys.lists() })
    },
  })
}

/** Deletes a penalty optimistically (removed at once, restored if the API refuses). */
export function useDeleteWarningPenalty() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (penalty: WarningPenalty) => warningPenaltyApi.remove(penalty.id),
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
    onSuccess: (_data, penalty) => {
      queryClient.removeQueries({ queryKey: warningPenaltyKeys.detail(penalty.id) })
      void queryClient.invalidateQueries({ queryKey: warningHistoryKeys.all })
      toast.success(`“${penalty.title}” deleted`)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: warningPenaltyKeys.lists() }),
  })
}
