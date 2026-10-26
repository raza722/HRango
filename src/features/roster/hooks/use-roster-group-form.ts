import { useEffect, useMemo } from 'react'
import { type FieldPath, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { ApiError } from '@/lib/api-error'

import {
  rosterGroupFormSchema,
  type RosterGroupFormValues,
} from '../schemas/roster-group-form.schema'
import type { RosterGroupDetail } from '../types/roster.types'
import {
  createDefaultRosterValues,
  toRosterFormValues,
  toRosterInput,
} from '../utils/roster-mappers'
import { useSaveRosterGroup } from './use-roster-groups'

interface UseRosterGroupFormOptions {
  /** The group being edited; `undefined` when adding. */
  group: RosterGroupDetail | undefined
  onSaved: (group: RosterGroupDetail) => void
}

/** Server field names that map onto a form field of the same name. */
const SERVER_FIELDS = [
  'title',
  'fromDate',
  'toDate',
  'description',
] as const satisfies readonly FieldPath<RosterGroupFormValues>[]

/**
 * "Add Roster Group" / edit form: Zod validation, loading the group, keeping every working
 * day on the default time slot while "Apply For All" is ticked, and saving (a duplicate
 * title or a bad period comes back from the API onto the field).
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

  const [applyToAll, defaultTimeSlotId, days] = useWatch({
    control,
    name: ['applyToAll', 'defaultTimeSlotId', 'days'],
  })
  // Re-run when a day is switched between working day and day off.
  const dayOffPattern = days.map((day) => (day.isDayOff ? 'O' : 'W')).join('')

  useEffect(() => {
    if (!applyToAll) return
    getValues('days').forEach((day, index) => {
      if (day.isDayOff || day.timeSlotId === defaultTimeSlotId) return
      setValue(`days.${index}.timeSlotId`, defaultTimeSlotId, { shouldDirty: true })
    })
  }, [applyToAll, defaultTimeSlotId, dayOffPattern, getValues, setValue])

  const submit = form.handleSubmit(async (formValues) => {
    let saved: RosterGroupDetail
    try {
      saved = await saveMutation.mutateAsync({
        id: group?.id,
        input: toRosterInput(formValues, group?.rowVersion),
      })
    } catch (error) {
      if (error instanceof ApiError) {
        const field = SERVER_FIELDS.find((name) => error.fieldErrors[name])
        if (field) {
          setError(
            field,
            { type: 'server', message: error.fieldErrors[field] },
            { shouldFocus: true },
          )
        }
      }
      return
    }
    form.reset(formValues)
    onSaved(saved)
  })

  return { form, submit, isSaving: saveMutation.isPending, applyToAll }
}
