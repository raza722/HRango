import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  type AnyRequest,
  type DayShift,
  PUNCH_REQUEST_TYPES,
  type RequestAction,
  type RequestDetail,
  type RequestKind,
  type RequestLookups,
  type RequestPage,
} from '@/features/requests'
import type { ApiItem } from '@/types/api'

import type { MockCollection } from '../collection'
import { DIRECTORY, findEmployee } from '../employees/seed'
import { rosterGroups } from '../roster/handlers'
import { profileOf } from '../scheduling/seed'
import { branches } from '../settings/handlers'
import { latency, paginate, readPageParams, requireAuth } from '../utils'
import { punchRequests, shiftRequests, shiftText } from './db'
import { applyEffect, entryOn, revertEffect, rosterTimes } from './effects'
import {
  applyCancelDecision,
  applyCancelRequest,
  applyConsent,
  applyDecision,
  currentStep,
  historyEntry,
  newRecord,
  type StoredPunchRequest,
  type StoredRequest,
  type StoredShiftRequest,
} from './flow'
import {
  base,
  countsOf,
  forbidden,
  invalid,
  notFound,
  now,
  readBody,
  text,
  today,
  toStep,
} from './http'
import { delegatorsOf, ME, mustFind, ref, requestEmployee } from './people'
import { restrictionFor } from './settings-db'
import { transferHandlers } from './transfer-handlers'

export { resetRequestsDb } from './db'

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

const punchSchema = z.object({
  employeeId: z.string().min(1).optional(),
  date: day,
  punchType: z.enum(PUNCH_REQUEST_TYPES),
  punchTime: time,
  description: text,
})

const shiftSchema = z.object({
  employeeId: z.string().min(1).optional(),
  date: day,
  rosterGroupId: z.string().min(1).nullable(),
  swapWithId: z.string().min(1).nullable(),
  description: text,
})

const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  remarks: text,
})

// --- serializing -----------------------------------------------------------------

/** Your own steps, and those of people who delegated this request type to you. */
const mayDecideFor = (approverId: string, kind: RequestKind) =>
  approverId === ME || delegatorsOf(ME, kind).includes(approverId)

function actionsFor(record: StoredRequest): RequestAction[] {
  const mine = record.employeeId === ME || record.createdById === ME
  const untouched = record.flow.every(
    (step) => step.status === 'pending' || step.status === 'waiting',
  )
  const step = currentStep(record)
  const actions: RequestAction[] = ['view', 'flow', 'history']
  if (record.status === 'pending' && mine && untouched) actions.push('edit', 'delete')
  if (record.status === 'completed' && mine) actions.push('cancel')
  if (step && record.employeeId !== ME && mayDecideFor(step.approverId, record.kind)) {
    actions.push('decide')
  }
  if (
    record.status === 'pending' &&
    record.consents.some((consent) => consent.personId === ME && consent.status === 'pending')
  ) {
    actions.push('consent')
  }
  return actions
}

function serialize(record: StoredRequest): AnyRequest {
  const step = currentStep(record)
  const shared = {
    id: record.id,
    code: record.code,
    status: record.status,
    employee: requestEmployee(mustFind(record.employeeId)),
    createdBy: ref(record.createdById),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    flow: [
      ...record.flow.map(toStep),
      ...(record.cancelStep
        ? [
            {
              ...toStep(record.cancelStep),
              authority: `${record.cancelStep.authority} (Cancellation)`,
            },
          ]
        : []),
    ],
    consents: record.consents.map((consent) => ({
      person: ref(consent.personId),
      status: consent.status,
      remarks: consent.remarks,
    })),
    cancelReason: record.cancelReason,
    currentStep: step ? toStep(step) : null,
    actions: actionsFor(record),
  }
  if (record.kind === 'punch') {
    const entry = entryOn(record.employeeId, record.payload.date)
    const shift = entry?.kind === 'shift' ? entry : undefined
    return {
      ...shared,
      kind: 'punch',
      payload: {
        ...record.payload,
        expectedIn: shift?.clockIn ?? null,
        expectedOut: shift?.clockOut ?? null,
      },
    }
  }
  const { swapWithId, ...payload } = record.payload
  return {
    ...shared,
    kind: 'shift',
    payload: { ...payload, swapWith: swapWithId ? ref(swapWithId) : null },
  }
}

