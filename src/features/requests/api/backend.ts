import type { PaginationMeta } from '@/types/api'

import type {
  ConsentEntry,
  FlowStep,
  FlowStepStatus,
  PersonRef,
  RequestAction,
  RequestAttachment,
  RequestCounts,
  RequestEmployee,
  RequestHeader,
  RequestHistoryEntry,
  RequestStatus,
} from '../types/requests.types'

/*
 * The request engine as the API speaks it (backend/app/schemas/requests.py,
 * routers/requests.py): one set of endpoints per request type under
 * `/requests/<type with hyphens>`, one Approvals screen under
 * `/requests/approvals`, and Request Settings under `/requests/settings`. Every
 * request has the same header and its type's `details` (camelCase, ids as
 * strings). This file holds those shapes and turns them into the screens'
 * models (`RequestHeader` + the shared request fields).
 */

// --- request types ----------------------------------------------------------------------------------

/**
 * Frontend page (URL segment under /requests) â†’ the API's request type code.
 * The API's URL segment is the code with hyphens (`shift_swap` â†’ `/requests/shift-swap`).
 */
export const REQUEST_TYPE_CODES = {
  punch: 'punch',
  shift: 'shift_swap',
  transfer: 'transfer',
  leave: 'leave',
  'loan-advances': 'loan',
  'work-from-home': 'work_from_home',
  promotion: 'promotion',
  relaxation: 'relaxation',
  'rest-days': 'rest_day',
  travel: 'travel',
  resignation: 'resignation',
  expense: 'expense',
  'official-visits': 'official_visit',
  'air-tickets': 'air_ticket',
  requisition: 'requisition',
} as const
export type RequestPageSlug = keyof typeof REQUEST_TYPE_CODES
export type RequestTypeCode = (typeof REQUEST_TYPE_CODES)[RequestPageSlug]

/** `/requests/<api slug>`: the type code with hyphens. */
export const apiSlug = (code: string) => code.replaceAll('_', '-')

/** The API path of a page's request type: `leave` â†’ `/requests/leave`, `shift` â†’ `/requests/shift-swap`. */
export const typePath = (page: RequestPageSlug, suffix = '') =>
  `/requests/${apiSlug(REQUEST_TYPE_CODES[page])}${suffix}`

/** Permission code of a page's request type: `requests.shift_swap.create`. */
export const typePermission = (
  page: RequestPageSlug,
  action: 'view' | 'create' | 'cancel' | 'export',
) => `requests.${REQUEST_TYPE_CODES[page]}.${action}`

// --- shapes ----------------------------------------------------------------------------------------

/** pending â†’ approved | rejected; approved â†’ cancelling â†’ cancelled (or back to approved). */
export type BackendStatus = 'pending' | 'approved' | 'rejected' | 'cancelling' | 'cancelled'

/** Row menu actions the API grants on a request's detail. */
export type BackendAction =
  'view' | 'edit' | 'delete' | 'cancel' | 'approve' | 'reject' | 'consent' | 'disagree' | 'forward'

export interface BackendStep {
  id: string
  purpose: 'request' | 'cancellation'
  stepNo: number | null
  /** line_manager, hod, branch_manager, final_authority, employee, role, an authority code, requester. */
  approverKind: string | null
  approverId: string | null
  approverName: string | null
  actedById: string | null
  actedByName: string | null
  isDelegate: boolean
  isConsent: boolean
  /** pending, approved, rejected, skipped, informed, forwarded, consented, disagreed, withdrawn, cancel_requested. */
  actionTaken: string
  remarks: string | null
  actedAt: string | null
  createdAt: string
}

export interface BackendAttachment {
  id: string
  fileId: string
  name: string
  mimeType: string | null
  sizeBytes: number | null
  label: string | null
  url: string
  createdAt: string
}

/** A request in a list (`RequestOut`). */
export interface BackendRequest<D = Record<string, unknown>> {
  id: string
  code: string
  requestType: string
  requestTypeName: string
  kind: string
  employeeId: string
  employeeCode: string
  employeeName: string | null
  departmentId: string | null
  departmentName: string | null
  branchId: string | null
  branchName: string | null
  locationId: string | null
  locationName: string | null
  jobTitleName: string | null
  joiningDate: string | null
  fromDate: string | null
  toDate: string | null
  days: number | null
  reason: string | null
  description: string | null
  application: string | null
  status: BackendStatus
  submittedAt: string | null
  decidedAt: string | null
  cancelReason: string | null
  nextApproverId: string | null
  nextApproverName: string | null
  nextApproverKind: string | null
  finalAuthorityId: string | null
  finalAuthorityName: string | null
  details: D
  createdAt: string
  updatedAt: string | null
  rowVersion: string
  /** Approvals lists only. */
  isWaiting?: boolean | null
  delegatorId?: string | null
  delegatorName?: string | null
}

