import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { FieldLayoutContext, SelectField, TextField } from '@/components/form'
import type { DataTableColumn } from '@/components/layout'
import { Checkbox } from '@/components/ui/checkbox'

import {
  CALCULATION_TYPE_LABELS,
  PAY_ITEM_TYPE_LABELS,
  TAX_DISTRIBUTION_LABELS,
} from '../../constants'
import {
  useDeleteResource,
  usePayrollLookups,
  useResourceList,
  useSaveResource,
} from '../../hooks/use-payroll'
import {
  CALCULATION_TYPES,
  PAY_ITEM_TYPES,
  type PayItem,
  TAX_DISTRIBUTIONS,
} from '../../types/payroll.types'
import { PayrollDialog } from '../shared/payroll-dialog'
import { SearchSelectField } from '../shared/search-select'
import { TwoWaySwitchField } from '../shared/two-way-switch'
import { CreateButton, DeleteConfirm, ExpressionField, SettingsRowMenu } from './settings-common'
import { applyApiError, type DialogState } from './settings-helpers'
import { SettingsTable, ViewHeader } from './settings-list'
import { SETTINGS_PAGE_SIZE } from './settings-nav'

const schema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name').max(80, 'Keep it under 80 characters'),
    label: z.string().trim().max(80),
    taxDistribution: z.enum(TAX_DISTRIBUTIONS),
    type: z.string().min(1, 'Choose the pay item type'),
    calculationType: z.string().min(1, 'Choose the calculation type'),
    employeeFormulaId: z.string(),
    employerContribution: z.enum(['no', 'yes']),
    employerFormulaId: z.string(),
    displayOnly: z.boolean(),
    benefit: z.boolean(),
    eligibilityCriteria: z.boolean(),
    isAdvancePayment: z.boolean(),
    expression: z.string().trim().max(500),
  })
  .refine(
    (value) =>
      value.calculationType !== 'fixed' ||
      value.expression.length > 0 ||
      (value.type === 'deduction' && value.employeeFormulaId !== ''),
    {
      message: 'A fixed pay item needs an expression',
      path: ['expression'],
    },
  )
  .refine(
    (value) =>
      value.type !== 'deduction' ||
      value.calculationType !== 'fixed' ||
      value.employeeFormulaId !== '' ||
      value.expression.length > 0,
    { message: 'Choose the employee deduction formula', path: ['employeeFormulaId'] },
  )
  .refine(
    (value) =>
      value.type !== 'deduction' ||
      value.employerContribution === 'no' ||
      value.employerFormulaId !== '',
    { message: 'Choose the employer contribution formula', path: ['employerFormulaId'] },
  )
type Values = z.infer<typeof schema>

function toValues(record: PayItem | undefined): Values {
  return {
    name: record?.name ?? '',
    label: record?.label ?? '',
    taxDistribution: record?.taxDistribution ?? 'remaining-months',
    type: record?.type ?? '',
    calculationType: record?.calculationType ?? '',
    employeeFormulaId: record?.employeeFormulaId ?? '',
    employerContribution: record?.employerContribution ? 'yes' : 'no',
    employerFormulaId: record?.employerFormulaId ?? '',
    displayOnly: record?.displayOnly ?? false,
    benefit: record?.benefit ?? false,
    eligibilityCriteria: record?.eligibilityCriteria ?? false,
    isAdvancePayment: record?.isAdvancePayment ?? false,
    expression: record?.expression ?? '',
  }
}

const FLAGS = [
  ['displayOnly', 'Display Only'],
  ['benefit', 'Benefit'],
  ['eligibilityCriteria', 'Eligibility Criteria'],
  ['isAdvancePayment', 'Is Advance Payment'],
] as const

