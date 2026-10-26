import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { RequestBody } from '../api/backend'
import type { DetailSource } from '../api/engine.api'
import { engineApi } from '../api/engine.api'
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

/** One request; `via: 'approvals'` reads it as an approver (wider than the type's own scope). */
export const useStandardDetail = <P>(kind: StandardKind, id: string, via?: DetailSource) =>
  useQuery(standardDetailQueryOptions<P>(kind, id, via))

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
    (body: RequestBody) => standardApi.create(kind, body),
    () => 'Request submitted',
  )

export const useUpdateStandard = (kind: StandardKind) =>
  useStandardMutation(
    ({ id, body }: { id: string; body: RequestBody }) => standardApi.update(kind, id, body),
    () => 'Request updated',
  )

export const useDeleteStandard = (kind: StandardKind) =>
  useStandardMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string }) =>
      standardApi.remove(kind, id, rowVersion),
    () => 'Request deleted',
  )

export const useDecideStandard = () =>
  useStandardMutation(
    ({ id, input }: { id: string; input: StandardDecisionInput }) => standardApi.decide(id, input),
    ({ input }) => (input.decision === 'approve' ? 'Request approved' : 'Request rejected'),
  )

export const useConsentStandard = () =>
  useStandardMutation(
    ({
      id,
      agree,
      remarks,
      rowVersion,
    }: {
      id: string
      agree: boolean
      remarks: string
      rowVersion: string
    }) => engineApi.consent(id, agree, remarks || null, rowVersion),
    ({ agree }) => (agree ? 'Consent given' : 'Disagreement recorded'),
  )

export const useForwardStandard = () =>
  useStandardMutation(
    ({
      id,
      employeeId,
      remarks,
      rowVersion,
    }: {
      id: string
      employeeId: string
      remarks: string
      rowVersion: string
    }) => engineApi.forward(id, employeeId, remarks || null, rowVersion),
    () => 'Request forwarded',
  )

/** Withdraws a pending request, or asks to cancel an approved one. */
export const useCancelStandard = (kind: StandardKind) =>
  useStandardMutation(
    ({ id, reason, rowVersion }: { id: string; reason: string; rowVersion: string }) =>
      standardApi.cancel(kind, id, reason, rowVersion),
    () => 'Cancellation requested',
  )

/**
 * "Approved" / "Unapproved" on the ticked rows (`/requests/approvals/bulk-*`):
 * each request is decided on its own. Resolves with how many went through.
 */
export function useBulkStandard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      items,
      decision,
      remarks,
    }: {
      items: readonly { id: string; rowVersion: string }[]
      decision: 'approve' | 'reject'
      remarks: string
    }) => {
      const results = await engineApi.bulk(decision, items, remarks || null)
      const done = results.filter((result) => result.ok).length
      if (done === 0) {
        throw new Error(
          results.find((result) => result.message)?.message ??
            'None of the requests could be updated.',
        )
      }
      return { done, failed: items.length - done }
    },
    meta: { suppressErrorToast: true },
    onSettled: () => queryClient.invalidateQueries(),
  })
}
