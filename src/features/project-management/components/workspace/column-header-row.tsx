import type { ComponentProps, ReactNode } from 'react'
import { DropdownMenu as Menu } from 'radix-ui'

import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { COLUMN_LABELS } from '../../constants'
import { TASK_COLUMN_KEYS, type TaskColumnKey } from '../../types/pm.types'
import { type ColumnAction, useListView } from './list-context'
import { addableColumns, COLUMN_GAP, COLUMN_WIDTHS, TAIL_WIDTH } from './list-utils'
import { PmMenu, PmMenuContent, PmMenuItem, PmMenuLabel, PmMenuTrigger } from './menu-parts'
import {
  AddColumnIcon,
  ChevronRightIcon,
  ClearSortIcon,
  HideIcon,
  MoveEndIcon,
  MoveStartIcon,
  PermissionIcon,
  PlusIcon,
  SortArrowsIcon,
  SortBottomIcon,
  SortTopIcon,
} from './workspace-icons'
import { headerMenuStyles, listStyles } from './workspace-styles'

/** The column headers of one status group (task row group 1:2779, column headers 1:11452). */
export function ColumnHeaderRow({
  groupLabel,
  taskIds,
}: {
  groupLabel: string
  /** Every task drawn in the group, for "select all". */
  taskIds: readonly string[]
}) {
  const { columns, selected, onSelect, onShowColumn, workspace, access, layout } = useListView()
  const chosen = taskIds.filter((id) => selected.has(id)).length
  // The Table view shows every column already; its columns are not arranged here.
  const addable = layout === 'table' ? [] : addableColumns(workspace.columns, TASK_COLUMN_KEYS)

  const name = columns.find((column) => column.key === 'name')
  const rest = columns.filter((column) => column.key !== 'name')

  return (
    <div role="row" className={listStyles.headerRow}>
      {name && (
        <div
          className={cn(listStyles.stickyStart, 'gap-2 rounded-l-[0.625rem] pl-[0.8125rem]')}
          style={{ width: COLUMN_WIDTHS.name }}
        >
          <span role="columnheader" className="flex shrink-0">
            <Checkbox
              aria-label={`Select all ${groupLabel} tasks`}
              disabled={taskIds.length === 0}
              checked={chosen === 0 ? false : chosen === taskIds.length ? true : 'indeterminate'}
              onCheckedChange={(checked) => {
                onSelect(taskIds, checked === true)
              }}
              className={listStyles.checkbox}
            />
          </span>
          <ColumnHeader columnKey="name" />
        </div>
      )}
      <div className={listStyles.middle} style={{ paddingRight: COLUMN_GAP }}>
        {rest.map((column) => (
          <ColumnHeader key={column.key} columnKey={column.key} />
        ))}
      </div>
      <div className={cn(listStyles.tail, 'rounded-r-[0.625rem]')} style={{ width: TAIL_WIDTH }}>
        <PmMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <PmMenuTrigger asChild disabled={addable.length === 0 || access.rank === 0}>
                <button
                  type="button"
                  aria-label="Add Column"
                  className="flex size-[1.84rem] items-center justify-center rounded-full border-[0.075rem] border-[#F0EDFF] bg-[linear-gradient(61.34deg,#7127EA_8.55%,#B792F4_149.44%)] text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:outline-none disabled:opacity-40 dark:border-border"
                >
                  <AddColumnIcon className="size-[0.742rem]" />
                </button>
              </PmMenuTrigger>
            </TooltipTrigger>
            <TooltipContent className="rounded-full bg-[#282828] px-4 text-[0.6rem] text-white">
              {addable.length ? 'Add Column' : 'Every column is shown'}
            </TooltipContent>
          </Tooltip>
          <PmMenuContent align="end" className="max-h-[24rem] min-w-[15rem]">
            <PmMenuLabel>Add Column</PmMenuLabel>
            {addable.map((key) => (
              <PmMenuItem
                key={key}
                icon={<PlusIcon />}
                onSelect={() => {
                  onShowColumn(key)
                }}
              >
                {COLUMN_LABELS[key]}
              </PmMenuItem>
            ))}
          </PmMenuContent>
        </PmMenu>
      </div>
    </div>
  )
}

