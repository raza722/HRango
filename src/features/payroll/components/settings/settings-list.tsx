import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

import { DataTable, type DataTableColumn, Pagination } from '@/components/layout'
import { cn } from '@/lib/utils'
import type { Paginated } from '@/types/api'

import { type PayrollSettingsTab, SETTINGS_VIEWS } from '../../routing'
import { payrollSettingsTableClass, payrollTableClass } from '../../utils/styles'
import { NoRecord } from '../shared/no-record'
import { type SettingsView, TAB_PATHS, VIEW_META } from './settings-nav'

/**
 * The row under the tabs: the tab's sub-tabs with their icons on the left
 * (Tax Rebate · Tax Structure…), the view's buttons (+ Create) on the right.
 */
export function ViewHeader({
  tab,
  view,
  actions,
}: {
  tab: PayrollSettingsTab
  view: SettingsView | null
  actions?: ReactNode
}) {
  const views: readonly SettingsView[] = SETTINGS_VIEWS[tab]
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {views.length > 0 ? (
        <nav aria-label="Sections" className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {views.map((item) => {
            const meta = VIEW_META[item]
            const Icon = meta.icon
            const selected = item === view
            return (
              <Link
                key={item}
                to={TAB_PATHS[tab]}
                search={{ view: item, page: 1 }}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-sm py-1 text-sm leading-6 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  selected
                    ? 'text-[#17263A] dark:text-heading'
                    : 'text-[#707070] hover:text-heading dark:text-field-foreground',
                )}
              >
                <Icon className="size-5 shrink-0" />
                {meta.label}
              </Link>
            )
          })}
        </nav>
      ) : (
        <span />
      )}
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  )
}

/** A Settings list: the grey-headed table, "No Record Found" and Previous / Next. */
export function SettingsTable<T>({
  caption,
  columns,
  page,
  getRowId,
  isLoading,
  isFetching,
  onPageChange,
  rowActions,
}: {
  caption: string
  columns: readonly DataTableColumn<T>[]
  page: Paginated<T> | undefined
  getRowId: (row: T) => string
  isLoading: boolean
  isFetching: boolean
  onPageChange: (page: number) => void
  rowActions?: (row: T) => ReactNode
}) {
  const meta = page?.meta
  return (
    <div className="grid gap-4">
      <DataTable
        columns={columns}
        data={page?.data ?? []}
        getRowId={getRowId}
        caption={caption}
        isLoading={isLoading}
        isFetching={isFetching}
        className={cn(payrollTableClass, payrollSettingsTableClass)}
        emptyState={<NoRecord />}
        {...(rowActions ? { rowActions } : {})}
      />
      {meta && meta.total > 0 && (
        <div className="flex justify-end">
          <Pagination
            page={meta.page}
            totalPages={Math.max(1, meta.totalPages)}
            disabled={isFetching}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  )
}
