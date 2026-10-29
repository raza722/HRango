import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Two or three named choices side by side (Existing / New candidate, Board / List), the chosen
 * one filled navy. Each is a toggle button named by its label, so the choice is never colour only.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: T
  options: readonly { value: T; label: string; icon?: ReactNode }[]
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex w-fit max-w-full rounded-md border bg-card p-0.5', className)}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              onChange(option.value)
            }}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-[5px] px-3 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 pointer-coarse:h-10',
              selected
                ? 'bg-sidebar text-white dark:bg-primary'
                : 'text-field-foreground hover:bg-muted',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
