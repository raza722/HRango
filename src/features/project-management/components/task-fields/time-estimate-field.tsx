import { useState } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import type { TaskRow } from '../../types/pm.types'
import { ChevronDownIcon, InfoIcon, TimerIcon } from './field-icons'
import { FieldPopover } from './field-popup'
import { fieldStyles } from './field-styles'
import { estimateWithSubtasks, formatDuration, parseDuration } from './field-utils'
import type { TaskCellProps } from './task-cell-types'
import { useTaskSave } from './use-task-save'

const MAX_MINUTES = 100_000

/** Time Estimate column: the estimate ("2hr 7min") or "Add time"; opens Add Time Estimate. */
export function TimeEstimateCell({ task, tasks }: TaskCellProps) {
  const [open, setOpen] = useState(false)
  const minutes = task.timeEstimateMinutes

  return (
    <FieldPopover
      open={open}
      onOpenChange={setOpen}
      label="Add Time Estimate"
      className="w-[min(25rem,calc(100vw-1rem))] px-[0.9rem] py-[0.8rem]"
      trigger={
        <button
          type="button"
          aria-label={
            minutes
              ? `Time Estimate: ${formatDuration(minutes)}`
              : `Add time estimate to ${task.name}`
          }
          className={fieldStyles.cell}
        >
          <span className={fieldStyles.cellIcon}>
            <TimerIcon />
          </span>
          <span className="truncate">{minutes ? formatDuration(minutes) : 'Add time'}</span>
          <ChevronDownIcon className={fieldStyles.cellChevron} />
        </button>
      }
    >
      <TimeEstimateForm
        task={task}
        tasks={tasks}
        onClose={() => {
          setOpen(false)
        }}
      />
    </FieldPopover>
  )
}

/**
 * "Add Time Estimate": the info button, Total with Subtask, the time typed ("4hr", "3h 30min")
 * and the Hour / Minute steppers, Cancel and Done.
 */
function TimeEstimateForm({
  task,
  tasks,
  onClose,
}: {
  task: TaskRow
  tasks: readonly TaskRow[]
  onClose: () => void
}) {
  const { save, isPending } = useTaskSave()
  const [minutes, setMinutes] = useState(task.timeEstimateMinutes ?? 0)
  const [typed, setTyped] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const withSubtasks = estimateWithSubtasks({ ...task, timeEstimateMinutes: minutes }, tasks)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  const set = (next: number) => {
    setMinutes(Math.min(MAX_MINUTES, Math.max(0, next)))
    setTyped(null)
    setError(null)
  }

  /** The typed time wins over the steppers; an unreadable entry keeps the form open. */
  const readTyped = (): number | null => {
    if (typed === null || typed.trim() === '') return minutes
    const parsed = parseDuration(typed)
    if (parsed === null) {
      setError('Enter a time such as 4hr or 3h 30min')
      return null
    }
    return parsed
  }

  const submit = async () => {
    const value = readTyped()
    if (value === null) return
    if (await save(task.id, { timeEstimateMinutes: value > 0 ? value : null })) onClose()
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
      className="flex flex-col gap-3"
    >
      <div className="flex items-center gap-2">
        <h3 className={fieldStyles.groupTitle}>Add Time Estimate</h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="About time estimates"
              className="flex size-[1.05rem] items-center justify-center rounded-full bg-[#777676] text-white [&_svg]:size-3"
            >
              <InfoIcon />
            </button>
          </TooltipTrigger>
          <TooltipContent className={cn(fieldStyles.tooltip, 'max-w-60')}>
            How long the task should take. Its subtasks&apos; estimates add up in Total with
            Subtask.
          </TooltipContent>
        </Tooltip>
        <span className="ml-auto text-[0.71875rem] font-medium tracking-[0.01em] text-[#454545] dark:text-title">
          Total with Subtask{' '}
          <strong className="font-semibold text-[#4382EE] dark:text-[#8FB0FF]">
            {formatDuration(withSubtasks)}
          </strong>
        </span>
      </div>

      <div
        className={cn(
          fieldStyles.panel,
          'flex flex-col gap-3 border border-[#E9E9E9] p-[0.9rem] dark:border-border',
        )}
      >
        <label>
          <span className="sr-only">Time estimate</span>
          <input
            value={typed ?? (minutes > 0 ? formatDuration(minutes) : '')}
            onChange={(event) => {
              setTyped(event.target.value)
              setError(null)
            }}
            onBlur={() => {
              if (typed === null) return
              const parsed = typed.trim() === '' ? 0 : parseDuration(typed)
              if (parsed === null) setError('Enter a time such as 4hr or 3h 30min')
              else set(parsed)
            }}
            placeholder="Enter Time (ex: 3h 30min)"
            aria-invalid={error !== null}
            className="h-10 w-full rounded-[0.8125rem] border border-[#E9E9E9] bg-white px-3 text-sm tracking-[0.01em] text-[#3D3D3D] outline-none placeholder:text-[#909090] focus:border-[#A181FF] dark:border-border dark:bg-card dark:text-title"
          />
        </label>
        {error && (
          <p role="alert" className={fieldStyles.error}>
            {error}
          </p>
        )}
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <Unit
            label="Hour"
            value={hours}
            onStep={(step) => {
              set(minutes + step * 60)
            }}
          />
          <span className="pb-2 text-[1.05rem] font-bold text-[#626262] dark:text-title">:</span>
          <Unit
            label="Minute"
            value={rest}
            onStep={(step) => {
              set(minutes + step)
            }}
          />
        </div>
      </div>

      <div className="flex gap-5">
        <button type="button" onClick={onClose} className={cn(fieldStyles.cancel, 'h-[2.95rem]')}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className={cn(fieldStyles.done, 'h-[2.95rem] flex-[1.4]')}
        >
          Done
        </button>
      </div>
    </form>
  )
}

/** "Hour" / "Minute": the label chip (#DFD7FF) over the value with purple minus and plus. */
function Unit({
  label,
  value,
  onStep,
}: {
  label: string
  value: number
  onStep: (step: 1 | -1) => void
}) {
  const stepButton =
    'flex size-6 items-center justify-center rounded text-base leading-none font-semibold text-[#7127EA] dark:text-[#C4ABFF] hover:bg-[#EEE7FF] dark:hover:bg-[#7127EA]/25'
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="flex h-[2.1rem] w-[4.75rem] items-center justify-center rounded-md bg-[#DFD7FF] text-[0.8125rem] font-semibold tracking-[0.01em] text-[#4A4A4A] dark:bg-[#7127EA]/25 dark:text-title">
        {label}
      </span>
      <span className="flex h-10 w-full items-center justify-between rounded-[0.375rem] bg-white px-1.5 shadow-[0_0_7px_rgba(0,0,0,0.1)] dark:bg-card">
        <button
          type="button"
          aria-label={`Fewer ${label.toLowerCase()}s`}
          onClick={() => {
            onStep(-1)
          }}
          className={stepButton}
        >
          −
        </button>
        <span
          aria-label={`${label}s`}
          className="flex h-[1.6rem] min-w-9 items-center justify-center rounded-[0.125rem] bg-[#F6F4FF] px-1 text-[1.05rem] font-medium text-[#626262] dark:bg-[#7127EA]/10 dark:text-title"
        >
          {String(value).padStart(2, '0')}
        </span>
        <button
          type="button"
          aria-label={`More ${label.toLowerCase()}s`}
          onClick={() => {
            onStep(1)
          }}
          className={stepButton}
        >
          +
        </button>
      </span>
    </div>
  )
}
