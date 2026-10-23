import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  standardApi,
  standardApprovalsQueryOptions,
  standardDetailQueryOptions,
  standardListQueryOptions,
  standardLookupsQueryOptions,
} from './standard.api'
import type {
  StandardApprovalParams,
  StandardDecisionInput,
  StandardKind,
  StandardListParams,
} from './standard.types'

export const useStandardList = <P>(kind: StandardKind, params: StandardListParams) =>
  useQuery(standardListQueryOptions<P>(kind, params))

export const useStandardApprovals = <P>(kind: StandardKind, params: StandardApprovalParams) =>
  useQuery(standardApprovalsQueryOptions<P>(kind, params))

export const useStandardDetail = <P>(kind: StandardKind, id: string) =>
  useQuery(standardDetailQueryOptions<P>(kind, id))

export const useStandardLookups = <X>(kind: StandardKind) =>
  useQuery(standardLookupsQueryOptions<X>(kind))

/**
 * On success everything refetches: an approval can change other modules' data
 * (schedules, attendance, End of Employment, payroll records).
 */
function useStandardMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  message: ((variables: TVariables) => string) | null,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    meta: { suppressErrorToast: true },
    onSuccess: async (_result, variables) => {
      if (message) toast.success(message(variables))
      await queryClient.invalidateQueries()
    },
  })
}

export const useCreateStandard = (kind: StandardKind) =>
  useStandardMutation(
    (input: object) => standardApi.create(kind, input),
    () => 'Request submitted',
  )

export const useUpdateStandard = (kind: StandardKind) =>
  useStandardMutation(
    ({ id, input }: { id: string; input: object }) => standardApi.update(kind, id, input),
    () => 'Request updated',
  )

export const useDeleteStandard = (kind: StandardKind) =>
  useStandardMutation(
    (id: string) => standardApi.remove(kind, id),
    () => 'Request deleted',
  )

export const useDecideStandard = (kind: StandardKind) =>
  useStandardMutation(
    ({ id, input }: { id: string; input: StandardDecisionInput }) =>
      standardApi.decide(kind, id, input),
    ({ input }) => (input.decision === 'approve' ? 'Request approved' : 'Request rejected'),
  )

export const useCancelStandard = (kind: StandardKind) =>
  useStandardMutation(
    ({ id, reason }: { id: string; reason: string }) => standardApi.cancel(kind, id, reason),
    () => 'Cancellation requested',
  )

/**
 * "Approved" / "Unapproved" on the ticked rows: the same decision on each, one
 * after another. Resolves with how many went through.
 */
export function useBulkStandard(kind: StandardKind) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      ids,
      input,
    }: {
      ids: readonly string[]
      input: StandardDecisionInput
    }) => {
      let done = 0
      for (const id of ids) {
        try {
          await standardApi.decide(kind, id, input)
          done += 1
        } catch {
          // Counted as not done; the toast says how many went through.
        }
      }
      if (done === 0) throw new Error('None of the requests could be updated.')
      return { done, failed: ids.length - done }
    },
    meta: { suppressErrorToast: true },
    onSettled: () => queryClient.invalidateQueries(),
  })
}
