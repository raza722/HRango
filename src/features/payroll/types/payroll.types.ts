// Payroll: settings (pay items, formulas, tax, rewards, accounts, banks), the
// monthly and daily-wage runs, pay slips, vouchers, balances, salary revision,
// final settlement and the report. Dates are `yyyy-MM-dd`, months `yyyy-MM`.

export interface EmployeeRef {
  id: string
  name: string
  code: string
  department: string
  designation: string
  photoUrl: string | null
}

/** The person card at the top of View / Edit dialogs. */
export interface EmployeeProfile extends EmployeeRef {
  location: string | null
  branch: string | null
  company: string | null
  joiningDate: string
}

export interface ChangeLogEntry {
  id: string
  field: string
  oldValue: string
  newValue: string
  action: 'Create' | 'Update' | 'Delete'
  performedAt: string
  performedBy: string
}

// --- Payroll Settings → Pay Components ---------------------------------------------------

export const PAY_ITEM_TYPES = [
  'deduction',
  'earning',
  'reimbursement',
  'employee-data',
  'other',
] as const
export type PayItemType = (typeof PAY_ITEM_TYPES)[number]

export const CALCULATION_TYPES = ['fixed', 'manual'] as const
export type CalculationType = (typeof CALCULATION_TYPES)[number]

export const TAX_DISTRIBUTIONS = ['current-month', 'remaining-months'] as const
export type TaxDistribution = (typeof TAX_DISTRIBUTIONS)[number]

export interface PayItem {
  id: string
  name: string
  label: string
  taxDistribution: TaxDistribution
  type: PayItemType
  calculationType: CalculationType
  /** `{gross_salary} / {applicable_days} * {absent_days}`; empty for manual entry. */
  expression: string
  /** Deductions: the employee's share comes from this formula. */
  employeeFormulaId: string | null
  employerContribution: boolean
  employerFormulaId: string | null
  displayOnly: boolean
  benefit: boolean
  eligibilityCriteria: boolean
  isAdvancePayment: boolean
  createdAt: string
}
export type PayItemInput = Omit<PayItem, 'id' | 'createdAt'>

export interface Formula {
  id: string
  name: string
  expression: string
  isSalaryDivision: boolean
  forIntegration: boolean
  isCustom: boolean
  description: string
}
export type FormulaInput = Omit<Formula, 'id'>

export interface PayRule {
  id: string
  name: string
  expression: string
  isCustom: boolean
}
export type PayRuleInput = Omit<PayRule, 'id'>

// --- Payroll Settings → Account Type, Disbursement Banks ---------------------------------

export const ACCOUNT_CATEGORIES = ['benefit', 'leave-quotas', 'custom-pay-item'] as const
export type AccountCategory = (typeof ACCOUNT_CATEGORIES)[number]

export interface AccountType {
  id: string
  category: AccountCategory
  /** Medical, Sick Leave, Provident Fund…; the category's name for a custom pay item. */
  name: string
}
export type AccountTypeInput = Omit<AccountType, 'id'>

export interface DisbursementBank {
  id: string
  accountHolder: string
  accountNumber: string
  bankName: string
  branchName: string
  branchCode: string
  branchLocation: string
  bankCode: string
  taxPayerId: string
  effectiveDate: string
}
export type DisbursementBankInput = Omit<DisbursementBank, 'id'>

// --- Payroll Settings → Tax ---------------------------------------------------------------

export const SURCHARGE_RATES = ['flat', 'percentage'] as const
export type SurchargeRate = (typeof SURCHARGE_RATES)[number]
export const SURCHARGE_CONDITIONS = ['>', '>=', '<', '<='] as const
export type SurchargeCondition = (typeof SURCHARGE_CONDITIONS)[number]

export interface TaxSlab {
  id: string
  min: number
  /** `null` = no upper limit. */
  max: number | null
  fixedAmount: number
  percentage: number
}

export interface TaxStructure {
  id: string
  code: string
  name: string
  startDate: string
  endDate: string
  surcharge: boolean
  /** "Apply {value} {rate} When Annual Tax is {condition} {amount}". */
  surchargeRule: {
    value: number
    rate: SurchargeRate
    condition: SurchargeCondition
    amount: number
  } | null
  description: string
  slabs: TaxSlab[]
}
export type TaxStructureInput = Omit<TaxStructure, 'id' | 'code'>

