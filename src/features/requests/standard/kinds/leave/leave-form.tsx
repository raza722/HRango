import { useEffect, useId, useRef } from 'react'
import {
  type Control,
  type FieldPathByValue,
  useController,
  useForm,
  useWatch,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { addMinutes, format, parse } from 'date-fns'
import { Clock } from 'lucide-react'
import { z } from 'zod'

import { CheckboxField, FormField, TextareaField } from '@/components/form'
import { Input } from '@/components/ui/input'
import {
  AttachmentField,
  DateField,
  DateInput,
  PayrollDialog,
  SearchSelectField,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import type { StandardFormProps } from '../../standard.types'
import { standardReadOnlyClass } from '../../standard-styles'
import { useCreateStandard, useStandardLookups, useUpdateStandard } from '../../use-standard'
import { useScheduleDays } from '../work-from-home/schedule-days'
import { ShiftStrip } from '../work-from-home/shift-strip'
import type { LeaveInput, LeaveLookups, LeavePayload, ShortLeaveType } from './leave.types'

const chosen = (message: string) =>
  z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message })

const schema = z
  .object({
    employeeId: z.string().nullable(),
    leaveTypeId: chosen('Choose the leave type'),
    short: z.boolean(),
    shortType: z.string().nullable(),
    from: z.string(),
    to: z.string(),
    requestDate: z.string(),
    startDate: z.string(),
    startTime: z.string(),
    endDate: z.string(),
    endTime: z.string(),
    attachment: z.string().nullable(),
    reason: z.string().trim().min(1, 'Give the reason').max(500, 'Keep it under 500 characters'),
  })
  .superRefine((values, context) => {
    const need = (path: keyof typeof values, message: string) => {
      context.addIssue({ code: 'custom', path: [path], message })
    }
    if (!values.short) {
      if (!values.from) need('from', 'Choose the start date')
      if (!values.to) need('to', 'Choose the end date')
      else if (values.from && values.to < values.from) {
        need('to', 'Choose the Start Date or a later day')
      }
      return
    }
    if (!values.shortType) need('shortType', 'Choose the short leave type')
    if (!values.requestDate) need('requestDate', 'Choose the request date')
    if (!values.startDate || !values.startTime) need('startTime', 'Choose the start time')
    if (!values.endDate || !values.endTime) need('endTime', 'Choose the end time')
    else if (
      values.startDate &&
      values.startTime &&
      `${values.endDate} ${values.endTime}` <= `${values.startDate} ${values.startTime}`
    ) {
      need('endTime', 'Choose a time after the start time')
    }
  })
type Values = z.infer<typeof schema>

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())
const iso = (date: Date) => format(date, 'yyyy-MM-dd')
/** 8, 14.5. */
const days = (value: number) => String(Math.round(value * 100) / 100)

const TITLES = {
  create: 'Leave Request Create',
  edit: 'Leave Request Edit',
  view: 'Leave Request View',
} as const

/** "Start Time *": the day and the time side by side, as drawn. */
function DateTimeField({
  control,
  dateName,
  timeName,
  label,
  disabled,
}: {
  control: Control<Values>
  dateName: FieldPathByValue<Values, string>
  timeName: FieldPathByValue<Values, string>
  label: string
  disabled: boolean
}) {
  const date = useController({ control, name: dateName })
  const time = useController({ control, name: timeName })
  const error = time.fieldState.error?.message ?? date.fieldState.error?.message
  return (
    <FormField label={label} required error={error}>
      {(a11y) => (
        <div className="grid gap-3 @md:grid-cols-2 @md:gap-6">
          <DateInput
            {...a11y}
            aria-label={`${label} date`}
            value={date.field.value}
            onChange={date.field.onChange}
            disabled={disabled}
            display="MMMM d, yyyy"
          />
          <div className="relative">
            <Input
              type="time"
              aria-label={`${label} time`}
              aria-invalid={Boolean(error)}
              ref={time.field.ref}
              name={time.field.name}
              value={time.field.value}
              onChange={time.field.onChange}
              onBlur={time.field.onBlur}
              disabled={disabled}
              className="pr-11 [color-scheme:light] dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-y-0 [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-11 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
            />
            <Clock
              aria-hidden="true"
              strokeWidth={1.5}
              className="pointer-events-none absolute top-1/2 right-3 size-6 -translate-y-1/2 text-chip"
            />
          </div>
        </div>
      )}
    </FormField>
  )
}

