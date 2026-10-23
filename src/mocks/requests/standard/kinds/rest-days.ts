import { addDays, differenceInCalendarDays, format, parse } from 'date-fns'
import { z } from 'zod'

import type { ScheduleEntry } from '@/features/scheduling'

import { enrollments, rosterGroups } from '../../../roster/handlers'
import { scheduleEntries } from '../../../scheduling/handlers'
import { slotFor } from '../../../scheduling/seed'
import { createId } from '../../../utils'
import { entryOn, rosterTimes } from '../../effects'
import { invalid, today } from '../../http'
import { mustFind } from '../../people'
import {
  defineStandardKind,
  seedRequest,
  type StandardKindServer,
  type StoredStandardRequest,
} from '../engine'

/*
 * Rest Days: the person asks for days off on their roster's working days
 * between two dates ("Create Rest Day Request": Employee Name, Department,
 * Roster, Date (from), Date (to), Reason; "Selected Days" counts the days).
 * Approval turns those days into paid rest days on the schedule; an approved
 * cancellation puts the shifts back.
 */

const ymd = /^\d{4}-\d{2}-\d{2}$/
const schema = z.object({
  department: z.string().trim().min(1).max(80),
  rosterGroupId: z.string().min(1),
  from: z.string().regex(ymd),
  to: z.string().regex(ymd),
  reason: z.string().trim().max(500),
})
type Input = z.infer<typeof schema>

export interface RestDayStored {
  department: string
  rosterGroupId: string
  from: string
  to: string
  /** The roster's working days between the dates: the days asked off. */
  dates: string[]
  payable: boolean
  reason: string
}

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())
const iso = (date: Date) => format(date, 'yyyy-MM-dd')
const clock = (time: string | null) =>
  time ? format(parse(time, 'HH:mm', new Date()), 'hh:mm aaa') : ''

/** The roster's day: its default times, else its first working day's. */
function rosterDayTimes(rosterGroupId: string) {
  const group = rosterGroups.find(rosterGroupId)
  if (!group) return null
  const first = group.days.find((item) => !item.isWeekend && item.clockIn && item.clockOut)
  const clockIn = group.clockIn ?? first?.clockIn ?? null
  const clockOut = group.clockOut ?? first?.clockOut ?? null
  return { group, clockIn, clockOut }
}

/** "Morning Shift (10:00 am - 05:00 pm)", as the list's Shift column writes it. */
function shiftLabel(rosterGroupId: string): string {
  const times = rosterDayTimes(rosterGroupId)
  if (!times) return '—'
  return times.clockIn && times.clockOut
    ? `${times.group.title} (${clock(times.clockIn)} - ${clock(times.clockOut)})`
    : times.group.title
}

/** The roster's working days between two dates. */
function workingDays(rosterGroupId: string, from: string, to: string): string[] {
  const count = differenceInCalendarDays(day(to), day(from))
  return Array.from({ length: count + 1 }, (_, index) => iso(addDays(day(from), index))).filter(
    (date) => rosterTimes(rosterGroupId, date) !== null,
  )
}

const stored = (record: StoredStandardRequest) => record.payload as unknown as RestDayStored

const overlaps = (a: RestDayStored, from: string, to: string) => a.from <= to && a.to >= from

function toPayload(
  input: Input,
  context: {
    employeeId: string
    ignoreId: string | null
    records: readonly StoredStandardRequest[]
  },
): Response | Record<string, unknown> {
  const employee = mustFind(context.employeeId)
  if (input.department !== employee.department) {
    return invalid(`${employee.name} works in ${employee.department}.`, {
      department: `Choose ${employee.department}`,
    })
  }
  const group = rosterGroups.find(input.rosterGroupId)
  if (!group?.isActive) return invalid('Choose a roster.', { rosterGroupId: 'Choose a roster' })
  if (input.from < today()) {
    return invalid('Choose today or a later day.', { from: 'Choose today or a later day' })
  }
  if (input.to < input.from) {
    return invalid('Date (to) comes before Date (from).', { to: 'Choose Date (from) or later' })
  }
  if (differenceInCalendarDays(day(input.to), day(input.from)) > 30) {
    return invalid('Ask for 31 days at most at a time.', { to: 'Ask for 31 days at most' })
  }
  const dates = workingDays(group.id, input.from, input.to)
  if (dates.length === 0) {
    return invalid(`${group.title} has no working day between these dates.`, {
      from: 'Choose dates with working days',
    })
  }
  const clash = context.records.find(
    (record) =>
      record.id !== context.ignoreId &&
      record.employeeId === context.employeeId &&
      ['pending', 'completed', 'cancelling'].includes(record.status) &&
      overlaps(stored(record), input.from, input.to),
  )
  if (clash) {
    return invalid(`${clash.code} already asks for rest days in these dates.`, {
      from: 'These dates are already asked for',
    })
  }
  return {
    department: input.department,
    rosterGroupId: group.id,
    from: input.from,
    to: input.to,
    dates,
    // Rest days granted on request are paid (the list's Payable column).
    payable: true,
    reason: input.reason,
  } satisfies RestDayStored
}

/** What approval changed: each day's entry before it became a rest day. */
interface Effect {
  before: { date: string; entry: ScheduleEntry | null }[]
}