/**
 * The Filters dialog's values (Punch): the person and where they work, the next
 * requestee, the dates, the punch type ("Method") and a punch-time range.
 */
function matchesFilters(record: StoredRequest, url: URL): boolean {
  const employee = mustFind(record.employeeId)
  const checks: [string, (value: string) => boolean][] = [
    ['employeeId', (value) => record.employeeId === value],
    ['department', (value) => employee.department === value],
    ['branchId', (value) => employee.branchId === value],
    [
      'locationId',
      (value) =>
        (employee.branchId ? branches.find(employee.branchId)?.locationId : null) === value,
    ],
    ['employmentStatus', (value) => value === 'all' || profileOf(employee).status === value],
    ['nextRequesteeId', (value) => currentStep(record)?.approverId === value],
    ['delegatorId', (value) => record.flow.some((step) => step.approverId === value)],
    ['from', (value) => record.payload.date >= value],
    ['to', (value) => record.payload.date <= value],
    ['punchType', (value) => record.kind === 'punch' && record.payload.punchType === value],
    ['startTime', (value) => record.kind === 'punch' && record.payload.punchTime >= value],
    ['endTime', (value) => record.kind === 'punch' && record.payload.punchTime <= value],
  ]
  return checks.every(([name, test]) => {
    const value = url.searchParams.get(name) ?? ''
    return value === '' || test(value)
  })
}

function listResponse(url: URL, records: StoredRequest[]) {
  const status = url.searchParams.get('status')
  const { page, pageSize } = readPageParams(url)
  const sorted = records
    .filter((record) => matchesFilters(record, url))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const filtered = status ? sorted.filter((record) => record.status === status) : sorted
  const result = paginate(filtered, page, pageSize)
  return HttpResponse.json<RequestPage<AnyRequest>>({
    ...result,
    data: result.data.map(serialize),
    counts: countsOf(sorted),
  })
}

// --- validation per type ------------------------------------------------------------

type Collection = MockCollection<StoredPunchRequest> | MockCollection<StoredShiftRequest>

function employeeFor(employeeId: string | undefined) {
  const employee = findEmployee(employeeId ?? ME)
  if (!employee || profileOf(employee).status !== 'active') return null
  return employee
}

function validatePunch(
  input: z.infer<typeof punchSchema>,
  employeeId: string,
  ignoreId: string | null,
): Response | StoredPunchRequest['payload'] {
  if (input.date > today()) {
    return invalid('Choose today or a past day.', { date: 'Choose today or a past day' })
  }
  const entry = entryOn(employeeId, input.date)
  if (entry?.kind !== 'shift') {
    return invalid('No shift is scheduled on this day.', {
      date: 'No shift is scheduled on this day',
    })
  }
  const duplicate = punchRequests
    .all()
    .some(
      (record) =>
        record.id !== ignoreId &&
        record.employeeId === employeeId &&
        record.status === 'pending' &&
        record.payload.date === input.date &&
        record.payload.punchType === input.punchType,
    )
  if (duplicate) {
    return invalid('A request for this punch is already pending.', {
      punchType: 'A request for this punch is already pending',
    })
  }
  return {
    date: input.date,
    punchType: input.punchType,
    punchTime: input.punchTime,
    description: input.description,
  }
}

