import { Search } from 'lucide-react'

import { ScopeTabs } from '@/components/layout'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { DAY_STATUS_META } from '../../constants'
import {
  DAY_STATUSES,
  type DayStatus,
  OVERVIEW_SCOPES,
  type OverviewScope,
} from '../../types/attendance.types'
import { AttendanceSectionsMenu } from '../layout/attendance-sub-layout'
import { StatusIcon } from '../shared/status-badges'

interface OverviewHeaderProps {
  scope: OverviewScope
  onScopeChange: (scope: OverviewScope) => void
  searchText: string
  onSearchChange: (text: string) => void
  highlight: DayStatus | null
  onHighlightChange: (status: DayStatus | null) => void
}

/**
 * The first card of Attendance Overview: title, "More" (the Attendance sub menu's pages),
 * search, All / Subordinates and the legend of day states. A legend chip highlights that
 * state in the grid.
 */
export function OverviewHeader({
  scope,
  onScopeChange,
  searchText,
  onSearchChange,
  highlight,
  onHighlightChange,
}: OverviewHeaderProps) {
  return (
    <header className="@container grid gap-5 rounded-xl bg-card px-4 py-5 shadow-xs sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-inter text-xl font-medium text-heading">Attendance Overview</h1>
        <div className="flex w-full flex-wrap items-center gap-2 @lg:w-auto">
          <AttendanceSectionsMenu className="h-10" />
          <div className="relative min-w-0 flex-1 @lg:w-64 @lg:flex-none">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-label"
            />
            <Input
              type="search"
              aria-label="Search employees"
              placeholder="Search"
              value={searchText}
              onChange={(event) => {
                onSearchChange(event.target.value)
              }}
              className="pl-9 font-inter placeholder:text-grey sm:pl-9 sm:text-base"
            />
          </div>
        </div>
      </div>

      <ScopeTabs
        label="Whose attendance"
        scopes={OVERVIEW_SCOPES}
        value={scope}
        onChange={onScopeChange}
      />

      <div className="grid gap-2">
        <ul
          aria-label="Legend. Choose a state to highlight it in the grid."
          className="grid grid-cols-2 gap-3 @md:grid-cols-3 @2xl:grid-cols-4 @4xl:grid-cols-6"
        >
          {DAY_STATUSES.map((status) => {
            const meta = DAY_STATUS_META[status]
            const active = highlight === status
            return (
              <li key={status}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    onHighlightChange(active ? null : status)
                  }}
                  className={cn(
                    'flex h-[2.625rem] w-full items-center gap-2.5 rounded-md border px-3 text-left font-inter text-sm font-medium text-title transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 @4xl:text-base',
                    active
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-[#303030] dark:border-border',
                    highlight !== null && !active && 'opacity-60',
                  )}
                >
                  <StatusIcon status={status} className="size-6" />
                  <span className="min-w-0 flex-1 truncate">{meta.legendLabel ?? meta.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
        {highlight && (
          <p aria-live="polite" className="text-xs text-muted-foreground">
            Highlighting {DAY_STATUS_META[highlight].label} days.{' '}
            <button
              type="button"
              onClick={() => {
                onHighlightChange(null)
              }}
              className="text-primary underline-offset-2 hover:underline"
            >
              Show all
            </button>
          </p>
        )}
      </div>
    </header>
  )
}
