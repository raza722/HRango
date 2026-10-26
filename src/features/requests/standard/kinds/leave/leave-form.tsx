import { useEffect, useId, useRef } from 'react'
import { type Control, useController, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { addDays, addMinutes, format, parse, startOfToday } from 'date-fns'
import { Clock } from 'lucide-react'
import { z } from 'zod'

import { CheckboxField, FormField, TextareaField } from '@/components/form'
import { Input } from '@/components/ui/input'
import { DateField, PayrollDialog, SearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import type { FileRef } from '@/lib/files'
import { cn } from '@/lib/utils'

import { type RequestBody, typePermission } from '../../../api/backend'
import { useRequestPerson } from '../../../components/shared/request-employee'
import { RequestEmployeeField } from '../../../components/shared/request-employee-field'
import { RequestFileField } from '../../../components/shared/request-files'
import { attachmentRef, syncAttachments } from '../../../utils/request-files'
import type { StandardFormProps } from '../../standard.types'
import { standardReadOnlyClass } from '../../standard-styles'
import { useCreateStandard, useStandardLookups, useUpdateStandard } from '../../use-standard'
import { useScheduleDays } from '../work-from-home/schedule-days'
import { ShiftStrip } from '../work-from-home/shift-strip'
import { SHORT_TYPES, useLeaveTypeOptions } from './leave.lookups'
import type { LeaveDetailsIn, LeavePayload, ShortLeaveType } from './leave.types'

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
    startTime: z.string(),
    endTime: z.string(),
    reason: z.string().trim().min(1, 'Give the reason').max(4000, 'Keep it shorter'),
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
    if (!values.startTime) need('startTime', 'Choose the start time')
    if (!values.endTime) need('endTime', 'Choose the end time')
    else if (values.startTime && values.endTime <= values.startTime) {
      need('endTime', 'Choose a time after the start time')
    }
  })
type Values = z.infer<typeof schema>
type Field = keyof Values | 'attachment'

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())
/** 8, 14.5. */
const days = (value: number) => String(Math.round(value * 100) / 100)
/** "09:00:00" → "09:00". */
const hhmm = (time: string | null | undefined) => (time ? time.slice(0, 5) : '')

/** API field → form field, for the server's field errors. */
const FIELDS: Record<string, Field> = {
  employeeId: 'employeeId',
  leaveTypeId: 'leaveTypeId',
  isShort: 'short',
  shortLeaveType: 'shortType',
  startTime: 'startTime',
  endTime: 'endTime',
  toDate: 'to',
  reason: 'reason',
  attachments: 'attachment',
}

const TITLES = {
  create: 'Leave Request Create',
  edit: 'Leave Request Edit',
  view: 'Leave Request View',
} as const

/**
 * "Leave Request Create" (frames 4189:59340, 4189:61223, 4191:58946; All:
 * 4194:67969): Employee Name (All only), Leave Type, Short, Available Leaves,
 * Start / End Date, Attachment, Reason and Selected Days. "Short" swaps the
 * dates for Short Leave Type, Request Date with the day's shift, Start Time
 * and End Time (times on that day). Sends `POST /requests/leave`; the API
 * counts the shift days and checks the balance and the leave type's rules.
 */
