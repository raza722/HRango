import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { usePeople } from '../../hooks/use-pm'
import { useOpenComments } from '../comments/comments-context'
import { ChevronDownIcon, CommentIcon, CopyIcon } from './field-icons'
import { PersonAvatar } from './field-popup'
import { fieldStyles } from './field-styles'
import { taskLink, taskProgress } from './field-utils'
import type { TaskCellProps } from './task-cell-types'

/** A read-only cell: the white box with its value (Medium 18.97 #626262). */
const box = cn(fieldStyles.cell, 'cursor-default pl-3 hover:border-[#E9E9E9]')
const empty = <span className="text-[0.8125rem] text-[#B0B0B0]">-</span>

/** The Task Name column's plain name (the List view draws its own name with the adornments). */
export const NameCell = ({ task }: TaskCellProps) => (
  <span className="truncate text-[0.8125rem] text-[#4F4F4F]">{task.name}</span>
)

/** Progress Bar (Workspace Page 1:2755): the share of subtasks closed, green on grey, and the %. */
export function ProgressCell({ task, tasks, workspace }: TaskCellProps) {
  const { done, total, percent } = taskProgress(task, tasks, workspace)
  const label = tasks.some((other) => other.parentId === task.id)
    ? `${done} of ${total} subtasks closed`
    : percent === 100
      ? 'Task closed'
      : 'Task open'
  return (
    <div
      className="flex h-10 w-full min-w-0 items-center gap-2.5 rounded-[0.5625rem] bg-white px-2.5"
      title={label}
    >
      <div
        role="progressbar"
        aria-label={`Progress of ${task.name}`}
        aria-valuetext={`${percent}%, ${label}`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="relative flex h-[0.55rem] min-w-0 flex-1 items-center"
      >
        <span className="absolute inset-x-0 h-[0.45rem] rounded-full bg-[#E7E7E7]" />
        <span
          className="relative h-[0.55rem] rounded-full bg-[#2CBD4D]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-sm font-semibold text-[#626262]">
        {percent}%
      </span>
    </div>
  )
}

/** Task ID (`#HR000000001`): the copy icon copies the task's address ("URL Copied Successfully"). */
export function TaskIdCell({ task }: TaskCellProps) {
  const [copied, setCopied] = useState<'done' | 'failed' | null>(null)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => {
      setCopied(null)
    }, 2000)
    return () => {
      window.clearTimeout(timer)
    }
  }, [copied])

  return (
    <div className={cn(box, 'pl-1.5')}>
      <Tooltip open={copied !== null}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(taskLink(task, window.location.origin)).then(
                () => {
                  setCopied('done')
                },
                () => {
                  setCopied('failed')
                },
              )
            }}
            aria-label={`Copy the link of ${task.code}`}
            className={cn(fieldStyles.cellIcon, 'transition-colors hover:bg-[#EEE7FF]')}
          >
            <CopyIcon />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className={fieldStyles.tooltip}>
          {copied === 'failed' ? 'The URL could not be copied' : 'URL Copied Successfully'}
        </TooltipContent>
      </Tooltip>
      <span className="truncate">{task.code}</span>
    </div>
  )
}

/** Created by: the avatar and name; hovering shows the designation and department. */
export function CreatedByCell({ task }: TaskCellProps) {
  const people = usePeople()
  const person = people.get(task.createdById)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div tabIndex={0} className={cn(box, 'gap-2.5 pl-1.5')}>
          <PersonAvatar person={person} />
          <span className="truncate">{person?.name ?? 'Unknown'}</span>
        </div>
      </TooltipTrigger>
      {person && (
        <TooltipContent
          side="bottom"
          className="flex flex-col gap-1 rounded-lg bg-white px-3 py-2 text-[0.6875rem] font-medium text-[#5D5D5D] shadow-[0_0_10px_rgba(0,0,0,0.12)]"
        >
          <span>Designation: {person.designation || '-'}</span>
          <span>Department: {person.department || '-'}</span>
        </TooltipContent>
      )}
    </Tooltip>
  )
}

const instant = (value: string | null) => (
  <div className={box}>
    {value ? <span className="truncate">{format(parseISO(value), 'M/d/yyyy')}</span> : empty}
  </div>
)

export const DateCreatedCell = ({ task }: TaskCellProps) => instant(task.createdAt)
export const DateClosedCell = ({ task }: TaskCellProps) => instant(task.closedAt)

/** Latest Comment: the newest comment's text; clicking it opens the task's Comments panel. */
export function LatestCommentCell({ task }: TaskCellProps) {
  const people = usePeople()
  const openComments = useOpenComments()
  const comment = task.latestComment
  const author = comment ? (people.get(comment.authorId)?.name ?? 'Someone') : null

  return (
    <button
      type="button"
      onClick={() => {
        openComments({ taskId: task.id, workspaceId: task.workspaceId })
      }}
      aria-label={
        comment
          ? `Latest comment by ${author ?? ''}: ${comment.body}. Open comments`
          : `Comment on ${task.name}`
      }
      className={fieldStyles.cell}
    >
      <span className={fieldStyles.cellIcon}>
        <CommentIcon />
      </span>
      {comment ? (
        <span className="truncate">{comment.body}</span>
      ) : (
        <span className={cn(fieldStyles.placeholder, 'text-[#909090]')}>Add a comment</span>
      )}
      <ChevronDownIcon className={fieldStyles.cellChevron} />
    </button>
  )
}
