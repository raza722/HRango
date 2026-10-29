import { useAuthStore } from '@/stores/auth-store'

import type {
  AccountCategory,
  BenefitType,
  CalculationType,
  EncashmentBasis,
  EncashmentType,
  FinalSettlementStatus,
  IncentiveType,
  InfoType,
  PayItemType,
  PaymentMethod,
  PayrollSettings,
  PayrollStatus,
  PayslipStatus,
  PayslipTemplate,
  ProcessingMode,
  ReportRounding,
  RoundingOption,
  SurchargeRate,
  TaxDistribution,
  ValueType,
  VoucherLineType,
  VoucherStatus,
} from './types/payroll.types'

// Labels for the API's values (snake_case, as `backend/app/schemas/payroll_*.py` names them).

export const PAY_ITEM_TYPE_LABELS: Record<PayItemType, string> = {
  earning: 'Earning',
  deduction: 'Deduction',
  reimbursement: 'Reimbursement',
  employee_data: 'Employee Data',
  other: 'Other',
}

export const CALCULATION_TYPE_LABELS: Record<CalculationType, string> = {
  fixed: 'Fixed',
  manual: 'Manual Entry',
  formula: 'Formula',
}

export const TAX_DISTRIBUTION_LABELS: Record<TaxDistribution, string> = {
  current_month: 'Current Month',
  remaining_months: 'Divided in Remaining Month',
}

export const ACCOUNT_CATEGORY_LABELS: Record<AccountCategory, string> = {
  benefit: 'Benefit',
  leave_quota: 'Leave Quotas',
  custom_pay_item: 'Custom Pay Item',
}

export const BENEFIT_TYPE_LABELS: Record<BenefitType, string> = {
  allowance: 'Allowance',
  bonus: 'Bonus',
  reward: 'Reward',
  other: 'Other',
}

export const INCENTIVE_TYPE_LABELS: Record<IncentiveType, string> = {
  reimbursement: 'Reimbursement',
  part_of_salary: 'Part of Salary',
}

export const VALUE_TYPE_LABELS: Record<ValueType, string> = {
  percentage: 'Percentage',
  flat: 'Flat',
}

export const SURCHARGE_RATE_LABELS: Record<SurchargeRate, string> = {
  flat: 'Flat',
  percentage: 'Percentage',
}

export const INFO_TYPE_LABELS: Record<InfoType, string> = {
  string: 'String',
  number: 'Number',
  date: 'Date',
  boolean: 'Boolean',
}

export const ROUNDING_LABELS: Record<RoundingOption, string> = {
  floor: 'Floor',
  ceil: 'Ceil',
  round: 'Round',
  actual: 'As per Actual',
}

export const REPORT_ROUNDING_LABELS: Record<ReportRounding, string> = {
  none: 'None',
  round_off: 'Round Off',
  ceil: 'Ceil',
  floor: 'Floor',
}

export const PAYSLIP_TEMPLATE_LABELS: Record<PayslipTemplate, string> = {
  default: 'Default template',
  template_1: 'Template 1',
  template_2: 'Template 2',
  template_3: 'Template 3',
}

export const PROCESSING_MODE_LABELS: Record<ProcessingMode, string> = {
  from_date: 'From Date',
  month_end: 'Month End',
}

type ConfigControl =
  | { kind: 'checkbox' }
  | { kind: 'select'; options: readonly string[]; labels: Record<string, string> }
  | { kind: 'text' }
  | { kind: 'number'; min: number; max: number }
  /** A month and day every year (`MM-DD`). */
  | { kind: 'monthDay' }
  /** A `#RRGGBB` colour. */
  | { kind: 'color' }

/** Keys of the general settings that are payroll options (the rest is leave configuration). */
export type PayrollConfigurationKey = Exclude<
  keyof PayrollSettings,
  | 'rowVersion'
  | 'cplLeaveTypeId'
  | 'maxEarnedCpl'
  | 'deductCasualLeaves'
  | 'deductSickLeaves'
  | 'leaveYearBasis'
  | 'fiscalYearStartMonth'
  | 'fiscalYearEndMonth'
>

/**
 * "Payroll Configurations", numbered and worded as in the design, one row per API key.
 * Keys that only make sense with another (the revision date, the cut-off day, the notes) sit
 * right after it.
 */
