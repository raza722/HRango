import { http, type HttpHandler, HttpResponse } from 'msw'
import { z } from 'zod'

import type {
  ApprovalDetails,
  BackendAttachment,
  BackendRequest,
  BackendRequestDetail,
  BackendRequestPage,
  RequestStatus,
  SettingsRequestType,
  StandardKind,
} from '@/features/requests'
import type { ApiItem } from '@/types/api'

import type { MockCollection } from '../../collection'
import { findEmployee } from '../../employees/seed'
import { mockFileUrl } from '../../files/handlers'
import { profileOf } from '../../scheduling/seed'
import { createId, errorResponse, latency, requireAuth } from '../../utils'
import {
  backendActions,
  cancelBodySchema,
  filesFrom,
  forwardRecord,
  matchesFilters,
  pageOf,
  registerApprovalSource,
  type RequestBodyIn,
  requestBodySchema,
  type RequestHeaderFields,
  serializeDetail,
  type SerializeInfo,
  serializeRequest,
  staleRow,
  type StoredFile,
  withdrawRecord,
} from '../backend'
import {
  applyCancelDecision,
  applyConsent,
  applyDecision,
  buildFlow,
  currentStep,
  historyEntry,
  planFlow,
  type StoredPunchRequest,
  type StoredStep,
} from '../flow'
import { base, invalid, notFound, now, readBody } from '../http'
import { ME } from '../people'
import { restrictionFor } from '../settings-db'

/*
 * The standard request types (Leave, Loan & Advances, Work From Home,
 * Promotion, Relaxation, Rest Days, Travel, Resignation …) on the backend's
 * request engine routes (backend/app/routers/requests.py):
 *   GET    /requests/<type>             ?view=my|subordinates|all&status&q&employeeId&departmentId&from&to
 *   GET    /requests/<type>/:id         RequestDetailOut (steps, attachments, actions)
 *   POST   /requests/<type>             RequestIn { employeeId?, fromDate, toDate, reason, description,
 *                                         application, attachments: [fileId], details }
 *   PUT    /requests/<type>/:id         RequestIn + rowVersion
 *   DELETE /requests/<type>/:id?rowVersion
 *   POST   /requests/<type>/:id/cancel  { reason, rowVersion }: withdraws a pending request,
 *                                         asks to cancel an approved one
 *   POST/DELETE /requests/<type>/:id/attachments[/:attachmentId]
 *   GET    /requests/<type>/export      the list's filters → CSV (the spec leaves the format open)
 * Approvals (`/requests/approvals…`) are shared across types (../backend.ts).
 * A type supplies its definition (`StandardKindServer`): how to read its
 * `details`, check and store them, show them, its seeds and what approval changes.
 */

/**
 * The kinds the mock engine serves: the Requests module's standard kinds, plus request types
 * other modules file on the same engine (Attendance → Overtime, `/requests/overtime`).
 */
export type MockStandardKind = StandardKind | 'overtime'

/** A stored request of a standard type; `effect` remembers what its approval changed. */
export type StoredStandardRequest = Omit<StoredPunchRequest, 'kind' | 'payload' | 'applied'> & {
  kind: MockStandardKind
  payload: Record<string, unknown>
  applied: null
  effect?: unknown
  files?: StoredFile[]
}

export interface PayloadContext {
  /** Whose request it is. */
  employeeId: string
  /** The request being edited, if any (left out of duplicate checks). */
  ignoreId: string | null
  /** This type's stored requests. */
  records: readonly StoredStandardRequest[]
}

