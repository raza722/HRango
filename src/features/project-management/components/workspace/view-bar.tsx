import { type ReactNode, useRef } from 'react'

import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { COLUMN_LABELS, PRIORITY_META, VIEW_LABELS } from '../../constants'
import {
  type ListColumn,
  type PmPerson,
  PRIORITIES,
  TASK_COLUMN_KEYS,
  type TaskColumnKey,
  type TaskType,
  VIEW_KINDS,
  type ViewKind,
  type Workspace,
} from '../../types/pm.types'
import { filterCount, hideColumn, showColumn, stepColumn, type TaskFilters } from './list-utils'
import { PmMenu, PmMenuContent, PmMenuItem, PmMenuLabel, PmMenuTrigger } from './menu-parts'
import { VIEW_ICONS } from './view-icons'
import {
  ChevronDownIcon,
  CustomizeIcon,
  FiltersIcon,
  MilestoneIcon,
  PlusIcon,
  TaskIcon,
} from './workspace-icons'
import { popupStyles } from './workspace-styles'

/** View, Filters and Customize buttons: 51 px, 12 px radius, Medium 18 #3D3D3D, icons #5D5D5D. */
const barButton =
  'inline-flex h-[3.1875rem] shrink-0 items-center gap-[0.6875rem] rounded-xl px-4 text-lg leading-[1.5] font-medium text-[#3D3D3D] outline-none transition-colors hover:bg-[#F8F5FF] focus-visible:ring-2 focus-visible:ring-[#A181FF] data-[state=open]:bg-[#F8F5FF] [&_svg]:text-[#5D5D5D]'

/** The 35 px grey rules between the view buttons and before Add Task. */
const Divider = () => (
  <span
    aria-hidden="true"
    className="mx-1 hidden h-[2.1875rem] w-[0.156rem] shrink-0 rounded-full bg-[#CECECE] sm:block"
  />
)

/**
 * The view bar (Header Section 1:3769): List and the workspace's other views, "+ View", Filters,
 * Customize and the purple "Add Task" button with its drop-down.
 */
export function ViewBar({
  workspace,
  view,
  onView,
  onAddView,
  filters,
  onFilters,
  members,
  onColumns,
  onAddTask,
}: {
  workspace: Workspace
  view: ViewKind
  onView: (view: ViewKind) => void
  onAddView: (view: ViewKind) => void
  filters: TaskFilters
  onFilters: (filters: TaskFilters) => void
  members: readonly PmPerson[]
  onColumns: (columns: ListColumn[]) => void
  onAddTask: (type: TaskType) => void
}) {
  const views = VIEW_KINDS.filter((kind) => kind === 'list' || workspace.setup.views.includes(kind))
  const missing = VIEW_KINDS.filter((kind) => !views.includes(kind))

  return (
    <div className="flex min-h-[4.6875rem] flex-wrap items-center gap-2 rounded-xl bg-white p-3">
      <nav aria-label="Views" className="flex min-w-0 flex-wrap items-center gap-2">
        {views.map((kind) => {
          const { Icon, size } = VIEW_ICONS[kind]
          const active = kind === view
          return (
            <button
              key={kind}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                onView(kind)
              }}
              className={cn(
                barButton,
                active && 'bg-[#F8F5FF] font-semibold text-[#7127EA] [&_svg]:text-[#7127EA]',
              )}
            >
              <Icon className={size} />
              {VIEW_LABELS[kind]}
            </button>
          )
        })}
        <Divider />
        <PmMenu modal={false}>
          <PmMenuTrigger asChild disabled={missing.length === 0}>
            <button
              type="button"
              aria-label="Add View"
              className={cn(barButton, 'disabled:opacity-50')}
            >
              <PlusIcon className="size-[0.904rem]" />
              View
            </button>
          </PmMenuTrigger>
          <PmMenuContent align="start" className="w-[16rem]">
            <PmMenuLabel>Add View</PmMenuLabel>
            {missing.map((kind) => {
              const { Icon } = VIEW_ICONS[kind]
              return (
                <PmMenuItem
                  key={kind}
                  icon={<Icon />}
                  onSelect={() => {
                    onAddView(kind)
                  }}
                >
                  {VIEW_LABELS[kind]}
                </PmMenuItem>
              )
            })}
          </PmMenuContent>
        </PmMenu>
      </nav>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <FiltersPopover
          workspace={workspace}
          filters={filters}
          onFilters={onFilters}
          members={members}
        />
        <CustomizePopover columns={workspace.columns} onColumns={onColumns} />
        <Divider />
        <AddTaskSplit onAddTask={onAddTask} />
      </div>
    </div>
  )
}

