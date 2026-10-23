import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/** Multi-line input styled like `<Input>`; grows with its content up to `max-h`. */
function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-28 w-full min-w-0 resize-y rounded-md border border-input bg-card px-3 py-2.5 text-base text-field-foreground shadow-xs transition-[color,box-shadow] outline-none placeholder:text-label disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-sm',
        'max-h-80 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/15',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
