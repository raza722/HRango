import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { ApiError } from '@/lib/api-error'

import {
  rosterGroupFormSchema,
  type RosterGroupFormValues,
} from '../schemas/roster-group-form.schema'
import type { RosterGroup } from '../types/roster.types'
import {
  createDefaultRosterValues,
  toRosterFormValues,
  toRosterInput,
} from '../utils/roster-mappers'
import { useSaveRosterGroup } from './use-roster-groups'

interface UseRosterGroupFormOptions {
  /** The group being edited; `undefined` when adding. */
  group: RosterGroup | undefined
  onSaved: (group: RosterGroup) => void
}

/**
 * "Add Roster Group" / edit form: Zod validation, loading the group, keeping
 * every working day on the default times while "Apply For All" is ticked,
 * and saving (a duplicate title comes back from the API onto the field).
 */
export function useRosterGroupForm({ group, onSaved }: UseRosterGroupFormOptions) {
  const saveMutation = useSaveRosterGroup()
  const values = useMemo(() => (group ? toRosterFormValues(group) : undefined), [group])

  const form = useForm<RosterGroupFormValues>({
    resolver: zodResolver(rosterGroupFormSchema),
    defaultValues: createDefaultRosterValues(),
    values,
    resetOptions: { keepDirtyValues: true },
    mode: 'onTouched',
  })
  const { control, getValues, setValue, setError } = form

  const [applyToAll, clockIn, clockOut, days] = useWatch({
    control,
    name: ['applyToAll', 'clockIn', 'clockOut', 'days'],
  })
  // Re-run when a day is switched between working day and weekend.
  const weekendPattern = days.map((day) => (day.isWeekend ? 'W' : 'D')).join('')

  useEffect(() => {
    if (!applyToAll) return
    getValues('days').forEach((day, index) => {
      if (day.isWeekend) return
      if (day.clockIn !== clockIn) setValue(`days.${index}.clockIn`, clockIn, { shouldDirty: true })
      if (day.clockOut !== clockOut) {
        setValue(`days.${index}.clockOut`, clockOut, { shouldDirty: true })
      }
    })
  }, [applyToAll, clockIn, clockOut, weekendPattern, getValues, setValue])

  const submit = form.handleSubmit(async (formValues) => {
    let saved: RosterGroup
    try {
      saved = await saveMutation.mutateAsync({ id: group?.id, input: toRosterInput(formValues) })
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.title) {
        setError(
          'title',
          { type: 'server', message: error.fieldErrors.title },
          { shouldFocus: true },
        )
      }
      return
    }
    form.reset(formValues)
    onSaved(saved)
  })

  return { form, submit, isSaving: saveMutation.isPending, applyToAll, clockIn, clockOut }
}
