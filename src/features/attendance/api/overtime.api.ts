import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { format } from 'date-fns'

import {
  approverKindLabel,
  type BackendRequest,
  type BackendRequestDetail,
  type BackendRequestPage,
  type BackendStep,
} from '@/features/requests'
import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import {
  OVERTIME_STATUSES,
  type OvertimeAction,
  type OvertimeApplication,
  type OvertimeApplicationDetail,
  type OvertimeApplicationPage,
  type OvertimeApprovalParams,
  type OvertimeBulkResult,
  type OvertimeDecisionInput,
  type OvertimeDetailsOut,
  type OvertimeExportParams,
  type OvertimeLeaveType,
  type OvertimeListParams,
  type OvertimePolicy,
  type OvertimePolicyInput,
  type OvertimePolicyParams,
  type OvertimeRequestBody,
  type OvertimeSettings,
  type OvertimeStatus,
  type OvertimeStep,
} from '../types/overtime.types'
import { hm, spanMinutes } from '../utils/overtime-format'
import { compact, downloadCsv } from './attendance.api'

/*
 * Attendance → Overtime on the API:
 * - requests: `/requests/overtime` (the request engine's type `overtime`), approved through the
 *   shared `/requests/approvals` endpoints with `details.approvedMinutes`;
 * - policies: `/attendance/settings/overtime-policies`; settings: `/attendance/settings/overtime`.
 * The engine's `RequestOut` is read into the screens' `OvertimeApplication` here.
 */

const REQUESTS = '/requests/overtime'
const APPROVALS = '/requests/approvals'
const POLICIES = '/attendance/settings/overtime-policies'
const SETTINGS = '/attendance/settings/overtime'

// --- reading the engine's shapes --------------------------------------------------------------

const idOf = (value: unknown): string | null =>
  (typeof value === 'string' && value !== '') || typeof value === 'number' ? String(value) : null

const statusOf = (status: string): OvertimeStatus =>
  OVERTIME_STATUSES.find((item) => item === status) ?? 'pending'

/** A list row (or a detail) → the screens' application. Missing details fall back to the header. */
export function toOvertimeApplication(
  row: BackendRequest<OvertimeDetailsOut>,
): OvertimeApplication {
  const details = row.details
  const startTime = hm(details.startTime)
  const endTime = hm(details.endTime)
  const span = startTime && endTime ? Math.max(0, spanMinutes(startTime, endTime)) : 0
  return {
    id: row.id,
    code: row.code,
    employeeId: row.employeeId,
    employeeName: row.employeeName ?? row.employeeCode,
    employeeCode: row.employeeCode,
    departmentId: idOf(details.departmentId) ?? row.departmentId,
    departmentName: details.departmentName ?? row.departmentName,
    locationId: idOf(details.locationId) ?? row.locationId,
    locationName: details.locationName ?? row.locationName,
    branchId: idOf(details.branchId) ?? row.branchId,
    branchName: details.branchName ?? row.branchName,
    date: details.overtimeDate ?? row.fromDate ?? '',
    startTime,
    endTime,
    appliedMinutes: details.appliedMinutes ?? span,
    approvedMinutes: details.approvedMinutes ?? null,
    reason: row.reason,
    status: statusOf(row.status),
    submittedAt: row.submittedAt ?? row.createdAt,
    decidedAt: row.decidedAt,
    cancelReason: row.cancelReason,
    nextApproverId: row.nextApproverId,
    nextApproverName: row.nextApproverName,
    finalAuthorityName: row.finalAuthorityName,
    rowVersion: row.rowVersion,
    isWaiting: row.isWaiting ?? null,
    delegatorName: row.delegatorName ?? null,
  }
}

const STEP_WORDS: Record<string, string> = {
  submitted: 'Requested',
  withdrawn: 'Withdrawn',
  cancel_requested: 'Cancellation requested',
}

