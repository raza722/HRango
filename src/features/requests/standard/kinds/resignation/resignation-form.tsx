import { useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { parse } from 'date-fns'
import { z } from 'zod'

import { CheckboxField, FormField, TextareaField } from '@/components/form'
import { Input } from '@/components/ui/input'
import { DateField, PayrollDialog, SearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { type RequestBody, typePermission } from '../../../api/backend'
import { RequestEmployeeField } from '../../../components/shared/request-employee-field'
import { RequestFileField } from '../../../components/shared/request-files'
import { syncAttachments } from '../../../utils/request-files'
import type { StandardFormProps } from '../../standard.types'
import { standardReadOnlyClass } from '../../standard-styles'
import { useCreateStandard, useStandardLookups, useUpdateStandard } from '../../use-standard'
import { useRequestAttachment } from '../loan-advances/use-request-attachment'
import { RESIGNATION_TYPE_LABELS } from './resignation.lookups'
import {
  RESIGNATION_TYPES,
  type ResignationDetailsIn,
  type ResignationLookups,
  type ResignationPayload,
  type ResignationType,
} from './resignation.types'
import { noticeDaysOf } from './resignation.utils'

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
    lastWorkingDate: z.string(),
    serveNotice: z.boolean(),
    reason: z.string().trim().min(1, 'Give the reason').max(500, 'Keep it under 500 characters'),
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
  const days = noticeDaysOf(from || null, to || null)
  return days === null ? '' : `${String(days)} ${days === 1 ? 'day' : 'days'}`
}

/** The API's field names → the form's. */
const FIELD_OF: Record<string, keyof Values> = {
  employeeId: 'employeeId',
  resignationType: 'type',
  resignationDate: 'resignationDate',
  fromDate: 'resignationDate',
  lastWorkingDate: 'lastWorkingDate',
  toDate: 'lastWorkingDate',
  serveNotice: 'serveNotice',
  reason: 'reason',
}

const isType = (value: string | null): value is ResignationType =>
  (RESIGNATION_TYPES as readonly (string | null)[]).includes(value)

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
 * Last Working Date (optional: the approver may set it), Notice Period (the
 * days between the two dates), Serve Notice, Reason and Attachment.
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
  const { attachment, setAttachment, before } = useRequestAttachment('resignation', request)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: request?.employee.id ?? null,
      type: request?.payload.resignationType ?? null,
      resignationDate: request?.payload.resignationDate ?? '',
      lastWorkingDate: request?.payload.lastWorkingDate ?? '',
      serveNotice: request?.payload.serveNotice ?? false,
      reason: request?.reason ?? '',
    },
  })
  const [resignationDate, lastWorkingDate] = useWatch({
    control: form.control,
    name: ['resignationDate', 'lastWorkingDate'],
  })

  const submit = form.handleSubmit(async (values) => {
    if (pickPerson && !values.employeeId) {
      form.setError('employeeId', { message: 'Choose the employee' })
      return
    }
    const lastWorkingDate = values.lastWorkingDate || null
    const details = {
      resignationType: isType(values.type) ? values.type : 'resignation',
      resignationDate: values.resignationDate,
      lastWorkingDate,
      noticePeriodDays: noticeDaysOf(values.resignationDate, lastWorkingDate),
      serveNotice: values.serveNotice,
    } satisfies ResignationDetailsIn
    const body: RequestBody = {
      ...(pickPerson && values.employeeId ? { employeeId: values.employeeId } : {}),
      fromDate: values.resignationDate,
      toDate: lastWorkingDate ?? values.resignationDate,
      reason: values.reason.trim(),
      details,
    }
    try {
      if (mode === 'edit' && request) {
        await update.mutateAsync({
          id: request.id,
          body: { ...body, rowVersion: request.rowVersion },
        })
        await syncAttachments('resignation', request.id, before, [attachment])
      } else {
        await create.mutateAsync({ ...body, attachments: attachment ? [attachment.id] : [] })
      }
    } catch (failure) {
      if (failure instanceof ApiError) {
        let placed = false
        for (const [field, message] of Object.entries(failure.fieldErrors)) {
          const name = FIELD_OF[field]
          if (name) {
            form.setError(name, { message })
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
          <RequestEmployeeField
            control={form.control}
            name="employeeId"
            permission={typePermission('resignation', 'create')}
            current={request?.employee}
            required
            disabled={!pickPerson}
          />
        )}
        <SearchSelectField
          control={form.control}
          name="type"
          label="Type"
          required
          placeholder="Select"
          disabled={readOnly}
          options={[
            ...(lookups.data?.extra.types ?? []),
            // A saved request keeps its type, even one the list no longer offers.
            ...(request &&
            !(lookups.data?.extra.types ?? []).some(
              (item) => item.value === request.payload.resignationType,
            )
              ? [
                  {
                    value: request.payload.resignationType,
                    label: RESIGNATION_TYPE_LABELS[request.payload.resignationType],
                  },
                ]
              : []),
          ].map((item) => ({
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
          disabled={readOnly}
          minDate={resignationDate ? day(resignationDate) : undefined}
        />
        <ComputedField label="Notice Period" value={noticeText(resignationDate, lastWorkingDate)} />
        <CheckboxField
          control={form.control}
          name="serveNotice"
          label="Serve Notice"
          tone="navy"
          disabled={readOnly}
        />
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
        <RequestFileField value={attachment} onChange={setAttachment} disabled={readOnly} />
      </form>
    </PayrollDialog>
  )
}
