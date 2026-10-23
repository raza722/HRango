import { useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { XCircle } from 'lucide-react'
import { z } from 'zod'

import { CheckboxField, TextareaField, TextField } from '@/components/form'
import type { DataTableColumn } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import { SURCHARGE_RATE_LABELS } from '../../constants'
import { useDeleteResource, useResourceList, useSaveResource } from '../../hooks/use-payroll'
import { SURCHARGE_CONDITIONS, SURCHARGE_RATES, type TaxStructure } from '../../types/payroll.types'
import { btn, toolbarButton } from '../../utils/styles'
import { DateField } from '../shared/date-input'
import { NoRecord } from '../shared/no-record'
import { PayrollDialog } from '../shared/payroll-dialog'
import { CreateButton, DeleteConfirm, SettingsRowMenu } from './settings-common'
import {
  applyApiError,
  type DialogState,
  numberText,
  optionalNumberText,
  sectionHeading,
  toAmount,
  toOptionalNumber,
} from './settings-helpers'
import { SettingsTable, ViewHeader } from './settings-list'
import { SETTINGS_PAGE_SIZE } from './settings-nav'

const slab = z.object({
  id: z.string(),
  min: z
    .string()
    .trim()
    .min(1, 'Enter the minimum')
    .refine((value) => Number.isFinite(toAmount(value)), {
      message: 'Enter a number',
    }),
  max: optionalNumberText,
  fixedAmount: optionalNumberText,
  percentage: optionalNumberText.refine(
    (value) => value === '' || (toAmount(value) >= 0 && toAmount(value) <= 100),
    {
      message: 'Use 0 to 100',
    },
  ),
})

const schema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name').max(80, 'Keep it under 80 characters'),
    startDate: z.string().min(1, 'Choose the start date'),
    endDate: z.string().min(1, 'Choose the end date'),
    surcharge: z.boolean(),
    surchargeValue: optionalNumberText,
    surchargeRate: z.string(),
    surchargeCondition: z.string(),
    surchargeAmount: optionalNumberText,
    description: z.string().trim().max(500),
    slabs: z.array(slab).max(30),
  })
  .refine((value) => !value.startDate || !value.endDate || value.endDate >= value.startDate, {
    message: 'The end date must be on or after the start date',
    path: ['endDate'],
  })
  .refine((value) => !value.surcharge || value.surchargeValue !== '', {
    message: 'Enter the value',
    path: ['surchargeValue'],
  })
  .refine((value) => !value.surcharge || value.surchargeRate !== '', {
    message: 'Choose the rate',
    path: ['surchargeRate'],
  })
  .refine((value) => !value.surcharge || value.surchargeCondition !== '', {
    message: 'Choose the condition',
    path: ['surchargeCondition'],
  })
  .refine((value) => !value.surcharge || value.surchargeAmount !== '', {
    message: 'Enter the tax amount',
    path: ['surchargeAmount'],
  })
type Values = z.infer<typeof schema>

let slabCount = 0
const newSlab = () => {
  slabCount += 1
  return {
    id: `slab_${Date.now().toString(36)}_${slabCount}`,
    min: '',
    max: '',
    fixedAmount: '',
    percentage: '',
  }
}

function toValues(record: TaxStructure | undefined): Values {
  return {
    name: record?.name ?? '',
    startDate: record?.startDate ?? '',
    endDate: record?.endDate ?? '',
    surcharge: record?.surcharge ?? false,
    surchargeValue: numberText(record?.surchargeRule?.value),
    surchargeRate: record?.surchargeRule?.rate ?? '',
    surchargeCondition: record?.surchargeRule?.condition ?? '',
    surchargeAmount: numberText(record?.surchargeRule?.amount),
    description: record?.description ?? '',
    slabs: (record?.slabs ?? []).map((item) => ({
      id: item.id,
      min: String(item.min),
      max: numberText(item.max),
      fixedAmount: String(item.fixedAmount),
      percentage: String(item.percentage),
    })),
  }
}

