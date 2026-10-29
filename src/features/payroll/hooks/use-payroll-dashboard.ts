import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { Paginated } from '@/types/api'

import { payrollApi, payrollKeys } from '../api/payroll.api'

/*
 * The dashboard's widgets beyond `GET /payroll/dashboard`, read from endpoints that exist:
 * the Loans module's instalments (Month Wise Loan & Advance) and one person's payslips
 * (Employee Month Wise Earning).
 */

interface InstallmentRow {
  /** yyyy-MM-dd, the 1st of the month payroll deducts it in. */
  dueMonth: string
  /** Decimals arrive as text ("16666.66"). */
  amount: number | string
  paidAmount: number | string | null
}

const toNumber = (value: number | string | null) => {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

/** The year's loan and advance instalments per month (`yyyy-MM`): due and repaid. */
export interface LoanMonth {
  month: string
  due: number
  paid: number
}

/** `GET /loans/installments?monthFrom&monthTo` (every page), added up per month. */
async function loanMonths(year: number, signal?: AbortSignal): Promise<LoanMonth[]> {
  const months = new Map<string, LoanMonth>()
  for (let page = 1; ; page += 1) {
    const { data } = await apiClient.get<Paginated<InstallmentRow>>('/loans/installments', {
      params: {
        monthFrom: `${String(year)}-01-01`,
        monthTo: `${String(year)}-12-31`,
        page,
        pageSize: 100,
      },
      signal,
    })
    for (const row of data.data) {
      const month = row.dueMonth.slice(0, 7)
      const current = months.get(month) ?? { month, due: 0, paid: 0 }
      current.due += toNumber(row.amount)
      current.paid += toNumber(row.paidAmount)
      months.set(month, current)
    }
    if (page >= data.meta.totalPages) break
  }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month))
}

export const useLoanMonths = (year: number) =>
  useQuery({
    queryKey: payrollKeys.list('dashboard-loans', { year }),
    queryFn: ({ signal }) => loanMonths(year, signal),
    retry: false,
  })

/** The person whose earnings the dashboard opens on: the one on the latest payslip. */
export const useLatestPayslip = () =>
  useQuery({
    queryKey: payrollKeys.list('dashboard-latest-payslip'),
    queryFn: async ({ signal }) =>
      (await payrollApi.payslips({ scope: 'all', page: 1, pageSize: 1 }, signal)).data[0] ?? null,
    retry: false,
  })

/** One person's regular payslips (final settlements left out), newest first. */
export const useEmployeeEarnings = (employeeId: string | null) =>
  useQuery({
    queryKey: payrollKeys.list('dashboard-earnings', { employeeId }),
    queryFn: async ({ signal }) =>
      (
        await payrollApi.payslips(
          { scope: 'all', employeeId: employeeId ?? undefined, page: 1, pageSize: 100 },
          signal,
        )
      ).data.filter((slip) => !slip.isFinalSettlement),
    enabled: employeeId !== null,
    retry: false,
  })
