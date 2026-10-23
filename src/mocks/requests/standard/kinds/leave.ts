import { addDays, differenceInCalendarDays, format, parse } from 'date-fns'
import { z } from 'zod'

import { eachDay } from '@/features/scheduling'

import { createMockCollection } from '../../../collection'
import { DIRECTORY } from '../../../employees/seed'
import { leaveTypes } from '../../../leaves/db'
import { entitlementFor } from '../../../leaves/rules'
import { rosterGroups } from '../../../roster/handlers'
import { invalid } from '../../http'
import { mustFind } from '../../people'
import {
  defineStandardKind,
  type PayloadContext,
  seedRequest,
  type StandardKindModule,
  type StandardKindServer,
  type StoredStandardRequest,
} from '../engine'
import { photos, rosterOf, scheduleDay, scheduleHandler } from './work-from-home-days'

/*
 * Leave: the person asks for days off of one leave type ("Leave Request
 * Create": Leave Type, Start Date, End Date, Attachment, Reason; "Short" turns
 * it into part of one day: Short Leave Type, Request Date, Start Time, End
 * Time). Only the days with a shift count. The balance card reads each
 * person's yearly entitlement (seeded below) against their requests: approved
 * days are Availed, pending days Pending, and the rest Available.
 */

/**
 * The leave types are the ones set up under Leaves → Settings → Leave Types
 * (`src/mocks/leaves`), so both modules offer and name the same types; the
 * Create form lists the active ones.
 */
const leaveTypeOf = (id: string) => leaveTypes.find(id)
const activeLeaveTypes = () => leaveTypes.all().filter((type) => type.active)

export const SHORT_LEAVE_TYPES = [
  { value: 'half-day', label: 'Half Day', fraction: 0.5 },
  { value: 'quarter-day', label: 'Quarter Day', fraction: 0.25 },
] as const
type ShortLeaveType = (typeof SHORT_LEAVE_TYPES)[number]['value']

// --- entitlements ---------------------------------------------------------------------------------

interface LeaveEntitlement {
  id: string
  employeeId: string
  leaveTypeId: string
  /** Days a year. */
  days: number
}

/** Shelley Kannes has the frame's 8 casual and 15 sick days; the others vary a little. */
function seedEntitlements(): LeaveEntitlement[] {
  return DIRECTORY.flatMap((employee, index) => {
    const casual = employee.id === 'em_shelley' ? 8 : ([8, 10, 12][index % 3] ?? 8)
    const sick = employee.id === 'em_shelley' ? 15 : ([15, 12, 10][index % 3] ?? 15)
    return [
      {
        id: `le_${employee.id}_casual`,
        employeeId: employee.id,
        leaveTypeId: 'lt_casual',
        days: casual,
      },
      { id: `le_${employee.id}_sick`, employeeId: employee.id, leaveTypeId: 'lt_sick', days: sick },
    ]
  })
}

/** Each person's yearly days per leave type (kept in memory; nothing edits them yet). */
export const leaveEntitlements = createMockCollection<LeaveEntitlement>({ seed: seedEntitlements })

// --- the stored request ---------------------------------------------------------------------------

export interface LeaveStored {
  leaveTypeId: string
  short: boolean
  shortType: ShortLeaveType | null
  /** The first and last day; one day (the Request Date) for a short leave. */
  from: string
  to: string
  /** Short leave only: when it starts and ends (`yyyy-MM-dd`, `HH:mm`). */
  startDate: string | null
  startTime: string | null
  endDate: string | null
  endTime: string | null
  /** The days with a shift: the days counted. */
  dates: string[]
  /** Days taken: the shift days, or the short leave's share of one day. */
  count: number
  rosterGroupId: string | null
  attachment: string | null
  reason: string
}

const ymd = /^\d{4}-\d{2}-\d{2}$/
const hm = /^\d{2}:\d{2}$/
const schema = z.object({
  leaveTypeId: z.string().min(1),
  short: z.boolean(),
  shortType: z.enum(['half-day', 'quarter-day']).nullable(),
  from: z.string().regex(ymd),
  to: z.string().regex(ymd),
  startDate: z.string().regex(ymd).nullable(),
  startTime: z.string().regex(hm).nullable(),
  endDate: z.string().regex(ymd).nullable(),
  endTime: z.string().regex(hm).nullable(),
  attachment: z.string().trim().max(200).nullable(),
  reason: z.string().trim().min(1).max(500),
})
type Input = z.infer<typeof schema>

