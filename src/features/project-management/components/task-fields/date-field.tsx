import { useState } from 'react'
import { format, isToday } from 'date-fns'

import { cn } from '@/lib/utils'

import type { Recurrence, TaskRow } from '../../types/pm.types'
import { AddTimePopover } from './add-time-popup'
import { CalendarIcon, ChevronDownIcon, ClockIcon, CloseIcon } from './field-icons'
import { FieldPopover, PopupHeader } from './field-popup'
import { fieldStyles } from './field-styles'
import { formatCellDate, formatTime12, fromDay, quickPicks, WEEKDAY_SHORT } from './field-utils'
import { MonthCalendar } from './month-calendar'
import { RecurrencePanel } from './recurrence-panel'
import type { TaskCellProps } from './task-cell-types'
import { useTaskSave } from './use-task-save'

type DateEnd = 'start' | 'due'

export const StartDateCell = (props: TaskCellProps) => <DateCell {...props} end="start" />
export const DueDateCell = (props: TaskCellProps) => <DateCell {...props} end="due" />

/** The cells' date: "Today", or `4/16/2025`. */
const cellDate = (day: string) => (isToday(fromDay(day)) ? 'Today' : formatCellDate(day))

/**
 * Start Date / Due Date column (Workspace Page 1:2755): the calendar icon, the date and the
 * purple arrow; both open the Calendar popup with their own date chosen.
 */
function DateCell({ task, end }: TaskCellProps & { end: DateEnd }) {
  const [open, setOpen] = useState(false)
  const day = end === 'start' ? task.startDate : task.dueDate
  const time = end === 'start' ? task.startTime : task.dueTime
  const label = end === 'start' ? 'Start Date' : 'Due Date'

  return (
    <FieldPopover
      open={open}
      onOpenChange={setOpen}
      label="Calendar"
      className="w-[min(42.5rem,calc(100vw-1rem))]"
      trigger={
        <button
          type="button"
          aria-label={
            day
              ? `${label}: ${formatCellDate(day)}${time ? ` ${formatTime12(time)}` : ''}`
              : `Add ${label} to ${task.name}`
          }
          className={fieldStyles.cell}
        >
          <span className={fieldStyles.cellIcon}>
            <CalendarIcon />
          </span>
          {day ? (
            <span className="min-w-0 truncate">
              {cellDate(day)}
              {time && (
                <span className="ml-1.5 text-[0.6875rem] text-[#909090]">{formatTime12(time)}</span>
              )}
            </span>
          ) : (
            <span className={cn(fieldStyles.placeholder, 'text-[#909090]')}>{label}</span>
          )}
          <ChevronDownIcon className={fieldStyles.cellChevron} />
        </button>
      }
    >
      <CalendarPopup
        task={task}
        initialEnd={end}
        onClose={() => {
          setOpen(false)
        }}
      />
    </FieldPopover>
  )
}

interface Draft {
  startDate: string | null
  startTime: string | null
  dueDate: string | null
  dueTime: string | null
  recurrence: Recurrence | null
}

const defaultRecurrence = (draft: Draft): Recurrence => {
  const anchor = draft.dueDate ?? draft.startDate
  return {
    every: 1,
    unit: 'week',
    weekdays: [(anchor ? fromDay(anchor) : new Date()).getDay()],
    ends: { kind: 'never' },
  }
}

const UNIT_PLURAL = { day: 'days', week: 'weeks', month: 'months', year: 'years' } as const

function describeRecurrence(recurrence: Recurrence): string {
  const every =
    recurrence.every === 1
      ? `Every ${recurrence.unit}`
      : `Every ${recurrence.every} ${UNIT_PLURAL[recurrence.unit]}`
  const days =
    recurrence.unit === 'week' && recurrence.weekdays.length > 0
      ? ` on ${recurrence.weekdays.map((day) => WEEKDAY_SHORT[day]).join(', ')}`
      : ''
  return every + days
}

const fieldBox =
  'flex h-10 w-full items-center gap-2.5 rounded-[0.5625rem] border border-[#E9E9E9] bg-white pr-2.5 pl-1.5 text-left text-xs tracking-[0.01em]'

