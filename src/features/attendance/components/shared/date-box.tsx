import { useId, useState } from 'react'
import { format } from 'date-fns'
import { CalendarDays } from 'lucide-react'

import { fieldControlClassName } from '@/components/form'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { parseDateValue, toDateValue } from '@/lib/date'
import { cn } from '@/lib/utils'

/**
 * "01-Aug-2024" date button with a calendar: the time sheet and logs From / To,
 * and (`variant="form"`) a date field in a dialog, labelled like the other fields.
 */
export function DateBox({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  required,
  variant = 'filter',
  tone = 'poppins',
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  minDate?: Date | undefined
  maxDate?: Date | undefined
  required?: boolean
  variant?: 'filter' | 'form'
  /** `inter`: the time sheet filters (older Inter frames), value Inter Regular 14 #475569. */
  tone?: 'poppins' | 'inter'
  className?: string
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const selected = parseDateValue(value)
  const disabled = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ]
  return (
    <div
      className={cn(
        'grid min-w-0',
        variant === 'form' ? 'gap-2' : 'gap-1.5',
        tone === 'inter' && 'font-inter',
        className,
      )}
    >
      <label
        htmlFor={id}
        className={
          variant === 'form'
            ? 'text-sm leading-none text-title'
            : 'text-sm font-medium text-heading'
        }
      >
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-destructive">
            *
          </span>
        )}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            aria-label={selected ? `${label}: ${format(selected, 'd MMMM yyyy')}` : label}
            className={cn(
              fieldControlClassName,
              'justify-start gap-2.5 bg-muted/60 text-left',
              tone === 'inter' && 'text-field-value',
            )}
          >
            <CalendarDays className="size-4 shrink-0 text-field-foreground/70" aria-hidden="true" />
            <span className={cn('truncate', !selected && 'text-label')}>
              {selected ? format(selected, 'dd-MMM-yyyy') : 'Choose a date'}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            disabled={disabled}
            autoFocus
            onSelect={(date) => {
              if (date) onChange(toDateValue(date))
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
