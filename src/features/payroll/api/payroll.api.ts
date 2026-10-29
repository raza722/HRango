import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { type EmployeeLookupParams, fetchEmployeeLookup } from '@/hooks/use-employee-lookup'
import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  AccountImportRow,
  AccountStatementRow,
  AccountType,
  AccountTypeInput,
  Benefit,
  BenefitInput,
  ChangedResult,
  CurrentSalary,
  DailyWageBatchRow,
  DailyWageDetail,
  DailyWageEditInput,
  DailyWageInput,
  DailyWagesReportRow,
  DisbursementBank,
  DisbursementBankInput,
  EmployeeAccountInput,
  EmployeeAccountReportRow,
  EmployeeAccountRow,
  EmployeeCount,
  EmployeeFilterInput,
  EmployeeLookup,
  EmployeeWiseRow,
  ExpressionCheck,
  ExpressionVariable,
  FinalSettlementCloseInput,
  FinalSettlementRow,
  Formula,
  FormulaInput,
  ImportResult,
  IncentiveInput,
  IncentiveRow,
  LeaveEncashmentDetail,
  LeaveEncashmentInput,
  LeaveEncashmentRow,
  LeaveTypeOption,
  ListParams,
  LookupItem,
  MyAccountsSummary,
  OpeningBalanceDetail,
  OpeningBalanceEntry,
  OpeningBalanceImportRow,
  OpeningBalanceInput,
  OpeningBalanceRow,
  PayItem,
  PayItemInput,
  PayrollDashboard,
  PayrollEmployeeRow,
  PayrollError,
  PayrollInput,
  PayrollRow,
  PayrollSettings,
  PayrollSummary,
  PayRule,
  PayRuleInput,
  PayslipDetail,
  PayslipHistoryEntry,
  PayslipLineInput,
  PayslipRow,
  RunLog,
  SalaryImportRow,
  SalaryRevisionInput,
  SalaryRevisionRow,
  SalarySheet,
  TaxRebateInput,
  TaxRebateRow,
  TaxStructure,
  TaxStructureInput,
  TimeSlotOption,
  VoucherDecisionInput,
  VoucherInput,
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

/** `DELETE` with the row version last read (`?rowVersion=`). */
async function remove(url: string, rowVersion?: string | null) {
  await apiClient.delete(path(url), rowVersion ? { params: { rowVersion } } : undefined)
}

/** Filters the people lists take (all ids are the API's string ids). */
export interface PeopleFilters {
  employeeId?: string | undefined
  branchId?: string | undefined
  locationId?: string | undefined
  departmentId?: string | undefined
  designationId?: string | undefined
  employmentStatus?: string | undefined
}

export type PageQuery<F = PeopleFilters> = ListParams & F

interface ResourceApi<TRow, TInput> {
  list: (
    params: PageQuery<Record<string, unknown>>,
    signal?: AbortSignal,
  ) => Promise<Paginated<TRow>>
  get: (id: string, signal?: AbortSignal) => Promise<TRow>
  create: (input: TInput) => Promise<TRow>
  update: (id: string, input: TInput) => Promise<TRow>
  remove: (id: string, rowVersion?: string | null) => Promise<void>
}

