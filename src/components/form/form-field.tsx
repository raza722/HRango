import { type ReactNode, useId } from 'react'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import {
  horizontalLabelClassName,
  horizontalRowClassName,
  useFieldOrientation,
} from './field-layout'

/** Props a control must receive so its label, hint and error are announced. */
export interface FieldA11yProps {
  id: string
  'aria-describedby': string | undefined
  'aria-invalid': boolean
}

interface FormFieldProps {
  label: ReactNode
  /** Validation message; when set the control is marked invalid. */
  error?: string | undefined
  description?: ReactNode
  required?: boolean
  /** Hide the label visually but keep it for screen readers. */
  hideLabel?: boolean
  className?: string
  children: (a11y: FieldA11yProps) => ReactNode
}

/**
 * Label + control + hint + error, wired with ids and aria attributes.
 * Used by every `*Field` wrapper; use it directly for one-off controls.
 * Inside `<FieldLayoutContext value="horizontal">` the label moves to a left column.
 */
export function FormField({
  label,
  error,
  description,
  required = false,
  hideLabel = false,
  className,
  children,
}: FormFieldProps) {
  const id = useId()
  const horizontal = useFieldOrientation() === 'horizontal'
  const descriptionId = description ? `${id}-description` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined

  const labelNode = (
    <Label
      htmlFor={id}
      className={cn(horizontal && horizontalLabelClassName, hideLabel && 'sr-only')}
    >
      {/* One inline run, so a wrapped label keeps its asterisk next to the last word. */}
      <span>
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-destructive">
            *
          </span>
        )}
      </span>
    </Label>
  )
  const control = children({ id, 'aria-describedby': describedBy, 'aria-invalid': Boolean(error) })
  const messages = (
    <>
      {description && !error && (
        <p id={descriptionId} className="-mt-1 text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className="-mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </>
  )

  if (horizontal) {
    return (
      <div className={cn(horizontalRowClassName, className)} data-invalid={Boolean(error)}>
        {labelNode}
        <div className="grid min-w-0 gap-2.5">
          {control}
          {messages}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('grid content-start gap-3', className)} data-invalid={Boolean(error)}>
      {labelNode}
      {control}
      {messages}
    </div>
  )
}