interface CalendarPopupProps {
  task: TaskRow
  initialEnd: DateEnd
  onClose: () => void
}

/**
 * Calendar (1:10061, 1:10346): Add Start Date and Add Due Date with their Add Time, the quick
 * picks, the month (or the Custom Recurrence panel in its place), Set Recurrence, Cancel and
 * Save. Nothing is saved until Save.
 */
function CalendarPopup({ task, initialEnd, onClose }: CalendarPopupProps) {
  const { save, isPending } = useTaskSave()
  const [draft, setDraft] = useState<Draft>({
    startDate: task.startDate,
    startTime: task.startTime,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    recurrence: task.recurrence,
  })
  const [active, setActive] = useState<DateEnd>(initialEnd)
  const [panel, setPanel] = useState<'dates' | 'recurrence'>('dates')
  const [timeOpen, setTimeOpen] = useState<DateEnd | null>(null)
  const [now] = useState(() => new Date())
  const groups = quickPicks(now)

  const dateKey = active === 'start' ? 'startDate' : 'dueDate'
  const timeKey = active === 'start' ? 'startTime' : 'dueTime'
  const selected = draft[dateKey]
  const error =
    draft.startDate && draft.dueDate && draft.dueDate < draft.startDate
      ? 'The due date cannot be before the start date'
      : null

  const setDay = (day: string, time?: string | null) => {
    setDraft((current) => ({
      ...current,
      [dateKey]: day,
      ...(time === undefined ? {} : { [timeKey]: time }),
    }))
  }

  const submit = async () => {
    if (error) return
    if (await save(task.id, draft)) onClose()
  }

  const block = (end: DateEnd) => {
    const day = end === 'start' ? draft.startDate : draft.dueDate
    const time = end === 'start' ? draft.startTime : draft.dueTime
    const title = end === 'start' ? 'Start Date' : 'Due Date'
    const isActive = active === end
    return (
      <div
        className={cn(
          fieldStyles.card,
          'flex flex-col gap-[0.7rem] p-[0.7rem]',
          isActive && 'border-[#A181FF]',
        )}
      >
        <div className={cn(fieldBox, isActive && 'border-[#A181FF]')}>
          <button
            type="button"
            onClick={() => {
              setActive(end)
            }}
            aria-pressed={isActive}
            aria-label={day ? `${title}: ${format(fromDay(day), 'MMM d, yyyy')}` : `Add ${title}`}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          >
            <span className={fieldStyles.cellIcon}>
              <CalendarIcon />
            </span>
            {day ? (
              <span className="truncate font-medium text-[#676565]">
                {format(fromDay(day), 'MMM d, yyyy')}
              </span>
            ) : (
              <span className="truncate text-[#909090]">Add {title}</span>
            )}
          </button>
          {day && (
            <button
              type="button"
              aria-label={`Clear ${title}`}
              onClick={() => {
                setDraft((current) =>
                  end === 'start'
                    ? { ...current, startDate: null, startTime: null }
                    : { ...current, dueDate: null, dueTime: null },
                )
              }}
              className="flex size-5 shrink-0 items-center justify-center rounded-full text-[#909090] hover:bg-[rgba(236,71,79,0.1)] hover:text-[#DC3545] [&_svg]:size-2"
            >
              <CloseIcon />
            </button>
          )}
        </div>
        <AddTimePopover
          open={timeOpen === end}
          onOpenChange={(open) => {
            setTimeOpen(open ? end : null)
          }}
          value={time}
          onSave={(picked) => {
            const today = format(now, 'yyyy-MM-dd')
            setDraft((current) =>
              end === 'start'
                ? { ...current, startTime: picked, startDate: current.startDate ?? today }
                : { ...current, dueTime: picked, dueDate: current.dueDate ?? today },
            )
            setActive(end)
          }}
          trigger={
            <button
              type="button"
              aria-label={time ? `${title} time: ${formatTime12(time)}` : `Add Time to ${title}`}
              className={cn(fieldBox, 'hover:border-[#D9C8FB]')}
            >
              <span className={fieldStyles.cellIcon}>
                <ClockIcon />
              </span>
              {time ? (
                <span className="font-medium text-[#676565]">{formatTime12(time)}</span>
              ) : (
                <span className="text-[#909090]">Add Time</span>
              )}
              <ChevronDownIcon className="ml-auto h-[0.4rem] w-[0.8rem] shrink-0 text-[#7127EA]" />
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[0.9rem] px-[0.9rem] pt-[0.7rem] pb-[0.9rem]">
      <PopupHeader title="Calendar" onClose={onClose} />
      <div className={cn(fieldStyles.panel, 'grid gap-[0.9rem] p-[0.7rem] sm:grid-cols-2')}>
        {block('start')}
        {block('due')}
      </div>

      <div className="grid gap-[0.9rem] sm:grid-cols-[minmax(0,369fr)_minmax(0,513fr)]">
        <div className={cn(fieldStyles.panel, 'flex flex-col gap-[0.9rem] p-[0.9rem]')}>
          {groups.map((group) => (
            <ul
              key={group[0]?.key}
              className={cn(fieldStyles.card, 'flex flex-col gap-[0.7rem] p-[0.9rem]')}
            >
              {group.map((pick) => (
                <li key={pick.key}>
                  <button
                    type="button"
                    aria-label={`${pick.label}, ${pick.hint}`}
                    onClick={() => {
                      setDay(pick.date, pick.time ?? undefined)
                    }}
                    className={cn(
                      fieldStyles.softRow,
                      'px-2.5',
                      selected === pick.date && 'bg-[#EEE7FF]',
                    )}
                  >
                    <span>{pick.label}</span>
                    <span>{pick.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          ))}
        </div>

        <div className={cn(fieldStyles.panel, 'flex flex-col gap-[0.9rem] p-[0.9rem]')}>
          {panel === 'recurrence' && draft.recurrence ? (
            <RecurrencePanel
              value={draft.recurrence}
              onChange={(recurrence) => {
                setDraft((current) => ({ ...current, recurrence }))
              }}
              onBack={() => {
                setPanel('dates')
              }}
            />
          ) : (
            <>
              <MonthCalendar
                key={active}
                selected={selected}
                marked={active === 'start' ? draft.dueDate : draft.startDate}
                onSelect={(day) => {
                  setDay(day)
                }}
              />
              <div className="flex flex-col gap-2">
                <h4 className={fieldStyles.groupTitle}>Custom Recurrence</h4>
                <div className="flex h-10 items-center rounded-[0.5625rem] border border-[#E9E9E9] bg-white">
                  <button
                    type="button"
                    onClick={() => {
                      setDraft((current) => ({
                        ...current,
                        recurrence: current.recurrence ?? defaultRecurrence(current),
                      }))
                      setPanel('recurrence')
                    }}
                    className="flex h-full min-w-0 flex-1 items-center justify-between gap-2 px-3 text-left text-[0.71875rem] font-medium tracking-[0.01em]"
                  >
                    {draft.recurrence ? (
                      <span className="truncate text-[#4A4A4A]">
                        {describeRecurrence(draft.recurrence)}
                      </span>
                    ) : (
                      <span className="text-[#909090]">Set Recurrence</span>
                    )}
                    <ChevronDownIcon className="h-[0.4rem] w-[0.8rem] shrink-0 -rotate-90 text-[#7127EA]" />
                  </button>
                  {draft.recurrence && (
                    <button
                      type="button"
                      aria-label="Remove recurrence"
                      onClick={() => {
                        setDraft((current) => ({ ...current, recurrence: null }))
                      }}
                      className="mr-2 flex size-5 shrink-0 items-center justify-center rounded-full text-[#909090] hover:bg-[rgba(236,71,79,0.1)] hover:text-[#DC3545] [&_svg]:size-2"
                    >
                      <CloseIcon />
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
          {error && (
            <p role="alert" className={fieldStyles.error}>
              {error}
            </p>
          )}
          <div className="mt-auto flex gap-[0.9rem]">
            <button type="button" onClick={onClose} className={fieldStyles.cancel}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                void submit()
              }}
              disabled={isPending || error !== null}
              className={fieldStyles.save}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
