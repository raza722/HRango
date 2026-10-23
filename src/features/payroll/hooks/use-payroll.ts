import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  type BalanceFilters,
  type BalanceImportRow,
  type DailyWageFilters,
  type EncashmentFilters,
  listQueryOptions,
  lookupsQueryOptions,
  type PageQuery,
  payrollApi,
  payrollKeys,
  type PayslipFilters,
  type PeopleFilters,
  resourceQueryOptions,
  type RevisionFilters,
  type SettingsResourceName,
  type SettingsResources,
  type VoucherFilters,
} from '../api/payroll.api'
import type {
  DailyWageInput,
  EmployeeAccountInput,
  EmployeeVoucherInput,
  LeaveEncashmentInput,
  ListParams,
  OpeningBalanceInput,
  PayrollInput,
  PayrollSettings,
  PayslipItemInput,
  SalaryRevisionInput,
} from '../types/payroll.types'

// --- queries ------------------------------------------------------------------------------------

export const usePayrollLookups = () => useQuery(lookupsQueryOptions())

export const usePayrollSettings = () =>
  useQuery({
    queryKey: payrollKeys.settings(),
    queryFn: ({ signal }) => payrollApi.settings(signal),
  })

export const useResourceList = <N extends SettingsResourceName>(name: N, params: PageQuery) =>
  useQuery(resourceQueryOptions(name, params))

export const usePayrolls = (params: ListParams) =>
  useQuery(listQueryOptions('payrolls', params, payrollApi.payrolls))

export const usePayroll = (id: string | null) =>
  useQuery({
    queryKey: payrollKeys.payroll(id ?? '', 'detail'),
    queryFn: ({ signal }) => payrollApi.payroll(id ?? '', signal),
    enabled: id !== null,
  })

export const useEmployments = (id: string, search: string) =>
  useQuery({
    queryKey: [...payrollKeys.payroll(id, 'employments'), search],
    queryFn: ({ signal }) => payrollApi.employments(id, search, signal),
  })

export const usePayrollHistory = (id: string) =>
  useQuery({
    queryKey: payrollKeys.payroll(id, 'history'),
    queryFn: ({ signal }) => payrollApi.payrollHistory(id, signal),
  })

export const usePayrollErrors = (id: string) =>
  useQuery({
    queryKey: payrollKeys.payroll(id, 'errors'),
    queryFn: ({ signal }) => payrollApi.payrollErrors(id, signal),
  })

export const useSalarySheet = (params: {
  payrollId?: string | undefined
  month?: string | undefined
}) =>
  useQuery({
    queryKey: payrollKeys.list('salary-sheet', params),
    queryFn: ({ signal }) => payrollApi.salarySheet(params, signal),
  })

export const usePayslips = (params: PageQuery<PayslipFilters>) =>
  useQuery(listQueryOptions('payslips', params, payrollApi.payslips))

export const useMyAccounts = () =>
  useQuery({
    queryKey: payrollKeys.list('my-accounts'),
    queryFn: ({ signal }) => payrollApi.myAccounts(signal),
  })