function validateShift(
  input: z.infer<typeof shiftSchema>,
  employeeId: string,
): Response | StoredShiftRequest['payload'] {
  if (input.date < today()) {
    return invalid('Choose today or a later day.', { date: 'Choose today or a later day' })
  }
  if (!input.rosterGroupId && !input.swapWithId) {
    return invalid('Choose a time roster or someone to swap with.', {
      rosterGroupId: 'Choose a time roster or someone to swap with',
    })
  }
  const current = entryOn(employeeId, input.date)
  if (input.swapWithId) {
    const colleague = findEmployee(input.swapWithId)
    const theirs = entryOn(input.swapWithId, input.date)
    if (!colleague || input.swapWithId === employeeId) {
      return invalid('Choose someone else to swap with.', { swapWithId: 'Choose someone else' })
    }
    if (theirs?.kind !== 'shift') {
      return invalid(`${colleague.name} has no shift that day.`, {
        swapWithId: `${colleague.name} has no shift that day`,
      })
    }
  }
  let rosterTitle: string | null = null
  if (input.rosterGroupId && !input.swapWithId) {
    const times = rosterTimes(input.rosterGroupId, input.date)
    const group = rosterGroups.find(input.rosterGroupId)
    if (!group) return invalid('Choose a time roster.', { rosterGroupId: 'Choose a time roster' })
    if (!times) {
      return invalid(`${group.title} has that day off.`, {
        rosterGroupId: `${group.title} has that day off`,
      })
    }
    if (current?.kind === 'shift' && current.rosterGroupId === group.id) {
      return invalid('That is already the shift on this day.', {
        rosterGroupId: 'That is already the shift on this day',
      })
    }
    rosterTitle = group.title
  }
  return {
    date: input.date,
    rosterGroupId: input.swapWithId ? null : input.rosterGroupId,
    rosterTitle,
    swapFrom: shiftText(employeeId, input.date),
    swapWithId: input.swapWithId,
    swapToShift: input.swapWithId ? shiftText(input.swapWithId, input.date) : null,
    description: input.description,
  }
}

function nextCode(kind: RequestKind): string {
  const records: StoredRequest[] = kind === 'punch' ? punchRequests.all() : shiftRequests.all()
  const highest = records.reduce((max, record) => {
    const number = Number(record.code.slice(-4))
    return Number.isFinite(number) ? Math.max(max, number) : max
  }, 0)
  return `RQ-${kind === 'punch' ? 'ATT' : 'SFT'}-${String(highest + 1).padStart(4, '0')}`
}

function store(kind: RequestKind): Collection {
  return kind === 'punch' ? punchRequests : shiftRequests
}

function save(record: StoredRequest) {
  if (record.kind === 'punch') punchRequests.update(record.id, record)
  else shiftRequests.update(record.id, record)
}

function find(kind: RequestKind, id: unknown): StoredRequest | undefined {
  return typeof id === 'string' ? store(kind).find(id) : undefined
}

const item = (record: StoredRequest) =>
  HttpResponse.json<ApiItem<AnyRequest>>({ data: serialize(record) })

// --- handlers ---------------------------------------------------------------------------

