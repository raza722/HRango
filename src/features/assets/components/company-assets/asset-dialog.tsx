import { type SyntheticEvent, useId } from 'react'
import { useController, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { CheckboxField, FormField, SelectField, TextareaField, TextField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AttachmentField,
  btn,
  DateField,
  footerButton,
  PayrollDialog,
  RsField,
  TwoWaySwitch,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { useAsset, useAssetLookups, useSaveAsset } from '../../hooks/use-assets'
import { ASSET_CONDITIONS, type AssetDetail } from '../../types/assets.types'
import { viewFieldsClass } from './view-fields'

const schema = z.object({
  name: z.string().trim().min(1, 'Enter the name').max(80, 'Keep it under 80 characters'),
  assetTypeId: z.string().min(1, 'Choose the asset type'),
  identificationNumber: z
    .string()
    .trim()
    .min(1, 'Enter the identification number')
    .max(40, 'Keep it under 40 characters'),
  taxable: z.boolean(),
  condition: z.enum(ASSET_CONDITIONS),
  manufacturer: z.string().trim().max(60, 'Keep it under 60 characters'),
  model: z.string().trim().max(60, 'Keep it under 60 characters'),
  attachmentName: z.string().nullable(),
  currentValue: z.string().refine((value) => Number(value.replace(/,/g, '')) > 0, {
    message: 'Enter the current value',
  }),
  acquiredDate: z.string().min(1, 'Choose the acquired date'),
  description: z.string().trim().max(500, 'Keep it under 500 characters'),
})
type Values = z.infer<typeof schema>

const toValues = (asset: AssetDetail | undefined): Values => ({
  name: asset?.name ?? '',
  assetTypeId: asset?.assetTypeId ?? '',
  identificationNumber: asset?.identificationNumber ?? '',
  taxable: asset?.taxable ?? true,
  // Create draws the switch off, on Old.
  condition: asset?.condition ?? 'old',
  manufacturer: asset?.manufacturer ?? '',
  model: asset?.model ?? '',
  attachmentName: asset?.attachmentName ?? null,
  currentValue: asset ? String(asset.currentValue) : '',
  acquiredDate: asset?.acquiredDate ?? '',
  description: asset?.description ?? '',
})

type Mode = 'create' | 'edit' | 'view'

const TITLES: Record<Mode, string> = {
  create: 'Asset Create',
  edit: 'Asset Edit',
  view: 'Asset View',
}

const FIELDS = [
  'name',
  'assetTypeId',
  'identificationNumber',
  'currentValue',
  'acquiredDate',
] as const
const DATE = 'MMMM d, yyyy'

/**
 * "Asset Create" / Edit / View: Name, Asset Type, Identification Number,
 * Taxable and Condition (Old / New), Manufacturer, Model, Attachment, Current
 * Value, Acquired date and Description. View has the orange History button.
 */
export function AssetDialog({
  id,
  mode,
  onClose,
  onHistory,
}: {
  id: string | null
  mode: Mode
  onClose: () => void
  /** View → History. */
  onHistory?: (() => void) | undefined
}) {
  const asset = useAsset(id)
  if (id && !asset.data) {
    return (
      <PayrollDialog title={TITLES[mode]} onClose={onClose} readOnly className="max-w-3xl">
        <Skeleton className="h-96 w-full" />
      </PayrollDialog>
    )
  }
  return <AssetForm asset={asset.data} mode={mode} onClose={onClose} onHistory={onHistory} />
}

function AssetForm({
  asset,
  mode,
  onClose,
  onHistory,
}: {
  asset: AssetDetail | undefined
  mode: Mode
  onClose: () => void
  onHistory?: (() => void) | undefined
}) {
  const formId = useId()
  const lookups = useAssetLookups()
  const save = useSaveAsset()
  const readOnly = mode === 'view'
  const creating = mode === 'create'
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(asset) })
  const condition = useController({ control: form.control, name: 'condition' })
  const attachment = useController({ control: form.control, name: 'attachmentName' })
  // Only active types can be chosen; an edited asset keeps its own type even if it is not.
  const types = (lookups.data?.assetTypes ?? [])
    .filter((type) => type.active || type.id === asset?.assetTypeId)
    .map((type) => ({ value: type.id, label: type.name }))

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: asset?.id,
        input: {
          name: values.name,
          assetTypeId: values.assetTypeId,
          identificationNumber: values.identificationNumber,
          taxable: values.taxable,
          condition: values.condition,
          manufacturer: values.manufacturer,
          model: values.model,
          attachmentName: values.attachmentName,
          currentValue: Number(values.currentValue.replace(/,/g, '')),
          acquiredDate: values.acquiredDate,
          description: values.description,
        },
      })
      onClose()
    } catch (error) {
      const field =
        error instanceof ApiError ? FIELDS.find((name) => error.fieldErrors[name]) : undefined
      if (error instanceof ApiError && field) {
        form.setError(field, { message: error.fieldErrors[field] })
      } else {
        form.setError('root', {
          message: error instanceof ApiError ? error.message : 'Could not save the asset.',
        })
      }
    }
  })

  return (
    <PayrollDialog
      title={TITLES[mode]}
      onClose={onClose}
      formId={formId}
      readOnly={readOnly}
      pending={save.isPending}
      error={form.formState.errors.root?.message}
      className="max-w-3xl"
      actions={
        readOnly && onHistory ? (
          <Button
            type="button"
            onClick={onHistory}
            className={cn(footerButton, btn.orange, 'mr-auto')}
          >
            History
          </Button>
        ) : undefined
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event: SyntheticEvent) => void submit(event)}
        className={cn('grid gap-5', readOnly && viewFieldsClass)}
      >
        <TextField control={form.control} name="name" label="Name" required disabled={readOnly} />
        <SelectField
          control={form.control}
          name="assetTypeId"
          label="Asset Type"
          placeholder="Select Asset Type"
          options={types}
          required
          disabled={readOnly}
        />
        <TextField
          control={form.control}
          name="identificationNumber"
          label="Identification Number"
          required
          disabled={readOnly}
        />
        {/* Taxable and Condition share a row, as drawn. */}
        <div className="grid gap-5 @2xl:grid-cols-2">
          <CheckboxField
            control={form.control}
            name="taxable"
            label="Taxable"
            tone="violet"
            disabled={readOnly}
          />
          <FormField label="Condition">
            {(a11y) => (
              <TwoWaySwitch
                id={a11y.id}
                label="Condition"
                options={[
                  { value: 'old', label: 'Old' },
                  { value: 'new', label: 'New' },
                ]}
                value={condition.field.value}
                disabled={readOnly}
                onChange={condition.field.onChange}
              />
            )}
          </FormField>
        </div>
        <TextField
          control={form.control}
          name="manufacturer"
          label="Manufacturer"
          disabled={readOnly}
        />
        <TextField control={form.control} name="model" label="Model" disabled={readOnly} />
        <AttachmentField
          value={attachment.field.value}
          onChange={attachment.field.onChange}
          disabled={readOnly}
        />
        <RsField
          control={form.control}
          name="currentValue"
          label="Current Value"
          required={creating}
          disabled={readOnly}
        />
        <DateField
          control={form.control}
          name="acquiredDate"
          label="Acquired date"
          required={creating}
          disabled={readOnly}
          maxDate={new Date()}
          display={DATE}
        />
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          disabled={readOnly}
          maxLength={500}
        />
      </form>
    </PayrollDialog>
  )
}
