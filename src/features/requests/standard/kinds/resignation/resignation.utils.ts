import { differenceInCalendarDays, parse } from 'date-fns'

import type { ResignationPayload } from './resignation.types'

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())

/** Days between the resignation and last working dates; null until both are known. */
export function noticeDaysOf(from: string | null, to: string | null): number | null {
  if (!from || !to || to < from) return null
  return differenceInCalendarDays(day(to), day(from))
}

/** "30 days": the API's notice period, or the days between the two dates. */
export function noticePeriod(payload: ResignationPayload): string {
  const days =
    payload.noticePeriodDays ?? noticeDaysOf(payload.resignationDate, payload.lastWorkingDate)
  return days === null ? '—' : `${String(days)} ${days === 1 ? 'day' : 'days'}`
}
