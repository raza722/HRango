import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { ApiError } from '@/lib/api-error'

/**
 * Puts a failed save's field errors (`ApiError.fieldErrors`) on the form's fields. `fieldOf` maps
 * API names to form names (`phone1` → `phone`, `fileId` → `file`); a name the form has as is
 * is used directly. Anything left over, or an error with no field, goes to `root`.
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
    const name = fieldOf[key] ?? (fields.includes(key) ? (key as Path<T>) : undefined)
    if (name) {
      setError(name, { type: 'server', message })
      placed = true
    }
  }
  if (!placed) setError('root', { type: 'server', message: error.message })
}
