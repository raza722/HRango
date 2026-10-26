import { format } from 'date-fns'
import { http, type HttpHandler, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  type BackendAttachment,
  type BackendRequestDetail,
  type BackendRequestPage,
  PUNCH_REQUEST_TYPES,
} from '@/features/requests'
import type { ApiItem } from '@/types/api'

import type { MockCollection } from '../collection'
import { DIRECTORY, findEmployee } from '../employees/seed'
import { mockFileUrl } from '../files/handlers'
import { rosterGroups } from '../roster/handlers'
import { scheduleEntries } from '../scheduling/handlers'
import { profileOf } from '../scheduling/seed'
import {
  apiPath,
  createId,
  errorResponse,
  latency,
  paginate,
  readPageParams,
  requireAuth,
} from '../utils'
import {
  backendActions,
  cancelBodySchema,
  filesFrom,
  forwardRecord,
  pageOf,
  registerApprovalSource,
  type RequestBodyIn,
  requestBodySchema,
  type RequestHeaderFields,
  serializeDetail,
  type SerializeInfo,
  serializeRequest,
  staleRow,
  textOrNull,
  withdrawRecord,
} from './backend'
import { punchRequests, shiftRequests, slotNameOn } from './db'
import { applyEffect, entryOn, revertEffect, rosterTimes } from './effects'
import { fallbackGet } from './fallback'
import {
  type AppliedEffect,
  applyCancelDecision,
  applyConsent,
  applyDecision,
  type FlowFacts,
  historyEntry,
} from './flow'
import { base, invalid, notFound, now, readBody, today } from './http'
import { ME, requestEmployee } from './people'
import { restrictionFor } from './settings-db'
import {
  CORE_TYPE_CODES,
  newCoreRecord,
  releaseFlow,
  requestCoreCancel,
  type StoredCorePunch,
  type StoredCoreRequest,
  type StoredCoreShift,
} from './transfer-flow'
import { transferDef } from './transfer-handlers'

export { resetRequestsDb } from './db'

/*
 * Punch (`/requests/punch`), Shift (`/requests/shift-swap`) and Transfer
 * (`/requests/transfer`) on the backend's request engine routes, in its shapes
 * (`RequestOut`, `RequestDetailOut`, `RequestIn` with each type's `details`).
 * Approvals are the shared `/requests/approvals…` (./backend.ts); each type
 * registers there. The pickers Scheduling owns (the day's shift, time slots)
 * are answered only when no other mock serves them (./fallback.ts).
 */

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  .transform((value) => value.slice(0, 5))
const id = z.union([z.string(), z.number()]).transform(String)

const conflict = (message: string, fieldErrors?: Record<string, string>) =>
  errorResponse(409, message, { code: 'CONFLICT', ...(fieldErrors ? { fieldErrors } : {}) })

/** What a request type supplies to the shared endpoints below. */
export interface CoreKindDef<T extends StoredCoreRequest> {
  kind: T['kind']
  typeName: string
  /** `RQ-PCH` → RQ-PCH-0001. */
  codePrefix: string
  idPrefix: string
  collection: MockCollection<T>
  /** Checks a `RequestIn` body and returns what to store, or an error response. */
  toPayload: (body: RequestBodyIn, employeeId: string, current: T | null) => Response | T['payload']
  /** Asked before the flow starts (a shift swap's colleague). */
  consentIds?: (payload: T['payload']) => string[]
  facts: (payload: T['payload']) => FlowFacts
  /** The day Request Restriction checks. */
  dateOf: (payload: T['payload']) => string
  details: (record: T) => Record<string, unknown>
  header: (record: T) => RequestHeaderFields
  /** Runs at the final approval; what it returns is kept to undo it. */
  onApproved?: (record: T) => AppliedEffect | null
  /** Runs when the cancellation of an approved request is approved. */
  onCancelled?: (record: T) => void
}

