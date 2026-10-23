import { Fragment, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BREAKPOINTS, useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

export interface DataTableColumn<T> {
  /** Stable key for the column. */
  id: string
  header: ReactNode
  /** Renders the cell; `rowIndex` is the index within the current page. */
  cell: (row: T, rowIndex: number) => ReactNode
  align?: 'left' | 'center' | 'right'
  /** Extra classes for both the header and the body cells of this column. */
  className?: string
  /**
   * Role in the stacked (phone) layout: `heading` becomes the card title,
   * `hidden` is left out. By default a column is a "label: value" line.
   */
  mobile?: 'heading' | 'hidden'
  /** Makes the header a sort button (needs `onSortChange` on the table). */
  sortKey?: string
}

export interface DataTableSort {
  key: string
  direction: 'asc' | 'desc'
}

export interface DataTableProps<T> {
  columns: readonly DataTableColumn<T>[]
  data: readonly T[]
  getRowId: (row: T) => string
  /** Accessible name: the table caption, or the list label in the stacked layout. */
  caption: string
  /** First load: shows skeleton rows. */
  isLoading?: boolean
  /** Background refetch: dims the rows but keeps them visible. */
  isFetching?: boolean
  /** Shown instead of rows when `data` is empty. */
  emptyState?: ReactNode
  /** Renders a trailing actions cell (e.g. a `RowActionsMenu`). */
  rowActions?: (row: T) => ReactNode
  /** A visible heading over the actions cell ("Action"); by default it is for screen readers only. */
  rowActionsHeader?: string
  loadingRowCount?: number
  /**
   * `auto` (default): columns from the `md` breakpoint, stacked cards below it.
   * `table` / `cards` force one layout.
   */
  layout?: 'auto' | 'table' | 'cards'
  /** `brand`: purple header row and grey rows, as in the Roster designs. */
  appearance?: 'plain' | 'brand'
  /** Current sort, shown on the matching header. */
  sort?: DataTableSort | undefined
  /** Called with the next sort when a sortable header is clicked (asc → desc → asc). */
  onSortChange?: (sort: DataTableSort) => void
  className?: string
}

const alignClass = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const

const justifyClass = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
} as const

const brandHeadClass =
  'h-14 border-r border-white/25 bg-primary font-medium text-primary-foreground last:border-r-0 first:rounded-tl-md last:rounded-tr-md'

function nextSort(current: DataTableSort | undefined, key: string): DataTableSort {
  if (current?.key === key) return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
  return { key, direction: 'asc' }
}

function SortableHeader<T>({
  column,
  sort,
  onSortChange,
}: {
  column: DataTableColumn<T> & { sortKey: string }
  sort: DataTableSort | undefined
  onSortChange: (sort: DataTableSort) => void
}) {
  const active = sort?.key === column.sortKey
  const Icon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={() => {
        onSortChange(nextSort(sort, column.sortKey))
      }}
      className={cn(
        'inline-flex w-full items-center gap-1.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        justifyClass[column.align ?? 'left'],
      )}
    >
      {column.header}
      <Icon
        aria-hidden="true"
        className={cn('size-3.5 shrink-0', active ? 'opacity-100' : 'opacity-40')}
      />
    </button>
  )
}

/**
 * Generic, typed table built on the shadcn table primitives. On phones it
 * renders each row as a card of "label: value" lines instead of a table that
 * scrolls sideways. Data fetching, sorting and pagination stay with the caller.
 */
export function DataTable<T>(props: DataTableProps<T>) {
  const isWide = useMediaQuery(BREAKPOINTS.md)
  const layout = props.layout ?? 'auto'
  const stacked = layout === 'cards' || (layout === 'auto' && !isWide)
  return stacked ? <StackedRows {...props} /> : <ColumnTable {...props} />
}

