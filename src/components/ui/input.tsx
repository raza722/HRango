import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // 16px text below `sm` stops iOS Safari from zooming into a focused field.
        'flex h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-base text-field-foreground shadow-xs transition-[color,box-shadow] outline-none placeholder:text-label disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-sm pointer-coarse:h-11',
        'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/15',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
