import { endOfMonth, format, isValid, parseISO, subDays } from 'date-fns'
import { z } from 'zod'

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => isValid(parseISO(value)))
  .optional()
  .catch(undefined)

/**
 * `/?from=2026-10-01&to=2026-10-31`: the dates the dashboard covers. Left out for the default,
 * this month up to today. `?month=2026-09` (older links) means that whole month.
 */
export const dashboardSearchSchema = z.object({
  from: day,
  to: day,
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .catch(undefined),
})
export type DashboardSearch = z.infer<typeof dashboardSearchSchema>

/** Longest From → To the dashboard asks for (the time sheet's limit). */
export const DASHBOARD_MAX_DAYS = 366

export interface DashboardPeriod {
  /** First and last day covered, `yyyy-MM-dd` (To is never after today). */
  from: string
  to: string
  /**
   * `yyyy-MM` of To: the month of the figures the API gives only per month (new hires, leavers,
   * turnover, the workforce charts, payroll and recruitment).
   */
  month: string
  /** That month's last day, `yyyy-MM-dd`. */
  monthEnd: string
  currentMonth: string
  today: string
}

const lastDayOf = (month: string) => format(endOfMonth(parseISO(`${month}-01`)), 'yyyy-MM-dd')

/** The dates a dashboard URL covers; days after today, or From after To, fall back. */
export function dashboardPeriodFor(search: DashboardSearch, now = new Date()): DashboardPeriod {
  const today = format(now, 'yyyy-MM-dd')
  const currentMonth = today.slice(0, 7)
  let from = `${currentMonth}-01`
  let to = today
  if (search.from || search.to) {
    to = search.to && search.to <= today ? search.to : today
    from = search.from && search.from <= to ? search.from : `${to.slice(0, 7)}-01`
  } else if (search.month && search.month < currentMonth) {
    from = `${search.month}-01`
    to = lastDayOf(search.month)
  }
  const earliest = format(subDays(parseISO(to), DASHBOARD_MAX_DAYS - 1), 'yyyy-MM-dd')
  if (from < earliest) from = earliest
  const month = to.slice(0, 7)
  return { from, to, month, monthEnd: lastDayOf(month), currentMonth, today }
}

/** The URL search for From → To: the default (this month up to today) leaves the URL clean. */
export function dashboardSearchFor(from: string, to: string, today: string): DashboardSearch {
  const isDefault = to === today && from === `${today.slice(0, 7)}-01`
  return isDefault ? {} : { from, to }
}
