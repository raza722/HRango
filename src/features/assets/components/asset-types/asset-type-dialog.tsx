import { type SyntheticEvent, useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { CheckboxField, TextareaField, TextField } from '@/components/form'
import { Skeleton } from '@/components/ui/skeleton'
import { PayrollDialog } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { useAssetType, useSaveAssetType } from '../../hooks/use-assets'
import type { AssetType } from '../../types/assets.types'
import { viewFieldsClass } from '../company-assets/view-fields'

const schema = z.object({
  name: z.string().trim().min(1, 'Enter the name').max(200, 'Keep it under 200 characters'),
  isActive: z.boolean(),
  description: z.string().trim().max(500, 'Keep it under 500 characters'),
})
type Values = z.infer<typeof schema>

type Mode = 'create' | 'edit' | 'view'

const TITLES: Record<Mode, string> = {
  create: 'Asset Type Create',
  edit: 'Asset Type Edit',
  view: 'Asset Type View',
}

/** "Asset Type Create" / Edit / View: Name, Active and Description. */
export function AssetTypeDialog({
  id,
  mode,
  onClose,
}: {
  id: string | null
  mode: Mode
  onClose: () => void
}) {
  const type = useAssetType(id)
  if (id && !type.data) {
    return (
      <PayrollDialog title={TITLES[mode]} onClose={onClose} readOnly className="max-w-3xl">
        <Skeleton className="h-48 w-full" />
      </PayrollDialog>
    )
  }
  return <AssetTypeForm type={type.data} mode={mode} onClose={onClose} />
}

function AssetTypeForm({
  type,
  mode,
  onClose,
}: {
  type: AssetType | undefined
  mode: Mode
  onClose: () => void
}) {
  const formId = useId()
  const save = useSaveAssetType()
  const readOnly = mode === 'view'
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: type?.name ?? '',
      isActive: type?.isActive ?? true,
      description: type?.description ?? '',
    },
  })

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: type?.id,
        input: {
          name: values.name,
          isActive: values.isActive,
          description: values.description || null,
          rowVersion: type?.rowVersion,
        },
      })
      onClose()
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.name) {
        form.setError('name', { message: error.fieldErrors.name })
      } else {
        form.setError('root', {
          message: error instanceof ApiError ? error.message : 'Could not save the asset type.',
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
          required={mode === 'create'}
          disabled={readOnly}
        />
        <CheckboxField
          control={form.control}
          name="isActive"
          label="Active"
          tone="violet"
          disabled={readOnly}
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
