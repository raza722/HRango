// Payroll, as the HRango API sends it (`/api/payroll/...`, backend/app/schemas/payroll_*.py).
// Ids are strings, money is a JSON number, dates `yyyy-MM-dd`, months the first day of the
// month (`yyyy-MM-01`), stamps ISO date-times. Every editable record carries `rowVersion`;
// edits and deletes send back the one last read.

import type { FileRef } from '@/lib/files'

export type { FileRef }

/** A person as other features show them (cards, cells). Kept for the assets / off-boarding kit. */
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

/** `GET /employees/lookup`: a picker row. */
export interface EmployeeLookup {
  id: string
  code: string
  name: string
  designationName: string | null
  jobTitleName: string | null
  departmentId?: string | null
  departmentName: string | null
  branchId?: string | null
  branchName: string
  status: string
  photoUrl?: string | null
}

/** `GET /organisation/lookups/{kind}` and `/scheduling/options/time-slots`. */
export interface LookupItem {
  id: string
  name: string
  code?: string | null
  parentId?: string | null
}

export interface TimeSlotOption {
  id: string
  name: string
  code?: string | null
  startTime?: string | null
  endTime?: string | null
  isOvernight?: boolean | null
  isFlexible?: boolean | null
}

/** A leave type for the encashment picker (`GET /leaves/types`). */
export interface LeaveTypeOption {
  id: string
  name: string
}

