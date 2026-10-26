import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  CLOCK_EVENTS,
  CLOCK_EVENTS_FOR,
  POLICY_NAMES,
  TIME_SPANS,
  WEEKDAYS,
} from '@/features/warning'
import type { ApiItem, Paginated } from '@/types/api'

import { apiPath, errorResponse, latency, paginate, readPageParams, requireAuth } from '../utils'
import { recordHistory, renameInHistory } from '../warning-history/handlers'
import {
  newRowVersion,
  nextId,
  type PolicyRecord,
  presentPolicy,
  serverNow,
  warningPenalties,
  warningPolicies,
} from './store'

export { warningPolicies } from './store'

/** `WarningPolicyIn`, checked as the API does (pydantic, then the service's rules). */
const policyInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  appliesTo: z.enum(POLICY_NAMES),
  period: z.enum(TIME_SPANS),
  graceMinutes: z.number().int().min(0).max(100000).nullable().optional(),
  weekStartDay: z.enum(WEEKDAYS).nullable().optional(),
  weekEndDay: z.enum(WEEKDAYS).nullable().optional(),
  isActive: z.boolean().optional(),
  rules: z
    .array(
      z.object({
        clockEvent: z.enum(CLOCK_EVENTS),
        minutes: z.number().int().min(0).max(1440).optional(),
        occurrenceCount: z.number().int().min(1).max(100).optional(),
      }),
    )
    .min(1)
    .max(2),
  rowVersion: z.string().nullable().optional(),
})
type PolicyInput = z.infer<typeof policyInputSchema>

const BASE = apiPath('/warning/policies')

function invalid(fieldErrors: Record<string, string>) {
  return errorResponse(422, 'Some fields need your attention.', {
    code: 'VALIDATION_FAILED',
    fieldErrors,
  })
}

export function notFound() {
  return errorResponse(404, 'Warning policy not found', { code: 'NOT_FOUND' })
}

export function changedByOthers() {
  return errorResponse(409, 'Someone else changed this warning policy. Reload it and try again', {
    code: 'CONFLICT',
  })
}

/** The service's checks: clock events that suit the policy, one per event. */
function ruleErrors(input: PolicyInput): Record<string, string> {
  const errors: Record<string, string> = {}
  const events = input.rules.map((rule) => rule.clockEvent)
  if (new Set(events).size !== events.length) errors.rules = 'One rule per clock event.'
  input.rules.forEach((rule, index) => {
    if (!CLOCK_EVENTS_FOR[input.appliesTo].includes(rule.clockEvent)) {
      errors[`rules.${index}.clockEvent`] =
        'This clock event does not apply to what the policy watches.'
    }
  })
  if (input.appliesTo === 'half_day_leave' && input.rules.length > 1) {
    errors.rules = 'A half-day leave policy has one rule.'
  }
  return errors
}

function isDuplicate(title: string, exceptId?: string) {
  const wanted = title.trim().toLowerCase()
  return warningPolicies
    .all()
    .some((policy) => policy.id !== exceptId && policy.title.toLowerCase() === wanted)
}

function duplicate() {
  const message = 'A warning policy with this title already exists.'
  return errorResponse(409, message, {
    code: 'WARNING_POLICY_DUPLICATE',
    fieldErrors: { title: message },
  })
}

async function readInput(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  return policyInputSchema.safeParse(body)
}

/** The stored fields an input sets (week days only for weekly policies). */
function fromInput(input: PolicyInput) {
  const weekly = input.period === 'week'
  return {
    title: input.title.trim(),
    appliesTo: input.appliesTo,
    period: input.period,
    graceMinutes: input.graceMinutes ?? null,
    weekStartDay: weekly ? (input.weekStartDay ?? 'mon') : null,
    weekEndDay: weekly ? (input.weekEndDay ?? null) : null,
    isActive: input.isActive ?? true,
    rules: input.rules.map((rule) => ({
      clockEvent: rule.clockEvent,
      minutes: rule.minutes ?? 0,
      occurrenceCount: rule.occurrenceCount ?? 1,
    })),
  }
}

/** Audit-log keys are the table's columns. */
const AUDIT_FIELDS = {
  title: 'title',
  appliesTo: 'applies_to',
  period: 'period',
  graceMinutes: 'grace_minutes',
  weekStartDay: 'week_start_day',
  weekEndDay: 'week_end_day',
  isActive: 'is_active',
  rules: 'rules',
} as const

function asText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function presented(record: PolicyRecord) {
  return presentPolicy(record)
}

