import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { TextField } from '@/components/form'
import type { DataTableColumn } from '@/components/layout'

import { useDeleteResource, useResourceList, useSaveResource } from '../../hooks/use-payroll'
import { BANK_FORMATS, type DisbursementBank } from '../../types/payroll.types'
import { formatLong } from '../../utils/format'
import { DateField } from '../shared/date-input'
import { PayrollDialog } from '../shared/payroll-dialog'
import { CreateButton, DeleteConfirm, SettingsRowMenu } from './settings-common'
import { applyApiError, type DialogState } from './settings-helpers'
import { SettingsTable, ViewHeader } from './settings-list'
import { SETTINGS_PAGE_SIZE } from './settings-nav'
import { rowMenuHandlers, useSettingsCan } from './settings-permissions'

const required = (label: string, max: number) =>
  z.string().trim().min(1, `Enter the ${label}`).max(max, `Keep it under ${max} characters`)

/** A required code in its format (`BANK_FORMATS`). */
const code = (
  label: string,
  max: number,
  format: (typeof BANK_FORMATS)[keyof typeof BANK_FORMATS],
) => required(label, max).regex(format.pattern, format.message)

const schema = z.object({
  accountHolder: required('account holder', 200),
  accountNumber: code('account number', 50, BANK_FORMATS.accountNumber),
  bankName: required('bank name', 200),
  branchName: z.string().trim().max(200),
  branchCode: code('branch code', 30, BANK_FORMATS.branchCode),
  branchLocation: required('branch location', 200),
  taxPayerId: code('tax payer ID', 30, BANK_FORMATS.taxPayerId),
  effectiveDate: z.string(),
  description: z.string().trim().max(2000),
})
type Values = z.infer<typeof schema>

const empty: Values = {
  accountHolder: '',
  accountNumber: '',
  bankName: '',
  branchName: '',
  branchCode: '',
  branchLocation: '',
  taxPayerId: '',
  effectiveDate: '',
  description: '',
}

const valuesOf = (record: DisbursementBank | undefined): Values =>
  record
    ? {
        accountHolder: record.accountHolder,
        accountNumber: record.accountNumber,
        bankName: record.bankName,
        branchName: record.branchName ?? '',
        branchCode: record.branchCode,
        branchLocation: record.branchLocation,
        taxPayerId: record.taxPayerId,
        effectiveDate: record.effectiveDate ?? '',
        description: record.description ?? '',
      }
    : empty

/** "Disbursement Bank Create" / Edit / View. */
function BankDialog({
  state,
  onClose,
}: {
  state: Exclude<DialogState<DisbursementBank>, null>
  onClose: () => void
}) {
  const record = state.mode === 'create' ? undefined : state.record
  const readOnly = state.mode === 'view'
  const save = useSaveResource('banks')
  const [error, setError] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: valuesOf(record),
  })
  const submit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await save.mutateAsync({
        id: record?.id,
        input: {
          ...values,
          branchName: values.branchName || null,
          effectiveDate: values.effectiveDate || null,
          description: values.description || null,
          rowVersion: record?.rowVersion ?? null,
        },
      })
      onClose()
    } catch (failure) {
      setError(applyApiError(failure, form.setError, Object.keys(empty) as (keyof Values)[]))
    }
  })
  const title =
    state.mode === 'create'
      ? 'Disbursement Bank Create'
      : state.mode === 'edit'
        ? 'Disbursement Bank Edit'
        : 'Disbursement Bank View'

  return (
    <PayrollDialog
      title={title}
      onClose={onClose}
      formId="bank-form"
      readOnly={readOnly}
      pending={save.isPending}
      error={error}
    >
      <form
        id="bank-form"
        noValidate
        onSubmit={(event) => void submit(event)}
        className="grid gap-5"
      >
        <fieldset disabled={readOnly} className="grid gap-5">
          <TextField control={form.control} name="accountHolder" label="Account Holder" required />
          <TextField control={form.control} name="accountNumber" label="Account Number" required />
          <TextField control={form.control} name="bankName" label="Bank Name" required />
          <TextField control={form.control} name="branchName" label="Branch Name" />
          <TextField control={form.control} name="branchCode" label="Branch Code" required />
          <TextField
            control={form.control}
            name="branchLocation"
            label="Branch Location"
            required
          />
          <TextField control={form.control} name="taxPayerId" label="Tax Payer ID" required />
          <DateField
            control={form.control}
            name="effectiveDate"
            label="Effective Date"
            disabled={readOnly}
          />
          <TextField control={form.control} name="description" label="Description" />
        </fieldset>
      </form>
    </PayrollDialog>
  )
}

const columns: DataTableColumn<DisbursementBank>[] = [
  { id: 'bank', header: 'Bank Name', cell: (row) => row.bankName, mobile: 'heading' },
  { id: 'account', header: 'Account Number', cell: (row) => row.accountNumber },
  { id: 'branch', header: 'Branch Name', cell: (row) => row.branchName ?? '—' },
  { id: 'code', header: 'Branch Code', cell: (row) => row.branchCode },
  {
    id: 'date',
    header: 'Effective Date',
    cell: (row) => (row.effectiveDate ? formatLong(row.effectiveDate) : '—'),
  },
]

/** Settings → Disbursement Banks: the company's paying accounts. */
export function BanksView() {
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<DialogState<DisbursementBank>>(null)
  const [deleting, setDeleting] = useState<DisbursementBank | null>(null)
  const list = useResourceList('banks', { page, pageSize: SETTINGS_PAGE_SIZE })
  const remove = useDeleteResource('banks')
  const may = useSettingsCan('banks')

  return (
    <>
      <ViewHeader
        tab="disbursement-banks"
        view={null}
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
        caption="Disbursement Banks"
        columns={columns}
        page={list.data}
        getRowId={(row) => row.id}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        onPageChange={setPage}
        rowActions={(row) => (
          <SettingsRowMenu
            label={`Actions for ${row.bankName} (${row.accountNumber})`}
            {...rowMenuHandlers(may, row, setDialog, setDeleting)}
          />
        )}
      />
      {dialog && (
        <BankDialog
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
