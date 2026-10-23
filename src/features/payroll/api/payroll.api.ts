import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  AccountStatementRow,
  AccountType,
  AccountTypeInput,
  Benefit,
  BenefitInput,
  DailyWageBatchRow,
  DailyWageDetail,
  DailyWageInput,
  DisbursementBank,
  DisbursementBankInput,
  EmployeeAccountInput,
  EmployeeAccountReportRow,
  EmployeeAccountRow,
  EmployeeProfile,
  EmployeeVoucherInput,
  EmployeeVoucherRow,
  EmploymentRow,
  ExpenseReportRow,
  FinalSettlementRow,
  Formula,
  FormulaInput,
  IncentiveInput,
  IncentiveRow,
  LeaveEncashmentDetail,
  LeaveEncashmentInput,
  LeaveEncashmentRow,
  ListParams,
  MonthAmount,
  MyAccountsSummary,
  OpeningBalanceDetail,
  OpeningBalanceInput,
  OpeningBalanceRow,
  PayItem,
  PayItemInput,
  PayrollDashboard,
  PayrollError,
  PayrollHistoryEntry,
  PayrollInput,
  PayrollLookups,
  PayrollRow,
  PayrollSettings,
  PayRule,
  PayRuleInput,
  PayslipDetail,
  PayslipItemInput,
  PayslipRow,
  SalaryRevisionDetail,
  SalaryRevisionInput,
  SalaryRevisionRow,
  SalarySheet,
  TaxRebateInput,
  TaxRebateRow,
  TaxStructure,
  TaxStructureInput,
  VoucherRow,
} from '../types/payroll.types'

/** Query values: only what is set, so keys and URLs stay short. */
export function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== '' && value !== null,
    ),
  ) as Partial<T>
}

const path = (rest: string) => `/payroll${rest}`

async function getData<T>(url: string, params?: object, signal?: AbortSignal) {
  const { data } = await apiClient.get<ApiItem<T>>(path(url), {
    ...(params ? { params: compact(params) } : {}),
    signal,
  })
  return data.data
}

async function getPage<T>(url: string, params: object, signal?: AbortSignal) {
  const { data } = await apiClient.get<Paginated<T>>(path(url), { params: compact(params), signal })
  return data
}

async function send<T>(method: 'post' | 'put' | 'patch', url: string, body?: unknown) {
  const { data } = await apiClient[method]<ApiItem<T>>(path(url), body ?? {})
  return data.data
}

async function remove(url: string) {
  await apiClient.delete(path(url))
}

/** The filters every list can take: who, and where they work. */
export interface PeopleFilters {
  employeeId?: string | undefined
  branchId?: string | undefined
  locationId?: string | undefined
  department?: string | undefined
  designation?: string | undefined
  employmentStatus?: string | undefined
  code?: string | undefined
}

export type PageQuery<F = PeopleFilters> = ListParams & F

interface ResourceApi<TRow, TInput> {
  list: (params: PageQuery, signal?: AbortSignal) => Promise<Paginated<TRow>>
  get: (id: string, signal?: AbortSignal) => Promise<TRow>
  create: (input: TInput) => Promise<TRow>
  update: (id: string, input: TInput) => Promise<TRow>
  remove: (id: string) => Promise<void>
}

function resource<TRow, TInput>(url: string): ResourceApi<TRow, TInput> {
  return {
    list: (params, signal) => getPage<TRow>(url, params, signal),
    get: (id, signal) => getData<TRow>(`${url}/${id}`, undefined, signal),
    create: (input) => send<TRow>('post', url, input),
    update: (id, input) => send<TRow>('put', `${url}/${id}`, input),
    remove: (id) => remove(`${url}/${id}`),
  }
}

/** Payroll Settings lists, by name. */
export interface SettingsResources {
  payItems: { row: PayItem; input: PayItemInput }
  formulas: { row: Formula; input: FormulaInput }
  rules: { row: PayRule; input: PayRuleInput }
  accountTypes: { row: AccountType; input: AccountTypeInput }
  banks: { row: DisbursementBank; input: DisbursementBankInput }
  taxStructures: { row: TaxStructure; input: TaxStructureInput }
  taxRebates: { row: TaxRebateRow; input: TaxRebateInput }
  benefits: { row: Benefit; input: BenefitInput }
  incentives: { row: IncentiveRow; input: IncentiveInput }
}
export type SettingsResourceName = keyof SettingsResources

