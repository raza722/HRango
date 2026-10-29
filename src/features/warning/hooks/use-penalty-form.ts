import { useMemo } from 'react'
import { type FieldPath, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { ApiError } from '@/lib/api-error'

import { penaltyFormSchema, type PenaltyFormValues } from '../schemas/penalty-form.schema'
import type { PenaltyPeriod } from '../types/warning-penalty.types'
import type { TimeSpan } from '../types/warning-policy.types'
import {
  createDefaultPenaltyValues,
  createEmptyRule,
  toPenaltyFormValues,
  toPenaltyInput,
} from '../utils/penalty-mappers'
import { useUpdateWarningPenalty, useWarningPenalty } from './use-warning-penalties'

/** `fieldErrors` keys are `penalties`, `penalties.0.percentage` …; the form calls them `rules`. */
function toFormField(key: string): FieldPath<PenaltyFormValues> | null {
  const match =
    /^penalties(?:\.(\d+)\.(afterCount|period|penaltyType|percentage|deduction|leaveTypeId))?$/.exec(
      key,
    )
  if (!match) return null
  const [, index, field] = match
  return index !== undefined && field !== undefined
    ? (`rules.${Number(index)}.${field}` as FieldPath<PenaltyFormValues>)
    : 'rules'
}

/**
 * A penalty counts a policy's warnings in its own period: a weekly policy's penalties count per
 * week, a monthly one's per month. Penalties have no daily period, so a daily policy's count
 * per week, the shortest there is.
 */
export function penaltyPeriodOf(period: TimeSpan | undefined): PenaltyPeriod {
  if (period === 'week' || period === 'month' || period === 'year') return period
  return period === 'day' ? 'week' : 'month'
}

interface UsePenaltyFormOptions {
  /** Id of the policy whose penalties are edited (from `?edit=`), if one is chosen. */
  editingId: string | undefined
  /** Runs after a successful save. */
  onSaved?: (mode: 'created' | 'updated') => Promise<void> | void
}

/**
 * Owns the penalty form: the chosen policy and its penalty rules ("+ Add Penalty"), loaded from
 * the policy and saved back all at once (`PUT /warning/policies/{id}/penalties`).
 */
export function usePenaltyForm({ editingId, onSaved }: UsePenaltyFormOptions) {
  const editingQuery = useWarningPenalty(editingId)
  const saveMutation = useUpdateWarningPenalty()

  const editingValues = useMemo(
    () => (editingId && editingQuery.data ? toPenaltyFormValues(editingQuery.data) : undefined),
    [editingId, editingQuery.data],
  )

  const form = useForm<PenaltyFormValues>({
    resolver: zodResolver(penaltyFormSchema),
    defaultValues: createDefaultPenaltyValues(editingId),
    values: editingValues,
    mode: 'onTouched',
  })

  const rules = useFieldArray({ control: form.control, name: 'rules', keyName: 'key' })

  const resetToNew = () => {
    form.reset(createDefaultPenaltyValues())
  }

  /**
   * "+ Add Penalty": same time span as the last block (the first one takes the policy's period),
   * the next count.
   */
  const addRule = () => {
    const last = form.getValues('rules').at(-1)
    const period = last?.period ?? penaltyPeriodOf(editingQuery.data?.period)
    rules.append(createEmptyRule(period, last ? Number(last.afterCount) + 1 || 1 : 1))
  }

  const submit = form.handleSubmit(async (values) => {
    const policy = editingQuery.data
    if (policy?.id !== values.policyId) {
      form.setError('policyId', { type: 'manual', message: 'Select a policy' })
      return
    }
    const mode = policy.penalties.length > 0 ? 'updated' : 'created'
    try {
      await saveMutation.mutateAsync({
        policyId: policy.id,
        input: toPenaltyInput(values, policy.rowVersion),
      })
    } catch (error) {
      if (error instanceof ApiError) {
        Object.entries(error.fieldErrors).forEach(([key, message]) => {
          const field = toFormField(key)
          if (field) form.setError(field, { type: 'server', message }, { shouldFocus: true })
        })
      }
      return
    }
    await onSaved?.(mode)
  })

  return {
    form,
    rules,
    submit,
    resetToNew,
    addRule,
    isEditing: editingId !== undefined,
    /** The policy whose penalties are edited, once loaded. */
    editingPolicy: editingQuery.data,
    /** Legacy (kept for the barrel): Use `editingPolicy`. */
    editingPenalty: editingQuery.data,
    isLoadingPenalty: editingQuery.isLoading,
    isSaving: saveMutation.isPending,
  }
}