function kindHandlers(kind: RequestKind) {
  const path = (suffix = '') => base(`/${kind}${suffix}`)
  return [
    http.get(path(), async ({ request }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized
      const url = new URL(request.url)
      const all: StoredRequest[] = store(kind).all()
      const scope = url.searchParams.get('scope') ?? 'my'
      return listResponse(
        url,
        scope === 'all' ? all : all.filter((record) => record.employeeId === ME),
      )
    }),

    http.get(path('/approvals'), async ({ request }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized
      const url = new URL(request.url)
      const view = url.searchParams.get('view') ?? 'requested'
      const delegators = delegatorsOf(ME, kind)
      const steps = (record: StoredRequest) => [
        ...record.flow,
        ...(record.cancelStep ? [record.cancelStep] : []),
      ]
      const all: StoredRequest[] = store(kind).all()
      const records = all.filter((record) => {
        if (view === 'consents') return record.consents.some((consent) => consent.personId === ME)
        const approvers = view === 'delegates' ? delegators : [ME]
        return (
          record.employeeId !== ME &&
          steps(record).some(
            (step) => approvers.includes(step.approverId) && step.status !== 'waiting',
          )
        )
      })
      return listResponse(url, records)
    }),

    http.get(path('/:id'), async ({ request, params }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized
      const record = find(kind, params.id)
      if (!record) return notFound()
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
      return HttpResponse.json<ApiItem<RequestDetail<AnyRequest>>>({
        data: { request: serialize(record), history },
      })
    }),

    http.post(path(), async ({ request }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized
      if (kind === 'punch') {
        const parsed = await readBody(request, punchSchema)
        if (!parsed.success) return invalid('Some fields are not valid.')
        const employee = employeeFor(parsed.data.employeeId)
        if (!employee)
          return invalid('Choose an active employee.', { employeeId: 'Choose an employee' })
        const payload = validatePunch(parsed.data, employee.id, null)
        if (payload instanceof Response) return payload
        const closed = restrictionFor('punch', payload.date, employee.id)
        if (closed) return invalid(closed, { date: closed })
        const record = newRecord<StoredPunchRequest>(
          {
            id: `prq_${Date.now().toString(36)}`,
            code: nextCode('punch'),
            kind: 'punch',
            employeeId: employee.id,
            createdById: ME,
            consents: [],
            payload,
          },
          now(),
        )
        punchRequests.insert(record)
        return item(record)
      }
      const parsed = await readBody(request, shiftSchema)
      if (!parsed.success) return invalid('Some fields are not valid.')
      const employee = employeeFor(parsed.data.employeeId)
      if (!employee)
        return invalid('Choose an active employee.', { employeeId: 'Choose an employee' })
      const payload = validateShift(parsed.data, employee.id)
      if (payload instanceof Response) return payload
      const closed = restrictionFor('shift', payload.date, employee.id)
      if (closed) return invalid(closed, { date: closed })
      const record = newRecord<StoredShiftRequest>(
        {
          id: `srq_${Date.now().toString(36)}`,
          code: nextCode('shift'),
          kind: 'shift',
          employeeId: employee.id,
          createdById: ME,
          consents: payload.swapWithId
            ? [{ personId: payload.swapWithId, status: 'pending', remarks: null }]
            : [],
          payload,
        },
        now(),
      )
      shiftRequests.insert(record)
      return item(record)
    }),

    http.put(path('/:id'), async ({ request, params }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized
      const record = find(kind, params.id)
      if (!record) return notFound()
      if (!actionsFor(record).includes('edit')) {
        return forbidden('Only a pending request nobody has acted on can be edited.')
      }
      const at = now()
      if (record.kind === 'punch') {
        const parsed = await readBody(request, punchSchema)
        if (!parsed.success) return invalid('Some fields are not valid.')
        const payload = validatePunch(parsed.data, record.employeeId, record.id)
        if (payload instanceof Response) return payload
        const next: StoredPunchRequest = {
          ...record,
          payload,
          updatedAt: at,
          history: [...record.history, historyEntry(ME, 'Edited', null, at)],
        }
        save(next)
        return item(next)
      }
      const parsed = await readBody(request, shiftSchema)
      if (!parsed.success) return invalid('Some fields are not valid.')
      const payload = validateShift(parsed.data, record.employeeId)
      if (payload instanceof Response) return payload
      const next: StoredShiftRequest = {
        ...record,
        payload,
        consents: payload.swapWithId
          ? [{ personId: payload.swapWithId, status: 'pending', remarks: null }]
          : [],
        updatedAt: at,
        history: [...record.history, historyEntry(ME, 'Edited', null, at)],
      }
      save(next)
      return item(next)
    }),

    http.delete(path('/:id'), async ({ request, params }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized
      const record = find(kind, params.id)
      if (!record) return notFound()
      if (!actionsFor(record).includes('delete')) {
        return forbidden('Only a pending request nobody has acted on can be deleted.')
      }
      store(kind).remove(record.id)
      return new HttpResponse(null, { status: 204 })
    }),

    http.post(path('/:id/decision'), async ({ request, params }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized
      const record = find(kind, params.id)
      if (!record) return notFound()
      if (!actionsFor(record).includes('decide')) {
        return forbidden('This request is not waiting for your decision.')
      }
      const parsed = await readBody(request, decisionSchema)
      if (!parsed.success) return invalid('Some fields are not valid.')
      const { decision } = parsed.data
      const remarks = parsed.data.remarks || null
      if (decision === 'reject' && !remarks) {
        return invalid('Give a reason for rejecting.', { remarks: 'Give a reason for rejecting' })
      }
      const at = now()

      if (record.status === 'cancelling') {
        const next = applyCancelDecision(record, decision, ME, remarks, at)
        if (decision === 'approve') {
          revertEffect(record.applied, record.payload.date)
          next.applied = null
        }
        save(next)
        return item(next)
      }

      const step = currentStep(record)
      const isLast = step !== null && record.flow.at(-1) === step
      if (
        decision === 'approve' &&
        isLast &&
        record.kind === 'shift' &&
        record.payload.swapWithId
      ) {
        const consent = record.consents.find(
          (entry) => entry.personId === record.payload.swapWithId,
        )
        const name = ref(record.payload.swapWithId).name
        if (consent?.status === 'pending') return invalid(`Waiting for ${name}’s consent.`)
        if (consent?.status === 'declined') return invalid(`${name} declined the swap.`)
      }
      const { record: next, completed } = applyDecision(record, decision, ME, remarks, at)
      if (completed) next.applied = applyEffect(next)
      save(next)
      return item(next)
    }),

    http.post(path('/:id/consent'), async ({ request, params }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized
      const record = find(kind, params.id)
      if (!record) return notFound()
      if (!actionsFor(record).includes('consent')) {
        return forbidden('Your consent is not needed on this request.')
      }
      const parsed = await readBody(request, decisionSchema)
      if (!parsed.success) return invalid('Some fields are not valid.')
      const next = applyConsent(
        record,
        ME,
        parsed.data.decision,
        parsed.data.remarks || null,
        now(),
      )
      save(next)
      return item(next)
    }),

    http.post(path('/:id/cancel'), async ({ request, params }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized
      const record = find(kind, params.id)
      if (!record) return notFound()
      if (!actionsFor(record).includes('cancel')) {
        return forbidden('Only your completed requests can be cancelled.')
      }
      const parsed = await readBody(
        request,
        z.object({ reason: z.string().trim().min(1).max(500) }),
      )
      if (!parsed.success) {
        return invalid('Give a reason for cancellation.', {
          reason: 'Give a reason for cancellation',
        })
      }
      const next = applyCancelRequest(record, ME, parsed.data.reason, now())
      save(next)
      return item(next)
    }),
  ]
}