/** Builds a type's endpoints and registers it with the Approvals screen. */
export function createCoreHandlers<T extends StoredCoreRequest>(
  def: CoreKindDef<T>,
): HttpHandler[] {
  const typeCode = CORE_TYPE_CODES[def.kind]
  const { collection } = def
  const find = (value: unknown) => (typeof value === 'string' ? collection.find(value) : undefined)
  const save = (record: T) => {
    collection.update(record.id, record)
    return record
  }
  const info = (record: T): SerializeInfo => ({
    typeCode,
    typeName: def.typeName,
    kind: typeCode,
    header: def.header(record),
    details: def.details(record),
  })
  const detail = (record: T, status = 200) =>
    HttpResponse.json<ApiItem<BackendRequestDetail>>(
      { data: serializeDetail(record, info(record)) },
      { status },
    )
  const actionsFor = (record: T) => backendActions(record, typeCode)

  registerApprovalSource({
    typeCode,
    records: () => collection.all(),
    find: (value) => collection.find(value),
    info: (record) => info(record as T),
    decide: (stored, decision, remarks) => {
      const record = stored as T
      const at = now()
      if (record.status === 'cancelling') {
        const next = applyCancelDecision(record, decision, ME, remarks, at)
        if (decision === 'approve') {
          def.onCancelled?.(record)
          return save({ ...next, applied: null })
        }
        return save(next)
      }
      const { record: next, completed } = applyDecision(record, decision, ME, remarks, at)
      if (completed && def.onApproved) return save({ ...next, applied: def.onApproved(next) })
      return save(next)
    },
    consent: (stored, agree, remarks) =>
      save(
        releaseFlow(applyConsent(stored as T, ME, agree ? 'approve' : 'reject', remarks, now())),
      ),
    forward: (stored, employeeId, remarks) =>
      save(forwardRecord(stored as T, employeeId, remarks, now())),
  })

  function nextCode(): string {
    const highest = collection.all().reduce((max, record) => {
      const number = Number(record.code.slice(-4))
      return Number.isFinite(number) ? Math.max(max, number) : max
    }, 0)
    return `${def.codePrefix}-${String(highest + 1).padStart(4, '0')}`
  }

  /** Reads a `RequestIn` body, checks the employee, the type's fields and the restriction. */
  async function readInput(
    request: Request,
    current: T | null,
  ): Promise<Response | { employeeId: string; payload: T['payload']; body: RequestBodyIn }> {
    const parsed = requestBodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return invalid('Some fields are not valid.')
    const employeeId = current?.employeeId ?? parsed.data.employeeId ?? ME
    const employee = findEmployee(employeeId)
    if (!employee || profileOf(employee).status !== 'active') {
      return invalid('Choose an active employee.', { employeeId: 'Choose an active employee' })
    }
    const payload = def.toPayload(parsed.data, employeeId, current)
    if (payload instanceof Response) return payload
    const closed = restrictionFor(typeCode, def.dateOf(payload), employeeId)
    if (closed) return invalid(closed, { fromDate: closed })
    return { employeeId, payload, body: parsed.data }
  }

  const path = (suffix = '') => base(`/${typeCode.replaceAll('_', '-')}${suffix}`)
  const guard = async (request: Request) => {
    await latency()
    return requireAuth(request)
  }

  return [
    // My / Subordinates / All: the mock user reaches everyone, so Subordinates is everyone else.
    http.get(path(), async ({ request }) => {
      const denied = await guard(request)
      if (denied) return denied
      const url = new URL(request.url)
      const view = url.searchParams.get('view') ?? 'my'
      const shown = collection
        .all()
        .filter((record) =>
          view === 'all'
            ? true
            : view === 'subordinates'
              ? record.employeeId !== ME
              : record.employeeId === ME,
        )
      return HttpResponse.json<BackendRequestPage>(
        pageOf(
          url,
          shown.map((record) => ({ row: serializeRequest(record, info(record)) })),
        ),
      )
    }),

    http.get(path('/:id'), async ({ request, params }) => {
      const denied = await guard(request)
      if (denied) return denied
      const record = find(params.id)
      return record ? detail(record) : notFound()
    }),

    http.post(path(), async ({ request }) => {
      const denied = await guard(request)
      if (denied) return denied
      const input = await readInput(request, null)
      if (input instanceof Response) return input
      const at = now()
      const record = newCoreRecord<T>(
        {
          id: createId(def.idPrefix),
          code: nextCode(),
          kind: def.kind,
          employeeId: input.employeeId,
          createdById: ME,
          payload: input.payload,
          consentIds: def.consentIds?.(input.payload) ?? [],
        },
        def.facts(input.payload),
        at,
      )
      collection.insert({ ...record, files: filesFrom(input.body.attachments, at) })
      return detail(record, 201)
    }),

    http.put(path('/:id'), async ({ request, params }) => {
      const denied = await guard(request)
      if (denied) return denied
      const record = find(params.id)
      if (!record) return notFound()
      if (!actionsFor(record).includes('edit')) {
        return conflict(
          'An approver has already acted on this request, so it can no longer be edited.',
        )
      }
      const input = await readInput(request, record)
      if (input instanceof Response) return input
      const stale = staleRow(record, input.body.rowVersion)
      if (stale) return stale
      const at = now()
      const consentIds = def.consentIds?.(input.payload) ?? []
      const replanned = newCoreRecord<T>(
        {
          id: record.id,
          code: record.code,
          kind: def.kind,
          employeeId: record.employeeId,
          createdById: record.createdById,
          payload: input.payload,
          consentIds,
        },
        def.facts(input.payload),
        record.createdAt,
      )
      return detail(
        save({
          ...replanned,
          files: record.files ?? [],
          updatedAt: at,
          history: [...record.history, historyEntry(ME, 'Edited', null, at)],
        }),
      )
    }),

    http.delete(path('/:id'), async ({ request, params }) => {
      const denied = await guard(request)
      if (denied) return denied
      const record = find(params.id)
      if (!record) return notFound()
      const stale = staleRow(record, new URL(request.url).searchParams.get('rowVersion'))
      if (stale) return stale
      if (!actionsFor(record).includes('delete')) {
        return conflict('Only a pending request nobody has acted on can be deleted.')
      }
      collection.remove(record.id)
      return new HttpResponse(null, { status: 204 })
    }),

    http.post(path('/:id/cancel'), async ({ request, params }) => {
      const denied = await guard(request)
      if (denied) return denied
      const record = find(params.id)
      if (!record) return notFound()
      const parsed = await readBody(request, cancelBodySchema)
      if (!parsed.success) {
        return invalid('Give a reason for cancellation.', { reason: 'Reason is required.' })
      }
      const stale = staleRow(record, parsed.data.rowVersion)
      if (stale) return stale
      if (!actionsFor(record).includes('cancel')) {
        return conflict('Only a pending or approved request can be cancelled.')
      }
      const at = now()
      const next =
        record.status === 'pending'
          ? withdrawRecord(record, parsed.data.reason, at)
          : requestCoreCancel(record, ME, parsed.data.reason, at)
      return detail(save(next))
    }),

    http.post(path('/:id/attachments'), async ({ request, params }) => {
      const denied = await guard(request)
      if (denied) return denied
      const record = find(params.id)
      if (!record) return notFound()
      const parsed = await readBody(request, z.object({ fileId: id, label: z.string().nullish() }))
      const at = now()
      const file = parsed.success ? filesFrom([parsed.data.fileId], at)[0] : undefined
      if (!parsed.success || !file) return invalid('Choose a file.', { fileId: 'Choose a file' })
      const stored = { ...file, label: parsed.data.label ?? null }
      save({ ...record, files: [...(record.files ?? []), stored], updatedAt: at })
      return HttpResponse.json<ApiItem<BackendAttachment>>(
        {
          data: {
            id: stored.id,
            fileId: stored.fileId,
            name: stored.name,
            mimeType: null,
            sizeBytes: null,
            label: stored.label,
            url: mockFileUrl(stored.fileId),
            createdAt: at,
          },
        },
        { status: 201 },
      )
    }),

    http.delete(path('/:id/attachments/:attachmentId'), async ({ request, params }) => {
      const denied = await guard(request)
      if (denied) return denied
      const record = find(params.id)
      if (!record) return notFound()
      save({
        ...record,
        files: (record.files ?? []).filter((file) => file.id !== params.attachmentId),
        updatedAt: now(),
      })
      return new HttpResponse(null, { status: 204 })
    }),
  ]
}

