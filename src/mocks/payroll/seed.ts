import { addDays, format, subDays, subMonths } from 'date-fns'

import type {
  AccountType,
  Benefit,
  DisbursementBank,
  EmployeeAccountEntry,
  EmployeeVoucher,
  FinalSettlement,
  Formula,
  Incentive,
  LeaveEncashment,
  OpeningBalance,
  PayItem,
  PayItemType,
  PayrollSettings,
  PayRule,
  SalaryRevision,
  TaxRebate,
  TaxStructure,
  Voucher,
} from '@/features/payroll'

import { DIRECTORY, type DirectoryEmployee } from '../employees/seed'

const stamp = (days: number) => subDays(new Date(), days).toISOString()
export const monthOf = (date: Date) => format(date, 'yyyy-MM')
export const thisMonth = () => monthOf(new Date())
export const lastMonth = () => monthOf(subMonths(new Date(), 1))

// --- salaries -----------------------------------------------------------------------------

/** Monthly gross before any revision: by job title, with a small per-person offset. */
export function baseSalaryOf(employee: DirectoryEmployee): number {
  const title = employee.jobTitle.toLowerCase()
  let hash = 0
  for (let index = 0; index < employee.id.length; index += 1) {
    hash = (hash * 31 + employee.id.charCodeAt(index)) % 10_007
  }
  const offset = (hash % 8) * 5_000
  const base = /head|country|gm |surgeon|anaesthetist/.test(`${title} `)
    ? 420_000
    : title.includes('manager')
      ? 300_000
      : /developer|engineer|designer|devops/.test(title)
        ? 170_000
        : title.includes('physiotherapist')
          ? 150_000
          : 110_000
  return base + offset
}

// --- pay components ----------------------------------------------------------------------

const payItem = (
  id: string,
  name: string,
  type: PayItemType,
  expression: string,
  extra: Partial<PayItem> = {},
): PayItem => ({
  id,
  name,
  label: name,
  taxDistribution: 'remaining-months',
  type,
  calculationType: expression ? 'fixed' : 'manual',
  expression,
  employeeFormulaId: null,
  employerContribution: false,
  employerFormulaId: null,
  displayOnly: false,
  benefit: false,
  eligibilityCriteria: false,
  isAdvancePayment: false,
  createdAt: stamp(200),
  ...extra,
})

/** The pay items listed in the design's Payitem drop-down, with working expressions. */
export function seedPayItems(): PayItem[] {
  const perDay = '{gross_salary} / {applicable_days}'
  return [
    payItem('pi_gross_salary', 'Gross Salary', 'earning', '{gross_salary}'),
    payItem('pi_salary_per_month', 'Salary Per Month', 'employee-data', '{gross_salary}', {
      calculationType: 'fixed',
    }),
    payItem('pi_earned_salary', 'Earned Salary', 'employee-data', `${perDay} * {worked_days}`),
    payItem('pi_overtime', 'Overtime', 'earning', `${perDay} / 8 * {overtime_minutes} / 60`),
    payItem('pi_over_time', 'Over Time', 'earning', ''),
    payItem('pi_short_duration', 'Short Duration', 'deduction', `${perDay} / 2 * {short_days}`),
    payItem('pi_travel_self', 'Travel Self Allowance', 'earning', ''),
    payItem('pi_relaxation', 'Relaxation', 'deduction', ''),
    payItem('pi_absent', 'Absent Deduction', 'deduction', `${perDay} * {absent_days}`),
    payItem('pi_expense', 'Expense', 'reimbursement', ''),
    payItem('pi_travel_deduction', 'Travel Deduction', 'deduction', ''),
    payItem('pi_claimed_benefits', 'Claimed Benefits', 'reimbursement', '', { benefit: true }),
    payItem('pi_leave_encashment', 'Leave Encashment', 'earning', '{leave_encashment}'),
    payItem('pi_early_left', 'Early Left', 'deduction', `${perDay} / 4 * {early_left_days}`),
    payItem('pi_gratuity', 'Gratuity', 'earning', ''),
    payItem('pi_lend', 'Lend', 'other', '', { isAdvancePayment: true }),
    payItem('pi_late_arrival', 'Late Arrival', 'deduction', `${perDay} * {penalty_count}`),
    payItem('pi_arrear', 'Arrear', 'earning', ''),
    payItem('pi_pf', 'Provident Fund Deduction', 'deduction', '{gross_salary} * 5 / 100', {
      employeeFormulaId: 'f_pf_employee',
      employerContribution: true,
      employerFormulaId: 'f_pf_employer',
    }),
    payItem('pi_travel_company', 'Travel Company Allowance', 'earning', ''),
    payItem('pi_cpl_encashment', 'CPL Encashment', 'earning', ''),
    payItem('pi_missing', 'Missing Deduction', 'deduction', `${perDay} / 2 * {missing_punch_days}`),
    payItem('pi_travel_daily', 'Travel Daily Allowance', 'earning', ''),
    payItem('pi_leave_deduction', 'Leave Deduction', 'deduction', ''),
    payItem('pi_tax', 'Tax', 'deduction', '{monthly_tax}', { taxDistribution: 'current-month' }),
    payItem('pi_sale_incentive', 'Sale Incentive', 'earning', ''),
    payItem('pi_target_incentive', 'Target Incentive', 'earning', ''),
    payItem('pi_pf_encashment', 'Provident Fund Encashment', 'earning', ''),
    payItem('pi_travel_encashment', 'Travel Encashment', 'earning', ''),
    payItem('pi_yearly_tax', 'Yearly Tax', 'employee-data', '{annual_tax}'),
    payItem('pi_eobi', 'EOBI', 'deduction', '370', {
      employerContribution: true,
      employerFormulaId: 'f_eobi_employer',
    }),
    payItem('pi_medical', 'Medical', 'reimbursement', '', { benefit: true }),
  ]
}

