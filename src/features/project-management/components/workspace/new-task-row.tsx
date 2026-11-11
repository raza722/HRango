import { cn } from '@/lib/utils'

import type { TaskStatus, TaskType } from '../../types/pm.types'
import { useListView } from './list-context'
import { COLUMN_WIDTHS, TAIL_WIDTH } from './list-utils'
import { useTaskComposer } from './use-task-composer'
import { MilestoneIcon, StatusRingIcon } from './workspace-icons'
import { listStyles } from './workspace-styles'

/**
 * The inline new-task row under a status group, drawn as a task row with the name box open:
 * Enter saves and keeps the row open for the next task, Escape closes it.
 */
export function NewTaskRow({
  status,
  type,
  listId,
  onClose,
}: {
  status: TaskStatus
  type: TaskType
  listId: string | null
  onClose: () => void
}) {
  const { workspace } = useListView()
  // Enter clears the box at once and saves in the background (see useTaskComposer).
  const { name, change, error, submit, savingText, label } = useTaskComposer({
    workspaceId: workspace.id,
    listId,
    statusId: status.id,
    type,
  })
  const errorId = `new-task-error-${status.id}`

  return (
    <form
      aria-label={`New ${label} in ${status.name}`}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className={listStyles.row}
    >
      <div
        className={cn(listStyles.stickyStart, 'gap-2 pr-2 pl-1.5')}
        style={{ width: COLUMN_WIDTHS.name }}
      >
        <span className="w-[6.65rem] shrink-0" aria-hidden="true" />
        <div className="flex h-[3.6875rem] min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#7127EA] bg-white pr-2 ring-4 ring-[#7127EA]/20 dark:bg-card">
          <span
            aria-hidden="true"
            className="ml-[0.594rem] flex size-[2.4rem] shrink-0 items-center justify-center rounded-[0.52rem] bg-[#F8F8F8] dark:bg-white/5"
            style={{ color: status.color }}
          >
            {type === 'milestone' ? (
              <MilestoneIcon className="size-[1.4rem]" />
            ) : (
              <StatusRingIcon className="size-[1.55rem]" />
            )}
          </span>
          <input
            autoFocus
            value={name}
            maxLength={200}
            aria-label={type === 'milestone' ? 'Milestone name' : 'Task name'}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            placeholder={type === 'milestone' ? 'Milestone Name' : 'Task Name'}
            onChange={(event) => {
              change(event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
              }
            }}
            className="h-9 min-w-0 flex-1 bg-transparent text-[1.1858rem] font-medium text-[#626262] outline-none placeholder:text-[#A4A4A4] dark:text-title"
          />
          <button
            type="button"
            onClick={onClose}
            className="h-9 shrink-0 rounded-lg bg-[#B7192C] px-3 text-sm font-semibold text-white hover:bg-[#9b1524]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="h-9 shrink-0 rounded-lg bg-[#318845] px-4 text-sm font-semibold text-white hover:bg-[#287238]"
          >
            Save
          </button>
        </div>
      </div>
      <div className={cn(listStyles.middle, 'gap-4 px-5')}>
        {error && (
          <span id={errorId} role="alert" className="text-sm text-[#DC3545] dark:text-[#FF8A94]">
            {error}
          </span>
        )}
        <span role="status" className="text-sm text-[#707070] dark:text-grey">
          {savingText}
        </span>
      </div>
      <div className={listStyles.tail} style={{ width: TAIL_WIDTH }} />
    </form>
  )
}
