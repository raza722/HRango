import { type SyntheticEvent, useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { addDays, format, parseISO, startOfDay } from 'date-fns'
import { z } from 'zod'

import { TextareaField } from '@/components/form'
import { Skeleton } from '@/components/ui/skeleton'
import { DateField, PayrollDialog, SearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import {
  useCreateRestriction,
  useRestriction,
  useUpdateRestriction,
} from '../../hooks/use-request-settings'
import {
  type RequestRestriction,
  SETTINGS_REQUEST_TYPES,
  type SettingsRequestType,
} from '../../types/request-settings.types'
import { REQUEST_TYPE_OPTIONS, viewFieldsClass } from './settings-helpers'

/** The first day a new restriction can start: tomorrow (the API refuses today and before). */
const tomorrow = () => addDays(startOfDay(new Date()), 1)

/** A new restriction starts in the future; an existing one keeps its start (it may have begun). */
const schemaFor = (isNew: boolean) =>
  z
    .object({
      startDate: z.string().min(1, 'Choose the start date'),
      endDate: z.string().min(1, 'Choose the end date'),
      requestType: z.string().min(1, 'Choose the request type'),
      description: z.string().trim().max(500, 'Keep it under 500 characters'),
    })
    .refine(
      (values) =>
        !isNew || !values.startDate || values.startDate >= format(tomorrow(), 'yyyy-MM-dd'),
      { path: ['startDate'], message: 'Start date must be in the future' },
    )
    .refine(
      (values) => !values.startDate || !values.endDate || values.endDate >= values.startDate,
      { path: ['endDate'], message: 'End date must be on or after the start date' },
    )
type Values = z.infer<ReturnType<typeof schemaFor>>

const FIELDS = ['startDate', 'endDate', 'requestType', 'description'] as const

/**
 * "Request Restriction Create" / View / Edit: Start Date (in the future), End Date,
 * Request Types and Description. View is the same form in grey with Cancel only; Edit
 * (`PUT /requests/settings/restrictions/{id}`, `requests.settings.restrictions.edit`) saves
 * with the rowVersion just read.
 */
export function RestrictionDialog({
  id,
  edit = false,
  onClose,
}: {
  id: string | null
  /** Open the restriction `id` for editing (View otherwise). */
  edit?: boolean
  onClose: () => void
}) {
  const restriction = useRestriction(id)
  if (id && !restriction.data) {
    return (
      <PayrollDialog
        title={edit ? 'Request Restriction Edit' : 'Request Restriction View'}
        onClose={onClose}
        readOnly
      >
        <Skeleton className="h-56 w-full" />
      </PayrollDialog>
    )
  }
  return <RestrictionForm restriction={restriction.data} edit={edit} onClose={onClose} />
}

function RestrictionForm({
  restriction,
  edit,
  onClose,
}: {
  restriction: RequestRestriction | undefined
  edit: boolean
  onClose: () => void
}) {
  const formId = useId()
  const create = useCreateRestriction()
  const update = useUpdateRestriction()
  const readOnly = restriction !== undefined && !edit
  const form = useForm<Values>({
    resolver: zodResolver(schemaFor(restriction === undefined)),
    defaultValues: {
      startDate: restriction?.startDate ?? '',
      endDate: restriction?.endDate ?? '',
      requestType: restriction?.requestType ?? '',
      description: restriction?.description ?? '',
    },
  })

  // The calendars offer only days the form takes: a new start from tomorrow, an end from the start.
  const startDate = useWatch({ control: form.control, name: 'startDate' })
  const firstStart = restriction === undefined ? tomorrow() : undefined
  const firstEnd = startDate ? parseISO(startDate) : firstStart

  const submit = form.handleSubmit(async (values) => {
    if (!SETTINGS_REQUEST_TYPES.includes(values.requestType as SettingsRequestType)) return
    try {
      const input = {
        startDate: values.startDate,
        endDate: values.endDate,
        requestType: values.requestType as SettingsRequestType,
        description: values.description === '' ? null : values.description,
      }
      if (restriction) {
        await update.mutateAsync({
          id: restriction.id,
          input: { ...input, rowVersion: restriction.rowVersion },
        })
      } else {
        await create.mutateAsync(input)
      }
      onClose()
    } catch (error) {
      const field = FIELDS.find((name) => error instanceof ApiError && error.fieldErrors[name])
      if (error instanceof ApiError && field) {
        form.setError(field, { message: error.fieldErrors[field] })
      } else {
        form.setError('root', {
          message: error instanceof ApiError ? error.message : 'Could not save the restriction.',
        })
      }
    }
  })

  return (
    <PayrollDialog
      title={
        readOnly
          ? 'Request Restriction View'
          : restriction
            ? 'Request Restriction Edit'
            : 'Request Restriction Create'
      }
      onClose={onClose}
      formId={formId}
      readOnly={readOnly}
      pending={create.isPending || update.isPending}
      error={form.formState.errors.root?.message}
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event: SyntheticEvent) => void submit(event)}
        className={cn('grid gap-5', readOnly && viewFieldsClass)}
      >
        <DateField
          control={form.control}
          name="startDate"
          label="Start Date"
          required={!readOnly}
          disabled={readOnly}
          minDate={readOnly ? undefined : firstStart}
        />
        <DateField
          control={form.control}
          name="endDate"
          label="End Date"
          required={!readOnly}
          disabled={readOnly}
          minDate={readOnly ? undefined : firstEnd}
        />
        <SearchSelectField
          control={form.control}
          name="requestType"
          label="Request Types"
          options={REQUEST_TYPE_OPTIONS}
          placeholder="Select Request Types"
          required={!readOnly}
          disabled={readOnly}
        />
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          disabled={readOnly}
          maxLength={500}
          rows={5}
        />
      </form>
    </PayrollDialog>
  )
}