interface Stamped {
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** `{created, errors}` from an import. */
export interface ImportResult {
  created: number
  errors: string[]
}

/** `{changed, errors}` from a bulk payslip action. */
export interface ChangedResult {
  changed: number
  errors: string[]
}

// --- Payroll Settings → General ------------------------------------------------------------------

export const ROUNDING_OPTIONS = ['floor', 'ceil', 'round', 'actual'] as const
export type RoundingOption = (typeof ROUNDING_OPTIONS)[number]
export const REPORT_ROUNDING_OPTIONS = ['none', 'round_off', 'ceil', 'floor'] as const
export type ReportRounding = (typeof REPORT_ROUNDING_OPTIONS)[number]
export const PAYSLIP_TEMPLATES = ['default', 'template_1', 'template_2', 'template_3'] as const
export type PayslipTemplate = (typeof PAYSLIP_TEMPLATES)[number]

/** `GET/PUT /payroll/settings/general`: the payroll options and the leave configuration. */
export interface PayrollSettings {
  excludeFinalSettlement: boolean
  disableTaxDistributionOnFinalSettlement: boolean
  hidePayslipAfterRun: boolean
  salaryReportRounding: ReportRounding
  revisionOnFixedDays: boolean
  /** `MM-DD`. */
  revisionFixedDate: string | null
  revisionOnShiftDays: boolean
  revisionShiftDays: number | null
  disableRevisionEmail: boolean
  cutoffProration: boolean
  /** 1–28. */
  cutoffDay: number | null
  hideAttendanceSummary: boolean
  showSalaryBreakdown: boolean
  payslipColor: string | null
  taxRounding: RoundingOption
  taxPositiveOnly: boolean
  notesEnglishEnabled: boolean
  notesEnglish: string | null
  notesOtherLanguage: string | null
  printSignature: boolean
  sendCloseEmail: boolean
  payslipTemplate: PayslipTemplate
  prorationRounding: RoundingOption
  showOnHoldAmounts: boolean
  useShiftHours: boolean
  showEmployeePayItems: boolean
  // Leave configuration
  cplLeaveTypeId: string | null
  maxEarnedCpl: number | null
  deductCasualLeaves: boolean
  deductSickLeaves: boolean
  leaveYearBasis: 'calendar' | 'fiscal'
  fiscalYearStartMonth: number | null
  fiscalYearEndMonth: number | null
  /** `null` until the settings are first saved. */
  rowVersion: string | null
}
export type PayrollSettingsInput = PayrollSettings

/** `GET /payroll/settings/variables`: what an expression may reference. */
export interface ExpressionVariable {
  name: string
  reference: string
  kind: string
  description: string | null
}

export interface ExpressionCheck {
  valid: boolean
  message: string | null
  references: string[]
}

// --- Payroll Settings → Pay Components ------------------------------------------------------------

export const PAY_ITEM_TYPES = [
  'earning',
  'deduction',
  'reimbursement',
  'employee_data',
  'other',
] as const
export type PayItemType = (typeof PAY_ITEM_TYPES)[number]

export const CALCULATION_TYPES = ['fixed', 'manual', 'formula'] as const
export type CalculationType = (typeof CALCULATION_TYPES)[number]

export const TAX_DISTRIBUTIONS = ['current_month', 'remaining_months'] as const
export type TaxDistribution = (typeof TAX_DISTRIBUTIONS)[number]

export interface PayItem extends Stamped {
  id: string
  name: string
  /** `{salary}`: how expressions refer to it. */
  reference: string
  label: string | null
  itemType: PayItemType
  calculationType: CalculationType
  taxDistribution: TaxDistribution
  employeeFormulaId: string | null
  employeeFormulaName: string | null
  /** The employee formula's expression (read only). */
  expression: string | null
  employerFormulaId: string | null
  employerFormulaName: string | null
  employerExpression: string | null
  isTaxable: boolean
  isDisplayOnly: boolean
  isBenefit: boolean
  isAdvancePayment: boolean
  eligibilityExpression: string | null
  /** Set on the nine items the system adds (salary, tax …): not deletable. */
  systemCode: string | null
  description: string | null
}
export interface PayItemInput {
  name: string
  label: string | null
  itemType: PayItemType
  calculationType: CalculationType
  taxDistribution: TaxDistribution
  employeeFormulaId: string | null
  employerFormulaId: string | null
  isTaxable: boolean
  isDisplayOnly: boolean
  isBenefit: boolean
  isAdvancePayment: boolean
  eligibilityExpression: string | null
  description: string | null
  rowVersion?: string | null
}

export interface Formula extends Stamped {
  id: string
  name: string
  reference: string
  expression: string
  isSalaryDivision: boolean
  forIntegration: boolean
  /** `false` for the formulas the system adds. */
  isCustom: boolean
  description: string | null
}
export interface FormulaInput {
  name: string
  expression: string
  isSalaryDivision: boolean
  forIntegration: boolean
  description: string | null
  rowVersion?: string | null
}

export interface PayRule extends Stamped {
  id: string
  name: string
  expression: string
  /** The employee account the rule posts its amount to. */
  accountTypeId: string
  accountTypeName: string
  accountCategory: AccountCategory
  description: string | null
}
export interface PayRuleInput {
  name: string
  expression: string
  accountTypeId: string
  description: string | null
  rowVersion?: string | null
}

// --- Payroll Settings → Account Type, Disbursement Banks -------------------------------------------

export const ACCOUNT_CATEGORIES = ['benefit', 'leave_quota', 'custom_pay_item'] as const
export type AccountCategory = (typeof ACCOUNT_CATEGORIES)[number]

export interface AccountType extends Stamped {
  id: string
  code: string
  name: string
  category: AccountCategory
  /** The benefit / leave type / pay item the account follows. */
  refId: string | null
  refName: string | null
}
export interface AccountTypeInput {
  name: string
  category: AccountCategory
  refId: string | null
  rowVersion?: string | null
}

export interface DisbursementBank extends Stamped {
  id: string
  accountHolder: string
  accountNumber: string
  bankName: string
  branchName: string | null
  branchCode: string
  branchLocation: string
  taxPayerId: string
  effectiveDate: string | null
  description: string | null
}
export interface DisbursementBankInput {
  accountHolder: string
  accountNumber: string
  bankName: string
  branchName: string | null
  branchCode: string
  branchLocation: string
  taxPayerId: string
  effectiveDate: string | null
  description: string | null
  rowVersion?: string | null
}

// --- Payroll Settings → Tax -----------------------------------------------------------------------

export const SURCHARGE_RATES = ['flat', 'percentage'] as const
export type SurchargeRate = (typeof SURCHARGE_RATES)[number]

export interface TaxSlab {
  id?: string
  minAmount: number
  /** `null` = no upper limit. */
  maxAmount: number | null
  fixedAmount: number
  percentage: number
}

export interface TaxStructure extends Stamped {
  id: string
  code: string
  name: string
  startDate: string
  endDate: string
  surchargeType: SurchargeRate | null
  surchargeValue: number | null
  description: string | null
  slabCount: number
  /** Filled on `GET /tax-structures/{id}` (and in lists). */
  slabs: TaxSlab[]
}
export interface TaxStructureInput {
  name: string
  startDate: string
  endDate: string
  surchargeType: SurchargeRate | null
  surchargeValue: number | null
  description: string | null
  slabs: Omit<TaxSlab, 'id'>[]
  rowVersion?: string | null
}

export interface TaxRebateRow extends Stamped {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  rebateDate: string
  amount: number
  fileId: string | null
  file: FileRef | null
  description: string | null
}
export interface TaxRebateInput {
  employeeId: string
  rebateDate: string
  amount: number
  fileId: string | null
  description: string | null
  rowVersion?: string | null
}

// --- Payroll Settings → Rewards -------------------------------------------------------------------

export const BENEFIT_TYPES = ['allowance', 'bonus', 'reward', 'other'] as const
export type BenefitType = (typeof BENEFIT_TYPES)[number]

export const INFO_TYPES = ['string', 'number', 'date', 'boolean'] as const
export type InfoType = (typeof INFO_TYPES)[number]

/** "Additional Information": a field the benefit asks for. */
export interface BenefitField {
  id?: string
  name: string
  fieldType: InfoType
  isRequired: boolean
  minValue: number | null
  maxValue: number | null
  minLength: number | null
  maxLength: number | null
  fieldValue: string | null
}

/** A member: one employee or one employee group. */
export interface BenefitMember {
  id: string
  employeeId: string | null
  employeeName: string | null
  employeeGroupId: string | null
  employeeGroupName: string | null
}

export interface Benefit extends Stamped {
  id: string
  name: string
  benefitType: BenefitType
  payItemId: string
  payItemName: string
  formulaId: string | null
  formulaName: string | null
  isGroup: boolean
  isAccumulative: boolean
  description: string | null
  memberCount: number
  members: BenefitMember[]
  fields: BenefitField[]
}
export interface BenefitInput {
  name: string
  benefitType: BenefitType
  payItemId: string
  formulaId: string | null
  isGroup: boolean
  isAccumulative: boolean
  description: string | null
  members: { employeeId: string | null; employeeGroupId: string | null }[]
  fields: Omit<BenefitField, 'id'>[]
  rowVersion?: string | null
}

export const INCENTIVE_TYPES = ['reimbursement', 'part_of_salary'] as const
export type IncentiveType = (typeof INCENTIVE_TYPES)[number]

export const VALUE_TYPES = ['percentage', 'flat'] as const
export type ValueType = (typeof VALUE_TYPES)[number]

/** "Sale Incentive": reach `targetAmount` and earn `rewardValue` (stored only; no sales data). */
export interface IncentiveRow extends Stamped {
  id: string
  branchId: string
  branchName: string
  applicableMonth: string
  incentiveType: IncentiveType
  targetAmount: number
  valueType: ValueType
  rewardValue: number
  description: string | null
}
export interface IncentiveInput {
  branchId: string
  applicableMonth: string
  incentiveType: IncentiveType
  targetAmount: number
  valueType: ValueType
  rewardValue: number
  description: string | null
  rowVersion?: string | null
}

// --- Payrolls → Monthly ---------------------------------------------------------------------------

/** `open` until the first run, `running` after it, `on_hold`, `closed`. */
export const PAYROLL_STATUSES = ['open', 'running', 'on_hold', 'closed'] as const
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number]