export interface TaxRebate {
  id: string
  employeeId: string
  date: string
  amount: number
  attachmentName: string | null
}
export type TaxRebateInput = Omit<TaxRebate, 'id'>
export interface TaxRebateRow extends TaxRebate {
  employee: EmployeeRef
}

// --- Payroll Settings → Rewards -----------------------------------------------------------

export const BENEFIT_TYPES = ['reimbursement', 'part-of-salary'] as const
export type BenefitType = (typeof BENEFIT_TYPES)[number]

export const INFO_TYPES = ['string', 'number', 'boolean'] as const
export type InfoType = (typeof INFO_TYPES)[number]

/** "Additional Information Create": a field the benefit asks for. */
export interface AdditionalInfo {
  id: string
  name: string
  type: InfoType
  required: boolean
  /** Number: min / max value; string: min / max length. */
  min: number | null
  max: number | null
}

export interface BenefitMember {
  id: string
  name: string
  formulaId: string | null
}

export interface Benefit {
  id: string
  code: string
  name: string
  type: BenefitType
  payItemId: string
  group: boolean
  accumulative: boolean
  description: string
  additionalInfo: AdditionalInfo[]
  members: BenefitMember[]
}
export type BenefitInput = Omit<Benefit, 'id' | 'code'>

export const VALUE_TYPES = ['percentage', 'flat'] as const
export type ValueType = (typeof VALUE_TYPES)[number]

/** "Sale Incentive Create": reach `amount` (the target) and earn `value`. */
export interface Incentive {
  id: string
  code: string
  branchId: string
  month: string
  incentiveType: BenefitType
  amount: number
  valueType: ValueType
  value: number
}
export type IncentiveInput = Omit<Incentive, 'id' | 'code'>
export interface IncentiveRow extends Incentive {
  branchName: string
}

// --- Payroll Settings → General -----------------------------------------------------------

export const ROUNDING_OPTIONS = [
  'none',
  'round-off',
  'ceil',
  'floor',
  'round',
  'as-per-actual',
] as const
export type RoundingOption = (typeof ROUNDING_OPTIONS)[number]
export const PAYSLIP_TEMPLATES = ['default', 'template-1', 'template-2', 'template-3'] as const
export type PayslipTemplate = (typeof PAYSLIP_TEMPLATES)[number]
export const PRORATE_OPTIONS = ['calendar-days', 'working-days', 'fixed-30'] as const
export type ProrateOption = (typeof PRORATE_OPTIONS)[number]

/** "Payroll Configurations": the 22 settings, in the design's order. */
export interface PayrollConfiguration {
  excludeFinalSettlement: boolean
  disableTaxDistributionOnFinalSettlement: boolean
  doNotDisplayPayslipAfterRun: RoundingOption | null
  applySalaryRevisionOnFixedDays: boolean
  applySalaryRevisionOnShiftDays: boolean
  disableSalaryRevisionEmail: boolean
  applyCutOffDatesForProration: boolean
  hideAttendanceSummaryInPayslip: boolean
  showSalaryBreakdownOnPayslip: boolean
  mainColorForPayslip: boolean
  roundOffTaxAmount: RoundingOption | null
  displayTaxOnlyForPositive: boolean
  notesInEnglish: string
  notesInOtherLanguage: string
  printSignatureOnSalarySheet: boolean
  sendPayrollCloseEmail: boolean
  payslipTemplate: PayslipTemplate | null
  prorateMonthly: ProrateOption | null
  showOnHoldOnSalarySheet: boolean
  prorateMonthlyByShift: boolean
  useShiftHoursForPolicies: boolean
  displayEmployeePayItemsOnPayslip: boolean
}

export const LEAVE_TYPES = ['casual', 'sick'] as const
export type LeaveType = (typeof LEAVE_TYPES)[number]

export interface LeaveConfiguration {
  cplLeaveType: LeaveType | null
  maximumEarnedCpl: number | null
  deductionOrder: Record<LeaveType, boolean>
  fiscalYear: 'calendar' | 'fiscal'
  /** 1–12. */
  yearStartMonth: number
  yearEndMonth: number
}

export interface PayrollSettings {
  configuration: PayrollConfiguration
  leave: LeaveConfiguration
}

// --- Payrolls → Monthly --------------------------------------------------------------------

export const PAYROLL_STATUSES = ['pending', 'run', 'closed', 'on-hold'] as const
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number]

