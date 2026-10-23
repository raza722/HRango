import { http, type HttpHandler, HttpResponse } from 'msw'
import { z } from 'zod'

import type {
  RequestAction,
  RequestDetail,
  RequestPage,
  RequestStatus,
  SettingsRequestType,
  StandardKind,
  StandardLookups,
  StandardRequest,
} from '@/features/requests'
import type { ApiItem } from '@/types/api'

import type { MockCollection } from '../../collection'
import { DIRECTORY, findEmployee } from '../../employees/seed'
import { profileOf } from '../../scheduling/seed'
import { createId, latency, paginate, readPageParams, requireAuth } from '../../utils'
import {
  applyCancelDecision,
  applyDecision,
  buildFlow,
  currentStep,
  historyEntry,
  planFlow,
  type StoredPunchRequest,
  type StoredStep,
} from '../flow'
import { base, countsOf, forbidden, invalid, notFound, now, readBody, text, toStep } from '../http'
import { delegatorsOf, ME, mustFind, ref, requestEmployee } from '../people'
import { restrictionFor } from '../settings-db'

/*
 * The standard request types (Leave, Loan & Advances, Work From Home,
 * Promotion, Relaxation, Rest Days, Travel, Resignation) share one REST shape,
 * the same as Transfer's:
 *   GET  /requests/<kind>             ?scope=my|all&status&page&pageSize&<filters>
 *   GET  /requests/<kind>/approvals   ?view=requested|cancellations|delegates…
 *   GET  /requests/<kind>/lookups
 *   GET  /requests/<kind>/:id         the request and its history
 *   POST /requests/<kind>             PUT/DELETE /requests/<kind>/:id
 *   POST /requests/<kind>/:id/decision  { decision, remarks, extras? }
 *   POST /requests/<kind>/:id/cancel    { reason }
 * A type supplies its definition (`StandardKindServer`): how to check and
 * store its fields, its filters, look-ups, seeds and what approval changes.
 */

/** A stored request of a standard type; `effect` remembers what its approval changed. */
export type StoredStandardRequest = Omit<StoredPunchRequest, 'kind' | 'payload' | 'applied'> & {
  kind: StandardKind
  payload: Record<string, unknown>
  applied: null
  effect?: unknown
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
  kind: StandardKind
  /** The type in Requests → Settings: flows, delegations and restrictions. */
  settingsType: SettingsRequestType
  /** "RD-" → RD-0001. */
  codePrefix: string
  codeDigits?: number
  /** The request body, without `employeeId` (added by the engine). */
  schema: z.ZodType<I>
  /** Checks the fields and returns what to store, or an error response (`invalid(…)`). */
  toPayload: (input: I, context: PayloadContext) => Response | Record<string, unknown>
  /** The day Request Restriction checks, and the From / To filters read. */
  dateOf: (payload: Record<string, unknown>) => string
  /** The payload as the client sees it (names for ids…); stored payload if left out. */
  present?: (payload: Record<string, unknown>, record: StoredStandardRequest) => object
  /** Filters dialog fields → tests, beyond the shared employee / department / status / dates. */
  filters?: Record<string, (record: StoredStandardRequest, value: string) => boolean>
  /** The type's own look-ups (`extra` in GET /lookups). */
  lookups?: (employeeId: string) => object
  /** Fields the approver fills in (Loan & Advances); returns the new payload or an error. */
  decision?: {
    schema: z.ZodType<Record<string, unknown>>
    apply: (
      record: StoredStandardRequest,
      extras: Record<string, unknown>,
    ) => Response | Record<string, unknown>
  }
  /** "Reason for Approval *" (Relaxation). */
  approveNeedsRemarks?: boolean
  /** Cancellations have their own Approvals view; otherwise they show under Requested. */
  cancellationsView?: boolean
  /** Runs when the last approver approves; what it returns is kept to undo it. */
  onCompleted?: (record: StoredStandardRequest) => unknown
  /** Runs when a cancellation is approved, with what `onCompleted` returned. */
  onCancelled?: (record: StoredStandardRequest) => void
  /** Seed requests (use `seedRequest`). */
  seed: () => StoredStandardRequest[]
  /** Endpoints of the type's own (Loan & Advances → Settings…), registered before the shared ones. */
  extraHandlers?: HttpHandler[]
}

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

const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  remarks: text,
  extras: z.record(z.string(), z.unknown()).optional(),
})

const cancelSchema = z.object({ reason: z.string().trim().min(1).max(500) })

const departments = () => [...new Set(DIRECTORY.map((employee) => employee.department))].sort()
const isActive = (employeeId: string) => {
  const employee = findEmployee(employeeId)
  return employee ? profileOf(employee).status === 'active' : false
}

/** The shared filters; a type adds its own. */
const SHARED_FILTERS: Record<
  string,
  (
    record: StoredStandardRequest,
    value: string,
    def: Pick<StandardKindServer<unknown>, 'dateOf'>,
  ) => boolean
