import { http, HttpResponse } from 'msw'

import type { InboxChanged, InboxItem, InboxSummary } from '@/features/inbox'
import type { ApiItem } from '@/types/api'

import { apiPath, errorResponse, latency, paginate, readPageParams, requireAuth } from '../utils'

// The signed-in user's notifications as `/api/inbox` serves them. There are no messages:
// chat is out of the first release.

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

interface StoredNotification extends InboxItem {
  cleared: boolean
}

const notification = (
  id: string,
  title: string,
  body: string,
  minutes: number,
  read: boolean,
  extra: Partial<InboxItem> = {},
): StoredNotification => ({
  id,
  notificationType: null,
  title,
  body,
  link: null,
  entityType: null,
  entityId: null,
  read,
  readAt: read ? minutesAgo(minutes - 1) : null,
  createdAt: minutesAgo(minutes),
  cleared: false,
  ...extra,
})

function seedInbox(): StoredNotification[] {
  return [
    notification(
      'ntf_1',
      '3 late arrivals today',
      'Grace minutes exceeded for 3 employees in Engineering.',
      30,
      false,
      {
        notificationType: 'attendance.late_arrivals',
      },
    ),
    notification(
      'ntf_2',
      'Leave request',
      'Sara Khan requested 2 days of annual leave.',
      180,
      false,
      {
        notificationType: 'requests.submitted',
        link: '/requests/leave',
        entityType: 'req.request',
        entityId: '101',
      },
    ),
    notification('ntf_3', 'Policy updated', '“Month End” grace policy was updated.', 60 * 30, true),
  ]
}

let inbox = seedInbox()

export function resetInbox(): void {
  inbox = seedInbox()
}

const visible = () =>
  inbox.filter((item) => !item.cleared).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

const toItem = ({ cleared: _cleared, ...item }: StoredNotification): InboxItem => item

function summary(): InboxSummary {
  const items = visible()
  return {
    unread: items.filter((item) => !item.read).length,
    latest: items.slice(0, 5).map(toItem),
  }
}

/** Applies a change to the matching notifications; answers how many changed. */
function change(
  match: (item: StoredNotification) => boolean,
  apply: (item: StoredNotification) => StoredNotification,
) {
  let changed = 0
  inbox = inbox.map((item) => {
    if (item.cleared || !match(item)) return item
    changed += 1
    return apply(item)
  })
  return HttpResponse.json<ApiItem<InboxChanged>>({ data: { changed } })
}

const markRead = (item: StoredNotification) => ({
  ...item,
  read: true,
  readAt: item.readAt ?? new Date().toISOString(),
})

export const inboxHandlers = [
  http.get(apiPath('/inbox'), async ({ request }) => {
    await latency()
    return requireAuth(request) ?? HttpResponse.json<ApiItem<InboxSummary>>({ data: summary() })
  }),

  http.get(apiPath('/inbox/notifications'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const { page, pageSize } = readPageParams(url)
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true'
    const rows = visible()
      .filter((item) => !unreadOnly || !item.read)
      .map(toItem)
    return HttpResponse.json(paginate(rows, page, pageSize))
  }),

  // Static paths before `/:id/...`.
  http.patch(apiPath('/inbox/notifications/read-all'), async ({ request }) => {
    await latency()
    return requireAuth(request) ?? change((item) => !item.read, markRead)
  }),

  http.patch(apiPath('/inbox/notifications/clear-all'), async ({ request }) => {
    await latency()
    return (
      requireAuth(request) ??
      change(
        () => true,
        (item) => ({ ...item, cleared: true }),
      )
    )
  }),

  http.patch<{ id: string; action: string }>(
    apiPath('/inbox/notifications/:id/:action'),
    async ({ request, params }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized
      if (!inbox.some((item) => item.id === params.id && !item.cleared)) {
        return errorResponse(404, 'Notification not found', { code: 'NOT_FOUND' })
      }
      const byId = (item: StoredNotification) => item.id === params.id
      if (params.action === 'read') return change(byId, markRead)
      if (params.action === 'clear') return change(byId, (item) => ({ ...item, cleared: true }))
      return errorResponse(404, 'Not found', { code: 'NOT_FOUND' })
    },
  ),
]
