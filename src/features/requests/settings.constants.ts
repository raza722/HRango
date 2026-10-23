import type {
  FlowAuthority,
  FlowNodeType,
  FlowRequestType,
  SettingsRequestType,
} from './types/request-settings.types'
import { SETTINGS_REQUEST_TYPES } from './types/request-settings.types'

/** "Punch Request", "Work From Home Request"… as the design's drop-downs write them. */
export const SETTINGS_REQUEST_TYPE_LABELS: Record<SettingsRequestType, string> = {
  punch: 'Punch Request',
  shift: 'Shift Request',
  expense: 'Expense Request',
  leave: 'Leave Request',
  lend: 'Lend Request',
  'official-duty': 'Official Duty Request',
  overtime: 'Overtime Request',
  promotion: 'Promotion Request',
  relaxation: 'Relaxation Request',
  transfer: 'Transfer Request',
  'benefit-withdrawal': 'Benefit Withdrawal Request',
  travel: 'Travel Request',
  requisition: 'Requisition Request',
  resignation: 'Resignation Request',
  'work-from-home': 'Work From Home Request',
  'rest-day': 'Rest Day Request',
}

/** "Punch Cancel Request" for a cancellation flow. */
export function flowRequestTypeLabel(type: FlowRequestType): string {
  if (type.endsWith('-cancel')) {
    const base = type.slice(0, -'-cancel'.length) as SettingsRequestType
    return SETTINGS_REQUEST_TYPE_LABELS[base].replace(/ Request$/, ' Cancel Request')
  }
  return SETTINGS_REQUEST_TYPE_LABELS[type as SettingsRequestType]
}

/** Request Flow's "Request Type": each type followed by its cancellation, as drawn. */
export const FLOW_REQUEST_TYPES: readonly FlowRequestType[] = SETTINGS_REQUEST_TYPES.flatMap(
  (type): FlowRequestType[] => [type, `${type}-cancel`],
)

export const FLOW_NODE_LABELS: Record<FlowNodeType, string> = {
  'line-manager': 'Line Manager',
  hod: 'HOD',
  'hod-finance': 'HOD Finance',
  'final-authority': 'Final Authority',
  'hod-hr-admin': 'HOD HR/Admin',
  'hod-hr': 'HOD HR',
  'hod-admin': 'HOD Admin',
  employee: 'Employee',
  consentee: 'Consentee',
  'branch-manager': 'Branch Manager',
  'area-manager': 'Area Manager',
}

export const FLOW_AUTHORITY_LABELS: Record<FlowAuthority, string> = {
  'general-flow': 'General Flow',
  'line-manager': 'Line Manager',
  hod: 'HOD',
  'final-authority': 'Final Authority',
  'branch-manager': 'Branch Manager',
  'area-manager': 'Area Manager',
  'retail-employee': 'Retail Employee',
}

/** Delegations' Active chip, as drawn: green Active, red In Active. */
export const DELEGATION_STATUS_META = {
  active: { label: 'Active', className: 'bg-[#E3F8E8] text-[#2CBD4D]' },
  inactive: { label: 'In Active', className: 'bg-[#FFE1E7] text-[#E50141]' },
} as const

/** The maroon of the design's "In Active" / "Unapproved" buttons. */
export const MAROON_BUTTON = 'bg-[#7B254A] text-white hover:bg-[#7B254A]/90'

export const SETTINGS_PAGE_SIZE = 10
