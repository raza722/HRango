import { cn } from '@/lib/utils'

import { CloseIcon } from './field-icons'
import { fieldStyles } from './field-styles'

/** The red round (x) that removes a row: assignees, members, links, entries. */
export function RemoveButton({
  label,
  onClick,
  className,
}: {
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(fieldStyles.removeIcon, className)}
    >
      <CloseIcon />
    </button>
  )
}
