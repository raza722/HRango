import { useId, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { addDays, differenceInCalendarDays, parse, startOfToday } from 'date-fns'
import { Paperclip } from 'lucide-react'
import { z } from 'zod'

import { CheckboxField, FormField, SelectField, TextareaField, TextField } from '@/components/form'
import { Input } from '@/components/ui/input'
import {
  DateField,
  EmployeeSearchSelectField,
  PayrollDialog,
  SearchSelectField,
  TwoWaySwitchField,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { ACCEPTED_FILE_TYPES, deleteUpload, uploadFile } from '@/lib/files'

import { CATEGORY_LABELS, LEAVE_CODES, SHORT_LEAVE_LABELS } from '../../constants'
import { useApplyLeave, useLeaveTypeOptions } from '../../hooks/use-leaves'
import { type LeaveRequestInput, SHORT_LEAVE_TYPES } from '../../types/leaves.types'
import { balanceDays } from '../../utils/format'

const chosen = (message: string) =>
  z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message })

const schema = z
  .object({
    forOthers: z.boolean(),
    employeeId: z.string().nullable(),
    category: z.enum(['single', 'multiple']),
    leaveTypeId: chosen('Choose the leave type'),
    from: z.string(),
    to: z.string(),
    isShort: z.boolean(),
    shortLeaveType: z.enum(SHORT_LEAVE_TYPES),
    startTime: z.string(),
    endTime: z.string(),
    reason: z.string().trim().min(1, 'Give the reason').max(4000, 'Keep it under 4000 characters'),
  })
  .superRefine((values, context) => {
    const need = (path: keyof typeof values, message: string) => {
      context.addIssue({ code: 'custom', path: [path], message })
    }
    if (values.forOthers && !values.employeeId) need('employeeId', 'Choose the employee')
    if (values.category === 'single') {
      if (!values.from) need('from', 'Choose the leave date')
      if (values.isShort) {
        if (!values.startTime) need('startTime', 'Enter the start time')
        if (!values.endTime) need('endTime', 'Enter the end time')
        else if (values.startTime && values.endTime <= values.startTime) {
          need('endTime', 'End after the start time')
        }
      }
      return
    }
    if (!values.from) need('from', 'Choose the start date')
    if (!values.to) need('to', 'Choose the end date')
    else if (values.from && values.to < values.from) {
      need('to', 'Choose the Start Date or a later day')
    }
  })
type Values = z.infer<typeof schema>

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())

/** The server's field names → this form's. */
const FIELD_OF: Record<string, keyof Values> = {
  employeeId: 'employeeId',
  leaveTypeId: 'leaveTypeId',
  fromDate: 'from',
  toDate: 'to',
  reason: 'reason',
  isShort: 'isShort',
  shortLeaveType: 'shortLeaveType',
  startTime: 'startTime',
  endTime: 'endTime',
}

/**
 * Attachment: uploads the file at once (`POST /files`, module `requests`) and keeps its id;
 * Remove deletes the upload again.
 */
