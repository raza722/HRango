import { differenceInCalendarDays, differenceInCalendarMonths, format, parse } from 'date-fns'
import { http, type HttpHandler, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  type FinalApprovalBy,
  LEAVE_CATEGORIES,
  type LeaveApplication,
  type LeaveApplicationAction,
  type LeaveApplicationDetail,
  type LeaveApplicationPage,
  type LeavesLookups,
} from '@/features/leaves'
import { eachDay } from '@/features/scheduling'
import type { ApiItem } from '@/types/api'

import { DIRECTORY, findEmployee } from '../employees/seed'
import {
  applyCancelDecision,
  applyDecision,
  currentStep,
  historyEntry,
  type StoredStep,
} from '../requests/flow'
import {
  countsOf,
  forbidden,
  invalid,
  notFound,
  now,
  readBody,
  text,
  toStep,
} from '../requests/http'
import { ME, mustFind, ref, requestEmployee } from '../requests/people'
import { restrictionFor } from '../requests/settings-db'
import { standardRequests } from '../requests/standard'
import {
  newStandardRecord,
  requestStandardCancel,
  type StoredStandardRequest,
} from '../requests/standard/engine'
import { type LeaveStored, SHORT_LEAVE_TYPES } from '../requests/standard/kinds/leave'
import { rosterOf, scheduleDay } from '../requests/standard/kinds/work-from-home-days'
import { rosterGroups } from '../roster/handlers'
import { profileOf } from '../scheduling/seed'
import { apiPath, createId, latency, paginate, readPageParams, requireAuth } from '../utils'
import { currentLeaveSettings, leaveTypes, publicLeaveSettings } from './db'
import {
  allBalances,
  coverageFor,
  isLeave,
  leaveBalanceFor,
  leaveStored,
  monthsOfService,
  notOfferedBecause,
  offeredTypes,
} from './rules'

/*
 * My Leaves and Leave Applications read and write the leave requests of
 * Requests → Leave (the shared standard requests table, kind "leave"), so a
 * leave asked for here shows there and the other way round. Applying checks
 * the Leaves module's own rules (the type's switches, pre-conditions and
 * balance, the general settings) before a request is stored through the
 * requests engine's flow.
 */

export const LEAVE_DEF = { kind: 'leave', settingsType: 'leave' } as const

const path = (suffix = '') => apiPath(`/leaves${suffix}`)
const leaveRecords = () => standardRequests.all().filter(isLeave)
const today = () => format(new Date(), 'yyyy-MM-dd')
const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())
const longDay = (date: string) => format(day(date), 'MMMM d, yyyy')
/** 8, 14.5, 0.25. */
const days = (value: number) => String(Math.round(value * 100) / 100)

/** The authority recorded on the final approval, per Leave Final Approval By. */
export const FINAL_AUTHORITY_LABELS: Record<FinalApprovalBy, string> = {
  'hr-manager': 'HR Manager',
  'line-manager': 'Line Manager',
  'department-head': 'Head of Department',
}

/** Leave Applications may be asked for up to this many days ahead when the type has a future date limit. */
export const FUTURE_LIMIT_DAYS = 60

type StoredLeaveApplication = LeaveStored & { attachmentMissing?: boolean; category?: string }

function actionsFor(record: StoredStandardRequest): LeaveApplicationAction[] {
  const actions: LeaveApplicationAction[] = ['view']
  const mine = record.employeeId === ME
  if (mine && (record.status === 'pending' || record.status === 'completed')) actions.push('cancel')
  if (!mine && (record.status === 'pending' || record.status === 'cancelling')) {
    actions.push('decide')
  }
  return actions
}