/** The pay items a new payroll starts with, and the seeded payrolls use. */
export const STANDARD_PAY_ITEMS = [
  'pi_gross_salary',
  'pi_overtime',
  'pi_short_duration',
  'pi_absent',
  'pi_late_arrival',
  'pi_leave_deduction',
  'pi_tax',
  'pi_pf',
  'pi_eobi',
  'pi_expense',
]

const formula = (
  id: string,
  name: string,
  expression: string,
  extra: Partial<Formula> = {},
): Formula => ({
  id,
  name,
  expression,
  isSalaryDivision: false,
  forIntegration: false,
  isCustom: false,
  description: '',
  ...extra,
})

export function seedFormulas(): Formula[] {
  return [
    formula('f_salary_per_month', 'Salary Per Month', '{gross_salary} + {Overtime_minutes}', {
      isCustom: true,
      isSalaryDivision: true,
    }),
    formula('f_per_day', 'Per Day Salary', '{gross_salary} / {applicable_days}', {
      isSalaryDivision: true,
      description: 'One day of the month’s salary.',
    }),
    formula('f_pf_employee', 'Provident Fund (Employee)', '{gross_salary} * 5 / 100'),
    formula('f_pf_employer', 'Provident Fund (Employer)', '{gross_salary} * 5 / 100'),
    formula('f_eobi_employer', 'EOBI (Employer)', '1850'),
    formula('f_gross', 'Gross Salary', '{gross_salary}'),
    formula('f_monthly_taxable', 'Monthly Taxable Earning', '{gross_salary}'),
    formula('f_paid_tax', 'Paid Tax', '{monthly_tax}'),
    formula('f_short_leave_count', 'Short Leave Count', '{short_days}'),
  ]
}

export function seedRules(): PayRule[] {
  return [
    {
      id: 'r_salary_per_month',
      name: 'Salary Per Month',
      expression: '{gross_salary} + {Overtime_minutes}',
      isCustom: true,
    },
    {
      id: 'r_late_penalty',
      name: 'Late Penalty',
      expression: '{gross_salary} / {applicable_days} * {penalty_count}',
      isCustom: false,
    },
  ]
}

export function seedAccountTypes(): AccountType[] {
  return [
    { id: 'at_medical', category: 'benefit', name: 'Medical' },
    { id: 'at_sick', category: 'leave-quotas', name: 'Sick Leave' },
    { id: 'at_casual', category: 'leave-quotas', name: 'Casual Leaves' },
    { id: 'at_pf', category: 'custom-pay-item', name: 'Provident Fund' },
    { id: 'at_eobi', category: 'custom-pay-item', name: 'EOBI' },
    { id: 'at_loan', category: 'custom-pay-item', name: 'Outstanding Loan/ Advance Payment' },
  ]
}

