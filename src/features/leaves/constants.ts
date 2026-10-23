import type { RequestStatus } from '@/features/requests'

import type {
  ApproveOnStatus,
  AttachmentRule,
  BalanceBasis,
  FinalApprovalBy,
  LeaveCategory,
  LeaveGenderRule,
  LeaveMaritalRule,
  LeaveTenure,
  LeaveTypeInput,
  PolicyKind,
  PolicyLevel,
  ShortSlabUnit,
} from './types/leaves.types'

export const LEAVES_PAGE_SIZE = 10

/**
 * Status chips (Poppins Medium 10 in the status colour on a pale fill) and
 * the "All Requests ⌄" dropdown's words, as the frames draw them: the chip
 * of an approved leave reads "Approved", the dropdown "Completed".
 */
export const LEAVE_STATUS_META: Record<
  RequestStatus,
  { label: string; menuLabel: string; className: string }
> = {
  pending: {
    label: 'Pending',
    menuLabel: 'Pending',
    className: 'bg-[#FFF3D9] text-[#EBA51E] dark:bg-amber-500/15 dark:text-amber-300',
  },
  completed: {
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

export const CATEGORY_LABELS: Record<LeaveCategory, string> = {
  single: 'Single',
  multiple: 'Multiple',
}

export const FINAL_APPROVAL_LABELS: Record<FinalApprovalBy, string> = {
  'hr-manager': 'HR Manager',
  'line-manager': 'Line Manager',
  'department-head': 'Head of Department',
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

export const SHORT_UNIT_LABELS: Record<ShortSlabUnit, string> = {
  hours: 'Hours',
  minutes: 'Minutes',
}

export const POLICY_LEVEL_LABELS: Record<PolicyLevel, string> = {
  company: 'Company Level Policy',
  employee: 'Employee Level Policy',
}

/** The boolean fields of a leave type, as the "Add Leave Types" frame lists them. */
export type LeaveTypeSwitch = {
  [K in keyof LeaveTypeInput]: LeaveTypeInput[K] extends boolean ? K : never
}[keyof LeaveTypeInput]

/**
 * The checkboxes of the "Add Leave Types" popup, in the frames' order (4428:90632
 * and 4428:90852). Pro Rated sits under Pre Condition, where the frame draws it.
 */
export const LEAVE_TYPE_SWITCHES: readonly { name: LeaveTypeSwitch; label: string }[] = [
  { name: 'probationType', label: 'Probation Leave Type' },
  { name: 'active', label: 'Is Active' },
  { name: 'autoAllotment', label: 'Auto Allotment' },
  { name: 'autoBalanceOnJoiningMonth', label: 'Auto Balance on Joining Month' },
  { name: 'composite', label: 'Composite' },
  { name: 'shortLeave', label: 'Short Leave' },
  { name: 'showInPayslip', label: 'Show Remaining Leaves in Payslip' },
  { name: 'deductible', label: 'Deductible' },
  { name: 'sandwich', label: 'Sandwich' },
  { name: 'sandwichAcrossTypes', label: 'Sandwich Across Leave Type' },
  { name: 'earnedBalance', label: 'Earned Balance' },
  { name: 'backDate', label: 'Can Apply for Back Date' },
  { name: 'futureDateLimit', label: 'Has Future Date Limit' },
  { name: 'attachmentRequired', label: 'Attachment Required' },
  { name: 'encashment', label: 'Encashment' },
  { name: 'carryForward', label: 'Carry Forward' },
]

/** "Policy *" of Add Policy: the frame's two policies. */
export const POLICY_KIND_LABELS: Record<PolicyKind, string> = {
  distribution: 'Leave Distribution Policy',
  'half-short': 'Half leave & Short leave',
}