function ColumnHeader({ columnKey }: { columnKey: TaskColumnKey }) {
  const { sort, onSort, onColumnAction, onOpenPermission, access, layout } = useListView()
  /** Members keep their own column layout (List view only); readers who are not members cannot. */
  const canArrange = access.rank > 0 && layout === 'list'
  const label = COLUMN_LABELS[columnKey]
  const direction = sort?.key === columnKey ? sort.direction : null
  const isName = columnKey === 'name'

  const cycleSort = () => {
    if (direction === null) onSort({ key: columnKey, direction: 'asc' })
    else if (direction === 'asc') onSort({ key: columnKey, direction: 'desc' })
    else onSort(null)
  }

  const action = (value: ColumnAction) => () => {
    onColumnAction(columnKey, value)
  }

  return (
    <div
      role="columnheader"
      aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}
      className={cn('flex shrink-0', isName && 'min-w-0 flex-1 pr-2')}
      style={isName ? undefined : { width: COLUMN_WIDTHS[columnKey], marginLeft: COLUMN_GAP }}
    >
      <div className={cn(listStyles.headerCell, isName && 'w-full')}>
        <PmMenu modal={false}>
          <PmMenuTrigger asChild>
            <button
              type="button"
              aria-label={`${label} column menu`}
              className="min-w-0 truncate rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-[#A181FF]"
            >
              {label}
            </button>
          </PmMenuTrigger>
          <Menu.Portal>
            <Menu.Content
              align="start"
              sideOffset={10}
              collisionPadding={8}
              className={headerMenuStyles.content}
            >
              <Menu.Label className={headerMenuStyles.title}>Sorting Order</Menu.Label>
              <HeaderCheck
                icon={<SortTopIcon />}
                checked={direction === 'asc'}
                onSelect={action('sort-asc')}
              >
                Sort as Top
              </HeaderCheck>
              <HeaderCheck
                icon={<SortBottomIcon />}
                checked={direction === 'desc'}
                onSelect={action('sort-desc')}
              >
                Sort as Bottom
              </HeaderCheck>
              <Menu.Separator className={headerMenuStyles.separator} />
              {!isName && canArrange && (
                <>
                  <HeaderItem icon={<MoveStartIcon />} onSelect={action('move-start')}>
                    Move to Start
                  </HeaderItem>
                  <HeaderItem icon={<MoveEndIcon />} onSelect={action('move-end')}>
                    Move to End
                  </HeaderItem>
                </>
              )}
              <HeaderItem
                icon={<ClearSortIcon />}
                disabled={direction === null}
                onSelect={action('clear-sort')}
              >
                Clear Sort
              </HeaderItem>
              {!isName && access.editWorkspace && (
                <HeaderItem
                  icon={<PermissionIcon />}
                  trailing={
                    <ChevronRightIcon className="h-3 w-1.5 shrink-0 text-[#7127EA] dark:text-[#C4ABFF]" />
                  }
                  onSelect={() => {
                    onOpenPermission(columnKey)
                  }}
                >
                  Add Role Permission
                </HeaderItem>
              )}
              {!isName && canArrange && (
                <>
                  <Menu.Separator className={headerMenuStyles.separator} />
                  <HeaderItem icon={<HideIcon />} onSelect={action('hide')}>
                    Hide Column
                  </HeaderItem>
                  <Menu.Item className={headerMenuStyles.danger} onSelect={action('delete')}>
                    Delete Column
                  </Menu.Item>
                </>
              )}
            </Menu.Content>
          </Menu.Portal>
        </PmMenu>
        <button
          type="button"
          onClick={cycleSort}
          aria-label={`Sort by ${label}`}
          className="flex h-6 w-4 shrink-0 items-center justify-center rounded text-[#7127EA] outline-none hover:bg-[#F0E9FD] focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:text-[#C4ABFF] dark:hover:bg-[#7127EA]/25"
        >
          <SortArrowsIcon direction={direction} className="h-[1.195rem] w-[0.7rem]" />
        </button>
      </div>
    </div>
  )
}

function HeaderItem({
  icon,
  trailing,
  children,
  ...props
}: ComponentProps<typeof Menu.Item> & { icon: ReactNode; trailing?: ReactNode }) {
  return (
    <Menu.Item className={headerMenuStyles.item} {...props}>
      <span className="flex size-6 shrink-0 items-center justify-center text-[#7127EA] dark:text-[#C4ABFF] [&_svg]:size-5">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </Menu.Item>
  )
}

function HeaderCheck({
  icon,
  children,
  ...props
}: ComponentProps<typeof Menu.CheckboxItem> & { icon: ReactNode }) {
  return (
    <Menu.CheckboxItem className={headerMenuStyles.item} {...props}>
      <span className="flex size-6 shrink-0 items-center justify-center text-[#7127EA] dark:text-[#C4ABFF] [&_svg]:size-5">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </Menu.CheckboxItem>
  )
}
