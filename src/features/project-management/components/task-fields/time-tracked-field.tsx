import { useEffect, useId, useState } from 'react'
import { Controller, useForm, type UseFormReturn, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, parseISO } from 'date-fns'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import {
  useAddTimeEntry,
  useDeleteTimeEntry,
  usePeople,
  usePmMe,
  useStartTimer,
  useStopTimer,
  useTimeEntries,
} from '../../hooks/use-pm'
import { usePmAccess } from '../../hooks/use-pm-access'
import type { TaskRow, TimeEntry, Workspace } from '../../types/pm.types'
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  PauseIcon,
  PlayIcon,
} from './field-icons'
import { FieldPopover, PersonAvatar, PopupHeader } from './field-popup'
import { fieldStyles } from './field-styles'
import {
  entriesByPerson,
  formatClock,
  formatDuration,
  formatTime12,
  formatTimeOption,
  fromDay,
  minutesOf,
  parseDuration,
  QUARTER_TIMES,
  TIME_NOTES_MAX,
  type TimeEntryForm,
  timeEntrySchema,
  toDay,
  trackedMinutes,
} from './field-utils'
import { MonthCalendar } from './month-calendar'
import { RemoveButton } from './remove-button'
import type { TaskCellProps } from './task-cell-types'

/** The caller's running timer among a task's entries. */
function runningEntry(entries: readonly TimeEntry[] | undefined, meId: string | null) {
  return entries?.find((entry) => entry.isRunning && (meId === null || entry.employeeId === meId))
}

/** Seconds since `startedAt`, ticking each second while a timer runs. */
function useElapsed(startedAt: string | null): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!startedAt) return
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => {
      window.clearInterval(timer)
    }
  }, [startedAt])
  if (!startedAt) return 0
  return Math.max(0, Math.floor((now - parseISO(startedAt).getTime()) / 1000))
}

/**
 * Time Tracked column (1:91537, 1:83704): the time tracked with a bar against the estimate, a
 * red clock while the timer runs; the popup has the timer field, the time entries per person
 * and a manual entry.
 */
export function TimeTrackedCell({ task, workspace }: TaskCellProps) {
  const [open, setOpen] = useState(false)
  const meId = usePmMe()
  // Entries are read when the popup opens; the cell keeps showing a running timer after that.
  const entries = useTimeEntries(task.id, open)
  const timer = runningEntry(entries.data, meId)
  const tracked = trackedMinutes(task)
  const running = timer !== undefined
  const elapsed = useElapsed(timer?.startAt ?? null)
  const estimate = task.timeEstimateMinutes ?? 0
  const percent = estimate > 0 ? Math.min(100, Math.round((tracked / estimate) * 100)) : 0

  return (
    <FieldPopover
      open={open}
      onOpenChange={setOpen}
      label="Time Tracked"
      className="w-[min(31rem,calc(100vw-1rem))] px-3 py-3.5"
      trigger={
        <button
          type="button"
          aria-label={
            running
              ? `Time Tracked: timer running ${formatClock(elapsed)}`
              : tracked > 0
                ? `Time Tracked: ${formatDuration(tracked)}`
                : `Track time on ${task.name}`
          }
          className={fieldStyles.cell}
        >
          <span
            className={cn(
              fieldStyles.cellIcon,
              running && 'bg-[rgba(236,71,79,0.1)] text-[#DC3545] dark:text-[#FF8A94] [&_svg]:h-3',
            )}
          >
            {running ? <PauseIcon /> : <ClockIcon />}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            {running ? (
              <span className="truncate text-[0.8125rem] font-medium text-[#DC3545] tabular-nums dark:text-[#FF8A94]">
                {formatClock(elapsed)}
              </span>
            ) : (
              <span className="truncate">{tracked > 0 ? formatDuration(tracked) : 'Add time'}</span>
            )}
            {estimate > 0 && (
              <span className="h-1 w-full overflow-hidden rounded-full bg-[#E7E7E7] dark:bg-white/10">
                <span
                  className="block h-full rounded-full bg-[#7127EA]"
                  style={{ width: `${percent}%` }}
                />
              </span>
            )}
          </span>
          <ChevronDownIcon className={fieldStyles.cellChevron} />
        </button>
      }
    >
      <TimeTrackedPanel
        task={task}
        workspace={workspace}
        entries={entries.data}
        loading={entries.isPending}
        onClose={() => {
          setOpen(false)
        }}
      />
    </FieldPopover>
  )
}