export function seedBanks(): DisbursementBank[] {
  return [
    {
      id: 'bank_ubl',
      accountHolder: 'Top Edge Technologies',
      accountNumber: '0245-1029384756',
      bankName: 'UBL Digital Bank',
      branchName: 'Gulberg Branch',
      branchCode: '0245',
      branchLocation: 'Lahore',
      bankCode: 'UNIL-0245',
      taxPayerId: '7364519-2',
      effectiveDate: '2024-01-15',
    },
    {
      id: 'bank_meezan',
      accountHolder: 'Top Edge Technologies',
      accountNumber: '0102-0105566778',
      bankName: 'Meezan Bank',
      branchName: 'Blue Area Branch',
      branchCode: '0102',
      branchLocation: 'Islamabad',
      bankCode: 'MEZN-0102',
      taxPayerId: '7364519-2',
      effectiveDate: '2025-03-01',
    },
    {
      id: 'bank_avik',
      accountHolder: 'Top Edge Technologies',
      accountNumber: '1006-7788990011',
      bankName: 'Avik Bank',
      branchName: 'USA Branch',
      branchCode: '1006',
      branchLocation: 'Karachi',
      bankCode: 'AVIK-1006',
      taxPayerId: '7364519-2',
      effectiveDate: '2024-01-15',
    },
  ]
}

/** Salaried income tax slabs (yearly taxable income → tax), the current year first. */
export function seedTaxStructures(): TaxStructure[] {
  const year = new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1
  const slab = (
    id: string,
    min: number,
    max: number | null,
    fixedAmount: number,
    percentage: number,
  ) => ({
    id,
    min,
    max,
    fixedAmount,
    percentage,
  })
  return [
    {
      id: 'ts_current',
      code: 'TS-0007',
      name: `Tax Structure ${year}-${year + 1}`,
      startDate: `${year}-07-01`,
      endDate: `${year + 1}-06-30`,
      surcharge: true,
      surchargeRule: { value: 10, rate: 'percentage', condition: '>', amount: 1_000_000 },
      description: 'Salaried individuals, as notified for the tax year.',
      slabs: [
        slab('s1', 0, 600_000, 0, 0),
        slab('s2', 600_001, 1_200_000, 0, 1),
        slab('s3', 1_200_001, 2_200_000, 6_000, 11),
        slab('s4', 2_200_001, 3_200_000, 116_000, 23),
        slab('s5', 3_200_001, 4_100_000, 346_000, 30),
        slab('s6', 4_100_001, null, 616_000, 35),
      ],
    },
    {
      id: 'ts_2023',
      code: 'TS-0004',
      name: 'Tax Structure 2023-2024',
      startDate: '2023-07-01',
      endDate: '2024-06-30',
      surcharge: false,
      surchargeRule: null,
      description: '',
      slabs: [
        slab('s1', 0, 600_000, 0, 0),
        slab('s2', 600_001, 1_200_000, 0, 2.5),
        slab('s3', 1_200_001, 2_400_000, 15_000, 12.5),
        slab('s4', 2_400_001, 3_600_000, 165_000, 22.5),
        slab('s5', 3_600_001, 6_000_000, 435_000, 27.5),
        slab('s6', 6_000_001, null, 1_095_000, 35),
      ],
    },
  ]
}

export function seedTaxRebates(): TaxRebate[] {
  const date = format(subDays(new Date(), 46), 'yyyy-MM-dd')
  return [
    {
      id: 'rb_1',
      employeeId: 'em_hina',
      date,
      amount: 15_000,
      attachmentName: 'donation-receipt.pdf',
    },
    { id: 'rb_2', employeeId: 'em_bilal', date, amount: 8_500, attachmentName: null },
  ]
}

export function seedBenefits(): Benefit[] {
  return [
    {
      id: 'bn_medical',
      code: 'BN-0001',
      name: 'Medical Allowance',
      type: 'reimbursement',
      payItemId: 'pi_medical',
      group: false,
      accumulative: true,
      description: 'Out-patient bills, paid back with the salary.',
      additionalInfo: [
        { id: 'ai_1', name: 'Hospital', type: 'string', required: true, min: 2, max: 80 },
        { id: 'ai_2', name: 'Bill Amount', type: 'number', required: true, min: 1, max: 100_000 },
      ],
      members: [],
    },
    {
      id: 'bn_travel',
      code: 'BN-0002',
      name: 'Travel Allowance',
      type: 'part-of-salary',
      payItemId: 'pi_travel_company',
      group: true,
      accumulative: false,
      description: 'Field staff who travel for work.',
      additionalInfo: [],
      members: [
        { id: 'bm_1', name: 'Sales Team', formulaId: 'f_gross' },
        { id: 'bm_2', name: 'Marketing Team', formulaId: 'f_monthly_taxable' },
      ],
    },
  ]
}

