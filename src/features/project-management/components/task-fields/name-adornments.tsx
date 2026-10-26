import { useState } from 'react'
import { toast } from 'sonner'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import type { TaskRow } from '../../types/pm.types'
import { DependenciesPopover } from './dependency-field'
import { DescriptionIcon, LinkIcon, WarningIcon } from './field-icons'
import { FieldPopover, PopupHeader } from './field-popup'
import { fieldStyles } from './field-styles'
import { taskLink } from './field-utils'
import type { TaskCellProps } from './task-cell-types'
import { useTaskSave } from './use-task-save'

const DESCRIPTION_MAX = 5000

/** The coloured chips after a name: 27 x 20 px, radius 4 (Workspace Page task row). */
const iconButton =
  'flex h-[1.25rem] w-[1.7rem] shrink-0 items-center justify-center rounded-[0.27rem] transition-[filter] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:outline-none [&_svg]:h-[0.8rem] [&_svg]:w-auto'

/**
 * The icons after a task's name (Workspace Page 1:2755): description (opens the editor; shown
 * faintly on row hover when there is none), the dependency warning while a task it waits on is
 * open (shows the dependencies), and the link (copies the task's address).
 */
export function TaskNameAdornments({ task, workspace, tasks }: TaskCellProps) {
  const [descriptionOpen, setDescriptionOpen] = useState(false)
  const [dependenciesOpen, setDependenciesOpen] = useState(false)
  // Open tasks this one waits on (the row's count; the popup lists them).
  const blockers = task.openDependencyCount
  const hasDescription = task.description.trim() !== ''

  const copyLink = () => {
    void navigator.clipboard.writeText(taskLink(task, window.location.origin)).then(
      () => toast.success('Task link copied'),
      () => toast.error('The link could not be copied'),
    )
  }

  return (
    <span className="flex shrink-0 items-center gap-[0.3rem]">
      <FieldPopover
        open={descriptionOpen}
        onOpenChange={setDescriptionOpen}
        label="Description"
        className="w-[min(24rem,calc(100vw-1rem))] px-3 py-3.5"
        trigger={
          <button
            type="button"
            aria-label={
              hasDescription ? `Description of ${task.name}` : `Add a description to ${task.name}`
            }
            className={cn(
              iconButton,
              'bg-[#FFEEE7] text-[#B07542]',
              !hasDescription &&
                'opacity-0 group-hover/row:opacity-60 focus-visible:opacity-100 data-[state=open]:opacity-100',
            )}
          >
            <DescriptionIcon />
          </button>
        }
      >
        <DescriptionEditor
          task={task}
          onClose={() => {
            setDescriptionOpen(false)
          }}
        />
      </FieldPopover>

      {blockers > 0 && (
        <DependenciesPopover
          open={dependenciesOpen}
          onOpenChange={setDependenciesOpen}
          task={task}
          workspace={workspace}
          tasks={tasks}
          trigger={
            <button
              type="button"
              aria-label={`Waiting on ${blockers} open ${blockers === 1 ? 'task' : 'tasks'}: show dependencies`}
              className={cn(iconButton, 'w-[1.5rem] bg-[#FFF9E7] text-[#B0A042]')}
            >
              <WarningIcon />
            </button>
          }
        />
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={copyLink}
            aria-label={`Copy link to ${task.name}`}
            className={cn(iconButton, 'w-[1.6rem] bg-[#E7F1FF] text-[#427FB0]')}
          >
            <LinkIcon />
          </button>
        </TooltipTrigger>
        <TooltipContent className={fieldStyles.tooltip}>Copy link</TooltipContent>
      </Tooltip>
    </span>
  )
}

function DescriptionEditor({ task, onClose }: { task: TaskRow; onClose: () => void }) {
  const { save, isPending } = useTaskSave()
  const [value, setValue] = useState(task.description)

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void save(task.id, { description: value.trim() }).then((saved) => {
          if (saved) onClose()
        })
      }}
      className="flex flex-col gap-3"
    >
      <PopupHeader title="Description" onClose={onClose} />
      <div className="flex flex-col gap-1">
        <textarea
          aria-label="Description"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
          }}
          rows={6}
          maxLength={DESCRIPTION_MAX}
          placeholder="Add a description"
          className="resize-none rounded-[0.5625rem] border border-[#E9E9E9] px-3 py-2 text-[0.8125rem] text-[#3D3D3D] outline-none placeholder:text-[#909090] focus:border-[#A181FF]"
        />
        <span className="self-end text-[0.625rem] text-[#909090]">
          {value.length}/{DESCRIPTION_MAX}
        </span>
      </div>
      <div className="flex gap-4">
        <button type="button" onClick={onClose} className={fieldStyles.cancel}>
          Cancel
        </button>
        <button type="submit" disabled={isPending} className={fieldStyles.save}>
          Save
        </button>
      </div>
    </form>
  )
}