export const PROCESSING_MODES = ['from_date', 'month_end'] as const
export type ProcessingMode = (typeof PROCESSING_MODES)[number]

export interface PayrollPayItemRow {
  payItemId: string
  payItemName: string
  itemType: PayItemType
  systemCode: string | null
  isTaxable: boolean
  arrearApplicable: boolean
  finalSettlement: boolean
  calculateOnly: boolean
}
export type PayrollPayItemInput = Pick<
  PayrollPayItemRow,
  'payItemId' | 'isTaxable' | 'arrearApplicable' | 'finalSettlement' | 'calculateOnly'
>

/** A monthly or daily-wage run (`kind`). */
export interface PayrollRow extends Stamped {
  id: string
  code: string
  name: string
  kind: 'monthly' | 'daily_wage'
  /** Monthly: the month processed (`yyyy-MM-01`). */
  payrollMonth: string | null
  /** Daily wages: the day. */
  workDate: string | null
  timeSlotId: string | null
  timeSlotName: string | null
  currency: string | null
  taxStructureId: string | null
  taxStructureName: string | null
  taxApplicable: boolean
  processingMode: ProcessingMode | null
  processingDate: string | null
  applicableDays: 'actual' | 'fixed' | null
  fixedDays: number | null
  disbursementBankId: string | null
  disbursementBankName: string | null
  description: string | null
  status: PayrollStatus
  lastRunAt: string | null
  closedAt: string | null
  closedByUserId: string | null
  employeeCount: number
  payslipCount: number
  totalEarnings: number
  totalDeductions: number
  netPayable: number
  payItems: PayrollPayItemRow[]
}

