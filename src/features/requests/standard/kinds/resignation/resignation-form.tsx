import { useId } from 'react'
import { useController, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { differenceInCalendarDays, parse } from 'date-fns'
import { z } from 'zod'

import { FormField, TextareaField } from '@/components/form'
import { Input } from '@/components/ui/input'
import { AttachmentField, DateField, PayrollDialog, SearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import type { StandardFormProps } from '../../standard.types'
import { standardReadOnlyClass } from '../../standard-styles'
import { useCreateStandard, useStandardLookups, useUpdateStandard } from '../../use-standard'
import type { ResignationInput, ResignationLookups, ResignationPayload } from './resignation.types'

const chosen = (message: string) =>
  z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message })

const schema = z
  .object({
    employeeId: z.string().nullable(),
    type: chosen('Choose the type'),
    resignationDate: z.string().min(1, 'Choose the resignation date'),
    lastWorkingDate: z.string().min(1, 'Choose the last working date'),
    reason: z.string().trim().min(1, 'Give the reason').max(500, 'Keep it under 500 characters'),
    attachmentName: z.string().nullable(),
  })
  .refine(
    (values) =>
      !values.resignationDate ||
      !values.lastWorkingDate ||
      values.lastWorkingDate >= values.resignationDate,
    { message: 'Choose the resignation date or a later day', path: ['lastWorkingDate'] },
  )
type Values = z.infer<typeof schema>

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())

/** "30 days" between the two dates; empty until both are chosen. */
function noticeText(from: string, to: string): string {
  if (!from || !to || to < from) return ''
  const days = differenceInCalendarDays(day(to), day(from))
  return `${String(days)} ${days === 1 ? 'day' : 'days'}`
}

const TITLES = {
  create: 'Create Resignation Request',
  edit: 'Resignation Request Edit',
  view: 'Resignation Request View',
} as const

/** A value worked out from other fields: a grey box that cannot be typed in. */
function ComputedField({ label, value }: { label: string; value: string }) {
  return (
    <FormField label={label}>
      {(a11y) => (
        <Input
          {...a11y}
          readOnly
          value={value}
          placeholder="—"
          className="border-transparent bg-[#D9D9D9]/60 dark:bg-muted"
        />
      )}
    </FormField>
  )
}

/**
 * "Create Resignation Request": Employee (All only), Type, Resignation Date,
 * Last Working Date, Notice Period (the days between the two dates), Reason
 * and Attachment, as the notes list them.
 */
export function ResignationForm({
  mode,
  scope,
  request,
  onClose,
}: StandardFormProps<ResignationPayload>) {
  const formId = useId()
  const lookups = useStandardLookups<ResignationLookups>('resignation')
  const create = useCreateStandard('resignation')
  const update = useUpdateStandard('resignation')
  const readOnly = mode === 'view'
  const pickPerson = scope === 'all' && mode === 'create'
  const people = lookups.data?.employees ?? []

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: request?.employee.id ?? null,
      type: request?.payload.type ?? null,
      resignationDate: request?.payload.resignationDate ?? '',
      lastWorkingDate: request?.payload.lastWorkingDate ?? '',
      reason: request?.payload.reason ?? '',
      attachmentName: request?.payload.attachmentName ?? null,
    },
  })
  const [resignationDate, lastWorkingDate] = useWatch({
    control: form.control,
    name: ['resignationDate', 'lastWorkingDate'],
  })
  const attachment = useController({ control: form.control, name: 'attachmentName' })

  const submit = form.handleSubmit(async (values) => {
    if (pickPerson && !values.employeeId) {
      form.setError('employeeId', { message: 'Choose the employee' })
      return
    }
    const input: ResignationInput = {
      ...(pickPerson && values.employeeId ? { employeeId: values.employeeId } : {}),
      type: values.type ?? '',
      resignationDate: values.resignationDate,
      lastWorkingDate: values.lastWorkingDate,
      reason: values.reason.trim(),
      attachmentName: values.attachmentName,
    }
    try {
      if (mode === 'edit' && request) await update.mutateAsync({ id: request.id, input })
      else await create.mutateAsync(input)
    } catch (failure) {
      if (failure instanceof ApiError) {
        let placed = false
        for (const [field, message] of Object.entries(failure.fieldErrors)) {
          if (field in values) {
            form.setError(field as keyof Values, { message })
            placed = true
          }
        }
        if (!placed) form.setError('root', { message: failure.message })
      }
      return
    }
    onClose()
  })

  return (
    <PayrollDialog
      title={TITLES[mode]}
      onClose={onClose}
      formId={formId}
      readOnly={readOnly}
      pending={create.isPending || update.isPending}
      error={form.formState.errors.root?.message}
      className="max-w-3xl"
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void submit(event)}
        className={cn('grid gap-5', readOnly && standardReadOnlyClass)}
      >
        {/* All Resignations only: HR picks whose notice it is; locked once made. */}
        {scope === 'all' && (
          <SearchSelectField
            control={form.control}
            name="employeeId"
            label="Employee"
            required
            placeholder="Select"
            disabled={!pickPerson}
            options={people
              .filter((person) => person.active || person.id === request?.employee.id)
              .map((person) => ({ value: person.id, label: person.name, hint: person.code }))}
          />
        )}
        <SearchSelectField
          control={form.control}
          name="type"
          label="Type"
          required
          placeholder="Select"
          disabled={readOnly}
          options={(lookups.data?.extra.types ?? []).map((item) => ({
            value: item.value,
            label: item.label,
          }))}
        />
        <DateField
          control={form.control}
          name="resignationDate"
          label="Resignation Date"
          required
          disabled={readOnly}
        />
        <DateField
          control={form.control}
          name="lastWorkingDate"
          label="Last Working Date"
          required
          disabled={readOnly}
          minDate={resignationDate ? day(resignationDate) : undefined}
        />
        <ComputedField label="Notice Period" value={noticeText(resignationDate, lastWorkingDate)} />
        <TextareaField
          control={form.control}
          name="reason"
          label="Reason"
          required
          rows={4}
          maxLength={500}
          placeholder="Write here"
          disabled={readOnly}
        />
        <AttachmentField
          value={attachment.field.value}
          onChange={attachment.field.onChange}
          disabled={readOnly}
        />
      </form>
    </PayrollDialog>
  )
}
