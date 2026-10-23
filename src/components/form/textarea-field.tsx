import type { ComponentProps, ReactNode } from 'react'
import {
  type Control,
  type FieldPathByValue,
  type FieldValues,
  useController,
} from 'react-hook-form'

import { Textarea } from '@/components/ui/textarea'

import { FormField } from './form-field'
import { toInputValue } from './utils'

type NativeTextareaProps = Omit<
  ComponentProps<typeof Textarea>,
  'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'id' | 'ref'
>

export interface TextareaFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, string>,
> extends NativeTextareaProps {
  control: Control<TFieldValues>
  name: TName
  label: ReactNode
  description?: ReactNode
  required?: boolean
  className?: string
  textareaClassName?: string
  /** Shows "12 / 500" under the field when `maxLength` is set. */
  showCount?: boolean
}

/** Multi-line text bound to a string field of a react-hook-form form. */
export function TextareaField<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, string>,
>({
  control,
  name,
  label,
  description,
  required,
  className,
  textareaClassName,
  showCount = false,
  disabled,
  maxLength,
  ...textareaProps
}: TextareaFieldProps<TFieldValues, TName>) {
  const { field, fieldState } = useController({ control, name })
  const value = toInputValue(field.value)
  const counter =
    showCount && maxLength !== undefined ? `${value.length} / ${maxLength}` : undefined

  return (
    <FormField
      label={label}
      description={description ?? counter}
      required={required}
      error={fieldState.error?.message}
      className={className}
    >
      {(a11y) => (
        <Textarea
          {...textareaProps}
          {...a11y}
          ref={field.ref}
          name={field.name}
          value={value}
          maxLength={maxLength}
          onChange={field.onChange}
          onBlur={field.onBlur}
          disabled={disabled ?? field.disabled}
          className={textareaClassName}
        />
      )}
    </FormField>
  )
}