export interface StandardKindServer<I> {
  kind: MockStandardKind
  /** The backend's request type code (`rest_day`); the URL is the code with hyphens. */
  typeCode: string
  /** `GET /requests/types` name ("Rest Day"). */
  typeName: string
  /** The backend's kind when it differs from the code (`time_window`). */
  backendKind?: string
  /** The type in Requests → Settings: flows, delegations and restrictions. */
  settingsType: SettingsRequestType
  /** "RD-" → RD-0001. */
  codePrefix: string
  codeDigits?: number
  /** A `RequestIn` body → the type's input for `schema` (default: details + reason, description). */
  fromBody?: (body: RequestBodyIn) => unknown
  /** The type's input, without `employeeId` (added by the engine). */
  schema: z.ZodType<I>
  /** Checks the fields and returns what to store, or an error response (`invalid(…)`). */
  toPayload: (input: I, context: PayloadContext) => Response | Record<string, unknown>
  /** The day Request Restriction checks. */
  dateOf: (payload: Record<string, unknown>) => string
  /** The header fields (dates, days, reason, description); default from `dateOf` and the payload. */
  header?: (payload: Record<string, unknown>, record: StoredStandardRequest) => RequestHeaderFields
  /** The `details` the backend sends (camelCase, ids as strings, names beside ids). */
  toDetails?: (payload: Record<string, unknown>, record: StoredStandardRequest) => object
  /** Older name of `toDetails`; used when `toDetails` is left out. */
  present?: (payload: Record<string, unknown>, record: StoredStandardRequest) => object
  /** The type's own list filters, beyond the shared ones. */
  filters?: Record<string, (record: StoredStandardRequest, value: string) => boolean>
  /** Fields the approver fills in (`details` of the approve body); returns the new payload or an error. */
  decision?: {
    schema: z.ZodType<Record<string, unknown>>
    apply: (
      record: StoredStandardRequest,
      extras: Record<string, unknown>,
    ) => Response | Record<string, unknown>
  }
  /** "Reason for Approval *" (Relaxation). */
  approveNeedsRemarks?: boolean
  /** Runs when the last approver approves; what it returns is kept to undo it. */
  onCompleted?: (record: StoredStandardRequest) => unknown
  /** Runs when a cancellation is approved, with what `onCompleted` returned. */
  onCancelled?: (record: StoredStandardRequest) => void
  /** Seed requests (use `seedRequest`). */
  seed: () => StoredStandardRequest[]
  /** Endpoints of the type's own (Loan settings, look-ups …), registered before the shared ones. */
  extraHandlers?: HttpHandler[]
  /** The type's own CSV columns in `GET …/export`, after the shared ones: a header and a value. */
  exportColumns?: readonly ExportColumn[]
}

/** One column of a type's CSV export, read from the row as the list sends it. */
export type ExportColumn = readonly [
  header: string,
  value: (row: BackendRequest) => string | number | null | undefined,
]

const SHARED_EXPORT_COLUMNS: readonly ExportColumn[] = [
  ['Code', (row) => row.code],
  ['Employee Code', (row) => row.employeeCode],
  ['Employee', (row) => row.employeeName],
  ['Department', (row) => row.departmentName],
  ['Status', (row) => row.status],
  ['From', (row) => row.fromDate],
  ['To', (row) => row.toDate],
  ['Reason', (row) => row.reason],
  ['Submitted At', (row) => row.submittedAt],
]

/** A CSV cell: quoted when it holds a comma, a quote or a line break. */
const csvCell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** The approver's fields as the decision schema reads them. */
export type DecisionExtras = ApprovalDetails

// --- building and moving requests ------------------------------------------------------------------

/** A fresh request through the type's flow, with "Requested" in its history. */
export function newStandardRecord(
  def: Pick<StandardKindServer<unknown>, 'kind' | 'settingsType'>,
  base: { id: string; code: string; employeeId: string; createdById: string },
  payload: Record<string, unknown>,
  at: string,
): StoredStandardRequest {
  const facts = Object.fromEntries(
    Object.entries(payload).filter(
      (entry): entry is [string, string | number | boolean] =>
        typeof entry[1] === 'string' ||
        typeof entry[1] === 'number' ||
        typeof entry[1] === 'boolean',
    ),
  )
  const plan = planFlow(base.employeeId, def.settingsType, facts)
  return {
    ...base,
    kind: def.kind,
    payload,
    status: 'pending',
    flow: plan.steps,
    consents: plan.consentIds.map((personId) => ({ personId, status: 'pending', remarks: null })),
    cancelReason: null,
    cancelStep: null,
    history: [
      historyEntry(base.createdById, 'Requested', null, at),
      ...plan.lookerIds.map((personId) => historyEntry(personId, 'Informed (On Looker)', null, at)),
    ],
    applied: null,
    createdAt: at,
    updatedAt: at,
  }
}

