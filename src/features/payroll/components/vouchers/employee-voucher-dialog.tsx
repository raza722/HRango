import { type SyntheticEvent, useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { z } from 'zod'

import { FormField, SelectField, TextareaField, TextField } from '@/components/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import type { EmployeeLookupRow } from '@/hooks/use-employee-lookup'
import { ApiError } from '@/lib/api-error'
import type { FileRef } from '@/lib/files'

import { PAYMENT_METHOD_LABELS, VOUCHER_STATUS_LABELS, VOUCHER_TYPE_LABELS } from '../../constants'
import { useDecideVoucher, useSaveVoucher, useVoucher } from '../../hooks/use-payroll'
import { personHint, usePayrollOptions } from '../../hooks/use-payroll-records'
import {
  PAYMENT_METHODS,
  type PaymentMethod,
  VOUCHER_TYPES,
  type VoucherInput,
  type VoucherRow,
  type VoucherType,
} from '../../types/payroll.types'
import { formatStamp } from '../../utils/format'
import { ReadOnlyRow, RsField, SectionTitle } from '../balances/list-parts'
import { DateField } from '../shared/date-input'
import { EmployeeSearchSelectField } from '../shared/employee-search-select'
import { PayrollDialog } from '../shared/payroll-dialog'
import { UploadField } from '../shared/upload-field'

const DATE = 'EEE,d MMM yyyy'

const schema = z.object({
  employeeId: z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message: 'Choose the employee' }),
  voucherType: z.string().min(1, 'Choose the voucher type'),
  voucherNo: z.string().trim().max(30, 'Keep it under 30 characters'),
  voucherDate: z.string().min(1, 'Choose the voucher date'),
  currency: z
    .string()
    .trim()
    .regex(/^([A-Za-z]{3})?$/, 'Use a 3-letter currency code'),
  amount: z
    .string()
    .refine((value) => Number(value.replace(/,/g, '')) > 0, { message: 'Enter the amount' }),
  paymentMethod: z.string().min(1, 'Choose the payment method'),
  purpose: z
    .string()
    .trim()
    .min(1, 'Enter the purpose of the voucher')
    .max(500, 'Keep it under 500 characters'),
  notes: z.string().trim().max(2000, 'Keep it under 2000 characters'),
  requestedById: z.string().nullable(),
})
type Values = z.infer<typeof schema>

const toValues = (row: VoucherRow | undefined): Values => ({
  employeeId: row?.employeeId ?? null,
  voucherType: row && row.voucherType !== 'daily_wage' ? row.voucherType : 'expense_reimbursement',
  voucherNo: row?.voucherNo ?? '',
  voucherDate: row?.voucherDate ?? format(new Date(), 'yyyy-MM-dd'),
  currency: row?.currency ?? 'PKR',
  amount: row ? String(row.amount) : '',
  paymentMethod: row?.paymentMethod ?? 'bank_transfer',
  purpose: row?.purpose ?? '',
  notes: row?.notes ?? '',
  requestedById: row?.requestedById ?? null,
})

const pick = <T extends string>(values: readonly T[], value: string, fallback: T): T =>
  values.find((item) => item === value) ?? fallback

function toInput(values: Values, file: FileRef | null, rowVersion?: string): VoucherInput {
  return {
    employeeId: values.employeeId ?? '',
    voucherNo: values.voucherNo.trim() || null,
    voucherType: pick<VoucherType>(VOUCHER_TYPES, values.voucherType, 'expense_reimbursement'),
    voucherDate: values.voucherDate,
    currency: values.currency.trim().toUpperCase() || null,
    amount: Number(values.amount.replace(/,/g, '')),
    paymentMethod: pick<PaymentMethod>(PAYMENT_METHODS, values.paymentMethod, 'bank_transfer'),
    purpose: values.purpose.trim(),
    notes: values.notes.trim() || null,
    fileId: file?.id ?? null,
    requestedById: values.requestedById,
    ...(rowVersion ? { rowVersion } : {}),
  }
}

