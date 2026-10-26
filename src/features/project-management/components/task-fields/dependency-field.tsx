import { type ReactNode, useState } from 'react'

import { cn } from '@/lib/utils'

import { PRIORITY_META } from '../../constants'
import {
  useAddDependency,
  useCreateTask,
  usePeople,
  useRemoveDependency,
  useTaskDetail,
  useTasks,
} from '../../hooks/use-pm'
import type { TaskDependency, TaskRow, Workspace } from '../../types/pm.types'
import {
  BackIcon,
  BlockingIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FlagFilledIcon,
  LinkIcon,
  PlusIcon,
  WaitingOnIcon,
  WarningIcon,
} from './field-icons'
import { FieldPopover, PersonAvatar, PopupHeader, SearchField } from './field-popup'
import { fieldStyles } from './field-styles'
import {
  DEPENDENCY_KIND,
  type DependencyRelation,
  formatCellDate,
  formatDuration,
  PRIORITY_FLAG_COLORS,
  ROLLUP_COLUMNS,
  type RollupColumn,
  trackedMinutes,
} from './field-utils'
import { RemoveButton } from './remove-button'
import { StatusChip } from './status-chip'
import type { TaskCellProps } from './task-cell-types'

interface Relation {
  key: DependencyRelation
  title: string
  hint: string
  Icon: typeof WaitingOnIcon
}

const WAITING_ON: Relation = {
  key: 'waitingOn',
  title: 'Waiting On',
  hint: 'Task that must be completed before this task',
  Icon: WaitingOnIcon,
}
const BLOCKING: Relation = {
  key: 'blocking',
  title: 'Blocking',
  hint: 'Tasks that can’t start until this task is completed',
  Icon: BlockingIcon,
}
const RELATIONS = [WAITING_ON, BLOCKING]
const relationOf = (key: DependencyRelation) => (key === 'waitingOn' ? WAITING_ON : BLOCKING)

/** "Waiting On" / "Blocking" label (#EBE6FF, radius 5) with its icon. */
function RelationLabel({ relation }: { relation: DependencyRelation }) {
  const { title, Icon } = relationOf(relation)
  return (
    <span className="flex h-[1.2rem] shrink-0 items-center gap-1.5 rounded-[0.25rem] bg-[#EBE6FF] px-1.5 text-[0.71875rem] font-medium text-[#626262]">
      <Icon className="size-[0.95rem]" />
      {title}
    </span>
  )
}

/**
 * Dependencies column (Workspace Page 1:2755): the first link with its "Waiting On" / "Blocking"
 * label, a warning while a task it waits on is open. The row carries the counts (open tasks it
 * waits on, tasks it blocks); the links themselves are read when the popup opens.
 */
export function DependenciesCell({ task, workspace, tasks }: TaskCellProps) {
  const [open, setOpen] = useState(false)
  const count = task.openDependencyCount + task.blockingCount
  const blocked = task.openDependencyCount > 0
  const firstRelation: DependencyRelation = blocked ? 'waitingOn' : 'blocking'
  const shown = blocked ? task.openDependencyCount : task.blockingCount

  return (
    <DependenciesPopover
      open={open}
      onOpenChange={setOpen}
      task={task}
      workspace={workspace}
      tasks={tasks}
      trigger={
        <button
          type="button"
          aria-label={
            count > 0
              ? `Dependencies: ${count} linked ${count === 1 ? 'task' : 'tasks'}${blocked ? ', waiting on an open task' : ''}`
              : `Add dependencies to ${task.name}`
          }
          className={fieldStyles.cell}
        >
          {count > 0 ? (
            <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-[#F6F4FF] py-[0.15rem] pr-2 pl-[0.2rem]">
              <RelationLabel relation={firstRelation} />
              <span className="min-w-0 truncate">
                {shown} {shown === 1 ? 'task' : 'tasks'}
              </span>
              {count > shown && (
                <span className="shrink-0 text-[0.6875rem] font-semibold text-[#7127EA]">
                  +{count - shown}
                </span>
              )}
            </span>
          ) : (
            <>
              <span className={fieldStyles.cellIcon}>
                <LinkIcon />
              </span>
              <span className={cn(fieldStyles.placeholder, 'text-[#909090]')}>Dependencies</span>
            </>
          )}
          {blocked && <WarningIcon className="h-[0.85rem] w-auto shrink-0 text-[#B0A042]" />}
          <ChevronDownIcon className={cn(fieldStyles.cellChevron, count > 0 && 'ml-0')} />
        </button>
      }
    />
  )
}

interface DependenciesPopoverProps extends TaskCellProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: ReactNode
}

