import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { compactQuery, REQUEST_TYPE_CODES, type RequestBody, typePermission } from '../api/backend'
import { asDetails, type DetailSource, engineApi } from '../api/engine.api'
import { currentPerson, lookupsApi } from '../api/lookups.api'
import type {
  StandardApprovalParams,
  StandardDecisionInput,
  StandardKind,
  StandardListParams,
  StandardLookups,
} from './standard.types'
import { STANDARD_EXTRA_LOOKUPS } from './standard-lookups'

/*
 * The standard request types on the API's request engine
 * (`/requests/<type>`, `/requests/approvals`). The screens read each type's
 * `details` as the API sends them, so the payload is the details.
 */

/** REST calls of the standard request types. */
export const standardApi = {
  list: <P>(kind: StandardKind, params: StandardListParams, signal?: AbortSignal) =>
    engineApi.list(
      kind,
      {
        view: params.scope,
        status: params.status,
        page: params.page,
        pageSize: params.pageSize,
        filters: params.filters,
      },
      asDetails<P>(),
      signal,
    ),
  approvals: <P>(kind: StandardKind, params: StandardApprovalParams, signal?: AbortSignal) =>
    engineApi.approvals(
      kind,
      {
        box: params.view,
        status: params.status,
        page: params.page,
        pageSize: params.pageSize,
        filters: params.filters,
      },
      asDetails<P>(),
      signal,
    ),
  detail: <P>(
    kind: StandardKind,
    id: string,
    via: DetailSource = 'request',
    signal?: AbortSignal,
  ) => engineApi.detail(kind, id, asDetails<P>(), via, signal),
  /**
   * The forms' and filters' look-ups: the signed-in person, whom they may file
   * for, departments, their delegators, and the type's own (`extra`).
   */
  async lookups<X>(kind: StandardKind, signal?: AbortSignal): Promise<StandardLookups<X>> {
    const extra = STANDARD_EXTRA_LOOKUPS[kind]
    const [employees, departments, delegators, own] = await Promise.all([
      lookupsApi.employees(typePermission(kind, 'create'), {}, signal).catch(() => []),
      lookupsApi.org('departments', undefined, signal).catch(() => []),
      lookupsApi.delegators(REQUEST_TYPE_CODES[kind], signal).catch(() => []),
      extra ? extra(signal) : Promise.resolve({}),
    ])
    return {
      me: currentPerson(),
      employees,
      departments: departments.map(({ id, name }) => ({ id, name })),
      delegators,
      extra: own as X,
    }
  },
  create: <P>(kind: StandardKind, body: RequestBody) =>
    engineApi.create(kind, body, asDetails<P>()),
  update: <P>(kind: StandardKind, id: string, body: RequestBody) =>
    engineApi.update(kind, id, body, asDetails<P>()),
  remove: (kind: StandardKind, id: string, rowVersion: string) =>
    engineApi.remove(kind, id, rowVersion),
  decide: (id: string, input: StandardDecisionInput) =>
    engineApi.decide(id, input.decision, {
      remarks: input.remarks || null,
      details: input.extras ?? null,
      rowVersion: input.rowVersion,
    }),
  cancel: (kind: StandardKind, id: string, reason: string, rowVersion: string) =>
    engineApi.cancel(kind, id, reason, rowVersion),
}

export const standardKeys = {
  all: ['requests', 'standard'] as const,
  kind: (kind: StandardKind) => [...standardKeys.all, kind] as const,
  list: (kind: StandardKind, params: StandardListParams) =>
    [...standardKeys.kind(kind), 'list', compactQuery(params)] as const,
  approvals: (kind: StandardKind, params: StandardApprovalParams) =>
    [...standardKeys.kind(kind), 'approvals', compactQuery(params)] as const,
  detail: (kind: StandardKind, id: string, via: DetailSource = 'request') =>
    [...standardKeys.kind(kind), 'detail', id, via] as const,
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

export const standardDetailQueryOptions = <P>(
  kind: StandardKind,
  id: string,
  via: DetailSource = 'request',
) =>
  queryOptions({
    queryKey: standardKeys.detail(kind, id, via),
    queryFn: ({ signal }) => standardApi.detail<P>(kind, id, via, signal),
  })

export const standardLookupsQueryOptions = <X>(kind: StandardKind) =>
  queryOptions({
    queryKey: standardKeys.lookups(kind),
    queryFn: ({ signal }) => standardApi.lookups<X>(kind, signal),
    staleTime: 5 * 60_000,
  })