/** "Pay Item Create": name, how it is taxed and worked out, its formulas and flags. */
function PayItemDialog({
  state,
  onClose,
}: {
  state: Exclude<DialogState<PayItem>, null>
  onClose: () => void
}) {
  const record = state.mode === 'create' ? undefined : state.record
  const readOnly = state.mode === 'view'
  const save = useSaveResource('payItems')
  const lookups = usePayrollLookups()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(record) })
  const [type, calculationType, employer] = useWatch({
    control: form.control,
    name: ['type', 'calculationType', 'employerContribution'],
  })
  const formulas = (lookups.data?.formulas ?? []).map((item) => ({
    value: item.id,
    label: item.name,
  }))
  const deduction = type === 'deduction'

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    const payType = PAY_ITEM_TYPES.find((item) => item === values.type)
    const calc = CALCULATION_TYPES.find((item) => item === values.calculationType)
    if (!payType || !calc) return
    const isDeduction = payType === 'deduction'
    try {
      await save.mutateAsync({
        id: record?.id,
        input: {
          name: values.name,
          label: values.label,
          taxDistribution: values.taxDistribution,
          type: payType,
          calculationType: calc,
          expression: calc === 'manual' ? '' : values.expression,
          employeeFormulaId:
            isDeduction && values.employeeFormulaId ? values.employeeFormulaId : null,
          employerContribution: isDeduction && values.employerContribution === 'yes',
          employerFormulaId:
            isDeduction && values.employerContribution === 'yes' && values.employerFormulaId
              ? values.employerFormulaId
              : null,
          displayOnly: values.displayOnly,
          benefit: values.benefit,
          eligibilityCriteria: values.eligibilityCriteria,
          isAdvancePayment: values.isAdvancePayment,
        },
      })
      onClose()
    } catch (failure) {
      setError(applyApiError(failure, form.setError, ['name', 'expression', 'employerFormulaId']))
    }
  })
  const title =
    state.mode === 'create'
      ? 'Pay Item Create'
      : state.mode === 'edit'
        ? 'Pay Item Edit'
        : 'Pay Item View'

  return (
    <PayrollDialog
      title={title}
      onClose={onClose}
      formId="pay-item-form"
      readOnly={readOnly}
      pending={save.isPending}
      error={error}
    >
      <form
        id="pay-item-form"
        noValidate
        onSubmit={(event) => void submit(event)}
        className="grid gap-5"
      >
        <TextField control={form.control} name="name" label="Name" required disabled={readOnly} />
        <TextField control={form.control} name="label" label="Label" disabled={readOnly} />
        <SelectField
          control={form.control}
          name="taxDistribution"
          label="Tax Distribution"
          disabled={readOnly}
          options={TAX_DISTRIBUTIONS.map((value) => ({
            value,
            label: TAX_DISTRIBUTION_LABELS[value],
          }))}
        />
        <SearchSelectField
          control={form.control}
          name="type"
          label="Pay item Type"
          placeholder="Select Pay item Type"
          required
          disabled={readOnly}
          options={PAY_ITEM_TYPES.map((value) => ({ value, label: PAY_ITEM_TYPE_LABELS[value] }))}
        />
        <SearchSelectField
          control={form.control}
          name="calculationType"
          label="Calculation Type"
          placeholder="Select Calculation Type"
          required
          disabled={readOnly}
          options={CALCULATION_TYPES.map((value) => ({
            value,
            label: CALCULATION_TYPE_LABELS[value],
          }))}
        />
        {deduction && (
          <>
            <SearchSelectField
              control={form.control}
              name="employeeFormulaId"
              label="Employee Deduction(Formula)"
              placeholder="Select Employee Deduction Formula"
              required={calculationType === 'fixed'}
              disabled={readOnly}
              options={formulas}
            />
            <TwoWaySwitchField<Values, 'no' | 'yes'>
              control={form.control}
              name="employerContribution"
              label="Employer Contribution (Formula)"
              ariaLabel="Employer Contribution"
              options={[
                { value: 'no', label: 'No' },
                { value: 'yes', label: 'Yes' },
              ]}
              disabled={readOnly}
            />
            {employer === 'yes' && (
              <SearchSelectField
                control={form.control}
                name="employerFormulaId"
                label="Employer Contribution (Formula)"
                placeholder="Select Employer Contribution"
                required
                disabled={readOnly}
                options={formulas}
              />
            )}
          </>
        )}
        <FieldLayoutContext value="vertical">
          <div className="flex flex-wrap items-center gap-x-10 gap-y-3">
            {FLAGS.map(([name, text]) => (
              <Controller
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <label className="flex items-center gap-3 font-inter text-sm text-heading sm:text-base">
                    {text}
                    <Checkbox
                      checked={field.value}
                      disabled={readOnly}
                      onCheckedChange={(checked) => {
                        field.onChange(checked === true)
                      }}
                    />
                  </label>
                )}
              />
            ))}
          </div>
        </FieldLayoutContext>
        {calculationType !== 'manual' && (
          <ExpressionField
            control={form.control}
            name="expression"
            required={calculationType === 'fixed' && !deduction}
            disabled={readOnly}
          />
        )}
      </form>
    </PayrollDialog>
  )
}

const columns: DataTableColumn<PayItem>[] = [
  { id: 'name', header: 'Name', cell: (row) => row.name, mobile: 'heading' },
  { id: 'type', header: 'Type', cell: (row) => PAY_ITEM_TYPE_LABELS[row.type] },
  {
    id: 'calculation',
    header: 'Calculation Type',
    cell: (row) => CALCULATION_TYPE_LABELS[row.calculationType],
  },
  {
    id: 'expression',
    header: 'Expression',
    cell: (row) => (
      <span className="line-clamp-2 max-w-72 whitespace-normal">{row.expression || '—'}</span>
    ),
  },
]

/** Pay Components → Pay Items: every earning, deduction and data item a payroll can use. */
export function PayItemsView() {
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<DialogState<PayItem>>(null)
  const [deleting, setDeleting] = useState<PayItem | null>(null)
  const list = useResourceList('payItems', { page, pageSize: SETTINGS_PAGE_SIZE })
  const remove = useDeleteResource('payItems')

  return (
    <>
      <ViewHeader
        tab="pay-components"
        view="pay-items"
        actions={
          <CreateButton
            onClick={() => {
              setDialog({ mode: 'create' })
            }}
          />
        }
      />
      <SettingsTable
        caption="Pay Items"
        columns={columns}
        page={list.data}
        getRowId={(row) => row.id}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        onPageChange={setPage}
        rowActions={(row) => (
          <SettingsRowMenu
            label={`Actions for ${row.name}`}
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
        <PayItemDialog
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