const settingsResources: {
  [N in SettingsResourceName]: ResourceApi<
    SettingsResources[N]['row'],
    SettingsResources[N]['input']
  >
} = {
  payItems: resource('/pay-items'),
  formulas: resource('/formulas'),
  rules: resource('/rules'),
  accountTypes: resource('/account-types'),
  banks: resource('/banks'),
  taxStructures: resource('/tax-structures'),
  taxRebates: resource('/tax-rebates'),
  benefits: resource('/benefits'),
  incentives: resource('/incentives'),
}

export interface PayslipFilters extends PeopleFilters {
  scope?: 'my' | 'all'
  status?: string | undefined
  payrollId?: string | undefined
  month?: string | undefined
  earningsFrom?: number | undefined
  earningsTo?: number | undefined
  deductionFrom?: number | undefined
  deductionTo?: number | undefined
  netFrom?: number | undefined
  netTo?: number | undefined
}

export interface DailyWageFilters {
  timeSlotId?: string | undefined
  name?: string | undefined
  from?: string | undefined
  to?: string | undefined
}

export interface VoucherFilters extends PeopleFilters {
  amountFrom?: number | undefined
  amountTo?: number | undefined
  voucherCode?: string | undefined
  type?: string | undefined
  date?: string | undefined
}

export interface BalanceFilters extends PeopleFilters {
  balanceCode?: string | undefined
  netFrom?: number | undefined
  netTo?: number | undefined
  month?: string | undefined
}

export interface RevisionFilters extends PeopleFilters {
  from?: string | undefined
  to?: string | undefined
}

export interface EncashmentFilters extends PeopleFilters {
  leaveTypeId?: string | undefined
  year?: number | undefined
}

export interface ImportResult {
  created: number
  errors: string[]
}

export interface BalanceImportRow {
  employeeCode: string
  payItem: string
  month: string
  amount: number
  taxable: boolean
  description: string
}

