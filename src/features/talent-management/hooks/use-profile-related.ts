import { useQuery } from '@tanstack/react-query'
import { endOfMonth, format, startOfMonth } from 'date-fns'

import { attendanceApi, attendanceKeys, type SummaryParams } from '@/features/attendance'
import { type LeaveApplicationListParams, leavesApi, leavesKeys } from '@/features/leaves'
import { payrollApi, payrollKeys } from '@/features/payroll'
import { standardApi, standardKeys, type StandardListParams } from '@/features/requests'

/*
 * What the Work, Benefits and Leave tabs show of one person, read through the other modules'
 * own APIs (Payroll, Requests → Loan & Advances, Attendance, Leaves), under their own query keys
 * so their screens' changes refresh these too.
 */

/** Rows the profile's small tables show before "View History" / "View More". */
export const PROFILE_ROWS = 3

const DAY = 'yyyy-MM-dd'

/** This month, from its first day to today. */
export function thisMonth(today: Date = new Date()) {
  return { from: format(startOfMonth(today), DAY), to: format(today, DAY) }
}

/** Payroll History: the latest pay slips (`GET /payroll/payslips?scope=all&employeeId`). */
export function usePayslipHistory(employeeId: string, enabled = true) {
  const params = { scope: 'all' as const, employeeId, page: 1, pageSize: PROFILE_ROWS }
  return useQuery({
    queryKey: payrollKeys.list('payslips', params),
    queryFn: ({ signal }) => payrollApi.payslips(params, signal),
    enabled,
  })
}

/** Benefits: the person's Payroll accounts (`GET /payroll/payslips/summary?employeeId`). */
export function usePayrollAccounts(employeeId: string, enabled = true) {
  return useQuery({
    queryKey: payrollKeys.list('payslip-summary', { employeeId }),
    queryFn: ({ signal }) => payrollApi.myAccounts(employeeId, signal),
    enabled,
  })
}

/** `details` of a loan request, as far as Loan Summary reads them. */
export interface LoanDetails {
  loanTypeName?: string | null
  amountRequested?: number | null
  approvedAmount?: number | null
}

/** Loan Summary: the latest loan requests (`GET /requests/loan?view=all&employeeId`). */
export function useLoanRequests(employeeId: string, enabled = true) {
  const params: StandardListParams = {
    scope: 'all',
    page: 1,
    pageSize: PROFILE_ROWS,
    filters: { employeeId },
  }
  return useQuery({
    queryKey: standardKeys.list('loan-advances', params),
    queryFn: ({ signal }) => standardApi.list<LoanDetails>('loan-advances', params, signal),
    enabled,
  })
}

/** Attendance: this month's totals (`GET /attendance/time-sheet/summary?tab=all&employeeId`). */
export function useAttendanceMonth(employeeId: string, enabled = true) {
  const params: SummaryParams = { scope: 'all', employeeId, ...thisMonth() }
  return useQuery({
    queryKey: attendanceKeys.summary(params),
    queryFn: ({ signal }) => attendanceApi.summary(params, signal),
    enabled,
  })
}

/** Leave list: the latest applications (`GET /leaves/applications?tab=all&employeeId`). */
export function useLeaveApplicationsOf(employeeId: string, enabled = true) {
  const params: LeaveApplicationListParams = {
    tab: 'all',
    page: 1,
    pageSize: 5,
    filters: { employeeId },
  }
  return useQuery({
    queryKey: leavesKeys.applicationList(params),
    queryFn: ({ signal }) => leavesApi.applications(params, signal),
    enabled,
  })
}

/** Leave Overview This Month: approved leave starting this month (days per type). */
export function useLeaveThisMonth(employeeId: string, enabled = true) {
  const today = new Date()
  const params: LeaveApplicationListParams = {
    tab: 'all',
    status: 'approved',
    page: 1,
    pageSize: 100,
    filters: {
      employeeId,
      fromDate: format(startOfMonth(today), DAY),
      toDate: format(endOfMonth(today), DAY),
    },
  }
  return useQuery({
    queryKey: leavesKeys.applicationList(params),
    queryFn: ({ signal }) => leavesApi.applications(params, signal),
    enabled,
  })
}

/** Leave Overview's "allowed": each type's entitlement this leave year (`GET /leaves/balances`). */
export function useLeaveBalancesOf(employeeId: string, enabled = true) {
  const params = { employeeId, page: 1, pageSize: 100 }
  return useQuery({
    queryKey: leavesKeys.balances(params),
    queryFn: ({ signal }) => leavesApi.balances(params, signal),
    enabled,
  })
}