function resource<TRow, TInput>(url: string): ResourceApi<TRow, TInput> {
  return {
    list: (params, signal) => getPage<TRow>(url, params, signal),
    get: (id, signal) => getData<TRow>(`${url}/${id}`, undefined, signal),
    create: (input) => send<TRow>('post', url, input),
    update: (id, input) => send<TRow>('put', `${url}/${id}`, input),
    remove: (id, rowVersion) => remove(`${url}/${id}`, rowVersion),
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
  banks: resource('/disbursement-banks'),
  taxStructures: resource('/tax-structures'),
  taxRebates: resource('/tax-rebates'),
  benefits: resource('/benefits'),
  incentives: resource('/incentives'),
}

export interface PayrollListFilters {
  status?: string | undefined
  month?: string | undefined
}

export interface PayslipFilters {
  scope?: 'my' | 'all'
  status?: string | undefined
  payrollId?: string | undefined
  month?: string | undefined
  employeeId?: string | undefined
  branchId?: string | undefined
  departmentId?: string | undefined
  employmentStatus?: string | undefined
  finalSettlement?: boolean | undefined
  earningsFrom?: number | undefined
  earningsTo?: number | undefined
  deductionFrom?: number | undefined
  deductionTo?: number | undefined
  netFrom?: number | undefined
  netTo?: number | undefined
}

export interface DailyWageFilters {
  status?: string | undefined
  timeSlotId?: string | undefined
  from?: string | undefined
  to?: string | undefined
}

export interface VoucherFilters {
  employeeId?: string | undefined
  departmentId?: string | undefined
  designationId?: string | undefined
  type?: string | undefined
  status?: string | undefined
  voucherCode?: string | undefined
  payrollId?: string | undefined
  from?: string | undefined
  to?: string | undefined
  amountFrom?: number | undefined
  amountTo?: number | undefined
}

export interface FinalSettlementFilters {
  status?: string | undefined
  month?: string | undefined
  branchId?: string | undefined
  departmentId?: string | undefined
  locationId?: string | undefined
  employmentStatus?: string | undefined
}

export interface OpeningBalanceFilters {
  employeeId?: string | undefined
  departmentId?: string | undefined
  month?: string | undefined
  netFrom?: number | undefined
  netTo?: number | undefined
}

export interface AccountFilters {
  scope?: 'my' | 'all'
  employeeId?: string | undefined
  accountTypeId?: string | undefined
  month?: string | undefined
}

export interface StatementFilters {
  employeeId?: string | undefined
  accountTypeId?: string | undefined
  from?: string | undefined
  to?: string | undefined
}

export interface RevisionFilters {
  employeeId?: string | undefined
  from?: string | undefined
  to?: string | undefined
  salaryFrom?: number | undefined
  salaryTo?: number | undefined
}

export interface EncashmentFilters {
  leaveTypeId?: string | undefined
  year?: number | undefined
  employeeId?: string | undefined
}

export interface ReportFilters {
  from?: string | undefined
  to?: string | undefined
  departmentId?: string | undefined
  employeeId?: string | undefined
}

/** An import: the rows read from the sheet, or an uploaded CSV (`fileId`). */
export type ImportBody<Row> = { rows: Row[] } | { fileId: string }

/** Kept name: an opening balance import row. */
export type BalanceImportRow = OpeningBalanceImportRow

export type { ImportResult }

export const payrollApi = {
  // Settings → General
  settings: (signal?: AbortSignal) =>
    getData<PayrollSettings>('/settings/general', undefined, signal),
  saveSettings: (input: PayrollSettings) =>
    send<PayrollSettings>('put', '/settings/general', input),
  variables: (signal?: AbortSignal) =>
    getData<ExpressionVariable[]>('/settings/variables', undefined, signal),
  checkExpression: (expression: string, kind: 'value' | 'condition' = 'value') =>
    send<ExpressionCheck>('post', '/settings/expressions/check', { expression, kind }),
  resource: <N extends SettingsResourceName>(name: N) => settingsResources[name],

  // Payrolls → Monthly
  payrolls: (params: PageQuery<PayrollListFilters>, signal?: AbortSignal) =>
    getPage<PayrollRow>('/payrolls', params, signal),
  payroll: (id: string, signal?: AbortSignal) =>
    getData<PayrollRow>(`/payrolls/${id}`, undefined, signal),
  createPayroll: (input: PayrollInput) => send<PayrollRow>('post', '/payrolls', input),
  updatePayroll: (id: string, input: PayrollInput) =>
    send<PayrollRow>('put', `/payrolls/${id}`, input),
  deletePayroll: (id: string, rowVersion: string) => remove(`/payrolls/${id}`, rowVersion),
  runPayroll: (id: string) => send<RunLog>('post', `/payrolls/${id}/run`),
  closePayroll: (id: string, rowVersion: string) =>
    send<PayrollRow>('post', `/payrolls/${id}/close`, { rowVersion }),
  holdPayroll: (id: string, hold: boolean) =>
    send<PayrollRow>('post', `/payrolls/${id}/${hold ? 'hold' : 'unhold'}`),
  payrollEmployees: (id: string, q: string, signal?: AbortSignal) =>
    getData<PayrollEmployeeRow[]>(`/payrolls/${id}/employees`, { q }, signal),
  setPayrollEmployees: (id: string, employeeIds: string[]) =>
    send<EmployeeCount>('put', `/payrolls/${id}/employees`, { employeeIds }),
  addPayrollEmployees: (id: string, filter: EmployeeFilterInput) =>
    send<EmployeeCount>('post', `/payrolls/${id}/employees/add`, compact(filter)),
  payrollHistory: (id: string, signal?: AbortSignal) =>
    getData<RunLog[]>(`/payrolls/${id}/history`, undefined, signal),
  payrollErrors: (id: string, runLogId?: string, signal?: AbortSignal) =>
    getData<PayrollError[]>(`/payrolls/${id}/errors`, { runLogId }, signal),

  salarySheet: (
    params: { payrollId?: string | undefined; month?: string | undefined },
    signal?: AbortSignal,
  ) => getData<SalarySheet>('/salary-sheet', params, signal),

  // Pay Slips
  payslips: (params: PageQuery<PayslipFilters>, signal?: AbortSignal) =>
    getPage<PayslipRow>('/payslips', params, signal),
  myAccounts: (employeeId?: string, signal?: AbortSignal) =>
    getData<MyAccountsSummary>('/payslips/summary', { employeeId }, signal),
  payslip: (id: string, signal?: AbortSignal) =>
    getData<PayslipDetail>(`/payslips/${id}`, undefined, signal),
  updatePayslip: (id: string, lines: PayslipLineInput[], rowVersion: string) =>
    send<PayslipDetail>('put', `/payslips/${id}`, { lines, rowVersion }),
  payslipAction: (id: string, action: 'hold' | 'unhold' | 'pay' | 'recalculate') =>
    send<PayslipDetail>('post', `/payslips/${id}/${action}`),
  payslipsBulk: (ids: string[], action: 'hold' | 'unhold' | 'pay' | 'recalculate') =>
    send<ChangedResult>('post', `/payslips/${action}`, { ids }),
  payslipHistory: (id: string, signal?: AbortSignal) =>
    getData<PayslipHistoryEntry[]>(`/payslips/${id}/history`, undefined, signal),

  // Payrolls → Daily Wages
  dailyWages: (params: PageQuery<DailyWageFilters>, signal?: AbortSignal) =>
    getPage<DailyWageBatchRow>('/daily-wages', params, signal),
  dailyWage: (id: string, signal?: AbortSignal) =>
    getData<DailyWageDetail>(`/daily-wages/${id}`, undefined, signal),
  createDailyWage: (input: DailyWageInput) => send<DailyWageDetail>('post', '/daily-wages', input),
  updateDailyWage: (id: string, input: DailyWageEditInput) =>
    send<DailyWageDetail>('put', `/daily-wages/${id}`, input),
  setDailyWageEmployees: (id: string, employeeIds: string[]) =>
    send<EmployeeCount>('put', `/daily-wages/${id}/employees`, { employeeIds }),
  deleteDailyWage: (id: string, rowVersion: string) => remove(`/daily-wages/${id}`, rowVersion),
  processDailyWage: (id: string) => send<RunLog>('post', `/daily-wages/${id}/process`),
  closeDailyWage: (id: string, rowVersion: string) =>
    send<PayrollRow>('post', `/daily-wages/${id}/close`, { rowVersion }),
  dailyWageVouchers: (id: string) =>
    send<{ created: number }>('post', `/daily-wages/${id}/vouchers`),
  dailyWageErrors: (id: string, signal?: AbortSignal) =>
    getData<PayrollError[]>(`/daily-wages/${id}/errors`, undefined, signal),

  // Vouchers (one resource; the employee-voucher screen is the same records)
  vouchers: (params: PageQuery<VoucherFilters>, signal?: AbortSignal) =>
    getPage<VoucherRow>('/vouchers', params, signal),
  voucher: (id: string, signal?: AbortSignal) =>
    getData<VoucherRow>(`/vouchers/${id}`, undefined, signal),
  createVoucher: (input: VoucherInput) => send<VoucherRow>('post', '/vouchers', input),
  updateVoucher: (id: string, input: VoucherInput) =>
    send<VoucherRow>('put', `/vouchers/${id}`, input),
  deleteVoucher: (id: string, rowVersion: string) => remove(`/vouchers/${id}`, rowVersion),
  decideVoucher: (
    id: string,
    action: 'approve' | 'reject' | 'verify',
    input: VoucherDecisionInput,
  ) => send<VoucherRow>('post', `/vouchers/${id}/${action}`, input),

  // Final Settlement
  finalSettlements: (params: PageQuery<FinalSettlementFilters>, signal?: AbortSignal) =>
    getPage<FinalSettlementRow>('/final-settlements', params, signal),
  finalSettlement: (id: string, signal?: AbortSignal) =>
    getData<FinalSettlementRow>(`/final-settlements/${id}`, undefined, signal),
  finalSettlementPayslip: (id: string, signal?: AbortSignal) =>
    getData<PayslipDetail>(`/final-settlements/${id}/payslip`, undefined, signal),
  recalculateFinalSettlement: (id: string) =>
    send<FinalSettlementRow>('post', `/final-settlements/${id}/recalculate`),
  closeFinalSettlement: (id: string, input: FinalSettlementCloseInput) =>
    send<FinalSettlementRow>('post', `/final-settlements/${id}/close`, input),

  // Balances → Opening balances
  openingBalances: (params: PageQuery<OpeningBalanceFilters>, signal?: AbortSignal) =>
    getPage<OpeningBalanceRow>('/opening-balances', params, signal),
  openingBalancesOf: (employeeId: string, signal?: AbortSignal) =>
    getData<OpeningBalanceDetail>(`/opening-balances/employees/${employeeId}`, undefined, signal),
  openingBalance: (id: string, signal?: AbortSignal) =>
    getData<OpeningBalanceEntry>(`/opening-balances/${id}`, undefined, signal),
  createOpeningBalance: (input: OpeningBalanceInput) =>
    send<OpeningBalanceEntry>('post', '/opening-balances', input),
  updateOpeningBalance: (id: string, input: OpeningBalanceInput) =>
    send<OpeningBalanceEntry>('put', `/opening-balances/${id}`, input),
  deleteOpeningBalance: (id: string, rowVersion: string) =>
    remove(`/opening-balances/${id}`, rowVersion),
  importOpeningBalances: (body: ImportBody<OpeningBalanceImportRow>) =>
    send<ImportResult>('post', '/opening-balances/import', body),

  // Balances → Employee accounts, statement
  employeeAccounts: (params: PageQuery<AccountFilters>, signal?: AbortSignal) =>
    getPage<EmployeeAccountRow>('/employee-accounts', params, signal),
  employeeAccount: (id: string, signal?: AbortSignal) =>
    getData<EmployeeAccountRow>(`/employee-accounts/${id}`, undefined, signal),
  createEmployeeAccount: (input: EmployeeAccountInput) =>
    send<EmployeeAccountRow>('post', '/employee-accounts', input),
  updateEmployeeAccount: (id: string, input: EmployeeAccountInput) =>
    send<EmployeeAccountRow>('put', `/employee-accounts/${id}`, input),
  deleteEmployeeAccount: (id: string, rowVersion: string) =>
    remove(`/employee-accounts/${id}`, rowVersion),
  importEmployeeAccounts: (body: ImportBody<AccountImportRow>) =>
    send<ImportResult>('post', '/employee-accounts/import', body),
  accountStatement: (params: PageQuery<StatementFilters>, signal?: AbortSignal) =>
    getPage<AccountStatementRow>('/account-statement', params, signal),

  // Salary Revision
  salaryRevisions: (params: PageQuery<RevisionFilters>, signal?: AbortSignal) =>
    getPage<SalaryRevisionRow>('/salary-revisions', params, signal),
  salaryRevision: (id: string, signal?: AbortSignal) =>
    getData<SalaryRevisionRow>(`/salary-revisions/${id}`, undefined, signal),
  currentSalary: (employeeId: string, date: string, signal?: AbortSignal) =>
    getData<CurrentSalary>(`/salary-revisions/current/${employeeId}`, { date }, signal),
  createSalaryRevision: (input: SalaryRevisionInput) =>
    send<SalaryRevisionRow>('post', '/salary-revisions', input),
  updateSalaryRevision: (id: string, input: SalaryRevisionInput) =>
    send<SalaryRevisionRow>('put', `/salary-revisions/${id}`, input),
  deleteSalaryRevision: (id: string, rowVersion: string) =>
    remove(`/salary-revisions/${id}`, rowVersion),
  importSalaryRevisions: (body: ImportBody<SalaryImportRow>) =>
    send<ImportResult>('post', '/salary-revisions/import', body),

  // Leave Encashment
  leaveEncashments: (params: PageQuery<EncashmentFilters>, signal?: AbortSignal) =>
    getPage<LeaveEncashmentRow>('/leave-encashments', params, signal),
  leaveEncashment: (id: string, signal?: AbortSignal) =>
    getData<LeaveEncashmentDetail>(`/leave-encashments/${id}`, undefined, signal),
  createLeaveEncashment: (input: LeaveEncashmentInput) =>
    send<LeaveEncashmentDetail>('post', '/leave-encashments', input),
  updateLeaveEncashment: (id: string, input: LeaveEncashmentInput) =>
    send<LeaveEncashmentDetail>('put', `/leave-encashments/${id}`, input),
  deleteLeaveEncashment: (id: string, rowVersion: string) =>
    remove(`/leave-encashments/${id}`, rowVersion),

  // Reports, dashboard
  employeeAccountReport: (params: PageQuery<ReportFilters>, signal?: AbortSignal) =>
    getPage<EmployeeAccountReportRow>('/reports/employee-accounts', params, signal),
  payrollSummary: (payrollId: string, signal?: AbortSignal) =>
    getData<PayrollSummary>(`/reports/payroll-summary/${payrollId}`, undefined, signal),
  employeeWiseReport: (params: PageQuery<ReportFilters>, signal?: AbortSignal) =>
    getPage<EmployeeWiseRow>('/reports/employee-wise', params, signal),
  dailyWagesReport: (params: PageQuery<ReportFilters>, signal?: AbortSignal) =>
    getPage<DailyWagesReportRow>('/reports/daily-wages', params, signal),
  dashboard: (
    params: { year?: number | undefined; month?: string | undefined },
    signal?: AbortSignal,
  ) => getData<PayrollDashboard>('/dashboard', params, signal),
}

/** Pickers other modules serve (not under `/payroll`). */
export const lookupApi = {
  /**
   * One page of the employees the caller reaches through `permission` (`GET /employees/lookup`
   * → `{data, meta}`), searched on the server by `q` (code or name); `pageSize` 1–100.
   * Pickers page through it with `EmployeeSearchSelect` ("Load more").
   */
  employees: (params: EmployeeLookupParams & { permission: string }, signal?: AbortSignal) =>
    fetchEmployeeLookup<EmployeeLookup>(params, signal),
  /** branches, departments, designations, locations, employee-groups … */
  organisation: async (kind: string, signal?: AbortSignal) => {
    const { data } = await apiClient.get<ApiItem<LookupItem[]>>(`/organisation/lookups/${kind}`, {
      signal,
    })
    return data.data
  },
  timeSlots: async (signal?: AbortSignal) => {
    const { data } = await apiClient.get<ApiItem<TimeSlotOption[]>>(
      '/scheduling/options/time-slots',
      { signal },
    )
    return data.data
  },
  leaveTypes: async (signal?: AbortSignal) => {
    const { data } = await apiClient.get<
      Paginated<{
        id: string
        title: string
        allowEncashment?: boolean | null
        encashmentMin?: number | null
        encashmentMax?: number | null
      }>
    >('/leaves/types', { params: { page: 1, pageSize: 100 }, signal })
    return data.data.map((type): LeaveTypeOption => ({
      id: type.id,
      name: type.title,
      // Left out by an older API: nothing to refuse on.
      allowEncashment: type.allowEncashment ?? true,
      encashmentMin: type.encashmentMin ?? null,
      encashmentMax: type.encashmentMax ?? null,
    }))
  },
}

export const payrollKeys = {
  all: ['payroll'] as const,
  lookups: (name: string, params?: object) =>
    params
      ? ([...payrollKeys.all, 'lookups', name, compact(params)] as const)
      : ([...payrollKeys.all, 'lookups', name] as const),
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

export const resourceQueryOptions = <N extends SettingsResourceName>(
  name: N,
  params: PageQuery<Record<string, unknown>>,
) =>
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
