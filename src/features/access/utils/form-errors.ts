import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { ApiError } from '@/lib/api-error'

/**
 * Puts a failed save's field errors (`ApiError.fieldErrors`, 422 or 409) on the form's fields,
 * all at once. `fieldOf` maps API names to form names; a name the form has as is (`email`) is
 * used directly. Anything left over, or an error with no field (a stale row, a refused rule),
 * goes to `root` and shows under the buttons.
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
  const leftOver: string[] = []
  let placed = false
  for (const [key, message] of Object.entries(error.fieldErrors)) {
    const name = fieldOf[key] ?? (fields.includes(key) ? (key as Path<T>) : undefined)
    if (name) {
      setError(name, { type: 'server', message })
      placed = true
    } else leftOver.push(message)
  }
  if (!placed) setError('root', { type: 'server', message: error.message })
  else if (leftOver.length > 0) setError('root', { type: 'server', message: leftOver.join(' ') })
}

/** A refused action's message, for a toast or a line in a dialog. */
export const messageOf = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
