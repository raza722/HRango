import { format, subDays, subMonths } from 'date-fns'

import type {
  AccountType,
  Benefit,
  DisbursementBank,
  Formula,
  IncentiveRow,
  PayItem,
  PayItemType,
  PayrollSettings,
  PayRule,
  TaxRebateRow,
  TaxSlab,
  TaxStructure,
} from '@/features/payroll'

import { mockFileUrl } from '../files/handlers'
import { branches } from '../settings/handlers'
import { personFields } from './people'

// Payroll Settings seed, in the API's shapes. Other mocks rely on these ids:
// pay items `pi_*` (the nine system items: pi_salary … pi_tax), formulas `f_*`,
// tax structure `tx_current`, banks `bank_ubl` / `bank_meezan`, account types `at_*`.

const stamp = (days: number) => subDays(new Date(), days).toISOString().slice(0, 19)
let version = 1
const rv = () => {
  version += 1
  return version.toString(16).padStart(16, '0')
}
const stamped = (days = 200) => ({ createdAt: stamp(days), updatedAt: null, rowVersion: rv() })

/** `{name}` as expressions refer to it: lower case, other characters as `_`. */
export const referenceOf = (name: string) =>
  `{${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')}}`

// --- formulas -------------------------------------------------------------------------------

const formula = (
  id: string,
  name: string,
  expression: string,
  extra: Partial<Formula> = {},
): Formula => ({
  id,
  name,
  reference: referenceOf(name),
  expression,
  isSalaryDivision: false,
  forIntegration: false,
  isCustom: true,
  description: null,
  ...stamped(),
  ...extra,
})

const system = (item: string) => ({
  isCustom: false,
  description: `Added by the system for the ${item} pay item.`,
})

export function seedFormulas(): Formula[] {
  return [
    formula('f_salary', 'Salary formula', '{gross_salary} * {employed_days} / {month_days}', {
      ...system('Salary'),
    }),
    formula(
      'f_overtime',
      'Overtime formula',
      '{gross_salary} / {applicable_days} / {day_minutes} * {overtime_minutes}',
      system('Overtime'),
    ),
    formula(
      'f_absent',
      'Absent deduction formula',
      '{gross_salary} / {applicable_days} * ({absent_days} + {half_days} * 0.5)',
      system('Absence Deductions'),
    ),
    formula(
      'f_leave',
      'Leave deduction formula',
      '{gross_salary} / {applicable_days} * {unpaid_leave_days}',
      system('Leave Deductions'),
    ),
    formula(
      'f_short',
      'Short deduction formula',
      '{gross_salary} / {applicable_days} / {day_minutes} * {short_minutes}',
      system('Short Deductions'),
    ),
    formula(
      'f_penalty',
      'Penalty deduction formula',
      '{gross_salary} / {applicable_days} * {penalty_days}',
      system('Penalty Deductions'),
    ),
    formula('f_per_day', 'Per Day Salary', '{gross_salary} / {applicable_days}', {
      isSalaryDivision: true,
      description: 'One day of the month’s salary.',
    }),
    formula('f_pf_employee', 'Provident Fund (Employee)', '{gross_salary} * 5 / 100'),
    formula('f_pf_employer', 'Provident Fund (Employer)', '{gross_salary} * 5 / 100'),
    formula('f_eobi_employer', 'EOBI (Employer)', '1850'),
  ]
}

// --- pay items --------------------------------------------------------------------------------

const payItem = (
  id: string,
  name: string,
  itemType: PayItemType,
  extra: Partial<PayItem> = {},
): PayItem => ({
  id,
  name,
  reference: referenceOf(name),
  label: name,
  itemType,
  calculationType: 'fixed',
  taxDistribution: 'current_month',
  employeeFormulaId: null,
  employeeFormulaName: null,
  expression: null,
  employerFormulaId: null,
  employerFormulaName: null,
  employerExpression: null,
  isTaxable: itemType === 'earning',
  isDisplayOnly: false,
  isBenefit: false,
  isAdvancePayment: false,
  eligibilityExpression: null,
  systemCode: null,
  description: null,
  ...stamped(),
  ...extra,
})

