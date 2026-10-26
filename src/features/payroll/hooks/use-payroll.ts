import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useEmployeeLookupSearch } from '@/hooks/use-employee-lookup'

import {
  type AccountFilters,
  type DailyWageFilters,
  type EncashmentFilters,
  type FinalSettlementFilters,
  type ImportBody,
  listQueryOptions,
  lookupApi,
  type OpeningBalanceFilters,
  type PageQuery,
  payrollApi,
  payrollKeys,
  type PayrollListFilters,
  type PayslipFilters,
  type ReportFilters,
  resourceQueryOptions,
  type RevisionFilters,
  type SettingsResourceName,
  type SettingsResources,
  type StatementFilters,
  type VoucherFilters,
} from '../api/payroll.api'
import type {
  AccountImportRow,
  DailyWageEditInput,
  DailyWageInput,
  EmployeeAccountInput,
  EmployeeFilterInput,
  EmployeeLookup,
  FinalSettlementCloseInput,
  ImportResult,
  LeaveEncashmentInput,
  OpeningBalanceImportRow,
  OpeningBalanceInput,
  PayrollInput,
  PayrollSettings,
  PayslipLineInput,
  SalaryImportRow,
  SalaryRevisionInput,
  VoucherDecisionInput,
  VoucherInput,
} from '../types/payroll.types'

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`

// --- lookups (pickers) ----------------------------------------------------------------------------

/**
 * Employees the caller reaches through `permission` (the screen's own view code), searched on
 * the server (`search`, debounced) and paged: `rows`, `hasMore` / `loadMore`, `find(id)`.
 * Pickers use `EmployeeSearchSelect`, which reads it the same way.
 */
export const useEmployeeLookup = (permission: string, includeInactive = true, search = '') =>
  useEmployeeLookupSearch<EmployeeLookup>({ permission, includeInactive }, { search })

export const useOrganisationLookup = (kind: string) =>
  useQuery({
    queryKey: payrollKeys.lookups(`organisation-${kind}`),
    queryFn: ({ signal }) => lookupApi.organisation(kind, signal),
    staleTime: 5 * 60_000,
  })

/** Time slots (scheduling); empty when the caller may not read them. */
export const useTimeSlotLookup = () =>
  useQuery({
    queryKey: payrollKeys.lookups('time-slots'),
    queryFn: ({ signal }) => lookupApi.timeSlots(signal).catch(() => []),
    staleTime: 5 * 60_000,
  })

/** Leave types (leaves settings); empty when the caller may not read them. */
export const useLeaveTypeLookup = () =>
  useQuery({
    queryKey: payrollKeys.lookups('leave-types'),
    queryFn: ({ signal }) => lookupApi.leaveTypes(signal).catch(() => []),
    staleTime: 5 * 60_000,
  })

/** A settings list as a picker (first 100). */
export const useResourceLookup = <N extends SettingsResourceName>(name: N, enabled = true) =>
  useQuery({
    ...resourceQueryOptions(name, { page: 1, pageSize: 100 }),
    staleTime: 60_000,
    enabled,
  })

export const usePayrollLookup = () =>
  useQuery({
    queryKey: payrollKeys.payrolls({ page: 1, pageSize: 100, lookup: true }),
    queryFn: ({ signal }) => payrollApi.payrolls({ page: 1, pageSize: 100 }, signal),
    staleTime: 60_000,
  })

// --- queries ------------------------------------------------------------------------------------

export const usePayrollSettings = () =>
  useQuery({
    queryKey: payrollKeys.settings(),
    queryFn: ({ signal }) => payrollApi.settings(signal),
  })

export const useExpressionVariables = () =>
  useQuery({
    queryKey: payrollKeys.list('variables'),
    queryFn: ({ signal }) => payrollApi.variables(signal),
    staleTime: 5 * 60_000,
  })

export const useResourceList = <N extends SettingsResourceName>(
  name: N,
  params: PageQuery<Record<string, unknown>>,
) => useQuery(resourceQueryOptions(name, params))

export const useResource = <N extends SettingsResourceName>(name: N, id: string | null) =>
  useQuery({
    queryKey: [...payrollKeys.resource(name), 'detail', id ?? ''],
    queryFn: ({ signal }) => payrollApi.resource(name).get(id ?? '', signal),
    enabled: id !== null,
  })

export const usePayrolls = (params: PageQuery<PayrollListFilters>) =>
  useQuery(listQueryOptions('payrolls', params, payrollApi.payrolls))

export const usePayroll = (id: string | null) =>
  useQuery({
    queryKey: payrollKeys.payroll(id ?? '', 'detail'),
    queryFn: ({ signal }) => payrollApi.payroll(id ?? '', signal),
    enabled: id !== null,
  })

export const usePayrollEmployees = (id: string, q: string) =>
  useQuery({
    queryKey: [...payrollKeys.payroll(id, 'employees'), q],
    queryFn: ({ signal }) => payrollApi.payrollEmployees(id, q, signal),
  })
/** Kept name. */
export const useEmployments = usePayrollEmployees

export const usePayrollHistory = (id: string) =>
  useQuery({
    queryKey: payrollKeys.payroll(id, 'history'),
    queryFn: ({ signal }) => payrollApi.payrollHistory(id, signal),
  })

export const usePayrollErrors = (id: string, runLogId?: string) =>
  useQuery({
    queryKey: [...payrollKeys.payroll(id, 'errors'), runLogId ?? ''],
    queryFn: ({ signal }) => payrollApi.payrollErrors(id, runLogId, signal),
  })

export const useSalarySheet = (params: {
  payrollId?: string | undefined
  month?: string | undefined
}) =>
  useQuery({
    queryKey: payrollKeys.list('salary-sheet', params),
    queryFn: ({ signal }) => payrollApi.salarySheet(params, signal),
    enabled: Boolean(params.payrollId ?? params.month),
  })

export const usePayslips = (params: PageQuery<PayslipFilters>) =>
  useQuery(listQueryOptions('payslips', params, payrollApi.payslips))

export const useMyAccounts = (employeeId?: string) =>
  useQuery({
    queryKey: payrollKeys.list('my-accounts', { employeeId }),
    queryFn: ({ signal }) => payrollApi.myAccounts(employeeId, signal),
    retry: false,
  })

export const usePayslip = (id: string | null) =>
  useQuery({
    queryKey: payrollKeys.detail('payslip', id ?? ''),
    queryFn: ({ signal }) => payrollApi.payslip(id ?? '', signal),
    enabled: id !== null,
  })

export const usePayslipHistory = (id: string | null) =>
  useQuery({
    queryKey: payrollKeys.detail('payslip-history', id ?? ''),
    queryFn: ({ signal }) => payrollApi.payslipHistory(id ?? '', signal),
    enabled: id !== null,
  })

export const useDailyWages = (params: PageQuery<DailyWageFilters>) =>
  useQuery(listQueryOptions('daily-wages', params, payrollApi.dailyWages))

export const useDailyWage = (id: string | null) =>
  useQuery({
    queryKey: payrollKeys.detail('daily-wage', id ?? ''),
    queryFn: ({ signal }) => payrollApi.dailyWage(id ?? '', signal),
    enabled: id !== null,
  })

export const useDailyWageErrors = (id: string | null) =>
  useQuery({
    queryKey: payrollKeys.detail('daily-wage-errors', id ?? ''),
    queryFn: ({ signal }) => payrollApi.dailyWageErrors(id ?? '', signal),
    enabled: id !== null,
  })

export const useVouchers = (params: PageQuery<VoucherFilters>) =>
  useQuery(listQueryOptions('vouchers', params, payrollApi.vouchers))
/** Kept name: employee vouchers are the same list. */
export const useEmployeeVouchers = useVouchers

export const useVoucher = (id: string | null) =>
  useQuery({
    queryKey: payrollKeys.detail('voucher', id ?? ''),
    queryFn: ({ signal }) => payrollApi.voucher(id ?? '', signal),
    enabled: id !== null,
  })
export const useEmployeeVoucher = useVoucher

export const useFinalSettlements = (params: PageQuery<FinalSettlementFilters>) =>
  useQuery(listQueryOptions('final-settlements', params, payrollApi.finalSettlements))

export const useFinalSettlement = (id: string | null) =>
  useQuery({
    queryKey: payrollKeys.detail('final-settlement', id ?? ''),
    queryFn: ({ signal }) => payrollApi.finalSettlement(id ?? '', signal),
    enabled: id !== null,
  })

export const useFinalSettlementPayslip = (id: string | null) =>
  useQuery({
    queryKey: payrollKeys.detail('final-settlement-payslip', id ?? ''),
    queryFn: ({ signal }) => payrollApi.finalSettlementPayslip(id ?? '', signal),
    enabled: id !== null,
  })

export const useOpeningBalances = (params: PageQuery<OpeningBalanceFilters>) =>
  useQuery(listQueryOptions('opening-balances', params, payrollApi.openingBalances))

/** Everything one person has in opening balances. */
export const useOpeningBalance = (employeeId: string | null) =>
  useQuery({
    queryKey: payrollKeys.detail('opening-balance', employeeId ?? ''),
    queryFn: ({ signal }) => payrollApi.openingBalancesOf(employeeId ?? '', signal),
    enabled: employeeId !== null,
  })

export const useEmployeeAccounts = (params: PageQuery<AccountFilters>) =>
  useQuery(listQueryOptions('employee-accounts', params, payrollApi.employeeAccounts))

export const useEmployeeAccount = (id: string | null) =>
  useQuery({
    queryKey: payrollKeys.detail('employee-account', id ?? ''),
    queryFn: ({ signal }) => payrollApi.employeeAccount(id ?? '', signal),
    enabled: id !== null,
  })

export const useAccountStatement = (params: PageQuery<StatementFilters>) =>
  useQuery(listQueryOptions('account-statement', params, payrollApi.accountStatement))

export const useSalaryRevisions = (params: PageQuery<RevisionFilters>) =>
  useQuery(listQueryOptions('salary-revisions', params, payrollApi.salaryRevisions))

export const useSalaryRevision = (id: string | null) =>
  useQuery({
    queryKey: payrollKeys.detail('salary-revision', id ?? ''),
    queryFn: ({ signal }) => payrollApi.salaryRevision(id ?? '', signal),
    enabled: id !== null,
  })

export const useCurrentSalary = (employeeId: string | null, date: string) =>
  useQuery({
    queryKey: [...payrollKeys.detail('current-salary', employeeId ?? ''), date],
    queryFn: ({ signal }) => payrollApi.currentSalary(employeeId ?? '', date, signal),
    enabled: employeeId !== null && /^\d{4}-\d{2}-\d{2}$/.test(date),
  })

export const useLeaveEncashments = (params: PageQuery<EncashmentFilters>) =>
  useQuery(listQueryOptions('leave-encashments', params, payrollApi.leaveEncashments))

export const useLeaveEncashment = (id: string | null) =>
  useQuery({
    queryKey: payrollKeys.detail('leave-encashment', id ?? ''),
    queryFn: ({ signal }) => payrollApi.leaveEncashment(id ?? '', signal),
    enabled: id !== null,
  })

export const useEmployeeAccountReport = (params: PageQuery<ReportFilters>) =>
  useQuery(listQueryOptions('report-employee-accounts', params, payrollApi.employeeAccountReport))

export const useEmployeeWiseReport = (params: PageQuery<ReportFilters>) =>
  useQuery(listQueryOptions('report-employee-wise', params, payrollApi.employeeWiseReport))

export const useDailyWagesReport = (params: PageQuery<ReportFilters>) =>
  useQuery(listQueryOptions('report-daily-wages', params, payrollApi.dailyWagesReport))

export const usePayrollSummary = (payrollId: string | null) =>
  useQuery({
    queryKey: payrollKeys.detail('payroll-summary', payrollId ?? ''),
    queryFn: ({ signal }) => payrollApi.payrollSummary(payrollId ?? '', signal),
    enabled: payrollId !== null,
  })

export const usePayrollDashboard = (params: { year?: number; month?: string } = {}) =>
  useQuery({
    queryKey: payrollKeys.list('dashboard', params),
    queryFn: ({ signal }) => payrollApi.dashboard(params, signal),
  })

// --- mutations ----------------------------------------------------------------------------------

/**
 * A Payroll change. Everything in Payroll depends on everything else (a run
 * changes pay slips, the sheet, the dashboard), so all of it refetches.
 */
export function usePayrollMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  message: ((variables: TVariables, result: TResult) => string) | null,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    meta: { suppressErrorToast: true },
    onSuccess: async (result, variables) => {
      if (message) toast.success(message(variables, result))
      await queryClient.invalidateQueries({ queryKey: payrollKeys.all })
    },
  })
}

export const useSavePayrollSettings = () =>
  usePayrollMutation(
    (input: PayrollSettings) => payrollApi.saveSettings(input),
    () => 'Settings saved',
  )

export const useCheckExpression = () =>
  useMutation({
    mutationFn: ({ expression, kind }: { expression: string; kind?: 'value' | 'condition' }) =>
      payrollApi.checkExpression(expression, kind),
    meta: { suppressErrorToast: true },
  })

const NOUNS: Record<SettingsResourceName, string> = {
  payItems: 'Pay item',
  formulas: 'Formula',
  rules: 'Rule',
  accountTypes: 'Account type',
  banks: 'Disbursement bank',
  taxStructures: 'Tax structure',
  taxRebates: 'Tax rebate',
  benefits: 'Benefit',
  incentives: 'Incentive',
}

export function useSaveResource<N extends SettingsResourceName>(name: N) {
  return usePayrollMutation(
    ({ id, input }: { id?: string | undefined; input: SettingsResources[N]['input'] }) =>
      id ? payrollApi.resource(name).update(id, input) : payrollApi.resource(name).create(input),
    ({ id }) => `${NOUNS[name]} ${id ? 'updated' : 'created'}`,
  )
}

export const useDeleteResource = (name: SettingsResourceName) =>
  usePayrollMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string }) =>
      payrollApi.resource(name).remove(id, rowVersion),
    () => `${NOUNS[name]} deleted`,
  )

export const useSavePayroll = () =>
  usePayrollMutation(
    ({ id, input }: { id?: string | undefined; input: PayrollInput }) =>
      id ? payrollApi.updatePayroll(id, input) : payrollApi.createPayroll(input),
    ({ id }) => (id ? 'Payroll updated' : 'Payroll created'),
  )

export const useDeletePayroll = () =>
  usePayrollMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string }) =>
      payrollApi.deletePayroll(id, rowVersion),
    () => 'Payroll deleted',
  )

export const useRunPayroll = () =>
  usePayrollMutation(
    (id: string) => payrollApi.runPayroll(id),
    (_id, log) =>
      log.errorCount
        ? `Payroll run with ${plural(log.errorCount, 'error')}`
        : `Payroll run (${plural(log.processedCount ?? 0, 'payslip')})`,
  )

export const useClosePayroll = () =>
  usePayrollMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string }) =>
      payrollApi.closePayroll(id, rowVersion),
    () => 'Payroll closed',
  )

export const useHoldPayroll = () =>
  usePayrollMutation(
    ({ id, hold }: { id: string; hold: boolean }) => payrollApi.holdPayroll(id, hold),
    ({ hold }) => (hold ? 'Payroll on hold' : 'Payroll taken off hold'),
  )

export const useSetPayrollEmployees = () =>
  usePayrollMutation(
    ({ id, employeeIds }: { id: string; employeeIds: string[] }) =>
      payrollApi.setPayrollEmployees(id, employeeIds),
    () => 'Employments saved',
  )
/** Kept name. */
export const useSetEmployments = useSetPayrollEmployees

export const useAddPayrollEmployees = () =>
  usePayrollMutation(
    ({ id, filter }: { id: string; filter: EmployeeFilterInput }) =>
      payrollApi.addPayrollEmployees(id, filter),
    (_vars, result) => `${plural(result.added ?? 0, 'employee')} added`,
  )

export const useUpdatePayslip = () =>
  usePayrollMutation(
    ({ id, lines, rowVersion }: { id: string; lines: PayslipLineInput[]; rowVersion: string }) =>
      payrollApi.updatePayslip(id, lines, rowVersion),
    () => 'Pay slip updated',
  )

const SLIP_MESSAGES = {
  hold: 'Pay slip on hold',
  unhold: 'Pay slip taken off hold',
  pay: 'Pay slip marked paid',
  recalculate: 'Pay slip recalculated',
}
export type PayslipAction = keyof typeof SLIP_MESSAGES

export const usePayslipAction = () =>
  usePayrollMutation(
    ({ id, action }: { id: string; action: PayslipAction }) => payrollApi.payslipAction(id, action),
    ({ action }) => SLIP_MESSAGES[action],
  )

const BULK_VERBS: Record<PayslipAction, string> = {
  hold: 'on hold',
  unhold: 'taken off hold',
  pay: 'marked paid',
  recalculate: 'recalculated',
}
export const usePayslipsBulk = () =>
  usePayrollMutation(
    ({ ids, action }: { ids: string[]; action: PayslipAction }) =>
      payrollApi.payslipsBulk(ids, action),
    ({ action }, result) =>
      result.changed === 0
        ? 'Nothing changed'
        : `${plural(result.changed, 'pay slip')} ${BULK_VERBS[action]}`,
  )
/** Kept name: put several pay slips on hold. */
export const useHoldPayslips = () => {
  const bulk = usePayslipsBulk()
  return {
    ...bulk,
    mutate: (ids: string[]) => {
      bulk.mutate({ ids, action: 'hold' })
    },
  }
}

export const useCreateDailyWage = () =>
  usePayrollMutation(
    (input: DailyWageInput) => payrollApi.createDailyWage(input),
    () => 'Daily wage payroll created',
  )

export const useUpdateDailyWage = () =>
  usePayrollMutation(
    ({ id, input }: { id: string; input: DailyWageEditInput }) =>
      payrollApi.updateDailyWage(id, input),
    () => 'Daily wage payroll updated',
  )

export const useSetDailyWageEmployees = () =>
  usePayrollMutation(
    ({ id, employeeIds }: { id: string; employeeIds: string[] }) =>
      payrollApi.setDailyWageEmployees(id, employeeIds),
    () => 'Employees saved',
  )

export const useDeleteDailyWage = () =>
  usePayrollMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string }) =>
      payrollApi.deleteDailyWage(id, rowVersion),
    () => 'Daily wage payroll deleted',
  )

export const useProcessDailyWage = () =>
  usePayrollMutation(
    (id: string) => payrollApi.processDailyWage(id),
    (_id, log) =>
      log.errorCount
        ? `Processed with ${plural(log.errorCount, 'error')}`
        : `Processed (${plural(log.processedCount ?? 0, 'wage slip')})`,
  )

export const useCloseDailyWage = () =>
  usePayrollMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string }) =>
      payrollApi.closeDailyWage(id, rowVersion),
    () => 'Daily wage payroll closed',
  )

export const useDailyWageVouchers = () =>
  usePayrollMutation(
    (id: string) => payrollApi.dailyWageVouchers(id),
    (_id, result) => `${plural(result.created, 'voucher')} created`,
  )

export const useSaveVoucher = () =>
  usePayrollMutation(
    ({ id, input }: { id?: string | undefined; input: VoucherInput }) =>
      id ? payrollApi.updateVoucher(id, input) : payrollApi.createVoucher(input),
    ({ id }) => (id ? 'Voucher updated' : 'Voucher created'),
  )
/** Kept name. */
export const useSaveEmployeeVoucher = useSaveVoucher

export const useDeleteVoucher = () =>
  usePayrollMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string }) =>
      payrollApi.deleteVoucher(id, rowVersion),
    () => 'Voucher deleted',
  )
/** Kept name. */
export const useDeleteEmployeeVoucher = useDeleteVoucher

const DECISIONS = { approve: 'approved', reject: 'rejected', verify: 'verified for payment' }
export const useDecideVoucher = () =>
  usePayrollMutation(
    ({
      id,
      action,
      input,
    }: {
      id: string
      action: 'approve' | 'reject' | 'verify'
      input: VoucherDecisionInput
    }) => payrollApi.decideVoucher(id, action, input),
    ({ action }) => `Voucher ${DECISIONS[action]}`,
  )

export const useRecalculateFinalSettlement = () =>
  usePayrollMutation(
    (id: string) => payrollApi.recalculateFinalSettlement(id),
    () => 'Final settlement recalculated',
  )

export const useCloseFinalSettlement = () =>
  usePayrollMutation(
    ({ id, input }: { id: string; input: FinalSettlementCloseInput }) =>
      payrollApi.closeFinalSettlement(id, input),
    () => 'Final settlement closed',
  )

export const useSaveOpeningBalance = () =>
  usePayrollMutation(
    ({ id, input }: { id?: string | undefined; input: OpeningBalanceInput }) =>
      id ? payrollApi.updateOpeningBalance(id, input) : payrollApi.createOpeningBalance(input),
    ({ id }) => (id ? 'Opening balance updated' : 'Opening balance saved'),
  )
/** Kept name. */
export const useAddOpeningBalance = () => {
  const save = useSaveOpeningBalance()
  return {
    ...save,
    mutate: (input: OpeningBalanceInput, options?: Parameters<typeof save.mutate>[1]) => {
      save.mutate({ input }, options)
    },
  }
}

export const useDeleteOpeningBalance = () =>
  usePayrollMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string }) =>
      payrollApi.deleteOpeningBalance(id, rowVersion),
    () => 'Opening balance deleted',
  )

const importMessage = (_variables: unknown, result: ImportResult) =>
  `Imported ${plural(result.created, 'row')}${result.errors.length ? `, ${result.errors.length} skipped` : ''}`

export const useImportOpeningBalances = () =>
  usePayrollMutation(
    (body: ImportBody<OpeningBalanceImportRow>) => payrollApi.importOpeningBalances(body),
    importMessage,
  )

export const useSaveEmployeeAccount = () =>
  usePayrollMutation(
    ({ id, input }: { id?: string | undefined; input: EmployeeAccountInput }) =>
      id ? payrollApi.updateEmployeeAccount(id, input) : payrollApi.createEmployeeAccount(input),
    ({ id }) => (id ? 'Employee account updated' : 'Employee account created'),
  )

export const useDeleteEmployeeAccount = () =>
  usePayrollMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string }) =>
      payrollApi.deleteEmployeeAccount(id, rowVersion),
    () => 'Employee account entry deleted',
  )

export const useImportEmployeeAccounts = () =>
  usePayrollMutation(
    (body: ImportBody<AccountImportRow>) => payrollApi.importEmployeeAccounts(body),
    importMessage,
  )

export const useSaveSalaryRevision = () =>
  usePayrollMutation(
    ({ id, input }: { id?: string | undefined; input: SalaryRevisionInput }) =>
      id ? payrollApi.updateSalaryRevision(id, input) : payrollApi.createSalaryRevision(input),
    ({ id }) => (id ? 'Salary revision updated' : 'Salary revision created'),
  )

export const useDeleteSalaryRevision = () =>
  usePayrollMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string }) =>
      payrollApi.deleteSalaryRevision(id, rowVersion),
    () => 'Salary revision deleted',
  )

export const useImportSalaryRevisions = () =>
  usePayrollMutation(
    (body: ImportBody<SalaryImportRow>) => payrollApi.importSalaryRevisions(body),
    importMessage,
  )

export const useSaveLeaveEncashment = () =>
  usePayrollMutation(
    ({ id, input }: { id?: string | undefined; input: LeaveEncashmentInput }) =>
      id ? payrollApi.updateLeaveEncashment(id, input) : payrollApi.createLeaveEncashment(input),
    ({ id }, result) => {
      const people = plural(result.employees.length, 'person').replace('persons', 'people')
      return id ? `Leave encashment updated (${people})` : `Leave encashment created (${people})`
    },
  )

export const useDeleteLeaveEncashment = () =>
  usePayrollMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string }) =>
      payrollApi.deleteLeaveEncashment(id, rowVersion),
    () => 'Leave encashment deleted',
  )