function TimeTrackedPanel({
  task,
  workspace,
  entries,
  loading,
  onClose,
}: {
  task: TaskRow
  workspace: Workspace
  entries: TimeEntry[] | undefined
  loading: boolean
  onClose: () => void
}) {
  const meId = usePmMe()
  const access = usePmAccess(workspace)
  const tracked = trackedMinutes(task)
  const estimate = task.timeEstimateMinutes ?? 0
  const entry = useTimeEntryForm(task)

  return (
    <div className="flex flex-col gap-3">
      <PopupHeader title="Time Tracked" onClose={onClose} />
      {access.trackTime && (
        <TimerField task={task} timer={runningEntry(entries, meId)} entry={entry} />
      )}
      {estimate > 0 && <TrackedBar tracked={tracked} estimate={estimate} />}
      <TimeEntries
        entries={entries ?? []}
        loading={loading}
        meId={meId}
        canDelete={access.deleteTime}
      />
      {access.trackTime && <ManualEntry entry={entry} />}
    </div>
  )
}

interface EntryForm {
  form: UseFormReturn<TimeEntryForm>
  submit: () => Promise<void>
  isPending: boolean
}

/**
 * The popup's one entry form: the typed time (saved by Enter or by Save) and the Start / Stop
 * form. A saved entry clears both, with their errors.
 */
function useTimeEntryForm(task: TaskRow): EntryForm {
  const addEntry = useAddTimeEntry()
  const form = useForm<TimeEntryForm>({
    resolver: zodResolver(timeEntrySchema),
    defaultValues: { duration: '', date: toDay(new Date()), start: '', end: '', notes: '' },
  })
  const submit = form.handleSubmit(async (values) => {
    const typed = values.duration.trim()
    const notes = values.notes.trim()
    try {
      await addEntry.mutateAsync({
        taskId: task.id,
        input: typed
          ? { minutes: parseDuration(typed) ?? 0, notes }
          : { date: values.date, start: values.start, end: values.end, notes },
      })
      form.reset({ duration: '', date: values.date, start: '', end: '', notes: '' })
    } catch {
      // The mutation cache shows the server's message.
    }
  })
  return { form, submit: () => submit(), isPending: addEntry.isPending }
}

