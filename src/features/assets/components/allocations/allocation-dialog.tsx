import { type SyntheticEvent, useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { SelectField, TextareaField, TextField } from '@/components/form'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DateField,
  EmployeeSearchSelectField,
  PayrollDialog,
  SearchSelectField,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import type { FileRef } from '@/lib/files'
import { cn } from '@/lib/utils'

import { personHint } from '../../api/lookups.api'
import { RETURN_CONDITION_LABELS } from '../../constants'
import {
  useAllocate,
  useAllocation,
  useAssetOptions,
  useAssetTypeOptions,
} from '../../hooks/use-assets'
import type { Allocation } from '../../types/assets.types'
import { viewFieldsClass } from '../company-assets/view-fields'
import { UploadField } from '../shared/upload-field'

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
  allocatedOn: z.string().min(1, 'Choose the allocation date'),
  identificationNo: z.string(),
  deallocatedOn: z.string(),
  returnCondition: z.string(),
  deallocationRemarks: z.string(),
  description: z.string().trim().max(2000, 'Keep it under 2000 characters'),
})
type Values = z.infer<typeof schema>

const FIELDS = ['employeeId', 'assetId', 'allocatedOn'] as const
const DATE = 'MMMM d, yyyy'

const toValues = (row: Allocation | undefined): Values => ({
  employeeId: row?.employeeId ?? null,
  assetTypeId: row?.assetTypeId ?? '',
  assetId: row?.assetId ?? null,
  allocatedOn: row?.allocatedOn ?? '',
  identificationNo: row?.identificationNo ?? '',
  deallocatedOn: row?.deallocatedOn ?? '',
  returnCondition: row?.returnCondition ? RETURN_CONDITION_LABELS[row.returnCondition] : '',
  deallocationRemarks: row?.deallocationRemarks ?? '',
  description: row?.description ?? '',
})

/**
 * Allocate ("Asset" as drawn): Employee, Asset Type, the Asset (an available
 * one of that type), Allocation Date, Attachment and Description. View shows
 * the same fields read-only, with the Identification Number and how it came back.
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
  allocation: Allocation | undefined
  onClose: () => void
}) {
  const formId = useId()
  const allocate = useAllocate()
  const readOnly = allocation !== undefined
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: toValues(allocation),
  })
  const [attachment, setAttachment] = useState<FileRef | null>(allocation?.file ?? null)
  const assetTypeId = useWatch({ control: form.control, name: 'assetTypeId' })
  const types = useAssetTypeOptions()
  // Only assets of the chosen type that nobody holds.
  const free = useAssetOptions(
    { assetTypeId, availability: 'available' },
    !readOnly && assetTypeId !== '',
  )

  // View names the allocation's person without asking the lookup.
  const known = allocation
    ? [
        {
          value: allocation.employeeId,
          label: allocation.employeeName ?? allocation.employeeId,
          hint: allocation.employeeCode ?? '',
        },
      ]
    : undefined
  const typeOptions = readOnly
    ? [{ value: allocation.assetTypeId, label: allocation.assetTypeName }]
    : (types.data ?? [])
        .filter((type) => type.isActive)
        .map((type) => ({ value: type.id, label: type.name }))
  const assets = readOnly
    ? [
        {
          value: allocation.assetId,
          label: `${allocation.assetName}${allocation.identificationNo ? ` (${allocation.identificationNo})` : ''}`,
          hint: allocation.assetCode,
        },
      ]
    : (free.data ?? []).map((asset) => ({
        value: asset.id,
        label: `${asset.name}${asset.identificationNo ? ` (${asset.identificationNo})` : ''}`,
        hint: asset.code,
      }))

  const submit = form.handleSubmit(async (values) => {
    try {
      await allocate.mutateAsync({
        employeeId: values.employeeId ?? '',
        assetId: values.assetId ?? '',
        allocatedOn: values.allocatedOn,
        description: values.description.trim() || null,
        fileId: attachment?.id ?? null,
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
        <EmployeeSearchSelectField
          control={form.control}
          name="employeeId"
          label="Employee"
          placeholder="Select Employee"
          filters={{ permission: 'assets.allocations.assign' }}
          enabled={!readOnly}
          known={known}
          hint={personHint}
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
            name="identificationNo"
            label="Identification Number"
            disabled
          />
        )}
        <DateField
          control={form.control}
          name="allocatedOn"
          label="Allocation Date"
          required={!readOnly}
          disabled={readOnly}
          display={DATE}
        />
        {readOnly && allocation.deallocatedOn && (
          <>
            <DateField
              control={form.control}
              name="deallocatedOn"
              label="Deallocation Date"
              disabled
              display={DATE}
            />
            {allocation.returnCondition && (
              <TextField
                control={form.control}
                name="returnCondition"
                label="Return Condition"
                disabled
              />
            )}
            {allocation.deallocationRemarks && (
              <TextareaField
                control={form.control}
                name="deallocationRemarks"
                label="Remarks"
                disabled
              />
            )}
          </>
        )}
        <UploadField
          value={attachment}
          onChange={setAttachment}
          module="assets"
          disabled={readOnly}
        />
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          disabled={readOnly}
          maxLength={2000}
          rows={6}
        />
      </form>
    </PayrollDialog>
  )
}
