import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { TextField } from '@/components/form'
import type { DataTableColumn } from '@/components/layout'

import { BENEFIT_TYPE_LABELS, VALUE_TYPE_LABELS } from '../../constants'
import {
  useDeleteResource,
  usePayrollLookups,
  useResourceList,
  useSaveResource,
} from '../../hooks/use-payroll'
import { BENEFIT_TYPES, type IncentiveRow, type ValueType } from '../../types/payroll.types'
import { formatMonth, formatRs } from '../../utils/format'
import { MonthField } from '../shared/month-picker'
import { PayrollDialog } from '../shared/payroll-dialog'
import { SearchSelectField } from '../shared/search-select'
import { TwoWaySwitchField } from '../shared/two-way-switch'
import { CreateButton, DeleteConfirm, SettingsRowMenu } from './settings-common'
import { amountText, applyApiError, type DialogState, toAmount } from './settings-helpers'
import { SettingsTable, ViewHeader } from './settings-list'
import { SETTINGS_PAGE_SIZE } from './settings-nav'

const positive = (message: string) =>
  amountText(message).refine((value) => toAmount(value) > 0, { message })

const schema = z.object({
  branchId: z.string().min(1, 'Choose the branch'),
  month: z.string().min(1, 'Choose the month'),
  incentiveType: z.string().min(1, 'Choose the incentive type'),
  amount: positive('Enter the target amount'),
  valueType: z.enum(['percentage', 'flat']),
  value: positive('Enter the value'),
})
type Values = z.infer<typeof schema>

/** "Sale Incentive Create": reach the target Amount in the month to earn Value. */
function IncentiveDialog({
  state,
  onClose,
}: {
  state: Exclude<DialogState<IncentiveRow>, null>
  onClose: () => void
}) {
  const record = state.mode === 'create' ? undefined : state.record
  const readOnly = state.mode === 'view'
  const save = useSaveResource('incentives')
  const lookups = usePayrollLookups()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      branchId: record?.branchId ?? '',
      month: record?.month ?? '',
      incentiveType: record?.incentiveType ?? '',
      amount: record ? String(record.amount) : '',
      valueType: record?.valueType ?? 'percentage',
      value: record ? String(record.value) : '',
    },
  })
  const submit = form.handleSubmit(async (values) => {
    setError(null)
    const incentiveType = BENEFIT_TYPES.find((item) => item === values.incentiveType)
    if (!incentiveType) return
    try {
      await save.mutateAsync({
        id: record?.id,
        input: {
          branchId: values.branchId,
          month: values.month,
          incentiveType,
          amount: toAmount(values.amount),
          valueType: values.valueType,
          value: toAmount(values.value),
        },
      })
      onClose()
    } catch (failure) {
      setError(applyApiError(failure, form.setError, ['branchId', 'month', 'amount', 'value']))
    }
  })
  const title =
    state.mode === 'create'
      ? 'Sale Incentive Create'
      : state.mode === 'edit'
        ? 'Sale Incentive Edit'
        : 'Sale Incentive View'

  return (
    <PayrollDialog
      title={title}
      onClose={onClose}
      formId="incentive-form"
      readOnly={readOnly}
      pending={save.isPending}
      error={error}
    >
      <form
        id="incentive-form"
        noValidate
        onSubmit={(event) => void submit(event)}
        className="grid gap-5"
      >
        <SearchSelectField
          control={form.control}
          name="branchId"
          label="Branch"
          placeholder="Select Branch"
          required
          disabled={readOnly}
          options={(lookups.data?.branches ?? []).map((branch) => ({
            value: branch.id,
            label: branch.name,
          }))}
        />
        <MonthField
          control={form.control}
          name="month"
          label="Applicable Month"
          required
          disabled={readOnly}
        />
        <SearchSelectField
          control={form.control}
          name="incentiveType"
          label="Incentive Type"
          placeholder="Select Incentive Type"
          required
          disabled={readOnly}
          options={BENEFIT_TYPES.map((value) => ({ value, label: BENEFIT_TYPE_LABELS[value] }))}
        />
        <TextField
          control={form.control}
          name="amount"
          label="Amount"
          required
          inputMode="decimal"
          placeholder="Amount in RS"
          description="Amount (Target or sale amount which must need to achieve)."
          disabled={readOnly}
        />
        <TwoWaySwitchField<Values, ValueType>
          control={form.control}
          name="valueType"
          label="Type"
          ariaLabel="Type"
          options={[
            { value: 'percentage', label: VALUE_TYPE_LABELS.percentage },
            { value: 'flat', label: VALUE_TYPE_LABELS.flat },
          ]}
          disabled={readOnly}
        />
        <TextField
          control={form.control}
          name="value"
          label="Value"
          required
          inputMode="decimal"
          placeholder={'Only value, e.g. "5"'}
          description={'Only value, e.g. "5"'}
          disabled={readOnly}
        />
      </form>
    </PayrollDialog>
  )
}

const columns: DataTableColumn<IncentiveRow>[] = [
  { id: 'code', header: 'Code', cell: (row) => row.code },
  { id: 'branch', header: 'Branch', cell: (row) => row.branchName, mobile: 'heading' },
  { id: 'month', header: 'Applicable Month', cell: (row) => formatMonth(row.month) },
  { id: 'type', header: 'Incentive Type', cell: (row) => BENEFIT_TYPE_LABELS[row.incentiveType] },
  { id: 'amount', header: 'Amount', cell: (row) => formatRs(row.amount) },
  { id: 'valueType', header: 'Type', cell: (row) => VALUE_TYPE_LABELS[row.valueType] },
  {
    id: 'value',
    header: 'Value',
    cell: (row) => (row.valueType === 'percentage' ? `${row.value}%` : formatRs(row.value)),
  },
]

/** Rewards → Incentives: sales targets per branch and what reaching them pays. */
export function IncentivesView() {
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<DialogState<IncentiveRow>>(null)
  const [deleting, setDeleting] = useState<IncentiveRow | null>(null)
  const list = useResourceList('incentives', { page, pageSize: SETTINGS_PAGE_SIZE })
  const remove = useDeleteResource('incentives')

  return (
    <>
      <ViewHeader
        tab="rewards"
        view="incentives"
        actions={
          <CreateButton
            onClick={() => {
              setDialog({ mode: 'create' })
            }}
          />
        }
      />
      <SettingsTable
        caption="Incentives"
        columns={columns}
        page={list.data}
        getRowId={(row) => row.id}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        onPageChange={setPage}
        rowActions={(row) => (
          <SettingsRowMenu
            label={`Actions for ${row.code}`}
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
        <IncentiveDialog
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
