import { http, HttpResponse } from 'msw'

import type { WarningHistoryEntry } from '@/features/warning'
import type { Paginated } from '@/types/api'

import { DEMO_USER } from '../auth/handlers'
import { createMockCollection } from '../collection'
import { apiPath, latency, paginate, readPageParams, requireAuth } from '../utils'

/** UTC without a zone, as the API writes `performedAt`. */
function at(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString().slice(0, 19)
}

/** Seven lines over today and yesterday, newest first by id. */
function seedHistory(): WarningHistoryEntry[] {
  const now = new Date()
  const minutesToday = Math.max(10, now.getHours() * 60 + now.getMinutes())
  const today = (fraction: number) => at(Math.floor(minutesToday * fraction))
  const yesterday = (fraction: number) => at(minutesToday + Math.floor(600 * fraction) + 60)

  const entry = (
    id: string,
    performedAt: string,
    actionName: string,
    policyId: string,
    policyTitle: string | null,
    fieldName: string,
    oldValue: string | null,
    newValue: string | null,
  ): WarningHistoryEntry => ({
    id,
    performedAt,
    actionName,
    policyId,
    policyTitle,
    fieldName,
    oldValue,
    newValue,
    performedByUserId: DEMO_USER.id,
    performedByName: DEMO_USER.name,
  })

  return [
    entry('7', today(0.1), 'update', '5', 'Grace', 'grace_minutes', '480', '600'),
    entry('6', today(0.4), 'update', '1', 'Late', 'penalties', '[{}]', '[{},{}]'),
    entry('5', today(0.7), 'update', '1', 'Late', 'title', 'Late arrival', 'Late'),
    entry('4', today(0.9), 'create', '5', 'Grace', 'title', null, 'Grace'),
    entry(
      '3',
      yesterday(0.2),
      'create',
      '6',
      'Late Night Shift',
      'title',
      null,
      'Late Night Shift',
    ),
    entry('2', yesterday(0.5), 'delete', '99', 'Probation grace', 'title', 'Probation grace', null),
    entry('1', yesterday(0.8), 'update', '3', 'Overtime Cap', 'period', 'week', 'day'),
  ]
}

export const warningHistory = createMockCollection<WarningHistoryEntry>({
  storageKey: 'hrms-mock-warning-history-v2',
  seed: seedHistory,
})

/** Appends an audit line, as the procedures do (one per changed field on an update). */
export function recordHistory(
  actionName: 'create' | 'update' | 'delete',
  policy: { id: string; title: string },
  fieldName: string,
  oldValue: string | null,
  newValue: string | null,
): void {
  const id = String(
    warningHistory.all().reduce((max, e) => Math.max(max, Number(e.id) || 0), 0) + 1,
  )
  warningHistory.insert({
    id,
    performedAt: new Date().toISOString().slice(0, 19),
    actionName,
    policyId: policy.id,
    policyTitle: policy.title,
    fieldName,
    oldValue,
    newValue,
    performedByUserId: DEMO_USER.id,
    performedByName: DEMO_USER.name,
  })
}

/** After a rename the log shows the policy's current title, as the API's join does. */
export function renameInHistory(policyId: string, title: string): void {
  warningHistory
    .all()
    .filter((entry) => entry.policyId === policyId)
    .forEach((entry) => warningHistory.update(entry.id, { ...entry, policyTitle: title }))
}

export const warningHistoryHandlers = [
  // GET /warning/history?policyId=&page=&pageSize= — newest first.
  http.get(apiPath('/warning/history'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized

    const url = new URL(request.url)
    const policyId = url.searchParams.get('policyId')
    const { page, pageSize } = readPageParams(url)
    const entries = warningHistory
      .all()
      .filter((entry) => !policyId || entry.policyId === policyId)
      .sort((a, b) => Number(b.id) - Number(a.id))
    return HttpResponse.json<Paginated<WarningHistoryEntry>>(paginate(entries, page, pageSize))
  }),
]
