import { type SyntheticEvent, useId } from 'react'
import { useController, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { z } from 'zod'

import { CheckboxField, SelectField, TextField } from '@/components/form'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api-error'

import { useEmployeeAccount, useSaveEmployeeAccount } from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import type { EmployeeAccountRow } from '../../types/payroll.types'
import { MonthField } from '../shared/month-picker'
import { PayrollDialog } from '../shared/payroll-dialog'
import { SearchSelectField } from '../shared/search-select'
import { TwoWaySwitch } from '../shared/two-way-switch'

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
})
type Values = z.infer<typeof schema>

const toValues = (row: EmployeeAccountRow | undefined): Values => ({
  accountTypeId: row?.accountTypeId ?? '',
  employeeId: row?.employeeId ?? null,
  month: row?.month ?? format(new Date(), 'yyyy-MM'),
  direction: row?.direction ?? 'credit',
  amount: row ? String(row.amount) : '',
  processed: row?.processed ?? true,
})

/**
 * "Employee Account Create" (and its Edit and View, which are not drawn):
 * Account, Employee, Month, Credit+ / Debit-, Amount and Processed.
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
  const options = usePayrollOptions()
  const save = useSaveEmployeeAccount()
  const readOnly = mode === 'view'
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(row) })
  const direction = useController({ control: form.control, name: 'direction' })

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: row?.id,
        input: {
          accountTypeId: values.accountTypeId,
          employeeId: values.employeeId ?? '',
          month: values.month,
          direction: values.direction,
          amount: Number(values.amount.replace(/,/g, '')),
          processed: values.processed,
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
          options={options.accountTypes}
          required
          disabled={readOnly}
        />
        <SearchSelectField
          control={form.control}
          name="employeeId"
          label="Employee"
          placeholder="Select Employee"
          options={options.employees}
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
      </form>
    </PayrollDialog>
  )
}
