import { addMinutes, startOfToday, startOfYesterday } from 'date-fns'
import { http, HttpResponse } from 'msw'

import type { HistoryAction, HistoryEntity, WarningHistoryEntry } from '@/features/warning'
import type { ApiItem } from '@/types/api'

import { DEMO_USER } from '../auth/handlers'
import { createMockCollection } from '../collection'
import { apiPath, createId, errorResponse, latency, requireAuth } from '../utils'

/** Today's entries spread over the part of today that has passed; yesterday's at fixed times. */
function seedHistory(): WarningHistoryEntry[] {
  const today = startOfToday()
  const elapsedMinutes = Math.max(10, Math.floor((Date.now() - today.getTime()) / 60_000))
  const at = (fraction: number) =>
    addMinutes(today, Math.floor(elapsedMinutes * fraction)).toISOString()
  const yesterday = (hour: number, minute: number) =>
    addMinutes(startOfYesterday(), hour * 60 + minute).toISOString()

  const entry = (
    id: string,
    occurredAt: string,
    entity: HistoryEntity,
    action: HistoryAction,
    recordId: string,
    recordTitle: string,
  ): WarningHistoryEntry => ({
    id,
    occurredAt,
    entity,
    action,
    recordId,
    recordTitle,
    actor: DEMO_USER.name,
  })

  return [
    entry('wh_01', at(0.92), 'policy', 'updated', 'wp_grace01', 'Grace'),
    entry('wh_02', at(0.75), 'penalty', 'created', 'pn_late02', 'Late arrival penalty'),
    entry('wh_03', at(0.5), 'policy', 'updated', 'wp_late01', 'Late'),
    entry('wh_04', at(0.25), 'penalty', 'updated', 'pn_grace01', 'Grace penalty'),
    entry('wh_05', yesterday(17, 40), 'policy', 'created', 'wp_ot01', 'Overtime Cap'),
    entry('wh_06', yesterday(15, 54), 'policy', 'deleted', 'wp_old01', 'Probation grace'),
    entry('wh_07', yesterday(10, 12), 'penalty', 'updated', 'pn_late01', 'Late arrival full day'),
  ]
}

export const warningHistory = createMockCollection<WarningHistoryEntry>({
  storageKey: 'hrms-mock-warning-history',
  seed: seedHistory,
})

/** Appends an audit entry; called by the policy and penalty handlers after each change. */
export function recordHistory(
  entity: HistoryEntity,
  action: HistoryAction,
  record: { id: string; title: string },
): void {
  warningHistory.insert({
    id: createId('wh'),
    occurredAt: new Date().toISOString(),
    entity,
    action,
    recordId: record.id,
    recordTitle: record.title,
    actor: DEMO_USER.name,
  })
}

const BASE = apiPath('/warning-history')

export const warningHistoryHandlers = [
  http.get(BASE, async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized

    const entries = warningHistory
      .all()
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, 200)
    return HttpResponse.json<ApiItem<WarningHistoryEntry[]>>({ data: entries })
  }),

  http.delete<{ id: string }>(`${BASE}/:id`, async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    if (!warningHistory.remove(params.id)) {
      return errorResponse(404, 'History entry not found.', { code: 'NOT_FOUND' })
    }
    return new HttpResponse(null, { status: 204 })
  }),

  http.delete(BASE, async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    warningHistory.all().forEach((entry) => warningHistory.remove(entry.id))
    return new HttpResponse(null, { status: 204 })
  }),
]