function serialize(
  record: StoredStandardRequest,
  records: readonly StoredStandardRequest[],
): LeaveApplication {
  const payload = leaveStored(record) as StoredLeaveApplication
  const employee = mustFind(record.employeeId)
  const person = requestEmployee(employee)
  const type = leaveTypes.find(payload.leaveTypeId)
  const step = currentStep(record)
  const roster = payload.rosterGroupId ? rosterGroups.find(payload.rosterGroupId) : undefined
  const cancelStep: StoredStep | null = record.cancelStep
  return {
    id: record.id,
    code: record.code,
    status: record.status,
    employee: {
      id: person.id,
      name: person.name,
      code: person.code,
      department: person.department,
      designation: person.designation,
      photoUrl: person.photoUrl,
    },
    category: payload.short || payload.dates.length <= 1 ? 'single' : 'multiple',
    leaveTypeId: payload.leaveTypeId,
    leaveTypeTitle: type?.title ?? '—',
    leaveTypeCode: type?.shortCode ?? '—',
    from: payload.from,
    to: payload.to,
    dates: payload.dates,
    count: payload.count,
    short: payload.short,
    shortTypeLabel:
      SHORT_LEAVE_TYPES.find((item) => item.value === payload.shortType)?.label ?? null,
    rosterTitle: roster?.title ?? '—',
    reason: payload.reason,
    attachment: payload.attachment,
    attachmentMissing: payload.attachmentMissing === true,
    appliedAt: record.createdAt,
    nextAuthority: step?.authority ?? null,
    nextApprover: step ? ref(step.approverId) : null,
    flow: [
      ...record.flow.map(toStep),
      ...(cancelStep
        ? [{ ...toStep(cancelStep), authority: `${cancelStep.authority} (Cancellation)` }]
        : []),
    ],
    cancelReason: record.cancelReason,
    actions: actionsFor(record),
    balance: type
      ? leaveBalanceFor(employee, type, records)
      : { total: 0, availed: 0, pending: 0, available: 0 },
  }
}

const item = (record: StoredStandardRequest) =>
  HttpResponse.json<ApiItem<LeaveApplication>>({ data: serialize(record, leaveRecords()) })

/** The Filters dialog's fields, as query parameters. */
const FILTERS: Record<string, (record: StoredStandardRequest, value: string) => boolean> = {
  leaveTypeId: (record, value) => leaveStored(record).leaveTypeId === value,
  category: (record, value) => {
    const payload = leaveStored(record)
    const single = payload.short || payload.dates.length <= 1
    return value === 'single' ? single : !single
  },
  employeeId: (record, value) => record.employeeId === value,
  department: (record, value) => mustFind(record.employeeId).department === value,
  from: (record, value) => leaveStored(record).from >= value,
  to: (record, value) => leaveStored(record).from <= value,
}

function matches(record: StoredStandardRequest, url: URL): boolean {
  for (const [name, value] of url.searchParams) {
    const test = FILTERS[name]
    if (value && test && !test(record, value)) return false
  }
  return true
}

function nextCode(): string {
  const highest = leaveRecords().reduce((max, record) => {
    const number = Number(record.code.slice(3))
    return Number.isFinite(number) ? Math.max(max, number) : max
  }, 0)
  return `LV-${String(highest + 1).padStart(4, '0')}`
}

const ymd = /^\d{4}-\d{2}-\d{2}$/
const applySchema = z.object({
  category: z.enum(LEAVE_CATEGORIES),
  leaveTypeId: z.string().min(1),
  from: z.string().regex(ymd),
  to: z.string().regex(ymd),
  reason: z.string().trim().min(1).max(500),
  attachment: z.string().trim().max(200).nullable(),
})

const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  remarks: text,
})

const cancelSchema = z.object({ reason: z.string().trim().min(1).max(500) })

