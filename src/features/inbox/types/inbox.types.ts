/**
 * `messages`: the top bar's mail menu (chat is not in the first release; the API has no
 * messages, so it stays empty). `notifications`: the bell, fed by `/api/inbox`.
 */
export type InboxKind = 'messages' | 'notifications'

/** One notification (`NotificationOut`). */
export interface InboxItem {
  id: string
  /** What happened, e.g. `requests.approved`; `null` for plain notices. */
  notificationType: string | null
  title: string
  body: string | null
  /** Where clicking it leads (an app path such as `/requests/leave/123`), if anywhere. */
  link: string | null
  entityType: string | null
  entityId: string | null
  read: boolean
  readAt: string | null
  /** ISO timestamp. */
  createdAt: string
}

/** `GET /inbox`: unread count and the latest five, for the top bar. */
export interface InboxSummary {
  unread: number
  latest: InboxItem[]
}

/** `PATCH /inbox/notifications/...`: how many notifications changed. */
export interface InboxChanged {
  changed: number
}

/** `GET /inbox/notifications` query. */
export interface NotificationListParams {
  page: number
  pageSize: number
  unreadOnly?: boolean | undefined
}
