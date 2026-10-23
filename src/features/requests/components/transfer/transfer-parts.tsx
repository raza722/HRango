import { SlidersHorizontal } from 'lucide-react'

import { EmployeeAvatar } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { btn, toolbarButton } from '@/features/payroll'
import { cn } from '@/lib/utils'

import { TRANSFER_STATUS_META } from '../../constants'
import {
  REQUEST_STATUSES,
  type RequestCounts,
  type RequestEmployee,
  type RequestStatus,
} from '../../types/requests.types'
import {
  chipText,
  outlinedControlText,
  personCodeText,
  personNameText,
  tabText,
} from '../shared/request-styles'
import { bulkButton } from './transfer-styles'

export function TransferStatusChip({ status }: { status: RequestStatus }) {
  const meta = TRANSFER_STATUS_META[status]
  return (
    <span
      className={cn(
        'inline-flex min-w-16 items-center justify-center rounded-[3px] px-2.5 py-1 leading-none whitespace-nowrap',
        chipText,
        meta.className,
      )}
    >
      {meta.label}
    </span>
  )
}

/** "All (8)  Pending (2)  Approved (2) …" with the navy bar under the chosen one. */
export function TransferStatusTabs({
  value,
  counts,
  onChange,
}: {
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
            'relative px-4 pb-2 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            tabText.base,
            selected ? tabText.current : tabText.idle,
          )}
        >
          {label}
          {count !== undefined && ` (${String(count)})`}
          {selected && (
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-sidebar dark:bg-primary"
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
        item(status, TRANSFER_STATUS_META[status].label, counts?.[status]),
      )}
    </ul>
  )
}

/** Approvals → "Requested | Delegates" in a grey pill, the chosen one navy. */
export function ApprovalPills({
  value,
  onChange,
}: {
  value: 'requested' | 'delegates'
  onChange: (view: 'requested' | 'delegates') => void
}) {
  const views = [
    { value: 'requested', label: 'Requested' },
    { value: 'delegates', label: 'Delegates' },
  ] as const
  return (
    <div
      role="tablist"
      aria-label="Approvals"
      className="inline-flex gap-1 rounded-md bg-[#EFEFEF] p-1 dark:bg-muted"
    >
      {views.map((view) => {
        const selected = view.value === value
        return (
          <button
            key={view.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => {
              onChange(view.value)
            }}
            className={cn(
              // Figma: Poppins 14, white on the navy when chosen, #707070 otherwise; "Requested" is Medium.
              'h-8 min-w-24 rounded-[5px] px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              view.value === 'requested' && 'font-medium',
              selected ? 'bg-[#17263A] text-white dark:bg-primary' : 'text-grey hover:text-title',
            )}
          >
            {view.label}
          </button>
        )
      })}
    </div>
  )
}

/** The outlined "Filter" button with the sliders icon; the number of filters in use is read out. */
export function FilterButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      className={cn(toolbarButton, btn.outline, 'gap-2 px-4', outlinedControlText)}
    >
      <SlidersHorizontal aria-hidden="true" className="size-4" />
      Filter
      {count > 0 && (
        <span className="rounded-full bg-[#17263A] px-1.5 text-[0.6875rem] text-white dark:bg-primary">
          {count}
          <span className="sr-only"> in use</span>
        </span>
      )}
    </Button>
  )
}

/** "Approved" / "Unapproved" for the ticked rows. */
export function BulkButtons({
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
        className={cn(toolbarButton, bulkButton.approved, 'px-3 text-sm font-medium')}
      >
        Approved
      </Button>
      <Button
        disabled={disabled}
        onClick={onUnapprove}
        className={cn(toolbarButton, bulkButton.unapproved, 'min-w-32 px-4 text-sm font-medium')}
      >
        Unapproved
      </Button>
    </div>
  )
}

/** The small photo, the name and the code under it, as in the Transfer lists. */
export function TransferPersonCell({ employee }: { employee: RequestEmployee }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <EmployeeAvatar
        name={employee.name}
        photoUrl={employee.photoUrl}
        className="size-6 shrink-0"
      />
      <span className="min-w-0">
        <span className={cn('block truncate', personNameText)}>{employee.name}</span>
        <span className={cn('block truncate', personCodeText)}>{employee.code}</span>
      </span>
    </span>
  )
}