export interface PayrollPayItemRow {
  payItemId: string
  taxable: boolean
  arrearApplicable: boolean
  finalSettlement: boolean
  calculateOnly: boolean
}

export interface PayrollHistoryEntry {
  id: string
  action: 'Created' | 'Run' | 'Closed' | 'On Hold' | 'Updated'
  month: string
  performedAt: string
  performedBy: string
}

export interface PayrollError {
  employeeId: string
  employeeName: string
  message: string
}

export interface Payroll {
  id: string
  code: string
  name: string
  currency: 'PKR'
  taxStructureId: string | null
  taxApplicable: boolean
  processing: 'from-date' | 'month-end'
  /** Day of the month the run is processed (1–31). */
  processingDay: number | null
  applicableDays: 'actual' | 'fixed'
  fixedDays: number | null
  companyBankId: string | null
  description: string
  payItems: PayrollPayItemRow[]
  employeeIds: string[]
  /** The month being processed. */
  month: string
  status: PayrollStatus
  lastRunAt: string | null
  lastClosedAt: string | null
  history: PayrollHistoryEntry[]
  errors: PayrollError[]
  createdAt: string
}

export type PayrollInput = Pick<
  Payroll,
  | 'name'
  | 'currency'
  | 'taxStructureId'
  | 'taxApplicable'
  | 'processing'
  | 'processingDay'
  | 'applicableDays'
  | 'fixedDays'
  | 'companyBankId'
  | 'description'
  | 'payItems'
>

export interface PayrollRow extends Payroll {
  taxStructureName: string | null
  employeeCount: number
}

export interface EmploymentRow {
  employee: EmployeeRef
  joiningDate: string
  branch: string | null
}

// --- Pay Slips -------------------------------------------------------------------------------

export const PAYSLIP_STATUSES = ['ready', 'released', 'on-hold', 'released-fs'] as const
export type PayslipStatus = (typeof PAYSLIP_STATUSES)[number]

export interface PayslipItem {
  payItemId: string
  name: string
  type: PayItemType
  value: number
  /** Deductions with an employer side: the two shares. */
  employeeContribution: number | null
  employerContribution: number | null
  manuallyUpdated: boolean
}

export interface Payslip {
  id: string
  payrollId: string
  employeeId: string
  month: string
  salary: number
  items: PayslipItem[]
  earnings: number
  deductions: number
  reimbursements: number
  netPayable: number
  status: PayslipStatus
  changes: ChangeLogEntry[]
}

export interface PayslipRow {
  id: string
  employee: EmployeeRef
  month: string
  /** Day the slip was generated (shown as "14, August 2024"). */
  date: string
  payrollId: string
  payrollName: string
  earnings: number
  deductions: number
  reimbursements: number
  netPayable: number
  status: PayslipStatus
}

export interface PayslipDetail extends Payslip {
  employee: EmployeeProfile
  payrollName: string
}

/** "Employee Accounts" above My pay slips. */
export interface MyAccountsSummary {
  providentFund: number
  eobi: number
  outstandingLoan: number
}

export interface PayslipItemInput {
  payItemId: string
  value: number
  employeeContribution: number | null
  employerContribution: number | null
  manuallyUpdated: boolean
}

// --- Salary Sheet ----------------------------------------------------------------------------

export interface SalarySheetRow {
  employee: EmployeeRef
  paymentMethod: 'Cash' | 'Bank Transfer'
  grossSalary: number
  overtime: number
  tax: number
  leaveDeduction: number
  shortDeduction: number
  absentDeduction: number
  totalEarnings: number
  totalDeductions: number
  totalReimbursements: number
  netPay: number
}

export interface SalarySheet {
  payroll: { id: string; name: string; month: string } | null
  rows: SalarySheetRow[]
  total: Omit<SalarySheetRow, 'employee' | 'paymentMethod'>
}

// --- Payrolls → Daily Wages ------------------------------------------------------------------

export interface TimeSlot {
  id: string
  code: string
  name: string
  clockIn: string
  clockOut: string
}

export interface DailyWageRow {
  employee: EmployeeRef
  checkIn: string | null
  checkOut: string | null
  wage: number
  workedMinutes: number | null
  expectedMinutes: number
  totalEarnings: number
  totalDeductions: number
  netPayable: number
}

