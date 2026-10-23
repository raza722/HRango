import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem } from '@/types/api'

import type {
  ApprovalListParams,
  DayShift,
  DecisionInput,
  RequestDetail,
  RequestInputMap,
  RequestKind,
  RequestKindMap,
  RequestListParams,
  RequestLookups,
  RequestPage,
  TransferFilters,
  TransferLookups,
  TransferRequest,
} from '../types/requests.types'

/**
 * Leaves out empty values so equal filters share one cache entry, and puts a
 * list's `filters` into the query beside the other parameters.
 */
function compact<T extends object>(params: T): Partial<T> {
  const { filters, ...rest } = params as T & { filters?: Record<string, string | undefined> }
  return Object.fromEntries(
    Object.entries({ ...rest, ...filters }).filter(
      ([, value]) => value !== undefined && value !== '',
    ),
  ) as Partial<T>
}

async function getData<T>(path: string, params?: object, signal?: AbortSignal) {
  const { data } = await apiClient.get<ApiItem<T>>(path, {
    params: params ? compact(params) : undefined,
    signal,
  })
  return data.data
}

async function postData<T>(path: string, body: unknown) {
  const { data } = await apiClient.post<ApiItem<T>>(path, body)
  return data.data
}

/** REST calls of the Requests module, one set per request type. */
export const requestsApi = {
  async list<K extends RequestKind>(kind: K, params: RequestListParams, signal?: AbortSignal) {
    const { data } = await apiClient.get<RequestPage<RequestKindMap[K]>>(`/requests/${kind}`, {
      params: compact(params),
      signal,
    })
    return data
  },
  async approvals<K extends RequestKind>(
    kind: K,
    params: ApprovalListParams,
    signal?: AbortSignal,
  ) {
    const { data } = await apiClient.get<RequestPage<RequestKindMap[K]>>(
      `/requests/${kind}/approvals`,
      { params: compact(params), signal },
    )
    return data
  },
  detail: <K extends RequestKind>(kind: K, id: string, signal?: AbortSignal) =>
    getData<RequestDetail<RequestKindMap[K]>>(`/requests/${kind}/${id}`, undefined, signal),
  lookups: (signal?: AbortSignal) =>
    getData<RequestLookups>('/requests/lookups', undefined, signal),
  dayShift: (employeeId: string | undefined, date: string, signal?: AbortSignal) =>
    getData<DayShift>('/requests/day-shift', { employeeId, date }, signal),

  create: <K extends RequestKind>(kind: K, input: RequestInputMap[K]) =>
    postData<RequestKindMap[K]>(`/requests/${kind}`, input),
  async update<K extends RequestKind>(kind: K, id: string, input: RequestInputMap[K]) {
    const { data } = await apiClient.put<ApiItem<RequestKindMap[K]>>(
      `/requests/${kind}/${id}`,
      input,
    )
    return data.data
  },
  async remove(kind: RequestKind, id: string) {
    await apiClient.delete(`/requests/${kind}/${id}`)
  },
  decide: <K extends RequestKind>(kind: K, id: string, input: DecisionInput) =>
    postData<RequestKindMap[K]>(`/requests/${kind}/${id}/decision`, input),
  consent: <K extends RequestKind>(kind: K, id: string, input: DecisionInput) =>
    postData<RequestKindMap[K]>(`/requests/${kind}/${id}/consent`, input),
  cancel: <K extends RequestKind>(kind: K, id: string, reason: string) =>
    postData<RequestKindMap[K]>(`/requests/${kind}/${id}/cancel`, { reason }),

  // Transfer lists take the Filters dialog's values as well.
  async transferList(params: RequestListParams & TransferFilters, signal?: AbortSignal) {
    const { data } = await apiClient.get<RequestPage<TransferRequest>>('/requests/transfer', {
      params: compact(params),
      signal,
    })
    return data
  },
  async transferApprovals(params: ApprovalListParams & TransferFilters, signal?: AbortSignal) {
    const { data } = await apiClient.get<RequestPage<TransferRequest>>(
      '/requests/transfer/approvals',
      { params: compact(params), signal },
    )
    return data
  },
  transferLookups: (signal?: AbortSignal) =>
    getData<TransferLookups>('/requests/lookups/transfer', undefined, signal),
}

export const requestKeys = {
  all: ['requests'] as const,
  kind: (kind: RequestKind) => [...requestKeys.all, kind] as const,
  list: (kind: RequestKind, params: RequestListParams) =>
    [...requestKeys.kind(kind), 'list', compact(params)] as const,
  approvals: (kind: RequestKind, params: ApprovalListParams) =>
    [...requestKeys.kind(kind), 'approvals', compact(params)] as const,
  detail: (kind: RequestKind, id: string) => [...requestKeys.kind(kind), 'detail', id] as const,
  lookups: () => [...requestKeys.all, 'lookups'] as const,
  dayShift: (employeeId: string | undefined, date: string) =>
    [...requestKeys.all, 'day-shift', employeeId ?? 'me', date] as const,
  transferList: (params: RequestListParams & TransferFilters) =>
    [...requestKeys.kind('transfer'), 'list', compact(params)] as const,
  transferApprovals: (params: ApprovalListParams & TransferFilters) =>
    [...requestKeys.kind('transfer'), 'approvals', compact(params)] as const,
  transferLookups: () => [...requestKeys.all, 'lookups', 'transfer'] as const,
}

export const requestListQueryOptions = <K extends RequestKind>(
  kind: K,
  params: RequestListParams,
) =>
  queryOptions({
    queryKey: requestKeys.list(kind, params),
    queryFn: ({ signal }) => requestsApi.list(kind, params, signal),
    placeholderData: keepPreviousData,
  })

export const approvalListQueryOptions = <K extends RequestKind>(
  kind: K,
  params: ApprovalListParams,
) =>
  queryOptions({
    queryKey: requestKeys.approvals(kind, params),
    queryFn: ({ signal }) => requestsApi.approvals(kind, params, signal),
    placeholderData: keepPreviousData,
  })

export const requestDetailQueryOptions = <K extends RequestKind>(kind: K, id: string) =>
  queryOptions({
    queryKey: requestKeys.detail(kind, id),
    queryFn: ({ signal }) => requestsApi.detail(kind, id, signal),
  })

export const requestLookupsQueryOptions = () =>
  queryOptions({
    queryKey: requestKeys.lookups(),
    queryFn: ({ signal }) => requestsApi.lookups(signal),
    staleTime: 5 * 60_000,
  })

export const dayShiftQueryOptions = (employeeId: string | undefined, date: string) =>
  queryOptions({
    queryKey: requestKeys.dayShift(employeeId, date),
    queryFn: ({ signal }) => requestsApi.dayShift(employeeId, date, signal),
  })

export const transferListQueryOptions = (params: RequestListParams & TransferFilters) =>
  queryOptions({
    queryKey: requestKeys.transferList(params),
    queryFn: ({ signal }) => requestsApi.transferList(params, signal),
    placeholderData: keepPreviousData,
  })

export const transferApprovalsQueryOptions = (params: ApprovalListParams & TransferFilters) =>
  queryOptions({
    queryKey: requestKeys.transferApprovals(params),
    queryFn: ({ signal }) => requestsApi.transferApprovals(params, signal),
    placeholderData: keepPreviousData,
  })

export const transferLookupsQueryOptions = () =>
  queryOptions({
    queryKey: requestKeys.transferLookups(),
    queryFn: ({ signal }) => requestsApi.transferLookups(signal),
    staleTime: 5 * 60_000,
  })