/** One request with its steps, files and what the caller may do (`RequestDetailOut`). */
export interface BackendRequestDetail<D = Record<string, unknown>> extends BackendRequest<D> {
  steps: BackendStep[]
  attachments: BackendAttachment[]
  actions: BackendAction[]
}

/** A list page with the status tabs' counts. */
export interface BackendRequestPage<D = Record<string, unknown>> {
  data: BackendRequest<D>[]
  meta: PaginationMeta
  counts: Partial<Record<BackendStatus, number>>
}

/** POST /requests/<type> and PUT /requests/<type>/<id> (`RequestIn`). */
export interface RequestBody<D = Record<string, unknown>> {
  /** Empty: the caller's own request (My); an employee for All Requests. */
  employeeId?: string | null
  fromDate?: string | null
  toDate?: string | null
  reason?: string | null
  description?: string | null
  application?: string | null
  /** Uploaded file ids (POST /files, module `requests`). */
  attachments?: string[]
  details: D
  /** Required on edit. */
  rowVersion?: string
}

/** What an approver enters (loans, overtime, resignation, expense, air tickets); others send nothing. */
export interface ApprovalDetails {
  approvedAmount?: number | null
  lines?: { id: string; approvedAmount: number }[] | null
  paymentMethod?: 'bank' | 'cash' | 'pay_order' | 'cheque' | null
  repaymentDate?: string | null
  currency?: string | null
  approvedMinutes?: number | null
  lastWorkingDate?: string | null
  serveNotice?: boolean | null
  noticePeriodDays?: number | null
}

export interface DecisionBody {
  remarks?: string | null
  details?: ApprovalDetails | null
  rowVersion: string
}

export interface BulkResult {
  id: string
  ok: boolean
  status: string | null
  code: string | null
  message: string | null
}

/** `GET /requests/types`. */
export interface RequestTypeInfo {
  id: string
  code: string
  name: string
  kind: string
  isAdminOnly: boolean
  isActive: boolean
  sortOrder: number | null
}

// --- adapters --------------------------------------------------------------------------------------

/** The screens say Completed (Approved on some types) where the API says approved. */
export function toStatus(status: string): RequestStatus {
  if (status === 'approved') return 'completed'
  if (status === 'pending' || status === 'rejected' || status === 'cancelling') return status
  return 'cancelled'
}

/** The API's status for a status tab / filter. */
export function fromStatus(status: RequestStatus | undefined): BackendStatus | undefined {
  if (!status) return undefined
  return status === 'completed' ? 'approved' : status
}

/** The status tabs' counts, with All. */
export function toCounts(
  counts: Partial<Record<BackendStatus, number>> | undefined,
): RequestCounts {
  const get = (status: BackendStatus) => counts?.[status] ?? 0
  const out: RequestCounts = {
    all: 0,
    pending: get('pending'),
    completed: get('approved'),
    rejected: get('rejected'),
    cancelling: get('cancelling'),
    cancelled: get('cancelled'),
  }
  out.all = out.pending + out.completed + out.rejected + out.cancelling + out.cancelled
  return out
}

const person = (id: string | null | undefined, name: string | null | undefined): PersonRef => ({
  id: id ?? '',
  name: name ?? 'â€”',
  code: '',
})

const personOrNull = (id: string | null | undefined, name: string | null | undefined) =>
  id ? person(id, name) : null

/** Words for an approver kind (`line_manager` â†’ Line Manager). */
export const APPROVER_KIND_LABELS: Record<string, string> = {
  line_manager: 'Line Manager',
  hod: 'HOD',
  branch_manager: 'Branch Manager',
  final_authority: 'Final Authority',
  employee: 'Employee',
  role: 'Role',
  requester: 'Requester',
  colleague: 'Colleague',
  approver: 'Approver',
  team_lead: 'Team Lead',
  hr_manager: 'HR Manager',
  operations_manager: 'Operations Manager',
  finance_manager: 'Finance Manager',
  director: 'Director',
  compliance_officer: 'Compliance Officer',
  project_manager: 'Project Manager',
  admin_supervisor: 'Admin Supervisor',
  it_administrator: 'IT Administrator',
  area_manager: 'Area Manager',
  admin_manager: 'Admin Manager',
}

