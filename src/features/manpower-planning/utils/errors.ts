import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form'
import { toast } from 'sonner'

import { ApiError } from '@/lib/api-error'

/**
 * Puts the API's field messages under their fields (`fields` lists the ones the form
 * has); anything else becomes a toast.
 */
export function showSaveError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly FieldPath<T>[],
  fallback: string,
) {
  if (error instanceof ApiError) {
    const known = Object.entries(error.fieldErrors).filter(([path]) =>
      fields.includes(path as FieldPath<T>),
    )
    if (known.length > 0) {
      for (const [path, message] of known) setError(path as FieldPath<T>, { message })
      return
    }
    toast.error(error.message)
    return
  }
  toast.error(fallback)
}

/** A failed list action (delete, approve…) as a toast. */
export const toastError = (fallback: string) => (error: unknown) => {
  toast.error(error instanceof ApiError ? error.message : fallback)
}
