import { type ReactNode, useState } from 'react'
import {
  type Control,
  type FieldPathByValue,
  type FieldValues,
  useController,
} from 'react-hook-form'
import { Calculator } from 'lucide-react'
import { toast } from 'sonner'

import { FormField } from '@/components/form'
import { type RowAction, RowActionsMenu, rowMenuItemClass } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { FORMULA_VARIABLES } from '../../constants'
import { btn, toolbarButton } from '../../utils/styles'
import { ConfirmAction } from '../shared/confirm-action'
import { errorMessage } from './settings-helpers'

/** The navy "+ Create" of every Settings list. */
export function CreateButton({
  onClick,
  label = '+ Create',
}: {
  onClick: () => void
  label?: string
}) {
  return (
    <Button onClick={onClick} className={cn(toolbarButton, btn.navy, 'min-w-[6.625rem]')}>
      {label}
    </Button>
  )
}

/** The ⋮ menu of a Settings row: Edit, View, Delete (as drawn), or a subset. */
export function SettingsRowMenu({
  label,
  onEdit,
  onView,
  onDelete,
}: {
  label: string
  onEdit?: () => void
  onView?: () => void
  onDelete?: () => void
}) {
  const actions: RowAction[] = [
    ...(onEdit ? [{ label: 'Edit', onSelect: onEdit }] : []),
    ...(onView ? [{ label: 'View', onSelect: onView }] : []),
    ...(onDelete ? [{ label: 'Delete', onSelect: onDelete, variant: 'destructive' as const }] : []),
  ]
  return <RowActionsMenu itemClassName={rowMenuItemClass.inter} label={label} actions={actions} />
}

/** "Are you sure you want to Perform this action?" before a delete; errors become a toast. */
export function DeleteConfirm<T>({
  record,
  onClose,
  remove,
  idOf,
}: {
  record: T | null
  onClose: () => void
  remove: { mutate: (id: string, options: { onError: (error: unknown) => void }) => void }
  idOf: (record: T) => string
}) {
  return (
    <ConfirmAction
      open={record !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Delete"
      message="Are you sure you want to Perform this action?"
      onConfirm={() => {
        if (record === null) return
        remove.mutate(idOf(record), {
          onError: (error) => {
            toast.error(errorMessage(error, 'Could not delete it.'))
          },
        })
        onClose()
      }}
    />
  )
}

/** Expression box with the calculator icon; the icon lists the variables to insert. */
export function ExpressionInput({
  id,
  value,
  onChange,
  disabled,
  placeholder,
  ...aria
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean | undefined
  placeholder?: string
  'aria-describedby'?: string | undefined
  'aria-invalid'?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        className="pr-11 font-mono text-[0.8125rem]"
        {...aria}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Insert a variable"
            className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded text-[#17263A] outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-40 dark:text-heading"
          >
            <Calculator aria-hidden="true" className="size-5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-2">
          <p className="px-2 pb-1.5 text-xs text-muted-foreground">
            Use numbers, + − × ÷, brackets and these values:
          </p>
          <ul className="grid scrollbar-thin max-h-64 gap-0.5 overflow-y-auto">
            {FORMULA_VARIABLES.map(([name, hint]) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => {
                    const spacer = value && !value.endsWith(' ') ? ' ' : ''
                    onChange(`${value}${spacer}{${name}}`)
                    setOpen(false)
                  }}
                  className="grid w-full rounded-sm px-2 py-1.5 text-left outline-none hover:bg-muted focus-visible:bg-muted"
                >
                  <span className="font-mono text-xs text-heading">{`{${name}}`}</span>
                  <span className="text-xs text-muted-foreground">{hint}</span>
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  )
}

interface ExpressionFieldProps<T extends FieldValues, N extends FieldPathByValue<T, string>> {
  control: Control<T>
  name: N
  label?: ReactNode
  required?: boolean
  disabled?: boolean
  description?: ReactNode
}

/** An expression bound to a string field of a react-hook-form form. */
export function ExpressionField<T extends FieldValues, N extends FieldPathByValue<T, string>>({
  control,
  name,
  label = 'Expression',
  required,
  disabled,
  description,
}: ExpressionFieldProps<T, N>) {
  const { field, fieldState } = useController({ control, name })
  return (
    <FormField
      label={label}
      required={required}
      error={fieldState.error?.message}
      description={description}
    >
      {(a11y) => (
        <ExpressionInput
          {...a11y}
          value={field.value ?? ''}
          onChange={field.onChange}
          disabled={disabled}
          placeholder="{gross_salary} / {applicable_days}"
        />
      )}
    </FormField>
  )
}