/** Dependencies popup (1:8476), also opened from the warning icon after a task's name. */
export function DependenciesPopover({
  open,
  onOpenChange,
  trigger,
  task,
  workspace,
  tasks,
}: DependenciesPopoverProps) {
  return (
    <FieldPopover
      open={open}
      onOpenChange={onOpenChange}
      label="Dependencies"
      className="w-[min(59.5rem,calc(100vw-1rem))] px-[1.1rem] py-[0.75rem]"
      trigger={trigger}
    >
      <DependenciesPanel
        task={task}
        workspace={workspace}
        fallback={tasks}
        onClose={() => {
          onOpenChange(false)
        }}
      />
    </FieldPopover>
  )
}

const ROLLUP_STORAGE = (workspaceId: string) => `hrms-pm-rollups-${workspaceId}`

function readRollups(workspaceId: string): RollupColumn[] {
  try {
    const raw = window.localStorage.getItem(ROLLUP_STORAGE(workspaceId))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? ROLLUP_COLUMNS.map((column) => column.key).filter((key) => parsed.includes(key))
      : []
  } catch {
    return []
  }
}

interface DependenciesPanelProps {
  task: TaskRow
  workspace: Workspace
  /** The view's tasks, used until the whole workspace's tasks arrive. */
  fallback: readonly TaskRow[]
  onClose: () => void
}

