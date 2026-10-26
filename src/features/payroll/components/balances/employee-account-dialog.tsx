import { type SyntheticEvent, useId } from 'react'
import { useController, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { z } from 'zod'

import { CheckboxField, SelectField, TextareaField, TextField } from '@/components/form'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api-error'

import { useEmployeeAccount, useSaveEmployeeAccount } from '../../hooks/use-payroll'
import { personHint, usePayrollOptions } from '../../hooks/use-payroll-records'
import type { EmployeeAccountRow } from '../../types/payroll.types'
import { monthOf, monthStart } from '../../utils/format'
import { EmployeeSearchSelectField } from '../shared/employee-search-select'
import { MonthField } from '../shared/month-picker'
import { PayrollDialog } from '../shared/payroll-dialog'
import { TwoWaySwitch } from '../shared/two-way-switch'
import { ReadOnlyRow } from './list-parts'

const schema = z.object({
  accountTypeId: z.string().min(1, 'Choose the account'),
  employeeId: z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message: 'Choose the employee' }),
  month: z.string().min(1, 'Choose the month'),
  direction: z.enum(['credit', 'debit']),
  amount: z
    .string()
    .refine((value) => Number(value.replace(/,/g, '')) > 0, { message: 'Enter the amount' }),
  processed: z.boolean(),
  description: z.string().trim().max(2000, 'Keep it under 2000 characters'),
})
type Values = z.infer<typeof schema>

/** The API sends credit and debit; one of them is the entry's amount. */
const toValues = (row: EmployeeAccountRow | undefined): Values => ({
  accountTypeId: row?.accountTypeId ?? '',
  employeeId: row?.employeeId ?? null,
  month: row ? monthOf(row.entryMonth) : format(new Date(), 'yyyy-MM'),
  direction: row && row.debit > 0 ? 'debit' : 'credit',
  amount: row ? String(row.debit > 0 ? row.debit : row.credit) : '',
  processed: row?.isProcessed ?? false,
  description: row?.description ?? '',
})

/**
 * "Employee Account Create" / Edit / View (`/payroll/employee-accounts`): Account, Employee,
 * Month, Credit+ / Debit-, Amount, Processed and a description.
 */
export function EmployeeAccountDialog({
  id,
  mode,
  onClose,
}: {
  id: string | null
  mode: 'create' | 'edit' | 'view'
  onClose: () => void
}) {
  const entry = useEmployeeAccount(id)
  if (id && !entry.data) {
    return (
      <PayrollDialog
        title={mode === 'view' ? 'Employee Account View' : 'Employee Account Edit'}
        onClose={onClose}
        readOnly
      >
        <Skeleton className="h-72 w-full" />
      </PayrollDialog>
    )
  }
  return <AccountForm row={entry.data} mode={mode} onClose={onClose} />
}

function AccountForm({
  row,
  mode,
  onClose,
}: {
  row: EmployeeAccountRow | undefined
  mode: 'create' | 'edit' | 'view'
  onClose: () => void
}) {
  const formId = useId()
  const switchId = useId()
  const options = usePayrollOptions('payroll.employee_accounts.view')
  const save = useSaveEmployeeAccount()
  const readOnly = mode === 'view'
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(row) })
  const direction = useController({ control: form.control, name: 'direction' })
  // An account no longer in the first page of the lookup still shows by its name.
  const accounts =
    row && !options.accountTypes.some((item) => item.value === row.accountTypeId)
      ? [...options.accountTypes, { value: row.accountTypeId, label: row.accountName }]
      : options.accountTypes

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: row?.id,
        input: {
          accountTypeId: values.accountTypeId,
          employeeId: values.employeeId ?? '',
          entryMonth: monthStart(values.month),
          direction: values.direction,
          amount: Number(values.amount.replace(/,/g, '')),
          isProcessed: values.processed,
          description: values.description.trim() || null,
          ...(row ? { rowVersion: row.rowVersion } : {}),
        },
      })
      onClose()
    } catch (error) {
      form.setError('root', {
        message: error instanceof ApiError ? error.message : 'Could not save the entry.',
      })
    }
  })

  return (
    <PayrollDialog
      title={
        mode === 'create'
          ? 'Employee Account Create'
          : mode === 'edit'
            ? 'Employee Account Edit'
            : 'Employee Account View'
      }
      onClose={onClose}
      formId={formId}
      readOnly={readOnly}
      pending={save.isPending}
      error={form.formState.errors.root?.message}
      className="max-w-3xl"
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event: SyntheticEvent) => void submit(event)}
        className="grid gap-5"
      >
        <SelectField
          control={form.control}
          name="accountTypeId"
          label="Account"
          placeholder="Select Account"
          options={accounts}
          required
          disabled={readOnly}
        />
        <EmployeeSearchSelectField
          control={form.control}
          name="employeeId"
          label="Employee"
          placeholder="Select Employee"
          filters={options.employeeFilters}
          known={row ? [{ value: row.employeeId, label: row.employeeName }] : undefined}
          hint={personHint}
          required
          disabled={readOnly}
        />
        <MonthField
          control={form.control}
          name="month"
          label="Month"
          required
          disabled={readOnly}
        />
        <div className="grid gap-2 @xl:grid-cols-[10rem_minmax(0,1fr)] @3xl:grid-cols-[11rem_minmax(0,1fr)]">
          <span aria-hidden="true" />
          <TwoWaySwitch
            id={switchId}
            label="Credit or debit"
            options={[
              { value: 'credit', label: 'Credit+' },
              { value: 'debit', label: 'Debit -' },
            ]}
            value={direction.field.value}
            disabled={readOnly}
            onChange={direction.field.onChange}
          />
        </div>
        <TextField
          control={form.control}
          name="amount"
          label="Amount"
          inputMode="decimal"
          required
          disabled={readOnly}
        />
        <CheckboxField
          control={form.control}
          name="processed"
          label="Processed"
          disabled={readOnly}
        />
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          disabled={readOnly}
          textareaClassName="min-h-20"
        />
        {row?.payRuleName && <ReadOnlyRow label="Posted by rule" value={row.payRuleName} />}
      </form>
    </PayrollDialog>
  )
}
