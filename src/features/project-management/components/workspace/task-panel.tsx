import { type ReactNode, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CornerLeftUp, Link2, MessageSquare, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { columnFromApi } from '../../api/pm.mappers'
import { useDeleteTask, useRecordRecent, useTaskActivity, useTaskDetail } from '../../hooks/use-pm'
import { columnEditable, type PmAccess } from '../../hooks/use-pm-access'
import type { TaskColumnKey, TaskRow, Workspace } from '../../types/pm.types'
import { useOpenComments } from '../comments/comments-context'
import { formatCellDate, taskLink } from '../task-fields/field-utils'
import { TASK_CELLS } from '../task-fields/task-cells'
import { useTaskSave } from '../task-fields/use-task-save'
import { ActivitySentence } from './activity-sentence'
import { READ_ONLY_INERT } from './list-utils'
import { useTaskComposer } from './use-task-composer'

/**
 * The fields the panel lists, in order, with their labels here (the List view's headers read as
 * actions, "Add Assignee", "Set Priority"). Task Name is the title; Latest Comment has its part.
 */
const PANEL_FIELDS: readonly { key: TaskColumnKey; label: string }[] = [
  { key: 'status', label: 'Status' },
  { key: 'assignees', label: 'Assignees' },
  { key: 'startDate', label: 'Start date' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'priority', label: 'Priority' },
  { key: 'tags', label: 'Tags' },
  { key: 'labels', label: 'Labels' },
  { key: 'dependencies', label: 'Dependencies' },
  { key: 'timeEstimate', label: 'Time estimate' },
  { key: 'timeTracked', label: 'Time tracked' },
  { key: 'storyPoints', label: 'Story points' },
  { key: 'files', label: 'Files' },
  { key: 'progress', label: 'Subtask progress' },
  { key: 'createdBy', label: 'Created by' },
  { key: 'dateCreated', label: 'Date created' },
  { key: 'dateClosed', label: 'Date closed' },
]

const DESCRIPTION_MAX = 5000

const iconButton =
  'inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-[#5D5D5D] outline-none transition-colors hover:bg-[#F0E9FD] hover:text-[#7127EA] focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:text-title dark:hover:bg-[#7127EA]/15'
const sectionTitle = 'text-sm font-semibold text-[#303030] dark:text-title'
const card = 'rounded-xl border border-[#ECECEC] bg-white p-4 dark:border-border dark:bg-card'

export interface TaskPanelProps {
  /** The open task (`?task=`); null closes the panel. */
  taskId: string | null
  workspace: Workspace
  /** Every task of the page (before search and filters): fields, subtasks and the parent. */
  tasks: readonly TaskRow[]
  /** Columns that are Private Fields for the caller (API keys): not shown. */
  hiddenColumns: readonly string[]
  access: PmAccess
  /** Opens another task in the panel (a subtask, the parent). */
  onOpenTask: (taskId: string) => void
  onClose: () => void
}

/**
 * The task panel: everything about one task in one place, beside the view it was opened from.
 * Its address is `?task=<id>`, so Copy link, Open in new tab, the dashboards and the inbox's
 * notification links (`/project-management/workspaces/{ws}?task={id}`) all open it.
 */
export function TaskPanel(props: TaskPanelProps) {
  const { taskId, onClose } = props
  return (
    <Sheet
      open={taskId !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        side="right"
        showClose={false}
        // Focus the panel itself, not the name box: a stray key must not rename the task.
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus()
        }}
        className="w-full max-w-[46rem] gap-0 border-l border-[#ECECEC] bg-[#F7F7FB] outline-none dark:border-border dark:bg-background"
      >
        {taskId && <PanelBody key={taskId} {...props} taskId={taskId} />}
      </SheetContent>
    </Sheet>
  )
}

