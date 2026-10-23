import { type ReactNode, useId } from 'react'
import {
  type Control,
  type FieldPathByValue,
  type FieldValues,
  useController,
} from 'react-hook-form'

import { Checkbox, type CheckboxProps } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import { useFieldOrientation } from './field-layout'

export interface CheckboxFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, boolean>,
> {
  control: Control<TFieldValues>
  name: TName
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
  tone?: CheckboxProps['tone']
  className?: string
  /** Runs after the value changes, e.g. to clear a field the box reveals. */
  onCheckedChange?: (checked: boolean) => void
}

/**
 * Checkbox bound to a boolean form field. In a wide horizontal form the label
 * sits in the label column like every other field (as in the Settings
 * designs); otherwise the box comes first with its label beside it.
 */
export function CheckboxField<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, boolean>,
>({
  control,
  name,
  label,
  description,
  disabled,
  tone,
  className,
  onCheckedChange,
}: CheckboxFieldProps<TFieldValues, TName>) {
  const id = useId()
  const descriptionId = description ? `${id}-description` : undefined
  const horizontal = useFieldOrientation() === 'horizontal'
  const {
    field: { ref, name: fieldName, value, onChange, onBlur, disabled: fieldDisabled },
  } = useController({ control, name })

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1.5',
        horizontal &&
          '@xl:grid @xl:grid-cols-[10rem_minmax(0,1fr)] @xl:gap-x-6 @3xl:grid-cols-[11rem_minmax(0,1fr)]',
        className,
      )}
    >
      <Label
        htmlFor={id}
        className={cn(
          'order-2 cursor-pointer text-field-foreground',
          horizontal &&
            '@xl:order-none @xl:min-h-10 @xl:text-[0.9375rem] @xl:text-heading/80 pointer-coarse:@xl:min-h-11',
        )}
      >
        {label}
      </Label>
      <div className={cn('order-1 flex items-center', horizontal && '@xl:order-none')}>
        <Checkbox
          id={id}
          ref={ref}
          name={fieldName}
          tone={tone}
          checked={value === true}
          onCheckedChange={(checked) => {
            const next = checked === true
            onChange(next)
            onCheckedChange?.(next)
          }}
          onBlur={onBlur}
          disabled={disabled ?? fieldDisabled}
          aria-describedby={descriptionId}
          className="size-5.5 rounded-[0.125rem]"
        />
      </div>
      {description && (
        <p
          id={descriptionId}
          className={cn(
            'order-3 basis-full text-xs text-muted-foreground',
            horizontal && '@xl:col-start-2',
          )}
        >
          {description}
        </p>
      )}
    </div>
  )
}