export const CONFIGURATION_ITEMS: readonly {
  key: PayrollConfigurationKey
  label: string
  control: ConfigControl
}[] = [
  {
    key: 'excludeFinalSettlement',
    label: 'Exclude Final Settlement from Payroll',
    control: { kind: 'checkbox' },
  },
  {
    key: 'disableTaxDistributionOnFinalSettlement',
    label: 'Disable Tax Distribution on Final Settlement',
    control: { kind: 'checkbox' },
  },
  {
    key: 'hidePayslipAfterRun',
    label: 'Do Not Display Payslip After Run',
    control: { kind: 'checkbox' },
  },
  {
    key: 'salaryReportRounding',
    label: 'Salary Report Rounding',
    control: {
      kind: 'select',
      options: ['none', 'round_off', 'ceil', 'floor'],
      labels: REPORT_ROUNDING_LABELS,
    },
  },
  {
    key: 'revisionOnFixedDays',
    label: 'Apply Salary Revision on Fixed Days',
    control: { kind: 'checkbox' },
  },
  {
    key: 'revisionFixedDate',
    label: 'Fixed Revision Date (MM-DD)',
    control: { kind: 'monthDay' },
  },
  {
    key: 'revisionOnShiftDays',
    label: 'Apply Salary Revision Based on Shift Days',
    control: { kind: 'checkbox' },
  },
  {
    key: 'revisionShiftDays',
    label: 'Shift Days for Revision',
    control: { kind: 'number', min: 1, max: 3650 },
  },
  {
    key: 'disableRevisionEmail',
    label: 'Disable Email Notification for Salary Revision',
    control: { kind: 'checkbox' },
  },
  {
    key: 'cutoffProration',
    label: 'Apply Cut-Off Dates for Proration',
    control: { kind: 'checkbox' },
  },
  { key: 'cutoffDay', label: 'Cut-Off Day', control: { kind: 'number', min: 1, max: 28 } },
  {
    key: 'hideAttendanceSummary',
    label: 'Do Not Display Attendance Summary in Payslip',
    control: { kind: 'checkbox' },
  },
  {
    key: 'showSalaryBreakdown',
    label: 'Show Salary Breakdown on Pay slip',
    control: { kind: 'checkbox' },
  },
  { key: 'payslipColor', label: 'Main Color for Payslip', control: { kind: 'color' } },
  {
    key: 'taxRounding',
    label: 'Round Off Tax Amount in Payroll',
    control: {
      kind: 'select',
      options: ['floor', 'ceil', 'round', 'actual'],
      labels: ROUNDING_LABELS,
    },
  },
  {
    key: 'taxPositiveOnly',
    label: 'Display Tax Only for Positive Amounts',
    control: { kind: 'checkbox' },
  },
  {
    key: 'notesEnglishEnabled',
    label: 'Display Notes in English',
    control: { kind: 'checkbox' },
  },
  { key: 'notesEnglish', label: 'Notes in English', control: { kind: 'text' } },
  {
    key: 'notesOtherLanguage',
    label: 'Display Notes In Other Language',
    control: { kind: 'text' },
  },
  {
    key: 'printSignature',
    label: 'Print Signature on Salary Sheet',
    control: { kind: 'checkbox' },
  },
  {
    key: 'sendCloseEmail',
    label: 'Send Payroll Close Email to All Employees',
    control: { kind: 'checkbox' },
  },
  {
    key: 'payslipTemplate',
    label: 'Choose Payslip Template',
    control: {
      kind: 'select',
      options: ['default', 'template_1', 'template_2', 'template_3'],
      labels: PAYSLIP_TEMPLATE_LABELS,
    },
  },
  {
    key: 'prorationRounding',
    label: 'How to Prorate Monthly?',
    control: {
      kind: 'select',
      options: ['floor', 'ceil', 'round', 'actual'],
      labels: ROUNDING_LABELS,
    },
  },
  {
    key: 'showOnHoldAmounts',
    label: 'Show On Hold Amounts on Salary Sheet',
    control: { kind: 'checkbox' },
  },
  {
    key: 'useShiftHours',
    label: 'Use Shift Hours for Policy Calculations',
    control: { kind: 'checkbox' },
  },
  {
    key: 'showEmployeePayItems',
    label: 'Display Employee Pay Items on Payslip',
    control: { kind: 'checkbox' },
  },
]