function InlineSelect({
  label,
  placeholder,
  value,
  onChange,
  options,
  disabled,
  invalid,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  options: readonly { value: string; label: string }[]
  disabled: boolean
  invalid: boolean
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger aria-label={label} aria-invalid={invalid} className="h-9 w-40">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** "Tax Structure Create": dates, the surcharge, and the slabs. */
function TaxStructureDialog({
  state,
  onClose,
}: {
  state: Exclude<DialogState<TaxStructure>, null>
  onClose: () => void
}) {
  const record = state.mode === 'create' ? undefined : state.record
  const readOnly = state.mode === 'view'
  const save = useSaveResource('taxStructures')
  const [error, setError] = useState<string | null>(null)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(record) })
  const slabs = useFieldArray({ control: form.control, name: 'slabs', keyName: 'key' })
  const surcharge = useWatch({ control: form.control, name: 'surcharge' })
  const errors = form.formState.errors

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    const rate = SURCHARGE_RATES.find((item) => item === values.surchargeRate)
    const condition = SURCHARGE_CONDITIONS.find((item) => item === values.surchargeCondition)
    try {
      await save.mutateAsync({
        id: record?.id,
        input: {
          name: values.name,
          startDate: values.startDate,
          endDate: values.endDate,
          surcharge: values.surcharge,
          surchargeRule:
            values.surcharge && rate && condition
              ? {
                  value: toAmount(values.surchargeValue),
                  rate,
                  condition,
                  amount: toAmount(values.surchargeAmount),
                }
              : null,
          description: values.description,
          slabs: values.slabs.map((item) => ({
            id: item.id,
            min: toAmount(item.min),
            max: toOptionalNumber(item.max),
            fixedAmount: toOptionalNumber(item.fixedAmount) ?? 0,
            percentage: toOptionalNumber(item.percentage) ?? 0,
          })),
        },
      })
      onClose()
    } catch (failure) {
      setError(applyApiError(failure, form.setError, ['name', 'endDate', 'slabs']))
    }
  })
  const title =
    state.mode === 'create'
      ? 'Tax Structure Create'
      : state.mode === 'edit'
        ? 'Tax Structure Edit'
        : 'Tax Structure View'
  const cellInput = (
    index: number,
    field: 'min' | 'max' | 'fixedAmount' | 'percentage',
    label: string,
    placeholder?: string,
  ) => (
    <Controller
      control={form.control}
      name={`slabs.${index}.${field}`}
      render={({ field: input, fieldState }) => (
        <div className="grid gap-1">
          <Input
            {...input}
            inputMode="decimal"
            aria-label={`Slab ${index + 1} ${label}`}
            aria-invalid={Boolean(fieldState.error)}
            placeholder={placeholder}
            disabled={readOnly}
            className="h-9"
          />
          {fieldState.error && (
            <span className="text-xs text-destructive">{fieldState.error.message}</span>
          )}
        </div>
      )}
    />
  )

  return (
    <PayrollDialog
      title={title}
      onClose={onClose}
      formId="tax-structure-form"
      readOnly={readOnly}
      pending={save.isPending}
      error={error}
      className="max-w-5xl"
    >
      <form
        id="tax-structure-form"
        noValidate
        onSubmit={(event) => void submit(event)}
        className="grid gap-5"
      >
        <TextField control={form.control} name="name" label="Name" required disabled={readOnly} />
        <DateField
          control={form.control}
          name="startDate"
          label="Start Date"
          required
          disabled={readOnly}
        />
        <DateField
          control={form.control}
          name="endDate"
          label="End Date"
          required
          disabled={readOnly}
        />
        <CheckboxField
          control={form.control}
          name="surcharge"
          label="Surcharge"
          disabled={readOnly}
        />

        {surcharge && (
          <section aria-labelledby="surcharge-title" className="grid gap-3 border-b pb-4">
            <h3 id="surcharge-title" className={sectionHeading}>
              Surcharge
            </h3>
            <div className="flex flex-wrap items-center gap-3 font-inter text-sm text-field-value">
              <span>Apply</span>
              <Controller
                control={form.control}
                name="surchargeValue"
                render={({ field, fieldState }) => (
                  <Input
                    {...field}
                    inputMode="decimal"
                    aria-label="Surcharge value"
                    aria-invalid={Boolean(fieldState.error)}
                    placeholder="value"
                    disabled={readOnly}
                    className="h-9 w-28"
                  />
                )}
              />
              <Controller
                control={form.control}
                name="surchargeRate"
                render={({ field, fieldState }) => (
                  <InlineSelect
                    label="Surcharge rate"
                    placeholder="Select Rate"
                    value={field.value}
                    onChange={field.onChange}
                    options={SURCHARGE_RATES.map((value) => ({
                      value,
                      label: SURCHARGE_RATE_LABELS[value],
                    }))}
                    disabled={readOnly}
                    invalid={Boolean(fieldState.error)}
                  />
                )}
              />
              <span>When Annual Tax is</span>
              <Controller
                control={form.control}
                name="surchargeCondition"
                render={({ field, fieldState }) => (
                  <InlineSelect
                    label="Surcharge condition"
                    placeholder="Select Condition"
                    value={field.value}
                    onChange={field.onChange}
                    options={SURCHARGE_CONDITIONS.map((value) => ({ value, label: value }))}
                    disabled={readOnly}
                    invalid={Boolean(fieldState.error)}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="surchargeAmount"
                render={({ field, fieldState }) => (
                  <Input
                    {...field}
                    inputMode="decimal"
                    aria-label="Surcharge tax amount"
                    aria-invalid={Boolean(fieldState.error)}
                    placeholder="Tax amount"
                    disabled={readOnly}
                    className="h-9 w-36"
                  />
                )}
              />
            </div>
            {(errors.surchargeValue ??
              errors.surchargeRate ??
              errors.surchargeCondition ??
              errors.surchargeAmount) && (
              <p className="text-xs text-destructive">
                {
                  (
                    errors.surchargeValue ??
                    errors.surchargeRate ??
                    errors.surchargeCondition ??
                    errors.surchargeAmount
                  )?.message
                }
              </p>
            )}
          </section>
        )}

        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          disabled={readOnly}
        />

        <section aria-labelledby="slabs-title" className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 id="slabs-title" className={sectionHeading}>
              Slabs
            </h3>
            {!readOnly && (
              <Button
                type="button"
                onClick={() => {
                  slabs.append(newSlab())
                }}
                className={cn(toolbarButton, btn.navy, 'min-w-[6.625rem]')}
              >
                +Add
              </Button>
            )}
          </div>
          {slabs.fields.length === 0 ? (
            <NoRecord />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <caption className="sr-only">Slabs</caption>
                <thead>
                  <tr className="font-inter text-sm text-heading sm:text-base">
                    <th scope="col" className="pb-2 font-normal">
                      Min
                    </th>
                    <th scope="col" className="pb-2 font-normal">
                      Max
                    </th>
                    <th scope="col" className="pb-2 font-normal">
                      Fixed Amount
                    </th>
                    <th scope="col" className="pb-2 font-normal">
                      Percentage
                    </th>
                    <th scope="col" className="w-16 pb-2 text-center font-normal">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {slabs.fields.map((item, index) => (
                    <tr key={item.key} className="align-top">
                      <td className="py-1.5 pr-2">{cellInput(index, 'min', 'minimum', 'Min')}</td>
                      <td className="py-1.5 pr-2">
                        {cellInput(index, 'max', 'maximum', 'No limit')}
                      </td>
                      <td className="py-1.5 pr-2">
                        {cellInput(index, 'fixedAmount', 'fixed amount')}
                      </td>
                      <td className="py-1.5 pr-2">
                        {cellInput(index, 'percentage', 'percentage')}
                      </td>
                      <td className="py-1.5 text-center">
                        <button
                          type="button"
                          disabled={readOnly}
                          aria-label={`Remove slab ${index + 1}`}
                          onClick={() => {
                            slabs.remove(index)
                          }}
                          className="inline-flex size-9 items-center justify-center rounded-full text-[#E50141] hover:bg-[#E50141]/10 disabled:opacity-40"
                        >
                          <XCircle aria-hidden="true" className="size-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {errors.slabs?.message && (
            <p className="text-xs text-destructive">{errors.slabs.message}</p>
          )}
        </section>
      </form>
    </PayrollDialog>
  )
}

const columns: DataTableColumn<TaxStructure>[] = [
  { id: 'code', header: 'Code', cell: (row) => row.code },
  { id: 'name', header: 'Name', cell: (row) => row.name, mobile: 'heading' },
  {
    id: 'description',
    header: 'Description',
    cell: (row) => (
      <span className="line-clamp-2 max-w-72 whitespace-normal">{row.description || '—'}</span>
    ),
  },
]

/** Tax → Tax Structure: the yearly income tax slabs a payroll uses. */
export function TaxStructuresView() {
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<DialogState<TaxStructure>>(null)
  const [deleting, setDeleting] = useState<TaxStructure | null>(null)
  const list = useResourceList('taxStructures', { page, pageSize: SETTINGS_PAGE_SIZE })
  const remove = useDeleteResource('taxStructures')

  return (
    <>
      <ViewHeader
        tab="tax"
        view="tax-structure"
        actions={
          <CreateButton
            onClick={() => {
              setDialog({ mode: 'create' })
            }}
          />
        }
      />
      <SettingsTable
        caption="Tax Structures"
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
        <TaxStructureDialog
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
