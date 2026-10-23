import type {
  AccountCategory,
  BenefitType,
  CalculationType,
  EncashmentBasis,
  InfoType,
  LeaveType,
  PayItemType,
  PaymentMethod,
  PayrollConfiguration,
  PayrollStatus,
  PayslipStatus,
  PayslipTemplate,
  ProrateOption,
  RoundingOption,
  SeparationReason,
  SurchargeRate,
  TaxDistribution,
  ValueType,
  VoucherLineType,
  VoucherStatus,
} from './types/payroll.types'

export const PAY_ITEM_TYPE_LABELS: Record<PayItemType, string> = {
  deduction: 'Deduction',
  earning: 'Earning',
  reimbursement: 'Reimbursement',
  'employee-data': 'Employee Data',
  other: 'Other',
}

export const CALCULATION_TYPE_LABELS: Record<CalculationType, string> = {
  fixed: 'Fixed',
  manual: 'Manual Entry',
}

export const TAX_DISTRIBUTION_LABELS: Record<TaxDistribution, string> = {
  'current-month': 'Current Month',
  'remaining-months': 'Divided in Remaining Month',
}

export const ACCOUNT_CATEGORY_LABELS: Record<AccountCategory, string> = {
  benefit: 'Benefit',
  'leave-quotas': 'Leave Quotas',
  'custom-pay-item': 'Custom Pay Item',
}

export const BENEFIT_TYPE_LABELS: Record<BenefitType, string> = {
  reimbursement: 'Reimbursement',
  'part-of-salary': 'Part of Salary',
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
  boolean: 'Boolean',
}

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  casual: 'Casual Leaves',
  sick: 'Sick Leaves',
}

export const ROUNDING_LABELS: Record<RoundingOption, string> = {
  none: 'None',
  'round-off': 'Round Off',
  ceil: 'Ceil',
  floor: 'Floor',
  round: 'Round',
  'as-per-actual': 'As per Actual',
}

export const PAYSLIP_TEMPLATE_LABELS: Record<PayslipTemplate, string> = {
  default: 'Default template',
  'template-1': 'Template 1',
  'template-2': 'Template 2',
  'template-3': 'Template 3',
}

export const PRORATE_LABELS: Record<ProrateOption, string> = {
  'calendar-days': 'Calendar Days',
  'working-days': 'Working Days',
  'fixed-30': 'Fixed 30 Days',
}

type ConfigControl =
  | { kind: 'checkbox' }
  | { kind: 'select'; options: readonly string[]; labels: Record<string, string> }
  | { kind: 'text' }

/** "Payroll Configurations", numbered and worded as in the design. */
export const CONFIGURATION_ITEMS: readonly {
  key: keyof PayrollConfiguration
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
    key: 'doNotDisplayPayslipAfterRun',
    label: 'Do Not Display Payslip After Run',
    control: {
      kind: 'select',
      options: ['none', 'round-off', 'ceil', 'floor'],
      labels: ROUNDING_LABELS,
    },
  },
  {
    key: 'applySalaryRevisionOnFixedDays',
    label: 'Apply Salary Revision on Fixed Days',
    control: { kind: 'checkbox' },
  },
  {
    key: 'applySalaryRevisionOnShiftDays',
    label: 'Apply Salary Revision Based on Shift Days',
    control: { kind: 'checkbox' },
  },
  {
    key: 'disableSalaryRevisionEmail',
    label: 'Disable Email Notification for Salary Revision',
    control: { kind: 'checkbox' },
  },
  {
    key: 'applyCutOffDatesForProration',
    label: 'Apply Cut-Off Dates for Proration',
    control: { kind: 'checkbox' },
  },
  {
    key: 'hideAttendanceSummaryInPayslip',
    label: 'Do Not Display Attendance Summary in Payslip',
    control: { kind: 'checkbox' },
  },
  {
    key: 'showSalaryBreakdownOnPayslip',
    label: 'Show Salary Breakdown on Pay slip',
    control: { kind: 'checkbox' },
  },
  { key: 'mainColorForPayslip', label: 'Main Color for Payslip', control: { kind: 'checkbox' } },
  {
    key: 'roundOffTaxAmount',
    label: 'Round Off Tax Amount in Payroll',
    control: {
      kind: 'select',
      options: ['floor', 'ceil', 'round', 'as-per-actual'],
      labels: ROUNDING_LABELS,
    },
  },
  {
    key: 'displayTaxOnlyForPositive',
    label: 'Display Tax Only for Positive Amounts',
    control: { kind: 'checkbox' },
  },
  { key: 'notesInEnglish', label: 'Display Notes in English', control: { kind: 'text' } },
  {
    key: 'notesInOtherLanguage',
    label: 'Display Notes In Other Language',
    control: { kind: 'text' },
  },
  {
    key: 'printSignatureOnSalarySheet',
    label: 'Print Signature on Salary Sheet',
    control: { kind: 'checkbox' },
  },
  {
    key: 'sendPayrollCloseEmail',
    label: 'Send Payroll Close Email to All Employees',
    control: { kind: 'checkbox' },
  },
  {
    key: 'payslipTemplate',
    label: 'Choose Payslip Template',
    control: {
      kind: 'select',
      options: ['default', 'template-1', 'template-2', 'template-3'],
      labels: PAYSLIP_TEMPLATE_LABELS,
    },
  },
  {
    key: 'prorateMonthly',
    label: 'How to Prorate Monthly?',
    control: {
      kind: 'select',
      options: ['calendar-days', 'working-days', 'fixed-30'],
      labels: PRORATE_LABELS,
    },
  },
  {
    key: 'showOnHoldOnSalarySheet',
    label: 'Show On Hold Amounts on Salary Sheet',
    control: { kind: 'checkbox' },
  },
  { key: 'prorateMonthlyByShift', label: 'How to Prorate Monthly?', control: { kind: 'checkbox' } },
  {
    key: 'useShiftHoursForPolicies',
    label: 'Use Shift Hours for Policy Calculations',
    control: { kind: 'checkbox' },
  },
  {
    key: 'displayEmployeePayItemsOnPayslip',
    label: 'Display Employee Pay Items on Payslip',
    control: { kind: 'checkbox' },
  },
]