export function seedIncentives(): Incentive[] {
  return [
    {
      id: 'inc_khi',
      code: 'INC-0001',
      branchId: 'br_khi',
      month: format(new Date(), 'yyyy-MM'),
      incentiveType: 'part-of-salary',
      amount: 5_000_000,
      valueType: 'percentage',
      value: 5,
    },
    {
      id: 'inc_isb',
      code: 'INC-0002',
      branchId: 'br_isb',
      month: format(subMonths(new Date(), 1), 'yyyy-MM'),
      incentiveType: 'reimbursement',
      amount: 2_500_000,
      valueType: 'flat',
      value: 25_000,
    },
  ]
}

export function defaultPayrollSettings(): PayrollSettings {
  return {
    configuration: {
      excludeFinalSettlement: false,
      disableTaxDistributionOnFinalSettlement: false,
      doNotDisplayPayslipAfterRun: null,
      applySalaryRevisionOnFixedDays: false,
      applySalaryRevisionOnShiftDays: false,
      disableSalaryRevisionEmail: false,
      applyCutOffDatesForProration: false,
      hideAttendanceSummaryInPayslip: false,
      showSalaryBreakdownOnPayslip: true,
      mainColorForPayslip: false,
      roundOffTaxAmount: 'round',
      displayTaxOnlyForPositive: true,
      notesInEnglish: '',
      notesInOtherLanguage: '',
      printSignatureOnSalarySheet: false,
      sendPayrollCloseEmail: false,
      payslipTemplate: 'default',
      prorateMonthly: 'calendar-days',
      showOnHoldOnSalarySheet: false,
      prorateMonthlyByShift: false,
      useShiftHoursForPolicies: false,
      displayEmployeePayItemsOnPayslip: true,
    },
    leave: {
      cplLeaveType: null,
      maximumEarnedCpl: null,
      deductionOrder: { casual: true, sick: false },
      fiscalYear: 'calendar',
      yearStartMonth: 1,
      yearEndMonth: 12,
    },
  }
}

// --- people records -----------------------------------------------------------------------

export function seedSalaryRevisions(): SalaryRevision[] {
  const find = (id: string) => DIRECTORY.find((employee) => employee.id === id)
  const rehan = find('em_rehan')
  const maryam = find('em_maryam')
  const revisions: SalaryRevision[] = []
  if (rehan) {
    const previous = baseSalaryOf(rehan)
    revisions.push({
      id: 'sr_1',
      code: 'SR-00001',
      employeeId: rehan.id,
      effectiveDate: format(subMonths(new Date(), 3), 'yyyy-MM-01'),
      type: 'flat',
      percentage: null,
      previousSalary: previous,
      salary: previous + 30_000,
    })
  }
  if (maryam) {
    const previous = baseSalaryOf(maryam)
    revisions.push({
      id: 'sr_2',
      code: 'SR-00002',
      employeeId: maryam.id,
      effectiveDate: format(subMonths(new Date(), 1), 'yyyy-MM-15'),
      type: 'percentage',
      percentage: 10,
      previousSalary: previous,
      salary: Math.round(previous * 1.1),
    })
  }
  return revisions
}

export function seedOpeningBalances(): OpeningBalance[] {
  const month = format(subMonths(new Date(), 2), 'yyyy-MM')
  return [
    {
      id: 'ob_1',
      code: 'RI-00001',
      employeeId: 'em_omer',
      items: [
        {
          id: 'obi_1',
          payItemId: 'pi_travel_self',
          month,
          amount: 5_000,
          taxable: false,
          description: 'Detail Data about allowance',
        },
        {
          id: 'obi_2',
          payItemId: 'pi_relaxation',
          month,
          amount: 5_000,
          taxable: false,
          description: 'Detail Data about allowance',
        },
      ],
    },
  ]
}

