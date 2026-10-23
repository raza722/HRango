import type { ComponentProps } from 'react'
import { CheckIcon } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

const toneClassName = {
  /** Warning designs: the pager blue. */
  accent: 'data-[state=checked]:border-pager-active data-[state=checked]:bg-pager-active',
  /** Settings designs: navy. */
  navy: 'data-[state=checked]:border-check data-[state=checked]:bg-check dark:data-[state=checked]:text-sidebar',
  /** Payroll Leave Encashment design: violet. */
  violet:
    'data-[state=checked]:border-[#6631C7] data-[state=checked]:bg-[#6631C7] dark:data-[state=checked]:border-primary dark:data-[state=checked]:bg-primary',
} as const

interface CheckboxProps extends ComponentProps<typeof CheckboxPrimitive.Root> {
  tone?: keyof typeof toneClassName
}

/** Square checkbox; `tone` picks the checked colour used by each part of the design. */
function Checkbox({ className, tone = 'accent', ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer size-5 shrink-0 rounded-[0.25rem] border border-input bg-card shadow-xs transition-colors outline-none',
        'focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-destructive data-[state=checked]:text-white',
        toneClassName[tone],
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <CheckIcon className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox, type CheckboxProps }
