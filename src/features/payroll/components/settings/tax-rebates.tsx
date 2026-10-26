import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { TextareaField, TextField } from '@/components/form'
import { type DataTableColumn, EmployeeAvatar } from '@/components/layout'
import { cn } from '@/lib/utils'

import { useDeleteResource, useResourceList, useSaveResource } from '../../hooks/use-payroll'
import { personHint } from '../../hooks/use-payroll-records'
import type { TaxRebateRow } from '../../types/payroll.types'
import { formatAmount, formatLong } from '../../utils/format'
import { personCodeText, personNameText } from '../../utils/styles'
import { DateField } from '../shared/date-input'
import { EmployeeSearchSelectField } from '../shared/employee-search-select'
import { PayrollDialog } from '../shared/payroll-dialog'
import { UploadField } from '../shared/upload-field'
import { CreateButton, DeleteConfirm, SettingsRowMenu } from './settings-common'
import { amountText, applyApiError, type DialogState, toAmount } from './settings-helpers'
import { SettingsTable, ViewHeader } from './settings-list'
import { SETTINGS_PAGE_SIZE } from './settings-nav'
import { rowMenuHandlers, useSettingsCan } from './settings-permissions'

const schema = z.object({
  employeeId: z.string().min(1, 'Choose the employee'),
  rebateDate: z.string().min(1, 'Choose the date'),
  file: z.object({ id: z.string(), name: z.string().nullable(), url: z.string() }).nullable(),
  amount: amountText('Enter the amount').refine((value) => toAmount(value) > 0, {
    message: 'Enter the amount',
  }),
  description: z.string().trim().max(2000),
})
type Values = z.infer<typeof schema>

/** "Tax Rebate Create": Employee, Date, Attachment (uploaded first, sent as `fileId`), Amount. */
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
  const [error, setError] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: record?.employeeId ?? '',
      rebateDate: record?.rebateDate ?? '',
      file: record?.file ?? null,
      amount: record ? String(record.amount) : '',
      description: record?.description ?? '',
    },
  })
  const submit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await save.mutateAsync({
        id: record?.id,
        input: {
          employeeId: values.employeeId,
          rebateDate: values.rebateDate,
          amount: toAmount(values.amount),
          fileId: values.file?.id ?? null,
          description: values.description || null,
          rowVersion: record?.rowVersion ?? null,
        },
      })
      onClose()
    } catch (failure) {
      setError(applyApiError(failure, form.setError, ['employeeId', 'rebateDate', 'amount']))
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
        <EmployeeSearchSelectField
          control={form.control}
          name="employeeId"
          label="Employee"
          placeholder="Select Employee"
          required
          disabled={readOnly}
          filters={{ permission: 'payroll.settings.tax.view', includeInactive: true }}
          known={
            record
              ? [
                  {
                    value: record.employeeId,
                    label: record.employeeName,
                    hint: record.employeeCode,
                  },
                ]
              : undefined
          }
          hint={personHint}
        />
        <DateField
          control={form.control}
          name="rebateDate"
          label="Date"
          required
          disabled={readOnly}
          maxDate={new Date()}
        />
        <Controller
          control={form.control}
          name="file"
          render={({ field, fieldState }) => (
            <UploadField
              value={field.value}
              onChange={field.onChange}
              disabled={readOnly}
              error={fieldState.error?.message}
            />
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
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
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
        <EmployeeAvatar name={row.employeeName} photoUrl={null} className="size-6" />
        <span className="min-w-0">
          <span className={cn('block truncate', personNameText)}>{row.employeeName}</span>
          <span className={cn('block', personCodeText)}>{row.employeeCode}</span>
        </span>
      </span>
    ),
  },
  { id: 'date', header: 'Date', cell: (row) => formatLong(row.rebateDate) },
  { id: 'amount', header: 'Amount', cell: (row) => formatAmount(row.amount) },
  {
    id: 'file',
    header: 'Attachment',
    cell: (row) =>
      row.file ? (
        <a
          href={row.file.url}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          {row.file.name ?? 'Attachment'}
        </a>
      ) : (
        '—'
      ),
  },
]

/** Tax → Tax Rebate: rebates that lower a person's yearly tax. */
export function TaxRebatesView() {
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<DialogState<TaxRebateRow>>(null)
  const [deleting, setDeleting] = useState<TaxRebateRow | null>(null)
  const list = useResourceList('taxRebates', { page, pageSize: SETTINGS_PAGE_SIZE })
  const remove = useDeleteResource('taxRebates')
  const may = useSettingsCan('tax')

  return (
    <>
      <ViewHeader
        tab="tax"
        view="tax-rebate"
        actions={
          may.create && (
            <CreateButton
              onClick={() => {
                setDialog({ mode: 'create' })
              }}
            />
          )
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
            label={`Actions for ${row.employeeName}'s rebate`}
            {...rowMenuHandlers(may, row, setDialog, setDeleting)}
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
      />
    </>
  )
}
