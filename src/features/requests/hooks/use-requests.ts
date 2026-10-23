import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { attendanceKeys } from '@/features/attendance'
import { schedulingKeys } from '@/features/scheduling'

import {
  approvalListQueryOptions,
  dayShiftQueryOptions,
  requestDetailQueryOptions,
  requestKeys,
  requestListQueryOptions,
  requestLookupsQueryOptions,
  requestsApi,
  transferApprovalsQueryOptions,
  transferListQueryOptions,
  transferLookupsQueryOptions,
} from '../api/requests.api'
import type {
  ApprovalListParams,
  DecisionInput,
  RequestInputMap,
  RequestKind,
  RequestListParams,
  TransferFilters,
} from '../types/requests.types'

export function useRequestList<K extends RequestKind>(kind: K, params: RequestListParams) {
  return useQuery(requestListQueryOptions(kind, params))
}

export function useApprovalList<K extends RequestKind>(kind: K, params: ApprovalListParams) {
  return useQuery(approvalListQueryOptions(kind, params))
}

export function useRequestDetail<K extends RequestKind>(kind: K, id: string) {
  return useQuery(requestDetailQueryOptions(kind, id))
}

export function useRequestLookups() {
  return useQuery(requestLookupsQueryOptions())
}

/** The person's shift on a date, for the request forms. */
export function useDayShift(employeeId: string | undefined, date: string) {
  return useQuery({ ...dayShiftQueryOptions(employeeId, date), enabled: date !== '' })
}

/**
 * A change to a request: on success the lists and the request refetch, and so
 * do attendance and schedules, which an approval changes.
 */
function useRequestMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  message: (variables: TVariables) => string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    meta: { suppressErrorToast: true },
    onSuccess: async (_result, variables) => {
      toast.success(message(variables))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: requestKeys.all }),
        queryClient.invalidateQueries({ queryKey: attendanceKeys.all }),
        queryClient.invalidateQueries({ queryKey: schedulingKeys.all }),
      ])
    },
  })
}

export const useCreateRequest = <K extends RequestKind>(kind: K) =>
  useRequestMutation(
    (input: RequestInputMap[K]) => requestsApi.create(kind, input),
    () => 'Request submitted',
  )

export const useUpdateRequest = <K extends RequestKind>(kind: K) =>
  useRequestMutation(
    ({ id, input }: { id: string; input: RequestInputMap[K] }) =>
      requestsApi.update(kind, id, input),
    () => 'Request updated',
  )

export const useDeleteRequest = (kind: RequestKind) =>
  useRequestMutation(
    (id: string) => requestsApi.remove(kind, id),
    () => 'Request deleted',
  )

export const useDecideRequest = (kind: RequestKind) =>
  useRequestMutation(
    ({ id, input }: { id: string; input: DecisionInput }) => requestsApi.decide(kind, id, input),
    ({ input }) => (input.decision === 'approve' ? 'Request approved' : 'Request rejected'),
  )

export const useConsentRequest = (kind: RequestKind) =>
  useRequestMutation(
    ({ id, input }: { id: string; input: DecisionInput }) => requestsApi.consent(kind, id, input),
    ({ input }) => (input.decision === 'approve' ? 'Consent given' : 'Consent declined'),
  )

export const useCancelRequest = (kind: RequestKind) =>
  useRequestMutation(
    ({ id, reason }: { id: string; reason: string }) => requestsApi.cancel(kind, id, reason),
    () => 'Cancellation requested',
  )

export function useTransferList(params: RequestListParams & TransferFilters) {
  return useQuery(transferListQueryOptions(params))
}

export function useTransferApprovals(params: ApprovalListParams & TransferFilters) {
  return useQuery(transferApprovalsQueryOptions(params))
}

export function useTransferLookups() {
  return useQuery(transferLookupsQueryOptions())
}

/**
 * The lists' "Approved" / "Unapproved": the same decision on every ticked
 * request, one after another. Resolves with how many went through.
 */
export function useBulkDecide(kind: RequestKind) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ ids, input }: { ids: readonly string[]; input: DecisionInput }) => {
      let done = 0
      for (const id of ids) {
        try {
          await requestsApi.decide(kind, id, input)
          done += 1
        } catch {
          // Counted as not done; the toast says how many went through.
        }
      }
      if (done === 0) throw new Error('None of the requests could be updated.')
      return { done, failed: ids.length - done }
    },
    meta: { suppressErrorToast: true },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: requestKeys.all }),
        queryClient.invalidateQueries({ queryKey: attendanceKeys.all }),
        queryClient.invalidateQueries({ queryKey: schedulingKeys.all }),
      ]),
  })
}