/** Status chips: colour classes as drawn (pale fill, coloured text). */
export const PAYROLL_STATUS_META: Record<PayrollStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-muted text-field-foreground' },
  run: { label: 'Run', className: 'bg-[#E3F8E8] text-[#51B969]' },
  closed: { label: 'Closed', className: 'bg-[#DCE8FF] text-[#2975FB]' },
  'on-hold': { label: 'On Hold', className: 'bg-[#FFE1E7] text-[#E50141]' },
}

export const PAYSLIP_STATUS_META: Record<PayslipStatus, { label: string; className: string }> = {
  ready: { label: 'Ready to Release', className: 'bg-[#DCE8FF] text-[#2975FB]' },
  released: { label: 'Released', className: 'bg-[#E3F8E8] text-[#51B969]' },
  'on-hold': { label: 'On Hold', className: 'bg-[#FFE1E7] text-[#E50141]' },
  'released-fs': { label: 'Released With FS', className: 'bg-[#E0F7F4] text-[#0F9F8F]' },
}

export const FINAL_SETTLEMENT_STATUS_META = {
  pending: { label: 'Pending', className: 'bg-[#FFF1DE] text-[#FF8A1D]' },
  completed: { label: 'Completed', className: 'bg-[#E3F8E8] text-[#51B969]' },
} as const

export const VOUCHER_TYPE_LABELS: Record<VoucherLineType, string> = {
  'expense-reimbursement': 'Expense Reimbursement',
  'salary-advance': 'Salary Advance',
  bonus: 'Bonus',
  'travel-allowance': 'Travel Allowance',
  'daily-wages': 'Daily Wages',
  'leave-encashment': 'Leave Encashment',
}

/** Leave Encashment "Amount Per Leave", as drawn. */
export const ENCASHMENT_BASIS_LABELS: Record<EncashmentBasis, string> = {
  overtime: 'Overtime',
  'earned-salary': 'Earned Salary',
  'per-hour-rate': 'Per Hour Rate',
  overnight: 'Overnight',
}

/**
 * What one leave day is paid, as a multiple of the person's hourly rate (a
 * day's gross salary ÷ 8) times their shift hours. The design names the bases
 * but not the rates; these are the defaults (see the README).
 */
export const ENCASHMENT_BASIS_RATES: Record<
  EncashmentBasis,
  { perShiftHour: boolean; times: number }
> = {
  'earned-salary': { perShiftHour: false, times: 1 },
  'per-hour-rate': { perShiftHour: true, times: 1 },
  overtime: { perShiftHour: true, times: 1.5 },
  overnight: { perShiftHour: true, times: 2 },
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  'bank-transfer': 'Bank Transfer',
  cash: 'Cash',
  cheque: 'Cheque',
}

export const VOUCHER_STATUS_LABELS: Record<VoucherStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
}

export const SEPARATION_REASON_LABELS: Record<SeparationReason, string> = {
  resignation: 'Resignation',
  retirement: 'Retirement',
  termination: 'Termination',
  transfer: 'Transfer',
  other: 'Other',
}

/** Variables a pay item, formula or rule expression can use, in `{braces}`. */
export const FORMULA_VARIABLES = [
  ['gross_salary', 'Monthly gross salary'],
  ['applicable_days', 'Days the month is paid on (actual or fixed)'],
  ['worked_days', 'Days paid: applicable days less absences'],
  ['absent_days', 'Absent days'],
  ['leave_days', 'Leave days'],
  ['half_days', 'Half days'],
  ['short_days', 'Short days and short leaves'],
  ['late_days', 'Late arrivals'],
  ['late_minutes', 'Minutes late, all month'],
  ['early_left_days', 'Days left early'],
  ['missing_punch_days', 'Days with a missing punch'],
  ['overtime_minutes', 'Approved overtime minutes'],
  ['relaxation_days', 'Days relaxed'],
  ['penalty_count', 'Late / absent penalties from the warnings'],
  ['monthly_tax', 'Tax for the month from the tax structure'],
  ['annual_tax', 'Tax for the year from the tax structure'],
  ['leave_encashment', 'Leave encashment paid through this month’s payroll'],
] as const

/** Employment status filter (Active / In Active / All). */
export const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'In Active' },
  { value: 'all', label: 'All' },
] as const

export const COMPANY_NAME = 'Top Edge Technologies'
