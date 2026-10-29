import { useRouter } from '@tanstack/react-router'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ArrowUpRight, Bell, Mail } from 'lucide-react'

import { TopbarIconButton } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import { useCanSeeInbox, useInboxSummary, useMarkAllRead, useMarkRead } from '../hooks/use-inbox'
import type { InboxItem, InboxKind } from '../types/inbox.types'

const COPY: Record<InboxKind, { title: string; empty: string; icon: typeof Mail }> = {
  // Chat is out of the first release: the API has no messages, so this menu stays empty.
  messages: { title: 'Messages', empty: 'No messages', icon: Mail },
  notifications: { title: 'Notifications', empty: 'You are all caught up', icon: Bell },
}

const NO_ITEMS: readonly InboxItem[] = []

/** The API sends UTC times without a zone (`2026-10-26T05:14:37`); read them as UTC. */
const parseUtc = (iso: string) => parseISO(/(?:[zZ]|[+-]\d\d:?\d\d)$/.test(iso) ? iso : `${iso}Z`)

/**
 * Mail or bell button in the top bar, with an unread dot and a dropdown list. Notifications
 * come from `GET /inbox` (unread count and the latest five); clicking one marks it read and
 * opens its link (an app path such as `/requests/leave`) when it has one. Hidden without
 * `inbox.notifications.view`.
 */
export function InboxMenu({ kind }: { kind: InboxKind }) {
  const canSee = useCanSeeInbox()
  const isNotifications = kind === 'notifications'
  const { data, isPending } = useInboxSummary({ enabled: canSee && isNotifications })
  const markAllRead = useMarkAllRead()
  const markRead = useMarkRead()
  const router = useRouter()
  const { title, empty, icon: Icon } = COPY[kind]

  if (isNotifications && !canSee) return null

  const items = isNotifications ? (data?.latest ?? NO_ITEMS) : NO_ITEMS
  const unread = isNotifications ? (data?.unread ?? 0) : 0
  const loading = isNotifications && isPending

  const open = (item: InboxItem) => {
    if (!item.read) markRead.mutate(item.id)
    // App paths only (`/…`, not `//host`): a link elsewhere is not followed from the menu.
    const link = item.link?.trim()
    if (link?.startsWith('/') && !link.startsWith('//')) void router.navigate({ href: link })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <TopbarIconButton
          indicator={unread > 0}
          aria-label={unread > 0 ? `${title}, ${unread} unread` : title}
          title={title}
        >
          <Icon className="size-5" strokeWidth={1.5} />
        </TopbarIconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <DropdownMenuLabel className="p-0 text-sm text-heading">{title}</DropdownMenuLabel>
          {isNotifications && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              disabled={unread === 0 || markAllRead.isPending}
              onClick={() => {
                markAllRead.mutate(kind)
              }}
            >
              Mark all as read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-80 overflow-y-auto p-1">
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>
          ) : (
            items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                className="flex-col items-start gap-0.5 px-3 py-2.5"
                onSelect={() => {
                  open(item)
                }}
              >
                <span className="flex w-full items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      item.read ? 'bg-transparent' : 'bg-primary',
                    )}
                  />
                  <span className={cn('flex-1 truncate', !item.read && 'font-medium')}>
                    {item.title}
                  </span>
                  {item.link && (
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-muted-foreground"
                    />
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(parseUtc(item.createdAt), { addSuffix: true })}
                  </span>
                </span>
                {item.body && (
                  <span className="line-clamp-2 pl-4 text-xs text-muted-foreground">
                    {item.body}
                  </span>
                )}
                {!item.read && <span className="sr-only">Unread</span>}
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
