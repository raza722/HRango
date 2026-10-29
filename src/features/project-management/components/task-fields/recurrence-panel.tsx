import { useId, useState } from 'react'
import { addMonths, format } from 'date-fns'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import type { Recurrence, RecurrenceUnit } from '../../types/pm.types'
import { BackIcon, ChevronDownIcon } from './field-icons'
import { FieldPopover } from './field-popup'
import { fieldStyles } from './field-styles'
import { fromDay, toDay, WEEKDAY_SHORT } from './field-utils'
import { MonthCalendar } from './month-calendar'

const UNIT_LABELS: Record<RecurrenceUnit, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  year: 'Year',
}

const box =
  'h-10 rounded-[0.5625rem] border border-[#E9E9E9] dark:border-border bg-white dark:bg-card text-[0.71875rem] font-medium tracking-[0.01em] outline-none focus:border-[#A181FF] focus-visible:border-[#A181FF]'

interface RecurrencePanelProps {
  value: Recurrence
  onChange: (value: Recurrence) => void
  onBack: () => void
}

/**
 * Custom Recurrence (1:10346): the back arrow, every n Day / Week / Month / Year, Repeat On
 * weekdays (weekly repeats) and When Closed: Never, On a date or After n Occurrence.
 */
export function RecurrencePanel({ value, onChange, onBack }: RecurrencePanelProps) {
  const [dateOpen, setDateOpen] = useState(false)
  const radioName = useId()
  const set = (patch: Partial<Recurrence>) => {
    onChange({ ...value, ...patch })
  }
  const endsOn = value.ends.kind === 'on' ? value.ends.date : toDay(addMonths(new Date(), 1))
  const endsAfter = value.ends.kind === 'after' ? value.ends.count : 1

  const toggleWeekday = (weekday: number) => {
    const weekdays = value.weekdays.includes(weekday)
      ? value.weekdays.filter((other) => other !== weekday)
      : [...value.weekdays, weekday].sort()
    set({ weekdays })
  }

  return (
    <section aria-label="Custom Recurrence" className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to calendar"
        className="flex size-[2.0625rem] items-center justify-center rounded-full border-[1.5px] border-[#7127EA] text-[#7127EA] hover:bg-[#F8F5FF] dark:text-[#C4ABFF] dark:hover:bg-[#7127EA]/15"
      >
        <BackIcon className="size-5" />
      </button>

      <div className="flex flex-col gap-2">
        <h4 className={fieldStyles.groupTitle}>Custom Recurrence</h4>
        <div className="flex items-center justify-between gap-3">
          <NumberBox
            label="Repeat every"
            value={value.every}
            max={365}
            onChange={(every) => {
              set({ every })
            }}
            className={cn(
              box,
              'w-[2.8rem] text-center text-[0.8125rem] text-[#3D3D3D] dark:text-title',
            )}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Repeat unit: ${UNIT_LABELS[value.unit]}`}
              className={cn(
                box,
                'flex w-[7.3rem] items-center justify-between px-3 text-[#909090]',
              )}
            >
              {UNIT_LABELS[value.unit]}
              <ChevronDownIcon className="h-[0.4rem] w-[0.75rem] text-[#7127EA] dark:text-[#C4ABFF]" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[7.3rem]">
              <DropdownMenuRadioGroup
                value={value.unit}
                onValueChange={(unit) => {
                  set({ unit: unit as RecurrenceUnit })
                }}
              >
                {(Object.keys(UNIT_LABELS) as RecurrenceUnit[]).map((unit) => (
                  <DropdownMenuRadioItem key={unit} value={unit} className="text-xs">
                    {UNIT_LABELS[unit]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {value.unit === 'week' && (
        <div className="flex flex-col gap-2">
          <h4 className={fieldStyles.groupTitle}>Repeat On</h4>
          <div className="flex flex-wrap justify-between gap-1">
            {WEEKDAY_SHORT.map((label, weekday) => {
              const on = value.weekdays.includes(weekday)
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    toggleWeekday(weekday)
                  }}
                  className={cn(
                    'flex size-[2.0625rem] items-center justify-center rounded-full border-[1.4px] text-[0.6875rem] font-medium tracking-[0.01em] text-[#4A4A4A] transition-colors dark:text-title',
                    on
                      ? 'border-[#7127EA] bg-[#DAD0FF] dark:bg-[#7127EA]/25'
                      : 'border-[#DAD0FF] bg-white hover:bg-[#F8F5FF] dark:border-border dark:bg-card dark:hover:bg-[#7127EA]/15',
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <fieldset className="flex flex-col gap-2.5">
        <legend className={cn(fieldStyles.groupTitle, 'mb-2')}>When Closed</legend>
        <Radio
          name={radioName}
          label="Never"
          checked={value.ends.kind === 'never'}
          onSelect={() => {
            set({ ends: { kind: 'never' } })
          }}
        />
        <div className="flex items-center justify-between gap-3">
          <Radio
            name={radioName}
            label="On"
            checked={value.ends.kind === 'on'}
            onSelect={() => {
              set({ ends: { kind: 'on', date: endsOn } })
            }}
          />
          <FieldPopover
            open={dateOpen}
            onOpenChange={setDateOpen}
            label="Ends on"
            align="end"
            className="w-[22rem] p-1"
            trigger={
              <button
                type="button"
                aria-label={`Ends on ${format(fromDay(endsOn), 'MMM d, yyyy')}`}
                className={cn(
                  box,
                  'flex h-8 w-[7.3rem] items-center justify-between gap-2 px-2.5 text-[#909090]',
                )}
              >
                {format(fromDay(endsOn), 'MMM d, yyyy')}
                <ChevronDownIcon className="h-[0.4rem] w-[0.75rem] shrink-0 text-[#7127EA] dark:text-[#C4ABFF]" />
              </button>
            }
          >
            <MonthCalendar
              selected={endsOn}
              compact
              className="border-0"
              onSelect={(date) => {
                set({ ends: { kind: 'on', date } })
                setDateOpen(false)
              }}
            />
          </FieldPopover>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Radio
            name={radioName}
            label="After"
            checked={value.ends.kind === 'after'}
            onSelect={() => {
              set({ ends: { kind: 'after', count: endsAfter } })
            }}
          />
          <label className="flex items-center gap-2 text-[0.71875rem] font-medium tracking-[0.01em] text-[#4A4A4A] dark:text-title">
            <NumberBox
              label="Occurrences"
              value={endsAfter}
              max={999}
              onChange={(count) => {
                set({ ends: { kind: 'after', count } })
              }}
              className={cn(box, 'h-8 w-[2.8rem] text-center text-[#3D3D3D] dark:text-title')}
            />
            Occurrence
          </label>
        </div>
      </fieldset>
    </section>
  )
}

/** A whole number from 1 to `max`; it may be empty while typing and settles on blur. */
function NumberBox({
  label,
  value,
  max,
  onChange,
  className,
}: {
  label: string
  value: number
  max: number
  onChange: (value: number) => void
  className: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      type="number"
      min={1}
      max={max}
      aria-label={label}
      value={draft ?? value}
      onChange={(event) => {
        const typed = event.target.value
        setDraft(typed)
        const number = Math.floor(Number(typed))
        if (typed !== '' && number >= 1 && number <= max) onChange(number)
      }}
      onBlur={() => {
        setDraft(null)
      }}
      className={className}
    />
  )
}

function Radio({
  name,
  label,
  checked,
  onSelect,
}: {
  name: string
  label: string
  checked: boolean
  onSelect: () => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[0.71875rem] font-medium tracking-[0.01em] text-[#4A4A4A] dark:text-title">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          'flex size-[1.06rem] items-center justify-center rounded-full border peer-focus-visible:ring-2 peer-focus-visible:ring-[#A181FF]',
          checked ? 'border-[#A181FF]' : 'border-[#979797] dark:border-border',
        )}
      >
        <span
          className={cn('size-[0.7rem] rounded-full', checked ? 'bg-[#7127EA]' : 'bg-[#979797]')}
        />
      </span>
      {label}
    </label>
  )
}