export function seedAccountEntries(): EmployeeAccountEntry[] {
  const entries: EmployeeAccountEntry[] = []
  for (let back = 1; back <= 3; back += 1) {
    const month = format(subMonths(new Date(), back), 'yyyy-MM')
    entries.push({
      id: `ae_pf_${back}`,
      employeeId: 'em_shelley',
      accountTypeId: 'at_pf',
      month,
      direction: 'credit',
      amount: 30_000,
      processed: true,
    })
    entries.push({
      id: `ae_eobi_${back}`,
      employeeId: 'em_shelley',
      accountTypeId: 'at_eobi',
      month,
      direction: 'credit',
      amount: 2_220,
      processed: true,
    })
  }
  entries.push({
    id: 'ae_loan',
    employeeId: 'em_shelley',
    accountTypeId: 'at_loan',
    month: format(subMonths(new Date(), 4), 'yyyy-MM'),
    direction: 'debit',
    amount: 60_000,
    processed: true,
  })
  entries.push({
    id: 'ae_loan_back',
    employeeId: 'em_shelley',
    accountTypeId: 'at_loan',
    month: format(subMonths(new Date(), 1), 'yyyy-MM'),
    direction: 'credit',
    amount: 20_000,
    processed: true,
  })
  entries.push({
    id: 'ae_medical',
    employeeId: 'em_omer',
    accountTypeId: 'at_medical',
    month: format(subMonths(new Date(), 1), 'yyyy-MM'),
    direction: 'debit',
    amount: 12_000,
    processed: false,
  })
  return [...entries, ...seedLeaveQuotas(), ...seedEncashmentDebits()]
}

// --- leave quotas and leave encashment ---------------------------------------------------

/** People with leave quotas this year (Head Office and Software). */
const QUOTA_PEOPLE = ['em_omer', 'em_sadia', 'em_fatima', 'em_imran', 'em_haroon', 'em_rehan']
const QUOTA_DAYS = { at_sick: 8, at_casual: 10 } as const
/** Days already taken: [person, leave type, days]. */
const TAKEN: [string, keyof typeof QUOTA_DAYS, number][] = [
  ['em_omer', 'at_sick', 3],
  ['em_fatima', 'at_casual', 2],
  ['em_sadia', 'at_sick', 1],
]

/** The leave year the seed fills: the calendar year (the default Leave Configuration). */
export const leaveYear = () => new Date().getFullYear()

/** Leave Quotas accounts hold days: this year's quota as a credit, days taken as debits. */
function seedLeaveQuotas(): EmployeeAccountEntry[] {
  const month = `${leaveYear()}-01`
  const credits = QUOTA_PEOPLE.flatMap((employeeId) =>
    Object.entries(QUOTA_DAYS).map(([accountTypeId, amount]) => ({
      id: `ae_quota_${employeeId}_${accountTypeId}`,
      employeeId,
      accountTypeId,
      month,
      direction: 'credit' as const,
      amount,
      processed: true,
    })),
  )
  const taken = TAKEN.map(([employeeId, accountTypeId, amount]) => ({
    id: `ae_taken_${employeeId}_${accountTypeId}`,
    employeeId,
    accountTypeId,
    month,
    direction: 'debit' as const,
    amount,
    processed: true,
  }))
  return [...credits, ...taken]
}

const daySalary = (employeeId: string) => {
  const employee = DIRECTORY.find((person) => person.id === employeeId)
  return employee ? Math.round(baseSalaryOf(employee) / 30) : 0
}

/**
 * Two encashments as on the list frame: Sick Leave through this month's payroll
 * for Omer Farooq, and Casual Leaves paid by voucher. The people have no salary
 * revision, so a day's salary is the starting salary ÷ 30.
 */
export function seedLeaveEncashments(): LeaveEncashment[] {
  return [
    {
      id: 'le_1',
      code: 'LE-00001',
      leaveTypeId: 'at_sick',
      allEmployees: false,
      employeeIds: ['em_omer'],
      year: leaveYear(),
      type: 'payroll',
      basis: null,
      lines: [{ employeeId: 'em_omer', days: 5, amountPerLeave: daySalary('em_omer') }],
      payMonth: thisMonth(),
      createdAt: stamp(3),
    },
    {
      id: 'le_2',
      code: 'LE-00002',
      leaveTypeId: 'at_casual',
      allEmployees: false,
      employeeIds: ['em_haroon', 'em_fatima'],
      year: leaveYear(),
      type: 'manual',
      basis: 'earned-salary',
      lines: [
        { employeeId: 'em_haroon', days: 10, amountPerLeave: daySalary('em_haroon') },
        { employeeId: 'em_fatima', days: 8, amountPerLeave: daySalary('em_fatima') },
      ],
      payMonth: thisMonth(),
      createdAt: stamp(2),
    },
  ]
}