function AttachmentUpload({
  label,
  value,
  onChange,
  error,
}: {
  label: string
  value: { id: string; name: string } | null
  onChange: (file: { id: string; name: string } | null) => void
  error: string | undefined
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  return (
    <FormField label={label} error={error ?? failure ?? undefined}>
      {(a11y) => (
        <div className="flex h-10 overflow-hidden rounded-md bg-[#D9D9D9]/70 dark:bg-muted">
          <span
            id={a11y.id}
            className="flex min-w-0 flex-1 items-center truncate px-4 font-inter text-sm text-field-value"
          >
            {busy ? 'Uploading…' : (value?.name ?? '')}
          </span>
          {value && !busy && (
            <button
              type="button"
              onClick={() => {
                void deleteUpload(value.id).catch(() => undefined)
                onChange(null)
              }}
              className="px-2 text-xs text-muted-foreground hover:text-destructive"
            >
              Remove
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            aria-label={value ? `Attach another file (now ${value.name})` : 'Attach a file'}
            onClick={() => input.current?.click()}
            className="flex shrink-0 items-center gap-2 bg-[#707070] px-4 font-inter text-sm font-normal text-white outline-none hover:bg-[#5c5c5c] focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-60"
          >
            <Paperclip aria-hidden="true" className="size-4" />
            Attach
          </button>
          <input
            ref={input}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              setBusy(true)
              setFailure(null)
              uploadFile(file, 'requests')
                .then((uploaded) => {
                  onChange({ id: uploaded.id, name: uploaded.name })
                })
                .catch((reason: unknown) => {
                  setFailure(
                    reason instanceof Error ? reason.message : 'The file was not uploaded.',
                  )
                })
                .finally(() => {
                  setBusy(false)
                })
            }}
          />
        </div>
      )}
    </FormField>
  )
}

/**
 * "+ Apply Leave" (the Leaves notes; no frame export): `POST /requests/leave`. Category
 * Single or Multiple, Leave Type with the person's available balance of each type, the
 * date (or Start / End Date), a short leave (half or quarter day with its times) on a single
 * day, Attachment and Reason. From Leave Applications it first asks for the employee. The
 * days, the type's rules and the balance are worked out on the server, which answers with
 * the field to fix.
 */
export function ApplyLeaveDialog({
  forOthers = false,
  onClose,
}: {
  /** Leave Applications: apply on someone's behalf (an Employee picker). */
  forOthers?: boolean
  onClose: () => void
}) {
  const formId = useId()
  const apply = useApplyLeave()
  const [attachment, setAttachment] = useState<{ id: string; name: string } | null>(null)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      forOthers,
      employeeId: null,
      category: 'single',
      leaveTypeId: null,
      from: '',
      to: '',
      isShort: false,
      shortLeaveType: 'half_day',
      startTime: '',
      endTime: '',
      reason: '',
    },
  })
  const [employeeId, category, leaveTypeId, from, to, isShort, shortLeaveType] = useWatch({
    control: form.control,
    name: ['employeeId', 'category', 'leaveTypeId', 'from', 'to', 'isShort', 'shortLeaveType'],
  })

  // The leave types the person may apply for, with balance and rules
  // (`GET /requests/options/leave-types`): the chosen person, or yourself.
  const owner = forOthers ? (employeeId ?? undefined) : undefined
  const options = useLeaveTypeOptions(owner, from || undefined, !forOthers || Boolean(employeeId))
  const offers = options.data ?? []
  const offer = offers.find((item) => item.id === leaveTypeId)
  const shortTypes = SHORT_LEAVE_TYPES.filter(
    (value) => !offer || (value === 'half_day' ? offer.allowHalfDay : offer.allowShortLeave),
  )
  const shortAllowed = shortTypes.length > 0
  const attachmentRequired = offer?.attachmentRequired === true && offer.attachmentRule !== 'note'
  // How far back or ahead the type lets the dates go.
  const today = startOfToday()
  const minDate =
    offer && !offer.allowBackDate
      ? today
      : offer?.backDateLimitDays
        ? addDays(today, -offer.backDateLimitDays)
        : undefined
  const maxDate =
    offer && offer.futureLimitDays !== null ? addDays(today, offer.futureLimitDays) : undefined
  const last = category === 'single' ? from : to
  const calendarDays =
    from && last && last >= from
      ? category === 'single' && isShort
        ? shortLeaveType === 'quarter_day'
          ? 0.25
          : 0.5
        : differenceInCalendarDays(day(last), day(from)) + 1
      : 0
  const available = offer ? (offer.isDeductible ? balanceDays(offer.available) : 'No limit') : ''

  const submit = form.handleSubmit(async (values) => {
    if (attachmentRequired && !attachment) {
      form.setError('root', {
        message: `${offer.name} needs an attachment.`,
      })
      return
    }
    const short = values.category === 'single' && values.isShort && shortAllowed
    if (short && !shortTypes.includes(values.shortLeaveType)) {
      form.setError('shortLeaveType', {
        message: `${SHORT_LEAVE_LABELS[values.shortLeaveType]} is not allowed for ${offer?.name ?? 'this leave'}`,
      })
      return
    }
    const lastDay = values.category === 'single' ? values.from : values.to
    if (offer && minDate && values.from && day(values.from) < minDate) {
      form.setError('from', {
        message: offer.allowBackDate
          ? `${offer.name} goes back ${String(offer.backDateLimitDays)} days at most`
          : `${offer.name} cannot start before today`,
      })
      return
    }
    if (offer && maxDate && lastDay && day(lastDay) > maxDate) {
      form.setError(values.category === 'single' ? 'from' : 'to', {
        message: `Choose a day within ${String(offer.futureLimitDays)} days from today`,
      })
      return
    }
    const input: LeaveRequestInput = {
      ...(values.forOthers ? { employeeId: values.employeeId } : {}),
      fromDate: values.from,
      toDate: values.category === 'single' ? values.from : values.to,
      reason: values.reason,
      attachments: attachment ? [attachment.id] : [],
      details: {
        leaveTypeId: values.leaveTypeId ?? '',
        isShort: short,
        shortLeaveType: short ? values.shortLeaveType : null,
        startTime: short ? values.startTime : null,
        endTime: short ? values.endTime : null,
      },
    }
    try {
      await apply.mutateAsync(input)
    } catch (failure) {
      if (failure instanceof ApiError) {
        let placed = false
        for (const [field, message] of Object.entries(failure.fieldErrors)) {
          const target = FIELD_OF[field]
          if (target && (target !== 'to' || values.category === 'multiple')) {
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
      title="Apply Leave"
      onClose={onClose}
      formId={formId}
      saveLabel="Apply"
      pending={apply.isPending}
      error={form.formState.errors.root?.message}
      className="max-w-3xl"
    >
      <form id={formId} noValidate onSubmit={(event) => void submit(event)} className="grid gap-5">
        {forOthers && (
          <EmployeeSearchSelectField
            control={form.control}
            name="employeeId"
            label="Employee"
            required
            placeholder="Select Employee"
            filters={{ permission: LEAVE_CODES.apply }}
            include={(person) => person.status === 'active'}
            hint={(person) => [person.code, person.departmentName].filter(Boolean).join(' · ')}
            onValueChange={() => {
              form.setValue('leaveTypeId', null)
            }}
          />
        )}
        <TwoWaySwitchField
          control={form.control}
          name="category"
          label="Category"
          ariaLabel="Category"
          options={[
            { value: 'single', label: CATEGORY_LABELS.single },
            { value: 'multiple', label: CATEGORY_LABELS.multiple },
          ]}
          onValueChange={(value: 'single' | 'multiple') => {
            if (value === 'single') form.setValue('to', '')
            else form.setValue('isShort', false)
          }}
        />
        <SearchSelectField
          control={form.control}
          name="leaveTypeId"
          label="Leave Type"
          required
          placeholder="Select Leave Type"
          options={offers.map((item) => ({
            value: item.id,
            label: item.code ? `${item.name} (${item.code})` : item.name,
            hint: item.isDeductible
              ? `Available ${balanceDays(item.available)} of ${balanceDays(item.entitled)}`
              : 'No balance limit',
          }))}
        />
        <FormField label="Available Balance">
          {(a11y) => (
            <Input
              {...a11y}
              readOnly
              value={available}
              placeholder={leaveTypeId ? '' : 'Choose the leave type'}
            />
          )}
        </FormField>
        {options.isSuccess && offers.length === 0 && (
          <p
            role="alert"
            className="rounded-md bg-[#FFF3D9] px-4 py-3 font-inter text-sm text-[#8A5A00] dark:bg-amber-500/15 dark:text-amber-200"
          >
            No leave type to apply for yet: HR sets them in the leave policies (Settings → Leave
            Policies) and allots the balance (Leave Types → Allotment).
          </p>
        )}
        {category === 'single' ? (
          <>
            <DateField
              control={form.control}
              name="from"
              label="Leave Date"
              required
              display="MMMM d, yyyy"
              minDate={minDate}
              maxDate={maxDate}
            />
            {shortAllowed && (
              <CheckboxField
                control={form.control}
                name="isShort"
                label="Short Leave (part of the day)"
                tone="navy"
              />
            )}
            {isShort && shortAllowed && (
              <>
                <SelectField
                  control={form.control}
                  name="shortLeaveType"
                  label="Short Leave Type"
                  required
                  options={shortTypes.map((value) => ({
                    value,
                    label: SHORT_LEAVE_LABELS[value],
                  }))}
                />
                <TextField
                  control={form.control}
                  name="startTime"
                  label="Start Time"
                  required
                  type="time"
                />
                <TextField
                  control={form.control}
                  name="endTime"
                  label="End Time"
                  required
                  type="time"
                />
              </>
            )}
          </>
        ) : (
          <>
            <DateField
              control={form.control}
              name="from"
              label="Start Date"
              required
              display="MMMM d, yyyy"
              minDate={minDate}
              maxDate={maxDate}
            />
            <DateField
              control={form.control}
              name="to"
              label="End Date"
              required
              display="MMMM d, yyyy"
              minDate={from ? day(from) : minDate}
              maxDate={maxDate}
            />
          </>
        )}
        <div className="grid gap-2 @xl:grid-cols-[10rem_minmax(0,1fr)] @xl:items-center @3xl:grid-cols-[11rem_minmax(0,1fr)]">
          <span className="font-inter text-base text-heading">Selected Days</span>
          <span className="flex flex-wrap items-center gap-3">
            <span
              aria-live="polite"
              className="w-fit min-w-8 rounded-[5px] bg-[#FFE3E3] px-1.5 py-1 text-center font-inter text-sm font-semibold text-[#333C48] dark:bg-red-500/15 dark:text-heading"
            >
              {String(calendarDays)}
            </span>
            <span className="text-xs text-muted-foreground">
              Calendar days; the server counts the days that apply.
            </span>
          </span>
        </div>
        <AttachmentUpload
          label={attachmentRequired ? 'Attachment *' : 'Attachment'}
          value={attachment}
          onChange={setAttachment}
          error={undefined}
        />
        {offer?.attachmentRequired && offer.attachmentRule === 'note' && !attachment && (
          <p className="-mt-3 text-xs text-muted-foreground">
            {offer.name} asks for a supporting document; without one the application is noted for
            HR.
          </p>
        )}
        <TextareaField
          control={form.control}
          name="reason"
          label="Reason"
          required
          rows={4}
          maxLength={4000}
        />
      </form>
    </PayrollDialog>
  )
}
