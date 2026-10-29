import { useMemo, useState } from 'react'
import { type DefaultValues, type FieldValues, type Path, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import type { z } from 'zod'

import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'

import type { OrgResource } from '../api/org-resource'
import type { FormMapper } from '../utils/form-mappers'
import { useOrgRecord, useSaveOrgRecord } from './use-org-records'

interface AnyRecord {
  id: string
  name: string
  rowVersion: string
}

interface UseOrgRecordFormOptions<
  TRecord extends AnyRecord,
  TInput,
  TRow extends AnyRecord,
  TValues,
> {
  resource: OrgResource<TRecord, TInput, TRow>
  /** Record being edited; `undefined` on a "Create" page. */
  id: string | undefined
  schema: z.ZodType<TValues, TValues>
  mapper: FormMapper<TRecord, TValues, TInput>
  /** Runs after a successful save (usually: go back to the list). */
  onSaved: (record: TRecord) => Promise<void> | void
}

/**
 * Form state for a Control Panel create/edit page: Zod validation, loading the
 * record into the form, saving, and showing server field errors (such as a
 * duplicate name) on the right input. Leaving with unsaved changes asks first
 * (`guard` drives the dialog).
 */
export function useOrgRecordForm<
  TRecord extends AnyRecord,
  TInput,
  TRow extends AnyRecord,
  TValues extends FieldValues,
>({
  resource,
  id,
  schema,
  mapper,
  onSaved,
}: UseOrgRecordFormOptions<TRecord, TInput, TRow, TValues>) {
  const recordQuery = useOrgRecord(resource, id)
  const mayWrite = useCan(`${resource.permission}.${id === undefined ? 'create' : 'edit'}`)
  const saveMutation = useSaveOrgRecord(resource)
  const [defaultValues] = useState(mapper.empty)

  const values = useMemo(
    () => (id && recordQuery.data ? mapper.toValues(recordQuery.data) : undefined),
    [id, recordQuery.data, mapper],
  )

  const form = useForm<TValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as DefaultValues<TValues>,
    values,
    // A background refetch must not wipe what the user is typing.
    resetOptions: { keepDirtyValues: true },
    mode: 'onTouched',
  })
  const guard = useUnsavedChangesGuard(form.formState.isDirty)

  const submit = form.handleSubmit(async (formValues) => {
    let record: TRecord
    try {
      record = await saveMutation.mutateAsync({
        id,
        input: mapper.toInput(formValues),
        rowVersion: recordQuery.data?.rowVersion,
      })
    } catch (error) {
      let placed = false
      if (error instanceof ApiError) {
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          if (!(field in formValues)) continue
          form.setError(
            field as Path<TValues>,
            { type: 'server', message },
            { shouldFocus: !placed },
          )
          placed = true
        }
      }
      // An error on a field is shown there only; anything else (a stale record…) as a toast.
      if (!placed && !(error instanceof ApiError && error.kind === 'cancelled')) {
        toast.error(error instanceof ApiError ? error.message : 'The record could not be saved.')
      }
      return
    }
    form.reset(formValues)
    guard.allowNextNavigation()
    await onSaved(record)
  })

  return {
    form,
    submit,
    isEditing: id !== undefined,
    record: recordQuery.data,
    isLoadingRecord: id !== undefined && recordQuery.isPending,
    loadError: id !== undefined && !recordQuery.data ? recordQuery.error : null,
    retryLoad: () => {
      void recordQuery.refetch()
    },
    isSaving: saveMutation.isPending,
    /** Without the create / edit permission the form only shows the record. */
    readOnly: !mayWrite,
    guard,
  }
}
