import { http, type HttpHandler, HttpResponse } from 'msw'
import { z } from 'zod'

import type {
  ApprovalDetails,
  BackendAction,
  BackendAttachment,
  BackendRequest,
  BackendRequestDetail,
  BackendRequestPage,
  BackendStatus,
  BackendStep,
  BulkResult,
} from '@/features/requests'
import type { ApiItem } from '@/types/api'

import { findEmployee } from '../employees/seed'
import { mockFileUrl, mockUploadName } from '../files/handlers'
import { profileOf } from '../scheduling/seed'
import { apiPath, errorResponse, latency, paginate, readPageParams, requireAuth } from '../utils'
import { currentStep, type FlowRecord, type StoredStep } from './flow'
import { forbidden, invalid, notFound } from './http'
import { delegatorsOf, ME, mustFind, requestEmployee } from './people'

/*
 * The mock API speaks the backend's request engine (backend/app/routers/requests.py):
 * requests in the `RequestOut` / `RequestDetailOut` shape, request bodies as
 * `RequestIn` (`details` per type), and one Approvals screen across types
 * (`/requests/approvals`). Each type keeps its own stored records (the mock's
 * planned flow, history and payload) and registers an `ApprovalSource` here, so
 * the shared endpoints can list, read and decide its requests.
 */

// --- stored records -------------------------------------------------------------------------------

/** A stored request of any type: the planned flow, consents, history and the type's payload. */
export type StoredAnyRequest = FlowRecord & {
  payload: unknown
  /** Uploaded files (`attachments: [fileId]`), kept with the name the mock knows. */
  files?: StoredFile[]
  /** Who forwarded the current step, when an approver passed it on. */
  forwardedTo?: string | null
}

export interface StoredFile {
  id: string
  fileId: string
  name: string
  label: string | null
  at: string
}

/** The header fields the backend keeps on every request. */
export interface RequestHeaderFields {
  fromDate: string | null
  toDate: string | null
  days: number | null
  reason: string | null
  description: string | null
  application: string | null
}

/** What a type tells the serializer about one of its records. */
export interface SerializeInfo {
  /** `leave`, `shift_swap` … */
  typeCode: string
  typeName: string
  /** The backend's kind (`time_window` for relaxation and official visits). */
  kind: string
  header: RequestHeaderFields
  /** The type's `details`, camelCase, ids as strings. */
  details: Record<string, unknown>
}

// --- people and labels ----------------------------------------------------------------------------

/** The mock planner's step labels → the backend's approver kinds. */
const AUTHORITY_KINDS: Record<string, string> = {
  'Line Manager': 'line_manager',
  HOD: 'hod',
  'HOD Finance': 'finance_manager',
  'HOD Admin': 'admin_manager',
  'HOD HR': 'hr_manager',
  'HOD HR/Admin': 'hr_manager',
  'HR Manager': 'final_authority',
  'Final Authority': 'final_authority',
  'Branch Manager': 'branch_manager',
  'Area Manager': 'area_manager',
  Employee: 'employee',
  Consentee: 'employee',
}

export const approverKindOf = (authority: string) =>
  AUTHORITY_KINDS[authority] ?? authority.toLowerCase().replace(/[^a-z]+/g, '_')

const nameOf = (id: string | null) => (id ? (findEmployee(id)?.name ?? id) : null)