function DependenciesPanel({
  task: rowTask,
  workspace,
  fallback,
  onClose,
}: DependenciesPanelProps) {
  // Links can reach tasks of other lists, so the popup reads the whole workspace.
  const { data } = useTasks(workspace.id, null)
  const all = data ?? fallback
  const task = all.find((other) => other.id === rowTask.id) ?? rowTask
  const detail = useTaskDetail(rowTask.id)
  const addDependency = useAddDependency()
  const removeDependency = useRemoveDependency()
  const [rollups, setRollups] = useState<RollupColumn[]>(() => readRollups(workspace.id))
  const dependencies = detail.data?.dependencies ?? []
  const links = dependencies
    .filter((entry) => entry.kind !== 'linked')
    .map((entry): { link: TaskDependency; relation: DependencyRelation } => ({
      link: entry,
      relation: entry.kind === 'blocking' ? 'blocking' : 'waitingOn',
    }))
  const linkedIds = new Set([task.id, ...dependencies.map((entry) => entry.taskId)])

  const changeRollups = (next: RollupColumn[]) => {
    setRollups(next)
    try {
      window.localStorage.setItem(ROLLUP_STORAGE(workspace.id), JSON.stringify(next))
    } catch {
      // Storage may be unavailable (private window); the choice then lasts until reload.
    }
  }

  /** `POST /tasks/{id}/dependencies`; the API keeps both sides. */
  const link = async (other: Pick<TaskRow, 'id'>, relation: DependencyRelation) => {
    try {
      await addDependency.mutateAsync({
        taskId: task.id,
        otherTaskId: other.id,
        kind: DEPENDENCY_KIND[relation],
      })
      return true
    } catch {
      return false
    }
  }

  const unlink = (dependencyId: string) => {
    removeDependency.mutate(dependencyId)
  }

  return (
    <div className="flex flex-col gap-3">
      <PopupHeader title="Dependencies" onClose={onClose} />
      <div className={cn(fieldStyles.panel, 'p-[0.9rem]')}>
        <div className={cn(fieldStyles.card, 'flex min-w-0 flex-col px-[0.9rem] py-[0.6rem]')}>
          <div className="flex justify-end">
            <RollupMenu value={rollups} onChange={changeRollups} />
          </div>
          <div className={cn(fieldStyles.divider, 'my-[0.6rem]')} />

          <div className={cn(fieldStyles.scroll, 'overflow-x-auto pb-1')}>
            {detail.isPending ? (
              <p className="flex h-[2.4rem] items-center px-3 text-[0.8125rem] text-[#909090]">
                Loading dependencies...
              </p>
            ) : links.length === 0 ? (
              <p className="flex h-[2.4rem] items-center rounded-[0.5625rem] border border-[#E9E9E9] px-3 text-[0.8125rem] font-medium text-[#626262]">
                There are no tasks to link as dependencies
              </p>
            ) : (
              <table className="w-full min-w-max border-separate border-spacing-x-0 border-spacing-y-1.5">
                {rollups.length > 0 && (
                  <thead>
                    <tr>
                      <th className="px-1 text-left">
                        <span className="sr-only">Task</span>
                      </th>
                      {rollups.map((key) => (
                        <th key={key} className="px-1 text-left">
                          <span className="flex h-7 items-center rounded-[0.25rem] bg-[#F8F5FF] px-2 text-[0.8125rem] font-semibold whitespace-nowrap text-[#626262]">
                            {ROLLUP_COLUMNS.find((column) => column.key === key)?.label}
                          </span>
                        </th>
                      ))}
                      <th className="w-8">
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                )}
                <tbody>
                  {links.map(({ link: entry, relation }) => (
                    <LinkedTaskRow
                      key={entry.id}
                      link={entry}
                      task={all.find((other) => other.id === entry.taskId)}
                      relation={relation}
                      workspace={workspace}
                      rollups={rollups}
                      onRemove={() => {
                        unlink(entry.id)
                      }}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className={cn(fieldStyles.divider, 'my-[0.6rem]')} />
          <div>
            <AddDependency
              task={task}
              workspace={workspace}
              tasks={all}
              linkedIds={linkedIds}
              onLink={link}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

interface LinkedTaskRowProps {
  /** The link as the API lists it (the other task's code, name and status). */
  link: TaskDependency
  task: TaskRow | undefined
  relation: DependencyRelation
  workspace: Workspace
  rollups: readonly RollupColumn[]
  onRemove: () => void
}

const linkCell =
  'h-11 border-y border-[#E9E9E9] bg-white px-2 text-[0.8125rem] font-medium whitespace-nowrap text-[#626262]'

/** One link: the status, the relation label and the name, then any roll-up columns. */
function LinkedTaskRow({ link, task, relation, workspace, rollups, onRemove }: LinkedTaskRowProps) {
  const people = usePeople()
  if (!task) {
    // A task of another list or workspace view: what the link itself tells.
    return (
      <tr>
        <td
          className={cn(linkCell, 'rounded-l-[0.5625rem] border-l pl-2.5')}
          colSpan={rollups.length + 1}
        >
          <span className="flex items-center gap-2">
            <StatusChip
              status={{
                id: '',
                name: link.statusName,
                color: link.statusColor ?? '#979797',
                group: 'active',
              }}
            />
            <span className="flex min-w-0 items-center gap-2 rounded-md bg-[#F6F4FF] py-[0.15rem] pr-2 pl-[0.2rem]">
              <RelationLabel relation={relation} />
              <span className="max-w-[26rem] truncate">{link.name}</span>
            </span>
          </span>
        </td>
        <td className={cn(linkCell, 'rounded-r-[0.5625rem] border-r')}>
          <RemoveButton label={`Unlink ${link.name}`} onClick={onRemove} />
        </td>
      </tr>
    )
  }
  const status = workspace.setup.statuses.find((entry) => entry.id === task.statusId)

  const value = (key: RollupColumn): ReactNode => {
    switch (key) {
      case 'status':
        return <StatusChip status={status} />
      case 'assignees':
        return task.assigneeIds.length === 0 ? (
          '-'
        ) : (
          <span className="flex items-center">
            {task.assigneeIds.slice(0, 4).map((id, index) => (
              <PersonAvatar
                key={id}
                person={people.get(id)}
                className={cn('size-6 ring-white', index > 0 && '-ml-1.5')}
              />
            ))}
            {task.assigneeIds.length > 4 && (
              <span className="-ml-1.5 flex size-6 items-center justify-center rounded-full bg-[#7127EA] text-[0.625rem] text-white ring-[1.6px] ring-white">
                {task.assigneeIds.length - 4}+
              </span>
            )}
          </span>
        )
      case 'taskId':
        return task.code
      case 'priority':
        return task.priority ? (
          <span className="flex items-center gap-1.5">
            <FlagFilledIcon
              className="h-[0.85rem] w-auto"
              style={{ color: PRIORITY_FLAG_COLORS[task.priority] }}
            />
            {PRIORITY_META[task.priority].label}
          </span>
        ) : (
          '-'
        )
      case 'startDate':
        return task.startDate ? formatCellDate(task.startDate) : '-'
      case 'dueDate':
        return task.dueDate ? formatCellDate(task.dueDate) : '-'
      case 'dateCreated':
        return formatCellDate(task.createdAt.slice(0, 10))
      case 'dateClosed':
        return task.closedAt ? formatCellDate(task.closedAt.slice(0, 10)) : '-'
      case 'timeEstimate':
        return task.timeEstimateMinutes ? formatDuration(task.timeEstimateMinutes) : '-'
      case 'timeTracked': {
        const minutes = trackedMinutes(task)
        return minutes > 0 ? formatDuration(minutes) : '-'
      }
    }
  }

  return (
    <tr>
      <td className={cn(linkCell, 'rounded-l-[0.5625rem] border-l pl-2.5')}>
        <span className="flex items-center gap-2">
          {!rollups.includes('status') && <StatusChip status={status} />}
          <span className="flex min-w-0 items-center gap-2 rounded-md bg-[#F6F4FF] py-[0.15rem] pr-2 pl-[0.2rem]">
            <RelationLabel relation={relation} />
            <span className="max-w-[26rem] truncate">{task.name}</span>
          </span>
        </span>
      </td>
      {rollups.map((key) => (
        <td key={key} className={linkCell}>
          {value(key)}
        </td>
      ))}
      <td className={cn(linkCell, 'w-8 rounded-r-[0.5625rem] border-r pr-2.5')}>
        <RemoveButton label={`Unlink ${task.name}`} onClick={onRemove} />
      </td>
    </tr>
  )
}

/** "+ Add a Roll-up": search and tick the linked tasks' fields to show as columns. */
function RollupMenu({
  value,
  onChange,
}: {
  value: RollupColumn[]
  onChange: (value: RollupColumn[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const query = search.trim().toLowerCase()
  const listed = ROLLUP_COLUMNS.filter((column) => column.label.toLowerCase().includes(query))

  const toggle = (key: RollupColumn) => {
    onChange(
      value.includes(key)
        ? value.filter((other) => other !== key)
        : ROLLUP_COLUMNS.map((column) => column.key).filter(
            (other) => other === key || value.includes(other),
          ),
    )
  }

  return (
    <FieldPopover
      open={open}
      onOpenChange={setOpen}
      label="Add a Roll-up"
      align="end"
      className="w-[min(19rem,calc(100vw-1rem))] p-[0.7rem]"
      trigger={
        <button type="button" className={fieldStyles.purpleLink}>
          <PlusIcon className="size-4" />
          Add a Roll-up
        </button>
      }
    >
      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Search fields"
        label="Search fields"
        className="h-9 w-full flex-none"
      />
      <ul className={cn(fieldStyles.scroll, 'mt-3 flex max-h-80 flex-col gap-1.5 overflow-y-auto')}>
        {listed.map((column) => (
          <li key={column.key}>
            <label className="flex h-10 cursor-pointer items-center gap-2.5 rounded-[0.5625rem] border border-[#E9E9E9] bg-white px-3 text-[0.8125rem] font-semibold tracking-[0.01em] text-[#4A4A4A] hover:bg-[#F8F5FF]">
              <input
                type="checkbox"
                checked={value.includes(column.key)}
                onChange={() => {
                  toggle(column.key)
                }}
                className="size-4 accent-[#7127EA]"
              />
              {column.label}
            </label>
          </li>
        ))}
      </ul>
    </FieldPopover>
  )
}

interface AddDependencyProps {
  task: TaskRow
  workspace: Workspace
  tasks: readonly TaskRow[]
  /** The task and the tasks already linked to it. */
  linkedIds: ReadonlySet<string>
  onLink: (other: Pick<TaskRow, 'id'>, relation: DependencyRelation) => Promise<boolean>
}

/**
 * "+ Add Task" and its Add Link menu (Waiting On, Blocking, Create New Task), then the Add Task
 * popup with Recent Task and Browse Task (the workspace's lists).
 */
function AddDependency({ task, workspace, tasks, linkedIds, onLink }: AddDependencyProps) {
  const [open, setOpen] = useState(false)
  const [relation, setRelation] = useState<DependencyRelation | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const createTask = useCreateTask()

  const close = () => {
    setOpen(false)
    setRelation(null)
    setCreating(false)
    setName('')
  }

  const create = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      const created = await createTask.mutateAsync({
        workspaceId: workspace.id,
        listId: task.listId,
        parentId: null,
        name: trimmed,
      })
      if (await onLink(created, 'waitingOn')) close()
    } catch {
      // The mutation cache shows the server's message.
    }
  }

  return (
    <FieldPopover
      open={open}
      onOpenChange={(next) => {
        if (next) setOpen(true)
        else close()
      }}
      label={relation ? 'Add Task' : 'Add Link'}
      className={cn(
        'p-[0.9rem]',
        relation ? 'w-[min(44rem,calc(100vw-1rem))]' : 'w-[min(21rem,calc(100vw-1rem))]',
      )}
      trigger={
        <button type="button" className={fieldStyles.purpleLink}>
          <PlusIcon className="size-4" />
          Add Task
        </button>
      }
    >
      {relation ? (
        <TaskPicker
          workspace={workspace}
          tasks={tasks}
          linkedIds={linkedIds}
          relation={relation}
          onBack={() => {
            setRelation(null)
          }}
          onPick={async (other) => {
            if (await onLink(other, relation)) close()
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <h3 className={fieldStyles.popupTitle}>Add Link</h3>
          {RELATIONS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => {
                setRelation(entry.key)
              }}
              className="flex flex-col gap-2 rounded-[0.5625rem] border border-transparent bg-[#F8F8F8] p-3 text-left transition-colors hover:border-[#7127EA]"
            >
              <span className="flex items-center gap-2 text-[0.8125rem] font-semibold text-[#626262]">
                <entry.Icon className="size-4" />
                {entry.title}
              </span>
              <span className="text-[0.71875rem] font-medium text-[#626262]">{entry.hint}</span>
            </button>
          ))}
          {creating ? (
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                void create()
              }}
              className="flex gap-2"
            >
              <label className="min-w-0 flex-1">
                <span className="sr-only">New task name</span>
                <input
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                  }}
                  maxLength={200}
                  placeholder="Task name"
                  className={fieldStyles.input}
                />
              </label>
              <button
                type="submit"
                disabled={createTask.isPending || !name.trim()}
                className="h-9 rounded-[0.5625rem] bg-[#7127EA] px-3 text-xs font-semibold text-white hover:bg-[#5f1fd0] disabled:opacity-60"
              >
                Create
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setCreating(true)
              }}
              className={cn(fieldStyles.purpleLink, 'self-start')}
            >
              <PlusIcon className="size-4" />
              Create New Task
            </button>
          )}
        </div>
      )}
    </FieldPopover>
  )
}

interface TaskPickerProps {
  workspace: Workspace
  linkedIds: ReadonlySet<string>
  tasks: readonly TaskRow[]
  relation: DependencyRelation
  onBack: () => void
  onPick: (other: TaskRow) => Promise<void>
}

/** "Add Task as a Waiting On Dependencies": Recent Task, or Browse Task through the lists. */
function TaskPicker({ workspace, linkedIds, tasks, relation, onBack, onPick }: TaskPickerProps) {
  const people = usePeople()
  const [browse, setBrowse] = useState(false)
  const [listId, setListId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const candidates = tasks.filter((other) => !linkedIds.has(other.id))
  const query = search.trim().toLowerCase()
  const matches = (other: TaskRow) =>
    !query || other.name.toLowerCase().includes(query) || other.code.toLowerCase().includes(query)
  const lists = workspace.items.filter((item) => item.kind === 'list')
  const folderName = (parentId: string | null) =>
    workspace.items.find((item) => item.id === parentId)?.name ?? workspace.name

  const recent = candidates
    .filter(matches)
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6)
  const inList = candidates.filter(
    (other) => (listId === '' ? other.listId === null : other.listId === listId) && matches(other),
  )

  const row = (other: TaskRow, showCode: boolean) => {
    const status = workspace.setup.statuses.find((entry) => entry.id === other.statusId)
    const parent = other.parentId ? tasks.find((entry) => entry.id === other.parentId) : undefined
    return (
      <li key={other.id}>
        <button
          type="button"
          onClick={() => {
            void onPick(other)
          }}
          aria-label={`Link ${other.name}`}
          className="flex min-h-[2.6rem] w-full items-center gap-2.5 rounded-[0.5625rem] bg-[#F7F7F7] px-2 py-1 text-left transition-colors hover:bg-[#EEE7FF]"
        >
          <StatusChip status={status} />
          <span className="flex min-w-0 flex-1 flex-col">
            {parent && (
              <span className="truncate text-[0.625rem] font-medium text-[#626262]">
                {parent.name}
              </span>
            )}
            <span className="truncate text-[0.8125rem] font-medium text-[#626262]">
              {other.name}
            </span>
          </span>
          {showCode && (
            <span className="shrink-0 text-[0.8125rem] font-medium text-[#7127EA]">
              {other.code}
            </span>
          )}
          <span className="flex shrink-0 items-center">
            {other.assigneeIds.slice(0, 4).map((id, index) => (
              <PersonAvatar
                key={id}
                person={people.get(id)}
                className={cn('size-6 ring-white', index > 0 && '-ml-1.5')}
              />
            ))}
          </span>
        </button>
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => {
            if (browse && listId !== null) setListId(null)
            else if (browse) setBrowse(false)
            else onBack()
          }}
          aria-label="Back"
          className="flex size-[2.0625rem] shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#7127EA] text-[#7127EA] hover:bg-[#F8F5FF]"
        >
          <BackIcon className="size-5" />
        </button>
        <span className="text-[0.8125rem] font-semibold text-[#626262]">
          Add as {relationOf(relation).title}
        </span>
      </div>
      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Search task name or ID"
        label="Search tasks"
        className="h-9 w-full flex-none"
      />
      <div className="flex items-center justify-between px-0.5">
        <h4 className={fieldStyles.sectionTitle}>
          {browse ? (listId === null ? 'Workspace Lists' : 'Tasks') : 'Recent Task'}
        </h4>
        {!browse && (
          <button
            type="button"
            onClick={() => {
              setBrowse(true)
              setListId(null)
            }}
            className={fieldStyles.link}
          >
            Browse task
          </button>
        )}
      </div>
      <ul
        className={cn(
          fieldStyles.scroll,
          'flex max-h-[16rem] flex-col gap-2 overflow-y-auto pr-1.5',
        )}
      >
        {!browse && recent.map((other) => row(other, false))}
        {browse &&
          listId === null &&
          [...lists, { id: '', name: workspace.name, parentId: null }].map((list) => (
            <li key={list.id || 'top'}>
              <button
                type="button"
                onClick={() => {
                  setListId(list.id)
                }}
                className="flex h-[2.6rem] w-full items-center gap-2.5 rounded-[0.5625rem] bg-[#F7F7F7] px-3 text-left text-[0.8125rem] font-medium text-[#626262] hover:bg-[#EEE7FF]"
              >
                <span className="min-w-0 flex-1 truncate">
                  {list.id ? list.name : `${workspace.name} (no list)`}
                </span>
                {list.id && (
                  <span className="truncate text-[0.6875rem] text-[#909090]">
                    {folderName(list.parentId)}
                  </span>
                )}
                <ChevronRightIcon className="size-4 shrink-0 text-[#7127EA]" />
              </button>
            </li>
          ))}
        {browse && listId !== null && inList.map((other) => row(other, true))}
        {((!browse && recent.length === 0) ||
          (browse && listId !== null && inList.length === 0)) && (
          <li className={cn(fieldStyles.muted, 'px-1')}>No tasks to link</li>
        )}
      </ul>
    </div>
  )
}
