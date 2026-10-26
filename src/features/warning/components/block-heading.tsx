import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface BlockHeadingProps {
  /** "Rule 2", "Penalty 3" … */
  heading?: string | undefined
  onRemove?: (() => void) | undefined
  /** Accessible name of the remove button. */
  removeLabel?: string
}

/** Heading and Remove button above one repeated block of a form. */
export function BlockHeading({ heading, onRemove, removeLabel }: BlockHeadingProps) {
  if (!heading && !onRemove) return null
  return (
    <div className="flex items-center justify-between gap-3">
      {heading && <h3 className="text-base font-medium text-heading">{heading}</h3>}
      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-destructive"
          onClick={onRemove}
          aria-label={removeLabel}
        >
          <Trash2 /> Remove
        </Button>
      )}
    </div>
  )
}