function ColumnTable<T>({
  columns,
  data,
  getRowId,
  caption,
  isLoading = false,
  isFetching = false,
  emptyState = 'No records yet.',
  rowActions,
  rowActionsHeader,
  loadingRowCount = 5,
  appearance = 'plain',
  sort,
  onSortChange,
  className,
}: DataTableProps<T>) {
  const columnCount = columns.length + (rowActions ? 1 : 0)
  const brand = appearance === 'brand'
  const rowClassName = brand
    ? 'border-b-2 border-card bg-muted/80 hover:bg-muted dark:bg-muted/60'
    : undefined

  return (
    <Table className={className} aria-busy={isLoading || isFetching}>
      <TableCaption className="sr-only">{caption}</TableCaption>
      <TableHeader className={cn(brand && '[&_tr]:border-0')}>
        <TableRow className="hover:bg-transparent">
          {columns.map((column) => {
            const sortKey = column.sortKey
            const sorted = sortKey !== undefined && sort?.key === sortKey
            return (
              <TableHead
                key={column.id}
                scope="col"
                aria-sort={
                  sorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined
                }
                className={cn(
                  alignClass[column.align ?? 'left'],
                  brand && brandHeadClass,
                  column.className,
                )}
              >
                {sortKey !== undefined && onSortChange ? (
                  <SortableHeader
                    column={{ ...column, sortKey }}
                    sort={sort}
                    onSortChange={onSortChange}
                  />
                ) : (
                  column.header
                )}
              </TableHead>
            )
          })}
          {rowActions && (
            <TableHead
              scope="col"
              className={cn('w-14', rowActionsHeader && 'text-right', brand && brandHeadClass)}
            >
              {rowActionsHeader ?? <span className="sr-only">Actions</span>}
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody className={cn('transition-opacity', isFetching && !isLoading && 'opacity-60')}>
        {isLoading ? (
          Array.from({ length: loadingRowCount }, (_, index) => (
            <TableRow key={`loading-${index}`} className="hover:bg-transparent">
              {Array.from({ length: columnCount }, (__, cellIndex) => (
                <TableCell key={cellIndex}>
                  <Skeleton className="mx-auto h-4 w-3/4" />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : data.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columnCount} className="h-32 text-center text-muted-foreground">
              {emptyState}
            </TableCell>
          </TableRow>
        ) : (
          data.map((row, rowIndex) => (
            <TableRow key={getRowId(row)} className={rowClassName}>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  className={cn(alignClass[column.align ?? 'left'], column.className)}
                >
                  {column.cell(row, rowIndex)}
                </TableCell>
              ))}
              {rowActions && <TableCell className="w-14 text-right">{rowActions(row)}</TableCell>}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

/**
 * Phones have no column headers to click, so sortable lists get a
 * "Sort by" select and an ascending / descending button above the cards.
 */
function StackedSortBar<T>({
  columns,
  sort,
  onSortChange,
}: {
  columns: readonly DataTableColumn<T>[]
  sort: DataTableSort | undefined
  onSortChange: (sort: DataTableSort) => void
}) {
  const sortable = columns.filter(
    (column): column is DataTableColumn<T> & { sortKey: string } => column.sortKey !== undefined,
  )
  if (sortable.length === 0) return null
  const direction = sort?.direction ?? 'asc'
  const DirectionIcon = direction === 'asc' ? ArrowUp : ArrowDown

  return (
    <div className="mb-3 flex items-center gap-2">
      <Select
        value={sort?.key ?? ''}
        onValueChange={(key) => {
          onSortChange({ key, direction: sort?.key === key ? direction : 'asc' })
        }}
      >
        <SelectTrigger aria-label="Sort by" className="h-10 min-w-0 flex-1">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {sortable.map((column) => (
            <SelectItem key={column.sortKey} value={column.sortKey}>
              {typeof column.header === 'string' ? column.header : column.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon-lg"
        disabled={!sort}
        aria-label={
          direction === 'asc'
            ? 'Sorted A to Z, switch to Z to A'
            : 'Sorted Z to A, switch to A to Z'
        }
        onClick={() => {
          if (sort) onSortChange({ key: sort.key, direction: direction === 'asc' ? 'desc' : 'asc' })
        }}
      >
        <DirectionIcon />
      </Button>
    </div>
  )
}

function StackedRows<T>(props: DataTableProps<T>) {
  const { columns, sort, onSortChange } = props
  return (
    <div>
      {onSortChange && <StackedSortBar columns={columns} sort={sort} onSortChange={onSortChange} />}
      <StackedList {...props} />
    </div>
  )
}

function StackedList<T>({
  columns,
  data,
  getRowId,
  caption,
  isLoading = false,
  isFetching = false,
  emptyState = 'No records yet.',
  rowActions,
  loadingRowCount = 5,
  className,
}: DataTableProps<T>) {
  const heading = columns.find((column) => column.mobile === 'heading')
  const lines = columns.filter((column) => column.mobile === undefined)

  if (isLoading) {
    return (
      <div aria-busy="true" className={cn('flex flex-col gap-3', className)}>
        <span className="sr-only">Loading {caption.toLowerCase()}</span>
        {Array.from({ length: Math.min(loadingRowCount, 3) }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <p className={cn('py-10 text-center text-sm text-muted-foreground', className)}>
        {emptyState}
      </p>
    )
  }

  return (
    <ul
      aria-label={caption}
      aria-busy={isFetching}
      className={cn(
        'divide-y divide-border transition-opacity',
        isFetching && 'opacity-60',
        className,
      )}
    >
      {data.map((row, rowIndex) => (
        <li key={getRowId(row)} className="flex items-start gap-2 py-4 first:pt-1 last:pb-1">
          <div className="min-w-0 flex-1">
            {heading && (
              <p className="mb-2 text-base font-medium break-words text-heading">
                {heading.cell(row, rowIndex)}
              </p>
            )}
            <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
              {lines.map((column) => (
                <Fragment key={column.id}>
                  <dt className="text-label">{column.header}</dt>
                  <dd className="min-w-0 break-words text-heading">{column.cell(row, rowIndex)}</dd>
                </Fragment>
              ))}
            </dl>
          </div>
          {rowActions && <div className="-mt-1 shrink-0">{rowActions(row)}</div>}
        </li>
      ))}
    </ul>
  )
}