export interface PayrollInput {
  name: string
  payrollMonth: string
  currency: string
  taxStructureId: string
  taxApplicable: boolean
  processingMode: ProcessingMode
  processingDate: string
  applicableDays: 'actual' | 'fixed'
  fixedDays: number | null
  disbursementBankId: string
  description: string | null
  /** Omitted: keep the current list (on create: every pay item of the company). */
  payItems?: PayrollPayItemInput[] | null
  rowVersion?: string | null
}

/** `GET /payrolls/{id}/employees`: who is on the run, with their payslip. */
export interface PayrollEmployeeRow {
  employeeId: string
  employeeCode: string
  employeeName: string
  designationName: string | null
  departmentName: string | null
  branchName: string | null
  employeeStatus: string | null
  joiningDate: string | null
  payslipId: string | null
  payslipStatus: PayslipStatus | null
  netPayable: number | null
}

/** `POST /payrolls/{id}/employees/add`: everyone matching the filter is added. */
export interface EmployeeFilterInput {
  branchId?: string | null
  departmentId?: string | null
  designationId?: string | null
  gradeId?: string | null
  locationId?: string | null
  employeeGroupId?: string | null
  employmentTypeId?: string | null
  employeeStatus?: string | null
  joinedFrom?: string | null
  joinedTo?: string | null
}

export interface EmployeeCount {
  employeeCount: number
  added?: number | null
  skipped?: number | null
}

/** A run, recalculation or close (`kind`) of a payroll. */
export interface RunLog {
  id: string
  kind: string
  startedAt: string | null
  finishedAt: string | null
  status: string | null
  processedCount: number | null
  errorCount: number | null
  runByUserId?: string | null
  runByName?: string | null
}
/** Kept name: the run history entries. */
export type PayrollHistoryEntry = RunLog

export interface PayrollError {
  id: string
  payrollRunLogId: string
  employeeId: string | null
  employeeCode: string | null
  employeeName: string | null
  message: string | null
  startedAt: string | null
}

// --- Pay Slips --------------------------------------------------------------------------------------

export const PAYSLIP_STATUSES = ['ready', 'on_hold', 'released'] as const
export type PayslipStatus = (typeof PAYSLIP_STATUSES)[number]