/** The person asks to cancel an approved request; the last approver of the cancel flow decides. */
export function requestStandardCancel(
  def: Pick<StandardKindServer<unknown>, 'settingsType'>,
  record: StoredStandardRequest,
  reason: string,
  at: string,
): StoredStandardRequest {
  const final: StoredStep | undefined =
    buildFlow(record.employeeId, `${def.settingsType}-cancel`).at(-1) ?? record.flow.at(-1)
  return {
    ...record,
    status: 'cancelling',
    cancelReason: reason,
    cancelStep: final
      ? { ...final, status: 'pending', actedById: null, actedAt: null, remarks: null }
      : null,
    updatedAt: at,
    history: [...record.history, historyEntry(ME, 'Cancellation requested', reason, at)],
  }
}

/**
 * A seed request taken to `status`: "approved" steps are decided by their
 * approvers (the first `approvedSteps`, or all for completed), then rejected,
 * cancelling or cancelled as asked.
 */
export function seedRequest(
  def: Pick<StandardKindServer<unknown>, 'kind' | 'settingsType'>,
  options: {
    id: string
    code: string
    employeeId: string
    payload: Record<string, unknown>
    at: string
    status?: RequestStatus
    /** Steps approved before the request stops (pending / rejected). */
    approvedSteps?: number
    remarks?: string
    cancelReason?: string
  },
): StoredStandardRequest {
  const status = options.status ?? 'pending'
  let record = newStandardRecord(
    def,
    {
      id: options.id,
      code: options.code,
      employeeId: options.employeeId,
      createdById: options.employeeId,
    },
    options.payload,
    options.at,
  )
  const later = (minutes: number) =>
    new Date(new Date(options.at).getTime() + minutes * 60_000).toISOString()
  const approve = (count: number) => {
    for (let index = 0; index < count; index += 1) {
      const step = currentStep(record)
      if (!step) break
      record = applyDecision(
        record,
        'approve',
        step.approverId,
        options.remarks ?? 'Fine by me.',
        later(60 * (index + 1)),
      ).record
    }
  }
  if (status === 'pending') approve(options.approvedSteps ?? 0)
  if (status === 'rejected') {
    approve(options.approvedSteps ?? 0)
    const step = currentStep(record)
    if (step) {
      record = applyDecision(
        record,
        'reject',
        step.approverId,
        options.remarks ?? 'Not this time.',
        later(180),
      ).record
    }
  }
  if (status === 'completed' || status === 'cancelling' || status === 'cancelled') {
    approve(record.flow.length)
  }
  if (status === 'cancelling' || status === 'cancelled') {
    record = requestStandardCancel(
      def,
      record,
      options.cancelReason ?? 'Plans changed.',
      later(300),
    )
  }
  if (status === 'cancelled' && record.cancelStep) {
    record = applyCancelDecision(
      record,
      'approve',
      record.cancelStep.approverId,
      'Cancelled as asked.',
      later(360),
    )
  }
  return record
}

// --- the handlers -----------------------------------------------------------------------------------

/** The type's input from a `RequestIn` body, before its own checks (`schema`, `toPayload`). */
const defaultFromBody = (body: RequestBodyIn) => ({
  ...body.details,
  reason: body.reason ?? '',
  description: body.description ?? '',
})

function defaultHeader(
  def: Pick<StandardKindServer<unknown>, 'dateOf'>,
  payload: Record<string, unknown>,
): RequestHeaderFields {
  const text = (key: string) => {
    const value = payload[key]
    return typeof value === 'string' ? value : null
  }
  const day = def.dateOf(payload)
  return {
    fromDate: day || null,
    toDate: day || null,
    days: null,
    reason: text('reason'),
    description: text('description'),
    application: text('application'),
  }
}

const isActive = (employeeId: string) => {
  const employee = findEmployee(employeeId)
  return employee ? profileOf(employee).status === 'active' : false
}

const conflict = (message: string) => errorResponse(409, message, { code: 'CONFLICT' })

const attachmentSchema = z.object({
  fileId: z.union([z.string(), z.number()]).transform(String),
  label: z.string().nullish(),
})

/** The type's own filters (beyond q, employee, department, branch, dates; read by `pageOf`). */
function matches<I>(def: StandardKindServer<I>, record: StoredStandardRequest, url: URL): boolean {
  for (const [name, value] of url.searchParams) {
    if (!value) continue
    const own = def.filters?.[name]
    if (own && !own(record, value)) return false
  }
  return true
}

