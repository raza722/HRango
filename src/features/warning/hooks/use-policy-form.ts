import { useMemo } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { ApiError } from '@/lib/api-error'

import { policyFormSchema, type PolicyFormValues } from '../schemas/policy-form.schema'
import type { TimeSpan } from '../types/warning-policy.types'
import {
  createDefaultFormValues,
  createEmptyPeriod,
  createNextPeriod,
  toFormValues,
  toPolicyInput,
} from '../utils/policy-mappers'
import { useWarningPolicy } from './use-warning-policies'
import { useCreateWarningPolicy, useUpdateWarningPolicy } from './use-warning-policy-mutations'

/** Top-level fields the API may return in `fieldErrors`. */
const SERVER_FIELDS = ['policyName', 'title', 'timeSpan', 'clockEvent'] as const
type ServerField = (typeof SERVER_FIELDS)[number]

function isServerField(key: string): key is ServerField {
  return SERVER_FIELDS.some((field) => field === key)
}

interface UsePolicyFormOptions {
  /** Id of the policy being edited (from the `?edit=` search param), if any. */
  editingId: string | undefined
  /**
   * Called after a successful create or update, before the form is cleared.
   * Return the navigation promise (leaving edit mode) so the reset happens after it.
   */
  onSaved?: (mode: 'created' | 'updated') => Promise<void> | void
}

/**
 * Owns the Warning Policy form: schema validation, the periods field array,
 * loading a policy for editing, and the create/update mutations.
 *
 * Flow: Zod schema → RHF → `toPolicyInput` → TanStack mutation → MSW →
 * list invalidation → table refresh.
 */
export function usePolicyForm({ editingId, onSaved }: UsePolicyFormOptions) {
  const editingQuery = useWarningPolicy(editingId)
  const createMutation = useCreateWarningPolicy()
  const updateMutation = useUpdateWarningPolicy()

  // `values` makes RHF load the record once it arrives (deep-compared, so a
  // background refetch with identical data does not wipe the user's edits).
  const editingValues = useMemo(
    () => (editingId && editingQuery.data ? toFormValues(editingQuery.data) : undefined),
    [editingId, editingQuery.data],
  )

  const form = useForm<PolicyFormValues>({
    resolver: zodResolver(policyFormSchema),
    defaultValues: createDefaultFormValues(),
    values: editingValues,
    mode: 'onTouched',
  })

  const periods = useFieldArray({ control: form.control, name: 'periods', keyName: 'key' })

  /** Clears the form for a brand-new policy. */
  const resetToNew = () => {
    form.reset(createDefaultFormValues())
  }

  /** Switching span swaps the period blocks for one block of the new kind. */
  const changeTimeSpan = (timeSpan: TimeSpan) => {
    periods.replace([createEmptyPeriod(timeSpan)])
  }

  const addPeriod = () => {
    const current = form.getValues()
    periods.append(createNextPeriod(current.timeSpan, current.periods.at(-1)))
  }

  const submit = form.handleSubmit(async (values) => {
    const input = toPolicyInput(values)
    const mode = editingId ? 'updated' : 'created'
    try {
      if (editingId) await updateMutation.mutateAsync({ id: editingId, input })
      else await createMutation.mutateAsync(input)
    } catch (error) {
      // The mutation cache already showed a toast; put field errors next to the fields too.
      if (error instanceof ApiError) {
        Object.entries(error.fieldErrors).forEach(([field, message]) => {
          if (isServerField(field)) {
            form.setError(field, { type: 'server', message }, { shouldFocus: true })
          }
        })
      }
      return
    }
    await onSaved?.(mode)
    form.reset(createDefaultFormValues())
  })

  return {
    form,
    periods,
    submit,
    resetToNew,
    changeTimeSpan,
    addPeriod,
    isEditing: editingId !== undefined,
    /** The record being edited, once loaded. */
    editingPolicy: editingQuery.data,
    isLoadingPolicy: editingQuery.isLoading,
    editingError: editingQuery.error,
    isSaving: createMutation.isPending || updateMutation.isPending,
  }
}
