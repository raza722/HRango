import { format, subDays } from 'date-fns'

import type {
  AccountType,
  Benefit,
  DailyWageBatch,
  DisbursementBank,
  EmployeeAccountEntry,
  EmployeeVoucher,
  FinalSettlement,
  Formula,
  Incentive,
  LeaveEncashment,
  OpeningBalance,
  PayItem,
  Payroll,
  PayrollSettings,
  PayRule,
  Payslip,
  SalaryRevision,
  TaxRebate,
  TaxStructure,
  Voucher,
} from '@/features/payroll'

import { createMockCollection } from '../collection'
import { DIRECTORY } from '../employees/seed'
import { profileOf } from '../scheduling/seed'
import {
  defaultPayrollSettings,
  lastMonth,
  recentWorkday,
  seedAccountEntries,
  seedAccountTypes,
  seedBanks,
  seedBenefits,
  seedEmployeeVouchers,
  seedEncashmentVouchers,
  seedFinalSettlements,
  seedFormulas,
  seedIncentives,
  seedLeaveEncashments,
  seedOpeningBalances,
  seedPayItems,
  seedRules,
  seedSalaryRevisions,
  seedTaxRebates,
  seedTaxStructures,
  STANDARD_PAY_ITEMS,
  thisMonth,
} from './seed'

const key = (name: string) => `hrms-mock-payroll-${name}`

export const payItems = createMockCollection<PayItem>({
  storageKey: key('pay-items'),
  seed: seedPayItems,
})
export const formulas = createMockCollection<Formula>({
  storageKey: key('formulas'),
  seed: seedFormulas,
})
export const payRules = createMockCollection<PayRule>({ storageKey: key('rules'), seed: seedRules })
export const accountTypes = createMockCollection<AccountType>({
  storageKey: key('account-types'),
  seed: seedAccountTypes,
})
export const banks = createMockCollection<DisbursementBank>({
  storageKey: key('banks'),
  seed: seedBanks,
})
export const taxStructures = createMockCollection<TaxStructure>({
  storageKey: key('tax-structures'),
  seed: seedTaxStructures,
})
export const taxRebates = createMockCollection<TaxRebate>({
  storageKey: key('tax-rebates'),
  seed: seedTaxRebates,
})
export const benefits = createMockCollection<Benefit>({
  storageKey: key('benefits'),
  seed: seedBenefits,
})
export const incentives = createMockCollection<Incentive>({
  storageKey: key('incentives'),
  seed: seedIncentives,
})
export const payrollSettingsStore = createMockCollection<PayrollSettings & { id: string }>({
  storageKey: key('settings'),
  seed: () => [{ id: 'settings', ...defaultPayrollSettings() }],
})

export function currentPayrollSettings(): PayrollSettings {
  return payrollSettingsStore.find('settings') ?? defaultPayrollSettings()
}

export const salaryRevisions = createMockCollection<SalaryRevision>({
  storageKey: key('salary-revisions'),
  seed: seedSalaryRevisions,
})
export const openingBalances = createMockCollection<OpeningBalance>({
  storageKey: key('opening-balances'),
  seed: seedOpeningBalances,
})
export const accountEntries = createMockCollection<EmployeeAccountEntry>({
  storageKey: key('account-entries'),
  seed: seedAccountEntries,
})
export const employeeVouchers = createMockCollection<EmployeeVoucher>({
  storageKey: key('employee-vouchers'),
  seed: seedEmployeeVouchers,
})
export const finalSettlements = createMockCollection<FinalSettlement>({
  storageKey: key('final-settlements'),
  seed: seedFinalSettlements,
})
export const leaveEncashments = createMockCollection<LeaveEncashment>({
  storageKey: key('leave-encashments'),
  seed: seedLeaveEncashments,
})

// --- runs ----------------------------------------------------------------------------------

const activeIn = (branchIds: readonly string[]) =>
  DIRECTORY.filter(
    (employee) =>
      employee.branchId !== null &&
      branchIds.includes(employee.branchId) &&
      profileOf(employee).status === 'active',
  ).map((employee) => employee.id)

const rows = (ids: readonly string[]) =>
  ids.map((payItemId) => ({
    payItemId,
    taxable: payItemId === 'pi_gross_salary' || payItemId === 'pi_overtime',
    arrearApplicable: false,
    finalSettlement: true,
    calculateOnly: false,
  }))

const at = (back: number, time = '16:22') =>
  `${format(subDays(new Date(), back), 'yyyy-MM-dd')}T${time}:00.000Z`

