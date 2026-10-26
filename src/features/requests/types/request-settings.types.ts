// --- request types the settings speak about ----------------------------------------------------

/**
 * Every request type the Settings pages offer: the API's request type codes
 * (`GET /requests/types`), in the Requests menu's order. Restrictions,
 * delegations, flows and authorities are kept per type code.
 */
export const SETTINGS_REQUEST_TYPES = [
  'punch',
  'shift_swap',
  'expense',
  'leave',
  'loan',
  'official_visit',
  'overtime',
  'promotion',
  'relaxation',
  'transfer',
  'travel',
  'air_ticket',
  'requisition',
  'resignation',
  'work_from_home',
  'rest_day',
] as const
export type SettingsRequestType = (typeof SETTINGS_REQUEST_TYPES)[number]

/** A flow is set for a request type or for its cancellation ("Punch Cancel Request"). */
export type FlowRequestType = SettingsRequestType | `${SettingsRequestType}-cancel`

// --- Request Restriction (`/requests/settings/restrictions`) -----------------------------------

/** A request type closed for the company between two dates (`RestrictionOut`). */
export interface RequestRestriction {
  id: string
  companyName: string
  requestType: SettingsRequestType
  requestTypeName: string
  startDate: string
  endDate: string
  description: string | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** `RestrictionIn`: the start date must be in the future; no overlap with the type's others. */
export interface RequestRestrictionInput {
  requestType: SettingsRequestType
  startDate: string
  endDate: string
  description: string | null
  /** Required on edit (`PUT`). */
  rowVersion?: string
}

// --- Delegation (`/requests/settings/delegations`) ---------------------------------------------

/** The delegatee decides the delegator's steps of one request type while it is active (`DelegationOut`). */
export interface RequestDelegation {
  id: string
  delegatorId: string
  delegatorName: string | null
  delegateeId: string
  delegateeName: string | null
  requestType: SettingsRequestType
  requestTypeName: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** `DelegationIn`. No start / end dates (Open Question D6). */
export interface RequestDelegationInput {
  delegatorId: string
  delegateeId: string
  requestType: SettingsRequestType
  description: string | null
  isActive: boolean
}

/** `PATCH`: Disable / Enable, and the description. */
export interface RequestDelegationPatch {
  isActive: boolean
  description: string | null
  rowVersion: string
}

// --- Request Flows (`/requests/settings/flows`) ------------------------------------------------

/** Approvers the organisation gives (structural) — the rest are held through Authorities. */
export const FLOW_STRUCTURAL_KINDS = [
  'line_manager',
  'hod',
  'branch_manager',
  'final_authority',
  'employee',
  'role',
] as const

/** Authorities someone holds under Request Settings → Authorities. */
export const FLOW_AUTHORITIES = [
  'team_lead',
  'hr_manager',
  'operations_manager',
  'finance_manager',
  'director',
  'compliance_officer',
  'project_manager',
  'admin_supervisor',
  'it_administrator',
  'area_manager',
  'admin_manager',
] as const
export type FlowAuthority = (typeof FLOW_AUTHORITIES)[number]

/** "Node": who decides at a step (`approverKind`). */
export const FLOW_NODE_TYPES = [...FLOW_STRUCTURAL_KINDS, ...FLOW_AUTHORITIES] as const
export type FlowNodeType = (typeof FLOW_NODE_TYPES)[number]

export type FlowPurpose = 'request' | 'cancellation'
export const FLOW_SCOPES = ['company', 'branch', 'department', 'employee'] as const
export type FlowScope = (typeof FLOW_SCOPES)[number]

/**
 * One node of a flow (`FlowNodeIn`). Next / If True / If False name another
 * node's `stepNo`; empty means the next node by number (the last ends the flow).
 */
export interface FlowNode {
  stepNo: number
  /** Null on a condition node. */
  approverKind: FlowNodeType | null
  /** An Employee node's person. */
  employeeId: string | null
  /** A Role node's role. */
  roleId: string | null
  isCondition: boolean
  /** `<field> <op> <number>`: fields days, amount, minutes, department_id, branch_id, location_id, grade_id, designation_id, employment_type_id. */
  expression: string | null
  next: number | null
  ifTrue: number | null
  ifFalse: number | null
  canEdit: boolean
  /** A consent step: agree or disagree, the flow goes on. */
  canDisagree: boolean
  /** "On Looker": told, does not decide. */
  isObserver: boolean
}

/** A node as the API returns it (`FlowNodeOut`). */
export interface FlowNodeRow extends FlowNode {
  id: string
  employeeName: string | null
  roleName: string | null
}

/** A flow in the list (`FlowOut`). */
export interface RequestFlow {
  id: string
  requestType: SettingsRequestType
  requestTypeName: string
  purpose: FlowPurpose
  name: string
  scopeType: FlowScope
  scopeId: string | null
  scopeName: string | null
  description: string | null
  isActive: boolean
  nodeCount: number
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** A flow with its nodes (`FlowDetailOut`). */
export interface RequestFlowDetail extends RequestFlow {
  nodes: FlowNodeRow[]
}

/** `FlowIn`. Saving an existing flow stores a new version (a new id); requests on the way keep theirs. */
export interface RequestFlowInput {
  requestType: SettingsRequestType
  purpose: FlowPurpose
  name: string
  scopeType: FlowScope
  scopeId: string | null
  description: string | null
  isActive: boolean
  nodes: FlowNode[]
  rowVersion?: string | undefined
}

// --- Authorities (`/requests/settings/authorities`) --------------------------------------------

/** Who holds an authority (HR Manager, Finance Manager …), for a type / branch / department or all. */
export interface RequestAuthority {
  id: string
  authority: FlowAuthority
  employeeId: string
  employeeName: string | null
  employeeCode: string
  designationName: string | null
  employeeBranchName: string | null
  requestType: SettingsRequestType | null
  requestTypeName: string | null
  branchId: string | null
  branchName: string | null
  departmentId: string | null
  departmentName: string | null
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** `AuthorityIn`; empty type / branch / department: every one. */
export interface RequestAuthorityInput {
  authority: FlowAuthority
  employeeId: string
  requestType: SettingsRequestType | null
  branchId: string | null
  departmentId: string | null
  description: string | null
  isActive: boolean
  rowVersion?: string | undefined
}
