import { useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { parse } from 'date-fns'
import { z } from 'zod'

import { FormField, TextareaField } from '@/components/form'
import { Input } from '@/components/ui/input'
import {
  AttachmentField,
  DateField,
  PayrollDialog,
  SearchSelectField,
  TwoWaySwitchField,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { apiClient } from '@/lib/axios'

import { CATEGORY_LABELS } from '../../constants'
import { useApplyLeave, useLeavesLookups } from '../../hooks/use-leaves'
import {
  LEAVE_CATEGORIES,
  type LeaveApplyInput,
  type LeaveCategory,
} from '../../types/leaves.types'
import { balanceDays } from '../../utils/format'

const chosen = (message: string) =>
  z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message })

const schema = z
  .object({
    category: z.enum(LEAVE_CATEGORIES),
    leaveTypeId: chosen('Choose the leave type'),
    from: z.string(),
    to: z.string(),
    attachment: z.string().nullable(),
    reason: z.string().trim().min(1, 'Give the reason').max(500, 'Keep it under 500 characters'),
  })
  .superRefine((values, context) => {
    const need = (path: keyof typeof values, message: string) => {
      context.addIssue({ code: 'custom', path: [path], message })
    }
    if (values.category === 'single') {
      if (!values.from) need('from', 'Choose the leave date')
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

interface ScheduleDay {
  date: string
  status: 'shift' | 'rest' | 'off'
}

/** The person's days between two dates, from the Leave request's schedule endpoint. */
function useShiftDays(employeeId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ['leaves', 'schedule', employeeId, from, to],
    enabled: Boolean(employeeId && from && to && to >= from),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<{ data: ScheduleDay[] }>('/requests/leave/schedule', {
        params: { employeeId, from, to },
        signal,
      })
      return data.data
    },
  })
}

/**
 * "+ Apply Leave" (the Leaves notes; no frame export): Category Single or
 * Multiple, Leave Type with the available balance of each type, the date (or
 * Start / End Date), Attachment and Reason. Only shift days count; the
 * type's rules and the balance are checked again on the server.
 */
