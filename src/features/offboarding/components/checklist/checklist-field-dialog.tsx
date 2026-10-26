import { type SyntheticEvent, useId } from 'react'
import { type Control, useController, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { CheckboxField, SelectField, TextField } from '@/components/form'
import { Input } from '@/components/ui/input'
import { PayrollDialog } from '@/features/payroll'
import { cn } from '@/lib/utils'

import { CHECKLIST_FIELD_TYPE_LABELS } from '../../constants'
import { CHECKLIST_FIELD_TYPES, type ChecklistFieldInput } from '../../types/offboarding.types'

/** A field of the checklist being edited; `key` tells rows apart before they have an id. */
export interface DraftField extends ChecklistFieldInput {
  key: string
}

/** The Min / Max boxes: a value range for a Number, a length range for a String. */
const boundsOf = (field: DraftField | null) =>
  field?.fieldType === 'string'
    ? { min: field.minLength, max: field.maxLength }
    : { min: field?.minValue ?? null, max: field?.maxValue ?? null }

const hasConditions = (type: string) => type === 'number' || type === 'string'

const bound = z.string().trim()

const schema = z
  .object({
    name: z.string().trim().min(1, 'Enter the name').max(200, 'Keep it under 200 characters'),
    type: z.string().min(1, 'Choose the type'),
    required: z.boolean(),
    min: bound,
    max: bound,
  })
  .superRefine((value, context) => {
    if (!hasConditions(value.type)) return
    const lengths = value.type === 'string'
    for (const key of ['min', 'max'] as const) {
      const text = value[key]
      if (text === '') continue
      const number = Number(text)
      if (!Number.isFinite(number)) {
        context.addIssue({ code: 'custom', message: 'Enter a number', path: [key] })
      } else if (lengths && (!Number.isInteger(number) || number < 0)) {
        context.addIssue({ code: 'custom', message: 'Enter a whole number', path: [key] })
      }
    }
    if (value.min !== '' && value.max !== '' && Number(value.min) > Number(value.max)) {
      context.addIssue({ code: 'custom', message: 'Min cannot be more than Max', path: ['max'] })
    }
  })
type Values = z.infer<typeof schema>

const typeOptions = CHECKLIST_FIELD_TYPES.map((value) => ({
  value,
  label: CHECKLIST_FIELD_TYPE_LABELS[value],
}))

const TITLES = {
  create: 'Additional Information Create',
  edit: 'Additional Information Edit',
  view: 'Additional Information View',
} as const

function BoundInput({
  control,
  name,
  label,
  placeholder,
  disabled,
}: {
  control: Control<Values>
  name: 'min' | 'max'
  label: string
  placeholder: string
  disabled: boolean
}) {
  const id = useId()
  const errorId = `${id}-error`
  const { field, fieldState } = useController({ control, name })
  return (
    <div className="grid gap-1.5 @xl:grid-cols-[7rem_minmax(0,1fr)] @xl:items-center @xl:gap-x-4">
      <label htmlFor={id} className="font-inter text-sm text-heading @xl:text-base">
        {label}
      </label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={fieldState.error ? true : undefined}
        aria-describedby={fieldState.error ? errorId : undefined}
        value={field.value}
        onChange={(event) => {
          field.onChange(event.target.value)
        }}
        onBlur={field.onBlur}
      />
      {fieldState.error && (
        <p id={errorId} className="text-xs text-destructive @xl:col-start-2">
          {fieldState.error.message}
        </p>
      )}
    </div>
  )
}

/**
 * "Additional Information Create" / Edit / View: one field of the checklist,
 * with Min / Max for a Number and Min Length / Max Length for a String.
 */
export function ChecklistFieldDialog({
  mode,
  field,
  takenNames,
  onSave,
  onClose,
}: {
  mode: 'create' | 'edit' | 'view'
  field: DraftField | null
  /** Other fields' names, so a name is used once. */
  takenNames: readonly string[]
  onSave: (field: Omit<DraftField, 'key'>) => void
  onClose: () => void
}) {
  const formId = useId()
  const readOnly = mode === 'view'
  const bounds = boundsOf(field)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: field?.name ?? '',
      type: field?.fieldType ?? '',
      required: field?.isRequired ?? false,
      min: bounds.min === null ? '' : String(bounds.min),
      max: bounds.max === null ? '' : String(bounds.max),
    },
  })
  const type = useWatch({ control: form.control, name: 'type' })

  const submit = form.handleSubmit((values) => {
    const picked = CHECKLIST_FIELD_TYPES.find((item) => item === values.type)
    if (!picked) return
    if (takenNames.some((name) => name.toLowerCase() === values.name.trim().toLowerCase())) {
      form.setError('name', { message: 'Another field has this name' })
      return
    }
    onSave({
      id: field?.id,
      name: values.name.trim(),
      fieldType: picked,
      isRequired: values.required,
      minValue: picked === 'number' && values.min !== '' ? Number(values.min) : null,
      maxValue: picked === 'number' && values.max !== '' ? Number(values.max) : null,
      minLength: picked === 'string' && values.min !== '' ? Number(values.min) : null,
      maxLength: picked === 'string' && values.max !== '' ? Number(values.max) : null,
    })
  })

  return (
    <PayrollDialog
      title={TITLES[mode]}
      onClose={onClose}
      formId={formId}
      readOnly={readOnly}
      className="max-w-3xl"
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event: SyntheticEvent) => void submit(event)}
        className={cn(
          'grid gap-5',
          readOnly &&
            '[&_[role=combobox]:disabled]:border-transparent [&_[role=combobox]:disabled]:bg-[#D9D9D9]/60 [&_[role=combobox]:disabled]:opacity-100 dark:[&_[role=combobox]:disabled]:bg-muted [&_input:disabled]:border-transparent [&_input:disabled]:bg-[#D9D9D9]/60 [&_input:disabled]:opacity-100 dark:[&_input:disabled]:bg-muted',
        )}
      >
        <TextField
          control={form.control}
          name="name"
          label="Name"
          placeholder="Name"
          required={!readOnly}
          disabled={readOnly}
        />
        <SelectField
          control={form.control}
          name="type"
          label="Type"
          placeholder="Select Type"
          options={typeOptions}
          required={!readOnly}
          disabled={readOnly}
          onValueChange={() => {
            form.setValue('min', '')
            form.setValue('max', '')
            form.clearErrors(['min', 'max'])
          }}
        />
        <CheckboxField
          control={form.control}
          name="required"
          label="Required"
          disabled={readOnly}
        />
        {hasConditions(type) && (
          <div
            role="group"
            aria-label="Conditions"
            className="grid gap-3 @xl:grid-cols-[10rem_minmax(0,1fr)] @xl:items-center @xl:gap-x-6 @3xl:grid-cols-[11rem_minmax(0,1fr)]"
          >
            <span className="font-inter text-sm text-heading @xl:text-base">Conditions</span>
            <div className="grid gap-4 @xl:pl-[28%]">
              <BoundInput
                control={form.control}
                name="min"
                label={type === 'string' ? 'Min Length' : 'Min'}
                placeholder="Min"
                disabled={readOnly}
              />
              <BoundInput
                control={form.control}
                name="max"
                label={type === 'string' ? 'Max Length' : 'Max'}
                placeholder="Max"
                disabled={readOnly}
              />
            </div>
          </div>
        )}
      </form>
    </PayrollDialog>
  )
}
