import { addDays, differenceInCalendarDays, format, parse } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import { eachDay } from '@/features/scheduling'

import { holidayFor } from '../../../attendance/audience'
import { holidays } from '../../../attendance/settings-db'
import { findEmployee } from '../../../employees/seed'
import { leaveTypes } from '../../../leaves/db'
import { bindLeaveRequestSource } from '../../../leaves/requests'
import { balanceOf, coveredTypes, policyFor } from '../../../leaves/rules'
import { apiPath, errorResponse, latency, requireAuth } from '../../../utils'
import type { RequestBodyIn } from '../../backend'
import { invalid } from '../../http'
import { ME, mustFind } from '../../people'
import {
  defineStandardKind,
  type PayloadContext,
  seedRequest,
  type StandardKindModule,
  type StandardKindServer,
  type StoredStandardRequest,
} from '../engine'
import { rosterOf, scheduleDay } from './work-from-home-days'

/*
 * Leave: the person asks for days off of one leave type ("Leave Request
 * Create": Leave Type, Start Date, End Date, Attachment, Reason; "Short" turns
 * it into part of one day: Short Leave Type, Request Date, Start Time, End
 * Time). Only the working days count: days with a shift that are not the
 * person's holiday (Attendance → Settings → Holidays).
 *
 * These are the only leave requests in the mock, as on the backend: Leaves →
 * My Leaves / Leave Applications read them too (`src/mocks/leaves/requests.ts`),
 * and every balance (`/leaves/balances`, `/leaves/ledger`, the options below) is
 * the Leaves ledger's allotment less these requests (`src/mocks/leaves/rules.ts`):
 * approved days are Availed, pending days Pending, and the rest Available.
 */

/**
 * The leave types are the ones set up under Leaves → Settings → Leave Types
 * (`src/mocks/leaves`), so both modules offer and name the same types; the
 * Create form lists the ones the person's leave policy gives.
 */
const leaveTypeOf = (id: string) => leaveTypes.find(id)

export const SHORT_LEAVE_TYPES = [
  { value: 'half-day', label: 'Half Day', fraction: 0.5 },
  { value: 'quarter-day', label: 'Quarter Day', fraction: 0.25 },
] as const
type ShortLeaveType = (typeof SHORT_LEAVE_TYPES)[number]['value']

/** The person's holiday that day (Attendance → Settings → Holidays), if any. */
const holidayOn = (employeeId: string, date: string) => holidayFor(holidays.all(), employeeId, date)

/** A day the leave counts: a shift day that is not a holiday. */
const isWorkingDay = (employeeId: string, date: string) =>
  scheduleDay(employeeId, date).status === 'shift' && !holidayOn(employeeId, date)

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

const shortTypeOf = (value: string | null) => SHORT_LEAVE_TYPES.find((item) => item.value === value)

/** The API's short leave values (`half_day`) ↔ the stored ones (`half-day`). */
const toApiShort = (value: string | null) => (value ? value.replace('-', '_') : null)
const fromApiShort = (value: unknown) =>
  typeof value === 'string' ? value.replace('_', '-') : null
const hhmm = (value: unknown) => (typeof value === 'string' ? value.slice(0, 5) : null)

/** A `RequestIn` body → the stored shape's input (times on the request's day). */
function fromBody(body: RequestBodyIn): unknown {
  const details = body.details
  const short = details.isShort === true
  const from = body.fromDate ?? ''
  return {
    leaveTypeId: details.leaveTypeId,
    short,
    shortType: short ? fromApiShort(details.shortLeaveType) : null,
    from,
    to: short ? from : (body.toDate ?? ''),
    startDate: short ? from : null,
    startTime: short ? hhmm(details.startTime) : null,
    endDate: short ? from : null,
    endTime: short ? hhmm(details.endTime) : null,
    attachment: body.attachments.length > 0 ? 'Attachment' : null,
    reason: body.reason ?? '',
  }
}

/**
 * `GET /requests/options/leave-types?employeeId=&asOf=` (`LeaveTypeOptionOut`): the types the
 * person's leave policy gives (default the signed-in person), with the balance of the leave
 * year holding `asOf` (default today) and the form rules; half / short leave follow the
 * person's "Half & Short" policy as the API does.
 */
export const leaveTypeOptionsHandler = http.get(
  apiPath('/requests/options/leave-types'),
  async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const employeeId = url.searchParams.get('employeeId') ?? ME
    if (!findEmployee(employeeId)) {
      return errorResponse(404, 'Employee not found.', { code: 'NOT_FOUND' })
    }
    const asOf = url.searchParams.get('asOf')
    const year = /^\d{4}/.test(asOf ?? '') ? Number(asOf?.slice(0, 4)) : new Date().getFullYear()
    const policy = policyFor(employeeId, 'half_short')
    const rows = coveredTypes(employeeId).map(({ type }) => {
      const balance = balanceOf(employeeId, type.id, year)
      return {
        id: type.id,
        name: type.title,
        code: type.shortCode,
        isDeductible: type.isDeductible,
        isShortLeave: type.isShortLeave,
        allowHalfDay: type.isShortLeave && (policy?.allowHalfDay ?? true),
        allowShortLeave: type.isShortLeave && (policy?.allowShortLeave ?? true),
        attachmentRequired: type.attachmentRequired,
        attachmentRule: type.attachmentRule ?? 'refuse',
        allowBackDate: type.allowBackDate,
        backDateLimitDays: type.backDateLimitDays,
        futureLimitDays: type.hasFutureLimit ? type.futureLimitDays : null,
        ...balance,
      }
    })
    return HttpResponse.json({ data: rows })
  },
)