> = {
  employeeId: (record, value) => record.employeeId === value,
  department: (record, value) => mustFind(record.employeeId).department === value,
  employmentStatus: (record, value) =>
    value === 'all' || profileOf(mustFind(record.employeeId)).status === value,
  delegatorId: (record, value) => record.flow.some((step) => step.approverId === value),
  nextRequesteeId: (record, value) => currentStep(record)?.approverId === value,
  from: (record, value, def) => def.dateOf(record.payload) >= value,
  to: (record, value, def) => def.dateOf(record.payload) <= value,
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

  const mayDecideFor = (approverId: string) =>
    approverId === ME || delegatorsOf(ME, def.settingsType).includes(approverId)

  function actionsFor(record: StoredStandardRequest): RequestAction[] {
    const mine = record.employeeId === ME || record.createdById === ME
    const untouched = record.flow.every(
      (step) => step.status === 'pending' || step.status === 'waiting',
    )
    const step = currentStep(record)
    const actions: RequestAction[] = ['view', 'flow', 'history']
    if (record.status === 'pending' && mine && untouched) actions.push('edit', 'delete')
    if (record.status === 'completed' && mine) actions.push('cancel')
    if (step && record.employeeId !== ME && mayDecideFor(step.approverId)) actions.push('decide')
    return actions
  }

  function serialize(record: StoredStandardRequest): StandardRequest {
    const step = currentStep(record)
    return {
      id: record.id,
      code: record.code,
      kind: record.kind,
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
      payload: (def.present ? def.present(record.payload, record) : record.payload) as Record<
        string,
        unknown
      >,
    }
  }

  function matches(record: StoredStandardRequest, url: URL): boolean {
    for (const [name, value] of url.searchParams) {
      if (!value) continue
      const own = def.filters?.[name]
      if (own) {
        if (!own(record, value)) return false
        continue
      }
      const shared = SHARED_FILTERS[name]
      if (shared && !shared(record, value, def)) return false
    }
    return true
  }

  function listResponse(url: URL, list: StoredStandardRequest[]) {
    const status = url.searchParams.get('status')
    const { page, pageSize } = readPageParams(url)
    const sorted = list
      .filter((record) => matches(record, url))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const filtered = status ? sorted.filter((record) => record.status === status) : sorted
    const result = paginate(filtered, page, pageSize)
    return HttpResponse.json<RequestPage<StandardRequest>>({
      ...result,
      data: result.data.map(serialize),
      counts: countsOf(sorted),
    })
  }

  const item = (record: StoredStandardRequest) =>
    HttpResponse.json<ApiItem<StandardRequest>>({ data: serialize(record) })

  function nextCode(): string {
    const digits = def.codeDigits ?? 4
    const highest = records().reduce((max, record) => {
      const number = Number(record.code.slice(def.codePrefix.length))
      return Number.isFinite(number) ? Math.max(max, number) : max
    }, 0)
    return `${def.codePrefix}${String(highest + 1).padStart(digits, '0')}`
  }

  /** Reads the body, checks the employee and the type's fields, and the restriction. */
  async function readInput(
    request: Request,
    employeeId: string | null,
    ignoreId: string | null,
  ): Promise<Response | { employeeId: string; payload: Record<string, unknown> }> {
    const body: unknown = await request.json().catch(() => null)
    const who = z.object({ employeeId: z.string().min(1).optional() }).safeParse(body)
    const parsed = def.schema.safeParse(body)
    if (!parsed.success || !who.success) return invalid('Some fields are not valid.')
    const id = employeeId ?? who.data.employeeId ?? ME
    if (!isActive(id)) {
      return invalid('Choose an active employee.', { employeeId: 'Choose an active employee' })
    }
    const payload = def.toPayload(parsed.data, {
      employeeId: id,
      ignoreId,
      records: records(),
    })
    if (payload instanceof Response) return payload
    const closed = restrictionFor(def.settingsType, def.dateOf(payload), id)
    if (closed) return invalid(closed)
    return { employeeId: id, payload }
  }

  const path = (suffix = '') => base(`/${def.kind}${suffix}`)
  const guard = async (request: Request) => {
    await latency()
    return requireAuth(request)
  }

  return [
    ...(def.extraHandlers ?? []),

    http.get(path('/lookups'), async ({ request }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name)
      const people = DIRECTORY.map((employee) => ({
        ...ref(employee.id),
        department: employee.department,
        designation: employee.jobTitle,
        active: profileOf(employee).status === 'active',
      })).sort(byName)
      const me = people.find((person) => person.id === ME)
      if (!me) return notFound()
      return HttpResponse.json<ApiItem<StandardLookups<object>>>({
        data: {
          me,
          employees: people,
          departments: departments(),
          delegators: delegatorsOf(ME, def.settingsType).map(ref),
          extra: def.lookups ? def.lookups(ME) : {},
        },
      })
    }),

    http.get(path(), async ({ request }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      const url = new URL(request.url)
      const all = records()
      const scope = url.searchParams.get('scope') ?? 'my'
      return listResponse(
        url,
        scope === 'all' ? all : all.filter((record) => record.employeeId === ME),
      )
    }),

    http.get(path('/approvals'), async ({ request }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      const url = new URL(request.url)
      const view = url.searchParams.get('view') ?? 'requested'
      const approvers = view === 'delegates' ? delegatorsOf(ME, def.settingsType) : [ME]
      const reached = (step: StoredStep | null) =>
        step !== null &&
        approvers.includes(step.approverId) &&
        // Reached you: not still waiting, nor skipped because an earlier approver rejected it.
        step.status !== 'waiting' &&
        step.status !== 'skipped'
      const list = records().filter((record) => {
        if (record.employeeId === ME) return false
        if (view === 'cancellations') return reached(record.cancelStep)
        const steps = def.cancellationsView
          ? record.flow
          : [...record.flow, ...(record.cancelStep ? [record.cancelStep] : [])]
        return steps.some(reached)
      })
      return listResponse(url, list)
    }),

    http.get(path('/:id'), async ({ request, params }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      const record = find(params.id)
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
      return HttpResponse.json<ApiItem<RequestDetail<StandardRequest>>>({
        data: { request: serialize(record), history },
      })
    }),

    http.post(path(), async ({ request }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      const input = await readInput(request, null, null)
      if (input instanceof Response) return input
      const record = newStandardRecord(
        def,
        {
          id: createId(def.codePrefix.replace(/[^A-Za-z]/g, '').toLowerCase() || 'rq'),
          code: nextCode(),
          employeeId: input.employeeId,
          createdById: ME,
        },
        input.payload,
        now(),
      )
      collection.insert(record)
      return item(record)
    }),

    http.put(path('/:id'), async ({ request, params }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      const record = find(params.id)
      if (!record) return notFound()
      if (!actionsFor(record).includes('edit')) {
        return forbidden('Only a pending request nobody has acted on can be edited.')
      }
      const input = await readInput(request, record.employeeId, record.id)
      if (input instanceof Response) return input
      const at = now()
      const next: StoredStandardRequest = {
        ...record,
        payload: input.payload,
        updatedAt: at,
        history: [...record.history, historyEntry(ME, 'Edited', null, at)],
      }
      save(next)
      return item(next)
    }),

    http.delete(path('/:id'), async ({ request, params }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      const record = find(params.id)
      if (!record) return notFound()
      if (!actionsFor(record).includes('delete')) {
        return forbidden('Only a pending request nobody has acted on can be deleted.')
      }
      collection.remove(record.id)
      return new HttpResponse(null, { status: 204 })
    }),

    http.post(path('/:id/decision'), async ({ request, params }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      const record = find(params.id)
      if (!record) return notFound()
      if (!actionsFor(record).includes('decide')) {
        return forbidden('This request is not waiting for your decision.')
      }
      const parsed = await readBody(request, decisionSchema)
      if (!parsed.success) return invalid('Some fields are not valid.')
      const { decision } = parsed.data
      const remarks = parsed.data.remarks || null
      const at = now()
      if (record.status === 'cancelling') {
        if (decision === 'reject' && !remarks) {
          return invalid('Give a reason for rejecting.', { remarks: 'Give a reason for rejecting' })
        }
        const next = applyCancelDecision(record, decision, ME, remarks, at)
        if (decision === 'approve') def.onCancelled?.(record)
        save(decision === 'approve' ? { ...next, effect: undefined } : next)
        return item(next)
      }
      if (decision === 'reject' && !remarks) {
        return invalid('Give a reason for rejecting.', { remarks: 'Give a reason for rejecting' })
      }
      if (decision === 'approve' && def.approveNeedsRemarks && !remarks) {
        return invalid('Give a reason for approval.', { remarks: 'Give a reason for approval' })
      }
      let current = record
      if (decision === 'approve' && def.decision) {
        const extras = def.decision.schema.safeParse(parsed.data.extras ?? {})
        if (!extras.success) return invalid('Fill in the approval fields.')
        const payload = def.decision.apply(record, extras.data)
        if (payload instanceof Response) return payload
        current = { ...record, payload }
      }
      const { record: next, completed } = applyDecision(current, decision, ME, remarks, at)
      const done = completed && def.onCompleted ? { ...next, effect: def.onCompleted(next) } : next
      save(done)
      return item(done)
    }),

    http.post(path('/:id/cancel'), async ({ request, params }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      const record = find(params.id)
      if (!record) return notFound()
      if (!actionsFor(record).includes('cancel')) {
        return forbidden('Only your approved requests can be cancelled.')
      }
      const parsed = await readBody(request, cancelSchema)
      if (!parsed.success) {
        return invalid('Give a reason for cancellation.', {
          reason: 'Give a reason for cancellation',
        })
      }
      const next = requestStandardCancel(def, record, parsed.data.reason, now())
      save(next)
      return item(next)
    }),
  ]
}

/** A type ready for the mock server: its seeds and its endpoints over the shared table. */
export interface StandardKindModule {
  kind: StandardKind
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