/** A formula pay item: the name and expression come from the formula. */
const withFormula = (formulaId: string, formulas: readonly Formula[]) => {
  const found = formulas.find((item) => item.id === formulaId)
  return {
    calculationType: 'formula' as const,
    employeeFormulaId: formulaId,
    employeeFormulaName: found?.name ?? null,
    expression: found?.expression ?? null,
  }
}

export function seedPayItems(): PayItem[] {
  const formulas = seedFormulas()
  const sys = (code: string) => ({ systemCode: code })
  return [
    // The nine items the API adds to every company (as GET /payroll/pay-items returns them).
    payItem('pi_salary', 'Salary', 'earning', {
      label: 'Gross Salary',
      ...withFormula('f_salary', formulas),
      ...sys('salary'),
    }),
    payItem('pi_overtime', 'Overtime', 'earning', {
      ...withFormula('f_overtime', formulas),
      ...sys('overtime'),
    }),
    payItem('pi_absent', 'Absent Deduction', 'deduction', {
      label: 'Absence Deductions',
      isTaxable: true,
      ...withFormula('f_absent', formulas),
      ...sys('absent_deduction'),
    }),
    payItem('pi_leave_deduction', 'Leave Deduction', 'deduction', {
      label: 'Leave Deductions',
      isTaxable: true,
      ...withFormula('f_leave', formulas),
      ...sys('leave_deduction'),
    }),
    payItem('pi_short', 'Short Deduction', 'deduction', {
      label: 'Short Deductions',
      isTaxable: true,
      ...withFormula('f_short', formulas),
      ...sys('short_deduction'),
    }),
    payItem('pi_penalty', 'Penalty Deduction', 'deduction', {
      label: 'Penalty Deductions',
      isTaxable: true,
      ...withFormula('f_penalty', formulas),
      ...sys('penalty_deduction'),
    }),
    payItem('pi_loan', 'Loan Deduction', 'deduction', {
      label: 'Loan / Advance Deduction',
      ...sys('loan_deduction'),
    }),
    payItem('pi_leave_encashment', 'Leave Encashment', 'earning', sys('leave_encashment')),
    payItem('pi_tax', 'Tax', 'deduction', { label: 'Income Tax', ...sys('tax') }),
    // The company's own.
    payItem('pi_pf', 'Provident Fund Deduction', 'deduction', {
      ...withFormula('f_pf_employee', formulas),
      employerFormulaId: 'f_pf_employer',
      employerFormulaName: 'Provident Fund (Employer)',
      employerExpression: '{gross_salary} * 5 / 100',
    }),
    payItem('pi_eobi', 'EOBI', 'deduction', {
      employerFormulaId: 'f_eobi_employer',
      employerFormulaName: 'EOBI (Employer)',
      employerExpression: '1850',
    }),
    payItem('pi_travel', 'Travel Allowance', 'earning', { taxDistribution: 'remaining_months' }),
    payItem('pi_medical', 'Medical', 'reimbursement', { isBenefit: true, isTaxable: false }),
    payItem('pi_expense', 'Expense', 'reimbursement', { isTaxable: false }),
    payItem('pi_lend', 'Lend', 'other', { isAdvancePayment: true, isTaxable: false }),
  ]
}

// --- rules, account types, banks ----------------------------------------------------------------

export function seedAccountTypes(): AccountType[] {
  const account = (
    id: string,
    code: number,
    name: string,
    category: AccountType['category'],
    refId: string | null,
    refName: string | null,
  ): AccountType => ({
    id,
    code: `ACT-${String(code).padStart(4, '0')}`,
    name,
    category,
    refId,
    refName,
    ...stamped(),
  })
  return [
    account('at_medical', 1, 'Medical', 'benefit', 'bn_medical', 'Medical Allowance'),
    account('at_sick', 2, 'Sick Leave', 'leave_quota', 'lt_sick', 'Sick Leave'),
    account('at_casual', 3, 'Casual Leaves', 'leave_quota', 'lt_casual', 'Casual Leave'),
    account('at_pf', 4, 'Provident Fund', 'custom_pay_item', 'pi_pf', 'Provident Fund Deduction'),
    account('at_eobi', 5, 'EOBI', 'custom_pay_item', 'pi_eobi', 'EOBI'),
    account(
      'at_loan',
      6,
      'Outstanding Loan/ Advance Payment',
      'custom_pay_item',
      'pi_lend',
      'Lend',
    ),
  ]
}

