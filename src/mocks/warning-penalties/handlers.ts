import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import { DEDUCTIONS, PENALTY_TYPES, type WarningPenalty } from '@/features/warning'
import type { Paginated } from '@/types/api'

import { leaveTypes } from '../leaves/db'
import { apiPath, errorResponse, latency, paginate, readPageParams, requireAuth } from '../utils'
import { recordHistory } from '../warning-history/handlers'
import { changedByOthers, notFound } from '../warning-policies/handlers'
import {
  newRowVersion,
  nextId,
  type PenaltyRecord,
  presentPolicy,
  serverNow,
  warningPenalties,
  warningPolicies,
} from '../warning-policies/store'

export { warningPenalties } from '../warning-policies/store'

/** `PenaltiesIn`. */
const penaltiesInputSchema = z.object({
  penalties: z
    .array(
      z.object({
        afterCount: z.number().int().min(1).max(100),
        period: z.enum(['week', 'month', 'year']),
        penaltyType: z.enum(PENALTY_TYPES),
        percentage: z.number().gt(0).max(100).nullable().optional(),
        deduction: z.enum(DEDUCTIONS),
        leaveTypeId: z.union([z.string(), z.number()]).nullable().optional(),
      }),
    )
    .max(50),
  rowVersion: z.string().nullable().optional(),
})

const SHARE = { half_day: 50, full_day: 100 } as const

/** Penalty rows in the list's order: by policy, then period and count. */
function listRows(policyId: string | null): WarningPenalty[] {
  const policies = new Map(warningPolicies.all().map((policy) => [policy.id, policy]))
  return warningPenalties
    .all()
    .filter((penalty) => !policyId || penalty.warningPolicyId === policyId)
    .flatMap((penalty) => {
      const policy = policies.get(penalty.warningPolicyId)
      return policy ? [{ ...penalty, policyTitle: policy.title, appliesTo: policy.appliesTo }] : []
    })
    .sort(
      (a, b) =>
        Number(a.warningPolicyId) - Number(b.warningPolicyId) ||
        a.period.localeCompare(b.period) ||
        a.afterCount - b.afterCount,
    )
}

export const warningPenaltyHandlers = [
  // GET /warning/penalties?policyId= — every penalty rule with its policy.
  http.get(apiPath('/warning/penalties'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized

    const url = new URL(request.url)
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json<Paginated<WarningPenalty>>(
      paginate(listRows(url.searchParams.get('policyId')), page, pageSize),
    )
  }),

  // PUT /warning/policies/:id/penalties — replaces the policy's penalty rules.
  http.put<{ id: string }>(
    apiPath('/warning/policies/:id/penalties'),
    async ({ request, params }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized

      const body: unknown = await request.json().catch(() => null)
      const parsed = penaltiesInputSchema.safeParse(body)
      if (!parsed.success) {
        return errorResponse(422, 'Some fields need your attention.', { code: 'VALIDATION_FAILED' })
      }
      const errors: Record<string, string> = {}
      parsed.data.penalties.forEach((penalty, index) => {
        if (penalty.penaltyType === 'percentage' && penalty.percentage == null) {
          errors[`penalties.${index}.percentage`] = 'Give the percentage of a day.'
        }
        if (penalty.deduction !== 'payroll' && penalty.leaveTypeId == null) {
          errors[`penalties.${index}.leaveTypeId`] =
            'Choose the leave type the deduction is taken from.'
        }
      })
      const keys = parsed.data.penalties.map((penalty) => `${penalty.period}:${penalty.afterCount}`)
      if (new Set(keys).size !== keys.length) {
        errors.penalties = 'Two penalties have the same count and period.'
      }
      if (Object.keys(errors).length > 0) {
        return errorResponse(422, 'Some fields need your attention.', {
          code: 'VALIDATION_FAILED',
          fieldErrors: errors,
        })
      }

      const policy = warningPolicies.find(params.id)
      if (!policy) return notFound()
      if (!parsed.data.rowVersion || parsed.data.rowVersion !== policy.rowVersion) {
        return changedByOthers()
      }

      const before = presentPolicy(policy).penalties
      warningPenalties
        .all()
        .filter((penalty) => penalty.warningPolicyId === policy.id)
        .forEach((penalty) => warningPenalties.remove(penalty.id))
      const now = serverNow()
      parsed.data.penalties.forEach((penalty) => {
        const leaveTypeId =
          penalty.deduction === 'payroll' || penalty.leaveTypeId == null
            ? null
            : String(penalty.leaveTypeId)
        const record: PenaltyRecord = {
          id: nextId(warningPenalties.all()),
          warningPolicyId: policy.id,
          afterCount: penalty.afterCount,
          period: penalty.period,
          penaltyType: penalty.penaltyType,
          percentage:
            penalty.penaltyType === 'percentage'
              ? (penalty.percentage ?? 0)
              : SHARE[penalty.penaltyType],
          deduction: penalty.deduction,
          leaveTypeId,
          leaveTypeTitle: leaveTypeId ? (leaveTypes.find(leaveTypeId)?.title ?? null) : null,
          createdAt: now,
        }
        warningPenalties.insert(record)
      })
      const updated = { ...policy, updatedAt: now, rowVersion: newRowVersion() }
      warningPolicies.update(policy.id, updated)
      const after = presentPolicy(updated)
      if (JSON.stringify(before) !== JSON.stringify(after.penalties)) {
        recordHistory(
          'update',
          updated,
          'penalties',
          before.length ? JSON.stringify(before) : null,
          JSON.stringify(after.penalties),
        )
      }
      return HttpResponse.json({ data: after })
    },
  ),
]
