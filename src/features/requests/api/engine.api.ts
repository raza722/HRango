import { apiClient } from '@/lib/axios'
import type { ApiItem } from '@/types/api'

import type { RequestPage, RequestStatus } from '../types/requests.types'
import {
  type AdaptedRequest,
  adaptRequest,
  type BackendRequest,
  type BackendRequestDetail,
  type BackendRequestPage,
  type BulkResult,
  compactQuery,
  type DecisionBody,
  fromStatus,
  REQUEST_TYPE_CODES,
  type RequestBody,
  type RequestPageSlug,
  type RequestTypeInfo,
  type RowSource,
  toCounts,
  toHistory,
  typePath,
} from './backend'

/*
 * The request engine's calls, the same for every request type. A type turns
 * the API's `details` into its screens' payload with `toPayload` (identity when
 * the screens read the details as they come).
 */

export type ApprovalBox = 'requested' | 'delegates' | 'consents' | 'cancellations'

/** Shared list filters the API takes (`q`, `employeeId`, `departmentId`, `from`, `to` …). */
export type ListFilters = Record<string, string | undefined>

export interface EngineListParams {
  /** My / Subordinates / All. */
  view: 'my' | 'subordinates' | 'all'
  status?: RequestStatus | undefined
  page: number
  pageSize: number
  filters?: ListFilters | undefined
}

export interface EngineApprovalParams {
  box: ApprovalBox
  status?: RequestStatus | undefined
  page: number
  pageSize: number
  filters?: ListFilters | undefined
}

/** A type's request as the screens use it: the shared fields, `kind` and `payload`. */
export type EngineRequest<K extends string, P> = AdaptedRequest & { kind: K; payload: P }

export type PayloadMapper<P> = (request: BackendRequest) => P

/** Reads the details as they come: `asDetails<LeaveDetails>()`. */
export function asDetails<P>(): PayloadMapper<P> {
  return (request) => request.details as P
}

function adapt<K extends string, P>(
  kind: K,
  row: BackendRequest,
  source: RowSource,
  toPayload: PayloadMapper<P>,
): EngineRequest<K, P> {
  return { ...adaptRequest(row, source), kind, payload: toPayload(row) }
}

function adaptPage<K extends string, P>(
  kind: K,
  page: BackendRequestPage,
  source: RowSource,
  toPayload: PayloadMapper<P>,
): RequestPage<EngineRequest<K, P>> {
  return {
    data: page.data.map((row) => adapt(kind, row, source, toPayload)),
    meta: page.meta,
    counts: toCounts(page.counts),
  }
}

/** Where a request is read from: its type's endpoints, or Approvals (wider: whatever reached you). */
export type DetailSource = 'request' | 'approvals'

