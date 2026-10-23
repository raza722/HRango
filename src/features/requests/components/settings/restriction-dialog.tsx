import { type SyntheticEvent, useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { TextareaField } from '@/components/form'
import { Skeleton } from '@/components/ui/skeleton'
import { DateField, PayrollDialog, SearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { useCreateRestriction, useRestriction } from '../../hooks/use-request-settings'
import {
  type RequestRestrictionRow,
  SETTINGS_REQUEST_TYPES,
  type SettingsRequestType,
} from '../../types/request-settings.types'
import { REQUEST_TYPE_OPTIONS, viewFieldsClass } from './settings-helpers'

const schema = z
  .object({
    startDate: z.string().min(1, 'Choose the start date'),
    endDate: z.string().min(1, 'Choose the end date'),
    requestType: z.string().min(1, 'Choose the request type'),
    description: z.string().trim().max(500, 'Keep it under 500 characters'),
  })
  .refine((values) => !values.startDate || !values.endDate || values.endDate >= values.startDate, {
    path: ['endDate'],
    message: 'End date must be on or after the start date',
  })
type Values = z.infer<typeof schema>

const FIELDS = ['startDate', 'endDate', 'requestType', 'description'] as const

/**
 * "Request Restriction Create" / View: Start Date, End Date, Request Types
 * and Description. View is the same form in grey with Cancel only.
 */
export function RestrictionDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const restriction = useRestriction(id)
  if (id && !restriction.data) {
    return (
      <PayrollDialog title="Request Restriction View" onClose={onClose} readOnly>
        <Skeleton className="h-56 w-full" />
      </PayrollDialog>
    )
  }
  return <RestrictionForm restriction={restriction.data} onClose={onClose} />
}

function RestrictionForm({
  restriction,
  onClose,
}: {
  restriction: RequestRestrictionRow | undefined
  onClose: () => void
}) {
  const formId = useId()
  const create = useCreateRestriction()
  const readOnly = restriction !== undefined
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      startDate: restriction?.startDate ?? '',
      endDate: restriction?.endDate ?? '',
      requestType: restriction?.requestType ?? '',
      description: restriction?.description ?? '',
    },
  })

  const submit = form.handleSubmit(async (values) => {
    if (!SETTINGS_REQUEST_TYPES.includes(values.requestType as SettingsRequestType)) return
    try {
      await create.mutateAsync({
        ...values,
        requestType: values.requestType as SettingsRequestType,
      })
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
      title={readOnly ? 'Request Restriction View' : 'Request Restriction Create'}
      onClose={onClose}
      formId={formId}
      readOnly={readOnly}
      pending={create.isPending}
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
        />
        <DateField
          control={form.control}
          name="endDate"
          label="End Date"
          required={!readOnly}
          disabled={readOnly}
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