export const payrollApi = {
  lookups: (signal?: AbortSignal) => getData<PayrollLookups>('/lookups', undefined, signal),

  // Settings
  settings: (signal?: AbortSignal) => getData<PayrollSettings>('/settings', undefined, signal),
  saveSettings: (input: PayrollSettings) => send<PayrollSettings>('put', '/settings', input),
  resource: <N extends SettingsResourceName>(name: N) => settingsResources[name],

  // Payrolls → Monthly
  payrolls: (params: ListParams, signal?: AbortSignal) =>
    getPage<PayrollRow>('/payrolls', params, signal),
  payroll: (id: string, signal?: AbortSignal) =>
    getData<PayrollRow>(`/payrolls/${id}`, undefined, signal),
  createPayroll: (input: PayrollInput) => send<PayrollRow>('post', '/payrolls', input),
  updatePayroll: (id: string, input: PayrollInput) =>
    send<PayrollRow>('put', `/payrolls/${id}`, input),
  runPayroll: (id: string) => send<PayrollRow>('post', `/payrolls/${id}/run`),
  closePayroll: (id: string) => send<PayrollRow>('post', `/payrolls/${id}/close`),
  holdPayrolls: (ids: string[]) => send<{ held: number }>('post', '/payrolls/hold', { ids }),
  employments: (id: string, search: string, signal?: AbortSignal) =>
    getData<EmploymentRow[]>(`/payrolls/${id}/employments`, { search }, signal),
  setEmployments: (id: string, employeeIds: string[]) =>
    send<PayrollRow>('put', `/payrolls/${id}/employments`, { employeeIds }),
  payrollHistory: (id: string, signal?: AbortSignal) =>
    getData<PayrollHistoryEntry[]>(`/payrolls/${id}/history`, undefined, signal),
  payrollErrors: (id: string, signal?: AbortSignal) =>
    getData<PayrollError[]>(`/payrolls/${id}/errors`, undefined, signal),

  salarySheet: (
    params: { payrollId?: string | undefined; month?: string | undefined },
    signal?: AbortSignal,
  ) => getData<SalarySheet>('/salary-sheet', params, signal),

  // Pay Slips
  payslips: (params: PageQuery<PayslipFilters>, signal?: AbortSignal) =>
    getPage<PayslipRow>('/payslips', params, signal),
  myAccounts: (signal?: AbortSignal) =>
    getData<MyAccountsSummary>('/payslips/summary', undefined, signal),
  payslip: (id: string, signal?: AbortSignal) =>
    getData<PayslipDetail>(`/payslips/${id}`, undefined, signal),
  updatePayslip: (id: string, items: PayslipItemInput[]) =>
    send<PayslipDetail>('put', `/payslips/${id}`, { items }),
  payslipAction: (id: string, action: 'hold' | 'pay' | 'recalculate') =>
    send<PayslipDetail>('post', `/payslips/${id}/${action}`),
  holdPayslips: (ids: string[]) => send<{ held: number }>('post', '/payslips/hold', { ids }),

  // Payrolls → Daily Wages
  dailyWages: (params: PageQuery<DailyWageFilters>, signal?: AbortSignal) =>
    getPage<DailyWageBatchRow>('/daily-wages', params, signal),
  dailyWage: (id: string, signal?: AbortSignal) =>
    getData<DailyWageDetail>(`/daily-wages/${id}`, undefined, signal),
  createDailyWage: (input: DailyWageInput) =>
    send<DailyWageBatchRow>('post', '/daily-wages', input),
  updateDailyWage: (
    id: string,
    input: {
      name: string
      rows: { employeeId: string; totalEarnings: number; totalDeductions: number; wage: number }[]
    },
  ) => send<DailyWageDetail>('put', `/daily-wages/${id}`, input),
  dailyWageVouchers: (id: string) =>
    send<{ created: number }>('post', `/daily-wages/${id}/vouchers`),

  // Vouchers
  vouchers: (params: PageQuery<VoucherFilters>, signal?: AbortSignal) =>
    getPage<VoucherRow>('/vouchers', params, signal),
  deleteVoucher: (id: string) => remove(`/vouchers/${id}`),
  employeeVouchers: resource<EmployeeVoucherRow, EmployeeVoucherInput>('/employee-vouchers'),

  // Final Settlement
  finalSettlements: (
    params: PageQuery<{ month?: string | undefined } & PeopleFilters>,
    signal?: AbortSignal,
  ) => getPage<FinalSettlementRow>('/final-settlements', params, signal),
  finalSettlement: (id: string, signal?: AbortSignal) =>
    getData<FinalSettlementRow & { profile: EmployeeProfile }>(
      `/final-settlements/${id}`,
      undefined,
      signal,
    ),
  finalSettlementPayslip: (id: string, signal?: AbortSignal) =>
    getData<PayslipDetail>(`/final-settlements/${id}/payslip`, undefined, signal),
  finalSettlementAction: (id: string, action: 'recalculate' | 'close') =>
    send<FinalSettlementRow>('post', `/final-settlements/${id}/${action}`),

  // Balances
  openingBalances: (params: PageQuery<BalanceFilters>, signal?: AbortSignal) =>
    getPage<OpeningBalanceRow>('/opening-balances', params, signal),
  openingBalance: (id: string, signal?: AbortSignal) =>
    getData<OpeningBalanceDetail>(`/opening-balances/${id}`, undefined, signal),
  addOpeningBalance: (input: OpeningBalanceInput) =>
    send<OpeningBalanceRow>('post', '/opening-balances', input),
  importOpeningBalances: (kind: 'opening-balance' | 'provident-fund', rows: BalanceImportRow[]) =>
    send<ImportResult>('post', '/opening-balances/import', { kind, rows }),
  employeeAccounts: (params: PageQuery<BalanceFilters>, signal?: AbortSignal) =>
    getPage<EmployeeAccountRow>('/employee-accounts', params, signal),
  employeeAccount: (id: string, signal?: AbortSignal) =>
    getData<EmployeeAccountRow>(`/employee-accounts/${id}`, undefined, signal),
  createEmployeeAccount: (input: EmployeeAccountInput) =>
    send<EmployeeAccountRow>('post', '/employee-accounts', input),
  updateEmployeeAccount: (id: string, input: EmployeeAccountInput) =>
    send<EmployeeAccountRow>('put', `/employee-accounts/${id}`, input),
  importEmployeeAccounts: (kind: 'opening-balance' | 'provident-fund', rows: BalanceImportRow[]) =>
    send<ImportResult>('post', '/employee-accounts/import', { kind, rows }),
  accountStatement: (params: PageQuery<BalanceFilters>, signal?: AbortSignal) =>
    getPage<AccountStatementRow>('/account-statement', params, signal),

  // Salary Revision
  salaryRevisions: (params: PageQuery<RevisionFilters>, signal?: AbortSignal) =>
    getPage<SalaryRevisionRow>('/salary-revisions', params, signal),
  salaryRevision: (id: string, signal?: AbortSignal) =>
    getData<SalaryRevisionDetail>(`/salary-revisions/${id}`, undefined, signal),
  currentSalary: (employeeId: string, date: string, signal?: AbortSignal) =>
    getData<{ salary: number; profile: EmployeeProfile }>(
      `/salary-revisions/current/${employeeId}`,
      { date },
      signal,
    ),
  createSalaryRevision: (input: SalaryRevisionInput) =>
    send<SalaryRevisionRow>('post', '/salary-revisions', input),
  updateSalaryRevision: (id: string, input: SalaryRevisionInput) =>
    send<SalaryRevisionRow>('put', `/salary-revisions/${id}`, input),
  deleteSalaryRevision: (id: string) => remove(`/salary-revisions/${id}`),
  importSalaryRevisions: (
    rows: { employeeCode: string; effectiveDate: string; salary: number }[],
  ) => send<ImportResult>('post', '/salary-revisions/import', { rows }),

  // Leave Encashment
  leaveEncashments: (params: PageQuery<EncashmentFilters>, signal?: AbortSignal) =>
    getPage<LeaveEncashmentRow>('/leave-encashments', params, signal),
  leaveEncashment: (id: string, signal?: AbortSignal) =>
    getData<LeaveEncashmentDetail>(`/leave-encashments/${id}`, undefined, signal),
  createLeaveEncashment: (input: LeaveEncashmentInput) =>
    send<LeaveEncashmentDetail>('post', '/leave-encashments', input),
  updateLeaveEncashment: (id: string, input: LeaveEncashmentInput) =>
    send<LeaveEncashmentDetail>('put', `/leave-encashments/${id}`, input),
  deleteLeaveEncashment: (id: string) => remove(`/leave-encashments/${id}`),

  // Reports, dashboard
  employeeAccountReport: (params: PageQuery, signal?: AbortSignal) =>
    getPage<EmployeeAccountReportRow>('/reports/employee-accounts', params, signal),
  dashboard: (signal?: AbortSignal) => getData<PayrollDashboard>('/dashboard', undefined, signal),
  employeeEarning: (employeeId: string, signal?: AbortSignal) =>
    getData<MonthAmount[]>(`/dashboard/employees/${employeeId}`, undefined, signal),
  expenseReport: (month: string, signal?: AbortSignal) =>
    getData<ExpenseReportRow[]>('/dashboard/expenses', { month }, signal),
}

