import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem } from '@/types/api'

import type { RequestDetail, RequestPage } from '../types/requests.types'
import type {
  StandardApprovalParams,
  StandardDecisionInput,
  StandardKind,
  StandardListParams,
  StandardLookups,
  StandardRequest,
} from './standard.types'

/** Flattens the filters into the query and leaves out empty values. */
function query(params: object & { filters?: Record<string, string | undefined> | undefined }) {
  const { filters, ...rest } = params
  return Object.fromEntries(
    Object.entries({ ...rest, ...filters }).filter(
      ([, value]) => value !== undefined && value !== '',
    ),
  )
}

const path = (kind: StandardKind, suffix = '') => `/requests/${kind}${suffix}`

/** REST calls of the standard request types (the same shape as Transfer's). */
export const standardApi = {
  async list<P>(kind: StandardKind, params: StandardListParams, signal?: AbortSignal) {
    const { data } = await apiClient.get<RequestPage<StandardRequest<P>>>(path(kind), {
      params: query(params),
      signal,
    })
    return data
  },
  async approvals<P>(kind: StandardKind, params: StandardApprovalParams, signal?: AbortSignal) {
    const { data } = await apiClient.get<RequestPage<StandardRequest<P>>>(
      path(kind, '/approvals'),
      { params: query(params), signal },
    )
    return data
  },
  async detail<P>(kind: StandardKind, id: string, signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiItem<RequestDetail<StandardRequest<P>>>>(
      path(kind, `/${id}`),
      { signal },
    )
    return data.data
  },
  async lookups<X>(kind: StandardKind, signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiItem<StandardLookups<X>>>(path(kind, '/lookups'), {
      signal,
    })
    return data.data
  },
  async create<P>(kind: StandardKind, input: object) {
    const { data } = await apiClient.post<ApiItem<StandardRequest<P>>>(path(kind), input)
    return data.data
  },
  async update<P>(kind: StandardKind, id: string, input: object) {
    const { data } = await apiClient.put<ApiItem<StandardRequest<P>>>(path(kind, `/${id}`), input)
    return data.data
  },
  async remove(kind: StandardKind, id: string) {
    await apiClient.delete(path(kind, `/${id}`))
  },
  async decide<P>(kind: StandardKind, id: string, input: StandardDecisionInput) {
    const { data } = await apiClient.post<ApiItem<StandardRequest<P>>>(
      path(kind, `/${id}/decision`),
      input,
    )
    return data.data
  },
  async cancel<P>(kind: StandardKind, id: string, reason: string) {
    const { data } = await apiClient.post<ApiItem<StandardRequest<P>>>(
      path(kind, `/${id}/cancel`),
      { reason },
    )
    return data.data
  },
}

export const standardKeys = {
  all: ['requests', 'standard'] as const,
  kind: (kind: StandardKind) => [...standardKeys.all, kind] as const,
  list: (kind: StandardKind, params: StandardListParams) =>
    [...standardKeys.kind(kind), 'list', query(params)] as const,
  approvals: (kind: StandardKind, params: StandardApprovalParams) =>
    [...standardKeys.kind(kind), 'approvals', query(params)] as const,
  detail: (kind: StandardKind, id: string) => [...standardKeys.kind(kind), 'detail', id] as const,
  lookups: (kind: StandardKind) => [...standardKeys.kind(kind), 'lookups'] as const,
}

export const standardListQueryOptions = <P>(kind: StandardKind, params: StandardListParams) =>
  queryOptions({
    queryKey: standardKeys.list(kind, params),
    queryFn: ({ signal }) => standardApi.list<P>(kind, params, signal),
    placeholderData: keepPreviousData,
  })

export const standardApprovalsQueryOptions = <P>(
  kind: StandardKind,
  params: StandardApprovalParams,
) =>
  queryOptions({
    queryKey: standardKeys.approvals(kind, params),
    queryFn: ({ signal }) => standardApi.approvals<P>(kind, params, signal),
    placeholderData: keepPreviousData,
  })

export const standardDetailQueryOptions = <P>(kind: StandardKind, id: string) =>
  queryOptions({
    queryKey: standardKeys.detail(kind, id),
    queryFn: ({ signal }) => standardApi.detail<P>(kind, id, signal),
  })

export const standardLookupsQueryOptions = <X>(kind: StandardKind) =>
  queryOptions({
    queryKey: standardKeys.lookups(kind),
    queryFn: ({ signal }) => standardApi.lookups<X>(kind, signal),
    staleTime: 5 * 60_000,
  })
