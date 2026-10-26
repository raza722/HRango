import { type SyntheticEvent, useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { Lock, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { AppDialog } from '@/components/feedback/app-dialog'
import { CheckboxField, SelectField, TextareaField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { PAYROLL_CODES } from '../../constants'
import {
  useDeleteOpeningBalance,
  useOpeningBalance,
  useSaveOpeningBalance,
} from '../../hooks/use-payroll'
import { personHint, usePayrollOptions } from '../../hooks/use-payroll-records'
import type { OpeningBalanceEntry, OpeningBalanceRow } from '../../types/payroll.types'
import { formatAmount, formatMonthComma, monthOf, monthStart, profileOf } from '../../utils/format'
import { btn, footerButton } from '../../utils/styles'
import { ConfirmAction } from '../shared/confirm-action'
import { EmployeeCard } from '../shared/employee-card'
import { EmployeeSearchSelectField } from '../shared/employee-search-select'
import { MonthField } from '../shared/month-picker'
import { NoRecord } from '../shared/no-record'
import { PayrollDialog } from '../shared/payroll-dialog'
import { SearchSelectField } from '../shared/search-select'
import { RsField } from './list-parts'

const CODE = PAYROLL_CODES.openingBalances

const schema = z.object({
  employeeId: z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message: 'Choose the employee' }),
  month: z.string().min(1, 'Choose the month'),
  kind: z.enum(['opening', 'adjustment']),
  taxable: z.boolean(),
  payItemId: z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message: 'Choose the pay item' }),
  amount: z.string().refine(
    (value) => {
      const number = Number(value.replace(/,/g, ''))
      return value.trim() !== '' && Number.isFinite(number) && number !== 0
    },
    { message: 'Enter the amount (not zero)' },
  ),
  description: z.string().trim().max(2000, 'Keep it under 2000 characters'),
})
type Values = z.infer<typeof schema>

/**
 * "Opening Balance Adjustment" (`POST/PUT /opening-balances`): Create (any employee and month),
 * Adjust (the row's employee, an adjustment entry) or Edit (one entry). An amount is added to the
 * pay item in that month's payroll run; a negative amount takes it off.
 */