/** Status chips: colour classes as drawn (pale fill, coloured text). */
export const PAYROLL_STATUS_META: Record<PayrollStatus, { label: string; className: string }> = {
  open: { label: 'Pending', className: 'bg-muted text-field-foreground' },
  running: { label: 'Run', className: 'bg-[#E3F8E8] text-[#51B969]' },
  closed: { label: 'Closed', className: 'bg-[#DCE8FF] text-[#2975FB]' },
  on_hold: { label: 'On Hold', className: 'bg-[#FFE1E7] text-[#E50141]' },
}

export const PAYSLIP_STATUS_META: Record<PayslipStatus, { label: string; className: string }> = {
  ready: { label: 'Ready to Release', className: 'bg-[#DCE8FF] text-[#2975FB]' },
  released: { label: 'Released', className: 'bg-[#E3F8E8] text-[#51B969]' },
  on_hold: { label: 'On Hold', className: 'bg-[#FFE1E7] text-[#E50141]' },
}

/** A released final-settlement slip ("Released With FS" in the design). */
export const RELEASED_WITH_FS_META = {
  label: 'Released With FS',
  className: 'bg-[#E0F7F4] text-[#0F9F8F]',
}

export const FINAL_SETTLEMENT_STATUS_META: Record<
  FinalSettlementStatus,
  { label: string; className: string }
> = {
  pending: { label: 'Pending', className: 'bg-[#FFF1DE] text-[#FF8A1D]' },
  open: { label: 'Calculated', className: 'bg-[#DCE8FF] text-[#2975FB]' },
  closed: { label: 'Completed', className: 'bg-[#E3F8E8] text-[#51B969]' },
}

export const VOUCHER_TYPE_LABELS: Record<VoucherLineType, string> = {
  expense_reimbursement: 'Expense Reimbursement',
  salary_advance: 'Salary Advance',
  bonus: 'Bonus',
  travel_allowance: 'Travel Allowance',
  daily_wage: 'Daily Wages',
  leave_encashment: 'Leave Encashment',
}

export const ENCASHMENT_TYPE_LABELS: Record<EncashmentType, string> = {
  payroll: 'Payroll',
  manual: 'Manually',
}

/** Leave Encashment "Amount Per Leave", as drawn. */
export const ENCASHMENT_BASIS_LABELS: Record<EncashmentBasis, string> = {
  overtime: 'Overtime',
  earned_salary: 'Earned Salary',
  per_hour_rate: 'Per Hour Rate',
  overnight: 'Overnight',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  cheque: 'Cheque',
  pay_order: 'Pay Order',
}

export const VOUCHER_STATUS_LABELS: Record<VoucherStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  processed: 'Verified',
}

/** Separation reasons as Off-boarding sends them (free text on the API; known ones get a label). */
export const SEPARATION_REASON_LABELS: Record<string, string> = {
  resignation: 'Resignation',
  retirement: 'Retirement',
  termination: 'Termination',
  transfer: 'Transfer',
  other: 'Other',
}

/** Employment status filter (Active / In Active / All). */
export const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'In Active' },
  { value: 'all', label: 'All' },
] as const

/** The organisation using hRango (the signed-in user's company), for payslip headers. */
export function companyName(): string {
  return useAuthStore.getState().user?.companyName ?? ''
}

/** Permission codes the payroll screens check (`useCan`); the API enforces them anyway. */
export const PAYROLL_CODES = {
  dashboard: 'payroll.dashboard',
  general: 'payroll.settings.general',
  tax: 'payroll.settings.tax',
  rewards: 'payroll.settings.rewards',
  payComponents: 'payroll.settings.pay_components',
  accountTypes: 'payroll.settings.account_types',
  banks: 'payroll.settings.disbursement_banks',
  payrolls: 'payroll.payrolls',
  dailyWages: 'payroll.daily_wages',
  salarySheet: 'payroll.salary_sheet',
  payslips: 'payroll.payslips',
  vouchers: 'payroll.vouchers',
  finalSettlement: 'payroll.final_settlement',
  openingBalances: 'payroll.opening_balances',
  employeeAccounts: 'payroll.employee_accounts',
  salaryRevision: 'payroll.salary_revision',
  leaveEncashment: 'payroll.leave_encashment',
  reports: 'payroll.reports',
} as const
