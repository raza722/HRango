import { useState } from 'react'

import { cn } from '@/lib/utils'

import { PRIORITY_META } from '../../constants'
import { PRIORITIES, type Priority } from '../../types/pm.types'
import { ChevronDownIcon, ClearIcon, FlagFilledIcon, FlagIcon } from './field-icons'
import { FieldPopover } from './field-popup'
import { fieldStyles } from './field-styles'
import { PRIORITY_FLAG_COLORS } from './field-utils'
import type { TaskCellProps } from './task-cell-types'
import { useTaskSave } from './use-task-save'

/**
 * Set Priority column (1:27555): the flag in its colour and the name ("Urgent"), or the purple
 * outline flag and "Priorities this task"; the popup lists Urgent, High, Normal and Low with
 * their flags and a purple Clear.
 */
export function PriorityCell({ task }: TaskCellProps) {
  const [open, setOpen] = useState(false)
  const { save } = useTaskSave()
  const label = task.priority ? PRIORITY_META[task.priority].label : null

  const choose = async (priority: Priority | null) => {
    if (await save(task.id, { priority })) setOpen(false)
  }

  return (
    <FieldPopover
      open={open}
      onOpenChange={setOpen}
      label="Set Priority"
      className="w-[13.4rem] p-[0.6rem]"
      trigger={
        <button
          type="button"
          aria-label={label ? `Priority: ${label}` : `Set priority of ${task.name}`}
          className={fieldStyles.cell}
        >
          <span className={fieldStyles.cellIcon}>
            {task.priority ? (
              <FlagFilledIcon style={{ color: PRIORITY_FLAG_COLORS[task.priority] }} />
            ) : (
              <FlagIcon />
            )}
          </span>
          <span className={fieldStyles.placeholder}>{label ?? 'Priorities this task'}</span>
          <ChevronDownIcon className={fieldStyles.cellChevron} />
        </button>
      }
    >
      <ul className="flex flex-col gap-[0.45rem]">
        {PRIORITIES.map((priority) => {
          const selected = task.priority === priority
          return (
            <li key={priority}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  void choose(priority)
                }}
                className={cn(
                  'flex h-[2.125rem] w-full items-center gap-2.5 rounded-[0.5rem] bg-[#F7F7F7] px-1.5 text-[0.8125rem] text-[#626262] transition-colors hover:bg-[#EEE7FF]',
                  selected && 'bg-[#EEE7FF] ring-1 ring-[#A181FF]',
                )}
              >
                <span className="flex size-[1.45rem] items-center justify-center rounded-[0.4rem] bg-[#F6F2FF]">
                  <FlagFilledIcon
                    className="h-[0.85rem] w-auto"
                    style={{ color: PRIORITY_FLAG_COLORS[priority] }}
                  />
                </span>
                {PRIORITY_META[priority].label}
              </button>
            </li>
          )
        })}
      </ul>
      <div className={cn(fieldStyles.divider, 'my-[0.7rem]')} />
      <button
        type="button"
        onClick={() => {
          void choose(null)
        }}
        className="flex h-[2.25rem] w-full items-center gap-2.5 rounded-[0.5rem] bg-[#7127EA] px-1.5 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-[#5f1fd0]"
      >
        <span className="flex size-[1.45rem] items-center justify-center rounded-[0.4rem] bg-white text-[#DC3545]">
          <ClearIcon className="size-[1rem]" />
        </span>
        Clear
      </button>
    </FieldPopover>
  )
}