/** Checks an application against the type's rules and returns what to store. */
function buildPayload(
  input: z.infer<typeof applySchema>,
  records: readonly StoredStandardRequest[],
): Response | StoredLeaveApplication {
  const employee = mustFind(ME)
  const settings = currentLeaveSettings()
  if (!coverageFor(employee).distribution) {
    return invalid(
      'No leave distribution policy covers you yet; ask HR to enroll you in one (Settings → Leave Policies).',
      { leaveTypeId: 'No leave policy covers you' },
    )
  }
  const type = leaveTypes.find(input.leaveTypeId)
  if (!type) return invalid('Choose the leave type.', { leaveTypeId: 'Choose the leave type' })
  const refused = notOfferedBecause(employee, type)
  if (refused) return invalid(`${type.title}: ${refused}`, { leaveTypeId: refused })

  const from = input.from
  const to = input.category === 'single' ? input.from : input.to
  if (to < from) {
    return invalid('End Date comes before Start Date.', { to: 'Choose the Start Date or later' })
  }
  if (from.slice(0, 4) !== to.slice(0, 4)) {
    return invalid('Ask for the days of one leave year at a time.', {
      to: 'Choose a day this year',
    })
  }
  if (differenceInCalendarDays(day(to), day(from)) > 60) {
    return invalid('Ask for 61 days at most at a time.', { to: 'Ask for 61 days at most' })
  }

  const current = today()
  if (from < current) {
    if (!type.backDate) {
      return invalid(`${type.title} cannot be asked for past days.`, {
        from: 'Choose today or a later day',
      })
    }
    const limit = type.backDateLimitDays
    if (settings.postDeadline && limit !== null) {
      const late = differenceInCalendarDays(day(current), day(from))
      if (late > limit) {
        return invalid(
          `Post Leave Application Deadline: a back-dated ${type.title} must be posted within ${String(limit)} day${limit === 1 ? '' : 's'} of the leave date.`,
          {
            from: `Post it within ${String(limit)} day${limit === 1 ? '' : 's'} of the leave date`,
          },
        )
      }
    }
  }
  if (
    type.futureDateLimit &&
    differenceInCalendarDays(day(from), day(current)) > FUTURE_LIMIT_DAYS
  ) {
    return invalid(
      `${type.title} may be asked for up to ${String(FUTURE_LIMIT_DAYS)} days ahead.`,
      {
        from: `Choose a day within ${String(FUTURE_LIMIT_DAYS)} days`,
      },
    )
  }

  let attachmentMissing = false
  const attachment = input.attachment === '' ? null : input.attachment
  if (type.attachmentRequired && !attachment) {
    if (type.attachmentRule !== 'note') {
      return invalid(`${type.title} needs a supporting document.`, {
        attachment: 'Attach the supporting document',
      })
    }
    attachmentMissing = true
  }

  const months = monthsOfService(employee)
  if (months < type.minExperienceMonths) {
    return invalid(
      `${type.title} needs ${String(type.minExperienceMonths)} months of service; ${employee.name} has ${String(months)}.`,
      { leaveTypeId: `Needs ${String(type.minExperienceMonths)} months of service` },
    )
  }
  const own = records
    .filter(
      (record) =>
        record.employeeId === ME &&
        leaveStored(record).leaveTypeId === type.id &&
        ['pending', 'completed', 'cancelling'].includes(record.status),
    )
    .sort((a, b) => leaveStored(b).from.localeCompare(leaveStored(a).from))
  if (type.maxApplications !== null && own.length >= type.maxApplications) {
    return invalid(
      `${type.title} may be asked for ${String(type.maxApplications)} time${type.maxApplications === 1 ? '' : 's'} in employment; ${employee.name} has used them.`,
      { leaveTypeId: 'Maximum applications reached' },
    )
  }
  const latest = own[0]
  if (
    type.gapMonths !== null &&
    latest &&
    Math.abs(differenceInCalendarMonths(day(from), day(leaveStored(latest).from))) < type.gapMonths
  ) {
    return invalid(
      `Keep ${String(type.gapMonths)} month${type.gapMonths === 1 ? '' : 's'} between ${type.title} applications; the last one (${latest.code}) was on ${longDay(leaveStored(latest).from)}.`,
      {
        from: `Keep ${String(type.gapMonths)} month${type.gapMonths === 1 ? '' : 's'} between applications`,
      },
    )
  }

  const shiftDays = eachDay(from, to).filter(
    (date) => scheduleDay(employee.id, date).status === 'shift',
  )
  const first = shiftDays[0]
  const last = shiftDays.at(-1)
  if (!first || !last) {
    return invalid(`${employee.name} has no shift between these dates.`, {
      from: 'Choose dates with working days',
    })
  }
  // Sandwich: the rest days between the leave days are counted as well.
  const dates = type.sandwich ? eachDay(first, last) : shiftDays

  const clash = records.find(
    (record) =>
      record.employeeId === ME &&
      ['pending', 'completed', 'cancelling'].includes(record.status) &&
      leaveStored(record).dates.some((date) => dates.includes(date)),
  )
  if (clash) {
    const taken = leaveStored(clash).dates.find((date) => dates.includes(date)) ?? from
    return invalid(`${clash.code} already asks for leave on ${longDay(taken)}.`, {
      from: 'These days are already asked for',
    })
  }

  if (type.deductible) {
    const balance = leaveBalanceFor(employee, type, records)
    if (dates.length > balance.available) {
      return invalid(
        `${employee.name} has ${days(balance.available)} ${type.title} available; this asks for ${days(dates.length)}.`,
        {
          [input.category === 'single' ? 'from' : 'to']:
            `Only ${days(balance.available)} available`,
        },
      )
    }
  }

  const closed = restrictionFor('leave', from, ME)
  if (closed) return invalid(closed)

  return {
    leaveTypeId: type.id,
    short: false,
    shortType: null,
    from,
    to,
    startDate: null,
    startTime: null,
    endDate: null,
    endTime: null,
    dates,
    count: dates.length,
    rosterGroupId: scheduleDay(employee.id, first).rosterGroupId ?? rosterOf(employee.id),
    attachment,
    reason: input.reason,
    attachmentMissing,
    category: input.category,
  }
}