const FIELDS = [
  'employeeId',
  'voucherNo',
  'voucherType',
  'voucherDate',
  'amount',
  'purpose',
] as const

/**
 * "Employee Voucher Create" / Edit / View (`POST/PUT/GET /payroll/vouchers`): who, the voucher and
 * its attachment. Approval and Finance verification are actions on the list (the View shows them).
 */
export function EmployeeVoucherDialog({
  id,
  mode,
  onClose,
}: {
  id: string | null
  mode: 'create' | 'edit' | 'view'
  onClose: () => void
}) {
  const voucher = useVoucher(id)
  if (id && !voucher.data) {
    return (
      <PayrollDialog
        title={mode === 'view' ? 'Employee Voucher View' : 'Employee Voucher Edit'}
        onClose={onClose}
        readOnly
      >
        <Skeleton className="h-96 w-full" />
      </PayrollDialog>
    )
  }
  return <VoucherForm row={voucher.data} mode={mode} onClose={onClose} />
}

function VoucherForm({
  row,
  mode,
  onClose,
}: {
  row: VoucherRow | undefined
  mode: 'create' | 'edit' | 'view'
  onClose: () => void
}) {
  const formId = useId()
  const options = usePayrollOptions('payroll.vouchers.view')
  const save = useSaveVoucher()
  const readOnly = mode === 'view'
  const [file, setFile] = useState<FileRef | null>(row?.file ?? null)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(row) })
  const employeeId = useWatch({ control: form.control, name: 'employeeId' })
  // The picked person's lookup row (code, department, designation).
  const [picked, setPicked] = useState<EmployeeLookupRow | undefined>(undefined)
  const chosen = picked?.id === employeeId ? picked : undefined

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: row?.id, input: toInput(values, file, row?.rowVersion) })
      onClose()
    } catch (error) {
      if (!(error instanceof ApiError)) {
        form.setError('root', { message: 'Could not save the voucher.' })
        return
      }
      const field = FIELDS.find((name) => error.fieldErrors[name])
      if (field) form.setError(field, { message: error.fieldErrors[field] })
      else form.setError('root', { message: error.message })
    }
  })

  const readOnlyBox = (label: string, value: string) => (
    <FormField label={label}>
      {(a11y) => <Input {...a11y} readOnly value={value} className="bg-card" />}
    </FormField>
  )

  return (
    <PayrollDialog
      title={
        mode === 'create'
          ? 'Employee Voucher Create'
          : mode === 'edit'
            ? 'Employee Voucher Edit'
            : 'Employee Voucher View'
      }
      onClose={onClose}
      formId={formId}
      readOnly={readOnly}
      pending={save.isPending}
      error={form.formState.errors.root?.message}
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event: SyntheticEvent) => void submit(event)}
        className="grid gap-5"
      >
        <EmployeeSearchSelectField
          control={form.control}
          name="employeeId"
          label="Employee Name"
          placeholder="Select Employee"
          filters={readOnly ? options.employeeFilters : options.activeEmployeeFilters}
          known={
            row
              ? [{ value: row.employeeId, label: row.employeeName, hint: row.employeeCode }]
              : undefined
          }
          hint={personHint}
          onValueChange={(_, person) => {
            setPicked(person)
          }}
          required
          disabled={readOnly || mode === 'edit'}
        />
        {readOnlyBox('Employee ID', chosen?.code ?? row?.employeeCode ?? '')}
        {readOnlyBox('Department', chosen?.departmentName ?? row?.departmentName ?? '')}
        {readOnlyBox(
          'Designation',
          chosen?.designationName ?? chosen?.jobTitleName ?? row?.designationName ?? '',
        )}

        <SectionTitle>Voucher Details</SectionTitle>
        <SelectField
          control={form.control}
          name="voucherType"
          label="Voucher Type"
          required
          disabled={readOnly}
          options={VOUCHER_TYPES.map((type) => ({ value: type, label: VOUCHER_TYPE_LABELS[type] }))}
        />
        <TextField
          control={form.control}
          name="voucherNo"
          label="Voucher No"
          placeholder="Next VCH- number"
          disabled={readOnly}
        />
        <DateField
          control={form.control}
          name="voucherDate"
          label="Voucher Date"
          required
          disabled={readOnly}
          display={DATE}
        />
        <TextField control={form.control} name="currency" label="Currency" disabled={readOnly} />
        <RsField control={form.control} name="amount" label="Amount" required readOnly={readOnly} />
        <SelectField
          control={form.control}
          name="paymentMethod"
          label="Payment Method"
          required
          disabled={readOnly}
          options={PAYMENT_METHODS.map((method) => ({
            value: method,
            label: PAYMENT_METHOD_LABELS[method],
          }))}
        />
        <TextareaField
          control={form.control}
          name="purpose"
          label="Purpose Of Voucher"
          required
          disabled={readOnly}
          textareaClassName="min-h-20"
        />
        <TextareaField
          control={form.control}
          name="notes"
          label="Comments/ Additional Notes"
          disabled={readOnly}
          textareaClassName="min-h-24"
        />
        <UploadField value={file} disabled={readOnly} onChange={setFile} />
        <EmployeeSearchSelectField
          control={form.control}
          name="requestedById"
          label="Requested By (Employee)"
          placeholder="Employee"
          filters={options.activeEmployeeFilters}
          known={
            row?.requestedById && row.requestedByName
              ? [{ value: row.requestedById, label: row.requestedByName }]
              : undefined
          }
          hint={personHint}
          clearable
          disabled={readOnly}
        />

        {row && (
          <>
            <SectionTitle>Approval Web Flow</SectionTitle>
            <ReadOnlyRow label="Voucher Status" value={VOUCHER_STATUS_LABELS[row.status]} />
            <ReadOnlyRow label="Approved By" value={row.approvedByName ?? '—'} />
            <ReadOnlyRow
              label="Approval Date"
              value={row.approvedAt ? formatStamp(row.approvedAt) : '—'}
            />
            <SectionTitle>Verification</SectionTitle>
            <ReadOnlyRow label="Verified By" value={row.verifiedByName ?? '—'} />
            <ReadOnlyRow
              label="Verification Date"
              value={row.verifiedAt ? formatStamp(row.verifiedAt) : '—'}
            />
            <ReadOnlyRow label="Remarks" value={row.remarks ?? '—'} />
          </>
        )}
      </form>
    </PayrollDialog>
  )
}