/** The short leave's checks: a shift that day, times inside it, no longer than its share. */
function shortLeave(input: Input, employeeId: string, name: string) {
  const shortType = shortTypeOf(input.shortType)
  if (!shortType) {
    return invalid('Choose the short leave type.', {
      shortLeaveType: 'Choose the short leave type',
    })
  }
  if (input.to !== input.from) return invalid('A short leave is one day.')
  const holiday = holidayOn(employeeId, input.from)
  if (holiday) {
    return invalid(`${longDay(input.from)} is a holiday (${holiday.name}).`, {
      fromDate: `${holiday.name} is a holiday`,
    })
  }
  const shift = scheduleDay(employeeId, input.from)
  if (shift.status !== 'shift' || !shift.clockIn || !shift.clockOut) {
    return invalid(`${name} has no shift on ${longDay(input.from)}.`, {
      fromDate: 'Choose a day with a shift',
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
  if (!coveredTypes(employee.id).some((item) => item.type.id === type.id)) {
    return invalid(`No leave policy gives ${employee.name} ${type.title}.`, {
      leaveTypeId: 'Not in this person’s leave policy',
    })
  }
  if (input.short) {
    // The person's "Half & Short" policy (Leaves → Settings → Leave Policies).
    const policy = policyFor(employee.id, 'half_short')
    const half = input.shortType === 'half-day'
    if (!type.isShortLeave || (policy && !(half ? policy.allowHalfDay : policy.allowShortLeave))) {
      const what = half ? 'Half-day' : 'Short'
      return invalid(`${what} leave is not allowed for ${employee.name}.`, {
        shortLeaveType: `${what} leave is not allowed`,
      })
    }
  }
  if (type.attachmentRequired && type.attachmentRule !== 'note' && !input.attachment) {
    return invalid(`${type.title} needs an attachment.`, {
      attachment: 'Attach the supporting document',
    })
  }
  if (input.to < input.from) {
    return invalid('End Date comes before Start Date.', {
      toDate: 'Choose the Start Date or later',
    })
  }
  if (input.from.slice(0, 4) !== input.to.slice(0, 4)) {
    return invalid('Ask for the days of one leave year at a time.', {
      to: 'Choose a day this year',
    })
  }
  if (differenceInCalendarDays(day(input.to), day(input.from)) > 60) {
    return invalid('Ask for 61 days at most at a time.', { toDate: 'Ask for 61 days at most' })
  }

  let dates: string[]
  let count: number
  if (input.short) {
    const result = shortLeave(input, employee.id, employee.name)
    if (result instanceof Response) return result
    ;({ dates, count } = result)
  } else {
    // Holidays and days off are not counted; a leave of only those days asks for nothing.
    dates = eachDay(input.from, input.to).filter((date) => isWorkingDay(employee.id, date))
    if (dates.length === 0) {
      const holiday = input.from === input.to ? holidayOn(employee.id, input.from) : null
      return invalid(
        holiday
          ? `${longDay(input.from)} is a holiday (${holiday.name}).`
          : `${employee.name} has no working day between these dates.`,
        { fromDate: holiday ? `${holiday.name} is a holiday` : 'Choose dates with working days' },
      )
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
      fromDate: 'These days are already asked for',
    })
  }

  // The Leaves module's balance: the ledger's allotment less every leave request.
  const balance = balanceOf(employee.id, type.id, Number(input.from.slice(0, 4)), context.ignoreId)
  // A non-deductible type (Leave Without Pay) has no balance to run out of, as in Leaves.
  if (type.deductible && count > balance.available) {
    return invalid(
      `${employee.name} has ${days(balance.available)} ${type.title} available; this asks for ${days(count)}.`,
      { [input.short ? 'shortLeaveType' : 'toDate']: `Only ${days(balance.available)} available` },
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
  typeCode: 'leave',
  typeName: 'Leave',
  settingsType: 'leave',
  codePrefix: 'LV-',
  codeDigits: 4,
  fromBody,
  schema,
  toPayload,
  dateOf: (payload) => String(payload.from),
  header: (payload) => {
    const value = payload as unknown as LeaveStored
    return {
      fromDate: value.from,
      toDate: value.to,
      days: value.count,
      reason: value.reason || null,
      description: null,
      application: null,
    }
  },
  // `req.fn_request_details` for leave: the type, short leave and the counted days.
  toDetails: (payload) => {
    const value = payload as unknown as LeaveStored
    return {
      leaveTypeId: value.leaveTypeId,
      leaveTypeName: leaveTypeOf(value.leaveTypeId)?.title ?? null,
      isShort: value.short,
      shortLeaveType: toApiShort(value.shortType),
      startTime: value.startTime ? `${value.startTime}:00` : null,
      endTime: value.endTime ? `${value.endTime}:00` : null,
      days: value.count,
    }
  },
  extraHandlers: [leaveTypeOptionsHandler],
  seed: () => {
    const ago = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()
    /** The first `count` working days (shift days, not holidays) from `offset` days from today. */
    const workdays = (employeeId: string, offset: number, count: number) => {
      const found: string[] = []
      for (let step = 0; step < 40 && found.length < count; step += 1) {
        const date = iso(addDays(new Date(), offset + step))
        if (isWorkingDay(employeeId, date)) found.push(date)
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

/**
 * The Leave server. It hands the Leaves mock a reader of its requests, so My Leaves, Leave
 * Applications and every balance read the same requests.
 */
export const leaveServer: StandardKindModule = {
  ...leaveModule,
  handlers: (collection) => {
    bindLeaveRequestSource(() => collection.all().filter((record) => record.kind === 'leave'))
    return leaveModule.handlers(collection)
  },
}