function PanelBody({
  taskId,
  workspace,
  tasks,
  hiddenColumns,
  access,
  onOpenTask,
  onClose,
}: TaskPanelProps & { taskId: string }) {
  const detail = useTaskDetail(taskId)
  useRecordRecent('task', taskId)
  // The row of the page is live (every change refreshes it); the task's own read covers a task
  // the page does not list (another list, a link from elsewhere).
  const task = tasks.find((entry) => entry.id === taskId) ?? detail.data

  if (!task) {
    return detail.isError ? (
      <div className="flex flex-1 flex-col">
        <PanelHeaderBar onClose={onClose} />
        <div role="alert" className="m-5 flex flex-col items-center gap-2 py-10 text-center">
          <SheetTitle className="text-base font-semibold text-[#303030] dark:text-title">
            {detail.error.isNotFound ? 'Task not found' : 'Could not load the task'}
          </SheetTitle>
          <SheetDescription className="max-w-sm text-sm text-[#707070] dark:text-grey">
            {detail.error.isNotFound
              ? 'It may have been deleted, or it is not shared with you.'
              : detail.error.message}
          </SheetDescription>
        </div>
      </div>
    ) : (
      <div role="status" aria-label="Loading the task" className="flex flex-col gap-4 p-5">
        <SheetTitle className="sr-only">Loading the task</SheetTitle>
        <SheetDescription className="sr-only">The task's details are loading.</SheetDescription>
        <Skeleton className="h-8 w-2/3 bg-white" />
        <Skeleton className="h-48 bg-white" />
        <Skeleton className="h-24 bg-white" />
      </div>
    )
  }

  return (
    <PanelContent
      task={task}
      workspace={workspace}
      tasks={tasks}
      hiddenColumns={hiddenColumns}
      access={access}
      onOpenTask={onOpenTask}
      onClose={onClose}
    />
  )
}