function toStep(step: BackendStep): OvertimeStep {
  const requester = step.approverKind === 'requester'
  const authority = requester
    ? (STEP_WORDS[step.actionTaken] ?? 'Requester')
    : approverKindLabel(step.approverKind)
  return {
    id: step.id,
    label:
      step.purpose === 'cancellation' && !requester ? `${authority} (Cancellation)` : authority,
    personName: requester ? step.actedByName : (step.actedByName ?? step.approverName),
    action: step.actionTaken,
    remarks: step.remarks,
    at: step.actedAt,
  }
}

const ACTIONS: readonly OvertimeAction[] = [
  'view',
  'edit',
  'delete',
  'cancel',
  'approve',
  'reject',
  'consent',
  'disagree',
  'forward',
]

export function toOvertimeDetail(
  detail: BackendRequestDetail<OvertimeDetailsOut>,
): OvertimeApplicationDetail {
  return {
    ...toOvertimeApplication(detail),
    steps: detail.steps.map(toStep),
    attachments: detail.attachments.map((file) => ({
      id: file.id,
      fileId: file.fileId,
      name: file.name,
      url: file.url,
    })),
    actions: detail.actions.filter((action): action is OvertimeAction => ACTIONS.includes(action)),
  }
}

function toPage(page: BackendRequestPage<OvertimeDetailsOut>): OvertimeApplicationPage {
  const counts = Object.fromEntries(
    OVERTIME_STATUSES.map((status) => [status, page.counts[status] ?? 0]),
  ) as Record<OvertimeStatus, number>
  return { data: page.data.map(toOvertimeApplication), meta: page.meta, counts }
}

async function getData<T>(path: string, params?: object, signal?: AbortSignal) {
  const { data } = await apiClient.get<ApiItem<T>>(path, {
    signal,
    ...(params ? { params: compact(params) } : {}),
  })
  return data.data
}

// --- calls ---------------------------------------------------------------------------------------

