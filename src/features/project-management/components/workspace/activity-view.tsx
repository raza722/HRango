import { type ReactNode, useMemo, useState } from 'react'
import { format, isSameDay, parseISO, subDays } from 'date-fns'
import { Download } from 'lucide-react'

import { EmployeeAvatar } from '@/components/layout/employee-avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { downloadText, toCsv } from '@/features/payroll'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { cn } from '@/lib/utils'

import { PRIORITY_META } from '../../constants'
import { useWorkspaceActivity } from '../../hooks/use-pm'
import type { ActivityEntry, PmPerson, Priority, Workspace } from '../../types/pm.types'

/**
 * What each action is called in the Action filter and the CSV. The API's action names are not
 * documented; these are the ones the mock writes, and any other name is shown as it comes.
 */
const ACTION_LABELS: Record<string, string> = {
  created: 'Created',
  updated: 'Changed',
  deleted: 'Deleted',
  commented: 'Commented',
  extension_requested: 'Extension requested',
  extension_approved: 'Extension approved',
  extension_rejected: 'Extension rejected',
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  description: 'Description',
  status: 'Status',
  priority: 'Priority',
  start_date: 'Start date',
  due_date: 'Due date',
  assignees: 'Assignees',
  task_list: 'List',
  tags: 'Tags',
  time_estimate: 'Time estimate',
}

/** `dueDate` and `due_date` alike. */
const snake = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()