export const approverKindLabel = (kind: string | null | undefined) =>
  kind ? (APPROVER_KIND_LABELS[kind] ?? kind.replaceAll('_', ' ')) : 'Approver'

const STEP_STATUSES: readonly FlowStepStatus[] = [
  'pending',
  'approved',
  'rejected',
  'skipped',
  'informed',
  'forwarded',
  'consented',
  'disagreed',
]

/** The requester's own entries (withdrawn, cancellation asked) belong in History, not the flow. */
const isRequesterStep = (step: BackendStep) => step.approverKind === 'requester'

export function toFlowStep(step: BackendStep): FlowStep {
  const status = STEP_STATUSES.find((value) => value === step.actionTaken) ?? 'skipped'
  const authority = approverKindLabel(step.approverKind)
  return {
    authority: step.purpose === 'cancellation' ? `${authority} (Cancellation)` : authority,
    approver: person(step.approverId, step.approverName),
    status,
    actedBy: personOrNull(step.actedById, step.actedByName),
    actedAt: step.actedAt,
    remarks: step.remarks,
    purpose: step.purpose,
    isConsent: step.isConsent,
    isDelegate: step.isDelegate,
  }
}

const HISTORY_WORDS: Record<string, string> = {
  submitted: 'Requested',
  approved: 'Approved',
  rejected: 'Rejected',
  skipped: 'Skipped',
  informed: 'Informed (On Looker)',
  forwarded: 'Forwarded',
  consented: 'Consented',
  disagreed: 'Disagreed',
  withdrawn: 'Withdrawn',
  cancel_requested: 'Cancellation requested',
}

/** History, newest first: "Requested", then each step someone acted on. */
export function toHistory(request: BackendRequestDetail): RequestHistoryEntry[] {
  const entries: RequestHistoryEntry[] = request.steps
    .filter((step) => step.actedAt && step.actionTaken !== 'pending')
    .map((step) => {
      const word = HISTORY_WORDS[step.actionTaken] ?? step.actionTaken
      const by = isRequesterStep(step) ? '' : ` by ${approverKindLabel(step.approverKind)}`
      const cancellation =
        step.purpose === 'cancellation' && !isRequesterStep(step) ? ' (Cancellation)' : ''
      return {
        id: step.id,
        by: person(step.actedById ?? step.approverId, step.actedByName ?? step.approverName),
        delegate: step.isDelegate,
        status: `${word}${by}${cancellation}`,
        remarks: step.remarks,
        at: step.actedAt ?? step.createdAt,
      }
    })
  // The API records the submission as a step; older requests may lack it.
  if (!request.steps.some((step) => step.actionTaken === 'submitted')) {
    entries.push({
      id: `${request.id}-requested`,
      by: person(request.employeeId, request.employeeName),
      delegate: false,
      status: 'Requested',
      remarks: null,
      at: request.submittedAt ?? request.createdAt,
    })
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at))
}

/** The employee card of the View / Approve popups. */
export function toEmployee(request: BackendRequest<unknown>): RequestEmployee {
  return {
    id: request.employeeId,
    name: request.employeeName ?? request.employeeCode,
    code: request.employeeCode,
    department: request.departmentName ?? 'â€”',
    designation: request.jobTitleName ?? 'â€”',
    company: null,
    branch: request.branchName,
    location: request.locationName,
    joiningDate: request.joiningDate ?? '',
    photoUrl: null,
  }
}

export function toAttachment(file: BackendAttachment): RequestAttachment {
  return {
    id: file.id,
    fileId: file.fileId,
    name: file.name,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    label: file.label,
    url: file.url,
  }
}

/** Where a list row was read: the Requests tab, or an Approvals box. */
export type RowSource =
  | { tab: 'request' }
  | { tab: 'approvals'; box: 'requested' | 'delegates' | 'consents' | 'cancellations' }

/**
 * A list row's menu. Lists do not carry the API's `actions`, so they follow
 * from the status: the server checks again (and the detail has the real list).
 */
export function rowActions(request: BackendRequest<unknown>, source: RowSource): RequestAction[] {
  const actions: RequestAction[] = ['view', 'flow', 'history']
  if (source.tab === 'request') {
    if (request.status === 'pending') actions.push('edit', 'delete', 'cancel')
    if (request.status === 'approved') actions.push('cancel')
    return actions
  }
  if (request.isWaiting) {
    if (source.box === 'consents') actions.push('consent')
    else actions.push('decide', 'forward')
  }
  return actions
}