const stored = (record: StoredStandardRequest) => record.payload as unknown as LeaveStored
const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())
const iso = (date: Date) => format(date, 'yyyy-MM-dd')
const longDay = (date: string) => format(day(date), 'MMMM d, yyyy')
const at = (date: string, time: string) =>
  parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date()).getTime()
/** 8, 14.5, 0.25. */
export const days = (value: number) => String(Math.round(value * 100) / 100)

/** This type's stored requests; set when the handlers are built over the shared table. */
let leaveRecords: () => readonly StoredStandardRequest[] = () => []

export interface LeaveBalance {
  total: number
  availed: number
  pending: number
  available: number
}

/**
 * The person's balance of one leave type this year: approved days (and
 * approved ones being cancelled) are Availed, pending days Pending.
 */
export function balanceOf(
  employeeId: string,
  leaveTypeId: string,
  records: readonly StoredStandardRequest[],
  ignoreId: string | null = null,
): LeaveBalance {
  const year = String(new Date().getFullYear())
  // The Leaves module's rule: an employee-level policy, else the entitlement seeded below, else
  // the company policy, else the type's own number; so both modules show the same balance.
  const employee = DIRECTORY.find((item) => item.id === employeeId)
  const type = leaveTypeOf(leaveTypeId)
  const total = employee && type ? entitlementFor(employee, type) : 0
  let availed = 0
  let pending = 0
  for (const record of records) {
    const payload = stored(record)
    if (record.kind !== 'leave' || record.id === ignoreId || record.employeeId !== employeeId) {
      continue
    }
    if (payload.leaveTypeId !== leaveTypeId || !payload.from.startsWith(year)) continue
    if (record.status === 'completed' || record.status === 'cancelling') availed += payload.count
    if (record.status === 'pending') pending += payload.count
  }
  return { total, availed, pending, available: total - availed - pending }
}

const shortTypeOf = (value: string | null) => SHORT_LEAVE_TYPES.find((item) => item.value === value)

/** The short leave's checks: a shift that day, times inside it, no longer than its share. */
function shortLeave(input: Input, employeeId: string, name: string) {
  const shortType = shortTypeOf(input.shortType)
  if (!shortType) {
    return invalid('Choose the short leave type.', { shortType: 'Choose the short leave type' })
  }
  if (input.to !== input.from) return invalid('A short leave is one day.')
  const shift = scheduleDay(employeeId, input.from)
  if (shift.status !== 'shift' || !shift.clockIn || !shift.clockOut) {
    return invalid(`${name} has no shift on ${longDay(input.from)}.`, {
      requestDate: 'Choose a day with a shift',
    })
  }
  const { startDate, startTime, endDate, endTime } = input
  if (!startDate || !startTime || !endDate || !endTime) {
    return invalid('Give the start and end times.', {
      startTime: 'Choose the start time',
      endTime: 'Choose the end time',
    })
  }
  const shiftStart = at(input.from, shift.clockIn)
  const overnight = shift.clockOut < shift.clockIn
  const shiftEnd = at(overnight ? iso(addDays(day(input.from), 1)) : input.from, shift.clockOut)
  const start = at(startDate, startTime)
  const end = at(endDate, endTime)
  if (end <= start) {
    return invalid('End Time comes before Start Time.', {
      endTime: 'Choose a time after the start time',
    })
  }
  if (start < shiftStart || end > shiftEnd) {
    return invalid(`Keep the times inside the shift (${shift.label}).`, {
      startTime: `Keep inside ${shift.label}`,
    })
  }
  const share = Math.round(((shiftEnd - shiftStart) * shortType.fraction) / 60_000)
  if ((end - start) / 60_000 > share) {
    const length = `${String(Math.floor(share / 60))}h ${String(share % 60).padStart(2, '0')}m`
    return invalid(`A ${shortType.label} of this shift is ${length} at most.`, {
      endTime: `${shortType.label}: ${length} at most`,
    })
  }
  return { dates: [input.from], count: shortType.fraction, shift }
}