/** A department's id as the mock's `/organisation/lookups/departments` gives it (payroll's mock too). */
export const mockDepartmentId = (name: string) =>
  `dep_${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

/** Trimmed text, or null when blank. */
export function textOrNull(value: string | null | undefined): string | null {
  const text = value?.trim() ?? ''
  return text === '' ? null : text
}

/** The mock's row version: the record's last change. */
export const rowVersionOf = (record: { updatedAt: string }) => record.updatedAt

const toBackendStatus = (status: FlowRecord['status']): BackendStatus =>
  status === 'completed' ? 'approved' : status

// --- steps ----------------------------------------------------------------------------------------

function step(
  record: FlowRecord,
  index: string,
  stored: StoredStep,
  purpose: 'request' | 'cancellation',
  stepNo: number,
): BackendStep | null {
  if (stored.status === 'waiting') return null
  return {
    id: `${record.id}-${index}`,
    purpose,
    stepNo,
    approverKind: approverKindOf(stored.authority),
    approverId: stored.approverId,
    approverName: nameOf(stored.approverId),
    actedById: stored.actedById,
    actedByName: nameOf(stored.actedById),
    isDelegate: stored.actedById !== null && stored.actedById !== stored.approverId,
    isConsent: false,
    actionTaken: stored.status,
    remarks: stored.remarks,
    actedAt: stored.actedAt,
    createdAt: record.createdAt,
  }
}

/** The steps as the backend records them: as the flow reaches them, plus the requester's own. */
export function backendSteps(record: FlowRecord): BackendStep[] {
  const steps: BackendStep[] = [
    {
      id: `${record.id}-submitted`,
      purpose: 'request',
      stepNo: null,
      approverKind: 'requester',
      approverId: null,
      approverName: null,
      actedById: record.createdById,
      actedByName: nameOf(record.createdById),
      isDelegate: false,
      isConsent: false,
      actionTaken: 'submitted',
      remarks: null,
      actedAt: record.createdAt,
      createdAt: record.createdAt,
    },
  ]
  record.consents.forEach((consent, index) => {
    steps.push({
      id: `${record.id}-c${String(index)}`,
      purpose: 'request',
      stepNo: index + 1,
      approverKind: 'employee',
      approverId: consent.personId,
      approverName: nameOf(consent.personId),
      actedById: consent.status === 'pending' ? null : consent.personId,
      actedByName: consent.status === 'pending' ? null : nameOf(consent.personId),
      isDelegate: false,
      isConsent: true,
      actionTaken:
        consent.status === 'given'
          ? 'consented'
          : consent.status === 'declined'
            ? 'disagreed'
            : record.status === 'pending'
              ? 'pending'
              : 'skipped',
      remarks: consent.remarks,
      actedAt: consent.status === 'pending' ? null : record.updatedAt,
      createdAt: record.createdAt,
    })
  })
  record.flow.forEach((stored, index) => {
    const out = step(record, `s${String(index)}`, stored, 'request', index + 1)
    if (out) steps.push(out)
  })
  if (record.cancelReason !== null && record.status !== 'pending') {
    const asked = record.history.find((entry) => entry.status === 'Cancellation requested')
    steps.push({
      id: `${record.id}-cancel`,
      purpose: 'cancellation',
      stepNo: null,
      approverKind: 'requester',
      approverId: null,
      approverName: null,
      actedById: asked?.byId ?? record.employeeId,
      actedByName: nameOf(asked?.byId ?? record.employeeId),
      isDelegate: false,
      isConsent: false,
      actionTaken:
        record.status === 'cancelled' && !record.cancelStep ? 'withdrawn' : 'cancel_requested',
      remarks: record.cancelReason,
      actedAt: asked?.at ?? record.updatedAt,
      createdAt: asked?.at ?? record.updatedAt,
    })
  }
  if (record.cancelStep) {
    const out = step(record, 'x', record.cancelStep, 'cancellation', 1)
    if (out) steps.push(out)
  }
  return steps
}

// --- actions --------------------------------------------------------------------------------------

/** The approver (or their delegator) whose step waits now, if the signed-in person may take it. */
function waitingFor(record: FlowRecord, typeCode: string): { delegator: string | null } | null {
  const now = currentStep(record)
  if (!now || record.employeeId === ME) return null
  if (now.approverId === ME) return { delegator: null }
  if (delegatorsOf(ME, typeCode).includes(now.approverId)) return { delegator: now.approverId }
  return null
}

const consentWaiting = (record: FlowRecord) =>
  record.status === 'pending' &&
  record.consents.some((consent) => consent.personId === ME && consent.status === 'pending')

/**
 * What the signed-in person may do, as the backend lists it. Read as an approver
 * (`GET /requests/approvals/{id}`) only view and the decision actions are listed: approve /
 * reject / forward while their step waits, or consent / disagree.
 */
export function backendActions(
  record: FlowRecord,
  typeCode: string,
  asApprover = false,
): BackendAction[] {
  const actions: BackendAction[] = ['view']
  if (asApprover) {
    if (waitingFor(record, typeCode)) {
      actions.push('approve', 'reject')
      if (record.status === 'pending') actions.push('forward')
    }
    if (consentWaiting(record)) actions.push('consent', 'disagree')
    return actions
  }
  const mine = record.employeeId === ME || record.createdById === ME
  const untouched =
    record.flow.every((stored) => stored.status === 'pending' || stored.status === 'waiting') &&
    record.consents.every((consent) => consent.status === 'pending')
  if (mine && record.status === 'pending')
    actions.push(...(untouched ? (['edit', 'delete'] as const) : []), 'cancel')
  if (mine && record.status === 'completed') actions.push('cancel')
  if (waitingFor(record, typeCode)) {
    actions.push('approve', 'reject')
    if (record.status === 'pending') actions.push('forward')
  }
  if (consentWaiting(record)) actions.push('consent', 'disagree')
  return actions
}

// --- serializing ----------------------------------------------------------------------------------

export function serializeRequest(record: StoredAnyRequest, info: SerializeInfo): BackendRequest {
  const employee = requestEmployee(mustFind(record.employeeId))
  const directory = mustFind(record.employeeId)
  const now = currentStep(record)
  const final = record.flow.at(-1) ?? null
  return {
    id: record.id,
    code: record.code,
    requestType: info.typeCode,
    requestTypeName: info.typeName,
    kind: info.kind,
    employeeId: employee.id,
    employeeCode: employee.code,
    employeeName: employee.name,
    departmentId: mockDepartmentId(directory.department),
    departmentName: employee.department,
    branchId: directory.branchId ?? null,
    branchName: employee.branch,
    locationId: null,
    locationName: employee.location,
    jobTitleName: employee.designation,
    joiningDate: employee.joiningDate || null,
    ...info.header,
    status: toBackendStatus(record.status),
    submittedAt: record.createdAt,
    decidedAt: record.status === 'pending' ? null : (record.history.at(-1)?.at ?? record.updatedAt),
    cancelReason: record.cancelReason,
    nextApproverId: now?.approverId ?? null,
    nextApproverName: nameOf(now?.approverId ?? null),
    nextApproverKind: now ? approverKindOf(now.authority) : null,
    finalAuthorityId: final?.approverId ?? null,
    finalAuthorityName: nameOf(final?.approverId ?? null),
    details: info.details,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    rowVersion: rowVersionOf(record),
  }
}

export function serializeDetail(
  record: StoredAnyRequest,
  info: SerializeInfo,
  asApprover = false,
): BackendRequestDetail {
  return {
    ...serializeRequest(record, info),
    steps: backendSteps(record),
    attachments: (record.files ?? []).map((file): BackendAttachment => ({
      id: file.id,
      fileId: file.fileId,
      name: file.name,
      mimeType: null,
      sizeBytes: null,
      label: file.label,
      url: mockFileUrl(file.fileId),
      createdAt: file.at,
    })),
    actions: backendActions(record, info.typeCode, asApprover),
  }
}

/** Uploaded file ids from a body → stored files (the mock knows no names: "Attachment N"). */
export function filesFrom(ids: readonly string[], at: string): StoredFile[] {
  return ids.map((fileId, index) => ({
    id: `att_${fileId}`,
    fileId,
    // The name it was uploaded with (as the API returns it); seeded ids have none.
    name: mockUploadName(fileId) ?? `Attachment ${String(index + 1)}`,
    label: null,
    at,
  }))
}

// --- request bodies -------------------------------------------------------------------------------

/** `RequestIn`; `details` is checked by the type. */
export const requestBodySchema = z.object({
  employeeId: z.string().min(1).nullish(),
  fromDate: z.string().nullish(),
  toDate: z.string().nullish(),
  reason: z.string().max(4000).nullish(),
  description: z.string().max(4000).nullish(),
  application: z.string().nullish(),
  attachments: z
    .array(z.union([z.string(), z.number()]).transform(String))
    .max(20)
    .default([]),
  details: z.record(z.string(), z.unknown()),
  rowVersion: z.string().nullish(),
})
export type RequestBodyIn = z.infer<typeof requestBodySchema>

export const decisionBodySchema = z.object({
  remarks: z.string().max(4000).nullish(),
  details: z.record(z.string(), z.unknown()).nullish(),
  rowVersion: z.string().min(1),
})

export const cancelBodySchema = z.object({
  reason: z.string().trim().min(1).max(4000),
  rowVersion: z.string().min(1),
})

/** 409 when the row changed since the caller read it. */
export function staleRow(record: { updatedAt: string }, rowVersion: string | null | undefined) {
  if (!rowVersion || rowVersion === rowVersionOf(record)) return null
  return errorResponse(
    409,
    'Someone changed this request since you opened it. Reload and try again.',
    {
      code: 'CONFLICT',
    },
  )
}

// --- the shared Approvals screen ------------------------------------------------------------------

/** A request type the Approvals screen reads and decides. */
export interface ApprovalSource {
  typeCode: string
  records: () => StoredAnyRequest[]
  find: (id: string) => StoredAnyRequest | undefined
  info: (record: StoredAnyRequest) => SerializeInfo
  /** Approve or reject the step waiting for the signed-in person (or the cancellation). */
  decide: (
    record: StoredAnyRequest,
    decision: 'approve' | 'reject',
    remarks: string | null,
    details: ApprovalDetails,
  ) => Response | StoredAnyRequest
  consent: (record: StoredAnyRequest, agree: boolean, remarks: string | null) => StoredAnyRequest
  forward: (
    record: StoredAnyRequest,
    employeeId: string,
    remarks: string | null,
  ) => StoredAnyRequest
}

const sources = new Map<string, ApprovalSource>()

export function registerApprovalSource(source: ApprovalSource): void {
  sources.set(source.typeCode, source)
}

function locate(id: string): { source: ApprovalSource; record: StoredAnyRequest } | null {
  for (const source of sources.values()) {
    const record = source.find(id)
    if (record) return { source, record }
  }
  return null
}

type Box = 'requested' | 'delegates' | 'consents' | 'cancellations'

/** The steps of a record the signed-in person is part of, per box (as `req.fn_actor_steps`). */
function inBox(record: StoredAnyRequest, box: Box, typeCode: string, delegatorId: string | null) {
  if (record.employeeId === ME) return null
  const reached = (stored: StoredStep | null) =>
    stored !== null && stored.status !== 'waiting' && stored.status !== 'skipped'
  const waiting = currentStep(record)
  if (box === 'consents') {
    const consent = record.consents.find((item) => item.personId === ME)
    return consent
      ? { waiting: consent.status === 'pending' && record.status === 'pending', delegator: null }
      : null
  }
  if (box === 'cancellations') {
    const stored = record.cancelStep
    if (!reached(stored) || !stored) return null
    const mine = stored.approverId === ME || delegatorsOf(ME, typeCode).includes(stored.approverId)
    return mine ? { waiting: record.status === 'cancelling', delegator: null } : null
  }
  const people =
    box === 'delegates'
      ? delegatorsOf(ME, typeCode).filter((id) => !delegatorId || id === delegatorId)
      : [ME]
  const steps = record.flow.filter(
    (stored) => reached(stored) && people.includes(stored.approverId),
  )
  if (steps.length === 0) return null
  return {
    waiting: record.status === 'pending' && waiting !== null && steps.includes(waiting),
    delegator: box === 'delegates' ? (steps[0]?.approverId ?? null) : null,
  }
}

const STATUS_ORDER: BackendStatus[] = ['pending', 'approved', 'rejected', 'cancelling', 'cancelled']

/** Shared list filters: q, employeeId, departmentId, branchId, from, to. */
export function matchesFilters(row: BackendRequest, url: URL): boolean {
  const get = (name: string) => textOrNull(url.searchParams.get(name))
  const q = get('q')?.toLowerCase()
  if (
    q &&
    ![row.code, row.employeeName ?? '', row.employeeCode].some((text) =>
      text.toLowerCase().includes(q),
    )
  ) {
    return false
  }
  const employeeId = get('employeeId')
  if (employeeId && row.employeeId !== employeeId) return false
  const departmentId = get('departmentId')
  if (departmentId && row.departmentId !== departmentId) return false
  const branchId = get('branchId')
  if (branchId && row.branchId !== branchId) return false
  const from = get('from')
  if (from && (row.toDate ?? row.fromDate ?? '9999') < from) return false
  const to = get('to')
  if (to && (row.fromDate ?? '0000') > to) return false
  return true
}

/** A list page with the status tabs' counts (pending in Approvals = waiting for you). */
export function pageOf(
  url: URL,
  rows: { row: BackendRequest; waiting?: boolean }[],
): BackendRequestPage {
  const status = url.searchParams.get('status')
  const filtered = rows.filter(({ row }) => matchesFilters(row, url))
  const counts = Object.fromEntries(STATUS_ORDER.map((name) => [name, 0])) as Record<
    BackendStatus,
    number
  >
  // Approvals: each row sits in one tab, so the counts add up to All. One waiting for you is
  // Pending (whatever its status, e.g. a cancelling one in Cancellations); the rest go by status.
  for (const { row, waiting } of filtered) {
    if (waiting === undefined) counts[row.status] += 1
    else if (waiting) counts.pending += 1
    else if (row.status !== 'pending') counts[row.status] += 1
  }
  const shown = filtered.filter(({ row, waiting }) =>
    !status
      ? true
      : waiting === undefined
        ? row.status === status
        : status === 'pending'
          ? waiting
          : !waiting && row.status === status,
  )
  const sorted = shown.sort(
    (a, b) =>
      Number(b.waiting ?? false) - Number(a.waiting ?? false) ||
      (b.row.submittedAt ?? '').localeCompare(a.row.submittedAt ?? ''),
  )
  const { page, pageSize } = readPageParams(url)
  const result = paginate(
    sorted.map(({ row }) => row),
    page,
    pageSize,
  )
  return { ...result, counts }
}

const guard = async (request: Request) => {
  await latency()
  return requireAuth(request)
}

const base = (path: string) => apiPath(`/requests/approvals${path}`)

function decided(source: ApprovalSource, record: StoredAnyRequest) {
  return HttpResponse.json<ApiItem<BackendRequestDetail>>({
    data: serializeDetail(record, source.info(record), true),
  })
}

const consentSchema = z.object({
  agree: z.boolean(),
  remarks: z.string().max(4000).nullish(),
  rowVersion: z.string().min(1),
})
const forwardSchema = z.object({
  employeeId: z.union([z.string(), z.number()]).transform(String),
  remarks: z.string().max(4000).nullish(),
  rowVersion: z.string().min(1),
})
const bulkSchema = z.object({
  items: z
    .array(
      z.object({ id: z.union([z.string(), z.number()]).transform(String), rowVersion: z.string() }),
    )
    .min(1)
    .max(100),
  remarks: z.string().max(4000).nullish(),
})

function runDecision(
  found: { source: ApprovalSource; record: StoredAnyRequest },
  decision: 'approve' | 'reject',
  remarks: string | null,
  details: ApprovalDetails,
): Response | StoredAnyRequest {
  const { source, record } = found
  if (!backendActions(record, source.typeCode).includes(decision)) {
    return forbidden('This request is not waiting for your decision.')
  }
  if (decision === 'reject' && !remarks) {
    return invalid('Give a reason for rejecting.', { remarks: 'Give a reason for rejecting' })
  }
  return source.decide(record, decision, remarks, details)
}

/** `/requests/approvals…`: the Approvals screen over every registered type. */
export const approvalHandlers: HttpHandler[] = [
  http.get(base(''), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const url = new URL(request.url)
    const box = (url.searchParams.get('box') ?? 'requested') as Box
    const type = url.searchParams.get('type')?.replaceAll('-', '_') ?? null
    const delegatorId = url.searchParams.get('delegatorId')
    const rows: { row: BackendRequest; waiting: boolean }[] = []
    for (const source of sources.values()) {
      if (type && source.typeCode !== type) continue
      for (const record of source.records()) {
        const hit = inBox(record, box, source.typeCode, delegatorId)
        if (!hit) continue
        rows.push({
          row: {
            ...serializeRequest(record, source.info(record)),
            isWaiting: hit.waiting,
            delegatorId: hit.delegator,
            delegatorName: nameOf(hit.delegator),
          },
          waiting: hit.waiting,
        })
      }
    }
    return HttpResponse.json<BackendRequestPage>(pageOf(url, rows))
  }),

  ...(['approve', 'reject'] as const).map((decision) =>
    http.post(base(`/bulk-${decision}`), async ({ request }) => {
      const denied = await guard(request)
      if (denied) return denied
      const body = bulkSchema.safeParse(await request.json().catch(() => null))
      if (!body.success) return invalid('Some fields are not valid.')
      const remarks = textOrNull(body.data.remarks)
      const results: BulkResult[] = body.data.items.map((item) => {
        const found = locate(item.id)
        if (!found)
          return { id: item.id, ok: false, status: null, code: 'NOT_FOUND', message: 'Not found.' }
        const stale = staleRow(found.record, item.rowVersion)
        if (stale) {
          return {
            id: item.id,
            ok: false,
            status: null,
            code: 'CONFLICT',
            message: 'Changed since you read it.',
          }
        }
        // Bulk approve has no approval form: a loan's amount and dates are prefilled (as the API).
        const prefill =
          'kind' in found.record && found.record.kind === 'loan-advances'
            ? ({ prefill: true } as ApprovalDetails)
            : {}
        const out = runDecision(found, decision, remarks, prefill)
        if (out instanceof Response) {
          return {
            id: item.id,
            ok: false,
            status: null,
            code: 'REFUSED',
            message: 'Not waiting for your decision.',
          }
        }
        return {
          id: item.id,
          ok: true,
          status: toBackendStatus(out.status),
          code: null,
          message: null,
        }
      })
      return HttpResponse.json<ApiItem<BulkResult[]>>({ data: results })
    }),
  ),

  http.get(base('/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const found = locate(String(params.id))
    if (!found) return notFound()
    return decided(found.source, found.record)
  }),

  http.post(base('/:id/:action'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const found = locate(String(params.id))
    if (!found) return notFound()
    const { source, record } = found
    const body: unknown = await request.json().catch(() => null)
    const action = String(params.action)
    if (action === 'approve' || action === 'reject') {
      const parsed = decisionBodySchema.safeParse(body)
      if (!parsed.success) return invalid('Some fields are not valid.')
      const stale = staleRow(record, parsed.data.rowVersion)
      if (stale) return stale
      const out = runDecision(
        found,
        action,
        textOrNull(parsed.data.remarks),
        parsed.data.details ?? {},
      )
      return out instanceof Response ? out : decided(source, out)
    }
    if (action === 'consent') {
      const parsed = consentSchema.safeParse(body)
      if (!parsed.success) return invalid('Some fields are not valid.')
      const stale = staleRow(record, parsed.data.rowVersion)
      if (stale) return stale
      if (!consentWaiting(record))
        return forbidden('Your consent is not asked for on this request.')
      const remarks = textOrNull(parsed.data.remarks)
      if (!parsed.data.agree && !remarks) {
        return invalid('Give a reason for disagreeing.', {
          remarks: 'Give a reason for disagreeing',
        })
      }
      return decided(source, source.consent(record, parsed.data.agree, remarks))
    }
    if (action === 'forward') {
      const parsed = forwardSchema.safeParse(body)
      if (!parsed.success)
        return invalid('Choose whom to forward it to.', { employeeId: 'Choose an employee' })
      const stale = staleRow(record, parsed.data.rowVersion)
      if (stale) return stale
      if (!backendActions(record, source.typeCode).includes('forward')) {
        return forbidden('This request is not waiting for your decision.')
      }
      const target = findEmployee(parsed.data.employeeId)
      if (!target || profileOf(target).status !== 'active') {
        return invalid('Choose an active employee.', { employeeId: 'Choose an active employee' })
      }
      return decided(source, source.forward(record, target.id, textOrNull(parsed.data.remarks)))
    }
    return notFound()
  }),
]

// --- moving records (shared by every type) --------------------------------------------------------

/** Withdrawing a pending request: cancelled at once, its waiting steps skipped. */
export function withdrawRecord<T extends FlowRecord>(record: T, reason: string, at: string): T {
  return {
    ...record,
    status: 'cancelled',
    cancelReason: reason,
    flow: record.flow.map((stored) =>
      stored.status === 'pending' || stored.status === 'waiting'
        ? { ...stored, status: 'skipped' as const, remarks: 'Withdrawn by the requester.' }
        : stored,
    ),
    updatedAt: at,
    history: [
      ...record.history,
      {
        id: `${record.id}-w${String(record.history.length)}`,
        byId: ME,
        delegate: false,
        status: 'Withdrawn',
        remarks: reason,
        at,
      },
    ],
  }
}

/** Forwarding: the waiting step is marked forwarded and the chosen employee's step waits next. */
export function forwardRecord<T extends FlowRecord>(
  record: T,
  employeeId: string,
  remarks: string | null,
  at: string,
): T {
  const index = record.flow.findIndex((stored) => stored.status === 'pending')
  const waiting = record.flow[index]
  if (!waiting) return record
  const flow: StoredStep[] = [
    ...record.flow.slice(0, index),
    { ...waiting, status: 'forwarded', actedById: ME, actedAt: at, remarks },
    {
      authority: 'Employee',
      approverId: employeeId,
      status: 'pending',
      actedById: null,
      actedAt: null,
      remarks: null,
    },
    ...record.flow.slice(index + 1),
  ]
  return {
    ...record,
    flow,
    updatedAt: at,
    history: [
      ...record.history,
      {
        id: `${record.id}-f${String(record.history.length)}`,
        byId: ME,
        delegate: false,
        status: `Forwarded to ${nameOf(employeeId) ?? employeeId}`,
        remarks,
        at,
      },
    ],
  }
}
