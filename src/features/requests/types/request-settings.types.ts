import type { PersonRef } from './requests.types'

// --- request types the settings speak about ----------------------------------------------------

/**
 * Every request type the Settings pages offer, in the design's order (Shift
 * Request is added after Punch: the app has it, the design's lists do not).
 */
export const SETTINGS_REQUEST_TYPES = [
  'punch',
  'shift',
  'expense',
  'leave',
  'lend',
  'official-duty',
  'overtime',
  'promotion',
  'relaxation',
  'transfer',
  'benefit-withdrawal',
  'travel',
  'requisition',
  'resignation',
  'work-from-home',
  // Not in the design's lists; added so Rest Days requests have a flow, delegations and restrictions.
  'rest-day',
] as const
export type SettingsRequestType = (typeof SETTINGS_REQUEST_TYPES)[number]

/** A flow is set for a request type or for its cancellation ("Punch Cancel Request"). */
export type FlowRequestType = SettingsRequestType | `${SettingsRequestType}-cancel`

// --- Request Restriction -----------------------------------------------------------------------

/** A request type closed for a company between two dates. */
export interface RequestRestriction {
  id: string
  companyId: string
  requestType: SettingsRequestType
  startDate: string
  endDate: string
  description: string
  createdAt: string
}
export type RequestRestrictionInput = Pick<
  RequestRestriction,
  'requestType' | 'startDate' | 'endDate' | 'description'
>
export interface RequestRestrictionRow extends RequestRestriction {
  company: string
}

// --- Delegation --------------------------------------------------------------------------------

/** The delegatee approves the delegator's requests of one type while it is active. */
export interface RequestDelegation {
  id: string
  delegatorId: string
  delegateeId: string
  requestType: SettingsRequestType
  description: string
  active: boolean
  createdAt: string
}
export type RequestDelegationInput = Pick<
  RequestDelegation,
  'delegatorId' | 'delegateeId' | 'requestType' | 'description'
>
export interface RequestDelegationRow extends RequestDelegation {
  delegator: PersonRef
  delegatee: PersonRef
}

// --- Request Flows -----------------------------------------------------------------------------

/** "Node": who a step goes to. */
export const FLOW_NODE_TYPES = [
  'line-manager',
  'hod',
  'hod-finance',
  'final-authority',
  'hod-hr-admin',
  'hod-hr',
  'hod-admin',
  'employee',
  'consentee',
  'branch-manager',
  'area-manager',
] as const
export type FlowNodeType = (typeof FLOW_NODE_TYPES)[number]

/** One row of "Request Flow Edit". */
export interface FlowNode {
  /** The node's number; Next / If True / If False point at these. */
  id: number
  canEdit: boolean
  /** Told about the request, does not decide. */
  onLooker: boolean
  /** Asked for consent rather than approval. */
  canDisagree: boolean
  isCondition: boolean
  node: FlowNodeType
  /** For an Employee or Consentee node. */
  employeeId: string | null
  next: number | null
  /** With Is Condition: e.g. `days > 3`. */
  expression: string
  ifTrue: number | null
  ifFalse: number | null
}

export interface RequestFlowDefinition {
  requestType: FlowRequestType
  name: string
  nodes: FlowNode[]
}

export interface FlowNodeRow extends FlowNode {
  employee: PersonRef | null
}

/** "Authority" on the Request Flow page: General Flow, or a chain of authorities. */
export const FLOW_AUTHORITIES = [
  'general-flow',
  'line-manager',
  'hod',
  'final-authority',
  'branch-manager',
  'area-manager',
  'retail-employee',
] as const
export type FlowAuthority = (typeof FLOW_AUTHORITIES)[number]

/** One row of the Request Flow table: a person and the authorities their requests go to. */
export interface FlowAssignmentRow {
  employee: PersonRef & { department: string }
  branch: string | null
  designation: string
  authorities: FlowAuthority[]
}

export interface FlowAssignmentInput {
  requestType: FlowRequestType
  employeeIds: string[]
  authorities: FlowAuthority[]
}

export interface RequestSettingsLookups {
  companies: { id: string; name: string }[]
  employees: (PersonRef & { department: string; branchId: string | null })[]
}
