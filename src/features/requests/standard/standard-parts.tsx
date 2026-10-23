import { Plus, SlidersHorizontal } from 'lucide-react'

import { EmployeeAvatar } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import {
  type PersonRef,
  REQUEST_STATUSES,
  type RequestCounts,
  type RequestEmployee,
  type RequestStatus,
} from '../types/requests.types'
import type { StandardKindConfig } from './standard.types'
import { STANDARD_STATUS_META, standardButton, statusLabel } from './standard-styles'

export function StandardStatusChip({ status, label }: { status: RequestStatus; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex min-w-[4.25rem] items-center justify-center rounded-[3px] px-2.5 py-1 text-[0.625rem] leading-none font-medium whitespace-nowrap',
        STANDARD_STATUS_META[status].className,
      )}
    >
      {label}
    </span>
  )
}

/** Requests / Approvals (/ Settings): Poppins Regular 13 #5C5C5C, the current one Medium 14 navy. */
export function StandardPageTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly { value: T; label: string }[]
  value: T
  onChange: (tab: T) => void
}) {
  return (
    <div role="tablist" aria-label="Page" className="flex gap-6 border-b px-4 sm:px-6">
      {tabs.map((tab) => {
        const selected = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => {
              onChange(tab.value)
            }}
            className={cn(
              'relative h-14 min-w-20 px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              selected
                ? 'text-sm font-medium text-sidebar dark:text-heading'
                : 'text-[0.8125rem] text-tab hover:text-heading',
            )}
          >
            {selected && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-[2.5px] rounded-b bg-sidebar dark:bg-primary"
              />
            )}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * The grey pill: "My Requests | All Requests" or "Requested | Cancellations |
 * Delegates"; the chosen one navy (Poppins Medium 14 white), others Poppins
 * Regular 14 #707070.
 */
export function StandardPill<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string
  items: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex max-w-full flex-wrap gap-1 rounded-md bg-sidebar/[0.07] p-1.5 dark:bg-muted"
    >
      {items.map((item) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => {
              onChange(item.value)
            }}
            className={cn(
              'h-[1.875rem] min-w-24 rounded-[5px] px-4 text-sm whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              selected
                ? 'bg-sidebar font-medium text-white dark:bg-primary'
                : 'text-grey hover:text-heading',
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

/** "All (8)  Pending (2)  Approved (2) …": the chosen one Medium 14 navy with the bar under it. */
export function StandardStatusTabs({
  config,
  value,
  counts,
  onChange,
}: {
  config: Pick<StandardKindConfig, 'statusLabels'>
  value: RequestStatus | undefined
  counts: RequestCounts | undefined
  onChange: (status: RequestStatus | undefined) => void
}) {
  const item = (status: RequestStatus | undefined, label: string, count: number | undefined) => {
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
            'relative min-w-20 px-4 pb-2 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            selected
              ? 'text-sm font-medium text-sidebar dark:text-heading'
              : 'text-[0.8125rem] text-tab hover:text-heading',
          )}
        >
          {label}
          {count !== undefined && ` (${String(count)})`}
          {selected && (
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-[2.5px] rounded-full bg-sidebar dark:bg-primary"
            />
          )}
        </button>
      </li>
    )
  }
  return (
    <ul aria-label="Requests by status" className="flex flex-wrap items-end gap-x-2 gap-y-2">
      {item(undefined, 'All', counts?.all)}
      {REQUEST_STATUSES.map((status) =>
        item(status, statusLabel(config, status), counts?.[status]),
      )}
    </ul>
  )
}

const toolbarClass =
  'h-9 rounded-[5px] font-medium whitespace-nowrap focus-visible:ring-2 focus-visible:ring-ring/50'

/** The outlined "Filter" (Poppins Medium 14 navy); the number of filters in use is read out. */
export function StandardFilterButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className={cn(
        toolbarClass,
        'gap-2 border-[1.5px] border-sidebar bg-card px-5 text-sm text-sidebar hover:bg-sidebar/5 dark:border-input dark:text-heading',
      )}
    >
      <SlidersHorizontal aria-hidden="true" className="size-4" />
      Filter
      {count > 0 && (
        <span className="rounded-full bg-sidebar px-1.5 text-[0.6875rem] text-white dark:bg-primary">
          {count}
          <span className="sr-only"> in use</span>
        </span>
      )}
    </Button>
  )
}

/** "+ Create": Poppins Medium 12 white on navy. */
export function StandardCreateButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      className={cn(toolbarClass, standardButton.navy, 'min-w-24 gap-1 px-6 text-xs')}
    >
      <Plus aria-hidden="true" className="size-3.5" /> Create
    </Button>
  )
}

/** "Approved" / "Unapproved" for the ticked rows (Poppins Medium 14 white). */
export function StandardBulkButtons({
  disabled,
  onApprove,
  onUnapprove,
}: {
  disabled: boolean
  onApprove: () => void
  onUnapprove: () => void
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2.5">
      <Button
        disabled={disabled}
        onClick={onApprove}
        className={cn(toolbarClass, standardButton.navy, 'px-3 text-sm')}
      >
        Approved
      </Button>
      <Button
        disabled={disabled}
        onClick={onUnapprove}
        className={cn(toolbarClass, standardButton.maroon, 'min-w-32 px-4 text-sm')}
      >
        Unapproved
      </Button>
    </div>
  )
}

/**
 * The small photo, the name (Poppins Medium 11 #505050) and the code under it
 * (Poppins Regular 9 #707070). The frames draw 9 / 7 px; raised per the
 * readability rule to the person cell the other modules draw.
 */
export function StandardPersonCell({ person }: { person: RequestEmployee | PersonRef }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <EmployeeAvatar
        name={person.name}
        photoUrl={'photoUrl' in person ? person.photoUrl : null}
        className="size-6 shrink-0"
      />
      <span className="min-w-0">
        <span className="block truncate text-[0.6875rem] font-medium text-person">
          {person.name}
        </span>
        <span className="block truncate text-[0.5625rem] text-grey">{person.code}</span>
      </span>
    </span>
  )
}
