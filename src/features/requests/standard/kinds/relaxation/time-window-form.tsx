import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { FormField, TextareaField, TimePickerField } from '@/components/form'
import { Input } from '@/components/ui/input'
import { DateField, PayrollDialog } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import type { FileRef } from '@/lib/files'
import { cn } from '@/lib/utils'

import { type RequestBody, typePermission } from '../../../api/backend'
import { RequestEmployeeField } from '../../../components/shared/request-employee-field'
import { RequestFileField } from '../../../components/shared/request-files'
import { attachmentRef, syncAttachments } from '../../../utils/request-files'
import { clock } from '../../../utils/request-format'
import { standardDetailQueryOptions } from '../../standard.api'
import type { StandardFormProps } from '../../standard.types'
import { standardReadOnlyClass } from '../../standard-styles'
import { useCreateStandard, useStandardLookups, useUpdateStandard } from '../../use-standard'
import {
  daySlotKey,
  fetchDaySlot,
  hm,
  type TimeWindowDetails,
  type TimeWindowInput,
} from './time-window'

/** Where the API puts a field error → the form's field. */
const FIELD_OF: Record<string, keyof Values> = {
  windowDate: 'date',
  fromDate: 'date',
  toDate: 'date',
  startTime: 'startTime',
  endTime: 'endTime',
  reason: 'reason',
  description: 'description',
  employeeId: 'employeeId',
}

function makeSchema(reasonRequired: boolean) {
  return z.object({
    employeeId: z.string().nullable(),
    date: z.string().min(1, 'Choose the date'),
    startTime: z.string().min(1, 'Choose the start time'),
    endTime: z.string().min(1, 'Choose the end time'),
    reason: reasonRequired
      ? z.string().trim().min(1, 'Give the reason').max(500, 'Keep it under 500 characters')
      : z.string().trim().max(500, 'Keep it under 500 characters'),
    description: z.string().trim().max(1000, 'Keep it under 1000 characters'),
  })
}
type Values = z.infer<ReturnType<typeof makeSchema>>

