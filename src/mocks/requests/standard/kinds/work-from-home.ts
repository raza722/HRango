import { addDays, differenceInCalendarDays, format, parse } from 'date-fns'
import { z } from 'zod'

import { eachDay, type ScheduleEntry, weekdayOf } from '@/features/scheduling'

import { scheduleEntries } from '../../../scheduling/handlers'
import { slotFor } from '../../../scheduling/seed'
import { createId } from '../../../utils'
import type { RequestBodyIn } from '../../backend'
import { entryOn, rosterTimes } from '../../effects'
import { invalid, today } from '../../http'
import { ME, mustFind } from '../../people'
import {
  defineStandardKind,
  type PayloadContext,
  seedRequest,
  type StandardKindServer,
  type StoredStandardRequest,
} from '../engine'
import { rosterOf, scheduleBoardHandler, scheduleDay } from './work-from-home-days'

/*
 * Work From Home: the person picks a Start Date and an End Date, and in the
 * week strip under them ticks the shifts they will work from home ("Please
 * select at least one shift."). "Selected Days" counts the ticked shifts.
 * Approval marks those schedule entries `workFromHome`; an approved
 * cancellation puts them back as they were.
 */

const ymd = /^\d{4}-\d{2}-\d{2}$/
const schema = z.object({
  from: z.string().regex(ymd),
  to: z.string().regex(ymd),
  dates: z.array(z.string().regex(ymd)).max(62),
  reason: z.string().trim().max(500),
})
type Input = z.infer<typeof schema>

export interface WorkFromHomeStored {
  from: string
  to: string
  /** The ticked shifts' days. */
  dates: string[]
  count: number
  reason: string
}

const stored = (record: StoredStandardRequest) => record.payload as unknown as WorkFromHomeStored
const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())
const iso = (date: Date) => format(date, 'yyyy-MM-dd')
const longDay = (date: string) => format(day(date), 'EEEE, MMMM d')

function toPayload(input: Input, context: PayloadContext): Response | Record<string, unknown> {
  const employee = mustFind(context.employeeId)
  if (input.from < today()) {
    return invalid('Choose today or a later day.', { fromDate: 'Choose today or a later day' })
  }
  if (input.to < input.from) {
    return invalid('End Date comes before Start Date.', {
      toDate: 'Choose the Start Date or later',
    })
  }
  if (differenceInCalendarDays(day(input.to), day(input.from)) > 30) {
    return invalid('Ask for 31 days at most at a time.', { toDate: 'Ask for 31 days at most' })
  }
  const dates = [...new Set(input.dates)].filter((date) => date >= input.from && date <= input.to)
  dates.sort()
  if (dates.length === 0) {
    return invalid('Please select at least one shift.', {
      dates: 'Please select at least one shift.',
    })
  }
  for (const date of dates) {
    const shift = scheduleDay(employee.id, date)
    if (shift.status !== 'shift') {
      return invalid(`${employee.name} has no shift on ${longDay(date)}.`, {
        dates: `${longDay(date)} has no shift`,
      })
    }
    if (shift.workFromHome) {
      return invalid(`${employee.name} already works from home on ${longDay(date)}.`, {
        dates: `${longDay(date)} is already from home`,
      })
    }
  }
  const clash = context.records.find(
    (record) =>
      record.id !== context.ignoreId &&
      record.employeeId === employee.id &&
      ['pending', 'completed', 'cancelling'].includes(record.status) &&
      stored(record).dates.some((date) => dates.includes(date)),
  )
  if (clash) {
    const taken = stored(clash).dates.find((date) => dates.includes(date)) ?? dates[0] ?? ''
    return invalid(`${clash.code} already asks for ${longDay(taken)}.`, {
      dates: `${longDay(taken)} is already asked for`,
    })
  }
  return {
    from: input.from,
    to: input.to,
    dates,
    count: dates.length,
    reason: input.reason,
  } satisfies WorkFromHomeStored
}

/** What approval changed: each day's entry before it became a work-from-home day. */
interface Effect {
  before: { date: string; entry: ScheduleEntry | null }[]
}

function applyWorkFromHome(record: StoredStandardRequest): Effect {
  const at = new Date().toISOString()
  const before = stored(record).dates.map((date) => ({
    date,
    entry: entryOn(record.employeeId, date) ?? null,
  }))
  for (const { date, entry } of before) {
    // Only the flag changes, as Scheduling's own "Work From Home" edit does.
    if (entry) {
      scheduleEntries.update(entry.id, { ...entry, workFromHome: true, updatedAt: at })
      continue
    }
    // No entry yet (past the scheduled months): write the roster's shift, from home.
    const roster = rosterOf(record.employeeId)
    const times = roster ? rosterTimes(roster, date) : null
    if (!times) continue
    scheduleEntries.insert({
      id: createId('se'),
      employeeId: record.employeeId,
      date,
      kind: 'shift',
      rosterGroupId: times.group.id,
      clockIn: times.clockIn,
      clockOut: times.clockOut,
      workFromHome: true,
      geoFenceIds: [],
      breaks: [],
      slot: slotFor(times.group, times.clockOut < times.clockIn),
      restDayPayable: false,
      batchId: record.code,
      createdAt: at,
      updatedAt: at,
    })
  }
  return { before }
}

