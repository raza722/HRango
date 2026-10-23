import type { ComponentType, ReactNode } from 'react'

import type { DataTableColumn } from '@/components/layout'
import type { FilterField } from '@/features/payroll'

import type {
  ConsentEntry,
  FlowStep,
  PersonRef,
  RequestAction,
  RequestEmployee,
  RequestStatus,
} from '../types/requests.types'

/**
 * The request types built on the shared "standard" pages (the design's newer
 * Requests frames, section 2697:5532). The kind is also the URL segment and the
 * API path: `/requests/<kind>`.
 */
export const STANDARD_KINDS = [
  'leave',
  'loan-advances',
  'work-from-home',
  'promotion',
  'relaxation',
  'rest-days',
  'travel',
  'resignation',
] as const
export type StandardKind = (typeof STANDARD_KINDS)[number]

export const isStandardKind = (value: string): value is StandardKind =>
  (STANDARD_KINDS as readonly string[]).includes(value)

/** Approvals → Requested (yours), Cancellations (cancellations to decide), Delegates. */
export const STANDARD_APPROVAL_VIEWS = ['requested', 'cancellations', 'delegates'] as const
export type StandardApprovalView = (typeof STANDARD_APPROVAL_VIEWS)[number]

/** A request of a standard type; `payload` is the type's own fields. */
export interface StandardRequest<P = Record<string, unknown>> {
  id: string
  code: string
  kind: StandardKind
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
  payload: P
}

/** The Filters dialog's values, sent as query parameters. */
export type StandardFilters = Record<string, string | undefined>

export interface StandardListParams {
  scope: 'my' | 'all'
  status?: RequestStatus | undefined
  page: number
  pageSize: number
  filters?: StandardFilters | undefined
}

export interface StandardApprovalParams {
  view: StandardApprovalView
  status?: RequestStatus | undefined
  page: number
  pageSize: number
  filters?: StandardFilters | undefined
}

/** A person on the forms and filters. */
export interface StandardPerson extends PersonRef {
  department: string
  designation: string
  active: boolean
}

/** Look-ups every standard type gets, plus the type's own (`extra`). */
export interface StandardLookups<X = Record<string, unknown>> {
  /** The signed-in person (My Requests forms start from them). */
  me: StandardPerson
  employees: StandardPerson[]
  departments: string[]
  /** People whose approvals of this type are passed to the signed-in person. */
  delegators: PersonRef[]
  extra: X
}

export interface StandardDecisionInput {
  decision: 'approve' | 'reject'
  remarks: string
  /** Fields the type adds to the Approve popup (Loan: approved amount, payment method…). */
  extras?: Record<string, unknown>
}

// --- what a type supplies to the shared pages ------------------------------------------------------

export type StandardTab = 'request' | 'approvals' | 'settings'

export interface StandardFormProps<P> {
  mode: 'create' | 'edit' | 'view'
  /** The list the dialog was opened from: All shows the employee picker. */
  scope: 'my' | 'all'
  request?: StandardRequest<P> | undefined
  onClose: () => void
}

export interface StandardDecisionFieldsProps<P> {
  request: StandardRequest<P>
  /** Read-only in View. */
  readOnly: boolean
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
  errors: Record<string, string>
}

export interface StandardFilterContext {
  tab: 'request' | 'approvals'
  scope: 'my' | 'all'
  view: StandardApprovalView
  lookups: StandardLookups | undefined
}

/**
 * One request type on the shared pages: its words, columns, filters and
 * popups. Everything else (tabs, pills, status tabs, bulk buttons, flow,
 * history, cancel, delete, the Approve popup's frame) is shared.
 */
export interface StandardKindConfig<P = Record<string, unknown>> {
  kind: StandardKind
  /** Sub menu and sidebar label ("Loan & Advances"). */
  label: string
  /** Popup titles: "<noun> Request Flow", "<noun> Approve/Reject" … ("Rest Days"). */
  noun: string
  /** Requests tab heading ("Rest Days Requests"). */
  requestsTitle: string
  /** Approvals tab heading ("Rest Days Approvals"). */
  approvalsTitle: string
  /** The My / All pill's words; leave out for a type with one list only. */
  scopeLabels?: { my: string; all: string }
  /** The Approvals pill, in the design's order. */
  approvalViews: readonly StandardApprovalView[]
  /** "All (8) Pending (2) …" over the list, where the frames draw it. */
  statusTabs: boolean
  /** Approved / Unapproved for ticked rows, where the frames draw them. */
  bulk: boolean
  /** A status' word where the type differs ("Completed" on Work From Home). */
  statusLabels?: Partial<Record<RequestStatus, string>>
  /** A third page tab, e.g. Loan & Advances → Settings. */
  settingsTab?: { label: string; Page: ComponentType }
  requestColumns: (scope: 'my' | 'all') => readonly DataTableColumn<StandardRequest<P>>[]
  approvalColumns: (view: StandardApprovalView) => readonly DataTableColumn<StandardRequest<P>>[]
  filterFields: (context: StandardFilterContext) => readonly FilterField[]
  /** Create / Edit / View. */
  FormDialog: ComponentType<StandardFormProps<P>>
  /** The request's fields in the View and Approve popups, under the employee card. */
  DetailRows: ComponentType<{ request: StandardRequest<P> }>
  /** Inputs the approver fills in (Loan & Advances). */
  DecisionFields?: ComponentType<StandardDecisionFieldsProps<P>>
  /** Approving needs a reason ("Reason for Approval *", Relaxation). */
  approveNeedsRemarks?: boolean
  /** Something above the list on the Requests tab (Leave's balance card). */
  ListHeader?: ComponentType<{ scope: 'my' | 'all' }>
  /** Shown above the table, when the type wants a sub-heading ("Request"). */
  listHeading?: ReactNode
}
