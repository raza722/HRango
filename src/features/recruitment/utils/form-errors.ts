import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { ApiError } from '@/lib/api-error'

/**
 * Puts a failed save's field errors (`ApiError.fieldErrors`, a 422 or 409) on the form's fields.
 * `fieldOf` maps API names to form names (`cvFileId` → `cv`, `applicant.email` → `email`); a name
 * the form has as is is used directly. Anything left over, or an error naming no field, goes to
 * `root`, which the dialogs show beside their buttons.
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
    const plain = key.replace(/^(body\.|applicant\.)/, '')
    const name =
      fieldOf[key] ?? fieldOf[plain] ?? (fields.includes(plain) ? (plain as Path<T>) : undefined)
    if (name) {
      setError(name, { type: 'server', message })
      placed = true
    }
  }
  if (!placed) setError('root', { type: 'server', message: error.message })
}
