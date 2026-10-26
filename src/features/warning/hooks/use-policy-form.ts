import { useMemo } from 'react'
import { type FieldPath, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { ApiError } from '@/lib/api-error'

import { policyFormSchema, type PolicyFormValues } from '../schemas/policy-form.schema'
import { type AppliesTo, CLOCK_EVENTS_FOR, maxRulesFor } from '../types/warning-policy.types'
import {
  createDefaultFormValues,
  createEmptyRule,
  createNextRule,
  toFormValues,
  toPolicyInput,
} from '../utils/policy-mappers'
import { useWarningPolicy } from './use-warning-policies'
import { useCreateWarningPolicy, useUpdateWarningPolicy } from './use-warning-policy-mutations'

/** Fields the API may name in `fieldErrors` (`title`, `rules`, `rules.0.clockEvent` …). */
const SERVER_FIELD =
  /^(title|appliesTo|period|graceMinutes|weekStartDay|weekEndDay|rules(\.\d+\.(clockEvent|minutes|occurrenceCount))?)$/

function isServerField(key: string): key is FieldPath<PolicyFormValues> {
  return SERVER_FIELD.test(key)
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
 * Owns the Warning Policy form: schema validation, the rules field array (one per clock event),
 * loading a policy for editing, and the create/update mutations.
 *
 * Flow: Zod schema → RHF → `toPolicyInput` (+ rowVersion) → TanStack mutation → `/api/warning/policies`
 * → list invalidation → table refresh.
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

  const rules = useFieldArray({ control: form.control, name: 'rules', keyName: 'key' })

  /** Clears the form for a brand-new policy. */
  const resetToNew = () => {
    form.reset(createDefaultFormValues())
  }

  /** A new kind of policy keeps only the rules its clock events allow (at least one). */
  const changeAppliesTo = (appliesTo: AppliesTo) => {
    const allowed = CLOCK_EVENTS_FOR[appliesTo]
    const kept = form
      .getValues('rules')
      .filter((rule) => allowed.includes(rule.clockEvent))
      .slice(0, maxRulesFor(appliesTo))
    rules.replace(kept.length > 0 ? kept : [createEmptyRule(allowed[0])])
  }

  /** "+ Add Rule": the clock event that has no rule yet. */
  const addRule = () => {
    const next = createNextRule(form.getValues('appliesTo'), form.getValues('rules'))
    if (next) rules.append(next)
  }

  const submit = form.handleSubmit(async (values) => {
    const input = toPolicyInput(values, editingId ? editingQuery.data?.rowVersion : undefined)
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
    rules,
    /** Legacy (kept for the barrel): Use `rules`. */
    periods: rules,
    submit,
    resetToNew,
    changeAppliesTo,
    addRule,
    /** Legacy (kept for the barrel): Use `addRule`. */
    addPeriod: addRule,
    isEditing: editingId !== undefined,
    /** The record being edited, once loaded. */
    editingPolicy: editingQuery.data,
    isLoadingPolicy: editingQuery.isLoading,
    editingError: editingQuery.error,
    isSaving: createMutation.isPending || updateMutation.isPending,
  }
}