/** Approves every step still waiting: the HR manager's approval here is the final one. */
function approveAll(record: StoredStandardRequest, remarks: string | null, at: string) {
  const label = FINAL_AUTHORITY_LABELS[currentLeaveSettings().finalApprovalBy]
  const lastIndex = record.flow.length - 1
  let current: StoredStandardRequest = {
    ...record,
    flow: record.flow.map((step, index) =>
      index === lastIndex ? { ...step, authority: label } : step,
    ),
  }
  while (current.status === 'pending' && currentStep(current)) {
    current = applyDecision(current, 'approve', ME, remarks, at).record
  }
  return current
}

const guard = async (request: Request) => {
  await latency()
  return requireAuth(request)
}

export const leaveApplicationHandlers: HttpHandler[] = [
  http.get(path('/lookups'), async ({ request }) => {
    const unauthorized = await guard(request)
    if (unauthorized) return unauthorized
    const records = leaveRecords()
    const people = DIRECTORY.map((employee) => ({
      ...ref(employee.id),
      department: employee.department,
      designation: employee.jobTitle,
      active: profileOf(employee).status === 'active',
    })).sort((a, b) => a.name.localeCompare(b.name))
    const me = people.find((person) => person.id === ME)
    if (!me) return notFound()
    return HttpResponse.json<ApiItem<LeavesLookups>>({
      data: {
        me,
        employees: people,
        departments: [...new Set(DIRECTORY.map((employee) => employee.department))].sort(),
        leaveTypes: leaveTypes
          .all()
          .map((type) => ({
            id: type.id,
            title: type.title,
            shortCode: type.shortCode,
            active: type.active,
          }))
          .sort((a, b) => a.title.localeCompare(b.title)),
        offered: offeredTypes(mustFind(ME), records),
        balances: allBalances(records),
        coverage: coverageFor(mustFind(ME)),
        settings: publicLeaveSettings(),
        rosters: rosterGroups
          .all()
          .map((group) => ({ id: group.id, title: group.title }))
          .sort((a, b) => a.title.localeCompare(b.title)),
      },
    })
  }),

  http.get(path('/applications'), async ({ request }) => {
    const unauthorized = await guard(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const scope = url.searchParams.get('scope') ?? 'my'
    const status = url.searchParams.get('status')
    const { page, pageSize } = readPageParams(url)
    const records = leaveRecords()
    const scoped = (
      scope === 'all' ? records : records.filter((record) => record.employeeId === ME)
    )
      .filter((record) => matches(record, url))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const filtered = status ? scoped.filter((record) => record.status === status) : scoped
    const result = paginate(filtered, page, pageSize)
    return HttpResponse.json<LeaveApplicationPage>({
      ...result,
      data: result.data.map((record) => serialize(record, records)),
      counts: countsOf(scoped),
    })
  }),

  http.get(path('/applications/:id'), async ({ request, params }) => {
    const unauthorized = await guard(request)
    if (unauthorized) return unauthorized
    const record = typeof params.id === 'string' ? standardRequests.find(params.id) : undefined
    if (!record || !isLeave(record)) return notFound()
    const history = [...record.history]
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((entry) => ({
        id: entry.id,
        by: ref(entry.byId),
        delegate: entry.delegate,
        status: entry.status,
        remarks: entry.remarks,
        at: entry.at,
      }))
    return HttpResponse.json<ApiItem<LeaveApplicationDetail>>({
      data: { application: serialize(record, leaveRecords()), history },
    })
  }),

  http.post(path('/applications'), async ({ request }) => {
    const unauthorized = await guard(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, applySchema)
    if (!parsed.success) return invalid('Some fields are not valid.')
    const me = findEmployee(ME)
    if (!me || profileOf(me).status !== 'active')
      return forbidden('Only active employees may apply.')
    const payload = buildPayload(parsed.data, leaveRecords())
    if (payload instanceof Response) return payload
    const record = newStandardRecord(
      LEAVE_DEF,
      { id: createId('lv'), code: nextCode(), employeeId: ME, createdById: ME },
      payload as unknown as Record<string, unknown>,
      now(),
    )
    standardRequests.insert(record)
    return item(record)
  }),

  http.post(path('/applications/:id/decision'), async ({ request, params }) => {
    const unauthorized = await guard(request)
    if (unauthorized) return unauthorized
    const record = typeof params.id === 'string' ? standardRequests.find(params.id) : undefined
    if (!record || !isLeave(record)) return notFound()
    if (!actionsFor(record).includes('decide')) {
      return forbidden('This application is not waiting for a decision.')
    }
    const parsed = await readBody(request, decisionSchema)
    if (!parsed.success) return invalid('Some fields are not valid.')
    const { decision } = parsed.data
    const remarks = parsed.data.remarks || null
    if (decision === 'reject' && !remarks) {
      return invalid('Give a reason for rejecting.', { remarks: 'Give a reason for rejecting' })
    }
    const at = now()
    let next: StoredStandardRequest
    if (record.status === 'cancelling') {
      next = applyCancelDecision(record, decision, ME, remarks, at)
    } else if (decision === 'approve') {
      next = approveAll(record, remarks, at)
    } else {
      next = applyDecision(record, 'reject', ME, remarks, at).record
    }
    standardRequests.update(next.id, next)
    return item(next)
  }),

  http.post(path('/applications/:id/cancel'), async ({ request, params }) => {
    const unauthorized = await guard(request)
    if (unauthorized) return unauthorized
    const record = typeof params.id === 'string' ? standardRequests.find(params.id) : undefined
    if (!record || !isLeave(record)) return notFound()
    if (!actionsFor(record).includes('cancel')) {
      return forbidden('Only your pending or approved applications can be cancelled.')
    }
    const parsed = await readBody(request, cancelSchema)
    if (!parsed.success) {
      return invalid('Give a reason for cancellation.', {
        reason: 'Give a reason for cancellation',
      })
    }
    const at = now()
    let next: StoredStandardRequest
    if (record.status === 'pending') {
      // Withdrawn before anyone decided: the steps still waiting are skipped.
      next = {
        ...record,
        status: 'cancelled',
        cancelReason: parsed.data.reason,
        flow: record.flow.map((step) =>
          step.status === 'pending' || step.status === 'waiting'
            ? { ...step, status: 'skipped' }
            : step,
        ),
        updatedAt: at,
        history: [...record.history, historyEntry(ME, 'Cancelled', parsed.data.reason, at)],
      }
    } else {
      next = requestStandardCancel(LEAVE_DEF, record, parsed.data.reason, at)
    }
    standardRequests.update(next.id, next)
    return item(next)
  }),
]
