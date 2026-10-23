import type { LeaveConfiguration } from '../types/payroll.types'

/**
 * The leave year today falls in: the calendar year, or with a fiscal year the
 * year it started in (a July–June year started last calendar year until July).
 */
export function currentLeaveYear(leave: LeaveConfiguration | undefined, today = new Date()) {
  const year = today.getFullYear()
  if (!leave || leave.fiscalYear === 'calendar') return year
  return today.getMonth() + 1 >= leave.yearStartMonth ? year : year - 1
}
