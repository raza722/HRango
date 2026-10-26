import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useCan } from '@/lib/permissions'

import { type RequestBody, typePermission } from '../api/backend'
import type { DetailSource } from '../api/engine.api'
import { engineApi } from '../api/engine.api'
import { employeeOptionsQuery, orgOptionsQuery } from '../api/lookups.api'
import {
  approvalListQueryOptions,
  dayShiftQueryOptions,
  requestDetailQueryOptions,
  requestKeys,
  requestListQueryOptions,
  requestsApi,
  swapColleaguesQueryOptions,
  timeSlotsQueryOptions,
  toSwapColleague,
  transferLookupsQueryOptions,
} from '../api/requests.api'
import type {
  ApprovalListParams,
  DecisionInput,
  RequestAction,
  RequestKind,
  RequestListParams,
} from '../types/requests.types'

/**
 * The buttons the user's permission codes open (the server checks again). Who
 * may decide a request is set by its flow; these only show the buttons.
 */
export function useRequestPermissions(kind: RequestKind) {
  return {
    create: useCan(typePermission(kind, 'create')),
    cancel: useCan(typePermission(kind, 'cancel')),
    approvals: useCan('requests.approvals.view'),
    approve: useCan('requests.approvals.approve'),
    reject: useCan('requests.approvals.reject'),
  }
}
export type RequestPermissions = ReturnType<typeof useRequestPermissions>

/** Whether the user's permissions allow a row action at all. */
export function permits(action: RequestAction, can: RequestPermissions): boolean {
  if (action === 'edit') return can.create
  if (action === 'delete' || action === 'cancel') return can.cancel
  if (action === 'decide') return can.approve || can.reject
  if (action === 'forward') return can.approve
  return true
}

export function useRequestList<K extends RequestKind>(kind: K, params: RequestListParams) {
  return useQuery(requestListQueryOptions(kind, params))
}

export function useApprovalList<K extends RequestKind>(kind: K, params: ApprovalListParams) {
  return useQuery(approvalListQueryOptions(kind, params))
}

/** One request; `via: 'approvals'` reads it as an approver (wider than the type's own scope). */
export function useRequestDetail<K extends RequestKind>(
  kind: K,
  id: string,
  via?: DetailSource,
  enabled = true,
) {
  return useQuery({ ...requestDetailQueryOptions(kind, id, via), enabled: enabled && id !== '' })
}

/**
 * The first page of people the caller reaches through `permission` (`GET /employees/lookup`).
 * Pickers search the server instead (`RequestEmployeeField`).
 */
export function useEmployeeOptions(permission: string) {
  return useQuery(employeeOptionsQuery(permission))
}

/** The person's shift on a date, for the request forms. */
export function useDayShift(employeeId: string | undefined, date: string) {
  return useQuery({ ...dayShiftQueryOptions(employeeId, date), enabled: date !== '' })
}

/** The first page of colleagues to swap with on `date`, with their shift where known. */
export function useSwapColleagues(employeeId: string | undefined, date: string) {
  return useQuery({ ...swapColleaguesQueryOptions(employeeId, date), enabled: date !== '' })
}

/**
 * "Swap To": colleagues of `employeeId` (default the caller) from
 * `GET /requests/options/colleagues`, searched on the server as `search` changes
 * (debounced) and paged (`loadMore`), with each one's shift on `date` where the board shows it.
 */
export function useSwapColleagueSearch(
  employeeId: string | undefined,
  date: string,
  search: string,
) {
  const q = useDebouncedValue(search.trim(), 300)
  const enabled = date !== ''
  const pages = useInfiniteQuery({
    queryKey: requestKeys.colleagueSearch(employeeId, q),
    queryFn: ({ pageParam, signal }) =>
      requestsApi.colleagues({ employeeId, q: q || undefined, page: pageParam }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    enabled,
    placeholderData: keepPreviousData,
  })
  const shifts = useQuery({
    queryKey: requestKeys.dayShifts(date),
    queryFn: ({ signal }) => requestsApi.dayShifts(date, signal),
    enabled,
  })
  const rows = (pages.data?.pages ?? []).flatMap((page) =>
    page.data.map((colleague) => toSwapColleague(colleague, shifts.data ?? {})),
  )
  return {
    rows,
    hasMore: pages.hasNextPage,
    loadMore: () => {
      void pages.fetchNextPage()
    },
    isFetching: pages.isFetching,
  }
}

export function useTimeSlots() {
  return useQuery(timeSlotsQueryOptions())
}

/** The branches of a location (`GET /organisation/lookups/branches?parentId=`). */
export function useLocationBranches(locationId: string | null) {
  return useQuery({
    ...orgOptionsQuery('branches', locationId ?? ''),
    enabled: Boolean(locationId),
  })
}

export function useTransferLookups() {
  return useQuery(transferLookupsQueryOptions())
}

/**
 * A change to a request: on success everything refetches (an approval changes
 * attendance, schedules and employee records).
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
      await queryClient.invalidateQueries()
    },
  })
}

export const useCreateRequest = (kind: RequestKind) =>
  useRequestMutation(
    (body: RequestBody) => requestsApi.create(kind, body),
    () => 'Request submitted',
  )

export const useUpdateRequest = (kind: RequestKind) =>
  useRequestMutation(
    ({ id, body }: { id: string; body: RequestBody }) => requestsApi.update(kind, id, body),
    () => 'Request updated',
  )

export const useDeleteRequest = (kind: RequestKind) =>
  useRequestMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string }) =>
      requestsApi.remove(kind, id, rowVersion),
    () => 'Request deleted',
  )

export const useDecideRequest = () =>
  useRequestMutation(
    ({ id, input }: { id: string; input: DecisionInput }) => requestsApi.decide(id, input),
    ({ input }) => (input.decision === 'approve' ? 'Request approved' : 'Request rejected'),
  )

export const useConsentRequest = () =>
  useRequestMutation(
    ({ id, input }: { id: string; input: DecisionInput }) => requestsApi.consent(id, input),
    ({ input }) => (input.decision === 'approve' ? 'Consent given' : 'Disagreement recorded'),
  )

export const useForwardRequest = () =>
  useRequestMutation(
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
export const useCancelRequest = (kind: RequestKind) =>
  useRequestMutation(
    ({ id, reason, rowVersion }: { id: string; reason: string; rowVersion: string }) =>
      requestsApi.cancel(kind, id, reason, rowVersion),
    () => 'Cancellation requested',
  )

/**
 * The lists' "Approved" / "Unapproved" (`/requests/approvals/bulk-*`): each
 * ticked request is decided on its own. Resolves with how many went through.
 */
export function useBulkDecide() {
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
