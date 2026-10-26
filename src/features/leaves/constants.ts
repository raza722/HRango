import type {
  ApproveOnStatus,
  AttachmentRule,
  BalanceBasis,
  FinalApprovalBy,
  LeaveGenderRule,
  LeaveMaritalRule,
  LeaveStatus,
  LeaveTenure,
  LeaveTypeInput,
  PolicyKind,
  PolicyLevel,
  ShortLeaveType,
  ShortSlabValueType,
} from './types/leaves.types'

export const LEAVES_PAGE_SIZE = 10

/**
 * Status chips (Poppins Medium 10 in the status colour on a pale fill) and
 * the "All Requests ⌄" dropdown's words, as the frames draw them: the chip
 * of an approved leave reads "Approved", the dropdown "Completed".
 */
export const LEAVE_STATUS_META: Record<
  LeaveStatus,
  { label: string; menuLabel: string; className: string }
> = {
  pending: {
    label: 'Pending',
    menuLabel: 'Pending',
    className: 'bg-[#FFF3D9] text-[#EBA51E] dark:bg-amber-500/15 dark:text-amber-300',
  },
  approved: {
    label: 'Approved',
    menuLabel: 'Completed',
    className: 'bg-[#2CBD4D]/[0.18] text-[#51B969] dark:bg-green-500/15 dark:text-green-400',
  },
  rejected: {
    label: 'Rejected',
    menuLabel: 'Rejected',
    className: 'bg-[#FFE3E3] text-[#D83838] dark:bg-red-500/15 dark:text-red-300',
  },
  cancelling: {
    label: 'Cancelling',
    menuLabel: 'Cancelling',
    className: 'bg-[#FFEDE0] text-[#F87927] dark:bg-orange-500/15 dark:text-orange-300',
  },
  cancelled: {
    label: 'Cancelled',
    menuLabel: 'Cancelled',
    className: 'bg-[#EFE9FE] text-[#8B5CF6] dark:bg-violet-500/15 dark:text-violet-300',
  },
}

/** The design's Category column: derived from the dates (the backend keeps no category). */
export type LeaveCategory = 'single' | 'multiple'
export const CATEGORY_LABELS: Record<LeaveCategory, string> = {
  single: 'Single',
  multiple: 'Multiple',
}

export const SHORT_LEAVE_LABELS: Record<ShortLeaveType, string> = {
  half_day: 'Half Day',
  quarter_day: 'Quarter Day',
}

/** Leave Applications' tabs (My Leaves is its own page). */
export const LEAVE_TAB_LABELS = {
  all: 'All',
  subordinates: 'Subordinates',
} as const

export const FINAL_APPROVAL_LABELS: Record<FinalApprovalBy, string> = {
  hr_manager: 'HR Manager',
  line_manager: 'Line Manager',
  department_head: 'Head of Department',
}

export const APPROVE_ON_STATUS_LABELS: Record<ApproveOnStatus, string> = {
  approved: 'Approved',
  pending: 'Pending',
}

export const GENDER_RULE_LABELS: Record<LeaveGenderRule, string> = {
  any: 'All',
  male: 'Male',
  female: 'Female',
}

export const MARITAL_RULE_LABELS: Record<LeaveMaritalRule, string> = {
  any: 'Any',
  married: 'Married',
  single: 'Single',
}

export const TENURE_LABELS: Record<LeaveTenure, string> = {
  yearly: 'Yearly',
  monthly: 'Monthly',
  employment: 'Whole Employment',
}

export const BALANCE_BASIS_LABELS: Record<BalanceBasis, string> = {
  flat: 'Flat',
  experience: 'Experience',
}

export const ATTACHMENT_RULE_LABELS: Record<AttachmentRule, string> = {
  refuse: 'Refuse the application',
  note: 'Accept it and note the missing attachment',
}

export const SHORT_SLAB_VALUE_TYPE_LABELS: Record<ShortSlabValueType, string> = {
  percentage: 'Percentage',
  flat: 'Flat',
}

export const POLICY_LEVEL_LABELS: Record<PolicyLevel, string> = {
  company: 'Company Level Policy',
  employee: 'Employee Level Policy',
}

/** The boolean fields of a leave type, as the "Add Leave Types" frame lists them. */
export type LeaveTypeSwitch = {
  [K in keyof LeaveTypeInput]-?: LeaveTypeInput[K] extends boolean ? K : never
}[keyof LeaveTypeInput]

/**
 * The checkboxes of the "Add Leave Types" popup, in the frames' order (4428:90632
 * and 4428:90852). Pro Rated sits under Pre Condition, where the frame draws it.
 */
export const LEAVE_TYPE_SWITCHES: readonly { name: LeaveTypeSwitch; label: string }[] = [
  { name: 'isProbationType', label: 'Probation Leave Type' },
  { name: 'isActive', label: 'Is Active' },
  { name: 'autoAllotment', label: 'Auto Allotment' },
  { name: 'autoBalanceOnJoining', label: 'Auto Balance on Joining Month' },
  { name: 'isComposite', label: 'Composite' },
  { name: 'isShortLeave', label: 'Short Leave' },
  { name: 'showInPayslip', label: 'Show Remaining Leaves in Payslip' },
  { name: 'isDeductible', label: 'Deductible' },
  { name: 'isSandwich', label: 'Sandwich' },
  { name: 'sandwichAcrossTypes', label: 'Sandwich Across Leave Type' },
  { name: 'isEarned', label: 'Earned Balance' },
  { name: 'allowBackDate', label: 'Can Apply for Back Date' },
  { name: 'hasFutureLimit', label: 'Has Future Date Limit' },
  { name: 'attachmentRequired', label: 'Attachment Required' },
  { name: 'allowEncashment', label: 'Encashment' },
  { name: 'carryForward', label: 'Carry Forward' },
]

/** "Policy *" of Add Policy: the frame's two policies. */
export const POLICY_KIND_LABELS: Record<PolicyKind, string> = {
  distribution: 'Leave Distribution Policy',
  half_short: 'Half leave & Short leave',
}

/** Permission codes the Leaves screens check (backend/app/catalogue/leaves.py and requests.py). */
export const LEAVE_CODES = {
  applicationsView: 'leaves.applications.view',
  balancesView: 'leaves.balances.view',
  allotment: 'leaves.allotment.process',
  generalView: 'leaves.settings.general.view',
  generalEdit: 'leaves.settings.general.edit',
  typesView: 'leaves.settings.types.view',
  typesCreate: 'leaves.settings.types.create',
  typesEdit: 'leaves.settings.types.edit',
  typesDelete: 'leaves.settings.types.delete',
  policiesView: 'leaves.settings.policies.view',
  policiesCreate: 'leaves.settings.policies.create',
  policiesEdit: 'leaves.settings.policies.edit',
  policiesDelete: 'leaves.settings.policies.delete',
  policiesEnroll: 'leaves.settings.policies.enroll',
  apply: 'requests.leave.create',
  cancel: 'requests.leave.cancel',
  requestView: 'requests.leave.view',
  approve: 'requests.approvals.approve',
  reject: 'requests.approvals.reject',
} as const
