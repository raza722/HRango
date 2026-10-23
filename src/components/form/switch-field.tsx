import { type ReactNode, useId } from 'react'
import {
  type Control,
  type FieldPathByValue,
  type FieldValues,
  useController,
} from 'react-hook-form'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export interface SwitchFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, boolean>,
> {
  control: Control<TFieldValues>
  name: TName
  label: ReactNode
  /** Visually hide the label (keep it for screen readers), e.g. inside a table row. */
  hideLabel?: boolean
  /** Text after the switch, e.g. "Active" / "Inactive". */
  stateLabel?: (checked: boolean) => ReactNode
  disabled?: boolean
  className?: string
  onCheckedChange?: (checked: boolean) => void
}

/** On/off switch bound to a boolean form field, label above (as the Roster "Status"). */
export function SwitchField<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, boolean>,
>({
  control,
  name,
  label,
  hideLabel = false,
  stateLabel,
  disabled,
  className,
  onCheckedChange,
}: SwitchFieldProps<TFieldValues, TName>) {
  const id = useId()
  const {
    field: { ref, name: fieldName, value, onChange, onBlur, disabled: fieldDisabled },
  } = useController({ control, name })
  const checked = value === true

  return (
    <div className={cn('grid content-start gap-3', className)}>
      <Label htmlFor={id} className={cn(hideLabel && 'sr-only')}>
        {label}
      </Label>
      <div className="flex min-h-5 items-center gap-2.5">
        <Switch
          id={id}
          ref={ref}
          name={fieldName}
          checked={checked}
          onCheckedChange={(next) => {
            onChange(next)
            onCheckedChange?.(next)
          }}
          onBlur={onBlur}
          disabled={disabled ?? fieldDisabled}
        />
        {stateLabel && (
          <span aria-hidden="true" className="text-sm text-field-foreground">
            {stateLabel(checked)}
          </span>
        )}
      </div>
    </div>
  )
}
