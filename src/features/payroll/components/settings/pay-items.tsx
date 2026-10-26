import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { FieldLayoutContext, SelectField, TextareaField, TextField } from '@/components/form'
import type { DataTableColumn } from '@/components/layout'
import { Checkbox } from '@/components/ui/checkbox'

import {
  CALCULATION_TYPE_LABELS,
  PAY_ITEM_TYPE_LABELS,
  TAX_DISTRIBUTION_LABELS,
} from '../../constants'
import {
  useDeleteResource,
  useResourceList,
  useResourceLookup,
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
import { applyApiError, type DialogState, orNull } from './settings-helpers'
import { SettingsTable, ViewHeader } from './settings-list'
import { SETTINGS_PAGE_SIZE } from './settings-nav'
import { rowMenuHandlers, useSettingsCan } from './settings-permissions'

const schema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name').max(200, 'Keep it under 200 characters'),
    label: z.string().trim().max(200),
    taxDistribution: z.enum(TAX_DISTRIBUTIONS),
    itemType: z.string().min(1, 'Choose the pay item type'),
    calculationType: z.string().min(1, 'Choose the calculation type'),
    employeeFormulaId: z.string().nullable(),
    employerContribution: z.enum(['no', 'yes']),
    employerFormulaId: z.string(),
    isTaxable: z.boolean(),
    isDisplayOnly: z.boolean(),
    isBenefit: z.boolean(),
    isAdvancePayment: z.boolean(),
    eligibilityExpression: z.string().trim().max(2000),
    description: z.string().trim().max(2000),
  })
  .refine((value) => value.calculationType !== 'formula' || Boolean(value.employeeFormulaId), {
    message: 'Choose the formula',
    path: ['employeeFormulaId'],
  })
  .refine((value) => value.employerContribution === 'no' || value.employerFormulaId !== '', {
    message: 'Choose the employer contribution formula',
    path: ['employerFormulaId'],
  })
type Values = z.infer<typeof schema>

function toValues(record: PayItem | undefined): Values {
  return {
    name: record?.name ?? '',
    label: record?.label ?? '',
    taxDistribution: record?.taxDistribution ?? 'remaining_months',
    itemType: record?.itemType ?? '',
    calculationType: record?.calculationType ?? '',
    employeeFormulaId: record?.employeeFormulaId ?? '',
    employerContribution: record?.employerFormulaId ? 'yes' : 'no',
    employerFormulaId: record?.employerFormulaId ?? '',
    isTaxable: record?.isTaxable ?? false,
    isDisplayOnly: record?.isDisplayOnly ?? false,
    isBenefit: record?.isBenefit ?? false,
    isAdvancePayment: record?.isAdvancePayment ?? false,
    eligibilityExpression: record?.eligibilityExpression ?? '',
    description: record?.description ?? '',
  }
}

const FLAGS = [
  ['isTaxable', 'Taxable'],
  ['isDisplayOnly', 'Display Only'],
  ['isBenefit', 'Benefit'],
  ['isAdvancePayment', 'Is Advance Payment'],
] as const

/**
 * "Pay Item Create": name, how it is taxed and worked out, its formulas and flags.
 * Formula items take their amount from the employee formula; fixed / manual items from the
 * person's pay items or a hand entry. The eligibility condition decides who gets it.
 */
function PayItemDialog({
  state,
  onClose,
}: {
  state: Exclude<DialogState<PayItem>, null>
  onClose: () => void
}) {
  const record = state.mode === 'create' ? undefined : state.record
  const readOnly = state.mode === 'view'
  // The system works its own items out: their type and calculation cannot change.
  const systemItem = Boolean(record?.systemCode)
  const save = useSaveResource('payItems')
  const formulaList = useResourceLookup('formulas')
  const [error, setError] = useState<string | null>(null)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(record) })
  const [calculationType, employer, employeeFormulaId] = useWatch({
    control: form.control,
    name: ['calculationType', 'employerContribution', 'employeeFormulaId'],
  })
  const formulas = (formulaList.data?.data ?? []).map((item) => ({
    value: item.id,
    label: item.name,
    hint: item.expression,
  }))
  const chosen = formulaList.data?.data.find((item) => item.id === employeeFormulaId)

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    const itemType = PAY_ITEM_TYPES.find((item) => item === values.itemType)
    const calc = CALCULATION_TYPES.find((item) => item === values.calculationType)
    if (!itemType || !calc) return
    try {
      await save.mutateAsync({
        id: record?.id,
        input: {
          name: values.name,
          label: values.label || null,
          itemType,
          calculationType: calc,
          taxDistribution: values.taxDistribution,
          employeeFormulaId: orNull(values.employeeFormulaId),
          employerFormulaId:
            values.employerContribution === 'yes' && values.employerFormulaId
              ? values.employerFormulaId
              : null,
          isTaxable: values.isTaxable,
          isDisplayOnly: values.isDisplayOnly,
          isBenefit: values.isBenefit,
          isAdvancePayment: values.isAdvancePayment,
          eligibilityExpression: values.eligibilityExpression || null,
          description: values.description || null,
          rowVersion: record?.rowVersion ?? null,
        },
      })
      onClose()
    } catch (failure) {
      setError(
        applyApiError(failure, form.setError, [
          'name',
          'employeeFormulaId',
          'employerFormulaId',
          'eligibilityExpression',
        ]),
      )
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
        {record && (
          <p className="font-inter text-sm text-muted-foreground">
            Used in expressions as <span className="font-mono">{record.reference}</span>
            {record.systemCode ? ' (added by the system: it cannot be deleted)' : ''}
          </p>
        )}
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
          name="itemType"
          label="Pay item Type"
          placeholder="Select Pay item Type"
          required
          disabled={readOnly || systemItem}
          options={PAY_ITEM_TYPES.map((value) => ({ value, label: PAY_ITEM_TYPE_LABELS[value] }))}
        />
        <SearchSelectField
          control={form.control}
          name="calculationType"
          label="Calculation Type"
          placeholder="Select Calculation Type"
          required
          disabled={readOnly || systemItem}
          options={CALCULATION_TYPES.map((value) => ({
            value,
            label: CALCULATION_TYPE_LABELS[value],
          }))}
        />
        <SearchSelectField
          control={form.control}
          name="employeeFormulaId"
          label="Employee Formula"
          placeholder="Select Formula"
          required={calculationType === 'formula'}
          clearable
          disabled={readOnly}
          options={formulas}
        />
        {chosen && (
          <p className="font-mono text-xs break-words text-muted-foreground">{chosen.expression}</p>
        )}
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
        <ExpressionField
          control={form.control}
          name="eligibilityExpression"
          label="Eligibility Criteria"
          description="A condition; only people it is true for get this item. Leave blank for everyone."
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

const columns: DataTableColumn<PayItem>[] = [
  { id: 'name', header: 'Name', cell: (row) => row.name, mobile: 'heading' },
  { id: 'type', header: 'Type', cell: (row) => PAY_ITEM_TYPE_LABELS[row.itemType] },
  {
    id: 'calculation',
    header: 'Calculation Type',
    cell: (row) => CALCULATION_TYPE_LABELS[row.calculationType],
  },
  {
    id: 'expression',
    header: 'Expression',
    cell: (row) => (
      <span className="line-clamp-2 max-w-72 whitespace-normal">{row.expression ?? '—'}</span>
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
  const may = useSettingsCan('payComponents')

  return (
    <>
      <ViewHeader
        tab="pay-components"
        view="pay-items"
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
            {...rowMenuHandlers(may, row, setDialog, setDeleting, row.systemCode === null)}
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
      />
    </>
  )
}