export const warningPolicyHandlers = [
  http.get(BASE, async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized

    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const appliesTo = url.searchParams.get('appliesTo')
    const { page, pageSize } = readPageParams(url)
    const rows = warningPolicies
      .all()
      .filter((policy) => !q || policy.title.toLowerCase().includes(q))
      .filter((policy) => !appliesTo || policy.appliesTo === appliesTo)
      .sort((a, b) => Number(a.id) - Number(b.id))
    const result = paginate(rows, page, pageSize)
    return HttpResponse.json<Paginated<ReturnType<typeof presented>>>({
      ...result,
      data: result.data.map(presented),
    })
  }),

  http.get<{ id: string }>(`${BASE}/:id`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized

    const policy = warningPolicies.find(params.id)
    if (!policy) return notFound()
    return HttpResponse.json<ApiItem<ReturnType<typeof presented>>>({ data: presented(policy) })
  }),

  http.post(BASE, async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized

    const parsed = await readInput(request)
    if (!parsed.success) return invalid({})
    const errors = ruleErrors(parsed.data)
    if (Object.keys(errors).length > 0) return invalid(errors)
    if (isDuplicate(parsed.data.title)) return duplicate()

    const record: PolicyRecord = {
      id: nextId(warningPolicies.all()),
      ...fromInput(parsed.data),
      warningCount: 0,
      createdAt: serverNow(),
      updatedAt: null,
      rowVersion: newRowVersion(),
    }
    warningPolicies.insert(record)
    recordHistory('create', record, 'title', null, record.title)
    return HttpResponse.json({ data: presented(record) }, { status: 201 })
  }),

  http.put<{ id: string }>(`${BASE}/:id`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized

    const parsed = await readInput(request)
    if (!parsed.success) return invalid({})
    const existing = warningPolicies.find(params.id)
    if (!existing) return notFound()
    const errors = ruleErrors(parsed.data)
    if (Object.keys(errors).length > 0) return invalid(errors)
    if (isDuplicate(parsed.data.title, existing.id)) return duplicate()
    if (!parsed.data.rowVersion) {
      return errorResponse(422, 'rowVersion is required to edit a warning policy', {
        code: 'VALIDATION_FAILED',
      })
    }
    if (parsed.data.rowVersion !== existing.rowVersion) return changedByOthers()

    const updated: PolicyRecord = {
      ...existing,
      ...fromInput(parsed.data),
      updatedAt: serverNow(),
      rowVersion: newRowVersion(),
    }
    warningPolicies.update(existing.id, updated)
    for (const [key, column] of Object.entries(AUDIT_FIELDS)) {
      const before = asText(existing[key as keyof typeof AUDIT_FIELDS])
      const after = asText(updated[key as keyof typeof AUDIT_FIELDS])
      if (before !== after) recordHistory('update', updated, column, before, after)
    }
    if (existing.title !== updated.title) renameInHistory(updated.id, updated.title)
    return HttpResponse.json({ data: presented(updated) })
  }),

  http.delete<{ id: string }>(`${BASE}/:id`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized

    const existing = warningPolicies.find(params.id)
    if (!existing) return notFound()
    const rowVersion = new URL(request.url).searchParams.get('rowVersion')
    if (!rowVersion) {
      return errorResponse(422, 'rowVersion is required.', {
        code: 'VALIDATION_FAILED',
        fieldErrors: { rowVersion: 'Required.' },
      })
    }
    if (rowVersion !== existing.rowVersion) return changedByOthers()
    if (existing.warningCount > 0) {
      return errorResponse(
        409,
        'Warnings have been raised under this policy. Make it inactive instead',
        { code: 'CONFLICT' },
      )
    }
    warningPenalties
      .all()
      .filter((penalty) => penalty.warningPolicyId === existing.id)
      .forEach((penalty) => warningPenalties.remove(penalty.id))
    warningPolicies.remove(existing.id)
    recordHistory('delete', existing, 'title', existing.title, null)
    return new HttpResponse(null, { status: 204 })
  }),

  // Warnings raised from processed time sheets: none in the mock (attendance is simulated apart).
  http.get(apiPath('/warning/warnings'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const { page, pageSize } = readPageParams(new URL(request.url))
    return HttpResponse.json(paginate([], page, pageSize))
  }),

  http.post(apiPath('/warning/warnings/process'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const body = (await request.json().catch(() => null)) as {
      fromDate?: string
      toDate?: string
    } | null
    if (!body?.fromDate || !body.toDate) return invalid({ fromDate: 'Field required' })
    if (body.toDate < body.fromDate) {
      return invalid({ toDate: 'The end date must be on or after the start date.' })
    }
    return HttpResponse.json({
      data: {
        raised: 0,
        penalised: 0,
        fromDate: `${body.fromDate.slice(0, 4)}-01-01`,
        toDate: `${body.toDate.slice(0, 4)}-12-31`,
      },
    })
  }),
]