/** Builds a type's endpoints over its share of the standard requests collection. */
export function createStandardHandlers<I>(
  def: StandardKindServer<I>,
  collection: MockCollection<StoredStandardRequest>,
): HttpHandler[] {
  const records = () => collection.all().filter((record) => record.kind === def.kind)
  const find = (id: unknown) => {
    const record = typeof id === 'string' ? collection.find(id) : undefined
    return record?.kind === def.kind ? record : undefined
  }
  const save = (record: StoredStandardRequest) => collection.update(record.id, record)

  const info = (record: StoredStandardRequest): SerializeInfo => ({
    typeCode: def.typeCode,
    typeName: def.typeName,
    kind: def.backendKind ?? def.typeCode,
    header: def.header ? def.header(record.payload, record) : defaultHeader(def, record.payload),
    details: (def.toDetails
      ? def.toDetails(record.payload, record)
      : def.present
        ? def.present(record.payload, record)
        : record.payload) as Record<string, unknown>,
  })

  const actionsFor = (record: StoredStandardRequest) => backendActions(record, def.typeCode)

  /** The records a list (or its export) shows: its view, then the type's own filters. */
  const inView = (url: URL) => {
    const view = url.searchParams.get('view') ?? 'my'
    const all = records()
    const shown =
      view === 'all'
        ? all
        : view === 'subordinates'
          ? all.filter((record) => record.employeeId !== ME)
          : all.filter((record) => record.employeeId === ME)
    return shown.filter((record) => matches(def, record, url))
  }

  registerApprovalSource({
    typeCode: def.typeCode,
    records,
    find: (id) => find(id),
    info: (record) => info(record as StoredStandardRequest),
    decide: (stored, decision, remarks, details) => {
      const record = stored as StoredStandardRequest
      const at = now()
      if (record.status === 'cancelling') {
        const next = applyCancelDecision(record, decision, ME, remarks, at)
        if (decision === 'approve') def.onCancelled?.(record)
        const out = decision === 'approve' ? { ...next, effect: undefined } : next
        save(out)
        return out
      }
      if (decision === 'approve' && def.approveNeedsRemarks && !remarks) {
        return invalid('Give a reason for approval.', { remarks: 'Give a reason for approval' })
      }
      let current = record
      if (decision === 'approve' && def.decision) {
        const extras = def.decision.schema.safeParse(details)
        if (!extras.success) return invalid('Fill in the approval fields.')
        const payload = def.decision.apply(record, extras.data)
        if (payload instanceof Response) return payload
        current = { ...record, payload }
      }
      const { record: next, completed } = applyDecision(current, decision, ME, remarks, at)
      const done = completed && def.onCompleted ? { ...next, effect: def.onCompleted(next) } : next
      save(done)
      return done
    },
    consent: (stored, agree, remarks) => {
      const record = stored as StoredStandardRequest
      const next = applyConsent(record, ME, agree ? 'approve' : 'reject', remarks, now())
      save(next)
      return next
    },
    forward: (stored, employeeId, remarks) => {
      const next = forwardRecord(stored as StoredStandardRequest, employeeId, remarks, now())
      save(next)
      return next
    },
  })

  const detail = (record: StoredStandardRequest, status = 200) =>
    HttpResponse.json<ApiItem<BackendRequestDetail>>(
      { data: serializeDetail(record, info(record)) },
      { status },
    )

  function nextCode(): string {
    const digits = def.codeDigits ?? 4
    const highest = records().reduce((max, record) => {
      const number = Number(record.code.slice(def.codePrefix.length))
      return Number.isFinite(number) ? Math.max(max, number) : max
    }, 0)
    return `${def.codePrefix}${String(highest + 1).padStart(digits, '0')}`
  }

  /** Reads a `RequestIn` body, checks the employee and the type's fields, and the restriction. */
  async function readInput(
    request: Request,
    employeeId: string | null,
    ignoreId: string | null,
  ): Promise<
    Response | { employeeId: string; payload: Record<string, unknown>; body: RequestBodyIn }
  > {
    const raw: unknown = await request.json().catch(() => null)
    const body = requestBodySchema.safeParse(raw)
    if (!body.success) return invalid('Some fields are not valid.')
    const parsed = def.schema.safeParse((def.fromBody ?? defaultFromBody)(body.data))
    if (!parsed.success) {
      const fieldErrors = Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
      )
      return invalid('Some fields are not valid.', fieldErrors)
    }
    const id = employeeId ?? body.data.employeeId ?? ME
    if (!isActive(id)) {
      return invalid('Choose an active employee.', { employeeId: 'Choose an active employee' })
    }
    const payload = def.toPayload(parsed.data, { employeeId: id, ignoreId, records: records() })
    if (payload instanceof Response) return payload
    const closed = restrictionFor(def.settingsType, def.dateOf(payload), id)
    if (closed) return invalid(closed, { fromDate: closed })
    return { employeeId: id, payload, body: body.data }
  }

  const path = (suffix = '') => base(`/${def.typeCode.replaceAll('_', '-')}${suffix}`)
  const guard = async (request: Request) => {
    await latency()
    return requireAuth(request)
  }

  return [
    ...(def.extraHandlers ?? []),

    // My / Subordinates / All: the mock user reaches everyone, so Subordinates is everyone else.
    http.get(path(), async ({ request }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      const url = new URL(request.url)
      return HttpResponse.json<BackendRequestPage>(
        pageOf(
          url,
          inView(url).map((record) => ({ row: serializeRequest(record, info(record)) })),
        ),
      )
    }),

    // The list's rows (its view and filters, every page) as CSV; registered before `/:id`.
    http.get(path('/export'), async ({ request }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      const url = new URL(request.url)
      const status = url.searchParams.get('status')
      const rows = inView(url)
        .map((record) => serializeRequest(record, info(record)))
        .filter((row) => matchesFilters(row, url) && (!status || row.status === status))
      const columns = [...SHARED_EXPORT_COLUMNS, ...(def.exportColumns ?? [])]
      const lines = [
        columns.map(([header]) => csvCell(header)).join(','),
        ...rows.map((row) => columns.map(([, value]) => csvCell(value(row))).join(',')),
      ]
      return new HttpResponse(lines.join('\n') + '\n', {
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      })
    }),

    http.get(path('/:id'), async ({ request, params }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      const record = find(params.id)
      return record ? detail(record) : notFound()
    }),

    http.post(path(), async ({ request }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      const input = await readInput(request, null, null)
      if (input instanceof Response) return input
      const at = now()
      const record: StoredStandardRequest = {
        ...newStandardRecord(
          def,
          {
            id: createId(def.codePrefix.replace(/[^A-Za-z]/g, '').toLowerCase() || 'rq'),
            code: nextCode(),
            employeeId: input.employeeId,
            createdById: ME,
          },
          input.payload,
          at,
        ),
        files: filesFrom(input.body.attachments, at),
      }
      collection.insert(record)
      return detail(record, 201)
    }),

    http.put(path('/:id'), async ({ request, params }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      const record = find(params.id)
      if (!record) return notFound()
      if (!actionsFor(record).includes('edit')) {
        return conflict(
          'An approver has already acted on this request, so it can no longer be edited.',
        )
      }
      const input = await readInput(request, record.employeeId, record.id)
      if (input instanceof Response) return input
      const stale = staleRow(record, input.body.rowVersion)
      if (stale) return stale
      const at = now()
      const next: StoredStandardRequest = {
        ...record,
        payload: input.payload,
        updatedAt: at,
        history: [...record.history, historyEntry(ME, 'Edited', null, at)],
      }
      save(next)
      return detail(next)
    }),

    http.delete(path('/:id'), async ({ request, params }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
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
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
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
          : requestStandardCancel(def, record, parsed.data.reason, at)
      save(next)
      return detail(next)
    }),

    http.post(path('/:id/attachments'), async ({ request, params }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      const record = find(params.id)
      if (!record) return notFound()
      const parsed = await readBody(request, attachmentSchema)
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
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
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

/** A type ready for the mock server: its seeds and its endpoints over the shared table. */
export interface StandardKindModule {
  kind: MockStandardKind
  seed: () => StoredStandardRequest[]
  handlers: (collection: MockCollection<StoredStandardRequest>) => HttpHandler[]
}

export function defineStandardKind<I>(def: StandardKindServer<I>): StandardKindModule {
  return {
    kind: def.kind,
    seed: def.seed,
    handlers: (collection) => createStandardHandlers(def, collection),
  }
}
