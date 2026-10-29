import { useId } from 'react'
import { RefreshCw, Search } from 'lucide-react'

import { DownloadCircleIcon, FilterSlidersIcon } from '@/components/icons/attendance-menu-icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatTimeValue } from '@/lib/date'
import { cn } from '@/lib/utils'

import { LEGEND } from '../constants'
import { SCHEDULE_SCOPES, type ScheduleScope } from '../types/scheduling.types'
import type { SchedulingHeaderProps } from './scheduling-header'

/*
 * The Attendance Logs look (`features/attendance/utils/settings-styles.ts`), repeated here so
 * Scheduling does not depend on Attendance: Poppins titles, outlined and navy toolbar buttons.
 */
const titleClass = 'text-xl font-medium text-title'
const outlineClass =
  'h-9 border-heading/80 px-4 font-medium text-sidebar dark:border-border dark:text-heading'
const toolbarClass = 'h-9 px-4 text-xs font-medium'
const navyClass = 'bg-sidebar text-white hover:bg-sidebar/90 dark:bg-primary'
const fieldLabelClass = 'text-sm font-medium text-heading'

const SCOPE_OPTIONS: Record<ScheduleScope, string> = {
  my: 'My schedule',
  all: 'All employees',
  subordinates: 'My subordinates',
}

/**
 * Scheduling inside the Attendance sub menu (no frame draws it there): the same controls as
 * the drawn header, laid out like Attendance Logs. The title with Download, Delete, Apply
 * Default Shift and + Create on the right; a grey band with whose schedule, the employee
 * search and the signed-in person's active shift; the legend with Multiselect, Filter and
 * Refresh; the filters panel in its own grey band when open.
 */
export function SchedulingToolbar({
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
  const scopeId = useId()
  const searchId = useId()
  const manage = scope !== 'my'
  const canMultiselect = can.edit || can.delete
  const shiftText =
    activeShift === undefined
      ? '…'
      : [
          activeShift.slotName ?? 'Not scheduled',
          activeShift.clockIn && activeShift.clockOut
            ? `${formatTimeValue(activeShift.clockIn)} – ${formatTimeValue(activeShift.clockOut)}`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={titleClass}>Scheduling</h1>
        {manage && (can.create || can.delete || can.export) && (
          <div className="flex flex-wrap gap-2.5">
            {can.export && (
              <Button
                variant="outline"
                onClick={onExport}
                disabled={isExporting}
                className={outlineClass}
              >
                <DownloadCircleIcon className="size-5" /> Export
              </Button>
            )}
            {can.delete && (
              <Button
                variant="outline"
                onClick={onDelete}
                className={cn(outlineClass, 'border-destructive/70 text-destructive')}
              >
                Delete
              </Button>
            )}
            {can.create && (
              <>
                <Button variant="outline" onClick={onApplyDefault} className={outlineClass}>
                  Apply Default Shift
                </Button>
                <Button onClick={onCreate} className={cn(toolbarClass, navyClass)}>
                  Create
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="@container grid gap-3 rounded-md bg-muted/50 p-3">
        <div className="grid grid-cols-1 gap-3 @md:grid-cols-2 @2xl:grid-cols-3">
          <div className="grid min-w-0 gap-1.5">
            <label htmlFor={scopeId} className={fieldLabelClass}>
              Show
            </label>
            <Select
              value={scope}
              onValueChange={(picked) => {
                const next = SCHEDULE_SCOPES.find((item) => item === picked)
                if (next) onScopeChange(next)
              }}
            >
              <SelectTrigger id={scopeId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULE_SCOPES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {SCOPE_OPTIONS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid min-w-0 gap-1.5">
            <label htmlFor={searchId} className={fieldLabelClass}>
              Employee
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-label"
              />
              <Input
                id={searchId}
                type="search"
                aria-label="Search employees"
                placeholder="Name or code"
                value={searchText}
                onChange={(event) => {
                  onSearchChange(event.target.value)
                }}
                className="bg-card pl-9 sm:pl-9"
              />
            </div>
          </div>
          <div className="grid min-w-0 gap-1.5">
            <span className={fieldLabelClass}>Your Active Status</span>
            <p
              role="status"
              aria-label="Your active status"
              className="flex h-10 items-center truncate rounded-md border bg-card px-3 text-sm text-field-foreground sm:px-4"
            >
              {shiftText}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul
          aria-label="Legend"
          className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-title"
        >
          {Object.values(LEGEND).map((item) => (
            <li key={item.label} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={cn('size-2.5 rounded-full', item.dot)} />
              {item.label}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          {canMultiselect && (
            <Button
              variant="outline"
              aria-pressed={multiselect}
              onClick={onToggleMultiselect}
              className={cn(outlineClass, multiselect && 'bg-sidebar/10')}
            >
              Enable/Disable Multiselect
            </Button>
          )}
          <Button
            variant="outline"
            aria-label={filtersOpen ? 'Hide filters' : 'Show filters'}
            aria-expanded={filtersOpen}
            onClick={onToggleFilters}
            className={cn(outlineClass, 'relative')}
          >
            <FilterSlidersIcon className="size-4" /> Filter
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[0.625rem] text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Refresh"
            onClick={onRefresh}
            className="size-9 border-heading/80 text-sidebar dark:border-border dark:text-heading"
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
              disabled={selectedCount === 0}
              onClick={onMultiEdit}
              className={cn('min-w-24', toolbarClass, navyClass)}
            >
              Multi Edit
            </Button>
          )}
          {can.delete && (
            <Button
              variant="destructive"
              disabled={selectedCount === 0}
              onClick={onMultiDelete}
              className={cn('min-w-24', toolbarClass)}
            >
              Multi Delete
            </Button>
          )}
        </div>
      )}

      {filtersOpen && (
        <div className="@container rounded-md bg-muted/50 p-3 [&>section]:border-t-0 [&>section]:pt-0">
          {filters}
        </div>
      )}
    </div>
  )
}