function applyRestDays(record: StoredStandardRequest): Effect {
  const payload = stored(record)
  const at = new Date().toISOString()
  const group = rosterGroups.find(payload.rosterGroupId)
  const before = payload.dates.map((date) => ({
    date,
    entry: entryOn(record.employeeId, date) ?? null,
  }))
  for (const { date, entry } of before) {
    const rest: Omit<ScheduleEntry, 'id' | 'createdAt' | 'updatedAt'> = {
      employeeId: record.employeeId,
      date,
      kind: 'rest',
      rosterGroupId: payload.rosterGroupId,
      clockIn: null,
      clockOut: null,
      workFromHome: false,
      geoFenceIds: [],
      breaks: [],
      slot: entry?.slot ?? slotFor(group ?? { title: 'Rest Day', days: [] }),
      restDayPayable: payload.payable,
      batchId: record.code,
    }
    if (entry) scheduleEntries.update(entry.id, { ...entry, ...rest, updatedAt: at })
    else scheduleEntries.insert({ ...rest, id: createId('se'), createdAt: at, updatedAt: at })
  }
  return { before }
}

function revertRestDays(record: StoredStandardRequest): void {
  const effect = record.effect as Effect | undefined
  if (!effect) return
  for (const { date, entry } of effect.before) {
    const current = entryOn(record.employeeId, date)
    if (entry) {
      if (current) scheduleEntries.update(current.id, { ...entry, id: current.id })
      else scheduleEntries.insert(entry)
    } else if (current) {
      scheduleEntries.remove(current.id)
    }
  }
}

/** The roster the person is enrolled in now. */
const rosterOf = (employeeId: string) =>
  enrollments.all().find((item) => item.employeeId === employeeId && item.status === 'active')
    ?.rosterGroupId ?? null

const def: StandardKindServer<Input> = {
  kind: 'rest-days',
  settingsType: 'rest-day',
  codePrefix: 'RD-',
  codeDigits: 3,
  schema,
  toPayload,
  dateOf: (payload) => String(payload.from),
  present: (payload) => {
    const value = payload as unknown as RestDayStored
    const times = rosterDayTimes(value.rosterGroupId)
    const upper = (time: string | null) =>
      time ? format(parse(time, 'HH:mm', new Date()), 'hh:mm a') : ''
    let minutes = 0
    if (times?.clockIn && times.clockOut) {
      const [inH = 0, inM = 0] = times.clockIn.split(':').map(Number)
      const [outH = 0, outM = 0] = times.clockOut.split(':').map(Number)
      minutes = (outH * 60 + outM - (inH * 60 + inM) + 1440) % 1440
    }
    return {
      ...value,
      rosterTitle: times?.group.title ?? '—',
      shift: shiftLabel(value.rosterGroupId),
      // The Approvals frames' Time and Duration columns: the roster's day.
      time: times?.clockIn ? `${upper(times.clockIn)} - ${upper(times.clockOut)}` : '—',
      duration: `${String(Math.floor(minutes / 60))}h : ${String(minutes % 60).padStart(2, '0')}m`,
      days: value.dates.length,
    }
  },
  filters: {
    rosterGroupId: (record, value) => stored(record).rosterGroupId === value,
  },
  lookups: () => ({
    rosters: rosterGroups
      .all()
      .filter((group) => group.isActive)
      .map((group) => ({
        id: group.id,
        title: group.title,
        shift: shiftLabel(group.id),
        workingDays: group.days.filter((item) => !item.isWeekend).map((item) => item.day),
      }))
      .sort((a, b) => a.title.localeCompare(b.title)),
    /** Each person's current roster, so the form can start from it. */
    rosterOf: Object.fromEntries(
      [...new Set(enrollments.all().map((item) => item.employeeId))].map((id) => [
        id,
        rosterOf(id),
      ]),
    ),
  }),
  cancellationsView: true,
  onCompleted: applyRestDays,
  onCancelled: revertRestDays,
  seed: () => {
    const start = (offset: number) => iso(addDays(new Date(), offset))
    const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()
    const make = (
      id: string,
      employeeId: string,
      fromOffset: number,
      toOffset: number,
      status: StoredStandardRequest['status'],
      options: { approvedSteps?: number; daysAgo?: number; reason?: string } = {},
    ) => {
      const employee = mustFind(employeeId)
      const rosterGroupId = rosterOf(employeeId) ?? 'rg_morning'
      const from = start(fromOffset)
      const to = start(toOffset)
      const dates = workingDays(rosterGroupId, from, to)
      return seedRequest(def, {
        id,
        code: `RD-${id.slice(-3)}`,
        employeeId,
        payload: {
          department: employee.department,
          rosterGroupId,
          from,
          to,
          dates: dates.length > 0 ? dates : [from],
          payable: true,
          reason: options.reason ?? 'Family event out of town.',
        } satisfies RestDayStored,
        at: at(options.daysAgo ?? 3),
        status,
        ...(options.approvedSteps !== undefined ? { approvedSteps: options.approvedSteps } : {}),
      })
    }
    return [
      make('rd_001', 'em_sadia', 6, 7, 'pending', { daysAgo: 1 }),
      make('rd_002', 'em_haroon', 9, 10, 'pending', { daysAgo: 2 }),
      make('rd_003', 'em_zainab', 12, 13, 'pending', { approvedSteps: 1, daysAgo: 2 }),
      make('rd_004', 'em_omer', 4, 4, 'completed', { daysAgo: 5 }),
      make('rd_005', 'em_laiba', 15, 16, 'cancelling', { daysAgo: 6, reason: 'Moving house.' }),
      make('rd_006', 'em_shelley', 20, 21, 'pending', {
        daysAgo: 1,
        reason: 'Wedding in the family.',
      }),
      make('rd_007', 'em_shelley', 2, 2, 'completed', { daysAgo: 8, reason: 'Doctor visit.' }),
      make('rd_008', 'em_mahnoor', 8, 8, 'rejected', { daysAgo: 4 }),
    ]
  },
}

export const restDaysServer = defineStandardKind(def)