/** "Add Task": 141 × 51, purple gradient; the chevron opens Task / Milestone. */
function AddTaskSplit({ onAddTask }: { onAddTask: (type: TaskType) => void }) {
  const picked = useRef(false)
  return (
    <div className="inline-flex h-[3.1875rem] shrink-0 overflow-hidden rounded-xl bg-[linear-gradient(161.34deg,#7127EA_12.62%,#AB84EA_142.91%)] text-white">
      <button
        type="button"
        onClick={() => {
          onAddTask('task')
        }}
        className="pr-2.5 pl-4 text-lg leading-[1.5] font-semibold outline-none hover:bg-white/10 focus-visible:bg-white/15"
      >
        Add Task
      </button>
      <PmMenu modal={false}>
        <PmMenuTrigger asChild>
          <button
            type="button"
            aria-label="More ways to add a task"
            className="pr-4 pl-1 outline-none hover:bg-white/10 focus-visible:bg-white/15"
          >
            <ChevronDownIcon className="h-[0.6rem] w-[1.0625rem]" />
          </button>
        </PmMenuTrigger>
        <PmMenuContent
          align="end"
          className="w-[13rem]"
          onCloseAutoFocus={(event) => {
            if (picked.current) event.preventDefault()
            picked.current = false
          }}
        >
          <PmMenuItem
            icon={<TaskIcon />}
            onSelect={() => {
              picked.current = true
              onAddTask('task')
            }}
          >
            Task
          </PmMenuItem>
          <PmMenuItem
            icon={<MilestoneIcon />}
            onSelect={() => {
              picked.current = true
              onAddTask('milestone')
            }}
          >
            Milestone
          </PmMenuItem>
        </PmMenuContent>
      </PmMenu>
    </div>
  )
}

function CheckRow({
  id,
  label,
  checked,
  disabled,
  onChange,
  children,
}: {
  id: string
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
  children?: ReactNode
}) {
  return (
    <li className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#FAFAFA]">
      <Checkbox
        id={id}
        tone="violet"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => {
          onChange(value === true)
        }}
        className="size-4"
      />
      <label htmlFor={id} className="min-w-0 flex-1 truncate text-[0.8125rem] text-[#4F4F4F]">
        {label}
      </label>
      {children}
    </li>
  )
}

