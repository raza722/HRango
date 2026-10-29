import { useState } from 'react'
import { addMonths, format, isSameMonth, isToday, startOfMonth } from 'date-fns'

import { cn } from '@/lib/utils'

import { ChevronDownIcon, ChevronUpIcon } from './field-icons'
import { fromDay, monthDays, toDay, WEEKDAY_SHORT } from './field-utils'

const weeks = (days: Date[]): Date[][] =>
  Array.from({ length: Math.ceil(days.length / 7) }, (_, index) =>
    days.slice(index * 7, index * 7 + 7),
  )

interface MonthCalendarProps {
  /** The chosen day, `yyyy-MM-dd`. */
  selected: string | null
  /** A second day drawn with a ring (the other end of a start / due pair). */
  marked?: string | null
  onSelect: (day: string) => void
  className?: string
  compact?: boolean
}

const arrowButton =
  'flex size-8 items-center justify-center rounded-[0.53rem] bg-white dark:bg-card text-[#7127EA] dark:text-[#C4ABFF] shadow-[0_0_6px_rgba(0,0,0,0.08)] transition-colors hover:bg-[#F8F5FF] dark:hover:bg-[#7127EA]/15'

/**
 * The month of the Calendar popup (1:10061): "April 2025" and Today in purple, previous / next
 * arrows, Sun to Sat on a grey band, days SemiBold #4A4A4A, other months' days faded purple and
 * the chosen day in a purple circle.
 */
export function MonthCalendar({
  selected,
  marked = null,
  onSelect,
  className,
  compact = false,
}: MonthCalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(selected ? fromDay(selected) : new Date()))
  const days = monthDays(month)
  const title = format(month, 'MMMM yyyy')

  return (
    <div
      className={cn(
        'rounded-[0.95rem] border border-[#E9E9E9] bg-white px-2 pt-3 pb-2 dark:border-border dark:bg-card',
        className,
      )}
    >
      <div className="flex items-center gap-1 px-1">
        <h4
          aria-live="polite"
          className="text-sm font-bold tracking-[0.01em] whitespace-nowrap text-[#7127EA] dark:text-[#C4ABFF]"
        >
          {title}
        </h4>
        <button
          type="button"
          onClick={() => {
            setMonth(startOfMonth(new Date()))
          }}
          className="ml-auto rounded-[0.63rem] px-3 py-1.5 text-sm font-semibold tracking-[0.01em] text-[#7127EA] hover:bg-[#F8F5FF] dark:text-[#C4ABFF] dark:hover:bg-[#7127EA]/15"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => {
            setMonth((current) => addMonths(current, -1))
          }}
          aria-label="Previous month"
          className={arrowButton}
        >
          <ChevronUpIcon className="h-[0.4rem] w-[0.8rem]" />
        </button>
        <button
          type="button"
          onClick={() => {
            setMonth((current) => addMonths(current, 1))
          }}
          aria-label="Next month"
          className={cn(arrowButton, 'ml-1.5')}
        >
          <ChevronDownIcon className="h-[0.4rem] w-[0.8rem]" />
        </button>
      </div>
      <div role="grid" aria-label={title} className="mt-3">
        <div
          role="row"
          className="grid h-10 grid-cols-7 items-center rounded-[0.63rem] bg-[rgba(221,221,221,0.2)] px-1"
        >
          {WEEKDAY_SHORT.map((weekday) => (
            <span
              key={weekday}
              role="columnheader"
              className="text-center text-[0.84rem] font-bold text-[#4A4A4A] dark:text-title"
            >
              {weekday}
            </span>
          ))}
        </div>
        <div className={cn('mt-1.5 flex flex-col px-1', compact ? 'gap-0' : 'gap-0.5')}>
          {weeks(days).map((week) => (
            <div key={toDay(week[0] ?? month)} role="row" className="grid grid-cols-7">
              {week.map((date) => {
                const day = toDay(date)
                const isSelected = day === selected
                const isMarked = !isSelected && day === marked
                const outside = !isSameMonth(date, month)
                return (
                  <span key={day} role="gridcell" className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(day)
                      }}
                      aria-label={format(date, 'EEEE, MMMM d, yyyy')}
                      aria-pressed={isSelected}
                      className={cn(
                        'flex size-[1.625rem] items-center justify-center rounded-full text-xs font-semibold transition-colors',
                        compact ? 'my-0.5' : 'my-[0.15rem]',
                        outside ? 'text-[rgba(73,18,160,0.37)]' : 'text-[#4A4A4A] dark:text-title',
                        isToday(date) && !isSelected && 'ring-1 ring-[#A181FF]',
                        isMarked && 'bg-[#EEE7FF] dark:bg-[#7127EA]/10',
                        isSelected
                          ? 'bg-[#7127EA] text-white'
                          : 'hover:bg-[#EEE7FF] dark:hover:bg-[#7127EA]/25',
                      )}
                    >
                      {format(date, 'd')}
                    </button>
                  </span>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