const DECISION_TITLES = {
  approve: 'Approve Voucher',
  reject: 'Reject Voucher',
  verify: 'Verify Voucher',
} as const

/** Approve / Reject (manager) or Verify for payment (Finance), with optional remarks. */
export function VoucherDecisionDialog({
  row,
  action,
  onClose,
}: {
  row: VoucherRow
  action: 'approve' | 'reject' | 'verify'
  onClose: () => void
}) {
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState<string | null>(null)
  const decide = useDecideVoucher()
  return (
    <PayrollDialog
      title={DECISION_TITLES[action]}
      onClose={onClose}
      saveLabel={action === 'approve' ? 'Approve' : action === 'reject' ? 'Reject' : 'Verify'}
      pending={decide.isPending}
      error={error}
      className="max-w-2xl"
      onSave={() => {
        setError(null)
        decide.mutate(
          {
            id: row.id,
            action,
            input: { remarks: remarks.trim() || null, rowVersion: row.rowVersion },
          },
          {
            onSuccess: onClose,
            onError: (reason) => {
              setError(reason instanceof ApiError ? reason.message : 'That could not be done.')
            },
          },
        )
      }}
    >
      <div className="grid gap-4">
        <ReadOnlyRow label="Voucher" value={`${row.voucherNo} · ${row.employeeName}`} />
        <ReadOnlyRow label="Type" value={VOUCHER_TYPE_LABELS[row.voucherType]} />
        <FormField label="Remarks">
          {(a11y) => (
            <Textarea
              {...a11y}
              value={remarks}
              maxLength={2000}
              onChange={(event) => {
                setRemarks(event.target.value)
              }}
              className="min-h-24"
            />
          )}
        </FormField>
      </div>
    </PayrollDialog>
  )
}