/** The close button row, for the loading and not-found states. */
function PanelHeaderBar({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex justify-end border-b border-[#ECECEC] bg-white px-5 py-3 dark:border-border dark:bg-card">
      <button type="button" aria-label="Close task" onClick={onClose} className={iconButton}>
        <X className="size-5" />
      </button>
    </div>
  )
}

function PanelContent({
  task,
  workspace,
  tasks,
  hiddenColumns,
  access,
  onOpenTask,
  onClose,
}: Omit<TaskPanelProps, 'taskId'> & { task: TaskRow }) {
  const remove = useDeleteTask()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const status = workspace.setup.statuses.find((entry) => entry.id === task.statusId)
  const parent = task.parentId ? tasks.find((entry) => entry.id === task.parentId) : undefined
  const hidden = new Set(
    hiddenColumns.map((key) => columnFromApi(key, workspace.labelsFieldId)).filter(Boolean),
  )
  const fields = PANEL_FIELDS.filter(
    ({ key }) => !hidden.has(key) && (key !== 'labels' || workspace.labelsFieldId !== null),
  )

  const copyLink = () => {
    void navigator.clipboard.writeText(taskLink(task, window.location.origin)).then(
      () => toast.success('Task link copied'),
      () => toast.error('The link could not be copied'),
    )
  }

  return (
    <>
      <header className="flex shrink-0 items-start gap-3 border-b border-[#ECECEC] bg-white px-5 py-4 dark:border-border dark:bg-card">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-[#707070] dark:text-grey">
            {workspace.name}
            {task.listName ? ` › ${task.listName}` : ''}
          </p>
          <TaskTitle task={task} editable={access.editTasks} />
          <SheetDescription className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[#707070] dark:text-grey">
            <span className="font-medium">{task.code}</span>
            {status && (
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: status.color }}
                />
                {status.name}
              </span>
            )}
            {task.isOverdue && (
              <span className="rounded bg-[#FDECEE] px-1.5 py-0.5 font-medium text-[#B7192C] dark:bg-[#DC3545]/15 dark:text-[#FF9AA3]">
                Overdue
              </span>
            )}
            {task.isClosedLate && (
              <span className="rounded bg-[#FFF4E5] px-1.5 py-0.5 font-medium text-[#9A5B00] dark:bg-[#F79009]/15 dark:text-[#FFC266]">
                Closed late
              </span>
            )}
          </SheetDescription>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Copy task link"
            onClick={copyLink}
            className={iconButton}
          >
            <Link2 className="size-[1.125rem]" />
          </button>
          {access.deleteTasks && (
            <button
              type="button"
              aria-label="Delete task"
              onClick={() => {
                setConfirmDelete(true)
              }}
              className={cn(iconButton, 'hover:bg-[#FDECEE] hover:text-[#B7192C]')}
            >
              <Trash2 className="size-[1.125rem]" />
            </button>
          )}
          <button type="button" aria-label="Close task" onClick={onClose} className={iconButton}>
            <X className="size-5" />
          </button>
        </div>
      </header>

      <div className="flex scrollbar-thin min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
        {parent && (
          <button
            type="button"
            onClick={() => {
              onOpenTask(parent.id)
            }}
            className="inline-flex items-center gap-2 self-start rounded-lg px-2 py-1 text-sm font-medium text-[#7127EA] outline-none hover:bg-[#F0E9FD] focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:text-[#C4ABFF] dark:hover:bg-[#7127EA]/15"
          >
            <CornerLeftUp aria-hidden="true" className="size-4" />
            Subtask of {parent.name}
          </button>
        )}

        <Section title="Details">
          <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-[9.5rem_1fr]">
            {fields.map(({ key, label }) => {
              const Cell = TASK_CELLS[key]
              // As in the List view: Can View / Private Field, or no edit rights, shows the value
              // without opening its popup.
              const readOnly = !access.editTasks || !columnEditable(workspace, key)
              return (
                <div key={key} className="contents">
                  <dt className="pt-2 text-[0.8125rem] font-medium text-[#707070] dark:text-grey">
                    {label}
                  </dt>
                  <dd
                    inert={readOnly && READ_ONLY_INERT.has(key) ? true : undefined}
                    aria-readonly={readOnly || undefined}
                    className="flex min-h-10 min-w-0 items-center"
                  >
                    <Cell task={task} workspace={workspace} tasks={tasks} />
                  </dd>
                </div>
              )
            })}
          </dl>
        </Section>

        <Section title="Description">
          <DescriptionBox task={task} editable={access.editTasks} />
        </Section>

        <Subtasks
          task={task}
          workspace={workspace}
          tasks={tasks}
          canAdd={access.addTasks}
          onOpenTask={onOpenTask}
        />

        <CommentsPart task={task} />

        <History taskId={task.id} />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this task?"
        description={`${task.name} and its subtasks will be deleted. This cannot be undone.`}
        confirmLabel="Delete Task"
        variant="destructive"
        onConfirm={() => {
          remove.mutate(task, {
            onSuccess: () => {
              onClose()
            },
          })
        }}
      />
    </>
  )
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-label={title} className={card}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className={sectionTitle}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

/** The name as the panel's title: a box to rename it (Enter or leaving it saves, Escape undoes). */
function TaskTitle({ task, editable }: { task: TaskRow; editable: boolean }) {
  const { save } = useTaskSave()
  if (!editable) {
    return (
      <SheetTitle className="mt-1 text-xl leading-snug font-semibold break-words text-[#303030] dark:text-title">
        {task.name}
      </SheetTitle>
    )
  }
  const finish = (input: HTMLInputElement) => {
    const name = input.value.trim()
    if (!name) {
      input.value = task.name
      toast.error('A task needs a name')
      return
    }
    if (name !== task.name) void save(task.id, { name })
  }
  return (
    <>
      <SheetTitle className="sr-only">{task.name}</SheetTitle>
      <input
        // A new name from elsewhere (the List view) replaces what the box shows.
        key={task.name}
        defaultValue={task.name}
        aria-label="Task name"
        maxLength={200}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          } else if (event.key === 'Escape' && event.currentTarget.value !== task.name) {
            // Escape first undoes the edit; a second Escape closes the panel.
            event.preventDefault()
            event.stopPropagation()
            event.currentTarget.value = task.name
          }
        }}
        onBlur={(event) => {
          finish(event.currentTarget)
        }}
        className="mt-1 -ml-1.5 w-full rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-xl leading-snug font-semibold text-[#303030] outline-none hover:border-[#E9E9E9] focus:border-[#A181FF] focus:ring-[3px] focus:ring-[rgba(132,78,255,0.2)] dark:text-title"
      />
    </>
  )
}

