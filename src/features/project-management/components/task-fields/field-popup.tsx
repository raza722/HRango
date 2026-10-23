import type { ReactNode } from 'react'
import { Popover as PopoverPrimitive } from 'radix-ui'

import { EmployeeAvatar } from '@/components/layout'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import type { PmPerson } from '../../types/pm.types'
import { CloseIcon, SearchIcon } from './field-icons'
import { fieldStyles } from './field-styles'

interface FieldPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The cell button that opens the popup. */
  trigger?: ReactNode
  /** Or an element the popup is placed against, when the cell holds several buttons. */
  anchor?: ReactNode
  /** The popup's accessible name (its title). */
  label: string
  className?: string
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  children: ReactNode
}

/** A column popup opened from its cell; it scrolls when the window is shorter than it. */
export function FieldPopover({
  open,
  onOpenChange,
  trigger,
  anchor,
  label,
  className,
  align = 'start',
  side = 'bottom',
  children,
}: FieldPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {trigger && <PopoverTrigger asChild>{trigger}</PopoverTrigger>}
      {anchor && <PopoverPrimitive.Anchor asChild>{anchor}</PopoverPrimitive.Anchor>}
      <PopoverContent
        aria-label={label}
        align={align}
        side={side}
        className={cn(
          fieldStyles.popup,
          fieldStyles.scroll,
          'max-h-(--radix-popover-content-available-height) w-80 overflow-y-auto',
          className,
        )}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}

/** A popup's title (SemiBold 22 #393636) with the red close button. */
export function PopupHeader({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  /** Extra controls between the title and the close button. */
  children?: ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <h3 className={fieldStyles.popupTitle}>{title}</h3>
      <div className="ml-auto flex items-center gap-3">
        {children}
        <button type="button" onClick={onClose} aria-label="Close" className={fieldStyles.close}>
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
  onEnter?: () => void
  className?: string
}

/** The round search field with the purple search icon. */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  onEnter,
  className,
}: SearchFieldProps) {
  return (
    <label className={cn(fieldStyles.search, className)}>
      <SearchIcon className="size-3.5 shrink-0 text-[#A181FF]" />
      <span className="sr-only">{label}</span>
      <input
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && onEnter) {
            event.preventDefault()
            onEnter()
          }
        }}
        placeholder={placeholder}
        className={fieldStyles.searchInput}
      />
    </label>
  )
}

/** A person's photo or initials in a lavender ring (#DBD2FF); unknown ids draw a neutral circle. */
export function PersonAvatar({
  person,
  className,
}: {
  person: PmPerson | undefined
  className?: string
}) {
  return (
    <EmployeeAvatar
      name={person?.name ?? '?'}
      photoUrl={person?.photoUrl ?? null}
      className={cn('size-[1.8rem] ring-[1.6px] ring-[#DBD2FF]', className)}
      fallbackClassName="text-[0.625rem]"
    />
  )
}