export interface DailyWageBatch {
  id: string
  code: string
  name: string
  date: string
  timeSlotId: string
  employeeIds: string[]
  /** Edit overrides per employee: earnings, deductions and wage. */
  overrides: Record<string, { totalEarnings: number; totalDeductions: number; wage: number }>
  status: 'closed'
  createdAt: string
}

export interface DailyWageBatchRow {
  id: string
  code: string
  name: string
  date: string
  timeSlot: TimeSlot
  createdBy: EmployeeRef
  totalEmployees: number
  netPayable: number
  status: 'closed'
}

export interface DailyWageDetail extends DailyWageBatchRow {
  rows: DailyWageRow[]
}

export interface DailyWageInput {
  name: string
  date: string
  timeSlotId: string
  employeeIds: string[]
}

// --- Vouchers --------------------------------------------------------------------------------

export const VOUCHER_TYPES = [
  'expense-reimbursement',
  'salary-advance',
  'bonus',
  'travel-allowance',
] as const
export type VoucherType = (typeof VOUCHER_TYPES)[number]

export const PAYMENT_METHODS = ['bank-transfer', 'cash', 'cheque'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const VOUCHER_STATUSES = ['pending', 'approved', 'rejected', 'paid'] as const
export type VoucherStatus = (typeof VOUCHER_STATUSES)[number]

/** What a payment line on the Vouchers list is for: an employee voucher's type, or its source. */
export type VoucherLineType = VoucherType | 'daily-wages' | 'leave-encashment'

/** A payment line on the Vouchers list (from daily wages, an employee voucher or an encashment). */
export interface Voucher {
  id: string
  code: string
  employeeId: string
  amount: number
  date: string
  type: VoucherLineType
}
export interface VoucherRow extends Voucher {
  employee: EmployeeRef
}

export interface EmployeeVoucher {
  id: string
  employeeId: string
  voucherType: VoucherType
  voucherNo: string
  voucherDate: string
  amount: number
  paymentMethod: PaymentMethod
  purpose: string
  comments: string
  attachmentName: string | null
  requestedById: string
  approvedById: string | null
  approvalDate: string | null
  verifiedBy: string
  verificationDate: string | null
  status: VoucherStatus
}
export type EmployeeVoucherInput = Omit<EmployeeVoucher, 'id'>
export interface EmployeeVoucherRow extends EmployeeVoucher {
  employee: EmployeeRef
  requestedBy: EmployeeRef
  approvedBy: EmployeeRef | null
}

// --- Final Settlement ------------------------------------------------------------------------

export const SEPARATION_REASONS = [
  'resignation',
  'retirement',
  'termination',
  'transfer',
  'other',
] as const
export type SeparationReason = (typeof SEPARATION_REASONS)[number]

export interface FinalSettlement {
  id: string
  employeeId: string
  reason: SeparationReason
  resignationDate: string
  noticePeriod: boolean
  lastWorkingDate: string
  finalSettlement: boolean
  attachmentName: string | null
  description: string
  status: 'pending' | 'completed'
  /** Last calculated amounts. */
  payslipId: string | null
}
export interface FinalSettlementRow extends FinalSettlement {
  employee: EmployeeRef
}

// --- Balances --------------------------------------------------------------------------------

export interface OpeningBalanceItem {
  id: string
  payItemId: string
  month: string
  amount: number
  taxable: boolean
  description: string
}

export interface OpeningBalance {
  id: string
  code: string
  employeeId: string
  items: OpeningBalanceItem[]
}

export interface OpeningBalanceRow {
  id: string
  code: string
  employee: EmployeeRef
  netAmount: number
}

export interface OpeningBalanceDetail extends OpeningBalanceRow {
  profile: EmployeeProfile
  /** Items grouped by pay item, as in the View. */
  groups: { payItemId: string; name: string; items: OpeningBalanceItem[] }[]
}

export interface OpeningBalanceInput {
  employeeId: string
  month: string
  taxable: boolean
  payItemId: string
  amount: number
  description: string
}

export interface EmployeeAccountEntry {
  id: string
  employeeId: string
  accountTypeId: string
  month: string
  direction: 'credit' | 'debit'
  amount: number
  processed: boolean
}
export type EmployeeAccountInput = Omit<EmployeeAccountEntry, 'id'>
export interface EmployeeAccountRow extends EmployeeAccountEntry {
  employee: EmployeeRef
  account: string
  credit: number
  debit: number
}

export interface AccountStatementRow {
  id: string
  employee: EmployeeRef
  account: string
  accountTypeId: string
  month: string
  credit: number
  debit: number
}

// --- Salary Revision -------------------------------------------------------------------------

export interface SalaryRevision {
  id: string
  code: string
  employeeId: string
  effectiveDate: string
  type: 'flat' | 'percentage'
  percentage: number | null
  previousSalary: number
  salary: number
}
export interface SalaryRevisionInput {
  employeeId: string
  effectiveDate: string
  type: 'flat' | 'percentage'
  percentage: number | null
  salary: number
}
export interface SalaryRevisionRow extends SalaryRevision {
  employee: EmployeeRef
}
export interface SalaryRevisionDetail extends SalaryRevisionRow {
  profile: EmployeeProfile
}

// --- Leave Encashment ------------------------------------------------------------------------

/** "Type": paid through the monthly payroll, or worked out on a chosen basis and paid by voucher. */
export const ENCASHMENT_TYPES = ['payroll', 'manual'] as const
export type EncashmentType = (typeof ENCASHMENT_TYPES)[number]

/** "Amount Per Leave" (Manually only), in the design's order. */
export const ENCASHMENT_BASES = ['overtime', 'earned-salary', 'per-hour-rate', 'overnight'] as const
export type EncashmentBasis = (typeof ENCASHMENT_BASES)[number]

/** One person's part of an encashment: the leave days left, and what each is paid. */
export interface LeaveEncashmentLine {
  employeeId: string
  days: number
  amountPerLeave: number
}

export interface LeaveEncashment {
  id: string
  code: string
  /** A Leave Quotas account type (Sick Leave, Casual Leaves …). */
  leaveTypeId: string
  allEmployees: boolean
  /** Who was chosen; empty with All Employees. */
  employeeIds: string[]
  year: number
  type: EncashmentType
  /** Set with Manually; Payroll pays a day's salary per leave. */
  basis: EncashmentBasis | null
  lines: LeaveEncashmentLine[]
  /** `yyyy-MM`: the payroll month (or voucher month) it is paid in. */
  payMonth: string
  createdAt: string
}

export interface LeaveEncashmentInput {
  leaveTypeId: string
  allEmployees: boolean
  employeeIds: string[]
  year: number
  type: EncashmentType
  basis: EncashmentBasis | null
}

/** A list line: one person of an encashment. */
export interface LeaveEncashmentRow {
  /** `<encashment id>:<employee id>`. */
  id: string
  encashmentId: string
  leave: string
  employee: EmployeeRef
  year: number
  days: number
  amountPerLeave: number
  /** People on the same encashment, this one included. */
  people: number
}

export interface LeaveEncashmentDetail extends LeaveEncashment {
  leave: string
  /** Paid in a released pay slip or as vouchers: no longer editable. */
  paid: boolean
}

// --- Reports ---------------------------------------------------------------------------------

export interface EmployeeAccountReportRow {
  employee: EmployeeRef
  providentFund: number
  totalTaxRebate: number
  totalTaxPaid: number
}

// --- Dashboard -------------------------------------------------------------------------------

export interface MonthAmount {
  /** `yyyy-MM`. */
  month: string
  amount: number
}

export interface PayrollDashboard {
  /** Net payroll per month for last year and this year. */
  yearly: { year: number; months: MonthAmount[] }[]
  expensesMonthWise: MonthAmount[]
  loanAndAdvance: MonthAmount[]
}

export interface ExpenseReportRow {
  id: string
  employee: EmployeeRef
  type: string
  amount: number
  date: string
}

// --- Lookups ---------------------------------------------------------------------------------

export interface PayrollLookups {
  employees: (EmployeeRef & { status: 'active' | 'inactive'; branchId: string | null })[]
  branches: { id: string; name: string }[]
  departments: string[]
  payrolls: { id: string; name: string; month: string }[]
  payItems: { id: string; name: string; type: PayItemType }[]
  formulas: { id: string; name: string }[]
  taxStructures: { id: string; name: string }[]
  banks: { id: string; name: string }[]
  accountTypes: { id: string; name: string; category: AccountCategory }[]
  timeSlots: TimeSlot[]
}

export interface ListParams {
  page: number
  pageSize: number
  search?: string
}
