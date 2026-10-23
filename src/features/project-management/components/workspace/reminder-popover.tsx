import { type ReactNode, useState } from 'react'
import { format, startOfDay } from 'date-fns'
import { Popover as PopoverPrimitive } from 'radix-ui'

import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

import { pmButton } from '../../pm-styles'
import { reminderQuickPicks } from './list-utils'
import { popupStyles } from './workspace-styles'

const toTime = (date: Date) => format(date, 'HH:mm')

function combine(day: Date, time: string): Date {
  const [hours = '9', minutes = '0'] = time.split(':')
  const next = new Date(day)
  next.setHours(Number(hours), Number(minutes), 0, 0)
  return next
}

/**
 * "Remind Me" (Reminder Calendar): quick picks with the day they land on, a month calendar and
 * a time, then Cancel / Save. Anchored to the row's menu button.
 */
export function ReminderPopover({
  open,
  onOpenChange,
  value,
  taskName,
  onSave,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The task's current reminder (ISO), if any. */
  value: string | null
  taskName: string
  onSave: (at: Date | null) => void
  /** The anchor (the row's three-dot button). */
  children: ReactNode
}) {
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Anchor asChild>{children}</PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="left"
          align="start"
          sideOffset={8}
          collisionPadding={8}
          aria-label={`Remind me about ${taskName}`}
          className={cn(
            popupStyles.content,
            'z-50 w-[36rem] max-w-[calc(100vw-1rem)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0',
          )}
        >
          {open && (
            <ReminderForm
              value={value}
              onCancel={() => {
                onOpenChange(false)
              }}
              onSave={(at) => {
                onSave(at)
                onOpenChange(false)
              }}
            />
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

function ReminderForm({
  value,
  onCancel,
  onSave,
}: {
  value: string | null
  onCancel: () => void
  onSave: (at: Date | null) => void
}) {
  const [now] = useState(() => new Date())
  const picks = reminderQuickPicks(now)
  const initial = value ? new Date(value) : null
  const [day, setDay] = useState<Date | undefined>(initial ?? undefined)
  const [time, setTime] = useState(initial ? toTime(initial) : '09:00')
  const [month, setMonth] = useState<Date>(initial ?? now)
  const chosen = day ? combine(day, time) : null

  return (
    <div className="flex flex-col gap-3">
      <h2 className={popupStyles.title}>Remind Me</h2>
      <div className="flex flex-col gap-3 sm:flex-row">
        <ul aria-label="Quick picks" className="flex shrink-0 flex-col gap-1 sm:w-48">
          {picks.map((pick) => {
            const active = chosen?.getTime() === pick.at.getTime()
            return (
              <li key={pick.label}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setDay(pick.at)
                    setMonth(pick.at)
                    setTime(toTime(pick.at))
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[0.8125rem] text-[#4F4F4F] outline-none hover:bg-[#F7F2FF] focus-visible:ring-2 focus-visible:ring-[#A181FF]',
                    active && 'bg-[#F0E9FD] text-[#7127EA]',
                  )}
                >
                  <span>{pick.label}</span>
                  <span className="text-xs text-[#909090]">{pick.hint}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="flex min-w-0 flex-1 flex-col gap-2 border-t border-[#EFEFEF] pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-3">
          <button
            type="button"
            onClick={() => {
              setMonth(now)
            }}
            className="self-end text-xs font-medium text-[#7127EA] hover:underline"
          >
            Today
          </button>
          <Calendar
            mode="single"
            selected={day}
            onSelect={setDay}
            month={month}
            onMonthChange={setMonth}
            disabled={{ before: startOfDay(now) }}
            classNames={{
              selected:
                '[&>button]:bg-[#7127EA] [&>button]:text-white [&>button]:hover:bg-[#7127EA] [&>button]:hover:text-white',
              today: '[&>button]:text-[#7127EA] [&>button]:font-semibold',
            }}
            className="p-0"
          />
          <label className="flex items-center justify-between gap-3 text-[0.8125rem] text-[#4F4F4F]">
            Add Time
            <input
              type="time"
              value={time}
              onChange={(event) => {
                setTime(event.target.value || '09:00')
              }}
              className={cn(popupStyles.field, 'w-32')}
            />
          </label>
        </div>
      </div>
      <p className="text-xs text-[#707070]" aria-live="polite">
        {chosen ? `Reminder on ${format(chosen, 'EEE, d MMM yyyy, h:mm a')}` : 'Pick a day.'}
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        {value && (
          <button
            type="button"
            onClick={() => {
              onSave(null)
            }}
            className="mr-auto text-xs font-medium text-[#B7192C] hover:underline"
          >
            Remove reminder
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className={cn(pmButton.cancel, 'h-9 rounded-xl px-5 text-sm')}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!chosen}
          onClick={() => {
            if (chosen) onSave(chosen)
          }}
          className={cn(pmButton.save, 'h-9 disabled:cursor-not-allowed disabled:opacity-50')}
        >
          Save
        </button>
      </div>
    </div>
  )
}
