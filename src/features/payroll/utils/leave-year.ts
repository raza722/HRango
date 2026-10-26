import type { PayrollSettings } from '../types/payroll.types'

/**
 * The leave year today falls in: the calendar year, or with a fiscal year the
 * year it started in (a July–June year started last calendar year until July).
 */
export function currentLeaveYear(
  leave: Pick<PayrollSettings, 'leaveYearBasis' | 'fiscalYearStartMonth'> | undefined,
  today = new Date(),
) {
  const year = today.getFullYear()
  if (!leave || leave.leaveYearBasis === 'calendar') return year
  return today.getMonth() + 1 >= (leave.fiscalYearStartMonth ?? 1) ? year : year - 1
}
