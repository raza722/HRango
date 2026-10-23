import type { Paginated } from '@/types/api'

/** Request types built so far (the sub menu lists the rest as coming). */
export const REQUEST_KINDS = ['punch', 'shift', 'transfer'] as const
export type RequestKind = (typeof REQUEST_KINDS)[number]

/** Status of a request, as in the design's "All Requests" dropdown. */
export const REQUEST_STATUSES = [
  'pending',
  'completed',
  'rejected',
  'cancelling',
  'cancelled',
] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]
export type RequestStatusFilter = RequestStatus | 'all'

export const REQUEST_TABS = ['request', 'approvals'] as const
export type RequestTab = (typeof REQUEST_TABS)[number]

export const REQUEST_SCOPES = ['my', 'all'] as const
export type RequestScope = (typeof REQUEST_SCOPES)[number]

/** Approvals → Requested (yours), Delegates (passed to you), Consents (your say asked). */
export const APPROVAL_VIEWS = ['requested', 'delegates', 'consents'] as const
export type ApprovalView = (typeof APPROVAL_VIEWS)[number]

export const PUNCH_REQUEST_TYPES = ['check-in', 'check-out', 'missing-punch'] as const
export type PunchRequestType = (typeof PUNCH_REQUEST_TYPES)[number]

/** What the signed-in person may do with a request (decided by the server). */
export const REQUEST_ACTIONS = [
  'view',
  'edit',
  'delete',
  'flow',
  'history',
  'cancel',
  'decide',
  'consent',
] as const
export type RequestAction = (typeof REQUEST_ACTIONS)[number]

export interface PersonRef {
  id: string
  name: string
  code: string
}

/** The person card of the View / Approve popups. */
export interface RequestEmployee extends PersonRef {
  department: string
  designation: string
  company: string | null
  branch: string | null
  location: string | null
  joiningDate: string
  photoUrl: string | null
}

export type FlowStepStatus = 'waiting' | 'pending' | 'approved' | 'rejected' | 'skipped'

/** One approver in the request's flow (Line Manager, then HR Manager). */
export interface FlowStep {
  authority: string
  approver: PersonRef
  status: FlowStepStatus
  /** Who acted, when a delegate acted for the approver. */
  actedBy: PersonRef | null
  actedAt: string | null
  remarks: string | null
}

export interface ConsentEntry {
  person: PersonRef
  status: 'pending' | 'given' | 'declined'
  remarks: string | null
}

export interface RequestHistoryEntry {
  id: string
  by: PersonRef
  /** True when a delegate acted for the approver. */
  delegate: boolean
  /** "Approved by Line Manager", "Cancellation requested"… */
  status: string
  remarks: string | null
  at: string
}

export interface PunchPayload {
  date: string
  expectedIn: string | null
  expectedOut: string | null
  punchType: PunchRequestType
  punchTime: string
  description: string
}

export interface ShiftPayload {
  date: string
  /** The time roster asked for; null when swapping with a colleague. */
  rosterGroupId: string | null
  rosterTitle: string | null
  /** The shift the person has that day ("Swap From"). */
  swapFrom: string | null
  /** The colleague to swap with ("Swap To"). */
  swapWith: PersonRef | null
  /** The colleague's shift that day, when swapping. */
  swapToShift: string | null
  description: string
}

interface RequestBase {
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
  /** The flow step waiting for a decision, if any. */
  currentStep: FlowStep | null
  actions: RequestAction[]
}

export interface PunchRequest extends RequestBase {
  kind: 'punch'
  payload: PunchPayload
}

export interface ShiftRequest extends RequestBase {
  kind: 'shift'
  payload: ShiftPayload
}

export interface NamedRef {
  id: string
  name: string
}

/** A transfer: where the person moves, from when, and who they will report to. */
export interface TransferPayload {
  location: NamedRef
  branch: NamedRef
  department: string
  /** Where the person worked when they asked. */
  current: { location: string | null; branch: string | null; department: string }
  lineManager: PersonRef
  finalAuthority: PersonRef
  effectiveDate: string
  attachmentName: string | null
  description: string
  /** The application letter, as simple HTML from the editor. */
  application: string
}

export interface TransferRequest extends RequestBase {
  kind: 'transfer'
  payload: TransferPayload
}

export type AnyRequest = PunchRequest | ShiftRequest | TransferRequest

export interface RequestKindMap {
  punch: PunchRequest
  shift: ShiftRequest
  transfer: TransferRequest
}

export type RequestCounts = Record<RequestStatusFilter, number>

export interface RequestPage<T> extends Paginated<T> {
  counts: RequestCounts
}

export interface RequestDetail<T> {
  request: T
  history: RequestHistoryEntry[]
}

export interface RequestListParams {
  scope: RequestScope
  status?: RequestStatus
  page: number
  pageSize: number
  /** The Filters dialog's values (Punch), sent as query parameters. */
  filters?: Record<string, string | undefined>
}

export interface ApprovalListParams {
  view: ApprovalView
  status?: RequestStatus
  page: number
  pageSize: number
  filters?: Record<string, string | undefined>
}

export interface PunchRequestInput {
  /** Omitted: the signed-in person. */
  employeeId?: string
  date: string
  punchType: PunchRequestType
  punchTime: string
  description: string
}

export interface ShiftRequestInput {
  employeeId?: string
  date: string
  rosterGroupId: string | null
  swapWithId: string | null
  description: string
}

export interface TransferRequestInput {
  employeeId?: string
  locationId: string
  branchId: string
  department: string
  lineManagerId: string
  finalAuthorityId: string
  effectiveDate: string
  attachmentName: string | null
  description: string
  application: string
}

export interface RequestInputMap {
  punch: PunchRequestInput
  shift: ShiftRequestInput
  transfer: TransferRequestInput
}

/**
 * The Transfer lists' Filters: the request's employee, new location, branch,
 * department and effective date; Delegates adds employment status, the
 * delegator, the next requestee and an effective-date range.
 */
export interface TransferFilters {
  employeeId?: string | undefined
  locationId?: string | undefined
  branchId?: string | undefined
  department?: string | undefined
  effectiveDate?: string | undefined
  employmentStatus?: string | undefined
  delegatorId?: string | undefined
  nextRequesteeId?: string | undefined
  from?: string | undefined
  to?: string | undefined
}

/** A person on the Transfer form, with where they work now. */
export interface TransferPerson extends PersonRef {
  department: string
  designation: string
  locationId: string | null
  branchId: string | null
  active: boolean
}

export interface TransferLookups {
  employees: TransferPerson[]
  locations: NamedRef[]
  branches: (NamedRef & { locationId: string })[]
  departments: string[]
  /** People whose approvals are passed on to the signed-in person. */
  delegators: PersonRef[]
}

export interface DecisionInput {
  decision: 'approve' | 'reject'
  remarks: string
}

/** The person's day for a request form: shift times, or the shift to swap. */
export interface DayShift {
  date: string
  slotName: string | null
  rosterGroupId: string | null
  clockIn: string | null
  clockOut: string | null
  /** Colleagues who work a different shift that day (Swap To options). */
  colleagues: { person: PersonRef; shift: string }[]
}

export interface RequestLookups {
  employees: (PersonRef & { department: string })[]
  rosters: { id: string; title: string }[]
}
