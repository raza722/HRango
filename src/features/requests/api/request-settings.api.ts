import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  FlowPurpose,
  FlowScope,
  RequestAuthority,
  RequestAuthorityInput,
  RequestDelegation,
  RequestDelegationInput,
  RequestDelegationPatch,
  RequestFlow,
  RequestFlowDetail,
  RequestFlowInput,
  RequestRestriction,
  RequestRestrictionInput,
} from '../types/request-settings.types'

/*
 * Request Settings on the API (backend/app/routers/requests.py):
 *   /requests/settings/restrictions  GET (list, one), POST, PUT {…, rowVersion}, DELETE ?rowVersion
 *   /requests/settings/delegations   GET (list, one), POST, PATCH {isActive, description, rowVersion},
 *                                    DELETE ?rowVersion
 *   /requests/settings/flows         GET (list, one with nodes), POST, PUT (a new version), DELETE
 *   /requests/settings/authorities   GET, POST, PUT, DELETE
 */

function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== '' && value !== null,
    ),
  ) as Partial<T>
}

const path = (rest: string) => `/requests/settings${rest}`

async function getItem<T>(url: string, signal?: AbortSignal) {
  const { data } = await apiClient.get<ApiItem<T>>(path(url), { signal })
  return data.data
}

async function getPage<T>(url: string, params: object, signal?: AbortSignal) {
  const { data } = await apiClient.get<Paginated<T>>(path(url), { params: compact(params), signal })
  return data
}

async function send<T>(method: 'post' | 'put' | 'patch', url: string, body: unknown) {
  const { data } = await apiClient[method]<ApiItem<T>>(path(url), body)
  return data.data
}

async function remove(url: string, rowVersion: string) {
  await apiClient.delete(path(url), { params: { rowVersion } })
}

export interface PageParams {
  page: number
  pageSize: number
}

export interface RestrictionFilters {
  requestType?: string | undefined
  startFrom?: string | undefined
  startTo?: string | undefined
  endFrom?: string | undefined
  endTo?: string | undefined
}

export interface DelegationFilters {
  delegatorId?: string | undefined
  delegateeId?: string | undefined
  /** `true` / `false` (the Status filter's Active / Inactive). */
  isActive?: string | undefined
  requestType?: string | undefined
  q?: string | undefined
}

export interface FlowFilters {
  requestType?: string | undefined
  purpose?: FlowPurpose | undefined
  scopeType?: FlowScope | undefined
}

export interface AuthorityFilters {
  authority?: string | undefined
  requestType?: string | undefined
  employeeId?: string | undefined
}

export const requestSettingsApi = {
  restrictions: (params: PageParams & RestrictionFilters, signal?: AbortSignal) =>
    getPage<RequestRestriction>('/restrictions', params, signal),
  restriction: (id: string, signal?: AbortSignal) =>
    getItem<RequestRestriction>(`/restrictions/${id}`, signal),
  createRestriction: (input: RequestRestrictionInput) =>
    send<RequestRestriction>('post', '/restrictions', input),
  updateRestriction: (id: string, input: RequestRestrictionInput) =>
    send<RequestRestriction>('put', `/restrictions/${id}`, input),
  deleteRestriction: (row: { id: string; rowVersion: string }) =>
    remove(`/restrictions/${row.id}`, row.rowVersion),

  delegations: (params: PageParams & DelegationFilters, signal?: AbortSignal) =>
    getPage<RequestDelegation>('/delegations', params, signal),
  delegation: (id: string, signal?: AbortSignal) =>
    getItem<RequestDelegation>(`/delegations/${id}`, signal),
  createDelegation: (input: RequestDelegationInput) =>
    send<RequestDelegation>('post', '/delegations', input),
  patchDelegation: (id: string, input: RequestDelegationPatch) =>
    send<RequestDelegation>('patch', `/delegations/${id}`, input),
  deleteDelegation: (row: { id: string; rowVersion: string }) =>
    remove(`/delegations/${row.id}`, row.rowVersion),

  flows: (params: PageParams & FlowFilters, signal?: AbortSignal) =>
    getPage<RequestFlow>('/flows', params, signal),
  flow: (id: string, signal?: AbortSignal) => getItem<RequestFlowDetail>(`/flows/${id}`, signal),
  createFlow: (input: RequestFlowInput) => send<RequestFlowDetail>('post', '/flows', input),
  /** Saves a new version: the answer has a new id. */
  updateFlow: (id: string, input: RequestFlowInput) =>
    send<RequestFlowDetail>('put', `/flows/${id}`, input),
  deleteFlow: (row: { id: string; rowVersion: string }) =>
    remove(`/flows/${row.id}`, row.rowVersion),

  authorities: (params: PageParams & AuthorityFilters, signal?: AbortSignal) =>
    getPage<RequestAuthority>('/authorities', params, signal),
  createAuthority: (input: RequestAuthorityInput) =>
    send<RequestAuthority>('post', '/authorities', input),
  updateAuthority: (id: string, input: RequestAuthorityInput) =>
    send<RequestAuthority>('put', `/authorities/${id}`, input),
  deleteAuthority: (row: { id: string; rowVersion: string }) =>
    remove(`/authorities/${row.id}`, row.rowVersion),

  /** Roles for a flow's Role node (`GET /access/roles`, needs access.roles.view). */
  async roles(signal?: AbortSignal) {
    const { data } = await apiClient.get<Paginated<{ id: string; name: string }>>('/access/roles', {
      params: { pageSize: 100 },
      signal,
    })
    return data.data.map(({ id, name }) => ({ id, name }))
  },
}

export const requestSettingsKeys = {
  all: ['requests', 'settings'] as const,
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
