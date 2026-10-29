import { useState } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { STATUS_GROUP_LABELS } from '../../constants'
import { STATUS_GROUPS, type TaskType } from '../../types/pm.types'
import { ChevronDownIcon, GearIcon, InfoIcon, MilestoneIcon } from './field-icons'
import { FieldPopover, SearchField } from './field-popup'
import { fieldStyles } from './field-styles'
import { StatusChip, StatusIconBox } from './status-chip'
import type { TaskCellProps } from './task-cell-types'
import { useTaskSave } from './use-task-save'

const TASK_TYPES: { key: TaskType; label: string; note?: string }[] = [
  { key: 'task', label: 'Task', note: '(Default)' },
  { key: 'milestone', label: 'Milestone' },
]

const TASK_TYPE_INFO =
  "Customize names and icons to match your workflow needs. Whether it's Epics, Customers, People, or 1on1s."

const optionRow =
  'flex h-[2.4rem] w-full items-center gap-2.5 rounded-[0.5rem] border px-2.5 text-[0.8125rem] font-medium text-[#626262] dark:text-title transition-colors'

/**
 * Status column ("Status Column Field Dropdown", 1:64968): the status chip; the popup has the
 * Status tab (search, the gear, the workspace's statuses by group) and the Task Type tab.
 */
export function StatusCell({ task, workspace, onOpenStatusSettings }: TaskCellProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'status' | 'type'>('status')
  const [search, setSearch] = useState('')
  const { save } = useTaskSave()
  const statuses = workspace.setup.statuses
  const current = statuses.find((status) => status.id === task.statusId)
  const query = search.trim().toLowerCase()
  const groups = STATUS_GROUPS.map((group) => ({
    group,
    statuses: statuses.filter(
      (status) => status.group === group && (!query || status.name.toLowerCase().includes(query)),
    ),
  })).filter((entry) => entry.statuses.length > 0)

  const choose = async (patch: { statusId: string } | { type: TaskType }) => {
    if (await save(task.id, patch)) setOpen(false)
  }

  return (
    <FieldPopover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setTab('status')
          setSearch('')
        }
      }}
      label="Status"
      className="w-[min(17.5rem,calc(100vw-1rem))] p-[0.7rem]"
      trigger={
        <button
          type="button"
          aria-label={`Status: ${current?.name ?? 'none'}${task.type === 'milestone' ? ', Milestone' : ''}`}
          className={cn(fieldStyles.cell, 'pl-1')}
        >
          <StatusChip status={current} />
          {task.type === 'milestone' && (
            <MilestoneIcon className="size-4 shrink-0 text-[#D9A800] dark:text-[#E8D36A]" />
          )}
          <ChevronDownIcon className={fieldStyles.cellChevron} />
        </button>
      }
    >
      <div
        role="tablist"
        aria-label="Status or Task Type"
        className="flex gap-1 rounded-[0.6rem] border border-[#E9E9E9] p-1 dark:border-border"
      >
        {(
          [
            ['status', 'Status'],
            ['type', 'Task Type'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => {
              setTab(key)
            }}
            className={cn(
              'h-8 flex-1 rounded-[0.45rem] border text-[0.8125rem] font-medium transition-colors',
              tab === key
                ? 'border-[#7127EA] bg-[#F6F4FF] text-[#3D3D3D] dark:bg-[#7127EA]/10 dark:text-title'
                : 'border-transparent text-[#5D5D5D] hover:bg-[#F8F5FF] dark:text-title dark:hover:bg-[#7127EA]/15',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'status' ? (
        <div role="tabpanel" aria-label="Status" className="mt-3">
          <div className="flex items-center gap-2.5">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search status"
              label="Search status"
              className="h-9"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Status settings"
                  aria-disabled={onOpenStatusSettings ? undefined : 'true'}
                  onClick={() => {
                    if (!onOpenStatusSettings) return
                    setOpen(false)
                    onOpenStatusSettings()
                  }}
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[#3D3D3D] shadow-[0_0_6.6px_rgba(0,0,0,0.12)] dark:bg-card dark:text-title',
                    !onOpenStatusSettings && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <GearIcon className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className={fieldStyles.tooltip}>
                {onOpenStatusSettings ? 'Status settings' : 'Status settings are not available yet'}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className={cn(fieldStyles.divider, 'my-3')} />
          <div
            className={cn(fieldStyles.scroll, 'flex max-h-72 flex-col gap-3 overflow-y-auto pr-1')}
          >
            {groups.map(({ group, statuses: inGroup }, index) => (
              <section key={group} aria-label={STATUS_GROUP_LABELS[group]}>
                {index > 0 && <div className={cn(fieldStyles.divider, 'mb-3')} />}
                <h4 className="text-[0.8125rem] font-medium text-[#3D3D3D] dark:text-title">
                  {STATUS_GROUP_LABELS[group]}
                </h4>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {inGroup.map((status) => {
                    const selected = status.id === task.statusId
                    return (
                      <li key={status.id}>
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            void choose({ statusId: status.id })
                          }}
                          className={cn(
                            optionRow,
                            selected
                              ? 'border-[#7127EA] bg-[#F6F4FF] dark:bg-[#7127EA]/10'
                              : 'border-transparent bg-[#F7F7F7] hover:bg-[#F6F4FF] dark:bg-white/5 dark:hover:bg-[#7127EA]/15',
                          )}
                        >
                          <StatusIconBox color={status.color} />
                          {status.name}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
            {groups.length === 0 && <p className={fieldStyles.muted}>No status matches</p>}
          </div>
        </div>
      ) : (
        <div role="tabpanel" aria-label="Task Type" className="mt-3">
          <div className={cn(fieldStyles.divider, 'mb-3')} />
          <div className="flex items-center gap-1.5">
            <h4 className="text-[0.8125rem] font-medium text-[#3D3D3D] dark:text-title">
              Task Types
            </h4>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="About task types"
                  className="flex size-5 items-center justify-center rounded-full text-[#777676] hover:bg-[#F7F7F7] dark:text-grey dark:hover:bg-white/5"
                >
                  <InfoIcon className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className={cn(fieldStyles.tooltip, 'max-w-60')}>
                {TASK_TYPE_INFO}
              </TooltipContent>
            </Tooltip>
          </div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {TASK_TYPES.map((type) => {
              const selected = task.type === type.key
              return (
                <li key={type.key}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      void choose({ type: type.key })
                    }}
                    className={cn(
                      optionRow,
                      selected
                        ? 'border-[#7127EA] bg-[#F6F4FF] dark:bg-[#7127EA]/10'
                        : 'border-transparent bg-[#F7F7F7] hover:bg-[#F6F4FF] dark:bg-white/5 dark:hover:bg-[#7127EA]/15',
                    )}
                  >
                    {type.key === 'task' ? (
                      <StatusIconBox color="#2E64E2" />
                    ) : (
                      <MilestoneIcon className="size-[1.05rem] text-[#D9A800] dark:text-[#E8D36A]" />
                    )}
                    {type.label}
                    {type.note && (
                      <span className="text-[0.6875rem] text-[#707070] dark:text-grey">
                        {type.note}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </FieldPopover>
  )
}