export const usePayslip = (id: string | null) =>
  useQuery({
    queryKey: payrollKeys.detail('payslip', id ?? ''),
    queryFn: ({ signal }) => payrollApi.payslip(id ?? '', signal),
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

export const useVouchers = (params: PageQuery<VoucherFilters>) =>
  useQuery(listQueryOptions('vouchers', params, payrollApi.vouchers))

export const useEmployeeVouchers = (params: PageQuery) =>
  useQuery(listQueryOptions('employee-vouchers', params, payrollApi.employeeVouchers.list))

export const useEmployeeVoucher = (id: string | null) =>
  useQuery({
    queryKey: payrollKeys.detail('employee-voucher', id ?? ''),
    queryFn: ({ signal }) => payrollApi.employeeVouchers.get(id ?? '', signal),
    enabled: id !== null,
  })

export const useFinalSettlements = (
  params: PageQuery<PeopleFilters & { month?: string | undefined }>,
) => useQuery(listQueryOptions('final-settlements', params, payrollApi.finalSettlements))

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

export const useOpeningBalances = (params: PageQuery<BalanceFilters>) =>
  useQuery(listQueryOptions('opening-balances', params, payrollApi.openingBalances))

export const useOpeningBalance = (id: string | null) =>
  useQuery({
    queryKey: payrollKeys.detail('opening-balance', id ?? ''),
    queryFn: ({ signal }) => payrollApi.openingBalance(id ?? '', signal),
    enabled: id !== null,
  })

export const useEmployeeAccounts = (params: PageQuery<BalanceFilters>) =>
  useQuery(listQueryOptions('employee-accounts', params, payrollApi.employeeAccounts))

export const useEmployeeAccount = (id: string | null) =>
  useQuery({
    queryKey: payrollKeys.detail('employee-account', id ?? ''),
    queryFn: ({ signal }) => payrollApi.employeeAccount(id ?? '', signal),
    enabled: id !== null,
  })

export const useAccountStatement = (params: PageQuery<BalanceFilters>) =>
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

export const useEmployeeAccountReport = (params: PageQuery) =>
  useQuery(listQueryOptions('report-employee-accounts', params, payrollApi.employeeAccountReport))

export const usePayrollDashboard = () =>
  useQuery({
    queryKey: payrollKeys.list('dashboard'),
    queryFn: ({ signal }) => payrollApi.dashboard(signal),
  })

export const useEmployeeEarning = (employeeId: string | null) =>
  useQuery({
    queryKey: payrollKeys.detail('employee-earning', employeeId ?? ''),
    queryFn: ({ signal }) => payrollApi.employeeEarning(employeeId ?? '', signal),
    enabled: employeeId !== null,
  })

export const useExpenseReport = (month: string) =>
  useQuery({
    queryKey: payrollKeys.list('expense-report', { month }),
    queryFn: ({ signal }) => payrollApi.expenseReport(month, signal),
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
    (id: string) => payrollApi.resource(name).remove(id),
    () => `${NOUNS[name]} deleted`,
  )

export const useSavePayroll = () =>
  usePayrollMutation(
    ({ id, input }: { id?: string | undefined; input: PayrollInput }) =>
      id ? payrollApi.updatePayroll(id, input) : payrollApi.createPayroll(input),
    ({ id }) => (id ? 'Payroll updated' : 'Payroll created'),
  )

export const useRunPayroll = () =>
  usePayrollMutation(
    (id: string) => payrollApi.runPayroll(id),
    (_id, payroll) =>
      payroll.errors.length > 0
        ? `Payroll run with ${payroll.errors.length} error${payroll.errors.length === 1 ? '' : 's'}`
        : 'Payroll run',
  )

export const useClosePayroll = () =>
  usePayrollMutation(
    (id: string) => payrollApi.closePayroll(id),
    () => 'Payroll closed',
  )

export const useHoldPayrolls = () =>
  usePayrollMutation(
    (ids: string[]) => payrollApi.holdPayrolls(ids),
    (_ids, result) =>
      result.held === 0
        ? 'Nothing to put on hold'
        : `${result.held} payroll${result.held === 1 ? '' : 's'} on hold`,
  )

export const useSetEmployments = () =>
  usePayrollMutation(
    ({ id, employeeIds }: { id: string; employeeIds: string[] }) =>
      payrollApi.setEmployments(id, employeeIds),
    () => 'Employments saved',
  )

export const useUpdatePayslip = () =>
  usePayrollMutation(
    ({ id, items }: { id: string; items: PayslipItemInput[] }) =>
      payrollApi.updatePayslip(id, items),
    () => 'Pay slip updated',
  )

const SLIP_MESSAGES = {
  hold: 'Pay slip on hold',
  pay: 'Pay slip released',
  recalculate: 'Pay slip recalculated',
}
export const usePayslipAction = () =>
  usePayrollMutation(
    ({ id, action }: { id: string; action: 'hold' | 'pay' | 'recalculate' }) =>
      payrollApi.payslipAction(id, action),
    ({ action }) => SLIP_MESSAGES[action],
  )

export const useHoldPayslips = () =>
  usePayrollMutation(
    (ids: string[]) => payrollApi.holdPayslips(ids),
    (_ids, result) =>
      result.held === 0
        ? 'Nothing to put on hold'
        : `${result.held} pay slip${result.held === 1 ? '' : 's'} on hold`,
  )

export const useCreateDailyWage = () =>
  usePayrollMutation(
    (input: DailyWageInput) => payrollApi.createDailyWage(input),
    () => 'Daily wage payroll created',
  )

export const useUpdateDailyWage = () =>
  usePayrollMutation(
    ({ id, input }: { id: string; input: Parameters<typeof payrollApi.updateDailyWage>[1] }) =>
      payrollApi.updateDailyWage(id, input),
    () => 'Daily wage payroll updated',
  )

export const useDailyWageVouchers = () =>
  usePayrollMutation(
    (id: string) => payrollApi.dailyWageVouchers(id),
    (_id, result) => `${result.created} voucher${result.created === 1 ? '' : 's'} created`,
  )

export const useDeleteVoucher = () =>
  usePayrollMutation(
    (id: string) => payrollApi.deleteVoucher(id),
    () => 'Voucher deleted',
  )

export const useSaveEmployeeVoucher = () =>
  usePayrollMutation(
    ({ id, input }: { id?: string | undefined; input: EmployeeVoucherInput }) =>
      id
        ? payrollApi.employeeVouchers.update(id, input)
        : payrollApi.employeeVouchers.create(input),
    ({ id }) => (id ? 'Employee voucher updated' : 'Employee voucher created'),
  )

export const useDeleteEmployeeVoucher = () =>
  usePayrollMutation(
    (id: string) => payrollApi.employeeVouchers.remove(id),
    () => 'Employee voucher deleted',
  )

const FS_MESSAGES = {
  recalculate: 'Final settlement recalculated',
  close: 'Final settlement closed',
}
export const useFinalSettlementAction = () =>
  usePayrollMutation(
    ({ id, action }: { id: string; action: 'recalculate' | 'close' }) =>
      payrollApi.finalSettlementAction(id, action),
    ({ action }) => FS_MESSAGES[action],
  )

export const useAddOpeningBalance = () =>
  usePayrollMutation(
    (input: OpeningBalanceInput) => payrollApi.addOpeningBalance(input),
    () => 'Opening balance saved',
  )

const importMessage = (_variables: unknown, result: { created: number; errors: string[] }) =>
  `Imported ${result.created} row${result.created === 1 ? '' : 's'}${result.errors.length ? `, ${result.errors.length} skipped` : ''}`

export const useImportOpeningBalances = () =>
  usePayrollMutation(
    ({ kind, rows }: { kind: 'opening-balance' | 'provident-fund'; rows: BalanceImportRow[] }) =>
      payrollApi.importOpeningBalances(kind, rows),
    importMessage,
  )

export const useSaveEmployeeAccount = () =>
  usePayrollMutation(
    ({ id, input }: { id?: string | undefined; input: EmployeeAccountInput }) =>
      id ? payrollApi.updateEmployeeAccount(id, input) : payrollApi.createEmployeeAccount(input),
    ({ id }) => (id ? 'Employee account updated' : 'Employee account created'),
  )

export const useImportEmployeeAccounts = () =>
  usePayrollMutation(
    ({ kind, rows }: { kind: 'opening-balance' | 'provident-fund'; rows: BalanceImportRow[] }) =>
      payrollApi.importEmployeeAccounts(kind, rows),
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
    (id: string) => payrollApi.deleteSalaryRevision(id),
    () => 'Salary revision deleted',
  )

export const useImportSalaryRevisions = () =>
  usePayrollMutation(
    (rows: { employeeCode: string; effectiveDate: string; salary: number }[]) =>
      payrollApi.importSalaryRevisions(rows),
    importMessage,
  )

export const useSaveLeaveEncashment = () =>
  usePayrollMutation(
    ({ id, input }: { id?: string | undefined; input: LeaveEncashmentInput }) =>
      id ? payrollApi.updateLeaveEncashment(id, input) : payrollApi.createLeaveEncashment(input),
    ({ id }, result) => {
      const people = result.lines.length === 1 ? '1 person' : `${result.lines.length} people`
      return id ? `Leave encashment updated (${people})` : `Leave encashment created (${people})`
    },
  )

export const useDeleteLeaveEncashment = () =>
  usePayrollMutation(
    (id: string) => payrollApi.deleteLeaveEncashment(id),
    () => 'Leave encashment deleted',
  )
