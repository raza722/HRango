import type {
  FlowAuthority,
  FlowNodeType,
  FlowPurpose,
  FlowRequestType,
  FlowScope,
  SettingsRequestType,
} from './types/request-settings.types'
import { SETTINGS_REQUEST_TYPES } from './types/request-settings.types'

/** "Punch Request", "Work From Home Request"… as the design's drop-downs write them. */
export const SETTINGS_REQUEST_TYPE_LABELS: Record<SettingsRequestType, string> = {
  punch: 'Punch Request',
  shift_swap: 'Shift Request',
  expense: 'Expense Request',
  leave: 'Leave Request',
  loan: 'Loan & Advance Request',
  official_visit: 'Official Visit Request',
  overtime: 'Overtime Request',
  promotion: 'Promotion Request',
  relaxation: 'Relaxation Request',
  transfer: 'Transfer Request',
  travel: 'Travel Request',
  air_ticket: 'Air Ticket Request',
  requisition: 'Requisition Request',
  resignation: 'Resignation Request',
  work_from_home: 'Work From Home Request',
  rest_day: 'Rest Day Request',
}

/** "Punch Cancel Request" for a cancellation flow. */
export function flowRequestTypeLabel(type: FlowRequestType): string {
  if (type.endsWith('-cancel')) {
    const base = type.slice(0, -'-cancel'.length) as SettingsRequestType
    return SETTINGS_REQUEST_TYPE_LABELS[base].replace(/ Request$/, ' Cancel Request')
  }
  return SETTINGS_REQUEST_TYPE_LABELS[type as SettingsRequestType]
}

/** `leave-cancel` → the API's `{ requestType: 'leave', purpose: 'cancellation' }`. */
export function splitFlowType(type: FlowRequestType): {
  requestType: SettingsRequestType
  purpose: FlowPurpose
} {
  return type.endsWith('-cancel')
    ? {
        requestType: type.slice(0, -'-cancel'.length) as SettingsRequestType,
        purpose: 'cancellation',
      }
    : { requestType: type as SettingsRequestType, purpose: 'request' }
}

/** The other way: a flow's type and purpose as the page's Request Type. */
export function joinFlowType(
  requestType: SettingsRequestType,
  purpose: FlowPurpose,
): FlowRequestType {
  return purpose === 'cancellation' ? `${requestType}-cancel` : requestType
}

/** Request Flow's "Request Type": each type followed by its cancellation, as drawn. */
export const FLOW_REQUEST_TYPES: readonly FlowRequestType[] = SETTINGS_REQUEST_TYPES.flatMap(
  (type): FlowRequestType[] => [type, `${type}-cancel`],
)

/** Authorities held under Request Settings → Authorities. */
export const FLOW_AUTHORITY_LABELS: Record<FlowAuthority, string> = {
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

/** "Node": who decides at a step (the API's `approverKind`). */
export const FLOW_NODE_LABELS: Record<FlowNodeType, string> = {
  line_manager: 'Line Manager',
  hod: 'HOD',
  branch_manager: 'Branch Manager',
  final_authority: 'Final Authority',
  employee: 'Employee',
  role: 'Role',
  ...FLOW_AUTHORITY_LABELS,
}

/** Who a flow is for; the most specific active one applies. */
export const FLOW_SCOPE_LABELS: Record<FlowScope, string> = {
  company: 'Company',
  branch: 'Branch',
  department: 'Department',
  employee: 'Employee',
}

/** Delegations' Active chip, as drawn: green Active, red In Active. */
export const DELEGATION_STATUS_META = {
  active: { label: 'Active', className: 'bg-[#E3F8E8] text-[#2CBD4D]' },
  inactive: { label: 'In Active', className: 'bg-[#FFE1E7] text-[#E50141]' },
} as const

/** The maroon of the design's "In Active" / "Unapproved" buttons. */
export const MAROON_BUTTON = 'bg-[#7B254A] text-white hover:bg-[#7B254A]/90'

export const SETTINGS_PAGE_SIZE = 10
