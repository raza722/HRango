import { useState } from 'react'
import { format, parse } from 'date-fns'
import { Check, ChevronLeft, ChevronRight, House } from 'lucide-react'

import { EmployeeAvatar } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import type { ShiftDay } from './work-from-home.types'

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())
/** "Sep 24, 24". */
const short = (date: string) => format(day(date), 'MMM d, yy')
/** "Oct - Week 4": the week of the month. */
const weekOf = (date: string) =>
  `${format(day(date), 'MMM')} - Week ${String(Math.ceil(day(date).getDate() / 7))}`

/** Seven days a page, as a week. */
const PAGE = 7

interface ShiftStripProps {
  person: { name: string; code: string; photoUrl?: string | null | undefined }
  /** The days to show, in date order. */
  days: readonly ShiftDay[] | undefined
  /** Ticked shifts. */
  selected: ReadonlySet<string>
  /** Ticks a shift; leave out for a read-only strip. */
  onToggle?: ((date: string) => void) | undefined
  loading?: boolean
  /** Names the strip for screen readers ("Shifts to work from home"). */
  label: string
  className?: string
}

/**
 * The strip the Work From Home and Leave popups draw: the blue week header
 * with its arrows over the person, then one column per day ("Tue 24",
 * "Sep - Week 4") with the day's shift as a chip, or "Rest Day" / "Day off".
 * A ticked shift is blue with a tick. Long ranges page by seven days.
 */
export function ShiftStrip({
  person,
  days,
  selected,
  onToggle,
  loading = false,
  label,
  className,
}: ShiftStripProps) {
  const [page, setPage] = useState(0)
  const all = days ?? []
  const pages = Math.max(1, Math.ceil(all.length / PAGE))
  const current = Math.min(page, pages - 1)
  const shown = all.slice(current * PAGE, current * PAGE + PAGE)
  const first = shown[0]?.date
  const last = shown.at(-1)?.date

  return (
    <section
      aria-label={label}
      className={cn('max-w-full overflow-x-auto rounded-md font-inter', className)}
    >
      <div className="flex w-max min-w-full border border-[#E4E7EC] dark:border-border">
        <div className="grid w-60 shrink-0 grid-rows-[4rem_auto] @xl:w-[17rem]">
          <div className="flex items-center justify-between gap-1 bg-[#2F6FED] px-2 text-white dark:bg-primary">
            <button
              type="button"
              aria-label="Previous week"
              disabled={current === 0}
              onClick={() => {
                setPage(current - 1)
              }}
              className="grid size-8 place-items-center rounded outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-40"
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
            <p aria-live="polite" className="text-base font-medium whitespace-nowrap @xl:text-lg">
              {first && last ? `${short(first)} - ${short(last)}` : '—'}
            </p>
            <button
              type="button"
              aria-label="Next week"
              disabled={current >= pages - 1}
              onClick={() => {
                setPage(current + 1)
              }}
              className="grid size-8 place-items-center rounded outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-40"
            >
              <ChevronRight aria-hidden="true" className="size-5" />
            </button>
          </div>
          <div className="flex min-h-[4.5rem] items-center gap-3 border-t border-[#E4E7EC] bg-card px-4 dark:border-border">
            <EmployeeAvatar
              name={person.name}
              photoUrl={person.photoUrl ?? null}
              className="size-10 shrink-0"
            />
            <span className="min-w-0">
              <span className="block truncate text-[0.8125rem] font-medium text-heading">
                {person.name}
              </span>
              <span className="block truncate text-[0.6875rem] text-field-value">
                {person.code}
              </span>
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center gap-2 p-3">
            <Skeleton className="h-24 w-24" />
            <Skeleton className="h-24 w-24" />
            <Skeleton className="h-24 w-24" />
          </div>
        ) : shown.length === 0 ? (
          <p className="flex flex-1 items-center px-4 text-sm text-grey">
            Choose the dates to see the shifts.
          </p>
        ) : (
          <ul className="flex">
            {shown.map((item) => (
              <li
                key={item.date}
                className="grid w-24 shrink-0 grid-rows-[2rem_2rem_auto] border-l border-[#E4E7EC] text-center dark:border-border"
              >
                <span className="grid place-items-center bg-[#D9D9D9]/50 text-[0.8125rem] text-field-value dark:bg-muted">
                  {format(day(item.date), 'EEE d')}
                </span>
                <span className="grid place-items-center bg-[#D9D9D9]/80 text-[0.8125rem] whitespace-nowrap text-field-value dark:bg-muted/70">
                  {weekOf(item.date)}
                </span>
                <span className="grid min-h-[4.5rem] place-items-center bg-[#D9D9D9]/50 p-1.5 dark:bg-muted">
                  <DayChip item={item} ticked={selected.has(item.date)} onToggle={onToggle} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

/** A shift (blue when ticked), an existing work-from-home day, or a rest day / day off. */
function DayChip({
  item,
  ticked,
  onToggle,
}: {
  item: ShiftDay
  ticked: boolean
  onToggle: ((date: string) => void) | undefined
}) {
  const name = format(day(item.date), 'EEEE, MMMM d')
  if (item.status !== 'shift') {
    return (
      <span className="rounded-[3px] px-1 text-[0.6875rem] leading-tight font-medium text-grey">
        {item.label}
      </span>
    )
  }
  const chip = cn(
    'flex w-full flex-col items-start gap-0.5 rounded-[3px] px-1.5 py-1 text-left text-[0.6875rem] leading-tight',
    ticked
      ? 'bg-[#2F6FED] text-white dark:bg-primary'
      : 'border border-[#2F6FED]/50 bg-card text-[#2F6FED] dark:border-primary/60 dark:text-heading',
  )
  const times = (
    <>
      {ticked ? (
        <Check aria-hidden="true" className="size-3" />
      ) : item.workFromHome ? (
        <House aria-hidden="true" className="size-3" />
      ) : null}
      <span>{item.label}</span>
    </>
  )
  // An existing work-from-home day cannot be asked for again.
  if (!onToggle || (item.workFromHome && !ticked)) {
    return (
      <span
        className={cn(chip, item.workFromHome && !ticked && 'opacity-70')}
        title={item.workFromHome && !ticked ? 'Already working from home' : undefined}
      >
        {times}
        {item.workFromHome && !ticked && <span className="sr-only"> (already from home)</span>}
      </span>
    )
  }
  return (
    <button
      type="button"
      aria-pressed={ticked}
      aria-label={`${name}, ${item.label}`}
      onClick={() => {
        onToggle(item.date)
      }}
      className={cn(chip, 'outline-none focus-visible:ring-2 focus-visible:ring-ring/60')}
    >
      {times}
    </button>
  )
}