export const engineApi = {
  /** `GET /requests/<type>?view=my|subordinates|all&status&page&pageSize&<filters>`. */
  async list<K extends RequestPageSlug, P>(
    kind: K,
    params: EngineListParams,
    toPayload: PayloadMapper<P>,
    signal?: AbortSignal,
  ) {
    const { data } = await apiClient.get<BackendRequestPage>(typePath(kind), {
      params: compactQuery({ ...params, status: fromStatus(params.status) }),
      signal,
    })
    return adaptPage(kind, data, { tab: 'request' }, toPayload)
  },

  /** `GET /requests/approvals?box=&type=<code>&status&page&pageSize&<filters>`. */
  async approvals<K extends RequestPageSlug, P>(
    kind: K,
    params: EngineApprovalParams,
    toPayload: PayloadMapper<P>,
    signal?: AbortSignal,
  ) {
    const { data } = await apiClient.get<BackendRequestPage>('/requests/approvals', {
      params: compactQuery({
        ...params,
        type: REQUEST_TYPE_CODES[kind],
        status: fromStatus(params.status),
      }),
      signal,
    })
    return adaptPage(kind, data, { tab: 'approvals', box: params.box }, toPayload)
  },

  /** One request with its flow, history, files and the caller's actions. */
  async detail<K extends RequestPageSlug, P>(
    kind: K,
    id: string,
    toPayload: PayloadMapper<P>,
    via: DetailSource = 'request',
    signal?: AbortSignal,
  ) {
    const url = via === 'approvals' ? `/requests/approvals/${id}` : typePath(kind, `/${id}`)
    const { data } = await apiClient.get<ApiItem<BackendRequestDetail>>(url, { signal })
    return {
      request: adapt(kind, data.data, { tab: 'request' }, toPayload),
      history: toHistory(data.data),
    }
  },

  async create<K extends RequestPageSlug, P>(
    kind: K,
    body: RequestBody,
    toPayload: PayloadMapper<P>,
  ) {
    const { data } = await apiClient.post<ApiItem<BackendRequestDetail>>(typePath(kind), body)
    return adapt(kind, data.data, { tab: 'request' }, toPayload)
  },

  /** Edits a pending request nobody has acted on (or as a Can Edit approver); `body.rowVersion` required. */
  async update<K extends RequestPageSlug, P>(
    kind: K,
    id: string,
    body: RequestBody,
    toPayload: PayloadMapper<P>,
  ) {
    const { data } = await apiClient.put<ApiItem<BackendRequestDetail>>(
      typePath(kind, `/${id}`),
      body,
    )
    return adapt(kind, data.data, { tab: 'request' }, toPayload)
  },

  /** Deletes a pending request nobody has acted on (kept, marked deleted). */
  async remove(kind: RequestPageSlug, id: string, rowVersion: string) {
    await apiClient.delete(typePath(kind, `/${id}`), { params: { rowVersion } })
  },

  /**
   * Withdraws a pending request (cancelled at once) or asks to cancel an
   * approved one (the cancellation flow decides). A reason is required.
   */
  async cancel(kind: RequestPageSlug, id: string, reason: string, rowVersion: string) {
    await apiClient.post(typePath(kind, `/${id}/cancel`), { reason, rowVersion })
  },

  /** Approve or reject the step waiting for the caller (`details`: the approver's fields). */
  async decide(id: string, decision: 'approve' | 'reject', body: DecisionBody) {
    await apiClient.post(`/requests/approvals/${id}/${decision}`, body)
  },

  /** A Can Disagree step: agree or disagree; the flow goes on either way. */
  async consent(id: string, agree: boolean, remarks: string | null, rowVersion: string) {
    await apiClient.post(`/requests/approvals/${id}/consent`, { agree, remarks, rowVersion })
  },

  /** Passes the step waiting for the caller to another employee. */
  async forward(id: string, employeeId: string, remarks: string | null, rowVersion: string) {
    await apiClient.post(`/requests/approvals/${id}/forward`, { employeeId, remarks, rowVersion })
  },

  /** Each request decided on its own; the answer says which went through. */
  async bulk(
    decision: 'approve' | 'reject',
    items: readonly { id: string; rowVersion: string }[],
    remarks: string | null,
  ) {
    const { data } = await apiClient.post<ApiItem<BulkResult[]>>(
      `/requests/approvals/bulk-${decision}`,
      { items, remarks },
    )
    return data.data
  },

  /** Adds an uploaded file to a request. */
  async addAttachment(kind: RequestPageSlug, id: string, fileId: string, label?: string) {
    await apiClient.post(typePath(kind, `/${id}/attachments`), { fileId, label: label ?? null })
  },

  async removeAttachment(kind: RequestPageSlug, id: string, attachmentId: string) {
    await apiClient.delete(typePath(kind, `/${id}/attachments/${attachmentId}`))
  },

  /** `GET /requests/types`: the request types, names and whether they are admin only. */
  async types(signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiItem<RequestTypeInfo[]>>('/requests/types', { signal })
    return data.data
  },
}
