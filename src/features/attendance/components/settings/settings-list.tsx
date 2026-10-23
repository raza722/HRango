import { type ReactNode, useState } from 'react'
import { Search } from 'lucide-react'

import { FilterSlidersIcon } from '@/components/icons/attendance-menu-icons'
import { DataTable, type DataTableColumn, Pagination } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { PaginationMeta } from '@/types/api'

import { useDebouncedSearch } from '../../hooks/use-debounced-search'
import {
  compactTableClass,
  navyButtonClass,
  outlineButtonClass,
  pageTitleClass,
  toolbarButtonClass,
} from '../../utils/settings-styles'

/** Green "Active" / grey "Inactive" chip. */
export function ActiveChip({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-sm px-2 py-0.5 text-[0.625rem] font-medium whitespace-nowrap',
        active
          ? 'bg-[#D7F5DF] text-[#51B969] dark:bg-green-500/15 dark:text-green-400'
          : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-500/25 dark:text-neutral-300',
      )}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

interface SettingsListCardProps<T> {
  title: string
  columns: readonly DataTableColumn<T>[]
  rows: readonly T[]
  meta: PaginationMeta | undefined
  getRowId: (row: T) => string
  isLoading: boolean
  isFetching: boolean
  rowActions?: (row: T) => ReactNode
  onCreate?: () => void
  /** Buttons before Create (the red Delete of Rest Days). */
  actions?: ReactNode
  /** Filter panel content; a search box is always there. */
  filters?: ReactNode
  searchLabel: string
  onSearch: (text: string) => void
  onPageChange: (page: number) => void
  emptyText: string
}

/**
 * A Settings list as drawn: the title, Filter (outline), optional actions and
 * + Create (navy), the table and the pager. Filter opens a search row.
 */
export function SettingsListCard<T>({
  title,
  columns,
  rows,
  meta,
  getRowId,
  isLoading,
  isFetching,
  rowActions,
  onCreate,
  actions,
  filters,
  searchLabel,
  onSearch,
  onPageChange,
  emptyText,
}: SettingsListCardProps<T>) {
  const [open, setOpen] = useState(false)
  const search = useDebouncedSearch(onSearch)

  return (
    <section aria-label={title} className="grid gap-4 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={pageTitleClass}>{title}</h2>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            aria-expanded={open}
            onClick={() => {
              setOpen((value) => !value)
            }}
            className={outlineButtonClass}
          >
            <FilterSlidersIcon className="size-5" /> Filter
          </Button>
          {actions}
          {onCreate && (
            <Button onClick={onCreate} className={cn(toolbarButtonClass, 'px-5', navyButtonClass)}>
              + Create
            </Button>
          )}
        </div>
      </div>

      {open && (
        <div className="flex flex-wrap items-end gap-3 rounded-md bg-muted/50 p-3">
          <div className="relative w-full sm:w-64">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-label"
            />
            <Input
              type="search"
              aria-label={searchLabel}
              placeholder="Search"
              value={search.text}
              onChange={(event) => {
                search.set(event.target.value)
              }}
              className="h-9 bg-card pl-9 sm:pl-9"
            />
          </div>
          {filters}
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        getRowId={getRowId}
        caption={title}
        isLoading={isLoading}
        isFetching={isFetching}
        className={compactTableClass}
        emptyState={<p className="py-10 text-center text-sm text-muted-foreground">{emptyText}</p>}
        {...(rowActions ? { rowActions } : {})}
      />

      {meta && meta.totalPages > 1 && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          disabled={isFetching}
          onPageChange={onPageChange}
          className="justify-end"
        />
      )}
    </section>
  )
}