/** The day's shift, read from the schedule: a grey box that cannot be typed in. */
function TimeSlotField({ value, hint }: { value: string; hint?: string | undefined }) {
  return (
    <FormField label="Time Slot" description={hint}>
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

export interface TimeWindowFormOptions {
  kind: 'relaxation' | 'official-visits'
  titles: { create: string; edit: string; view: string }
  /** Relaxation: the times must fall inside the day's shift (the API refuses a day without one). */
  needsShift: boolean
  reasonLabel: string
  reasonRequired: boolean
  /** Official Visit: Description and Attachment as well. */
  extras: boolean
}

/**
 * The time-window request form (Relaxation, Official Visit): Employee Name
 * (All only), Date, the day's Time Slot from the schedule, Start Time, End
 * Time and the reason; a visit adds Description and an Attachment.
 */
export function TimeWindowForm({
  mode,
  scope,
  request,
  onClose,
  options,
}: StandardFormProps<TimeWindowDetails> & { options: TimeWindowFormOptions }) {
  const formId = useId()
  const { kind } = options
  const lookups = useStandardLookups(kind)
  const create = useCreateStandard(kind)
  const update = useUpdateStandard(kind)
  const readOnly = mode === 'view'
  const pickPerson = scope === 'all' && mode === 'create'
  const payload = request?.payload

  const form = useForm<Values>({
    resolver: zodResolver(makeSchema(options.reasonRequired)),
    defaultValues: {
      employeeId: request?.employee.id ?? null,
      date: payload?.windowDate ?? '',
      startTime: hm(payload?.startTime),
      endTime: hm(payload?.endTime),
      reason: request?.reason ?? '',
      description: request?.description ?? '',
    },
  })
  // Lists carry no files: Edit and View read the request for its attachment.
  const detail = useQuery({
    ...standardDetailQueryOptions<TimeWindowDetails>(kind, request?.id ?? ''),
    enabled: Boolean(request) && options.extras,
  })
  const savedFiles = detail.data?.request.attachments ?? request?.attachments ?? []
  // Uploaded as soon as it is picked; undefined until the person changes it.
  const [picked, setFile] = useState<FileRef | null | undefined>(undefined)
  const first = savedFiles[0]
  const file = picked === undefined ? (first ? attachmentRef(first) : null) : picked
  const [employeeId, date] = useWatch({ control: form.control, name: ['employeeId', 'date'] })
  const waitingForPerson = pickPerson && !employeeId
  // My Requests: the signed-in person (left out when unknown: the API then reads the caller's own row).
  const person =
    request?.employee.id ??
    (pickPerson ? (employeeId ?? undefined) : (lookups.data?.me?.id ?? undefined))
  // View keeps the slot saved with the request; Create and Edit read the day's schedule.
  const shift = useQuery({
    queryKey: daySlotKey(person, date),
    queryFn: ({ signal }) => fetchDaySlot(person, date, signal),
    enabled: !readOnly && !waitingForPerson && date !== '',
    retry: false,
  })
  const saved =
    payload?.timeSlotName && payload.slotStartTime
      ? `${payload.timeSlotName} (${clock(hm(payload.slotStartTime))} - ${clock(hm(payload.slotEndTime))})`
      : (payload?.timeSlotName ?? '')
  const slot = readOnly
    ? saved
    : shift.data
      ? `${shift.data.slotName} (${clock(shift.data.start)} - ${clock(shift.data.end)})`
      : ''
  const hint =
    readOnly || !date
      ? undefined
      : waitingForPerson
        ? 'Choose the employee first.'
        : shift.isError
          ? 'The schedule could not be read.'
          : shift.isSuccess && !shift.data
            ? options.needsShift
              ? 'No shift is scheduled on this day.'
              : undefined
            : shift.data && options.needsShift && shift.data.count === 1
              ? 'Start Time and End Time must fall inside this shift.'
              : undefined

  const submit = form.handleSubmit(async (values) => {
    if (pickPerson && !values.employeeId) {
      form.setError('employeeId', { message: 'Choose the employee' })
      return
    }
    const details: TimeWindowInput = {
      windowDate: values.date,
      startTime: values.startTime,
      endTime: values.endTime,
    }
    const body: RequestBody = {
      ...(pickPerson && values.employeeId ? { employeeId: values.employeeId } : {}),
      fromDate: values.date,
      toDate: values.date,
      reason: values.reason.trim() || null,
      ...(options.extras ? { description: values.description.trim() || null } : {}),
      attachments: file ? [file.id] : [],
      details: { ...details },
    }
    try {
      if (mode === 'edit' && request) {
        await update.mutateAsync({
          id: request.id,
          body: { ...body, rowVersion: request.rowVersion },
        })
        if (options.extras) await syncAttachments(kind, request.id, savedFiles, [file])
      } else {
        await create.mutateAsync(body)
      }
    } catch (failure) {
      if (failure instanceof ApiError) {
        let placed = false
        for (const [field, message] of Object.entries(failure.fieldErrors)) {
          const target = FIELD_OF[field]
          if (target) {
            form.setError(target, { message })
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
      title={options.titles[mode]}
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
        {/* All Requests only: HR picks whose request it is; locked once made. */}
        {scope === 'all' && (
          <RequestEmployeeField
            control={form.control}
            name="employeeId"
            permission={typePermission(kind, 'create')}
            current={request?.employee}
            label="Employee Name"
            required
            disabled={!pickPerson}
          />
        )}
        <DateField control={form.control} name="date" label="Date" required disabled={readOnly} />
        <TimeSlotField value={slot} hint={hint} />
        <TimePickerField
          control={form.control}
          name="startTime"
          label="Start Time"
          required
          disabled={readOnly}
        />
        <TimePickerField
          control={form.control}
          name="endTime"
          label="End Time"
          required
          disabled={readOnly}
        />
        <TextareaField
          control={form.control}
          name="reason"
          label={options.reasonLabel}
          required={options.reasonRequired}
          rows={4}
          maxLength={500}
          placeholder="Write here"
          disabled={readOnly}
        />
        {options.extras && (
          <>
            <TextareaField
              control={form.control}
              name="description"
              label="Description"
              rows={3}
              maxLength={1000}
              placeholder="Write here"
              disabled={readOnly}
            />
            <RequestFileField value={file} onChange={setFile} disabled={readOnly} />
          </>
        )}
      </form>
    </PayrollDialog>
  )
}
