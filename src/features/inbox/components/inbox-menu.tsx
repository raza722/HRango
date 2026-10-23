import { formatDistanceToNow, parseISO } from 'date-fns'
import { Bell, Mail } from 'lucide-react'

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

import { useInboxSummary, useMarkAllRead } from '../hooks/use-inbox'
import type { InboxKind } from '../types/inbox.types'

const COPY: Record<InboxKind, { title: string; empty: string; icon: typeof Mail }> = {
  messages: { title: 'Messages', empty: 'No messages', icon: Mail },
  notifications: { title: 'Notifications', empty: 'You are all caught up', icon: Bell },
}

/** Mail or bell button in the top bar, with an unread dot and a dropdown list. */
export function InboxMenu({ kind }: { kind: InboxKind }) {
  const { data, isPending } = useInboxSummary()
  const markAllRead = useMarkAllRead()
  const { title, empty, icon: Icon } = COPY[kind]
  const items = data?.[kind] ?? []
  const unread = items.filter((item) => !item.read).length

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
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-80 overflow-y-auto p-1">
          {isPending ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>
          ) : (
            items.map((item) => (
              <DropdownMenuItem key={item.id} className="flex-col items-start gap-0.5 px-3 py-2.5">
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
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(parseISO(item.createdAt), { addSuffix: true })}
                  </span>
                </span>
                <span className="line-clamp-2 pl-4 text-xs text-muted-foreground">{item.body}</span>
                {!item.read && <span className="sr-only">Unread</span>}
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
