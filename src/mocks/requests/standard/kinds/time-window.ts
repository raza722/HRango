import { addDays, format, parse } from 'date-fns'
import { HttpResponse } from 'msw'

import { findEmployee } from '../../../employees/seed'
import type { RequestBodyIn, RequestHeaderFields } from '../../backend'
import { entryOn } from '../../effects'
import { fallbackGet } from '../../fallback'
import { ME } from '../../people'

/*
 * Relaxation and Official Visit share the API's `time_window` kind: one date
 * with a time range. `POST /requests/<type>` sends `details: {windowDate,
 * startTime, endTime}` with the reason and description in the header; the
 * details come back with the duration and the day's time slot.
 */

/** What both types store. */
export interface TimeWindowStored {
  date: string
  /** `HH:mm`. */
  startTime: string
  endTime: string
  reason: string
  /** The day's shift when the request was made (null for a visit on a day without one). */
  slotName: string | null
  shiftIn: string | null
  shiftOut: string | null
}

/** `09:05:00` → `09:05`. */
export const toHm = (time: unknown) => (typeof time === 'string' ? time.slice(0, 5) : '')

const minutesOf = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** Minutes between two times; past midnight counts on (`22:00`–`02:00` is 240). */
export function spanMinutes(startTime: string, endTime: string): number {
  const span = minutesOf(endTime) - minutesOf(startTime)
  return span > 0 ? span : span + 1440
}

/** A time-window `RequestIn` → the type's input (`date`, times as `HH:mm`, reason, description). */
export function timeWindowFromBody(body: RequestBodyIn) {
  const details = body.details
  return {
    date: typeof details.windowDate === 'string' ? details.windowDate : (body.fromDate ?? ''),
    startTime: toHm(details.startTime),
    endTime: toHm(details.endTime),
    reason: body.reason ?? '',
    description: body.description ?? '',
  }
}

/** The stored window as the API's `details`. */
export function timeWindowDetails(kind: string, value: TimeWindowStored) {
  return {
    windowKind: kind,
    windowDate: value.date,
    startTime: `${value.startTime}:00`,
    endTime: `${value.endTime}:00`,
    durationMinutes: spanMinutes(value.startTime, value.endTime),
    timeSlotId: null,
    timeSlotName: value.slotName,
    slotStartTime: value.shiftIn ? `${value.shiftIn}:00` : null,
    slotEndTime: value.shiftOut ? `${value.shiftOut}:00` : null,
  }
}

/** The header of a one-day request. */
export function timeWindowHeader(value: {
  date: string
  reason: string
  description?: string | null | undefined
}): RequestHeaderFields {
  return {
    fromDate: value.date,
    toDate: value.date,
    days: 1,
    reason: value.reason || null,
    description: value.description ?? null,
    application: null,
  }
}

const nextDay = (date: string) =>
  format(addDays(parse(date, 'yyyy-MM-dd', new Date()), 1), 'yyyy-MM-dd')

/**
 * `GET /scheduling/schedules?employeeId&from&to` (the board) for the request
 * forms' Time Slot, answered only when the scheduling mock does not serve it.
 * Without an employee: the signed-in person.
 */
export const scheduleBoardFallback = fallbackGet('/scheduling/schedules', ({ request }) => {
  const url = new URL(request.url)
  const employeeId = url.searchParams.get('employeeId') ?? ME
  const from = url.searchParams.get('from') ?? format(new Date(), 'yyyy-MM-dd')
  const to = url.searchParams.get('to') ?? from
  const employee = findEmployee(employeeId)
  const meta = { page: 1, pageSize: 10, total: employee ? 1 : 0, totalPages: 1 }
  if (!employee) return HttpResponse.json({ data: [], meta })
  const shifts = []
  // A month at most, so a wrong range cannot loop for long.
  for (let date = from, step = 0; date <= to && step < 31; date = nextDay(date), step += 1) {
    const entry = entryOn(employeeId, date)
    if (entry?.kind !== 'shift' || !entry.clockIn || !entry.clockOut) continue
    const overnight = entry.clockOut <= entry.clockIn
    shifts.push({
      id: entry.id,
      workDate: date,
      startAt: `${date}T${entry.clockIn}:00`,
      endAt: `${overnight ? nextDay(date) : date}T${entry.clockOut}:00`,
      timeSlotId: entry.timeSlotId ?? null,
      timeSlotName: entry.slot.name,
      isOvernight: overnight,
      isWfh: entry.workFromHome,
    })
  }
  return HttpResponse.json({
    data: [
      { employee: { id: employeeId, name: employee.name }, shifts, restDays: [], holidays: [] },
    ],
    meta,
  })
})
