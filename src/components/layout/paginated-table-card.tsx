import { type ReactNode, useEffect } from 'react'

import { ErrorState } from '@/components/feedback/error-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Paginated } from '@/types/api'

import { CollapsibleCard } from './collapsible-card'
import { DataTable, type DataTableColumn } from './data-table'
import { Pagination } from './pagination'

/** The parts of a TanStack Query result the card needs. */
export interface PaginatedResult<T> {
  data: Paginated<T> | undefined
  isPending: boolean
  isFetching: boolean
  isPlaceholderData: boolean
  error: Error | null
  refetch: () => unknown
}

interface PaginatedTableCardProps<T> {
  title: ReactNode
  /** Header buttons, e.g. "+ Add Form". */
  actions?: ReactNode
  /** Search box and filters, shown above the table. */
  toolbar?: ReactNode
  titleAs?: 'h1' | 'h2'
  /** Pass to make the card collapsible (chevron in the header). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  caption: string
  columns: readonly DataTableColumn<T>[]
  result: PaginatedResult<T>
  /** 1-based page from the URL. */
  page: number
  pageSize: number
  pageSizeOptions: readonly number[]
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  getRowId: (row: T) => string
  rowActions?: (row: T) => ReactNode
  emptyState?: ReactNode
  className?: string
}

/**
 * A list card from the Warning designs: title, optional actions and collapse
 * chevron, a `DataTable`, "Showing x–y of z", rows per page and the pager.
 * Loading, refetching, error and empty states are handled here.
 */
export function PaginatedTableCard<T>({
  title,
  actions,
  toolbar,
  titleAs,
  open,
  onOpenChange,
  caption,
  columns,
  result,
  page,
  pageSize,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  getRowId,
  rowActions,
  emptyState,
  className,
}: PaginatedTableCardProps<T>) {
  const meta = result.data?.meta
  const lastPage = meta?.totalPages

  // Deleting the only row of the last page leaves the URL on a page that no longer exists.
  useEffect(() => {
    if (lastPage !== undefined && !result.isPlaceholderData && page > lastPage) {
      onPageChange(lastPage)
    }
  }, [lastPage, page, result.isPlaceholderData, onPageChange])

  const offset = ((meta?.page ?? page) - 1) * (meta?.pageSize ?? pageSize)
  const total = meta?.total ?? 0
  const firstRow = total === 0 ? 0 : offset + 1
  const lastRow = Math.min(offset + (result.data?.data.length ?? 0), total)

  return (
    <CollapsibleCard
      title={title}
      actions={actions}
      open={open}
      onOpenChange={onOpenChange}
      titleAs={titleAs}
      className={className}
      contentClassName="pt-4 sm:pt-6"
    >
      {toolbar && <div className="mb-4 flex flex-wrap items-center gap-3 sm:mb-5">{toolbar}</div>}
      {result.error && !result.data ? (
        <ErrorState
          message={result.error.message}
          onRetry={() => {
            void result.refetch()
          }}
          className="shadow-none"
        />
      ) : (
        <>
          <DataTable
            caption={caption}
            columns={columns}
            data={result.data?.data ?? []}
            getRowId={getRowId}
            isLoading={result.isPending}
            isFetching={result.isFetching}
            rowActions={rowActions}
            loadingRowCount={pageSize}
            emptyState={emptyState}
          />
          <div className="flex flex-col-reverse items-center justify-between gap-4 pt-5 @lg:flex-row @lg:pt-6">
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
              <span aria-live="polite">
                {result.isPending
                  ? ''
                  : total > 0
                    ? `Showing ${firstRow}–${lastRow} of ${total}`
                    : 'No records'}
              </span>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  onPageSizeChange(Number(value))
                }}
              >
                <SelectTrigger
                  aria-label={`Rows per page in ${caption.toLowerCase()}`}
                  // The box is 4.5rem as drawn; with the trigger's wider desktop padding only
                  // 10px were left for the number, so "10" lost its last digit.
                  className="h-9 w-[4.5rem] px-2 sm:px-2"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* The Warning and Settings frames draw the current page blue. */}
            <Pagination
              page={meta?.page ?? page}
              totalPages={meta?.totalPages ?? 1}
              onPageChange={onPageChange}
              disabled={result.isPending}
              currentClassName="bg-pager-active font-medium text-white"
            />
          </div>
        </>
      )}
    </CollapsibleCard>
  )
}