// --- Punch ----------------------------------------------------------------------------------------

const punchDetails = z.object({
  punchDate: day.nullish(),
  punchType: z.enum(PUNCH_REQUEST_TYPES, { message: 'Punch type is required.' }),
  punchTime: time,
})

const hhmmss = (value: string) => (value.length === 5 ? `${value}:00` : value)

const punchDef: CoreKindDef<StoredCorePunch> = {
  kind: 'punch',
  typeName: 'Punch',
  codePrefix: 'RQ-PCH',
  idPrefix: 'prq',
  collection: punchRequests,
  toPayload: (body, employeeId, current) => {
    const parsed = punchDetails.safeParse(body.details)
    const date = parsed.success ? (parsed.data.punchDate ?? body.fromDate) : null
    if (!parsed.success || !date) {
      const fieldErrors = parsed.success
        ? { punchDate: 'Date is required.' }
        : Object.fromEntries(
            parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
          )
      return invalid('Some fields are not valid.', fieldErrors)
    }
    if (date > today()) {
      return invalid('A punch request is for today or an earlier date.', {
        punchDate: 'A punch request is for today or an earlier date.',
      })
    }
    const entry = entryOn(employeeId, date)
    if (entry?.kind !== 'shift') {
      return invalid('There is no shift on this date, so a punch cannot be requested.', {
        punchDate: 'There is no shift on this date, so a punch cannot be requested.',
      })
    }
    const duplicate = punchRequests
      .all()
      .some(
        (record) =>
          record.id !== current?.id &&
          record.employeeId === employeeId &&
          (record.status === 'pending' || record.status === 'completed') &&
          record.payload.date === date &&
          record.payload.punchType === parsed.data.punchType,
      )
    if (duplicate) {
      return conflict('A request for this punch on this date already exists.', {
        punchType: 'A request for this punch on this date already exists.',
      })
    }
    return {
      date,
      punchType: parsed.data.punchType,
      punchTime: parsed.data.punchTime,
      reason: textOrNull(body.reason),
      description: textOrNull(body.description),
    }
  },
  facts: (payload) => ({ punchType: payload.punchType }),
  dateOf: (payload) => payload.date,
  details: (record) => ({
    punchDate: record.payload.date,
    punchType: record.payload.punchType,
    punchTime: hhmmss(record.payload.punchTime),
  }),
  header: (record) => ({
    fromDate: record.payload.date,
    toDate: record.payload.date,
    days: 1,
    reason: record.payload.reason,
    description: record.payload.description,
    application: null,
  }),
  onApproved: (record) => applyEffect(record),
  onCancelled: (record) => {
    revertEffect(record.applied, record.payload.date)
  },
}

