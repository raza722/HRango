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

/**
 * Approvals → Requested (yours), Delegates (passed to you), Consents (your say
 * asked), Cancellations (cancellations of approved requests to decide). The API's `box`.
 */
export const APPROVAL_VIEWS = ['requested', 'delegates', 'consents', 'cancellations'] as const
export type ApprovalView = (typeof APPROVAL_VIEWS)[number]

/** The API's punch types (`req_punch.punch_type`). */
export const PUNCH_REQUEST_TYPES = ['check_in', 'check_out', 'break_out', 'break_in'] as const
export type PunchRequestType = (typeof PUNCH_REQUEST_TYPES)[number]

/**
 * What the signed-in person may do with a request. The API's detail lists them
 * (approve / reject read as `decide`, consent / disagree as `consent`); list rows
 * get them from the status and the tab (see `api/backend.ts`).
 */
export const REQUEST_ACTIONS = [
  'view',
  'edit',
  'delete',
  'flow',
  'history',
  'cancel',
  'decide',
  'consent',
  'forward',
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

/**
 * A step's state. The API records steps as the flow reaches them (`actionTaken`): pending,
 * approved, rejected, skipped, informed (an On Looker node), forwarded, consented, disagreed.
 * `waiting` is a step not reached yet (the mock API plans the whole flow).
 */
export type FlowStepStatus =
  | 'waiting'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'skipped'
  | 'informed'
  | 'forwarded'
  | 'consented'
  | 'disagreed'

/** One approver in the request's flow (Line Manager, then HR Manager). */
export interface FlowStep {
  authority: string
  approver: PersonRef
  status: FlowStepStatus
  /** Who acted, when a delegate acted for the approver. */
  actedBy: PersonRef | null
  actedAt: string | null
  remarks: string | null
  /** The request's own flow, or its cancellation's. */
  purpose?: 'request' | 'cancellation'
  /** A "Can Disagree" step: agree or disagree, and the flow goes on. */
  isConsent?: boolean
  /** A delegate acted for the approver. */
  isDelegate?: boolean
}

/** A file attached to a request: `url` is a signed link that expires (reopen for a fresh one). */
export interface RequestAttachment {
  /** The attachment row (DELETE /requests/<type>/<id>/attachments/<id>). */
  id: string
  fileId: string
  name: string
  mimeType: string | null
  sizeBytes: number | null
  label: string | null
  url: string
}

/** The fields every request has in the API, whatever its type. */
export interface RequestHeader {
  /** The API's request type code (`leave`, `shift_swap`). */
  requestType: string
  /** Sent back with edits, decisions, cancellations and deletes. */
  rowVersion: string
  fromDate: string | null
  toDate: string | null
  /** Counted days (leave, rest days, work from home). */
  days: number | null
  reason: string | null
  description: string | null
  /** The application letter (Transfer), as sent. */
  application: string | null
  submittedAt: string | null
  decidedAt: string | null
  /** Who must act now. */
  nextApprover: PersonRef | null
  finalAuthority: PersonRef | null
  /** Files; only the detail (View, Approve) carries them, lists give `[]`. */
  attachments: RequestAttachment[]
  /** Approvals lists: the request waits for the caller (or their delegator). */
  isWaiting?: boolean
  /** Approvals → Delegates: whose approval was passed on. */
  delegator?: PersonRef | null
  /**
   * The detail's own decision actions as the API lists them for the caller (`approve`,
   * `reject`, `consent`, `disagree`, `forward`); absent on list rows. The popups enable
   * each button only when its action is listed.
   */
  decisions?: readonly ('approve' | 'reject' | 'consent' | 'disagree' | 'forward')[]
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

/**
 * Punch: the API's `details` (`req_punch`). The reason and description are
 * the request's own (`RequestHeader`).
 */
export interface PunchPayload {
  punchDate: string | null
  punchType: PunchRequestType
  /** `HH:mm:ss` from the API. */
  punchTime: string
}

/**
 * Shift: either a new time slot for the day (`timeSlotId`) or a swap with a
 * colleague (`withEmployeeId`, who gives consent first). The API adds the
 * shift the person has that day and the colleague's.
 */
export interface ShiftPayload {
  shiftDate: string | null
  fromScheduleId?: string | null
  fromTimeSlotName?: string | null
  timeSlotId: string | null
  timeSlotName?: string | null
  withEmployeeId: string | null
  withEmployeeName?: string | null
  toScheduleId?: string | null
  toTimeSlotName?: string | null
}

interface RequestBase extends RequestHeader {
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

/**
 * A transfer (`req_transfer`): where the person moves, from when, and who they
 * will report to. The application letter and description are the request's own.
 */
export interface TransferPayload {
  locationId: string
  locationName: string | null
  branchId: string
  branchName: string | null
  departmentId: string
  departmentName: string | null
  lineManagerId: string
  lineManagerName: string | null
  finalAuthorityId: string
  finalAuthorityName: string | null
  effectiveDate: string | null
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

/**
 * The lists' filters the API reads: `q`, `employeeId`, `departmentId`,
 * `branchId`, `locationId`, `from`, `to` (and `delegatorId` on Approvals).
 */
export type RequestFilters = Record<string, string | undefined>

export interface RequestListParams {
  scope: RequestScope
  status?: RequestStatus | undefined
  page: number
  pageSize: number
  /** The Filters dialog's values, sent as query parameters. */
  filters?: RequestFilters | undefined
}

export interface ApprovalListParams {
  view: ApprovalView
  status?: RequestStatus | undefined
  page: number
  pageSize: number
  filters?: RequestFilters | undefined
}

/** The person's shift on a date (`GET /scheduling/schedules`), for the request forms. */
export interface DayShift {
  date: string
  /** The time slot's name ("RS Morning"); null when nothing is scheduled. */
  slotName: string | null
  timeSlotId: string | null
  /** `HH:mm`. */
  clockIn: string | null
  clockOut: string | null
  /** A rest day is scheduled. */
  restDay: boolean
}

/** A time slot to change a shift to (`GET /scheduling/options/time-slots`). */
export interface TimeSlotOption {
  id: string
  name: string
  code: string | null
  /** `HH:mm:ss`. */
  startTime: string | null
  endTime: string | null
}

/** A colleague who works that day, and their shift ("Swap To"). */
export interface SwapColleague {
  person: PersonRef
  shift: string | null
}

/**
 * `GET /requests/options/colleagues`: someone the requester may swap a shift with (the
 * company's current employees but the requester; held with `requests.shift_swap.create`).
 */
export interface ColleagueOption {
  id: string
  code: string | null
  name: string | null
  departmentId: string | null
  departmentName: string | null
  branchId: string | null
  branchName: string | null
}

/** The Transfer form's and filters' pickers. */
export interface TransferLookups {
  locations: NamedRef[]
  branches: (NamedRef & { locationId: string | null })[]
  departments: NamedRef[]
}

export interface DecisionInput {
  decision: 'approve' | 'reject'
  remarks: string
  rowVersion: string
}