export function seedRules(): PayRule[] {
  return [
    {
      id: 'r_pf',
      name: 'Provident Fund Posting',
      expression: '{provident_fund_deduction} * 2',
      accountTypeId: 'at_pf',
      accountTypeName: 'Provident Fund',
      accountCategory: 'custom_pay_item',
      description: 'Employee and employer share into the provident fund account.',
      ...stamped(),
    },
  ]
}

export function seedBanks(): DisbursementBank[] {
  const bank = (
    id: string,
    bankName: string,
    branchName: string,
    branchCode: string,
    branchLocation: string,
    accountNumber: string,
    effectiveDate: string,
  ): DisbursementBank => ({
    id,
    accountHolder: 'Top Edge Technologies',
    accountNumber,
    bankName,
    branchName,
    branchCode,
    branchLocation,
    taxPayerId: '7364519-2',
    effectiveDate,
    description: null,
    ...stamped(),
  })
  return [
    bank(
      'bank_ubl',
      'UBL Digital Bank',
      'Gulberg Branch',
      '0245',
      'Lahore',
      '0245-1029384756',
      '2024-01-15',
    ),
    bank(
      'bank_meezan',
      'Meezan Bank',
      'Blue Area Branch',
      '0102',
      'Islamabad',
      '0102-0105566778',
      '2025-03-01',
    ),
  ]
}

// --- tax ------------------------------------------------------------------------------------------

/** The tax year (July to June) today falls in: its first calendar year. */
export const currentTaxYear = () =>
  new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1

export function seedTaxStructures(): TaxStructure[] {
  const year = currentTaxYear()
  let slabId = 0
  const slab = (
    minAmount: number,
    maxAmount: number | null,
    fixedAmount: number,
    percentage: number,
  ): TaxSlab => {
    slabId += 1
    return { id: `slab_${slabId}`, minAmount, maxAmount, fixedAmount, percentage }
  }
  const current = [
    slab(0, 600_000, 0, 0),
    slab(600_000, 1_200_000, 0, 1),
    slab(1_200_000, 2_200_000, 6_000, 11),
    slab(2_200_000, 3_200_000, 116_000, 23),
    slab(3_200_000, 4_100_000, 346_000, 30),
    slab(4_100_000, null, 616_000, 35),
  ]
  const previous = [
    slab(0, 600_000, 0, 0),
    slab(600_000, 1_200_000, 0, 2.5),
    slab(1_200_000, 2_400_000, 15_000, 12.5),
    slab(2_400_000, null, 165_000, 22.5),
  ]
  return [
    {
      id: 'tx_current',
      code: 'TXS-0002',
      name: `Tax Structure ${year}-${year + 1}`,
      startDate: `${year}-07-01`,
      endDate: `${year + 1}-06-30`,
      surchargeType: 'percentage',
      surchargeValue: 10,
      description: 'Salaried individuals, as notified for the tax year.',
      slabCount: current.length,
      slabs: current,
      ...stamped(),
    },
    {
      id: 'tx_previous',
      code: 'TXS-0001',
      name: `Tax Structure ${year - 1}-${year}`,
      startDate: `${year - 1}-07-01`,
      endDate: `${year}-06-30`,
      surchargeType: null,
      surchargeValue: null,
      description: null,
      slabCount: previous.length,
      slabs: previous,
      ...stamped(400),
    },
  ]
}

export function seedTaxRebates(): TaxRebateRow[] {
  const rebateDate = format(subDays(new Date(), 46), 'yyyy-MM-dd')
  const rebate = (
    id: string,
    employeeId: string,
    amount: number,
    file: { id: string; name: string } | null,
  ): TaxRebateRow => {
    const person = personFields(employeeId)
    return {
      id,
      employeeId,
      employeeCode: person.employeeCode,
      employeeName: person.employeeName,
      rebateDate,
      amount,
      fileId: file?.id ?? null,
      file: file ? { ...file, url: mockFileUrl(file.id) } : null,
      description: null,
      ...stamped(46),
    }
  }
  return [
    rebate('rb_1', 'em_hina', 15_000, { id: 'file_rebate1', name: 'donation-receipt.pdf' }),
    rebate('rb_2', 'em_bilal', 8_500, null),
  ]
}

