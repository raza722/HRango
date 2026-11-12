import { useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { z } from 'zod'

import { DatePickerField, SelectField, TextareaField, TextField } from '@/components/form'
import { PayrollDialog, SearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'

import { useAddLedgerEntry, useAllLeaveTypes } from '../../hooks/use-leaves'
import type { LedgerInputReason } from '../../types/leaves.types'

const KINDS: Record<LedgerInputReason, string> = {
  adjustment: 'Adjustment (add or take away days)',
  opening: 'Opening balance (days brought from before)',
}

const schema = z
  .object({
    reason: z.enum(['adjustment', 'opening']),
    leaveTypeId: z.string().nullable(),
    days: z.string().trim(),
    entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date'),
    remarks: z.string().trim().max(2000, 'Keep it under 2000 characters'),
  })
  .superRefine((values, ctx) => {
    if (!values.leaveTypeId) {
      ctx.addIssue({ code: 'custom', path: ['leaveTypeId'], message: 'Choose a leave type' })
    }
    const days = Number(values.days)
    if (values.days === '' || !Number.isFinite(days) || !/^-?\d+(\.\d{1,2})?$/.test(values.days)) {
      ctx.addIssue({
        code: 'custom',
        path: ['days'],
        message: 'Enter a number of days, e.g. 2 or 1.5',
      })
    } else if (days === 0) {
      ctx.addIssue({ code: 'custom', path: ['days'], message: 'Days cannot be zero' })
    } else if (Math.abs(days) > 366) {
      ctx.addIssue({ code: 'custom', path: ['days'], message: 'At most 366 days' })
    } else if (values.reason === 'opening' && days < 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['days'],
        message: 'An opening balance cannot be negative',
      })
    }
    if (values.reason === 'adjustment' && values.remarks === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['remarks'],
        message: 'Say why the balance is adjusted',
      })
    }
  })
type Values = z.infer<typeof schema>

type FieldName = keyof Values
const FIELD_NAMES: readonly string[] = ['reason', 'leaveTypeId', 'days', 'entryDate', 'remarks']
/** The server names its fields as the form does (`fieldErrors.days`, `fieldErrors.remarks`…). */
const isField = (key: string): key is FieldName => FIELD_NAMES.includes(key)

/**
 * Adjust Balance (no frame; `POST /leaves/ledger`): gives one employee days of a leave type by
 * hand, or takes them away, outside the yearly allotment: an opening balance (days they
 * brought from before this system, once per type and year) or an adjustment (+ adds, − takes
 * away; the reason is required). The date decides which leave year the days count in. The
 * employee is told in their inbox.
 */
export function AdjustBalanceDialog({
  employee,
  onClose,
}: {
  employee: { id: string; name: string }
  onClose: () => void
}) {
  const formId = useId()
  const types = useAllLeaveTypes()
  const add = useAddLedgerEntry()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      reason: 'adjustment',
      leaveTypeId: null,
      days: '',
      entryDate: format(new Date(), 'yyyy-MM-dd'),
      remarks: '',
    },
  })
  const reason = useWatch({ control: form.control, name: 'reason' })

  const submit = form.handleSubmit(async (values) => {
    try {
      await add.mutateAsync({
        employeeId: employee.id,
        leaveTypeId: values.leaveTypeId ?? '',
        entryDate: values.entryDate,
        days: Number(values.days),
        reason: values.reason,
        remarks: values.remarks === '' ? null : values.remarks,
      })
    } catch (failure) {
      if (failure instanceof ApiError) {
        let placed = false
        for (const [key, message] of Object.entries(failure.fieldErrors)) {
          if (isField(key)) {
            form.setError(key, { message })
            placed = true
          }
        }
        if (!placed) form.setError('root', { message: failure.message })
      } else {
        form.setError('root', { message: 'The balance could not be saved. Try again.' })
      }
      return
    }
    onClose()
  })

  return (
    <PayrollDialog
      title={`Adjust Balance · ${employee.name}`}
      onClose={onClose}
      formId={formId}
      saveLabel="Save"
      pending={add.isPending}
      error={form.formState.errors.root?.message}
      className="max-w-2xl"
    >
      <form id={formId} noValidate onSubmit={(event) => void submit(event)} className="grid gap-5">
        <SelectField
          control={form.control}
          name="reason"
          label="Entry"
          required
          options={(Object.keys(KINDS) as LedgerInputReason[]).map((value) => ({
            value,
            label: KINDS[value],
          }))}
        />
        <SearchSelectField
          control={form.control}
          name="leaveTypeId"
          label="Leave Type"
          required
          placeholder="Select Leave Type"
          options={(types.data?.data ?? []).map((type) => ({
            value: type.id,
            label: type.title,
            hint: type.shortCode,
          }))}
        />
        <TextField
          control={form.control}
          name="days"
          label="Days"
          required
          inputMode="decimal"
          maxLength={7}
          placeholder={reason === 'opening' ? 'e.g. 5' : 'e.g. 2 or -1.5'}
          description={
            reason === 'opening'
              ? 'Days they had before, added to this leave year. Once per leave type and year.'
              : 'A plus number adds days; a minus number (e.g. -2) takes them away.'
          }
        />
        <DatePickerField
          control={form.control}
          name="entryDate"
          label="Date"
          required
          description="The leave year that contains this date gets the days."
        />
        <TextareaField
          control={form.control}
          name="remarks"
          label="Reason"
          required={reason === 'adjustment'}
          maxLength={2000}
          placeholder={
            reason === 'adjustment' ? 'Why the balance changes' : 'Optional note for the employee'
          }
        />
      </form>
    </PayrollDialog>
  )
}
