import { ChevronDown, CircleX } from 'lucide-react'

import { DelegatesIcon } from '@/components/icons/request-icons'
import {
  AllScopeIcon as RequestedIcon,
  MyScopeIcon as ConsentsIcon,
} from '@/components/icons/scope-icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import { APPROVAL_VIEW_LABELS, STATUS_META } from '../../constants'
import {
  APPROVAL_VIEWS,
  type ApprovalView,
  REQUEST_STATUSES,
  REQUEST_TABS,
  type RequestCounts,
  type RequestStatus,
  type RequestTab,
} from '../../types/requests.types'
import { chipText, tabText } from './request-styles'

/** Pale chip with the status in colour ("Pending", "Completed"…). */
export function StatusChip({ status }: { status: RequestStatus }) {
  const meta = STATUS_META[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-2 py-0.5 leading-4 whitespace-nowrap',
        chipText,
        meta.className,
      )}
    >
      {meta.label}
    </span>
  )
}

const TAB_LABELS: Record<RequestTab, string> = { request: 'Request', approvals: 'Approvals' }

/** "Request" / "Approvals" with the navy bar over the current one. */
export function RequestTabs({
  value,
  onChange,
  approvals = true,
}: {
  value: RequestTab
  onChange: (tab: RequestTab) => void
  /** Approvals shows only with `requests.approvals.view`. */
  approvals?: boolean
}) {
  return (
    <div
      role="tablist"
      aria-label="Requests or approvals"
      className="flex gap-6 border-b px-4 sm:px-6"
    >
      {REQUEST_TABS.filter((tab) => approvals || tab !== 'approvals').map((tab) => {
        const selected = tab === value
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => {
              onChange(tab)
            }}
            className={cn(
              'relative h-14 px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              tabText.base,
              selected ? tabText.current : tabText.idle,
            )}
          >
            {selected && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-0.5 rounded-b bg-sidebar dark:bg-primary"
              />
            )}
            {TAB_LABELS[tab]}
          </button>
        )
      })}
    </div>
  )
}

const VIEW_ICONS = {
  requested: RequestedIcon,
  delegates: DelegatesIcon,
  consents: ConsentsIcon,
  cancellations: CircleX,
}

/** Approvals → Requested / Delegates / Consents / Cancellations. */
export function ApprovalViewTabs({
  value,
  onChange,
}: {
  value: ApprovalView
  onChange: (view: ApprovalView) => void
}) {
  return (
    <div role="tablist" aria-label="Approvals" className="flex flex-wrap gap-x-7 gap-y-2">
      {APPROVAL_VIEWS.map((view) => {
        const Icon = VIEW_ICONS[view]
        const selected = view === value
        return (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => {
              onChange(view)
            }}
            className={cn(
              'flex h-8 items-center gap-2.5 rounded-sm text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              selected ? 'text-sidebar dark:text-heading' : 'text-grey hover:text-title',
            )}
          >
            <Icon className={cn(view === 'delegates' ? 'size-6' : 'size-4')} />
            {APPROVAL_VIEW_LABELS[view]}
          </button>
        )
      })}
    </div>
  )
}

const statusLabel = (status: RequestStatus | undefined) =>
  status ? STATUS_META[status].label : 'All Requests'

/** "All Requests ⌄" with the count of each status, as drawn. */
export function StatusDropdown({
  value,
  counts,
  onChange,
}: {
  value: RequestStatus | undefined
  counts: RequestCounts | undefined
  onChange: (status: RequestStatus | undefined) => void
}) {
  const count = (key: RequestStatus | 'all') => (counts ? ` (${counts[key]})` : '')
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={`Status: ${statusLabel(value)}`}
        className="flex h-9 min-w-44 items-center justify-between gap-3 rounded-md border border-heading/80 bg-card px-3 text-sm font-medium text-sidebar outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-border dark:text-heading"
      >
        {statusLabel(value)}
        <ChevronDown className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuRadioGroup
          value={value ?? 'all'}
          onValueChange={(picked) => {
            onChange(REQUEST_STATUSES.find((status) => status === picked))
          }}
        >
          <DropdownMenuRadioItem value="all">All Requests{count('all')}</DropdownMenuRadioItem>
          {REQUEST_STATUSES.map((status) => (
            <DropdownMenuRadioItem key={status} value={status}>
              {STATUS_META[status].label}
              {count(status)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** "2 (All) (1) Pending (1) Completed …": quick status filters above the list. */
export function StatusStrip({
  value,
  counts,
  onChange,
}: {
  value: RequestStatus | undefined
  counts: RequestCounts | undefined
  onChange: (status: RequestStatus | undefined) => void
}) {
  if (!counts) return null
  const item = (status: RequestStatus | undefined, label: string) => {
    const selected = value === status
    return (
      <li key={status ?? 'all'}>
        <button
          type="button"
          aria-pressed={selected}
          onClick={() => {
            onChange(status)
          }}
          className={cn(
            'rounded-sm px-1.5 py-1 text-[0.6875rem] font-medium whitespace-nowrap outline-none hover:text-title focus-visible:ring-2 focus-visible:ring-ring/50',
            selected ? 'text-sidebar underline underline-offset-4 dark:text-heading' : 'text-tab',
          )}
        >
          {label}
        </button>
      </li>
    )
  }
  return (
    <ul aria-label="Requests by status" className="flex flex-wrap items-center gap-x-6 gap-y-1">
      {item(undefined, `${counts.all} (All)`)}
      {REQUEST_STATUSES.map((status) =>
        item(status, `(${counts[status]}) ${STATUS_META[status].label}`),
      )}
    </ul>
  )
}
