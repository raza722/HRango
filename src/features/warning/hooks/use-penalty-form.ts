import { useMemo } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { ApiError } from '@/lib/api-error'

import { penaltyFormSchema, type PenaltyFormValues } from '../schemas/penalty-form.schema'
import {
  createDefaultPenaltyValues,
  createEmptyRule,
  toPenaltyFormValues,
  toPenaltyInput,
} from '../utils/penalty-mappers'
import {
  useCreateWarningPenalty,
  useUpdateWarningPenalty,
  useWarningPenalty,
} from './use-warning-penalties'

const SERVER_FIELDS = ['policyName', 'title', 'scaleType'] as const
type ServerField = (typeof SERVER_FIELDS)[number]

function isServerField(key: string): key is ServerField {
  return SERVER_FIELDS.some((field) => field === key)
}

interface UsePenaltyFormOptions {
  /** Id from `?edit=`, if a penalty is being edited. */
  editingId: string | undefined
  /** Runs after a successful save, before the form is cleared. */
  onSaved?: (mode: 'created' | 'updated') => Promise<void> | void
}

/**
 * Owns the penalty form: Zod validation, the "+ Add Penalty" rules array,
 * loading a record for editing, and the create/update mutations.
 */
export function usePenaltyForm({ editingId, onSaved }: UsePenaltyFormOptions) {
  const editingQuery = useWarningPenalty(editingId)
  const createMutation = useCreateWarningPenalty()
  const updateMutation = useUpdateWarningPenalty()

  const editingValues = useMemo(
    () => (editingId && editingQuery.data ? toPenaltyFormValues(editingQuery.data) : undefined),
    [editingId, editingQuery.data],
  )

  const form = useForm<PenaltyFormValues>({
    resolver: zodResolver(penaltyFormSchema),
    defaultValues: createDefaultPenaltyValues(),
    values: editingValues,
    mode: 'onTouched',
  })

  const rules = useFieldArray({ control: form.control, name: 'rules', keyName: 'key' })

  const resetToNew = () => {
    form.reset(createDefaultPenaltyValues())
  }

  /** "+ Add Penalty": a new block with the same time span as the last one. */
  const addRule = () => {
    const last = form.getValues('rules').at(-1)
    rules.append(createEmptyRule(last?.timeSpan ?? 'weekly'))
  }

  const submit = form.handleSubmit(async (values) => {
    const input = toPenaltyInput(values)
    const mode = editingId ? 'updated' : 'created'
    try {
      if (editingId) await updateMutation.mutateAsync({ id: editingId, input })
      else await createMutation.mutateAsync(input)
    } catch (error) {
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
    form.reset(createDefaultPenaltyValues())
  })

  return {
    form,
    rules,
    submit,
    resetToNew,
    addRule,
    isEditing: editingId !== undefined,
    editingPenalty: editingQuery.data,
    isLoadingPenalty: editingQuery.isLoading,
    isSaving: createMutation.isPending || updateMutation.isPending,
  }
}