/**
 * "Leave Request Create" (frames 4189:59340, 4189:61223, 4191:58946; All:
 * 4194:67969): Employee Name (All only), Leave Type, Short, Available Leaves,
 * Start / End Date, Attachment, Reason and Selected Days. "Short" swaps the
 * dates for Short Leave Type, Request Date with the day's shift, Start Time
 * and End Time. Only shift days count; the balance is checked before saving.
 */
export function LeaveForm({ mode, scope, request, onClose }: StandardFormProps<LeavePayload>) {
  const formId = useId()
  const lookups = useStandardLookups<LeaveLookups>('leave')
  const create = useCreateStandard('leave')
  const update = useUpdateStandard('leave')
  const readOnly = mode === 'view'
  const pickPerson = scope === 'all' && mode === 'create'
  const people = lookups.data?.employees ?? []
  const extra = lookups.data?.extra
  const payload = request?.payload

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: request?.employee.id ?? null,
      leaveTypeId: payload?.leaveTypeId ?? null,
      short: payload?.short ?? false,
      shortType: payload?.shortType ?? null,
      from: payload && !payload.short ? payload.from : '',
      to: payload && !payload.short ? payload.to : '',
      requestDate: payload?.short ? payload.from : '',
      startDate: payload?.startDate ?? '',
      startTime: payload?.startTime ?? '',
      endDate: payload?.endDate ?? '',
      endTime: payload?.endTime ?? '',
      attachment: payload?.attachment ?? null,
      reason: payload?.reason ?? '',
    },
  })
  const [employeeId, leaveTypeId, short, shortType, from, to, requestDate, attachment] = useWatch({
    control: form.control,
    name: [
      'employeeId',
      'leaveTypeId',
      'short',
      'shortType',
      'from',
      'to',
      'requestDate',
      'attachment',
    ],
  })

  const personId = request?.employee.id ?? (pickPerson ? employeeId : lookups.data?.me.id)
  const listed = people.find((item) => item.id === personId)
  const person =
    request?.employee ?? (listed && { ...listed, photoUrl: extra?.photos[listed.id] ?? null })
  const range = useScheduleDays(
    'leave',
    personId,
    short ? requestDate : from,
    short ? requestDate : to,
  )
  const shift = short ? range.data?.find((item) => item.date === requestDate) : undefined
  const fraction = extra?.shortTypes.find((item) => item.value === shortType)?.fraction ?? 0
  const selectedDays = short
    ? shift?.status === 'shift'
      ? fraction
      : 0
    : (range.data?.filter((item) => item.status === 'shift').length ?? 0)

  // Available Leaves: this request's own pending days are given back while it is edited.
  const balance = personId && leaveTypeId ? extra?.balances[personId]?.[leaveTypeId] : undefined
  const ownDays =
    payload && request.status === 'pending' && payload.leaveTypeId === leaveTypeId
      ? payload.count
      : 0
  const available = balance ? balance.available + ownDays : undefined

  // A short leave starts with the shift and lasts its share of it, until changed.
  const filled = useRef(mode === 'create' ? '' : `${requestDate}|${shortType ?? ''}`)
  useEffect(() => {
    if (readOnly || !short || !requestDate || !shortType || !shift?.clockIn || !shift.clockOut) {
      return
    }
    const key = `${requestDate}|${shortType}`
    if (filled.current === key) return
    filled.current = key
    const start = parse(`${requestDate} ${shift.clockIn}`, 'yyyy-MM-dd HH:mm', new Date())
    let end = parse(`${requestDate} ${shift.clockOut}`, 'yyyy-MM-dd HH:mm', new Date())
    if (end <= start) end = addMinutes(end, 1440)
    const until = addMinutes(
      start,
      Math.round(((end.getTime() - start.getTime()) / 60_000) * fraction),
    )
    form.setValue('startDate', requestDate)
    form.setValue('startTime', shift.clockIn)
    form.setValue('endDate', iso(until))
    form.setValue('endTime', format(until, 'HH:mm'))
  }, [form, readOnly, short, requestDate, shortType, shift?.clockIn, shift?.clockOut, fraction])

  const submit = form.handleSubmit(async (values) => {
    if (pickPerson && !values.employeeId) {
      form.setError('employeeId', { message: 'Choose the employee' })
      return
    }
    if (!values.short && selectedDays === 0 && !range.isPending) {
      form.setError('from', { message: 'Choose dates with working days' })
      return
    }
    if (values.short && shift && shift.status !== 'shift') {
      form.setError('requestDate', { message: 'Choose a day with a shift' })
      return
    }
    if (available !== undefined && selectedDays > available) {
      form.setError(values.short ? 'shortType' : 'to', {
        message: `Only ${days(available)} available`,
      })
      return
    }
    const input: LeaveInput = {
      ...(pickPerson && values.employeeId ? { employeeId: values.employeeId } : {}),
      leaveTypeId: values.leaveTypeId ?? '',
      short: values.short,
      shortType: values.short ? ((values.shortType ?? null) as ShortLeaveType | null) : null,
      from: values.short ? values.requestDate : values.from,
      to: values.short ? values.requestDate : values.to,
      startDate: values.short ? values.startDate : null,
      startTime: values.short ? values.startTime : null,
      endDate: values.short ? values.endDate : null,
      endTime: values.short ? values.endTime : null,
      attachment: values.attachment,
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
      className="max-w-3xl"
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
            label="Employee Name"
            required
            placeholder="Select Employee Name"
            disabled={!pickPerson}
            options={people
              .filter((item) => item.active || item.id === request?.employee.id)
              .map((item) => ({ value: item.id, label: item.name, hint: item.code }))}
          />
        )}
        <SearchSelectField
          control={form.control}
          name="leaveTypeId"
          label="Leave Type"
          required
          placeholder="Select Leave Type"
          disabled={readOnly}
          options={(extra?.leaveTypes ?? []).map((item) => ({ value: item.id, label: item.name }))}
        />
        <CheckboxField control={form.control} name="short" label="Short" disabled={readOnly} />
        {short && (
          <SearchSelectField
            control={form.control}
            name="shortType"
            label="Short Leave Type"
            required
            placeholder="Select Short Leave Type"
            disabled={readOnly}
            options={(extra?.shortTypes ?? []).map((item) => ({
              value: item.value,
              label: item.label,
            }))}
          />
        )}
        <FormField label="Available Leaves">
          {(a11y) => (
            <Input
              {...a11y}
              readOnly
              disabled={readOnly}
              value={available === undefined ? '' : days(available)}
              placeholder={leaveTypeId ? '' : 'Choose the leave type'}
            />
          )}
        </FormField>
        {short ? (
          <>
            <DateField
              control={form.control}
              name="requestDate"
              label="Request Date"
              required
              disabled={readOnly}
              display="MMMM d, yyyy"
            />
            {requestDate && person && (
              <ShiftStrip
                label="The day’s shift"
                person={person}
                days={range.data}
                loading={range.isPending}
                selected={new Set(shift?.status === 'shift' ? [requestDate] : [])}
              />
            )}
            <DateTimeField
              control={form.control}
              dateName="startDate"
              timeName="startTime"
              label="Start Time"
              disabled={readOnly}
            />
            <DateTimeField
              control={form.control}
              dateName="endDate"
              timeName="endTime"
              label="End Time"
              disabled={readOnly}
            />
          </>
        ) : (
          <>
            <DateField
              control={form.control}
              name="from"
              label="Start Date"
              required
              disabled={readOnly}
              display="MMMM d, yyyy"
            />
            <DateField
              control={form.control}
              name="to"
              label="End Date"
              required
              disabled={readOnly}
              display="MMMM d, yyyy"
              minDate={from ? day(from) : undefined}
            />
          </>
        )}
        <AttachmentField
          value={attachment}
          onChange={(name) => {
            form.setValue('attachment', name, { shouldDirty: true })
          }}
          disabled={readOnly}
        />
        <TextareaField
          control={form.control}
          name="reason"
          label="Reason"
          required
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
            {days(selectedDays)}
          </span>
        </div>
      </form>
    </PayrollDialog>
  )
}
