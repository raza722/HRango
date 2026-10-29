import type { ReactNode } from 'react'

import { columnEditable, type PmAccess } from '../../hooks/use-pm-access'
import type { TaskRow, Workspace } from '../../types/pm.types'
import { DueDateCell, StartDateCell } from '../task-fields/date-field'
import { FieldPopover, PopupHeader } from '../task-fields/field-popup'
import { formatCellDate } from '../task-fields/field-utils'

/**
 * A task at a glance, from a Calendar chip or a Timeline bar: its code, status and people, its
 * Start and Due Date (the List view's date cells: the calendar popup with times and repeats),
 * and "Open in List view". It is also the keyboard's way to change a task's dates there.
 */
export function TaskPeek({
  task,
  workspace,
  tasks,
  access,
  open,
  onOpenChange,
  onOpenTask,
  trigger,
}: {
  task: TaskRow
  workspace: Workspace
  /** Every task of the view, for the date cells. */
  tasks: readonly TaskRow[]
  access: PmAccess
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenTask: (task: TaskRow) => void
  trigger: ReactNode
}) {
  const status = workspace.setup.statuses.find((entry) => entry.id === task.statusId)
  const canEditStart = access.editTasks && columnEditable(workspace, 'startDate')
  const canEditDue = access.editTasks && columnEditable(workspace, 'dueDate')
  const dates = [
    { label: 'Start Date', value: task.startDate, editable: canEditStart, Cell: StartDateCell },
    { label: 'Due Date', value: task.dueDate, editable: canEditDue, Cell: DueDateCell },
  ]

  return (
    <FieldPopover
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      label={task.name}
      className="w-[min(20rem,calc(100vw-1rem))] px-4 py-3.5"
    >
      <div className="grid gap-3">
        <PopupHeader
          title={task.name}
          onClose={() => {
            onOpenChange(false)
          }}
        />
        <p className="flex flex-wrap items-center gap-2 text-xs text-[#707070] dark:text-grey">
          <span>{task.code}</span>
          {status && (
            <span className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ backgroundColor: status.color }}
              />
              {status.name}
            </span>
          )}
          {task.isOverdue && (
            <span className="font-medium text-[#B7192C] dark:text-[#FF9AA3]">Overdue</span>
          )}
        </p>
        <p className="text-xs text-[#4A4A4A] dark:text-title">
          {task.assignees.length > 0
            ? task.assignees.map((entry) => entry.name).join(', ')
            : 'Not assigned'}
        </p>
        {dates.map(({ label, value, editable, Cell }) => (
          <div key={label} className="grid gap-1">
            <span className="text-xs font-medium text-[#303030] dark:text-title">{label}</span>
            {editable ? (
              <Cell task={task} workspace={workspace} tasks={tasks} />
            ) : (
              <span className="text-sm text-[#626262] dark:text-title">
                {value ? formatCellDate(value) : '—'}
              </span>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            onOpenChange(false)
            onOpenTask(task)
          }}
          className="justify-self-start rounded-lg px-2 py-1 text-sm font-semibold text-[#7127EA] outline-none hover:bg-[#F8F5FF] focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:text-[#C4ABFF] dark:hover:bg-[#7127EA]/15"
        >
          Open in List view
        </button>
      </div>
    </FieldPopover>
  )
}