export const overtimeApi = {
  /** `GET /requests/overtime?view=my|subordinates|all&status&q&employeeId&from&to&page&pageSize`. */
  async list(params: OvertimeListParams, signal?: AbortSignal) {
    const { data } = await apiClient.get<BackendRequestPage<OvertimeDetailsOut>>(REQUESTS, {
      params: compact(params),
      signal,
    })
    return toPage(data)
  },

  /** `GET /requests/approvals?box&type=overtime&status&q&employeeId&from&to&page&pageSize`. */
  async approvals(params: OvertimeApprovalParams, signal?: AbortSignal) {
    const { data } = await apiClient.get<BackendRequestPage<OvertimeDetailsOut>>(APPROVALS, {
      params: compact({ ...params, type: 'overtime' }),
      signal,
    })
    return toPage(data)
  },

  /**
   * One request with its steps, files and the caller's actions: from its own endpoint, or as an
   * approver (`/requests/approvals/{id}`: view and the decision actions only).
   */
  async detail(id: string, via: 'request' | 'approvals' = 'request', signal?: AbortSignal) {
    const path = via === 'approvals' ? `${APPROVALS}/${id}` : `${REQUESTS}/${id}`
    return toOvertimeDetail(
      await getData<BackendRequestDetail<OvertimeDetailsOut>>(path, undefined, signal),
    )
  },

  /** "Apply for Overtime" (yours), or one person of a bulk request (`employeeId` set). */
  async create(body: OvertimeRequestBody) {
    const { data } = await apiClient.post<ApiItem<BackendRequestDetail<OvertimeDetailsOut>>>(
      REQUESTS,
      body,
    )
    return toOvertimeDetail(data.data)
  },

  /** Edits a pending request nobody has acted on (`body.rowVersion` required). */
  async update(id: string, body: OvertimeRequestBody) {
    const { data } = await apiClient.put<ApiItem<BackendRequestDetail<OvertimeDetailsOut>>>(
      `${REQUESTS}/${id}`,
      body,
    )
    return toOvertimeDetail(data.data)
  },

  /** Withdraws a pending request (cancelled at once) or asks to cancel an approved one. */
  async cancel(id: string, reason: string, rowVersion: string) {
    const { data } = await apiClient.post<ApiItem<BackendRequestDetail<OvertimeDetailsOut>>>(
      `${REQUESTS}/${id}/cancel`,
      { reason, rowVersion },
    )
    return toOvertimeDetail(data.data)
  },

  /** Approve (with the approved minutes) or reject the step waiting for the caller. */
  async decide(id: string, decision: 'approve' | 'reject', input: OvertimeDecisionInput) {
    const details =
      decision === 'approve' &&
      input.approvedMinutes !== undefined &&
      input.approvedMinutes !== null
        ? { approvedMinutes: input.approvedMinutes }
        : null
    const { data } = await apiClient.post<ApiItem<BackendRequestDetail<OvertimeDetailsOut>>>(
      `${APPROVALS}/${id}/${decision}`,
      { remarks: input.remarks, details, rowVersion: input.rowVersion },
    )
    return toOvertimeDetail(data.data)
  },

  /** Approves each request on its own (no approval details: the applied minutes stand). */
  async bulkApprove(items: readonly { id: string; rowVersion: string }[], remarks: string | null) {
    const { data } = await apiClient.post<ApiItem<OvertimeBulkResult[]>>(
      `${APPROVALS}/bulk-approve`,
      { items, remarks },
    )
    return data.data
  },

  /** Rejects each request on its own, with one reason for all; the result says which went through. */
  async bulkReject(items: readonly { id: string; rowVersion: string }[], remarks: string) {
    const { data } = await apiClient.post<ApiItem<OvertimeBulkResult[]>>(
      `${APPROVALS}/bulk-reject`,
      { items, remarks },
    )
    return data.data
  },

  /** Deletes a pending request nobody has acted on. */
  async remove(id: string, rowVersion: string) {
    await apiClient.delete(`${REQUESTS}/${id}`, { params: { rowVersion } })
  },

  /** Adds an uploaded file (`POST /files`, module `requests`) to a filed request. */
  async addAttachment(id: string, fileId: string) {
    await apiClient.post(`${REQUESTS}/${id}/attachments`, { fileId, label: null })
  },

  async removeAttachment(id: string, attachmentId: string) {
    await apiClient.delete(`${REQUESTS}/${id}/attachments/${attachmentId}`)
  },

  /** A Can Disagree step (Consents box): agree, or disagree with remarks; the flow goes on. */
  async consent(id: string, agree: boolean, remarks: string | null, rowVersion: string) {
    const { data } = await apiClient.post<ApiItem<BackendRequestDetail<OvertimeDetailsOut>>>(
      `${APPROVALS}/${id}/consent`,
      { agree, remarks, rowVersion },
    )
    return toOvertimeDetail(data.data)
  },

  /** Passes the step waiting for the caller to another employee. */
  async forward(id: string, employeeId: string, remarks: string | null, rowVersion: string) {
    const { data } = await apiClient.post<ApiItem<BackendRequestDetail<OvertimeDetailsOut>>>(
      `${APPROVALS}/${id}/forward`,
      { employeeId, remarks, rowVersion },
    )
    return toOvertimeDetail(data.data)
  },

  /**
   * The list's rows as a file (`GET /requests/overtime/export`, the list's filters without the
   * page). The spec does not name the format; it is saved as CSV, like the Attendance exports.
   */
  exportCsv: (params: OvertimeExportParams) =>
    downloadCsv(
      `${REQUESTS}/export`,
      compact(params),
      `overtime-${params.view}-${format(new Date(), 'yyyy-MM-dd')}.csv`,
    ),

  // --- policies -------------------------------------------------------------------------------
  async policies(params: OvertimePolicyParams, signal?: AbortSignal) {
    const { data } = await apiClient.get<Paginated<OvertimePolicy>>(POLICIES, {
      params: compact(params),
      signal,
    })
    return { ...data, data: data.data.map(normalizePolicy) }
  },
  policy: async (id: string, signal?: AbortSignal) =>
    normalizePolicy(await getData<OvertimePolicy>(`${POLICIES}/${id}`, undefined, signal)),
  async createPolicy(input: OvertimePolicyInput) {
    const { data } = await apiClient.post<ApiItem<OvertimePolicy>>(POLICIES, input)
    return normalizePolicy(data.data)
  },
  async updatePolicy(id: string, input: OvertimePolicyInput) {
    const { data } = await apiClient.put<ApiItem<OvertimePolicy>>(`${POLICIES}/${id}`, input)
    return normalizePolicy(data.data)
  },
  deletePolicy: async (id: string, rowVersion: string) => {
    await apiClient.delete(`${POLICIES}/${id}`, { params: { rowVersion } })
  },
  /** Leave types a `leave` slab can encash into (`GET /leaves/types`, the largest page). */
  async leaveTypes(signal?: AbortSignal) {
    const { data } = await apiClient.get<Paginated<OvertimeLeaveType>>('/leaves/types', {
      params: { page: 1, pageSize: 100 },
      signal,
    })
    return data.data
  },

  // --- settings -------------------------------------------------------------------------------
  settings: (signal?: AbortSignal) => getData<OvertimeSettings>(SETTINGS, undefined, signal),
  async saveSettings(input: OvertimeSettings) {
    const { data } = await apiClient.put<ApiItem<OvertimeSettings>>(SETTINGS, input)
    return data.data
  },
}