export interface PayslipRow extends Stamped {
  id: string
  payrollId: string | null
  payrollCode: string | null
  payrollName: string | null
  payrollKind: string | null
  payrollStatus: string | null
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string | null
  branchName: string | null
  payslipMonth: string
  gross: number | null
  totalEarnings: number | null
  totalDeductions: number | null
  totalReimbursements: number | null
  netPayable: number | null
  taxAmount: number | null
  status: PayslipStatus
  paymentMethod: string | null
  releasedAt: string | null
  paidAt: string | null
  isFinalSettlement: boolean
}

export interface PayslipLine {
  id: string
  payItemId: string
  payItemName: string
  payItemLabel: string | null
  itemType: PayItemType
  systemCode: string | null
  amount: number
  employerContribution: number | null
  isTaxable: boolean
  isManuallyUpdated: boolean
  isDisplayOnly: boolean
  calculateOnly: boolean
}

/** How the payslip is drawn (from Payroll Settings → General). */
export interface PayslipDisplay {
  template: string
  color: string | null
  showSalaryBreakdown: boolean
  hideAttendanceSummary: boolean
  showEmployeePayItems: boolean
  taxPositiveOnly: boolean
  notesEnglish: string | null
  notesOtherLanguage: string | null
}

export interface PayslipDetail extends PayslipRow {
  designationName: string | null
  jobTitleName: string | null
  locationName: string | null
  joiningDate: string | null
  bankName: string | null
  accountNumber: string | null
  currency: string | null
  applicableDays: number | null
  workedDays: number | null
  workedMinutes: number | null
  expectedMinutes: number | null
  leaveDays: number | null
  absentDays: number | null
  overtimeMinutes: number | null
  taxableIncome: number | null
  isManuallyUpdated: boolean
  lines: PayslipLine[]
  display: PayslipDisplay
}

/** `PUT /payslips/{id}`: every line's amount (hand edits are kept on recalculation). */
export interface PayslipLineInput {
  payItemId: string
  amount: number
  employerContribution: number | null
}
/** Kept name for the edit body's lines. */
export type PayslipItemInput = PayslipLineInput

export interface PayslipHistoryEntry {
  id: string
  fieldName: string | null
  oldValue: string | null
  newValue: string | null
  actionName: string
  performedAt: string
  performedByUserId: string | null
  performedByName: string | null
}

export interface AccountBalance {
  accountTypeId: string
  accountName: string
  category: AccountCategory
  credit: number
  debit: number
  balance: number
}

/** "Employee Accounts" above My pay slips (`GET /payslips/summary`). */
export interface MyAccountsSummary {
  employeeId: string
  employeeCode: string
  employeeName: string
  outstandingLoan: number | null
  advancesPaid: number | null
  accounts: AccountBalance[]
}

// --- Salary Sheet ---------------------------------------------------------------------------------

export interface SalarySheetItem {
  payItemId: string
  payItemName: string
  itemType: PayItemType
  amount: number
}

export interface SalarySheetTotals {
  gross: number
  overtime: number
  tax: number
  leaveDeduction: number
  shortDeduction: number
  absentDeduction: number
  totalEarnings: number
  totalReimbursements: number
  totalDeductions: number
  netPayable: number
}

export interface SalarySheetRow extends SalarySheetTotals {
  payslipId: string
  payrollId: string
  payrollName: string
  employeeId: string
  employeeCode: string
  employeeName: string
  paymentMethod: string | null
  status: PayslipStatus
  items: SalarySheetItem[]
}

export interface SalarySheet {
  rounding: string
  printSignature: boolean
  columns: { payItemId: string; payItemName: string; itemType: PayItemType }[]
  rows: SalarySheetRow[]
  totals: SalarySheetTotals
}

// --- Payrolls → Daily Wages -----------------------------------------------------------------------

/** A daily-wage run in the list (the same row as a monthly payroll). */
export type DailyWageBatchRow = PayrollRow

