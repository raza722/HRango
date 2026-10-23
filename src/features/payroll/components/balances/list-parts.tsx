import { type ReactNode, useId } from 'react'
import {
  type Control,
  type FieldPathByValue,
  type FieldValues,
  useController,
} from 'react-hook-form'

import { FormField } from '@/components/form'
import { EmployeeAvatar, Pagination } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PaginationMeta } from '@/types/api'

import type { EmployeeRef } from '../../types/payroll.types'
import { btn, fieldValueText, personNameText, toolbarButton } from '../../utils/styles'

/** "Saud Ahmed" with a small round photo, as in every Payroll list. */
export function PersonCell({ person }: { person: Pick<EmployeeRef, 'name' | 'photoUrl'> }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <EmployeeAvatar name={person.name} photoUrl={person.photoUrl} className="size-6 shrink-0" />
      <span className={cn('truncate', personNameText)}>{person.name}</span>
    </span>
  )
}

/** The orange Filters button; the number of filters in use is read out. */
export function FiltersButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <Button onClick={onClick} className={cn(toolbarButton, btn.orange)}>
      Filters
      {count > 0 && (
        <span className="ml-1 rounded-full bg-white/25 px-1.5 text-[0.6875rem]">
          {count}
          <span className="sr-only"> in use</span>
        </span>
      )}
    </Button>
  )
}

/** "Showing 1 to 10 of 12 …" and the pager under a list. */
export function ListFooter({
  meta,
  noun,
  disabled,
  onPageChange,
}: {
  meta: PaginationMeta | undefined
  noun: string
  disabled?: boolean
  onPageChange: (page: number) => void
}) {
  if (!meta || meta.total === 0) return null
  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-muted-foreground">
        Showing {(meta.page - 1) * meta.pageSize + 1} to{' '}
        {Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total} {noun}
      </p>
      <Pagination
        page={meta.page}
        totalPages={meta.totalPages}
        disabled={disabled}
        onPageChange={onPageChange}
      />
    </div>
  )
}

/** An amount box with the grey "Rs" (or "RS") prefix of the designs. */
export function RsInput({
  id,
  value,
  onChange,
  prefix = 'RS',
  disabled = false,
  readOnly = false,
  placeholder,
  className,
  prefixClassName,
  inputClassName,
  ...aria
}: {
  id?: string
  value: string
  onChange?: (value: string) => void
  prefix?: string
  disabled?: boolean
  readOnly?: boolean
  placeholder?: string
  className?: string
  /** Overrides the "RS" prefix type (default Inter Regular 18 #475569). */
  prefixClassName?: string
  /** Overrides the amount type (default Inter Regular 14 #475569). */
  inputClassName?: string
  'aria-describedby'?: string | undefined
  'aria-invalid'?: boolean
  'aria-label'?: string
}) {
  return (
    <span
      className={cn(
        'flex h-10 w-full min-w-0 overflow-hidden rounded-md border border-input bg-card text-sm shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/25 has-[[aria-invalid=true]]:border-destructive',
        (disabled || readOnly) && 'bg-muted',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex items-center bg-[#D9D9D9] px-3 font-inter text-base font-normal text-field-value sm:text-lg dark:bg-muted-foreground/30',
          prefixClassName,
        )}
      >
        {prefix}
      </span>
      <input
        id={id}
        inputMode="decimal"
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
        {...aria}
        className={cn(
          'min-w-0 flex-1 bg-transparent px-3 outline-none placeholder:text-field-value disabled:cursor-not-allowed',
          fieldValueText,
          inputClassName,
        )}
      />
    </span>
  )
}

/** `RsInput` in a form row. */
export function RsField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  disabled,
  readOnly,
  prefix,
  className,
}: {
  control: Control<T>
  name: FieldPathByValue<T, string>
  label: ReactNode
  required?: boolean
  disabled?: boolean
  readOnly?: boolean
  prefix?: string
  className?: string
}) {
  const { field, fieldState } = useController({ control, name })
  return (
    <FormField
      label={label}
      required={required}
      error={fieldState.error?.message}
      className={className}
    >
      {(a11y) => (
        <RsInput
          {...a11y}
          value={field.value ?? ''}
          onChange={field.onChange}
          disabled={disabled}
          readOnly={readOnly}
          prefix={prefix}
        />
      )}
    </FormField>
  )
}

/** A read-only line in a View dialog: label on the left, the grey box on the right. */
export function ReadOnlyRow({ label, value }: { label: string; value: ReactNode }) {
  const id = useId()
  return (
    <div className="grid gap-2 @xl:grid-cols-[10rem_minmax(0,1fr)] @xl:items-center @3xl:grid-cols-[11rem_minmax(0,1fr)]">
      <span id={id} className="font-inter text-sm text-heading @xl:text-base">
        {label}
      </span>
      <span
        aria-labelledby={id}
        className="flex min-h-10 items-center rounded-md bg-[#D9D9D9]/60 px-4 py-2 font-inter text-sm text-field-value dark:bg-muted"
      >
        {value}
      </span>
    </div>
  )
}

/** "Voucher Details", "Approval Web Flow": a section heading inside a dialog. */
export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={cn('pt-2 font-inter text-xl font-medium text-heading sm:text-2xl', className)}>
      {children}
    </h3>
  )
}