function revertWorkFromHome(record: StoredStandardRequest): void {
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

/** A `RequestIn` body → the stored shape's input (`details.dates`: the ticked shift days). */
function fromBody(body: RequestBodyIn): unknown {
  const dates = body.details.dates
  const from = body.fromDate ?? ''
  const to = body.toDate ?? from
  return {
    from,
    to,
    // No dates: every shift day between the dates, as the API counts them.
    dates: Array.isArray(dates)
      ? dates
      : from && to && to >= from
        ? eachDay(from, to)
            .slice(0, 62)
            .filter((date) => scheduleDay(ME, date).status === 'shift')
        : [],
    reason: body.reason ?? '',
  }
}

const def: StandardKindServer<Input> = {
  kind: 'work-from-home',
  typeCode: 'work_from_home',
  typeName: 'Work From Home',
  settingsType: 'work_from_home',
  codePrefix: 'WFH-',
  codeDigits: 4,
  fromBody,
  schema,
  toPayload,
  dateOf: (payload) => String(payload.from),
  header: (payload) => {
    const value = payload as unknown as WorkFromHomeStored
    return {
      fromDate: value.dates[0] ?? value.from,
      toDate: value.dates.at(-1) ?? value.to,
      days: value.count,
      reason: value.reason || null,
      description: null,
      application: null,
    }
  },
  // `req.fn_request_details` for work from home: the days asked, with their shift.
  toDetails: (payload, record) => ({
    days: (payload as unknown as WorkFromHomeStored).dates.map((date) => ({
      requestDate: date,
      scheduleId: entryOn(record.employeeId, date)?.id ?? null,
    })),
  }),
  onCompleted: applyWorkFromHome,
  onCancelled: revertWorkFromHome,
  extraHandlers: [scheduleBoardHandler],
  seed: () => {
    const ago = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()
    /**
     * The first `count` shifts from `offset` days from today, leaving out the
     * Hybrid Work roster's own Monday and Friday at home. Read from the roster
     * pattern, not the flag, so a reseed over a kept schedule picks the same days.
     */
    const shifts = (employeeId: string, offset: number, count: number) => {
      const found: string[] = []
      for (let step = 0; step < 30 && found.length < count; step += 1) {
        const date = iso(addDays(new Date(), offset + step))
        const shift = scheduleDay(employeeId, date)
        const hybridHome =
          shift.rosterGroupId === 'rg_hybrid' && ['mon', 'fri'].includes(weekdayOf(date))
        if (shift.status === 'shift' && !hybridHome) found.push(date)
      }
      return found
    }
    /** Approved seeds show on the schedule; before them the days were at the office. */
    const applied = (record: StoredStandardRequest): Effect => ({
      before: applyWorkFromHome(record).before.map(({ date, entry }) => ({
        date,
        entry: entry ? { ...entry, workFromHome: false } : null,
      })),
    })
    const make = (
      id: string,
      employeeId: string,
      offset: number,
      count: number,
      status: StoredStandardRequest['status'],
      options: { approvedSteps?: number; daysAgo?: number; reason?: string } = {},
    ) => {
      const dates = shifts(employeeId, offset, count)
      const from = dates[0] ?? iso(addDays(new Date(), offset))
      const record = seedRequest(def, {
        id,
        code: `WFH-${id.slice(-4)}`,
        employeeId,
        payload: {
          from,
          to: dates.at(-1) ?? from,
          dates,
          count: dates.length,
          reason: options.reason ?? 'Waiting at home for a repair visit.',
        } satisfies WorkFromHomeStored,
        at: ago(options.daysAgo ?? 3),
        status,
        ...(options.approvedSteps !== undefined ? { approvedSteps: options.approvedSteps } : {}),
        ...(status === 'cancelling' || status === 'cancelled'
          ? { cancelReason: 'The visit was moved; I will come in.' }
          : {}),
      })
      return status === 'completed' || status === 'cancelling'
        ? { ...record, effect: applied(record) }
        : record
    }
    return [
      make('wfh_0001', 'em_sadia', 3, 2, 'pending', { daysAgo: 1 }),
      make('wfh_0002', 'em_haroon', 4, 3, 'pending', {
        daysAgo: 2,
        reason: 'Release week; fewer interruptions at home.',
      }),
      make('wfh_0003', 'em_zainab', 6, 2, 'pending', {
        approvedSteps: 1,
        daysAgo: 2,
        reason: 'Child is unwell.',
      }),
      make('wfh_0004', 'em_omer', 2, 1, 'completed', { daysAgo: 5 }),
      make('wfh_0005', 'em_laiba', 9, 2, 'cancelling', { daysAgo: 6 }),
      make('wfh_0006', 'em_mahnoor', 5, 1, 'rejected', { daysAgo: 4 }),
      make('wfh_0007', 'em_shelley', 7, 2, 'pending', {
        daysAgo: 1,
        reason: 'Payroll close; quiet focus time.',
      }),
      make('wfh_0008', 'em_shelley', 1, 1, 'completed', {
        daysAgo: 6,
        reason: 'Gas line work at home.',
      }),
      make('wfh_0009', 'em_rehan', 8, 2, 'pending', { daysAgo: 1 }),
    ]
  },
}

export const workFromHomeServer = defineStandardKind(def)