/** `slabs` may come back null (`slabCount` only); ids as strings. */
function normalizePolicy(policy: OvertimePolicy): OvertimePolicy {
  return {
    ...policy,
    period: policy.period === 'monthly' ? 'monthly' : 'daily',
    slabs: ((policy.slabs as OvertimePolicy['slabs'] | null) ?? []).map((slab) => ({
      ...slab,
      encashmentType: slab.encashmentType === 'full_day' ? 'full_day' : 'leave',
      leaveTypeId: idOf(slab.leaveTypeId),
    })),
  }
}

export const overtimeKeys = {
  all: ['attendance', 'overtime'] as const,
  requests: () => [...overtimeKeys.all, 'requests'] as const,
  list: (params: OvertimeListParams) =>
    [...overtimeKeys.requests(), 'list', compact(params)] as const,
  approvals: (params: OvertimeApprovalParams) =>
    [...overtimeKeys.requests(), 'approvals', compact(params)] as const,
  detail: (id: string, via: 'request' | 'approvals') =>
    [...overtimeKeys.requests(), 'detail', via, id] as const,
  policies: () => [...overtimeKeys.all, 'policies'] as const,
  policyList: (params: OvertimePolicyParams) =>
    [...overtimeKeys.policies(), 'list', compact(params)] as const,
  leaveTypes: () => [...overtimeKeys.all, 'leave-types'] as const,
  settings: () => [...overtimeKeys.all, 'settings'] as const,
}

export const overtimeListQueryOptions = (params: OvertimeListParams) =>
  queryOptions({
    queryKey: overtimeKeys.list(params),
    queryFn: ({ signal }) => overtimeApi.list(params, signal),
    placeholderData: keepPreviousData,
  })

export const overtimeApprovalsQueryOptions = (params: OvertimeApprovalParams) =>
  queryOptions({
    queryKey: overtimeKeys.approvals(params),
    queryFn: ({ signal }) => overtimeApi.approvals(params, signal),
    placeholderData: keepPreviousData,
  })

export const overtimeDetailQueryOptions = (id: string, via: 'request' | 'approvals') =>
  queryOptions({
    queryKey: overtimeKeys.detail(id, via),
    queryFn: ({ signal }) => overtimeApi.detail(id, via, signal),
  })

export const overtimePoliciesQueryOptions = (params: OvertimePolicyParams) =>
  queryOptions({
    queryKey: overtimeKeys.policyList(params),
    queryFn: ({ signal }) => overtimeApi.policies(params, signal),
    placeholderData: keepPreviousData,
  })

export const overtimeLeaveTypesQueryOptions = () =>
  queryOptions({
    queryKey: overtimeKeys.leaveTypes(),
    queryFn: ({ signal }) => overtimeApi.leaveTypes(signal),
    staleTime: 60_000,
  })

export const overtimeSettingsQueryOptions = () =>
  queryOptions({
    queryKey: overtimeKeys.settings(),
    queryFn: ({ signal }) => overtimeApi.settings(signal),
  })
