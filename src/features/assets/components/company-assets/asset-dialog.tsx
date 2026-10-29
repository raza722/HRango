import { type SyntheticEvent, useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { CheckboxField, SelectField, TextareaField, TextField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { btn, DateField, footerButton, PayrollDialog, RsField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import type { FileRef } from '@/lib/files'
import { cn } from '@/lib/utils'

import { ASSET_CONDITION_LABELS, ASSET_STATUS_LABELS } from '../../constants'
import { useAsset, useAssetTypeOptions, useSaveAsset } from '../../hooks/use-assets'
import { type Asset, ASSET_CONDITIONS } from '../../types/assets.types'
import { UploadField } from '../shared/upload-field'
import { viewFieldsClass } from './view-fields'

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${String(max)} characters`)

/** The largest Current Value kept exactly (beyond it the number loses its cents). */
const MAX_ASSET_VALUE = 999_999_999_999.99

const schema = z.object({
  name: z.string().trim().min(1, 'Enter the name').max(200, 'Keep it under 200 characters'),
  assetTypeId: z.string().min(1, 'Choose the asset type'),
  identificationNo: optional(100),
  isTaxable: z.boolean(),
  assetCondition: z.enum(ASSET_CONDITIONS),
  manufacturer: optional(100),
  model: optional(100),
  currentValue: z.string().superRefine((value, ctx) => {
    const text = value.replace(/,/g, '').trim()
    if (text === '') return
    const amount = Number(text)
    const problem = !Number.isFinite(amount)
      ? 'Enter a number'
      : amount < 0
        ? 'Enter an amount of 0 or more'
        : amount > MAX_ASSET_VALUE
          ? 'Enter an amount up to 999,999,999,999.99'
          : (text.split('.')[1]?.length ?? 0) > 2
            ? 'Use at most 2 decimal places'
            : null
    if (problem) ctx.addIssue({ code: 'custom', message: problem })
  }),
  acquiredDate: z.string(),
  description: optional(2000),
})
type Values = z.infer<typeof schema>

const toValues = (asset: Asset | undefined): Values => ({
  name: asset?.name ?? '',
  assetTypeId: asset?.assetTypeId ?? '',
  identificationNo: asset?.identificationNo ?? '',
  isTaxable: asset?.isTaxable ?? false,
  assetCondition: asset?.assetCondition ?? 'new',
  manufacturer: asset?.manufacturer ?? '',
  model: asset?.model ?? '',
  currentValue: asset?.currentValue === null || !asset ? '' : String(asset.currentValue),
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
  'identificationNo',
  'assetCondition',
  'currentValue',
  'acquiredDate',
] as const
const DATE = 'MMMM d, yyyy'
const blank = (text: string) => (text.trim() === '' ? null : text.trim())

/**
 * "Asset Create" / Edit / View: Name, Asset Type, Identification Number,
 * Taxable and Condition (New / Old / Fair), Manufacturer, Model, Attachment,
 * Current Value, Acquired date and Description. View has the orange History button.
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
  asset: Asset | undefined
  mode: Mode
  onClose: () => void
  onHistory?: (() => void) | undefined
}) {
  const formId = useId()
  const types = useAssetTypeOptions()
  const save = useSaveAsset()
  const readOnly = mode === 'view'
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(asset) })
  const [attachment, setAttachment] = useState<FileRef | null>(asset?.file ?? null)
  // Only active types can be chosen; an edited asset keeps its own type even if it is not.
  const typeOptions = (types.data ?? [])
    .filter((type) => type.isActive || type.id === asset?.assetTypeId)
    .map((type) => ({ value: type.id, label: type.name }))
  if (asset && !typeOptions.some((option) => option.value === asset.assetTypeId)) {
    typeOptions.push({ value: asset.assetTypeId, label: asset.assetTypeName })
  }

  const submit = form.handleSubmit(async (values) => {
    const value = values.currentValue.replace(/,/g, '').trim()
    try {
      await save.mutateAsync({
        id: asset?.id,
        input: {
          name: values.name.trim(),
          assetTypeId: values.assetTypeId,
          identificationNo: blank(values.identificationNo),
          isTaxable: values.isTaxable,
          assetCondition: values.assetCondition,
          manufacturer: blank(values.manufacturer),
          model: blank(values.model),
          currentValue: value === '' ? null : Number(value),
          acquiredDate: values.acquiredDate || null,
          description: blank(values.description),
          fileId: attachment?.id ?? null,
          rowVersion: asset?.rowVersion,
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
        <TextField
          control={form.control}
          name="name"
          label="Name"
          required={!readOnly}
          disabled={readOnly}
        />
        <SelectField
          control={form.control}
          name="assetTypeId"
          label="Asset Type"
          placeholder="Select Asset Type"
          options={typeOptions}
          required={!readOnly}
          disabled={readOnly}
        />
        <TextField
          control={form.control}
          name="identificationNo"
          label="Identification Number"
          disabled={readOnly}
        />
        {/* Taxable and Condition share a row, as drawn. */}
        <div className="grid gap-5 @2xl:grid-cols-2">
          <CheckboxField
            control={form.control}
            name="isTaxable"
            label="Taxable"
            tone="violet"
            disabled={readOnly}
          />
          <SelectField
            control={form.control}
            name="assetCondition"
            label="Condition"
            options={ASSET_CONDITIONS.map((value) => ({
              value,
              label: ASSET_CONDITION_LABELS[value],
            }))}
            required={!readOnly}
            disabled={readOnly}
          />
        </div>
        <TextField
          control={form.control}
          name="manufacturer"
          label="Manufacturer"
          disabled={readOnly}
        />
        <TextField control={form.control} name="model" label="Model" disabled={readOnly} />
        <UploadField
          value={attachment}
          onChange={setAttachment}
          module="assets"
          disabled={readOnly}
        />
        <RsField
          control={form.control}
          name="currentValue"
          label="Current Value"
          disabled={readOnly}
        />
        <DateField
          control={form.control}
          name="acquiredDate"
          label="Acquired date"
          disabled={readOnly}
          maxDate={new Date()}
          display={DATE}
        />
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          disabled={readOnly}
          maxLength={2000}
        />
        {readOnly && asset && (
          <p className="font-inter text-sm text-muted-foreground">
            Status: {ASSET_STATUS_LABELS[asset.status]}
            {asset.holderName ? ` · Allocated to ${asset.holderName}` : ''}
          </p>
        )}
      </form>
    </PayrollDialog>
  )
}
