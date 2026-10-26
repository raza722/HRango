import { ChevronDown } from 'lucide-react'

import { FilterSlidersIcon } from '@/components/icons/attendance-menu-icons'
import { EmployeeAvatar } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import { LEAVE_STATUS_META } from '../../constants'
import {
  LEAVE_STATUSES,
  type LeaveApplicationCounts,
  type LeaveStatus,
} from '../../types/leaves.types'
import {
  leaveNavyButtonClass,
  leaveOutlineButtonClass,
  leaveToolbarClass,
} from '../../utils/styles'

/** "Approved", "Pending" …: 59 × 20, 3px corners, Poppins Medium 10 in the status colour. */
export function LeaveStatusChip({ status }: { status: LeaveStatus }) {
  const meta = LEAVE_STATUS_META[status]
  return (
    <span
      className={cn(
        'inline-flex min-w-[3.6875rem] items-center justify-center rounded-[3px] px-2 py-1 text-[0.625rem] leading-none font-medium whitespace-nowrap',
        meta.className,
      )}
    >
      {meta.label}
    </span>
  )
}

const statusLabel = (status: LeaveStatus | undefined) =>
  status ? LEAVE_STATUS_META[status].menuLabel : 'All Requests'

/**
 * "All Requests ⌄" (outlined, Poppins Medium 14 navy) opening the list
 * "All Requests (20) Pending (2) Completed (2) Rejected (2) Cancelling (3)
 * Cancelled (3)", as the frame draws it.
 */
export function LeaveStatusDropdown({
  value,
  counts,
  onChange,
}: {
  value: LeaveStatus | undefined
  counts: LeaveApplicationCounts | undefined
  onChange: (status: LeaveStatus | undefined) => void
}) {
  const count = (key: LeaveStatus | 'all') => (counts ? ` (${String(counts[key])})` : '')
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={`Status: ${statusLabel(value)}`}
        className={cn(
          leaveToolbarClass,
          leaveOutlineButtonClass,
          'flex min-w-[9.5rem] items-center justify-between gap-6 px-5 outline-none',
        )}
      >
        {statusLabel(value)}
        <ChevronDown aria-hidden="true" className="size-4" strokeWidth={1.6} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48 py-1">
        <DropdownMenuRadioGroup
          value={value ?? 'all'}
          onValueChange={(picked) => {
            onChange(LEAVE_STATUSES.find((status) => status === picked))
          }}
        >
          <DropdownMenuRadioItem value="all" className="text-[0.8125rem] text-title">
            All Requests{count('all')}
          </DropdownMenuRadioItem>
          {LEAVE_STATUSES.map((status) => (
            <DropdownMenuRadioItem
              key={status}
              value={status}
              className="text-[0.8125rem] text-title"
            >
              {LEAVE_STATUS_META[status].menuLabel}
              {count(status)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * "Filter" with the design's page-info icon: outlined on My Leaves, filled
 * navy on Leave Applications. The number of filters in use is read out.
 */
export function LeaveFilterButton({
  filled = false,
  count,
  onClick,
}: {
  filled?: boolean
  count: number
  onClick: () => void
}) {
  return (
    <Button
      variant={filled ? 'default' : 'outline'}
      onClick={onClick}
      className={cn(
        leaveToolbarClass,
        'gap-2 px-5 text-sm',
        filled ? leaveNavyButtonClass : leaveOutlineButtonClass,
      )}
    >
      <FilterSlidersIcon aria-hidden="true" className="size-5" />
      Filter
      {count > 0 && (
        <span
          className={cn(
            'rounded-full px-1.5 text-[0.6875rem]',
            filled ? 'bg-white/20 text-white' : 'bg-sidebar text-white dark:bg-primary',
          )}
        >
          {count}
          <span className="sr-only"> in use</span>
        </span>
      )}
    </Button>
  )
}

/** "+ Apply Leave": Poppins Medium 12 white on navy. */
export function ApplyLeaveButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      className={cn(leaveToolbarClass, leaveNavyButtonClass, 'px-7 text-xs')}
    >
      + Apply Leave
    </Button>
  )
}

/**
 * Employees cell (frame 4428:90071): the 28px photo with a 1px #B9B9B9 ring,
 * the name Poppins Medium and the code Regular under it (drawn 10 / 8 px;
 * 11 / 9 per the readability rule).
 */
export function LeavePersonCell({
  person,
}: {
  person: { name: string; code: string; photoUrl?: string | null }
}) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      <EmployeeAvatar
        name={person.name}
        photoUrl={person.photoUrl ?? null}
        className="size-7 shrink-0 ring-1 ring-[#B9B9B9] dark:ring-border"
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
