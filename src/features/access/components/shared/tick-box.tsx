import type { ComponentProps } from 'react'
import { CheckIcon, MinusIcon } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

/**
 * The navy tick of the Settings frames, with a dash for "some" (Select all of a screen or
 * module when only part of it is ticked). The shared `Checkbox` draws a tick for both.
 */
export function TickBox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer size-5 shrink-0 rounded-[0.25rem] border border-input bg-card shadow-xs transition-colors outline-none',
        'focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:border-check data-[state=checked]:bg-check data-[state=checked]:text-white dark:data-[state=checked]:text-sidebar',
        'data-[state=indeterminate]:border-check data-[state=indeterminate]:bg-check data-[state=indeterminate]:text-white dark:data-[state=indeterminate]:text-sidebar',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="group flex items-center justify-center text-current">
        <CheckIcon className="size-3.5 group-data-[state=indeterminate]:hidden" strokeWidth={3} />
        <MinusIcon
          className="hidden size-3.5 group-data-[state=indeterminate]:block"
          strokeWidth={3}
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}
