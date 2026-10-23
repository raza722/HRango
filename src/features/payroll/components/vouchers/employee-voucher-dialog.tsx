import { type SyntheticEvent, useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { z } from 'zod'

import { FormField, SelectField, TextareaField, TextField } from '@/components/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api-error'

import { PAYMENT_METHOD_LABELS, VOUCHER_STATUS_LABELS, VOUCHER_TYPE_LABELS } from '../../constants'
import { useEmployeeVoucher, useSaveEmployeeVoucher } from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import {
  type EmployeeVoucherInput,
  type EmployeeVoucherRow,
  PAYMENT_METHODS,
  type PaymentMethod,
  VOUCHER_STATUSES,
  VOUCHER_TYPES,
  type VoucherStatus,
  type VoucherType,
} from '../../types/payroll.types'
import { RsField, SectionTitle } from '../balances/list-parts'
import { AttachmentField } from '../shared/attachment-field'
import { DateField } from '../shared/date-input'
import { PayrollDialog } from '../shared/payroll-dialog'
import { SearchSelectField } from '../shared/search-select'

const DATE = 'EEE,d MMM yyyy'

const person = (message: string) =>
  z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message })

const schema = z.object({
  employeeId: person('Choose the employee'),
  voucherType: z.string().min(1, 'Choose the voucher type'),
  voucherNo: z
    .string()
    .trim()
    .min(1, 'Enter the voucher number')
    .max(40, 'Keep it under 40 characters'),
  voucherDate: z.string().min(1, 'Choose the voucher date'),
  amount: z
    .string()
    .refine((value) => Number(value.replace(/,/g, '')) > 0, { message: 'Enter the amount' }),
  paymentMethod: z.string().min(1, 'Choose the payment method'),
  purpose: z.string().trim().max(500, 'Keep it under 500 characters'),
  comments: z.string().trim().max(1000, 'Keep it under 1000 characters'),
  attachmentName: z.string().nullable(),
  requestedById: person('Choose who requested it'),
  approvedById: person('Choose who approved it'),
  approvalDate: z.string().min(1, 'Choose the approval date'),
  verifiedBy: z.string().trim().min(1, 'Enter who verified it').max(80),
  verificationDate: z.string(),
  status: z.string().min(1, 'Choose the status'),
})
type Values = z.infer<typeof schema>

const toValues = (row: EmployeeVoucherRow | undefined): Values => ({
  employeeId: row?.employeeId ?? null,
  voucherType: row?.voucherType ?? 'expense-reimbursement',
  voucherNo: row?.voucherNo ?? '',
  voucherDate: row?.voucherDate ?? format(new Date(), 'yyyy-MM-dd'),
  amount: row ? String(row.amount) : '',
  paymentMethod: row?.paymentMethod ?? 'bank-transfer',
  purpose: row?.purpose ?? '',
  comments: row?.comments ?? '',
  attachmentName: row?.attachmentName ?? null,
  requestedById: row?.requestedById ?? null,
  approvedById: row?.approvedById ?? null,
  approvalDate: row?.approvalDate ?? '',
  verifiedBy: row?.verifiedBy ?? '',
  verificationDate: row?.verificationDate ?? '',
  status: row?.status ?? 'pending',
})

const pick = <T extends string>(values: readonly T[], value: string, fallback: T): T =>
  values.find((item) => item === value) ?? fallback

function toInput(values: Values): EmployeeVoucherInput {
  return {
    employeeId: values.employeeId ?? '',
    voucherType: pick<VoucherType>(VOUCHER_TYPES, values.voucherType, 'expense-reimbursement'),
    voucherNo: values.voucherNo.trim(),
    voucherDate: values.voucherDate,
    amount: Number(values.amount.replace(/,/g, '')),
    paymentMethod: pick<PaymentMethod>(PAYMENT_METHODS, values.paymentMethod, 'bank-transfer'),
    purpose: values.purpose.trim(),
    comments: values.comments.trim(),
    attachmentName: values.attachmentName,
    requestedById: values.requestedById ?? '',
    approvedById: values.approvedById,
    approvalDate: values.approvalDate || null,
    verifiedBy: values.verifiedBy.trim(),
    verificationDate: values.verificationDate || null,
    status: pick<VoucherStatus>(VOUCHER_STATUSES, values.status, 'pending'),
  }
}

