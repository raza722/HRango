import { Link } from '@tanstack/react-router'
import { format, isValid, parse } from 'date-fns'
import { CalendarDays, ChevronRight, Megaphone } from 'lucide-react'

import { LEAVE_STATUS_META, LEAVE_STATUSES, type LeaveStatus } from '@/features/leaves'
import { cn } from '@/lib/utils'

import type { LeaveApplication, Notice, WaitingApprovals } from '../api/dashboard.api'
import { formatCount, formatDay, formatDays, formatSpan, plural } from '../utils/format'
import { approvalsLink, type DashLink } from '../utils/links'
import { type QueryState, Widget, WidgetBody, WidgetLink } from './widget'

const isLeaveStatus = (value: string): value is LeaveStatus =>
  (LEAVE_STATUSES as readonly string[]).includes(value)

function LeaveChip({ status }: { status: string }) {
  const meta = isLeaveStatus(status) ? LEAVE_STATUS_META[status] : null
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded-[3px] px-2 text-[0.625rem] font-medium whitespace-nowrap',
        meta?.className ?? 'bg-muted text-field-foreground',
      )}
    >
      {meta?.label ?? status}
    </span>
  )
}

/** Rows a list card shows; the card's link opens the rest. */
const LIST_ROWS = 6

/** The latest leave applications with their status (everyone's, or the caller's own). */
export function LeaveApplicationsWidget({
  query,
  title,
  link,
  showPerson = true,
}: {
  query: QueryState<LeaveApplication[]>
  title: string
  link?: DashLink | undefined
  showPerson?: boolean
}) {
  const pending = query.data?.filter((item) => item.status === 'pending').length ?? 0
  return (
    <Widget
      title={title}
      description={query.data ? `${formatCount(pending)} pending` : undefined}
      action={link && <WidgetLink link={link} label="View all" name={`View all: ${title}`} />}
    >
      <WidgetBody
        query={query}
        what={title}
        skeleton="list"
        isEmpty={(data) => data.length === 0}
        empty="No leave applications yet."
      >
        {(data) => (
          <ul aria-label={title} className="grid divide-y divide-border">
            {data.slice(0, LIST_ROWS).map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="grid min-w-0 gap-0.5">
                  {showPerson && (
                    <span className="truncate text-sm font-medium text-heading">
                      {item.employeeName}
                    </span>
                  )}
                  <span
                    className={cn(
                      'text-xs',
                      showPerson ? 'text-field-foreground' : 'text-sm text-heading',
                    )}
                  >
                    {formatSpan(item.fromDate, item.toDate)} · {formatDays(item.days)}
                  </span>
                  {(item.designationName && showPerson) || item.reason ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {[showPerson ? item.designationName : null, item.reason]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  ) : null}
                </div>
                <LeaveChip status={item.status} />
              </li>
            ))}
          </ul>
        )}
      </WidgetBody>
    </Widget>
  )
}

function noticeDate(value: string | null) {
  if (!value) return null
  const date = parse(value.slice(0, 10), 'yyyy-MM-dd', new Date())
  return isValid(date) ? date : null
}

/** Notices from HR, newest first. */
export function NoticeBoardWidget({ query }: { query: QueryState<Notice[]> }) {
  return (
    <Widget title="Notice board">
      <WidgetBody
        query={query}
        what="Notice board"
        skeleton="list"
        isEmpty={(data) => data.length === 0}
        empty="No notices right now."
      >
        {(data) => (
          <ul aria-label="Notices" className="grid gap-3">
            {data.map((notice) => (
              <li key={notice.id} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/20 dark:text-[#c4b5fd]"
                >
                  <Megaphone className="size-4" />
                </span>
                <div className="grid min-w-0 gap-0.5">
                  <span className="text-sm font-medium text-heading">{notice.title}</span>
                  {notice.body && (
                    <span className="text-xs text-field-foreground">{notice.body}</span>
                  )}
                  <span className="text-[0.6875rem] text-muted-foreground">
                    {formatDay(notice.publishFrom ?? notice.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </WidgetBody>
    </Widget>
  )
}

/** Company events coming up, soonest first, each with its date. */
export function EventsWidget({ query }: { query: QueryState<Notice[]> }) {
  return (
    <Widget title="Upcoming events">
      <WidgetBody
        query={query}
        what="Upcoming events"
        skeleton="list"
        isEmpty={(data) => data.length === 0}
        empty="No events coming up."
      >
        {(data) => (
          <ul aria-label="Events" className="grid gap-3">
            {data
              .toSorted((a, b) => (a.eventDate ?? '').localeCompare(b.eventDate ?? ''))
              .map((event) => {
                const date = noticeDate(event.eventDate)
                return (
                  <li key={event.id} className="flex items-center gap-3">
                    {date ? (
                      <time
                        dateTime={format(date, 'yyyy-MM-dd')}
                        className="grid w-11 shrink-0 justify-items-center rounded-lg bg-muted py-1 leading-tight"
                      >
                        <span className="text-[0.625rem] text-muted-foreground uppercase">
                          {format(date, 'MMM')}
                        </span>
                        <span className="text-base font-semibold text-heading">
                          {format(date, 'd')}
                        </span>
                      </time>
                    ) : (
                      <span
                        aria-hidden="true"
                        className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted"
                      >
                        <CalendarDays className="size-4 text-muted-foreground" />
                      </span>
                    )}
                    <div className="grid min-w-0 gap-0.5">
                      <span className="truncate text-sm font-medium text-heading">
                        {event.title}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {[date ? format(date, 'EEEE') : null, event.body]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                  </li>
                )
              })}
          </ul>
        )}
      </WidgetBody>
    </Widget>
  )
}

/** The requests waiting for the caller's decision, by type, each opening its approvals. */
export function WaitingWidget({ query }: { query: QueryState<WaitingApprovals> }) {
  return (
    <Widget
      title="Waiting for your decision"
      description={query.data ? plural(query.data.total, 'request') : undefined}
    >
      <WidgetBody
        query={query}
        what="Requests waiting for you"
        skeleton="list"
        isEmpty={(data) => data.total === 0}
        empty="Nothing is waiting for you."
      >
        {(data) => (
          <div className="grid gap-2">
            <ul aria-label="Requests waiting for you by type" className="grid gap-1">
              {data.byType.slice(0, LIST_ROWS).map((item) => {
                const link = approvalsLink(item.type)
                return (
                  <li key={item.type}>
                    <Link
                      to={link.to}
                      params={link.params}
                      search={link.search}
                      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <span className="truncate text-heading">{item.name}</span>
                      <span className="flex items-center gap-1 font-semibold text-heading tabular-nums">
                        {formatCount(item.count)}
                        <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
            {data.byType.length > LIST_ROWS && (
              <p className="px-3 text-xs text-muted-foreground">
                And {plural(data.byType.length - LIST_ROWS, 'more type')}:{' '}
                {data.byType
                  .slice(LIST_ROWS)
                  .map((item) => `${item.name} (${formatCount(item.count)})`)
                  .join(', ')}
                .
              </p>
            )}
          </div>
        )}
      </WidgetBody>
    </Widget>
  )
}
