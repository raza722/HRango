import { useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { parse } from 'date-fns'
import { z } from 'zod'

import { TextareaField } from '@/components/form'
import { DateField, PayrollDialog } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { type RequestBody, typePermission } from '../../../api/backend'
import { useRequestPerson } from '../../../components/shared/request-employee'
import { RequestEmployeeField } from '../../../components/shared/request-employee-field'
import type { StandardFormProps } from '../../standard.types'
import { standardReadOnlyClass } from '../../standard-styles'
import { useCreateStandard, useStandardLookups, useUpdateStandard } from '../../use-standard'
import { useScheduleDays } from './schedule-days'
import { ShiftStrip } from './shift-strip'
import type { WorkFromHomeDetailsIn, WorkFromHomePayload } from './work-from-home.types'

const schema = z
  .object({
    employeeId: z.string().nullable(),
    from: z.string().min(1, 'Choose the start date'),
    to: z.string().min(1, 'Choose the end date'),
    dates: z.array(z.string()),
    reason: z.string().trim().min(1, 'Give the reason').max(4000, 'Keep it shorter'),
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

/** API field → form field, for the server's field errors. */
const FIELDS: Record<string, keyof Values> = {
  employeeId: 'employeeId',
  fromDate: 'from',
  toDate: 'to',
  dates: 'dates',
  reason: 'reason',
}

/**
 * Work From Home Create / Edit / View: Select Employee (All only), Start
 * Date, End Date, the week strip where the shifts to work from home are
 * ticked, Reason* (required by the API) and Selected Days (the ticked shifts).
 * Sends `POST /requests/work-from-home` with `details.dates`.
 */
export function WorkFromHomeForm({
  mode,
  scope,
  request,
  onClose,
}: StandardFormProps<WorkFromHomePayload>) {
  const formId = useId()
  const lookups = useStandardLookups('work-from-home')
  const create = useCreateStandard('work-from-home')
  const update = useUpdateStandard('work-from-home')
  const readOnly = mode === 'view'
  const pickPerson = scope === 'all' && mode === 'create'

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: request?.employee.id ?? null,
      from: request?.fromDate ?? '',
      to: request?.toDate ?? '',
      dates: request?.payload.days.map((item) => item.requestDate) ?? [],
      reason: request?.reason ?? '',
    },
  })
  const [employeeId, from, to, dates] = useWatch({
    control: form.control,
    name: ['employeeId', 'from', 'to', 'dates'],
  })
  // My Requests: the signed-in person (their own board when they have no employee id here).
  const personId = request?.employee.id ?? (pickPerson ? employeeId : lookups.data?.me?.id)
  const schedule = useScheduleDays('work-from-home', personId, from, to, {
    mine: !pickPerson && !request,
  })
  const picked = useRequestPerson(typePermission('work-from-home', 'create'), personId)
  const person = request?.employee ?? picked ?? schedule.data?.person
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
    const body: RequestBody = {
      ...(pickPerson && values.employeeId ? { employeeId: values.employeeId } : {}),
      fromDate: values.from,
      toDate: values.to,
      reason: values.reason,
      details: { dates: ticked } satisfies WorkFromHomeDetailsIn,
    }
    try {
      if (mode === 'edit' && request) {
        await update.mutateAsync({
          id: request.id,
          body: { ...body, rowVersion: request.rowVersion },
        })
      } else await create.mutateAsync(body)
    } catch (failure) {
      if (failure instanceof ApiError) {
        let placed = false
        for (const [field, message] of Object.entries(failure.fieldErrors)) {
          const name = FIELDS[field]
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
      className="max-w-4xl"
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
            permission={typePermission('work-from-home', 'create')}
            current={request?.employee}
            label="Select Employee"
            required
            placeholder="Select Employee"
            disabled={!pickPerson}
            onPick={() => {
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
              days={schedule.data?.days}
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
          required
          rows={4}
          maxLength={4000}
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