// --- Shift ----------------------------------------------------------------------------------------

const shiftDetails = z.object({
  shiftDate: day.nullish(),
  timeSlotId: id.nullish(),
  withEmployeeId: id.nullish(),
})

const shiftDef: CoreKindDef<StoredCoreShift> = {
  kind: 'shift',
  typeName: 'Shift Swap',
  codePrefix: 'RQ-SFT',
  idPrefix: 'srq',
  collection: shiftRequests,
  toPayload: (body, employeeId, current) => {
    const parsed = shiftDetails.safeParse(body.details)
    if (!parsed.success) return invalid('Some fields are not valid.')
    const date = parsed.data.shiftDate ?? body.fromDate
    const timeSlotId = parsed.data.timeSlotId ?? null
    const swapWithId = parsed.data.withEmployeeId ?? null
    if (!date) return invalid('Date is required.', { shiftDate: 'Date is required.' })
    if (date < today()) {
      return invalid('A shift request is for today or a later date.', {
        shiftDate: 'A shift request is for today or a later date.',
      })
    }
    if ((timeSlotId === null) === (swapWithId === null)) {
      return invalid('Choose either a new shift or a colleague to swap with.', {
        timeSlotId: 'Choose either a new shift or a colleague to swap with.',
      })
    }
    const mine = entryOn(employeeId, date)
    if (mine?.kind !== 'shift') {
      return invalid('There is no shift on this date to change.', {
        shiftDate: 'There is no shift on this date to change.',
      })
    }
    if (timeSlotId) {
      if (!rosterGroups.find(timeSlotId)) {
        return invalid('Shift not found.', { timeSlotId: 'Shift not found.' })
      }
      if (!rosterTimes(timeSlotId, date)) {
        return invalid('That shift has this day off.', {
          timeSlotId: 'That shift has this day off.',
        })
      }
      if (mine.rosterGroupId === timeSlotId) {
        return errorResponse(422, 'The new shift is the same as the current one.', {
          code: 'SHIFT_UNCHANGED',
          fieldErrors: { timeSlotId: 'The new shift is the same as the current one.' },
        })
      }
    }
    if (swapWithId) {
      const colleague = findEmployee(swapWithId)
      if (!colleague || swapWithId === employeeId) {
        return invalid('Choose a colleague to swap with.', {
          withEmployeeId: 'Choose a colleague to swap with.',
        })
      }
      if (entryOn(swapWithId, date)?.kind !== 'shift') {
        return invalid('The colleague has no shift on this date.', {
          withEmployeeId: 'The colleague has no shift on this date.',
        })
      }
      if (slotNameOn(swapWithId, date) === slotNameOn(employeeId, date)) {
        return errorResponse(422, 'The colleague works the same shift on this date.', {
          code: 'SHIFT_UNCHANGED',
          fieldErrors: { withEmployeeId: 'The colleague works the same shift on this date.' },
        })
      }
    }
    const waiting = shiftRequests
      .all()
      .some(
        (record) =>
          record.id !== current?.id &&
          record.employeeId === employeeId &&
          (record.status === 'pending' || record.status === 'cancelling') &&
          record.payload.date === date,
      )
    if (waiting) {
      return conflict('A shift request for this date is already waiting.', {
        shiftDate: 'A shift request for this date is already waiting.',
      })
    }
    return {
      date,
      timeSlotId,
      swapWithId,
      fromSlotName: slotNameOn(employeeId, date),
      toSlotName: swapWithId ? slotNameOn(swapWithId, date) : null,
      reason: textOrNull(body.reason),
      description: textOrNull(body.description),
    }
  },
  consentIds: (payload) => (payload.swapWithId ? [payload.swapWithId] : []),
  facts: () => ({}),
  dateOf: (payload) => payload.date,
  details: (record) => {
    const { payload } = record
    const slot = payload.timeSlotId ? rosterGroups.find(payload.timeSlotId) : undefined
    return {
      shiftDate: payload.date,
      fromScheduleId: null,
      fromTimeSlotName: payload.fromSlotName,
      timeSlotId: payload.timeSlotId,
      timeSlotName: slot?.title ?? null,
      withEmployeeId: payload.swapWithId,
      withEmployeeName: payload.swapWithId
        ? (findEmployee(payload.swapWithId)?.name ?? null)
        : null,
      toScheduleId: null,
      toTimeSlotName: payload.toSlotName,
    }
  },
  header: (record) => ({
    fromDate: record.payload.date,
    toDate: record.payload.date,
    days: 1,
    reason: record.payload.reason,
    description: record.payload.description,
    application: null,
  }),
  onApproved: (record) => applyEffect(record),
  onCancelled: (record) => {
    revertEffect(record.applied, record.payload.date)
  },
}