/** "Time Tracked Bar Progress Popup": tracked time against what is left of the estimate. */
function TrackedBar({ tracked, estimate }: { tracked: number; estimate: number }) {
  const remaining = Math.max(0, estimate - tracked)
  const percent = Math.min(100, Math.round((tracked / estimate) * 100))
  return (
    <div className="rounded-[0.5625rem] bg-[rgba(221,221,221,0.2)] px-3 py-2">
      <div className="flex justify-between text-[0.71875rem] font-medium text-[#626262] dark:text-title">
        <span>
          Tracked:{' '}
          <strong className="font-semibold text-[#7127EA] dark:text-[#C4ABFF]">
            {formatDuration(tracked)}
          </strong>
        </span>
        <span>
          Remaining:{' '}
          <strong className="font-semibold text-[#4382EE] dark:text-[#8FB0FF]">
            {formatDuration(remaining)}
          </strong>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Tracked against estimate"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-1.5 h-[0.45rem] overflow-hidden rounded-full bg-[#E7E7E7] dark:bg-white/10"
      >
        <div className="h-full rounded-full bg-[#7127EA]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

/**
 * "Enter Time Input Field & Record Time Section": idle "Enter Time (ex: 3h 30min) or Start
 * Timer" with a purple play, recording "00 : 00 : 00" in red with a pause, then the recorded
 * time in purple with play to start again. Pausing records the run as a time entry.
 */
function TimerField({
  task,
  timer,
  entry,
}: {
  task: TaskRow
  timer: TimeEntry | undefined
  entry: EntryForm
}) {
  const startTimer = useStartTimer()
  const stopTimer = useStopTimer()
  const isPending = startTimer.isPending || stopTimer.isPending || entry.isPending
  const elapsed = useElapsed(timer?.startAt ?? null)
  const [lastRun, setLastRun] = useState<number | null>(null)
  const running = timer !== undefined
  const errorId = useId()
  const error = entry.form.formState.errors.duration?.message ?? null

  const start = () => {
    entry.form.clearErrors('duration')
    startTimer.mutate(task.id)
  }

  const pause = async () => {
    if (!timer) return
    const seconds = Math.floor((Date.now() - parseISO(timer.startAt).getTime()) / 1000)
    try {
      await stopTimer.mutateAsync(undefined)
      setLastRun(seconds)
    } catch {
      // The mutation cache shows the server's message.
    }
  }

  const state = running ? 'recording' : lastRun !== null ? 'paused' : 'idle'

  return (
    <div>
      <div
        data-state={state}
        className={cn(
          'flex h-[3.1rem] items-center gap-2 rounded-[0.8125rem] border-[1.5px] bg-white pr-2 pl-3.5 dark:bg-card',
          state === 'recording' && 'border-[#B7192C]',
          state === 'paused' && 'border-[#7127EA]',
          state === 'idle' && 'border-[#E9E9E9] focus-within:border-[#A181FF] dark:border-border',
        )}
      >
        {state === 'idle' ? (
          <label className="min-w-0 flex-1">
            <span className="sr-only">Enter time</span>
            <input
              {...entry.form.register('duration', {
                onChange: () => {
                  if (error) entry.form.clearErrors('duration')
                },
              })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void entry.submit()
                }
              }}
              aria-invalid={error !== null}
              aria-describedby={error ? errorId : undefined}
              placeholder="Enter Time (ex: 3h 30min) or Start Timer"
              className="w-full bg-transparent text-[0.9375rem] text-[#3D3D3D] outline-none placeholder:text-[#5D5D5D] dark:text-title"
            />
          </label>
        ) : (
          <span
            role="timer"
            aria-label={state === 'recording' ? 'Timer running' : 'Time recorded'}
            className="flex-1 text-[0.9375rem] text-[#3D3D3D] tabular-nums dark:text-title"
          >
            {formatClock(state === 'recording' ? elapsed : (lastRun ?? 0))}
          </span>
        )}
        {state === 'recording' ? (
          <button
            type="button"
            onClick={() => {
              void pause()
            }}
            disabled={isPending}
            aria-label="Pause timer"
            className="flex size-[2.2rem] shrink-0 items-center justify-center rounded-full border border-[#DC3545] bg-[rgba(236,71,79,0.15)] text-[#DC3545] dark:text-[#FF8A94]"
          >
            <PauseIcon className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={isPending}
            aria-label="Start timer"
            className="flex size-[2.2rem] shrink-0 items-center justify-center rounded-full border border-[#7127EA] bg-[#DFD7FF] text-[#7127EA] dark:bg-[#7127EA]/25 dark:text-[#C4ABFF]"
          >
            <PlayIcon className="size-4" />
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className={cn(fieldStyles.error, 'mt-1')}>
          {error}
        </p>
      )}
    </div>
  )
}