function toPayload(input: Input, context: PayloadContext): Response | Record<string, unknown> {
  const employee = mustFind(context.employeeId)
  const type = leaveTypeOf(input.leaveTypeId)
  if (!type) return invalid('Choose the leave type.', { leaveTypeId: 'Choose the leave type' })
  if (input.to < input.from) {
    return invalid('End Date comes before Start Date.', { to: 'Choose the Start Date or later' })
  }
  if (input.from.slice(0, 4) !== input.to.slice(0, 4)) {
    return invalid('Ask for the days of one leave year at a time.', {
      to: 'Choose a day this year',
    })
  }
  if (differenceInCalendarDays(day(input.to), day(input.from)) > 60) {
    return invalid('Ask for 61 days at most at a time.', { to: 'Ask for 61 days at most' })
  }

  let dates: string[]
  let count: number
  if (input.short) {
    const result = shortLeave(input, employee.id, employee.name)
    if (result instanceof Response) return result
    ;({ dates, count } = result)
  } else {
    dates = eachDay(input.from, input.to).filter(
      (date) => scheduleDay(employee.id, date).status === 'shift',
    )
    if (dates.length === 0) {
      return invalid(`${employee.name} has no shift between these dates.`, {
        from: 'Choose dates with working days',
      })
    }
    count = dates.length
  }

  const clash = context.records.find(
    (record) =>
      record.id !== context.ignoreId &&
      record.employeeId === employee.id &&
      ['pending', 'completed', 'cancelling'].includes(record.status) &&
      stored(record).dates.some((date) => dates.includes(date)),
  )
  if (clash) {
    const taken = stored(clash).dates.find((date) => dates.includes(date)) ?? input.from
    return invalid(`${clash.code} already asks for leave on ${longDay(taken)}.`, {
      [input.short ? 'requestDate' : 'from']: 'These days are already asked for',
    })
  }

  const balance = balanceOf(employee.id, type.id, context.records, context.ignoreId)
  // A non-deductible type (Leave Without Pay) has no balance to run out of, as in Leaves.
  if (type.deductible && count > balance.available) {
    return invalid(
      `${employee.name} has ${days(balance.available)} ${type.title} available; this asks for ${days(count)}.`,
      { [input.short ? 'shortType' : 'to']: `Only ${days(balance.available)} available` },
    )
  }

  const firstShift = scheduleDay(employee.id, dates[0] ?? input.from)
  return {
    leaveTypeId: type.id,
    short: input.short,
    shortType: input.short ? input.shortType : null,
    from: input.from,
    to: input.to,
    startDate: input.short ? input.startDate : null,
    startTime: input.short ? input.startTime : null,
    endDate: input.short ? input.endDate : null,
    endTime: input.short ? input.endTime : null,
    dates,
    count,
    rosterGroupId: firstShift.rosterGroupId ?? rosterOf(employee.id),
    attachment: input.attachment === '' ? null : input.attachment,
    reason: input.reason,
  } satisfies LeaveStored
}

