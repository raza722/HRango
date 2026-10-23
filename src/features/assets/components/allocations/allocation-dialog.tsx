import { type SyntheticEvent, useId } from 'react'
import { useController, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { SelectField, TextareaField, TextField } from '@/components/form'
import { Skeleton } from '@/components/ui/skeleton'
import { AttachmentField, DateField, PayrollDialog, SearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { useAllocate, useAllocation, useAssetLookups } from '../../hooks/use-assets'
import type { AllocationDetail } from '../../types/assets.types'
import { viewFieldsClass } from '../company-assets/view-fields'

const schema = z.object({
  employeeId: z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message: 'Choose the employee' }),
  assetTypeId: z.string().min(1, 'Choose the asset type'),
  assetId: z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message: 'Choose the asset' }),
  allocationDate: z.string().min(1, 'Choose the allocation date'),
  identificationNumber: z.string(),
  deallocationDate: z.string(),
  attachmentName: z.string().nullable(),
  description: z.string().trim().max(500, 'Keep it under 500 characters'),
})
type Values = z.infer<typeof schema>

const FIELDS = ['employeeId', 'assetId', 'allocationDate'] as const
const DATE = 'MMMM d, yyyy'

const toValues = (row: AllocationDetail | undefined): Values => ({
  employeeId: row?.employee.id ?? null,
  assetTypeId: row?.assetTypeId ?? '',
  assetId: row?.assetId ?? null,
  allocationDate: row?.allocationDate ?? '',
  identificationNumber: row?.identificationNumber ?? '',
  deallocationDate: row?.deallocationDate ?? '',
  attachmentName: row?.attachmentName ?? null,
  description: row?.description ?? '',
})

/**
 * Allocate ("Asset" as drawn): Employee, Asset Type, the Asset (an available
 * one of that type), Allocation Date, Attachment and Description. View shows
 * the same fields read-only, with the Identification Number.
 */
export function AllocationDialog({
  id,
  onClose,
}: {
  /** null: Allocate; an allocation's id: its View. */
  id: string | null
  onClose: () => void
}) {
  const allocation = useAllocation(id)
  if (id && !allocation.data) {
    return (
      <PayrollDialog title="Asset" onClose={onClose} readOnly className="max-w-3xl">
        <Skeleton className="h-80 w-full" />
      </PayrollDialog>
    )
  }
  return <AllocationForm allocation={allocation.data} onClose={onClose} />
}

function AllocationForm({
  allocation,
  onClose,
}: {
  allocation: AllocationDetail | undefined
  onClose: () => void
}) {
  const formId = useId()
  const lookups = useAssetLookups()
  const allocate = useAllocate()
  const readOnly = allocation !== undefined
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: toValues(allocation),
  })
  const attachment = useController({ control: form.control, name: 'attachmentName' })
  const assetTypeId = useWatch({ control: form.control, name: 'assetTypeId' })
  const data = lookups.data
  const employees = (data?.employees ?? [])
    .filter((person) => readOnly || person.status === 'active')
    .map((person) => ({
      value: person.id,
      label: person.name,
      hint: `${person.code} · ${person.designation}`,
    }))
  const types = (data?.assetTypes ?? [])
    .filter((type) => readOnly || type.active)
    .map((type) => ({ value: type.id, label: type.name }))
  // Only assets of the chosen type that nobody holds (the viewed one is always listed).
  const assets = (data?.assets ?? [])
    .filter(
      (asset) =>
        asset.assetTypeId === assetTypeId &&
        (asset.status === 'available' || asset.id === allocation?.assetId),
    )
    .map((asset) => ({
      value: asset.id,
      label: `${asset.name} (${asset.identificationNumber})`,
      hint: asset.code,
    }))

  const submit = form.handleSubmit(async (values) => {
    try {
      await allocate.mutateAsync({
        employeeId: values.employeeId ?? '',
        assetId: values.assetId ?? '',
        allocationDate: values.allocationDate,
        attachmentName: values.attachmentName,
        description: values.description,
      })
      onClose()
    } catch (error) {
      const field =
        error instanceof ApiError ? FIELDS.find((name) => error.fieldErrors[name]) : undefined
      if (error instanceof ApiError && field) {
        form.setError(field, { message: error.fieldErrors[field] })
      } else {
        form.setError('root', {
          message: error instanceof ApiError ? error.message : 'Could not allocate the asset.',
        })
      }
    }
  })

  return (
    <PayrollDialog
      title="Asset"
      onClose={onClose}
      formId={formId}
      readOnly={readOnly}
      pending={allocate.isPending}
      error={form.formState.errors.root?.message}
      className="max-w-3xl"
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event: SyntheticEvent) => void submit(event)}
        className={cn('grid gap-5', readOnly && viewFieldsClass)}
      >
        <SearchSelectField
          control={form.control}
          name="employeeId"
          label="Employee"
          placeholder="Select Employee"
          options={employees}
          required={!readOnly}
          disabled={readOnly}
        />
        <SelectField
          control={form.control}
          name="assetTypeId"
          label="Asset Type"
          placeholder="Select Asset Type"
          options={types}
          required={!readOnly}
          disabled={readOnly}
          onValueChange={() => {
            form.setValue('assetId', null)
          }}
        />
        <SearchSelectField
          control={form.control}
          name="assetId"
          label="Asset"
          placeholder={assetTypeId ? 'Select Asset' : 'Choose the asset type first'}
          options={assets}
          required={!readOnly}
          disabled={readOnly || !assetTypeId}
        />
        {readOnly && (
          <TextField
            control={form.control}
            name="identificationNumber"
            label="Identification Number"
            disabled
          />
        )}
        <DateField
          control={form.control}
          name="allocationDate"
          label="Allocation Date"
          required
          disabled={readOnly}
          display={DATE}
        />
        {readOnly && allocation.deallocationDate && (
          <DateField
            control={form.control}
            name="deallocationDate"
            label="Deallocation Date"
            disabled
            display={DATE}
          />
        )}
        <AttachmentField
          value={attachment.field.value}
          onChange={attachment.field.onChange}
          disabled={readOnly}
        />
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          disabled={readOnly}
          maxLength={500}
          rows={6}
        />
      </form>
    </PayrollDialog>
  )
}