/** The description, edited in place: Save and Cancel appear once it changes. */
function DescriptionBox({ task, editable }: { task: TaskRow; editable: boolean }) {
  const { save, isPending } = useTaskSave()
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? task.description
  const dirty = draft !== null && draft.trim() !== task.description.trim()

  if (!editable) {
    return task.description.trim() ? (
      <p className="text-sm whitespace-pre-wrap text-[#3D3D3D] dark:text-title">
        {task.description}
      </p>
    ) : (
      <p className="text-sm text-[#909090]">No description.</p>
    )
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (draft === null) return
        void save(task.id, { description: draft.trim() }).then((saved) => {
          if (saved) setDraft(null)
        })
      }}
      className="flex flex-col gap-2"
    >
      <textarea
        aria-label="Description"
        value={value}
        rows={4}
        maxLength={DESCRIPTION_MAX}
        placeholder="Add details, links or acceptance criteria…"
        onChange={(event) => {
          setDraft(event.target.value)
        }}
        onKeyDown={(event) => {
          // Escape undoes unsaved text before it closes the panel.
          if (event.key === 'Escape' && dirty) {
            event.preventDefault()
            event.stopPropagation()
            setDraft(null)
          }
        }}
        className="min-h-24 resize-y rounded-lg border border-[#E9E9E9] bg-white px-3 py-2 text-sm text-[#3D3D3D] outline-none placeholder:text-[#909090] focus:border-[#A181FF] focus:ring-[3px] focus:ring-[rgba(132,78,255,0.2)] dark:border-border dark:bg-card dark:text-title"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-[#909090]">
          {value.length}/{DESCRIPTION_MAX}
        </span>
        {dirty && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(null)
              }}
              className="h-9 rounded-lg px-4 text-sm font-medium text-[#5D5D5D] hover:bg-[#F4F4F4] dark:text-title dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="h-9 rounded-lg bg-[#7127EA] px-4 text-sm font-semibold text-white hover:bg-[#5f1fd0] disabled:opacity-60"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </form>
  )
}