const def: StandardKindServer<Input> = {
  kind: 'leave',
  settingsType: 'leave',
  codePrefix: 'LV-',
  codeDigits: 4,
  schema,
  toPayload,
  dateOf: (payload) => String(payload.from),
  present: (payload, record) => {
    const value = payload as unknown as LeaveStored
    const roster = value.rosterGroupId ? rosterGroups.find(value.rosterGroupId) : undefined
    return {
      ...value,
      leaveTypeName: leaveTypeOf(value.leaveTypeId)?.title ?? '—',
      shortTypeLabel: shortTypeOf(value.shortType)?.label ?? null,
      rosterTitle: roster?.title ?? '—',
      balance: balanceOf(record.employeeId, value.leaveTypeId, leaveRecords()),
    }
  },
  filters: {
    leaveTypeId: (record, value) => stored(record).leaveTypeId === value,
  },
  lookups: () => {
    const records = leaveRecords()
    return {
      leaveTypes: activeLeaveTypes().map((item) => ({ id: item.id, name: item.title })),
      shortTypes: SHORT_LEAVE_TYPES.map((item) => ({ ...item })),
      photos: photos(),
      /** Every person's balance of each type, for the card and the forms. */
      balances: Object.fromEntries(
        DIRECTORY.map((employee) => [
          employee.id,
          Object.fromEntries(
            activeLeaveTypes().map((type) => [type.id, balanceOf(employee.id, type.id, records)]),
          ),
        ]),
      ),
    }
  },
  extraHandlers: [scheduleHandler('leave')],
  seed: () => {
    const ago = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()
    /** The first `count` shift days from `offset` days from today. */
    const workdays = (employeeId: string, offset: number, count: number) => {
      const found: string[] = []
      for (let step = 0; step < 40 && found.length < count; step += 1) {
        const date = iso(addDays(new Date(), offset + step))
        if (scheduleDay(employeeId, date).status === 'shift') found.push(date)
      }
      return found
    }
    const spanOf = (employeeId: string, dates: string[]) => {
      const first = dates[0] ?? iso(new Date())
      return {
        first,
        last: dates.at(-1) ?? first,
        rosterGroupId: scheduleDay(employeeId, first).rosterGroupId ?? rosterOf(employeeId),
      }
    }
    interface Options {
      approvedSteps?: number
      daysAgo?: number
      reason?: string
    }
    const make = (
      id: string,
      employeeId: string,
      payload: LeaveStored,
      status: StoredStandardRequest['status'],
      options: Options,
    ) =>
      seedRequest(def, {
        id,
        code: `LV-${id.slice(-4)}`,
        employeeId,
        payload: { ...payload },
        at: ago(options.daysAgo ?? 3),
        status,
        ...(options.approvedSteps !== undefined ? { approvedSteps: options.approvedSteps } : {}),
        ...(status === 'cancelling' || status === 'cancelled'
          ? { cancelReason: 'Plans changed; I will be at work.' }
          : {}),
      })
    const full = (
      id: string,
      employeeId: string,
      leaveTypeId: string,
      offset: number,
      count: number,
      status: StoredStandardRequest['status'],
      options: Options = {},
    ) => {
      const dates = workdays(employeeId, offset, count)
      const { first, last, rosterGroupId } = spanOf(employeeId, dates)
      return make(
        id,
        employeeId,
        {
          leaveTypeId,
          short: false,
          shortType: null,
          from: first,
          to: last,
          startDate: null,
          startTime: null,
          endDate: null,
          endTime: null,
          dates: eachDay(first, last).filter((date) => dates.includes(date)),
          count: dates.length,
          rosterGroupId,
          attachment: null,
          reason: options.reason ?? 'Family matter at home.',
        },
        status,
        options,
      )
    }
    const halfDay = (
      id: string,
      employeeId: string,
      leaveTypeId: string,
      offset: number,
      status: StoredStandardRequest['status'],
      options: Options = {},
    ) => {
      const dates = workdays(employeeId, offset, 1)
      const { first, rosterGroupId } = spanOf(employeeId, dates)
      const shift = scheduleDay(employeeId, first)
      const clockIn = shift.clockIn ?? '09:00'
      const clockOut = shift.clockOut ?? '17:00'
      const [inH = 9, inM = 0] = clockIn.split(':').map(Number)
      const [outH = 17, outM = 0] = clockOut.split(':').map(Number)
      const length = (outH * 60 + outM - (inH * 60 + inM) + 1440) % 1440
      const endAt = new Date(at(first, clockIn) + (length / 2) * 60_000)
      return make(
        id,
        employeeId,
        {
          leaveTypeId,
          short: true,
          shortType: 'half-day',
          from: first,
          to: first,
          startDate: first,
          startTime: clockIn,
          endDate: iso(endAt),
          endTime: format(endAt, 'HH:mm'),
          dates: [first],
          count: 0.5,
          rosterGroupId,
          attachment: null,
          reason: options.reason ?? 'Doctor’s appointment.',
        },
        status,
        options,
      )
    }
    return [
      full('lv_0001', 'em_sadia', 'lt_casual', 5, 2, 'pending', { daysAgo: 1 }),
      full('lv_0002', 'em_haroon', 'lt_sick', 8, 1, 'pending', {
        daysAgo: 2,
        reason: 'Fever since last night.',
      }),
      full('lv_0003', 'em_zainab', 'lt_casual', 10, 3, 'pending', {
        approvedSteps: 1,
        daysAgo: 2,
        reason: 'Sister’s wedding.',
      }),
      full('lv_0004', 'em_omer', 'lt_casual', -6, 1, 'completed', { daysAgo: 9 }),
      full('lv_0005', 'em_laiba', 'lt_sick', 12, 2, 'cancelling', {
        daysAgo: 6,
        reason: 'Minor surgery.',
      }),
      full('lv_0006', 'em_mahnoor', 'lt_casual', 3, 1, 'rejected', { daysAgo: 4 }),
      halfDay('lv_0007', 'em_shelley', 'lt_sick', 2, 'pending', { daysAgo: 1 }),
      full('lv_0008', 'em_shelley', 'lt_casual', -10, 1, 'completed', {
        daysAgo: 14,
        reason: 'Bank and passport office.',
      }),
      full('lv_0009', 'em_shelley', 'lt_sick', 20, 2, 'cancelled', { daysAgo: 6 }),
      full('lv_0010', 'em_rehan', 'lt_casual', 6, 1, 'pending', {
        daysAgo: 1,
        reason: 'Moving to a new flat.',
      }),
    ]
  },
}

const leaveModule = defineStandardKind(def)

/** The Leave server; it keeps a reader of its requests for the balances. */
export const leaveServer: StandardKindModule = {
  ...leaveModule,
  handlers: (collection) => {
    leaveRecords = () => collection.all().filter((record) => record.kind === 'leave')
    return leaveModule.handlers(collection)
  },
}