/** The detail's actions in the screens' words (approve / reject â†’ decide â€¦). */
export function detailActions(actions: readonly BackendAction[]): RequestAction[] {
  const out = new Set<RequestAction>(['view', 'flow', 'history'])
  for (const action of actions) {
    if (action === 'approve' || action === 'reject') out.add('decide')
    else if (action === 'consent' || action === 'disagree') out.add('consent')
    else out.add(action)
  }
  return [...out]
}

/** The detail's decision actions, as the popups enable their buttons by them. */
export function detailDecisions(
  actions: readonly BackendAction[],
): NonNullable<RequestHeader['decisions']> {
  return actions.filter(
    (action): action is NonNullable<RequestHeader['decisions']>[number] =>
      action === 'approve' ||
      action === 'reject' ||
      action === 'consent' ||
      action === 'disagree' ||
      action === 'forward',
  )
}

/** The shared part of every request model: header, employee, flow, consents, actions. */
export interface AdaptedRequest extends RequestHeader {
  id: string
  code: string
  status: RequestStatus
  employee: RequestEmployee
  createdBy: PersonRef
  createdAt: string
  updatedAt: string
  flow: FlowStep[]
  consents: ConsentEntry[]
  cancelReason: string | null
  currentStep: FlowStep | null
  actions: RequestAction[]
}

function isDetail(request: BackendRequest<unknown>): request is BackendRequestDetail<unknown> {
  return 'steps' in request && Array.isArray((request as BackendRequestDetail<unknown>).steps)
}

/**
 * Turns a list row or a detail into the screens' request (without `kind` and
 * `payload`, which each type adds).
 */
export function adaptRequest(request: BackendRequest<unknown>, source: RowSource): AdaptedRequest {
  const detail = isDetail(request) ? request : null
  const steps = (detail?.steps ?? []).filter((step) => !isRequesterStep(step))
  const flow = steps.map(toFlowStep)
  const pending = steps.find((step) => step.actionTaken === 'pending')
  const nextApprover = personOrNull(request.nextApproverId, request.nextApproverName)
  const currentStep = pending
    ? toFlowStep(pending)
    : nextApprover
      ? {
          authority: approverKindLabel(request.nextApproverKind),
          approver: nextApprover,
          status: 'pending' as const,
          actedBy: null,
          actedAt: null,
          remarks: null,
        }
      : null
  const employee = toEmployee(request)
  return {
    id: request.id,
    code: request.code,
    status: toStatus(request.status),
    employee,
    createdBy: { id: employee.id, name: employee.name, code: employee.code },
    createdAt: request.submittedAt ?? request.createdAt,
    updatedAt: request.updatedAt ?? request.createdAt,
    flow,
    consents: steps
      .filter((step) => step.isConsent)
      .map((step) => ({
        person: person(step.approverId, step.approverName),
        status:
          step.actionTaken === 'consented'
            ? 'given'
            : step.actionTaken === 'disagreed'
              ? 'declined'
              : 'pending',
        remarks: step.remarks,
      })),
    cancelReason: request.cancelReason,
    currentStep,
    actions: detail ? detailActions(detail.actions) : rowActions(request, source),
    ...(detail ? { decisions: detailDecisions(detail.actions) } : {}),
    requestType: request.requestType,
    rowVersion: request.rowVersion,
    fromDate: request.fromDate,
    toDate: request.toDate,
    days: request.days,
    reason: request.reason,
    description: request.description,
    application: request.application,
    submittedAt: request.submittedAt,
    decidedAt: request.decidedAt,
    nextApprover,
    finalAuthority: personOrNull(request.finalAuthorityId, request.finalAuthorityName),
    attachments: (detail?.attachments ?? []).map(toAttachment),
    isWaiting: request.isWaiting ?? undefined,
    delegator: personOrNull(request.delegatorId, request.delegatorName),
  }
}

/**
 * Leaves out empty values so equal filters share one cache entry, and puts a
 * list's `filters` into the query beside the other parameters.
 */
export function compactQuery(params: object): Record<string, string | number | boolean> {
  const { filters, ...rest } = params as {
    filters?: Record<string, string | undefined> | undefined
    [key: string]: unknown
  }
  return Object.fromEntries(
    Object.entries({ ...rest, ...filters }).filter(
      (entry): entry is [string, string | number | boolean] =>
        entry[1] !== undefined && entry[1] !== null && entry[1] !== '',
    ),
  )
}
