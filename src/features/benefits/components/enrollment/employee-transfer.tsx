import { type KeyboardEvent, type ReactNode, useId, useState } from 'react'

import { useEmployeeLookupSearch } from '@/hooks/use-employee-lookup'
import { cn } from '@/lib/utils'

import { PEOPLE_PERMISSION, toLookupEmployee } from '../../api/benefits.api'
import type { LookupDepartment, LookupEmployee } from '../../types/benefits.types'
import {
  MoveAllLeftIcon,
  MoveAllRightIcon,
  MoveLeftIcon,
  MoveRightIcon,
  SearchIcon,
} from '../shared/benefit-icons'
import { accent, mediumText, ruleBg, smallText } from '../shared/benefit-styles'
import { BxSelect } from '../shared/controls'

/** Moves focus between a list's options with the arrow keys, Home and End. */
function onListKey(event: KeyboardEvent<HTMLUListElement>) {
  const options = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]')]
  const index = options.findIndex((option) => option === document.activeElement)
  let next: HTMLElement | undefined
  if (event.key === 'ArrowDown') next = options[Math.min(options.length - 1, index + 1)]
  else if (event.key === 'ArrowUp') next = options[Math.max(0, index - 1)]
  else if (event.key === 'Home') next = options[0]
  else if (event.key === 'End') next = options.at(-1)
  if (next) {
    event.preventDefault()
    next.focus()
  }
}

/**
 * One of the two lists: options can be picked (purple row) with a click, Space or Enter, and
 * moved straight across with a double click.
 */
function PeopleList({
  label,
  people,
  picked,
  onPick,
  onMove,
  header,
  footer,
  emptyText,
  className,
}: {
  label: string
  people: readonly LookupEmployee[]
  picked: ReadonlySet<string>
  onPick: (id: string) => void
  onMove: (id: string) => void
  header?: ReactNode
  /** Under the list (Load more). */
  footer?: ReactNode
  emptyText: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-[13.5625rem] min-w-0 flex-col overflow-hidden rounded-[6px] border-2 border-[#EBEFF8] dark:border-border',
        className,
      )}
    >
      {header}
      {people.length === 0 ? (
        <p className={cn(smallText, 'px-4 py-3 text-muted-foreground')}>{emptyText}</p>
      ) : (
        <ul
          role="listbox"
          aria-label={label}
          aria-multiselectable="true"
          onKeyDown={onListKey}
          className="min-h-0 flex-1 [scrollbar-width:thin] [scrollbar-color:#7469E8_transparent] overflow-y-auto py-1"
        >
          {people.map((person, index) => {
            const isPicked = picked.has(person.id)
            return (
              <li
                key={person.id}
                role="option"
                aria-selected={isPicked}
                tabIndex={index === 0 ? 0 : -1}
                onClick={() => {
                  onPick(person.id)
                }}
                onDoubleClick={() => {
                  onMove(person.id)
                }}
                onKeyDown={(event) => {
                  if (event.key === ' ' || event.key === 'Enter') {
                    event.preventDefault()
                    onPick(person.id)
                  }
                }}
                className={cn(
                  smallText,
                  'flex min-h-[2.125rem] cursor-default items-center px-4 outline-none select-none focus-visible:ring-2 focus-visible:ring-[#7469E8]/50 focus-visible:ring-inset',
                  isPicked ? 'bg-[#7469E8] text-white dark:bg-[#7F75F0]' : 'hover:bg-[#EBEFF8]/60',
                )}
              >
                {person.name}
              </li>
            )
          })}
        </ul>
      )}
      {footer}
    </div>
  )
}

const moveButton =
  'flex h-8 w-[3.25rem] items-center justify-center rounded-[4px] bg-[#EBEFF8] text-[#1C1B1F] outline-none hover:bg-[#DDE3F2] focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35 disabled:opacity-50 dark:bg-[#22304a] dark:text-heading'

/**
 * "Who can enroll during this plan year window?": Available Employees (filtered by department
 * with "All Employees", and searched on the server: `GET /employees/lookup?q`, paged with
 * "Load more") and Selected Employees (n), with the four move buttons.
 */