export const requestHandlers = [
  http.get(base('/lookups'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    return HttpResponse.json<ApiItem<RequestLookups>>({
      data: {
        employees: DIRECTORY.filter((employee) => profileOf(employee).status === 'active')
          .map((employee) => ({ ...ref(employee.id), department: employee.department }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        rosters: rosterGroups
          .all()
          .map((group) => ({ id: group.id, title: group.title }))
          .sort((a, b) => a.title.localeCompare(b.title)),
      },
    })
  }),

  http.get(base('/day-shift'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const employee = findEmployee(url.searchParams.get('employeeId') ?? ME)
    const date = url.searchParams.get('date') ?? ''
    if (!employee || !day.safeParse(date).success) {
      return invalid('Choose an employee and a date.')
    }
    const entry = entryOn(employee.id, date)
    const shift = entry?.kind === 'shift' ? entry : undefined
    const sameTeam = DIRECTORY.filter(
      (other) =>
        other.id !== employee.id &&
        profileOf(other).status === 'active' &&
        other.department === employee.department,
    )
    const colleagues = sameTeam.flatMap((other) => {
      const theirs = entryOn(other.id, date)
      if (theirs?.kind !== 'shift') return []
      if (shift?.clockIn === theirs.clockIn && shift.clockOut === theirs.clockOut) return []
      return [{ person: ref(other.id), shift: shiftText(other.id, date) ?? '' }]
    })
    return HttpResponse.json<ApiItem<DayShift>>({
      data: {
        date,
        slotName: entry ? (shift ? shift.slot.name : 'Rest Day') : null,
        rosterGroupId: entry?.rosterGroupId ?? null,
        clockIn: shift?.clockIn ?? null,
        clockOut: shift?.clockOut ?? null,
        colleagues,
      },
    })
  }),

  ...kindHandlers('punch'),
  ...kindHandlers('shift'),
  ...transferHandlers,
]
