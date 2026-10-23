import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { TextField } from '@/components/form'
import { type DataTableColumn, EmployeeAvatar } from '@/components/layout'
import { cn } from '@/lib/utils'

import {
  useDeleteResource,
  usePayrollLookups,
  useResourceList,
  useSaveResource,
} from '../../hooks/use-payroll'
import type { TaxRebateRow } from '../../types/payroll.types'
import { formatAmount, formatLong } from '../../utils/format'
import { personCodeText, personNameText } from '../../utils/styles'
import { AttachmentField } from '../shared/attachment-field'
import { DateField } from '../shared/date-input'
import { PayrollDialog } from '../shared/payroll-dialog'
import { SearchSelectField } from '../shared/search-select'
import { CreateButton, DeleteConfirm, SettingsRowMenu } from './settings-common'
import { amountText, applyApiError, type DialogState, toAmount } from './settings-helpers'
import { SettingsTable, ViewHeader } from './settings-list'
import { SETTINGS_PAGE_SIZE } from './settings-nav'

const schema = z.object({
  employeeId: z.string().min(1, 'Choose the employee'),
  date: z.string().min(1, 'Choose the date'),
  attachmentName: z.string().nullable(),
  amount: amountText('Enter the amount').refine((value) => toAmount(value) > 0, {
    message: 'Enter the amount',
  }),
})
type Values = z.infer<typeof schema>

/** "Tax Rebate Create": Employee, Date, Attachment, Amount. */
function TaxRebateDialog({
  state,
  onClose,
}: {
  state: Exclude<DialogState<TaxRebateRow>, null>
  onClose: () => void
}) {
  const record = state.mode === 'create' ? undefined : state.record
  const readOnly = state.mode === 'view'
  const save = useSaveResource('taxRebates')
  const lookups = usePayrollLookups()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: record?.employeeId ?? '',
      date: record?.date ?? '',
      attachmentName: record?.attachmentName ?? null,
      amount: record ? String(record.amount) : '',
    },
  })
  const submit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await save.mutateAsync({
        id: record?.id,
        input: { ...values, amount: toAmount(values.amount) },
      })
      onClose()
    } catch (failure) {
      setError(applyApiError(failure, form.setError, ['employeeId', 'date', 'amount']))
    }
  })
  const title =
    state.mode === 'create'
      ? 'Tax Rebate Create'
      : state.mode === 'edit'
        ? 'Tax Rebate Edit'
        : 'Tax Rebate View'

  return (
    <PayrollDialog
      title={title}
      onClose={onClose}
      formId="tax-rebate-form"
      readOnly={readOnly}
      pending={save.isPending}
      error={error}
    >
      <form
        id="tax-rebate-form"
        noValidate
        onSubmit={(event) => void submit(event)}
        className="grid gap-5"
      >
        <SearchSelectField
          control={form.control}
          name="employeeId"
          label="Employee"
          placeholder="Select Employee"
          required
          disabled={readOnly}
          options={(lookups.data?.employees ?? []).map((employee) => ({
            value: employee.id,
            label: employee.name,
            hint: `${employee.code} · ${employee.designation}`,
          }))}
        />
        <DateField
          control={form.control}
          name="date"
          label="Date"
          required
          disabled={readOnly}
          maxDate={new Date()}
        />
        <Controller
          control={form.control}
          name="attachmentName"
          render={({ field }) => (
            <AttachmentField value={field.value} onChange={field.onChange} disabled={readOnly} />
          )}
        />
        <TextField
          control={form.control}
          name="amount"
          label="Amount"
          required
          inputMode="decimal"
          placeholder="5000"
          disabled={readOnly}
        />
      </form>
    </PayrollDialog>
  )
}

const columns: DataTableColumn<TaxRebateRow>[] = [
  {
    id: 'employee',
    header: 'Employee',
    mobile: 'heading',
    cell: (row) => (
      <span className="flex items-center gap-2">
        <EmployeeAvatar
          name={row.employee.name}
          photoUrl={row.employee.photoUrl}
          className="size-6"
        />
        <span className="min-w-0">
          <span className={cn('block truncate', personNameText)}>{row.employee.name}</span>
          <span className={cn('block', personCodeText)}>{row.employee.code}</span>
        </span>
      </span>
    ),
  },
  { id: 'date', header: 'Date', cell: (row) => formatLong(row.date) },
  { id: 'amount', header: 'Amount', cell: (row) => formatAmount(row.amount) },
]

/** Tax → Tax Rebate: rebates that lower a person's yearly tax. */
export function TaxRebatesView() {
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<DialogState<TaxRebateRow>>(null)
  const [deleting, setDeleting] = useState<TaxRebateRow | null>(null)
  const list = useResourceList('taxRebates', { page, pageSize: SETTINGS_PAGE_SIZE })
  const remove = useDeleteResource('taxRebates')

  return (
    <>
      <ViewHeader
        tab="tax"
        view="tax-rebate"
        actions={
          <CreateButton
            onClick={() => {
              setDialog({ mode: 'create' })
            }}
          />
        }
      />
      <SettingsTable
        caption="Tax Rebates"
        columns={columns}
        page={list.data}
        getRowId={(row) => row.id}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        onPageChange={setPage}
        rowActions={(row) => (
          <SettingsRowMenu
            label={`Actions for ${row.employee.name}'s rebate`}
            onEdit={() => {
              setDialog({ mode: 'edit', record: row })
            }}
            onView={() => {
              setDialog({ mode: 'view', record: row })
            }}
            onDelete={() => {
              setDeleting(row)
            }}
          />
        )}
      />
      {dialog && (
        <TaxRebateDialog
          state={dialog}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      <DeleteConfirm
        record={deleting}
        onClose={() => {
          setDeleting(null)
        }}
        remove={remove}
        idOf={(row) => row.id}
      />
    </>
  )
}
