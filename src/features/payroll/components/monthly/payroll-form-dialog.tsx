import { useState } from 'react'
import { type Control, Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CircleX } from 'lucide-react'

import { CheckboxField, FormField, SelectField, TextareaField, TextField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { PAY_ITEM_TYPE_LABELS } from '../../constants'
import { usePayrollLookups, useSavePayroll } from '../../hooks/use-payroll'
import {
  emptyPayrollForm,
  payrollFormSchema,
  type PayrollFormValues,
  toPayrollForm,
  toPayrollInput,
} from '../../schemas/payroll-form.schema'
import type { PayrollRow } from '../../types/payroll.types'
import { btn, toolbarButton } from '../../utils/styles'
import { NoRecord } from '../shared/no-record'
import { PayrollDialog } from '../shared/payroll-dialog'
import { SearchSelect } from '../shared/search-select'
import { TwoWaySwitchField } from '../shared/two-way-switch'

const FORM_ID = 'payroll-monthly-form'
/** The switches' side not chosen, as this form draws it (Inter Regular 16 #585858). */
const SWITCH_OFF = 'text-[#585858] dark:text-grey'
const DAYS = Array.from({ length: 31 }, (_, index) => ({
  value: String(index + 1),
  label: String(index + 1),
}))

/**
 * "Payrolls Monthly" (Create, Edit) and "Payrolls View": Name, Currency, Tax
 * Structure, Tax Applicable, Payroll Processing, Processing Date, Applicable
 * Days (and No of Fixed Days), Company Bank, Description and the Pay Items.
 */
export function PayrollFormDialog({
  payroll,
  mode,
  onClose,
  onHistory,
}: {
  payroll: PayrollRow | null
  mode: 'create' | 'edit' | 'view'
  onClose: () => void
  onHistory?: () => void
}) {
  const lookups = usePayrollLookups()
  const save = useSavePayroll()
  const [error, setError] = useState<string | null>(null)
  const readOnly = mode === 'view'
  const form = useForm<PayrollFormValues>({
    resolver: zodResolver(payrollFormSchema),
    defaultValues: payroll ? toPayrollForm(payroll) : emptyPayrollForm(),
  })
  const rows = useFieldArray({ control: form.control, name: 'payItems' })
  const applicableDays = useWatch({ control: form.control, name: 'applicableDays' })
  const payItems = lookups.data?.payItems ?? []
  const payItemOptions = payItems.map((item) => ({ value: item.id, label: item.name }))
  const itemsError =
    form.formState.errors.payItems?.root?.message ?? form.formState.errors.payItems?.message

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await save.mutateAsync({ id: payroll?.id, input: toPayrollInput(values) })
      onClose()
    } catch (failure) {
      if (failure instanceof ApiError) {
        const [field, message] = Object.entries(failure.fieldErrors)[0] ?? []
        if (field === 'name' && message) form.setError('name', { message })
        else setError(failure.message)
      } else setError('The payroll could not be saved.')
    }
  })

  return (
    <PayrollDialog
      title={readOnly ? 'Payrolls View' : 'Payrolls Monthly'}
      onClose={onClose}
      formId={FORM_ID}
      readOnly={readOnly}
      pending={save.isPending}
      error={error}
      labelSize="large"
      className="max-w-5xl"
    >
      {readOnly && onHistory && (
        <div className="-mt-2 mb-4 flex justify-end">
          <Button onClick={onHistory} className={cn(toolbarButton, btn.history, 'px-8')}>
            History
          </Button>
        </div>
      )}
      <form id={FORM_ID} noValidate onSubmit={(event) => void submit(event)} className="grid gap-5">
        <fieldset disabled={readOnly} className="grid gap-5">
          <TextField
            control={form.control}
            name="name"
            label="Name"
            placeholder="Enter name"
            required
          />
          <SelectField
            control={form.control}
            name="currency"
            label="Currency"
            options={[{ value: 'PKR', label: 'Rupees' }]}
            required
            disabled={readOnly}
          />
          <SelectField
            control={form.control}
            name="taxStructureId"
            label="Tax Structure"
            placeholder="Select Tax Structure"
            options={(lookups.data?.taxStructures ?? []).map((item) => ({
              value: item.id,
              label: item.name,
            }))}
            required
            disabled={readOnly}
          />
          <div className="grid gap-5 @3xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <CheckboxField
              control={form.control}
              name="taxApplicable"
              label="Tax Applicable"
              disabled={readOnly}
            />
            <TwoWaySwitchField
              control={form.control}
              name="processing"
              label="Payroll Processing"
              ariaLabel="Payroll Processing"
              offClassName={SWITCH_OFF}
              options={[
                { value: 'from-date', label: 'Process from Date' },
                { value: 'month-end', label: 'Process at Month End' },
              ]}
              disabled={readOnly}
            />
          </div>
          <SelectField
            control={form.control}
            name="processingDay"
            label="Payroll Processing Date"
            placeholder="Day of the month"
            options={DAYS}
            required
            disabled={readOnly}
          />
          <TwoWaySwitchField
            control={form.control}
            name="applicableDays"
            label="Applicable Days"
            ariaLabel="Applicable Days"
            offClassName={SWITCH_OFF}
            options={[
              { value: 'actual', label: 'Actual' },
              { value: 'fixed', label: 'Fixed' },
            ]}
            disabled={readOnly}
          />
          {applicableDays === 'fixed' && (
            <TextField
              control={form.control}
              name="fixedDays"
              label="No of Fixed Days"
              inputMode="numeric"
              placeholder="e.g. 30"
              required
            />
          )}
          <SelectField
            control={form.control}
            name="companyBankId"
            label="Company Bank"
            placeholder="Select Bank"
            options={(lookups.data?.banks ?? []).map((item) => ({
              value: item.id,
              label: item.name,
            }))}
            clearable="No bank (cash)"
            disabled={readOnly}
          />
          <TextareaField control={form.control} name="description" label="Description" rows={5} />
        </fieldset>

        <section aria-labelledby={`${FORM_ID}-items`} className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3
              id={`${FORM_ID}-items`}
              className="font-inter text-xl font-medium text-heading sm:text-2xl"
            >
              Pay Items
            </h3>
            {!readOnly && (
              <Button
                type="button"
                onClick={() => {
                  rows.append({
                    payItemId: '',
                    taxable: false,
                    arrearApplicable: false,
                    finalSettlement: true,
                    calculateOnly: false,
                  })
                }}
                className={cn(toolbarButton, btn.navy, 'w-24')}
              >
                +Add
              </Button>
            )}
          </div>
          {itemsError && (
            <p role="alert" className="text-sm text-destructive">
              {itemsError}
            </p>
          )}
          {rows.fields.length === 0 ? (
            <NoRecord />
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <caption className="sr-only">Pay items of the payroll</caption>
                <thead>
                  <tr className="font-inter text-[0.9375rem] text-[#585858] dark:text-heading">
                    <th scope="col" className="w-64 px-2 py-2 font-semibold">
                      Payitem Name <span className="text-[#E50141]">*</span>
                    </th>
                    <th scope="col" className="px-2 py-2 font-semibold">
                      Taxable
                    </th>
                    <th scope="col" className="px-2 py-2 font-semibold">
                      Type
                    </th>
                    <th scope="col" className="px-2 py-2 font-semibold">
                      Arrear Applicable
                    </th>
                    <th scope="col" className="px-2 py-2 font-semibold">
                      Final Settlement
                    </th>
                    <th scope="col" className="px-2 py-2 font-semibold">
                      Calculate Only
                    </th>
                    <th scope="col" className="px-2 py-2 text-center font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.fields.map((row, index) => (
                    <PayItemRow
                      key={row.id}
                      index={index}
                      control={form.control}
                      options={payItemOptions}
                      typeOf={(id) => {
                        const type = payItems.find((item) => item.id === id)?.type
                        return type ? PAY_ITEM_TYPE_LABELS[type] : '—'
                      }}
                      readOnly={readOnly}
                      onRemove={() => {
                        rows.remove(index)
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </form>
    </PayrollDialog>
  )
}

function PayItemRow({
  index,
  control,
  options,
  typeOf,
  readOnly,
  onRemove,
}: {
  index: number
  control: Control<PayrollFormValues>
  options: { value: string; label: string }[]
  typeOf: (payItemId: string) => string
  readOnly: boolean
  onRemove: () => void
}) {
  const payItemId = useWatch({ control, name: `payItems.${index}.payItemId` })
  const name = options.find((option) => option.value === payItemId)?.label ?? `row ${index + 1}`
  const flags = [
    ['taxable', 'Taxable'],
    ['arrearApplicable', 'Arrear Applicable'],
    ['finalSettlement', 'Final Settlement'],
    ['calculateOnly', 'Calculate Only'],
  ] as const
  return (
    <tr className="border-t align-middle">
      <td className="px-2 py-2">
        <Controller
          control={control}
          name={`payItems.${index}.payItemId`}
          render={({ field, fieldState }) => (
            <FormField
              label={`Payitem name, row ${index + 1}`}
              hideLabel
              error={fieldState.error?.message}
            >
              {(a11y) => (
                <SearchSelect
                  {...a11y}
                  value={field.value || null}
                  onChange={(next) => {
                    field.onChange(next ?? '')
                  }}
                  options={options}
                  placeholder="Select Pay Item"
                  disabled={readOnly}
                />
              )}
            </FormField>
          )}
        />
      </td>
      {flags.slice(0, 1).map(([key, label]) => (
        <td key={key} className="px-2 py-2">
          <Controller
            control={control}
            name={`payItems.${index}.${key}`}
            render={({ field }) => (
              <Checkbox
                aria-label={`${label}: ${name}`}
                checked={field.value}
                disabled={readOnly}
                onCheckedChange={(checked) => {
                  field.onChange(checked === true)
                }}
              />
            )}
          />
        </td>
      ))}
      <td className="px-2 py-2 font-inter text-[0.9375rem] text-heading">{typeOf(payItemId)}</td>
      {flags.slice(1).map(([key, label]) => (
        <td key={key} className="px-2 py-2">
          <Controller
            control={control}
            name={`payItems.${index}.${key}`}
            render={({ field }) => (
              <Checkbox
                aria-label={`${label}: ${name}`}
                checked={field.value}
                disabled={readOnly}
                onCheckedChange={(checked) => {
                  field.onChange(checked === true)
                }}
              />
            )}
          />
        </td>
      ))}
      <td className="px-2 py-2 text-center">
        {!readOnly && (
          <button
            type="button"
            aria-label={`Remove ${name}`}
            onClick={onRemove}
            className="inline-flex size-7 items-center justify-center rounded-full text-[#E50141] outline-none hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <CircleX aria-hidden="true" className="size-5" />
          </button>
        )}
      </td>
    </tr>
  )
}