/** Time Entries: one group per person with their total; each entry's day, range and length. */
function TimeEntries({
  entries,
  loading,
  meId,
  canDelete,
}: {
  entries: readonly TimeEntry[]
  loading: boolean
  meId: string | null
  canDelete: boolean
}) {
  const people = usePeople()
  const deleteEntry = useDeleteTimeEntry()
  const finished = entries.filter((entry) => !entry.isRunning)
  const groups = entriesByPerson(finished)
  // Your own entries start open; the set holds the groups toggled away from that.
  const [toggled, setToggled] = useState<ReadonlySet<string>>(() => new Set())
  const total = finished.reduce((sum, entry) => sum + entry.minutes, 0)

  const toggle = (id: string) => {
    setToggled((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section aria-label="Time Entries" className={cn(fieldStyles.panel, 'p-2.5')}>
      <div className="flex items-center justify-between px-1">
        <h4 className={fieldStyles.sectionTitle}>Time Entries</h4>
        <span className="rounded-md bg-[#DFD7FF] px-2 py-0.5 text-[0.6875rem] font-semibold text-[#7127EA] dark:bg-[#7127EA]/25 dark:text-[#C4ABFF]">
          {formatDuration(total)}
        </span>
      </div>
      {loading ? (
        <p className={cn(fieldStyles.muted, 'mt-2 px-1')}>Loading time entries...</p>
      ) : groups.length === 0 ? (
        <p className={cn(fieldStyles.muted, 'mt-2 px-1')}>No time tracked yet</p>
      ) : (
        <ul
          className={cn(
            fieldStyles.scroll,
            'mt-2 flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-1',
          )}
        >
          {groups.map((group) => {
            const person = people.get(group.employeeId)
            const name = person?.name ?? (group.name || 'Unknown')
            const isOpen = (group.employeeId === meId) !== toggled.has(group.employeeId)
            return (
              <li key={group.employeeId} className="flex flex-col gap-1">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => {
                    toggle(group.employeeId)
                  }}
                  className="flex h-9 items-center gap-2 rounded-[0.5625rem] border border-[#E9E9E9] bg-white px-2 text-xs font-medium text-[#5D5D5D] dark:border-border dark:bg-card dark:text-title"
                >
                  <ChevronRightIcon
                    className={cn(
                      'size-3.5 text-[#7127EA] transition-transform dark:text-[#C4ABFF]',
                      isOpen && 'rotate-90',
                    )}
                  />
                  <PersonAvatar person={person} className="size-6" />
                  <span className="truncate">{name}</span>
                  <span className="ml-auto font-medium text-[#7127EA] dark:text-[#C4ABFF]">
                    {formatDuration(group.minutes)}
                  </span>
                </button>
                {isOpen && (
                  <ul aria-label={`Entries of ${name}`} className="flex flex-col gap-1">
                    {group.entries.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex min-h-8 items-center gap-2 rounded-[0.5625rem] border border-[#E9E9E9] bg-white px-2.5 py-1 text-[0.6875rem] font-medium text-[#5D5D5D] dark:border-border dark:bg-card dark:text-title"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">
                            {format(fromDay(entry.date), 'EEE, MMM d')}, {formatTime12(entry.start)}{' '}
                            - {entry.end ? formatTime12(entry.end) : 'now'}
                          </span>
                          {entry.notes && (
                            <span className="block truncate text-[#909090]">{entry.notes}</span>
                          )}
                        </span>
                        <span className="font-medium text-[#7127EA] dark:text-[#C4ABFF]">
                          {formatDuration(entry.minutes)}
                        </span>
                        {canDelete && (
                          <RemoveButton
                            label={`Delete entry of ${formatTime12(entry.start)}`}
                            onClick={() => {
                              deleteEntry.mutate(entry.id)
                            }}
                            className="ml-0"
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Select Day & Date, Start Time and Stop Time (15-minute steps) and notes (165 characters). */
function ManualEntry({ entry }: { entry: EntryForm }) {
  const { form, isPending } = entry
  const [dayOpen, setDayOpen] = useState(false)
  const notesId = useId()
  const { errors } = form.formState
  const start = useWatch({ control: form.control, name: 'start' })
  const notes = useWatch({ control: form.control, name: 'notes' })

  return (
    <form
      noValidate
      aria-label="Add time entry"
      onSubmit={(event) => {
        event.preventDefault()
        void entry.submit()
      }}
      className={cn(fieldStyles.card, 'flex flex-col gap-2.5 p-2.5')}
    >
      <Controller
        control={form.control}
        name="date"
        render={({ field }) => (
          <FieldPopover
            open={dayOpen}
            onOpenChange={setDayOpen}
            label="Select Day & Date"
            className="w-[22rem] p-1"
            trigger={
              <button
                type="button"
                aria-label={`Day: ${format(fromDay(field.value), 'EEE, MMM d, yyyy')}`}
                className="flex h-10 items-center gap-2.5 rounded-[0.5625rem] border border-[#E9E9E9] bg-white pr-2.5 pl-1.5 text-xs font-medium text-[#676565] dark:border-border dark:bg-card dark:text-grey"
              >
                <span className={fieldStyles.cellIcon}>
                  <CalendarIcon />
                </span>
                {format(fromDay(field.value), 'EEE, MMM d, yyyy')}
                <ChevronDownIcon className="ml-auto h-[0.4rem] w-[0.75rem] text-[#7127EA] dark:text-[#C4ABFF]" />
              </button>
            }
          >
            <MonthCalendar
              selected={field.value}
              compact
              className="border-0"
              onSelect={(day) => {
                field.onChange(day)
                setDayOpen(false)
              }}
            />
          </FieldPopover>
        )}
      />
      <div className="grid grid-cols-2 gap-2">
        <Controller
          control={form.control}
          name="start"
          render={({ field }) => (
            <TimeSelect
              label="Start Time"
              value={field.value}
              error={errors.start?.message}
              options={QUARTER_TIMES.map((time) => ({
                value: time,
                label: formatTimeOption(time),
              }))}
              onChange={(value) => {
                field.onChange(value)
                const end = form.getValues('end')
                if (end && end <= value) form.setValue('end', '')
              }}
            />
          )}
        />
        <Controller
          control={form.control}
          name="end"
          render={({ field }) => (
            <TimeSelect
              label="Stop Time"
              value={field.value}
              error={errors.end?.message}
              options={QUARTER_TIMES.filter((time) => !start || time > start).map((time) => ({
                value: time,
                label: start
                  ? `${formatTimeOption(time)} (${formatDuration(minutesOf(time) - minutesOf(start))})`
                  : formatTimeOption(time),
              }))}
              onChange={field.onChange}
            />
          )}
        />
      </div>
      <div className="flex flex-col gap-1">
        <textarea
          aria-label="Notes"
          {...form.register('notes')}
          rows={2}
          maxLength={TIME_NOTES_MAX}
          placeholder="Add Notes"
          aria-describedby={notesId}
          aria-invalid={errors.notes !== undefined}
          className="resize-none rounded-[0.5625rem] border border-[#E9E9E9] px-2.5 py-2 text-xs tracking-[0.01em] text-[#3D3D3D] outline-none placeholder:text-[#909090] focus:border-[#A181FF] dark:border-border dark:text-title"
        />
        <span id={notesId} className="self-end text-[0.625rem] text-[#909090]">
          {notes.length}/{TIME_NOTES_MAX}
        </span>
        {errors.notes?.message && (
          <span role="alert" className={fieldStyles.error}>
            {errors.notes.message}
          </span>
        )}
      </div>
      <button type="submit" disabled={isPending} className={cn(fieldStyles.save, 'flex-none')}>
        Save
      </button>
    </form>
  )
}

interface TimeSelectProps {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  error?: string | undefined
}

function TimeSelect({ label, value, options, onChange, error }: TimeSelectProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={value ? `${label}: ${formatTimeOption(value)}` : label}
          aria-invalid={error !== undefined}
          className={cn(
            'flex h-10 min-w-0 items-center gap-2 rounded-[0.5625rem] border bg-white pr-2.5 pl-1.5 text-left text-xs tracking-[0.01em] outline-none focus-visible:border-[#A181FF] dark:bg-card',
            error ? 'border-[#DC3545]' : 'border-[#E9E9E9] dark:border-border',
          )}
        >
          <span className={fieldStyles.cellIcon}>
            <ClockIcon />
          </span>
          <span
            className={cn(
              'truncate',
              value ? 'font-medium text-[#676565] dark:text-grey' : 'text-[#909090]',
            )}
          >
            {value ? formatTimeOption(value) : label}
          </span>
          <ChevronDownIcon className="ml-auto h-[0.4rem] w-[0.75rem] shrink-0 text-[#7127EA] dark:text-[#C4ABFF]" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className={cn(fieldStyles.scroll, 'max-h-60 w-48 rounded-[0.625rem] p-1.5')}
        >
          {options.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => {
                onChange(option.value)
              }}
              className={cn(
                'rounded-md py-1.5 text-xs text-[#4F4F4F] dark:text-title',
                option.value === value && 'bg-[#EEE7FF] dark:bg-[#7127EA]/10',
              )}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
          {options.length === 0 && (
            <p className="px-4 py-2 text-xs text-[#909090]">No later time on this day</p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <span role="alert" className={fieldStyles.error}>
          {error}
        </span>
      )}
    </div>
  )
}
