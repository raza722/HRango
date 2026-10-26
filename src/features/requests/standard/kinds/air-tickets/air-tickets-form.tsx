import { useId } from 'react'
import { useController, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { FormField, TextareaField, TextField } from '@/components/form'
import { DateField, PayrollDialog, RsInput } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import type { FileRef } from '@/lib/files'
import { cn } from '@/lib/utils'

import { type RequestBody, typePermission } from '../../../api/backend'
import { RequestEmployeeField } from '../../../components/shared/request-employee-field'
import { RequestFileField } from '../../../components/shared/request-files'
import { detailFileRef } from '../../../utils/request-files'
import type { StandardFormProps } from '../../standard.types'
import { standardReadOnlyClass } from '../../standard-styles'
import { useCreateStandard, useUpdateStandard } from '../../use-standard'
import { parseAmount, requestBody, toAmount, todayIso } from '../expense/claims.utils'
import type { AirTicketDetailsInput, AirTicketPayload } from './air-tickets.types'

const schema = z.object({
  employeeId: z.string().nullable(),
  title: z.string().trim().min(1, 'Enter the title').max(200, 'Keep it under 200 characters'),
  claimDate: z.string().refine((value) => !value || value <= todayIso(), {
    message: 'Choose today or an earlier day',
  }),
  travelDate: z.string().min(1, 'Choose the travel date'),
  fromPlace: z.string().trim().max(200),
  toPlace: z.string().trim().max(200),
  amount: z
    .string()
    .refine((value) => (parseAmount(value) ?? 0) > 0, { message: 'Enter an amount above 0' }),
  description: z.string().trim().max(4000),
  ticket: z.custom<FileRef | null>(),
})
type Values = z.infer<typeof schema>

const TITLES = {
  create: 'Air Ticket Claim',
  edit: 'Air Ticket Claim Edit',
  view: 'Air Ticket Claim View',
} as const

const FIELDS = new Set([
  'title',
  'claimDate',
  'travelDate',
  'fromPlace',
  'toPlace',
  'amount',
  'description',
])

/**
 * "Air Tickets" (Figma App Version): Title*, Claim Date, Travel Date*, From,
 * To, Amount* (not drawn; a claim needs one), Description and the ticket file.
 */
export function AirTicketsForm({
  mode,
  scope,
  request,
  onClose,
}: StandardFormProps<AirTicketPayload>) {
  const formId = useId()
  const create = useCreateStandard('air-tickets')
  const update = useUpdateStandard('air-tickets')
  const readOnly = mode === 'view'
  const pickPerson = scope === 'all' && mode === 'create'
  const payload = request?.payload

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: request?.employee.id ?? null,
      title: payload?.title ?? '',
      claimDate: payload?.claimDate ?? todayIso(),
      travelDate: payload?.travelDate ?? '',
      fromPlace: payload?.fromPlace ?? '',
      toPlace: payload?.toPlace ?? '',
      amount: payload ? String(toAmount(payload.amount) ?? '') : '',
      description: payload?.description ?? '',
      ticket: payload ? detailFileRef(payload) : null,
    },
  })
  const amount = useController({ control: form.control, name: 'amount' })
  const ticket = useController({ control: form.control, name: 'ticket' })

  const submit = form.handleSubmit(async (values) => {
    if (pickPerson && !values.employeeId) {
      form.setError('employeeId', { message: 'Choose the employee' })
      return
    }
    const body: RequestBody<AirTicketDetailsInput> = {
      ...(pickPerson && values.employeeId ? { employeeId: values.employeeId } : {}),
      fromDate: values.travelDate,
      toDate: values.travelDate,
      details: {
        title: values.title.trim(),
        claimDate: values.claimDate || null,
        travelDate: values.travelDate,
        fromPlace: values.fromPlace.trim() || null,
        toPlace: values.toPlace.trim() || null,
        amount: parseAmount(values.amount) ?? 0,
        description: values.description.trim() || null,
        fileId: values.ticket?.id ?? null,
      },
      ...(mode === 'edit' && request ? { rowVersion: request.rowVersion } : {}),
    }
    try {
      if (mode === 'edit' && request)
        await update.mutateAsync({ id: request.id, body: requestBody(body) })
      else await create.mutateAsync(requestBody(body))
    } catch (failure) {
      if (failure instanceof ApiError) {
        let placed = false
        for (const [field, message] of Object.entries(failure.fieldErrors)) {
          const key = field.replace(/^details\./, '')
          if (FIELDS.has(key) || key === 'employeeId') {
            form.setError(key as keyof Values, { message })
            placed = true
          } else if (key === 'fileId') {
            form.setError('ticket', { message })
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
        {scope === 'all' && (
          <RequestEmployeeField
            control={form.control}
            name="employeeId"
            permission={typePermission('air-tickets', 'create')}
            current={request?.employee}
            required
            disabled={!pickPerson}
          />
        )}
        <TextField
          control={form.control}
          name="title"
          label="Title"
          required
          maxLength={200}
          placeholder="Write here"
          disabled={readOnly}
        />
        <DateField
          control={form.control}
          name="claimDate"
          label="Claim Date"
          disabled={readOnly}
          maxDate={new Date()}
        />
        <DateField
          control={form.control}
          name="travelDate"
          label="Travel Date"
          required
          disabled={readOnly}
        />
        <TextField
          control={form.control}
          name="fromPlace"
          label="From"
          maxLength={200}
          placeholder="City"
          disabled={readOnly}
        />
        <TextField
          control={form.control}
          name="toPlace"
          label="To"
          maxLength={200}
          placeholder="City"
          disabled={readOnly}
        />
        <FormField label="Amount" required error={amount.fieldState.error?.message}>
          {(a11y) => (
            <RsInput
              {...a11y}
              value={amount.field.value}
              onChange={amount.field.onChange}
              disabled={readOnly}
            />
          )}
        </FormField>
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          rows={3}
          maxLength={4000}
          placeholder="Write here"
          disabled={readOnly}
        />
        <RequestFileField
          label="Ticket"
          value={ticket.field.value ?? null}
          onChange={ticket.field.onChange}
          disabled={readOnly}
          error={ticket.fieldState.error?.message}
        />
      </form>
    </PayrollDialog>
  )
}