export function ApplyLeaveDialog({ onClose }: { onClose: () => void }) {
  const formId = useId()
  const lookups = useLeavesLookups()
  const apply = useApplyLeave()
  const offered = lookups.data?.offered ?? []
  const coverage = lookups.data?.coverage

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: 'single',
      leaveTypeId: null,
      from: '',
      to: '',
      attachment: null,
      reason: '',
    },
  })
  const [category, leaveTypeId, from, to, attachment] = useWatch({
    control: form.control,
    name: ['category', 'leaveTypeId', 'from', 'to', 'attachment'],
  })
  const offer = offered.find((item) => item.id === leaveTypeId)
  const last = category === 'single' ? from : to
  const range = useShiftDays(lookups.data?.me.id, from, last)
  const selectedDays = range.data?.filter((item) => item.status === 'shift').length ?? 0
  const available = offer
    ? offer.deductible
      ? balanceDays(offer.balance.available)
      : 'No limit'
    : ''

  const submit = form.handleSubmit(async (values) => {
    if (offer?.attachmentRequired && offer.attachmentRule === 'refuse' && !values.attachment) {
      form.setError('attachment', { message: 'Attach the supporting document' })
      return
    }
    if (range.data && selectedDays === 0) {
      form.setError('from', { message: 'Choose dates with working days' })
      return
    }
    if (offer?.deductible && selectedDays > offer.balance.available) {
      form.setError(values.category === 'single' ? 'from' : 'to', {
        message: `Only ${balanceDays(offer.balance.available)} available`,
      })
      return
    }
    const input: LeaveApplyInput = {
      category: values.category,
      leaveTypeId: values.leaveTypeId ?? '',
      from: values.from,
      to: values.category === 'single' ? values.from : values.to,
      reason: values.reason,
      attachment: values.attachment,
    }
    try {
      await apply.mutateAsync(input)
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
      title="Apply Leave"
      onClose={onClose}
      formId={formId}
      saveLabel="Apply"
      pending={apply.isPending}
      error={form.formState.errors.root?.message}
      className="max-w-3xl"
    >
      <form id={formId} noValidate onSubmit={(event) => void submit(event)} className="grid gap-5">
        <TwoWaySwitchField
          control={form.control}
          name="category"
          label="Category"
          ariaLabel="Category"
          options={[
            { value: 'single', label: CATEGORY_LABELS.single },
            { value: 'multiple', label: CATEGORY_LABELS.multiple },
          ]}
          onValueChange={(value: LeaveCategory) => {
            if (value === 'single') form.setValue('to', '')
          }}
        />
        <SearchSelectField
          control={form.control}
          name="leaveTypeId"
          label="Leave Type"
          required
          placeholder="Select Leave Type"
          options={offered.map((item) => ({
            value: item.id,
            label: `${item.title} (${item.shortCode})`,
            hint: item.deductible
              ? `Available ${balanceDays(item.balance.available)} of ${balanceDays(item.balance.total)}`
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
        {coverage && !coverage.distribution && (
          <p
            role="alert"
            className="rounded-md bg-[#FFF3D9] px-4 py-3 font-inter text-sm text-[#8A5A00] dark:bg-amber-500/15 dark:text-amber-200"
          >
            No leave distribution policy covers you yet; ask HR to enroll you in one (Settings →
            Leave Policies).
          </p>
        )}
        {coverage?.distribution && (
          <p className="-mt-2 font-inter text-xs text-muted-foreground">
            Your leave policy {coverage.halfDay ? 'allows' : 'does not allow'} half day leave and{' '}
            {coverage.shortLeave ? 'allows' : 'does not allow'} short leave.
          </p>
        )}
        {category === 'single' ? (
          <DateField
            control={form.control}
            name="from"
            label="Leave Date"
            required
            display="MMMM d, yyyy"
          />
        ) : (
          <>
            <DateField
              control={form.control}
              name="from"
              label="Start Date"
              required
              display="MMMM d, yyyy"
            />
            <DateField
              control={form.control}
              name="to"
              label="End Date"
              required
              display="MMMM d, yyyy"
              minDate={from ? day(from) : undefined}
            />
          </>
        )}
        <div className="grid gap-2 @xl:grid-cols-[10rem_minmax(0,1fr)] @xl:items-center @3xl:grid-cols-[11rem_minmax(0,1fr)]">
          <span className="font-inter text-base text-heading">Selected Days</span>
          <span
            aria-live="polite"
            className="w-fit min-w-8 rounded-[5px] bg-[#FFE3E3] px-1.5 py-1 text-center font-inter text-sm font-semibold text-[#333C48] dark:bg-red-500/15 dark:text-heading"
          >
            {range.isPending && from ? '…' : String(selectedDays)}
          </span>
        </div>
        <AttachmentField
          label={
            offer?.attachmentRequired && offer.attachmentRule === 'refuse'
              ? 'Attachment *'
              : 'Attachment'
          }
          value={attachment}
          onChange={(name) => {
            form.setValue('attachment', name, { shouldDirty: true })
            form.clearErrors('attachment')
          }}
        />
        {form.formState.errors.attachment && (
          <p role="alert" className="-mt-3 text-xs text-destructive">
            {form.formState.errors.attachment.message}
          </p>
        )}
        {offer?.attachmentRequired && offer.attachmentRule === 'note' && !attachment && (
          <p className="-mt-3 text-xs text-muted-foreground">
            {offer.title} asks for a supporting document; without one the application is noted for
            HR.
          </p>
        )}
        <TextareaField
          control={form.control}
          name="reason"
          label="Reason"
          required
          rows={4}
          maxLength={500}
        />
      </form>
    </PayrollDialog>
  )
}
