import type { ReactNode } from 'react'
import { Download, Filter, Network, RefreshCw, Search, SquareCheck, User } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatTimeValue } from '@/lib/date'
import { cn } from '@/lib/utils'

import { LEGEND, SCOPE_LABELS } from '../constants'
import { type ActiveShift, SCHEDULE_SCOPES, type ScheduleScope } from '../types/scheduling.types'
import { schedulingType } from './type-styles'

const SCOPE_ICONS = { my: User, all: SquareCheck, subordinates: Network } as const

export interface SchedulingHeaderProps {
  scope: ScheduleScope
  onScopeChange: (scope: ScheduleScope) => void
  searchText: string
  onSearchChange: (text: string) => void
  activeShift: ActiveShift | undefined
  multiselect: boolean
  onToggleMultiselect: () => void
  selectedCount: number
  onMultiEdit: () => void
  onMultiDelete: () => void
  filtersOpen: boolean
  onToggleFilters: () => void
  activeFilterCount: number
  onRefresh: () => void
  isRefreshing: boolean
  onApplyDefault: () => void
  onCreate: () => void
  onDelete: () => void
  onExport: () => void
  isExporting: boolean
  /** What the signed-in user may do (`scheduling.schedules.*`); all true in mock mode. */
  can: { create: boolean; edit: boolean; delete: boolean; export: boolean }
  /** The filters panel, shown under the toolbar when open. */
  filters: ReactNode
}

/**
 * The Scheduling header card as drawn: title, My / All / Subordinates, search,
 * the "Active Status" box, the All-tab actions (Apply Default Shift, Create,
 * Delete, Export), the legend, multiselect, filter and refresh. Buttons the user's
 * permissions do not allow are left out. (Import is not in the API's first build.)
 */
export function SchedulingHeader({
  scope,
  onScopeChange,
  searchText,
  onSearchChange,
  activeShift,
  multiselect,
  onToggleMultiselect,
  selectedCount,
  onMultiEdit,
  onMultiDelete,
  filtersOpen,
  onToggleFilters,
  activeFilterCount,
  onRefresh,
  isRefreshing,
  onApplyDefault,
  onCreate,
  onDelete,
  onExport,
  isExporting,
  can,
  filters,
}: SchedulingHeaderProps) {
  const manage = scope !== 'my'
  const canMultiselect = can.edit || can.delete

  return (
    <header className="@container grid gap-4 rounded-md bg-card px-4 py-5 font-inter shadow-xs sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-3">
          <h1 className="text-xl leading-tight font-medium text-heading">Scheduling</h1>
          <div role="tablist" aria-label="Whose schedule" className="flex flex-wrap gap-2">
            {SCHEDULE_SCOPES.map((option) => {
              const Icon = SCOPE_ICONS[option]
              const selected = scope === option
              return (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => {
                    onScopeChange(option)
                  }}
                  className={cn(
                    // Figma: Inter Medium 16, #897A7A when not chosen.
                    'inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-base font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 pointer-coarse:h-10',
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-chip text-[#897A7A] hover:brightness-95 dark:bg-input dark:text-field-foreground',
                  )}
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {SCOPE_LABELS[option]}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 @2xl:w-auto">
          <div className="relative min-w-0 flex-1 @2xl:w-56 @2xl:flex-none">
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
              className="pl-9 placeholder:text-grey sm:pl-9 sm:text-base"
            />
          </div>
          <div
            role="status"
            aria-label="Your active status"
            className="min-w-28 rounded-md border px-3 py-1.5 text-center"
          >
            <p className="text-xs font-semibold text-[#21A73F] dark:text-success">Active Status</p>
            <p className="text-sm text-heading">
              {activeShift === undefined ? '…' : (activeShift.slotName ?? 'Not scheduled')}
            </p>
            {activeShift?.clockIn && activeShift.clockOut && (
              <p className="text-[0.6875rem] text-muted-foreground tabular-nums">
                {formatTimeValue(activeShift.clockIn)} – {formatTimeValue(activeShift.clockOut)}
              </p>
            )}
          </div>
        </div>
      </div>

      {manage && (can.create || can.delete || can.export) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {can.create && (
              <>
                <Button onClick={onApplyDefault} className={schedulingType.button}>
                  Apply Default Shift
                </Button>
                <Button variant="success" onClick={onCreate} className={schedulingType.button}>
                  Create
                </Button>
              </>
            )}
            {can.delete && (
              <Button variant="destructive" onClick={onDelete} className={schedulingType.button}>
                Delete
              </Button>
            )}
          </div>
          {can.export && (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={onExport}
                disabled={isExporting}
                className={cn('bg-blue-600 text-white hover:bg-blue-600/90', schedulingType.button)}
              >
                <Download /> Export
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul
          aria-label="Legend"
          className="flex flex-wrap items-center gap-x-5 gap-y-2 text-base text-heading"
        >
          {Object.values(LEGEND).map((item) => (
            <li key={item.label} className="flex items-center gap-2">
              <span aria-hidden="true" className={cn('size-3 rounded-full', item.dot)} />
              {item.label}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          {canMultiselect && (
            <Button
              aria-pressed={multiselect}
              onClick={onToggleMultiselect}
              className={cn(
                schedulingType.button,
                multiselect && 'ring-2 ring-primary/40 ring-offset-2 ring-offset-card',
              )}
            >
              Enable/Disable Multiselect
            </Button>
          )}
          <Button
            size="icon"
            aria-label={filtersOpen ? 'Hide filters' : 'Show filters'}
            aria-expanded={filtersOpen}
            onClick={onToggleFilters}
            className="relative"
          >
            <Filter className="size-4 fill-current" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[0.625rem] text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Button
            variant="success"
            size="icon"
            aria-label="Refresh"
            onClick={onRefresh}
            className="bg-green-200 text-green-800 hover:bg-green-300 dark:bg-green-500/25 dark:text-green-200"
          >
            <RefreshCw className={cn('size-4', isRefreshing && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {multiselect && canMultiselect && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <p aria-live="polite" className="mr-auto text-sm text-muted-foreground @md:mr-2">
            {selectedCount === 0
              ? 'Click shifts on the board to select them.'
              : `${selectedCount} selected`}
          </p>
          {can.edit && (
            <Button
              variant="success"
              disabled={selectedCount === 0}
              onClick={onMultiEdit}
              className={cn('min-w-24', schedulingType.button)}
            >
              Multi Edit
            </Button>
          )}
          {can.delete && (
            <Button
              variant="destructive"
              disabled={selectedCount === 0}
              onClick={onMultiDelete}
              className={cn('min-w-24', schedulingType.button)}
            >
              Multi Delete
            </Button>
          )}
        </div>
      )}

      {filtersOpen && filters}
    </header>
  )
}