// --- rewards --------------------------------------------------------------------------------------

export function seedBenefits(): Benefit[] {
  return [
    {
      id: 'bn_medical',
      name: 'Medical Allowance',
      benefitType: 'allowance',
      payItemId: 'pi_medical',
      payItemName: 'Medical',
      formulaId: null,
      formulaName: null,
      isGroup: false,
      isAccumulative: true,
      description: 'Out-patient bills, paid back with the salary.',
      memberCount: 0,
      members: [],
      fields: [
        {
          id: 'bf_1',
          name: 'Hospital',
          fieldType: 'string',
          isRequired: true,
          minValue: null,
          maxValue: null,
          minLength: 2,
          maxLength: 80,
          fieldValue: 'Panel hospital',
        },
        {
          id: 'bf_2',
          name: 'Bill Amount',
          fieldType: 'number',
          isRequired: true,
          minValue: 1,
          maxValue: 100_000,
          minLength: null,
          maxLength: null,
          fieldValue: '50000',
        },
      ],
      ...stamped(),
    },
    {
      id: 'bn_travel',
      name: 'Travel Allowance',
      benefitType: 'allowance',
      payItemId: 'pi_travel',
      payItemName: 'Travel Allowance',
      formulaId: 'f_per_day',
      formulaName: 'Per Day Salary',
      isGroup: true,
      isAccumulative: false,
      description: 'Field staff who travel for work.',
      memberCount: 2,
      members: [
        {
          id: 'bm_1',
          employeeId: 'em_sara',
          employeeName: 'Sara Khan',
          employeeGroupId: null,
          employeeGroupName: null,
        },
        {
          id: 'bm_2',
          employeeId: 'em_daniel',
          employeeName: 'Daniel Brooks',
          employeeGroupId: null,
          employeeGroupName: null,
        },
      ],
      fields: [],
      ...stamped(),
    },
  ]
}

export function seedIncentives(): IncentiveRow[] {
  const branchName = (id: string) => branches.find(id)?.name ?? id
  return [
    {
      id: 'inc_khi',
      branchId: 'br_khi',
      branchName: branchName('br_khi'),
      applicableMonth: format(new Date(), 'yyyy-MM-01'),
      incentiveType: 'part_of_salary',
      targetAmount: 5_000_000,
      valueType: 'percentage',
      rewardValue: 5,
      description: null,
      ...stamped(30),
    },
    {
      id: 'inc_isb',
      branchId: 'br_isb',
      branchName: branchName('br_isb'),
      applicableMonth: format(subMonths(new Date(), 1), 'yyyy-MM-01'),
      incentiveType: 'reimbursement',
      targetAmount: 2_500_000,
      valueType: 'flat',
      rewardValue: 25_000,
      description: null,
      ...stamped(60),
    },
  ]
}

// --- general ----------------------------------------------------------------------------------------

/** What `GET /payroll/settings/general` returns before anything is saved. */
export function defaultPayrollSettings(): PayrollSettings {
  return {
    excludeFinalSettlement: false,
    disableTaxDistributionOnFinalSettlement: false,
    hidePayslipAfterRun: false,
    salaryReportRounding: 'none',
    revisionOnFixedDays: false,
    revisionFixedDate: null,
    revisionOnShiftDays: false,
    revisionShiftDays: null,
    disableRevisionEmail: false,
    cutoffProration: false,
    cutoffDay: null,
    hideAttendanceSummary: false,
    showSalaryBreakdown: true,
    payslipColor: null,
    taxRounding: 'actual',
    taxPositiveOnly: false,
    notesEnglishEnabled: false,
    notesEnglish: null,
    notesOtherLanguage: null,
    printSignature: false,
    sendCloseEmail: false,
    payslipTemplate: 'default',
    prorationRounding: 'actual',
    showOnHoldAmounts: false,
    useShiftHours: false,
    showEmployeePayItems: true,
    cplLeaveTypeId: null,
    maxEarnedCpl: null,
    deductCasualLeaves: false,
    deductSickLeaves: false,
    leaveYearBasis: 'calendar',
    fiscalYearStartMonth: null,
    fiscalYearEndMonth: null,
    rowVersion: null,
  }
}