export interface DailyWageRow {
  employeeId: string
  employeeCode: string
  employeeName: string
  checkIn: string | null
  checkOut: string | null
  expectedMinutes: number | null
  workedMinutes: number | null
  payslipId: string | null
  wage: number | null
  totalEarnings: number | null
  totalDeductions: number | null
  netPayable: number | null
  payslipStatus: PayslipStatus | null
  paymentMethod: string | null
  isManuallyUpdated: boolean | null
  voucherId: string | null
  voucherNo: string | null
  voucherStatus: VoucherStatus | null
}

export interface DailyWageDetail extends PayrollRow {
  rows: DailyWageRow[]
}

export interface DailyWageInput {
  name: string
  workDate: string
  timeSlotId: string
  employeeIds: string[]
}

export interface DailyWageEditInput {
  name: string
  rows: { employeeId: string; totalEarnings: number; totalDeductions: number }[]
  rowVersion: string
}

// --- Vouchers ---------------------------------------------------------------------------------------

/** Types a person can raise; `daily_wage` vouchers come from a closed daily-wage run. */
export const VOUCHER_TYPES = [
  'expense_reimbursement',
  'salary_advance',
  'bonus',
  'travel_allowance',
] as const
export type VoucherType = (typeof VOUCHER_TYPES)[number]
export type VoucherLineType = VoucherType | 'daily_wage'

