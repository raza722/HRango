import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { ApiError } from '@/lib/api-error'

/**
 * Puts a failed save's field errors (`ApiError.fieldErrors`, 422) on the form's fields.
 * `fieldOf` maps API names to form names (`appraisalCycleId` → `cycleId`); a name the form has
 * as is (`title`, `ratings.0.rating`) is used directly. Anything left over, or an error with no
 * field (409 stale row, 422 rule), goes to `root` and shows under the buttons.
 */
export function showServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
  fieldOf: Partial<Record<string, Path<T>>> = {},
): void {
  if (!(error instanceof ApiError)) {
    setError('root', { message: 'Something went wrong. Please try again.' })
    return
  }
  let placed = false
  for (const [key, message] of Object.entries(error.fieldErrors)) {
    const top = key.split('.')[0] ?? key
    const name =
      fieldOf[key] ?? (fields.includes(key) || fields.includes(top) ? (key as Path<T>) : undefined)
    if (name) {
      setError(name, { type: 'server', message })
      placed = true
    }
  }
  if (!placed) setError('root', { type: 'server', message: error.message })
}
