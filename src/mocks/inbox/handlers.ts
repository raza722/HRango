import { http, HttpResponse } from 'msw'

import type { InboxItem, InboxKind, InboxSummary } from '@/features/inbox'
import type { ApiItem } from '@/types/api'

import { apiPath, latency, requireAuth } from '../utils'

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

function seedInbox(): InboxSummary {
  return {
    messages: [
      {
        id: 'msg_1',
        title: 'Ayesha Malik',
        body: 'Can we review the late-arrival policy before Friday?',
        createdAt: minutesAgo(12),
        read: false,
      },
      {
        id: 'msg_2',
        title: 'Payroll team',
        body: 'October payroll draft is ready for approval.',
        createdAt: minutesAgo(95),
        read: false,
      },
      {
        id: 'msg_3',
        title: 'Omar Siddiqui',
        body: 'Thanks, the roster change is confirmed.',
        createdAt: minutesAgo(60 * 26),
        read: true,
      },
    ],
    notifications: [
      {
        id: 'ntf_1',
        title: '3 late arrivals today',
        body: 'Grace minutes exceeded for 3 employees in Engineering.',
        createdAt: minutesAgo(30),
        read: false,
      },
      {
        id: 'ntf_2',
        title: 'Leave request',
        body: 'Sara Khan requested 2 days of annual leave.',
        createdAt: minutesAgo(180),
        read: false,
      },
      {
        id: 'ntf_3',
        title: 'Policy updated',
        body: '“Month End” grace policy was updated.',
        createdAt: minutesAgo(60 * 30),
        read: true,
      },
    ],
  }
}

let inbox = seedInbox()

export function resetInbox(): void {
  inbox = seedInbox()
}

function isInboxKind(value: unknown): value is InboxKind {
  return value === 'messages' || value === 'notifications'
}

export const inboxHandlers = [
  http.get(apiPath('/inbox'), async ({ request }) => {
    await latency()
    return requireAuth(request) ?? HttpResponse.json<ApiItem<InboxSummary>>({ data: inbox })
  }),

  http.post<{ kind: string }>(apiPath('/inbox/:kind/read'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    if (!isInboxKind(params.kind)) return new HttpResponse(null, { status: 404 })

    const kind = params.kind
    inbox = {
      ...inbox,
      [kind]: inbox[kind].map((item: InboxItem) => ({ ...item, read: true })),
    }
    return new HttpResponse(null, { status: 204 })
  }),
]