function FiltersPopover({
  workspace,
  filters,
  onFilters,
  members,
}: {
  workspace: Workspace
  filters: TaskFilters
  onFilters: (filters: TaskFilters) => void
  members: readonly PmPerson[]
}) {
  const count = filterCount(filters)
  const toggle = <K extends keyof TaskFilters>(
    key: K,
    value: TaskFilters[K][number],
    on: boolean,
  ) => {
    const current = filters[key] as TaskFilters[K][number][]
    onFilters({
      ...filters,
      [key]: on ? [...current, value] : current.filter((entry) => entry !== value),
    })
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(barButton, count > 0 && 'text-[#7127EA]')}>
          <FiltersIcon className="h-[1.1875rem] w-[1.0625rem]" />
          Filters
          {count > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-[#7127EA] text-[0.6875rem] text-white">
              {count}
              <span className="sr-only"> active</span>
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn(
          popupStyles.content,
          'flex max-h-[28rem] w-[20rem] flex-col gap-3 overflow-y-auto',
        )}
      >
        <div className="flex items-center justify-between">
          <h2 className={popupStyles.title}>Filters</h2>
          <button
            type="button"
            disabled={count === 0}
            onClick={() => {
              onFilters({ statusIds: [], priorities: [], assigneeIds: [] })
            }}
            className="text-xs font-medium text-[#7127EA] hover:underline disabled:opacity-40"
          >
            Clear all
          </button>
        </div>
        <fieldset className="flex flex-col gap-1">
          <legend className="pb-1 text-xs font-medium text-[#909090]">Status</legend>
          <ul>
            {workspace.setup.statuses.map((status) => (
              <CheckRow
                key={status.id}
                id={`filter-status-${status.id}`}
                label={status.name}
                checked={filters.statusIds.includes(status.id)}
                onChange={(on) => {
                  toggle('statusIds', status.id, on)
                }}
              />
            ))}
          </ul>
        </fieldset>
        <fieldset className="flex flex-col gap-1">
          <legend className="pb-1 text-xs font-medium text-[#909090]">Priority</legend>
          <ul>
            {PRIORITIES.map((priority) => (
              <CheckRow
                key={priority}
                id={`filter-priority-${priority}`}
                label={PRIORITY_META[priority].label}
                checked={filters.priorities.includes(priority)}
                onChange={(on) => {
                  toggle('priorities', priority, on)
                }}
              />
            ))}
            <CheckRow
              id="filter-priority-none"
              label="No priority"
              checked={filters.priorities.includes('none')}
              onChange={(on) => {
                toggle('priorities', 'none', on)
              }}
            />
          </ul>
        </fieldset>
        <fieldset className="flex flex-col gap-1">
          <legend className="pb-1 text-xs font-medium text-[#909090]">Assignee</legend>
          <ul>
            {members.map((person) => (
              <CheckRow
                key={person.id}
                id={`filter-assignee-${person.id}`}
                label={person.name}
                checked={filters.assigneeIds.includes(person.id)}
                onChange={(on) => {
                  toggle('assigneeIds', person.id, on)
                }}
              />
            ))}
          </ul>
        </fieldset>
      </PopoverContent>
    </Popover>
  )
}

/** Customize: show or hide each column and change their order. */
function CustomizePopover({
  columns,
  onColumns,
}: {
  columns: readonly ListColumn[]
  onColumns: (columns: ListColumn[]) => void
}) {
  // The list's columns in order, then any deleted ones.
  const keys: TaskColumnKey[] = [
    ...columns.map((column) => column.key),
    ...TASK_COLUMN_KEYS.filter((key) => !columns.some((column) => column.key === key)),
  ]
  const visible = [
    'name',
    ...columns.filter((c) => c.visible && c.key !== 'name').map((c) => c.key),
  ]
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={barButton}>
          <CustomizeIcon className="h-[1.18rem] w-[1.13rem]" />
          Customize
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn(
          popupStyles.content,
          'flex max-h-[30rem] w-[20rem] flex-col gap-2 overflow-y-auto',
        )}
      >
        <h2 className={popupStyles.title}>Customize</h2>
        <p className={popupStyles.text}>Choose the columns of the List view and their order.</p>
        <ul aria-label="Columns">
          {keys.map((key) => {
            const shownAt = visible.indexOf(key)
            const isShown = shownAt >= 0
            const label = COLUMN_LABELS[key]
            return (
              <CheckRow
                key={key}
                id={`customize-${key}`}
                label={label}
                checked={isShown}
                disabled={key === 'name'}
                onChange={(on) => {
                  onColumns(on ? showColumn(columns, key) : hideColumn(columns, key))
                }}
              >
                {isShown && key !== 'name' && (
                  <span className="flex shrink-0 gap-0.5">
                    <button
                      type="button"
                      aria-label={`Move ${label} up`}
                      disabled={shownAt <= 1}
                      onClick={() => {
                        onColumns(stepColumn(columns, key, -1))
                      }}
                      className="flex size-6 items-center justify-center rounded text-[#7127EA] hover:bg-[#F0E9FD] disabled:opacity-30"
                    >
                      <ChevronDownIcon className="size-4 rotate-180" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${label} down`}
                      disabled={shownAt === visible.length - 1}
                      onClick={() => {
                        onColumns(stepColumn(columns, key, 1))
                      }}
                      className="flex size-6 items-center justify-center rounded text-[#7127EA] hover:bg-[#F0E9FD] disabled:opacity-30"
                    >
                      <ChevronDownIcon className="size-4" />
                    </button>
                  </span>
                )}
              </CheckRow>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
