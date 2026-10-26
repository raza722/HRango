import { addDays, differenceInCalendarDays, format, parse } from 'date-fns'
import { type HttpHandler, HttpResponse } from 'msw'
import { z } from 'zod'

import { eachDay } from '@/features/scheduling'

import { DIRECTORY, findEmployee } from '../../../employees/seed'
import { enrollments } from '../../../roster/handlers'
import { scheduleEntries } from '../../../scheduling/handlers'
import { entryOn, rosterTimes } from '../../effects'
import { fallbackGet } from '../../fallback'
import { invalid } from '../../http'
import { ME, mustFind, requestEmployee } from '../../people'

/*
 * A person's days as the Work From Home week strip and Leave's shift strip
 * show them: the day's shift ("10:00 AM - 05:00 PM"), a "Rest Day" given on
 * a roster working day, or the roster's "Day off". Read from the schedule
 * (Scheduling), else from the roster the person is enrolled in.
 */

export interface ScheduleDay {
  date: string
  status: 'shift' | 'rest' | 'off'
  clockIn: string | null
  clockOut: string | null
  /** "10:00 AM - 05:00 PM", "Rest Day" or "Day off". */
  label: string
  rosterGroupId: string | null
  workFromHome: boolean
}

const clock = (time: string) => format(parse(time, 'HH:mm', new Date()), 'hh:mm a')

/** "10:00 AM - 05:00 PM". */
export const shiftTimes = (clockIn: string, clockOut: string) =>
  `${clock(clockIn)} - ${clock(clockOut)}`

/**
 * The roster the person works: the one they are enrolled in now, else the
 * roster of their latest scheduled day (most people are scheduled without an
 * enrollment).
 */
export function rosterOf(employeeId: string): string | null {
  const enrolled = enrollments
    .all()
    .find((item) => item.employeeId === employeeId && item.status === 'active')
  if (enrolled) return enrolled.rosterGroupId
  let latest: { date: string; rosterGroupId: string } | null = null
  for (const entry of scheduleEntries.all()) {
    if (entry.employeeId !== employeeId || !entry.rosterGroupId) continue
    if (!latest || entry.date > latest.date) {
      latest = { date: entry.date, rosterGroupId: entry.rosterGroupId }
    }
  }
  return latest?.rosterGroupId ?? null
}

export function scheduleDay(employeeId: string, date: string): ScheduleDay {
  const entry = entryOn(employeeId, date)
  if (entry) {
    if (entry.kind === 'shift' && entry.clockIn && entry.clockOut) {
      return {
        date,
        status: 'shift',
        clockIn: entry.clockIn,
        clockOut: entry.clockOut,
        label: shiftTimes(entry.clockIn, entry.clockOut),
        rosterGroupId: entry.rosterGroupId,
        workFromHome: entry.workFromHome,
      }
    }
    // A rest entry on one of the roster's working days was given on purpose.
    const roster = entry.rosterGroupId ?? rosterOf(employeeId)
    const given = entry.restDayPayable || (roster ? rosterTimes(roster, date) !== null : false)
    return {
      date,
      status: given ? 'rest' : 'off',
      clockIn: null,
      clockOut: null,
      label: given ? 'Rest Day' : 'Day off',
      rosterGroupId: entry.rosterGroupId,
      workFromHome: false,
    }
  }
  const roster = rosterOf(employeeId)
  const times = roster ? rosterTimes(roster, date) : null
  if (times) {
    return {
      date,
      status: 'shift',
      clockIn: times.clockIn,
      clockOut: times.clockOut,
      label: shiftTimes(times.clockIn, times.clockOut),
      rosterGroupId: times.group.id,
      workFromHome: false,
    }
  }
  return {
    date,
    status: 'off',
    clockIn: null,
    clockOut: null,
    label: 'Day off',
    rosterGroupId: roster,
    workFromHome: false,
  }
}

export const scheduleDays = (employeeId: string, from: string, to: string) =>
  eachDay(from, to).map((date) => scheduleDay(employeeId, date))

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const querySchema = z.object({
  tab: z.enum(['my', 'subordinates', 'all']).default('all'),
  employeeId: z.string().min(1).optional(),
  from: ymd,
  to: ymd,
})

/** Days one board answers at once (two months). */
const MAX_DAYS = 62

const nextDay = (date: string) =>
  format(addDays(parse(date, 'yyyy-MM-dd', new Date()), 1), 'yyyy-MM-dd')

/** One person's row of Scheduling's board (`BoardRowOut`) from their days. */
function boardRow(employeeId: string, from: string, to: string) {
  const person = requestEmployee(mustFind(employeeId))
  const days = scheduleDays(employeeId, from, to)
  const shifts = days.flatMap((item) =>
    item.status === 'shift' && item.clockIn && item.clockOut
      ? [
          {
            id: `${employeeId}-${item.date}`,
            workDate: item.date,
            startAt: `${item.date}T${item.clockIn}:00`,
            endAt: `${item.clockOut < item.clockIn ? nextDay(item.date) : item.date}T${item.clockOut}:00`,
            timeSlotId: item.rosterGroupId ?? 'ts_default',
            timeSlotCode: 'TS',
            timeSlotName: item.label,
            timeSlotColor: null,
            isFlexible: false,
            isOvernight: item.clockOut < item.clockIn,
            geoFenceId: null,
            geoFenceName: null,
            isWfh: item.workFromHome,
            plannedMinutes: 0,
            scheduleBatchId: null,
            rowVersion: '1',
          },
        ]
      : [],
  )
  return {
    employee: {
      id: employeeId,
      code: person.code,
      name: person.name,
      designationName: person.designation,
      departmentName: person.department,
      status: 'active',
      defaultTimeSlotId: null,
      defaultTimeSlotName: null,
      plannedMinutes: 0,
      shiftCount: shifts.length,
    },
    shifts,
    restDays: days
      .filter((item) => item.status === 'rest')
      .map((item) => ({
        id: `${employeeId}-rest-${item.date}`,
        restDate: item.date,
        isPayable: true,
        restDayRuleId: null,
        requestId: null,
      })),
    holidays: [],
  }
}

/**
 * `GET /scheduling/schedules?tab&employeeId&from&to` (Scheduling's board) for
 * the request forms' shift strips, answered only when the Scheduling mock does
 * not serve it. `tab=my` is the signed-in person.
 */
export const scheduleBoardHandler: HttpHandler = fallbackGet(
  '/scheduling/schedules',
  ({ request }) => {
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!parsed.success) return invalid('Choose the dates.')
    const { tab, employeeId, from, to } = parsed.data
    const span = differenceInCalendarDays(
      parse(to, 'yyyy-MM-dd', new Date()),
      parse(from, 'yyyy-MM-dd', new Date()),
    )
    if (span < 0 || span >= MAX_DAYS) return invalid(`Choose up to ${String(MAX_DAYS)} days.`)
    const people = employeeId ? [employeeId] : tab === 'my' ? [ME] : []
    const rows = people.filter((id) => findEmployee(id)).map((id) => boardRow(id, from, to))
    return HttpResponse.json({
      data: rows,
      meta: { page: 1, pageSize: 10, total: rows.length, totalPages: 1 },
      dayTotals: [],
    })
  },
)

/** The people who have a photo, for the strip's person cell. */
export function photos(): Record<string, string> {
  const found: Record<string, string> = {}
  for (const employee of DIRECTORY) {
    const url = requestEmployee(employee).photoUrl
    if (url) found[employee.id] = url
  }
  return found
}
