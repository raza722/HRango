import { useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { FormField, TextareaField, TimePickerField } from '@/components/form'
import { Input } from '@/components/ui/input'
import { DateField, PayrollDialog, SearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { useDayShift } from '../../../hooks/use-requests'
import { clock } from '../../../utils/request-format'
import type { StandardFormProps } from '../../standard.types'
import { standardReadOnlyClass } from '../../standard-styles'
import { useCreateStandard, useStandardLookups, useUpdateStandard } from '../../use-standard'
import type { RelaxationInput, RelaxationPayload } from './relaxation.types'

const schema = z.object({
  employeeId: z.string().nullable(),
  date: z.string().min(1, 'Choose the date'),
  startTime: z.string().min(1, 'Choose the start time'),
  endTime: z.string().min(1, 'Choose the end time'),
  reason: z.string().trim().min(1, 'Give the reason').max(500, 'Keep it under 500 characters'),
})
type Values = z.infer<typeof schema>

const TITLES = {
  create: 'Create Relaxation Request',
  edit: 'Relaxation Request Edit',
  view: 'Relaxation Request View',
} as const

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

/**
 * "Create Relaxation Request": Employee Name (All only), Date, Start Time,
 * End Time and Reason. The relaxation must fall inside the person's shift
 * that day, so the form shows that shift (Time Slot) under the date.
 */
export function RelaxationForm({
  mode,
  scope,
  request,
  onClose,
}: StandardFormProps<RelaxationPayload>) {
  const formId = useId()
  const lookups = useStandardLookups('relaxation')
  const create = useCreateStandard('relaxation')
  const update = useUpdateStandard('relaxation')
  const readOnly = mode === 'view'
  const pickPerson = scope === 'all' && mode === 'create'
  const people = lookups.data?.employees ?? []

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: request?.employee.id ?? null,
      date: request?.payload.date ?? '',
      startTime: request?.payload.startTime ?? '',
      endTime: request?.payload.endTime ?? '',
      reason: request?.payload.reason ?? '',
    },
  })
  const [employeeId, date] = useWatch({ control: form.control, name: ['employeeId', 'date'] })
  const waitingForPerson = pickPerson && !employeeId
  // View keeps the shift saved with the request; Create and Edit read the day's schedule.
  const shift = useDayShift(
    request?.employee.id ?? (pickPerson ? (employeeId ?? undefined) : undefined),
    readOnly || waitingForPerson ? '' : date,
  )
  const slot = readOnly
    ? (request?.payload.timeSlot ?? '')
    : shift.data
      ? shift.data.clockIn
        ? `${shift.data.slotName ?? 'Shift'} (${clock(shift.data.clockIn)} - ${clock(shift.data.clockOut)})`
        : (shift.data.slotName ?? '')
      : ''
  const hint =
    readOnly || !date
      ? undefined
      : waitingForPerson
        ? 'Choose the employee first.'
        : shift.data && !shift.data.clockIn
          ? 'No shift is scheduled on this day.'
          : shift.data
            ? 'Start Time and End Time must fall inside this shift.'
            : undefined

  const submit = form.handleSubmit(async (values) => {
    if (pickPerson && !values.employeeId) {
      form.setError('employeeId', { message: 'Choose the employee' })
      return
    }
    const input: RelaxationInput = {
      ...(pickPerson && values.employeeId ? { employeeId: values.employeeId } : {}),
      date: values.date,
      startTime: values.startTime,
      endTime: values.endTime,
      reason: values.reason.trim(),
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
        {/* All Requests only: HR picks whose relaxation it is; locked once made. */}
        {scope === 'all' && (
          <SearchSelectField
            control={form.control}
            name="employeeId"
            label="Employee Name"
            required
            placeholder="Select"
            disabled={!pickPerson}
            options={people
              .filter((person) => person.active || person.id === request?.employee.id)
              .map((person) => ({ value: person.id, label: person.name, hint: person.code }))}
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
          label="Reason"
          required
          rows={4}
          maxLength={500}
          placeholder="Write here"
          disabled={readOnly}
        />
      </form>
    </PayrollDialog>
  )
}