export const PAYMENT_METHODS = ['bank_transfer', 'cash', 'cheque', 'pay_order'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** pending → approved / rejected (`approve` / `reject`) → processed (Finance `verify`). */
export const VOUCHER_STATUSES = ['pending', 'approved', 'rejected', 'processed'] as const
export type VoucherStatus = (typeof VOUCHER_STATUSES)[number]

export interface VoucherRow extends Stamped {
  id: string
  voucherNo: string
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string | null
  designationName: string | null
  voucherType: VoucherLineType
  voucherDate: string
  currency: string | null
  amount: number
  paymentMethod: PaymentMethod | null
  purpose: string | null
  notes: string | null
  fileId: string | null
  file: FileRef | null
  payrollId: string | null
  payrollName: string | null
  requestedById: string | null
  requestedByName: string | null
  approvedById: string | null
  approvedByName: string | null
  approvedAt: string | null
  verifiedById: string | null
  verifiedByName: string | null
  verifiedAt: string | null
  remarks: string | null
  status: VoucherStatus
}
/** Employee vouchers are the same records. */
export type EmployeeVoucherRow = VoucherRow

export interface VoucherInput {
  employeeId: string
  /** Blank: the next `VCH-` number. */
  voucherNo: string | null
  voucherType: VoucherType
  voucherDate: string
  currency: string | null
  amount: number
  paymentMethod: PaymentMethod
  purpose: string
  notes: string | null
  fileId: string | null
  requestedById: string | null
  rowVersion?: string | null
}
export type EmployeeVoucherInput = VoucherInput

export interface VoucherDecisionInput {
  remarks: string | null
  rowVersion: string
}

// --- Final Settlement -------------------------------------------------------------------------------

/** `pending` (no settlement yet), `open` (calculated), `closed`. */
export const FINAL_SETTLEMENT_STATUSES = ['pending', 'open', 'closed'] as const
export type FinalSettlementStatus = (typeof FINAL_SETTLEMENT_STATUSES)[number]

/** A leaver needing final settlement; `id` is the end-of-employment record. */
export interface FinalSettlementRow {
  id: string
  finalSettlementId: string | null
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string | null
  branchName: string | null
  reason: string | null
  resignationDate: string | null
  lastWorkingDate: string
  description: string | null
  status: FinalSettlementStatus
  payslipId: string | null
  totalEarnings: number | null
  totalDeductions: number | null
  netPayable: number | null
  closedAt: string | null
  /** The signed settlement letter given on Close FS. */
  fileId: string | null
  file: FileRef | null
  rowVersion: string | null
}

export interface FinalSettlementCloseInput {
  rowVersion: string
  fileId: string | null
}

// --- Balances ---------------------------------------------------------------------------------------

export interface OpeningBalanceEntry extends Stamped {
  id: string
  employeeId: string
  employeeCode?: string | null
  employeeName?: string | null
  balanceMonth: string
  payItemId: string
  payItemName: string
  itemType: PayItemType
  amount: number
  isTaxable: boolean
  kind: 'opening' | 'adjustment'
  description: string | null
  /** Its month is closed in payroll: no longer editable. */
  isLocked: boolean
}

/** The list: one line per person. */
export interface OpeningBalanceRow {
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string | null
  netAmount: number
  entryCount: number
  lastMonth: string | null
}

/** `GET /opening-balances/employees/{employeeId}`: the person and every entry. */
export interface OpeningBalanceDetail {
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName?: string | null
  jobTitleName?: string | null
  locationName?: string | null
  branchName?: string | null
  entries: OpeningBalanceEntry[]
}

export interface OpeningBalanceInput {
  employeeId: string
  balanceMonth: string
  payItemId: string
  amount: number
  isTaxable: boolean
  kind: 'opening' | 'adjustment'
  description: string | null
  rowVersion?: string | null
}

export interface OpeningBalanceImportRow {
  employeeCode: string
  payItem: string
  month: string
  amount: number
  taxable: boolean
  description: string | null
}

export interface EmployeeAccountRow extends Stamped {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  accountTypeId: string
  accountName: string
  accountCategory: AccountCategory
  entryMonth: string
  credit: number
  debit: number
  isProcessed: boolean
  payslipId: string | null
  payRuleId: string | null
  payRuleName: string | null
  description: string | null
}

export interface EmployeeAccountInput {
  employeeId: string
  accountTypeId: string
  entryMonth: string
  direction: 'credit' | 'debit'
  amount: number
  isProcessed: boolean
  description: string | null
  rowVersion?: string | null
}

export interface AccountImportRow {
  employeeCode: string
  account: string
  month: string
  credit: number
  debit: number
  description: string | null
}

export interface AccountStatementRow {
  id: string
  employeeId: string
  employeeName: string
  accountTypeId: string
  accountName: string
  entryMonth: string
  credit: number
  debit: number
  isProcessed: boolean
  description: string | null
  /** Running balance of the account up to this line. */
  balance: number
}

// --- Salary Revision --------------------------------------------------------------------------------

export interface SalaryRevisionRow extends Stamped {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  effectiveDate: string
  previousAmount: number | null
  amount: number
  changeType: 'flat' | 'percent' | null
  changeValue: number | null
  /** `revision`, `import`, or where else the salary row came from. */
  source: string | null
  canEdit: boolean
  departmentName?: string | null
  locationName?: string | null
  branchName?: string | null
  jobTitleName?: string | null
  joiningDate?: string | null
}
export type SalaryRevisionDetail = SalaryRevisionRow

/** Flat adds `changeValue` to the previous salary; percent raises it by `changeValue` %. */
export interface SalaryRevisionInput {
  employeeId: string
  effectiveDate: string
  changeType: 'flat' | 'percent'
  changeValue: number
  rowVersion?: string | null
}

export interface CurrentSalary {
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string | null
  jobTitleName: string | null
  joiningDate: string | null
  salary: number | null
  effectiveDate: string | null
}

export interface SalaryImportRow {
  employeeCode: string
  effectiveDate: string
  salary: number
}

/**
 * @deprecated The mock store's revision shape (the Requests mock writes promotions into it).
 * Screens use {@link SalaryRevisionRow}.
 */
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

// --- Leave Encashment -------------------------------------------------------------------------------

/** "Type": paid through the next monthly payroll, or worked out and handled outside payroll. */
export const ENCASHMENT_TYPES = ['payroll', 'manual'] as const
export type EncashmentType = (typeof ENCASHMENT_TYPES)[number]

export const ENCASHMENT_BASES = ['overtime', 'earned_salary', 'per_hour_rate', 'overnight'] as const
export type EncashmentBasis = (typeof ENCASHMENT_BASES)[number]

/** A list line: one person of an encashment. */
export interface LeaveEncashmentRow {
  id: string
  leaveEncashmentId?: string | null
  leaveTypeId?: string | null
  leaveTypeName?: string | null
  employeeId: string
  employeeCode: string
  employeeName: string
  fiscalYear?: number | null
  encashmentDate?: string | null
  basis?: EncashmentBasis | null
  mode?: EncashmentType | null
  amountPerLeave: number
  days: number
  amount: number
  payslipId: string | null
  isPaid?: boolean | null
  rowVersion?: string | null
}

export interface LeaveEncashmentDetail extends Stamped {
  id: string
  leaveTypeId: string
  leaveTypeName: string
  fiscalYear: number
  encashmentDate: string
  appliesToAll: boolean
  basis: EncashmentBasis
  amountPerLeave: number
  mode: EncashmentType
  totalDays: number | null
  totalAmount: number | null
  /** Paid in a released payslip: no longer editable. */
  isPaid: boolean
  employees: LeaveEncashmentRow[]
}

export interface LeaveEncashmentInput {
  leaveTypeId: string
  fiscalYear: number
  allEmployees: boolean
  employeeIds: string[]
  mode: EncashmentType
  basis: EncashmentBasis
  /** Required except for basis `earned_salary` (a day's salary). */
  amountPerLeave: number | null
  rowVersion?: string | null
}

// --- Reports ----------------------------------------------------------------------------------------

export interface EmployeeAccountReportRow {
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string | null
  taxPaid: number
  taxRebate: number
  accounts: {
    accountTypeId: string
    accountName: string
    credit: number
    debit: number
    balance: number
  }[]
}

export interface PayrollSummary {
  payrollId: string
  code: string
  name: string
  kind: string
  payrollMonth: string | null
  workDate: string | null
  status: string
  employeeCount: number
  gross: number
  totalEarnings: number
  totalDeductions: number
  totalReimbursements: number
  tax: number
  netPayable: number
  onHoldCount: number
  onHoldAmount: number
  paidAmount: number
  payItems: {
    payItemId: string
    payItemName: string
    itemType: PayItemType
    amount: number
    employerContribution: number
    employeeCount: number
  }[]
}

export interface EmployeeWiseRow {
  payslipId: string
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string | null
  payslipMonth: string
  payrollName: string | null
  isFinalSettlement: boolean
  gross: number | null
  totalEarnings: number | null
  totalReimbursements: number | null
  totalDeductions: number | null
  taxAmount: number | null
  netPayable: number | null
  status: string
}

export interface DailyWagesReportRow {
  payrollId: string
  code: string
  name: string
  workDate: string
  timeSlotName: string | null
  status: string
  employeeCount: number
  workedMinutes: number
  netPayable: number
  voucherCount: number
  vouchersProcessed: number
}

// --- Dashboard ----------------------------------------------------------------------------------------

export interface PayrollDashboard {
  year: number
  breakupMonth: string | null
  tiles: {
    totalPayrolls: number
    closedPayrolls: number
    totalPayslips: number
    releasedPayslips: number
    paidPayslips: number
    onHoldPayslips: number
    unpaidPayslips: number
    netPayable: number
    paidAmount: number
  }
  /** One entry per month of the year that has payslips. */
  salaryStatistics: {
    month: string
    gross: number
    tax: number
    deductions: number
    netPayable: number
    payslipCount: number
  }[]
  /** Pay item totals for `breakupMonth`. */
  salaryBreakup: { payItemId: string; payItemName: string; itemType: PayItemType; amount: number }[]
}

// --- Lists ----------------------------------------------------------------------------------------------

export interface ListParams {
  page: number
  pageSize: number
  /** Sent as `?q=`. */
  q?: string
}
