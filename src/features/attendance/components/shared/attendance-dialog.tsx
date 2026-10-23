import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Type of the read-only boxes, as the frames draw them:
 * - `view` (Time Sheet View): label and value Inter Regular 16 #000.
 * - `edit` (Time Sheet Edit): label Inter Regular 16 #000, value Inter Regular 14 #475569.
 * - `poppins` (Logs and Settings views): label Poppins Regular 14 #303030, value Poppins Regular 14 #707070.
 */
const TONES = {
  view: { label: 'font-inter text-base text-heading', value: 'font-inter text-base text-heading' },
  edit: {
    label: 'font-inter text-base text-heading',
    value: 'font-inter text-sm text-field-value',
  },
  poppins: { label: 'text-sm text-title', value: 'text-sm text-grey' },
} as const

/** Grey read-only box of the Edit / View dialogs (Day, Expected Check In…). */
export function ReadOnlyField({
  label,
  value,
  icon,
  tone = 'poppins',
  className,
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  tone?: keyof typeof TONES
  className?: string
}) {
  return (
    <div className={cn('grid min-w-0 gap-2.5', className)}>
      <span className={cn('leading-none', TONES[tone].label)}>{label}</span>
      <span
        role="textbox"
        aria-readonly="true"
        aria-label={label}
        className={cn(
          'flex h-9 min-w-0 items-center justify-between gap-2 rounded-md bg-chip px-3 dark:bg-input',
          TONES[tone].value,
        )}
      >
        <span className="truncate">{value}</span>
        {icon}
      </span>
    </div>
  )
}

/** "Manually Updated" chip (Inter Medium 16 #17263A): filled when HR changed the day, outlined otherwise. */
export function ManualBadge({ updated }: { updated: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-md px-4 font-inter text-base whitespace-nowrap',
        updated
          ? 'bg-chip font-medium text-sidebar dark:bg-input dark:text-heading'
          : 'border border-dashed text-muted-foreground',
      )}
    >
      {updated ? 'Manually Updated' : 'Not Manually Updated'}
    </span>
  )
}