export function LeaveForm({ mode, scope, request, onClose }: StandardFormProps<LeavePayload>) {
  const formId = useId()
  const lookups = useStandardLookups('leave')
  const create = useCreateStandard('leave')
  const update = useUpdateStandard('leave')
  const readOnly = mode === 'view'
  const pickPerson = scope === 'all' && mode === 'create'
  const permission = typePermission('leave', 'create')
  const payload = request?.payload
  const short0 = payload?.isShort ?? false

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: request?.employee.id ?? null,
      leaveTypeId: payload?.leaveTypeId ?? null,
      short: short0,
      shortType: payload?.shortLeaveType ?? null,
      from: request && !short0 ? (request.fromDate ?? '') : '',
      to: request && !short0 ? (request.toDate ?? '') : '',
      requestDate: short0 ? (request?.fromDate ?? '') : '',
      startTime: hhmm(payload?.startTime),
      endTime: hhmm(payload?.endTime),
      reason: request?.reason ?? '',
    },
  })
  const firstFile = request?.attachments[0]
  const attachmentForm = useForm<{ attachment: FileRef | null }>({
    defaultValues: { attachment: firstFile ? attachmentRef(firstFile) : null },
  })
  const attachment = useWatch({ control: attachmentForm.control, name: 'attachment' })
  const [employeeId, leaveTypeId, short, shortType, from, to, requestDate] = useWatch({
    control: form.control,
    name: ['employeeId', 'leaveTypeId', 'short', 'shortType', 'from', 'to', 'requestDate'],
  })

  // My Requests: the signed-in person (their own board and balances without an id here).
  const mine = !pickPerson && !request
  const personId = request?.employee.id ?? (pickPerson ? employeeId : lookups.data?.me?.id)
  const range = useScheduleDays(
    'leave',
    personId,
    short ? requestDate : from,
    short ? requestDate : to,
    { mine },
  )
  const picked = useRequestPerson(permission, pickPerson ? employeeId : null)
  const person = request?.employee ?? picked ?? range.data?.person
  const strip = range.data?.days
  const shift = short ? strip?.find((item) => item.date === requestDate) : undefined
  const fraction = SHORT_TYPES.find((item) => item.value === shortType)?.fraction ?? 0
  // The API counts shift days, or every day when the person has no schedule in the range.
  const shiftDays = strip?.filter((item) => item.status === 'shift').length ?? 0
  const selectedDays = short
    ? shift?.status === 'shift'
      ? fraction
      : 0
    : shiftDays > 0
      ? shiftDays
      : (strip?.length ?? 0)

  // The person's leave types with balance and rules (`GET /requests/options/leave-types`).
  const typeOptions = useLeaveTypeOptions(personId, mine)
  const leaveType = typeOptions.data?.find((item) => item.id === leaveTypeId)
  // Available Leaves: this request's own pending days are given back while it is edited.
  const ownDays =
    request?.status === 'pending' && payload?.leaveTypeId === leaveTypeId
      ? (request.days ?? payload.days ?? 0)
      : 0
  const available = leaveType ? leaveType.available + ownDays : undefined
  // The type's rules: which parts of a day, how far back or ahead, whether a file is needed.
  const shortTypes = SHORT_TYPES.filter(
    (item) =>
      !leaveType ||
      (item.value === 'half_day' ? leaveType.allowHalfDay : leaveType.allowShortLeave),
  )
  const shortAllowed = !leaveType || shortTypes.length > 0
  const today = startOfToday()
  const minDate =
    leaveType && !leaveType.allowBackDate
      ? today
      : leaveType?.backDateLimitDays
        ? addDays(today, -leaveType.backDateLimitDays)
        : undefined
  const maxDate =
    leaveType && leaveType.futureLimitDays !== null
      ? addDays(today, leaveType.futureLimitDays)
      : undefined
  const attachmentNeeded = Boolean(leaveType?.attachmentRequired)
  const attachmentRefused = attachmentNeeded && leaveType?.attachmentRule !== 'note'

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
    form.setValue('startTime', shift.clockIn)
    form.setValue('endTime', format(until, 'HH:mm'))
  }, [form, readOnly, short, requestDate, shortType, shift?.clockIn, shift?.clockOut, fraction])

  const setError = (field: Field, message: string) => {
    if (field === 'attachment') attachmentForm.setError('attachment', { message })
    else form.setError(field, { message })
  }

  const submit = form.handleSubmit(async (values) => {
    if (pickPerson && !values.employeeId) {
      form.setError('employeeId', { message: 'Choose the employee' })
      return
    }
    if (values.short && leaveType && !shortAllowed) {
      form.setError('shortType', { message: `${leaveType.name} cannot be taken as a short leave` })
      return
    }
    if (values.short && leaveType && !shortTypes.some((item) => item.value === values.shortType)) {
      const label = SHORT_TYPES.find((item) => item.value === values.shortType)?.label ?? 'This'
      form.setError('shortType', { message: `${label} is not allowed for ${leaveType.name}` })
      return
    }
    const first = values.short ? values.requestDate : values.from
    const last = values.short ? values.requestDate : values.to
    if (leaveType && first && minDate && day(first) < minDate) {
      form.setError(values.short ? 'requestDate' : 'from', {
        message: leaveType.allowBackDate
          ? `${leaveType.name} goes back ${String(leaveType.backDateLimitDays)} days at most`
          : `${leaveType.name} cannot start before today`,
      })
      return
    }
    if (leaveType && last && maxDate && day(last) > maxDate) {
      form.setError(values.short ? 'requestDate' : 'to', {
        message: `Choose a day within ${String(leaveType.futureLimitDays)} days from today`,
      })
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
    if (attachmentRefused && !attachment) {
      attachmentForm.setError('attachment', { message: 'Attach the supporting document' })
      return
    }
    const date = values.short ? values.requestDate : values.from
    const body: RequestBody = {
      ...(pickPerson && values.employeeId ? { employeeId: values.employeeId } : {}),
      fromDate: date,
      toDate: values.short ? values.requestDate : values.to,
      reason: values.reason,
      attachments: attachment ? [attachment.id] : [],
      details: {
        leaveTypeId: values.leaveTypeId ?? '',
        isShort: values.short,
        shortLeaveType: values.short ? (values.shortType as ShortLeaveType | null) : null,
        startTime: values.short ? values.startTime : null,
        endTime: values.short ? values.endTime : null,
      } satisfies LeaveDetailsIn,
    }
    try {
      if (mode === 'edit' && request) {
        await update.mutateAsync({
          id: request.id,
          body: { ...body, rowVersion: request.rowVersion },
        })
        await syncAttachments('leave', request.id, request.attachments, [attachment])
      } else await create.mutateAsync(body)
    } catch (failure) {
      if (failure instanceof ApiError) {
        let placed = false
        for (const [field, message] of Object.entries(failure.fieldErrors)) {
          const name =
            field === 'fromDate' ? (values.short ? 'requestDate' : 'from') : FIELDS[field]
          if (name) {
            setError(name, message)
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
            label="Employee Name"
            required
            placeholder="Select Employee Name"
            disabled={!pickPerson}
            enabled={pickPerson}
            permission={permission}
            current={request?.employee}
            onPick={() => {
              form.setValue('leaveTypeId', null)
            }}
          />
        )}
        <SearchSelectField
          control={form.control}
          name="leaveTypeId"
          label="Leave Type"
          required
          placeholder="Select Leave Type"
          disabled={readOnly}
          options={[
            ...(payload && !typeOptions.data?.some((item) => item.id === payload.leaveTypeId)
              ? [{ value: payload.leaveTypeId, label: payload.leaveTypeName ?? '—' }]
              : []),
            ...(typeOptions.data ?? []).map((item) => ({
              value: item.id,
              label: item.name,
              hint: `${days(item.available)} available`,
            })),
          ]}
        />
        <CheckboxField
          control={form.control}
          name="short"
          label="Short"
          disabled={readOnly || (!short && !shortAllowed)}
        />
        {short && (
          <SearchSelectField
            control={form.control}
            name="shortType"
            label="Short Leave Type"
            required
            placeholder="Select Short Leave Type"
            disabled={readOnly}
            options={(readOnly ? SHORT_TYPES : shortTypes).map((item) => ({
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
              minDate={readOnly ? undefined : minDate}
              maxDate={readOnly ? undefined : maxDate}
            />
            {requestDate && person && (
              <ShiftStrip
                label="The day’s shift"
                person={person}
                days={strip}
                loading={range.isPending}
                selected={new Set(shift?.status === 'shift' ? [requestDate] : [])}
              />
            )}
            <TimeField
              control={form.control}
              name="startTime"
              label="Start Time"
              disabled={readOnly}
            />
            <TimeField control={form.control} name="endTime" label="End Time" disabled={readOnly} />
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
              minDate={readOnly ? undefined : minDate}
              maxDate={readOnly ? undefined : maxDate}
            />
            <DateField
              control={form.control}
              name="to"
              label="End Date"
              required
              disabled={readOnly}
              display="MMMM d, yyyy"
              minDate={from ? day(from) : readOnly ? undefined : minDate}
              maxDate={readOnly ? undefined : maxDate}
            />
          </>
        )}
        <RequestFileField
          value={attachment}
          onChange={(file) => {
            attachmentForm.setValue('attachment', file, { shouldDirty: true })
            attachmentForm.clearErrors('attachment')
          }}
          disabled={readOnly}
          required={attachmentRefused}
          description={
            attachmentNeeded && !attachmentRefused && !readOnly
              ? `${leaveType?.name ?? 'This leave'} expects a supporting document`
              : undefined
          }
          error={attachmentForm.formState.errors.attachment?.message}
        />
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
            {days(readOnly && request ? (request.days ?? selectedDays) : selectedDays)}
          </span>
        </div>
      </form>
    </PayrollDialog>
  )
}

/** "Start Time *": a time on the request's day, with the clock drawn on the right. */
function TimeField({
  control,
  name,
  label,
  disabled,
}: {
  control: Control<Values>
  name: 'startTime' | 'endTime'
  label: string
  disabled: boolean
}) {
  const { field, fieldState } = useController({ control, name })
  const error = fieldState.error?.message
  return (
    <FormField label={label} required error={error}>
      {(a11y) => (
        <div className="relative">
          <Input
            {...a11y}
            type="time"
            aria-invalid={Boolean(error)}
            ref={field.ref}
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            disabled={disabled}
            className="pr-11 [color-scheme:light] dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-y-0 [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-11 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
          />
          <Clock
            aria-hidden="true"
            strokeWidth={1.5}
            className="pointer-events-none absolute top-1/2 right-3 size-6 -translate-y-1/2 text-chip"
          />
        </div>
      )}
    </FormField>
  )
}
