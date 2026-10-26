import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { TextareaField, TextField } from '@/components/form'
import type { DataTableColumn } from '@/components/layout'

import { INCENTIVE_TYPE_LABELS, VALUE_TYPE_LABELS } from '../../constants'
import {
  useDeleteResource,
  useOrganisationLookup,
  useResourceList,
  useSaveResource,
} from '../../hooks/use-payroll'
import { INCENTIVE_TYPES, type IncentiveRow, type ValueType } from '../../types/payroll.types'
import { formatMonth, formatRs, monthOf, monthStart } from '../../utils/format'
import { MonthField } from '../shared/month-picker'
import { PayrollDialog } from '../shared/payroll-dialog'
import { SearchSelectField } from '../shared/search-select'
import { TwoWaySwitchField } from '../shared/two-way-switch'
import { CreateButton, DeleteConfirm, SettingsRowMenu } from './settings-common'
import { amountText, applyApiError, type DialogState, toAmount } from './settings-helpers'
import { SettingsTable, ViewHeader } from './settings-list'
import { SETTINGS_PAGE_SIZE } from './settings-nav'
import { rowMenuHandlers, useSettingsCan } from './settings-permissions'

const positive = (message: string) =>
  amountText(message).refine((value) => toAmount(value) > 0, { message })

const schema = z
  .object({
    branchId: z.string().min(1, 'Choose the branch'),
    month: z.string().min(1, 'Choose the month'),
    incentiveType: z.string().min(1, 'Choose the incentive type'),
    amount: positive('Enter the target amount'),
    valueType: z.enum(['percentage', 'flat']),
    value: positive('Enter the value'),
    description: z.string().trim().max(2000),
  })
  .refine((value) => value.valueType !== 'percentage' || toAmount(value.value) <= 100, {
    message: 'A percentage cannot be above 100',
    path: ['value'],
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
  const branches = useOrganisationLookup('branches')
  const [error, setError] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      branchId: record?.branchId ?? '',
      month: monthOf(record?.applicableMonth),
      incentiveType: record?.incentiveType ?? '',
      amount: record ? String(record.targetAmount) : '',
      valueType: record?.valueType ?? 'percentage',
      value: record ? String(record.rewardValue) : '',
      description: record?.description ?? '',
    },
  })
  const submit = form.handleSubmit(async (values) => {
    setError(null)
    const incentiveType = INCENTIVE_TYPES.find((item) => item === values.incentiveType)
    if (!incentiveType) return
    try {
      await save.mutateAsync({
        id: record?.id,
        input: {
          branchId: values.branchId,
          applicableMonth: monthStart(values.month),
          incentiveType,
          targetAmount: toAmount(values.amount),
          valueType: values.valueType,
          rewardValue: toAmount(values.value),
          description: values.description || null,
          rowVersion: record?.rowVersion ?? null,
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
          options={(branches.data ?? []).map((branch) => ({
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
          options={INCENTIVE_TYPES.map((value) => ({
            value,
            label: INCENTIVE_TYPE_LABELS[value],
          }))}
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

const columns: DataTableColumn<IncentiveRow>[] = [
  { id: 'branch', header: 'Branch', cell: (row) => row.branchName, mobile: 'heading' },
  { id: 'month', header: 'Applicable Month', cell: (row) => formatMonth(row.applicableMonth) },
  {
    id: 'type',
    header: 'Incentive Type',
    cell: (row) => INCENTIVE_TYPE_LABELS[row.incentiveType],
  },
  { id: 'amount', header: 'Amount', cell: (row) => formatRs(row.targetAmount) },
  { id: 'valueType', header: 'Type', cell: (row) => VALUE_TYPE_LABELS[row.valueType] },
  {
    id: 'value',
    header: 'Value',
    cell: (row) =>
      row.valueType === 'percentage' ? `${row.rewardValue}%` : formatRs(row.rewardValue),
  },
]

/** Rewards → Incentives: sales targets per branch and what reaching them pays. */
export function IncentivesView() {
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<DialogState<IncentiveRow>>(null)
  const [deleting, setDeleting] = useState<IncentiveRow | null>(null)
  const list = useResourceList('incentives', { page, pageSize: SETTINGS_PAGE_SIZE })
  const remove = useDeleteResource('incentives')
  const may = useSettingsCan('rewards')

  return (
    <>
      <ViewHeader
        tab="rewards"
        view="incentives"
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
        caption="Incentives"
        columns={columns}
        page={list.data}
        getRowId={(row) => row.id}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        onPageChange={setPage}
        rowActions={(row) => (
          <SettingsRowMenu
            label={`Actions for ${row.branchName} incentive`}
            {...rowMenuHandlers(may, row, setDialog, setDeleting)}
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
      />
    </>
  )
}