// --- Scheduling's pickers (fallbacks) --------------------------------------------------------------

const clockOf = (time: string) => `${time}:00`

/** `GET /scheduling/schedules?employeeId&from&to`: the schedule board, as far as the forms read it. */
const scheduleBoard = fallbackGet('/scheduling/schedules', async ({ request }) => {
  const denied = requireAuth(request)
  if (denied) return denied
  await latency()
  const url = new URL(request.url)
  const employeeId = url.searchParams.get('employeeId')
  const from = url.searchParams.get('from') ?? format(new Date(), 'yyyy-MM-dd')
  const to = url.searchParams.get('to') ?? from
  const entries = scheduleEntries
    .all()
    .filter(
      (entry) =>
        entry.date >= from && entry.date <= to && (!employeeId || entry.employeeId === employeeId),
    )
  // The signed-in person first, as the API's board for one's own schedule.
  const people = [...new Set(entries.map((entry) => entry.employeeId))].sort((a, b) =>
    a === ME ? -1 : b === ME ? 1 : a.localeCompare(b),
  )
  const rows = people.flatMap((personId) => {
    const person = findEmployee(personId)
    if (!person) return []
    const mine = entries.filter((entry) => entry.employeeId === personId)
    return [
      {
        employee: { id: person.id, code: person.id, name: person.name },
        shifts: mine
          .filter((entry) => entry.kind === 'shift' && entry.clockIn && entry.clockOut)
          .map((entry) => ({
            id: entry.id,
            workDate: entry.date,
            startAt: `${entry.date}T${clockOf(entry.clockIn ?? '00:00')}`,
            endAt: `${entry.date}T${clockOf(entry.clockOut ?? '00:00')}`,
            timeSlotId: entry.rosterGroupId,
            timeSlotName: entry.slot.name,
          })),
        restDays: mine
          .filter((entry) => entry.kind === 'rest')
          .map((entry) => ({ id: entry.id, restDate: entry.date })),
        holidays: [],
      },
    ]
  })
  return HttpResponse.json({
    data: rows,
    meta: { page: 1, pageSize: rows.length, total: rows.length, totalPages: 1 },
    dayTotals: [],
  })
})