function Subtasks({
  task,
  workspace,
  tasks,
  canAdd,
  onOpenTask,
}: {
  task: TaskRow
  workspace: Workspace
  tasks: readonly TaskRow[]
  canAdd: boolean
  onOpenTask: (taskId: string) => void
}) {
  const children = tasks
    .filter((entry) => entry.parentId === task.id)
    .toSorted((a, b) => a.order - b.order)
  const statusOf = (id: string) => workspace.setup.statuses.find((entry) => entry.id === id)
  const doneGroups = new Set(['done', 'closed'])
  const done = children.filter((child) => doneGroups.has(statusOf(child.statusId)?.group ?? ''))
  const composer = useTaskComposer({
    workspaceId: workspace.id,
    listId: task.listId,
    statusId: workspace.setup.statuses[0]?.id,
    type: 'task',
    parentId: task.id,
  })

  return (
    <Section
      title={children.length > 0 ? `Subtasks (${done.length}/${children.length} done)` : 'Subtasks'}
    >
      {children.length > 0 ? (
        <ul className="mb-3 flex flex-col divide-y divide-[#F1F1F1] dark:divide-border">
          {children.map((child) => {
            const status = statusOf(child.statusId)
            return (
              <li key={child.id}>
                <button
                  type="button"
                  onClick={() => {
                    onOpenTask(child.id)
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left outline-none hover:bg-[#F8F5FF] focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:hover:bg-[#7127EA]/10"
                >
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: status?.color ?? '#979797' }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-[#303030] dark:text-title">
                    {child.name}
                  </span>
                  <span className="shrink-0 text-xs text-[#909090]">
                    {status?.name}
                    {child.dueDate ? ` · ${formatCellDate(child.dueDate)}` : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mb-3 text-sm text-[#909090]">No subtasks yet.</p>
      )}
      {canAdd && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            composer.submit()
          }}
          className="flex flex-col gap-1"
        >
          <div className="flex gap-2">
            <input
              value={composer.name}
              maxLength={200}
              aria-label="New subtask name"
              aria-invalid={composer.error ? true : undefined}
              placeholder="Add a subtask and press Enter"
              onChange={(event) => {
                composer.change(event.target.value)
              }}
              className="h-10 min-w-0 flex-1 rounded-lg border border-[#E9E9E9] bg-white px-3 text-sm text-[#3D3D3D] outline-none placeholder:text-[#909090] focus:border-[#A181FF] focus:ring-[3px] focus:ring-[rgba(132,78,255,0.2)] dark:border-border dark:bg-card dark:text-title"
            />
            <button
              type="submit"
              className="h-10 shrink-0 rounded-lg bg-[#F0E9FD] px-4 text-sm font-semibold text-[#7127EA] hover:bg-[#E4D8FC] dark:bg-[#7127EA]/20 dark:text-[#C4ABFF]"
            >
              Add
            </button>
          </div>
          {composer.error && (
            <p role="alert" className="text-xs text-[#DC3545] dark:text-[#FF8A94]">
              {composer.error}
            </p>
          )}
          <p role="status" className="text-xs text-[#909090]">
            {composer.savingText}
          </p>
        </form>
      )}
    </Section>
  )
}

/** The latest comment and the way into the thread (the Comments panel). */
function CommentsPart({ task }: { task: TaskRow }) {
  const openComments = useOpenComments()
  const latest = task.latestComment
  return (
    <Section
      title={task.commentCount > 0 ? `Comments (${task.commentCount})` : 'Comments'}
      action={
        <button
          type="button"
          onClick={() => {
            openComments({ taskId: task.id, workspaceId: task.workspaceId })
          }}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#F0E9FD] px-3 text-sm font-semibold text-[#7127EA] hover:bg-[#E4D8FC] dark:bg-[#7127EA]/20 dark:text-[#C4ABFF]"
        >
          <MessageSquare aria-hidden="true" className="size-4" />
          {task.commentCount > 0 ? 'Open comments' : 'Add a comment'}
        </button>
      }
    >
      {latest ? (
        <figure className="rounded-lg bg-[#F8F5FF] px-3 py-2 dark:bg-[#7127EA]/10">
          <blockquote className="line-clamp-3 text-sm text-[#3D3D3D] dark:text-title">
            {latest.body}
          </blockquote>
          <figcaption className="mt-1 text-xs text-[#707070] dark:text-grey">
            {latest.authorName ?? 'Someone'} · {format(parseISO(latest.createdAt), 'd MMM, h:mm a')}
          </figcaption>
        </figure>
      ) : (
        <p className="text-sm text-[#909090]">No comments yet.</p>
      )}
    </Section>
  )
}

/** The task's history, newest first (`GET /tasks/{id}/activity`), 30 lines at a time. */
function History({ taskId }: { taskId: string }) {
  const activity = useTaskActivity(taskId)
  const lines = activity.data?.pages.flatMap((page) => page.data) ?? []
  return (
    <Section title="History">
      {activity.isPending ? (
        <Skeleton className="h-16 bg-[#F4F4F4]" />
      ) : activity.isError ? (
        <p role="alert" className="text-sm text-[#B7192C] dark:text-[#FF9AA3]">
          Could not load the history. {activity.error.message}
        </p>
      ) : lines.length === 0 ? (
        <p className="text-sm text-[#909090]">Nothing has changed yet.</p>
      ) : (
        <>
          <ol className="flex flex-col gap-2.5">
            {lines.map((entry) => (
              <li key={entry.id} className="text-sm text-[#5D5D5D] dark:text-grey">
                <span className="font-medium text-[#303030] dark:text-title">
                  {entry.performedByName ?? 'Someone'}
                </span>{' '}
                <ActivitySentence entry={entry} item="this task" />
                <span className="block text-xs text-[#909090]">
                  {format(parseISO(entry.performedAt), 'd MMM yyyy, h:mm a')}
                </span>
              </li>
            ))}
          </ol>
          {activity.hasNextPage && (
            <button
              type="button"
              disabled={activity.isFetchingNextPage}
              onClick={() => {
                void activity.fetchNextPage()
              }}
              className="mt-3 h-9 rounded-lg px-3 text-sm font-semibold text-[#7127EA] hover:bg-[#F0E9FD] disabled:opacity-60 dark:text-[#C4ABFF]"
            >
              {activity.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </Section>
  )
}
