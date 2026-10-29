import { type ReactNode, type SyntheticEvent, useId, useState } from 'react'
import { ListTodo, Plus, Trash2 } from 'lucide-react'

import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

import { PERSONAL_TITLE_MAX } from '../../api/dashboards.api'
import {
  useAddPersonalItem,
  useDeletePersonalItem,
  usePersonalList,
  useSetPersonalItemDone,
} from '../../hooks/use-dashboards'
import { toDay } from '../task-fields/field-utils'
import {
  NotAvailable,
  PreviewBadge,
  Widget,
  WidgetEmpty,
  WidgetError,
  WidgetSkeleton,
} from './dashboard-parts'
import { dash } from './dashboard-styles'
import { dueLabel } from './dashboard-utils'

function AddItem() {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const add = useAddPersonalItem()
  const errorId = useId()

  const submit = (event: SyntheticEvent) => {
    event.preventDefault()
    const name = title.trim()
    if (!name) {
      setError('Write what you need to do')
      return
    }
    if (name.length > PERSONAL_TITLE_MAX) {
      setError(`Keep it to ${String(PERSONAL_TITLE_MAX)} characters`)
      return
    }
    setError(null)
    add.mutate(
      { title: name, dueDate: dueDate || null },
      {
        onSuccess: () => {
          setTitle('')
          setDueDate('')
        },
      },
    )
  }

  const field =
    'h-10 min-w-0 rounded-[0.625rem] border border-[#E9E9E9] bg-card px-3 text-sm text-title outline-none placeholder:text-[#909090] focus:border-[#7127EA] focus:ring-4 focus:ring-[#7127EA]/20 dark:border-border'
  return (
    <form onSubmit={submit} noValidate className="grid gap-1.5">
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor={`${errorId}-title`}>
          New item
        </label>
        <input
          id={`${errorId}-title`}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            if (error) setError(null)
          }}
          placeholder="Add something to do…"
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className={cn(field, 'flex-1 basis-48', error && 'border-[#DC3545]')}
        />
        {/* The date and Add wrap together, so Add never sits alone on a line. */}
        <div className="flex flex-1 basis-56 gap-2">
          <label className="sr-only" htmlFor={`${errorId}-due`}>
            Due date
          </label>
          <input
            id={`${errorId}-due`}
            type="date"
            value={dueDate}
            onChange={(event) => {
              setDueDate(event.target.value)
            }}
            className={cn(field, 'flex-1')}
          />
          <button
            type="submit"
            disabled={add.isPending}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[0.625rem] bg-[#7127EA] px-4 text-sm font-semibold text-white transition-colors outline-none hover:bg-[#5f1fd0] focus-visible:ring-2 focus-visible:ring-[#A181FF] disabled:opacity-60"
          >
            <Plus aria-hidden="true" className="size-4" />
            Add
          </button>
        </div>
      </div>
      {error && (
        <p id={errorId} className="text-xs text-[#DC3545]">
          {error}
        </p>
      )}
    </form>
  )
}

/**
 * Personal List (pending endpoint T11): the caller's own to-dos, not tied to a workspace. Tick to
 * finish, the bin to remove.
 */
export function PersonalListWidget({ className }: { className?: string }) {
  const list = usePersonalList()
  const toggle = useSetPersonalItemDone()
  const remove = useDeletePersonalItem()
  const now = new Date()

  let body: ReactNode
  if (list.isPending) body = <WidgetSkeleton rows={3} />
  else if (list.isError)
    body = <WidgetError message={list.error.message} onRetry={() => void list.refetch()} />
  else if (!list.data.available) body = <NotAvailable what="Personal lists" dependency="T11" />
  else {
    // Open items first, soonest due first (no date last); then the newest.
    const items = list.data.data.toSorted(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
        b.createdAt.localeCompare(a.createdAt),
    )
    body = (
      <div className="grid gap-3">
        <AddItem />
        {items.length === 0 ? (
          <WidgetEmpty icon={<ListTodo />} title="Your list is empty">
            Jot down things that are not tasks of a workspace.
          </WidgetEmpty>
        ) : (
          <ul aria-label="Personal list" className="grid gap-1">
            {items.map((item) => {
              const overdue = !item.done && item.dueDate !== null && item.dueDate < toDay(now)
              return (
                <li key={item.id} className={cn(dash.row, 'gap-2.5 py-1.5')}>
                  <Checkbox
                    checked={item.done}
                    aria-label={
                      item.done ? `Mark ${item.title} as not done` : `Mark ${item.title} as done`
                    }
                    onCheckedChange={(checked) => {
                      toggle.mutate({ item, done: checked === true })
                    }}
                  />
                  <span className="grid min-w-0 flex-1">
                    <span
                      className={cn(
                        'truncate text-sm text-title',
                        item.done && 'text-grey line-through',
                      )}
                    >
                      {item.title}
                    </span>
                    {item.dueDate && (
                      <span
                        className={cn(
                          'text-xs',
                          overdue ? 'text-[#B7192C] dark:text-[#FF9AA3]' : 'text-grey',
                        )}
                      >
                        {dueLabel({ dueDate: item.dueDate, done: item.done }, now)}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    aria-label={`Delete ${item.title}`}
                    onClick={() => {
                      remove.mutate(item)
                    }}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-grey transition-colors outline-none hover:bg-[#FDECEE] hover:text-[#DC3545] focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:hover:bg-[#DC3545]/15"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )
  }

  const open = list.data?.available ? list.data.data.filter((item) => !item.done).length : undefined
  return (
    <Widget
      title="Personal List"
      icon={<ListTodo />}
      description="Your own to-dos, visible only to you."
      count={open}
      badge={list.data?.available ? <PreviewBadge dependency="T11" /> : undefined}
      className={className}
    >
      {body}
    </Widget>
  )
}
