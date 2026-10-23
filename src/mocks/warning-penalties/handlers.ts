import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  BADGE_COLORS,
  DEDUCTIONS,
  PENALTY_TYPES,
  POLICY_NAMES,
  SCALE_TYPES,
  TIME_SPANS,
  type WarningPenalty,
  type WarningPenaltyInput,
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
import { seedWarningPenalties } from './seed'

export const warningPenalties = createMockCollection<WarningPenalty>({
  storageKey: 'hrms-mock-warning-penalties',
  seed: seedWarningPenalties,
})

const penaltyInputSchema = z.object({
  policyName: z.enum(POLICY_NAMES),
  title: z.string().trim().min(2).max(60),
  scaleType: z.enum(SCALE_TYPES),
  rules: z
    .array(
      z.object({
        count: z.number().int().min(1).max(10),
        timeSpan: z.enum(TIME_SPANS),
        startDay: z.string().min(1),
        endDay: z.string().min(1),
        day: z.number().int().min(1).max(31),
        weekdays: z.array(z.enum(WEEKDAYS)),
        from: z.string().regex(/^\d{2}:\d{2}$/),
        to: z.string().regex(/^\d{2}:\d{2}$/),
        points: z.number().int().min(0).max(999),
        penaltyType: z.enum(PENALTY_TYPES),
        deduction: z.enum(DEDUCTIONS),
        badgeColor: z.enum(BADGE_COLORS),
      }),
    )
    .min(1),
}) satisfies z.ZodType<WarningPenaltyInput>

const BASE = apiPath('/warning-penalties')

/** Same policy name + title (case-insensitive) counts as a duplicate. */
function isDuplicate(input: WarningPenaltyInput, exceptId?: string): boolean {
  const title = input.title.trim().toLowerCase()
  return warningPenalties
    .all()
    .some(
      (penalty) =>
        penalty.id !== exceptId &&
        penalty.policyName === input.policyName &&
        penalty.title.toLowerCase() === title,
    )
}

function duplicateResponse() {
  return errorResponse(409, 'A penalty with this policy name and title already exists.', {
    code: 'PENALTY_DUPLICATE',
    fieldErrors: { title: 'Choose a different title for this policy' },
  })
}

async function readInput(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  return penaltyInputSchema.safeParse(body)
}

export const warningPenaltyHandlers = [
  http.get(BASE, async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized

    const { page, pageSize } = readPageParams(new URL(request.url))
    const sorted = warningPenalties.all().sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return HttpResponse.json<Paginated<WarningPenalty>>(paginate(sorted, page, pageSize))
  }),

  http.get<{ id: string }>(`${BASE}/:id`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized

    const penalty = warningPenalties.find(params.id)
    if (!penalty) return errorResponse(404, 'Penalty not found.', { code: 'NOT_FOUND' })
    return HttpResponse.json<ApiItem<WarningPenalty>>({ data: penalty })
  }),

  http.post(BASE, async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized

    const parsed = await readInput(request)
    if (!parsed.success) {
      return errorResponse(422, 'Some fields are not valid.', { code: 'VALIDATION_FAILED' })
    }
    if (isDuplicate(parsed.data)) return duplicateResponse()

    const now = new Date().toISOString()
    const penalty = warningPenalties.insert({
      ...parsed.data,
      id: createId('pn'),
      createdAt: now,
      updatedAt: now,
    })
    recordHistory('penalty', 'created', penalty)
    return HttpResponse.json<ApiItem<WarningPenalty>>({ data: penalty }, { status: 201 })
  }),

  http.put<{ id: string }>(`${BASE}/:id`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized

    const existing = warningPenalties.find(params.id)
    if (!existing) return errorResponse(404, 'Penalty not found.', { code: 'NOT_FOUND' })

    const parsed = await readInput(request)
    if (!parsed.success) {
      return errorResponse(422, 'Some fields are not valid.', { code: 'VALIDATION_FAILED' })
    }
    if (isDuplicate(parsed.data, existing.id)) return duplicateResponse()

    const updated: WarningPenalty = {
      ...existing,
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    }
    warningPenalties.update(existing.id, updated)
    recordHistory('penalty', 'updated', updated)
    return HttpResponse.json<ApiItem<WarningPenalty>>({ data: updated })
  }),

  http.delete<{ id: string }>(`${BASE}/:id`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized

    const existing = warningPenalties.find(params.id)
    if (!existing || !warningPenalties.remove(params.id)) {
      return errorResponse(404, 'Penalty not found.', { code: 'NOT_FOUND' })
    }
    recordHistory('penalty', 'deleted', existing)
    return new HttpResponse(null, { status: 204 })
  }),
]
