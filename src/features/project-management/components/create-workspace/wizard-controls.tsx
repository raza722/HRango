import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Switch as SwitchPrimitive } from 'radix-ui'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import {
  BackArrowIcon,
  CloseIcon,
  ContinueChevronIcon,
  InfoIcon,
  PlusIcon,
  QuestionMarkIcon,
} from './wizard-icons'
import { wz } from './wizard-styles'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

/** The red square close (x) of the modal and its popups. */
export function CloseButton({
  label = 'Close',
  small = false,
  className,
  ...props
}: ButtonProps & { label?: string; small?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(small ? wz.closeSmall : wz.close, className)}
      {...props}
    >
      <CloseIcon className={small ? 'size-[0.55rem]' : 'size-[0.96rem]'} />
    </button>
  )
}

export function CancelButton({ children = 'Cancel', className, ...props }: ButtonProps) {
  return (
    <button type="button" className={cn(wz.cancel, className)} {...props}>
      {children}
    </button>
  )
}

/** Continue (chevron badge) or Create Workspace (plus badge). */
export function ContinueButton({
  children = 'Continue',
  badge = 'chevron',
  className,
  ...props
}: ButtonProps & { badge?: 'chevron' | 'plus' }) {
  return (
    <button type="button" className={cn(wz.continue, 'group', className)} {...props}>
      <span>{children}</span>
      <span aria-hidden="true" className={wz.continueBadge}>
        {badge === 'chevron' ? (
          <ContinueChevronIcon className="h-[0.9875rem] w-[0.58rem] text-white group-disabled:text-[#A181FF]" />
        ) : (
          <PlusIcon className="size-[0.9rem] text-white" />
        )}
      </span>
    </button>
  )
}

/** Back on steps 2 and 3: purple outline with the double chevron. */
export function BackButton({ className, ...props }: ButtonProps) {
  return (
    <button type="button" className={cn(wz.back, className)} {...props}>
      <BackArrowIcon className="h-[1.13rem] w-[0.875rem]" />
      Back
    </button>
  )
}

/** Back at the top left of the detail pages. */
export function BackLink({ className, ...props }: ButtonProps) {
  return (
    <button type="button" className={cn(wz.backLink, className)} {...props}>
      <BackArrowIcon className="h-[1.13rem] w-[0.875rem]" />
      Back
    </button>
  )
}

export function DoneButton({ children = 'Done', className, ...props }: ButtonProps) {
  return (
    <button type="button" className={cn(wz.done, className)} {...props}>
      {children}
    </button>
  )
}

/** The grey square that holds a field's or card's icon. */
export function IconTile({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span aria-hidden="true" className={cn(wz.iconTile, className)}>
      {children}
    </span>
  )
}

/**
 * "Radios / False / Light": a 24px ring with a dot, grey when off and purple when on (a Purple
 * 400 ring round a Purple 700 dot).
 */
export function RadioMark({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex size-6 shrink-0 items-center justify-center rounded-full border',
        checked ? 'border-[#A181FF]' : 'border-[#979797]',
        className,
      )}
    >
      <span className={cn('size-4 rounded-full', checked ? 'bg-[#7127EA]' : 'bg-[#979797]')} />
    </span>
  )
}

/** A status's coloured ring: a 23.68px ring round a 12px dot. */
export function StatusRing({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-full border',
        className,
      )}
      style={{ borderColor: color }}
    >
      <span className="size-3 rounded-full" style={{ backgroundColor: color }} />
    </span>
  )
}

/**
 * Toggle Button (610:201097): a Purple 200 track with the Purple 700 knob at the right when on.
 * The off look is not drawn: a grey track with the knob at the left.
 */
export function Toggle({
  checked,
  onCheckedChange,
  label,
  disabled = false,
  className,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  disabled?: boolean
  className?: string
}) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'group relative inline-flex h-[1.6075rem] w-[3.375rem] shrink-0 cursor-pointer items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:ring-offset-2 disabled:cursor-not-allowed',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute top-[14%] bottom-[9.5%] left-0 w-[84%] rounded-full bg-[#E4E4E4] transition-colors group-data-[state=checked]:bg-[#DBD2FF]"
      />
      <SwitchPrimitive.Thumb className="relative block size-[1.6075rem] rounded-full bg-[#B4BBC1] shadow-sm transition-transform data-[state=checked]:translate-x-[1.7675rem] data-[state=checked]:bg-[#7127EA]" />
    </SwitchPrimitive.Root>
  )
}

/** The "?" button of a Customize Template row, with its tooltip. */
export function HelpTip({ label, text }: { label: string; text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`About ${label}`}
          className="inline-flex size-[1.8125rem] shrink-0 items-center justify-center rounded-full bg-[#EDEDED]/80 text-[#454545] transition-colors hover:bg-[#E2E2E2] focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:outline-none"
        >
          <QuestionMarkIcon className="h-[0.92rem] w-[0.5675rem]" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 text-sm leading-5">{text}</TooltipContent>
    </Tooltip>
  )
}

/** The grey "i" next to a status group or organizer feature, with its tooltip. */
export function InfoTip({ label, text }: { label: string; text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`About ${label}`}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:outline-none"
        >
          <InfoIcon className="size-5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 text-sm leading-5">{text}</TooltipContent>
    </Tooltip>
  )
}

/** "Add Status Color +": the lavender chip of a status group header. */
export function AddStatusColorChip({ className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-[1.875rem] shrink-0 items-center gap-2.5 rounded-lg bg-[#844EFF]/10 px-2.5 text-[0.875rem] leading-[1.3125rem] font-medium tracking-[0.0168rem] text-[#666666] transition-colors hover:bg-[#844EFF]/15 focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    >
      Add Status Color
      <PlusIcon className="size-[0.9rem] text-[#7127EA]" />
    </button>
  )
}

/** A step or page's error line (server messages that belong to no field). */
export function FormError({ message, id }: { message: string | undefined; id?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className={wz.error}>
      {message}
    </p>
  )
}
