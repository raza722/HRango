import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  FlowAssignmentInput,
  FlowAssignmentRow,
  FlowNode,
  FlowNodeRow,
  FlowRequestType,
  RequestDelegationInput,
  RequestDelegationRow,
  RequestFlowDefinition,
  RequestRestrictionInput,
  RequestRestrictionRow,
  RequestSettingsLookups,
} from '../types/request-settings.types'

function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== '' && value !== null,
    ),
  ) as Partial<T>
}

const path = (rest: string) => `/requests/settings${rest}`

async function getData<T>(url: string, params?: object, signal?: AbortSignal) {
  const { data } = await apiClient.get<ApiItem<T>>(path(url), {
    ...(params ? { params: compact(params) } : {}),
    signal,
  })
  return data.data
}

async function getPage<T>(url: string, params: object, signal?: AbortSignal) {
  const { data } = await apiClient.get<Paginated<T>>(path(url), { params: compact(params), signal })
  return data
}

async function send<T>(method: 'post' | 'put', url: string, body?: unknown) {
  const { data } = await apiClient[method]<ApiItem<T>>(path(url), body ?? {})
  return data.data
}

export interface PageParams {
  page: number
  pageSize: number
}

export interface RestrictionFilters {
  companyId?: string | undefined
  requestType?: string | undefined
  startFrom?: string | undefined
  startTo?: string | undefined
  endFrom?: string | undefined
  endTo?: string | undefined
}

export interface DelegationFilters {
  delegatorId?: string | undefined
  delegateeId?: string | undefined
  status?: string | undefined
  requestType?: string | undefined
}

export interface AssignmentFilters {
  requestType: FlowRequestType
  employeeId?: string | undefined
  search?: string | undefined
}

export const requestSettingsApi = {
  lookups: (signal?: AbortSignal) => getData<RequestSettingsLookups>('/lookups', undefined, signal),

  restrictions: (params: PageParams & RestrictionFilters, signal?: AbortSignal) =>
    getPage<RequestRestrictionRow>('/restrictions', params, signal),
  restriction: (id: string, signal?: AbortSignal) =>
    getData<RequestRestrictionRow>(`/restrictions/${id}`, undefined, signal),
  createRestriction: (input: RequestRestrictionInput) =>
    send<RequestRestrictionRow>('post', '/restrictions', input),
  deleteRestrictions: (ids: string[]) =>
    send<{ deleted: number }>('post', '/restrictions/delete', { ids }),

  delegations: (params: PageParams & DelegationFilters, signal?: AbortSignal) =>
    getPage<RequestDelegationRow>('/delegations', params, signal),
  delegation: (id: string, signal?: AbortSignal) =>
    getData<RequestDelegationRow>(`/delegations/${id}`, undefined, signal),
  createDelegation: (input: RequestDelegationInput) =>
    send<RequestDelegationRow>('post', '/delegations', input),
  setDelegationsActive: (ids: string[], active: boolean) =>
    send<{ changed: number }>('post', '/delegations/status', { ids, active }),

  flow: (requestType: FlowRequestType, signal?: AbortSignal) =>
    getData<RequestFlowDefinition & { rows: FlowNodeRow[] }>(
      `/flows/${requestType}`,
      undefined,
      signal,
    ),
  saveFlow: (requestType: FlowRequestType, nodes: FlowNode[]) =>
    send<RequestFlowDefinition>('put', `/flows/${requestType}`, { nodes }),

  assignments: (params: PageParams & AssignmentFilters, signal?: AbortSignal) =>
    getPage<FlowAssignmentRow>('/flow-assignments', params, signal),
  saveAssignments: (input: FlowAssignmentInput) =>
    send<{ changed: number }>('post', '/flow-assignments', input),
}

export const requestSettingsKeys = {
  all: ['requests', 'settings'] as const,
  lookups: () => [...requestSettingsKeys.all, 'lookups'] as const,
  list: (name: string, params: object) =>
    [...requestSettingsKeys.all, name, compact(params)] as const,
  detail: (name: string, id: string) => [...requestSettingsKeys.all, name, 'detail', id] as const,
}

export const settingsListQueryOptions = <TRow, TParams extends object>(
  name: string,
  params: TParams,
  fetch: (params: TParams, signal?: AbortSignal) => Promise<Paginated<TRow>>,
) =>
  queryOptions({
    queryKey: requestSettingsKeys.list(name, params),
    queryFn: ({ signal }) => fetch(params, signal),
    placeholderData: keepPreviousData,
  })