export function OpeningBalanceDialog({
  balance,
  entry,
  onClose,
}: {
  /** The person being adjusted; `null` creates for anyone. */
  balance: Pick<OpeningBalanceRow, 'employeeId' | 'employeeName'> | null
  /** An entry to edit. */
  entry?: OpeningBalanceEntry
  onClose: () => void
}) {
  const formId = useId()
  const options = usePayrollOptions('payroll.opening_balances.view')
  const save = useSaveOpeningBalance()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: entry?.employeeId ?? balance?.employeeId ?? null,
      month: entry ? monthOf(entry.balanceMonth) : balance ? format(new Date(), 'yyyy-MM') : '',
      kind: entry?.kind ?? (balance ? 'adjustment' : 'opening'),
      taxable: entry?.isTaxable ?? false,
      payItemId: entry?.payItemId ?? null,
      amount: entry ? String(entry.amount) : '',
      description: entry?.description ?? '',
    },
  })
  const fixedPerson = balance !== null || entry !== undefined
  const personId = entry?.employeeId ?? balance?.employeeId
  const personName = entry?.employeeName ?? balance?.employeeName

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: entry?.id,
        input: {
          employeeId: values.employeeId ?? '',
          balanceMonth: monthStart(values.month),
          payItemId: values.payItemId ?? '',
          amount: Number(values.amount.replace(/,/g, '')),
          isTaxable: values.taxable,
          kind: values.kind,
          description: values.description.trim() || null,
          ...(entry ? { rowVersion: entry.rowVersion } : {}),
        },
      })
      onClose()
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.payItemId) {
        form.setError('payItemId', { message: error.fieldErrors.payItemId })
      } else if (error instanceof ApiError && error.fieldErrors.amount) {
        form.setError('amount', { message: error.fieldErrors.amount })
      } else {
        form.setError('root', {
          message:
            error instanceof ApiError ? error.message : 'Could not save the opening balance.',
        })
      }
    }
  })

  return (
    <PayrollDialog
      title={entry ? 'Opening Balance Edit' : 'Opening Balance Adjustment'}
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
        <EmployeeSearchSelectField
          control={form.control}
          name="employeeId"
          label="Employees"
          placeholder="Select Employee"
          filters={options.employeeFilters}
          known={personId && personName ? [{ value: personId, label: personName }] : undefined}
          hint={personHint}
          required
          disabled={fixedPerson}
        />
        <MonthField control={form.control} name="month" label="Month" required />
        <SelectField
          control={form.control}
          name="kind"
          label="Kind"
          options={[
            { value: 'opening', label: 'Opening Balance' },
            { value: 'adjustment', label: 'Adjustment' },
          ]}
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

/** Entries grouped by pay item, as the View draws them. */
function groupsOf(entries: readonly OpeningBalanceEntry[]) {
  const groups = new Map<string, { name: string; items: OpeningBalanceEntry[] }>()
  for (const entry of entries) {
    const group = groups.get(entry.payItemId) ?? { name: entry.payItemName, items: [] }
    group.items.push(entry)
    groups.set(entry.payItemId, group)
  }
  return [...groups.entries()].map(([payItemId, group]) => ({ payItemId, ...group }))
}

/**
 * The View (`GET /opening-balances/employees/{employeeId}`): the person, then each pay item's
 * months, amounts, taxable flag and description; entries of a closed month are locked.
 */
export function OpeningBalanceViewDialog({
  id,
  onClose,
}: {
  /** The employee whose balances are shown. */
  id: string
  onClose: () => void
}) {
  const detail = useOpeningBalance(id)
  const data = detail.data
  const canEdit = useCan(`${CODE}.edit`)
  const canDelete = useCan(`${CODE}.delete`)
  const remove = useDeleteOpeningBalance()
  const [editing, setEditing] = useState<OpeningBalanceEntry | null>(null)
  const [deleting, setDeleting] = useState<OpeningBalanceEntry | null>(null)
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
        <EmployeeCard profile={data ? profileOf(data) : undefined} />
        {!data ? (
          <Skeleton className="h-32 w-full" />
        ) : data.entries.length === 0 ? (
          <NoRecord />
        ) : (
          groupsOf(data.entries).map((group) => (
            <section key={group.payItemId} aria-label={group.name} className="grid gap-2">
              <h3 className="-mx-5 bg-[#17263A]/[0.06] px-5 py-2 text-lg font-medium text-title sm:-mx-8 sm:px-8 sm:text-xl dark:bg-muted">
                {group.name}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead>
                    <tr className="border-b text-sm text-title">
                      <th scope="col" className="px-3 py-3 font-medium">
                        Month
                      </th>
                      <th scope="col" className="px-3 py-3 font-medium">
                        Kind
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
                      <th scope="col" className="px-3 py-3 font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item) => {
                      const label = `${group.name} ${formatMonthComma(item.balanceMonth)}`
                      return (
                        <tr
                          key={item.id}
                          className="border-b text-base font-medium text-title last:border-b-0 sm:text-lg"
                        >
                          <td className="px-3 py-3">{formatMonthComma(item.balanceMonth)}</td>
                          <td className="px-3 py-3 text-sm">
                            {item.kind === 'adjustment' ? 'Adjustment' : 'Opening'}
                          </td>
                          <td className="px-3 py-3">{formatAmount(item.amount)}</td>
                          <td className="px-3 py-3">
                            <Checkbox
                              checked={item.isTaxable}
                              disabled
                              aria-label={`Taxable, ${label}`}
                            />
                          </td>
                          <td className="px-3 py-3">{item.description ?? '—'}</td>
                          <td className="px-3 py-3">
                            {item.isLocked ? (
                              <Lock
                                aria-label={`Locked (month closed), ${label}`}
                                className="size-4 text-muted-foreground"
                              />
                            ) : (
                              <span className="flex gap-1">
                                {canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Edit, ${label}`}
                                    onClick={() => {
                                      setEditing(item)
                                    }}
                                  >
                                    <Pencil aria-hidden="true" className="size-4" />
                                  </Button>
                                )}
                                {canDelete && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Delete, ${label}`}
                                    onClick={() => {
                                      setDeleting(item)
                                    }}
                                  >
                                    <Trash2 aria-hidden="true" className="size-4" />
                                  </Button>
                                )}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </div>
      {editing && (
        <OpeningBalanceDialog
          balance={null}
          entry={editing}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
      <ConfirmAction
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Delete opening balance"
        message="Are you sure you want to Delete this?"
        onConfirm={() => {
          if (!deleting) return
          remove.mutate(
            { id: deleting.id, rowVersion: deleting.rowVersion },
            {
              onError: (error) => {
                toast.error(
                  error instanceof ApiError ? error.message : 'Could not delete the balance.',
                )
              },
            },
          )
        }}
      />
    </AppDialog>
  )
}
