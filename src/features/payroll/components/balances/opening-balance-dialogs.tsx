import { type SyntheticEvent, useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { z } from 'zod'

import { AppDialog } from '@/components/feedback/app-dialog'
import { CheckboxField, TextareaField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { useAddOpeningBalance, useOpeningBalance } from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import type { OpeningBalanceRow } from '../../types/payroll.types'
import { formatAmount, formatMonthComma } from '../../utils/format'
import { btn, footerButton } from '../../utils/styles'
import { EmployeeCard } from '../shared/employee-card'
import { MonthField } from '../shared/month-picker'
import { NoRecord } from '../shared/no-record'
import { PayrollDialog } from '../shared/payroll-dialog'
import { SearchSelectField } from '../shared/search-select'
import { RsField } from './list-parts'

const schema = z.object({
  employeeId: z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message: 'Choose the employee' }),
  month: z.string().min(1, 'Choose the month'),
  taxable: z.boolean(),
  payItemId: z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message: 'Choose the pay item' }),
  amount: z
    .string()
    .refine((value) => Number(value.replace(/,/g, '')) > 0, { message: 'Enter the amount' }),
  description: z.string().trim().max(500, 'Keep it under 500 characters'),
})
type Values = z.infer<typeof schema>

/**
 * "Opening Balance Adjustment": Create (any employee and month) or Adjust
 * (the row's employee and this month, locked): pay item, amount, taxable.
 */
export function OpeningBalanceDialog({
  balance,
  onClose,
}: {
  /** The row being adjusted; `null` creates. */
  balance: OpeningBalanceRow | null
  onClose: () => void
}) {
  const formId = useId()
  const options = usePayrollOptions()
  const save = useAddOpeningBalance()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: balance?.employee.id ?? null,
      month: balance ? format(new Date(), 'yyyy-MM') : '',
      taxable: false,
      payItemId: null,
      amount: '',
      description: '',
    },
  })

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        employeeId: values.employeeId ?? '',
        month: values.month,
        taxable: values.taxable,
        payItemId: values.payItemId ?? '',
        amount: Number(values.amount.replace(/,/g, '')),
        description: values.description.trim(),
      })
      onClose()
    } catch (error) {
      form.setError('root', {
        message: error instanceof ApiError ? error.message : 'Could not save the opening balance.',
      })
    }
  })

  return (
    <PayrollDialog
      title="Opening Balance Adjustment"
      onClose={onClose}
      formId={formId}
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
          label="Employees"
          placeholder="Select Employee"
          options={options.employees}
          required
          disabled={balance !== null}
        />
        <MonthField
          control={form.control}
          name="month"
          label="Month"
          required
          disabled={balance !== null}
        />
        <CheckboxField control={form.control} name="taxable" label="Is Taxable" />
        <SearchSelectField
          control={form.control}
          name="payItemId"
          label="Pay item"
          placeholder="Select Pay item"
          options={options.payItems}
          required
        />
        <RsField control={form.control} name="amount" label="Amount" required />
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          textareaClassName="min-h-36"
        />
      </form>
    </PayrollDialog>
  )
}

/** The View: the person, then each pay item's months, amounts, taxable flag and description. */
export function OpeningBalanceViewDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useOpeningBalance(id)
  const data = detail.data
  return (
    <AppDialog
      title="Opening Balance View"
      hideTitle
      onRequestClose={onClose}
      className="max-w-4xl"
      footer={
        <Button onClick={onClose} className={cn(footerButton, btn.red)}>
          Cancel
        </Button>
      }
    >
      <div className="grid gap-6">
        <EmployeeCard profile={data?.profile} />
        {!data ? (
          <Skeleton className="h-32 w-full" />
        ) : data.groups.length === 0 ? (
          <NoRecord />
        ) : (
          data.groups.map((group) => (
            <section key={group.payItemId} aria-label={group.name} className="grid gap-2">
              <h3 className="-mx-5 bg-[#17263A]/[0.06] px-5 py-2 text-lg font-medium text-title sm:-mx-8 sm:px-8 sm:text-xl dark:bg-muted">
                {group.name}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead>
                    <tr className="border-b text-sm text-title">
                      <th scope="col" className="px-3 py-3 font-medium">
                        Month
                      </th>
                      <th scope="col" className="px-3 py-3 font-medium">
                        Amount
                      </th>
                      <th scope="col" className="px-3 py-3 font-medium">
                        Taxable
                      </th>
                      <th scope="col" className="px-3 py-3 font-medium">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b text-base font-medium text-title last:border-b-0 sm:text-lg"
                      >
                        <td className="px-3 py-3">{formatMonthComma(item.month)}</td>
                        <td className="px-3 py-3">{formatAmount(item.amount)}</td>
                        <td className="px-3 py-3">
                          <Checkbox
                            checked={item.taxable}
                            disabled
                            aria-label={`Taxable, ${group.name} ${formatMonthComma(item.month)}`}
                          />
                        </td>
                        <td className="px-3 py-3">{item.description || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </div>
    </AppDialog>
  )
}