export function EmployeeTransfer({
  employees,
  departments,
  value,
  onChange,
  invalid,
}: {
  /** People already known by id (names the selected ones). */
  employees: readonly LookupEmployee[]
  departments: readonly LookupDepartment[]
  value: readonly string[]
  onChange: (ids: string[]) => void
  invalid?: boolean
}) {
  const [department, setDepartment] = useState('')
  const [search, setSearch] = useState('')
  const [pickedLeft, setPickedLeft] = useState<Set<string>>(new Set())
  const [pickedRight, setPickedRight] = useState<Set<string>>(new Set())
  const searchId = useId()
  const departmentId = useId()
  const lookup = useEmployeeLookupSearch(
    { permission: PEOPLE_PERMISSION, departmentId: department || undefined },
    { search },
  )

  const chosen = new Set(value)
  const query = search.trim()
  const available = lookup.rows.map(toLookupEmployee).filter((person) => !chosen.has(person.id))
  const selected = value.map((id): LookupEmployee => {
    const row = lookup.find(id)
    return (
      employees.find((person) => person.id === id) ??
      (row
        ? toLookupEmployee(row)
        : { id, name: id, jobTitle: '', departmentId: null, department: '' })
    )
  })

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }
  const add = (ids: readonly string[]) => {
    onChange([...value, ...ids.filter((id) => !chosen.has(id))])
    setPickedLeft(new Set())
  }
  const remove = (ids: readonly string[]) => {
    onChange(value.filter((id) => !ids.includes(id)))
    setPickedRight(new Set())
  }
  const pickedAvailable = available.filter((person) => pickedLeft.has(person.id)).map((p) => p.id)
  const pickedSelected = selected.filter((person) => pickedRight.has(person.id)).map((p) => p.id)

  return (
    <div className="grid gap-4 @3xl:grid-cols-[minmax(0,21.4375rem)_3.25rem_minmax(0,21.4375rem)] @3xl:gap-x-[1.6rem]">
      <div className="grid min-w-0 gap-2.5">
        <p id={departmentId} className={cn(mediumText, accent.text)}>
          Available Employees
        </p>
        <BxSelect
          aria-labelledby={departmentId}
          value={department}
          onChange={setDepartment}
          noneLabel="All Employees"
          options={departments.map((item) => ({ value: item.id, label: item.name }))}
          className="h-[3.25rem] rounded-[6px] border-2"
        />
        <PeopleList
          label="Available Employees"
          people={available}
          picked={pickedLeft}
          onPick={(id) => {
            setPickedLeft((set) => toggle(set, id))
          }}
          onMove={(id) => {
            add([id])
          }}
          emptyText={
            lookup.isPending
              ? 'Loading…'
              : query || department
                ? 'Nobody matches.'
                : 'Everyone is selected.'
          }
          footer={
            lookup.hasMore && (
              <button
                type="button"
                disabled={lookup.isFetching}
                onClick={lookup.loadMore}
                className={cn(
                  smallText,
                  'h-8 shrink-0 font-medium outline-none hover:bg-[#EBEFF8]/60 focus-visible:ring-2 focus-visible:ring-[#7469E8]/50 focus-visible:ring-inset disabled:opacity-60',
                  accent.text,
                )}
              >
                {lookup.isFetching ? 'Loading…' : 'Load more'}
              </button>
            )
          }
          header={
            <label
              htmlFor={searchId}
              className={cn('flex h-10 shrink-0 items-center gap-2 rounded-t-[5px] px-3.5', ruleBg)}
            >
              <SearchIcon className="size-[1.05rem] shrink-0 text-[#1C1B1F] dark:text-heading" />
              <span className="sr-only">Search employees</span>
              <input
                id={searchId}
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                }}
                placeholder="Search here..."
                autoComplete="off"
                className="h-full min-w-0 flex-1 bg-transparent text-xs text-heading outline-none placeholder:text-[#6D6D6D] dark:placeholder:text-muted-foreground"
              />
            </label>
          }
        />
      </div>

      <div className="flex justify-center gap-4 @3xl:flex-col @3xl:pt-[5.2rem]">
        <button
          type="button"
          aria-label="Add the picked employees"
          disabled={pickedAvailable.length === 0}
          onClick={() => {
            add(pickedAvailable)
          }}
          className={moveButton}
        >
          <MoveRightIcon className="h-[0.67rem] w-[0.38rem] rotate-90 @3xl:rotate-0" />
        </button>
        <button
          type="button"
          aria-label="Add everyone listed"
          disabled={available.length === 0 || lookup.isFetching}
          onClick={() => {
            add(available.map((person) => person.id))
          }}
          className={moveButton}
        >
          <MoveAllRightIcon className="h-[0.67rem] w-[0.77rem] rotate-90 @3xl:rotate-0" />
        </button>
        <button
          type="button"
          aria-label="Remove everyone selected"
          disabled={selected.length === 0}
          onClick={() => {
            remove(selected.map((person) => person.id))
          }}
          className={moveButton}
        >
          <MoveAllLeftIcon className="h-[0.67rem] w-[0.77rem] rotate-90 @3xl:rotate-0" />
        </button>
        <button
          type="button"
          aria-label="Remove the picked employees"
          disabled={pickedSelected.length === 0}
          onClick={() => {
            remove(pickedSelected)
          }}
          className={moveButton}
        >
          <MoveLeftIcon className="h-[0.67rem] w-[0.38rem] rotate-90 @3xl:rotate-0" />
        </button>
      </div>

      <div className="grid min-w-0 content-start gap-2.5 @3xl:pt-[3.1rem]">
        <p
          className={cn(mediumText, accent.text)}
        >{`Selected Employees (${String(selected.length)})`}</p>
        <PeopleList
          label="Selected Employees"
          people={selected}
          picked={pickedRight}
          onPick={(id) => {
            setPickedRight((set) => toggle(set, id))
          }}
          onMove={(id) => {
            remove([id])
          }}
          emptyText="Nobody yet. Pick people on the left and press the arrow."
          className={invalid ? 'border-destructive/60 dark:border-destructive/60' : undefined}
        />
      </div>
    </div>
  )
}