/** "Employee Voucher Create" / Edit / View: who, the voucher, the approval and the verification. */
export function EmployeeVoucherDialog({
  id,
  mode,
  onClose,
}: {
  id: string | null
  mode: 'create' | 'edit' | 'view'
  onClose: () => void
}) {
  const voucher = useEmployeeVoucher(id)
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
  row: EmployeeVoucherRow | undefined
  mode: 'create' | 'edit' | 'view'
  onClose: () => void
}) {
  const formId = useId()
  const options = usePayrollOptions()
  const save = useSaveEmployeeVoucher()
  const readOnly = mode === 'view'
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(row) })
  const employeeId = useWatch({ control: form.control, name: 'employeeId' })
  const attachment = useWatch({ control: form.control, name: 'attachmentName' })
  const chosen = options.lookups?.employees.find((item) => item.id === employeeId)

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: row?.id, input: toInput(values) })
      onClose()
    } catch (error) {
      if (error instanceof ApiError) {
        const field = Object.keys(error.fieldErrors)[0]
        if (field === 'voucherNo') form.setError('voucherNo', { message: error.fieldErrors[field] })
        else form.setError('root', { message: error.message })
      }
    }
  })

  const readOnlyBox = (label: string, value: string) => (
    <FormField label={label} required>
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
        <SearchSelectField
          control={form.control}
          name="employeeId"
          label="Employee Name"
          placeholder="Select Employee"
          options={options.activeEmployees}
          required
          disabled={readOnly}
        />
        {readOnlyBox('Employee ID', chosen?.code ?? '')}
        {readOnlyBox('Department', chosen?.department ?? '')}
        {readOnlyBox('Designation', chosen?.designation ?? '')}

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
          required
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
        <RsField control={form.control} name="amount" label="Currency" readOnly={readOnly} />
        <SelectField
          control={form.control}
          name="paymentMethod"
          label="Payment Method"
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
          disabled={readOnly}
          textareaClassName="min-h-20"
        />
        <TextareaField
          control={form.control}
          name="comments"
          label="Comments/ Additional Notes"
          disabled={readOnly}
          textareaClassName="min-h-24"
        />
        <AttachmentField
          value={attachment}
          disabled={readOnly}
          onChange={(name) => {
            form.setValue('attachmentName', name, { shouldDirty: true })
          }}
        />

        <SectionTitle>Approval Web Flow</SectionTitle>
        <SearchSelectField
          control={form.control}
          name="requestedById"
          label="Requested By (Employee)"
          placeholder="Employee"
          options={options.activeEmployees}
          required
          disabled={readOnly}
        />
        <SearchSelectField
          control={form.control}
          name="approvedById"
          label="Approved By (Manager/ Supervisor)"
          placeholder="Employee"
          options={options.activeEmployees}
          required
          disabled={readOnly}
        />
        <DateField
          control={form.control}
          name="approvalDate"
          label="Approval Date"
          required
          disabled={readOnly}
          display={DATE}
        />

        <SectionTitle>Verification</SectionTitle>
        <TextField
          control={form.control}
          name="verifiedBy"
          label="Verified By (Finance/ Admin)"
          required
          disabled={readOnly}
        />
        <DateField
          control={form.control}
          name="verificationDate"
          label="Verification Date"
          disabled={readOnly}
          display={DATE}
        />
        <SelectField
          control={form.control}
          name="status"
          label="Voucher Status"
          disabled={readOnly}
          options={VOUCHER_STATUSES.map((status) => ({
            value: status,
            label: VOUCHER_STATUS_LABELS[status],
          }))}
        />
      </form>
    </PayrollDialog>
  )
}
