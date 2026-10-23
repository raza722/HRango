import type { ReactNode } from 'react'
import {
  type Control,
  type FieldPathByValue,
  type FieldValues,
  useController,
} from 'react-hook-form'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { FormField } from './form-field'
import { toInputValue } from './utils'

/** Value of the extra "None" item of a clearable select (Radix items cannot use ''). */
const CLEAR_VALUE = '__clear__'

export interface SelectOption<TValue extends string = string> {
  value: TValue
  label: string
  disabled?: boolean
  /** CSS colour shown as a small square after the label (e.g. Badge Color). */
  swatch?: string
}

export interface SelectFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, string>,
> {
  control: Control<TFieldValues>
  name: TName
  label: ReactNode
  options: readonly SelectOption[]
  placeholder?: string
  description?: ReactNode
  required?: boolean
  disabled?: boolean
  className?: string
  /** Runs after the form value changes, e.g. to reset dependent fields. */
  onValueChange?: (value: string) => void
  /** Adds a first item that clears an optional field back to ''. Pass a string to name it. */
  clearable?: boolean | string
}

/** shadcn/Radix select bound to a string field of a react-hook-form form. */
export function SelectField<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, string>,
>({
  control,
  name,
  label,
  options,
  placeholder = 'Select…',
  description,
  required,
  disabled,
  className,
  onValueChange,
  clearable = false,
}: SelectFieldProps<TFieldValues, TName>) {
  const { field, fieldState } = useController({ control, name })

  return (
    <FormField
      label={label}
      description={description}
      required={required}
      error={fieldState.error?.message}
      className={className}
    >
      {(a11y) => (
        <Select
          name={field.name}
          value={toInputValue(field.value)}
          disabled={disabled ?? field.disabled}
          onValueChange={(picked) => {
            const value = picked === CLEAR_VALUE ? '' : picked
            field.onChange(value)
            onValueChange?.(value)
          }}
        >
          <SelectTrigger {...a11y} ref={field.ref} onBlur={field.onBlur}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {clearable !== false && (
              <SelectItem value={CLEAR_VALUE} className="text-muted-foreground">
                {typeof clearable === 'string' ? clearable : 'None'}
              </SelectItem>
            )}
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                {option.swatch ? (
                  // Inside the item text, so the trigger shows the swatch for the chosen value too.
                  <span className="flex w-full items-center justify-between gap-3">
                    {option.label}
                    <span
                      aria-hidden="true"
                      className="size-5 shrink-0 rounded-sm"
                      style={{ backgroundColor: option.swatch }}
                    />
                  </span>
                ) : (
                  option.label
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  )
}
