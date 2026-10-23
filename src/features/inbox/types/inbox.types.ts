export type InboxKind = 'messages' | 'notifications'

export interface InboxItem {
  id: string
  title: string
  body: string
  /** ISO timestamp. */
  createdAt: string
  read: boolean
}

/** `GET /inbox`: the latest messages and notifications for the top bar. */
export interface InboxSummary {
  messages: InboxItem[]
  notifications: InboxItem[]
}