/** `GET /scheduling/options/time-slots`: the mock's time slots are the roster groups. */
const timeSlots = fallbackGet('/scheduling/options/time-slots', async ({ request }) => {
  const denied = requireAuth(request)
  if (denied) return denied
  await latency()
  const data = rosterGroups.all().map((group, index) => {
    const first = group.days.find((entry) => !entry.isWeekend && entry.clockIn && entry.clockOut)
    return {
      id: group.id,
      code: `TS-${String(index + 1).padStart(4, '0')}`,
      name: group.title,
      startTime: first?.clockIn ? clockOf(first.clockIn) : null,
      endTime: first?.clockOut ? clockOf(first.clockOut) : null,
    }
  })
  return HttpResponse.json({ data })
})

/**
 * `GET /requests/options/colleagues?q&employeeId&page&pageSize`: whom a shift may be swapped
 * with (the company's current people but the requester; id, code, name, department, branch).
 */
const colleagueOptions = http.get(apiPath('/requests/options/colleagues'), async ({ request }) => {
  await latency()
  const denied = requireAuth(request)
  if (denied) return denied
  const url = new URL(request.url)
  const requester = url.searchParams.get('employeeId') ?? ME
  const rows = DIRECTORY.filter((employee) => employee.id !== requester)
    .map((employee) => {
      const person = requestEmployee(employee)
      return {
        id: person.id,
        code: person.code,
        name: person.name,
        departmentId: null,
        departmentName: person.department,
        branchId: employee.branchId ?? null,
        branchName: person.branch,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
  const { page, pageSize } = readPageParams(url)
  const matches = q
    ? rows.filter((row) => `${row.name} ${row.code}`.toLowerCase().includes(q))
    : rows
  return HttpResponse.json(paginate(matches, page, pageSize))
})

export const requestHandlers = [
  colleagueOptions,
  ...createCoreHandlers(punchDef),
  ...createCoreHandlers(shiftDef),
  ...createCoreHandlers(transferDef),
  scheduleBoard,
  timeSlots,
]