export const payrollKeys = {
  all: ['payroll'] as const,
  lookups: () => [...payrollKeys.all, 'lookups'] as const,
  settings: () => [...payrollKeys.all, 'settings'] as const,
  resource: (name: SettingsResourceName, params?: object) =>
    params
      ? ([...payrollKeys.all, name, compact(params)] as const)
      : ([...payrollKeys.all, name] as const),
  payrolls: (params?: object) =>
    params
      ? ([...payrollKeys.all, 'payrolls', compact(params)] as const)
      : ([...payrollKeys.all, 'payrolls'] as const),
  payroll: (id: string, part: string) => [...payrollKeys.all, 'payrolls', id, part] as const,
  list: (name: string, params?: object) =>
    params
      ? ([...payrollKeys.all, name, compact(params)] as const)
      : ([...payrollKeys.all, name] as const),
  detail: (name: string, id: string) => [...payrollKeys.all, name, 'detail', id] as const,
}

export const lookupsQueryOptions = () =>
  queryOptions({
    queryKey: payrollKeys.lookups(),
    queryFn: ({ signal }) => payrollApi.lookups(signal),
    staleTime: 60_000,
  })

export const resourceQueryOptions = <N extends SettingsResourceName>(name: N, params: PageQuery) =>
  queryOptions({
    queryKey: payrollKeys.resource(name, params),
    queryFn: ({ signal }) => payrollApi.resource(name).list(params, signal),
    placeholderData: keepPreviousData,
  })

/** A paginated list; `fetch` is the matching `payrollApi` call. */
export const listQueryOptions = <TRow, TParams extends object>(
  name: string,
  params: TParams,
  fetch: (params: TParams, signal?: AbortSignal) => Promise<Paginated<TRow>>,
) =>
  queryOptions({
    queryKey: payrollKeys.list(name, params),
    queryFn: ({ signal }) => fetch(params, signal),
    placeholderData: keepPreviousData,
  })
