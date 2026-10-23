import { useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { parse } from 'date-fns'
import { z } from 'zod'

import { TextareaField } from '@/components/form'
import { DateField, PayrollDialog, SearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import type { StandardFormProps } from '../../standard.types'
import { standardReadOnlyClass } from '../../standard-styles'
import { useCreateStandard, useStandardLookups, useUpdateStandard } from '../../use-standard'
import { useScheduleDays } from './schedule-days'
import { ShiftStrip } from './shift-strip'
import type {
  WorkFromHomeInput,
  WorkFromHomeLookups,
  WorkFromHomePayload,
} from './work-from-home.types'

const schema = z
  .object({
    employeeId: z.string().nullable(),
    from: z.string().min(1, 'Choose the start date'),
    to: z.string().min(1, 'Choose the end date'),
    dates: z.array(z.string()),
    reason: z.string().trim().max(500, 'Keep it under 500 characters'),
  })
  .refine((values) => !values.from || !values.to || values.to >= values.from, {
    message: 'Choose the Start Date or a later day',
    path: ['to'],
  })
type Values = z.infer<typeof schema>

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())
const today = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

const TITLES = {
  create: 'WFH Request Create',
  edit: 'WFH Request Edit',
  view: 'WFH Request View',
} as const

/**
 * Work From Home Create / Edit / View: Select Employee (All only), Start
 * Date, End Date, the week strip where the shifts to work from home are
 * ticked, Reason and Selected Days (the ticked shifts).
 */
export function WorkFromHomeForm({
  mode,
  scope,
  request,
  onClose,
}: StandardFormProps<WorkFromHomePayload>) {
  const formId = useId()
  const lookups = useStandardLookups<WorkFromHomeLookups>('work-from-home')
  const create = useCreateStandard('work-from-home')
  const update = useUpdateStandard('work-from-home')
  const readOnly = mode === 'view'
  const pickPerson = scope === 'all' && mode === 'create'
  const people = lookups.data?.employees ?? []

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: request?.employee.id ?? null,
      from: request?.payload.from ?? '',
      to: request?.payload.to ?? '',
      dates: request?.payload.dates ?? [],
      reason: request?.payload.reason ?? '',
    },
  })
  const [employeeId, from, to, dates] = useWatch({
    control: form.control,
    name: ['employeeId', 'from', 'to', 'dates'],
  })
  const personId = request?.employee.id ?? (pickPerson ? employeeId : lookups.data?.me.id)
  const listed = people.find((item) => item.id === personId)
  const person =
    request?.employee ??
    (listed && { ...listed, photoUrl: lookups.data?.extra.photos[listed.id] ?? null })
  const schedule = useScheduleDays('work-from-home', personId, from, to)
  // Only the ticked shifts inside the dates count.
  const ticked = dates.filter((date) => date >= from && date <= to)
  const datesError = form.formState.errors.dates?.message

  const toggle = (date: string) => {
    const next = ticked.includes(date) ? ticked.filter((item) => item !== date) : [...ticked, date]
    next.sort()
    form.setValue('dates', next, { shouldDirty: true })
    form.clearErrors('dates')
  }

  const submit = form.handleSubmit(async (values) => {
    if (pickPerson && !values.employeeId) {
      form.setError('employeeId', { message: 'Choose the employee' })
      return
    }
    if (ticked.length === 0) {
      form.setError('dates', { message: 'Please select at least one shift.' })
      return
    }
    const input: WorkFromHomeInput = {
      ...(pickPerson && values.employeeId ? { employeeId: values.employeeId } : {}),
      from: values.from,
      to: values.to,
      dates: ticked,
      reason: values.reason,
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
      className="max-w-4xl"
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void submit(event)}
        className={cn('grid gap-5', readOnly && standardReadOnlyClass)}
      >
        {scope === 'all' && (
          <SearchSelectField
            control={form.control}
            name="employeeId"
            label="Select Employee"
            required
            placeholder="Select Employee"
            disabled={!pickPerson}
            options={people
              .filter((item) => item.active || item.id === request?.employee.id)
              .map((item) => ({ value: item.id, label: item.name, hint: item.code }))}
            onValueChange={() => {
              form.setValue('dates', [])
            }}
          />
        )}
        <DateField
          control={form.control}
          name="from"
          label="Start Date"
          required
          disabled={readOnly}
          minDate={readOnly ? undefined : today()}
        />
        <DateField
          control={form.control}
          name="to"
          label="End Date"
          required
          disabled={readOnly}
          minDate={readOnly ? undefined : from ? day(from) : today()}
        />
        {from && to && to >= from && person && (
          <div className="grid gap-1.5">
            <ShiftStrip
              label="Shifts to work from home"
              person={person}
              days={schedule.data}
              loading={schedule.isPending}
              selected={new Set(ticked)}
              onToggle={readOnly ? undefined : toggle}
            />
            {!readOnly && (
              <p className="text-xs text-grey">Tick the shifts you will work from home.</p>
            )}
          </div>
        )}
        {datesError && (
          <p role="alert" className="text-sm text-destructive">
            {datesError}
          </p>
        )}
        <TextareaField
          control={form.control}
          name="reason"
          label="Reason"
          rows={4}
          maxLength={500}
          disabled={readOnly}
        />
        <div className="grid gap-2 @xl:grid-cols-[10rem_minmax(0,1fr)] @xl:items-center @3xl:grid-cols-[11rem_minmax(0,1fr)]">
          <span className="font-inter text-base text-heading">Selected Days</span>
          <span
            aria-live="polite"
            className="w-fit min-w-8 rounded-[5px] bg-[#FFE3E3] px-1.5 py-1 text-center font-inter text-sm font-semibold text-[#333C48] dark:bg-red-500/15 dark:text-heading"
          >
            {ticked.length}
          </span>
        </div>
      </form>
    </PayrollDialog>
  )
}
