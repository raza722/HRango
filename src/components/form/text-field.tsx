import type { ComponentProps, ReactNode } from 'react'
import {
  type Control,
  type FieldPathByValue,
  type FieldValues,
  useController,
} from 'react-hook-form'

import { Input } from '@/components/ui/input'

import { FormField } from './form-field'
import { toInputValue } from './utils'

type NativeInputProps = Omit<
  ComponentProps<typeof Input>,
  'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'id' | 'ref'
>

export interface TextFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, string>,
> extends NativeInputProps {
  control: Control<TFieldValues>
  name: TName
  label: ReactNode
  description?: ReactNode
  required?: boolean
  /** Classes for the field wrapper (label + input + error). */
  className?: string
  inputClassName?: string
}

/** Text input bound to a string field of a react-hook-form form. */
export function TextField<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, string>,
>({
  control,
  name,
  label,
  description,
  required,
  className,
  inputClassName,
  disabled,
  ...inputProps
}: TextFieldProps<TFieldValues, TName>) {
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
        <Input
          {...inputProps}
          {...a11y}
          ref={field.ref}
          name={field.name}
          value={toInputValue(field.value)}
          onChange={field.onChange}
          onBlur={field.onBlur}
          disabled={disabled ?? field.disabled}
          className={inputClassName}
        />
      )}
    </FormField>
  )
}
