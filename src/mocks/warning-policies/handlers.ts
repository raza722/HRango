import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  CLOCK_EVENTS,
  POLICY_NAMES,
  TIME_SPANS,
  type WarningPolicy,
  type WarningPolicyInput,
  WEEKDAYS,
} from '@/features/warning'
import type { ApiItem, Paginated } from '@/types/api'

import { createMockCollection } from '../collection'
import {
  apiPath,
  createId,
  errorResponse,
  latency,
  paginate,
  readPageParams,
  requireAuth,
} from '../utils'
import { recordHistory } from '../warning-history/handlers'
import { seedWarningPolicies } from './seed'

export const warningPolicies = createMockCollection<WarningPolicy>({
  storageKey: 'hrms-mock-warning-policies',
  seed: seedWarningPolicies,
})

/** Server-side contract check, independent of the form schema (as a real API would be). */
const policyInputSchema = z.object({
  policyName: z.enum(POLICY_NAMES),
  title: z.string().trim().min(2).max(60),
  timeSpan: z.enum(TIME_SPANS),
  clockEvent: z.enum(CLOCK_EVENTS),
  periods: z
    .array(
      z.object({
        startDay: z.string().min(1),
        endDay: z.string().min(1),
        month: z.number().int().min(0).max(11).nullable(),
        day: z.number().int().min(1).max(31),
        weekdays: z.array(z.enum(WEEKDAYS)),
        totalGraceMinutes: z.number().int().min(0),
        clockIn: z.string().regex(/^\d{2}:\d{2}$/),
        clockOut: z.string().regex(/^\d{2}:\d{2}$/),
        minutes: z.number().int().min(0),
      }),
    )
    .min(1),
}) satisfies z.ZodType<WarningPolicyInput>

const BASE = apiPath('/warning-policies')

/** Same policy name + span + title (case-insensitive) counts as a duplicate. */
function findDuplicate(input: WarningPolicyInput, exceptId?: string) {
  const title = input.title.trim().toLowerCase()
  return warningPolicies
    .all()
    .find(
      (policy) =>
        policy.id !== exceptId &&
        policy.policyName === input.policyName &&
        policy.timeSpan === input.timeSpan &&
        policy.title.toLowerCase() === title,
    )
}

function duplicateResponse() {
  return errorResponse(409, 'A policy with this name, time span and title already exists.', {
    code: 'POLICY_DUPLICATE',
    fieldErrors: { title: 'Choose a different title for this policy and time span' },
  })
}

async function readInput(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  return policyInputSchema.safeParse(body)
}

export const warningPolicyHandlers = [
  http.get(BASE, async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized

    const { page, pageSize } = readPageParams(new URL(request.url))
    const sorted = warningPolicies.all().sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return HttpResponse.json<Paginated<WarningPolicy>>(paginate(sorted, page, pageSize))
  }),

  http.get<{ id: string }>(`${BASE}/:id`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized

    const policy = warningPolicies.find(params.id)
    if (!policy) return errorResponse(404, 'Policy not found.', { code: 'NOT_FOUND' })
    return HttpResponse.json<ApiItem<WarningPolicy>>({ data: policy })
  }),

  http.post(BASE, async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized

    const parsed = await readInput(request)
    if (!parsed.success) {
      return errorResponse(422, 'Some fields are not valid.', { code: 'VALIDATION_FAILED' })
    }
    if (findDuplicate(parsed.data)) return duplicateResponse()

    const now = new Date().toISOString()
    const policy = warningPolicies.insert({
      ...parsed.data,
      id: createId('wp'),
      createdAt: now,
      updatedAt: now,
    })
    recordHistory('policy', 'created', policy)
    return HttpResponse.json<ApiItem<WarningPolicy>>({ data: policy }, { status: 201 })
  }),

  http.put<{ id: string }>(`${BASE}/:id`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized

    const existing = warningPolicies.find(params.id)
    if (!existing) return errorResponse(404, 'Policy not found.', { code: 'NOT_FOUND' })

    const parsed = await readInput(request)
    if (!parsed.success) {
      return errorResponse(422, 'Some fields are not valid.', { code: 'VALIDATION_FAILED' })
    }
    if (findDuplicate(parsed.data, existing.id)) return duplicateResponse()

    const updated: WarningPolicy = {
      ...existing,
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    }
    warningPolicies.update(existing.id, updated)
    recordHistory('policy', 'updated', updated)
    return HttpResponse.json<ApiItem<WarningPolicy>>({ data: updated })
  }),

  http.delete<{ id: string }>(`${BASE}/:id`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized

    const existing = warningPolicies.find(params.id)
    if (!existing || !warningPolicies.remove(params.id)) {
      return errorResponse(404, 'Policy not found.', { code: 'NOT_FOUND' })
    }
    recordHistory('policy', 'deleted', existing)
    return new HttpResponse(null, { status: 204 })
  }),
]