function humanise(name: string): string {
  const words = snake(name).replace(/[_-]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const actionLabel = (action: string) => ACTION_LABELS[action] ?? humanise(action)
const fieldLabel = (field: string) => FIELD_LABELS[snake(field)] ?? humanise(field)

/** A logged value as people read it: dates as `5 Nov 2026`, priorities by their label. */
function valueText(field: string, value: string): string {
  const name = snake(field)
  if (name.endsWith('date') && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return format(parseISO(value.slice(0, 10)), 'd MMM yyyy')
  }
  if (name === 'priority' && value in PRIORITY_META) return PRIORITY_META[value as Priority].label
  return value
}

const Value = ({ children }: { children: ReactNode }) => (
  <span className="font-medium text-[#303030] dark:text-title">{children}</span>
)

/** The line's sentence after the person's name ("changed Status of [task] from A to B"). */
function describe(entry: ActivityEntry, item: ReactNode): ReactNode {
  const field = entry.fieldName
  const from = field && entry.oldValue !== null ? valueText(field, entry.oldValue) : null
  const to = field && entry.newValue !== null ? valueText(field, entry.newValue) : null
  switch (entry.action) {
    case 'created':
      return <>created {item}</>
    case 'deleted':
      return <>deleted {item}</>
    case 'commented':
      return <>commented on {item}</>
    case 'extension_requested':
      return (
        <>
          asked for more time on {item}
          {to && (
            <>
              {' '}
              (due date <Value>{to}</Value>
              {from && (
                <>
                  , was <Value>{from}</Value>
                </>
              )}
              )
            </>
          )}
        </>
      )
    case 'extension_approved':
      return (
        <>
          approved the extension of {item}
          {to && (
            <>
              {' '}
              to <Value>{to}</Value>
            </>
          )}
        </>
      )
    case 'extension_rejected':
      return <>rejected the extension of {item}</>
  }
  const verb = entry.action === 'updated' ? null : actionLabel(entry.action).toLowerCase()
  if (!field)
    return verb ? (
      <>
        {verb} {item}
      </>
    ) : (
      <>changed {item}</>
    )
  const label = <Value>{fieldLabel(field)}</Value>
  if (from === null && to === null) {
    return (
      <>
        {verb ?? 'changed'} {label} of {item}
      </>
    )
  }
  if (from === null) {
    return (
      <>
        {verb ?? 'set'} {label} of {item} to <Value>{to}</Value>
      </>
    )
  }
  if (to === null) {
    return (
      <>
        {verb ?? 'cleared'} {label} of {item} (was <Value>{from}</Value>)
      </>
    )
  }
  return (
    <>
      {verb ?? 'changed'} {label} of {item} from <Value>{from}</Value> to <Value>{to}</Value>
    </>
  )
}

function dayLabel(day: Date, now: Date): string {
  if (isSameDay(day, now)) return 'Today'
  if (isSameDay(day, subDays(now, 1))) return 'Yesterday'
  return format(day, 'EEEE, d MMMM yyyy')
}

const CSV_HEADER = ['Date', 'Time', 'By', 'Action', 'Item code', 'Item', 'Field', 'From', 'To']

const label = 'grid gap-1 text-xs font-medium text-[#707070] dark:text-grey'
const control =
  'h-10 rounded-xl border border-[#E9E9E9] dark:border-border bg-white dark:bg-card px-3 text-sm text-[#303030] dark:text-title outline-none focus-visible:ring-2 focus-visible:ring-[#A181FF]'

/**
 * The Activity view (not drawn; approved layout): the workspace's history newest first, grouped by
 * day, with search, an action filter, a date range, Export CSV of the lines loaded and "Load more".
 * Task names open the task in the List view while it still exists.
 */
export function ActivityView({
  workspace,
  people,
  taskIds,
  onOpenTask,
}: {
  workspace: Workspace
  people: Map<string, PmPerson>
  /** The workspace's tasks, so lines of deleted ones are not links. */
  taskIds: ReadonlySet<string>
  onOpenTask: (taskId: string) => void
}) {
  const [now] = useState(() => new Date())
  const [q, setQ] = useState('')
  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const search = useDebouncedValue(q.trim(), 300)
  const activity = useWorkspaceActivity(workspace.id, { q: search, action, from, to })

  const entries = useMemo(
    () => activity.data?.pages.flatMap((page) => page.data) ?? [],
    [activity.data],
  )
  const total = activity.data?.pages[0]?.meta.total ?? 0
  const photoByName = useMemo(
    () => new Map([...people.values()].map((person) => [person.name, person.photoUrl])),
    [people],
  )
  const actions = useMemo(
    () => [...new Set([...Object.keys(ACTION_LABELS), ...entries.map((entry) => entry.action)])],
    [entries],
  )
  const days = useMemo(() => {
    const groups: { key: string; label: string; entries: ActivityEntry[] }[] = []
    for (const entry of entries) {
      const at = parseISO(entry.performedAt)
      const key = format(at, 'yyyy-MM-dd')
      const last = groups.at(-1)
      if (last?.key === key) last.entries.push(entry)
      else groups.push({ key, label: dayLabel(at, now), entries: [entry] })
    }
    return groups
  }, [entries, now])

  const filtered = search !== '' || action !== '' || from !== '' || to !== ''
  const badRange = from !== '' && to !== '' && from > to

  const exportCsv = () => {
    const csv = toCsv(
      CSV_HEADER,
      entries.map((entry) => {
        const at = parseISO(entry.performedAt)
        const field = entry.fieldName
        return [
          format(at, 'yyyy-MM-dd'),
          format(at, 'HH:mm'),
          entry.performedByName ?? '',
          actionLabel(entry.action),
          entry.itemCode ?? '',
          entry.itemName ?? '',
          field ? fieldLabel(field) : '',
          field && entry.oldValue !== null ? valueText(field, entry.oldValue) : '',
          field && entry.newValue !== null ? valueText(field, entry.newValue) : '',
        ]
      }),
    )
    const slug = workspace.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    downloadText(csv, `${slug || 'workspace'}-activity-${format(new Date(), 'yyyy-MM-dd')}.csv`)
  }

  const item = (entry: ActivityEntry) => {
    const name = entry.itemName ?? entry.itemCode ?? 'an item'
    if (entry.entityType !== 'task' || !taskIds.has(entry.entityId)) return <Value>{name}</Value>
    return (
      <button
        type="button"
        onClick={() => {
          onOpenTask(entry.entityId)
        }}
        className="inline rounded text-left font-medium text-[#7127EA] underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:text-[#C4ABFF]"
      >
        {name}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="search"
        aria-label="Filter the activity"
        className="flex flex-wrap items-end gap-2 rounded-xl bg-white p-3 dark:bg-card"
      >
        <label className={cn(label, 'w-full min-w-48 sm:w-auto sm:flex-1')}>
          Search
          <input
            type="search"
            value={q}
            onChange={(event) => {
              setQ(event.target.value)
            }}
            placeholder="Task, code or person"
            className={control}
          />
        </label>
        <label className={cn(label, 'w-full sm:w-auto')}>
          Action
          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value)
            }}
            className={control}
          >
            <option value="">All</option>
            {actions.map((name) => (
              <option key={name} value={name}>
                {actionLabel(name)}
              </option>
            ))}
          </select>
        </label>
        <label className={cn(label, 'min-w-0 flex-1 sm:flex-none')}>
          From
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => {
              setFrom(event.target.value)
            }}
            className={control}
          />
        </label>
        <label className={cn(label, 'min-w-0 flex-1 sm:flex-none')}>
          To
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => {
              setTo(event.target.value)
            }}
            className={control}
          />
        </label>
        <button
          type="button"
          disabled={entries.length === 0}
          onClick={exportCsv}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#7127EA] bg-white px-4 text-sm font-semibold text-[#7127EA] outline-none hover:bg-[#F0E9FD] focus-visible:ring-2 focus-visible:ring-[#A181FF] disabled:opacity-50 sm:w-auto dark:bg-card dark:text-[#C4ABFF] dark:hover:bg-[#7127EA]/25"
        >
          <Download aria-hidden="true" className="size-4" />
          Export CSV
        </button>
      </div>

      {badRange && (
        <p role="alert" className="text-sm text-[#B7192C] dark:text-[#FF9AA3]">
          From is after To: pick a From date on or before the To date.
        </p>
      )}

      {activity.isPending ? (
        <div role="status" aria-label="Loading activity" className="grid gap-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : activity.isError ? (
        <div
          role="alert"
          className="grid justify-items-center gap-3 rounded-xl bg-white px-6 py-10 dark:bg-card"
        >
          <p className="text-sm text-[#303030] dark:text-title">Could not load the activity.</p>
          <button
            type="button"
            onClick={() => {
              void activity.refetch()
            }}
            className="inline-flex h-9 items-center rounded-xl bg-[#7127EA] px-4 text-sm font-semibold text-white hover:bg-[#5f1fd0]"
          >
            Try again
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-xl bg-white px-6 py-12 text-center dark:bg-card">
          <h2 className="text-base font-medium text-[#303030] dark:text-title">
            {filtered ? 'Nothing matches these filters' : 'No activity yet'}
          </h2>
          <p className="max-w-md text-sm text-[#707070] dark:text-grey">
            {filtered
              ? 'Try another action or a wider date range.'
              : 'Changes to the tasks of this workspace show here as they happen.'}
          </p>
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setQ('')
                setAction('')
                setFrom('')
                setTo('')
              }}
              className="inline-flex h-9 items-center rounded-xl border border-[#7127EA] px-4 text-sm font-semibold text-[#7127EA] hover:bg-[#F0E9FD] dark:text-[#C4ABFF] dark:hover:bg-[#7127EA]/25"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <p
            className={cn(
              'text-sm text-[#707070] dark:text-grey',
              activity.isPlaceholderData && 'opacity-60',
            )}
            aria-live="polite"
          >
            Showing {entries.length} of {total} {total === 1 ? 'change' : 'changes'}
          </p>
          <ol
            aria-label="Activity, newest first"
            className={cn('grid gap-4', activity.isPlaceholderData && 'opacity-60')}
          >
            {days.map((day) => (
              <li key={day.key} className="grid gap-1">
                <h3 className="px-1 text-xs font-semibold tracking-wide text-[#707070] uppercase dark:text-grey">
                  {day.label}
                </h3>
                <ul className="grid divide-y divide-[#F1F1F1] rounded-xl bg-white dark:divide-border dark:bg-card">
                  {day.entries.map((entry) => {
                    const who = entry.performedByName ?? 'Someone'
                    const at = parseISO(entry.performedAt)
                    return (
                      <li key={entry.id} className="flex items-start gap-3 px-3 py-2.5 sm:px-4">
                        <EmployeeAvatar
                          name={who}
                          photoUrl={photoByName.get(who) ?? null}
                          className="size-8 shrink-0"
                          fallbackClassName="text-[0.625rem]"
                        />
                        <p className="min-w-0 flex-1 pt-1 text-sm break-words text-[#5A5A5A] dark:text-title">
                          <Value>{who}</Value> {describe(entry, item(entry))}
                        </p>
                        <time
                          dateTime={entry.performedAt}
                          title={format(at, 'd MMM yyyy, h:mm a')}
                          className="shrink-0 pt-1.5 text-xs whitespace-nowrap text-[#909090]"
                        >
                          {format(at, 'h:mm a')}
                        </time>
                      </li>
                    )
                  })}
                </ul>
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
              className="mx-auto inline-flex h-10 items-center rounded-xl border border-[#E9E9E9] bg-white px-5 text-sm font-semibold text-[#3D3D3D] outline-none hover:bg-[#F8F5FF] focus-visible:ring-2 focus-visible:ring-[#A181FF] disabled:opacity-60 dark:border-border dark:bg-card dark:text-title dark:hover:bg-[#7127EA]/15"
            >
              {activity.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
