import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { TextField } from '@/components/form'
import type { DataTableColumn } from '@/components/layout'

import { useDeleteResource, useResourceList, useSaveResource } from '../../hooks/use-payroll'
import type { DisbursementBank } from '../../types/payroll.types'
import { formatLong } from '../../utils/format'
import { DateField } from '../shared/date-input'
import { PayrollDialog } from '../shared/payroll-dialog'
import { CreateButton, DeleteConfirm, SettingsRowMenu } from './settings-common'
import { applyApiError, type DialogState } from './settings-helpers'
import { SettingsTable, ViewHeader } from './settings-list'
import { SETTINGS_PAGE_SIZE } from './settings-nav'

const required = (label: string) => z.string().trim().min(1, `Enter the ${label}`).max(120)

const schema = z.object({
  accountHolder: required('account holder'),
  accountNumber: required('account number'),
  bankName: required('bank name'),
  branchName: required('branch name'),
  branchCode: required('branch code'),
  branchLocation: z.string().trim().max(120),
  bankCode: z.string().trim().max(40),
  taxPayerId: z.string().trim().max(40),
  effectiveDate: z.string().min(1, 'Choose the effective date'),
})
type Values = z.infer<typeof schema>

const empty: Values = {
  accountHolder: '',
  accountNumber: '',
  bankName: '',
  branchName: '',
  branchCode: '',
  branchLocation: '',
  bankCode: '',
  taxPayerId: '',
  effectiveDate: '',
}

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
    defaultValues: record ? { ...empty, ...record } : empty,
  })
  const submit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await save.mutateAsync({ id: record?.id, input: values })
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
          <TextField control={form.control} name="branchName" label="Branch Name" required />
          <TextField control={form.control} name="branchCode" label="Branch Code" required />
          <TextField control={form.control} name="branchLocation" label="Branch Location" />
          <TextField control={form.control} name="bankCode" label="Bank Code (IFSC)" />
          <TextField control={form.control} name="taxPayerId" label="Tax Payer ID (PAN)" />
          <DateField
            control={form.control}
            name="effectiveDate"
            label="Effective Date"
            required
            disabled={readOnly}
          />
        </fieldset>
      </form>
    </PayrollDialog>
  )
}

const columns: DataTableColumn<DisbursementBank>[] = [
  { id: 'bank', header: 'Bank Name', cell: (row) => row.bankName, mobile: 'heading' },
  { id: 'branch', header: 'Branch Name', cell: (row) => row.branchName },
  { id: 'code', header: 'Branch Code', cell: (row) => row.branchCode },
  { id: 'date', header: 'Effective Date', cell: (row) => formatLong(row.effectiveDate) },
]

/** Settings → Disbursement Banks: the company's paying accounts. */
export function BanksView() {
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<DialogState<DisbursementBank>>(null)
  const [deleting, setDeleting] = useState<DisbursementBank | null>(null)
  const list = useResourceList('banks', { page, pageSize: SETTINGS_PAGE_SIZE })
  const remove = useDeleteResource('banks')

  return (
    <>
      <ViewHeader
        tab="disbursement-banks"
        view={null}
        actions={
          <CreateButton
            onClick={() => {
              setDialog({ mode: 'create' })
            }}
          />
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
            label={`Actions for ${row.bankName} (${row.branchName})`}
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
        idOf={(row) => row.id}
      />
    </>
  )
}
