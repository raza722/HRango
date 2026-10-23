import { type ReactNode, useId, useState } from 'react'
import { format } from 'date-fns'
import { Select as SelectPrimitive } from 'radix-ui'

import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { parseDateValue, toDateValue } from '@/lib/date'
import { cn } from '@/lib/utils'

import {
  CalendarIcon,
  CheckBoxBlankIcon,
  CheckBoxIcon,
  ChevronDownIcon,
  OptionCheckIcon,
} from './benefit-icons'
import { boxClass, labelText, placeholderColor, requiredMark, smallText } from './benefit-styles'

interface A11y {
  id?: string
  'aria-describedby'?: string | undefined
  'aria-invalid'?: boolean
  'aria-label'?: string
  'aria-labelledby'?: string
}

/** Value of a select's "none" item (Radix items cannot be ''). */
const NONE = '__none__'

/**
 * The frames' select: a box with the chevron, and a list (5px corners, soft shadow) whose
 * chosen option is tinted #7469E8 at 20% with the purple tick, as the New Hires frame draws it.
 */
export function BxSelect({
  value,
  onChange,
  options,
  placeholder = 'Select',
  noneLabel,
  disabled,
  open,
  onOpenChange,
  icon,
  className,
  contentClassName,
  ...a11y
}: A11y & {
  value: string
  onChange: (value: string) => void
  options: readonly { value: string; label: string }[]
  placeholder?: string
  /** A first option that clears the value ("All Plan Years"). */
  noneLabel?: string
  disabled?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Replaces the chevron. */
  icon?: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <SelectPrimitive.Root
      value={value === '' ? (noneLabel ? NONE : '') : value}
      disabled={disabled}
      {...(open === undefined ? {} : { open })}
      {...(onOpenChange ? { onOpenChange } : {})}
      onValueChange={(picked) => {
        onChange(picked === NONE ? '' : picked)
      }}
    >
      <SelectPrimitive.Trigger
        {...a11y}
        className={cn(
          boxClass,
          'flex items-center justify-between gap-2 text-left data-[placeholder]:text-[#818CA3] dark:data-[placeholder]:text-muted-foreground',
          className,
        )}
      >
        <span className="min-w-0 truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon asChild>
          {icon ?? (
            <ChevronDownIcon className="h-[0.38rem] w-[0.67rem] shrink-0 text-[#1C1B1F] dark:text-heading" />
          )}
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          collisionPadding={8}
          className={cn(
            'relative z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-x-hidden overflow-y-auto rounded-[5px] bg-popover py-0 text-popover-foreground shadow-[0_2px_10px_rgba(0,0,0,0.15)]',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
            contentClassName,
          )}
        >
          <SelectPrimitive.Viewport className="py-0">
            {noneLabel && <BxOption value={NONE}>{noneLabel}</BxOption>}
            {options.map((option) => (
              <BxOption key={option.value} value={option.value}>
                {option.label}
              </BxOption>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

function BxOption({ value, children }: { value: string; children: ReactNode }) {
  return (
    <SelectPrimitive.Item
      value={value}
      className={cn(
        smallText,
        'relative flex min-h-10 cursor-default items-center justify-between gap-3 px-4 py-2 outline-none select-none',
        'first:rounded-t-[5px] last:rounded-b-[5px] focus:bg-[#7469E8]/10 data-[state=checked]:bg-[#7469E8]/20 pointer-coarse:min-h-11',
      )}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator>
        <OptionCheckIcon className="h-[0.7rem] w-[0.97rem] text-[#7469E8]" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

/** A date box with the calendar_month icon ("1 Jan 2024"). */
export function DateBox({
  value,
  onChange,
  placeholder = 'Select date',
  disabled,
  minDate,
  maxDate,
  yearPicker = false,
  className,
  ...a11y
}: A11y & {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  minDate?: string | undefined
  maxDate?: string | undefined
  /** Month and year lists in the caption (dates of birth). */
  yearPicker?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = parseDateValue(value)
  const min = minDate ? parseDateValue(minDate) : undefined
  const max = maxDate ? parseDateValue(maxDate) : undefined
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        {...a11y}
        className={cn(
          boxClass,
          'flex items-center justify-between gap-2 text-left',
          !selected && placeholderColor,
          className,
        )}
      >
        <span className="truncate">{selected ? format(selected, 'd MMM yyyy') : placeholder}</span>
        <CalendarIcon className="h-[1.19rem] w-[1.06rem] shrink-0 text-[#1C1B1F] dark:text-heading" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? min ?? max}
          disabled={[...(min ? [{ before: min }] : []), ...(max ? [{ after: max }] : [])]}
          {...(yearPicker
            ? {
                captionLayout: 'dropdown' as const,
                startMonth: new Date(1940, 0),
                endMonth: new Date(),
              }
            : {})}
          autoFocus
          onSelect={(date) => {
            onChange(date ? toDateValue(date) : '')
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

/**
 * A label beside its control, as the forms draw it (label column, then the 227px box); the
 * label goes above the box when the card is narrow. `columns` sets the label column.
 */
export function FieldRow({
  label,
  required,
  error,
  columns = '@lg:grid-cols-[7.9375rem_minmax(0,14.1875rem)]',
  labelClassName,
  className,
  children,
}: {
  label: ReactNode
  required?: boolean
  error?: string | undefined
  columns?: string
  labelClassName?: string
  className?: string
  children: (a11y: {
    id: string
    'aria-describedby': string | undefined
    'aria-invalid': boolean
  }) => ReactNode
}) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className={cn('grid content-start items-center gap-x-4 gap-y-1.5', columns, className)}>
      <label htmlFor={id} className={cn(labelText, labelClassName)}>
        {label}
        {required && (
          <span aria-hidden="true" className={requiredMark}>
            *
          </span>
        )}
      </label>
      {children({
        id,
        'aria-describedby': error ? errorId : undefined,
        'aria-invalid': Boolean(error),
      })}
      {error && (
        <p id={errorId} className="text-xs text-destructive @lg:col-start-2">
          {error}
        </p>
      )}
    </div>
  )
}

/** A message under a group of controls (the plan pickers, the people lists). */
export function FieldError({ id, message }: { id?: string; message: string | undefined }) {
  if (!message) return null
  return (
    <p id={id} className="text-xs text-destructive">
      {message}
    </p>
  )
}

/**
 * The check_box / check_box_outline_blank pair (24px, #7469E8). `mixed` keeps the tick drawn,
 * as the frames tick a coverage group with only some of its plans chosen.
 */
export function TickBox({
  checked,
  onChange,
  label,
  labelledBy,
  className,
}: {
  checked: boolean | 'mixed'
  onChange: (checked: boolean) => void
  /** Accessible name when no visible label is linked. */
  label?: string
  labelledBy?: string
  className?: string
}) {
  const Icon = checked === false ? CheckBoxBlankIcon : CheckBoxIcon
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      {...(label ? { 'aria-label': label } : {})}
      {...(labelledBy ? { 'aria-labelledby': labelledBy } : {})}
      onClick={() => {
        onChange(checked !== true)
      }}
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-[3px] text-[#7469E8] outline-none focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35 dark:text-[#A39BFF]',
        className,
      )}
    >
      <Icon className="size-[1.0625rem]" />
    </button>
  )
}