/** Three payrolls: one running this month, one closed last month, one on hold. */
export function seedPayrolls(): Payroll[] {
  const history = (entries: [Payroll['history'][number]['action'], string, number][]) =>
    entries.map(([action, month, back], index) => ({
      id: `ph_${index}_${back}`,
      action,
      month,
      performedAt: at(back),
      performedBy: 'Shelley Kannes',
    }))
  const common = {
    currency: 'PKR' as const,
    taxStructureId: 'ts_current',
    taxApplicable: true,
    processing: 'month-end' as const,
    processingDay: 28,
    applicableDays: 'actual' as const,
    fixedDays: null,
    createdAt: at(120),
  }
  return [
    {
      ...common,
      id: 'pr_6',
      code: 'PR-00006',
      name: 'Head Office (Pakistan-PKR)',
      companyBankId: 'bank_ubl',
      description: 'Head office staff in Lahore.',
      payItems: rows(STANDARD_PAY_ITEMS),
      employeeIds: activeIn(['br_lhr_ho']),
      month: thisMonth(),
      status: 'run',
      lastRunAt: at(1),
      lastClosedAt: at(21),
      history: history([
        ['Created', lastMonth(), 120],
        ['Run', lastMonth(), 23],
        ['Closed', lastMonth(), 21],
        ['Run', thisMonth(), 1],
      ]),
      errors: [],
    },
    {
      ...common,
      id: 'pr_7',
      code: 'PR-00007',
      name: 'Software (Pakistan-PKR)',
      companyBankId: 'bank_meezan',
      description: 'Johar Town and Rawalpindi software teams.',
      payItems: rows([...STANDARD_PAY_ITEMS, 'pi_travel_daily']),
      employeeIds: activeIn(['br_lhr_jt', 'br_rwp']),
      month: lastMonth(),
      status: 'closed',
      lastRunAt: at(24),
      lastClosedAt: at(21),
      history: history([
        ['Created', lastMonth(), 110],
        ['Run', lastMonth(), 24],
        ['Closed', lastMonth(), 21],
      ]),
      errors: [],
    },
    {
      ...common,
      id: 'pr_8',
      code: 'PR-00008',
      name: 'Abdul (Pakistan-PKR)',
      companyBankId: null,
      description: 'Islamabad and Karachi offices.',
      payItems: rows(STANDARD_PAY_ITEMS),
      employeeIds: activeIn(['br_isb', 'br_khi']),
      month: thisMonth(),
      status: 'on-hold',
      lastRunAt: at(2),
      lastClosedAt: null,
      history: history([
        ['Created', thisMonth(), 30],
        ['Run', thisMonth(), 2],
        ['On Hold', thisMonth(), 2],
      ]),
      errors: [],
    },
  ]
}

export const payrolls = createMockCollection<Payroll>({
  storageKey: key('payrolls'),
  seed: seedPayrolls,
})

/** Computed by the engine on first use (see `ensurePayrollRuns`). */
export const payslips = createMockCollection<Payslip>({
  storageKey: key('payslips'),
  seed: () => [],
})

export function seedDailyWages(): DailyWageBatch[] {
  return [
    {
      id: 'dw_1',
      code: 'DW-00001',
      name: 'Daily Wages',
      date: recentWorkday(5),
      timeSlotId: 'rg_morning',
      employeeIds: ['em_kashif', 'em_imran'],
      overrides: {},
      status: 'closed',
      createdAt: at(5),
    },
    {
      id: 'dw_2',
      code: 'DW-00002',
      name: 'Event Helpers',
      date: recentWorkday(2),
      timeSlotId: 'rg_morning',
      employeeIds: ['em_sadia'],
      overrides: {},
      status: 'closed',
      createdAt: at(2),
    },
  ]
}

export const dailyWages = createMockCollection<DailyWageBatch>({
  storageKey: key('daily-wages'),
  seed: seedDailyWages,
})

export function seedVouchers(): Voucher[] {
  return [
    {
      id: 'vc_1',
      code: '1100',
      employeeId: 'em_kashif',
      amount: 4_200,
      date: recentWorkday(5),
      type: 'daily-wages',
    },
    {
      id: 'vc_2',
      code: '55',
      employeeId: 'em_saad',
      amount: 50_000,
      date: recentWorkday(18),
      type: 'expense-reimbursement',
    },
    ...seedEncashmentVouchers(),
  ]
}

export const vouchers = createMockCollection<Voucher>({
  storageKey: key('vouchers'),
  seed: seedVouchers,
})

const RESETTABLE = [
  payItems,
  formulas,
  payRules,
  accountTypes,
  banks,
  taxStructures,
  taxRebates,
  benefits,
  incentives,
  payrollSettingsStore,
  salaryRevisions,
  openingBalances,
  accountEntries,
  employeeVouchers,
  finalSettlements,
  leaveEncashments,
  payrolls,
  payslips,
  dailyWages,
  vouchers,
]

/** Listeners that must forget cached work when the data is reset (the engine's seeding flag). */
const resetHooks: (() => void)[] = []
export const onPayrollReset = (hook: () => void) => {
  resetHooks.push(hook)
}

export function resetPayrollDb(): void {
  for (const collection of RESETTABLE) collection.reset()
  for (const hook of resetHooks) hook()
}