/** The days an encashment pays are taken off the leave quota (ids match the handlers'). */
export const encashmentEntryId = (encashmentId: string, employeeId: string) =>
  `ae_le_${encashmentId}_${employeeId}`
export const encashmentVoucherId = (encashmentId: string, employeeId: string) =>
  `vc_le_${encashmentId}_${employeeId}`

function seedEncashmentDebits(): EmployeeAccountEntry[] {
  return seedLeaveEncashments().flatMap((item) =>
    item.lines.map((line) => ({
      id: encashmentEntryId(item.id, line.employeeId),
      employeeId: line.employeeId,
      accountTypeId: item.leaveTypeId,
      month: item.payMonth,
      direction: 'debit' as const,
      amount: line.days,
      processed: true,
    })),
  )
}

/** Voucher lines of the seeded encashment paid Manually. */
export function seedEncashmentVouchers(): Voucher[] {
  return seedLeaveEncashments()
    .filter((item) => item.type === 'manual')
    .flatMap((item) =>
      item.lines.map((line, index) => ({
        id: encashmentVoucherId(item.id, line.employeeId),
        code: String(1200 + index),
        employeeId: line.employeeId,
        amount: line.days * line.amountPerLeave,
        date: format(new Date(item.createdAt), 'yyyy-MM-dd'),
        type: 'leave-encashment' as const,
      })),
    )
}

export function seedEmployeeVouchers(): EmployeeVoucher[] {
  const day = (back: number) => format(subDays(new Date(), back), 'yyyy-MM-dd')
  return [
    {
      id: 'ev_1',
      employeeId: 'em_saad',
      voucherType: 'expense-reimbursement',
      voucherNo: '02356897456123',
      voucherDate: day(20),
      amount: 50_000,
      paymentMethod: 'bank-transfer',
      purpose: 'Client visit to Karachi: air fare and hotel.',
      comments: '',
      attachmentName: 'karachi-visit.pdf',
      requestedById: 'em_saad',
      approvedById: 'em_bilal',
      approvalDate: day(18),
      verifiedBy: 'Finance',
      verificationDate: day(17),
      status: 'approved',
    },
    {
      id: 'ev_2',
      employeeId: 'em_bilal',
      voucherType: 'salary-advance',
      voucherNo: '02356897456124',
      voucherDate: day(6),
      amount: 75_000,
      paymentMethod: 'bank-transfer',
      purpose: 'Advance against next month’s salary.',
      comments: 'To be recovered in two instalments.',
      attachmentName: null,
      requestedById: 'em_bilal',
      approvedById: null,
      approvalDate: null,
      verifiedBy: 'Finance',
      verificationDate: null,
      status: 'pending',
    },
  ]
}

export function seedFinalSettlements(): FinalSettlement[] {
  const day = (back: number) => format(subDays(new Date(), back), 'yyyy-MM-dd')
  return [
    {
      id: 'fs_talha',
      employeeId: 'em_talha',
      reason: 'resignation',
      resignationDate: day(45),
      noticePeriod: true,
      lastWorkingDate: day(15),
      finalSettlement: true,
      attachmentName: 'resignation-letter.pdf',
      description: 'Moving abroad.',
      status: 'pending',
      payslipId: null,
    },
    {
      id: 'fs_nida',
      employeeId: 'em_nida',
      reason: 'resignation',
      resignationDate: day(80),
      noticePeriod: true,
      lastWorkingDate: day(50),
      finalSettlement: true,
      attachmentName: null,
      description: '',
      status: 'completed',
      payslipId: null,
    },
  ]
}

/** A recent working day for the seeded daily-wage batches. */
export function recentWorkday(back: number): string {
  let day = subDays(new Date(), back)
  while (day.getDay() === 0 || day.getDay() === 6) day = subDays(day, 1)
  return format(day, 'yyyy-MM-dd')
}

export const tomorrow = () => format(addDays(new Date(), 1), 'yyyy-MM-dd')
